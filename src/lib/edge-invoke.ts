import { supabase } from "@/integrations/supabase/client";

/**
 * Extrai a mensagem de erro real de uma resposta de supabase.functions.invoke.
 * Quando o status é não-2xx, o corpo JSON fica em response.error.context (Response).
 * Retorna null quando não há erro.
 */
export async function extractInvokeError(
  response: { data: any; error: any },
  fallback = "Falha na requisição"
): Promise<string | null> {
  if (response.error) {
    try {
      const ctx: any = (response.error as any).context;
      if (ctx && typeof ctx.json === "function") {
        const body = await (typeof ctx.clone === "function" ? ctx.clone().json() : ctx.json());
        if (body?.error) return String(body.error?.message || body.error);
        if (body?.message) return String(body.message);
      } else if (ctx && typeof ctx.text === "function") {
        const txt = await (typeof ctx.clone === "function" ? ctx.clone().text() : ctx.text());
        if (txt) return txt;
      }
    } catch {
      /* ignora parse */
    }
    return response.error.message || fallback;
  }
  if (response.data?.error) {
    const err = response.data.error;
    return String(err?.message || err);
  }
  return null;
}

/**
 * Extrai mensagem de erro de um throw/catch envolvendo functions.invoke.
 * Útil quando o caller faz `if (error) throw error`.
 */
export async function extractThrownEdgeError(e: unknown, fallback = "Falha na requisição"): Promise<string> {
  const err = e as any;
  if (err?.context instanceof Response || (err?.context && typeof err.context.json === "function")) {
    try {
      const body = await (typeof err.context.clone === "function"
        ? err.context.clone().json()
        : err.context.json());
      if (body?.error) return String(body.error?.message || body.error);
      if (body?.message) return String(body.message);
    } catch {
      /* ignore */
    }
  }
  return err?.message || fallback;
}

/**
 * Wrapper resiliente para supabase.functions.invoke.
 * Sempre devolve { data, error } com mensagem amigável — nunca lança.
 * Trata 404 (função não publicada) e 500 (erro interno) com texto claro.
 */
export async function invokeEdge<T = any>(
  name: string,
  body?: Record<string, unknown>
): Promise<{ data: T | null; error: string | null }> {
  try {
    const response = await supabase.functions.invoke(name, { body });
    const detail = await extractInvokeError(response);
    if (detail) {
      const ctx: any = (response.error as any)?.context;
      const status = ctx?.status;
      if (status === 404) {
        return {
          data: null,
          error:
            "Serviço indisponível (404). A função do servidor ainda não está publicada. Aguarde alguns instantes e tente novamente.",
        };
      }
      if (status === 401 || status === 403) {
        return { data: null, error: detail.includes("Edge Function") ? "Sessão expirada. Faça login novamente." : detail };
      }
      if (status === 500 && detail.includes("Edge Function returned a non-2xx")) {
        return {
          data: null,
          error: "Erro interno no servidor. Tente novamente em alguns instantes.",
        };
      }
      return { data: null, error: detail };
    }

    return { data: response.data as T, error: null };
  } catch (e: any) {
    return { data: null, error: await extractThrownEdgeError(e, e?.message || "Erro de rede") };
  }
}
