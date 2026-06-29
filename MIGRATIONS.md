# Migrations Supabase

Este documento descreve como gerenciar migrations do banco de dados Supabase.

## Estrutura

```
supabase/
├── migrations/
│   ├── 20260624_create_sensores_table.sql
│   └── ...
└── config.toml
```

## Aplicar Migrations

### Opção 1: Via Script Node.js (Recomendado)

```bash
# Aplicar uma migration específica
node scripts/apply-migration.js 20260624_create_sensores_table.sql

# Aplicar todas as migrations
node scripts/apply-migration.js all
```

### Opção 2: Via Script Bash

```bash
# Aplicar uma migration específica
./scripts/apply-migration.sh 20260624_create_sensores_table.sql

# Aplicar todas as migrations
./scripts/apply-migration.sh all
```

### Opção 3: Manualmente no Supabase Dashboard

1. Abra o [Supabase Dashboard](https://supabase.com/dashboard)
2. Vá para **SQL Editor**
3. Copie o conteúdo do arquivo `.sql`
4. Cole e execute

### Opção 4: Via Supabase CLI

```bash
# Instalar Supabase CLI
npm install -g supabase

# Aplicar migrations
supabase db push

# Ver status das migrations
supabase migration list
```

## Criar Nova Migration

1. Crie um arquivo em `supabase/migrations/` com o padrão:
   ```
   YYYYMMDD_descricao_da_migracao.sql
   ```

2. Exemplo:
   ```bash
   touch supabase/migrations/20260624_create_sensores_table.sql
   ```

3. Adicione o SQL:
   ```sql
   CREATE TABLE sensores (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     ...
   );
   ```

4. Commit e push:
   ```bash
   git add supabase/migrations/
   git commit -m "feat: adicionar migration para sensores"
   git push origin main
   ```

5. Aplique a migration:
   ```bash
   node scripts/apply-migration.js 20260624_create_sensores_table.sql
   ```

## Variáveis de Ambiente

As seguintes variáveis de ambiente são necessárias:

- `VITE_FRONTEND_FORGE_API_URL`: URL do Supabase (ex: `https://xxx.supabase.co`)
- `VITE_FRONTEND_FORGE_API_KEY`: Chave da API Supabase

Estas são carregadas automaticamente do arquivo `.env.local` ou `.env`.

## Migrations Disponíveis

### 20260624_create_sensores_table.sql

Cria a tabela `sensores` para monitoramento de temperatura e umidade.

**Campos:**
- `id`: UUID primária
- `company_id`: Referência ao tenant
- `device_id`: ID único do dispositivo
- `nome_dispositivo`: Nome do sensor
- `nome_sala`: Localização do sensor
- `temperatura_minima`: Limite mínimo de temperatura
- `temperatura_maxima`: Limite máximo de temperatura
- `umidade_minima`: Limite mínimo de umidade
- `umidade_maxima`: Limite máximo de umidade
- `responsavel`: Pessoa responsável
- `ativo`: Status do sensor
- `created_at`: Data de criação
- `updated_at`: Data de atualização

**Segurança:**
- RLS habilitado
- Isolamento por tenant (company_id)
- Índices para performance

## Troubleshooting

### Erro: "relation does not exist"

A migration não foi aplicada. Execute:

```bash
node scripts/apply-migration.js all
```

### Erro: "permission denied"

Verifique se a chave da API tem permissões suficientes. Use uma chave com role `anon` ou `authenticated`.

### Erro: "VITE_FRONTEND_FORGE_API_KEY não está definida"

Defina as variáveis de ambiente:

```bash
export VITE_FRONTEND_FORGE_API_URL="https://xxx.supabase.co"
export VITE_FRONTEND_FORGE_API_KEY="your-key-here"
```

## Boas Práticas

1. **Sempre versionize**: Use timestamps nos nomes dos arquivos
2. **Descreva bem**: Use nomes descritivos para migrations
3. **Teste localmente**: Aplique as migrations em desenvolvimento primeiro
4. **Commit antes de aplicar**: Sempre faça commit das migrations antes de aplicar
5. **Documente mudanças**: Adicione comentários explicativos no SQL
6. **Use transações**: Envolva operações em `BEGIN; ... COMMIT;`

## Referências

- [Supabase Migrations](https://supabase.com/docs/guides/cli/managing-migrations)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Supabase Dashboard](https://supabase.com/dashboard)
