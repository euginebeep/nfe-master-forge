import { supabase } from "@/integrations/supabase/client";

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

export async function carregarCodigosFiscaisDaEmpresa(
  companyId: string,
  crt: string | null | undefined,
) {
  const tipoIcms: TipoCodigoFiscal = String(crt) === "1" ? "CSOSN" : "CST_ICMS";
  const tipos: TipoCodigoFiscal[] = [tipoIcms, "ORIGEM", "CST_IPI", "CST_PIS_COFINS"];

  const result: Partial<Record<TipoCodigoFiscal, CodigoFiscalOption[]>> = {};

  await Promise.all(
    tipos.map(async (tipo) => {
      const { data, error } = await (supabase as any).rpc("codigos_fiscais_da_empresa", {
        p_company_id: companyId,
        p_tipo: tipo,
      });
      if (error) throw error;
      result[tipo] = mapRowsToOptions(data as CodigoFiscalRow[]);
    }),
  );

  return {
    tipoIcms,
    icms: result[tipoIcms] || [],
    origem: result.ORIGEM || [],
    ipi: result.CST_IPI || [],
    pisCofins: result.CST_PIS_COFINS || [],
  };
}
