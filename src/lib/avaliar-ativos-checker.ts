/**
 * Pós-processamento do Checker: IA extrai ativos; o motor SQL decide conformidade.
 */

import {
  aplicarPortaoBotanico,
  rpcAnvisaAvaliarAtivo,
  rpcAnvisaAvaliarInsumo,
  rpcAnvisaIdentidadeBotanica,
  statusGeralDosPareceres,
  type AnvisaAvaliarAtivoResult,
} from "@/lib/anvisa-avaliar-ativo";

export type AtivoChecker = {
  nome: string;
  dose: number;
  unit: string;
  key?: string;
  /** Quando presente, preferir anvisa_avaliar_insumo (vínculo RT). */
  item_id?: string | null;
  /** Função no produto — repassada como p_funcao (≠ ATIVO → via IN 211). */
  funcao_no_produto?: string | null;
  especie_declarada?: string | null;
  parte_vegetal?: string | null;
  tipo_extrato?: string | null;
  padronizacao?: string | null;
  /** Parecer do motor — nunca colapsar PENDENTE_VERIFICACAO com NAO_AUTORIZADO. */
  parecer?: AnvisaAvaliarAtivoResult & {
    especie_declarada?: string | null;
    parte_vegetal?: string | null;
    tipo_extrato?: string | null;
    padronizacao?: string | null;
  };
  status_parecer?: string;
};

export type ProdutoChecker = {
  nome: string;
  status_geral: string;
  ativos: AtivoChecker[];
  alertas?: Array<{ tipo: string; titulo: string; corpo: string }>;
  [key: string]: unknown;
};

function alertaDoParecer(
  ativo: AtivoChecker,
  parecer: AnvisaAvaliarAtivoResult,
): { tipo: "err" | "warn" | "ok" | "info"; titulo: string; corpo: string } | null {
  const status = String(parecer.status || "").toUpperCase();
  const motivo = parecer.motivo || "";
  const sub = parecer.substituicao_sugerida
    ? ` Substituição sugerida (proposta funcional permitida): ${parecer.substituicao_sugerida}${
      parecer.proposta_funcional ? ` — ${parecer.proposta_funcional}` : ""
    }.`
    : "";

  if (status === "NAO_AUTORIZADO") {
    return {
      tipo: "err",
      titulo: `${ativo.nome}: não autorizado`,
      corpo: (motivo || "Não consta da lista taxativa da IN 28/2018.") + sub,
    };
  }
  if (status === "PENDENTE_VERIFICACAO") {
    return {
      tipo: "warn",
      titulo: `${ativo.nome}: pendente de verificação`,
      corpo: motivo || "Falta dado para comparar com o limite oficial (unidade, fonte ou teor).",
    };
  }
  if (status === "APROVAVEL_COM_CORRECAO") {
    return {
      tipo: "warn",
      titulo: `${ativo.nome}: aprovável com correção`,
      corpo: motivo || "Ajuste de declaração necessário (ex.: teor elementar / %VDR).",
    };
  }
  if (status === "AVALIAR_FITOTERAPICO" || status === "REPROVADO_ALEGACAO") {
    return {
      tipo: "err",
      titulo: `${ativo.nome}: ${status}`,
      corpo: motivo || status,
    };
  }
  return null;
}

/** Avalia cada ativo via motor SQL e recalcula status_geral. */
export async function avaliarProdutosComMotor(
  produtos: ProdutoChecker[],
  publicoChecker: string,
  opts?: { companyId?: string | null },
): Promise<ProdutoChecker[]> {
  const out: ProdutoChecker[] = [];
  const companyId = opts?.companyId || null;

  for (const produto of produtos) {
    const ativosEnriquecidos: AtivoChecker[] = [];
    const alertasMotor: Array<{ tipo: "err" | "warn" | "ok" | "info"; titulo: string; corpo: string }> = [];

    for (const ativo of produto.ativos || []) {
      // Preferir vínculo RT quando houver item_id (contrato do banco).
      const bruto = ativo.item_id && companyId
        ? await rpcAnvisaAvaliarInsumo({
          itemId: ativo.item_id,
          companyId,
          dose: Number(ativo.dose) || 0,
          unidade: ativo.unit || "mg",
          grupo: publicoChecker,
          funcao: ativo.funcao_no_produto ?? null,
        })
        : await rpcAnvisaAvaliarAtivo({
          nome: ativo.nome,
          dose: Number(ativo.dose) || 0,
          unidade: ativo.unit || "mg",
          grupo: publicoChecker,
        });
      // Portão botânico: banco (constituinte casado) antes da heurística de nome.
      let identidadeBanco = null as Awaited<ReturnType<typeof rpcAnvisaIdentidadeBotanica>>;
      if (bruto.constituinte_id) {
        identidadeBanco = await rpcAnvisaIdentidadeBotanica(bruto.constituinte_id);
      }
      const parecer = aplicarPortaoBotanico(
        bruto,
        ativo.nome,
        {
          especie_declarada: ativo.especie_declarada,
          parte_vegetal: ativo.parte_vegetal,
          tipo_extrato: ativo.tipo_extrato,
          padronizacao: ativo.padronizacao,
        },
        identidadeBanco,
      );

      const enriquecido: AtivoChecker = {
        ...ativo,
        status_parecer: String(parecer.status),
        parecer: {
          ...parecer,
          especie_declarada: ativo.especie_declarada ?? null,
          parte_vegetal: ativo.parte_vegetal ?? null,
          tipo_extrato: ativo.tipo_extrato ?? null,
          padronizacao: ativo.padronizacao ?? null,
        },
      };
      ativosEnriquecidos.push(enriquecido);

      const alerta = alertaDoParecer(enriquecido, parecer);
      if (alerta) alertasMotor.push(alerta);
    }

    const statusGeral = statusGeralDosPareceres(
      ativosEnriquecidos.map((a) => ({ status: a.status_parecer })),
    );

    const alertasExistentes = Array.isArray(produto.alertas) ? produto.alertas : [];
    out.push({
      ...produto,
      status_geral: statusGeral,
      ativos: ativosEnriquecidos,
      alertas: [...alertasMotor, ...alertasExistentes],
      // Alegações/advertências vêm do motor (anvisa_constituintes) — nunca do LLM.
      alegacoes_permitidas: [],
      alegacoes_proibidas: [],
      avisos_rotulo: Array.isArray(produto.avisos_rotulo) ? produto.avisos_rotulo : [],
      motor: "anvisa_avaliar_ativo",
      pareceres: ativosEnriquecidos.map((a) => ({
        nome_ativo: a.nome,
        dose: a.dose,
        unidade: a.unit,
        ...(a.parecer || {}),
        status: a.status_parecer,
      })),
    });
  }

  return out;
}
