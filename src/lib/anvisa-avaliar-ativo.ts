/**
 * Motor único de avaliação por ativo — RPC public.anvisa_avaliar_ativo.
 * Fonte de verdade dos pareceres do Checker. Não usar anvisa-limits.ts.
 */

import { supabase } from "@/integrations/supabase/client";
import { normalizarGrupoAnvisa } from "@/lib/anvisa-consultar";

/** Seis status do parecer por ativo (anvisa_laudo_pareceres). */
export type StatusParecerAtivo =
  | "APROVADO"
  | "APROVAVEL_COM_CORRECAO"
  | "PENDENTE_VERIFICACAO"
  | "NAO_AUTORIZADO"
  | "AVALIAR_FITOTERAPICO"
  | "REPROVADO_ALEGACAO";

/**
 * Quem age — doutrina 01-principios.
 * Só `rt_do_tenant_confirma_vinculo` é da RT, e só sobre o pó do galpão dela.
 * Nunca pedir à RT que decida limite, órfão do painel ou norma não revisada.
 */
export type ResponsavelAvaliacao =
  | "regra_da_anvisa_nao_negociavel"
  | "plataforma"
  | "rt_do_tenant_confirma_vinculo"
  | "formulador_ajusta_dose";

/** Marcação obrigatória de afirmação regulatória. */
export type MarcacaoRegulatoria = "VERIFICADO" | "INFERIDO" | "NAO_VERIFICADO";

export type AnvisaAvaliarAtivoResult = {
  status: StatusParecerAtivo | string;
  motivo?: string | null;
  constituinte_id?: string | null;
  limite_min_oficial?: number | null;
  limite_max_oficial?: number | null;
  limite_texto?: string | null;
  unidade_comparavel?: boolean | null;
  norma_referencia?: string | null;
  advertencias?: unknown;
  alegacoes?: unknown;
  /** Texto oficial de rotulagem complementar (IN) — preferir sobre advertencias quando vier. */
  rotulagem_complementar?: unknown;
  substituicao_sugerida?: string | null;
  proposta_funcional?: string | null;
  responsavel?: ResponsavelAvaliacao | string | null;
  marcacao?: MarcacaoRegulatoria;
  /** Erro de transporte / RPC — não confundir com NAO_AUTORIZADO. */
  erro?: string | null;
};

/** Normaliza jsonb/texto do motor → linhas literais para UI/PDF. Nunca inventar. */
export function textosDoCampoNormativo(v: unknown): string[] {
  if (v == null) return [];
  if (typeof v === "string") {
    const t = v.trim();
    return t ? [t] : [];
  }
  if (typeof v === "number" || typeof v === "boolean") {
    return [String(v)];
  }
  if (Array.isArray(v)) {
    return v.flatMap((x) => textosDoCampoNormativo(x));
  }
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    for (const key of ["texto", "alegacao", "advertencia", "rotulagem", "descricao", "value"]) {
      if (o[key] != null) return textosDoCampoNormativo(o[key]);
    }
    return Object.values(o).flatMap((x) => textosDoCampoNormativo(x));
  }
  return [];
}

export function rotuloResponsavel(responsavel: string | null | undefined): string {
  switch (String(responsavel || "")) {
    case "regra_da_anvisa_nao_negociavel":
      return "Regra da ANVISA — não negociável";
    case "plataforma":
      return "Pendência da plataforma (não é decisão da RT)";
    case "rt_do_tenant_confirma_vinculo":
      return "RT confirma vínculo do insumo";
    case "formulador_ajusta_dose":
      return "Formulador ajusta dose";
    default:
      return responsavel ? String(responsavel) : "—";
  }
}

