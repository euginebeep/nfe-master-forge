import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { CentralToastProvider } from "@/components/ui/central-toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { MainLayout } from "./components/layout/MainLayout";
import { GlobalSearchDialog } from "./components/search/GlobalSearchDialog";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { ModuleGuard } from "./components/auth/ModuleGuard";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { LoadingSpinner } from "./components/ui/loading-spinner";
import { AuthProvider } from "./contexts/AuthContext";

// Lazy loaded pages
const AuthPageModern = lazy(() => import("./components/auth/AuthPageModern"));
const Index = lazy(() => import("./pages/Index"));
const LandingPage = lazy(() => import("./pages/LandingPage"));
const RoadmapPage = lazy(() => import("./pages/RoadmapPage"));
const FAQPage = lazy(() => import("./pages/faq/FAQPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const OnboardingPage = lazy(() => import("./pages/onboarding/OnboardingPage"));
const EmpresaSettingsPage = lazy(() => import("./pages/settings/EmpresaSettingsPage"));
const CompanySettingsPage = lazy(() => import("./pages/settings/CompanySettingsPage"));
const ClearDataPage = lazy(() => import("./pages/settings/ClearDataPage"));
const MigrarDadosPage = lazy(() => import("./pages/settings/MigrarDadosPage"));
const ImportarDadosPage = lazy(() => import("./pages/settings/ImportarDadosPage"));
const AdminMasterPage = lazy(() => import("./pages/settings/AdminMasterPage"));
const AdminUnlockRequestsPage = lazy(() => import("./pages/settings/AdminUnlockRequestsPage"));
const XmlBackupPage = lazy(() => import("./pages/settings/XmlBackupPage"));
const FornecedoresListPage = lazy(() => import("./pages/cadastros/FornecedoresListPage"));
const ClientesListPage = lazy(() => import("./pages/cadastros/ClientesListPage"));
const TransportadorasListPage = lazy(() => import("./pages/cadastros/TransportadorasListPage"));
const EntidadeDetailPageComplete = lazy(() => import("./pages/cadastros/EntidadeDetailPageComplete"));
const EntidadesListPageComplete = lazy(() => import("./pages/cadastros/EntidadesListPageComplete"));
const ItensListPageComplete = lazy(() => import("./pages/cadastros/ItensListPageComplete"));
const ProdutoDetailPage = lazy(() => import("./pages/cadastros/ProdutoDetailPage"));
const ResponsaveisTecnicosPage = lazy(() => import("./pages/cadastros/ResponsaveisTecnicosPage"));
const FormuladorIndustrialPage = lazy(() => import("./pages/producao/FormuladorIndustrialPage"));
const NovaFormulaPage = lazy(() => import("./pages/producao/NovaFormulaPage"));
const EditarFormulaPage = lazy(() => import("./pages/producao/EditarFormulaPage"));
const VisualizarFormulaPage = lazy(() => import("./pages/producao/VisualizarFormulaPage"));
const ParametrosIndustriaPage = lazy(() => import("./pages/producao/ParametrosIndustriaPage"));
const RequisicoesCompraPage = lazy(() => import("./pages/producao/RequisicoesCompraPage"));
const RequisicaoDetalhePage = lazy(() => import("./pages/compras/RequisicaoDetalhePage"));
const OrdensProducaoIndustrialPage = lazy(() => import("./pages/producao/OrdensProducaoIndustrialPage"));
const OrdemProducaoDetailPage = lazy(() => import("./pages/producao/OrdemProducaoDetailPage"));
const OrdemProducaoImpressaoPage = lazy(() => import("./pages/producao/OrdemProducaoImpressaoPage"));
const DashboardIndustrialPage = lazy(() => import("./pages/producao/DashboardIndustrialPage"));
const DashboardExecutivoPage = lazy(() => import("./pages/producao/DashboardExecutivoPage"));
const QuarentenaPage = lazy(() => import("./pages/estoque/QuarentenaPage"));
const LotesListPage = lazy(() => import("./pages/estoque/LotesListPage"));
const LotesReservadosPage = lazy(() => import("./pages/estoque/LotesReservadosPage"));
const LoteDetailPage = lazy(() => import("./pages/estoque/LoteDetailPage"));
const DashboardSemCOAPage = lazy(() => import("./pages/estoque/DashboardSemCOAPage"));
const MovimentacoesPage = lazy(() => import("./pages/estoque/MovimentacoesPage"));
const RastreabilidadePage = lazy(() => import("./pages/estoque/RastreabilidadePage"));
const NFeImportPage = lazy(() => import("./pages/compras/NFeImportPage"));
const NotasEntradaPage = lazy(() => import("./pages/compras/NotasEntradaPage"));
const FatorConversaoPage = lazy(() => import("./pages/compras/FatorConversaoPage"));
const PainelCompradorPage = lazy(() => import("./pages/compras/PainelCompradorPage"));
const ContasPagarPage = lazy(() => import("./pages/financeiro/ContasPagarPage"));
const ContasReceberPage = lazy(() => import("./pages/financeiro/ContasReceberPage"));
const FluxoCaixaPage = lazy(() => import("./pages/financeiro/FluxoCaixaPage"));
const ConciliacaoPage = lazy(() => import("./pages/financeiro/ConciliacaoPage"));
const DREPage = lazy(() => import("./pages/financeiro/DREPage"));
const CRMPage = lazy(() => import("./pages/vendas/CRMPage"));
const NovoPedidoVendedorPage = lazy(() => import("./pages/vendas/NovoPedidoVendedorPage"));
const ExpedicaoPage = lazy(() => import("./pages/expedicao/ExpedicaoPage"));
const OrcamentosPage = lazy(() => import("./pages/vendas/OrcamentosPage"));
const PedidosVendaPage = lazy(() => import("./pages/vendas/PedidosVendaPage"));
const MarketplacePage = lazy(() => import("./pages/vendas/MarketplacePage"));
const NotasSaidaPage = lazy(() => import("./pages/vendas/NotasSaidaPage"));
const EmissorNFePage = lazy(() => import("./pages/vendas/EmissorNFePage"));
const RelatoriosPage = lazy(() => import("./pages/relatorios/RelatoriosPage"));
const RelatorioCapsulasPage = lazy(() => import("./pages/relatorios/RelatorioCapsulasPage"));
const AuditoriaPage = lazy(() => import("./pages/auditoria/AuditoriaPage"));
const UsuariosPage = lazy(() => import("./pages/usuarios/UsuariosPage"));
const LoteAuditoriaPublicaPage = lazy(() => import("./pages/audit/LoteAuditoriaPublicaPage"));
const VerificarOPPage = lazy(() => import("./pages/producao/VerificarOPPage"));
const NotificacoesPage = lazy(() => import("./pages/notificacoes/NotificacoesPage"));
const DesviosPage = lazy(() => import("./pages/qualidade/DesviosPage"));
const DesvioDetailPage = lazy(() => import("./pages/qualidade/DesvioDetailPage"));
const AnalisesPage = lazy(() => import("./pages/qualidade/AnalisesPage"));
const CalibracoesPage = lazy(() => import("./pages/qualidade/CalibracoesPage"));
const POPsPage = lazy(() => import("./pages/qualidade/POPsPage"));
const CoaQualidadePage = lazy(() => import("./pages/qualidade/CoaQualidadePage"));
const ConsultaAnvisaPage = lazy(() => import("./pages/regulatorio/ConsultaAnvisaPage"));
const MonitoramentoAmbientalPage = lazy(() => import("./pages/ambiental/MonitoramentoAmbientalPage"));
const AmbientalConfigPage = lazy(() => import("./pages/ambiental/AmbientalConfigPage"));
const SensorDetailPage = lazy(() => import("./pages/ambiental/SensorDetailPage"));
const ChatInternoPage = lazy(() => import("./pages/chat/ChatInternoPage"));
const AssinaturaPage = lazy(() => import("./pages/assinatura/AssinaturaPage"));
const SaasDashboardPage = lazy(() => import("./pages/saas/SaasDashboardPage"));
const GhostAuditPage = lazy(() => import("./pages/saas/GhostAuditPage"));
const InstallPage = lazy(() => import("./pages/install/InstallPage"));
const TermosUsoPage = lazy(() => import("./pages/legal/TermosUsoPage"));
const PoliticaPrivacidadePage = lazy(() => import("./pages/legal/PoliticaPrivacidadePage"));
const EquipamentosPage = lazy(() => import("./pages/settings/EquipamentosPage"));
const AnvisaCheckerPage = lazy(() => import("./pages/regulatorio/AnvisaCheckerPage"));
const BibliotecaRTPage = lazy(() => import("./pages/regulatorio/BibliotecaRTPage"));
const CertificadoStatusPage = lazy(() => import("./pages/settings/CertificadoStatusPage"));
const AuditoriaFiscalPage = lazy(() => import("./pages/vendas/AuditoriaFiscalPage"));


import { queryClient } from "./lib/query-client";
import { GhostModeIndicator } from "./components/saas/GhostModeIndicator";

const PageFallback = () => (
  <div className="flex-1 flex items-center justify-center p-6">
    <LoadingSpinner text="Carregando página..." />
  </div>
);

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <CentralToastProvider />
        <BrowserRouter>
          <AuthProvider>
          <GlobalSearchDialog />
          <GhostModeIndicator />
          <Suspense fallback={<LoadingSpinner fullPage />}>
            <Routes>
              {/* Páginas Públicas */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              
              {/* Auth - público */}
              <Route path="/auth" element={<Suspense fallback={<PageFallback />}><ErrorBoundary><AuthPageModern /></ErrorBoundary></Suspense>} />
              <Route path="/termos-de-uso" element={<Suspense fallback={<PageFallback />}><TermosUsoPage /></Suspense>} />
              <Route path="/politica-de-privacidade" element={<Suspense fallback={<PageFallback />}><PoliticaPrivacidadePage /></Suspense>} />

              {/* Onboarding */}
              <Route path="/onboarding" element={
                <ProtectedRoute>
                  <Suspense fallback={<PageFallback />}><OnboardingPage /></Suspense>
                </ProtectedRoute>
              } />

              {/* Páginas Públicas */}
              <Route path="/audit/lote/:hash" element={
                <Suspense fallback={<PageFallback />}><LoteAuditoriaPublicaPage /></Suspense>
              } />
              <Route path="/op/verify/:opId" element={
                <Suspense fallback={<PageFallback />}><VerificarOPPage /></Suspense>
              } />
              <Route path="/install" element={
                <Suspense fallback={<PageFallback />}><InstallPage /></Suspense>
              } />

              {/* SaaS Admin Panel — standalone, fora do layout ERP */}
              <Route path="/saas" element={
                <Suspense fallback={<PageFallback />}><ErrorBoundary><SaasDashboardPage /></ErrorBoundary></Suspense>
              } />
              <Route path="/saas/ghost-log" element={
                <Suspense fallback={<PageFallback />}><ErrorBoundary><GhostAuditPage /></ErrorBoundary></Suspense>
              } />

              {/* Rotas Protegidas */}
              <Route element={
                <ProtectedRoute>
                  <MainLayout />
                </ProtectedRoute>
              }>
                <Route path="/dashboard" element={<Suspense fallback={<PageFallback />}><ErrorBoundary><Index /></ErrorBoundary></Suspense>} />
                <Route path="/roadmap" element={<Suspense fallback={<PageFallback />}><ErrorBoundary><RoadmapPage /></ErrorBoundary></Suspense>} />
                <Route path="/faq" element={<Suspense fallback={<PageFallback />}><ErrorBoundary><FAQPage /></ErrorBoundary></Suspense>} />
                {/* Settings — admin only */}
                <Route path="/settings/empresa" element={<ProtectedRoute minRole="admin"><Suspense fallback={<PageFallback />}><ErrorBoundary><EmpresaSettingsPage /></ErrorBoundary></Suspense></ProtectedRoute>} />
                <Route path="/settings/company" element={<ProtectedRoute minRole="admin"><Suspense fallback={<PageFallback />}><ErrorBoundary><CompanySettingsPage /></ErrorBoundary></Suspense></ProtectedRoute>} />
                <Route path="/settings/clear-data" element={<ProtectedRoute minRole="admin"><Suspense fallback={<PageFallback />}><ErrorBoundary><ClearDataPage /></ErrorBoundary></Suspense></ProtectedRoute>} />
                <Route path="/settings/migrar-dados" element={<ProtectedRoute minRole="admin"><Suspense fallback={<PageFallback />}><ErrorBoundary><MigrarDadosPage /></ErrorBoundary></Suspense></ProtectedRoute>} />
                <Route path="/settings/importar-dados" element={<ProtectedRoute minRole="admin"><Suspense fallback={<PageFallback />}><ErrorBoundary><ImportarDadosPage /></ErrorBoundary></Suspense></ProtectedRoute>} />
                <Route path="/settings/admin-master" element={<ProtectedRoute minRole="admin"><Suspense fallback={<PageFallback />}><ErrorBoundary><AdminMasterPage /></ErrorBoundary></Suspense></ProtectedRoute>} />
                <Route path="/settings/unlock-requests" element={<ProtectedRoute minRole="admin"><Suspense fallback={<PageFallback />}><ErrorBoundary><AdminUnlockRequestsPage /></ErrorBoundary></Suspense></ProtectedRoute>} />
                <Route path="/settings/xml-backup" element={<ProtectedRoute minRole="admin"><Suspense fallback={<PageFallback />}><ErrorBoundary><XmlBackupPage /></ErrorBoundary></Suspense></ProtectedRoute>} />
                <Route path="/settings/equipamentos" element={<ProtectedRoute minRole="admin"><Suspense fallback={<PageFallback />}><ErrorBoundary><ModuleGuard modulo="producao" moduloLabel="Produção"><EquipamentosPage /></ModuleGuard></ErrorBoundary></Suspense></ProtectedRoute>} />
                <Route path="/settings/certificado-status" element={<ProtectedRoute minRole="admin"><Suspense fallback={<PageFallback />}><ErrorBoundary><CertificadoStatusPage /></ErrorBoundary></Suspense></ProtectedRoute>} />

                {/* Cadastros */}
                <Route path="/cadastros/entidades" element={<Suspense fallback={<PageFallback />}><ErrorBoundary><ModuleGuard modulo="entidades" moduloLabel="Entidades"><EntidadesListPageComplete /></ModuleGuard></ErrorBoundary></Suspense>} />
                <Route path="/cadastros/fornecedores" element={<Suspense fallback={<PageFallback />}><ErrorBoundary><FornecedoresListPage /></ErrorBoundary></Suspense>} />
                <Route path="/cadastros/clientes" element={<Suspense fallback={<PageFallback />}><ErrorBoundary><ClientesListPage /></ErrorBoundary></Suspense>} />
                <Route path="/cadastros/transportadoras" element={<Suspense fallback={<PageFallback />}><ErrorBoundary><TransportadorasListPage /></ErrorBoundary></Suspense>} />
                <Route path="/cadastros/entidades/:id" element={<Suspense fallback={<PageFallback />}><ErrorBoundary><EntidadeDetailPageComplete /></ErrorBoundary></Suspense>} />
                <Route path="/cadastros/produtos" element={<Suspense fallback={<PageFallback />}><ErrorBoundary><ModuleGuard modulo="itens" moduloLabel="Produtos/Insumos"><ItensListPageComplete /></ModuleGuard></ErrorBoundary></Suspense>} />
                <Route path="/cadastros/itens" element={<Suspense fallback={<PageFallback />}><ErrorBoundary><ItensListPageComplete /></ErrorBoundary></Suspense>} />
                <Route path="/cadastros/itens/:id" element={<Suspense fallback={<PageFallback />}><ErrorBoundary><ProdutoDetailPage /></ErrorBoundary></Suspense>} />
                <Route path="/cadastros/produtos/:id" element={<Suspense fallback={<PageFallback />}><ErrorBoundary><ProdutoDetailPage /></ErrorBoundary></Suspense>} />
                <Route path="/cadastros/responsaveis-tecnicos" element={<Suspense fallback={<PageFallback />}><ErrorBoundary><ModuleGuard modulo="producao" moduloLabel="Produção"><ResponsaveisTecnicosPage /></ModuleGuard></ErrorBoundary></Suspense>} />
                <Route path="/responsaveis-tecnicos" element={<Navigate to="/cadastros/responsaveis-tecnicos" replace />} />

                {/* Produção — supervisor+ */}
                <Route path="/producao/formulas" element={<ProtectedRoute minRole="supervisor"><Suspense fallback={<PageFallback />}><ErrorBoundary><ModuleGuard modulo="producao" moduloLabel="Produção"><FormuladorIndustrialPage /></ModuleGuard></ErrorBoundary></Suspense></ProtectedRoute>} />
                <Route path="/producao/formulas/nova" element={<ProtectedRoute minRole="supervisor"><Suspense fallback={<PageFallback />}><ErrorBoundary><NovaFormulaPage /></ErrorBoundary></Suspense></ProtectedRoute>} />
                <Route path="/producao/formulas/:id" element={<ProtectedRoute minRole="supervisor"><Suspense fallback={<PageFallback />}><ErrorBoundary><VisualizarFormulaPage /></ErrorBoundary></Suspense></ProtectedRoute>} />
                <Route path="/producao/formulas/:id/editar" element={<ProtectedRoute minRole="supervisor"><Suspense fallback={<PageFallback />}><ErrorBoundary><EditarFormulaPage /></ErrorBoundary></Suspense></ProtectedRoute>} />
                <Route path="/producao/parametros" element={<ProtectedRoute minRole="supervisor"><Suspense fallback={<PageFallback />}><ErrorBoundary><ModuleGuard modulo="producao" moduloLabel="Produção"><ParametrosIndustriaPage /></ModuleGuard></ErrorBoundary></Suspense></ProtectedRoute>} />
                <Route path="/producao/requisicoes" element={<Navigate to="/compras/requisicoes" replace />} />

                <Route path="/regulatorio/anvisa" element={<Suspense fallback={<PageFallback />}><ErrorBoundary><ModuleGuard modulo="producao" moduloLabel="Produção"><ConsultaAnvisaPage /></ModuleGuard></ErrorBoundary></Suspense>} />
                <Route path="/regulatorio/consulta-anvisa" element={<Navigate to="/regulatorio/anvisa" replace />} />
                <Route path="/producao/ordens" element={<ProtectedRoute minRole="supervisor"><Suspense fallback={<PageFallback />}><ErrorBoundary><ModuleGuard modulo="producao" moduloLabel="Produção"><OrdensProducaoIndustrialPage /></ModuleGuard></ErrorBoundary></Suspense></ProtectedRoute>} />
                <Route path="/producao/ordens/:id" element={<ProtectedRoute minRole="supervisor"><Suspense fallback={<PageFallback />}><ErrorBoundary><ModuleGuard modulo="producao" moduloLabel="Produção"><OrdemProducaoDetailPage /></ModuleGuard></ErrorBoundary></Suspense></ProtectedRoute>} />
                <Route path="/producao/ordens/:id/imprimir" element={<ProtectedRoute minRole="supervisor"><Suspense fallback={<PageFallback />}><ErrorBoundary><ModuleGuard modulo="producao" moduloLabel="Produção"><OrdemProducaoImpressaoPage /></ModuleGuard></ErrorBoundary></Suspense></ProtectedRoute>} />

                <Route path="/producao/dashboard" element={<ProtectedRoute minRole="supervisor"><Suspense fallback={<PageFallback />}><ErrorBoundary><ModuleGuard modulo="producao" moduloLabel="Produção"><DashboardIndustrialPage /></ModuleGuard></ErrorBoundary></Suspense></ProtectedRoute>} />
                <Route path="/producao/executivo" element={<ProtectedRoute minRole="gerente"><Suspense fallback={<PageFallback />}><ErrorBoundary><ModuleGuard modulo="producao" moduloLabel="Produção"><DashboardExecutivoPage /></ModuleGuard></ErrorBoundary></Suspense></ProtectedRoute>} />
                {/* Estoque */}
                <Route path="/estoque/quarentena" element={<Suspense fallback={<PageFallback />}><ErrorBoundary><ModuleGuard modulo="qualidade" moduloLabel="Qualidade"><QuarentenaPage /></ModuleGuard></ErrorBoundary></Suspense>} />
                <Route path="/estoque/lotes" element={<Suspense fallback={<PageFallback />}><ErrorBoundary><ModuleGuard modulo="estoque" moduloLabel="Estoque"><LotesListPage /></ModuleGuard></ErrorBoundary></Suspense>} />
                <Route path="/estoque/lotes-reservados" element={<Suspense fallback={<PageFallback />}><ErrorBoundary><ModuleGuard modulo="estoque" moduloLabel="Estoque"><LotesReservadosPage /></ModuleGuard></ErrorBoundary></Suspense>} />
                <Route path="/estoque/lotes/:id" element={<Suspense fallback={<PageFallback />}><ErrorBoundary><ModuleGuard modulo="estoque" moduloLabel="Estoque"><LoteDetailPage /></ModuleGuard></ErrorBoundary></Suspense>} />
                <Route path="/estoque/dashboard-sem-coa" element={<Suspense fallback={<PageFallback />}><ErrorBoundary><ModuleGuard modulo="estoque" moduloLabel="Estoque"><DashboardSemCOAPage /></ModuleGuard></ErrorBoundary></Suspense>} />
                <Route path="/estoque/movimentacoes" element={<Suspense fallback={<PageFallback />}><ErrorBoundary><ModuleGuard modulo="estoque" moduloLabel="Estoque"><MovimentacoesPage /></ModuleGuard></ErrorBoundary></Suspense>} />
                <Route path="/estoque/rastreabilidade" element={<Suspense fallback={<PageFallback />}><ErrorBoundary><ModuleGuard modulo="qualidade" moduloLabel="Qualidade"><RastreabilidadePage /></ModuleGuard></ErrorBoundary></Suspense>} />
                {/* Compras — operador+ */}
                <Route path="/compras/importar-nfe" element={<ProtectedRoute minRole="operador"><Suspense fallback={<PageFallback />}><ErrorBoundary><ModuleGuard modulo="compras" moduloLabel="Compras"><NFeImportPage /></ModuleGuard></ErrorBoundary></Suspense></ProtectedRoute>} />
                <Route path="/compras/nfe-import" element={<ProtectedRoute minRole="operador"><Suspense fallback={<PageFallback />}><ErrorBoundary><ModuleGuard modulo="compras" moduloLabel="Compras"><NFeImportPage /></ModuleGuard></ErrorBoundary></Suspense></ProtectedRoute>} />
                <Route path="/compras/notas-entrada" element={<ProtectedRoute minRole="operador"><Suspense fallback={<PageFallback />}><ErrorBoundary><ModuleGuard modulo="compras" moduloLabel="Compras"><NotasEntradaPage /></ModuleGuard></ErrorBoundary></Suspense></ProtectedRoute>} />
                <Route path="/compras/fator-conversao" element={<ProtectedRoute minRole="operador"><Suspense fallback={<PageFallback />}><ErrorBoundary><ModuleGuard modulo="compras" moduloLabel="Compras"><FatorConversaoPage /></ModuleGuard></ErrorBoundary></Suspense></ProtectedRoute>} />
                <Route path="/compras/comprar" element={<ProtectedRoute minRole="supervisor"><Suspense fallback={<PageFallback />}><ErrorBoundary><ModuleGuard modulo="compras" moduloLabel="Compras"><PainelCompradorPage /></ModuleGuard></ErrorBoundary></Suspense></ProtectedRoute>} />
                <Route path="/compras/requisicoes" element={<ProtectedRoute minRole="supervisor"><Suspense fallback={<PageFallback />}><ErrorBoundary><ModuleGuard modulo="compras" moduloLabel="Compras"><RequisicoesCompraPage /></ModuleGuard></ErrorBoundary></Suspense></ProtectedRoute>} />
                <Route path="/compras/requisicoes/:id" element={<ProtectedRoute minRole="supervisor"><Suspense fallback={<PageFallback />}><ErrorBoundary><ModuleGuard modulo="compras" moduloLabel="Compras"><RequisicaoDetalhePage /></ModuleGuard></ErrorBoundary></Suspense></ProtectedRoute>} />
                {/* Financeiro — gerente+ */}
                <Route path="/financeiro/pagar" element={<ProtectedRoute minRole="gerente"><Suspense fallback={<PageFallback />}><ErrorBoundary><ModuleGuard modulo="financeiro" moduloLabel="Financeiro"><ContasPagarPage /></ModuleGuard></ErrorBoundary></Suspense></ProtectedRoute>} />
                <Route path="/financeiro/contas-pagar" element={<Navigate to="/financeiro/pagar" replace />} />
                <Route path="/financeiro/receber" element={<ProtectedRoute minRole="gerente"><Suspense fallback={<PageFallback />}><ErrorBoundary><ModuleGuard modulo="financeiro" moduloLabel="Financeiro"><ContasReceberPage /></ModuleGuard></ErrorBoundary></Suspense></ProtectedRoute>} />
                <Route path="/financeiro/fluxo" element={<ProtectedRoute minRole="gerente"><Suspense fallback={<PageFallback />}><ErrorBoundary><ModuleGuard modulo="financeiro" moduloLabel="Financeiro"><FluxoCaixaPage /></ModuleGuard></ErrorBoundary></Suspense></ProtectedRoute>} />
                <Route path="/financeiro/conciliacao" element={<ProtectedRoute minRole="gerente"><Suspense fallback={<PageFallback />}><ErrorBoundary><ModuleGuard modulo="financeiro" moduloLabel="Financeiro"><ConciliacaoPage /></ModuleGuard></ErrorBoundary></Suspense></ProtectedRoute>} />
                <Route path="/financeiro/dre" element={<ProtectedRoute minRole="gerente"><Suspense fallback={<PageFallback />}><ErrorBoundary><ModuleGuard modulo="financeiro" moduloLabel="Financeiro"><DREPage /></ModuleGuard></ErrorBoundary></Suspense></ProtectedRoute>} />
                {/* Vendas — operador+ */}
                <Route path="/vendas/crm" element={<ProtectedRoute minRole="operador"><Suspense fallback={<PageFallback />}><ErrorBoundary><ModuleGuard modulo="vendas" moduloLabel="Vendas"><CRMPage /></ModuleGuard></ErrorBoundary></Suspense></ProtectedRoute>} />
                <Route path="/vendas/pedido-vendedor/novo" element={<ProtectedRoute minRole="operador"><Suspense fallback={<PageFallback />}><ErrorBoundary><ModuleGuard modulo="vendas" moduloLabel="Vendas"><NovoPedidoVendedorPage /></ModuleGuard></ErrorBoundary></Suspense></ProtectedRoute>} />
                <Route path="/expedicao" element={<ProtectedRoute minRole="supervisor"><Suspense fallback={<PageFallback />}><ErrorBoundary><ModuleGuard modulo="vendas" moduloLabel="Vendas"><ExpedicaoPage /></ModuleGuard></ErrorBoundary></Suspense></ProtectedRoute>} />
                <Route path="/vendas/orcamentos" element={<ProtectedRoute minRole="operador"><Suspense fallback={<PageFallback />}><ErrorBoundary><ModuleGuard modulo="vendas" moduloLabel="Vendas"><OrcamentosPage /></ModuleGuard></ErrorBoundary></Suspense></ProtectedRoute>} />
                <Route path="/vendas/pedidos" element={<ProtectedRoute minRole="operador"><Suspense fallback={<PageFallback />}><ErrorBoundary><ModuleGuard modulo="vendas" moduloLabel="Vendas"><PedidosVendaPage /></ModuleGuard></ErrorBoundary></Suspense></ProtectedRoute>} />
                <Route path="/regulatorio/anvisa-checker" element={<ProtectedRoute minRole="supervisor"><Suspense fallback={<PageFallback />}><ErrorBoundary><ModuleGuard modulo="producao" moduloLabel="Produção"><AnvisaCheckerPage /></ModuleGuard></ErrorBoundary></Suspense></ProtectedRoute>} />
                <Route path="/vendas/marketplace" element={<ProtectedRoute minRole="operador"><Suspense fallback={<PageFallback />}><ErrorBoundary><ModuleGuard modulo="vendas" moduloLabel="Vendas"><MarketplacePage /></ModuleGuard></ErrorBoundary></Suspense></ProtectedRoute>} />
                <Route path="/vendas/notas-saida" element={<ProtectedRoute minRole="operador"><Suspense fallback={<PageFallback />}><ErrorBoundary><ModuleGuard modulo="fiscal" moduloLabel="Fiscal"><NotasSaidaPage /></ModuleGuard></ErrorBoundary></Suspense></ProtectedRoute>} />
                <Route path="/vendas/emissor-nfe" element={<ProtectedRoute minRole="operador"><Suspense fallback={<PageFallback />}><ErrorBoundary><ModuleGuard modulo="fiscal" moduloLabel="Fiscal"><EmissorNFePage /></ModuleGuard></ErrorBoundary></Suspense></ProtectedRoute>} />
                <Route path="/vendas/auditoria-fiscal" element={<ProtectedRoute minRole="operador"><Suspense fallback={<PageFallback />}><ErrorBoundary><ModuleGuard modulo="fiscal" moduloLabel="Fiscal"><AuditoriaFiscalPage /></ModuleGuard></ErrorBoundary></Suspense></ProtectedRoute>} />
                {/* Relatórios */}
                <Route path="/relatorios" element={<Suspense fallback={<PageFallback />}><ErrorBoundary><ModuleGuard modulo="relatorios" moduloLabel="Relatórios"><RelatoriosPage /></ModuleGuard></ErrorBoundary></Suspense>} />
                <Route path="/relatorios/capsulas" element={<Suspense fallback={<PageFallback />}><ErrorBoundary><ModuleGuard modulo="relatorios" moduloLabel="Relatórios"><RelatorioCapsulasPage /></ModuleGuard></ErrorBoundary></Suspense>} />
                <Route path="/auditoria" element={<Suspense fallback={<PageFallback />}><ErrorBoundary><ModuleGuard modulo="relatorios" moduloLabel="Relatórios"><AuditoriaPage /></ModuleGuard></ErrorBoundary></Suspense>} />
                {/* Qualidade */}
                <Route path="/qualidade/desvios" element={<Suspense fallback={<PageFallback />}><ErrorBoundary><ModuleGuard modulo="qualidade" moduloLabel="Qualidade"><DesviosPage /></ModuleGuard></ErrorBoundary></Suspense>} />
                <Route path="/qualidade/desvios/:id" element={<Suspense fallback={<PageFallback />}><ErrorBoundary><ModuleGuard modulo="qualidade" moduloLabel="Qualidade"><DesvioDetailPage /></ModuleGuard></ErrorBoundary></Suspense>} />
                <Route path="/qualidade/analises" element={<Suspense fallback={<PageFallback />}><ErrorBoundary><ModuleGuard modulo="qualidade" moduloLabel="Qualidade"><AnalisesPage /></ModuleGuard></ErrorBoundary></Suspense>} />
                <Route path="/qualidade/calibracoes" element={<Suspense fallback={<PageFallback />}><ErrorBoundary><ModuleGuard modulo="qualidade" moduloLabel="Qualidade"><CalibracoesPage /></ModuleGuard></ErrorBoundary></Suspense>} />
                <Route path="/qualidade/pops" element={<Suspense fallback={<PageFallback />}><ErrorBoundary><ModuleGuard modulo="qualidade" moduloLabel="Qualidade"><POPsPage /></ModuleGuard></ErrorBoundary></Suspense>} />
                <Route path="/qualidade/coa" element={<Suspense fallback={<PageFallback />}><ErrorBoundary><ModuleGuard modulo="qualidade" moduloLabel="Qualidade"><CoaQualidadePage /></ModuleGuard></ErrorBoundary></Suspense>} />
                {/* Regulatório */}
                <Route path="/regulatorio/anvisa" element={<Suspense fallback={<PageFallback />}><ErrorBoundary><ModuleGuard modulo="producao" moduloLabel="Produção"><ConsultaAnvisaPage /></ModuleGuard></ErrorBoundary></Suspense>} />
                <Route path="/regulatorio/biblioteca-rt" element={<Suspense fallback={<PageFallback />}><ErrorBoundary><ModuleGuard modulo="producao" moduloLabel="Produção"><BibliotecaRTPage /></ModuleGuard></ErrorBoundary></Suspense>} />
                <Route path="/ambiental/monitoramento" element={<Suspense fallback={<PageFallback />}><ErrorBoundary><ModuleGuard modulo="producao" moduloLabel="Produção"><MonitoramentoAmbientalPage /></ModuleGuard></ErrorBoundary></Suspense>} />
                <Route path="/ambiental/sensor/:deviceId" element={<Suspense fallback={<PageFallback />}><ErrorBoundary><ModuleGuard modulo="producao" moduloLabel="Produção"><SensorDetailPage /></ModuleGuard></ErrorBoundary></Suspense>} />
                <Route path="/ambiental/configuracao" element={<ProtectedRoute minRole="admin"><Suspense fallback={<PageFallback />}><ErrorBoundary><ModuleGuard modulo="producao" moduloLabel="Produção"><AmbientalConfigPage /></ModuleGuard></ErrorBoundary></Suspense></ProtectedRoute>} />
                {/* Notificações */}
                <Route path="/notificacoes" element={<Suspense fallback={<PageFallback />}><ErrorBoundary><NotificacoesPage /></ErrorBoundary></Suspense>} />
                {/* Chat Interno */}
                <Route path="/chat" element={<Suspense fallback={<PageFallback />}><ErrorBoundary><ChatInternoPage /></ErrorBoundary></Suspense>} />
                {/* Assinatura */}
                <Route path="/assinatura" element={<Suspense fallback={<PageFallback />}><ErrorBoundary><AssinaturaPage /></ErrorBoundary></Suspense>} />
                {/* Usuários — admin only */}
                <Route path="/usuarios" element={<ProtectedRoute minRole="admin"><Suspense fallback={<PageFallback />}><ErrorBoundary><ModuleGuard modulo="usuarios" moduloLabel="Usuários"><UsuariosPage /></ModuleGuard></ErrorBoundary></Suspense></ProtectedRoute>} />
                <Route path="/settings/usuarios" element={<ProtectedRoute minRole="admin"><Suspense fallback={<PageFallback />}><ErrorBoundary><ModuleGuard modulo="usuarios" moduloLabel="Usuários"><UsuariosPage /></ModuleGuard></ErrorBoundary></Suspense></ProtectedRoute>} />
              </Route>

              <Route path="*" element={<Suspense fallback={<PageFallback />}><NotFound /></Suspense>} />
            </Routes>
          </Suspense>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;