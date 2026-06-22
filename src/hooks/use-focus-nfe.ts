import { supabase } from "@/integrations/supabase/client";

const PROJECT_ID = "cqkvekdrifmvedvpjmjr";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxa3Zla2RyaWZtdmVkdnBqbWpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyODA0MzAsImV4cCI6MjA5NTg1NjQzMH0.6Y6c5-lzCcA5j8ujKMfvOqHBT19gZ4D8_PL1ZqVAYYI";

async function callFocusNfe(
  action: string,
  params?: Record<string, string>,
  body?: unknown
) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Não autenticado");

  const searchParams = new URLSearchParams({ action, ...params });
  const url = `https://${PROJECT_ID}.supabase.co/functions/v1/focus-nfe?${searchParams}`;

  const options: RequestInit = {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
      apikey: ANON_KEY,
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
    throw new Error(data.error?.message || data.error || `Erro ${res.status}`);
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

  return {
    cadastrarEmpresa,
    consultarEmpresa,
    emitirNFe,
    consultarNFe,
    baixarDanfe,
    baixarXml,
    cancelarNFe,
    cartaCorrecao,
    statusSefaz,
  };
}

// Alias para compatibilidade com código legado que importava useNuvemFiscal
export { useFocusNfe as useNuvemFiscal };
