import { supabase } from "@/integrations/supabase/client";

type InvokeResult<T> = {
  data: T | null;
  error: string | null;
  /** Corpo parseado preservado (detalhes fiscais, valid:false do certificado, etc.) */
  payload?: unknown;
  status?: number;
};

function mensagemDeErro(corpo: unknown, fallback: string): string {
  if (!corpo || typeof corpo !== "object") return fallback;
  const obj = corpo as {
    error?: unknown;
    message?: unknown;
    detalhes?: { mensagem?: unknown; codigo?: unknown } | string;
  };
  const base = String(obj.error || obj.message || fallback);
  const detalhes = obj.detalhes;
  if (!detalhes) return base;
  if (typeof detalhes === "string" && detalhes.trim()) return `${base} — ${detalhes}`;
  if (typeof detalhes === "object") {
    const extra = String(detalhes.mensagem || detalhes.codigo || "").trim();
    if (extra) return `${base} — ${extra}`;
  }
  return base;
}

/**
 * Wrapper resiliente para supabase.functions.invoke.
 * Sempre devolve { data, error } com mensagem amigável — nunca lança.
 *
 * Motivo: supabase.functions.invoke() sempre devolve
 * "Edge Function returned a non-2xx status code" em error.message.
 * O diagnóstico real está em error.context (Response).
 *
 * `payload` opcional preserva o corpo (ex.: detalhes de rejeição Focus,
 * valid:false do certificado) sem quebrar chamadas existentes.
 */
export async function invokeEdge<T = unknown>(
  name: string,
  body?: unknown,
  init?: { method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; headers?: Record<string, string> },
): Promise<InvokeResult<T>> {
  try {
    const { data, error } = await supabase.functions.invoke(name, {
      body: body as Record<string, unknown> | undefined,
      method: init?.method,
      headers: init?.headers,
    });

    if (error) {
      let corpoParseado: unknown = undefined;
      const ctx = (error as { context?: Response }).context;
      const status = ctx instanceof Response ? ctx.status : (ctx as { status?: number } | undefined)?.status;

      if (ctx instanceof Response) {
        try {
          corpoParseado = await ctx.json();
        } catch {
          /* corpo não-JSON */
        }
      } else if (ctx && typeof (ctx as { json?: () => Promise<unknown> }).json === "function") {
        try {
          corpoParseado = await (ctx as { json: () => Promise<unknown> }).json();
        } catch {
          /* ignore */
        }
      }

      const serverMsg = mensagemDeErro(corpoParseado, "");

      if (status === 404) {
        return {
          data: null,
          error:
            serverMsg ||
            "Serviço indisponível (404). A função do servidor ainda não está publicada. Aguarde alguns instantes e tente novamente.",
          payload: corpoParseado,
          status,
        };
      }
      if (status === 401 || status === 403) {
        return {
          data: null,
          error: serverMsg || "Sessão expirada. Faça login novamente.",
          payload: corpoParseado,
          status,
        };
      }
      if (status === 500) {
        return {
          data: null,
          error: serverMsg || "Erro interno no servidor. Tente novamente em alguns instantes.",
          payload: corpoParseado,
          status,
        };
      }
      return {
        data: null,
        error: serverMsg || error.message || "Falha na requisição",
        payload: corpoParseado,
        status,
      };
    }

    // Resposta estruturada com valid:false (ex.: certificado) — não descartar o objeto
    if (
      data &&
      typeof data === "object" &&
      "valid" in (data as object) &&
      (data as { valid?: unknown }).valid === false
    ) {
      return { data: data as T, error: null, payload: data };
    }

    // Erro lógico no payload — preservar o objeto inteiro (detalhes fiscais etc.)
    if (data && typeof data === "object" && "error" in (data as object) && (data as { error?: unknown }).error) {
      return {
        data: null,
        error: mensagemDeErro(data, String((data as { error: unknown }).error)),
        payload: data,
      };
    }

    return { data: data as T, error: null, payload: data ?? undefined };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro de rede";
    return { data: null, error: msg };
  }
}
