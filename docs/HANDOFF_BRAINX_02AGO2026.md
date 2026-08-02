# BrainX ERP — Handoff de Sessão

> Estado em **02/08/2026**, verificado diretamente no banco de produção.
> Projeto Supabase: `cqkvekdrifmvedvpjmjr` · Tenant: ProLab Health (`60d2caee-d99d-4954-8bab-38ddf2cf5019`)
>
> Cole este documento no início da nova conversa.

---

# 1. REGRAS DE TRABALHO — leia antes de qualquer coisa

## 1.1 Legislação

Antes de decidir **qualquer** mudança com base em norma (ANVISA, fiscal/NF-e, ICMS, CFOP, CSOSN, Simples Nacional, RICMS, Notas Técnicas da SEFAZ), consultar a versão vigente e conferir se foi alterada, revogada ou substituída. Nunca decidir por memória. Ao citar, indicar o que foi verificado agora vs. herdado.

## 1.2 Investigação — as sete fronteiras

Todo erro de afirmação vem de **verificar um lado e inferir o outro**. Antes de afirmar, identificar qual fronteira a afirmação cruza e verificar o outro lado:

| Fronteira | Como verificar |
|---|---|
| nome ↔ conteúdo | Ler o arquivo · `pg_get_functiondef` · `pg_get_viewdef` |
| contagem ↔ natureza | `relkind` — linha não diz se é tabela ou view |
| nosso código ↔ API externa | **Doc do terceiro.** `{...data}` repassa o que vier, não garante que venha |
| superusuário ↔ usuário | `SET LOCAL ROLE authenticated` + JWT |
| coluna ↔ significado | `COMMENT` + quem escreve/quem lê (entrada ≠ saldo) |
| repositório ↔ produção | Schema e edge functions podem divergir do repo |
| isolado ↔ geral | Repetir em ≥2 contextos antes de generalizar |

Marcar sempre: **VERIFICADO** (com caminho+linha ou objeto do banco) / **INFERIDO** / **NÃO VERIFICADO**.

Proibido sem verificação: *"já faz"*, *"não tem consumidor"*, *"está vazando"*, *"é duplicata"*, *"sempre"*, *"nunca"*.

## 1.3 Simetria de schema — PROIBIDO PRESUMIR

Nunca assumir que uma tabela tem coluna porque a "irmã" tem.

**Erros cometidos:** `contas_pagar` não tem `valor_restante` (usa `valor` − `valor_pago`) · `estoque_lotes` não tem `updated_at` (só `created_at`).

Antes de escrever INSERT/UPDATE/SELECT em tabela não lida nesta sessão:

```sql
SELECT string_agg(column_name,', ' ORDER BY ordinal_position)
FROM information_schema.columns WHERE table_schema='public' AND table_name='X';
```

Testar sempre o caminho **completo** em `BEGIN...ROLLBACK` — os dois erros acima só apareceram no teste de ponta a ponta.

## 1.4 Reutilização de função — REPRODUZ ou DESTRÓI?

**Erro cometido em 02/08/2026:** `atualizar_nota_saida` reusou `criar_nota_saida` sem perceber que devolução tem impostos **espelhados do XML** do fornecedor. Resultado: ICMS 25,30 → 0, base 140,57 → 0, CSOSN 900 → 400, DFeReferenciado perdido. **Silenciosamente, sem erro.**

Antes de reusar:
1. Listar **de onde vêm** os valores atuais — cadastro, XML externo, cálculo, entrada manual
2. Confirmar se a função candidata tem acesso à **mesma fonte**
3. Fonte externa → a via genérica **não reproduz**. Bloquear com mensagem, não recalcular
4. Testar comparando o registro **antes e depois, campo a campo**

> Atualizar quase nunca é recriar quando há dado derivado de fonte externa.

## 1.5 Migration e deploy

PR com arquivo em `supabase/migrations/` → merge no Vercel **não aplica** o SQL. Publica apenas frontend e edge functions. A migration precisa ser aplicada ao banco antes ou junto, senão vira **função fantasma**.

