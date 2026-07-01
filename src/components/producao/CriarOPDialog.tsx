import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CalendarIcon, Package, FlaskConical, User, Hash, Calculator, AlertTriangle, UserCheck } from "lucide-react";
import { format, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

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
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { gerarLoteProdutoAcabado, CHECKLIST_PADRAO } from "@/types/op-industrial";
import { RTSelectorOP } from "@/components/responsavel-tecnico/RTSelectorOP";

const formSchema = z.object({
  produto_nome: z.string().min(1, "Nome do produto é obrigatório"),
  formula_id: z.string().optional(),
  quantidade_frascos: z.number().min(1, "Mínimo 1 frasco"),
  capsulas_por_frasco: z.number().min(1, "Mínimo 1 cápsula por frasco"),
  lote_produto_acabado: z.string().min(1, "Lote é obrigatório"),
  data_fabricacao: z.date({ required_error: "Data de fabricação é obrigatória" }),
  data_validade: z.date({ required_error: "Data de validade é obrigatória" }),
  tipo_capsula: z.string().min(1, "Tipo de cápsula é obrigatório"),
  excipiente_base: z.enum(["AMIDO", "CELULOSE", "PRE_BLEND"]),
  responsavel_producao_nome: z.string().min(1, "Responsável é obrigatório"),
  responsavel_tecnico_id: z.string().min(1, "Responsável Técnico é obrigatório"),
  observacoes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface Formula {
  id: string;
  codigo_formula: string;
  nome_formula: string;
  status: string;
  tipo_capsula?: string;
  excipiente_padrao?: string;
}

interface CriarOPDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  formulaSelecionada?: Formula | null;
}

export function CriarOPDialog({
  open,
  onOpenChange,
  onSuccess,
  formulaSelecionada,
}: CriarOPDialogProps) {
  const [formulas, setFormulas] = useState<Formula[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFormula, setSelectedFormula] = useState<Formula | null>(formulaSelecionada || null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      produto_nome: "",
      formula_id: "",
      quantidade_frascos: 100,
      capsulas_por_frasco: 60,
      lote_produto_acabado: "",
      tipo_capsula: "0",
      excipiente_base: "AMIDO",
      responsavel_producao_nome: "",
      responsavel_tecnico_id: "",
      observacoes: "",
    },
  });

  // Carregar fórmulas aprovadas
  useEffect(() => {
    if (open) {
      const fetchFormulas = async () => {
        const { data } = await supabase
          .from("formulas")
          .select("id, codigo_formula, nome_formula, status, tipo_capsula, excipiente_padrao")
          .eq("status", "APROVADA")
          .order("nome_formula", { ascending: true });

        setFormulas((data as Formula[]) || []);
      };
      fetchFormulas();
    }
  }, [open]);

  // Atualizar quando fórmula é selecionada
  useEffect(() => {
    if (formulaSelecionada) {
      setSelectedFormula(formulaSelecionada);
      form.setValue("formula_id", formulaSelecionada.id);
      form.setValue("produto_nome", formulaSelecionada.nome_formula);
      form.setValue("tipo_capsula", formulaSelecionada.tipo_capsula || "0");
      form.setValue("excipiente_base", (formulaSelecionada.excipiente_padrao as "AMIDO" | "CELULOSE" | "PRE_BLEND") || "AMIDO");
    }
  }, [formulaSelecionada, form]);

  // Gerar lote automático quando data de fabricação muda
  const watchDataFab = form.watch("data_fabricacao");
  useEffect(() => {
    if (watchDataFab) {
      const lote = gerarLoteProdutoAcabado(watchDataFab, Math.floor(Math.random() * 100) + 1);
      form.setValue("lote_produto_acabado", lote);
      
      // Calcular validade (24 meses)
      const validade = addMonths(watchDataFab, 24);
      form.setValue("data_validade", validade);
    }
  }, [watchDataFab, form]);

  // Quando seleciona fórmula no dropdown
  const handleFormulaChange = (formulaId: string) => {
    const actualId = formulaId === "none" ? "" : formulaId;
    form.setValue("formula_id", actualId);
    const formula = formulas.find((f) => f.id === actualId);
    if (formula) {
      setSelectedFormula(formula);
      form.setValue("produto_nome", formula.nome_formula);
      form.setValue("tipo_capsula", formula.tipo_capsula || "0");
      form.setValue("excipiente_base", (formula.excipiente_padrao as "AMIDO" | "CELULOSE" | "PRE_BLEND") || "AMIDO");
    } else {
      setSelectedFormula(null);
    }
  };

  // Calcular totais
  const watchFrascos = form.watch("quantidade_frascos") || 0;
  const watchCapsulas = form.watch("capsulas_por_frasco") || 0;
  const totalCapsulas = watchFrascos * watchCapsulas;
  const totalComAcrescimo = Math.ceil(totalCapsulas * 1.05);

  const onSubmit = async (values: FormValues) => {
    setIsLoading(true);
    try {
      // Buscar próximo código sequencial
      const ano = new Date().getFullYear();
      const { data: lastOP } = await supabase
        .from("ordens_producao_industrial")
        .select("codigo")
        .ilike("codigo", `OP-${ano}-%`)
        .order("codigo", { ascending: false })
        .limit(1);

      let sequencia = 1;
      if (lastOP && lastOP.length > 0) {
        const partes = lastOP[0].codigo.split('-');
        sequencia = parseInt(partes[2] || '0', 10) + 1;
      }
      const codigo = `OP-${ano}-${String(sequencia).padStart(5, '0')}`;
      
      const opData = {
        codigo,
        produto_nome: values.produto_nome,
        formula_id: values.formula_id || null,
        formula_codigo: selectedFormula?.codigo_formula || null,
        formula_versao: selectedFormula ? 1 : null,
        quantidade_frascos: values.quantidade_frascos,
        capsulas_por_frasco: values.capsulas_por_frasco,
        total_capsulas: totalCapsulas,
        acrescimo_percentual: 5,
        total_capsulas_com_acrescimo: totalComAcrescimo,
        lote_produto_acabado: values.lote_produto_acabado,
        data_fabricacao: format(values.data_fabricacao, "yyyy-MM-dd"),
        data_validade: format(values.data_validade, "yyyy-MM-dd"),
        tipo_apresentacao: "CAPSULA",
        peso_capsula_mg: 500,
        tipo_capsula: values.tipo_capsula,
        excipiente_base: values.excipiente_base,
        status: "PLANEJADA",
        responsavel_producao_nome: values.responsavel_producao_nome,
        responsavel_tecnico_id: values.responsavel_tecnico_id,
        observacoes: values.observacoes || null,
      };

      const { data: newOP, error } = await supabase
        .from("ordens_producao_industrial")
        .insert(opData)
        .select()
        .single();

      if (error) throw error;

      // Se tem fórmula vinculada, criar matérias-primas automaticamente
      if (values.formula_id && newOP) {
        await criarMateriasPrimasDaFormula(newOP.id, values.formula_id, totalComAcrescimo);
      }

      // Criar checklist padrão
      if (newOP) {
        await criarChecklistPadrao(newOP.id);
      }

      toast.success(`OP ${codigo} criada com sucesso!`);
      onSuccess();
      onOpenChange(false);
      form.reset();
      setSelectedFormula(null);
    } catch (error) {
      console.error("Erro ao criar OP:", error);
      toast.error("Erro ao criar ordem de produção");
    } finally {
      setIsLoading(false);
    }
  };

  // Criar matérias-primas a partir da fórmula
  const criarMateriasPrimasDaFormula = async (opId: string, formulaId: string, totalCaps: number) => {
    try {
      // Buscar itens da fórmula
      const { data: itens } = await supabase
        .from("formula_itens")
        .select("*")
        .eq("formula_id", formulaId)
        .order("ordem_mistura", { ascending: true });

      if (!itens || itens.length === 0) return;

      const pesoCapsula = 500; // mg
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

      // Adicionar ativos da fórmula
      for (const item of itens) {
        const qTotalMg = item.quantidade_convertida_mg * totalCaps;
        const qTotalG = qTotalMg / 1000;
        const critico = item.ativo_critico || item.quantidade_convertida_mg < 1;
        const tolerancia = 10;
        const minimo = qTotalG * (1 - tolerancia / 100);
        const maximo = qTotalG * (1 + tolerancia / 100);

        materiasData.push({
          op_id: opId,
          insumo_id: item.produto_materia_prima_id || undefined,
          insumo_nome: item.nome_insumo,
          categoria: 'ATIVO',
          quantidade_teorica_mg: qTotalMg,
          quantidade_teorica_g: qTotalG,
          unidade: 'g',
          pesagem_critica: critico,
          motivo_critico: critico ? (item.quantidade_convertida_mg < 1 ? 'Quantidade < 1mg' : 'Ativo crítico') : undefined,
          tolerancia_percentual: tolerancia,
          quantidade_minima_g: minimo,
          quantidade_maxima_g: maximo,
          ordem_mistura: ordemMistura++,
        });
      }

      // Calcular excipientes tecnológicos (fixos para 500mg)
      const talcoMg = pesoCapsula * 0.05; // 5%
      const dioxidoMg = pesoCapsula * 0.02; // 2%
      const estearatoMg = pesoCapsula * 0.025; // 2.5%
      const totalTecnologicos = talcoMg + dioxidoMg + estearatoMg;
      const totalAtivos = itens.reduce((sum, i) => sum + i.quantidade_convertida_mg, 0);
      const excipienteBaseMg = pesoCapsula - totalAtivos - totalTecnologicos;

      // Excipiente base (Q.S.P.)
      const qspG = (excipienteBaseMg * totalCaps) / 1000;
      materiasData.push({
        op_id: opId,
        insumo_nome: 'Excipiente Base (Q.S.P.)',
        categoria: 'EXCIPIENTE_BASE',
        quantidade_teorica_mg: excipienteBaseMg * totalCaps,
        quantidade_teorica_g: qspG,
        unidade: 'g',
        pesagem_critica: false,
        tolerancia_percentual: 10,
        quantidade_minima_g: qspG * 0.9,
        quantidade_maxima_g: qspG * 1.1,
        ordem_mistura: ordemMistura++,
      });

      // Dióxido de Silício
      const dioxidoG = (dioxidoMg * totalCaps) / 1000;
      materiasData.push({
        op_id: opId,
        insumo_nome: 'Dióxido de Silício',
        categoria: 'EXCIPIENTE_TECNOLOGICO',
        quantidade_teorica_mg: dioxidoMg * totalCaps,
        quantidade_teorica_g: dioxidoG,
        unidade: 'g',
        pesagem_critica: false,
        tolerancia_percentual: 10,
        quantidade_minima_g: dioxidoG * 0.9,
        quantidade_maxima_g: dioxidoG * 1.1,
        ordem_mistura: ordemMistura++,
      });

      // Talco
      const talcoG = (talcoMg * totalCaps) / 1000;
      materiasData.push({
        op_id: opId,
        insumo_nome: 'Talco Farmacêutico',
        categoria: 'EXCIPIENTE_TECNOLOGICO',
        quantidade_teorica_mg: talcoMg * totalCaps,
        quantidade_teorica_g: talcoG,
        unidade: 'g',
        pesagem_critica: false,
        tolerancia_percentual: 10,
        quantidade_minima_g: talcoG * 0.9,
        quantidade_maxima_g: talcoG * 1.1,
        ordem_mistura: ordemMistura++,
      });

      // Estearato de Magnésio (SEMPRE ÚLTIMO)
      const estearatoG = (estearatoMg * totalCaps) / 1000;
      materiasData.push({
        op_id: opId,
        insumo_nome: 'Estearato de Magnésio',
        categoria: 'EXCIPIENTE_TECNOLOGICO',
        quantidade_teorica_mg: estearatoMg * totalCaps,
        quantidade_teorica_g: estearatoG,
        unidade: 'g',
        pesagem_critica: false,
        tolerancia_percentual: 10,
        quantidade_minima_g: estearatoG * 0.9,
        quantidade_maxima_g: estearatoG * 1.1,
        ordem_mistura: ordemMistura++,
      });

      await supabase.from("op_materias_primas").insert(materiasData);

      // Criar pesagens críticas
      const criticos = materiasData.filter(m => m.pesagem_critica);
      if (criticos.length > 0) {
        const { data: mps } = await supabase
          .from("op_materias_primas")
          .select("id, insumo_nome, quantidade_teorica_mg")
          .eq("op_id", opId)
          .eq("pesagem_critica", true);

        if (mps) {
          const pesagensCriticas = mps.map(mp => ({
            op_id: opId,
            materia_prima_id: mp.id,
            insumo_nome: mp.insumo_nome,
            quantidade_teorica_mg: mp.quantidade_teorica_mg,
            status: 'PENDENTE',
          }));
          await supabase.from("op_pesagens_criticas").insert(pesagensCriticas);
        }
      }

      // Criar controle de perdas
      await supabase.from("op_controle_perdas").insert({
        op_id: opId,
        quantidade_planejada: Math.floor(totalCaps / 1.05),
        acrescimo_percentual: 5,
        quantidade_com_acrescimo: totalCaps,
      });

    } catch (error) {
      console.error("Erro ao criar matérias-primas:", error);
    }
  };

  // Criar checklist padrão
  const criarChecklistPadrao = async (opId: string) => {
    const checklistData = CHECKLIST_PADRAO.map(item => ({
      op_id: opId,
      ...item,
      verificado: false,
    }));

    await supabase.from("op_checklist").insert(checklistData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Criar Ordem de Produção
          </DialogTitle>
          <DialogDescription>
            Preencha todos os campos obrigatórios para criar uma nova OP industrial.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Seção: Fórmula (Opcional) */}
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-4">
                  <FlaskConical className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Fórmula Base (Opcional)</span>
                  <Badge variant="outline" className="ml-auto">Opcional</Badge>
                </div>

                <FormField
                  control={form.control}
                  name="formula_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Selecionar Fórmula Aprovada</FormLabel>
                      <Select
                        value={field.value || "none"}
                        onValueChange={handleFormulaChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione uma fórmula (opcional)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Nenhuma (OP Manual)</SelectItem>
                          {formulas.map((formula) => (
                            <SelectItem key={formula.id} value={formula.id}>
                              {formula.codigo_formula} - {formula.nome_formula}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Vincular uma fórmula carrega automaticamente os ativos e excipientes
                      </FormDescription>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Separator />

            {/* Seção: Produto e Quantidades */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Produto e Quantidades</span>
                <Badge variant="destructive" className="ml-auto">Obrigatório</Badge>
              </div>

              <FormField
                control={form.control}
                name="produto_nome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do Produto *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Vitamina D3 5000UI + K2 100mcg" {...field} />
                    </FormControl>
                    <FormMessage />
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
                  name="capsulas_por_frasco"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cápsulas por Frasco *</FormLabel>
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
                  <FormLabel>Total de Cápsulas</FormLabel>
                  <div className="h-10 flex items-center px-3 bg-muted rounded-md">
                    <span className="font-mono font-bold">{totalCapsulas.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Card de cálculo */}
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Calculator className="h-4 w-4 text-primary" />
                    <span>
                      Total com acréscimo de 5%: <strong>{totalComAcrescimo.toLocaleString()} cápsulas</strong>
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Separator />

            {/* Seção: Lote e Datas */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Hash className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Lote e Datas</span>
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
                              {field.value ? (
                                format(field.value, "dd/MM/yyyy", { locale: ptBR })
                              ) : (
                                <span>Selecione</span>
                              )}
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
                      <FormLabel>Lote do Produto *</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: 260206-001" {...field} />
                      </FormControl>
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
                              {field.value ? (
                                format(field.value, "dd/MM/yyyy", { locale: ptBR })
                              ) : (
                                <span>Selecione</span>
                              )}
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
            </div>

            <Separator />

            {/* Seção: Configuração Técnica */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <span className="font-medium">Configuração Técnica</span>
              </div>

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
                          <SelectItem value="0">Cápsula 0 (0.68ml)</SelectItem>
                          <SelectItem value="1">Cápsula 1 (0.50ml)</SelectItem>
                          <SelectItem value="2">Cápsula 2 (0.37ml)</SelectItem>
                          <SelectItem value="3">Cápsula 3 (0.30ml)</SelectItem>
                          <SelectItem value="4">Cápsula 4 (0.21ml)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
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
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Separator />

            {/* Seção: Responsável */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Responsável</span>
              </div>

              <FormField
                control={form.control}
                name="responsavel_producao_nome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Responsável pela Produção *</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome do responsável técnico" {...field} />
                    </FormControl>
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

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Criando..." : "Criar Ordem de Produção"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
