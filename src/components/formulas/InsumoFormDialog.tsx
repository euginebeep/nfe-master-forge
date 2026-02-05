import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Beaker, Droplets, AlertTriangle } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
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
import { useInsumosFormulacao } from "@/hooks/use-formulas-industrial";
import { 
  InsumoFormulacao, 
  CategoriaInsumo, 
  TipoPotencia,
  NivelHigroscopicidade,
} from "@/types/formulas-industrial";

const insumoSchema = z.object({
  nome_interno: z.string().min(1, "Nome interno obrigatório"),
  nome_rotulo: z.string().min(1, "Nome para rótulo obrigatório"),
  categoria: z.string().min(1, "Categoria obrigatória"),
  tipo_potencia: z.string(),
  valor_potencia: z.coerce.number().optional(),
  percentual_elementar: z.coerce.number().optional(),
  higroscopico: z.boolean(),
  nivel_higroscopicidade: z.string().optional(),
  observacoes_processo: z.string().optional(),
});

type FormValues = z.infer<typeof insumoSchema>;

interface InsumoFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  insumo?: InsumoFormulacao | null;
  onSuccess?: () => void;
}

const CATEGORIAS: { value: CategoriaInsumo; label: string; descricao: string }[] = [
  { value: 'ATIVO', label: 'Ativo', descricao: 'Princípio ativo com efeito funcional' },
  { value: 'EXCIPIENTE', label: 'Excipiente', descricao: 'Sem potência funcional (100%)' },
  { value: 'ADITIVO_TECNOLOGICO', label: 'Aditivo Tecnológico', descricao: 'Melhora fluxo, estabilidade, etc.' },
];

const TIPOS_POTENCIA: { value: TipoPotencia; label: string; descricao: string; exemplo: string }[] = [
  { value: 'NENHUMA', label: 'Nenhuma', descricao: 'Sem potência', exemplo: 'Para excipientes' },
  { value: 'PERCENTUAL', label: 'Percentual (%)', descricao: 'Concentração em %', exemplo: '0.2% = 0.002' },
  { value: 'UI_POR_GRAMA', label: 'UI/g', descricao: 'Unidades internacionais por grama', exemplo: '100.000 UI/g' },
  { value: 'MG_POR_GRAMA', label: 'mg/g', descricao: 'Miligramas por grama', exemplo: '500 mg/g' },
];

const NIVEIS_HIGROSCOPICIDADE: { value: NivelHigroscopicidade; label: string }[] = [
  { value: 'BAIXO', label: 'Baixo' },
  { value: 'MEDIO', label: 'Médio' },
  { value: 'ALTO', label: 'Alto' },
];

