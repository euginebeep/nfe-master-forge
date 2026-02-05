import { useState, useEffect, useMemo } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  FlaskConical, Plus, Trash2, AlertTriangle, Calculator, 
  ChevronDown, ChevronUp, Info, Droplets, Beaker
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { useLocalItens, LocalItem } from "@/hooks/use-local-itens";
import { 
  useCreateFormula, 
  useUpdateFormula, 
  calcularQuantidadeManipulacao,
  calcularQSP,
  calcularAlertas,
} from "@/hooks/use-formulas";
import { 
  Formula, 
  FormulaIngrediente, 
  TipoCapsula, 
  CAPSULA_CAPACIDADES,
  VD_REFERENCIA,
} from "@/types/formulas";
import { LocalDb } from "@/lib/local-db";

const ingredienteSchema = z.object({
  id: z.string(),
  item_id: z.string().min(1, "Selecione um item"),
  item_descricao: z.string(),
  item_sku: z.string().optional(),
  quantidade_rotulo: z.coerce.number().min(0.001, "Quantidade obrigatória"),
  unidade_rotulo: z.string(),
  quantidade_manipulacao: z.coerce.number(),
  unidade_manipulacao: z.string(),
  potencia: z.coerce.number().optional(),
  nome_rotulo: z.string().optional(),
  higroscopico: z.boolean(),
  exige_premix: z.boolean(),
  ordem: z.number(),
});

const formulaSchema = z.object({
  nome: z.string().min(1, "Nome obrigatório"),
  nome_comercial: z.string().optional(),
  descricao: z.string().optional(),
  tipo_capsula: z.string().min(1, "Tipo de cápsula obrigatório"),
  capacidade_mg: z.coerce.number().min(1, "Capacidade obrigatória"),
  excipiente_padrao: z.string().optional(),
  status: z.string(),
  ingredientes: z.array(ingredienteSchema),
});

type FormValues = z.infer<typeof formulaSchema>;

interface FormulaFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formula?: Formula | null;
  onSuccess?: () => void;
}

const TIPOS_CAPSULA: TipoCapsula[] = [
  '000', '00', '0', '1', '2', '3', '4', '5',
  'Softgel', 'Vegana', 'Liquida', 'Comprimido', 'Sachê'
];

const UNIDADES_ROTULO = ['mg', 'mcg', 'UI', 'g', 'ml'];

const EXCIPIENTES = [
  'Maltodextrina',
  'Celulose Microcristalina',
  'Amido de Milho',
  'Dióxido de Silício',
  'Estearato de Magnésio',
  'Fosfato de Cálcio',
];

