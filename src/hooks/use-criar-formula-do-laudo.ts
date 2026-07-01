import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useFormulaCRUD, useFormulaItensCRUD, useConversoesUnidades } from "@/hooks/use-formulador-industrial";
import { useHybridItens } from "@/hooks/use-hybrid-data";
import {
  CAPSULA_TAMANHO_PADRAO, DENSIDADE_PADRAO_KG_L, sugerirPesoAlvoMg,
  converterMCGparaMG, converterGparaMG, converterUIparaMG,
} from "@/lib/formulador-industrial-rules";

type AtivoLaudo = { nome: string; dose: number; unit: string; key?: string };

const norm = (s: string) =>
  (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export function useCriarFormulaDoLaudo() {
  const navigate = useNavigate();
  const { criar } = useFormulaCRUD();
  const { adicionar } = useFormulaItensCRUD();
  const { buscarFator } = useConversoesUnidades();
  const { data: insumos = [] } = useHybridItens({ ativo: true });

  const casarInsumo = (nome: string) => {
    const n = norm(nome);
    const hit = insumos.find((i: any) => norm(i.nome) === n)
             || insumos.find((i: any) => norm(i.nome).includes(n) || n.includes(norm(i.nome)));
    return hit?.id ?? null;
  };

  async function criarDoLaudo(produtoNome: string, ativos: AtivoLaudo[]) {
    const pendenciasForaMassa: string[] = [];
    const flags: string[] = [];

    // Monta observações com constituintes fora da massa ANTES de criar
    let observacoesTecnicas = "";
    const pendenciasTemp: string[] = [];

    // 1) Identifica constituintes fora da massa (UFC, FCC, etc.)
    for (const a of ativos) {
      const u = (a.unit || "mg").toUpperCase();
      const nome = a.nome?.trim();
      if (!nome) continue;

      if (["UFC", "FCC"].includes(u) || !["MG", "MCG", "UI", "G"].includes(u)) {
        pendenciasTemp.push(`${nome} ${a.dose} ${a.unit}`);
      }
    }

    if (pendenciasTemp.length) {
      observacoesTecnicas = "Constituintes fora da massa (declarar junto à alegação): " + pendenciasTemp.join("; ");
    }

    // 2) cria a fórmula (cápsula 0, peso sugerido, densidade default, rascunho)
    const pesoAlvo = sugerirPesoAlvoMg(DENSIDADE_PADRAO_KG_L, CAPSULA_TAMANHO_PADRAO);
    const formula = await criar({
      nome_formula: produtoNome || "Fórmula do laudo",
      tipo_apresentacao: "CAPSULA",
      status: "RASCUNHO",
      tipo_capsula: CAPSULA_TAMANHO_PADRAO,
      excipiente_padrao: "AMIDO",
      densidade_aparente_kg_l: DENSIDADE_PADRAO_KG_L,
      peso_capsula_alvo_mg: pesoAlvo,
      peso_enchimento_mg: pesoAlvo,
      peso_capsula_nominal_mg: pesoAlvo,
      observacoes_tecnicas: observacoesTecnicas,
    } as any);
    if (!formula?.id) { toast.error("Falha ao criar a fórmula."); return; }

    // 3) insere cada ativo, aplicando normalização + flags
    let ordem = 1;
    for (const a of ativos) {
      const u = (a.unit || "mg").toUpperCase();
      const nome = a.nome?.trim();
      if (!nome) continue;

      // constituinte fora da massa (probiótico/enzima etc.)
      if (["UFC", "FCC"].includes(u) || !["MG", "MCG", "UI", "G"].includes(u)) {
        pendenciasForaMassa.push(`${nome} ${a.dose} ${a.unit}`);
        continue;
      }

      let unidade: "MG" | "MCG" | "UI" = "MG";
      let qtdInformada = Number(a.dose) || 0;
      let convertidaMg = qtdInformada;
      let critico = false;
      let metodo: string | null = null;

      if (u === "MCG") { unidade = "MCG"; convertidaMg = converterMCGparaMG(qtdInformada); }
      else if (u === "G") { unidade = "MG"; qtdInformada = converterGparaMG(qtdInformada); convertidaMg = qtdInformada; }
      else if (u === "UI") {
        unidade = "UI";
        const fator = buscarFator(nome);
        if (fator && fator > 0) convertidaMg = converterUIparaMG(qtdInformada, fator);
        else { convertidaMg = 0; critico = true; metodo = "PENDENTE: fator UI→mg não encontrado"; flags.push(`${nome} (UI sem fator)`); }
      }

      const insumoId = casarInsumo(nome);
      if (!insumoId) flags.push(`${nome} (sem insumo cadastrado)`);

      await adicionar({
        formula_id: formula.id,
        nome_insumo: nome,
        produto_materia_prima_id: insumoId,
        quantidade_informada: qtdInformada,
        unidade_informada: unidade,
        quantidade_convertida_mg: convertidaMg,
        ativo_critico: critico,
        ordem_mistura: ordem++,
        metodo_distribuicao: metodo,
      });
    }

    // 4) feedback e navegação para edição (onde as flags são resolvidas)
    toast.success(
      flags.length
        ? `Fórmula criada com ${flags.length} pendência(s): ${flags.join(", ")}. Resolva na edição.`
        : "Fórmula criada a partir do laudo."
    );
    navigate(`/producao/formulas/${formula.id}/editar`);
  }

  return { criarDoLaudo };
}
