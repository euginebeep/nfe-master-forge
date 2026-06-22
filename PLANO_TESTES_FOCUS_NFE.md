# Plano de Testes — Migração Nuvem Fiscal → Focus NFe
## BrainX ERP Industrial

**Versão:** 1.0  
**Data:** Junho/2026  
**Ambiente de referência:** https://www.brainxerp.com  
**Repositório:** nfe-master-forge  

---

## 1. Escopo e Objetivos

Este plano cobre a validação completa da migração do emissor de NF-e do BrainX ERP da **Nuvem Fiscal** para a **Focus NFe**, garantindo que nenhuma funcionalidade existente seja degradada e que os novos comportamentos da API sejam corretamente tratados.

O objetivo é validar que:

- A autenticação Basic Auth da Focus NFe funciona corretamente na Edge Function.
- O cadastro de empresas (multi-tenant) cria registros válidos na Focus NFe.
- A emissão de NF-e em homologação e produção gera notas autorizadas pela SEFAZ.
- O cancelamento e a carta de correção funcionam com os novos endpoints.
- O download de DANFE e XML via URL (novo comportamento) funciona no frontend.
- A lógica de pós-autorização (conta a receber + baixa de estoque FEFO) continua funcionando.
- A transição suave entre empresas com `nuvem_fiscal_id` e `focus_nfe_empresa_id` não quebra clientes existentes.

---

## 2. Ambientes de Teste

| Ambiente | URL | Banco | API NF-e |
|---|---|---|---|
| **Homologação** | https://homologacao.focusnfe.com.br/v2 | Supabase (dev) | Focus NFe Homologação |
| **Produção** | https://api.focusnfe.com.br/v2 | Supabase (prod) | Focus NFe Produção |

> **Regra:** Todos os testes funcionais devem ser executados primeiro em **homologação**. Somente após aprovação completa, executar os testes de produção (casos T-15 e T-16 apenas).

---

## 3. Pré-Requisitos

Antes de iniciar os testes, verificar:

- [ ] Secret `FOCUS_NFE_TOKEN` configurado no Supabase (produção e homologação).
- [ ] Edge Function `focus-nfe` deployada com sucesso (`supabase functions deploy focus-nfe`).
- [ ] Migration SQL `20260623100000_focus_nfe_migration.sql` executada no banco.
- [ ] Certificado digital A1 válido (`.pfx`) disponível para testes.
- [ ] CNPJ de teste cadastrado na Focus NFe (ambiente de homologação).
- [ ] Usuário de teste com perfil de empresa configurado no BrainX ERP.

---

## 4. Casos de Teste

### Módulo 1 — Infraestrutura e Autenticação

---

#### T-01 — Autenticação Basic Auth com token válido

**Objetivo:** Verificar que a Edge Function autentica corretamente na Focus NFe com o token configurado.

**Pré-condição:** Secret `FOCUS_NFE_TOKEN` configurado no Supabase.

**Passos:**
1. Chamar a Edge Function `focus-nfe` com `action=consultar-empresa` e um CNPJ válido.
2. Verificar o log da Edge Function no Supabase.

**Resultado esperado:** HTTP 200 com dados da empresa retornados pela Focus NFe. Nenhum erro de autenticação nos logs.

**Resultado obtido:** _______________

**Status:** ⬜ Não testado | ✅ Aprovado | ❌ Reprovado

---

#### T-02 — Autenticação Basic Auth com token inválido

**Objetivo:** Verificar que a Edge Function retorna erro adequado quando o token é inválido.

**Passos:**
1. Temporariamente alterar o secret `FOCUS_NFE_TOKEN` para um valor inválido.
2. Chamar qualquer ação da Edge Function.
3. Restaurar o token correto após o teste.

**Resultado esperado:** HTTP 401 com mensagem de erro clara. Nenhum crash ou stack trace exposto ao frontend.

**Resultado obtido:** _______________

**Status:** ⬜ Não testado | ✅ Aprovado | ❌ Reprovado

---

#### T-03 — Segurança: usuário sem sessão

**Objetivo:** Verificar que a Edge Function rejeita chamadas sem JWT de usuário.

**Passos:**
1. Chamar a Edge Function sem o header `Authorization`.
2. Chamar a Edge Function com um JWT expirado.

