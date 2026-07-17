/**
 * Unidades de insumo + conversão UI/mcg/mg via tabela conversoes_unidades.
 *
 * REGRA: nunca hardcodar fatores no front. Fatores vêm do banco (ativo=true).
 * Na dúvida (0 ou >1 match) → não converte; pede confirmação da RT.
 */

import { supabase } from "@/integrations/supabase/client";
import { canonicalizarUnidadeDose } from "@/lib/unidades-dose";

/**
 * Fonte ÚNICA de unidades de insumo/estoque.
 * Todas as telas devem importar daqui — não copiar listas locais.
 */
export const UNIDADES = [
  { value: "g", label: "Gramas (g)", grupo: "Massa" },
  { value: "mg", label: "Miligramas (mg)", grupo: "Massa" },
  { value: "mcg", label: "Microgramas (mcg)", grupo: "Massa" },
  { value: "UI", label: "Unidades Internacionais (UI)", grupo: "Atividade" },
  { value: "kg", label: "Quilogramas (kg)", grupo: "Massa" },
  { value: "un", label: "Unidades (un)", grupo: "Contagem" },
  { value: "ml", label: "Mililitros (ml)", grupo: "Volume" },
  { value: "l", label: "Litros (l)", grupo: "Volume" },
] as const;

export type UnidadeValue = (typeof UNIDADES)[number]["value"];

/** @deprecated use UNIDADES — mantido para imports que mapeiam só o value */
export const UNIDADES_INSUMO = UNIDADES.map((u) => u.value);
export type UnidadeInsumo = UnidadeValue;

/** Unidades de compra do fornecedor = canônicas + contáveis de embalagem */
export const UNIDADES_FORNECEDOR_EXTRA = [
  { value: "milheiro", label: "Milheiro (1000 un)", grupo: "Contagem" },
  { value: "caixa", label: "Caixa", grupo: "Contagem" },
  { value: "fardo", label: "Fardo", grupo: "Contagem" },
  { value: "pacote", label: "Pacote", grupo: "Contagem" },
] as const;

export const UNIDADES_FORNECEDOR = [
  ...UNIDADES,
  ...UNIDADES_FORNECEDOR_EXTRA,
] as const;

export interface ConversaoUnidadeRow {
  id: string;
  substancia: string;
  fator_ui_para_mg: number;
  conversao_ui_mcg: number | null;
  fonte_tecnica: string | null;
  ativo: boolean;
}

export type ConversaoStatus = "ok" | "ambiguo" | "indisponivel" | "nao_aplicavel";

/** Resultado rastreável — deve aparecer no memorial/laudo */
export interface ConversaoRastreavel {
  status: ConversaoStatus;
  valorOrigem: number;
  unidadeOrigem: string;
  valorDestino: number | null;
  unidadeDestino: string | null;
  fator: number | null;
  fonte_tecnica: string | null;
  substanciaMatch: string | null;
  mensagem: string;
}

function normalizarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

function extrairIdVitamina(nome: string): string | null {
  const s = normalizarTexto(nome);
  const m = s.match(/(?:vitamina|vit)?([a-z]\d+)/);
  if (m?.[1]) return m[1];
  const after = s.replace(/^vitamina/, "").replace(/^vit/, "");
  if (after.length === 1 && /[a-ek]/.test(after)) return after;
  return null;
}

/**
 * Match conservador: exact → containment único → id de vitamina único.
 * 0 ou >1 candidatas → null (não chutar).
 */
export function encontrarConversaoConservadora(
  nomeInsumo: string,
  rows: ConversaoUnidadeRow[],
): { status: "ok" | "ambiguo" | "indisponivel"; row?: ConversaoUnidadeRow } {
  if (!nomeInsumo.trim() || rows.length === 0) {
    return { status: "indisponivel" };
  }

  const alvo = normalizarTexto(nomeInsumo);
  const idAlvo = extrairIdVitamina(nomeInsumo);

  const exact = rows.filter((r) => normalizarTexto(r.substancia) === alvo);
  if (exact.length === 1) return { status: "ok", row: exact[0] };
  if (exact.length > 1) return { status: "ambiguo" };

  const contains = rows.filter((r) => {
    const cn = normalizarTexto(r.substancia);
    return cn.includes(alvo) || alvo.includes(cn);
  });

  if (contains.length === 1) return { status: "ok", row: contains[0] };

  if (contains.length > 1 && idAlvo) {
    const byId = contains.filter((r) => extrairIdVitamina(r.substancia) === idAlvo);
    if (byId.length === 1) return { status: "ok", row: byId[0] };
    if (byId.length > 1) return { status: "ambiguo" };
  }

  if (contains.length > 1) return { status: "ambiguo" };

  if (idAlvo) {
    const byIdOnly = rows.filter((r) => extrairIdVitamina(r.substancia) === idAlvo);
    if (byIdOnly.length === 1) return { status: "ok", row: byIdOnly[0] };
    if (byIdOnly.length > 1) return { status: "ambiguo" };
  }

  return { status: "indisponivel" };
}

