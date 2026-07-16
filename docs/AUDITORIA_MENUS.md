# Auditoria de Menus e Rotas — BrainX ERP

Data: 2026-07-16  
Fontes: `src/components/layout/AppSidebar.tsx`, `src/App.tsx`, `src/pages/**`, hooks/services relacionados.

---

## B1. Mapa menu → rota → página

Tabela gerada a partir de **todos** os itens de `menuGroups` em `AppSidebar.tsx`, cruzados com lazy imports e `<Route path>` em `App.tsx`.

| título | url | arquivo de página (from App.tsx lazy import) | existe? (S/N) |
|--------|-----|-----------------------------------------------|---------------|
| Dashboard | `/dashboard` | `src/pages/Index.tsx` | S |
| Entidades | `/cadastros/entidades` | `src/pages/cadastros/EntidadesListPageComplete.tsx` | S |
| Fornecedores | `/cadastros/fornecedores` | `src/pages/cadastros/FornecedoresListPage.tsx` | S |
| Clientes | `/cadastros/clientes` | `src/pages/cadastros/ClientesListPage.tsx` | S |
| Transportadoras | `/cadastros/transportadoras` | `src/pages/cadastros/TransportadorasListPage.tsx` | S |
| Produtos/Insumos | `/cadastros/produtos` | `src/pages/cadastros/ItensListPageComplete.tsx` | S |
| Comprar | `/compras/comprar` | `src/pages/compras/PainelCompradorPage.tsx` | S |
| Mapa de cotação | `/compras/mapa` | `src/pages/compras/MapaCotacaoPage.tsx` | S |
| Pedidos de Compra | `/compras/pedidos` | `src/pages/compras/PedidosCompraPage.tsx` | S |
| Importar NF-e | `/compras/importar-nfe` | `src/pages/compras/NFeImportPage.tsx` | S |
| Notas de Entrada | `/compras/notas-entrada` | `src/pages/compras/NotasEntradaPage.tsx` | S |
| Fator de Conversão | `/compras/fator-conversao` | `src/pages/compras/FatorConversaoPage.tsx` | S |
| Acompanhamento | `/compras/requisicoes` | `src/pages/producao/RequisicoesCompraPage.tsx` | S |
| Lotes | `/estoque/lotes` | `src/pages/estoque/LotesListPage.tsx` | S |
| Lotes Reservados | `/estoque/lotes-reservados` | `src/pages/estoque/LotesReservadosPage.tsx` | S |
| Movimentações | `/estoque/movimentacoes` | `src/pages/estoque/MovimentacoesPage.tsx` | S |
| Formulador | `/producao/formulas` | `src/pages/producao/FormuladorIndustrialPage.tsx` | S |
| Ordens de Produção | `/producao/ordens` | `src/pages/producao/OrdensProducaoIndustrialPage.tsx` | S |
| Dashboard Industrial | `/producao/dashboard` | `src/pages/producao/DashboardIndustrialPage.tsx` | S |
| Dashboard Executivo | `/producao/executivo` | `src/pages/producao/DashboardExecutivoPage.tsx` | S |
| Equipamentos | `/settings/equipamentos` | `src/pages/settings/EquipamentosPage.tsx` | S |
| Quarentena | `/estoque/quarentena` | `src/pages/estoque/QuarentenaPage.tsx` | S |
| Controle de COA | `/qualidade/coa` | `src/pages/qualidade/CoaQualidadePage.tsx` | S |
| Desvios / CAPA | `/qualidade/desvios` | `src/pages/qualidade/DesviosPage.tsx` | S |
| POPs | `/qualidade/pops` | `src/pages/qualidade/POPsPage.tsx` | S |
| Análises | `/qualidade/analises` | `src/pages/qualidade/AnalisesPage.tsx` | S |
| Calibrações | `/qualidade/calibracoes` | `src/pages/qualidade/CalibracoesPage.tsx` | S |
| Rastreabilidade | `/estoque/rastreabilidade` | `src/pages/estoque/RastreabilidadePage.tsx` | S |
| Consulta ANVISA | `/regulatorio/anvisa` | `src/pages/regulatorio/ConsultaAnvisaPage.tsx` | S |
| ANVISA Checker | `/regulatorio/anvisa-checker` | `src/pages/regulatorio/AnvisaCheckerPage.tsx` | S |
| Biblioteca do RT | `/regulatorio/biblioteca-rt` | `src/pages/regulatorio/BibliotecaRTPage.tsx` | S |
| Resp. Técnicos | `/cadastros/responsaveis-tecnicos` | `src/pages/cadastros/ResponsaveisTecnicosPage.tsx` | S |
| Monitoramento Ambiental | `/ambiental/monitoramento` | `src/pages/ambiental/MonitoramentoAmbientalPage.tsx` | S |
| Config. Sensores | `/ambiental/configuracao` | `src/pages/ambiental/AmbientalConfigPage.tsx` | S |
| CRM | `/vendas/crm` | `src/pages/vendas/CRMPage.tsx` | S |
| Orçamentos | `/vendas/orcamentos` | `src/pages/vendas/OrcamentosPage.tsx` | S |
| Pedidos | `/vendas/pedidos` | `src/pages/vendas/PedidosVendaPage.tsx` | S |
| Expedição | `/expedicao` | `src/pages/expedicao/ExpedicaoPage.tsx` | S |
| Marketplace | `/vendas/marketplace` | `src/pages/vendas/MarketplacePage.tsx` | S |
| Notas de Saída | `/vendas/notas-saida` | `src/pages/vendas/NotasSaidaPage.tsx` | S |
| Auditoria Fiscal | `/vendas/auditoria-fiscal` | `src/pages/vendas/AuditoriaFiscalPage.tsx` | S |
| Contas a Pagar | `/financeiro/pagar` | `src/pages/financeiro/ContasPagarPage.tsx` | S |
| Contas a Receber | `/financeiro/receber` | `src/pages/financeiro/ContasReceberPage.tsx` | S |
| Fluxo de Caixa | `/financeiro/fluxo` | `src/pages/financeiro/FluxoCaixaPage.tsx` | S |
| Conciliação | `/financeiro/conciliacao` | `src/pages/financeiro/ConciliacaoPage.tsx` | S |
| DRE Gerencial | `/financeiro/dre` | `src/pages/financeiro/DREPage.tsx` | S |
| Relatórios | `/relatorios` | `src/pages/relatorios/RelatoriosPage.tsx` | S |
| Auditoria | `/auditoria` | `src/pages/auditoria/AuditoriaPage.tsx` | S |
| Chat Interno | `/chat` | `src/pages/chat/ChatInternoPage.tsx` | S |

