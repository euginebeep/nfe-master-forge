# Como Aplicar Migrations Manualmente

Se os scripts automáticos não funcionarem, você pode aplicar as migrations manualmente no Supabase Dashboard.

## Passo a Passo

### 1. Abra o Supabase Dashboard

Acesse: https://supabase.com/dashboard

### 2. Selecione o Projeto

Clique no projeto `brain-erp` (ou o seu projeto).

### 3. Vá para SQL Editor

No menu lateral, clique em **SQL Editor**.

### 4. Crie uma Nova Query

Clique em **+ New Query** ou **New SQL Query**.

### 5. Cole o SQL

Copie o SQL abaixo e cole na query:

```sql
-- Criar tabela sensores para monitoramento de temperatura e umidade
CREATE TABLE IF NOT EXISTS public.sensores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id VARCHAR(50) NOT NULL,
  nome_dispositivo VARCHAR(255),
  nome_sala VARCHAR(255),
  temperatura_minima DECIMAL(5,2),
  temperatura_maxima DECIMAL(5,2),
  umidade_minima DECIMAL(5,2),
  umidade_maxima DECIMAL(5,2),
  responsavel VARCHAR(255),
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(company_id, device_id)
);

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_sensores_company_id ON public.sensores(company_id);
CREATE INDEX IF NOT EXISTS idx_sensores_device_id ON public.sensores(device_id);

-- Habilitar RLS
ALTER TABLE public.sensores ENABLE ROW LEVEL SECURITY;

-- Política de isolamento por tenant
CREATE POLICY "sensores_company_isolation" ON public.sensores
  FOR ALL
  USING (company_id = auth.uid());

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sensores TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sensores TO anon;
```

### 6. Execute a Query

Clique no botão **Run** (ou pressione `Ctrl+Enter`).

### 7. Verifique o Resultado

Se não houver erros, a tabela foi criada com sucesso! ✅

## Verificar se a Tabela foi Criada

Você pode verificar se a tabela foi criada corretamente executando:

```sql
-- Listar todas as tabelas
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Verificar estrutura da tabela sensores
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'sensores'
ORDER BY ordinal_position;
```

## Usar Script para Copiar SQL

Se preferir, você pode usar o script para copiar o SQL automaticamente:

```bash
node scripts/copy-migration-sql.js 20260624_create_sensores_table.sql
```

O SQL será copiado para o clipboard e você pode colar direto no Supabase Dashboard.

## Troubleshooting

### Erro: "relation already exists"

A tabela já foi criada. Você pode ignorar este erro ou usar `DROP TABLE IF EXISTS` antes.

### Erro: "permission denied"

Verifique se você está logado com uma conta que tem permissão para criar tabelas.

### Erro: "invalid syntax"

Verifique se o SQL foi copiado corretamente. Procure por caracteres especiais ou quebras de linha.

## Próximos Passos

Após criar a tabela, você pode:

1. Testar a aplicação
2. Verificar se o erro "Erro ao salvar sensor" foi resolvido
3. Criar novos sensores

## Referências

- [Supabase Dashboard](https://supabase.com/dashboard)
- [Supabase SQL Editor](https://supabase.com/docs/guides/database/sql-editor)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
