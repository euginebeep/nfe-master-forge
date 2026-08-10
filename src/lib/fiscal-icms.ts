/**
 * CST (regime normal) × CSOSN (Simples Nacional / MEI).
 * Lista única — Emissor, FiscalReview e wizard de item consomem daqui.
 *
 * No emissor de NF-e, o CSOSN é derivado por `csosn_sugerido` (LC 123/2006
 * art. 23) — não perguntar ao usuário nem ao contador.
 */

export type CodigoFiscalOpcao = { value: string; label: string };

/** CST ICMS — CRT 2 (excesso sublimite) e CRT 3 (regime normal). */
export const CST_ICMS_OPTIONS: CodigoFiscalOpcao[] = [
  { value: "00", label: "00 – Tributada integralmente" },
  { value: "10", label: "10 – Tributada com ST" },
  { value: "20", label: "20 – Com redução de BC" },
  { value: "30", label: "30 – Isenta/não tributada com ST" },
  { value: "40", label: "40 – Isenta" },
  { value: "41", label: "41 – Não tributada" },
  { value: "50", label: "50 – Suspensão" },
  { value: "51", label: "51 – Diferimento" },
  { value: "60", label: "60 – ICMS cobrado anteriormente por ST" },
  { value: "70", label: "70 – Com redução de BC e ST" },
  { value: "90", label: "90 – Outros" },
];

/**
 * CSOSN — CRT 1 (Simples Nacional) e CRT 4 (MEI).
 * Emitir CST 00 sendo Simples = rejeição SEFAZ.
 */
export const CSOSN_ICMS_OPTIONS: CodigoFiscalOpcao[] = [
  { value: "101", label: "101 – Tributada com permissão de crédito" },
  { value: "102", label: "102 – Tributada sem permissão de crédito" },
  { value: "103", label: "103 – Isenção do ICMS p/ faixa de receita bruta" },
  { value: "201", label: "201 – Tributada com crédito e com ST" },
  { value: "202", label: "202 – Tributada sem crédito e com ST" },
  { value: "300", label: "300 – Imune" },
  { value: "400", label: "400 – Não tributada" },
  { value: "500", label: "500 – ICMS cobrado ant. por ST ou antecipação" },
  { value: "900", label: "900 – Outros" },
];

export const CST_PIS_COFINS_OPTIONS: CodigoFiscalOpcao[] = [
  { value: "01", label: "01 – Operação tributável (alíquota normal)" },
  { value: "02", label: "02 – Operação tributável (alíquota diferenciada)" },
  { value: "04", label: "04 – Operação tributável (ST)" },
  { value: "06", label: "06 – Operação tributável (alíquota zero)" },
  { value: "07", label: "07 – Operação isenta" },
  { value: "08", label: "08 – Operação sem incidência" },
  { value: "09", label: "09 – Operação com suspensão" },
  { value: "49", label: "49 – Outras operações de saída" },
  { value: "99", label: "99 – Outras operações" },
];

export const CST_IPI_OPTIONS: CodigoFiscalOpcao[] = [
  { value: "00", label: "00 – Entrada com recuperação de crédito" },
  { value: "49", label: "49 – Outras entradas" },
  { value: "50", label: "50 – Saída tributada" },
  { value: "51", label: "51 – Saída tributável alíquota zero" },
  { value: "52", label: "52 – Saída isenta" },
  { value: "53", label: "53 – Saída não tributada" },
  { value: "54", label: "54 – Saída imune" },
  { value: "55", label: "55 – Saída com suspensão" },
  { value: "99", label: "99 – Outras saídas" },
];

/** CRT 1 Simples e CRT 4 MEI usam CSOSN; CRT 2/3 usam CST. */
export function empresaUsaCsosn(crt: string | number | null | undefined): boolean {
  const n = String(crt ?? "").trim();
  return n === "1" || n === "4";
}

export function opcoesIcmsPorCrt(crt: string | number | null | undefined): CodigoFiscalOpcao[] {
  return empresaUsaCsosn(crt) ? CSOSN_ICMS_OPTIONS : CST_ICMS_OPTIONS;
}

export function rotuloIcmsPorCrt(crt: string | number | null | undefined): string {
  return empresaUsaCsosn(crt) ? "CSOSN" : "CST ICMS";
}

/** Código atual é CST clássico (2 dígitos) — inválido para emitente Simples/MEI. */
export function codigoIcmsIncompativelComCrt(
  crt: string | number | null | undefined,
  codigo: string | null | undefined,
): boolean {
  if (!empresaUsaCsosn(crt)) return false;
  const c = String(codigo ?? "").trim();
  if (!c) return false;
  return CST_ICMS_OPTIONS.some((o) => o.value === c);
}