**Footer** (`footerItems`, fora de `menuGroups` — todos com rota e arquivo OK):

| título | url | arquivo | existe? |
|--------|-----|---------|---------|
| Manual / FAQ | `/faq` | `src/pages/faq/FAQPage.tsx` | S |
| Configuracoes | `/settings/company` | `src/pages/settings/CompanySettingsPage.tsx` | S |
| Admin Master | `/settings/admin-master` | `src/pages/settings/AdminMasterPage.tsx` | S |
| Usuarios | `/usuarios` | `src/pages/usuarios/UsuariosPage.tsx` | S |

### Menus sem rota (menu morto)

Nenhum. Todos os 50 itens de `menuGroups` têm `<Route>` correspondente em `App.tsx`.

### Rotas sem menu (telas órfãs)

Telas de 1º nível (não detalhe `/:id`) com rota em `App.tsx` e **sem** entrada no sidebar/`footerItems`:

| rota | arquivo | nota |
|------|---------|------|
| `/roadmap` | `src/pages/RoadmapPage.tsx` | protegida, sem menu |
| `/producao/parametros` | `src/pages/producao/ParametrosIndustriaPage.tsx` | produção, sem menu |
| `/estoque/dashboard-sem-coa` | `src/pages/estoque/DashboardSemCOAPage.tsx` | estoque/QC, sem menu |
| `/vendas/emissor-nfe` | `src/pages/vendas/EmissorNFePage.tsx` | fiscal, sem menu (irmão de Notas de Saída) |
| `/vendas/pedido-vendedor/novo` | `src/pages/vendas/NovoPedidoVendedorPage.tsx` | fluxo CRM, sem menu |
| `/relatorios/capsulas` | `src/pages/relatorios/RelatorioCapsulasPage.tsx` | sub-relatório, sem menu |
| `/notificacoes` | `src/pages/notificacoes/NotificacoesPage.tsx` | sem menu (provável acesso via header) |
| `/assinatura` | `src/pages/assinatura/AssinaturaPage.tsx` | gate de plano, sem menu |
| `/settings/empresa` | `src/pages/settings/EmpresaSettingsPage.tsx` | admin, sem menu |
| `/settings/clear-data` | `src/pages/settings/ClearDataPage.tsx` | admin |
| `/settings/migrar-dados` | `src/pages/settings/MigrarDadosPage.tsx` | admin |
| `/settings/importar-dados` | `src/pages/settings/ImportarDadosPage.tsx` | admin |
| `/settings/unlock-requests` | `src/pages/settings/AdminUnlockRequestsPage.tsx` | admin |
| `/settings/xml-backup` | `src/pages/settings/XmlBackupPage.tsx` | admin |
| `/settings/certificado-status` | `src/pages/settings/CertificadoStatusPage.tsx` | admin |
| `/saas` | `src/pages/saas/SaasDashboardPage.tsx` | painel SaaS standalone |
| `/saas/ghost-log` | `src/pages/saas/GhostAuditPage.tsx` | SaaS |
| `/onboarding` | `src/pages/onboarding/OnboardingPage.tsx` | fluxo pós-login |
| `/install` | `src/pages/install/InstallPage.tsx` | público |
| `/auth` | `src/components/auth/AuthPageModern.tsx` | público |
| `/termos-de-uso` | `src/pages/legal/TermosUsoPage.tsx` | público |
| `/politica-de-privacidade` | `src/pages/legal/PoliticaPrivacidadePage.tsx` | público |
| `/audit/lote/:hash` | `src/pages/audit/LoteAuditoriaPublicaPage.tsx` | público |
| `/op/verify/:opId` | `src/pages/producao/VerificarOPPage.tsx` | público |

