import { useEffect, useState } from "react";
import { Stethoscope, CheckCircle2, AlertTriangle, XCircle, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

type CheckStatus = "ok" | "warn" | "error" | "loading";

interface DiagnosticCheck {
  label: string;
  status: CheckStatus;
  detail?: string;
}

interface Props {
  /** Tabela a ser diagnosticada (com RLS multi-tenant via company_id). */
  table: "entidades" | "itens";
  /** Rótulo amigável para a tela atual. Ex.: "Fornecedores". */
  contextLabel: string;
  /** Quantidade atualmente exibida na tela (para destacar tela vazia). */
  visibleCount: number;
  /** Variante do botão. Default outline. */
  variant?: "outline" | "ghost" | "default";
  size?: "sm" | "default";
}

const StatusIcon = ({ status }: { status: CheckStatus }) => {
  if (status === "loading") return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  if (status === "ok") return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
  if (status === "warn") return <AlertTriangle className="h-4 w-4 text-amber-600" />;
  return <XCircle className="h-4 w-4 text-destructive" />;
};

export function TenantAccessDiagnostic({
  table,
  contextLabel,
  visibleCount,
  variant = "outline",
  size = "sm",
}: Props) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [checks, setChecks] = useState<DiagnosticCheck[]>([]);
  const [summary, setSummary] = useState<{ kind: CheckStatus; message: string; action?: { label: string; onClick: () => void } } | null>(null);

  const runDiagnostic = async () => {
    setRunning(true);
    setChecks([
      { label: "Sessão autenticada", status: "loading" },
      { label: "Perfil carregado", status: "loading" },
      { label: "Tenant (company_id) atribuído", status: "loading" },
      { label: "Empresa cadastrada", status: "loading" },
      { label: `Acesso à tabela "${table}" (RLS + GRANT)`, status: "loading" },
      { label: `Registros visíveis em ${contextLabel}`, status: "loading" },
    ]);
    setSummary(null);

    const next: DiagnosticCheck[] = [];
    let stopSummary: typeof summary = null;

    // 1. Auth
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) {
      next.push({ label: "Sessão autenticada", status: "error", detail: "Nenhuma sessão ativa. Faça login novamente." });
      stopSummary = {
        kind: "error",
        message: "Sua sessão expirou ou não está mais válida.",
        action: { label: "Ir para login", onClick: () => navigate("/auth") },
      };
      next.push(
        { label: "Perfil carregado", status: "warn", detail: "Pulado — sem sessão." },
        { label: "Tenant (company_id) atribuído", status: "warn", detail: "Pulado — sem sessão." },
        { label: "Empresa cadastrada", status: "warn", detail: "Pulado — sem sessão." },
        { label: `Acesso à tabela "${table}" (RLS + GRANT)`, status: "warn", detail: "Pulado — sem sessão." },
        { label: `Registros visíveis em ${contextLabel}`, status: "warn", detail: "Pulado — sem sessão." },
      );
      setChecks(next);
      setSummary(stopSummary);
      setRunning(false);
      return;
    }
    next.push({ label: "Sessão autenticada", status: "ok", detail: `${user.email} (uid ${user.id.slice(0, 8)}…)` });

    // 2. Profile
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("id, nome_completo, company_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profileErr || !profile) {
      next.push({ label: "Perfil carregado", status: "error", detail: profileErr?.message || "Perfil não encontrado." });
      next.push({ label: "Tenant (company_id) atribuído", status: "warn", detail: "Pulado — sem perfil." });
      next.push({ label: "Empresa cadastrada", status: "warn", detail: "Pulado — sem perfil." });
      next.push({ label: `Acesso à tabela "${table}" (RLS + GRANT)`, status: "warn", detail: "Pulado — sem perfil." });
      next.push({ label: `Registros visíveis em ${contextLabel}`, status: "warn", detail: "Pulado — sem perfil." });
      setChecks(next);
      setSummary({ kind: "error", message: "Não foi possível carregar o seu perfil de usuário." });
      setRunning(false);
      return;
    }
    next.push({ label: "Perfil carregado", status: "ok", detail: profile.nome_completo || profile.id });

    // 3. Tenant
    if (!profile.company_id) {
      next.push({
        label: "Tenant (company_id) atribuído",
        status: "error",
        detail: "Seu usuário não está vinculado a nenhuma empresa. Toda consulta multi-tenant retorna vazio.",
      });
      next.push({ label: "Empresa cadastrada", status: "warn", detail: "Pulado — sem tenant." });
      next.push({ label: `Acesso à tabela "${table}" (RLS + GRANT)`, status: "warn", detail: "Pulado — sem tenant." });
      next.push({ label: `Registros visíveis em ${contextLabel}`, status: "warn", detail: "Pulado — sem tenant." });
      setChecks(next);
      setSummary({
        kind: "error",
        message:
          "Seu usuário não tem empresa associada. Cadastre/selecione a empresa em Configurações para liberar os dados.",
        action: { label: "Cadastrar empresa", onClick: () => navigate("/configuracoes/empresa") },
      });
      setRunning(false);
      return;
    }
    next.push({ label: "Tenant (company_id) atribuído", status: "ok", detail: profile.company_id });

    // 4. Company exists
    const { data: company } = await supabase
      .from("companies")
      .select("id, razao_social, nome_fantasia, cnpj")
      .eq("id", profile.company_id)
      .maybeSingle();
    if (!company) {
      next.push({
        label: "Empresa cadastrada",
        status: "error",
        detail: "O company_id do perfil não corresponde a nenhuma empresa existente.",
      });
      setChecks(next);
      setSummary({
        kind: "error",
        message: "Tenant inválido: a empresa referenciada não existe mais. Contate o administrador.",
      });
      setRunning(false);
      return;
    }
    next.push({
      label: "Empresa cadastrada",
      status: "ok",
      detail: `${company.razao_social || company.nome_fantasia || "—"}${company.cnpj ? ` · ${company.cnpj}` : ""}`,
    });

    // 5. Permissions (RLS + GRANT) — count without tenant filter (RLS aplica automaticamente)
    const { count, error: countErr } = await supabase
      .from(table)
      .select("id", { count: "exact", head: true });

    if (countErr) {
      const msg = countErr.message || "";
      const isPerm = /permission denied|not authorized|RLS|policy/i.test(msg);
      next.push({
        label: `Acesso à tabela "${table}" (RLS + GRANT)`,
        status: "error",
        detail: msg,
      });
      next.push({ label: `Registros visíveis em ${contextLabel}`, status: "warn", detail: "Pulado — sem permissão." });
      setChecks(next);
      setSummary({
        kind: "error",
        message: isPerm
          ? `Permissão negada (GRANT/RLS) na tabela "${table}". Peça ao administrador para aplicar GRANT SELECT à role authenticated.`
          : `Erro ao consultar "${table}": ${msg}`,
      });
      setRunning(false);
      return;
    }
    next.push({ label: `Acesso à tabela "${table}" (RLS + GRANT)`, status: "ok", detail: "RLS e GRANT respondendo normalmente." });

    // 6. Visible count
    const total = count ?? 0;
    if (total === 0) {
      next.push({
        label: `Registros visíveis em ${contextLabel}`,
        status: "warn",
        detail: "0 registros — permissões OK, mas o tenant ainda não possui dados nesta tabela.",
      });
      setChecks(next);
      setSummary({
        kind: "warn",
        message: `Tudo certo com seu acesso. A empresa "${company.razao_social || company.nome_fantasia}" simplesmente ainda não tem ${contextLabel.toLowerCase()} cadastrados. Use o botão "Novo" para começar.`,
      });
      setRunning(false);
      return;
    }

    next.push({
      label: `Registros visíveis em ${contextLabel}`,
      status: "ok",
      detail: `${total} registro(s) acessíveis para este tenant.`,
    });
    setChecks(next);

    if (visibleCount === 0 && total > 0) {
      setSummary({
        kind: "warn",
        message: `Existem ${total} registro(s) na base, mas a tela está exibindo 0. Verifique os filtros ativos (status, tipo, busca) — eles podem estar escondendo os resultados.`,
      });
    } else {
      setSummary({
        kind: "ok",
        message: `Acesso, tenant e permissões estão corretos. ${total} registro(s) disponíveis para este tenant.`,
      });
    }
    setRunning(false);
  };

  useEffect(() => {
    if (open && !running && checks.length === 0) {
      runDiagnostic();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => {
          setChecks([]);
          setSummary(null);
          setOpen(true);
        }}
      >
        <Stethoscope className="h-4 w-4 mr-2" />
        Diagnosticar acesso
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Stethoscope className="h-5 w-5" />
              Diagnóstico de acesso — {contextLabel}
            </DialogTitle>
            <DialogDescription>
              Verifica sessão, tenant (company_id), empresa, permissões (RLS + GRANT) e a contagem real
              de registros visíveis para o seu usuário.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {checks.map((c, idx) => (
              <div key={idx} className="flex items-start gap-3 rounded-md border p-3">
                <div className="pt-0.5">
                  <StatusIcon status={c.status} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{c.label}</p>
                  {c.detail && (
                    <p className="text-xs text-muted-foreground break-words mt-0.5">{c.detail}</p>
                  )}
                </div>
              </div>
            ))}

            {summary && (
              <Alert
                variant={summary.kind === "error" ? "destructive" : "default"}
                className={
                  summary.kind === "ok"
                    ? "border-emerald-500/40 bg-emerald-500/5"
                    : summary.kind === "warn"
                      ? "border-amber-500/40 bg-amber-500/5"
                      : undefined
                }
              >
                <AlertTitle>
                  {summary.kind === "ok"
                    ? "Tudo certo"
                    : summary.kind === "warn"
                      ? "Atenção"
                      : "Problema detectado"}
                </AlertTitle>
                <AlertDescription className="space-y-2">
                  <p>{summary.message}</p>
                  {summary.action && (
                    <Button size="sm" variant="outline" onClick={summary.action.onClick}>
                      {summary.action.label}
                    </Button>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Fechar
            </Button>
            <Button variant="outline" onClick={runDiagnostic} disabled={running}>
              {running ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Reexecutar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
