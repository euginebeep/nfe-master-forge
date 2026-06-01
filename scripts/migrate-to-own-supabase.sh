#!/usr/bin/env bash
# ============================================================================
# migrate-to-own-supabase.sh
# Migra projeto Lovable Cloud (origem) -> seu próprio Supabase (destino).
#
# Restaura: schema public + auth.users (com senhas bcrypt) + storage metadata
#           + binários de todos os buckets + secrets list (manual).
#
# Requisitos locais:
#   - postgresql-client (>=15) : pg_dump, pg_restore, psql
#   - curl, jq
#   - supabase CLI (opcional, só para deploy de edge functions)
#
# Uso:
#   cp scripts/.env.migrate.example scripts/.env.migrate
#   # edite .env.migrate com as credenciais de origem e destino
#   chmod +x scripts/migrate-to-own-supabase.sh
#   ./scripts/migrate-to-own-supabase.sh [--skip-storage] [--skip-functions] [--dry-run]
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$SCRIPT_DIR/.env.migrate"
TS="$(date -u +%Y%m%d-%H%M%SZ)"
WORK_DIR="${WORK_DIR:-$REPO_ROOT/.migration-$TS}"

SKIP_STORAGE=0
SKIP_FUNCTIONS=0
DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
    --skip-storage)   SKIP_STORAGE=1 ;;
    --skip-functions) SKIP_FUNCTIONS=1 ;;
    --dry-run)        DRY_RUN=1 ;;
    *) echo "Flag desconhecida: $arg"; exit 2 ;;
  esac
done

log()  { printf "\033[1;36m[%s]\033[0m %s\n" "$(date +%H:%M:%S)" "$*"; }
ok()   { printf "\033[1;32m  ✓\033[0m %s\n" "$*"; }
warn() { printf "\033[1;33m  ⚠\033[0m %s\n" "$*"; }
die()  { printf "\033[1;31m  ✗\033[0m %s\n" "$*" >&2; exit 1; }

# ---------- 1. Pré-flight --------------------------------------------------
log "Pré-flight checks"
for bin in pg_dump pg_restore psql curl jq; do
  command -v "$bin" >/dev/null || die "Faltando binário: $bin"
done
ok "Binários OK"

[ -f "$ENV_FILE" ] || die "Crie $ENV_FILE a partir de scripts/.env.migrate.example"
# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a

for v in SRC_PROJECT_REF SRC_DB_PASSWORD SRC_SERVICE_ROLE_KEY \
         DST_PROJECT_REF DST_DB_PASSWORD DST_SERVICE_ROLE_KEY \
         SRC_DB_HOST DST_DB_HOST; do
  [ -n "${!v:-}" ] || die "Variável $v não definida em .env.migrate"
done
ok "Variáveis OK  ($SRC_PROJECT_REF → $DST_PROJECT_REF)"

SRC_URL="https://${SRC_PROJECT_REF}.supabase.co"
DST_URL="https://${DST_PROJECT_REF}.supabase.co"
SRC_DSN="postgresql://postgres:${SRC_DB_PASSWORD}@${SRC_DB_HOST}:5432/postgres?sslmode=require"
DST_DSN="postgresql://postgres:${DST_DB_PASSWORD}@${DST_DB_HOST}:5432/postgres?sslmode=require"

mkdir -p "$WORK_DIR"
log "Workspace: $WORK_DIR"

if [ "$DRY_RUN" = "1" ]; then
  log "Modo DRY-RUN: testando conectividade apenas"
  psql "$SRC_DSN" -c "select current_database(), current_user;" || die "Falha conectando ORIGEM"
  psql "$DST_DSN" -c "select current_database(), current_user;" || die "Falha conectando DESTINO"
  ok "Conectividade OK em ambos os lados"
  exit 0
fi

# ---------- 2. Dump da origem ---------------------------------------------
log "Dump: schema + dados (public, auth, storage)"

