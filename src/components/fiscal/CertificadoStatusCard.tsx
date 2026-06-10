import { useEffect, useState } from "react";
import { ShieldCheck, AlertTriangle, XCircle, Loader2, RefreshCw, Hash } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useNfeNumeracao } from "@/hooks/use-nfe-numeracao";

type Status = "ok" | "warn" | "error" | "loading";

interface Check {
  label: string;
  status: Status;
  detail?: string;
}

interface CompanyInfo {
  id: string;
  razao_social: string | null;
  nome_fantasia: string | null;
  cnpj: string | null;
  nfe_ambiente: string | null;
  nfe_serie_padrao: number | null;
  logo_file_id: string | null;
}

function StatusIcon({ status }: { status: Status }) {
  if (status === "loading") return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  if (status === "ok") return <ShieldCheck className="h-4 w-4 text-emerald-600" />;
  if (status === "warn") return <AlertTriangle className="h-4 w-4 text-amber-600" />;
  return <XCircle className="h-4 w-4 text-destructive" />;
}

export function CertificadoStatusCard() {
  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState<CompanyInfo | null>(null);
  const [checks, setChecks] = useState<Check[]>([]);
  const [hasCert, setHasCert] = useState(false);
  const { data: numeracao, refetch: refetchNum } = useNfeNumeracao();

  const run = async () => {
    setLoading(true);
    const result: Check[] = [];

    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) {
      setChecks([{ label: "Sessão", status: "error", detail: "Sem sessão ativa." }]);
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.company_id) {
      setChecks([{ label: "Empresa", status: "error", detail: "Usuário sem empresa vinculada." }]);
      setLoading(false);
      return;
    }

    const { data: comp } = await supabase
      .from("company")
      .select("id, razao_social, nome_fantasia, cnpj, nfe_ambiente, nfe_serie_padrao, logo_file_id")
      .eq("id", profile.company_id)
      .maybeSingle();
    setCompany(comp as CompanyInfo);

    // 1. Empresa cadastrada
    if (!comp) {
      result.push({ label: "Empresa cadastrada", status: "error", detail: "Empresa não encontrada." });
      setChecks(result);
      setLoading(false);
      return;
    }
    if (!comp.cnpj) {
      result.push({ label: "Empresa cadastrada", status: "error", detail: "CNPJ não preenchido." });
    } else {
      result.push({
        label: "Empresa cadastrada",
        status: "ok",
        detail: `${comp.razao_social || comp.nome_fantasia} · CNPJ ${comp.cnpj}`,
      });
    }

    // 2. Certificado A1 presente — chama validate-certificate (verify_jwt=false na função existente)
    let certPresent = false;
    try {
      const { data: certRes, error: certErr } = await supabase.functions.invoke("validate-certificate", {
        body: { company_id: comp.id, only_status: true },
      });
      if (certErr) throw certErr;
      certPresent = !!certRes?.has_certificate;
      setHasCert(certPresent);
      if (!certPresent) {
        result.push({
          label: "Certificado A1",
          status: "error",
          detail: "Nenhum certificado A1 (.pfx) foi enviado para esta empresa.",
        });
      } else {
        result.push({
          label: "Certificado A1 presente",
          status: "ok",
          detail: certRes?.filename ? `Arquivo: ${certRes.filename}` : "Certificado armazenado com segurança.",
        });

        // 3. CNPJ do certificado vs CNPJ da empresa
        if (certRes?.cnpj && comp.cnpj) {
          const a = String(certRes.cnpj).replace(/\D/g, "");
          const b = String(comp.cnpj).replace(/\D/g, "");
          if (a && b && a === b) {
            result.push({ label: "CNPJ do certificado bate com a empresa", status: "ok", detail: a });
          } else {
            result.push({
              label: "CNPJ do certificado",
              status: "error",
              detail: `Certificado: ${a || "?"} · Empresa: ${b || "?"} — não pode emitir.`,
            });
          }
        }

        // 4. Validade
        if (certRes?.valid_to) {
          const expires = new Date(certRes.valid_to);
          const daysLeft = Math.floor((expires.getTime() - Date.now()) / 86400000);
          let st: Status = "ok";
          if (daysLeft < 0) st = "error";
          else if (daysLeft < 30) st = "error";
          else if (daysLeft < 60) st = "warn";
          result.push({
            label: "Validade do certificado",
            status: st,
            detail:
              daysLeft < 0
                ? `Expirado há ${Math.abs(daysLeft)} dia(s) — renove antes de emitir.`
                : `Expira em ${expires.toLocaleDateString("pt-BR")} (${daysLeft} dias restantes).`,
          });
        }
      }
    } catch (e) {
      result.push({
        label: "Certificado A1",
        status: "warn",
        detail: `Não foi possível validar o certificado: ${(e as Error).message}`,
      });
    }

    // 5. Ambiente
    const amb = (comp.nfe_ambiente || "homologacao").toLowerCase();
    if (amb === "producao") {
      result.push({
        label: "Ambiente fiscal",
        status: certPresent ? "ok" : "error",
        detail: certPresent
          ? "PRODUÇÃO — notas emitidas têm valor fiscal real."
          : "PRODUÇÃO sem certificado válido. Emissão será rejeitada.",
      });
    } else {
      result.push({
        label: "Ambiente fiscal",
        status: "warn",
        detail: "HOMOLOGAÇÃO — notas são de teste e não têm valor fiscal.",
      });
    }

    setChecks(result);
    setLoading(false);
    refetchNum();
  };

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const blockEmission =
    checks.some((c) => c.status === "error" && c.label.toLowerCase().includes("certificado")) ||
    checks.some((c) => c.status === "error" && c.label.toLowerCase().includes("cnpj")) ||
    (company?.nfe_ambiente === "producao" && !hasCert);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-5 w-5" />
          Status do certificado A1 e numeração fiscal
        </CardTitle>
        <Button variant="outline" size="sm" onClick={run} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="ml-2">Revalidar</span>
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {blockEmission && (
          <Alert variant="destructive">
            <AlertTitle>Emissão bloqueada</AlertTitle>
            <AlertDescription>
              Resolva as pendências abaixo antes de transmitir uma NF-e/NFC-e.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          {checks.map((c, i) => (
            <div key={i} className="flex items-start gap-3 rounded-md border p-3">
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
        </div>

        <div>
          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <Hash className="h-4 w-4" />
            Próxima numeração reservada
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(numeracao || []).map((n) => (
              <div
                key={n.id}
                className="rounded-md border p-3 flex items-center justify-between"
              >
                <div>
                  <p className="text-sm font-medium">
                    {n.modelo === "55" ? "NF-e (mod. 55)" : "NFC-e (mod. 65)"} · Série {n.serie}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Último emitido: {n.ultimo_emitido ?? "—"}
                  </p>
                </div>
                <Badge variant="secondary" className="font-mono text-base">
                  #{n.proximo_numero}
                </Badge>
              </div>
            ))}
            {(!numeracao || numeracao.length === 0) && (
              <p className="text-sm text-muted-foreground col-span-full">
                Nenhuma série configurada ainda. A primeira emissão criará automaticamente.
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}