export async function carregarConversoesAtivas(): Promise<ConversaoUnidadeRow[]> {
  const { data, error } = await supabase
    .from("conversoes_unidades")
    .select("id, substancia, fator_ui_para_mg, conversao_ui_mcg, fonte_tecnica, ativo")
    .eq("ativo", true)
    .order("substancia");

  if (error) throw error;
  return (data || []) as ConversaoUnidadeRow[];
}

/**
 * Fator UI→mg a partir da potência do lote do premix (UI/g).
 * 1 g = P UI → 1 UI = 1000/P mg de premix.
 * Nunca usa o fator da vitamina pura.
 */
export function fatorUiMgDePotenciaLote(potenciaUiPorGrama: number): number | null {
  if (!Number.isFinite(potenciaUiPorGrama) || potenciaUiPorGrama <= 0) return null;
  return 1000 / potenciaUiPorGrama;
}

export async function fatorUiMgDoLotePremix(loteId: string): Promise<{
  ok: boolean;
  fator?: number;
  potencia_ui_g?: number;
  mensagem: string;
  motivo?: string;
}> {
  const { data, error } = await supabase.rpc("fator_ui_mg_do_lote" as never, {
    p_lote_id: loteId,
  } as never);
  if (error) {
    return { ok: false, mensagem: error.message, motivo: "RPC_ERRO" };
  }
  const j = (data ?? {}) as Record<string, unknown>;
  if (!j.ok) {
    return {
      ok: false,
      mensagem: String(j.mensagem ?? "Premix sem potência de lote"),
      motivo: String(j.motivo ?? "PREMIX_SEM_POTENCIA_LOTE"),
    };
  }
  return {
    ok: true,
    fator: Number(j.fator_ui_para_mg),
    potencia_ui_g: Number(j.potencia_ui_g),
    mensagem: String(j.mensagem ?? ""),
  };
}

/**
 * Massa de pré-mix (mg) para uma dose em UI — RPC massa_premix_para_dose.
 * Bloqueia se potência do lote não foi validada pela RT (padrão).
 */
export async function massaPremixParaDose(params: {
  lotePremixId: string;
  doseUi: number;
  exigirValidacaoRt?: boolean;
}): Promise<{
  ok: boolean;
  massa_premix_mg?: number;
  potencia_ui_g?: number;
  potencia_validada_rt?: boolean;
  mensagem: string;
  motivo?: string;
}> {
  const { data, error } = await (supabase as any).rpc("massa_premix_para_dose", {
    p_lote_premix_id: params.lotePremixId,
    p_dose_ui: params.doseUi,
    p_exigir_validacao_rt: params.exigirValidacaoRt ?? true,
  });
  if (error) {
    return { ok: false, mensagem: error.message, motivo: "RPC_ERRO" };
  }
  const j = (data ?? {}) as Record<string, unknown>;
  if (!j.ok) {
    return {
      ok: false,
      mensagem: String(j.mensagem ?? "Não foi possível calcular a massa do pré-mix"),
      motivo: String(j.motivo ?? "ERRO"),
      potencia_ui_g: j.potencia_ui_g != null ? Number(j.potencia_ui_g) : undefined,
    };
  }
  return {
    ok: true,
    massa_premix_mg: Number(j.massa_premix_mg),
    potencia_ui_g: Number(j.potencia_ui_g),
    potencia_validada_rt: Boolean(j.potencia_validada_rt),
    mensagem: String(j.mensagem ?? ""),
  };
}

/**
 * Converte valor digitado na unidade escolhida → destino (padrão: mcg se UI→mcg disponível, senão mg).
 * mcg ↔ mg usa fator 1000 (não precisa de tabela).
 *
 * Premix (ehPremix): UI→mg SÓ com potência do lote. Sem lote/potência → bloqueia
 * (nunca assume fator da D3 pura em conversoes_unidades).
 */