**Resultado esperado:** HTTP 401 em ambos os casos.

**Resultado obtido:** _______________

**Status:** ⬜ Não testado | ✅ Aprovado | ❌ Reprovado

---

### Módulo 2 — Cadastro de Empresa (Multi-Tenant)

---

#### T-04 — Cadastrar empresa com certificado válido

**Objetivo:** Verificar que o onboarding de um novo cliente cria corretamente a empresa na Focus NFe.

**Pré-condição:** Certificado A1 válido em formato `.pfx` codificado em base64.

**Passos:**
1. Acessar **Configurações → Fiscal** no BrainX ERP.
2. Fazer upload do certificado `.pfx` e informar a senha.
3. Clicar em "Salvar / Cadastrar na Focus NFe".
4. Verificar no banco se `focus_nfe_empresa_id` foi preenchido na tabela `companies`.
5. Verificar no painel da Focus NFe se a empresa aparece listada.

**Resultado esperado:**
- HTTP 200 com o objeto da empresa retornado.
- Campo `focus_nfe_empresa_id` preenchido no banco.
- Campo `certificado_valido_ate` armazenado para controle de vencimento.

**Resultado obtido:** _______________

**Status:** ⬜ Não testado | ✅ Aprovado | ❌ Reprovado

---

#### T-05 — Cadastrar empresa com certificado inválido (senha errada)

**Objetivo:** Verificar que o sistema apresenta mensagem de erro amigável quando a senha do certificado está errada.

**Passos:**
1. Fazer upload de um certificado `.pfx` válido com senha incorreta.
2. Clicar em "Salvar".

**Resultado esperado:** Mensagem de erro: "Senha do certificado incorreta. Verifique e tente novamente." HTTP 422 da Focus NFe tratado corretamente pelo frontend.

**Resultado obtido:** _______________

**Status:** ⬜ Não testado | ✅ Aprovado | ❌ Reprovado

---

#### T-06 — Cadastrar empresa com CNPJ já existente na Focus NFe

**Objetivo:** Verificar comportamento quando o CNPJ já está cadastrado.

**Passos:**
1. Tentar cadastrar uma empresa cujo CNPJ já existe na Focus NFe.

**Resultado esperado:** O sistema deve atualizar os dados (PUT) em vez de criar duplicata, ou apresentar mensagem clara ao usuário.

**Resultado obtido:** _______________

**Status:** ⬜ Não testado | ✅ Aprovado | ❌ Reprovado

---

#### T-07 — Isolamento multi-tenant: usuário não pode consultar empresa de outro tenant

**Objetivo:** Verificar que a validação de segurança impede que um usuário consulte dados de outro CNPJ.

**Passos:**
1. Logar como usuário da Empresa A.
2. Chamar `consultar-empresa` passando o CNPJ da Empresa B.

**Resultado esperado:** HTTP 403 com mensagem "Você só pode consultar os dados da sua própria empresa."

**Resultado obtido:** _______________

**Status:** ⬜ Não testado | ✅ Aprovado | ❌ Reprovado

---

### Módulo 3 — Emissão de NF-e

---

#### T-08 — Emissão de NF-e em homologação (fluxo completo)

**Objetivo:** Validar o fluxo completo de emissão de NF-e em ambiente de homologação.

**Pré-condição:** Empresa cadastrada na Focus NFe. Nota fiscal com pelo menos 1 item criada no BrainX ERP.

**Passos:**
1. Criar uma nota de saída com 1 item (produto com NCM, CFOP, tributação ICMS/PIS/COFINS).
2. Clicar em "Emitir NF-e".
3. Aguardar o polling de status (até 20 segundos).
4. Verificar o resultado na tela.
5. Verificar no banco os campos `chave_acesso`, `protocolo_autorizacao`, `numero`, `serie`.

**Resultado esperado:**
- Status da nota: **AUTORIZADA**.
- Campos `chave_acesso` (44 dígitos), `protocolo_autorizacao` e `numero` preenchidos no banco.
- Botões "Baixar DANFE" e "Baixar XML" habilitados.
- Conta a receber criada automaticamente.
- Baixa de estoque FEFO executada.

