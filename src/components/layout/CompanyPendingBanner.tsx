import { useLocation, useNavigate } from "react-router-dom";
import { Building2, ArrowRight, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCompany } from "@/hooks/use-company";
import { useAuth } from "@/hooks/use-auth";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Assistente global no topo do app que aparece sempre que o tenant ainda não
 * tem company cadastrada. Direciona o admin para Configurações → Empresa.
 * Permanece oculto na própria página de cadastro para não poluir a tela.
 */
export function CompanyPendingBanner() {
  const { data: company, isLoading } = useCompany();
  const { role } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const isAdmin = role === "admin";
  const onCompanyPage = pathname.startsWith("/settings/empresa");

  if (isLoading || company || !isAdmin || onCompanyPage) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        className="mb-4 rounded-lg border-2 border-destructive/40 bg-destructive/10 p-4 shadow-sm"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/20">
              <AlertTriangle className="h-5 w-5 text-destructive animate-pulse" />
            </div>
            <div className="space-y-0.5">
              <p className="text-sm font-bold text-destructive">
                Cadastro da empresa pendente
              </p>
              <p className="text-xs text-foreground/80">
                Conclua o cadastro em <strong>Configurações → Empresa</strong>
                {" "}(CNPJ, razão social, endereço e logo) para liberar criação de
                usuários, emissão de NF-e e os demais módulos do ERP.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => navigate("/settings/empresa")}
            className="shrink-0 gap-2 bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            <Building2 className="h-4 w-4" />
            Completar cadastro agora
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}