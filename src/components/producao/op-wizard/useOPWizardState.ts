import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { addMonths, format } from "date-fns";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LocalDb } from "@/lib/local-db";
import type { LocalEntidade } from "@/hooks/use-local-entidades";
import {
  type Formula,
  type PedidoVenda,
  type PedidoItem,
  type EntidadeCliente,
  type EtapaWizard,
  type TipoProduto,
  type FormValues,
  formSchema,
  EXCIPIENTES_TECNOLOGICOS,
  PESO_CAPSULA_ALVO,
  ACRESCIMO_INDUSTRIAL,
  PESO_CAPSULA_NOMINAL,
} from "./op-wizard-types";

export function useOPWizardState(open: boolean, onSuccess: () => void, onOpenChange: (open: boolean) => void) {
  const navigate = useNavigate();
  const [etapaAtual, setEtapaAtual] = useState<EtapaWizard>(1);
  const [formulas, setFormulas] = useState<Formula[]>([]);
  const [pedidos, setPedidos] = useState<PedidoVenda[]>([]);
  const [clientes, setClientes] = useState<EntidadeCliente[]>([]);
  const [clienteSearch, setClienteSearch] = useState("");
  const [selectedFormula, setSelectedFormula] = useState<Formula | null>(null);
  const [selectedPedido, setSelectedPedido] = useState<PedidoVenda | null>(null);
  const [selectedCliente, setSelectedCliente] = useState<EntidadeCliente | null>(null);
  const [pedidoItens, setPedidoItens] = useState<PedidoItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showClienteDropdown, setShowClienteDropdown] = useState(false);
  const [showQuickClienteModal, setShowQuickClienteModal] = useState(false);
  const [misturador, setMisturador] = useState<{
    volume_nominal_litros: number;
    fator_enchimento_maximo: number;
    fator_enchimento_minimo: number;
    fator_enchimento_padrao: number;
    densidade_padrao_kg_l: number;
    nome: string;
  } | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      tipo_op: "MANUAL",
      formula_id: "",
      pedido_id: "",
      cliente_id: "",
      cliente_nome: "",
      cliente_documento: "",
      produto_nome: "",
      tipo_produto: "CAPSULA",
      quantidade_frascos: 100,
      unidades_por_frasco: 60,
      capsula_item_id: "", capsula_item_nome: "", capsula_item_source: undefined,
      pote_item_id: "", pote_item_nome: "", pote_item_source: undefined,
      tampa_item_id: "", tampa_item_nome: "", tampa_item_source: undefined,
      silica_item_id: "", silica_item_nome: "", silica_item_source: undefined,
      incluir_silica: true,
      descricao_rotulo: "",
      lote_produto_acabado: "",
      tipo_capsula: "00",
      excipiente_base: "AMIDO",
      responsavel_producao_nome: "",
      responsavel_tecnico_id: "",
      observacoes: "",
    },
  });

  const tipoOP = form.watch("tipo_op");
  const tipoProduto = form.watch("tipo_produto");
  const quantidadeFrascos = form.watch("quantidade_frascos") || 0;
  const unidadesPorFrasco = form.watch("unidades_por_frasco") || 0;
  const dataFab = form.watch("data_fabricacao");

  const totalUnidades = quantidadeFrascos * unidadesPorFrasco;
  const totalComAcrescimo = Math.ceil(totalUnidades * (1 + ACRESCIMO_INDUSTRIAL / 100));

  // ============================================================
  // CÁLCULO DE BATELADAS — usa dados reais do equipamento + fórmula
  // Fallback seguro quando equipamento não está cadastrado
  // ============================================================
  // Parâmetros do equipamento (banco) ou defaults conservadores
  const VOL_TOTAL_L        = misturador?.volume_nominal_litros    ?? 100;
  const FATOR_MAX          = misturador?.fator_enchimento_maximo  ?? 0.65;
  const FATOR_MIN          = misturador?.fator_enchimento_minimo  ?? 0.15;
  const DENSIDADE_EQUIP    = misturador?.densidade_padrao_kg_l    ?? 0.65;

  // Volume útil máximo e mínimo por batelada (em litros)
  const VOLUME_UTIL_MAX_L  = VOL_TOTAL_L * FATOR_MAX;   // ex: 100 × 0.65 = 65L
  const VOLUME_UTIL_MIN_L  = VOL_TOTAL_L * FATOR_MIN;   // ex: 100 × 0.15 = 15L

  // Parâmetros da fórmula — usa o real, fallback para o equipamento, fallback para default
  const PESO_ENCHIMENTO_MG = selectedFormula?.peso_enchimento_mg       ?? 500;
  const DENSIDADE_FORMULA  = selectedFormula?.densidade_aparente_kg_l  ?? DENSIDADE_EQUIP;

  // 1. Peso total do pó a misturar (kg)
  const pesoTotalMisturaKg = totalComAcrescimo > 0
    ? (totalComAcrescimo * PESO_ENCHIMENTO_MG) / 1_000_000
    : 0;

  // 2. Volume total ocupado pelo pó (litros) = peso ÷ densidade real da fórmula
  const volumeTotalPoL = DENSIDADE_FORMULA > 0
    ? pesoTotalMisturaKg / DENSIDADE_FORMULA
    : 0;

  // 3. Número de bateladas — limitado pelo VOLUME (critério real do misturador)
  const numeroBateladas = volumeTotalPoL > 0
    ? Math.ceil(volumeTotalPoL / VOLUME_UTIL_MAX_L)
    : 1;

  // 4. Volume e peso por batelada
  const volumePorBatelada  = numeroBateladas > 0 ? volumeTotalPoL   / numeroBateladas : 0;
  const pesoPorBatelada    = numeroBateladas > 0 ? pesoTotalMisturaKg / numeroBateladas : 0;

  // 5. Fator de enchimento real (0.0 a 1.0) — quanto do misturador será usado
  const fatorEnchimentoReal = VOL_TOTAL_L > 0
    ? volumePorBatelada / VOL_TOTAL_L
    : 0;

  // 6. Status baseado em volume (critério principal)
  const bateladaStatus: 'ok' | 'aviso_baixo' | 'aviso_alto' | 'bloqueado' = (() => {
    if (volumePorBatelada <= 0) return 'ok';
    if (volumePorBatelada > VOLUME_UTIL_MAX_L)              return 'bloqueado';
    if (volumePorBatelada > VOLUME_UTIL_MAX_L * 0.90)       return 'aviso_alto';
    if (volumePorBatelada < VOLUME_UTIL_MIN_L)              return 'aviso_baixo';
    return 'ok';
  })();

  const nomeMisturador = misturador?.nome ?? `Misturador em V ${VOL_TOTAL_L}L`;

  const bateladaAlerta: string | null = (() => {
    switch (bateladaStatus) {
      case 'bloqueado':
        return `Volume por batelada (${volumePorBatelada.toFixed(1)}L) excede o limite do ${nomeMisturador} (${VOLUME_UTIL_MAX_L.toFixed(0)}L úteis). Reduza a quantidade ou cadastre um equipamento maior.`;
      case 'aviso_alto':
        return `Volume por batelada (${volumePorBatelada.toFixed(1)}L) próximo ao limite de ${VOLUME_UTIL_MAX_L.toFixed(0)}L. Confirme a densidade da fórmula (${DENSIDADE_FORMULA.toFixed(2)} kg/L) antes de produzir.`;
      case 'aviso_baixo':
        return `Volume por batelada (${volumePorBatelada.toFixed(1)}L) abaixo do mínimo recomendado (${VOLUME_UTIL_MIN_L.toFixed(0)}L). Risco de heterogeneidade na mistura.`;
      default:
        return null;
    }
  })();

  // Load formulas & pedidos on open
  useEffect(() => {
    if (!open) return;
    const fetchFormulas = async () => {
      const { data } = await supabase
        .from("formulas")
        .select("id, codigo_formula, nome_formula, status, tipo_capsula, excipiente_padrao, peso_capsula_alvo_mg, tipo_apresentacao, peso_enchimento_mg, densidade_aparente_kg_l")
        .eq("status", "APROVADA")
        .order("nome_formula", { ascending: true });
      setFormulas((data as Formula[]) || []);
    };
    const fetchPedidos = async () => {
      const { data } = await supabase
        .from("pedidos_venda")
        .select("id, codigo, cliente_nome, cliente_documento, cliente_id, valor_total, status")
        .eq("status", "CONFIRMADO")
        .is("op_id", null)
        .order("created_at", { ascending: false });
      setPedidos((data as PedidoVenda[]) || []);
    };
    const fetchMisturador = async () => {
      const { data } = await supabase
        .from('equipamentos')
        .select('nome, volume_nominal_litros, fator_enchimento_maximo, fator_enchimento_minimo, fator_enchimento_padrao, densidade_padrao_kg_l')
        .eq('ativo', true)
        .in('tipo', ['MISTURADOR_V', 'MISTURADOR_DUPLO_CONE'])
        .order('nome')
        .limit(1)
        .maybeSingle();
      if (data) setMisturador(data as any);
    };
    fetchMisturador();
    fetchFormulas();
    fetchPedidos();
    setEtapaAtual(1);
    form.reset();
    setSelectedFormula(null);
    setSelectedPedido(null);
    setSelectedCliente(null);
    setPedidoItens([]);
    setClientes([]);
    setClienteSearch("");
  }, [open, form]);

  // Client search with debounce
  useEffect(() => {
    const buscarClientes = async () => {
      if (clienteSearch.length < 2) { setClientes([]); return; }
      const searchLower = clienteSearch.toLowerCase();
      const { data: supabaseData } = await supabase
        .from("entidades")
        .select("id, razao_social, nome_fantasia, documento")
        .or(`razao_social.ilike.%${clienteSearch}%,nome_fantasia.ilike.%${clienteSearch}%,documento.ilike.%${clienteSearch}%`)
        .eq("status", "ATIVO")
        .limit(10);
      const supabaseClientes: EntidadeCliente[] = (supabaseData || []).map(c => ({
        ...c, nome_fantasia: c.nome_fantasia || undefined, source: "supabase" as const,
      }));
      const localEntidades = LocalDb.query<LocalEntidade>("entidades", (e) => {
        if (e.status !== "ATIVO") return false;
        return e.razao_social?.toLowerCase().includes(searchLower) ||
               e.nome_fantasia?.toLowerCase().includes(searchLower) ||
               e.documento?.includes(clienteSearch.replace(/\D/g, ""));
      });
      const localClientes: EntidadeCliente[] = localEntidades
        .filter(l => !supabaseClientes.find(s => s.id === l.id))
        .slice(0, 10)
        .map(l => ({ id: l.id, razao_social: l.razao_social, nome_fantasia: l.nome_fantasia, documento: l.documento, source: "local" as const }));
      setClientes([...supabaseClientes, ...localClientes]);
      setShowClienteDropdown(true);
    };
    const debounce = setTimeout(buscarClientes, 300);
    return () => clearTimeout(debounce);
  }, [clienteSearch]);

  // Auto-generate lot number
  useEffect(() => {
    if (dataFab) {
      const ano = String(dataFab.getFullYear()).slice(-2);
      const mes = String(dataFab.getMonth() + 1).padStart(2, "0");
      const dia = String(dataFab.getDate()).padStart(2, "0");
      const seq = String(Math.floor(Math.random() * 900) + 100);
      form.setValue("lote_produto_acabado", `${ano}${mes}${dia}-${seq}`);
      form.setValue("data_validade", addMonths(dataFab, 24));
    }
  }, [dataFab, form]);

  const handleClienteSelect = (cliente: EntidadeCliente) => {
    setSelectedCliente(cliente);
    form.setValue("cliente_id", cliente.id);
    form.setValue("cliente_nome", cliente.nome_fantasia || cliente.razao_social);
    form.setValue("cliente_documento", cliente.documento);
    setClienteSearch(cliente.nome_fantasia || cliente.razao_social);
    setShowClienteDropdown(false);
  };

  const handleQuickClienteCreated = (cliente: { id: string; razao_social: string; nome_fantasia?: string; documento: string }) => {
    handleClienteSelect({ ...cliente, source: "supabase" });
  };

  const handleFormulaChange = (formulaId: string) => {
    form.setValue("formula_id", formulaId);
    const formula = formulas.find((f) => f.id === formulaId);
    if (formula) {
      setSelectedFormula(formula);
      form.setValue("produto_nome", formula.nome_formula);
      form.setValue("tipo_capsula", formula.tipo_capsula || "00");
      form.setValue("excipiente_base", (formula.excipiente_padrao as "AMIDO" | "CELULOSE" | "PRE_BLEND") || "AMIDO");
      if (formula.tipo_apresentacao) form.setValue("tipo_produto", formula.tipo_apresentacao as TipoProduto);
    } else {
      setSelectedFormula(null);
    }
  };

  const handlePedidoChange = async (pedidoId: string) => {
    form.setValue("pedido_id", pedidoId);
    const pedido = pedidos.find((p) => p.id === pedidoId);
    if (pedido) {
      setSelectedPedido(pedido);
      form.setValue("cliente_nome", pedido.cliente_nome);
      form.setValue("cliente_documento", pedido.cliente_documento || "");
      const { data: itens } = await supabase
        .from("pedido_itens")
        .select("id, produto_nome, quantidade, unidades_por_frasco, formula_id")
        .eq("pedido_id", pedidoId)
        .order("ordem");
      if (itens && itens.length > 0) {
        setPedidoItens(itens as PedidoItem[]);
        const primeiroItem = itens[0];
        form.setValue("produto_nome", primeiroItem.produto_nome);
        form.setValue("quantidade_frascos", primeiroItem.quantidade);
        form.setValue("unidades_por_frasco", primeiroItem.unidades_por_frasco || 60);
        if (primeiroItem.formula_id) {
          form.setValue("formula_id", primeiroItem.formula_id);
          const formula = formulas.find(f => f.id === primeiroItem.formula_id);
          if (formula) {
            setSelectedFormula(formula);
            form.setValue("tipo_capsula", formula.tipo_capsula || "00");
            form.setValue("excipiente_base", (formula.excipiente_padrao as "AMIDO" | "CELULOSE" | "PRE_BLEND") || "AMIDO");
          }
        }
      }
    } else {
      setSelectedPedido(null);
      setPedidoItens([]);
    }
  };

  const podeAvancar = (): boolean => {
    switch (etapaAtual) {
      case 1:
        if (tipoOP === "BASEADA_FORMULA" && !form.watch("formula_id")) return false;
        if (tipoOP === "BASEADA_PEDIDO" && !form.watch("pedido_id")) return false;
        return true;
      case 2:
        return !!form.watch("produto_nome") && quantidadeFrascos > 0 && unidadesPorFrasco > 0;
      case 3:
        return !!form.watch("lote_produto_acabado") && !!dataFab && !!form.watch("data_validade");
      case 4:
        return !!form.watch("responsavel_producao_nome") && !!form.watch("responsavel_tecnico_id");
      default:
        return false;
    }
  };

  const avancar = () => { if (etapaAtual < 4 && podeAvancar()) setEtapaAtual((e) => (e + 1) as EtapaWizard); };
  const voltar = () => { if (etapaAtual > 1) setEtapaAtual((e) => (e - 1) as EtapaWizard); };

  // ============ SUBMIT ============
  const onSubmit = async (values: FormValues) => {
    if (bateladaStatus === 'bloqueado') {
      toast.error('Peso por batelada acima do máximo do misturador. Reduza a quantidade ou divida em múltiplas OPs.');
      return;
    }
    setIsLoading(true);
    try {
      const ano = new Date().getFullYear();
      const { data: lastOP } = await supabase
        .from("ordens_producao_industrial")
        .select("codigo")
        .ilike("codigo", `OP-${ano}-%`)
        .order("codigo", { ascending: false })
        .limit(1);
      let sequencia = 1;
      if (lastOP && lastOP.length > 0) {
        const partes = lastOP[0].codigo.split("-");
        sequencia = parseInt(partes[2] || "0", 10) + 1;
      }
      const codigo = `OP-${ano}-${String(sequencia).padStart(5, "0")}`;

      let rtData: { rt_nome?: string; rt_tipo_conselho?: string; rt_numero_registro?: string; rt_uf_conselho?: string } = {};
      if (values.responsavel_tecnico_id) {
        const { data: rt } = await supabase
          .from("responsaveis_tecnicos")
          .select("nome_completo, tipo_conselho, numero_registro, uf_conselho")
          .eq("id", values.responsavel_tecnico_id)
          .single();
        if (rt) {
          rtData = { rt_nome: rt.nome_completo, rt_tipo_conselho: rt.tipo_conselho, rt_numero_registro: rt.numero_registro, rt_uf_conselho: rt.uf_conselho };
        }
      }

      const opData = {
        codigo,
        produto_nome: values.produto_nome,
        formula_id: values.formula_id || null,
        formula_codigo: selectedFormula?.codigo_formula || null,
        formula_versao: selectedFormula ? 1 : null,
        quantidade_frascos: values.quantidade_frascos,
        capsulas_por_frasco: values.unidades_por_frasco,
        total_capsulas: totalUnidades,
        acrescimo_percentual: ACRESCIMO_INDUSTRIAL,
        total_capsulas_com_acrescimo: totalComAcrescimo,
        lote_produto_acabado: values.lote_produto_acabado,
        data_fabricacao: format(values.data_fabricacao, "yyyy-MM-dd"),
        data_validade: format(values.data_validade, "yyyy-MM-dd"),
        tipo_apresentacao: values.tipo_produto,
        peso_capsula_mg: PESO_CAPSULA_NOMINAL,
        tipo_capsula: values.tipo_capsula || "00",
        excipiente_base: values.excipiente_base,
        status: "PLANEJADA",
        responsavel_producao_nome: values.responsavel_producao_nome,
        responsavel_tecnico_id: values.responsavel_tecnico_id,
        rt_nome: rtData.rt_nome || null,
        rt_tipo_conselho: rtData.rt_tipo_conselho as 'CRF' | 'CRN' | 'CRQ' | null || null,
        rt_numero_registro: rtData.rt_numero_registro || null,
        rt_uf_conselho: rtData.rt_uf_conselho || null,
        rt_vinculado_em: new Date().toISOString(),
        observacoes: values.observacoes || null,
        cliente_id: values.cliente_id || null,
        cliente_nome: values.cliente_nome || null,
        white_label: values.tipo_op === "WHITE_LABEL",
        capsula_item_id: values.capsula_item_source === "supabase" ? (values.capsula_item_id || null) : null,
        capsula_item_nome: values.capsula_item_nome || null,
        pote_item_id: values.pote_item_source === "supabase" ? (values.pote_item_id || null) : null,
        pote_item_nome: values.pote_item_nome || null,
        tampa_item_id: values.tampa_item_source === "supabase" ? (values.tampa_item_id || null) : null,
        tampa_item_nome: values.tampa_item_nome || null,
        silica_item_id: values.silica_item_source === "supabase" ? (values.silica_item_id || null) : null,
        silica_item_nome: values.silica_item_nome || null,
        incluir_silica: values.incluir_silica,
        descricao_rotulo: values.descricao_rotulo || null,
        peso_total_mistura_kg: pesoTotalMisturaKg,
        numero_bateladas: numeroBateladas,
        peso_por_batelada_kg: pesoPorBatelada,
        alerta_batelada: bateladaAlerta,
        volume_total_po_l: volumeTotalPoL,
        volume_por_batelada_l: volumePorBatelada,
        fator_enchimento_real: fatorEnchimentoReal,
      };

      const { data: newOP, error } = await supabase
        .from("ordens_producao_industrial")
        .insert([opData])
        .select()
        .single();
      if (error) throw error;

      if (values.formula_id && newOP) {
        await criarMateriasPrimasDaFormula(newOP.id, values.formula_id, totalComAcrescimo, values.excipiente_base);
      } else if (newOP) {
        await criarExcipientesTecnologicosPadrao(newOP.id, totalComAcrescimo);
      }

      if (newOP) {
        await criarChecklistPadrao(newOP.id);
        await criarControlePerdas(newOP.id, totalUnidades);
        try {
          await supabase.rpc('baixar_estoque_op_embalagens', { p_op_id: newOP.id });
          await supabase.rpc('baixar_estoque_op_materias_primas', { p_op_id: newOP.id });
        } catch (err) {
          console.warn('Baixa de estoque não realizada:', err);
        }
      }

      toast.success(`OP ${codigo} criada com sucesso!`, {
        description: tipoOP === "MANUAL" ? "OP Manual" : `Baseada em ${selectedFormula?.codigo_formula}`,
      });
      onSuccess();
      onOpenChange(false);
      if (newOP?.id) navigate(`/producao/ordens/${newOP.id}`);
    } catch (error) {
      console.error("Erro ao criar OP:", error);
      toast.error("Erro ao criar ordem de produção");
    } finally {
      setIsLoading(false);
    }
  };

  return {
    form, etapaAtual, formulas, pedidos, clientes, clienteSearch, setClienteSearch,
    selectedFormula, selectedPedido, selectedCliente, pedidoItens,
    isLoading, showClienteDropdown, setShowClienteDropdown,
    showQuickClienteModal, setShowQuickClienteModal,
    tipoOP, tipoProduto, quantidadeFrascos, unidadesPorFrasco,
    totalUnidades, totalComAcrescimo, dataFab,
    pesoTotalMisturaKg, numeroBateladas, pesoPorBatelada, bateladaStatus, bateladaAlerta,
    volumeTotalPoL,
    volumePorBatelada,
    fatorEnchimentoReal,
    nomeMisturador,
    VOLUME_UTIL_MAX_L,
    VOLUME_UTIL_MIN_L,
    handleClienteSelect, handleQuickClienteCreated, handleFormulaChange, handlePedidoChange,
    podeAvancar, avancar, voltar, onSubmit,
    progressoEtapas: (etapaAtual / 4) * 100,
  };
}

