import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { MainLayout } from "./components/layout/MainLayout";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import EmpresaSettingsPage from "./pages/settings/EmpresaSettingsPage";
import FornecedoresListPage from "./pages/cadastros/FornecedoresListPage";
import ClientesListPage from "./pages/cadastros/ClientesListPage";
import TransportadorasListPage from "./pages/cadastros/TransportadorasListPage";
import EntidadeDetailPage from "./pages/cadastros/EntidadeDetailPage";
import ProdutosListPage from "./pages/cadastros/ProdutosListPage";
import ProdutoDetailPage from "./pages/cadastros/ProdutoDetailPage";

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
            <Route path="/settings/empresa" element={<EmpresaSettingsPage />} />
            <Route path="/cadastros/fornecedores" element={<FornecedoresListPage />} />
            <Route path="/cadastros/clientes" element={<ClientesListPage />} />
            <Route path="/cadastros/transportadoras" element={<TransportadorasListPage />} />
            <Route path="/cadastros/entidades/:id" element={<EntidadeDetailPage />} />
            <Route path="/cadastros/produtos" element={<ProdutosListPage />} />
            <Route path="/cadastros/produtos/:id" element={<ProdutoDetailPage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
