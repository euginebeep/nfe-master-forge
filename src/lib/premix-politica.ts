/**
 * Política de pré-mix por constituinte (micro-doses da base ANVISA).
 *
 * Fonte da verdade: unidade/limite do constituinte (não lista manual).
 * Sistema SUGERE; a RT confirma/ajusta em premix_politica_constituinte.
 */

export type Solubilidade = "LIPO" | "HIDRO" | "INDEFINIDA";

export type ProporcaoSugerida = "1:10" | "1:100" | "1:1000" | "1:10000";

export interface PremixPoliticaInput {
  nome: string;
  categoria?: string | null;
  limite_unidade?: string | null;
  limite_max_num?: number | null;
  /** Massa de ativo puro por dose (mg), preferencialmente da potência do lote/COA. */
  massaAtivoPuroPorDoseMg?: number | null;
}

export interface PremixPoliticaResultado {
  exige_premix: boolean;
  motivo: string;
  solubilidade: Solubilidade;
  proporcao_sugerida: ProporcaoSugerida | null;
  fator_diluicao_sugerido: number | null;
  veiculo_sugerido: string | null;
  precisa_antioxidante: boolean;
  precisa_protecao_luz: boolean;
  observacoes: string[];
}

/** Limiar: massa por dose do pré-mix já pesável na balança analítica. */
export const LIMIAR_PESAVEL_MG = 10;

const FATORES_DILUICAO = [10, 100, 1000, 10000] as const;

function normalizarTexto(s: string | null | undefined): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function normalizarUnidade(u: string | null | undefined): string {
  const n = normalizarTexto(u)
    .replace("μg", "mcg")
    .replace("µg", "mcg")
    .replace("ug", "mcg");
  return n;
}

/**
 * Lipossolúveis: A, D, E, K e carotenoides.
 * Hidrossolúveis: complexo B, C, minerais típicos de micro-dose, melatonina.
 * Ambíguos / não reconhecidos → INDEFINIDA (RT decide).
 */
export function classificarSolubilidade(
  nome: string,
  categoria?: string | null,
): Solubilidade {
  const n = normalizarTexto(nome);
  const c = normalizarTexto(categoria);

  const lipoPadroes = [
    /\bvitamina\s*d\b/,
    /\bd[23]\b/,
    /\bcolecalciferol\b/,
    /\bergocalciferol\b/,
    /\bcalcidiol\b/,
    /\bcalcitriol\b/,
    /\bvitamina\s*a\b/,
    /\bretinol\b/,
    /\bretinil/,
    /\bpalmitato\s*de\s*retinila\b/,
    /\bacetato\s*de\s*retinila\b/,
    /\bbetacaroteno\b/,
    /\bcaroteno/,
    /\bvitamina\s*e\b/,
    /\btocoferol/,
    /\bvitamina\s*k\b/,
    /\bk1\b/,
    /\bmk-?7\b/,
    /\bfitomenadiona\b/,
    /\bfiloquinona\b/,
    /\bmenaquinona\b/,
  ];
  if (lipoPadroes.some((re) => re.test(n)) || /\blitossol/.test(c)) {
    return "LIPO";
  }

  const hidroPadroes = [
    /\bvitamina\s*b\s*12\b/,
    /\bb12\b/,
    /\bcobalamina/,
    /\bciancobalamina\b/,
    /\bcianocobalamina\b/,
    /\bmetilcobalamina\b/,
    /\badenosilcobalamina\b/,
    /\bhidroxocobalamina\b/,
    /\bbiotina\b/,
    /\bvitamina\s*b\s*7\b/,
    /\bacido\s*folico\b/,
    /\bfolato\b/,
    /\bmetilfolato\b/,
    /\bvitamina\s*b\s*9\b/,
    /\btiamina\b/,
    /\bvitamina\s*b\s*1\b/,
    /\briboflavina\b/,
    /\bvitamina\s*b\s*2\b/,
    /\bniacina\b/,
    /\bvitamina\s*b\s*3\b/,
    /\bpiridoxina\b/,
    /\bvitamina\s*b\s*6\b/,
    /\bvitamina\s*c\b/,
    /\bacido\s*ascorbico\b/,
    /\bcromo\b/,
    /\bselenio\b/,
    /\biodo\b/,
    /\bmolibdenio\b/,
    /\bmanganes\b/,
    /\bmelatonina\b/,
    /\bzinc\b/,
    /\bzinco\b/,
  ];
  if (hidroPadroes.some((re) => re.test(n)) || /\bhidrossol/.test(c)) {
    return "HIDRO";
  }

  return "INDEFINIDA";
}

/**
 * Menor diluição (1:10 … 1:10000) que já deixe massaAtivo*fator ≥ limiar pesável.
 */
export function sugerirProporcao(
  massaAtivoPuroPorDoseMg: number,
): { proporcao: ProporcaoSugerida; fator: number } {
  const massa = Number.isFinite(massaAtivoPuroPorDoseMg)
    ? Math.max(0, massaAtivoPuroPorDoseMg)
    : 0;

  for (const fator of FATORES_DILUICAO) {
    if (massa * fator >= LIMIAR_PESAVEL_MG) {
      return { proporcao: `1:${fator}` as ProporcaoSugerida, fator };
    }
  }
  return { proporcao: "1:10000", fator: 10000 };
}

/** Candidato a pré-mix a partir da base (mcg sempre; mg < 5). */
export function ehCandidatoPreMix(
  limite_unidade?: string | null,
  limite_max_num?: number | null,
): boolean {
  const u = normalizarUnidade(limite_unidade);
  if (u === "mcg") return true;
  if (u === "mg" && limite_max_num != null && Number(limite_max_num) < 5) return true;
  return false;
}

