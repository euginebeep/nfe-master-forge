import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Pill, Image } from "lucide-react";
import { useCreateItem, LocalItem, TipoItemLocal, UnidadeInternaLocal } from "@/hooks/use-local-itens";

interface ItemFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const TIPOS_ITEM: { value: TipoItemLocal; label: string }[] = [
  { value: "MP", label: "Matéria Prima" },
  { value: "EMBALAGEM", label: "Embalagem" },
  { value: "ROTULO", label: "Rótulo" },
  { value: "TAMPA", label: "Tampa" },
  { value: "POTE", label: "Pote" },
  { value: "SILICA", label: "Sílica" },
  { value: "CAPSULA", label: "Cápsula Vazia" },
  { value: "PA", label: "Produto Acabado" },
  { value: "OUTRO", label: "Outro" },
];

const CRITICIDADES = [
  { value: "NORMAL", label: "Normal" },
  { value: "ATENCAO", label: "Atenção" },
  { value: "CRITICO", label: "Crítico" },
  { value: "ULTRA", label: "Ultra Crítico" },
];

const ARMAZENAMENTOS = [
  { value: "AMBIENTE", label: "Ambiente" },
  { value: "REFRIGERADO", label: "Refrigerado" },
  { value: "PROTEGIDO_LUZ", label: "Protegido da Luz" },
  { value: "OUTRO", label: "Outro" },
];

const UNIDADES_INTERNAS: { value: UnidadeInternaLocal; label: string; description: string }[] = [
  { value: "g", label: "Gramas (g)", description: "Para matérias-primas pesáveis" },
  { value: "mg", label: "Miligramas (mg)", description: "Para micro-dosagens" },
  { value: "un", label: "Unidades (un)", description: "Para itens discretos" },
  { value: "ml", label: "Mililitros (ml)", description: "Para líquidos" },
  { value: "milheiro", label: "Milheiro", description: "1000 unidades - para cápsulas" },
];

const TAMANHOS_CAPSULA = ['000', '00', '0', '1', '2', '3', '4', '5'];
const MATERIAIS_CAPSULA = [
  { value: 'GELATINA', label: 'Gelatina' },
  { value: 'VEGETAL', label: 'Vegetal (HPMC)' },
  { value: 'HPMC', label: 'HPMC' },
];

const MARCAS_CAPSULA_SUGERIDAS = [
  'Capsugel',
  'Qualicaps',
  'ACG Associated Capsules',
  'Farmoquímica',
  'Natural Caps',
  'Suheung',
  'Lefan Capsule',
];