## 1.6 Regra da ANVISA é lei

Regra da ANVISA **não pertence a tenant e não depende de aprovação**. Nenhuma empresa ou RT pode alterar, homologar ou vetar. O ERP **informa** o que mudou — não pede autorização.

| Camada | Tenant? | Aprovação? |
|---|---|---|
| Regra (constituintes, limites, alegações) | ❌ Global | ❌ Nunca |
| Aplicação (qual insumo = qual constituinte) | ✅ Por tenant | ✅ RT confirma |

Parsear a norma é trabalho da **plataforma**, não da RT de cada cliente.

---

# 2. ESTADO DO MÓDULO FISCAL

## 2.1 Configuração — pronta

| | |
|---|---|
| Certificado A1 | válido até 03/07/2027 · sincronizado com a Focus |
| Focus empresa | 225041 · tokens capturados e cifrados por tenant |
| Ambiente | PRODUCAO · série 2 |
| Edge functions | `focus-nfe` **v11** · `validate-certificate` **v11** · `brainx-parceiros` v6 |
| Onboarding | Automático — usuário nunca abre o painel da Focus |

## 2.2 ⚠️ NENHUMA NOTA FOI TRANSMITIDA

`notas_autorizadas = 0`. Tudo foi testado em `BEGIN...ROLLBACK` e dry run. **Nunca passou pela SEFAZ.**

Caminhos nunca exercitados: transmissão real, baixa de estoque em produção, crédito em contas a pagar, contas a receber, cancelamento, carta de correção, consulta reconciliando status, contingência.

## 2.3 Devolução pronta para transmitir

**ID: `3e14da8f-b225-4434-9621-c1fd048ff7e5`**

| | |
|---|---|
| Item | ACIDO FOLICO (VITAMINA B9) · 0,1 kg |
| Lote | 260402N012 · vinculado ao estoque (100 g) |
| CFOP / CSOSN | 5201 / 900 |
| Base ICMS / ICMS | 140,57 / 25,30 (18%) |
| Frete / Desconto | 4,73 / 4,16 |
| **Total** | **R$ 140,57** |
| DFeReferenciado | chave NF 444378, item 1 |
| Origem | NF 444378 Valdequímica, série 1 |

⚠️ **Prazo da Valdequímica: ~06/08/2026** (15 dias para devolução).

Um ID anterior (`577e386b...`) foi excluído — nota corrompida pela edição.

---

# 3. CONTRATO DO BACKEND

## 3.1 RPCs

| RPC | Uso |
|---|---|
| `dados_danfe(id)` | **Imprimir** — documento completo |
| `montar_payload_focus(id)` | **Transmitir** — omite o que a Focus calcula |
| `criar_nota_saida(...)` | Cria rascunho de qualquer operação |
| `atualizar_nota_saida(id, ...)` | Edita preservando o ID · **recusa devolução** |
| `gerar_devolucao_de_nota_entrada(...)` | Devolução espelhando o XML |
| `itens_devolviveis(id)` | Itens da nota de entrada prontos |
| `aplicar_efeitos_nota_saida(id)` | Estoque + financeiro · **idempotente** |
| `registrar_retorno_focus(...)` | Grava retorno sem sobrescrever com nulo |
| `proxima_numeracao_prevista()` | Previsão de número/série |
| `status_integracao_focus()` | Estado da integração |

**Duas RPCs de documento, dois públicos.** `dados_danfe` imprime, `montar_payload_focus` transmite. Nunca trocar.

## 3.2 View `v_notas_saida_status`

Entrega pronto: `status_label`, `status_tom`, `mensagem_usuario`, `numero_formatado`, `qtd_itens`, `pode_editar/excluir/transmitir/validar/visualizar/consultar/imprimir/baixar_xml/cancelar/carta_correcao/reenviar_email`, `horas_para_cancelar`, `em_contingencia`, `contingencia_modo`, `horas_para_autorizar_contingencia`, `tentativas_anteriores`.