// ============================================================
// FUNÇÕES AUXILIARES DE CRIAÇÃO (DB)
// ============================================================

async function criarMateriasPrimasDaFormula(opId: string, formulaId: string, totalCaps: number, excipienteBase: string) {
  try {
    const { data: itens } = await supabase
      .from("formula_itens")
      .select("*")
      .eq("formula_id", formulaId)
      .order("ordem_mistura", { ascending: true });
    if (!itens || itens.length === 0) return;

    let ordemMistura = 1;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const materiasData: any[] = [];

    for (const item of itens) {
      const qTotalMg = item.quantidade_convertida_mg * totalCaps;
      const qTotalG = qTotalMg / 1000;
      const critico = item.ativo_critico || item.quantidade_convertida_mg < 1 ||
                     item.unidade_informada === "UI" || item.unidade_informada === "MCG";
      const tolerancia = 10;
      let motivoCritico: string | undefined;
      if (item.quantidade_convertida_mg < 1) motivoCritico = "Quantidade < 1mg";
      else if (item.unidade_informada === "UI") motivoCritico = "Unidade UI";
      else if (item.unidade_informada === "MCG") motivoCritico = "Unidade mcg";

      materiasData.push({
        op_id: opId, insumo_id: item.produto_materia_prima_id || undefined,
        insumo_nome: item.nome_insumo, categoria: "ATIVO",
        quantidade_teorica_mg: qTotalMg, quantidade_teorica_g: qTotalG, unidade: "g",
        pesagem_critica: critico, motivo_critico: motivoCritico,
        tolerancia_percentual: tolerancia,
        quantidade_minima_g: qTotalG * 0.9, quantidade_maxima_g: qTotalG * 1.1,
        ordem_mistura: ordemMistura++,
      });
    }

    const totalAtivosMg = itens.reduce((sum, i) => sum + i.quantidade_convertida_mg, 0);
    const totalTecnologicosMg = PESO_CAPSULA_ALVO * (
      EXCIPIENTES_TECNOLOGICOS.DIOXIDO_SILICIO.percentual +
      EXCIPIENTES_TECNOLOGICOS.TALCO.percentual +
      EXCIPIENTES_TECNOLOGICOS.ESTEARATO.percentual
    ) / 100;
    const excipienteBaseMg = PESO_CAPSULA_ALVO - totalAtivosMg - totalTecnologicosMg;

    const nomeBase = excipienteBase === "AMIDO" ? "Amido de Milho" :
                     excipienteBase === "CELULOSE" ? "Celulose Microcristalina" : "Pré-blend Industrial";
    const qspG = (excipienteBaseMg * totalCaps) / 1000;
    materiasData.push({
      op_id: opId, insumo_nome: `${nomeBase} (Q.S.P.)`, categoria: "EXCIPIENTE_BASE",
      quantidade_teorica_mg: excipienteBaseMg * totalCaps, quantidade_teorica_g: qspG, unidade: "g",
      pesagem_critica: false, tolerancia_percentual: 10,
      quantidade_minima_g: qspG * 0.9, quantidade_maxima_g: qspG * 1.1,
      ordem_mistura: ordemMistura++,
    });

    // Excipientes tecnológicos
    const addTecnologico = (nome: string, percentual: number) => {
      const mg = PESO_CAPSULA_ALVO * (percentual / 100);
      const g = (mg * totalCaps) / 1000;
      materiasData.push({
        op_id: opId, insumo_nome: nome, categoria: "EXCIPIENTE_TECNOLOGICO",
        quantidade_teorica_mg: mg * totalCaps, quantidade_teorica_g: g, unidade: "g",
        pesagem_critica: false, tolerancia_percentual: 10,
        quantidade_minima_g: g * 0.9, quantidade_maxima_g: g * 1.1,
        ordem_mistura: ordemMistura++,
      });
    };
    addTecnologico(EXCIPIENTES_TECNOLOGICOS.DIOXIDO_SILICIO.nome, EXCIPIENTES_TECNOLOGICOS.DIOXIDO_SILICIO.percentual);
    addTecnologico(EXCIPIENTES_TECNOLOGICOS.TALCO.nome, EXCIPIENTES_TECNOLOGICOS.TALCO.percentual);
    addTecnologico(EXCIPIENTES_TECNOLOGICOS.ESTEARATO.nome, EXCIPIENTES_TECNOLOGICOS.ESTEARATO.percentual);

    await supabase.from("op_materias_primas").insert(materiasData);

    // Create critical weighings
    const criticos = materiasData.filter((m) => m.pesagem_critica);
    if (criticos.length > 0) {
      const { data: mps } = await supabase
        .from("op_materias_primas")
        .select("id, insumo_nome, quantidade_teorica_mg")
        .eq("op_id", opId)
        .eq("pesagem_critica", true);
      if (mps) {
        await supabase.from("op_pesagens_criticas").insert(
          mps.map((mp) => ({ op_id: opId, materia_prima_id: mp.id, insumo_nome: mp.insumo_nome, quantidade_teorica_mg: mp.quantidade_teorica_mg, status: "PENDENTE" }))
        );
      }
    }
  } catch (error) {
    console.error("Erro ao criar matérias-primas:", error);
  }
}

