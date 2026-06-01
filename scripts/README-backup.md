# Backup BIT-A-BIT do Supabase

Script único: `scripts/backup-supabase-full.sh`

## O que faz
1. **pg_dump completo** (`public`, `auth`, `storage`, `vault`, `extensions`, `graphql`, `net`, `pgsodium`) — schema + data.
2. **pg_dump --data-only do schema `auth`** — preserva **senhas bcrypt**, sessions, MFA, identities, refresh_tokens (impossível via API).
3. **pg_dump --schema-only** — DDL puro para reconstruir uma instância vazia.
4. **Download de TODOS os buckets do Storage** via REST + service role.
5. **Inventário** de Edge Functions e nomes de secrets (via Supabase CLI).
6. **Cópia da pasta `supabase/`** do repo (functions, migrations, config.toml).
7. Empacota tudo num **`.tar.zst`** (ou `.tar.gz`) com `MANIFEST.txt`.

## Pré-requisitos (máquina local)

```bash
# Ubuntu/Debian
sudo apt install -y postgresql-client jq zstd curl rsync
# Supabase CLI (opcional, para listar functions/secrets)
npm i -g supabase
```

## Configurar credenciais

```bash
cp scripts/.env.backup.example scripts/.env.backup
# edite o arquivo e preencha:
#   SUPABASE_PROJECT_REF
#   SUPABASE_DB_PASSWORD       (Dashboard > Settings > Database)
#   SUPABASE_SERVICE_ROLE_KEY  (Dashboard > Settings > API > service_role)
#   SUPABASE_URL
```

> ⚠️ **Nunca** comite `.env.backup`. O `.gitignore` já cobre `*.env*`.

## Executar

```bash
chmod +x scripts/backup-supabase-full.sh
./scripts/backup-supabase-full.sh
```

Saída final: `/mnt/documents/supabase-backup-<ref>-<timestamp>.tar.zst`
(ou no diretório atual se `/mnt/documents` não existir).

## Restaurar em outro projeto Supabase

```bash
tar -I zstd -xf supabase-backup-*.tar.zst
cd supabase-backup-*/

# 1) Cria estrutura
psql "$NEW_DB_URL" -f db/schema-only.sql

# 2) Carrega dados (inclui auth — preserva senhas)
zstd -d < db/dump-full.sql.zst | psql "$NEW_DB_URL"

# 3) Buckets + arquivos
supabase login
for b in storage/*/; do
  bucket=$(basename "$b")
  supabase storage create "ss:///$bucket" --project-ref <new-ref> || true
  supabase storage cp -r "$b" "ss:///$bucket/" --project-ref <new-ref>
done

# 4) Edge Functions (do repo)
cp -r project-config/supabase/functions ./supabase/
supabase functions deploy --project-ref <new-ref>

# 5) Secrets — definir manualmente (apenas NOMES estão em meta/secrets.txt)
supabase secrets set --project-ref <new-ref> NOME=valor
```

## O que NÃO é exportável (limitações do Supabase)

- **Logs históricos** (Auth / Postgres / Edge) — só via Dashboard, retenção limitada.
- **Valores de secrets** (`Vault` e secrets de Edge Functions) — opacos via API.
- **Configuração de Auth** (provedores OAuth, SMTP custom, templates de e-mail, URL allow-list) — refazer no Dashboard ou `supabase/config.toml`.
- **Webhooks externos** (Stripe, etc.) — refazer apontando p/ novo projeto.