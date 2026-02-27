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
import { Pill, AlertTriangle, ArrowRight, Calculator, Package, Beaker } from "lucide-react";
import { useCreateItem, LocalItem, TipoItemLocal, UnidadeInternaLocal, UnidadeFornecedor } from "@/hooks/use-local-itens";
import { CapsulePhotoUpload } from "./CapsulePhotoUpload";
import { 
  calcularFatorConversaoAutomatico, 
  unidadeInternaSugerida, 
  unidadeFornecedorSugerida,
  formatarUnidade,
  validarFatorConversao 
} from "@/lib/erp-validation";

interface ItemFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

// ====================================================
// REGRA MESTRE: TIPOS DE ITEM
// ====================================================
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

// ====================================================
// REGRA MESTRE: UNIDADES
// ====================================================
const UNIDADES_FORNECEDOR: { value: UnidadeFornecedor; label: string; grupo: string }[] = [
  // Massa
  { value: "kg", label: "Quilograma (kg)", grupo: "Massa" },
  { value: "g", label: "Grama (g)", grupo: "Massa" },
  { value: "mg", label: "Miligrama (mg)", grupo: "Massa" },
  // Volume
  { value: "l", label: "Litro (L)", grupo: "Volume" },
  { value: "ml", label: "Mililitro (mL)", grupo: "Volume" },
  // Discretas
  { value: "un", label: "Unidade (un)", grupo: "Contável" },
  { value: "milheiro", label: "Milheiro (1000 un)", grupo: "Contável" },
  { value: "caixa", label: "Caixa", grupo: "Contável" },
  { value: "fardo", label: "Fardo", grupo: "Contável" },
  { value: "pacote", label: "Pacote", grupo: "Contável" },
];

const UNIDADES_INTERNAS: { value: UnidadeInternaLocal; label: string; description: string }[] = [
  { value: "g", label: "Gramas (g)", description: "Para matérias-primas pesáveis" },
  { value: "mg", label: "Miligramas (mg)", description: "Para micro-dosagens" },
  { value: "kg", label: "Quilogramas (kg)", description: "Para grandes volumes" },
  { value: "un", label: "Unidades (un)", description: "Para itens discretos" },
  { value: "ml", label: "Mililitros (ml)", description: "Para líquidos" },
  { value: "l", label: "Litros (l)", description: "Para grandes volumes líquidos" },
];

