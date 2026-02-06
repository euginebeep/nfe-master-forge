// ============================================================
// MOTOR OP MASTER - DIÁLOGO DE CRIAÇÃO COMPLETO
// Sistema Industrial ANVISA com todas as 8 etapas
// ============================================================

import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  CalendarIcon, Package, FlaskConical, User, Hash, Calculator, 
  AlertTriangle, UserCheck, Beaker, Scale, Factory, ChevronRight,
  ChevronLeft, Check, FileText, Search, Plus, Building2
} from "lucide-react";
import { format, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { RTSelectorOP } from "@/components/responsavel-tecnico/RTSelectorOP";
import { QuickClienteModal } from "@/components/entidades/QuickClienteModal";
import { LocalDb } from "@/lib/local-db";
import type { LocalEntidade } from "@/hooks/use-local-entidades";

// Tipos de entidade para busca de clientes
interface EntidadeCliente {
  id: string;
  razao_social: string;
  nome_fantasia?: string;
  documento: string;
  source?: "supabase" | "local";
}

// ============================================================
// TIPOS
// ============================================================

type TipoOP = "MANUAL" | "BASEADA_FORMULA" | "BASEADA_PEDIDO";
type TipoProduto = "CAPSULA" | "LIQUIDO" | "PO";
type EtapaWizard = 1 | 2 | 3 | 4;

interface Formula {
  id: string;
  codigo_formula: string;
  nome_formula: string;
  status: string;
  tipo_capsula?: string;
  excipiente_padrao?: string;
  peso_capsula_alvo_mg?: number;
  tipo_apresentacao?: string;
}

interface PedidoVenda {
  id: string;
  codigo: string;
  cliente_nome: string;
  cliente_documento?: string;
  cliente_id?: string;
  valor_total: number;
  status: string;
}

interface PedidoItem {
  id: string;
  produto_nome: string;
  quantidade: number;
  unidades_por_frasco: number;
  formula_id?: string;
}

interface CriarOPDialogMasterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

// ============================================================
// SCHEMA DE VALIDAÇÃO
// ============================================================

const formSchema = z.object({
  // Etapa 1: Tipo de OP
  tipo_op: z.enum(["MANUAL", "BASEADA_FORMULA", "BASEADA_PEDIDO"]),
  formula_id: z.string().optional(),
  pedido_id: z.string().optional(),
  cliente_id: z.string().optional(),
  cliente_nome: z.string().optional(),
  cliente_documento: z.string().optional(),
  
  // Etapa 2: Dados Produtivos
  produto_nome: z.string().min(1, "Nome do produto é obrigatório"),
  tipo_produto: z.enum(["CAPSULA", "LIQUIDO", "PO"]),
  quantidade_frascos: z.number().min(1, "Mínimo 1 frasco"),
  unidades_por_frasco: z.number().min(1, "Mínimo 1 unidade por frasco"),
  
  // Especificações de Embalagem
  cor_capsula: z.string().optional(),
  cor_tampa: z.string().optional(),
  tipo_pote: z.string().optional(),
  tipo_tampa: z.string().optional(),
  incluir_silica: z.boolean().default(true),
  quantidade_silica_sache: z.string().default("1g"),
  descricao_rotulo: z.string().optional(),
  
  // Etapa 3: Lote e Rastreabilidade
  lote_produto_acabado: z.string().min(1, "Lote é obrigatório"),
  data_fabricacao: z.date({ required_error: "Data de fabricação é obrigatória" }),
  data_validade: z.date({ required_error: "Data de validade é obrigatória" }),
  
  // Etapa 4: Configuração Técnica + RT
  tipo_capsula: z.string().optional(),
  excipiente_base: z.enum(["AMIDO", "CELULOSE", "PRE_BLEND"]),
  responsavel_producao_nome: z.string().min(1, "Responsável é obrigatório"),
  responsavel_tecnico_id: z.string().min(1, "Responsável Técnico é obrigatório"),
  observacoes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

// ============================================================
// CONSTANTES INDUSTRIAIS
// ============================================================

const EXCIPIENTES_TECNOLOGICOS = {
  DIOXIDO_SILICIO: { nome: "Dióxido de Silício", percentual: 2.0, ordem: 4 },
  TALCO: { nome: "Talco Farmacêutico", percentual: 5.0, ordem: 5 },
  ESTEARATO: { nome: "Estearato de Magnésio", percentual: 2.5, ordem: 6 },
};

const PESO_CAPSULA_NOMINAL = 500; // mg
const PESO_CAPSULA_ALVO = 490; // mg (margem segurança)
const ACRESCIMO_INDUSTRIAL = 5; // %

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

export function CriarOPDialogMaster({
  open,
  onOpenChange,
  onSuccess,
}: CriarOPDialogMasterProps) {
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
      cor_capsula: "",
      cor_tampa: "",
      tipo_pote: "",
      tipo_tampa: "",
      incluir_silica: true,
      quantidade_silica_sache: "1g",
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

  // Cálculos automáticos
  const totalUnidades = quantidadeFrascos * unidadesPorFrasco;
  const totalComAcrescimo = Math.ceil(totalUnidades * (1 + ACRESCIMO_INDUSTRIAL / 100));

  // Carregar fórmulas aprovadas e pedidos confirmados
  useEffect(() => {
    if (open) {
      const fetchFormulas = async () => {
        const { data } = await supabase
          .from("formulas")
          .select("id, codigo_formula, nome_formula, status, tipo_capsula, excipiente_padrao, peso_capsula_alvo_mg, tipo_apresentacao")
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
    }
  }, [open, form]);

  // Buscar clientes quando o usuário digita (Supabase + LocalDb)
  useEffect(() => {
    const buscarClientes = async () => {
      if (clienteSearch.length < 2) {
        setClientes([]);
        return;
      }
      
      const searchLower = clienteSearch.toLowerCase();
      
      // Buscar no Supabase
      const { data: supabaseData } = await supabase
        .from("entidades")
        .select("id, razao_social, nome_fantasia, documento")
        .or(`razao_social.ilike.%${clienteSearch}%,nome_fantasia.ilike.%${clienteSearch}%,documento.ilike.%${clienteSearch}%`)
        .eq("status", "ATIVO")
        .limit(10);
      
      const supabaseClientes: EntidadeCliente[] = (supabaseData || []).map(c => ({
        ...c,
        nome_fantasia: c.nome_fantasia || undefined,
        source: "supabase" as const,
      }));
      
      // Buscar no LocalDb
      const localEntidades = LocalDb.query<LocalEntidade>("entidades", (e) => {
        if (e.status !== "ATIVO") return false;
        const matchRazao = e.razao_social?.toLowerCase().includes(searchLower);
        const matchFantasia = e.nome_fantasia?.toLowerCase().includes(searchLower);
        const matchDoc = e.documento?.includes(clienteSearch.replace(/\D/g, ""));
        return matchRazao || matchFantasia || matchDoc;
      });
      
      const localClientes: EntidadeCliente[] = localEntidades
        .filter(l => !supabaseClientes.find(s => s.id === l.id)) // Evitar duplicados
        .slice(0, 10)
        .map(l => ({
          id: l.id,
          razao_social: l.razao_social,
          nome_fantasia: l.nome_fantasia,
          documento: l.documento,
          source: "local" as const,
        }));
      
      setClientes([...supabaseClientes, ...localClientes]);
      setShowClienteDropdown(true);
    };

    const debounce = setTimeout(buscarClientes, 300);
    return () => clearTimeout(debounce);
  }, [clienteSearch]);

  // Quando seleciona um cliente
  const handleClienteSelect = (cliente: EntidadeCliente) => {
    setSelectedCliente(cliente);
    form.setValue("cliente_id", cliente.id);
    form.setValue("cliente_nome", cliente.nome_fantasia || cliente.razao_social);
    form.setValue("cliente_documento", cliente.documento);
    setClienteSearch(cliente.nome_fantasia || cliente.razao_social);
    setShowClienteDropdown(false);
  };

  // Quando cadastra um cliente pelo modal rápido
  const handleQuickClienteCreated = (cliente: { id: string; razao_social: string; nome_fantasia?: string; documento: string }) => {
    handleClienteSelect({
      ...cliente,
      source: "supabase",
    });
  };

  // Gerar lote automático quando data de fabricação muda
  useEffect(() => {
    if (dataFab) {
      const ano = String(dataFab.getFullYear()).slice(-2);
      const mes = String(dataFab.getMonth() + 1).padStart(2, "0");
      const dia = String(dataFab.getDate()).padStart(2, "0");
      const seq = String(Math.floor(Math.random() * 900) + 100);
      const loteGerado = `${ano}${mes}${dia}-${seq}`;
      form.setValue("lote_produto_acabado", loteGerado);
      form.setValue("data_validade", addMonths(dataFab, 24));
    }
  }, [dataFab, form]);

  // Quando seleciona fórmula
  const handleFormulaChange = (formulaId: string) => {
    form.setValue("formula_id", formulaId);
    const formula = formulas.find((f) => f.id === formulaId);
    if (formula) {
      setSelectedFormula(formula);
      form.setValue("produto_nome", formula.nome_formula);
      form.setValue("tipo_capsula", formula.tipo_capsula || "00");
      form.setValue("excipiente_base", (formula.excipiente_padrao as "AMIDO" | "CELULOSE" | "PRE_BLEND") || "AMIDO");
      if (formula.tipo_apresentacao) {
        form.setValue("tipo_produto", formula.tipo_apresentacao as TipoProduto);
      }
    } else {
      setSelectedFormula(null);
    }
  };

  // Quando seleciona pedido
  const handlePedidoChange = async (pedidoId: string) => {
    form.setValue("pedido_id", pedidoId);
    const pedido = pedidos.find((p) => p.id === pedidoId);
    if (pedido) {
      setSelectedPedido(pedido);
      form.setValue("cliente_nome", pedido.cliente_nome);
      form.setValue("cliente_documento", pedido.cliente_documento || "");
      
      // Buscar itens do pedido
      const { data: itens } = await supabase
        .from("pedido_itens")
        .select("id, produto_nome, quantidade, unidades_por_frasco, formula_id")
        .eq("pedido_id", pedidoId)
        .order("ordem");
      
      if (itens && itens.length > 0) {
        setPedidoItens(itens as PedidoItem[]);
        // Preencher dados do primeiro item
        const primeiroItem = itens[0];
        form.setValue("produto_nome", primeiroItem.produto_nome);
        form.setValue("quantidade_frascos", primeiroItem.quantidade);
        form.setValue("unidades_por_frasco", primeiroItem.unidades_por_frasco || 60);
        
        // Se o item tem fórmula vinculada, buscar
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

  // Navegação do wizard
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

  const avancar = () => {
    if (etapaAtual < 4 && podeAvancar()) {
      setEtapaAtual((e) => (e + 1) as EtapaWizard);
    }
  };

  const voltar = () => {
    if (etapaAtual > 1) {
      setEtapaAtual((e) => (e - 1) as EtapaWizard);
    }
  };

  // Submeter OP
  const onSubmit = async (values: FormValues) => {
    setIsLoading(true);
    try {
      // Gerar próximo código
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

      // Buscar dados do RT
      let rtData: {
        rt_nome?: string;
        rt_tipo_conselho?: string;
        rt_numero_registro?: string;
        rt_uf_conselho?: string;
      } = {};
      
      if (values.responsavel_tecnico_id) {
        const { data: rt } = await supabase
          .from("responsaveis_tecnicos")
          .select("nome_completo, tipo_conselho, numero_registro, uf_conselho")
          .eq("id", values.responsavel_tecnico_id)
          .single();
        
        if (rt) {
          rtData = {
            rt_nome: rt.nome_completo,
            rt_tipo_conselho: rt.tipo_conselho,
            rt_numero_registro: rt.numero_registro,
            rt_uf_conselho: rt.uf_conselho,
          };
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
        // Cliente
        cliente_id: values.cliente_id || null,
        cliente_nome: values.cliente_nome || null,
        // Embalagem
        cor_capsula: values.cor_capsula || null,
        cor_tampa: values.cor_tampa || null,
        tipo_pote: values.tipo_pote || null,
        tipo_tampa: values.tipo_tampa || null,
        incluir_silica: values.incluir_silica,
        quantidade_silica_sache: values.quantidade_silica_sache || null,
        descricao_rotulo: values.descricao_rotulo || null,
      };

      const { data: newOP, error } = await supabase
        .from("ordens_producao_industrial")
        .insert([opData])
        .select()
        .single();

      if (error) throw error;

      // Criar matérias-primas (se tiver fórmula vinculada)
      if (values.formula_id && newOP) {
        await criarMateriasPrimasDaFormula(newOP.id, values.formula_id, totalComAcrescimo, values.excipiente_base);
      } else if (newOP) {
        // OP Manual: criar apenas excipientes tecnológicos padrão
        await criarExcipientesTecnologicosPadrao(newOP.id, totalComAcrescimo);
      }

      // Criar checklist padrão
      if (newOP) {
        await criarChecklistPadrao(newOP.id);
        await criarControlePerdas(newOP.id, totalUnidades);
        
        // Dar baixa no estoque de embalagens (se houver lotes vinculados)
        try {
          await supabase.rpc('baixar_estoque_op_embalagens', { p_op_id: newOP.id });
          await supabase.rpc('baixar_estoque_op_materias_primas', { p_op_id: newOP.id });
        } catch (err) {
          console.warn('Baixa de estoque não realizada (lotes podem não estar vinculados):', err);
        }
      }

      toast.success(`OP ${codigo} criada com sucesso!`, {
        description: tipoOP === "MANUAL" ? "OP Manual" : `Baseada em ${selectedFormula?.codigo_formula}`,
      });
      
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Erro ao criar OP:", error);
      toast.error("Erro ao criar ordem de produção");
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================================
  // FUNÇÕES AUXILIARES
  // ============================================================

  const criarMateriasPrimasDaFormula = async (
    opId: string,
    formulaId: string,
    totalCaps: number,
    excipienteBase: string
  ) => {
    try {
      const { data: itens } = await supabase
        .from("formula_itens")
        .select("*")
        .eq("formula_id", formulaId)
        .order("ordem_mistura", { ascending: true });

      if (!itens || itens.length === 0) return;

      let ordemMistura = 1;
      const materiasData: Array<{
        op_id: string;
        insumo_id?: string;
        insumo_nome: string;
        categoria: string;
        quantidade_teorica_mg: number;
        quantidade_teorica_g: number;
        unidade: string;
        pesagem_critica: boolean;
        motivo_critico?: string;
        tolerancia_percentual: number;
        quantidade_minima_g: number;
        quantidade_maxima_g: number;
        ordem_mistura: number;
      }> = [];

      // 1. ATIVOS (ordem 1-N)
      for (const item of itens) {
        const qTotalMg = item.quantidade_convertida_mg * totalCaps;
        const qTotalG = qTotalMg / 1000;
        const critico = item.ativo_critico || item.quantidade_convertida_mg < 1 || 
                       item.unidade_informada === "UI" || item.unidade_informada === "MCG";
        const tolerancia = 10;
        const minimo = qTotalG * (1 - tolerancia / 100);
        const maximo = qTotalG * (1 + tolerancia / 100);

        let motivoCritico: string | undefined;
        if (item.quantidade_convertida_mg < 1) motivoCritico = "Quantidade < 1mg";
        else if (item.unidade_informada === "UI") motivoCritico = "Unidade UI";
        else if (item.unidade_informada === "MCG") motivoCritico = "Unidade mcg";

        materiasData.push({
          op_id: opId,
          insumo_id: item.produto_materia_prima_id || undefined,
          insumo_nome: item.nome_insumo,
          categoria: "ATIVO",
          quantidade_teorica_mg: qTotalMg,
          quantidade_teorica_g: qTotalG,
          unidade: "g",
          pesagem_critica: critico,
          motivo_critico: motivoCritico,
          tolerancia_percentual: tolerancia,
          quantidade_minima_g: minimo,
          quantidade_maxima_g: maximo,
          ordem_mistura: ordemMistura++,
        });
      }

      // Calcular totais
      const totalAtivosMg = itens.reduce((sum, i) => sum + i.quantidade_convertida_mg, 0);
      const totalTecnologicosMg = PESO_CAPSULA_ALVO * (
        EXCIPIENTES_TECNOLOGICOS.DIOXIDO_SILICIO.percentual +
        EXCIPIENTES_TECNOLOGICOS.TALCO.percentual +
        EXCIPIENTES_TECNOLOGICOS.ESTEARATO.percentual
      ) / 100;
      const excipienteBaseMg = PESO_CAPSULA_ALVO - totalAtivosMg - totalTecnologicosMg;

      // 2. EXCIPIENTE BASE (Q.S.P.) - ordem fixa
      const qspG = (excipienteBaseMg * totalCaps) / 1000;
      const nomeBase = excipienteBase === "AMIDO" ? "Amido de Milho" : 
                       excipienteBase === "CELULOSE" ? "Celulose Microcristalina" : "Pré-blend Industrial";
      materiasData.push({
        op_id: opId,
        insumo_nome: `${nomeBase} (Q.S.P.)`,
        categoria: "EXCIPIENTE_BASE",
        quantidade_teorica_mg: excipienteBaseMg * totalCaps,
        quantidade_teorica_g: qspG,
        unidade: "g",
        pesagem_critica: false,
        tolerancia_percentual: 10,
        quantidade_minima_g: qspG * 0.9,
        quantidade_maxima_g: qspG * 1.1,
        ordem_mistura: ordemMistura++,
      });

      // 3. DIÓXIDO DE SILÍCIO (2%) - ordem fixa
      const dioxidoMg = PESO_CAPSULA_ALVO * (EXCIPIENTES_TECNOLOGICOS.DIOXIDO_SILICIO.percentual / 100);
      const dioxidoG = (dioxidoMg * totalCaps) / 1000;
      materiasData.push({
        op_id: opId,
        insumo_nome: EXCIPIENTES_TECNOLOGICOS.DIOXIDO_SILICIO.nome,
        categoria: "EXCIPIENTE_TECNOLOGICO",
        quantidade_teorica_mg: dioxidoMg * totalCaps,
        quantidade_teorica_g: dioxidoG,
        unidade: "g",
        pesagem_critica: false,
        tolerancia_percentual: 10,
        quantidade_minima_g: dioxidoG * 0.9,
        quantidade_maxima_g: dioxidoG * 1.1,
        ordem_mistura: ordemMistura++,
      });

      // 4. TALCO FARMACÊUTICO (5%) - ordem fixa
      const talcoMg = PESO_CAPSULA_ALVO * (EXCIPIENTES_TECNOLOGICOS.TALCO.percentual / 100);
      const talcoG = (talcoMg * totalCaps) / 1000;
      materiasData.push({
        op_id: opId,
        insumo_nome: EXCIPIENTES_TECNOLOGICOS.TALCO.nome,
        categoria: "EXCIPIENTE_TECNOLOGICO",
        quantidade_teorica_mg: talcoMg * totalCaps,
        quantidade_teorica_g: talcoG,
        unidade: "g",
        pesagem_critica: false,
        tolerancia_percentual: 10,
        quantidade_minima_g: talcoG * 0.9,
        quantidade_maxima_g: talcoG * 1.1,
        ordem_mistura: ordemMistura++,
      });

      // 5. ESTEARATO DE MAGNÉSIO (2,5%) - SEMPRE ÚLTIMO
      const estearatoMg = PESO_CAPSULA_ALVO * (EXCIPIENTES_TECNOLOGICOS.ESTEARATO.percentual / 100);
      const estearatoG = (estearatoMg * totalCaps) / 1000;
      materiasData.push({
        op_id: opId,
        insumo_nome: EXCIPIENTES_TECNOLOGICOS.ESTEARATO.nome,
        categoria: "EXCIPIENTE_TECNOLOGICO",
        quantidade_teorica_mg: estearatoMg * totalCaps,
        quantidade_teorica_g: estearatoG,
        unidade: "g",
        pesagem_critica: false,
        tolerancia_percentual: 10,
        quantidade_minima_g: estearatoG * 0.9,
        quantidade_maxima_g: estearatoG * 1.1,
        ordem_mistura: ordemMistura++,
      });

      await supabase.from("op_materias_primas").insert(materiasData);

      // Criar pesagens críticas
      const criticos = materiasData.filter((m) => m.pesagem_critica);
      if (criticos.length > 0) {
        const { data: mps } = await supabase
          .from("op_materias_primas")
          .select("id, insumo_nome, quantidade_teorica_mg")
          .eq("op_id", opId)
          .eq("pesagem_critica", true);

        if (mps) {
          const pesagensCriticas = mps.map((mp) => ({
            op_id: opId,
            materia_prima_id: mp.id,
            insumo_nome: mp.insumo_nome,
            quantidade_teorica_mg: mp.quantidade_teorica_mg,
            status: "PENDENTE",
          }));
          await supabase.from("op_pesagens_criticas").insert(pesagensCriticas);
        }
      }
    } catch (error) {
      console.error("Erro ao criar matérias-primas:", error);
    }
  };

  const criarExcipientesTecnologicosPadrao = async (opId: string, totalCaps: number) => {
    const materiasData = [];
    let ordemMistura = 1;

    // Dióxido de Silício
    const dioxidoMg = PESO_CAPSULA_ALVO * (EXCIPIENTES_TECNOLOGICOS.DIOXIDO_SILICIO.percentual / 100);
    const dioxidoG = (dioxidoMg * totalCaps) / 1000;
    materiasData.push({
      op_id: opId,
      insumo_nome: EXCIPIENTES_TECNOLOGICOS.DIOXIDO_SILICIO.nome,
      categoria: "EXCIPIENTE_TECNOLOGICO",
      quantidade_teorica_mg: dioxidoMg * totalCaps,
      quantidade_teorica_g: dioxidoG,
      unidade: "g",
      pesagem_critica: false,
      tolerancia_percentual: 10,
      quantidade_minima_g: dioxidoG * 0.9,
      quantidade_maxima_g: dioxidoG * 1.1,
      ordem_mistura: ordemMistura++,
    });

    // Talco
    const talcoMg = PESO_CAPSULA_ALVO * (EXCIPIENTES_TECNOLOGICOS.TALCO.percentual / 100);
    const talcoG = (talcoMg * totalCaps) / 1000;
    materiasData.push({
      op_id: opId,
      insumo_nome: EXCIPIENTES_TECNOLOGICOS.TALCO.nome,
      categoria: "EXCIPIENTE_TECNOLOGICO",
      quantidade_teorica_mg: talcoMg * totalCaps,
      quantidade_teorica_g: talcoG,
      unidade: "g",
      pesagem_critica: false,
      tolerancia_percentual: 10,
      quantidade_minima_g: talcoG * 0.9,
      quantidade_maxima_g: talcoG * 1.1,
      ordem_mistura: ordemMistura++,
    });

    // Estearato
    const estearatoMg = PESO_CAPSULA_ALVO * (EXCIPIENTES_TECNOLOGICOS.ESTEARATO.percentual / 100);
    const estearatoG = (estearatoMg * totalCaps) / 1000;
    materiasData.push({
      op_id: opId,
      insumo_nome: EXCIPIENTES_TECNOLOGICOS.ESTEARATO.nome,
      categoria: "EXCIPIENTE_TECNOLOGICO",
      quantidade_teorica_mg: estearatoMg * totalCaps,
      quantidade_teorica_g: estearatoG,
      unidade: "g",
      pesagem_critica: false,
      tolerancia_percentual: 10,
      quantidade_minima_g: estearatoG * 0.9,
      quantidade_maxima_g: estearatoG * 1.1,
      ordem_mistura: ordemMistura++,
    });

    await supabase.from("op_materias_primas").insert(materiasData);
  };

  const criarChecklistPadrao = async (opId: string) => {
    const checklistItems = [
      // PRE_PRODUCAO
      { item: "Conferência de lotes das matérias-primas", categoria: "PRE_PRODUCAO", ordem: 1, obrigatorio: true },
      { item: "Verificação de validade de todos os insumos", categoria: "PRE_PRODUCAO", ordem: 2, obrigatorio: true },
      { item: "Limpeza e sanitização da área de pesagem", categoria: "PRE_PRODUCAO", ordem: 3, obrigatorio: true },
      { item: "Calibração da balança conferida", categoria: "PRE_PRODUCAO", ordem: 4, obrigatorio: true },
      { item: "Utensílios de pesagem limpos e identificados", categoria: "PRE_PRODUCAO", ordem: 5, obrigatorio: true },
      // DURANTE_PRODUCAO
      { item: "Pesagem de ativos críticos com dupla conferência", categoria: "DURANTE_PRODUCAO", ordem: 1, obrigatorio: true },
      { item: "Conferência de pesos dentro da tolerância (±10%)", categoria: "DURANTE_PRODUCAO", ordem: 2, obrigatorio: true },
      { item: "Ordem de mistura seguida corretamente", categoria: "DURANTE_PRODUCAO", ordem: 3, obrigatorio: true },
      { item: "Tempo de homogeneização respeitado", categoria: "DURANTE_PRODUCAO", ordem: 4, obrigatorio: true },
      { item: "Limpeza de equipamentos entre etapas", categoria: "DURANTE_PRODUCAO", ordem: 5, obrigatorio: true },
      { item: "Ajuste da encapsuladora realizado", categoria: "DURANTE_PRODUCAO", ordem: 6, obrigatorio: true },
      // POS_PRODUCAO
      { item: "Contagem final de unidades produzidas", categoria: "POS_PRODUCAO", ordem: 1, obrigatorio: true },
      { item: "Registro de perdas justificado", categoria: "POS_PRODUCAO", ordem: 2, obrigatorio: true },
      { item: "Liberação do lote", categoria: "POS_PRODUCAO", ordem: 3, obrigatorio: true },
      { item: "Limpeza final da área", categoria: "POS_PRODUCAO", ordem: 4, obrigatorio: true },
      // QC
      { item: "Teste de peso médio realizado", categoria: "QC", ordem: 1, obrigatorio: true },
      { item: "Avaliação de aparência do pó", categoria: "QC", ordem: 2, obrigatorio: true },
      { item: "Avaliação de fluidez do pó", categoria: "QC", ordem: 3, obrigatorio: true },
      { item: "Avaliação de homogeneidade", categoria: "QC", ordem: 4, obrigatorio: true },
    ];

    const checklistData = checklistItems.map((item) => ({
      op_id: opId,
      ...item,
      verificado: false,
    }));

    await supabase.from("op_checklist").insert(checklistData);
  };

  const criarControlePerdas = async (opId: string, quantidadePlanejada: number) => {
    await supabase.from("op_controle_perdas").insert({
      op_id: opId,
      quantidade_planejada: quantidadePlanejada,
      acrescimo_percentual: ACRESCIMO_INDUSTRIAL,
      quantidade_com_acrescimo: Math.ceil(quantidadePlanejada * (1 + ACRESCIMO_INDUSTRIAL / 100)),
    });
  };

  // ============================================================
  // RENDERIZAÇÃO
  // ============================================================

  const progressoEtapas = (etapaAtual / 4) * 100;

  const renderEtapa1 = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <Factory className="h-12 w-12 mx-auto text-primary mb-2" />
        <h3 className="text-lg font-semibold">Tipo de Ordem de Produção</h3>
        <p className="text-sm text-muted-foreground">
          Escolha se deseja criar uma OP manual ou baseada em fórmula aprovada
        </p>
      </div>

      <FormField
        control={form.control}
        name="tipo_op"
        render={({ field }) => (
          <FormItem className="space-y-4">
            <FormControl>
              <RadioGroup
                value={field.value}
                onValueChange={field.onChange}
                className="grid grid-cols-3 gap-4"
              >
                <div>
                  <RadioGroupItem value="MANUAL" id="manual" className="peer sr-only" />
                  <Label
                    htmlFor="manual"
                    className={cn(
                      "flex flex-col items-center justify-between rounded-lg border-2 p-4 cursor-pointer",
                      "hover:bg-accent hover:text-accent-foreground",
                      field.value === "MANUAL" ? "border-primary bg-primary/5" : "border-muted"
                    )}
                  >
                    <FileText className="h-8 w-8 mb-2" />
                    <span className="font-semibold">OP Manual</span>
                    <span className="text-xs text-muted-foreground text-center mt-1">
                      Definir ativos e quantidades manualmente
                    </span>
                  </Label>
                </div>

                <div>
                  <RadioGroupItem value="BASEADA_FORMULA" id="formula" className="peer sr-only" />
                  <Label
                    htmlFor="formula"
                    className={cn(
                      "flex flex-col items-center justify-between rounded-lg border-2 p-4 cursor-pointer",
                      "hover:bg-accent hover:text-accent-foreground",
                      field.value === "BASEADA_FORMULA" ? "border-primary bg-primary/5" : "border-muted"
                    )}
                  >
                    <FlaskConical className="h-8 w-8 mb-2" />
                    <span className="font-semibold">Baseada em Fórmula</span>
                    <span className="text-xs text-muted-foreground text-center mt-1">
                      Usar fórmula aprovada como base
                    </span>
                  </Label>
                </div>

                <div>
                  <RadioGroupItem value="BASEADA_PEDIDO" id="pedido" className="peer sr-only" />
                  <Label
                    htmlFor="pedido"
                    className={cn(
                      "flex flex-col items-center justify-between rounded-lg border-2 p-4 cursor-pointer",
                      "hover:bg-accent hover:text-accent-foreground",
                      field.value === "BASEADA_PEDIDO" ? "border-primary bg-primary/5" : "border-muted"
                    )}
                  >
                    <Package className="h-8 w-8 mb-2" />
                    <span className="font-semibold">Baseada em Pedido</span>
                    <span className="text-xs text-muted-foreground text-center mt-1">
                      Importar de pedido confirmado
                    </span>
                  </Label>
                </div>
              </RadioGroup>
            </FormControl>
          </FormItem>
        )}
      />

      {tipoOP === "BASEADA_FORMULA" && (
        <FormField
          control={form.control}
          name="formula_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Selecionar Fórmula Aprovada *</FormLabel>
              <Select value={field.value} onValueChange={handleFormulaChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma fórmula" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {formulas.map((formula) => (
                    <SelectItem key={formula.id} value={formula.id}>
                      {formula.codigo_formula} - {formula.nome_formula}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
              {formulas.length === 0 && (
                <Alert className="mt-2">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Nenhuma fórmula aprovada disponível.
                  </AlertDescription>
                </Alert>
              )}
            </FormItem>
          )}
        />
      )}

      {tipoOP === "BASEADA_PEDIDO" && (
        <FormField
          control={form.control}
          name="pedido_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Selecionar Pedido Confirmado *</FormLabel>
              <Select value={field.value} onValueChange={handlePedidoChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um pedido" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {pedidos.map((pedido) => (
                    <SelectItem key={pedido.id} value={pedido.id}>
                      {pedido.codigo} - {pedido.cliente_nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
              {pedidos.length === 0 && (
                <Alert className="mt-2">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Nenhum pedido confirmado disponível.
                  </AlertDescription>
                </Alert>
              )}
              {selectedPedido && (
                <div className="mt-2 p-3 bg-muted rounded-lg">
                  <p className="text-sm font-medium">{selectedPedido.cliente_nome}</p>
                  <p className="text-xs text-muted-foreground">{selectedPedido.cliente_documento}</p>
                </div>
              )}
            </FormItem>
          )}
        />
      )}
    </div>
  );

  const renderEtapa2 = () => (
    <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
      <div className="flex items-center gap-2 mb-4">
        <Package className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Dados Produtivos</h3>
        <Badge variant="destructive" className="ml-auto">Obrigatório</Badge>
      </div>

      {/* ===== SEÇÃO CLIENTE ===== */}
      <Card className="border-secondary/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Cliente
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <FormLabel>Buscar Cliente *</FormLabel>
            <div className="relative mt-1.5">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Digite nome, razão social ou CNPJ..."
                value={clienteSearch}
                onChange={(e) => setClienteSearch(e.target.value)}
                onFocus={() => clientes.length > 0 && setShowClienteDropdown(true)}
                className="pl-9"
              />
            </div>
            
            {/* Dropdown de clientes */}
            {showClienteDropdown && clientes.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-48 overflow-y-auto">
                {clientes.map((cliente) => (
                  <div
                    key={cliente.id}
                    className="px-3 py-2 hover:bg-muted cursor-pointer border-b last:border-b-0"
                    onClick={() => handleClienteSelect(cliente)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{cliente.nome_fantasia || cliente.razao_social}</span>
                      {cliente.source === "local" && (
                        <Badge variant="outline" className="text-xs">Local</Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {cliente.documento.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")}
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {clienteSearch.length >= 2 && clientes.length === 0 && (
              <div className="mt-2">
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="flex items-center justify-between">
                    <span>Cliente não encontrado.</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowQuickClienteModal(true)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Cadastrar
                    </Button>
                  </AlertDescription>
                </Alert>
              </div>
            )}
          </div>
          
          {selectedCliente && (
            <div className="p-3 bg-secondary/10 rounded-lg border border-secondary/30">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{selectedCliente.nome_fantasia || selectedCliente.razao_social}</p>
                  <p className="text-xs text-muted-foreground">
                    CNPJ: {selectedCliente.documento.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")}
                  </p>
                </div>
                <Badge variant="secondary">Vinculado</Badge>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===== PRODUTO ===== */}
      <FormField
        control={form.control}
        name="produto_nome"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Nome do Produto Final *</FormLabel>
            <FormControl>
              <Input placeholder="Ex: Vitamina D3 5000UI + K2 100mcg" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="tipo_produto"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Tipo de Produto *</FormLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="CAPSULA">Cápsula (padrão)</SelectItem>
                <SelectItem value="LIQUIDO">Líquido</SelectItem>
                <SelectItem value="PO">Pó</SelectItem>
              </SelectContent>
            </Select>
          </FormItem>
        )}
      />

      <div className="grid grid-cols-3 gap-4">
        <FormField
          control={form.control}
          name="quantidade_frascos"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Quantidade de Frascos *</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={1}
                  {...field}
                  onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="unidades_por_frasco"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {tipoProduto === "CAPSULA" ? "Cápsulas/Frasco *" : 
                 tipoProduto === "LIQUIDO" ? "mL/Frasco *" : "Doses/Frasco *"}
              </FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={1}
                  {...field}
                  onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-2">
          <FormLabel>Total Produzido</FormLabel>
          <div className="h-10 flex items-center px-3 bg-muted rounded-md">
            <span className="font-mono font-bold">{totalUnidades.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-4">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Calculator className="h-4 w-4 text-primary" />
              <span>Acréscimo Industrial (+{ACRESCIMO_INDUSTRIAL}%):</span>
            </div>
            <span className="font-mono font-bold text-primary">
              {totalComAcrescimo.toLocaleString()} {tipoProduto === "CAPSULA" ? "cápsulas" : "unidades"}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* ===== ESPECIFICAÇÕES DE EMBALAGEM ===== */}
      <Separator />
      
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Package className="h-4 w-4" />
            Especificações de Embalagem
          </CardTitle>
          <CardDescription>Defina cores, materiais e acessórios</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {tipoProduto === "CAPSULA" && (
              <FormField
                control={form.control}
                name="cor_capsula"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cor da Cápsula</FormLabel>
                    <Select value={field.value || ""} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="TRANSPARENTE">Transparente</SelectItem>
                        <SelectItem value="BRANCA">Branca</SelectItem>
                        <SelectItem value="VERDE">Verde</SelectItem>
                        <SelectItem value="VERMELHA">Vermelha</SelectItem>
                        <SelectItem value="AZUL">Azul</SelectItem>
                        <SelectItem value="PRETA">Preta</SelectItem>
                        <SelectItem value="AMARELA">Amarela</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="tipo_pote"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Pote/Frasco</FormLabel>
                  <Select value={field.value || ""} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="PEAD_BRANCO">PEAD Branco</SelectItem>
                      <SelectItem value="PEAD_AMBAR">PEAD Âmbar</SelectItem>
                      <SelectItem value="VIDRO_AMBAR">Vidro Âmbar</SelectItem>
                      <SelectItem value="VIDRO_TRANSPARENTE">Vidro Transparente</SelectItem>
                      <SelectItem value="PET_TRANSPARENTE">PET Transparente</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="cor_tampa"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cor da Tampa</FormLabel>
                  <Select value={field.value || ""} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="BRANCA">Branca</SelectItem>
                      <SelectItem value="PRETA">Preta</SelectItem>
                      <SelectItem value="DOURADA">Dourada</SelectItem>
                      <SelectItem value="PRATA">Prata</SelectItem>
                      <SelectItem value="VERDE">Verde</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tipo_tampa"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Tampa</FormLabel>
                  <Select value={field.value || ""} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="ROSCA_LACRE">Rosca com Lacre Indução</SelectItem>
                      <SelectItem value="ROSCA_SIMPLES">Rosca Simples</SelectItem>
                      <SelectItem value="FLIP_TOP">Flip Top</SelectItem>
                      <SelectItem value="CONTA_GOTAS">Conta-gotas</SelectItem>
                      <SelectItem value="PUMP">Pump/Dosador</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
          </div>

          {/* Sílica */}
          {tipoProduto !== "LIQUIDO" && (
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-3">
                <FormField
                  control={form.control}
                  name="incluir_silica"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2 space-y-0">
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="!mt-0">Incluir Sachê de Sílica Gel</FormLabel>
                    </FormItem>
                  )}
                />
              </div>
              
              {form.watch("incluir_silica") && (
                <FormField
                  control={form.control}
                  name="quantidade_silica_sache"
                  render={({ field }) => (
                    <FormItem className="w-24">
                      <Select value={field.value || "1g"} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="0.5g">0,5g</SelectItem>
                          <SelectItem value="1g">1g</SelectItem>
                          <SelectItem value="2g">2g</SelectItem>
                          <SelectItem value="5g">5g</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
              )}
            </div>
          )}

          {/* Descrição do Rótulo */}
          <FormField
            control={form.control}
            name="descricao_rotulo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Descrição/Observações do Rótulo</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder="Informações adicionais sobre o rótulo (arte, versão, etc)..."
                    className="resize-none"
                    rows={2}
                    {...field} 
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </CardContent>
      </Card>
    </div>
  );

  const renderEtapa3 = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Hash className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Lote e Rastreabilidade</h3>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <FormField
          control={form.control}
          name="data_fabricacao"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Data de Fabricação *</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant="outline"
                      className={cn(
                        "pl-3 text-left font-normal",
                        !field.value && "text-muted-foreground"
                      )}
                    >
                      {field.value ? format(field.value, "dd/MM/yyyy", { locale: ptBR }) : <span>Selecione</span>}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="lote_produto_acabado"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Lote do Produto Acabado *</FormLabel>
              <FormControl>
                <Input placeholder="Ex: 260206-001" {...field} />
              </FormControl>
              <FormDescription className="text-xs">
                Sugestão automática ao definir data
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="data_validade"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Data de Validade *</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant="outline"
                      className={cn(
                        "pl-3 text-left font-normal",
                        !field.value && "text-muted-foreground"
                      )}
                    >
                      {field.value ? format(field.value, "dd/MM/yyyy", { locale: ptBR }) : <span>Selecione</span>}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <strong>Rastreabilidade ANVISA:</strong> Insumos → Lotes → Fornecedor → Nota Fiscal serão vinculados automaticamente na etapa de pesagem.
        </AlertDescription>
      </Alert>
    </div>
  );

  const renderEtapa4 = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Beaker className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Configuração Técnica e RT</h3>
      </div>

      {tipoProduto === "CAPSULA" && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="tipo_capsula"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Cápsula *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="000">Cápsula 000 (1.37ml)</SelectItem>
                      <SelectItem value="00">Cápsula 00 (0.91ml) - Padrão</SelectItem>
                      <SelectItem value="0">Cápsula 0 (0.68ml)</SelectItem>
                      <SelectItem value="1">Cápsula 1 (0.50ml)</SelectItem>
                      <SelectItem value="2">Cápsula 2 (0.37ml)</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="excipiente_base"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Excipiente Base *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="AMIDO">Amido de Milho</SelectItem>
                      <SelectItem value="CELULOSE">Celulose Microcristalina</SelectItem>
                      <SelectItem value="PRE_BLEND">Pré-blend Industrial</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
          </div>

          <Card className="bg-muted/50">
            <CardContent className="p-4">
              <p className="text-sm font-medium mb-2">Excipientes Tecnológicos (aplicados automaticamente):</p>
              <div className="grid grid-cols-3 gap-2 text-sm text-muted-foreground">
                <div>• Dióxido de Silício: <strong>2%</strong></div>
                <div>• Talco Farmacêutico: <strong>5%</strong></div>
                <div>• Estearato de Magnésio: <strong>2,5%</strong></div>
              </div>
              <p className="text-xs mt-2 text-muted-foreground">
                Padrão industrial para encapsulamento semi-automático. Peso alvo: {PESO_CAPSULA_ALVO}mg
              </p>
            </CardContent>
          </Card>
        </>
      )}

      <Separator />

      <FormField
        control={form.control}
        name="responsavel_producao_nome"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Responsável pela Produção *</FormLabel>
            <FormControl>
              <Input placeholder="Nome do operador responsável" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="responsavel_tecnico_id"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="flex items-center gap-2">
              <UserCheck className="h-4 w-4" />
              Responsável Técnico *
            </FormLabel>
            <RTSelectorOP
              value={field.value}
              onChange={(rtId) => form.setValue("responsavel_tecnico_id", rtId)}
              tipoProduto={tipoProduto}
            />
            <FormDescription>
              RT com registro ativo e compatível com o tipo de produto.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="observacoes"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Observações</FormLabel>
            <FormControl>
              <Textarea
                placeholder="Observações adicionais..."
                className="min-h-[80px]"
                {...field}
              />
            </FormControl>
          </FormItem>
        )}
      />
    </div>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Factory className="h-5 w-5 text-primary" />
              Criar Ordem de Produção
            </DialogTitle>
            <DialogDescription>
              Sistema Industrial ANVISA - Etapa {etapaAtual} de 4
            </DialogDescription>
          </DialogHeader>

          {/* Progresso */}
          <div className="space-y-2">
            <Progress value={progressoEtapas} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span className={etapaAtual >= 1 ? "text-primary font-medium" : ""}>1. Tipo</span>
              <span className={etapaAtual >= 2 ? "text-primary font-medium" : ""}>2. Produção</span>
              <span className={etapaAtual >= 3 ? "text-primary font-medium" : ""}>3. Lote</span>
              <span className={etapaAtual >= 4 ? "text-primary font-medium" : ""}>4. Técnico</span>
            </div>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {etapaAtual === 1 && renderEtapa1()}
              {etapaAtual === 2 && renderEtapa2()}
              {etapaAtual === 3 && renderEtapa3()}
              {etapaAtual === 4 && renderEtapa4()}

              <DialogFooter className="flex justify-between">
                <div>
                  {etapaAtual > 1 && (
                    <Button type="button" variant="outline" onClick={voltar}>
                      <ChevronLeft className="h-4 w-4 mr-2" />
                      Voltar
                    </Button>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                    Cancelar
                  </Button>
                  {etapaAtual < 4 ? (
                    <Button type="button" onClick={avancar} disabled={!podeAvancar()}>
                      Próximo
                      <ChevronRight className="h-4 w-4 ml-2" />
                    </Button>
                  ) : (
                    <Button type="submit" disabled={isLoading || !podeAvancar()}>
                      {isLoading ? "Criando..." : (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          Criar OP
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Modal de cadastro rápido de cliente */}
      <QuickClienteModal
        open={showQuickClienteModal}
        onOpenChange={setShowQuickClienteModal}
        onClienteCreated={handleQuickClienteCreated}
        initialSearch={clienteSearch}
      />
    </>
  );
}
