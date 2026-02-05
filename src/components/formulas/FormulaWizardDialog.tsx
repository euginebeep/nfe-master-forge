import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  FlaskConical, ChevronRight, ChevronLeft, AlertTriangle, 
  CheckCircle2, XCircle, Droplets, Info, Lightbulb
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  useProdutosFormulacao,
  usePerfisExcipiente,
  useInsumosFormulacao,
  useCreateFormulaIndustrial,
  CriarFormulaParams,
} from "@/hooks/use-formulas-industrial";
import { 
  FormulaIndustrial,
  TipoCapsulaIndustrial,
  CAPSULAS_CAPACIDADE,
} from "@/types/formulas-industrial";

const wizardSchema = z.object({
  produto_id: z.string().min(1, "Selecione um produto"),
  capsulas_por_dose: z.coerce.number().min(1).max(2),
  numero_doses: z.coerce.number().min(1, "Quantidade de doses obrigatória"),
  perfil_excipiente_id: z.string().min(1, "Selecione um perfil de excipiente"),
  tipo_capsula: z.string().optional(),
  capacidade_alvo: z.coerce.number().optional(),
});

type FormValues = z.infer<typeof wizardSchema>;

interface FormulaWizardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const TIPOS_CAPSULA = Object.keys(CAPSULAS_CAPACIDADE) as TipoCapsulaIndustrial[];

