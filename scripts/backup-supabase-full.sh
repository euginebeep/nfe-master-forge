#!/usr/bin/env bash
# =============================================================================
#  backup-supabase-full.sh  —  Backup BIT-A-BIT do Supabase (BrainX ERP)
# -----------------------------------------------------------------------------
#  Gera, em um único diretório com timestamp:
#    1. pg_dump COMPLETO (schema + data) de todos os schemas (public, auth,
#       storage, vault parcial, extensões, etc.)  -> dump.sql.gz
#    2. pg_dump --data-only do schema `auth` (senhas bcrypt, sessions, MFA,
#       identities, refresh_tokens)               -> auth-data.sql.gz
#    3. pg_dump --schema-only (DDL puro p/ recriar instância)
#                                                  -> schema.sql
#    4. Download de TODOS os buckets do Storage   -> storage/<bucket>/...
#    5. Lista de Edge Functions e secrets (nomes) -> functions.txt / secrets.txt
#    6. Cópia da pasta supabase/ do projeto       -> project-config/
#    7. Tudo empacotado em UM .tar.zst final
#
#  Requisitos LOCAIS:
#    - bash 4+, curl, jq, tar, zstd (opcional, gzip se faltar)
#    - postgresql-client (pg_dump 15+)         -> apt install postgresql-client
#    - Supabase CLI v1.150+                    -> https://supabase.com/docs/guides/cli
#
#  Variáveis necessárias (defina antes ou via .env ao lado do script):
#    SUPABASE_PROJECT_REF        ex: lvptvswvqjhvobdvgfws
#    SUPABASE_DB_PASSWORD        senha do role 'postgres' (Dashboard > Settings > Database)
#    SUPABASE_SERVICE_ROLE_KEY   service role key (Dashboard > API)
#    SUPABASE_URL                ex: https://lvptvswvqjhvobdvgfws.supabase.co
#    (opcional) SUPABASE_ACCESS_TOKEN  para 'supabase functions list'
#
#  Uso:
#    chmod +x scripts/backup-supabase-full.sh
#    ./scripts/backup-supabase-full.sh
#    # ou com .env:
#    set -a; source scripts/.env.backup; set +a; ./scripts/backup-supabase-full.sh
# =============================================================================

set -euo pipefail

# ----- carregar .env se existir ----------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "$SCRIPT_DIR/.env.backup" ]]; then
  # shellcheck disable=SC1091
  set -a; source "$SCRIPT_DIR/.env.backup"; set +a
fi

# ----- validações ------------------------------------------------------------
req() { local v="${!1:-}"; [[ -n "$v" ]] || { echo "❌ Variável $1 não definida"; exit 1; }; }
req SUPABASE_PROJECT_REF
req SUPABASE_DB_PASSWORD
req SUPABASE_SERVICE_ROLE_KEY
req SUPABASE_URL

command -v pg_dump >/dev/null || { echo "❌ pg_dump não encontrado (apt install postgresql-client)"; exit 1; }
command -v curl    >/dev/null || { echo "❌ curl não encontrado"; exit 1; }
command -v jq      >/dev/null || { echo "❌ jq não encontrado (apt install jq)"; exit 1; }

COMPRESS_CMD="gzip -9"; COMPRESS_EXT="gz"
if command -v zstd >/dev/null; then COMPRESS_CMD="zstd -19 -T0 -q"; COMPRESS_EXT="zst"; fi

TS="$(date -u +%Y%m%d-%H%M%SZ)"
OUT_DIR="${OUT_DIR:-/tmp/supabase-backup-$SUPABASE_PROJECT_REF-$TS}"
mkdir -p "$OUT_DIR"/{db,storage,project-config,meta}

echo "📦 Saída: $OUT_DIR"
echo "🔗 Projeto: $SUPABASE_PROJECT_REF"

# ----- string de conexão Postgres (pooler IPv4, porta 6543 não suporta pg_dump;
#       use a direta 5432 do db.<ref>.supabase.co) ---------------------------
PGHOST="db.${SUPABASE_PROJECT_REF}.supabase.co"
PGPORT="5432"
PGUSER="postgres"
PGDATABASE="postgres"
PGPASSWORD_ENC="$(jq -rn --arg v "$SUPABASE_DB_PASSWORD" '$v|@uri')"
CONN_URI="postgresql://${PGUSER}:${PGPASSWORD_ENC}@${PGHOST}:${PGPORT}/${PGDATABASE}?sslmode=require"

export PGPASSWORD="$SUPABASE_DB_PASSWORD"
export PGSSLMODE=require

