import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { MainLayout } from "./components/layout/MainLayout";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import EmpresaSettingsPage from "./pages/settings/EmpresaSettingsPage";
import ClearDataPage from "./pages/settings/ClearDataPage";
import AdminMasterPage from "./pages/settings/AdminMasterPage";
import XmlBackupPage from "./pages/settings/XmlBackupPage";
import FornecedoresListPage from "./pages/cadastros/FornecedoresListPage";
import ClientesListPage from "./pages/cadastros/ClientesListPage";
import TransportadorasListPage from "./pages/cadastros/TransportadorasListPage";
import EntidadeDetailPageComplete from "./pages/cadastros/EntidadeDetailPageComplete";
import EntidadesListPageComplete from "./pages/cadastros/EntidadesListPageComplete";
import ItensListPageComplete from "./pages/cadastros/ItensListPageComplete";
import ProdutoDetailPage from "./pages/cadastros/ProdutoDetailPage";
import FormulasListPage from "./pages/producao/FormulasListPage";
import OrdensProducaoPage from "./pages/producao/OrdensProducaoPage";
import QuarentenaPage from "./pages/estoque/QuarentenaPage";
import LotesListPage from "./pages/estoque/LotesListPage";
import MovimentacoesPage from "./pages/estoque/MovimentacoesPage";
import NFeImportPage from "./pages/compras/NFeImportPage";
import NotasEntradaPage from "./pages/compras/NotasEntradaPage";
import ContasPagarPage from "./pages/financeiro/ContasPagarPage";
import ContasReceberPage from "./pages/financeiro/ContasReceberPage";
import FluxoCaixaPage from "./pages/financeiro/FluxoCaixaPage";
import CRMPage from "./pages/vendas/CRMPage";
import PedidosPage from "./pages/vendas/PedidosPage";
import MarketplacePage from "./pages/vendas/MarketplacePage";
import NotasSaidaPage from "./pages/vendas/NotasSaidaPage";
import RelatoriosPage from "./pages/relatorios/RelatoriosPage";
import AuditoriaPage from "./pages/auditoria/AuditoriaPage";
import UsuariosPage from "./pages/usuarios/UsuariosPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/" element={<Index />} />
            {/* Settings */}
            <Route path="/settings/empresa" element={<EmpresaSettingsPage />} />
            <Route path="/settings/clear-data" element={<ClearDataPage />} />
            <Route path="/settings/admin-master" element={<AdminMasterPage />} />
            <Route path="/settings/xml-backup" element={<XmlBackupPage />} />
            {/* Cadastros */}
            <Route path="/cadastros/entidades" element={<EntidadesListPageComplete />} />
            <Route path="/cadastros/fornecedores" element={<FornecedoresListPage />} />
            <Route path="/cadastros/clientes" element={<ClientesListPage />} />
            <Route path="/cadastros/transportadoras" element={<TransportadorasListPage />} />
            <Route path="/cadastros/entidades/:id" element={<EntidadeDetailPageComplete />} />
            <Route path="/cadastros/produtos" element={<ItensListPageComplete />} />
            <Route path="/cadastros/itens/:id" element={<ProdutoDetailPage />} />
            <Route path="/cadastros/produtos/:id" element={<ProdutoDetailPage />} />
            {/* Producao */}
            <Route path="/producao/formulas" element={<FormulasListPage />} />
            <Route path="/producao/ordens" element={<OrdensProducaoPage />} />
            {/* Estoque */}
            <Route path="/estoque/quarentena" element={<QuarentenaPage />} />
            <Route path="/estoque/lotes" element={<LotesListPage />} />
            <Route path="/estoque/movimentacoes" element={<MovimentacoesPage />} />
            {/* Compras */}
            <Route path="/compras/importar-nfe" element={<NFeImportPage />} />
            <Route path="/compras/notas-entrada" element={<NotasEntradaPage />} />
            {/* Financeiro */}
            <Route path="/financeiro/pagar" element={<ContasPagarPage />} />
            <Route path="/financeiro/receber" element={<ContasReceberPage />} />
            <Route path="/financeiro/fluxo" element={<FluxoCaixaPage />} />
            {/* Vendas */}
            <Route path="/vendas/crm" element={<CRMPage />} />
            <Route path="/vendas/pedidos" element={<PedidosPage />} />
            <Route path="/vendas/marketplace" element={<MarketplacePage />} />
            <Route path="/vendas/notas-saida" element={<NotasSaidaPage />} />
            {/* Relatorios */}
            <Route path="/relatorios" element={<RelatoriosPage />} />
            <Route path="/auditoria" element={<AuditoriaPage />} />
            {/* Usuarios */}
            <Route path="/usuarios" element={<UsuariosPage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