**Resultado obtido:** _______________

**Status:** ⬜ Não testado | ✅ Aprovado | ❌ Reprovado

---

#### T-09 — Emissão com dados inválidos (NCM em branco)

**Objetivo:** Verificar que erros de validação da SEFAZ são apresentados de forma compreensível.

**Passos:**
1. Criar uma nota com um item sem NCM preenchido.
2. Tentar emitir a NF-e.

**Resultado esperado:** Mensagem de erro clara indicando o campo com problema. Status da nota retorna para **RASCUNHO**. Número reservado é liberado.

**Resultado obtido:** _______________

**Status:** ⬜ Não testado | ✅ Aprovado | ❌ Reprovado

---

#### T-10 — Idempotência: reenvio da mesma nota (parâmetro `ref`)

**Objetivo:** Verificar que o parâmetro `ref` da Focus NFe evita emissão duplicada em caso de falha de rede.

**Passos:**
1. Emitir uma NF-e e simular queda de rede antes de receber a resposta.
2. Tentar emitir a mesma nota novamente.

**Resultado esperado:** A Focus NFe retorna a mesma nota já emitida (não cria duplicata). O BrainX ERP identifica que a nota já foi processada e atualiza o status corretamente.

**Resultado obtido:** _______________

**Status:** ⬜ Não testado | ✅ Aprovado | ❌ Reprovado

---

#### T-11 — Timeout de SEFAZ (polling excede 10 tentativas)

**Objetivo:** Verificar o comportamento quando a SEFAZ demora mais de 20 segundos para responder.

**Passos:**
1. Simular uma nota em estado `processando_autorizacao` que não avança.
2. Aguardar o timeout do polling.

**Resultado esperado:** Mensagem ao usuário: "Timeout aguardando SEFAZ. A nota foi salva — consulte depois clicando em Atualizar Status." Status da nota: **RASCUNHO** (não ERRO).

**Resultado obtido:** _______________

**Status:** ⬜ Não testado | ✅ Aprovado | ❌ Reprovado

---

### Módulo 4 — Consulta, DANFE e XML

---

#### T-12 — Download do DANFE via URL (novo comportamento)

**Objetivo:** Verificar que o download do DANFE funciona com o novo modelo de URL da Focus NFe.

> **Diferença crítica:** A Nuvem Fiscal enviava o PDF como binário. A Focus NFe retorna uma URL (`caminho_danfe`) que aponta para o arquivo no servidor deles.

**Passos:**
1. Em uma nota com status **AUTORIZADA**, clicar em "Baixar DANFE".
2. Verificar se o PDF abre corretamente no navegador.

**Resultado esperado:** PDF do DANFE abre em nova aba. O arquivo está legível e contém os dados corretos da nota (emitente, destinatário, itens, chave de acesso).

**Resultado obtido:** _______________

**Status:** ⬜ Não testado | ✅ Aprovado | ❌ Reprovado

---

#### T-13 — Download do XML via URL

**Objetivo:** Verificar que o download do XML da NF-e funciona com o novo modelo de URL.

**Passos:**
1. Em uma nota com status **AUTORIZADA**, clicar em "Baixar XML".
2. Verificar se o arquivo XML é baixado corretamente.

**Resultado esperado:** Arquivo `.xml` é baixado com o nome correto. O XML contém a chave de acesso, protocolo de autorização e assinatura digital válida.

**Resultado obtido:** _______________

**Status:** ⬜ Não testado | ✅ Aprovado | ❌ Reprovado

---

#### T-14 — Consulta de status de nota em processamento

**Objetivo:** Verificar que a consulta de status funciona corretamente.

**Passos:**
1. Chamar `consultar-nfe` com o `ref` de uma nota em processamento.
2. Chamar novamente após a autorização.

**Resultado esperado:** Retorno correto dos campos `status`, `chave_nfe`, `numero`, `serie`, `protocolo`, `caminho_danfe`, `caminho_xml_nota_fiscal`.

**Resultado obtido:** _______________

**Status:** ⬜ Não testado | ✅ Aprovado | ❌ Reprovado

---

### Módulo 5 — Cancelamento e Carta de Correção

---

#### T-15 — Cancelamento de NF-e dentro do prazo (24h)