# ============================================================================
# 1) pg_dump completo (custom format, paralelizável na restore)
# ============================================================================
echo "▶️  [1/6] pg_dump COMPLETO (schema + data, todos os schemas)..."
pg_dump "$CONN_URI" \
  --format=plain --no-owner --no-privileges \
  --schema=public --schema=auth --schema=storage \
  --schema=extensions --schema=graphql --schema=graphql_public \
  --schema=net --schema=pgsodium --schema=vault \
  | $COMPRESS_CMD > "$OUT_DIR/db/dump-full.sql.$COMPRESS_EXT"
echo "   ✅ db/dump-full.sql.$COMPRESS_EXT  ($(du -h "$OUT_DIR/db/dump-full.sql.$COMPRESS_EXT" | cut -f1))"

# ============================================================================
# 2) pg_dump APENAS data do schema auth (essencial p/ migrar usuários
#    preservando senhas bcrypt, identities, MFA, refresh_tokens)
# ============================================================================
echo "▶️  [2/6] pg_dump --data-only schema=auth (preserva senhas dos usuários)..."
pg_dump "$CONN_URI" --data-only --no-owner --schema=auth \
  | $COMPRESS_CMD > "$OUT_DIR/db/auth-data.sql.$COMPRESS_EXT"
echo "   ✅ db/auth-data.sql.$COMPRESS_EXT"

# ============================================================================
# 3) pg_dump APENAS schema (DDL p/ rebuild rápido)
# ============================================================================
echo "▶️  [3/6] pg_dump --schema-only (DDL puro)..."
pg_dump "$CONN_URI" --schema-only --no-owner --no-privileges \
  > "$OUT_DIR/db/schema-only.sql"
echo "   ✅ db/schema-only.sql"

# ============================================================================
# 4) Storage: listar buckets via REST e baixar TODOS os objetos
# ============================================================================
echo "▶️  [4/6] Storage: listando buckets..."
BUCKETS_JSON="$(curl -fsS "${SUPABASE_URL}/storage/v1/bucket" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY")"
echo "$BUCKETS_JSON" | jq . > "$OUT_DIR/meta/buckets.json"

# função recursiva: lista todos os objetos de um bucket usando paginação
list_bucket() {
  local bucket="$1" prefix="${2:-}" offset=0 limit=1000
  while :; do
    local body
    body=$(jq -nc --arg p "$prefix" --argjson l "$limit" --argjson o "$offset" \
              '{prefix:$p, limit:$l, offset:$o, sortBy:{column:"name",order:"asc"}}')
    local resp
    resp=$(curl -fsS -X POST "${SUPABASE_URL}/storage/v1/object/list/${bucket}" \
              -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
              -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
              -H "Content-Type: application/json" \
              --data "$body")
    local n
    n=$(echo "$resp" | jq 'length')
    [[ "$n" -eq 0 ]] && break
    while IFS=$'\t' read -r name id meta_size; do
      local full="${prefix:+$prefix/}$name"
      if [[ "$id" == "null" ]]; then
        list_bucket "$bucket" "$full"
      else
        echo "$full"
      fi
    done < <(echo "$resp" | jq -r '.[] | [.name, (.id//"null"), (.metadata.size//0)] | @tsv')
    [[ "$n" -lt "$limit" ]] && break
    offset=$((offset + limit))
  done
}

TOTAL_FILES=0
for BUCKET in $(echo "$BUCKETS_JSON" | jq -r '.[].id'); do
  echo "   📂 bucket: $BUCKET"
  mkdir -p "$OUT_DIR/storage/$BUCKET"
  N=0
  while IFS= read -r OBJ_PATH; do
    [[ -z "$OBJ_PATH" ]] && continue
    LOCAL="$OUT_DIR/storage/$BUCKET/$OBJ_PATH"
    mkdir -p "$(dirname "$LOCAL")"
    # URL-encode cada segmento do path
    ENC=$(printf '%s' "$OBJ_PATH" | jq -sRr @uri)
    if curl -fsS -o "$LOCAL" \
         -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
         -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
         "${SUPABASE_URL}/storage/v1/object/${BUCKET}/${ENC}"; then
      N=$((N+1))
    else
      echo "      ⚠️  falhou: $OBJ_PATH"
    fi
  done < <(list_bucket "$BUCKET")
  echo "      → $N arquivo(s)"
  TOTAL_FILES=$((TOTAL_FILES + N))
done
echo "   ✅ Storage: $TOTAL_FILES arquivo(s) totais"

