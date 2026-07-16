import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Pill, AlertTriangle, ArrowRight, Calculator, Package, Beaker, Loader2 } from "lucide-react";
import { useCreateItem as useCreateItemSupabase } from "@/hooks/use-itens";
import type { TipoItemLocal, UnidadeInternaLocal, UnidadeFornecedor } from "@/hooks/use-local-itens";
import { CapsulePhotoUpload } from "./CapsulePhotoUpload";
import { TOOLTIPS } from "@/components/ajuda/TooltipAjuda";
import { 
  calcularFatorConversaoAutomatico, 
  unidadeInternaSugerida, 
  unidadeFornecedorSugerida,
  formatarUnidade,
  validarFatorConversao 
} from "@/lib/erp-validation";
import { LABEL_MCG_POR_GRAMA } from "@/lib/unidades-dose";
import {
  UNIDADES_FORNECEDOR,
  UNIDADES_INTERNAS,
} from "@/components/itens/wizard/item-wizard-constants";

interface ItemFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const TIPOS_ITEM: { value: TipoItemLocal; label: string; description: string }[] = [
  { value: "MP", label: "Matéria Prima", description: "Insumos para produção" },
  { value: "ATIVO", label: "Ativo", description: "Componente funcional" },
  { value: "EXCIPIENTE", label: "Excipiente", description: "Veículo/enchimento" },
  { value: "EMBALAGEM", label: "Embalagem", description: "Embalagem genérica" },
  { value: "ROTULO", label: "Rótulo", description: "Rótulos impressos" },
  { value: "TAMPA", label: "Tampa", description: "Tampas de potes" },
  { value: "POTE", label: "Pote", description: "Potes/frascos" },
  { value: "SILICA", label: "Sílica", description: "Dessecante" },
  { value: "CAPSULA", label: "Cápsula Vazia", description: "Cápsulas para encapsulamento" },
  { value: "ACESSORIO", label: "Acessório", description: "Acessórios de produção" },
  { value: "PA", label: "Produto Acabado", description: "Produto final" },
  { value: "OUTRO", label: "Outro", description: "Classificação manual" },
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

const TIPOS_POTENCIA = [
  { value: "NENHUMA", label: "Nenhuma (excipiente)" },
  { value: "PERCENTUAL", label: "Percentual (%)" },
  { value: "UI_POR_GRAMA", label: "UI por grama (UI/g)" },
  { value: "MCG_POR_GRAMA", label: LABEL_MCG_POR_GRAMA },
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
  const createItemMutation = useCreateItemSupabase();
  const [tipoItem, setTipoItem] = useState<TipoItemLocal>("MP");
  const [criticidade, setCriticidade] = useState("NORMAL");
  const [armazenamento, setArmazenamento] = useState("AMBIENTE");
  
  const [unidadeFornecedor, setUnidadeFornecedor] = useState<UnidadeFornecedor>("kg");
  const [unidadeInterna, setUnidadeInterna] = useState<UnidadeInternaLocal>("g");
  const [fatorConversao, setFatorConversao] = useState<number>(1000);
  const [fatorManual, setFatorManual] = useState(false);
  
  const [tipoPotencia, setTipoPotencia] = useState<string>("NENHUMA");
  const [valorPotencia, setValorPotencia] = useState<number | undefined>();
  const [percentualElementar, setPercentualElementar] = useState<number | undefined>();
  
  const [controlaLote, setControlaLote] = useState(true);
  const [controlaValidade, setControlaValidade] = useState(true);
  const [higroscopico, setHigroscopico] = useState(false);
  const [exigePremix, setExigePremix] = useState(false);
  const [ativo, setAtivo] = useState(true);

  const [capsulaMarca, setCapsulaMarca] = useState("");
  const [capsulaTamanho, setCapsulaTamanho] = useState<string>("");
  const [capsulaCor, setCapsulaCor] = useState("");
  const [capsulaMaterial, setCapsulaMaterial] = useState<string>("");
  const [fotoUrl, setFotoUrl] = useState<string | undefined>();

  const { register, handleSubmit, reset, formState: { errors }, watch, setValue } = useForm({
    defaultValues: {
      sku_interno: "",
      descricao_interna: "",
      descricao_comercial: "",
      categoria_operacional: "",
      ncm: "",
      ean: "",
      numero_notificacao_anvisa: "",
      data_notificacao_anvisa: "",
      status_regulatorio: "PENDENTE",
    },
  });

  useEffect(() => {
    const unidadeIntSugerida = unidadeInternaSugerida(tipoItem);
    const unidadeFornSugerida = unidadeFornecedorSugerida(tipoItem);
    setUnidadeInterna(unidadeIntSugerida);
    setUnidadeFornecedor(unidadeFornSugerida);
    const fatorAuto = calcularFatorConversaoAutomatico(unidadeFornSugerida, unidadeIntSugerida);
    if (fatorAuto !== null) {
      setFatorConversao(fatorAuto);
      setFatorManual(false);
    } else {
      setFatorConversao(1);
      setFatorManual(true);
    }
    if (tipoItem === 'CAPSULA' || tipoItem === 'CAPSULA_VAZIA') {
      setControlaLote(true);
      setControlaValidade(true);
    } else if (tipoItem === 'MP' || tipoItem === 'ATIVO') {
      setControlaLote(true);
      setControlaValidade(true);
      setCriticidade('CRITICO');
    }
  }, [tipoItem]);

  useEffect(() => {
    if (!fatorManual) {
      const fatorAuto = calcularFatorConversaoAutomatico(unidadeFornecedor, unidadeInterna);
      if (fatorAuto !== null) {
        setFatorConversao(fatorAuto);
      }
    }
  }, [unidadeFornecedor, unidadeInterna, fatorManual]);

  const isCapsule = tipoItem === 'CAPSULA' || tipoItem === 'CAPSULA_VAZIA';
  const isAtivo = tipoItem === 'ATIVO' || tipoItem === 'MP';

  const validacaoFator = useMemo(() => {
    return validarFatorConversao(unidadeFornecedor, unidadeInterna, fatorConversao);
  }, [unidadeFornecedor, unidadeInterna, fatorConversao]);

  const previewConversao = useMemo(() => {
    const qtdExemplo = 1;
    const custoExemplo = 100;
    const qtdInterna = qtdExemplo * fatorConversao;
    const custoInterno = custoExemplo / fatorConversao;
    return { qtdInterna, custoInterno };
  }, [fatorConversao]);

  const onSubmit = async (data: any) => {
    if (!validacaoFator.valido) return;

    try {
      await createItemMutation.mutateAsync({
        ...data,
        sku_interno: data.sku_interno || undefined,
        tipo_item: tipoItem,
        criticidade,
        unidade_interna: unidadeInterna,
        ncm: data.ncm || undefined,
        ean: data.ean || undefined,
        controla_lote: controlaLote,
        controla_validade: controlaValidade,
        higroscopico,
        exige_premix: exigePremix,
        ativo,
        ...(isCapsule && {
          capsula_marca: capsulaMarca || undefined,
          capsula_tamanho: capsulaTamanho || undefined,
          capsula_cor: capsulaCor || undefined,
          capsula_material: capsulaMaterial || undefined,
          foto_url: fotoUrl || undefined,
        }),
      } as any);

      resetForm();
      onSuccess?.();
    } catch {
      // Error handled by mutation's onError
    }
  };

  const resetForm = () => {
    reset();
    setTipoItem("MP");
    setCriticidade("NORMAL");
    setArmazenamento("AMBIENTE");
    setUnidadeFornecedor("kg");
    setUnidadeInterna("g");
    setFatorConversao(1000);
    setFatorManual(false);
    setTipoPotencia("NENHUMA");
    setValorPotencia(undefined);
    setPercentualElementar(undefined);
    setControlaLote(true);
    setControlaValidade(true);
    setHigroscopico(false);
    setExigePremix(false);
    setAtivo(true);
    setCapsulaMarca("");
    setCapsulaTamanho("");
    setCapsulaCor("");
    setCapsulaMaterial("");
    setFotoUrl(undefined);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Novo Produto / Insumo
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* SKU e Descrição */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sku_interno">SKU (auto se vazio)</Label>
              <Input id="sku_interno" {...register("sku_interno")} placeholder="Insira o código SKU ou deixe vazio para gerar" />
            </div>
            <div className="col-span-2 space-y-2">
              <Label htmlFor="descricao_interna">Nome Técnico *</Label>
              <Input
                id="descricao_interna"
                {...register("descricao_interna", { required: "Nome é obrigatório" })}
                placeholder="Insira o nome técnico do insumo (ex: Vitamina D3 100.000 UI/g)"
              />
              {errors.descricao_interna && (
                <p className="text-sm text-destructive">{errors.descricao_interna.message}</p>
              )}
            </div>
          </div>

          {/* Tipo do Item */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo do Item *</Label>
              <Select value={tipoItem} onValueChange={(v) => setTipoItem(v as TipoItemLocal)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo do item" />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_ITEM.map((tipo) => (
                    <SelectItem key={tipo.value} value={tipo.value}>
                      <div className="flex flex-col">
                        <span>{tipo.label}</span>
                        <span className="text-xs text-muted-foreground">{tipo.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="descricao_comercial">Descrição Comercial</Label>
              <Input id="descricao_comercial" {...register("descricao_comercial")} placeholder="Insira a descrição comercial do produto" />
            </div>
          </div>

          {/* Unidades e Conversão */}
          <Card className="border-2 border-primary/30 bg-primary/5">
            <CardHeader className="py-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ArrowRight className="h-4 w-4" />
                Unidades e Conversão
              </CardTitle>
              <CardDescription>
                Defina a unidade do fornecedor e a unidade interna de controle.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4 items-end">
                <div className="space-y-2">
                  <Label>Unidade do Fornecedor (Fiscal)</Label>
                  <Select value={unidadeFornecedor} onValueChange={(v) => {
                    setUnidadeFornecedor(v as UnidadeFornecedor);
                    setFatorManual(false);
                  }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {UNIDADES_FORNECEDOR.map((u) => (
                        <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    Fator de Conversão
                    <Calculator className="h-3 w-3" />
                  </Label>
                  <Input
                    type="number" step="0.0001" min="0.0001"
                    value={fatorConversao}
                    onChange={(e) => { setFatorConversao(parseFloat(e.target.value) || 1); setFatorManual(true); }}
                  />
                  <p className="text-xs text-muted-foreground">
                    1 {formatarUnidade(unidadeFornecedor)} = {fatorConversao} {formatarUnidade(unidadeInterna)}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Unidade Interna (Controle)</Label>
                  <Select value={unidadeInterna} onValueChange={(v) => {
                    setUnidadeInterna(v as UnidadeInternaLocal);
                    setFatorManual(false);
                  }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {UNIDADES_INTERNAS.map((u) => (
                        <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {!validacaoFator.valido && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{validacaoFator.erro}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Criticidade e Armazenamento */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Criticidade</Label>
              <Select value={criticidade} onValueChange={setCriticidade}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ARMAZENAMENTOS.map((a) => (
                    <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">NCM {TOOLTIPS.ncm}</Label>
              <Input {...register("ncm")} placeholder="00000000" maxLength={8} />
            </div>
          </div>

          {/* Notificação ANVISA — RDC 843/2024 */}
          <div className="col-span-1 border border-amber-200 rounded-lg p-3 bg-amber-50">
            <div className="text-xs font-semibold text-amber-800 uppercase mb-2 flex items-center gap-1">
              <span>⚠</span> Notificação ANVISA — Obrigatório a partir de setembro/2026
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="numero_notificacao_anvisa">N° Notificação ANVISA</Label>
                <Input
                  id="numero_notificacao_anvisa"
                  placeholder="Ex: 6.2024.0001234"
                  {...register("numero_notificacao_anvisa")}
                />
              </div>
              <div>
                <Label htmlFor="data_notificacao_anvisa">Data da Notificação</Label>
                <Input
                  id="data_notificacao_anvisa"
                  type="date"
                  {...register("data_notificacao_anvisa")}
                />
              </div>
              <div>
                <Label htmlFor="status_regulatorio">Status Regulatório</Label>
                <Select
                  value={watch("status_regulatorio") || "PENDENTE"}
                  onValueChange={(v) => setValue("status_regulatorio", v)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NOTIFICADO">Notificado</SelectItem>
                    <SelectItem value="DISPENSADO">Dispensado (verificar)</SelectItem>
                    <SelectItem value="REGISTRADO">Registrado (RDC anterior)</SelectItem>
                    <SelectItem value="PENDENTE">Pendente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Checkboxes */}
          <div className="flex flex-wrap gap-6">
            <div className="flex items-center space-x-2">
              <Checkbox id="controla_lote" checked={controlaLote} onCheckedChange={(v) => setControlaLote(!!v)} />
              <label htmlFor="controla_lote" className="text-sm">Controla Lote</label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="controla_validade" checked={controlaValidade} onCheckedChange={(v) => setControlaValidade(!!v)} />
              <label htmlFor="controla_validade" className="text-sm">Controla Validade</label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="higroscopico" checked={higroscopico} onCheckedChange={(v) => setHigroscopico(!!v)} />
              <label htmlFor="higroscopico" className="text-sm">Higroscópico</label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="exige_premix" checked={exigePremix} onCheckedChange={(v) => setExigePremix(!!v)} />
              <label htmlFor="exige_premix" className="text-sm">Exige Pré-mix</label>
            </div>
          </div>

          {/* Capsule fields */}
          {isCapsule && (
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Pill className="h-4 w-4" />
                  Dados da Cápsula
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Tamanho *</Label>
                    <Select value={capsulaTamanho} onValueChange={setCapsulaTamanho}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {TAMANHOS_CAPSULA.map(t => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))
                        }
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Material *</Label>
                    <Select value={capsulaMaterial} onValueChange={setCapsulaMaterial}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {MATERIAIS_CAPSULA.map(m => (
                          <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                        ))
                        }
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Cor</Label>
                    <Input value={capsulaCor} onChange={e => setCapsulaCor(e.target.value)} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={createItemMutation.isPending}>
              {createItemMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
