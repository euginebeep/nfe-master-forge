# CHANGELOG — BrainX ERP

Registro do que muda no sistema, por data. Serve para responder rápido: *"o que mudou, quando, e por quê"*.

**Como manter (regra do projeto):**
- Toda PR mergeada adiciona uma linha aqui, na seção da data.
- Mudança de **banco** entra em `Banco` e **precisa** de um arquivo em `supabase/migrations/`.
- Mudança de **edge function** entra em `Edge Functions` e **exige redeploy próprio** (não sobe no merge).
- O log completo, commit a commit, é o git: `git log --oneline` ou a aba de PRs no GitHub.

Formato: `Adicionado` / `Corrigido` / `Alterado` / `Removido`.

---

## 2026-07-11 — Fase 4 (Compras P2P) — front completo

### Adicionado
- **Mapa de cotação com abas** (`/compras/mapa`): aba **Comparar** (decide por item) e aba **Fechar pedidos** (agrupa por fornecedor, gera 1 PO por fornecedor). `MapaFecharPedidosTab.tsx`.
- **Split real**: um item pode ser dividido entre N fornecedores. Item **com** pacote aloca por nº de pacotes; item **sem** pacote aloca quantidade livre. A soma pode passar da necessidade (decisão do comprador).
- **Sugestão automática do melhor fornecedor**: `use-mapa-ranking.ts` lê a view `mapa_cotacao_ranking`. Badges **MELHOR CUSTO** (custo real: embalagem + frete), **menor preço** (só quando difere do melhor custo — é o insight) e **mais rápido**. Botão "Sugerir melhores de todos".
- **Tela de Pedido**: `/compras/pedidos` (lista) e `/compras/pedidos/:id` (documento com identidade do tenant via `useCompanyBranding` + Imprimir).
- **Enviar pedido ao fornecedor**: `EnviarFornecedorMenu.tsx` (WhatsApp `wa.me` + e-mail `mailto` + copiar/PNG/imprimir). Grava `pedidos_compra.pedido_enviado_em` e mostra o selo "Enviado em DD/MM".
- **Edição do vínculo item-fornecedor** pela UI (`updateMutation` em `useSupabaseItemFornecedores`) — permite preencher `qtd_por_pacote` das MPs sem precisar recadastrar o fornecedor.

### Alterado
- **Mascote** movido do canto flutuante para o cabeçalho (`AssistenteTrigger` no `AppHeader`) — não cobre mais as barras de ação fixas.

---

## 2026-07-10 — Fase 4 (Compras P2P) — backend completo

### Banco
Todas aplicadas e testadas ao vivo. Arquivos em `supabase/migrations/`:

| Migration | O que faz |
|---|---|
| `20260710143531_fase4_status_check_e_limpeza_cotacao` | CHECK no status da requisição (mata o drift de status texto-livre); normaliza status legado |
| `20260710143729_fase4_view_compras_consolidadas` | VIEW `compras_necessidades_consolidadas` (`security_invoker=on`): soma a necessidade da mesma MP espalhada em N OPs |
| `20260710204242_fase4_rpcs_cotacao_consolidada` | `gravar_cotacao_item_consolidado` + `escolher_fornecedor_item_consolidado` (fan-out atômico do item consolidado → N linhas de requisição) |
| `20260710221649_fase4_limpeza_escolhido_sem_preco` | Desmarca cotação "escolhida" sem preço (invariante) |
| `20260710222037_fase4_pedidos_compra_e_aprovar` | Tabelas `pedidos_compra` + `pedidos_compra_itens`, numeração `PC-AAAA-000N`, helpers `f_para_gramas`/`f_de_gramas`/`f_qtd_compra`, RPC `aprovar_compra()` |
| `20260710231519_fase4_frete_cotacao_e_pedido` | Coluna `frete` (cotação e pedido) + `frete_rateado` (item do pedido) |
| `20260710231542_fase4_aprovar_compra_com_frete` | `aprovar_compra()` leva o frete ao pedido e rateia proporcional ao subtotal |
| `20260710231820_fase4_gravar_cotacao_com_frete` | `gravar_cotacao_item_consolidado` ganha `p_frete` (9º param) |
| `20260710231836_fase4_drop_gravar_cotacao_antiga` | Dropa a assinatura de 8 params (senão dá "function is not unique" em runtime) |
| `20260710232830_fase4_aprovar_por_fornecedor` | `aprovar_compra_fornecedor(forn)`: aprovação **parcial**, 1 pedido de um fornecedor só |
| `20260710233629_fase4_split_qtd_alocada` | Colunas `qtd_alocada` e `num_pacotes_alocado` na cotação |
| `20260710233939_fase4_split_rpcs_alocacao` | **SPLIT**: remove a trava de "1 fornecedor por item"; cria `alocar_fornecedor_item`; reescreve `aprovar_compra_fornecedor` para usar a quantidade **alocada** |
| `20260710234227_fase4_fk_cotacao_pedido_on_delete_setnull` | FK `cotacoes.pedido_item_id` → `ON DELETE SET NULL` (apagar pedido não trava, desfaz a alocação) |
| `20260710235602_fase4_mapa_cotacao_ranking` | VIEW `mapa_cotacao_ranking`: **custo real** por fornecedor (arredondamento de embalagem + frete) e `rank_custo`/`rank_preco`/`rank_prazo` |
| `20260710235930_fase4_pedido_enviado_em` | `pedidos_compra.pedido_enviado_em` (selo "Enviado em") |

