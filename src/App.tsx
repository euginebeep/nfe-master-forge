import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { MainLayout } from "./components/layout/MainLayout";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import CompanySettingsPage from "./pages/settings/CompanySettingsPage";
import EntidadesListPage from "./pages/cadastros/EntidadesListPage";
import ItensListPage from "./pages/cadastros/ItensListPage";
import LotesListPage from "./pages/estoque/LotesListPage";
import NFeImportPage from "./pages/compras/NFeImportPage";

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
            <Route path="/settings/company" element={<CompanySettingsPage />} />
            <Route path="/cadastros/entidades" element={<EntidadesListPage />} />
            <Route path="/cadastros/itens" element={<ItensListPage />} />
            <Route path="/estoque/lotes" element={<LotesListPage />} />
            <Route path="/compras/nfe-import" element={<NFeImportPage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
