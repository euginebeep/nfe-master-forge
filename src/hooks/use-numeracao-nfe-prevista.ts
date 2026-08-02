import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useFocusNfe } from "@/hooks/use-focus-nfe";

export type NumeracaoPrevista = {
  ambiente?: string;
  serie?: string | number;
  proximo_numero?: number;
  observacao?: string;
  atualizado_em?: string;
  desatualizado?: boolean;
};

const QUERY_KEY = ["nfe-numeracao-prevista"] as const;

function asNumeracao(raw: unknown): NumeracaoPrevista | null {
  if (!raw || typeof raw !== "object") return null;
  const row = Array.isArray(raw) ? raw[0] : raw;
  if (!row || typeof row !== "object") return null;
  return row as NumeracaoPrevista;
}

/**
 * Previsão de numeração NF-e.
 * Lê o cache via RPC; se desatualizado (>1h) ou ausente, consulta a Focus
 * via action proximo-numero e o cache é renovado no servidor.
 */
export function useNumeracaoNfePrevista(enabled = true) {
  const { proximoNumero } = useFocusNfe();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: QUERY_KEY,
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<NumeracaoPrevista | null> => {
      const { data, error } = await supabase.rpc("proxima_numeracao_prevista");
      if (!error) {
        const cached = asNumeracao(data);
        if (cached && !cached.desatualizado && cached.proximo_numero != null) {
          return cached;
        }
      }

      try {
        const fresh = await proximoNumero();
        const mapped = asNumeracao(fresh);
        if (mapped) return mapped;
      } catch {
        /* Focus indisponível — devolve cache mesmo desatualizado */
      }

      return asNumeracao(data) || null;
    },
  });

  const refresh = async () => {
    try {
      await proximoNumero();
    } catch {
      /* ignore */
    }
    await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
  };

  return { ...query, refresh };
}

export function fmtNumeroNfe(n: number | string | null | undefined): string {
  const digits = String(n ?? "").replace(/\D/g, "");
  if (!digits) return "—";
  const padded = digits.padStart(9, "0").slice(-9);
  return padded.replace(/(\d{3})(\d{3})(\d{3})/, "$1.$2.$3");
}