### Dados
- Seed de `item_fornecedores.qtd_por_pacote`: 4 migrados do texto (`25 KG`→25, `1 KG`→1, `500 g`→500) + 17 padrões (cápsulas → 1000/milheiro; frascos → 250; tampas → 2500). **MP fica NULL de propósito** (varia por fornecedor; a RFQ pede a embalagem mínima).

### Aprendizados registrados
- **Custo real ≠ menor preço unitário.** Comprovado ao vivo: fornecedor a R$ 10/kg em saco de 25 kg custa R$ 250 para uma necessidade de 1 kg; concorrente a R$ 12/kg sem pacote custa R$ 27. O ranking decide pelo custo real.
- Adicionar parâmetro a uma RPC cria **sobrecarga** — a assinatura antiga precisa ser dropada explicitamente.
- `f_qtd_compra` **sem pacote** devolve a falta crua na unidade do item (não converte) — por isso o ranking converte à parte.

---

## 2026-07-10 — Qualidade, Manual e menu

### Adicionado
- **Controle de COA** (`/qualidade/coa`): área dedicada da RT, **sem dados financeiros** (segregação de acesso é arquitetural). Importa o PDF compilado da nota, fatia e casa cada certificado por lote (fabricante OU interno); ambiguidade → revisão manual. Validar / Liberar com ressalva (justificativa ≥ 30 chars) / Editar lote com trilha **append-only**.
- **Manual/FAQ dinâmico** lendo do banco (`manual_secoes` / `manual_perguntas`) + **IA ancorada (RAG)** na edge function `manual-ia` (responde SOMENTE com o conteúdo do manual; nunca inventa tela).

### Banco
- `20260709113643_lote_documentos_validacao_rt` — `lote_documentos.validado_por` / `.validado_em`.

### Corrigido
- **Papel de fornecedor**: 7 emitentes de NF-e existiam sem o papel `FORNECEDOR` em `entidade_papeis` (a tela de Fornecedores mostrava 1 de 8). Backfill aplicado + correção da causa no importador.

### Alterado
- Menu: novo grupo **Estoque**; Suprimentos ganha **Comprar** como entrada principal e "Requisições de Compra" vira **Acompanhamento**.

---

## Antes de 2026-07-10

Histórico consolidado em `BRAINX_ERP_PROJETO_BASE.md` (seção 4 — "Estado atual: feito e testado"). Resumo:

- **Fase 1** — Cadastro rápido de insumo no formulador (com sugestão de nome por IA).
- **Fase 2+3** — Conferência de Materiais na OP: Necessário × Estoque × Falta × Comprar → gera requisição.
- **Match de laudo em 3 camadas** (exato → pg_trgm → IA) com **confirmação humana obrigatória** — o sistema nunca auto-vincula.
- **Padronização de unidades** (`mcg`, não `µg`); **OP Manual desativada** (usar o Formulador).
- Correção de 2 bugs críticos: crash da aba Pesagem (tolerância nula) e código de fórmula UNIQUE global (colisão entre tenants).
