import { supabase } from "@/integrations/supabase/client";

/**
 * Wrapper resiliente para supabase.functions.invoke.
 * Sempre devolve { data, error } com mensagem amigável — nunca lança.
 *
 * Motivo: supabase.functions.invoke() sempre devolve
 * "Edge Function returned a non-2xx status code" em error.message.
 * O diagnóstico real está em error.context (Response).
 *
 * Nota: a API é { data, error } (não throw) — já usada por unlock-* e
 * permite tratamento de status (404 de CNPJ ≠ função não publicada).
 */
export async function invokeEdge<T = unknown>(
  name: string,
  body?: unknown,
  init?: { method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; headers?: Record<string, string> },
): Promise<{ data: T | null; error: string | null; status?: number }> {
  try {
    const { data, error } = await supabase.functions.invoke(name, {
      body: body as Record<string, unknown> | undefined,
      method: init?.method,
      headers: init?.headers,
    });

    if (error) {
      let serverMsg: string | null = null;
      const ctx = (error as { context?: Response }).context;
      const status = ctx instanceof Response ? ctx.status : (ctx as { status?: number } | undefined)?.status;

      if (ctx instanceof Response) {
        try {
          const j = await ctx.json();
          serverMsg = j?.error || j?.message || null;
        } catch {
          /* corpo não-JSON: mantém a mensagem original */
        }
      } else if (ctx && typeof (ctx as { json?: () => Promise<unknown> }).json === "function") {
        try {
          const j = await (ctx as { json: () => Promise<{ error?: string; message?: string }> }).json();
          serverMsg = j?.error || j?.message || null;
        } catch {
          /* ignore */
        }
      }

      if (status === 404) {
        return {
          data: null,
          error:
            serverMsg ||
            "Serviço indisponível (404). A função do servidor ainda não está publicada. Aguarde alguns instantes e tente novamente.",
          status,
        };
      }
      if (status === 401 || status === 403) {
        return { data: null, error: serverMsg || "Sessão expirada. Faça login novamente.", status };
      }
      if (status === 500) {
        return {
          data: null,
          error: serverMsg || "Erro interno no servidor. Tente novamente em alguns instantes.",
          status,
        };
      }
      return {
        data: null,
        error: serverMsg || error.message || "Falha na requisição",
        status,
      };
    }

    // Erro lógico devolvido no payload
    if (data && typeof data === "object" && "error" in (data as object) && (data as { error?: unknown }).error) {
      return { data: null, error: String((data as { error: unknown }).error) };
    }

    return { data: data as T, error: null };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro de rede";
    return { data: null, error: msg };
  }
}