**Objetivo:** Verificar que o cancelamento funciona com o novo endpoint `DELETE /v2/nfe/:ref`.

> **Diferença crítica:** A Nuvem Fiscal usava `POST /nfe/:id/cancelamento`. A Focus NFe usa `DELETE /v2/nfe/:ref`.

**Passos:**
1. Em uma nota **AUTORIZADA** emitida há menos de 24 horas, clicar em "Cancelar".
2. Informar a justificativa com pelo menos 15 caracteres.
3. Confirmar o cancelamento.

**Resultado esperado:**
- Status da nota: **CANCELADA**.
- Registro de auditoria criado no banco com evento `CANCELAMENTO`.
- Conta a receber associada marcada como cancelada (se existir).

**Resultado obtido:** _______________

**Status:** ⬜ Não testado | ✅ Aprovado | ❌ Reprovado

---

#### T-16 — Cancelamento fora do prazo (>24h)

**Objetivo:** Verificar que o sistema apresenta mensagem adequada quando o cancelamento não é mais permitido.

**Passos:**
1. Tentar cancelar uma nota emitida há mais de 24 horas.

**Resultado esperado:** Mensagem de erro clara: "Prazo de cancelamento expirado. Utilize carta de correção ou emita nota de devolução." HTTP 422 da Focus NFe tratado corretamente.

**Resultado obtido:** _______________

**Status:** ⬜ Não testado | ✅ Aprovado | ❌ Reprovado

---

#### T-17 — Carta de Correção Eletrônica (CC-e)

**Objetivo:** Verificar que a emissão de CC-e funciona com o novo endpoint `POST /v2/nfe/:ref/carta_correcao`.

> **Diferença crítica:** A Nuvem Fiscal usava `carta-correcao` (hífen). A Focus NFe usa `carta_correcao` (underscore).

**Passos:**
1. Em uma nota **AUTORIZADA**, clicar em "Carta de Correção".
2. Informar a correção com pelo menos 15 caracteres.
3. Confirmar.

**Resultado esperado:**
- Resposta com status `aprovado`.
- Registro de auditoria com evento `CC_E`.
- XML da CC-e disponível para download.

**Resultado obtido:** _______________

**Status:** ⬜ Não testado | ✅ Aprovado | ❌ Reprovado

---

#### T-18 — Carta de Correção com texto menor que 15 caracteres

**Objetivo:** Verificar validação mínima do campo de correção.

**Passos:**
1. Tentar emitir CC-e com texto "erro" (4 caracteres).

**Resultado esperado:** Mensagem de erro: "Correção deve ter no mínimo 15 caracteres." Nenhuma chamada à API da Focus NFe é feita.

**Resultado obtido:** _______________

**Status:** ⬜ Não testado | ✅ Aprovado | ❌ Reprovado

---

### Módulo 6 — Transição Suave (Compatibilidade com Nuvem Fiscal)

---

#### T-19 — Empresa com `nuvem_fiscal_id` ainda emite pela Nuvem Fiscal

**Objetivo:** Verificar que empresas que ainda não migraram continuam emitindo pela Nuvem Fiscal sem interrupção.

**Passos:**
1. Usar uma empresa que tem `nuvem_fiscal_id` preenchido mas `focus_nfe_empresa_id` vazio.
2. Emitir uma NF-e normalmente.

**Resultado esperado:** A nota é emitida pela Nuvem Fiscal (Edge Function `nuvem-fiscal`). Nenhum erro. O campo `nuvem_fiscal_id` da nota é preenchido normalmente.

**Resultado obtido:** _______________

**Status:** ⬜ Não testado | ✅ Aprovado | ❌ Reprovado

---

#### T-20 — Empresa migrada usa Focus NFe automaticamente

**Objetivo:** Verificar que após o reenvio do certificado, a empresa passa a usar a Focus NFe.

**Passos:**
1. Usar uma empresa que tem `focus_nfe_empresa_id` preenchido.
2. Emitir uma NF-e normalmente.

**Resultado esperado:** A nota é emitida pela Focus NFe. O campo `focus_nfe_id` da nota é preenchido. O campo `chave_nfe` (não `chave_acesso`) é mapeado corretamente.

**Resultado obtido:** _______________