export function FormulaFormDialog({
  open,
  onOpenChange,
  formula,
  onSuccess,
}: FormulaFormDialogProps) {
  const [expandedIngrediente, setExpandedIngrediente] = useState<string | null>(null);
  const { data: itens } = useLocalItens({ ativo: true });
  const { create } = useCreateFormula();
  const { update } = useUpdateFormula();
  
  // Filtrar apenas matérias-primas para seleção
  const materiaPrimas = useMemo(() => 
    itens.filter(i => i.tipo_item === 'MP'), 
    [itens]
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(formulaSchema),
    defaultValues: {
      nome: "",
      nome_comercial: "",
      descricao: "",
      tipo_capsula: "00",
      capacidade_mg: 650,
      excipiente_padrao: "Maltodextrina",
      status: "RASCUNHO",
      ingredientes: [],
    },
  });

  const { fields, append, remove, update: updateField, move } = useFieldArray({
    control: form.control,
    name: "ingredientes",
  });

  // Carregar dados da fórmula existente
  useEffect(() => {
    if (formula) {
      form.reset({
        nome: formula.nome,
        nome_comercial: formula.nome_comercial || "",
        descricao: formula.descricao || "",
        tipo_capsula: formula.tipo_capsula,
        capacidade_mg: formula.capacidade_mg,
        excipiente_padrao: formula.excipiente_padrao || "Maltodextrina",
        status: formula.status,
        ingredientes: formula.ingredientes.map(ing => ({
          ...ing,
          potencia: ing.potencia ? ing.potencia * 100 : undefined, // Converter para %
        })),
      });
    } else {
      form.reset({
        nome: "",
        nome_comercial: "",
        descricao: "",
        tipo_capsula: "00",
        capacidade_mg: 650,
        excipiente_padrao: "Maltodextrina",
        status: "RASCUNHO",
        ingredientes: [],
      });
    }
  }, [formula, form]);

  // Atualizar capacidade quando muda tipo de cápsula
  const tipoCapsula = form.watch("tipo_capsula");
  useEffect(() => {
    const capacidade = CAPSULA_CAPACIDADES[tipoCapsula];
    if (capacidade && !formula) {
      form.setValue("capacidade_mg", capacidade.tipico);
    }
  }, [tipoCapsula, form, formula]);

  // Calcular totais
  const ingredientes = form.watch("ingredientes");
  const capacidade_mg = form.watch("capacidade_mg");
  
  const totais = useMemo(() => {
    const total_ativos = ingredientes.reduce((sum, ing) => sum + (ing.quantidade_manipulacao || 0), 0);
    const qsp = Math.max(0, capacidade_mg - total_ativos);
    const percentual_ocupado = capacidade_mg > 0 ? (total_ativos / capacidade_mg) * 100 : 0;
    return { total_ativos, qsp, percentual_ocupado };
  }, [ingredientes, capacidade_mg]);

  const alertas = useMemo(() => {
    return calcularAlertas({
      ingredientes: ingredientes.map(i => ({
        ...i,
        potencia: i.potencia ? i.potencia / 100 : undefined,
      })) as any,
      capacidade_mg,
    });
  }, [ingredientes, capacidade_mg]);

  // Adicionar ingrediente
  const handleAddIngrediente = () => {
    const newId = LocalDb.generateUUID();
    append({
      id: newId,
      item_id: "",
      item_descricao: "",
      item_sku: "",
      quantidade_rotulo: 0,
      unidade_rotulo: "mg",
      quantidade_manipulacao: 0,
      unidade_manipulacao: "mg",
      potencia: undefined,
      nome_rotulo: "",
      higroscopico: false,
      exige_premix: false,
      ordem: fields.length,
    });
    setExpandedIngrediente(newId);
  };

  // Atualizar ingrediente quando seleciona item
  const handleItemSelect = (index: number, itemId: string) => {
    const item = itens.find(i => i.id === itemId);
    if (!item) return;

    const current = fields[index];
    updateField(index, {
      ...current,
      item_id: itemId,
      item_descricao: item.descricao_interna,
      item_sku: item.sku_interno,
      higroscopico: item.higroscopico || false,
      exige_premix: item.exige_premix || false,
      nome_rotulo: item.descricao_comercial || item.descricao_interna,
    });
  };

  // Recalcular quantidade de manipulação
  const handleRecalcular = (index: number) => {
    const ing = form.getValues(`ingredientes.${index}`);
    const quantidade_manipulacao = calcularQuantidadeManipulacao(
      ing.quantidade_rotulo,
      ing.unidade_rotulo,
      ing.potencia ? ing.potencia / 100 : undefined
    );
    form.setValue(`ingredientes.${index}.quantidade_manipulacao`, Math.round(quantidade_manipulacao * 100) / 100);
  };

  const onSubmit = (data: FormValues) => {
    const formulaData = {
      nome: data.nome,
      nome_comercial: data.nome_comercial || undefined,
      descricao: data.descricao || undefined,
      tipo_capsula: data.tipo_capsula as TipoCapsula,
      capacidade_mg: data.capacidade_mg,
      excipiente_padrao: data.excipiente_padrao,
      status: data.status as any,
      ingredientes: data.ingredientes.map((ing, idx) => ({
        ...ing,
        potencia: ing.potencia ? ing.potencia / 100 : undefined,
        ordem: idx,
      })) as FormulaIngrediente[],
      versao: formula?.versao || 1,
    };

    if (formula) {
      update(formula.id, formulaData);
    } else {
      create(formulaData);
    }

    onSuccess?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-secondary" />
            {formula ? "Editar Fórmula" : "Nova Fórmula"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <ScrollArea className="h-[calc(90vh-180px)] px-6">
              <div className="space-y-6 pb-6">
                {/* Dados básicos */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="nome"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome da Fórmula *</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Vitamina D3 2000UI" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="nome_comercial"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome Comercial</FormLabel>
                        <FormControl>
                          <Input placeholder="Nome para rótulo" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="descricao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Indicações, público-alvo, observações..." 
                          className="resize-none"
                          rows={2}
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Configuração da cápsula */}
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm font-medium">Forma Farmacêutica</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                                {TIPOS_CAPSULA.map(tipo => (
                                  <SelectItem key={tipo} value={tipo}>
                                    {tipo} {CAPSULA_CAPACIDADES[tipo] && `(${CAPSULA_CAPACIDADES[tipo].tipico}mg)`}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="capacidade_mg"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Capacidade (mg) *</FormLabel>
                            <FormControl>
                              <Input type="number" step="1" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="excipiente_padrao"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Excipiente Q.S.P.</FormLabel>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {EXCIPIENTES.map(exc => (
                                  <SelectItem key={exc} value={exc}>{exc}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="status"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Status</FormLabel>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="RASCUNHO">Rascunho</SelectItem>
                                <SelectItem value="ATIVO">Ativo</SelectItem>
                                <SelectItem value="REVISAO">Em Revisão</SelectItem>
                                <SelectItem value="ARQUIVADO">Arquivado</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Ingredientes */}
                <Card>
                  <CardHeader className="py-3 flex-row items-center justify-between">
                    <CardTitle className="text-sm font-medium">Ingredientes</CardTitle>
                    <Button 
                      type="button" 
                      size="sm" 
                      variant="secondary"
                      onClick={handleAddIngrediente}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Adicionar
                    </Button>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-2">
                    {fields.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Beaker className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>Nenhum ingrediente adicionado</p>
                        <p className="text-sm">Clique em "Adicionar" para começar</p>
                      </div>
                    ) : (
                      fields.map((field, index) => (
                        <Collapsible 
                          key={field.id}
                          open={expandedIngrediente === field.id}
                          onOpenChange={(open) => setExpandedIngrediente(open ? field.id : null)}
                        >
                          <div className="border rounded-lg">
                            <CollapsibleTrigger asChild>
                              <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50">
                                <div className="flex items-center gap-3">
                                  <span className="text-xs text-muted-foreground w-6">
                                    #{index + 1}
                                  </span>
                                  <div>
                                    <p className="font-medium text-sm">
                                      {field.item_descricao || "Selecione um ingrediente"}
                                    </p>
                                    {field.quantidade_rotulo > 0 && (
                                      <p className="text-xs text-muted-foreground">
                                        {field.quantidade_rotulo} {field.unidade_rotulo} → {field.quantidade_manipulacao.toFixed(2)} mg
                                      </p>
                                    )}
                                  </div>
                                  {field.higroscopico && (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger>
                                          <Droplets className="h-4 w-4 text-blue-500" />
                                        </TooltipTrigger>
                                        <TooltipContent>Higroscópico</TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      remove(index);
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                  {expandedIngrediente === field.id ? (
                                    <ChevronUp className="h-4 w-4" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4" />
                                  )}
                                </div>
                              </div>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <Separator />
                              <div className="p-4 space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <FormField
                                    control={form.control}
                                    name={`ingredientes.${index}.item_id`}
                                    render={({ field: itemField }) => (
                                      <FormItem>
                                        <FormLabel>Matéria Prima *</FormLabel>
                                        <Select 
                                          value={itemField.value} 
                                          onValueChange={(val) => {
                                            itemField.onChange(val);
                                            handleItemSelect(index, val);
                                          }}
                                        >
                                          <FormControl>
                                            <SelectTrigger>
                                              <SelectValue placeholder="Selecione..." />
                                            </SelectTrigger>
                                          </FormControl>
                                          <SelectContent>
                                            {materiaPrimas.map(mp => (
                                              <SelectItem key={mp.id} value={mp.id}>
                                                {mp.sku_interno} - {mp.descricao_interna}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />

                                  <FormField
                                    control={form.control}
                                    name={`ingredientes.${index}.nome_rotulo`}
                                    render={({ field: nomeField }) => (
                                      <FormItem>
                                        <FormLabel>Nome no Rótulo</FormLabel>
                                        <FormControl>
                                          <Input placeholder="Ex: Vitamina D3 (Colecalciferol)" {...nomeField} />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                  <FormField
                                    control={form.control}
                                    name={`ingredientes.${index}.quantidade_rotulo`}
                                    render={({ field: qtdField }) => (
                                      <FormItem>
                                        <FormLabel>Qtd. Rótulo *</FormLabel>
                                        <FormControl>
                                          <Input 
                                            type="number" 
                                            step="0.001" 
                                            {...qtdField}
                                            onChange={(e) => {
                                              qtdField.onChange(e);
                                              setTimeout(() => handleRecalcular(index), 100);
                                            }}
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />

                                  <FormField
                                    control={form.control}
                                    name={`ingredientes.${index}.unidade_rotulo`}
                                    render={({ field: unidField }) => (
                                      <FormItem>
                                        <FormLabel>Unidade</FormLabel>
                                        <Select 
                                          value={unidField.value} 
                                          onValueChange={(val) => {
                                            unidField.onChange(val);
                                            setTimeout(() => handleRecalcular(index), 100);
                                          }}
                                        >
                                          <FormControl>
                                            <SelectTrigger>
                                              <SelectValue />
                                            </SelectTrigger>
                                          </FormControl>
                                          <SelectContent>
                                            {UNIDADES_ROTULO.map(u => (
                                              <SelectItem key={u} value={u}>{u}</SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />

                                  <FormField
                                    control={form.control}
                                    name={`ingredientes.${index}.potencia`}
                                    render={({ field: potField }) => (
                                      <FormItem>
                                        <FormLabel>Potência (%)</FormLabel>
                                        <FormControl>
                                          <Input 
                                            type="number" 
                                            step="0.1"
                                            placeholder="100"
                                            {...potField}
                                            value={potField.value || ""}
                                            onChange={(e) => {
                                              potField.onChange(e.target.value ? parseFloat(e.target.value) : undefined);
                                              setTimeout(() => handleRecalcular(index), 100);
                                            }}
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />

                                  <FormField
                                    control={form.control}
                                    name={`ingredientes.${index}.quantidade_manipulacao`}
                                    render={({ field: manipField }) => (
                                      <FormItem>
                                        <FormLabel className="flex items-center gap-1">
                                          Qtd. Manipulação
                                          <TooltipProvider>
                                            <Tooltip>
                                              <TooltipTrigger>
                                                <Info className="h-3 w-3" />
                                              </TooltipTrigger>
                                              <TooltipContent>
                                                Quantidade real em mg considerando potência
                                              </TooltipContent>
                                            </Tooltip>
                                          </TooltipProvider>
                                        </FormLabel>
                                        <div className="flex gap-2">
                                          <FormControl>
                                            <Input 
                                              type="number" 
                                              step="0.01"
                                              {...manipField}
                                            />
                                          </FormControl>
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            onClick={() => handleRecalcular(index)}
                                          >
                                            <Calculator className="h-4 w-4" />
                                          </Button>
                                        </div>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                </div>
                              </div>
                            </CollapsibleContent>
                          </div>
                        </Collapsible>
                      ))
                    )}
                  </CardContent>
                </Card>

                {/* Resumo e alertas */}
                {fields.length > 0 && (
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm font-medium">Resumo da Fórmula</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Total Ativos</p>
                          <p className="text-lg font-semibold">{totais.total_ativos.toFixed(2)} mg</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Q.S.P. ({form.watch("excipiente_padrao")})</p>
                          <p className="text-lg font-semibold">{totais.qsp.toFixed(2)} mg</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Capacidade</p>
                          <p className="text-lg font-semibold">{capacidade_mg} mg</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Ocupação</p>
                          <p className={`text-lg font-semibold ${totais.percentual_ocupado > 100 ? 'text-destructive' : ''}`}>
                            {totais.percentual_ocupado.toFixed(1)}%
                          </p>
                        </div>
                      </div>

                      {/* Barra de ocupação */}
                      <div className="mt-4">
                        <div className="h-3 bg-muted rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all ${
                              totais.percentual_ocupado > 100 
                                ? 'bg-destructive' 
                                : totais.percentual_ocupado > 90 
                                  ? 'bg-yellow-500' 
                                  : 'bg-secondary'
                            }`}
                            style={{ width: `${Math.min(totais.percentual_ocupado, 100)}%` }}
                          />
                        </div>
                      </div>

                      {/* Alertas */}
                      {alertas.length > 0 && (
                        <div className="mt-4 space-y-2">
                          {alertas.map((alerta, idx) => (
                            <div 
                              key={idx}
                              className={`flex items-start gap-2 p-2 rounded text-sm ${
                                alerta.severidade === 'error' 
                                  ? 'bg-destructive/10 text-destructive' 
                                  : alerta.severidade === 'warning'
                                    ? 'bg-warning/10 text-warning'
                                    : 'bg-muted'
                              }`}
                            >
                              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                              <span>{alerta.mensagem}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            </ScrollArea>

            <div className="flex justify-end gap-2 p-6 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-secondary hover:bg-secondary/90">
                {formula ? "Salvar Alterações" : "Criar Fórmula"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
