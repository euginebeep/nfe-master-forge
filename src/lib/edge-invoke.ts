import { supabase } from "@/integrations/supabase/client";

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
    const { data, error } = await supabase.functions.invoke(name, { body });

    // Erro de transporte (FunctionsHttpError / FunctionsRelayError / FunctionsFetchError)
    if (error) {
      let serverMsg: string | null = null;
      // FunctionsHttpError expõe .context (Response). Tentar ler o body.
      const ctx: any = (error as any).context;
      if (ctx?.json) {
        try {
          const j = await ctx.json();
          serverMsg = j?.error || j?.message || null;
        } catch { /* ignore */ }
      }
      const status = ctx?.status;
      if (status === 404) {
        return {
          data: null,
          error:
            "Serviço indisponível (404). A função do servidor ainda não está publicada. Aguarde alguns instantes e tente novamente.",
        };
      }
      if (status === 401 || status === 403) {
        return { data: null, error: serverMsg || "Sessão expirada. Faça login novamente." };
      }
      if (status === 500) {
        return {
          data: null,
          error: serverMsg || "Erro interno no servidor. Tente novamente em alguns instantes.",
        };
      }
      return { data: null, error: serverMsg || error.message || "Falha na requisição" };
    }

    // Erro lógico devolvido no payload
    if (data && typeof data === "object" && "error" in (data as any) && (data as any).error) {
      return { data: null, error: String((data as any).error) };
    }

    return { data: data as T, error: null };
  } catch (e: any) {
    return { data: null, error: e?.message || "Erro de rede" };
  }
}