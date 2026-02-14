import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { CentralToastProvider } from "@/components/ui/central-toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { MainLayout } from "./components/layout/MainLayout";
import { GlobalSearchDialog } from "./components/search/GlobalSearchDialog";
import Index from "./pages/Index";
import RoadmapPage from "./pages/RoadmapPage";
import NotFound from "./pages/NotFound";
import AuthPage from "./components/auth/AuthPage";
import EmpresaSettingsPage from "./pages/settings/EmpresaSettingsPage";
import CompanySettingsPage from "./pages/settings/CompanySettingsPage";
import ClearDataPage from "./pages/settings/ClearDataPage";
import MigrarDadosPage from "./pages/settings/MigrarDadosPage";
import AdminMasterPage from "./pages/settings/AdminMasterPage";
import XmlBackupPage from "./pages/settings/XmlBackupPage";
import FornecedoresListPage from "./pages/cadastros/FornecedoresListPage";
import ClientesListPage from "./pages/cadastros/ClientesListPage";
import TransportadorasListPage from "./pages/cadastros/TransportadorasListPage";
import EntidadeDetailPageComplete from "./pages/cadastros/EntidadeDetailPageComplete";
import EntidadesListPageComplete from "./pages/cadastros/EntidadesListPageComplete";
import ItensListPageComplete from "./pages/cadastros/ItensListPageComplete";
import ProdutoDetailPage from "./pages/cadastros/ProdutoDetailPage";
import ResponsaveisTecnicosPage from "./pages/cadastros/ResponsaveisTecnicosPage";
import FormuladorIndustrialPage from "./pages/producao/FormuladorIndustrialPage";
import NovaFormulaPage from "./pages/producao/NovaFormulaPage";
import EditarFormulaPage from "./pages/producao/EditarFormulaPage";
import VisualizarFormulaPage from "./pages/producao/VisualizarFormulaPage";
import OrdensProducaoIndustrialPage from "./pages/producao/OrdensProducaoIndustrialPage";
import OrdemProducaoDetailPage from "./pages/producao/OrdemProducaoDetailPage";
import DashboardIndustrialPage from "./pages/producao/DashboardIndustrialPage";
import DashboardExecutivoPage from "./pages/producao/DashboardExecutivoPage";
import QuarentenaPage from "./pages/estoque/QuarentenaPage";
import LotesListPage from "./pages/estoque/LotesListPage";
import LoteDetailPage from "./pages/estoque/LoteDetailPage";
import MovimentacoesPage from "./pages/estoque/MovimentacoesPage";
import NFeImportPage from "./pages/compras/NFeImportPage";
import NotasEntradaPage from "./pages/compras/NotasEntradaPage";
import ContasPagarPage from "./pages/financeiro/ContasPagarPage";
import ContasReceberPage from "./pages/financeiro/ContasReceberPage";
import FluxoCaixaPage from "./pages/financeiro/FluxoCaixaPage";
import CRMPage from "./pages/vendas/CRMPage";
import OrcamentosPage from "./pages/vendas/OrcamentosPage";
import PedidosVendaPage from "./pages/vendas/PedidosVendaPage";
import MarketplacePage from "./pages/vendas/MarketplacePage";
import NotasSaidaPage from "./pages/vendas/NotasSaidaPage";
import RelatoriosPage from "./pages/relatorios/RelatoriosPage";
import RelatorioCapsulasPage from "./pages/relatorios/RelatorioCapsulasPage";
import AuditoriaPage from "./pages/auditoria/AuditoriaPage";
import UsuariosPage from "./pages/usuarios/UsuariosPage";
import LoteAuditoriaPublicaPage from "./pages/audit/LoteAuditoriaPublicaPage";
import VerificarOPPage from "./pages/producao/VerificarOPPage";
import NotificacoesPage from "./pages/notificacoes/NotificacoesPage";
const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <CentralToastProvider />
      <BrowserRouter>
        <GlobalSearchDialog />
        <Routes>
          {/* Auth */}
          <Route path="/auth" element={<AuthPage />} />
          
          <Route element={<MainLayout />}>
            <Route path="/" element={<Index />} />
            <Route path="/roadmap" element={<RoadmapPage />} />
            {/* Settings */}
            <Route path="/settings/empresa" element={<EmpresaSettingsPage />} />
            <Route path="/settings/company" element={<CompanySettingsPage />} />
            <Route path="/settings/clear-data" element={<ClearDataPage />} />
            <Route path="/settings/migrar-dados" element={<MigrarDadosPage />} />
            <Route path="/settings/admin-master" element={<AdminMasterPage />} />
            <Route path="/settings/xml-backup" element={<XmlBackupPage />} />
            {/* Cadastros */}
            <Route path="/cadastros/entidades" element={<EntidadesListPageComplete />} />
            <Route path="/cadastros/fornecedores" element={<FornecedoresListPage />} />
            <Route path="/cadastros/clientes" element={<ClientesListPage />} />
            <Route path="/cadastros/transportadoras" element={<TransportadorasListPage />} />
            <Route path="/cadastros/entidades/:id" element={<EntidadeDetailPageComplete />} />
            <Route path="/cadastros/produtos" element={<ItensListPageComplete />} />
            <Route path="/cadastros/itens" element={<ItensListPageComplete />} />
            <Route path="/cadastros/itens/:id" element={<ProdutoDetailPage />} />
            <Route path="/cadastros/produtos/:id" element={<ProdutoDetailPage />} />
            <Route path="/cadastros/responsaveis-tecnicos" element={<ResponsaveisTecnicosPage />} />
            {/* Producao */}
            <Route path="/producao/formulas" element={<FormuladorIndustrialPage />} />
            <Route path="/producao/formulas/nova" element={<NovaFormulaPage />} />
            <Route path="/producao/formulas/:id" element={<VisualizarFormulaPage />} />
            <Route path="/producao/formulas/:id/editar" element={<EditarFormulaPage />} />
            <Route path="/producao/ordens" element={<OrdensProducaoIndustrialPage />} />
            <Route path="/producao/ordens/:id" element={<OrdemProducaoDetailPage />} />
            <Route path="/producao/dashboard" element={<DashboardIndustrialPage />} />
            <Route path="/producao/executivo" element={<DashboardExecutivoPage />} />
            {/* Estoque */}
            <Route path="/estoque/quarentena" element={<QuarentenaPage />} />
            <Route path="/estoque/lotes" element={<LotesListPage />} />
            <Route path="/estoque/lotes/:id" element={<LoteDetailPage />} />
            <Route path="/estoque/movimentacoes" element={<MovimentacoesPage />} />
            {/* Compras */}
            <Route path="/compras/importar-nfe" element={<NFeImportPage />} />
            <Route path="/compras/nfe-import" element={<NFeImportPage />} />
            <Route path="/compras/notas-entrada" element={<NotasEntradaPage />} />
            {/* Financeiro */}
            <Route path="/financeiro/pagar" element={<ContasPagarPage />} />
            <Route path="/financeiro/contas-pagar" element={<ContasPagarPage />} />
            <Route path="/financeiro/receber" element={<ContasReceberPage />} />
            <Route path="/financeiro/fluxo" element={<FluxoCaixaPage />} />
            {/* Vendas */}
            <Route path="/vendas/crm" element={<CRMPage />} />
            <Route path="/vendas/orcamentos" element={<OrcamentosPage />} />
            <Route path="/vendas/pedidos" element={<PedidosVendaPage />} />
            <Route path="/vendas/marketplace" element={<MarketplacePage />} />
            <Route path="/vendas/notas-saida" element={<NotasSaidaPage />} />
            {/* Relatorios */}
            <Route path="/relatorios" element={<RelatoriosPage />} />
            <Route path="/relatorios/capsulas" element={<RelatorioCapsulasPage />} />
            <Route path="/auditoria" element={<AuditoriaPage />} />
            {/* Notificações */}
            <Route path="/notificacoes" element={<NotificacoesPage />} />
            {/* Usuarios */}
            <Route path="/usuarios" element={<UsuariosPage />} />
            <Route path="/settings/usuarios" element={<UsuariosPage />} />
          </Route>
          {/* Páginas Públicas */}
          <Route path="/audit/lote/:hash" element={<LoteAuditoriaPublicaPage />} />
          <Route path="/op/verify/:opId" element={<VerificarOPPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
