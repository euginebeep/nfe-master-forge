# 🌡️ Setup da Tabela Sensores Ambientais - Guia Passo a Passo

## ⚡ Resumo

Este guia mostra como criar a tabela `ambiental_sensores` no Supabase em 5 minutos.

---

## 📋 Passo 1: Abrir o Supabase Dashboard

1. Acesse: **https://supabase.com/dashboard**
2. Faça login com sua conta
3. Selecione o projeto **brain-erp** (ou seu projeto)

---

## 📝 Passo 2: Abrir o SQL Editor

1. No menu lateral esquerdo, clique em **SQL Editor**
2. Clique em **+ New Query** ou **New SQL Query**

---

## 📌 Passo 3: Copiar o SQL

Copie TODO o SQL abaixo:

```sql
-- Criar tabela ambiental_sensores para armazenar configurações de sensores IoT
CREATE TABLE IF NOT EXISTS public.ambiental_sensores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  device_id VARCHAR(50) NOT NULL,
  device_name VARCHAR(255),
  sala VARCHAR(255) NOT NULL,
  room_name VARCHAR(255),
  temp_min DECIMAL(5,2) NOT NULL DEFAULT 18,
  temp_max DECIMAL(5,2) NOT NULL DEFAULT 25,
  hum_min DECIMAL(5,2) NOT NULL DEFAULT 40,
  hum_max DECIMAL(5,2) NOT NULL DEFAULT 60,
  responsible VARCHAR(255),
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(company_id, device_id)
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_ambiental_sensores_company_id ON public.ambiental_sensores(company_id);
CREATE INDEX IF NOT EXISTS idx_ambiental_sensores_device_id ON public.ambiental_sensores(device_id);
CREATE INDEX IF NOT EXISTS idx_ambiental_sensores_sala ON public.ambiental_sensores(sala);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.ambiental_sensores ENABLE ROW LEVEL SECURITY;

-- Política de isolamento por tenant
CREATE POLICY "ambiental_sensores_company_isolation" ON public.ambiental_sensores
  FOR ALL
  USING (company_id = (SELECT company_id FROM auth.users WHERE id = auth.uid()));

-- Conceder permissões
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ambiental_sensores TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ambiental_sensores TO anon;
```

---

## 🔗 Passo 4: Colar no Editor

1. Clique na área de edição (onde está escrito "SELECT...")
2. Pressione **Ctrl+A** para selecionar tudo
3. Pressione **Ctrl+V** para colar o SQL

---

## ▶️ Passo 5: Executar

1. Clique no botão **RUN** (ou pressione **Ctrl+Enter**)
2. Aguarde alguns segundos

---

## ✅ Passo 6: Verificar Sucesso

Se aparecer uma mensagem verde com "Query executed successfully", a tabela foi criada! 🎉

Se aparecer um erro, veja a seção **Troubleshooting** abaixo.

---

## 🔍 Verificar se a Tabela Existe

Para confirmar que a tabela foi criada corretamente, execute este SQL:

```sql
-- Listar todas as tabelas
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

Você deve ver `ambiental_sensores` na lista.

---

## 🐛 Troubleshooting

### ❌ Erro: "relation already exists"

**Solução**: A tabela já foi criada. Você pode ignorar este erro ou executar:

```sql
DROP TABLE IF EXISTS public.ambiental_sensores CASCADE;
```

Depois execute o SQL novamente.

### ❌ Erro: "permission denied"

**Solução**: Verifique se você está logado com uma conta que tem permissão para criar tabelas. Tente usar uma conta com role `admin`.

### ❌ Erro: "invalid syntax"

**Solução**: Verifique se o SQL foi copiado corretamente. Procure por caracteres especiais ou quebras de linha incomuns.

### ❌ Nenhuma mensagem de sucesso

**Solução**: Aguarde alguns segundos. Às vezes o Supabase leva um tempo para processar.

---

## 📚 Próximos Passos

Após criar a tabela:

1. ✅ Volte para o BrainX ERP
2. ✅ Vá para **Configuração → Monitoramento Ambiental**
3. ✅ Tente adicionar um novo sensor
4. ✅ O erro "Erro ao salvar sensor" deve desaparecer
5. ✅ Configure seus sensores IoT

---

## 📊 Estrutura da Tabela

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | Identificador único |
| `company_id` | UUID | Empresa (tenant) |
| `device_id` | VARCHAR(50) | ID do dispositivo IoT |
| `device_name` | VARCHAR(255) | Nome do dispositivo |
| `sala` | VARCHAR(255) | Nome da sala/ambiente |
| `room_name` | VARCHAR(255) | Alias para sala |
| `temp_min` | DECIMAL | Temperatura mínima permitida |
| `temp_max` | DECIMAL | Temperatura máxima permitida |
| `hum_min` | DECIMAL | Umidade mínima permitida |
| `hum_max` | DECIMAL | Umidade máxima permitida |
| `responsible` | VARCHAR(255) | Responsável pelo sensor |
| `ativo` | BOOLEAN | Sensor ativo/inativo |
| `created_at` | TIMESTAMP | Data de criação |
| `updated_at` | TIMESTAMP | Data de atualização |

---

## 🔐 Segurança

- ✅ RLS habilitado para isolamento por tenant
- ✅ Política de isolamento por `company_id`
- ✅ Permissões configuradas para usuários autenticados

---

## ⏱️ Tempo Estimado

- Copiar SQL: **1 minuto**
- Colar no editor: **1 minuto**
- Executar: **1 minuto**
- Verificar: **1 minuto**

**Total: ~5 minutos** ⚡

---

**Boa sorte! 🚀**
