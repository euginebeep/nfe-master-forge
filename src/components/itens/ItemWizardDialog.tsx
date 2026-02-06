import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { 
  Package, ArrowRight, ArrowLeft, Check, AlertTriangle, Calculator, 
  Pill, Beaker, FileText, Truck, DollarSign, ClipboardList
} from "lucide-react";
import { useCreateItem, LocalItem, TipoItemLocal, UnidadeInternaLocal, UnidadeFornecedor } from "@/hooks/use-local-itens";
import { CapsulePhotoUpload } from "./CapsulePhotoUpload";
import { 
  calcularFatorConversaoAutomatico, 
  unidadeInternaSugerida, 
  unidadeFornecedorSugerida,
  formatarUnidade,
  validarFatorConversao 
} from "@/lib/erp-validation";

interface ItemWizardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

// ====================================================
// CONSTANTES
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

const UNIDADES_FORNECEDOR: { value: UnidadeFornecedor; label: string; grupo: string }[] = [
  { value: "kg", label: "Quilograma (kg)", grupo: "Massa" },
  { value: "g", label: "Grama (g)", grupo: "Massa" },
  { value: "mg", label: "Miligrama (mg)", grupo: "Massa" },
  { value: "l", label: "Litro (L)", grupo: "Volume" },
  { value: "ml", label: "Mililitro (mL)", grupo: "Volume" },
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
  'Capsugel', 'Qualicaps', 'ACG Associated Capsules',
  'Farmoquímica', 'Natural Caps', 'Suheung', 'Lefan Capsule',
];

const CST_ICMS_OPTIONS = [
  { value: "00", label: "00 - Tributada integralmente" },
  { value: "10", label: "10 - Tributada com ST" },
  { value: "20", label: "20 - Com redução de BC" },
  { value: "40", label: "40 - Isenta" },
  { value: "41", label: "41 - Não tributada" },
  { value: "60", label: "60 - ICMS cobrado anteriormente por ST" },
  { value: "90", label: "90 - Outras" },
];

const CST_PIS_COFINS_OPTIONS = [
  { value: "01", label: "01 - Operação tributável (alíquota básica)" },
  { value: "04", label: "04 - Operação tributável (ST)" },
  { value: "06", label: "06 - Operação tributável (alíquota zero)" },
  { value: "07", label: "07 - Operação isenta" },
  { value: "08", label: "08 - Operação sem incidência" },
  { value: "49", label: "49 - Outras operações de saída" },
  { value: "99", label: "99 - Outras operações" },
];

const CST_IPI_OPTIONS = [
  { value: "00", label: "00 - Entrada com recuperação de crédito" },
  { value: "49", label: "49 - Outras entradas" },
  { value: "50", label: "50 - Saída tributada" },
  { value: "51", label: "51 - Saída tributável alíquota zero" },
  { value: "52", label: "52 - Saída isenta" },
  { value: "53", label: "53 - Saída não tributada" },
  { value: "54", label: "54 - Saída imune" },
  { value: "55", label: "55 - Saída com suspensão" },
  { value: "99", label: "99 - Outras saídas" },
];

// ====================================================
// ETAPAS DO WIZARD
// ====================================================
const WIZARD_STEPS = [
  { id: 1, title: "Identificação", icon: Package, description: "Dados básicos do item" },
  { id: 2, title: "Unidades", icon: Calculator, description: "Unidades e conversão" },
  { id: 3, title: "Comercial", icon: DollarSign, description: "Preço, MOQ e lead time" },
  { id: 4, title: "Fiscal", icon: FileText, description: "NCM, impostos e CFOP" },
  { id: 5, title: "Processo", icon: ClipboardList, description: "Controles e armazenamento" },
  { id: 6, title: "Revisão", icon: Check, description: "Confirmar e salvar" },
];