**A tela não recalcula nada disso.**

## 3.3 Ações da `focus-nfe` v11

```
?action=emitir-nota      { nota_saida_id, dry_run }
?action=consultar-nfe    &id={ref}&ambiente={amb}   (usa completa=1)
?action=proximo-numero
?action=danfe | xml      &id={ref}
?action=cancelar-nfe     { justificativa }  15–255
?action=carta-correcao   { correcao }       15–1000
?action=reenviar-email   { emails: [] }
?action=inutilizar-nfe
```

Nota **rejeitada pode ser retransmitida** com a mesma ref.

## 3.4 Proteções no banco

- `bloquear_edicao_nota_transmitida` — recusa editar/excluir nota em PROCESSANDO, AUTORIZADO, CANCELADO, DENEGADO
- `atualizar_nota_saida` — recusa devolução com `nota_entrada_origem_id`
- `chk_notas_saida_chave_44` — chave só com 44 dígitos (a Focus devolve com prefixo "NFe")
- Trigger `preencher_rastro_saida` — casa lote do XML com lote do estoque

## 3.5 Convenções

| | |
|---|---|
| `nfe_ambiente` | **MAIÚSCULO** — comparar com `.toLowerCase()` |
| Tabela de empresa | **`company`** (singular). `companies` não existe |
| CST de IPI em saída | **99**. 49 é "outras entradas" |
| CSOSN devolução | 900 · sem circulação financeira: 400 |
| Numeração | **Da Focus.** Nunca implementar contador |
| Chave da Focus | Vem com prefixo `NFe` — limpar para 44 dígitos |

---

# 4. PENDÊNCIAS

## 4.1 Frontend — três documentos prontos

1. **CURSOR_BUG_EDICAO_CRITICO_V2** 🔴 — operação trocada, frete dobrado, "Refazer devolução", revalidar existência
2. **CURSOR_EMISSOR_CARD_ITEM** — card colapsável, duplicar, "Concluir e adicionar outro"
3. **CURSOR_DANFE_EMITENTE_AJUSTES** — endereço em 3 linhas, sem fantasia/complemento

## 4.2 DANFE — não implementado

- Bloco **CÁLCULO DO ISSQN** (obrigatório mesmo zerado)
- **Duplicatas** no bloco FATURA
- Rodapé: `Documento gerado com www.brainxerp.com — versão X` (`package.json` está `0.0.0`)
- CSS de impressão A4 com grade fechada e paginação
- Layout de **contingência** (`tp_emis`, `dh_contingencia`, `justificativa_contingencia`)
- Grade de 24 colunas — bordas verticais não se alinham

## 4.3 🔴 24 itens sem NCM — NÃO PREENCHER POR SEMELHANÇA

**Verificado:** todos com `vezes_comprado = 0` e `lotes = 0`. **Nunca entraram por XML — não há origem de onde puxar.**

Preencher por semelhança de nome seria erro grave. Exemplos reais da busca:

| Item | NCM de "similares" |
|---|---|
| VITAMINA C | **8 diferentes**, incluindo `48211000` (etiquetas de papel) |
| MAGNESIO CITRATO | 6 diferentes |
| VIT. B3 | 10 diferentes |

> **NCM é responsabilidade do contador**, não da RT nem do sistema. Erro de NCM é autuação tributária, e a nota sai normal — ninguém percebe.

Os 24: Boro Quelato · Bromelina · Cálcio Quelato · Chá Verde · Cloreto de Magnésio · Cobre Quelato · Cromo Quelato · Ferro Quelato · Fósforo Quelato · Gengibre · Iodo · Magnésio Citrato · Magnésio Dimalato · Manganês Quelato · Metilfolato · Molibdênio · Pancreatina · Própolis Verde · Protease · Selênio Quelato · Silicium Max · Vit. B3 · Vitamina C · Sachê de Sílica Gel