export async function converterDeclaracaoInsumo(params: {
  nomeInsumo: string;
  valor: number;
  unidadeOrigem: string;
  /** Destino preferido; se omitido, UI→mcg (se houver fator) senão UI→mg; mcg↔mg conforme destino implícito */
  unidadeDestino?: string;
  /** Item é premix/diluição — não usar fator da substância pura */
  ehPremix?: boolean;
  /** Lote do premix (obrigatório se ehPremix + UI) */
  loteId?: string | null;
}): Promise<ConversaoRastreavel> {
  const { nomeInsumo, valor } = params;
  const origem = canonicalizarUnidadeDose(params.unidadeOrigem);
  const origemUi = params.unidadeOrigem.trim().toUpperCase() === "UI" ? "UI" : origem;

  if (!Number.isFinite(valor) || valor <= 0) {
    return {
      status: "nao_aplicavel",
      valorOrigem: valor,
      unidadeOrigem: origemUi,
      valorDestino: null,
      unidadeDestino: null,
      fator: null,
      fonte_tecnica: null,
      substanciaMatch: null,
      mensagem: "Informe um valor numérico positivo para converter.",
    };
  }

  // mcg ↔ mg (fator fixo 1000)
  const destinoPref = params.unidadeDestino
    ? canonicalizarUnidadeDose(params.unidadeDestino)
    : null;

  if (origemUi === "mcg" && (destinoPref === "mg" || destinoPref === null)) {
    if (destinoPref === null) {
      return {
        status: "ok",
        valorOrigem: valor,
        unidadeOrigem: "mcg",
        valorDestino: valor,
        unidadeDestino: "mcg",
        fator: 1,
        fonte_tecnica: "identidade (mcg)",
        substanciaMatch: null,
        mensagem: `${valor} mcg — sem conversão necessária.`,
      };
    }
    const mg = valor / 1000;
    return {
      status: "ok",
      valorOrigem: valor,
      unidadeOrigem: "mcg",
      valorDestino: mg,
      unidadeDestino: "mg",
      fator: 0.001,
      fonte_tecnica: "1 mg = 1000 mcg",
      substanciaMatch: null,
      mensagem: `${valor} mcg → ${mg} mg (fator 1/1000).`,
    };
  }

  if (origemUi === "mg" && destinoPref === "mcg") {
    const mcg = valor * 1000;
    return {
      status: "ok",
      valorOrigem: valor,
      unidadeOrigem: "mg",
      valorDestino: mcg,
      unidadeDestino: "mcg",
      fator: 1000,
      fonte_tecnica: "1 mg = 1000 mcg",
      substanciaMatch: null,
      mensagem: `${valor} mg → ${mcg} mcg (fator 1000).`,
    };
  }

  if (origemUi !== "UI") {
    return {
      status: "nao_aplicavel",
      valorOrigem: valor,
      unidadeOrigem: origemUi,
      valorDestino: valor,
      unidadeDestino: origemUi,
      fator: 1,
      fonte_tecnica: null,
      substanciaMatch: null,
      mensagem: `Unidade ${origemUi}: sem conversão UI necessária.`,
    };
  }

  // Premix: fator vem do lote (COA), nunca de conversoes_unidades da pura
  if (params.ehPremix) {
    if (!params.loteId) {
      return {
        status: "indisponivel",
        valorOrigem: valor,
        unidadeOrigem: "UI",
        valorDestino: null,
        unidadeDestino: null,
        fator: null,
        fonte_tecnica: null,
        substanciaMatch: nomeInsumo,
        mensagem:
          "Premix sem lote informado: não é possível converter UI→mg. Informe a potência (UI/g) do lote do COA — não usar fator da vitamina pura.",
      };
    }
    const calc = await massaPremixParaDose({
      lotePremixId: params.loteId,
      doseUi: valor,
      exigirValidacaoRt: true,
    });
    if (!calc.ok || calc.massa_premix_mg == null) {
      return {
        status: "indisponivel",
        valorOrigem: valor,
        unidadeOrigem: "UI",
        valorDestino: null,
        unidadeDestino: null,
        fator: null,
        fonte_tecnica: null,
        substanciaMatch: nomeInsumo,
        mensagem:
          calc.mensagem ||
          "Premix sem potência de lote validada pela RT. Bloqueado — não assumir fator da D3 pura.",
      };
    }
    const mg = calc.massa_premix_mg;
    const fator = valor > 0 ? mg / valor : null;
    return {
      status: "ok",
      valorOrigem: valor,
      unidadeOrigem: "UI",
      valorDestino: mg,
      unidadeDestino: "mg",
      fator,
      fonte_tecnica: calc.mensagem,
      substanciaMatch: nomeInsumo,
      mensagem: calc.mensagem,
    };
  }

  // UI → precisa da tabela (substância pura / não-premix)
  let rows: ConversaoUnidadeRow[];
  try {
    rows = await carregarConversoesAtivas();
  } catch (e) {
    return {
      status: "indisponivel",
      valorOrigem: valor,
      unidadeOrigem: "UI",
      valorDestino: null,
      unidadeDestino: null,
      fator: null,
      fonte_tecnica: null,
      substanciaMatch: null,
      mensagem:
        "Conversão indisponível (falha ao ler conversoes_unidades). Confirmar com RT.",
    };
  }

  const match = encontrarConversaoConservadora(nomeInsumo, rows);
  if (match.status === "ambiguo") {
    return {
      status: "ambiguo",
      valorOrigem: valor,
      unidadeOrigem: "UI",
      valorDestino: null,
      unidadeDestino: null,
      fator: null,
      fonte_tecnica: null,
      substanciaMatch: null,
      mensagem:
        "Mais de uma substância candidata em conversoes_unidades. Confirme com a RT — conversão automática bloqueada.",
    };
  }
  if (match.status === "indisponivel" || !match.row) {
    return {
      status: "indisponivel",
      valorOrigem: valor,
      unidadeOrigem: "UI",
      valorDestino: null,
      unidadeDestino: null,
      fator: null,
      fonte_tecnica: null,
      substanciaMatch: null,
      mensagem:
        "Conversão indisponível: não há fator UI para este insumo em conversoes_unidades. Confirmar com RT.",
    };
  }

  const row = match.row;
  const querMcg =
    !destinoPref || destinoPref === "mcg" || destinoPref === "µg";

  if (querMcg && row.conversao_ui_mcg != null && row.conversao_ui_mcg > 0) {
    const mcg = valor * row.conversao_ui_mcg;
    return {
      status: "ok",
      valorOrigem: valor,
      unidadeOrigem: "UI",
      valorDestino: mcg,
      unidadeDestino: "mcg",
      fator: row.conversao_ui_mcg,
      fonte_tecnica: row.fonte_tecnica,
      substanciaMatch: row.substancia,
      mensagem: `${valor} UI → ${mcg} mcg (fator ${row.conversao_ui_mcg} mcg/UI; ${row.substancia}${row.fonte_tecnica ? `; ${row.fonte_tecnica}` : ""}).`,
    };
  }

  if (row.fator_ui_para_mg != null && row.fator_ui_para_mg > 0) {
    const mg = valor * row.fator_ui_para_mg;
    return {
      status: "ok",
      valorOrigem: valor,
      unidadeOrigem: "UI",
      valorDestino: mg,
      unidadeDestino: "mg",
      fator: row.fator_ui_para_mg,
      fonte_tecnica: row.fonte_tecnica,
      substanciaMatch: row.substancia,
      mensagem: `${valor} UI → ${mg} mg (fator ${row.fator_ui_para_mg} mg/UI; ${row.substancia}${row.fonte_tecnica ? `; ${row.fonte_tecnica}` : ""}).`,
    };
  }

  return {
    status: "indisponivel",
    valorOrigem: valor,
    unidadeOrigem: "UI",
    valorDestino: null,
    unidadeDestino: null,
    fator: null,
    fonte_tecnica: row.fonte_tecnica,
    substanciaMatch: row.substancia,
    mensagem:
      "Conversão indisponível: linha encontrada sem fator válido. Confirmar com RT.",
  };
}

/** Formata o memorial curto para toast / observações */
export function formatarMemorialConversao(c: ConversaoRastreavel): string {
  if (c.status !== "ok" || c.valorDestino == null || !c.unidadeDestino) {
    return c.mensagem;
  }
  return [
    `${c.valorOrigem} ${c.unidadeOrigem} → ${c.valorDestino} ${c.unidadeDestino}`,
    c.fator != null ? `fator=${c.fator}` : null,
    c.fonte_tecnica ? `fonte=${c.fonte_tecnica}` : null,
    c.substanciaMatch ? `match=${c.substanciaMatch}` : null,
  ]
    .filter(Boolean)
    .join(" | ");
}