const TIPOS_POTENCIA = [
  { value: "NENHUMA", label: "Nenhuma (excipiente)" },
  { value: "PERCENTUAL", label: "Percentual (%)" },
  { value: "UI_POR_GRAMA", label: "UI por grama (UI/g)" },
  { value: "MCG_POR_GRAMA", label: "Micrograma por grama (mcg/g)" },
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
  
  // ====================================================
  // REGRA MESTRE: UNIDADES E CONVERSÃO
  // ====================================================
  const [unidadeFornecedor, setUnidadeFornecedor] = useState<UnidadeFornecedor>("kg");
  const [unidadeInterna, setUnidadeInterna] = useState<UnidadeInternaLocal>("g");
  const [fatorConversao, setFatorConversao] = useState<number>(1000);
  const [fatorManual, setFatorManual] = useState(false);
  
  // Potência (para ativos)
  const [tipoPotencia, setTipoPotencia] = useState<string>("NENHUMA");
  const [valorPotencia, setValorPotencia] = useState<number | undefined>();
  const [percentualElementar, setPercentualElementar] = useState<number | undefined>();
  
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
  const [fotoUrl, setFotoUrl] = useState<string | undefined>();
  const [fotoStorageKey, setFotoStorageKey] = useState<string | undefined>();

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

  // ====================================================
  // AUTO-CONFIGURAÇÃO baseada no tipo de item
  // ====================================================
  useEffect(() => {
    const unidadeIntSugerida = unidadeInternaSugerida(tipoItem);
    const unidadeFornSugerida = unidadeFornecedorSugerida(tipoItem);
    
    setUnidadeInterna(unidadeIntSugerida);
    setUnidadeFornecedor(unidadeFornSugerida);
    
    // Calcular fator automático
    const fatorAuto = calcularFatorConversaoAutomatico(unidadeFornSugerida, unidadeIntSugerida);
    if (fatorAuto !== null) {
      setFatorConversao(fatorAuto);
      setFatorManual(false);
    } else {
      setFatorConversao(1);
      setFatorManual(true);
    }
    
    // Configurações específicas por tipo
    if (tipoItem === 'CAPSULA' || tipoItem === 'CAPSULA_VAZIA') {
      setControlaLote(true);
      setControlaValidade(true);
    } else if (tipoItem === 'MP' || tipoItem === 'ATIVO') {
      setControlaLote(true);
      setControlaValidade(true);
      setCriticidade('CRITICO');
    }
  }, [tipoItem]);

  // Recalcular fator quando unidades mudam
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

  // Validação do fator
  const validacaoFator = useMemo(() => {
    return validarFatorConversao(unidadeFornecedor, unidadeInterna, fatorConversao);
  }, [unidadeFornecedor, unidadeInterna, fatorConversao]);

  // Preview da conversão
  const previewConversao = useMemo(() => {
    const qtdExemplo = 1;
    const custoExemplo = 100;
    const qtdInterna = qtdExemplo * fatorConversao;
    const custoInterno = custoExemplo / fatorConversao;
    return { qtdInterna, custoInterno };
  }, [fatorConversao]);

  const onSubmit = (data: any) => {
    // Validar fator de conversão
    if (!validacaoFator.valido) {
      return;
    }

    const item = create({
      ...data,
      tipo_item: tipoItem,
      criticidade: criticidade as any,
      armazenamento: armazenamento as any,
      unidade_fornecedor: unidadeFornecedor,
      unidade_interna: unidadeInterna,
      fator_conversao: fatorConversao,
      tipo_potencia: tipoPotencia !== 'NENHUMA' ? tipoPotencia : undefined,
      valor_potencia: valorPotencia,
      percentual_elementar: percentualElementar,
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
        foto_url: fotoUrl || undefined,
      }),
    } as Omit<LocalItem, 'id' | 'sku_interno'> & { sku_interno?: string });

    if (item) {
      resetForm();
      onSuccess?.();
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
    setFotoStorageKey(undefined);
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

          {/* ====================================================
              REGRA MESTRE: UNIDADES E CONVERSÃO
              ==================================================== */}
          <Card className="border-2 border-primary/30 bg-primary/5">
            <CardHeader className="py-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ArrowRight className="h-4 w-4" />
                Unidades e Conversão (REGRA MESTRE)
              </CardTitle>
              <CardDescription>
                Defina a unidade do fornecedor e a unidade interna de controle. O fator de conversão é OBRIGATÓRIO quando diferem.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4 items-end">
                {/* Unidade Fornecedor */}
                <div className="space-y-2">
                  <Label>Unidade do Fornecedor (Fiscal)</Label>
                  <Select value={unidadeFornecedor} onValueChange={(v) => {
                    setUnidadeFornecedor(v as UnidadeFornecedor);
                    setFatorManual(false);
                  }}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UNIDADES_FORNECEDOR.map((u) => (
                        <SelectItem key={u.value} value={u.value}>
                          {u.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Exatamente como vem na nota fiscal</p>
                </div>

                {/* Fator de Conversão */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    Fator de Conversão
                    <Calculator className="h-3 w-3" />
                  </Label>
                  <Input
                    type="number"
                    step="0.0001"
                    min="0.0001"
                    value={fatorConversao}
                    onChange={(e) => {
                      setFatorConversao(parseFloat(e.target.value) || 1);
                      setFatorManual(true);
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    1 {formatarUnidade(unidadeFornecedor)} = {fatorConversao} {formatarUnidade(unidadeInterna)}
                  </p>
                </div>

                {/* Unidade Interna */}
                <div className="space-y-2">
                  <Label>Unidade Interna (Controle)</Label>
                  <Select value={unidadeInterna} onValueChange={(v) => {
                    setUnidadeInterna(v as UnidadeInternaLocal);
                    setFatorManual(false);
                  }}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UNIDADES_INTERNAS.map((u) => (
                        <SelectItem key={u.value} value={u.value}>
                          {u.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Unidade padronizada do sistema</p>
                </div>
              </div>

              {/* Validação do Fator */}
              {!validacaoFator.valido && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{validacaoFator.erro}</AlertDescription>
                </Alert>
              )}

              {/* Preview da Conversão */}
              <div className="p-3 bg-background rounded-lg border">
                <div className="flex items-center gap-2 text-sm font-medium mb-2">
                  <Calculator className="h-4 w-4 text-primary" />
                  Preview da Conversão
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Estoque: </span>
                    <span className="font-mono">
                      1 {formatarUnidade(unidadeFornecedor)} → {previewConversao.qtdInterna.toLocaleString('pt-BR')} {formatarUnidade(unidadeInterna)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Custo: </span>
                    <span className="font-mono">
                      R$ 100,00/{formatarUnidade(unidadeFornecedor)} → R$ {previewConversao.custoInterno.toFixed(4)}/{formatarUnidade(unidadeInterna)}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Potência (para ativos) */}
          {isAtivo && (
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Beaker className="h-4 w-4" />
                  Potência / Concentração
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Tipo de Potência</Label>
                    <Select value={tipoPotencia} onValueChange={setTipoPotencia}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIPOS_POTENCIA.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {tipoPotencia !== 'NENHUMA' && (
                    <div className="space-y-2">
                      <Label>Valor da Potência</Label>
                      <Input
                        type="number"
                        step="0.0001"
                        value={valorPotencia || ''}
                        onChange={(e) => setValorPotencia(parseFloat(e.target.value) || undefined)}
                        placeholder={tipoPotencia === 'UI_POR_GRAMA' ? '100000' : '0.5'}
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>% Elementar (minerais)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={percentualElementar || ''}
                      onChange={(e) => setPercentualElementar(parseFloat(e.target.value) || undefined)}
                      placeholder="Ex: 16 para Citrato de Mg"
                    />
                  </div>
                </div>
                {tipoPotencia === 'UI_POR_GRAMA' && (
                  <Alert className="mt-3">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>BLOQUEIO:</strong> Conversão de UI só é permitida se a potência UI/g for informada.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}

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
                    <Label>Foto da Cápsula</Label>
                    <CapsulePhotoUpload
                      currentPhotoUrl={fotoUrl}
                      onPhotoChange={(url, key) => {
                        setFotoUrl(url);
                        setFotoStorageKey(key);
                      }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Separator />

          {/* NCM e EAN */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ncm">NCM</Label>
              <Input id="ncm" {...register("ncm")} placeholder="Insira o código NCM (ex: 2106.90.30)" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ean">EAN/GTIN</Label>
              <Input id="ean" {...register("ean")} placeholder="Insira o código de barras EAN/GTIN" />
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

          {/* Botões */}
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!validacaoFator.valido}>
              Salvar Produto
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