**Ação:** planilha para o contador com descrição e uso, e ele devolve o NCM.

## 4.4 Zero produtos acabados cadastrados

`tipo_item = 'PA'` = **0**. Não há o que vender. Devolução funciona porque o NCM vem do XML de origem; venda não tem de onde tirar.

## 4.5 Decisões de terceiros

| Assunto | Quem |
|---|---|
| CSOSN 101 ou 102 na venda | **Contador** |
| NCM dos 24 itens | **Contador** |
| Cronograma VC02-14 para CRT 1 (01/09/2026 ou 04/01/2027) | **Não verificado** |
| Devolução: abater título ou criar crédito | **Contador** |

## 4.6 Cadastro rápido de insumo

`CadastroRapidoInsumo.tsx` linhas 198-210 cria itens **sem NCM e sem fator de conversão**. É a causa dos 24.

⚠️ **NÃO fazer merge dos duplicados** — depende de `potencia_compra`, NULL em todo o catálogo. Repontar "Cálcio Quelato" para "Cálcio Bisglicinato 18%" causa **subdose de 5,5× em produto notificado**.

## 4.7 Motor regulatório

- **10 mudanças normativas detectadas e não revisadas** — 3 da IN 28/2018 (127 referências no código)
- `anvisa-limits.ts` (634 linhas à mão) dirige os laudos em vez da base sincronizada — deve virar cache
- Parser de teor no CoA — 1 de 195 lotes com potência
- Parser multicomponente (43 lipídeos) e UFC científica (41 probióticos)

## 4.8 Infraestrutura

- Migrations `CREATE OR REPLACE` das RPCs criadas via MCP (não estão no repo)
- `DATABASE_URL` como secret para o check `phantom-objects` ver o banco real
- Cadeia de auditoria: 5 elos rompidos, 4 sequências duplicadas
- Importador gravando CFOP de saída do fornecedor como CFOP de entrada

---

# 5. PRÓXIMO PASSO

**Transmitir a devolução `3e14da8f-b225-4434-9621-c1fd048ff7e5`.**

É o único teste que prova que o módulo funciona. Prazo ~06/08.

1. Aplicar as correções do `CURSOR_BUG_EDICAO_CRITICO_V2`
2. Ligar para a Valdequímica confirmando que aceitam
3. Validar (`dry_run: true`) → Transmitir (`dry_run: false`)
4. Conferir: chave 44 dígitos, protocolo, status AUTORIZADO
5. Rodar `aplicar_efeitos_nota_saida` e conferir baixa de 100 g + crédito de −140,57
6. Comparar o DANFE do ERP com o PDF da Focus, campo a campo

O passo 6 é a condição para o DANFE do BrainX ser o documento oficial. A Focus gera do XML autorizado; nós geramos do banco. **Se divergirem, o nosso está errado.**

---

# 6. TESTE RÁPIDO

```js
// Console do brainxerp.com, logado
let raw = localStorage.getItem('sb-cqkvekdrifmvedvpjmjr-auth-token');
if (raw?.startsWith('base64-')) raw = atob(raw.slice(7));
window.__tk = JSON.parse(raw).access_token;

const r = await fetch(
  'https://cqkvekdrifmvedvpjmjr.supabase.co/functions/v1/focus-nfe?action=emitir-nota',
  { method: 'POST',
    headers: { Authorization: `Bearer ${window.__tk}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nota_saida_id: '3e14da8f-b225-4434-9621-c1fd048ff7e5',
      dry_run: true })
  });
console.log(r.status, JSON.stringify(await r.json(), null, 2));
```

---

# 7. PRAZOS

| Data | Assunto |
|---|---|
| **~06/08/2026** | Devolução Valdequímica |
| **01/09/2026** | RDC 843/2024 art. 30 — adequação de produtos com registro |
| **01/09/2026** | VC02-14 — referenciamento por item (confirmar CRT 1) |
