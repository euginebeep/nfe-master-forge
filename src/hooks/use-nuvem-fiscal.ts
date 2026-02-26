import { supabase } from "@/integrations/supabase/client";

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;

async function callNuvemFiscal(action: string, params?: Record<string, string>, body?: unknown) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Não autenticado");

  const searchParams = new URLSearchParams({ action, ...params });
  const url = `https://${PROJECT_ID}.supabase.co/functions/v1/nuvem-fiscal?${searchParams}`;

  const options: RequestInit = {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(url, options);
  
  // Handle PDF/XML binary responses
  const contentType = res.headers.get("Content-Type") || "";
  if (contentType.includes("application/pdf") || contentType.includes("application/xml")) {
    if (!res.ok) throw new Error("Erro ao baixar arquivo");
    return res.blob();
  }

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || data.error || `Erro ${res.status}`);
  }
  return data;
}

export function useNuvemFiscal() {
  const cadastrarEmpresa = (payload: unknown) =>
    callNuvemFiscal("cadastrar-empresa", undefined, payload);

  const consultarEmpresa = (cpfCnpj: string) =>
    callNuvemFiscal("consultar-empresa", { cpf_cnpj: cpfCnpj });

  const emitirNFe = (payload: unknown) =>
    callNuvemFiscal("emitir-nfe", undefined, payload);

  const consultarNFe = (id: string) =>
    callNuvemFiscal("consultar-nfe", { id });

  const baixarDanfe = async (id: string) => {
    const blob = await callNuvemFiscal("danfe", { id });
    const url = URL.createObjectURL(blob as Blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `danfe-${id}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const baixarXml = async (id: string) => {
    const blob = await callNuvemFiscal("xml", { id });
    const url = URL.createObjectURL(blob as Blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nfe-${id}.xml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const cancelarNFe = (id: string, justificativa: string) =>
    callNuvemFiscal("cancelar-nfe", { id }, { justificativa });

  const cartaCorrecao = (id: string, correcao: string) =>
    callNuvemFiscal("carta-correcao", { id }, { correcao });

  const statusSefaz = (cpfCnpj: string, ambiente?: string) =>
    callNuvemFiscal("status-sefaz", { cpf_cnpj: cpfCnpj, ambiente: ambiente || "homologacao" });

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