Aliases / redirects (não são órfãs de produto): `/` → `/dashboard`, `/responsaveis-tecnicos` → `/cadastros/responsaveis-tecnicos`, `/regulatorio/consulta-anvisa` → `/regulatorio/anvisa`, `/producao/requisicoes` → `/compras/requisicoes`, `/financeiro/contas-pagar` → `/financeiro/pagar`, `/compras/nfe-import` (duplicata de importar-nfe), `/cadastros/itens` (alias de produtos), `/settings/usuarios` (alias de `/usuarios`).

**Arquivo de página sem rota em `App.tsx`:**

| arquivo | status |
|---------|--------|
| `src/pages/regulatorio/RelatorioAnvisaRTPage.tsx` | existe, **não** lazy-importado nem roteado |
| `src/pages/LandingPage.tsx` | lazy-importado em `App.tsx` (`LandingPage`), **sem** `<Route>` que o use |

### Páginas importadas que não existem como arquivo

Nenhuma. Os 91 lazy imports de `App.tsx` apontam para arquivos `.tsx` existentes (verificados um a um).

---

## B2. Telas duplicadas

Pares / variantes encontradas sob `src/` com padrões `*Modern*`, `*Master*`, `*V2*`, `*Novo*`, `*Complete*`, `*Dialog*` (só listagem — sem delete).

### Pares claros (legado + versão nova)

| legado (morto / não referenciado na rota ativa) | versão em uso | status |
|-------------------------------------------------|---------------|--------|
| `src/components/auth/AuthPage.tsx` | `src/components/auth/AuthPageModern.tsx` | **Não deletado.** App usa só `AuthPageModern` em `/auth`. `AuthPage` não tem imports externos. |
| `src/components/producao/CriarOPDialog.tsx` | `src/components/producao/CriarOPDialogMaster.tsx` | **Não deletado.** `OrdensProducaoIndustrialPage` usa só `CriarOPDialogMaster`. `CriarOPDialog` sem imports. |
| `src/components/entidades/EntidadeFormDialog.tsx` | `src/components/entidades/EntidadeFormDialogComplete.tsx` | Legado sem imports; Complete usado em Entidades/Clientes/Fornecedores/Transportadoras/Orçamentos. |

### Sufixo Complete sem gêmeo não-Complete