async function criarExcipientesTecnologicosPadrao(opId: string, totalCaps: number) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const materiasData: any[] = [];
  let ordemMistura = 1;
  const add = (nome: string, pct: number) => {
    const mg = PESO_CAPSULA_ALVO * (pct / 100);
    const g = (mg * totalCaps) / 1000;
    materiasData.push({
      op_id: opId, insumo_nome: nome, categoria: "EXCIPIENTE_TECNOLOGICO",
      quantidade_teorica_mg: mg * totalCaps, quantidade_teorica_g: g, unidade: "g",
      pesagem_critica: false, tolerancia_percentual: 10,
      quantidade_minima_g: g * 0.9, quantidade_maxima_g: g * 1.1,
      ordem_mistura: ordemMistura++,
    });
  };
  add(EXCIPIENTES_TECNOLOGICOS.DIOXIDO_SILICIO.nome, EXCIPIENTES_TECNOLOGICOS.DIOXIDO_SILICIO.percentual);
  add(EXCIPIENTES_TECNOLOGICOS.TALCO.nome, EXCIPIENTES_TECNOLOGICOS.TALCO.percentual);
  add(EXCIPIENTES_TECNOLOGICOS.ESTEARATO.nome, EXCIPIENTES_TECNOLOGICOS.ESTEARATO.percentual);
  await supabase.from("op_materias_primas").insert(materiasData);
}

