# Script de Migração: Nuvem Fiscal → Focus NFe no BrainX ERP

Este documento detalha todos os passos necessários para migrar o emissor de NF-e do BrainX ERP da Nuvem Fiscal para a Focus NFe, mantendo a arquitetura multi-tenant intacta.

## 1. Banco de Dados (Supabase)

A Focus NFe gerencia as empresas (clientes do ERP) por um ID interno próprio, assim como a Nuvem Fiscal. Precisamos adicionar colunas para armazenar essa referência.

Execute a seguinte migration SQL no Supabase:

```sql
-- 1. Adicionar novas colunas para Focus NFe
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS focus_nfe_empresa_id TEXT,
  ADD COLUMN IF NOT EXISTS focus_nfe_status TEXT;

-- 2. Adicionar coluna na tabela de notas
ALTER TABLE public.notas_saida 
  ADD COLUMN IF NOT EXISTS focus_nfe_id TEXT;

-- 3. Criar função de validação de acesso RLS
CREATE OR REPLACE FUNCTION public.validar_acesso_nota_saida_focus(p_focus_nfe_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.notas_saida n
    JOIN public.profiles p ON p.company_id = n.company_id
    WHERE n.focus_nfe_id = p_focus_nfe_id
      AND p.id = auth.uid()
  );
$$;
```

## 2. Configuração do Supabase Edge Functions

A Focus NFe usa autenticação Basic Auth com um token de produção. Não usa o fluxo complexo de OAuth2 `client_credentials` da Nuvem Fiscal, o que simplifica muito a arquitetura.

Adicione o token da Focus NFe aos secrets do Supabase:

```bash
supabase secrets set FOCUS_NFE_TOKEN="seu_token_de_producao_aqui"
```

## 3. Deploy da Nova Edge Function

Foi criada uma nova Edge Function `focus-nfe` que substitui a `nuvem-fiscal`. Ela já está com o código adaptado para a API da Focus NFe.

Para fazer o deploy:

```bash
supabase functions deploy focus-nfe
```

### Diferenças Técnicas Implementadas na Edge Function:
1. **Autenticação:** Trocada de Bearer OAuth2 para Basic Auth.
2. **Endpoint de Empresas:** Alterado de `POST /empresas` (Nuvem Fiscal) para `POST /v2/empresas` (Focus NFe).
3. **Consulta de Empresas:** Alterado de path param `GET /empresas/:cnpj` para query param `GET /v2/empresas?cnpj=:cnpj`.
4. **Emissão de NFe:** A Focus NFe exige um parâmetro `ref` na URL para controle de idempotência (`POST /v2/nfe?ref=...`), diferente da Nuvem Fiscal que recebe tudo no body.
5. **Cancelamento:** Alterado de `POST /nfe/:id/cancelamento` para `DELETE /v2/nfe/:id`.
6. **Carta de Correção:** Alterado de `POST /nfe/:id/carta-correcao` para `POST /v2/nfe/:id/carta_correcao` (snake_case).

## 4. Alterações no Frontend (React)

O hook `use-nuvem-fiscal.ts` deve ser renomeado para `use-focus-nfe.ts` e atualizado para chamar a nova Edge Function.

**Arquivo: `src/hooks/use-focus-nfe.ts`**

```typescript
import { supabase } from "@/integrations/supabase/client";

const PROJECT_ID = "cqkvekdrifmvedvpjmjr";

async function callFocusNfe(action: string, params?: Record<string, string>, body?: unknown) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Não autenticado");

  const searchParams = new URLSearchParams({ action, ...params });
  const url = `https://${PROJECT_ID}.supabase.co/functions/v1/focus-nfe?${searchParams}`;

  const options: RequestInit = {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(url, options);
  
  // A Focus NFe retorna URLs para download de PDF/XML em vez de binários diretos
  // O frontend precisará abrir essas URLs
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error?.message || data.error || `Erro ${res.status}`);
  }

  return data;
}

export function useFocusNfe() {
  const cadastrarEmpresa = (payload: unknown) =>
    callFocusNfe("cadastrar-empresa", undefined, payload);

  const consultarEmpresa = (cnpj: string) =>
    callFocusNfe("consultar-empresa", { cnpj });

  const emitirNFe = (payload: unknown) =>
    callFocusNfe("emitir-nfe", undefined, payload);

  const consultarNFe = (id: string) =>
    callFocusNfe("consultar-nfe", { id });

  // Focus NFe retorna URLs no objeto de consulta
  const baixarDanfe = async (id: string) => {
    const data = await consultarNFe(id);
    if (data.caminho_danfe) {
      window.open(`https://api.focusnfe.com.br${data.caminho_danfe}`, '_blank');
    }
  };

  const baixarXml = async (id: string) => {
    const data = await consultarNFe(id);
    if (data.caminho_xml_nota_fiscal) {
      window.open(`https://api.focusnfe.com.br${data.caminho_xml_nota_fiscal}`, '_blank');
    }
  };

  const cancelarNFe = (id: string, justificativa: string) =>
    callFocusNfe("cancelar-nfe", { id }, { justificativa });

  const cartaCorrecao = (id: string, correcao: string) =>
    callFocusNfe("carta-correcao", { id }, { correcao });

  return {
    cadastrarEmpresa,
    consultarEmpresa,
    emitirNFe,
    consultarNFe,
    baixarDanfe,
    baixarXml,
    cancelarNFe,
    cartaCorrecao,
  };
}
```

## 5. Alterações nas Telas (Pages)

Em todas as telas que usam `useNuvemFiscal`, substitua por `useFocusNfe`. 

Principais arquivos afetados:
- `src/pages/vendas/NotasSaidaPage.tsx`
- `src/components/configuracoes/ConfiguracaoFiscal.tsx` (onde a empresa é cadastrada)

## 6. Fluxo de Transição Suave

Para não interromper clientes atuais:

1. Faça deploy da nova Edge Function `focus-nfe` e rode a migration SQL.
2. Atualize a tela de configurações para cadastrar **novos** certificados apenas na Focus NFe.
3. Para emissão, o ERP deve verificar:
   - Se a empresa tem `focus_nfe_empresa_id`, usa o fluxo Focus NFe.
   - Se tem apenas `nuvem_fiscal_id`, usa o fluxo Nuvem Fiscal (legacy).
4. Emita um comunicado para os clientes reenviarem seus certificados `.pfx` no painel. Ao fazerem isso, o ERP os recadastra na Focus NFe e atualiza a flag.
5. Após 30 dias, desative a Edge Function da Nuvem Fiscal.