| arquivo | nota |
|---------|------|
| `src/pages/cadastros/EntidadesListPageComplete.tsx` | única listagem de entidades; sem `EntidadesListPage.tsx` |
| `src/pages/cadastros/EntidadeDetailPageComplete.tsx` | idem |
| `src/pages/cadastros/ItensListPageComplete.tsx` | idem |

### Master / Novo (não são pares de tela morta)

| arquivo | nota |
|---------|------|
| `src/components/producao/OPCabecalhoMaster.tsx` | usado em `OrdemProducaoDetailPage`; gêmeo PDF: `OPCabecalhoPDF.tsx` |
| `src/pages/settings/AdminMasterPage.tsx` | nome de produto (Admin Master), não duplicata |
| `src/pages/vendas/NovoPedidoVendedorPage.tsx` | tela “nova”, não versão de outra |

### V2

Nenhum arquivo `*V2*.tsx` em `src/`.

### Dialogs (amostra — maioria legítima, não duplicata de página)

Incluem: `GlobalSearchDialog`, `ItemFormDialog` / `ItemWizardDialog`, `VincularNotaPedidoDialog`, `ImportarCoaNotaDialog`, `ResolverInsumosLaudoDialog`, `ContratoWorkflowDialog`, `NovaMovimentacaoDialog`, `UserFormDialog`, `UnlockDialog`, `PdfViewerDialog`, dialogs NFe (`DANFEPreviewDialog`, `FiscalReviewDialog`, `FatorConversaoDialog`, etc.), UI primitives (`dialog.tsx`, `alert-dialog.tsx`, `confirm-dialog.tsx`).

**Conclusão B2:** `AuthPage` e `CriarOPDialog` **ainda existem** (não foram removidos). São os principais candidatos a limpeza junto com `EntidadeFormDialog`.

---

## B3. Telas sem conteúdo (tabelas vazias em produção)

Menus/páginas que **dependem** das tabelas listadas como vazias em produção → marcar como *tela sem conteúdo* (UI sobe, lista/KPI fica vazio ou painel inútil).

| Menu / tela | rota | tabela(s) vazia(s) | marca |
|-------------|------|--------------------|-------|
| Biblioteca do RT | `/regulatorio/biblioteca-rt` | `legislacao_monitoramento` (+ RAG via `legislacao_chunks` no admin SaaS) | **tela sem conteúdo** (radar/monitoramento vazio; RAG depende de chunks) |
| SaaS → Biblioteca Normas | `/saas` (panel) | `legislacao_chunks` | **tela sem conteúdo** (admin) |
| Formulador (aba/tabela nutricional) | `/producao/formulas` | `tabelas_nutricionais` | parcial — núcleo de fórmulas usa heart tables; nutricional vazio |
| Ordens de Produção (QC / histórico etapas na OP) | `/producao/ordens`, `/producao/ordens/:id` | `op_controle_qualidade`, `op_historico_etapas` | parcial — OP core tem dados; sub-abas QC/histórico vazias |
| Expedição | `/expedicao` | `expedicao_romaneio` | **tela sem conteúdo** |
| Notas de Saída | `/vendas/notas-saida` | `notas_saida` | **tela sem conteúdo** |
| Emissor NF-e (órfã) | `/vendas/emissor-nfe` | `notas_saida`, `catalogo_precos` | **tela sem conteúdo** |
| Pedidos (vendas) | `/vendas/pedidos` | `pedidos_venda` | **tela sem conteúdo** |
| Orçamentos | `/vendas/orcamentos` | `orcamentos` (+ `contratos_templates` no workflow) | **tela sem conteúdo** |
| CRM | `/vendas/crm` | `oportunidades`, `crm_interacoes` | **tela sem conteúdo** |
| Novo pedido vendedor (órfã) | `/vendas/pedido-vendedor/novo` | `oportunidades` | **tela sem conteúdo** |
| Marketplace | `/vendas/marketplace` | `catalogo_precos` | **tela sem conteúdo** |
| Calibrações | `/qualidade/calibracoes` | `qc_calibracoes` | **tela sem conteúdo** |
| Relatórios (bloco calibrações) | `/relatorios` | `qc_calibracoes` (entre outras) | parcial |
| Dashboard Executivo (ranking) | `/producao/executivo` | `ranking_fornecedores`, `avaliacoes_fornecedor` | parcial — painel ranking vazio |
| Admin Master → templates contrato | `/settings/admin-master` | `contratos_templates` | parcial |
| Dashboard (avisos SaaS) | `/dashboard` | `saas_comunicados` / `saas_comunicados_lidos` | parcial — popup sem comunicados |
| Company Settings (opt-out BrainX) | `/settings/company` | `brainx_optout` (+ módulos `brainx_*` no SaaS) | parcial / SaaS |
| SaaS Parceiros | `/saas` | `brainx_parceiros`, `brainx_campanhas`, `brainx_criativos`, `brainx_metricas` | **tela sem conteúdo** (módulos brainx) |
| — | — | `amostras_retencao` | **sem UI** (só `types.ts`) |
| — | — | `recebimentos_conferencia` | **sem UI** (só types / não referenciada em pages) |
| — | — | `saas_tickets` | **sem UI** (só types) |
| — | — | `op_historro_etapas` (typo) | **não existe no código** — uso real é `op_historico_etapas` |

