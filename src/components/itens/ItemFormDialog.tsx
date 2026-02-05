import { useState } from "react";
import { useForm } from "react-hook-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useCreateItem, LocalItem } from "@/hooks/use-local-itens";

interface ItemFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const TIPOS_ITEM = [
  { value: "MP", label: "Materia Prima" },
  { value: "EMBALAGEM", label: "Embalagem" },
  { value: "ROTULO", label: "Rotulo" },
  { value: "TAMPA", label: "Tampa" },
  { value: "POTE", label: "Pote" },
  { value: "SILICA", label: "Silica" },
  { value: "CAPSULA_VAZIA", label: "Capsula Vazia" },
  { value: "PA", label: "Produto Acabado" },
  { value: "OUTRO", label: "Outro" },
];

const CRITICIDADES = [
  { value: "NORMAL", label: "Normal" },
  { value: "ATENCAO", label: "Atencao" },
  { value: "CRITICO", label: "Critico" },
  { value: "ULTRA", label: "Ultra Critico" },
];

const ARMAZENAMENTOS = [
  { value: "AMBIENTE", label: "Ambiente" },
  { value: "REFRIGERADO", label: "Refrigerado" },
  { value: "PROTEGIDO_LUZ", label: "Protegido da Luz" },
  { value: "OUTRO", label: "Outro" },
];

export function ItemFormDialog({ open, onOpenChange, onSuccess }: ItemFormDialogProps) {
  const { create } = useCreateItem();
  const [tipoItem, setTipoItem] = useState("MP");
  const [criticidade, setCriticidade] = useState("NORMAL");
  const [armazenamento, setArmazenamento] = useState("AMBIENTE");
  const [unidadeInterna, setUnidadeInterna] = useState("g");
  const [controlaLote, setControlaLote] = useState(true);
  const [controlaValidade, setControlaValidade] = useState(true);
  const [higroscopico, setHigroscopico] = useState(false);
  const [exigePremix, setExigePremix] = useState(false);
  const [ativo, setAtivo] = useState(true);

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    defaultValues: {
      sku_interno: "",
      descricao_interna: "",
      descricao_comercial: "",
      categoria_operacional: "",
      ncm: "",
      ean: "",
    },
  });

  const onSubmit = (data: any) => {
    const item = create({
      ...data,
      tipo_item: tipoItem as any,
      criticidade: criticidade as any,
      armazenamento: armazenamento as any,
      unidade_interna: unidadeInterna as any,
      controla_lote: controlaLote,
      controla_validade: controlaValidade,
      higroscopico,
      exige_premix: exigePremix,
      ativo,
    } as Omit<LocalItem, 'id' | 'sku_interno'> & { sku_interno?: string });

    if (item) {
      reset();
      setTipoItem("MP");
      setCriticidade("NORMAL");
      setArmazenamento("AMBIENTE");
      setUnidadeInterna("g");
      setControlaLote(true);
      setControlaValidade(true);
      setHigroscopico(false);
      setExigePremix(false);
      setAtivo(true);
      onSuccess?.();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Produto</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* SKU e Descricao */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sku_interno">SKU (auto se vazio)</Label>
              <Input id="sku_interno" {...register("sku_interno")} placeholder="MP-XXXX" />
            </div>
            <div className="col-span-2 space-y-2">
              <Label htmlFor="descricao_interna">Descricao Interna *</Label>
              <Input
                id="descricao_interna"
                {...register("descricao_interna", { required: "Descricao e obrigatoria" })}
              />
              {errors.descricao_interna && (
                <p className="text-sm text-destructive">{errors.descricao_interna.message}</p>
              )}
            </div>
          </div>

          {/* Descricao Comercial e Categoria */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="descricao_comercial">Descricao Comercial</Label>
              <Input id="descricao_comercial" {...register("descricao_comercial")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="categoria_operacional">Categoria Operacional</Label>
              <Input id="categoria_operacional" {...register("categoria_operacional")} />
            </div>
          </div>

          {/* Tipo e Unidade */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo do Item *</Label>
              <Select value={tipoItem} onValueChange={setTipoItem}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_ITEM.map((tipo) => (
                    <SelectItem key={tipo.value} value={tipo.value}>{tipo.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Unidade Interna *</Label>
              <Select value={unidadeInterna} onValueChange={setUnidadeInterna}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="g">Gramas (g)</SelectItem>
                  <SelectItem value="mg">Miligramas (mg)</SelectItem>
                  <SelectItem value="un">Unidades (un)</SelectItem>
                  <SelectItem value="ml">Mililitros (ml)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* NCM e EAN */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ncm">NCM</Label>
              <Input id="ncm" {...register("ncm")} placeholder="0000.00.00" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ean">EAN/GTIN</Label>
              <Input id="ean" {...register("ean")} />
            </div>
          </div>

          {/* Criticidade e Armazenamento */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Criticidade</Label>
              <Select value={criticidade} onValueChange={setCriticidade}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CRITICIDADES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Armazenamento</Label>
              <Select value={armazenamento} onValueChange={setArmazenamento}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ARMAZENAMENTOS.map((a) => (
                    <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Checkboxes */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="controla_lote"
                checked={controlaLote}
                onCheckedChange={(checked) => setControlaLote(!!checked)}
              />
              <label htmlFor="controla_lote" className="text-sm">Controla Lote</label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="controla_validade"
                checked={controlaValidade}
                onCheckedChange={(checked) => setControlaValidade(!!checked)}
              />
              <label htmlFor="controla_validade" className="text-sm">Controla Validade</label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="higroscopico"
                checked={higroscopico}
                onCheckedChange={(checked) => setHigroscopico(!!checked)}
              />
              <label htmlFor="higroscopico" className="text-sm">Higroscopico</label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="exige_premix"
                checked={exigePremix}
                onCheckedChange={(checked) => setExigePremix(!!checked)}
              />
              <label htmlFor="exige_premix" className="text-sm">Exige Premix</label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="ativo"
                checked={ativo}
                onCheckedChange={(checked) => setAtivo(!!checked)}
              />
              <label htmlFor="ativo" className="text-sm">Ativo</label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit">Salvar</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
