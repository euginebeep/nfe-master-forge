import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/client";

async function callFocusNfe(
  action: string,
  params?: Record<string, string>,
  body?: unknown
) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Não autenticado");

  const searchParams = new URLSearchParams({ action, ...params });
  const url = `${SUPABASE_URL}/functions/v1/focus-nfe?${searchParams}`;

  const options: RequestInit = {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
      apikey: SUPABASE_PUBLISHABLE_KEY,
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(url, options);

  // Tratar respostas binárias (PDF / XML)
  const contentType = res.headers.get("Content-Type") || "";
  if (
    contentType.includes("application/pdf") ||
    contentType.includes("application/xml") ||
    contentType.includes("text/xml")
  ) {
    if (!res.ok) throw new Error("Erro ao baixar arquivo");
    return res.blob();
  }

  const data = await res.json();
  if (!res.ok) {
    // Preservar detalhes da rejeição Focus (schema/campo) — sem isso só aparece "Rejeicao na emissao."
    const base = data?.error?.message || data?.error || `Erro ${res.status}`;
    const detalhes = data?.detalhes;
    const extra =
      typeof detalhes === "string"
        ? detalhes
        : detalhes && typeof detalhes === "object"
          ? (detalhes.mensagem || detalhes.codigo || "")
          : "";
    throw new Error(extra ? `${base} — ${extra}` : String(base));
  }
  // HTTP 200 com erro lógico + detalhes (dry_run / rejeição)
  if (data && typeof data === "object" && data.error) {
    const base = data.error?.message || data.error;
    const detalhes = data.detalhes;
    const extra =
      typeof detalhes === "string"
        ? detalhes
        : detalhes && typeof detalhes === "object"
          ? (detalhes.mensagem || detalhes.codigo || "")
          : "";
    throw new Error(extra ? `${base} — ${extra}` : String(base));
  }
  return data;
}

export function useFocusNfe() {
  const cadastrarEmpresa = (payload: unknown) =>
    callFocusNfe("cadastrar-empresa", undefined, payload);

  const consultarEmpresa = (cpfCnpj: string) =>
    callFocusNfe("consultar-empresa", { cpf_cnpj: cpfCnpj });

  const emitirNFe = (payload: unknown) =>
    callFocusNfe("emitir-nfe", undefined, payload);

  const emitirNota = (notaSaidaId: string, dryRun: boolean) =>
    callFocusNfe("emitir-nota", undefined, { nota_saida_id: notaSaidaId, dry_run: dryRun });

  const consultarNFe = (id: string, ambiente?: string) =>
    callFocusNfe("consultar-nfe", { id, ambiente: ambiente || "homologacao" });

  const baixarDanfe = async (id: string, ambiente?: string) => {
    const blob = await callFocusNfe("danfe", { id, ambiente: ambiente || "homologacao" });
    const urlObj = URL.createObjectURL(blob as Blob);
    const a = document.createElement("a");
    a.href = urlObj;
    a.download = `danfe-${id}.pdf`;
    a.click();
    URL.revokeObjectURL(urlObj);
  };

  const baixarXml = async (id: string, ambiente?: string) => {
    const blob = await callFocusNfe("xml", { id, ambiente: ambiente || "homologacao" });
    const urlObj = URL.createObjectURL(blob as Blob);
    const a = document.createElement("a");
    a.href = urlObj;
    a.download = `nfe-${id}.xml`;
    a.click();
    URL.revokeObjectURL(urlObj);
  };

  const cancelarNFe = (id: string, justificativa: string, ambiente?: string) =>
    callFocusNfe("cancelar-nfe", { id, ambiente: ambiente || "homologacao" }, { justificativa });

  const cartaCorrecao = (id: string, correcao: string, ambiente?: string) =>
    callFocusNfe("carta-correcao", { id, ambiente: ambiente || "homologacao" }, { correcao });

  const statusSefaz = (cpfCnpj: string, ambiente?: string) =>
    callFocusNfe("status-sefaz", { cpf_cnpj: cpfCnpj, ambiente: ambiente || "homologacao" });

  const inutilizarNFe = (payload: {
    cnpj?: string;
    serie: string | number;
    numero_inicial: string | number;
    numero_final: string | number;
    justificativa: string;
    ambiente?: string;
  }) => callFocusNfe("inutilizar-nfe", undefined, payload);

  const consultarStatus = (id: string, ambiente?: string) =>
    callFocusNfe("consultar-status", { id, ambiente: ambiente || "homologacao" });

  /** Reenvia e-mail da NF-e autorizada (Focus v10+). Body: { emails: string[] } */
  const reenviarEmail = (id: string, emails: string[], ambiente?: string) =>
    callFocusNfe(
      "reenviar-email",
      { id, ambiente: ambiente || "homologacao" },
      { emails },
    );

  /** Previsão de número/série (Focus v11+). Não reserva — pode pular em contingência. */
  const proximoNumero = () => callFocusNfe("proximo-numero", undefined, {});

  return {
    cadastrarEmpresa,
    consultarEmpresa,
    emitirNota,
    emitirNFe,
    consultarNFe,
    baixarDanfe,
    baixarXml,
    cancelarNFe,
    cartaCorrecao,
    cartaCorrecaoNFe: cartaCorrecao,
    statusSefaz,
    inutilizarNFe,
    consultarStatus,
    reenviarEmail,
    proximoNumero,
  };
}

// Alias para compatibilidade com código legado que importava useNuvemFiscal
export { useFocusNfe as useNuvemFiscal };