### Heart tables (com dados) — navegação que precisa funcionar

| tabela | menu / rota principal | status nav |
|--------|----------------------|------------|
| `anvisa_constituintes` | Consulta ANVISA `/regulatorio/anvisa` | no menu, arquivo OK |
| `item_anvisa_vinculo` | Conferência do RT `/regulatorio/homologacao-rt` | **PR #82** (`feat/homologacao-rt`) — ainda não em `main` |
| `formulas` / `formula_itens` | Formulador `/producao/formulas` (+ nova/editar/ver) | no menu + subrotas |
| `itens` | Produtos/Insumos `/cadastros/produtos` | no menu |
| `estoque_lotes` | Lotes `/estoque/lotes` (+ detalhe, quarentena, COA) | no menu |
| `estoque_movimentacoes` | Movimentações `/estoque/movimentacoes` | no menu |
| `ordens_producao_industrial` | Ordens de Produção `/producao/ordens` | no menu |
| `op_checklist` / `op_embalagens` | detalhe OP `/producao/ordens/:id` | acessível via lista OP |
| `notas_entrada` | Notas de Entrada `/compras/notas-entrada` | no menu |
| `lote_documentos` | Controle de COA `/qualidade/coa` + detalhe lote | no menu |
| `pops` | POPs `/qualidade/pops` | no menu |
| `responsaveis_tecnicos` | Resp. Técnicos `/cadastros/responsaveis-tecnicos` | no menu |
| `sensor_readings` | Monitoramento Ambiental `/ambiental/monitoramento` (+ `/ambiental/sensor/:deviceId`) | no menu |

---

## B4. Duplicação regulatória

Comparação de leituras: `anvisa_limites` / `regras_anvisa` vs `anvisa_constituintes`.

### `anvisa_constituintes` (fonte canônica em uso)

| arquivo | uso |
|---------|-----|
| `src/hooks/use-anvisa-search.ts` | `.from('anvisa_constituintes')` — Consulta ANVISA |
| `src/pages/regulatorio/ConsultaAnvisaPage.tsx` | consome `use-anvisa-search` |
| `src/hooks/useHomologacaoRT.ts` + `HomologacaoRTPage.tsx` | **PR #82** — join `item_anvisa_vinculo` → `anvisa_constituintes` (`limite_max_num` / `limite_unidade`) |

### `regras_anvisa` (deprecated — ainda no código)

| arquivo | uso |
|---------|-----|
| `src/hooks/use-validador-anvisa.ts` | `useRegrasANVISA` / `useGestaoRegrasANVISA` / `useValidadorANVISA` fazem `.from('regras_anvisa')` (select/insert/update) |
| `src/pages/producao/DashboardIndustrialPage.tsx` | importa só `useLogValidacoesANVISA` (não lê `regras_anvisa` diretamente) |
| `src/components/admin/BackendCleanupManager.tsx` | lista `"regras_anvisa"` como tabela limpável |
| `src/integrations/supabase/types.ts` | tipo gerado ainda presente |

**Nota:** `useRegrasANVISA`, `useValidadorANVISA` e `useGestaoRegrasANVISA` **não têm consumidores** fora do próprio arquivo — código morto que ainda aponta para a tabela deprecated.

### `anvisa_limites`

