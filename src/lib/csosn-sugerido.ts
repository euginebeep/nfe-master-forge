/**
 * Resposta da RPC `csosn_sugerido` (LC 123/2006 art. 23).
 * CSOSN é derivado da operação + destinatário — não é digitado pelo usuário.
 */
export type RegraCsosn = {
  regime?: string;
  usa_csosn: boolean;
  csosn?: string | null;
  /** CST quando emitente em regime normal */
  cst_icms?: string | null;
  automatico?: boolean;
  motivo?: string | null;
  permite_101?: boolean;
  destinatario_contribuinte?: string | null;
  base_legal?: string | null;
  observacao_101?: string | null;
};

export function normalizarRegraCsosn(raw: unknown): RegraCsosn | null {
  const data = (Array.isArray(raw) ? raw[0] : raw) as RegraCsosn | null;
  if (!data || typeof data !== "object") return null;
  return {
    ...data,
    usa_csosn: !!data.usa_csosn,
    permite_101: !!data.permite_101,
  };
}

/** Código ICMS efetivo para exibição / itens (CSOSN ou CST). */
export function codigoIcmsEfetivo(
  regra: RegraCsosn | null | undefined,
  usar101: boolean,
): string {
  if (!regra) return "";
  if (regra.usa_csosn) {
    if (usar101 && regra.permite_101) return "101";
    return String(regra.csosn || "").trim();
  }
  return String(regra.cst_icms || "").trim();
}