export function ItemWizardDialog({ open, onOpenChange, onSuccess }: ItemWizardDialogProps) {
  const { create } = useCreateItem();
  const [currentStep, setCurrentStep] = useState(1);
  
  // Step 1: Identificação
  const [tipoItem, setTipoItem] = useState<TipoItemLocal>("MP");
  const [skuInterno, setSkuInterno] = useState("");
  const [descricaoInterna, setDescricaoInterna] = useState("");
  const [descricaoComercial, setDescricaoComercial] = useState("");
  const [categoriaOperacional, setCategoriaOperacional] = useState("");
  
  // Step 2: Unidades
  const [unidadeFornecedor, setUnidadeFornecedor] = useState<UnidadeFornecedor>("kg");
  const [unidadeInterna, setUnidadeInterna] = useState<UnidadeInternaLocal>("g");
  const [fatorConversao, setFatorConversao] = useState<number>(1000);
  const [fatorManual, setFatorManual] = useState(false);
  const [tipoPotencia, setTipoPotencia] = useState<string>("NENHUMA");
  const [valorPotencia, setValorPotencia] = useState<number | undefined>();
  const [percentualElementar, setPercentualElementar] = useState<number | undefined>();
  
  // Step 3: Comercial
  const [precoUnitarioFornecedor, setPrecoUnitarioFornecedor] = useState<number | undefined>();
  const [moq, setMoq] = useState<number | undefined>();
  const [leadTimeDias, setLeadTimeDias] = useState<number | undefined>();
  const [observacoesComerciais, setObservacoesComerciais] = useState("");
  
  // Step 4: Fiscal
  const [ncm, setNcm] = useState("");
  const [ean, setEan] = useState("");
  const [cfopEntradaPadrao, setCfopEntradaPadrao] = useState("");
  const [cfopSaidaPadrao, setCfopSaidaPadrao] = useState("");
  const [cstIcms, setCstIcms] = useState("");
  const [origemIcms, setOrigemIcms] = useState("0");
  const [aliquotaIcms, setAliquotaIcms] = useState<number | undefined>();
  const [mvaSt, setMvaSt] = useState<number | undefined>();
  const [cstIpi, setCstIpi] = useState("");
  const [aliquotaIpi, setAliquotaIpi] = useState<number | undefined>();
  const [cstPis, setCstPis] = useState("");
  const [aliquotaPis, setAliquotaPis] = useState<number | undefined>();
  const [cstCofins, setCstCofins] = useState("");
  const [aliquotaCofins, setAliquotaCofins] = useState<number | undefined>();
  const [cest, setCest] = useState("");
  const [observacoesFiscais, setObservacoesFiscais] = useState("");
  
  // Step 5: Processo
  const [criticidade, setCriticidade] = useState("NORMAL");
  const [armazenamento, setArmazenamento] = useState("AMBIENTE");
  const [controlaLote, setControlaLote] = useState(true);
  const [controlaValidade, setControlaValidade] = useState(true);
  const [higroscopico, setHigroscopico] = useState(false);
  const [exigePremix, setExigePremix] = useState(false);
  const [ativo, setAtivo] = useState(true);
  
  // Campos de cápsula
  const [capsulaMarca, setCapsulaMarca] = useState("");
  const [capsulaTamanho, setCapsulaTamanho] = useState<string>("");
  const [capsulaCor, setCapsulaCor] = useState("");
  const [capsulaMaterial, setCapsulaMaterial] = useState<string>("");
  const [fotoUrl, setFotoUrl] = useState<string | undefined>();

  const isCapsule = tipoItem === 'CAPSULA' || tipoItem === 'CAPSULA_VAZIA';
  const isAtivo = tipoItem === 'ATIVO' || tipoItem === 'MP';

  // Auto-configuração baseada no tipo
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

  // Recalcular fator quando unidades mudam
  useEffect(() => {
    if (!fatorManual) {
      const fatorAuto = calcularFatorConversaoAutomatico(unidadeFornecedor, unidadeInterna);
      if (fatorAuto !== null) {
        setFatorConversao(fatorAuto);
      }
    }
  }, [unidadeFornecedor, unidadeInterna, fatorManual]);

  const validacaoFator = useMemo(() => {
    return validarFatorConversao(unidadeFornecedor, unidadeInterna, fatorConversao);
  }, [unidadeFornecedor, unidadeInterna, fatorConversao]);

  const custoInternoCalculado = useMemo(() => {
    if (!precoUnitarioFornecedor || !fatorConversao) return undefined;
    return precoUnitarioFornecedor / fatorConversao;
  }, [precoUnitarioFornecedor, fatorConversao]);

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return !!descricaoInterna.trim();
      case 2:
        return validacaoFator.valido;
      case 3:
        return true; // Comercial é opcional
      case 4:
        return true; // Fiscal é opcional
      case 5:
        return true; // Processo é opcional
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (currentStep < 6 && canProceed()) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = () => {
    if (!validacaoFator.valido) return;

    const item = create({
      sku_interno: skuInterno || undefined,
      descricao_interna: descricaoInterna,
      descricao_comercial: descricaoComercial || undefined,
      categoria_operacional: categoriaOperacional || undefined,
      tipo_item: tipoItem,
      
      // Unidades
      unidade_fornecedor: unidadeFornecedor,
      unidade_interna: unidadeInterna,
      fator_conversao: fatorConversao,
      tipo_potencia: tipoPotencia !== 'NENHUMA' ? tipoPotencia : undefined,
      valor_potencia: valorPotencia,
      percentual_elementar: percentualElementar,
      
      // Comercial
      preco_unitario_fornecedor: precoUnitarioFornecedor,
      custo_por_unidade_interna: custoInternoCalculado,
      moq,
      lead_time_dias: leadTimeDias,
      observacoes_comerciais: observacoesComerciais || undefined,
      
      // Fiscal
      ncm: ncm || undefined,
      ean: ean || undefined,
      cfop_entrada_padrao: cfopEntradaPadrao || undefined,
      cfop_saida_padrao: cfopSaidaPadrao || undefined,
      cst_icms: cstIcms || undefined,
      origem_icms: origemIcms || undefined,
      aliquota_icms: aliquotaIcms,
      mva_st: mvaSt,
      cst_ipi: cstIpi || undefined,
      aliquota_ipi: aliquotaIpi,
      cst_pis: cstPis || undefined,
      aliquota_pis: aliquotaPis,
      cst_cofins: cstCofins || undefined,
      aliquota_cofins: aliquotaCofins,
      cest: cest || undefined,
      observacoes_fiscais: observacoesFiscais || undefined,
      
      // Processo
      criticidade: criticidade as any,
      armazenamento: armazenamento as any,
      controla_lote: controlaLote,
      controla_validade: controlaValidade,
      higroscopico,
      exige_premix: exigePremix,
      ativo,
      
      // Cápsulas
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
    setCurrentStep(1);
    setTipoItem("MP");
    setSkuInterno("");
    setDescricaoInterna("");
    setDescricaoComercial("");
    setCategoriaOperacional("");
    setUnidadeFornecedor("kg");
    setUnidadeInterna("g");
    setFatorConversao(1000);
    setFatorManual(false);
    setTipoPotencia("NENHUMA");
    setValorPotencia(undefined);
    setPercentualElementar(undefined);
    setPrecoUnitarioFornecedor(undefined);
    setMoq(undefined);
    setLeadTimeDias(undefined);
    setObservacoesComerciais("");
    setNcm("");
    setEan("");
    setCfopEntradaPadrao("");
    setCfopSaidaPadrao("");
    setCstIcms("");
    setOrigemIcms("0");
    setAliquotaIcms(undefined);
    setMvaSt(undefined);
    setCstIpi("");
    setAliquotaIpi(undefined);
    setCstPis("");
    setAliquotaPis(undefined);
    setCstCofins("");
    setAliquotaCofins(undefined);
    setCest("");
    setObservacoesFiscais("");
    setCriticidade("NORMAL");
    setArmazenamento("AMBIENTE");
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

  const progressPercent = (currentStep / 6) * 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Novo Produto / Insumo
          </DialogTitle>
        </DialogHeader>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-medium">Etapa {currentStep} de 6</span>
            <span className="text-muted-foreground">{WIZARD_STEPS[currentStep - 1].title}</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
          
          {/* Step Indicators */}
          <div className="flex justify-between mt-4">
            {WIZARD_STEPS.map((step) => {
              const Icon = step.icon;
              const isActive = currentStep === step.id;
              const isCompleted = currentStep > step.id;
              
              return (
                <div
                  key={step.id}
                  className={`flex flex-col items-center gap-1 cursor-pointer transition-colors ${
                    isActive ? 'text-primary' : isCompleted ? 'text-primary/60' : 'text-muted-foreground'
                  }`}
                  onClick={() => {
                    if (isCompleted || step.id === currentStep) {
                      setCurrentStep(step.id);
                    }
                  }}
                >
                  <div className={`p-2 rounded-full ${
                    isActive ? 'bg-primary text-primary-foreground' : 
                    isCompleted ? 'bg-primary/20' : 'bg-muted'
                  }`}>
                    {isCompleted ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <span className="text-xs hidden md:block">{step.title}</span>
                </div>
              );
            })}
          </div>
        </div>

        <Separator className="my-4" />

        {/* Step Content */}
        <div className="min-h-[400px]">
          {/* Step 1: Identificação */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Package className="h-5 w-5" />
                Identificação do Item
              </h3>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>SKU (auto se vazio)</Label>
                  <Input 
                    value={skuInterno}
                    onChange={(e) => setSkuInterno(e.target.value)}
                    placeholder="MP-XXXX" 
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Nome Técnico *</Label>
                  <Input
                    value={descricaoInterna}
                    onChange={(e) => setDescricaoInterna(e.target.value)}
                    placeholder="Vitamina D3 Colecalciferol"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo do Item *</Label>
                  <Select value={tipoItem} onValueChange={(v) => setTipoItem(v as TipoItemLocal)}>
                    <SelectTrigger>
                      <SelectValue />
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
                  <Label>Descrição Comercial</Label>
                  <Input 
                    value={descricaoComercial}
                    onChange={(e) => setDescricaoComercial(e.target.value)}
                    placeholder="Nome comercial do produto"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Categoria Operacional</Label>
                <Input 
                  value={categoriaOperacional}
                  onChange={(e) => setCategoriaOperacional(e.target.value)}
                  placeholder="Ex: Vitaminas, Minerais, Embalagens..."
                />
              </div>

              {/* Campos de Cápsula */}
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
                          placeholder="Ex: Transparente..."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Foto</Label>
                        <CapsulePhotoUpload
                          currentPhotoUrl={fotoUrl}
                          onPhotoChange={(url) => setFotoUrl(url)}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Step 2: Unidades */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Unidades e Conversão
              </h3>
              
              <Card className="border-2 border-primary/30 bg-primary/5">
                <CardHeader className="py-3">
                  <CardTitle className="text-base">REGRA MESTRE</CardTitle>
                  <CardDescription>
                    Defina a unidade do fornecedor (fiscal) e a unidade interna de controle
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

                  {!validacaoFator.valido && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>{validacaoFator.erro}</AlertDescription>
                    </Alert>
                  )}

                  <div className="p-3 bg-background rounded-lg border">
                    <div className="flex items-center gap-2 text-sm font-medium mb-2">
                      <Calculator className="h-4 w-4 text-primary" />
                      Preview da Conversão
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Estoque: </span>
                        <span className="font-mono">
                          1 {formatarUnidade(unidadeFornecedor)} → {fatorConversao.toLocaleString('pt-BR')} {formatarUnidade(unidadeInterna)}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Custo: </span>
                        <span className="font-mono">
                          R$ 100,00/{formatarUnidade(unidadeFornecedor)} → R$ {(100 / fatorConversao).toFixed(4)}/{formatarUnidade(unidadeInterna)}
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
                      Potência / Concentração (Referência)
                    </CardTitle>
                    <CardDescription>
                      A potência real será registrada no lote, conforme COA do fornecedor
                    </CardDescription>
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
                          <Label>Valor de Referência</Label>
                          <Input
                            type="number"
                            step="0.0001"
                            value={valorPotencia || ''}
                            onChange={(e) => setValorPotencia(parseFloat(e.target.value) || undefined)}
                            placeholder={tipoPotencia === 'UI_POR_GRAMA' ? '400000' : '0.5'}
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
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Step 3: Comercial */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Dados Comerciais
              </h3>
              
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Preço Unitário (R$/{formatarUnidade(unidadeFornecedor)})</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={precoUnitarioFornecedor || ''}
                        onChange={(e) => setPrecoUnitarioFornecedor(parseFloat(e.target.value) || undefined)}
                        placeholder="0,00"
                      />
                      <p className="text-xs text-muted-foreground">vUnCom da NF-e</p>
                    </div>
                    <div className="space-y-2">
                      <Label>MOQ (Qtd. Mínima)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={moq || ''}
                        onChange={(e) => setMoq(parseFloat(e.target.value) || undefined)}
                        placeholder="Ex: 25 kg"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Lead Time (dias)</Label>
                      <Input
                        type="number"
                        value={leadTimeDias || ''}
                        onChange={(e) => setLeadTimeDias(parseInt(e.target.value) || undefined)}
                        placeholder="Ex: 15"
                      />
                    </div>
                  </div>

                  {custoInternoCalculado !== undefined && (
                    <div className="p-3 bg-muted rounded-lg">
                      <div className="text-sm">
                        <span className="text-muted-foreground">Custo por Unidade Interna: </span>
                        <span className="font-mono font-bold text-primary">
                          R$ {custoInternoCalculado.toFixed(6)} / {formatarUnidade(unidadeInterna)}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Observações Comerciais</Label>
                    <Textarea
                      value={observacoesComerciais}
                      onChange={(e) => setObservacoesComerciais(e.target.value)}
                      placeholder="Condições de pagamento, negociações especiais, contatos..."
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Step 4: Fiscal */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Dados Fiscais
              </h3>
              
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>NCM</Label>
                      <Input
                        value={ncm}
                        onChange={(e) => setNcm(e.target.value)}
                        placeholder="0000.00.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>EAN/GTIN</Label>
                      <Input
                        value={ean}
                        onChange={(e) => setEan(e.target.value)}
                        placeholder="7891234567890"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>CEST</Label>
                      <Input
                        value={cest}
                        onChange={(e) => setCest(e.target.value)}
                        placeholder="00.000.00"
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>CFOP Entrada Padrão</Label>
                      <Input
                        value={cfopEntradaPadrao}
                        onChange={(e) => setCfopEntradaPadrao(e.target.value)}
                        placeholder="Ex: 1102"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>CFOP Saída Padrão</Label>
                      <Input
                        value={cfopSaidaPadrao}
                        onChange={(e) => setCfopSaidaPadrao(e.target.value)}
                        placeholder="Ex: 5102"
                      />
                    </div>
                  </div>

                  <Separator />

                  {/* ICMS */}
                  <div className="space-y-2">
                    <Label className="text-base font-semibold">ICMS</Label>
                    <div className="grid grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs">CST</Label>
                        <Select value={cstIcms} onValueChange={setCstIcms}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            {CST_ICMS_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Origem</Label>
                        <Select value={origemIcms} onValueChange={setOrigemIcms}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">0 - Nacional</SelectItem>
                            <SelectItem value="1">1 - Estrangeira (importação direta)</SelectItem>
                            <SelectItem value="2">2 - Estrangeira (mercado interno)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Alíquota %</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={aliquotaIcms || ''}
                          onChange={(e) => setAliquotaIcms(parseFloat(e.target.value) || undefined)}
                          placeholder="18"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">MVA ST %</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={mvaSt || ''}
                          onChange={(e) => setMvaSt(parseFloat(e.target.value) || undefined)}
                          placeholder="42"
                        />
                      </div>
                    </div>
                  </div>

                  {/* IPI */}
                  <div className="space-y-2">
                    <Label className="text-base font-semibold">IPI</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs">CST</Label>
                        <Select value={cstIpi} onValueChange={setCstIpi}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            {CST_IPI_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Alíquota %</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={aliquotaIpi || ''}
                          onChange={(e) => setAliquotaIpi(parseFloat(e.target.value) || undefined)}
                          placeholder="5"
                        />
                      </div>
                    </div>
                  </div>

                  {/* PIS/COFINS */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-base font-semibold">PIS</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-2">
                          <Label className="text-xs">CST</Label>
                          <Select value={cstPis} onValueChange={setCstPis}>
                            <SelectTrigger>
                              <SelectValue placeholder="CST" />
                            </SelectTrigger>
                            <SelectContent>
                              {CST_PIS_COFINS_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Alíquota %</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={aliquotaPis || ''}
                            onChange={(e) => setAliquotaPis(parseFloat(e.target.value) || undefined)}
                            placeholder="1.65"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-base font-semibold">COFINS</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-2">
                          <Label className="text-xs">CST</Label>
                          <Select value={cstCofins} onValueChange={setCstCofins}>
                            <SelectTrigger>
                              <SelectValue placeholder="CST" />
                            </SelectTrigger>
                            <SelectContent>
                              {CST_PIS_COFINS_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Alíquota %</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={aliquotaCofins || ''}
                            onChange={(e) => setAliquotaCofins(parseFloat(e.target.value) || undefined)}
                            placeholder="7.60"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Observações Fiscais</Label>
                    <Textarea
                      value={observacoesFiscais}
                      onChange={(e) => setObservacoesFiscais(e.target.value)}
                      placeholder="Informações adicionais fiscais..."
                      rows={2}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Step 5: Processo */}
          {currentStep === 5 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                Controles de Processo
              </h3>
              
              <Card>
                <CardContent className="pt-6 space-y-4">
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

                  <Separator />

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

                  {(criticidade === 'CRITICO' || criticidade === 'ULTRA') && (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        Item marcado como <strong>{criticidade}</strong> - lotes entrarão automaticamente em QUARENTENA
                        e precisarão de COA validado para liberação.
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Step 6: Revisão */}
          {currentStep === 6 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Check className="h-5 w-5" />
                Revisão Final
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm">Identificação</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-1">
                    <p><span className="text-muted-foreground">SKU:</span> {skuInterno || '(automático)'}</p>
                    <p><span className="text-muted-foreground">Nome:</span> {descricaoInterna}</p>
                    <p><span className="text-muted-foreground">Tipo:</span> {TIPOS_ITEM.find(t => t.value === tipoItem)?.label}</p>
                    {descricaoComercial && <p><span className="text-muted-foreground">Comercial:</span> {descricaoComercial}</p>}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm">Unidades</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-1">
                    <p><span className="text-muted-foreground">Fornecedor:</span> {formatarUnidade(unidadeFornecedor)}</p>
                    <p><span className="text-muted-foreground">Interna:</span> {formatarUnidade(unidadeInterna)}</p>
                    <p><span className="text-muted-foreground">Fator:</span> {fatorConversao}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm">Comercial</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-1">
                    <p><span className="text-muted-foreground">Preço:</span> {precoUnitarioFornecedor ? `R$ ${precoUnitarioFornecedor.toFixed(2)}` : '-'}</p>
                    <p><span className="text-muted-foreground">MOQ:</span> {moq || '-'}</p>
                    <p><span className="text-muted-foreground">Lead Time:</span> {leadTimeDias ? `${leadTimeDias} dias` : '-'}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm">Fiscal</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-1">
                    <p><span className="text-muted-foreground">NCM:</span> {ncm || '-'}</p>
                    <p><span className="text-muted-foreground">EAN:</span> {ean || '-'}</p>
                    <p><span className="text-muted-foreground">ICMS:</span> {cstIcms || '-'} {aliquotaIcms ? `(${aliquotaIcms}%)` : ''}</p>
                  </CardContent>
                </Card>

                <Card className="col-span-2">
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm">Processo</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm">
                    <div className="flex flex-wrap gap-2">
                      <span className="px-2 py-1 bg-muted rounded text-xs">Criticidade: {criticidade}</span>
                      <span className="px-2 py-1 bg-muted rounded text-xs">Armazenamento: {armazenamento}</span>
                      {controlaLote && <span className="px-2 py-1 bg-primary/20 text-primary rounded text-xs">Controla Lote</span>}
                      {controlaValidade && <span className="px-2 py-1 bg-primary/20 text-primary rounded text-xs">Controla Validade</span>}
                      {higroscopico && <span className="px-2 py-1 bg-accent text-accent-foreground rounded text-xs">Higroscópico</span>}
                      {exigePremix && <span className="px-2 py-1 bg-secondary text-secondary-foreground rounded text-xs">Exige Premix</span>}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between pt-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={currentStep === 1 ? () => onOpenChange(false) : handleBack}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {currentStep === 1 ? 'Cancelar' : 'Voltar'}
          </Button>
          
          {currentStep < 6 ? (
            <Button
              type="button"
              onClick={handleNext}
              disabled={!canProceed()}
            >
              Avançar
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleSubmit}
              variant="default"
            >
              <Check className="h-4 w-4 mr-2" />
              Salvar Produto
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
