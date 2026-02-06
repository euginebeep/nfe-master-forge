import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CalendarIcon, Package, FlaskConical, User, Hash, Calculator, AlertTriangle } from "lucide-react";
import { format, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

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
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { gerarLoteProdutoAcabado } from "@/types/op-industrial";

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
      tipo_capsula: "00",
      excipiente_base: "AMIDO",
      responsavel_producao_nome: "",
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
      form.setValue("tipo_capsula", formulaSelecionada.tipo_capsula || "00");
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
    form.setValue("formula_id", formulaId);
    const formula = formulas.find((f) => f.id === formulaId);
    if (formula) {
      setSelectedFormula(formula);
      form.setValue("produto_nome", formula.nome_formula);
      form.setValue("tipo_capsula", formula.tipo_capsula || "00");
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
      // Importar hook dentro da função para evitar problemas de dependência circular
      const { useOPIndustrial } = await import("@/hooks/use-op-industrial");
      
      // Para criar a OP, vamos usar uma função inline
      const codigo = `OP-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 99999)).padStart(5, '0')}`;
      
      const opData = {
        codigo,
        produto_nome: values.produto_nome,
        formula_id: values.formula_id || null,
        formula_codigo: selectedFormula?.codigo_formula || null,
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
        observacoes: values.observacoes || null,
      };

      const { error } = await supabase
        .from("ordens_producao_industrial")
        .insert(opData);

      if (error) throw error;

      onSuccess();
      onOpenChange(false);
      form.reset();
      setSelectedFormula(null);
    } catch (error) {
      console.error("Erro ao criar OP:", error);
    } finally {
      setIsLoading(false);
    }
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
                        value={field.value}
                        onValueChange={handleFormulaChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione uma fórmula (opcional)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">Nenhuma (OP Manual)</SelectItem>
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
                          <SelectItem value="00">Cápsula 00 (0.91ml)</SelectItem>
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