**Status:** ⬜ Não testado | ✅ Aprovado | ❌ Reprovado

---

### Módulo 7 — Testes de Produção (apenas após aprovação completa)

---

#### T-21 — Emissão real em produção com CNPJ da VITALNOW

**Objetivo:** Validar a emissão de uma NF-e real em ambiente de produção.

> **Atenção:** Este teste gera uma nota fiscal real. Emitir apenas com dados corretos e cancelar imediatamente após a confirmação.

**Passos:**
1. Configurar o ambiente como **Produção** nas configurações fiscais.
2. Criar uma nota de saída com valor mínimo (R$ 0,01) para um destinatário de teste.
3. Emitir a NF-e.
4. Confirmar autorização na SEFAZ.
5. Cancelar a nota imediatamente com justificativa "Nota emitida para teste de integração".

**Resultado esperado:** Nota autorizada com chave de acesso real. Cancelamento aprovado pela SEFAZ.

**Resultado obtido:** _______________

**Status:** ⬜ Não testado | ✅ Aprovado | ❌ Reprovado

---

## 5. Mapeamento de Campos: Nuvem Fiscal → Focus NFe

Esta tabela documenta as diferenças nos campos de resposta que o BrainX ERP consome, para garantir que o mapeamento no código está correto.

| Campo no BrainX ERP | Campo Nuvem Fiscal | Campo Focus NFe | Observação |
|---|---|---|---|
| ID da nota no provedor | `id` | `ref` | A Focus NFe usa a `ref` que o ERP enviou |
| Chave de acesso | `chave_acesso` | `chave_nfe` | Nome diferente — verificar mapeamento |
| Protocolo | `protocolo` | `protocolo` | Mesmo nome |
| Número da nota | `numero` | `numero` | Mesmo nome |
| Série | `serie` | `serie` | Mesmo nome |
| Status autorizado | `"autorizado"` | `"autorizado"` | Mesmo valor |
| Status processando | `"processando"` | `"processando_autorizacao"` | Valor diferente — verificar polling |
| Status erro | `"rejeitado"` | `"erro_autorizacao"` | Valor diferente — verificar tratamento |
| URL do DANFE | `link_pdf` | `caminho_danfe` | Nome diferente — verificar mapeamento |
| URL do XML | `link_xml` | `caminho_xml_nota_fiscal` | Nome diferente — verificar mapeamento |
| Status cancelado | `"cancelado"` | `"cancelado"` | Mesmo valor |

---

## 6. Critérios de Aprovação

A migração será considerada **aprovada** quando:

| Critério | Requisito |
|---|---|
| Testes T-01 a T-20 | 100% aprovados |
| Teste T-21 (produção) | Aprovado |
| Zero notas duplicadas emitidas | Verificado |
| Zero clientes impactados durante a transição | Verificado |
| Tempo de emissão | ≤ 20 segundos (média) |
| Logs de auditoria | Todos os eventos registrados corretamente |

---

## 7. Plano de Rollback

Se qualquer teste crítico falhar em produção:

1. **Imediato:** Reverter a variável de ambiente `FOCUS_NFE_TOKEN` para vazia, forçando fallback para a Nuvem Fiscal.
2. **Curto prazo:** Identificar o erro nos logs do Supabase Edge Functions.
3. **Correção:** Corrigir o código, fazer novo deploy e reiniciar os testes a partir do módulo afetado.
4. **Comunicação:** Notificar os clientes impactados via e-mail se houver interrupção superior a 5 minutos.

---

## 8. Responsáveis e Cronograma

| Fase | Responsável | Prazo |
|---|---|---|
| Configuração do ambiente de homologação | Dev Backend | Dia 1 |
| Execução dos testes T-01 a T-14 | Dev Backend | Dia 2 |
| Execução dos testes T-15 a T-20 | Dev Backend + QA | Dia 3 |
| Aprovação e go/no-go | Responsável Técnico | Dia 4 |
| Execução do teste T-21 em produção | Dev Backend + Responsável Técnico | Dia 5 |
| Comunicado aos clientes | Produto | Dia 6 |
| Desativação da Edge Function Nuvem Fiscal | Dev Backend | Dia 30 (após período de transição) |