/** Converte limite numérico da base em massa proxy (mg) quando não há COA. */
export function massaProxyDoLimite(
  limite_unidade?: string | null,
  limite_max_num?: number | null,
): number | null {
  if (limite_max_num == null || !Number.isFinite(Number(limite_max_num))) return null;
  const max = Number(limite_max_num);
  const u = normalizarUnidade(limite_unidade);
  if (u === "mcg") return max / 1000;
  if (u === "mg") return max;
  if (u === "g") return max * 1000;
  return null;
}

function veiculoPara(solubilidade: Solubilidade): string | null {
  if (solubilidade === "LIPO") {
    return "MCC + antioxidante (ex.: tocoferol/BHT) — proteger da luz";
  }
  if (solubilidade === "HIDRO") {
    return "MCC (veículo seco simples)";
  }
  return "A definir pela RT (solubilidade indefinida)";
}

export function politicaPreMix(input: PremixPoliticaInput): PremixPoliticaResultado {
  const observacoes: string[] = [];
  const solubilidade = classificarSolubilidade(input.nome, input.categoria);
  const candidato = ehCandidatoPreMix(input.limite_unidade, input.limite_max_num);

  let massa = input.massaAtivoPuroPorDoseMg ?? null;
  let usouProxy = false;
  if (massa == null || !(massa > 0)) {
    massa = massaProxyDoLimite(input.limite_unidade, input.limite_max_num);
    if (massa != null) {
      usouProxy = true;
      observacoes.push(
        "Proporção baseada no limite máximo da base ANVISA (proxy). Recalcular com a potência do lote (COA) na produção.",
      );
    }
  }

  if (!candidato) {
    return {
      exige_premix: false,
      motivo: "Dose/limite não caracteriza micro-dose (mcg ou mg < 5).",
      solubilidade,
      proporcao_sugerida: null,
      fator_diluicao_sugerido: null,
      veiculo_sugerido: null,
      precisa_antioxidante: false,
      precisa_protecao_luz: false,
      observacoes,
    };
  }

  if (massa == null || !(massa > 0)) {
    observacoes.push(
      "Candidato a pré-mix, mas sem massa por dose nem limite numérico — RT deve definir a proporção.",
    );
    return {
      exige_premix: true,
      motivo: "Micro-dose candidata (unidade/limite da base), sem massa para calcular diluição.",
      solubilidade,
      proporcao_sugerida: null,
      fator_diluicao_sugerido: null,
      veiculo_sugerido: veiculoPara(solubilidade),
      precisa_antioxidante: solubilidade === "LIPO",
      precisa_protecao_luz: solubilidade === "LIPO",
      observacoes,
    };
  }

  const { proporcao, fator } = sugerirProporcao(massa);
  const precisaLipoprotecao = solubilidade === "LIPO";
  if (precisaLipoprotecao) {
    observacoes.push(
      "Lipossolúvel: considerar sobrecarga de ~10%, antioxidante e proteção da luz.",
    );
  }
  if (!usouProxy) {
    observacoes.push("Proporção calculada com a massa de ativo puro por dose informada.");
  }

  const u = normalizarUnidade(input.limite_unidade);
  const motivo =
    u === "mcg"
      ? `Micro-dose (limite em mcg${input.limite_max_num != null ? `: ${input.limite_max_num}` : ""}).`
      : `Micro-dose (limite em mg < 5${input.limite_max_num != null ? `: ${input.limite_max_num}` : ""}).`;

  return {
    exige_premix: true,
    motivo,
    solubilidade,
    proporcao_sugerida: proporcao,
    fator_diluicao_sugerido: fator,
    veiculo_sugerido: veiculoPara(solubilidade),
    precisa_antioxidante: precisaLipoprotecao,
    precisa_protecao_luz: precisaLipoprotecao,
    observacoes,
  };
}

/** Mescla sugestão automática com decisão persistida da RT (se houver). */
export function resolverPoliticaEfetiva(
  sugestao: PremixPoliticaResultado,
  override: {
    exige_premix: boolean;
    solubilidade?: string | null;
    fator_diluicao?: number | null;
    veiculo?: string | null;
    precisa_antioxidante?: boolean | null;
  } | null,
): PremixPoliticaResultado & { origem: "rt" | "sugestao" } {
  if (!override) return { ...sugestao, origem: "sugestao" };

  const fator = override.fator_diluicao != null ? Number(override.fator_diluicao) : null;
  const proporcao =
    fator && FATORES_DILUICAO.includes(fator as (typeof FATORES_DILUICAO)[number])
      ? (`1:${fator}` as ProporcaoSugerida)
      : fator
        ? (`1:${fator}` as ProporcaoSugerida)
        : sugestao.proporcao_sugerida;

  const sol = (override.solubilidade as Solubilidade) || sugestao.solubilidade;

  return {
    exige_premix: override.exige_premix,
    motivo: "Decisão da RT (sobrescreve a sugestão automática).",
    solubilidade: sol,
    proporcao_sugerida: proporcao,
    fator_diluicao_sugerido: fator ?? sugestao.fator_diluicao_sugerido,
    veiculo_sugerido: override.veiculo ?? sugestao.veiculo_sugerido,
    precisa_antioxidante:
      override.precisa_antioxidante ?? (sol === "LIPO"),
    precisa_protecao_luz: sol === "LIPO",
    observacoes: [
      ...sugestao.observacoes,
      "Há registro em premix_politica_constituinte para este constituinte.",
    ],
    origem: "rt",
  };
}
