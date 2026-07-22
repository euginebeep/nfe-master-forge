// Formatters for Brazilian documents and data

export function formatCNPJ(cnpj: string): string {
  const cleaned = cnpj.replace(/\D/g, "");
  if (cleaned.length !== 14) return cnpj;
  return cleaned.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    "$1.$2.$3/$4-$5"
  );
}

export function formatCPF(cpf: string): string {
  const cleaned = cpf.replace(/\D/g, "");
  if (cleaned.length !== 11) return cpf;
  return cleaned.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
}

export function formatDocument(doc: string): string {
  const cleaned = doc.replace(/\D/g, "");
  if (cleaned.length === 14) return formatCNPJ(doc);
  if (cleaned.length === 11) return formatCPF(doc);
  return doc;
}

export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 11) {
    return cleaned.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
  }
  if (cleaned.length === 10) {
    return cleaned.replace(/^(\d{2})(\d{4})(\d{4})$/, "($1) $2-$3");
  }
  return phone;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatNumber(value: number, decimals = 2): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "-";
  if (typeof date === "string") {
    const m = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
    return new Date(date).toLocaleDateString("pt-BR");
  }
  return date.toLocaleDateString("pt-BR");
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("pt-BR");
}

export function cleanDocument(doc: string): string {
  return doc.replace(/\D/g, "");
}

export function normalizeString(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Quantidade de lote com casas decimais adequadas à unidade.
 * Massa/volume: 2 casas. Contáveis (un, mil, cx): inteiro quando for inteiro.
 */
export function formatQtdLote(qtd: number, unidade?: string | null): string {
  const u = (unidade || "").toLowerCase().trim();
  const massaVolume = ["g", "kg", "mg", "mcg", "µg", "ug", "l", "ml", "lt", "litro", "litros"].includes(u);
  if (massaVolume) return formatNumber(qtd, 2);
  const n = Number(qtd);
  if (Number.isFinite(n) && Number.isInteger(n)) return formatNumber(n, 0);
  return formatNumber(n, 2);
}

/**
 * Dias até a data de validade. Datas `date` do Postgres chegam como
 * "YYYY-MM-DD"; `new Date()` as interpreta como meia-noite UTC, o que em
 * UTC−3 devolve o dia anterior. Aqui montamos a data em horário local.
 * Retorna null quando a data é ausente ou inválida.
 */
export function diasAteValidade(dataVal?: string | Date | null): number | null {
  if (!dataVal) return null;
  let alvo: Date;
  if (dataVal instanceof Date) {
    alvo = new Date(dataVal);
  } else {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dataVal).trim());
    alvo = m
      ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
      : new Date(dataVal);
  }
  if (isNaN(alvo.getTime())) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  alvo.setHours(0, 0, 0, 0);
  return Math.round((alvo.getTime() - hoje.getTime()) / 86400000);
}

/** Escalas por família de unidade, com o fator para a unidade base. */
const ESCALAS_UNIDADE: Record<string, Array<[string, number]>> = {
  mg: [["mg", 1], ["g", 1000], ["kg", 1000000]],
  g:  [["mg", 0.001], ["g", 1], ["kg", 1000]],
  kg: [["g", 0.001], ["kg", 1]],
  ml: [["ml", 1], ["l", 1000]],
  l:  [["ml", 0.001], ["l", 1]],
};

/**
 * Escolhe a unidade mais legível para exibir uma quantidade, SEM alterar o
 * dado armazenado. 25000 g -> 25 kg | 0,5 kg -> 500 g | 500 g -> 500 g.
 * Unidades fora de escala (un, MIL, cx...) são devolvidas intactas,
 * preservando a grafia original.
 */
export function normalizarQtdExibicao(
  qtd: number,
  unidade?: string | null
): { valor: number; unidade: string } {
  const original = (unidade ?? "").trim();
  const u = original.toLowerCase();
  const escala = ESCALAS_UNIDADE[u];
  if (!escala || !Number.isFinite(qtd)) {
    return { valor: qtd, unidade: original };
  }
  const fatorBase = escala.find(([nome]) => nome === u)?.[1] ?? 1;
  const emBase = qtd * fatorBase;

  let melhor: { valor: number; unidade: string } | null = null;
  for (const [nome, fator] of escala) {
    const v = emBase / fator;
    if (v >= 1) melhor = { valor: v, unidade: nome };
  }
  if (!melhor) {
    const [nome, fator] = escala[0];
    melhor = { valor: emBase / fator, unidade: nome };
  }
  return melhor;
}

/**
 * Quantidade de lote pronta para exibição: unidade legível + casas decimais
 * adequadas. Ex.: (25000, "g") -> "25 kg" | (1250, "g") -> "1,25 kg".
 */
export function formatQtdExibicao(qtd: number, unidade?: string | null): string {
  if (qtd == null || !Number.isFinite(Number(qtd))) return "—";
  const { valor, unidade: un } = normalizarQtdExibicao(Number(qtd), unidade);
  const texto = valor.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
  return un ? `${texto} ${un}` : texto;
}