export function ItemFormDialog({ open, onOpenChange, onSuccess }: ItemFormDialogProps) {
  const { create } = useCreateItem();
  const [tipoItem, setTipoItem] = useState<TipoItemLocal>("MP");
  const [criticidade, setCriticidade] = useState("NORMAL");
  const [armazenamento, setArmazenamento] = useState("AMBIENTE");
  const [unidadeInterna, setUnidadeInterna] = useState<UnidadeInternaLocal>("g");
  const [controlaLote, setControlaLote] = useState(true);
  const [controlaValidade, setControlaValidade] = useState(true);
  const [higroscopico, setHigroscopico] = useState(false);
  const [exigePremix, setExigePremix] = useState(false);
  const [ativo, setAtivo] = useState(true);

  // Campos específicos de cápsula
  const [capsulaMarca, setCapsulaMarca] = useState("");
  const [capsulaTamanho, setCapsulaTamanho] = useState<string>("");
  const [capsulaCor, setCapsulaCor] = useState("");
  const [capsulaMaterial, setCapsulaMaterial] = useState<string>("");
  const [unidadeCompra, setUnidadeCompra] = useState("");
  const [fatorCompra, setFatorCompra] = useState<number>(1);

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

  // Auto-ajustar unidade interna baseado no tipo
  useEffect(() => {
    if (tipoItem === 'CAPSULA' || tipoItem === 'CAPSULA_VAZIA') {
      setUnidadeInterna('un');
      setUnidadeCompra('milheiro');
      setFatorCompra(1000);
      setControlaLote(true);
      setControlaValidade(true);
    } else if (['EMBALAGEM', 'ROTULO', 'TAMPA', 'POTE', 'SILICA'].includes(tipoItem)) {
      setUnidadeInterna('un');
      setUnidadeCompra('');
      setFatorCompra(1);
    } else if (tipoItem === 'MP') {
      setUnidadeInterna('g');
      setUnidadeCompra('');
      setFatorCompra(1);
    }
  }, [tipoItem]);

  const isCapsule = tipoItem === 'CAPSULA' || tipoItem === 'CAPSULA_VAZIA';

  const onSubmit = (data: any) => {
    const item = create({
      ...data,
      tipo_item: tipoItem,
      criticidade: criticidade as any,
      armazenamento: armazenamento as any,
      unidade_interna: unidadeInterna,
      controla_lote: controlaLote,
      controla_validade: controlaValidade,
      higroscopico,
      exige_premix: exigePremix,
      ativo,
      // Campos de cápsula
      ...(isCapsule && {
        capsula_marca: capsulaMarca || undefined,
        capsula_tamanho: capsulaTamanho || undefined,
        capsula_cor: capsulaCor || undefined,
        capsula_material: capsulaMaterial || undefined,
      }),
      // Conversão de unidade
      unidade_compra: unidadeCompra || undefined,
      fator_compra_para_interna: fatorCompra > 1 ? fatorCompra : undefined,
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
      setCapsulaMarca("");
      setCapsulaTamanho("");
      setCapsulaCor("");
      setCapsulaMaterial("");
      setUnidadeCompra("");
      setFatorCompra(1);
      onSuccess?.();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Produto</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* SKU e Descrição */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sku_interno">SKU (auto se vazio)</Label>
              <Input id="sku_interno" {...register("sku_interno")} placeholder="MP-XXXX" />
            </div>
            <div className="col-span-2 space-y-2">
              <Label htmlFor="descricao_interna">Descrição Interna *</Label>
              <Input
                id="descricao_interna"
                {...register("descricao_interna", { required: "Descrição é obrigatória" })}
              />
              {errors.descricao_interna && (
                <p className="text-sm text-destructive">{errors.descricao_interna.message}</p>
              )}
            </div>
          </div>

          {/* Descrição Comercial e Categoria */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="descricao_comercial">Descrição Comercial</Label>
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
              <Select value={tipoItem} onValueChange={(v) => setTipoItem(v as TipoItemLocal)}>
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
              <Select value={unidadeInterna} onValueChange={(v) => setUnidadeInterna(v as UnidadeInternaLocal)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNIDADES_INTERNAS.map((u) => (
                    <SelectItem key={u.value} value={u.value}>
                      <div className="flex flex-col">
                        <span>{u.label}</span>
                        <span className="text-xs text-muted-foreground">{u.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Seção específica de Cápsulas */}
          {isCapsule && (
            <Card className="border-primary/50 bg-primary/5">
              <CardHeader className="py-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Pill className="h-4 w-4" />
                  Dados da Cápsula
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Marca</Label>
                    <Input 
                      value={capsulaMarca}
                      onChange={(e) => setCapsulaMarca(e.target.value)}
                      placeholder="Ex: Capsugel, Qualicaps..."
                      list="marcas-capsula"
                    />
                    <datalist id="marcas-capsula">
                      {MARCAS_CAPSULA_SUGERIDAS.map(m => (
                        <option key={m} value={m} />
                      ))}
                    </datalist>
                  </div>
                  <div className="space-y-2">
                    <Label>Material</Label>
                    <Select value={capsulaMaterial} onValueChange={setCapsulaMaterial}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {MATERIAIS_CAPSULA.map(m => (
                          <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Tamanho</Label>
                    <Select value={capsulaTamanho} onValueChange={setCapsulaTamanho}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {TAMANHOS_CAPSULA.map(t => (
                          <SelectItem key={t} value={t}>Tamanho {t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Cor</Label>
                    <Input 
                      value={capsulaCor}
                      onChange={(e) => setCapsulaCor(e.target.value)}
                      placeholder="Ex: Transparente, Branca..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Foto do Produto</Label>
                    <Button type="button" variant="outline" className="w-full" disabled>
                      <Image className="h-4 w-4 mr-2" />
                      Em breve
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Conversão de Unidade de Compra */}
          {(isCapsule || unidadeCompra) && (
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-base">Conversão de Unidade de Compra</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 items-end">
                  <div className="space-y-2">
                    <Label>Unidade de Compra</Label>
                    <Input 
                      value={unidadeCompra}
                      onChange={(e) => setUnidadeCompra(e.target.value)}
                      placeholder="Ex: milheiro, caixa..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Fator de Conversão</Label>
                    <Input 
                      type="number"
                      value={fatorCompra}
                      onChange={(e) => setFatorCompra(Number(e.target.value))}
                      placeholder="1000"
                    />
                  </div>
                  <div className="text-sm text-muted-foreground pb-2">
                    1 {unidadeCompra || 'unidade de compra'} = {fatorCompra} {unidadeInterna}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Ao importar uma NF-e, o custo unitário será calculado: Total ÷ (Qtd × Fator)
                </p>
              </CardContent>
            </Card>
          )}

          <Separator />

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
              <label htmlFor="higroscopico" className="text-sm">Higroscópico</label>
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
