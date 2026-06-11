import { useLocation, useNavigate } from "react-router-dom";
import { Building2, ArrowRight, AlertTriangle, CheckCircle2, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCompany } from "@/hooks/use-company";
import { useAuth } from "@/hooks/use-auth";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Assistente global no topo do app: aparece quando a empresa não está cadastrada
 * OU quando há campos obrigatórios incompletos (CNPJ, regime, endereço, logo,
 * certificado A1 etc.). Mostra um checklist de progresso para o admin concluir
 * o cadastro mais rápido. Oculto na própria página de configuração.
 */
export function CompanyPendingBanner() {
  const { data: company, isLoading } = useCompany();
  const { role } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const isAdmin = role === "admin";
  const onCompanyPage = pathname.startsWith("/settings/empresa");

  if (isLoading || !isAdmin || onCompanyPage) return null;

  const c: any = company ?? {};
  const checklist = [
    { key: "razao_social", label: "Razão social", done: !!c.razao_social },
    { key: "cnpj", label: "CNPJ", done: !!c.cnpj },
    { key: "ie", label: "Inscrição estadual", done: !!c.ie },
    { key: "regime_tributario", label: "Regime tributário", done: !!c.regime_tributario },
    {
      key: "endereco",
      label: "Endereço completo",
      done: !!(c.endereco_logradouro && c.endereco_cidade && c.endereco_uf && c.endereco_cep),
    },
    { key: "telefone", label: "Telefone / e-mail fiscal", done: !!(c.telefone || c.email_fiscal) },
    { key: "logo", label: "Logo da empresa", done: !!c.logo_file_id },
    { key: "certificado", label: "Certificado digital A1", done: !!c.certificado_a1_file_id },
    { key: "nfe", label: "Ambiente NF-e configurado", done: !!c.nfe_ambiente },
  ];

  const completed = checklist.filter((i) => i.done).length;
  const total = checklist.length;
  const percent = Math.round((completed / total) * 100);

  // Tudo completo → não mostra banner
  if (company && completed === total) return null;

  const noCompany = !company;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        className={`mb-4 rounded-lg border-2 p-4 shadow-sm ${
          noCompany
            ? "border-destructive/40 bg-destructive/10"
            : "border-amber-500/40 bg-amber-500/10"
        }`}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                noCompany ? "bg-destructive/20" : "bg-amber-500/20"
              }`}
            >
              <AlertTriangle
                className={`h-5 w-5 ${
                  noCompany ? "text-destructive animate-pulse" : "text-amber-600"
                }`}
              />
            </div>
            <div className="space-y-2 flex-1">
              <div>
                <p
                  className={`text-sm font-bold ${
                    noCompany ? "text-destructive" : "text-amber-700 dark:text-amber-400"
                  }`}
                >
                  {noCompany
                    ? "Cadastro da empresa pendente"
                    : `Cadastro da empresa ${percent}% completo`}
                </p>
                <p className="text-xs text-foreground/80">
                  {noCompany
                    ? "Conclua o cadastro em Configurações → Empresa para liberar criação de usuários, emissão de NF-e e os demais módulos do ERP."
                    : `Faltam ${total - completed} item(ns) para concluir o cadastro e liberar todos os módulos.`}
                </p>
              </div>

              {/* Barra de progresso */}
              <div className="h-1.5 w-full rounded-full bg-foreground/10 overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    noCompany ? "bg-destructive" : "bg-amber-500"
                  }`}
                  style={{ width: `${percent}%` }}
                />
              </div>

              {/* Checklist */}
              <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1 pt-1">
                {checklist.map((item) => (
                  <li
                    key={item.key}
                    className={`flex items-center gap-1.5 text-xs ${
                      item.done
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-foreground/70"
                    }`}
                  >
                    {item.done ? (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <Circle className="h-3.5 w-3.5 shrink-0 text-foreground/40" />
                    )}
                    <span className={item.done ? "line-through opacity-80" : ""}>
                      {item.label}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => navigate("/settings/empresa")}
            className={`shrink-0 gap-2 ${
              noCompany
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : "bg-amber-500 text-white hover:bg-amber-600"
            }`}
          >
            <Building2 className="h-4 w-4" />
            {noCompany ? "Completar cadastro agora" : "Continuar cadastro"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}