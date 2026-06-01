#!/usr/bin/env bash
# Exporta todo o banco usando a edge function `export-database`
# sem precisar de DB password nem service_role key.
#
# Pré-requisitos:
#   1. Você está logado no app (https://nfe-master-forge.lovable.app) como ADMIN.
#   2. Pegue seu JWT no DevTools:
#        localStorage → sb-lvptvswvqjhvobdvgfws-auth-token → .access_token
#   3. export USER_JWT="eyJ..."
#
# Uso:
#   chmod +x scripts/export-via-edge.sh
#   ./scripts/export-via-edge.sh
set -euo pipefail

: "${USER_JWT:?Defina USER_JWT com seu access_token de admin}"

FN="https://lvptvswvqjhvobdvgfws.supabase.co/functions/v1/export-database"
OUT="${OUT:-./.export-$(date -u +%Y%m%d-%H%M%SZ)}"
mkdir -p "$OUT/tables" "$OUT/storage"

H=(-H "Authorization: Bearer $USER_JWT")

echo "▶ manifest"
curl -fsS "${H[@]}" "$FN?mode=manifest" | tee "$OUT/manifest.json" | jq '.tables | length' >/dev/null

echo "▶ schema.sql"
curl -fsS "${H[@]}" "$FN?mode=schema" -o "$OUT/schema.sql"

echo "▶ tabelas (paginado, 1000 linhas por página)"
jq -r '.tables[].relname' "$OUT/manifest.json" | while read -r T; do
  echo "   • $T"
  off=0
  page=0
  while :; do
    F="$OUT/tables/${T}_$(printf '%04d' $page).json"
    R=$(curl -fsS "${H[@]}" "$FN?mode=table&name=$T&offset=$off&limit=1000")
    echo "$R" > "$F"
    NEXT=$(echo "$R" | jq -r '.next_offset // empty')
    [ -z "$NEXT" ] && break
    off=$NEXT; page=$((page+1))
  done
done

echo "▶ storage-list (metadados)"
curl -fsS "${H[@]}" "$FN?mode=storage-list" -o "$OUT/storage-list.json"

echo "▶ storage: signed URLs por bucket (1h)"
jq -r '.buckets | keys[]' "$OUT/storage-list.json" | while read -r B; do
  echo "   • bucket $B"
  curl -fsS "${H[@]}" "$FN?mode=storage-urls&bucket=$B" -o "$OUT/storage/${B}-urls.json"
  # baixa binários
  mkdir -p "$OUT/storage/$B"
  jq -r '.urls[] | select(.error==null) | "\(.path)\t\(.signedUrl)"' "$OUT/storage/${B}-urls.json" \
  | while IFS=$'\t' read -r P URL; do
      mkdir -p "$OUT/storage/$B/$(dirname "$P")"
      curl -fsS "$URL" -o "$OUT/storage/$B/$P" || echo "      ⚠ falhou: $P"
    done
done

echo "✅ Concluído em: $OUT"