| escopo | achado |
|--------|--------|
| `src/**` | **nenhuma** leitura `.from('anvisa_limites')` |
| migrations | tabela criada em `supabase/migrations/20260704150000_anvisa_limites_base_homologavel.sql` |
| `types.ts` | tabela **não** aparece no client types gerado |

### Terceira fonte (hardcoded — risco de divergência)

| arquivo | uso |
|---------|-----|
| `src/lib/anvisa-limits` (via `ANVISA_LIMITS`) | `src/services/anvisa-laudo-generator.service.ts` — ANVISA Checker valida contra constante local, não contra `anvisa_constituintes` |

---

## Recomendações

Prioridade alta → baixa.

### 1. Esconder / despriorizar no menu (produto vazio)

Esconder ou marcar “em breve” até haver dados/processo:

1. **Vendas vazias:** CRM, Orçamentos, Pedidos, Expedição, Marketplace  
2. **Fiscal vazio:** Notas de Saída (+ expor ou esconder `/vendas/emissor-nfe`)  
3. **Qualidade vazia:** Calibrações  
4. **Regulatório parcial:** Biblioteca do RT (sem `legislacao_*`) — manter se RAG/offline ainda for útil; senão esconder radar  

Manter visíveis os heart paths: Formulador, OP, Lotes, Movimentações, Notas de Entrada, COA, Quarentena, Consulta ANVISA, Homologação RT (após merge do PR #82), Resp. Técnicos, POPs, Monitoramento Ambiental, Produtos/Insumos, Entidades.

**Nota:** a auditoria desta Parte B foi feita sobre `main`. O item de menu "Conferência do RT" entra com o PR #82 e não aparece na tabela B1 acima.

### 2. Corrigir (código / navegação)

1. **Regulatório:** migrar ou remover `use-validador-anvisa` → `regras_anvisa`; alinhar ANVISA Checker (`ANVISA_LIMITS` hardcoded) com `anvisa_constituintes`.  
2. **Duplicatas mortas:** remover (ou arquivar) `AuthPage.tsx`, `CriarOPDialog.tsx`, `EntidadeFormDialog.tsx` após confirmar bundle.  
3. **Imports/rotas órfãs:** remover lazy `LandingPage` sem Route; decidir destino de `RelatorioAnvisaRTPage.tsx` (rotear ou apagar).  
4. **Órfãs úteis a linkar no menu/admin:** `/estoque/dashboard-sem-coa`, `/producao/parametros`, `/vendas/emissor-nfe` (se fiscal for prioridade).  
5. **OP parcial:** UI de `op_controle_qualidade` / `op_historico_etapas` — ou popular no fluxo de OP, ou ocultar abas vazias.

### 3. Só falta dado (não é bug de menu)

| área | tabelas | ação |
|------|---------|------|
| Comercial | `orcamentos`, `pedidos_venda`, `oportunidades`, `crm_interacoes`, `catalogo_precos`, `expedicao_romaneio` | seed/demo ou go-live comercial |
| Fiscal saída | `notas_saida` | operação + certificado |
| QC calibração | `qc_calibracoes` | cadastro operacional |
| Ranking fornecedores | `ranking_fornecedores`, `avaliacoes_fornecedor` | processo de avaliação |
| Legislação / RAG | `legislacao_chunks`, `legislacao_monitoramento` | ingestão no SaaS admin |
| Contratos | `contratos_templates` | templates no Admin Master |
| BrainX / SaaS | `brainx_*`, `saas_comunicados`, `saas_tickets` | operação SaaS (tickets sem UI) |
| Sem tela | `amostras_retencao`, `recebimentos_conferencia` | implementar ou dropar do schema |

### Resumo executivo

- **Menu → rota → arquivo:** 50/50 OK; 0 menus mortos; 0 lazy imports quebrados.  
- **Principal risco de produto:** ~10 itens de menu comerciais/fiscais/QC apontam para tabelas vazias.  
- **Principal risco técnico regulatório:** três fontes de limites (DB `anvisa_constituintes`, DB morta `regras_anvisa`, constante `ANVISA_LIMITS`).  
- **Limpeza fácil:** AuthPage / CriarOPDialog / EntidadeFormDialog / LandingPage sem rota / RelatorioAnvisaRTPage sem rota.
