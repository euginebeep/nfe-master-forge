/**
 * RegulatoryEngine — orquestração fina sobre o núcleo SQL.
 *
 * REGRA DE OURO: nenhum cálculo de limite Anvisa neste arquivo.
 * Toda matemática vive em public.regulatory_validar_produto, que
 * CHAMA anvisa_avaliar_formula (não reimplementa).
 */

import { supabase } from "@/integrations/supabase/client";

export type StatusGeral = "CONFORME" | "NAO_CONFORME" | "PENDENTE_RT";

export interface IdentidadeCheck {
  insumo: string;
  status: "CONFIRMADO" | "SEM_VINCULO" | "VINCULO_NAO_CONFIRMADO" | string;
  constituinte: string | null;
  motivo: string | null;
  dado_faltante?: string | null;
}

export interface LimiteCheck {
  insumo?: string | null;
  constituinte: string | null;
  status: string;
  ativo_teto_mg?: number | null;
  ativo_piso_mg?: number | null;
  limite_min_mg?: number | null;
  limite_max_mg?: number | null;
  norma?: string | null;
  dado_faltante?: string | null;
}

export interface GrupoCheck {
  grupo: string | null;
  dado_faltante?: string | null;
  incompativeis: Array<{
    constituinte: string;
    grupo: string;
    motivo: string;
  }>;
}

export interface AssociacaoProibida {
  a: string;
  b: string;
  norma?: string | null;
}

export interface NormaAplicada {
  norma: string;
  dispositivo: string;
  data_verificacao: string;
  fonte_url?: string | null;
}

export interface ParecerRegulatorio {
  formulaId: string;
  dataReferencia: string;
  statusGeral: StatusGeral;
  bloqueante: boolean;
  verificacoes: {
    identidade: IdentidadeCheck[];
    limites: LimiteCheck[];
    grupo: GrupoCheck;
    associacoes: AssociacaoProibida[];
    alegacoes: {
      permitidas: string[];
      proibidas: string[];
      advertencias: string[];
    };
  };
  normasAplicadas: NormaAplicada[];
  snapshotId: string | null;
}

export interface ValidarProdutoParams {
  formulaId: string;
  dataReferencia?: Date | string;
  grupoPopulacional?: string;
  alegacoesPretendidas?: string[];
  documentoTipo?:
    | "laudo"
    | "op"
    | "rotulo"
    | "tabela_nutricional"
    | "ficha_tecnica"
    | "parecer";
  documentoId?: string;
}

function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x));
}

function assertParecer(raw: unknown): ParecerRegulatorio {
  if (!raw || typeof raw !== "object") {
    throw new Error("RegulatoryEngine: resposta vazia da RPC");
  }
  const p = raw as Record<string, unknown>;
  const status = p.statusGeral;
  if (
    status !== "CONFORME" &&
    status !== "NAO_CONFORME" &&
    status !== "PENDENTE_RT"
  ) {
    throw new Error(
      `RegulatoryEngine: statusGeral inválido (${String(status)})`,
    );
  }

  const ver = (p.verificacoes ?? {}) as Record<string, unknown>;
  const grupo = (ver.grupo ?? {}) as Record<string, unknown>;
  const aleg = (ver.alegacoes ?? {}) as Record<string, unknown>;

  return {
    formulaId: String(p.formulaId ?? ""),
    dataReferencia: String(p.dataReferencia ?? ""),
    statusGeral: status,
    bloqueante: Boolean(p.bloqueante),
    verificacoes: {
      identidade: asArray<IdentidadeCheck>(ver.identidade),
      limites: asArray<LimiteCheck>(ver.limites),
      grupo: {
        grupo: (grupo.grupo as string | null) ?? null,
        dado_faltante: (grupo.dado_faltante as string | null) ?? null,
        incompativeis: asArray(grupo.incompativeis),
      },
      associacoes: asArray<AssociacaoProibida>(ver.associacoes),
      alegacoes: {
        permitidas: asStringArray(aleg.permitidas),
        proibidas: asStringArray(aleg.proibidas),
        advertencias: asStringArray(aleg.advertencias),
      },
    },
    normasAplicadas: asArray<NormaAplicada>(p.normasAplicadas),
    snapshotId: (p.snapshotId as string | null) ?? null,
  };
}

/**
 * Executa o parecer regulatório completo via RPC SQL.
 * Nenhum cálculo local — só tipagem do shape retornado.
 */
export async function validarProduto(
  params: ValidarProdutoParams,
): Promise<ParecerRegulatorio> {
  if (!params.formulaId) {
    throw new Error("formulaId é obrigatório");
  }

  const dataRef =
    params.dataReferencia instanceof Date
      ? params.dataReferencia.toISOString().slice(0, 10)
      : (params.dataReferencia ?? new Date().toISOString().slice(0, 10));

  const { data, error } = await supabase.rpc(
    "regulatory_validar_produto" as never,
    {
      p_formula_id: params.formulaId,
      p_data: dataRef,
      p_grupo: params.grupoPopulacional ?? null,
      p_alegacoes: params.alegacoesPretendidas ?? null,
      p_documento_tipo: params.documentoTipo ?? null,
      p_documento_id: params.documentoId ?? null,
    } as never,
  );

  if (error) {
    throw new Error(`RegulatoryEngine: ${error.message}`);
  }

  return assertParecer(data);
}

export function isConforme(parecer: ParecerRegulatorio): boolean {
  return parecer.statusGeral === "CONFORME";
}

export function isBloqueante(parecer: ParecerRegulatorio): boolean {
  return parecer.bloqueante || parecer.statusGeral === "NAO_CONFORME";
}

export function precisaRT(parecer: ParecerRegulatorio): boolean {
  return parecer.statusGeral === "PENDENTE_RT";
}
