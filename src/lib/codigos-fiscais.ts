import { supabase } from "@/integrations/supabase/client";
import {
  CST_ICMS_OPTIONS,
  CSOSN_ICMS_OPTIONS,
  CST_IPI_OPTIONS,
  CST_PIS_COFINS_OPTIONS,
  empresaUsaCsosn,
} from "@/lib/fiscal-icms";

export type CodigoFiscalOption = { value: string; label: string };
export type TipoCodigoFiscal =
  | "CSOSN"
  | "CST_ICMS"
  | "ORIGEM"
  | "CST_IPI"
  | "CST_PIS_COFINS";

type CodigoFiscalRow = {
  codigo?: string | number | null;
  descricao?: string | null;
  rotulo?: string | null;
};

/** Origem da mercadoria — fallback quando a RPC não devolver ORIGEM. */
const ORIGEM_FALLBACK: CodigoFiscalOption[] = [
  { value: "0", label: "0 - Nacional" },
  { value: "1", label: "1 - Estrangeira (importação direta)" },
  { value: "2", label: "2 - Estrangeira (mercado interno)" },
  { value: "3", label: "3 - Nacional com conteúdo de importação > 40%" },
  { value: "4", label: "4 - Nacional produzida conforme processos básicos" },
  { value: "5", label: "5 - Nacional com conteúdo de importação ≤ 40%" },
  { value: "6", label: "6 - Estrangeira importação direta sem similar nacional" },
  { value: "7", label: "7 - Estrangeira mercado interno sem similar nacional" },
  { value: "8", label: "8 - Nacional com conteúdo de importação > 70%" },
];

function mapRowsToOptions(rows: CodigoFiscalRow[] | null | undefined): CodigoFiscalOption[] {
  return (rows || [])
    .map((r) => {
      const value = String(r?.codigo ?? "").trim();
      const descricao = String(r?.descricao ?? "").trim();
      const rotulo = String(r?.rotulo ?? "").trim();
      if (!value) return null;
      if (rotulo) return { value, label: rotulo };
      return { value, label: descricao ? `${value} - ${descricao}` : value };
    })
    .filter((v): v is CodigoFiscalOption => !!v);
}

function fallbackPorTipo(tipo: TipoCodigoFiscal): CodigoFiscalOption[] {
  switch (tipo) {
    case "CSOSN":
      return CSOSN_ICMS_OPTIONS;
    case "CST_ICMS":
      return CST_ICMS_OPTIONS;
    case "CST_IPI":
      return CST_IPI_OPTIONS;
    case "CST_PIS_COFINS":
      return CST_PIS_COFINS_OPTIONS;
    case "ORIGEM":
      return ORIGEM_FALLBACK;
  }
}

export async function carregarCodigosFiscaisDaEmpresa(
  companyId: string,
  crt: string | number | null | undefined,
) {
  const tipoIcms: TipoCodigoFiscal = empresaUsaCsosn(crt) ? "CSOSN" : "CST_ICMS";
  const tipos: TipoCodigoFiscal[] = [tipoIcms, "ORIGEM", "CST_IPI", "CST_PIS_COFINS"];

  const result: Partial<Record<TipoCodigoFiscal, CodigoFiscalOption[]>> = {};

  await Promise.all(
    tipos.map(async (tipo) => {
      try {
        const { data, error } = await supabase.rpc("codigos_fiscais_da_empresa", {
          p_company_id: companyId,
          p_tipo: tipo,
        });
        if (error) throw error;
        const mapped = mapRowsToOptions(data as CodigoFiscalRow[]);
        result[tipo] = mapped.length > 0 ? mapped : fallbackPorTipo(tipo);
      } catch {
        result[tipo] = fallbackPorTipo(tipo);
      }
    }),
  );

  return {
    tipoIcms,
    icms: result[tipoIcms] || fallbackPorTipo(tipoIcms),
    origem: result.ORIGEM || ORIGEM_FALLBACK,
    ipi: result.CST_IPI || CST_IPI_OPTIONS,
    pisCofins: result.CST_PIS_COFINS || CST_PIS_COFINS_OPTIONS,
  };
}
