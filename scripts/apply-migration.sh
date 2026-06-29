#!/bin/bash

# Script para aplicar migrations no Supabase
# Uso: ./scripts/apply-migration.sh [migration-file]

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configurações
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
MIGRATIONS_DIR="$PROJECT_ROOT/supabase/migrations"

# Verificar variáveis de ambiente
if [ -z "$VITE_FRONTEND_FORGE_API_URL" ]; then
  echo -e "${RED}❌ Erro: VITE_FRONTEND_FORGE_API_URL não está definida${NC}"
  exit 1
fi

if [ -z "$VITE_FRONTEND_FORGE_API_KEY" ]; then
  echo -e "${RED}❌ Erro: VITE_FRONTEND_FORGE_API_KEY não está definida${NC}"
  exit 1
fi

# Função para exibir ajuda
show_help() {
  cat << EOF
${BLUE}🚀 Script de Migrations Supabase${NC}

${YELLOW}Uso:${NC}
  ./scripts/apply-migration.sh [migration-file]
  ./scripts/apply-migration.sh all

${YELLOW}Exemplos:${NC}
  ./scripts/apply-migration.sh 20260624_create_sensores_table.sql
  ./scripts/apply-migration.sh all

${YELLOW}Variáveis de Ambiente:${NC}
  VITE_FRONTEND_FORGE_API_URL  - URL do Supabase
  VITE_FRONTEND_FORGE_API_KEY  - Chave da API Supabase

${YELLOW}Diretório de Migrations:${NC}
  $MIGRATIONS_DIR

EOF
}

# Função para aplicar uma migration
apply_migration() {
  local migration_file="$1"
  local full_path="$MIGRATIONS_DIR/$migration_file"
  
  if [ ! -f "$full_path" ]; then
    echo -e "${RED}❌ Arquivo não encontrado: $full_path${NC}"
    return 1
  fi
  
  echo -e "${BLUE}📄 Lendo migration: $(basename "$full_path")${NC}"
  
  # Ler o conteúdo do arquivo
  local sql=$(cat "$full_path")
  
  echo -e "${YELLOW}⏳ Aplicando migration...${NC}"
  
  # Executar via Node.js
  node "$SCRIPT_DIR/apply-migration.js" "$migration_file"
}

# Função para aplicar todas as migrations
apply_all_migrations() {
  if [ ! -d "$MIGRATIONS_DIR" ]; then
    echo -e "${YELLOW}ℹ️  Diretório de migrations não existe: $MIGRATIONS_DIR${NC}"
    return 0
  fi
  
  local files=($(find "$MIGRATIONS_DIR" -name "*.sql" | sort))
  
  if [ ${#files[@]} -eq 0 ]; then
    echo -e "${YELLOW}ℹ️  Nenhuma migration encontrada${NC}"
    return 0
  fi
  
  echo -e "${BLUE}📋 Encontradas ${#files[@]} migration(s)${NC}"
  
  for file in "${files[@]}"; do
    echo -e "\n${BLUE}📌 Aplicando: $(basename "$file")${NC}"
    apply_migration "$(basename "$file")" || true
  done
  
  return 0
}

# Main
if [ $# -eq 0 ]; then
  show_help
  exit 0
fi

target="$1"

if [ "$target" = "all" ]; then
  apply_all_migrations
elif [ "$target" = "-h" ] || [ "$target" = "--help" ]; then
  show_help
else
  apply_migration "$target"
fi