/** Vocabulário do Checker (AUDIENCES) → grupo canônico do banco. */
export function grupoDoPublicoChecker(publico: string | null | undefined): string {
  const p = String(publico || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();

  const map: Record<string, string> = {
    ADULTOS: "19_mais",
    GESTANTES: "gestantes",
    LACTANTES: "lactantes",
    CRIANCAS_4_8: "4_8_anos",
    CRIANCAS_9_18: "9_18_anos",
    IDOSOS: "19_mais",
  };
  if (map[p]) return map[p];

  const norm = normalizarGrupoAnvisa(publico);
  return norm || "19_mais";
}

/**
 * Heurística mínima: botânico sem identidade declarada não pode nascer APROVADO.
 * Colunas especie_declarada / parte_vegetal / tipo_extrato / padronizacao
 * existem em anvisa_laudo_pareceres — quem preenche é o frontend.
 */
export function pareceBotanico(nome: string): boolean {
  const n = String(nome || "").toLowerCase();
  if (!n) return false;
  if (
    /\b(extrato|extract|folhas?|folha|radix|herba|pó de|po de|ksm-?66|bacopa|ashwagandha|withania|ginkgo|curcuma|curcumin|panax|ginseng|rhodiola|valeriana|passiflora|camellia|green tea|chá verde|cha verde)\b/i.test(
      n,
    )
  ) {
    return true;
  }
  // binomial latino simples: Genus species
  return /\b[A-Z][a-z]{2,}\s+[a-z]{3,}\b/.test(nome);
}

export function aplicarPortaoBotanico(
  resultado: AnvisaAvaliarAtivoResult,
  nome: string,
  identidade?: {
    especie_declarada?: string | null;
    parte_vegetal?: string | null;
    tipo_extrato?: string | null;
    padronizacao?: string | null;
  },
): AnvisaAvaliarAtivoResult {
  if (!pareceBotanico(nome)) return resultado;
  const temIdentidade = Boolean(
    identidade?.especie_declarada?.trim()
    || identidade?.parte_vegetal?.trim()
    || identidade?.tipo_extrato?.trim()
    || identidade?.padronizacao?.trim(),
  );
  if (temIdentidade) return resultado;
  if (resultado.status !== "APROVADO" && resultado.status !== "APROVAVEL_COM_CORRECAO") {
    return resultado;
  }
  return {
    ...resultado,
    status: "PENDENTE_VERIFICACAO",
    // Identidade do pó = aplicação por tenant — única fatia da RT.
    responsavel: "rt_do_tenant_confirma_vinculo",
    marcacao: "INFERIDO",
    motivo: [
      resultado.motivo,
      "Identidade botânica incompleta: informe espécie, parte vegetal, tipo de extrato e/ou padronização. Sem isso o status máximo é PENDENTE_VERIFICACAO.",
    ]
      .filter(Boolean)
      .join(" "),
  };
}

export async function rpcAnvisaAvaliarAtivo(params: {
  nome: string;
  dose: number;
  unidade: string;
  grupo?: string | null;
}): Promise<AnvisaAvaliarAtivoResult> {
  const nome = (params.nome || "").trim();
  if (!nome) {
    return {
      status: "PENDENTE_VERIFICACAO",
      motivo: "Nome do ativo vazio.",
      unidade_comparavel: false,
      responsavel: "rt_do_tenant_confirma_vinculo",
      marcacao: "NAO_VERIFICADO",
    };
  }

  const grupo = grupoDoPublicoChecker(params.grupo);
  const dose = Number(params.dose);
  const unidade = (params.unidade || "mg").trim() || "mg";

  // Nunca filtrar por homologado — regra da ANVISA não depende de assinatura da RT.
  const { data, error } = await (supabase as any).rpc("anvisa_avaliar_ativo", {
    p_nome: nome,
    p_dose: Number.isFinite(dose) ? dose : 0,
    p_unidade: unidade,
    p_grupo: grupo,
  });

  if (error) {
    return {
      status: "PENDENTE_VERIFICACAO",
      motivo: `Falha ao avaliar no motor SQL: ${error.message}. Pendência da plataforma — não é decisão da RT.`,
      unidade_comparavel: false,
      responsavel: "plataforma",
      marcacao: "NAO_VERIFICADO",
      erro: error.message,
    };
  }

  const raw = (data ?? {}) as Record<string, unknown>;
  const status = String(raw.status || "PENDENTE_VERIFICACAO");
  const responsavel =
    (raw.responsavel as string | null)
    || (raw.responsavel_acao as string | null)
    || null;

  return {
    status,
    motivo: (raw.motivo as string | null) ?? null,
    constituinte_id: (raw.constituinte_id as string | null) ?? null,
    limite_min_oficial:
      raw.limite_min_oficial == null ? null : Number(raw.limite_min_oficial),
    limite_max_oficial:
      raw.limite_max_oficial == null ? null : Number(raw.limite_max_oficial),
    limite_texto: (raw.limite_texto as string | null) ?? null,
    unidade_comparavel:
      raw.unidade_comparavel == null ? null : Boolean(raw.unidade_comparavel),
    norma_referencia: (raw.norma_referencia as string | null) ?? null,
    advertencias: raw.advertencias ?? raw.advertencia ?? null,
    alegacoes: raw.alegacoes ?? raw.alegacao ?? null,
    rotulagem_complementar:
      raw.rotulagem_complementar ?? raw.rotulagem ?? null,
    substituicao_sugerida: (raw.substituicao_sugerida as string | null) ?? null,
    proposta_funcional: (raw.proposta_funcional as string | null) ?? null,
    responsavel,
    marcacao: "VERIFICADO",
  };
}

/** Agrega pareceres por ativo → status_geral do documento (vocabulário do Checker). */
export function statusGeralDosPareceres(
  pareceres: Array<{ status?: string | null }>,
): string {
  const statuses = pareceres.map((p) => String(p.status || "").toUpperCase());
  if (statuses.length === 0) return "VERIFICAR";
  if (
    statuses.some((s) =>
      ["NAO_AUTORIZADO", "REPROVADO_ALEGACAO", "AVALIAR_FITOTERAPICO"].includes(s),
    )
  ) {
    return "BLOQUEADO";
  }
  if (statuses.some((s) => s === "PENDENTE_VERIFICACAO")) return "VERIFICAR";
  if (statuses.some((s) => s === "APROVAVEL_COM_CORRECAO")) {
    return "APROVADO COM RESSALVAS";
  }
  if (statuses.every((s) => s === "APROVADO")) return "APROVADO";
  return "VERIFICAR";
}

export function estiloStatusParecer(status: string | undefined): {
  className: string;
  label: string;
} {
  const s = String(status || "PENDENTE_VERIFICACAO").toUpperCase();
  switch (s) {
    case "APROVADO":
      return { className: "bg-green-500/20 text-green-600 border-green-500/30", label: s };
    case "APROVAVEL_COM_CORRECAO":
      return { className: "bg-amber-500/20 text-amber-700 border-amber-500/30", label: s };
    case "PENDENTE_VERIFICACAO":
      return { className: "bg-slate-500/15 text-slate-700 border-slate-400/40", label: s };
    case "NAO_AUTORIZADO":
      return { className: "bg-red-500/20 text-red-600 border-red-500/30", label: s };
    case "AVALIAR_FITOTERAPICO":
      return { className: "bg-purple-500/15 text-purple-700 border-purple-500/30", label: s };
    case "REPROVADO_ALEGACAO":
      return { className: "bg-red-500/20 text-red-700 border-red-500/30", label: s };
    default:
      return { className: "bg-orange-500/20 text-orange-600 border-orange-500/30", label: s };
  }
}
