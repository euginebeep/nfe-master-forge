import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/client";
export { urlArquivoFocus } from "@/lib/focus-nfe-url";

export type FocusAmbiente = "producao" | "homologacao";

export class FocusNfeHttpError extends Error {
  status: number;
  data: Record<string, unknown>;
  constructor(message: string, status: number, data: Record<string, unknown> = {}) {
    super(message);
    this.name = "FocusNfeHttpError";
    this.status = status;
    this.data = data;
  }
}

/**
 * Ambiente Focus a partir do banco (nfe_ambiente / nota.ambiente = MAIÚSCULO).
 * Nunca defaultar para homologação: em tenant de produção isso pede o arquivo
 * no host errado e a Focus responde vazio — falha silenciosa.
 */
export function requireFocusAmbiente(
  ambiente: string | null | undefined,
): FocusAmbiente {
  const raw = String(ambiente ?? "").trim();
  if (!raw) {
    throw new Error(
      "Ambiente da NF-e não informado. Informe nota.ambiente (PRODUCAO ou HOMOLOGACAO).",
    );
  }
  const n = raw.toLowerCase();
  if (n === "producao") return "producao";
  if (n === "homologacao") return "homologacao";
  throw new Error(
    `Ambiente da NF-e inválido: "${ambiente}". Use PRODUCAO ou HOMOLOGACAO.`,
  );
}

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

  // Decidir por ação, não por Content-Type: a edge ?action=xml devolve
  // Content-Type que não entra na lista e cai em res.json() → Unexpected token '<'
  const ACOES_ARQUIVO = new Set(["xml", "danfe", "pdf-carta-correcao", "xml-cancelamento"]);
  if (ACOES_ARQUIVO.has(action)) {
    // arrayBuffer preserva binário. res.text() destrói PDF: decodifica os
    // bytes como UTF-8 e cada byte inválido vira U+FFFD. O arquivo sai com
    // tamanho plausível e conteúdo corrompido — abre em branco, sem erro.
    const buf = await res.arrayBuffer();

    // erro da API vem em JSON: '{' = 0x7B. PDF começa com '%PDF' = 0x25504446
    const head = new Uint8Array(buf.slice(0, 1));
    if (head[0] === 0x7B) {
      const j = JSON.parse(new TextDecoder().decode(buf));
      throw new FocusNfeHttpError(
        String(j?.error?.message || j?.error || "Erro ao baixar arquivo"),
        res.status,
        typeof j === "object" && j ? j : {},
      );
    }

    const isPdf = action === "danfe" || action === "pdf-carta-correcao";
    return new Blob([buf], {
      type: isPdf ? "application/pdf" : "application/xml",
    });
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const base = data?.error?.message || data?.error || `Erro ${res.status}`;
    const detalhes = data?.detalhes;
    const extra =
      typeof detalhes === "string"
        ? detalhes
        : detalhes && typeof detalhes === "object"
          ? (detalhes.mensagem || detalhes.codigo || "")
          : "";
    throw new FocusNfeHttpError(
      extra ? `${base} — ${extra}` : String(base),
      res.status,
      typeof data === "object" && data ? data : {},
    );
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

function triggerDownload(blob: Blob, filename: string) {
  const urlObj = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = urlObj;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(urlObj);
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

  const consultarNFe = (id: string, ambiente: string) =>
    callFocusNfe("consultar-nfe", { id, ambiente: requireFocusAmbiente(ambiente) });

  const baixarDanfe = async (id: string, ambiente: string) => {
    const blob = await callFocusNfe("danfe", {
      id,
      ambiente: requireFocusAmbiente(ambiente),
    });
    triggerDownload(blob as Blob, `danfe-${id}.pdf`);
  };

  const baixarXml = async (id: string, ambiente: string) => {
    const blob = await callFocusNfe("xml", {
      id,
      ambiente: requireFocusAmbiente(ambiente),
    });
    triggerDownload(blob as Blob, `nfe-${id}.xml`);
  };

  const baixarPdfCartaCorrecao = async (
    id: string,
    ambiente: string,
    sequencia?: number | null,
  ) => {
    const params: Record<string, string> = {
      id,
      ambiente: requireFocusAmbiente(ambiente),
    };
    if (sequencia != null && Number(sequencia) > 0) {
      params.sequencia = String(sequencia);
    }
    const blob = await callFocusNfe("pdf-carta-correcao", params);
    const sufixo = sequencia != null ? `-cce-${sequencia}` : "-cce";
    triggerDownload(blob as Blob, `cce-${id}${sufixo}.pdf`);
  };

  const baixarXmlCancelamento = async (id: string, ambiente: string) => {
    const blob = await callFocusNfe("xml-cancelamento", {
      id,
      ambiente: requireFocusAmbiente(ambiente),
    });
    triggerDownload(blob as Blob, `cancelamento-${id}.xml`);
  };

  const cancelarNFe = (
    id: string,
    justificativa: string,
    ambiente: string,
    opts?: { confirma_extemporaneo?: boolean },
  ) =>
    callFocusNfe(
      "cancelar-nfe",
      { id, ambiente: requireFocusAmbiente(ambiente) },
      {
        justificativa,
        ...(opts?.confirma_extemporaneo ? { confirma_extemporaneo: true } : {}),
      },
    );

  const cartaCorrecao = (id: string, correcao: string, ambiente: string) =>
    callFocusNfe(
      "carta-correcao",
      { id, ambiente: requireFocusAmbiente(ambiente) },
      { correcao },
    );

  const statusSefaz = (cpfCnpj: string, ambiente: string) =>
    callFocusNfe("status-sefaz", {
      cpf_cnpj: cpfCnpj,
      ambiente: requireFocusAmbiente(ambiente),
    });

  const inutilizarNFe = (payload: {
    cnpj?: string;
    serie: string | number;
    numero_inicial: string | number;
    numero_final: string | number;
    justificativa: string;
    ambiente: string;
  }) =>
    callFocusNfe("inutilizar-nfe", undefined, {
      ...payload,
      ambiente: requireFocusAmbiente(payload.ambiente),
    });

  const consultarStatus = (id: string, ambiente: string) =>
    callFocusNfe("consultar-status", {
      id,
      ambiente: requireFocusAmbiente(ambiente),
    });

  /** Reenvia e-mail da NF-e autorizada (Focus v10+). Body: { emails: string[] } */
  const reenviarEmail = (id: string, emails: string[], ambiente: string) =>
    callFocusNfe(
      "reenviar-email",
      { id, ambiente: requireFocusAmbiente(ambiente) },
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
    baixarPdfCartaCorrecao,
    baixarXmlCancelamento,
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
