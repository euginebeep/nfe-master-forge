import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const fmtBRL = (v: number | null | undefined) =>
  `R$ ${Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const fmtDataHora = (value?: string | null) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return format(d, "dd/MM/yyyy HH:mm", { locale: ptBR });
};

/** Prazo regulamentar sem multa (24h a partir da autorização/emissão). */
export function prazoCancelamentoSemMulta(dataEmissao?: string | null): string | null {
  if (!dataEmissao) return null;
  const d = new Date(dataEmissao);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(d.getHours() + 24);
  return fmtDataHora(d.toISOString());
}