# Schema-only primeiro (rápido, valida conexão)
pg_dump "$SRC_DSN" \
  --schema=public --schema=auth --schema=storage \
  --schema-only --no-owner --no-privileges \
  -f "$WORK_DIR/01-schema.sql"
ok "Schema: $(wc -l < "$WORK_DIR/01-schema.sql") linhas"

# Dados em formato custom (paralelo no restore)
pg_dump "$SRC_DSN" \
  --schema=public --schema=auth --schema=storage \
  --data-only --no-owner --disable-triggers \
  -Fc -f "$WORK_DIR/02-data.dump"
ok "Dados: $(du -h "$WORK_DIR/02-data.dump" | cut -f1)"

# ---------- 3. Restore no destino -----------------------------------------
log "Restore no destino"

# Aviso: o destino deve ser um projeto NOVO, vazio.
# Auth/storage já existem no Supabase — restauramos apenas dados nelas.
psql "$DST_DSN" -v ON_ERROR_STOP=0 -f "$WORK_DIR/01-schema.sql" \
  > "$WORK_DIR/03-schema-restore.log" 2>&1 || warn "Schema teve avisos (esperado p/ auth/storage já existentes). Log: 03-schema-restore.log"
ok "Schema aplicado"

pg_restore -d "$DST_DSN" \
  --data-only --disable-triggers --no-owner \
  -j 4 "$WORK_DIR/02-data.dump" \
  > "$WORK_DIR/04-data-restore.log" 2>&1 || warn "Dados tiveram avisos. Log: 04-data-restore.log"
ok "Dados restaurados"

# Reset de sequences
psql "$DST_DSN" -At <<'SQL' | psql "$DST_DSN" -f - >/dev/null
SELECT format(
  'SELECT setval(%L, COALESCE((SELECT MAX(%I) FROM %I.%I), 1));',
  quote_ident(schemaname)||'.'||quote_ident(sequencename),
  'id', schemaname, tablename
)
FROM pg_sequences s
JOIN pg_class c ON c.relname = s.sequencename
WHERE schemaname IN ('public');
SQL
ok "Sequences resetadas"

# ---------- 4. Storage (binários) -----------------------------------------
if [ "$SKIP_STORAGE" = "0" ]; then
  log "Storage: copiando binários bucket a bucket"
  STORAGE_DIR="$WORK_DIR/storage"
  mkdir -p "$STORAGE_DIR"

  BUCKETS=$(curl -fsS \
    -H "Authorization: Bearer $SRC_SERVICE_ROLE_KEY" \
    -H "apikey: $SRC_SERVICE_ROLE_KEY" \
    "$SRC_URL/storage/v1/bucket" | jq -r '.[].name')

  for bucket in $BUCKETS; do
    log "  bucket: $bucket"
    BDIR="$STORAGE_DIR/$bucket"
    mkdir -p "$BDIR"

    # cria bucket no destino (idempotente)
    PUBLIC=$(curl -fsS \
      -H "Authorization: Bearer $SRC_SERVICE_ROLE_KEY" \
      -H "apikey: $SRC_SERVICE_ROLE_KEY" \
      "$SRC_URL/storage/v1/bucket/$bucket" | jq -r '.public')

    curl -fsS -X POST \
      -H "Authorization: Bearer $DST_SERVICE_ROLE_KEY" \
      -H "apikey: $DST_SERVICE_ROLE_KEY" \
      -H "Content-Type: application/json" \
      -d "{\"id\":\"$bucket\",\"name\":\"$bucket\",\"public\":$PUBLIC}" \
      "$DST_URL/storage/v1/bucket" >/dev/null 2>&1 || true

    # lista objetos via SQL (mais rápido e completo que paginar API)
    OBJECTS=$(psql "$SRC_DSN" -At -c \
      "SELECT name FROM storage.objects WHERE bucket_id='$bucket' ORDER BY name;")
    TOTAL=$(echo "$OBJECTS" | grep -c . || true)
    log "    $TOTAL objetos"
    i=0
    while IFS= read -r obj; do
      [ -z "$obj" ] && continue
      i=$((i+1))
      LOCAL="$BDIR/$obj"
      mkdir -p "$(dirname "$LOCAL")"
      # download
      curl -fsS \
        -H "Authorization: Bearer $SRC_SERVICE_ROLE_KEY" \
        -H "apikey: $SRC_SERVICE_ROLE_KEY" \
        "$SRC_URL/storage/v1/object/$bucket/$obj" \
        -o "$LOCAL" || { warn "download falhou: $bucket/$obj"; continue; }
      # upload
      CT=$(file -b --mime-type "$LOCAL" 2>/dev/null || echo "application/octet-stream")
      curl -fsS -X POST \
        -H "Authorization: Bearer $DST_SERVICE_ROLE_KEY" \
        -H "apikey: $DST_SERVICE_ROLE_KEY" \
        -H "Content-Type: $CT" \
        -H "x-upsert: true" \
        --data-binary "@$LOCAL" \
        "$DST_URL/storage/v1/object/$bucket/$obj" >/dev/null \
        || warn "upload falhou: $bucket/$obj"
      [ $((i % 25)) -eq 0 ] && log "    progresso $i/$TOTAL"
    done <<< "$OBJECTS"
    ok "  bucket $bucket: $i objetos"
  done