# ============================================================================
# 5) Lista de Edge Functions e nomes de secrets
# ============================================================================
echo "▶️  [5/6] Inventário de Edge Functions & secrets..."
if command -v supabase >/dev/null && [[ -n "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  supabase functions list --project-ref "$SUPABASE_PROJECT_REF" \
      > "$OUT_DIR/meta/functions.txt" 2>&1 || true
  supabase secrets list --project-ref "$SUPABASE_PROJECT_REF" \
      > "$OUT_DIR/meta/secrets.txt" 2>&1 || true
else
  echo "(Supabase CLI ou SUPABASE_ACCESS_TOKEN ausente — pulando inventário)" \
      > "$OUT_DIR/meta/functions.txt"
fi

# ============================================================================
# 6) Configuração local do projeto (código-fonte das functions, migrations,
#     config.toml, RLS) — copia a pasta `supabase/` do repo
# ============================================================================
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
if [[ -d "$REPO_ROOT/supabase" ]]; then
  echo "▶️  [6/6] Copiando supabase/ (functions + migrations + config.toml)..."
  rsync -a --exclude '.temp' --exclude 'node_modules' \
        "$REPO_ROOT/supabase/" "$OUT_DIR/project-config/supabase/"
  echo "   ✅ project-config/supabase/"
else
  echo "   ℹ️  pasta supabase/ não encontrada no repo — pulando"
fi

# ============================================================================
# MANIFEST + Empacotamento final
# ============================================================================
cat > "$OUT_DIR/MANIFEST.txt" <<EOF
================================================================
  BACKUP BIT-A-BIT - SUPABASE PROJECT ${SUPABASE_PROJECT_REF}
================================================================
Gerado em: ${TS}
Host DB:   ${PGHOST}:${PGPORT}

ESTRUTURA:
  db/dump-full.sql.${COMPRESS_EXT}    Dump completo (schema + data) de
                                       public, auth, storage, extensions, vault,
                                       graphql, net, pgsodium.
  db/auth-data.sql.${COMPRESS_EXT}    Apenas DATA do schema auth (senhas bcrypt,
                                       sessions, identities, MFA, refresh_tokens).
  db/schema-only.sql                  DDL puro p/ recriar a instância.
  storage/<bucket>/...                Binários de TODOS os buckets do Storage.
  meta/buckets.json                   Definições dos buckets.
  meta/functions.txt                  Lista de Edge Functions (via Supabase CLI).
  meta/secrets.txt                    Nomes dos secrets (valores NÃO incluídos).
  project-config/supabase/            Código-fonte: functions, migrations, config.

RESTAURAÇÃO (resumo):
  1) Criar projeto Supabase novo.
  2) psql "<NEW_DB_URL>" -f db/schema-only.sql           # ou aplicar migrations
  3) gunzip -c db/dump-full.sql.${COMPRESS_EXT} | psql "<NEW_DB_URL>"
  4) Recriar buckets (meta/buckets.json) e fazer upload de storage/* via CLI:
       supabase storage cp -r storage/<bucket>/* ss:///<bucket>/
  5) Definir secrets manualmente (meta/secrets.txt lista os NOMES).
  6) Deploy de Edge Functions:
       supabase functions deploy --project-ref <new-ref>

OBSERVAÇÕES:
- Secrets do Vault e Edge Functions são opacos via API — só os NOMES são listados.
- Logs históricos (Auth / Postgres / Edge) NÃO são exportáveis via pg_dump.
- Configurações de Auth (provedores OAuth, SMTP, URL allow-list, templates)
  precisam ser reconfiguradas manualmente no Dashboard ou via config.toml.
EOF

echo
echo "▶️  Empacotando..."
FINAL="/mnt/documents/supabase-backup-${SUPABASE_PROJECT_REF}-${TS}.tar.${COMPRESS_EXT}"
mkdir -p /mnt/documents 2>/dev/null || FINAL="${OUT_DIR}.tar.${COMPRESS_EXT}"

if [[ "$COMPRESS_EXT" == "zst" ]]; then
  tar -C "$(dirname "$OUT_DIR")" -cf - "$(basename "$OUT_DIR")" \
    | zstd -19 -T0 -q -o "$FINAL"
else
  tar -C "$(dirname "$OUT_DIR")" -czf "$FINAL" "$(basename "$OUT_DIR")"
fi

echo
echo "✅ CONCLUÍDO"
echo "   Pasta:    $OUT_DIR"
echo "   Arquivo:  $FINAL  ($(du -h "$FINAL" | cut -f1))"
echo
echo "Para restaurar em outro projeto, leia o MANIFEST.txt dentro do tar."