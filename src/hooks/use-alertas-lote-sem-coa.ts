import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface AlertaLoteSemCOA {
  id: string;
  lote_id: string;
  numero_lote: string;
  insumo_nome: string;
  usuario_nome: string;
  usuario_email?: string;
  justificativa: string;
  coa_presente: boolean;
  created_at: string;
  lido: boolean;
}

/**
 * Hook que escuta em tempo real a tabela lote_liberacoes_sem_coa via Supabase Realtime.
 * Exibe toast de alerta imediatamente quando um novo registro é inserido.
 * Mantém contagem de alertas não lidos para badge no menu.
 */
export function useAlertasLoteSemCOA() {
  const [alertas, setAlertas] = useState<AlertaLoteSemCOA[]>([]);
  const [naoLidos, setNaoLidos] = useState(0);
  const [carregando, setCarregando] = useState(true);

  // Carregar alertas recentes (últimos 30 dias)
  const carregarAlertas = useCallback(async () => {
    setCarregando(true);
    const desde = new Date();
    desde.setDate(desde.getDate() - 30);

    const { data, error } = await supabase
      .from("lote_liberacoes_sem_coa" as any)
      .select("*")
      .gte("created_at", desde.toISOString())
      .order("created_at", { ascending: false })
      .limit(50);

    if (!error && data) {
      // Verificar quais já foram marcados como lidos no localStorage
      const lidosKey = "alertas_lote_sem_coa_lidos";
      const lidos: string[] = JSON.parse(localStorage.getItem(lidosKey) || "[]");

      const alertasComLido = (data as any[]).map((a) => ({
        ...a,
        lido: lidos.includes(a.id),
      }));

      setAlertas(alertasComLido);
      setNaoLidos(alertasComLido.filter((a) => !a.lido).length);
    }
    setCarregando(false);
  }, []);

  // Marcar todos como lidos
  const marcarTodosLidos = useCallback(() => {
    const lidosKey = "alertas_lote_sem_coa_lidos";
    const ids = alertas.map((a) => a.id);
    localStorage.setItem(lidosKey, JSON.stringify(ids));
    setAlertas((prev) => prev.map((a) => ({ ...a, lido: true })));
    setNaoLidos(0);
  }, [alertas]);

  // Marcar um alerta como lido
  const marcarLido = useCallback((id: string) => {
    const lidosKey = "alertas_lote_sem_coa_lidos";
    const lidos: string[] = JSON.parse(localStorage.getItem(lidosKey) || "[]");
    if (!lidos.includes(id)) {
      lidos.push(id);
      localStorage.setItem(lidosKey, JSON.stringify(lidos));
    }
    setAlertas((prev) =>
      prev.map((a) => (a.id === id ? { ...a, lido: true } : a))
    );
    setNaoLidos((prev) => Math.max(0, prev - 1));
  }, []);

  useEffect(() => {
    carregarAlertas();

    // Inscrever no canal Realtime para novos inserts
    const channel = supabase
      .channel("alertas-lote-sem-coa")
      .on(
        "postgres_changes" as any,
        {
          event: "INSERT",
          schema: "public",
          table: "lote_liberacoes_sem_coa",
        },
        (payload: any) => {
          const novo = payload.new as AlertaLoteSemCOA;

          // Exibir toast de alerta imediato
          toast.warning(
            `⚠ Lote liberado sem COA: ${novo.numero_lote || "—"}`,
            {
              description: `${novo.insumo_nome || "Insumo"} • Por: ${novo.usuario_nome}`,
              duration: 8000,
              action: {
                label: "Ver lote",
                onClick: () => {
                  window.location.href = `/estoque/lotes/${novo.lote_id}`;
                },
              },
            }
          );

          // Adicionar ao estado com lido = false
          setAlertas((prev) => [{ ...novo, lido: false }, ...prev]);
          setNaoLidos((prev) => prev + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [carregarAlertas]);

  return {
    alertas,
    naoLidos,
    carregando,
    marcarLido,
    marcarTodosLidos,
    recarregar: carregarAlertas,
  };
}