else
  warn "Storage pulado (--skip-storage)"
fi

# ---------- 5. Edge functions ---------------------------------------------
if [ "$SKIP_FUNCTIONS" = "0" ]; then
  log "Edge functions: deploy via supabase CLI"
  if command -v supabase >/dev/null; then
    pushd "$REPO_ROOT" >/dev/null
    supabase link --project-ref "$DST_PROJECT_REF" --password "$DST_DB_PASSWORD" || warn "supabase link falhou"
    for fn_dir in supabase/functions/*/; do
      fn=$(basename "$fn_dir")
      [ "$fn" = "_shared" ] && continue
      log "  deploy: $fn"
      supabase functions deploy "$fn" --project-ref "$DST_PROJECT_REF" --no-verify-jwt 2>&1 | tail -3 || warn "$fn falhou"
    done
    popd >/dev/null
    ok "Edge functions deployadas"
  else
    warn "supabase CLI não encontrado — pule ou instale: https://supabase.com/docs/guides/cli"
  fi
else
  warn "Edge functions puladas (--skip-functions)"
fi

# ---------- 6. Secrets (instruções) ---------------------------------------
log "Secrets — ação manual necessária"
cat <<EOF

  Os secrets do projeto origem NÃO podem ser exportados via API.
  Configure-os no destino acessando:
    https://supabase.com/dashboard/project/${DST_PROJECT_REF}/settings/functions

  Secrets esperados (baseado no projeto origem):
    - LOVABLE_API_KEY
    - STRIPE_SECRET_KEY
    - SMTP_USER / SMTP_PASS
    - FIRECRAWL_API_KEY
    - (SUPABASE_* são auto-injetados pelo destino)

EOF

# ---------- 7. Resumo ------------------------------------------------------
log "Migração concluída"
echo "  Workspace : $WORK_DIR"
echo "  Logs      : $WORK_DIR/*.log"
echo ""
echo "  Próximos passos:"
echo "    1. Validar contagens:  psql \"\$DST_DSN\" -c \"SELECT schemaname,relname,n_live_tup FROM pg_stat_user_tables ORDER BY n_live_tup DESC LIMIT 20;\""
echo "    2. Configurar secrets no dashboard do destino"
echo "    3. No Lovable: Connectors → desconectar Lovable Cloud → Connect Supabase (ref $DST_PROJECT_REF)"
echo "    4. Atualizar VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY (auto via Lovable)"
echo ""