export function InsumoFormDialog({
  open,
  onOpenChange,
  insumo,
  onSuccess,
}: InsumoFormDialogProps) {
  const { create, update } = useInsumosFormulacao();
  const isEdit = !!insumo;

  const form = useForm<FormValues>({
    resolver: zodResolver(insumoSchema),
    defaultValues: {
      nome_interno: "",
      nome_rotulo: "",
      categoria: "ATIVO",
      tipo_potencia: "NENHUMA",
      valor_potencia: undefined,
      percentual_elementar: undefined,
      higroscopico: false,
      nivel_higroscopicidade: undefined,
      observacoes_processo: "",
    },
  });

  useEffect(() => {
    if (insumo) {
      form.reset({
        nome_interno: insumo.nome_interno,
        nome_rotulo: insumo.nome_rotulo,
        categoria: insumo.categoria,
        tipo_potencia: insumo.tipo_potencia,
        valor_potencia: insumo.valor_potencia,
        percentual_elementar: insumo.percentual_elementar,
        higroscopico: insumo.higroscopico,
        nivel_higroscopicidade: insumo.nivel_higroscopicidade,
        observacoes_processo: insumo.observacoes_processo || "",
      });
    } else {
      form.reset({
        nome_interno: "",
        nome_rotulo: "",
        categoria: "ATIVO",
        tipo_potencia: "NENHUMA",
        valor_potencia: undefined,
        percentual_elementar: undefined,
        higroscopico: false,
        nivel_higroscopicidade: undefined,
        observacoes_processo: "",
      });
    }
  }, [insumo, form]);

  const categoria = form.watch("categoria");
  const tipoPotencia = form.watch("tipo_potencia");
  const higroscopico = form.watch("higroscopico");

  // Se for excipiente, forçar potência NENHUMA
  useEffect(() => {
    if (categoria === 'EXCIPIENTE') {
      form.setValue('tipo_potencia', 'NENHUMA');
      form.setValue('valor_potencia', undefined);
    }
  }, [categoria, form]);

  const onSubmit = (data: FormValues) => {
    const insumoData = {
      nome_interno: data.nome_interno,
      nome_rotulo: data.nome_rotulo,
      categoria: data.categoria as CategoriaInsumo,
      tipo_potencia: data.tipo_potencia as TipoPotencia,
      valor_potencia: data.tipo_potencia !== 'NENHUMA' ? data.valor_potencia : undefined,
      percentual_elementar: data.percentual_elementar,
      higroscopico: data.higroscopico,
      nivel_higroscopicidade: data.higroscopico ? data.nivel_higroscopicidade as NivelHigroscopicidade : undefined,
      observacoes_processo: data.observacoes_processo || undefined,
    };

    if (isEdit && insumo) {
      update(insumo.id, insumoData);
    } else {
      create(insumoData);
    }

    onSuccess?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Beaker className="h-5 w-5 text-secondary" />
            {isEdit ? "Editar Insumo" : "Novo Insumo"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-4">
                {/* Identificação */}
                <div className="grid grid-cols-1 gap-4">
                  <FormField
                    control={form.control}
                    name="nome_interno"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome Interno *</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Vitamina D3 100.000UI/g" {...field} />
                        </FormControl>
                        <FormDescription>Nome usado na produção</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="nome_rotulo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome no Rótulo *</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Vitamina D (Colecalciferol)" {...field} />
                        </FormControl>
                        <FormDescription>Nome que aparece no rótulo do produto</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Separator />

                {/* Categoria */}
                <FormField
                  control={form.control}
                  name="categoria"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Categoria *</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {CATEGORIAS.map(cat => (
                            <SelectItem key={cat.value} value={cat.value}>
                              <div>
                                <span className="font-medium">{cat.label}</span>
                                <span className="text-muted-foreground text-xs ml-2">
                                  {cat.descricao}
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

                {/* Potência - apenas para não-excipientes */}
                {categoria !== 'EXCIPIENTE' && (
                  <>
                    <Separator />
                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="tipo_potencia"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tipo de Potência</FormLabel>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {TIPOS_POTENCIA.map(tipo => (
                                  <SelectItem key={tipo.value} value={tipo.value}>
                                    <div className="flex flex-col">
                                      <span className="font-medium">{tipo.label}</span>
                                      <span className="text-muted-foreground text-xs">
                                        {tipo.exemplo}
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

                      {tipoPotencia !== 'NENHUMA' && (
                        <FormField
                          control={form.control}
                          name="valor_potencia"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                Valor da Potência *
                                {tipoPotencia === 'PERCENTUAL' && ' (ex: 0.002 para 0.2%)'}
                                {tipoPotencia === 'UI_POR_GRAMA' && ' (ex: 100000)'}
                                {tipoPotencia === 'MG_POR_GRAMA' && ' (ex: 500)'}
                              </FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  step="any"
                                  placeholder={
                                    tipoPotencia === 'PERCENTUAL' ? '0.002' :
                                    tipoPotencia === 'UI_POR_GRAMA' ? '100000' : '500'
                                  }
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                      <FormField
                        control={form.control}
                        name="percentual_elementar"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>% Elementar (opcional)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                step="0.1"
                                placeholder="Ex: 16 para Citrato de Magnésio"
                                {...field} 
                              />
                            </FormControl>
                            <FormDescription>
                              Para minerais: % do elemento ativo na molécula
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </>
                )}

                <Separator />

                {/* Flags técnicas */}
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="higroscopico"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="flex items-center gap-2">
                            <Droplets className="h-4 w-4 text-primary" />
                            Higroscópico
                          </FormLabel>
                          <FormDescription>
                            Absorve umidade do ambiente
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {higroscopico && (
                    <FormField
                      control={form.control}
                      name="nivel_higroscopicidade"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-warning" />
                            Nível de Higroscopicidade
                          </FormLabel>
                          <Select value={field.value || ""} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o nível" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {NIVEIS_HIGROSCOPICIDADE.map(nivel => (
                                <SelectItem key={nivel.value} value={nivel.value}>
                                  {nivel.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>

                <Separator />

                {/* Observações */}
                <FormField
                  control={form.control}
                  name="observacoes_processo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Observações de Processo</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Instruções especiais de manipulação..."
                          className="resize-none"
                          rows={3}
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
