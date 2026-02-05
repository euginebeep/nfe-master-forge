import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Package, Plus, Trash2 } from "lucide-react";
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  useProdutosFormulacao, 
  useInsumosFormulacao,
  usePerfisExcipiente,
} from "@/hooks/use-formulas-industrial";
import { 
  ProdutoFormulacao,
  TipoCapsulaIndustrial,
  CAPSULAS_CAPACIDADE,
} from "@/types/formulas-industrial";

const ativoSchema = z.object({
  id: z.string(),
  insumo_id: z.string().min(1, "Selecione um insumo"),
  nome_insumo: z.string(),
  dose_diaria: z.coerce.number().min(0.001, "Dose obrigatória"),
  unidade_dose: z.string(),
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

interface ProdutoFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  produto?: ProdutoFormulacao | null;
  onSuccess?: () => void;
}

const TIPOS_CAPSULA = Object.keys(CAPSULAS_CAPACIDADE) as TipoCapsulaIndustrial[];

const UNIDADES_DOSE = [
  { value: 'mg', label: 'mg (miligramas)' },
  { value: 'mcg', label: 'mcg (microgramas)' },
  { value: 'UI', label: 'UI (unidades internacionais)' },
  { value: 'g', label: 'g (gramas)' },
];

export function ProdutoFormDialog({
  open,
  onOpenChange,
  produto,
  onSuccess,
}: ProdutoFormDialogProps) {
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
          dose_diaria: a.dose_diaria,
          unidade_dose: a.unidade_dose,
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
      dose_diaria: 0,
      unidade_dose: "mg",
    });
  };

  const handleInsumoSelect = (index: number, insumoId: string) => {
    const insumo = insumos.find(i => i.id === insumoId);
    if (insumo) {
      form.setValue(`ativos.${index}.nome_insumo`, insumo.nome_interno);
    }
  };

  const onSubmit = (data: FormValues) => {
    const produtoData = {
      nome_comercial: data.nome_comercial,
      descricao: data.descricao || undefined,
      dose_diaria: data.dose_diaria,
      ativos: data.ativos.map(a => ({
        id: a.id,
        insumo_id: a.insumo_id,
        nome_insumo: a.nome_insumo,
        dose_diaria: a.dose_diaria,
        unidade_dose: a.unidade_dose as 'mg' | 'mcg' | 'UI' | 'g',
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-secondary" />
            {isEdit ? "Editar Produto" : "Novo Produto"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-4">
                {/* Identificação */}
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
                <Card>
                  <CardHeader className="py-3 flex-row items-center justify-between">
                    <CardTitle className="text-sm font-medium">
                      Ativos por Dose Diária
                    </CardTitle>
                    <Button 
                      type="button" 
                      size="sm" 
                      variant="secondary"
                      onClick={handleAddAtivo}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Adicionar
                    </Button>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    {fields.length === 0 ? (
                      <div className="text-center py-6 text-muted-foreground">
                        <p>Nenhum ativo adicionado</p>
                        <p className="text-sm">Clique em "Adicionar" para incluir ativos</p>
                      </div>
                    ) : (
                      fields.map((field, index) => (
                        <div 
                          key={field.id} 
                          className="grid grid-cols-12 gap-2 items-end p-3 bg-muted/30 rounded-lg"
                        >
                          <div className="col-span-5">
                            <FormField
                              control={form.control}
                              name={`ativos.${index}.insumo_id`}
                              render={({ field }) => (
                                <FormItem>
                                  {index === 0 && <FormLabel>Insumo *</FormLabel>}
                                  <Select 
                                    value={field.value} 
                                    onValueChange={(v) => {
                                      field.onChange(v);
                                      handleInsumoSelect(index, v);
                                    }}
                                  >
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Selecione..." />
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
                          </div>
                          <div className="col-span-3">
                            <FormField
                              control={form.control}
                              name={`ativos.${index}.dose_diaria`}
                              render={({ field }) => (
                                <FormItem>
                                  {index === 0 && <FormLabel>Dose Diária *</FormLabel>}
                                  <FormControl>
                                    <Input type="number" step="any" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <div className="col-span-3">
                            <FormField
                              control={form.control}
                              name={`ativos.${index}.unidade_dose`}
                              render={({ field }) => (
                                <FormItem>
                                  {index === 0 && <FormLabel>Unidade *</FormLabel>}
                                  <Select value={field.value} onValueChange={field.onChange}>
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {UNIDADES_DOSE.map(u => (
                                        <SelectItem key={u.value} value={u.value}>
                                          {u.value}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <div className="col-span-1">
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={() => remove(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                <Separator />

                {/* Configurações padrão */}
                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="tipo_capsula_padrao"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de Cápsula Padrão</FormLabel>
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
                        <FormDescription>Margem de segurança</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="perfil_excipiente_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Perfil de Excipiente</FormLabel>
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
