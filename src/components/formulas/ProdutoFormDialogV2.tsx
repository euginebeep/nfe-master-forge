import { useState, useEffect, useCallback } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Package, Plus, Trash2, AlertTriangle, Beaker, Scale, Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { 
  useProdutosFormulacao, 
  useInsumosFormulacao,
  usePerfisExcipiente,
} from "@/hooks/use-formulas-industrial";
import { useLotesDoInsumo, formatarPotencia } from "@/hooks/use-lotes-formulacao";
import { 
  ProdutoFormulacao,
  TipoCapsulaIndustrial,
  CAPSULAS_CAPACIDADE,
} from "@/types/formulas-industrial";
import {
  calcularMassaRealComPotenciaLote,
  verificarDiluicaoGeometrica,
  autocompletarNomeRotulo,
  ProdutoAtivoComLote,
} from "@/types/lote-formulacao";

// ========================================
// COMPONENTE: LINHA DE ATIVO COM LOTE
// ========================================

interface AtivoRowProps {
  index: number;
  control: any;
  setValue: any;
  watch: any;
  remove: () => void;
  insumosAtivos: any[];
}

function AtivoRow({ index, control, setValue, watch, remove, insumosAtivos }: AtivoRowProps) {
  const insumoId = watch(`ativos.${index}.insumo_id`);
  const loteId = watch(`ativos.${index}.lote_id`);
  const doseDeclarada = watch(`ativos.${index}.dose_declarada`);
  const unidadeDose = watch(`ativos.${index}.unidade_dose`);
  
  const { lotes, isLoading: loadingLotes } = useLotesDoInsumo(insumoId);
  const loteSelecionado = lotes.find(l => l.id === loteId);
  
  // Recalcular quando mudar dose/lote
  useEffect(() => {
    if (loteSelecionado && doseDeclarada > 0) {
      const resultado = calcularMassaRealComPotenciaLote(
        doseDeclarada,
        unidadeDose,
        loteSelecionado.tipo_potencia,
        loteSelecionado.potencia_valor
      );
      
      setValue(`ativos.${index}.massa_real_mg`, resultado.massa_mg);
      setValue(`ativos.${index}.equivalente_mcg`, resultado.equivalente_mcg);
      setValue(`ativos.${index}.lote_potencia_tipo`, loteSelecionado.tipo_potencia);
      setValue(`ativos.${index}.lote_potencia_valor`, loteSelecionado.potencia_valor);
      setValue(`ativos.${index}.lote_numero`, loteSelecionado.numero_lote);
      
      const diluicao = verificarDiluicaoGeometrica(resultado.massa_mg);
      setValue(`ativos.${index}.pesagem_critica`, diluicao.pesagem_critica);
      setValue(`ativos.${index}.requer_diluicao`, diluicao.requer_diluicao);
      setValue(`ativos.${index}.sugestao_premix`, diluicao.sugestao_premix);
    }
  }, [loteSelecionado, doseDeclarada, unidadeDose, setValue, index]);
  
  const massaRealMg = watch(`ativos.${index}.massa_real_mg`) || 0;
  const equivalenteMcg = watch(`ativos.${index}.equivalente_mcg`) || 0;
  const pesagemCritica = watch(`ativos.${index}.pesagem_critica`);
  const requerDiluicao = watch(`ativos.${index}.requer_diluicao`);
  const sugestaoPremix = watch(`ativos.${index}.sugestao_premix`);
  
  const handleInsumoSelect = (id: string) => {
    const insumo = insumosAtivos.find(i => i.id === id);
    if (insumo) {
      setValue(`ativos.${index}.nome_insumo`, insumo.nome_interno);
      setValue(`ativos.${index}.nome_rotulo`, insumo.nome_rotulo || '');
      // Limpar lote ao trocar insumo
      setValue(`ativos.${index}.lote_id`, '');
      setValue(`ativos.${index}.massa_real_mg`, 0);
    }
  };
  
  const handleNomeRotuloKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab') {
      const input = e.currentTarget.value;
      const sugestao = autocompletarNomeRotulo(input);
      if (sugestao) {
        e.preventDefault();
        setValue(`ativos.${index}.nome_rotulo`, sugestao);
      }
    }
  };
  
  return (
    <Card className={`${requerDiluicao ? 'border-destructive bg-destructive/5' : pesagemCritica ? 'border-warning bg-warning/5' : ''}`}>
      <CardContent className="pt-4 space-y-3">
        <div className="flex justify-between items-start">
          <div className="flex-1 grid grid-cols-2 gap-3">
            {/* Insumo */}
            <FormField
              control={control}
              name={`ativos.${index}.insumo_id`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Insumo (Cadastro) *</FormLabel>
                  <Select 
                    value={field.value} 
                    onValueChange={(v) => {
                      field.onChange(v);
                      handleInsumoSelect(v);
                    }}
                  >
                    <FormControl>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Selecione o insumo..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {insumosAtivos.map(insumo => (
                        <SelectItem key={insumo.id} value={insumo.id}>
                          {insumo.nome_interno}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Lote (com potência) */}
            <FormField
              control={control}
              name={`ativos.${index}.lote_id`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Lote (Potência) *</FormLabel>
                  <Select 
                    value={field.value} 
                    onValueChange={field.onChange}
                    disabled={!insumoId || loadingLotes}
                  >
                    <FormControl>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder={loadingLotes ? "Carregando..." : "Selecione o lote..."} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {lotes.length === 0 ? (
                        <div className="p-2 text-sm text-muted-foreground text-center">
                          Nenhum lote disponível
                        </div>
                      ) : (
                        lotes.map(lote => (
                          <SelectItem key={lote.id} value={lote.id}>
                            <div className="flex flex-col">
                              <span>{lote.numero_lote}</span>
                              <span className="text-xs text-muted-foreground">
                                {formatarPotencia(lote.tipo_potencia, lote.potencia_valor)}
                              </span>
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="text-destructive hover:text-destructive ml-2 mt-6"
            onClick={remove}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Linha 2: Dose e Nome Rótulo */}
        <div className="grid grid-cols-4 gap-3">
          <FormField
            control={control}
            name={`ativos.${index}.dose_declarada`}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Dose Declarada *</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    step="any" 
                    className="h-9"
                    placeholder="Ex: 2000"
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={control}
            name={`ativos.${index}.unidade_dose`}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Unidade</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="UI">UI</SelectItem>
                    <SelectItem value="mg">mg</SelectItem>
                    <SelectItem value="mcg">mcg</SelectItem>
                    <SelectItem value="g">g</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={control}
            name={`ativos.${index}.nome_rotulo`}
            render={({ field }) => (
              <FormItem className="col-span-2">
                <FormLabel className="text-xs flex items-center gap-1">
                  Nome no Rótulo
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Digite e pressione TAB para autocompletar</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </FormLabel>
                <FormControl>
                  <Input 
                    className="h-9"
                    placeholder="vitamina d + TAB"
                    {...field}
                    onKeyDown={handleNomeRotuloKeyDown}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        {/* Resultados calculados */}
        {loteSelecionado && massaRealMg > 0 && (
          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Scale className="h-4 w-4 text-secondary" />
              Cálculo Automático
            </div>
            
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Potência do Lote:</span>
                <div className="font-mono font-medium">
                  {formatarPotencia(loteSelecionado.tipo_potencia, loteSelecionado.potencia_valor)}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Massa Real/Cápsula:</span>
                <div className={`font-mono font-medium ${requerDiluicao ? 'text-destructive' : pesagemCritica ? 'text-warning' : 'text-secondary'}`}>
                  {massaRealMg.toFixed(3)} mg
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Equivalente:</span>
                <div className="font-mono font-medium">
                  {equivalenteMcg.toFixed(2)} mcg
                </div>
              </div>
            </div>
            
            {/* Alerta de segurança */}
            {requerDiluicao && (
              <Alert variant="destructive" className="mt-2">
                <Beaker className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  <strong>DILUIÇÃO GEOMÉTRICA OBRIGATÓRIA!</strong><br/>
                  {sugestaoPremix}
                </AlertDescription>
              </Alert>
            )}
            
            {pesagemCritica && !requerDiluicao && (
              <Alert className="mt-2 border-warning bg-warning/10">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <AlertDescription className="text-xs">
                  <strong>Pesagem Crítica</strong> - Usar balança analítica com precisão mínima de 0.001g
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
        
        {/* Aviso quando falta lote */}
        {insumoId && !loteId && lotes.length === 0 && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Este insumo não possui lotes disponíveis. Cadastre um lote com a potência informada pelo fornecedor.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

// ========================================
// SCHEMA DO FORMULÁRIO
// ========================================

const ativoSchema = z.object({
  id: z.string(),
  insumo_id: z.string().min(1, "Selecione um insumo"),
  nome_insumo: z.string(),
  nome_rotulo: z.string().optional(),
  lote_id: z.string().optional(),
  lote_numero: z.string().optional(),
  lote_potencia_tipo: z.string().optional(),
  lote_potencia_valor: z.coerce.number().optional(),
  dose_declarada: z.coerce.number().min(0.001, "Dose obrigatória"),
  unidade_dose: z.string(),
  massa_real_mg: z.coerce.number().optional(),
  equivalente_mcg: z.coerce.number().optional(),
  pesagem_critica: z.boolean().optional(),
  requer_diluicao: z.boolean().optional(),
  sugestao_premix: z.string().optional(),
});

const produtoSchema = z.object({
  nome_comercial: z.string().min(1, "Nome comercial obrigatório"),
  descricao: z.string().optional(),
  dose_diaria: z.coerce.number().min(1, "Dose por dia obrigatória"),
  ativos: z.array(ativoSchema).min(1, "Adicione pelo menos um ativo"),
  tipo_capsula_padrao: z.string(),
  capacidade_alvo: z.coerce.number().min(1, "Capacidade obrigatória"),
  perfil_excipiente_id: z.string().optional(),
});

type FormValues = z.infer<typeof produtoSchema>;

// ========================================
// COMPONENTE PRINCIPAL
// ========================================

interface ProdutoFormDialogV2Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  produto?: ProdutoFormulacao | null;
  onSuccess?: () => void;
}

const TIPOS_CAPSULA = Object.keys(CAPSULAS_CAPACIDADE) as TipoCapsulaIndustrial[];

export function ProdutoFormDialogV2({
  open,
  onOpenChange,
  produto,
  onSuccess,
}: ProdutoFormDialogV2Props) {
  const { create, update } = useProdutosFormulacao();
  const { data: insumos } = useInsumosFormulacao();
  const { data: perfis } = usePerfisExcipiente();
  const isEdit = !!produto;

  // Filtrar apenas insumos ativos
  const insumosAtivos = insumos.filter(i => i.categoria === 'ATIVO');

  const form = useForm<FormValues>({
    resolver: zodResolver(produtoSchema),
    defaultValues: {
      nome_comercial: "",
      descricao: "",
      dose_diaria: 1,
      ativos: [],
      tipo_capsula_padrao: "0",
      capacidade_alvo: 490,
      perfil_excipiente_id: "",
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "ativos",
  });

  useEffect(() => {
    if (produto) {
      form.reset({
        nome_comercial: produto.nome_comercial,
        descricao: produto.descricao || "",
        dose_diaria: produto.dose_diaria,
        ativos: produto.ativos.map(a => ({
          id: a.id,
          insumo_id: a.insumo_id,
          nome_insumo: a.nome_insumo,
          nome_rotulo: '',
          lote_id: '',
          lote_numero: '',
          dose_declarada: a.dose_diaria,
          unidade_dose: a.unidade_dose,
          massa_real_mg: 0,
          equivalente_mcg: 0,
        })),
        tipo_capsula_padrao: produto.tipo_capsula_padrao,
        capacidade_alvo: produto.capacidade_alvo,
        perfil_excipiente_id: produto.perfil_excipiente_id || "",
      });
    } else {
      const perfilPadrao = perfis.find(p => p.padrao);
      form.reset({
        nome_comercial: "",
        descricao: "",
        dose_diaria: 1,
        ativos: [],
        tipo_capsula_padrao: "0",
        capacidade_alvo: 490,
        perfil_excipiente_id: perfilPadrao?.id || "",
      });
    }
  }, [produto, form, perfis]);

  // Atualizar capacidade quando muda tipo de cápsula
  const tipoCapsula = form.watch("tipo_capsula_padrao");
  useEffect(() => {
    if (!produto && tipoCapsula) {
      const cap = CAPSULAS_CAPACIDADE[tipoCapsula as TipoCapsulaIndustrial];
      if (cap) {
        form.setValue("capacidade_alvo", cap.alvo);
      }
    }
  }, [tipoCapsula, form, produto]);

  const handleAddAtivo = () => {
    append({
      id: crypto.randomUUID(),
      insumo_id: "",
      nome_insumo: "",
      nome_rotulo: "",
      lote_id: "",
      lote_numero: "",
      dose_declarada: 0,
      unidade_dose: "UI",
      massa_real_mg: 0,
      equivalente_mcg: 0,
    });
  };

  const onSubmit = (data: FormValues) => {
    // Verificar se há diluição geométrica obrigatória não atendida
    const ativosComDiluicao = data.ativos.filter(a => a.requer_diluicao);
    if (ativosComDiluicao.length > 0) {
      // Apenas alerta, não bloqueia
    }
    
    const produtoData = {
      nome_comercial: data.nome_comercial,
      descricao: data.descricao || undefined,
      dose_diaria: data.dose_diaria,
      ativos: data.ativos.map(a => ({
        id: a.id,
        insumo_id: a.insumo_id,
        nome_insumo: a.nome_insumo,
        dose_diaria: a.dose_declarada,
        unidade_dose: a.unidade_dose as 'mg' | 'mcg' | 'UI' | 'g',
        materia_prima_padrao_id: a.lote_id,
      })),
      tipo_capsula_padrao: data.tipo_capsula_padrao as TipoCapsulaIndustrial,
      capacidade_alvo: data.capacidade_alvo,
      perfil_excipiente_id: data.perfil_excipiente_id || undefined,
      ativo: true,
    };

    if (isEdit && produto) {
      update(produto.id, produtoData);
    } else {
      create(produtoData);
    }

    onSuccess?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-secondary" />
            {isEdit ? "Editar Produto" : "Novo Produto"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <ScrollArea className="max-h-[65vh] pr-4">
              <div className="space-y-4">
                {/* Aviso das regras */}
                <Alert className="bg-muted/50">
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    <strong>REGRAS:</strong> Insumos existentes são selecionados do cadastro. 
                    Potência vem do Lote (COA do fornecedor). 
                    Cálculos de massa são automáticos.
                  </AlertDescription>
                </Alert>
                
                {/* Identificação */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="nome_comercial"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome Comercial *</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Vitamina D3 + K2" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="dose_diaria"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Doses por Dia</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} />
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
                          placeholder="Descrição do produto..."
                          className="resize-none"
                          rows={2}
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Separator />

                {/* Ativos */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">
                      Ativos por Dose Diária
                    </h4>
                    <Button 
                      type="button" 
                      size="sm" 
                      variant="secondary"
                      onClick={handleAddAtivo}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Adicionar Ativo
                    </Button>
                  </div>
                  
                  {fields.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                      <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>Nenhum ativo adicionado</p>
                      <p className="text-sm">Clique em "Adicionar Ativo" para incluir ingredientes</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {fields.map((field, index) => (
                        <AtivoRow
                          key={field.id}
                          index={index}
                          control={form.control}
                          setValue={form.setValue}
                          watch={form.watch}
                          remove={() => remove(index)}
                          insumosAtivos={insumosAtivos}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <Separator />

                {/* Configurações padrão */}
                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="tipo_capsula_padrao"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de Cápsula</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {TIPOS_CAPSULA.map(tipo => (
                              <SelectItem key={tipo} value={tipo}>
                                {tipo} ({CAPSULAS_CAPACIDADE[tipo].alvo}mg)
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
                    name="capacidade_alvo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Capacidade Alvo (mg)</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="perfil_excipiente_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Perfil Excipiente</FormLabel>
                        <Select value={field.value || ""} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {perfis.map(perfil => (
                              <SelectItem key={perfil.id} value={perfil.id}>
                                {perfil.nome} {perfil.padrao && '(padrão)'}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </ScrollArea>

            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-secondary hover:bg-secondary/90">
                {isEdit ? "Salvar" : "Cadastrar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