export function FormulaWizardDialog({
  open,
  onOpenChange,
  onSuccess,
}: FormulaWizardDialogProps) {
  const [step, setStep] = useState(1);
  const [preview, setPreview] = useState<Omit<FormulaIndustrial, 'id' | 'codigo' | 'created_at' | 'updated_at'> | null>(null);

  const { data: produtos } = useProdutosFormulacao();
  const { data: perfis, perfilPadrao } = usePerfisExcipiente();
  const { data: insumos } = useInsumosFormulacao();
  const { calcularFormula, create } = useCreateFormulaIndustrial();

  const form = useForm<FormValues>({
    resolver: zodResolver(wizardSchema),
    defaultValues: {
      produto_id: "",
      capsulas_por_dose: 1,
      numero_doses: 30,
      perfil_excipiente_id: perfilPadrao?.id || "",
      tipo_capsula: undefined,
      capacidade_alvo: undefined,
    },
  });

  // Produto selecionado
  const produtoId = form.watch("produto_id");
  const produtoSelecionado = useMemo(() => 
    produtos.find(p => p.id === produtoId),
    [produtos, produtoId]
  );

  // Reset quando abre
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setStep(1);
      setPreview(null);
      form.reset({
        produto_id: "",
        capsulas_por_dose: 1,
        numero_doses: 30,
        perfil_excipiente_id: perfilPadrao?.id || "",
      });
    }
    onOpenChange(open);
  };

  // Calcular preview quando avança para step 2
  const handleNext = () => {
    if (step === 1) {
      const data = form.getValues();
      if (!data.produto_id || !data.perfil_excipiente_id) {
        form.trigger();
        return;
      }

      const produto = produtos.find(p => p.id === data.produto_id);
      if (!produto) return;

      const params: CriarFormulaParams = {
        produto_id: data.produto_id,
        capsulas_por_dose: data.capsulas_por_dose as 1 | 2,
        numero_doses: data.numero_doses,
        perfil_excipiente_id: data.perfil_excipiente_id,
        tipo_capsula: data.tipo_capsula as TipoCapsulaIndustrial | undefined,
        capacidade_alvo: data.capacidade_alvo,
      };

      const resultado = calcularFormula(produto, insumos, params);
      if (resultado) {
        setPreview(resultado);
        setStep(2);
      }
    }
  };

  const handleBack = () => {
    setStep(1);
    setPreview(null);
  };

  const handleSave = () => {
    if (preview) {
      const formula = create(preview);
      if (formula) {
        onSuccess?.();
        handleOpenChange(false);
      }
    }
  };

  // Recalcular quando muda configurações
  const handleRecalcular = () => {
    const data = form.getValues();
    const produto = produtos.find(p => p.id === data.produto_id);
    if (!produto) return;

    const params: CriarFormulaParams = {
      produto_id: data.produto_id,
      capsulas_por_dose: data.capsulas_por_dose as 1 | 2,
      numero_doses: data.numero_doses,
      perfil_excipiente_id: data.perfil_excipiente_id,
      tipo_capsula: data.tipo_capsula as TipoCapsulaIndustrial | undefined,
      capacidade_alvo: data.capacidade_alvo,
    };

    const resultado = calcularFormula(produto, insumos, params);
    if (resultado) {
      setPreview(resultado);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-secondary" />
            Nova Fórmula Industrial
          </DialogTitle>
        </DialogHeader>

        {/* Progress */}
        <div className="flex items-center gap-4 mb-4">
          <div className={`flex items-center gap-2 ${step >= 1 ? 'text-secondary' : 'text-muted-foreground'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step >= 1 ? 'bg-secondary text-secondary-foreground' : 'bg-muted'}`}>
              1
            </div>
            <span className="text-sm font-medium">Configuração</span>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <div className={`flex items-center gap-2 ${step >= 2 ? 'text-secondary' : 'text-muted-foreground'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step >= 2 ? 'bg-secondary text-secondary-foreground' : 'bg-muted'}`}>
              2
            </div>
            <span className="text-sm font-medium">Revisão</span>
          </div>
        </div>

        <Form {...form}>
          {step === 1 && (
            <div className="space-y-6">
              {/* Seleção de Produto */}
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm font-medium">1. Escolha o Produto</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <FormField
                    control={form.control}
                    name="produto_id"
                    render={({ field }) => (
                      <FormItem>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione um produto cadastrado..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {produtos.length === 0 ? (
                              <div className="p-4 text-center text-muted-foreground">
                                Nenhum produto cadastrado
                              </div>
                            ) : (
                              produtos.map(produto => (
                                <SelectItem key={produto.id} value={produto.id}>
                                  <div className="flex flex-col">
                                    <span className="font-medium">{produto.nome_comercial}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {produto.ativos.length} ativo(s) • Cápsula {produto.tipo_capsula_padrao}
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

                  {produtoSelecionado && (
                    <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                      <p className="text-sm font-medium mb-2">Ativos do produto:</p>
                      <div className="flex flex-wrap gap-2">
                        {produtoSelecionado.ativos.map(ativo => (
                          <Badge key={ativo.id} variant="secondary">
                            {ativo.nome_insumo}: {ativo.dose_diaria} {ativo.unidade_dose}/dia
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Configuração de Dose */}
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm font-medium">2. Configuração de Dose</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="capsulas_por_dose"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cápsulas por Dose *</FormLabel>
                          <Select 
                            value={String(field.value)} 
                            onValueChange={(v) => field.onChange(Number(v))}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="1">1 cápsula por dose</SelectItem>
                              <SelectItem value="2">2 cápsulas por dose</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            A dose diária será dividida entre as cápsulas
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="numero_doses"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Quantidade de Doses *</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="30" {...field} />
                          </FormControl>
                          <FormDescription>
                            Total de doses no lote (ex: 30, 60, 90)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Perfil de Excipiente */}
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm font-medium">3. Perfil de Excipiente</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <FormField
                    control={form.control}
                    name="perfil_excipiente_id"
                    render={({ field }) => (
                      <FormItem>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione um perfil..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {perfis.map(perfil => (
                              <SelectItem key={perfil.id} value={perfil.id}>
                                <div className="flex flex-col">
                                  <span className="font-medium">
                                    {perfil.nome} {perfil.padrao && '(padrão)'}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {perfil.itens.map(i => i.nome).join(', ')}
                                  </span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* Opções avançadas */}
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Opções Avançadas (opcional)
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="tipo_capsula"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo de Cápsula</FormLabel>
                          <Select 
                            value={field.value || "default"} 
                            onValueChange={(v) => field.onChange(v === "default" ? undefined : v)}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Usar do produto" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="default">Usar do produto</SelectItem>
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
                            <Input 
                              type="number" 
                              placeholder="Usar do produto"
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {step === 2 && preview && (
            <ScrollArea className="h-[60vh] pr-4">
              <div className="space-y-4">
                {/* Status da fórmula */}
                <Card className={
                  preview.status_ocupacao === 'NAO_CABE' 
                    ? 'border-destructive' 
                    : preview.status_ocupacao === 'ATENCAO' 
                      ? 'border-warning' 
                      : 'border-secondary'
                }>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        {preview.status_ocupacao === 'OK' && (
                          <CheckCircle2 className="h-8 w-8 text-secondary" />
                        )}
                        {preview.status_ocupacao === 'ATENCAO' && (
                          <AlertTriangle className="h-8 w-8 text-warning" />
                        )}
                        {preview.status_ocupacao === 'NAO_CABE' && (
                          <XCircle className="h-8 w-8 text-destructive" />
                        )}
                        <div>
                          <h3 className="font-semibold text-lg">{preview.nome}</h3>
                          <p className="text-sm text-muted-foreground">
                            {preview.capsulas_por_dose} cápsula(s) por dose • {preview.numero_doses} doses
                          </p>
                        </div>
                      </div>
                      <Badge 
                        variant={
                          preview.status_ocupacao === 'OK' ? 'default' :
                          preview.status_ocupacao === 'ATENCAO' ? 'secondary' : 'destructive'
                        }
                        className="text-sm"
                      >
                        {preview.status_ocupacao === 'OK' && 'Fórmula OK'}
                        {preview.status_ocupacao === 'ATENCAO' && 'Atenção'}
                        {preview.status_ocupacao === 'NAO_CABE' && 'Não Cabe'}
                      </Badge>
                    </div>

                    {/* Barra de ocupação */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Ocupação da Cápsula</span>
                        <span className="font-medium">
                          {preview.peso_total_capsula_mg.toFixed(1)}mg / {preview.capacidade_alvo_mg}mg 
                          ({preview.percentual_ocupacao.toFixed(1)}%)
                        </span>
                      </div>
                      <Progress 
                        value={Math.min(preview.percentual_ocupacao, 100)} 
                        className={`h-3 ${
                          preview.status_ocupacao === 'NAO_CABE' ? '[&>div]:bg-destructive' :
                          preview.status_ocupacao === 'ATENCAO' ? '[&>div]:bg-warning' : ''
                        }`}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Alertas */}
                {preview.alertas.length > 0 && (
                  <div className="space-y-2">
                    {preview.alertas.map((alerta, idx) => (
                      <Alert 
                        key={idx} 
                        variant={alerta.severidade === 'error' ? 'destructive' : 'default'}
                        className={alerta.severidade === 'warning' ? 'border-warning' : ''}
                      >
                        {alerta.tipo === 'HIGROSCOPICO_DETECTADO' && (
                          <Droplets className="h-4 w-4" />
                        )}
                        {alerta.tipo === 'EXCEDE_CAPACIDADE' && (
                          <XCircle className="h-4 w-4" />
                        )}
                        {alerta.tipo !== 'HIGROSCOPICO_DETECTADO' && alerta.tipo !== 'EXCEDE_CAPACIDADE' && (
                          <AlertTriangle className="h-4 w-4" />
                        )}
                        <AlertTitle className="text-sm font-medium">{alerta.mensagem}</AlertTitle>
                        {alerta.sugestoes && (
                          <AlertDescription className="mt-2">
                            <div className="flex items-start gap-2">
                              <Lightbulb className="h-4 w-4 mt-0.5 text-warning" />
                              <ul className="text-xs space-y-1">
                                {alerta.sugestoes.map((s, i) => (
                                  <li key={i}>• {s}</li>
                                ))}
                              </ul>
                            </div>
                          </AlertDescription>
                        )}
                      </Alert>
                    ))}
                  </div>
                )}

                {/* Detalhamento */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Ingredientes Ativos */}
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm font-medium flex items-center justify-between">
                        <span>Ingredientes Ativos</span>
                        <Badge variant="outline">
                          {preview.total_ativos_mg.toFixed(2)} mg
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-2">
                        {preview.ingredientes.map(ing => (
                          <div 
                            key={ing.id} 
                            className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm"
                          >
                            <div className="flex items-center gap-2">
                              {ing.higroscopico && (
                                <Droplets className="h-3 w-3 text-primary" />
                              )}
                              <span>{ing.nome_interno}</span>
                            </div>
                            <div className="text-right">
                              <div className="font-medium">
                                {ing.peso_a_pesar_mg.toFixed(2)} mg
                              </div>
                              <div className="text-xs text-muted-foreground">
                                ({ing.dose_por_capsula} {ing.unidade_dose}/cápsula)
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Excipientes */}
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm font-medium flex items-center justify-between">
                        <span>Excipientes</span>
                        <Badge variant="outline">
                          {(preview.total_excipientes_fixos_mg + preview.qsp_mg).toFixed(2)} mg
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-2">
                        {preview.excipientes.map(exc => (
                          <div 
                            key={exc.id} 
                            className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm"
                          >
                            <div className="flex items-center gap-2">
                              <span>{exc.nome}</span>
                              {exc.tipo === 'QSP' && (
                                <Badge variant="secondary" className="text-xs">Q.S.P.</Badge>
                              )}
                            </div>
                            <div className="text-right">
                              <div className="font-medium">
                                {exc.peso_mg.toFixed(2)} mg
                              </div>
                              {exc.tipo === 'PERCENTUAL_FIXO' && (
                                <div className="text-xs text-muted-foreground">
                                  ({exc.valor_percentual}%)
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Resumo */}
                <Card className="bg-muted/50">
                  <CardContent className="py-4">
                    <div className="grid grid-cols-4 gap-4 text-center">
                      <div>
                        <p className="text-2xl font-bold text-secondary">
                          {preview.peso_total_capsula_mg.toFixed(1)}
                        </p>
                        <p className="text-xs text-muted-foreground">mg/cápsula</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold">
                          {preview.capsulas_por_dose * preview.numero_doses}
                        </p>
                        <p className="text-xs text-muted-foreground">cápsulas totais</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{preview.numero_doses}</p>
                        <p className="text-xs text-muted-foreground">doses</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{preview.tipo_capsula}</p>
                        <p className="text-xs text-muted-foreground">tipo cápsula</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Opções de ajuste se não couber */}
                {preview.status_ocupacao === 'NAO_CABE' && (
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertTitle>Ajuste a fórmula</AlertTitle>
                    <AlertDescription>
                      <div className="mt-2 flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => {
                            form.setValue('capsulas_por_dose', 2);
                            handleRecalcular();
                          }}
                        >
                          Usar 2 cápsulas/dose
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => {
                            form.setValue('tipo_capsula', '00');
                            handleRecalcular();
                          }}
                        >
                          Trocar para cápsula 00
                        </Button>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </ScrollArea>
          )}
        </Form>

        <DialogFooter className="flex justify-between">
          {step === 2 ? (
            <>
              <Button type="button" variant="outline" onClick={handleBack}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Voltar
              </Button>
              <Button 
                onClick={handleSave}
                className="bg-secondary hover:bg-secondary/90"
                disabled={preview?.alertas.some(a => 
                  a.severidade === 'error' && a.tipo === 'POTENCIA_AUSENTE'
                )}
              >
                Salvar Fórmula
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleNext} className="bg-secondary hover:bg-secondary/90">
                Calcular e Revisar
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