async function criarChecklistPadrao(opId: string) {
  const items = [
    { item: "Conferência de lotes das matérias-primas", categoria: "PRE_PRODUCAO", ordem: 1, obrigatorio: true },
    { item: "Verificação de validade de todos os insumos", categoria: "PRE_PRODUCAO", ordem: 2, obrigatorio: true },
    { item: "Limpeza e sanitização da área de pesagem", categoria: "PRE_PRODUCAO", ordem: 3, obrigatorio: true },
    { item: "Calibração da balança conferida", categoria: "PRE_PRODUCAO", ordem: 4, obrigatorio: true },
    { item: "Utensílios de pesagem limpos e identificados", categoria: "PRE_PRODUCAO", ordem: 5, obrigatorio: true },
    { item: "Pesagem de ativos críticos com dupla conferência", categoria: "DURANTE_PRODUCAO", ordem: 1, obrigatorio: true },
    { item: "Conferência de pesos dentro da tolerância (±10%)", categoria: "DURANTE_PRODUCAO", ordem: 2, obrigatorio: true },
    { item: "Ordem de mistura seguida corretamente", categoria: "DURANTE_PRODUCAO", ordem: 3, obrigatorio: true },
    { item: "Tempo de homogeneização respeitado", categoria: "DURANTE_PRODUCAO", ordem: 4, obrigatorio: true },
    { item: "Limpeza de equipamentos entre etapas", categoria: "DURANTE_PRODUCAO", ordem: 5, obrigatorio: true },
    { item: "Ajuste da encapsuladora realizado", categoria: "DURANTE_PRODUCAO", ordem: 6, obrigatorio: true },
    { item: "Contagem final de unidades produzidas", categoria: "POS_PRODUCAO", ordem: 1, obrigatorio: true },
    { item: "Registro de perdas justificado", categoria: "POS_PRODUCAO", ordem: 2, obrigatorio: true },
    { item: "Liberação do lote", categoria: "POS_PRODUCAO", ordem: 3, obrigatorio: true },
    { item: "Limpeza final da área", categoria: "POS_PRODUCAO", ordem: 4, obrigatorio: true },
    { item: "Teste de peso médio realizado", categoria: "QC", ordem: 1, obrigatorio: true },
    { item: "Avaliação de aparência do pó", categoria: "QC", ordem: 2, obrigatorio: true },
    { item: "Avaliação de fluidez do pó", categoria: "QC", ordem: 3, obrigatorio: true },
    { item: "Avaliação de homogeneidade", categoria: "QC", ordem: 4, obrigatorio: true },
  ];
  await supabase.from("op_checklist").insert(items.map(i => ({ op_id: opId, ...i, verificado: false })));
}

async function criarControlePerdas(opId: string, quantidadePlanejada: number) {
  await supabase.from("op_controle_perdas").insert({
    op_id: opId,
    quantidade_planejada: quantidadePlanejada,
    acrescimo_percentual: ACRESCIMO_INDUSTRIAL,
    quantidade_com_acrescimo: Math.ceil(quantidadePlanejada * (1 + ACRESCIMO_INDUSTRIAL / 100)),
  });
}
