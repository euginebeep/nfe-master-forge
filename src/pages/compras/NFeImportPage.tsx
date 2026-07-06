import { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { 
  FileText, Upload, Loader2, Check, AlertCircle, Building2, 
  Package, CheckCircle2, Truck, Receipt, CreditCard, DollarSign,
  Scale, FileWarning, Info, Box, ArrowRightLeft, Calculator, Edit, Link, Beaker
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { parseNFeCompleto, formatCNPJ, formatCurrency, formatDate, formatDateTime } from "@/lib/nfe-parser-completo";
import { checkNotaFiscalExistsSupabase, importarNFeCompletaSupabase, tipoExigeLote, extrairLoteDaDescricao, mapClassificacaoToTipo, type ImportStats, type ItemImportConfig } from "@/lib/supabase-nfe-import";
import type { NFeParseResult, ClassificacaoNota } from "@/types/nfe-completa";
import { FiscalReviewDialog, type FiscalItemConfig } from "@/components/nfe/FiscalReviewDialog";
import { ItemVinculoSelector } from "@/components/nfe/ItemVinculoSelector";
import type { LocalItem } from "@/hooks/use-local-itens";
import { preprocessarUnidadeComercial } from "@/lib/unidades-dose";
import { useAuth } from "@/hooks/use-auth";
import { useFormPersist } from "@/hooks/use-form-persist";

const CLASSIFICACOES_NOTA: { value: ClassificacaoNota; label: string; description: string }[] = [
  { value: "MATERIA_PRIMA", label: "Matéria Prima", description: "Insumos para produção" },
  { value: "EMBALAGEM", label: "Embalagem", description: "Potes, rótulos, tampas" },
  { value: "INSUMO_CONSUMO", label: "Insumo de Consumo", description: "Materiais de uso interno" },
  { value: "REMESSA_INDUSTRIALIZACAO", label: "Remessa p/ Industrialização", description: "Envio para terceiros" },
  { value: "RETORNO_INDUSTRIALIZACAO", label: "Retorno Industrialização", description: "Retorno de terceiros" },
  { value: "PRODUTO_TERCEIRO", label: "Produto de Terceiros", description: "Produtos acabados de terceiros" },
  { value: "ATIVO_IMOBILIZADO", label: "Ativo Imobilizado", description: "Máquinas e equipamentos" },
  { value: "MATERIAL_USO_CONSUMO", label: "Material Uso/Consumo", description: "Escritório, limpeza, etc." },
  { value: "OUTRO", label: "Outro", description: "Classificação manual" },
];

const UNIDADES_INTERNAS = [
  { value: "un", label: "Unidade (un)", descricao: "Peças, cápsulas, embalagens" },
  { value: "g", label: "Gramas (g)", descricao: "Matérias-primas pesáveis" },
  { value: "mg", label: "Miligramas (mg)", descricao: "Micronutrientes" },
  { value: "kg", label: "Quilogramas (kg)", descricao: "Grandes volumes" },
  { value: "ml", label: "Mililitros (ml)", descricao: "Líquidos pequenos" },
  { value: "l", label: "Litros (l)", descricao: "Líquidos grandes" },
  { value: "milheiro", label: "Milheiro", descricao: "Mil unidades" },
];

type ImportStep = 'upload' | 'preview' | 'processing' | 'complete';

// Interface para configuração de cada item
interface ItemConversaoConfig {
  unidadeInterna: string;
  fatorConversao: number;
  vinculoItemId?: string;
  vinculoTipoItem?: string;
  potenciaValor?: number;
  potenciaUnidade?: string;
  tipoPotencia?: string;
  loteManual?: string;
  dataValidadeManual?: string;
  dataFabManual?: string;
}

export default function NFeImportPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();

  type NFeImportDraft = {
    step: ImportStep;
    fileName: string | null;
    parsedResult: NFeParseResult | null;
    classificacao: ClassificacaoNota | null;
    itemConfigs: Record<number, ItemConversaoConfig>;
    fiscalConfigs: FiscalItemConfig[];
    itemVinculos: Record<number, string | undefined>;
  };

  const initialImportDraft: NFeImportDraft = {
    step: "upload",
    fileName: null,
    parsedResult: null,
    classificacao: null,
    itemConfigs: {},
    fiscalConfigs: [],
    itemVinculos: {},
  };

  const [draft, setDraft, clearDraft] = useFormPersist(
    `nfe-import:${profile?.company_id ?? "pending"}`,
    initialImportDraft,
  );

  const {
    step, fileName, parsedResult, classificacao, itemConfigs, fiscalConfigs, itemVinculos,
  } = draft;

  const setStep = (v: ImportStep) => setDraft((d) => ({ ...d, step: v }));
  const setParsedResult = (v: NFeParseResult | null) => setDraft((d) => ({ ...d, parsedResult: v }));
  const setClassificacao = (v: ClassificacaoNota | null) => setDraft((d) => ({ ...d, classificacao: v }));
  const setItemConfigs = (v: Record<number, ItemConversaoConfig> | ((prev: Record<number, ItemConversaoConfig>) => Record<number, ItemConversaoConfig>)) =>
    setDraft((d) => ({ ...d, itemConfigs: typeof v === "function" ? v(d.itemConfigs) : v }));
  const setFiscalConfigs = (v: FiscalItemConfig[] | ((prev: FiscalItemConfig[]) => FiscalItemConfig[])) =>
    setDraft((d) => ({ ...d, fiscalConfigs: typeof v === "function" ? v(d.fiscalConfigs) : v }));
  const setItemVinculos = (v: Record<number, string | undefined> | ((prev: Record<number, string | undefined>) => Record<number, string | undefined>)) =>
    setDraft((d) => ({ ...d, itemVinculos: typeof v === "function" ? v(d.itemVinculos) : v }));

  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importStats, setImportStats] = useState<ImportStats | null>(null);
  const [fiscalReviewOpen, setFiscalReviewOpen] = useState(false);

  /**
   * Parses compound units like "500 G", "500G", "250ML", "1.5KG", "0.5L"
   */
  const parseCompoundUnit = useCallback((uCom: string): { multiplier: number; baseUnit: string } => {
    const u = preprocessarUnidadeComercial(uCom).trim().toUpperCase();
    const match = u.match(/^(\d+(?:[.,]\d+)?)\s*(G|KG|MG|MCG|ML|L|LT|TON|T|UN|UND|UNID)$/);
    if (match) {
      const multiplier = parseFloat(match[1].replace(',', '.'));
      return { multiplier, baseUnit: match[2] };
    }
    return { multiplier: 1, baseUnit: u };
  }, []);

  // Sugerir unidade e fator baseado na descrição e unidade comercial
  const sugerirConversao = useCallback((descricao: string, unidadeComercial: string): ItemConversaoConfig => {
    const { multiplier, baseUnit } = parseCompoundUnit(unidadeComercial);
    const desc = descricao.toUpperCase();
    
    // Detectar cápsulas
    if (desc.includes('CAPSULA') || desc.includes('CÁPSULA') || desc.includes('CAPS')) {
      if (baseUnit === 'MILHEIRO' || baseUnit === 'MIL' || baseUnit === 'MI') {
        return { unidadeInterna: 'un', fatorConversao: 1000 * multiplier };
      }
      return { unidadeInterna: 'un', fatorConversao: multiplier };
    }
    
    // Detectar embalagens
    if (desc.includes('POTE') || desc.includes('FRASCO') || desc.includes('TAMPA') || 
        desc.includes('ROTULO') || desc.includes('RÓTULO') || desc.includes('CAIXA')) {
      return { unidadeInterna: 'un', fatorConversao: multiplier };
    }
    
    // Conversões de massa (com multiplicador de unidade composta)
    // Ex: "500 G" → baseUnit=G, multiplier=500 → interna=kg, fator=0.5 (500g = 0.5kg)
    if (baseUnit === 'KG') {
      return { unidadeInterna: 'kg', fatorConversao: multiplier };
    }
    if (baseUnit === 'G') {
      // Se multiplier > 1 (ex: "500 G"), converter para kg para ficar mais prático
      if (multiplier >= 1000) {
        return { unidadeInterna: 'kg', fatorConversao: multiplier / 1000 };
      }
      if (multiplier > 1) {
        return { unidadeInterna: 'kg', fatorConversao: multiplier / 1000 };
      }
      return { unidadeInterna: 'g', fatorConversao: 1 };
    }
    if (baseUnit === 'MG') return { unidadeInterna: 'mg', fatorConversao: multiplier };
    if (baseUnit === 'TON' || baseUnit === 'T') return { unidadeInterna: 'kg', fatorConversao: 1000 * multiplier };
    
    // Conversões de volume
    if (baseUnit === 'L' || baseUnit === 'LT') return { unidadeInterna: 'ml', fatorConversao: 1000 * multiplier };
    if (baseUnit === 'ML') return { unidadeInterna: 'ml', fatorConversao: multiplier };
    
    // Unidades discretas
    if (['UN', 'UND', 'UNID', 'PCT', 'CX', 'FD', 'SC', 'SACO', 'PC', 'PÇ', 'MILHEIRO', 'MI'].includes(baseUnit)) {
      const discreteFactor = (baseUnit === 'MILHEIRO' || baseUnit === 'MI') ? 1000 : 1;
      return { unidadeInterna: 'un', fatorConversao: discreteFactor * multiplier };
    }
    
    // Default: gramas com fator 1
    return { unidadeInterna: 'g', fatorConversao: multiplier };
  }, [parseCompoundUnit]);

  // Inicializar configs quando o resultado é parseado
  const initializeItemConfigs = useCallback((result: NFeParseResult) => {
    const configs: Record<number, ItemConversaoConfig> = {};
    result.itens.forEach((itemData, index) => {
      const sugestao = sugerirConversao(itemData.item.descricao, itemData.item.unidade_comercial);
      if (itemData.rastros.length === 0) {
        const loteExtraido = extrairLoteDaDescricao(itemData.item.descricao);
        if (loteExtraido) sugestao.loteManual = loteExtraido;
      }
      configs[index] = sugestao;
    });
    setItemConfigs(configs);
  }, [sugerirConversao]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setDraft((d) => ({
        ...d,
        fileName: selectedFile.name,
        parsedResult: null,
        classificacao: null,
        itemConfigs: {},
        step: "upload",
      }));
    }
  }, [setDraft]);

  const handleParse = async () => {
    if (!file) return;
    setParsing(true);
    
    try {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const xml = ev.target?.result as string;
        const parsed = parseNFeCompleto(xml);
        
        if (!parsed) {
          toast.error("Erro ao processar XML. Verifique se é um arquivo NF-e válido.");
          setParsing(false);
          return;
        }

        // Check for duplicate in Supabase
        const existingNota = await checkNotaFiscalExistsSupabase(parsed.notaFiscal.chave_acesso);
        if (existingNota) {
          toast.error(`Esta NF-e já foi importada anteriormente (Nº ${existingNota.numero})`);
          setParsing(false);
          return;
        }

        setParsedResult(parsed);
        setClassificacao(parsed.notaFiscal.classificacao);
        initializeItemConfigs(parsed);
        setStep('preview');
        setParsing(false);
      };
      reader.readAsText(file);
    } catch (error) {
      console.error('Error parsing XML:', error);
      toast.error("Erro ao ler o arquivo XML");
      setParsing(false);
    }
  };

  // Abre modal de revisão fiscal antes de confirmar importação
  const handleOpenFiscalReview = () => {
    setFiscalReviewOpen(true);
  };

  // Callback quando usuário confirma revisão fiscal
  const handleFiscalReviewConfirm = (configs: FiscalItemConfig[]) => {
    setFiscalConfigs(configs);
    // Proceder com importação
    handleConfirmImport(configs);
  };

  const handleConfirmImport = async (fiscalConfigsParam?: FiscalItemConfig[]) => {
    if (!parsedResult || !classificacao) return;
    
    setStep('processing');

    try {
      // Simular delay para UX
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Converter configs para o formato esperado
      const configuracoesItens: ItemImportConfig[] = Object.entries(itemConfigs).map(([indexStr, config]) => {
        const idx = parseInt(indexStr);
        const fiscalConfig = fiscalConfigsParam?.find(fc => fc.itemIndex === idx);
        const vinculoId = itemVinculos[idx];
        
        return {
          itemIndex: idx,
          unidadeInterna: config.unidadeInterna,
          fatorConversao: config.fatorConversao,
          vinculoItemId: vinculoId,
          potenciaValor: config.potenciaValor,
          potenciaUnidade: config.potenciaUnidade,
          tipoPotencia: config.tipoPotencia,
          loteManual: config.loteManual,
          dataValidadeManual: config.dataValidadeManual,
          dataFabManual: config.dataFabManual,
          tipoItem: config.vinculoTipoItem
            || (classificacao ? mapClassificacaoToTipo(classificacao, parsedResult.itens[idx]?.item.descricao || '') : undefined),
          // Adicionar dados fiscais editados se houver
          ...(fiscalConfig && {
            ncm: fiscalConfig.ncm,
            cfop: fiscalConfig.cfop,
            cstIcms: fiscalConfig.cstIcms,
            aliquotaIcms: fiscalConfig.aliquotaIcms,
            cstIpi: fiscalConfig.cstIpi,
            aliquotaIpi: fiscalConfig.aliquotaIpi,
            cstPis: fiscalConfig.cstPis,
            aliquotaPis: fiscalConfig.aliquotaPis,
            cstCofins: fiscalConfig.cstCofins,
            aliquotaCofins: fiscalConfig.aliquotaCofins,
          }),
        };
      });
      
      const result = await importarNFeCompletaSupabase(parsedResult, classificacao, configuracoesItens);
      setImportStats(result.stats);
      setFile(null);
      setDraft({ ...initialImportDraft, step: "complete" });
      toast.success(`NF-e ${parsedResult.notaFiscal.numero} importada com sucesso!`);
      
    } catch (error) {
      console.error('Error importing NF-e:', error);
      const e = error as { message?: string; code?: string };
      toast.error(e?.message || e?.code || 'Erro desconhecido', { duration: 8000 });
      setStep('preview');
    }
  };

  const updateItemConfig = useCallback((index: number, field: keyof ItemConversaoConfig, value: string | number) => {
    setItemConfigs(prev => ({
      ...prev,
      [index]: {
        ...prev[index],
        [field]: value,
      }
    }));
  }, []);

  // Vincular item manualmente
  const handleItemVinculo = useCallback((index: number, item: LocalItem | null, fatorCalculado?: number) => {
    setItemVinculos(prev => ({
      ...prev,
      [index]: item?.id,
    }));
    
    if (item) {
      setItemConfigs(prev => ({
        ...prev,
        [index]: {
          ...prev[index],
          unidadeInterna: item.unidade_interna,
          fatorConversao: fatorCalculado ?? prev[index]?.fatorConversao ?? 1,
          vinculoItemId: item.id,
          vinculoTipoItem: item.tipo_item,
        }
      }));
    } else {
      setItemConfigs(prev => ({
        ...prev,
        [index]: {
          ...prev[index],
          vinculoItemId: undefined,
          vinculoTipoItem: undefined,
        }
      }));
    }
  }, []);

  // Calcular preview da conversão
  const calcularPreview = useCallback((index: number, item: NFeParseResult['itens'][0]['item']) => {
    const config = itemConfigs[index];
    if (!config) return null;
    
    const qtdInterna = item.quantidade_comercial * config.fatorConversao;
    const custoUnitario = item.valor_total / qtdInterna;
    
    return {
      qtdInterna,
      custoUnitario,
      unidade: config.unidadeInterna,
    };
  }, [itemConfigs]);

  const resolveTipoItem = useCallback((index: number, descricao: string) => {
    const config = itemConfigs[index];
    if (config?.vinculoTipoItem) return config.vinculoTipoItem;
    if (classificacao) return mapClassificacaoToTipo(classificacao, descricao);
    return 'MP';
  }, [itemConfigs, classificacao]);

  const importBloqueado = useMemo(() => {
    if (!parsedResult || !classificacao) return true;
    return parsedResult.itens.some((itemData, index) => {
      if (itemData.rastros.length > 0) return false;
      const config = itemConfigs[index];
      const tipo = resolveTipoItem(index, itemData.item.descricao);
      if (!tipoExigeLote(tipo)) return false;
      return !config?.loteManual?.trim() || !config?.dataValidadeManual?.trim();
    });
  }, [parsedResult, classificacao, itemConfigs, resolveTipoItem]);

  const resetImport = () => {
    clearDraft(initialImportDraft);
    setFile(null);
    setImportStats(null);
  };

  const goToHistory = () => {
    navigate("/compras/notas-entrada");
  };

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        title="Importar NF-e"
        description="Importação automática de XML com captura completa de dados fiscais"
        icon={FileText}
      />

      <AnimatePresence mode="wait">
        {/* Step 1: Upload */}
        {step === 'upload' && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Upload do XML
                </CardTitle>
                <CardDescription>
                  Faça upload do arquivo XML da NF-e para importação automática
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary transition-colors">
                  <input
                    type="file"
                    accept=".xml"
                    onChange={handleFileChange}
                    className="hidden"
                    id="xml-upload"
                  />
                  <label
                    htmlFor="xml-upload"
                    className="cursor-pointer flex flex-col items-center gap-4"
                  >
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                      <FileText className="h-8 w-8 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {file ? file.name : "Clique para selecionar o arquivo XML"}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Arquivos XML de NF-e (modelo 55)
                      </p>
                    </div>
                  </label>
                </div>

                {file && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 flex justify-end"
                  >
                    <Button onClick={handleParse} disabled={parsing}>
                      {parsing ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4 mr-2" />
                      )}
                      Processar XML
                    </Button>
                  </motion.div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Info className="h-5 w-5 text-info" />
                  O que será importado
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span>Entidades (Emit/Dest/Transp)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span>Produtos e Lotes</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-muted-foreground" />
                    <span>Impostos Completos</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    <span>Contas a Pagar</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Step 2: Preview */}
        {step === 'preview' && parsedResult && (
          <motion.div
            key="preview"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {/* Header Card */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      NF-e {parsedResult.notaFiscal.numero}
                      <span className="text-muted-foreground font-normal">
                        Série {parsedResult.notaFiscal.serie}
                      </span>
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {parsedResult.notaFiscal.natureza_operacao}
                    </CardDescription>
                  </div>
                  <div className="text-right">
                    <StatusBadge 
                      variant={parsedResult.notaFiscal.status_sefaz === 'AUTORIZADA' ? 'success' : 'warning'}
                    >
                      {parsedResult.notaFiscal.status_sefaz}
                    </StatusBadge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {parsedResult.notaFiscal.ambiente}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Chave de Acesso</p>
                    <p className="font-mono text-xs break-all">{parsedResult.notaFiscal.chave_acesso}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Data Emissão</p>
                    <p>{formatDateTime(parsedResult.notaFiscal.dh_emissao)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Protocolo</p>
                    <p className="font-mono">{parsedResult.notaFiscal.protocolo_autorizacao || '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Versão Schema</p>
                    <p>{parsedResult.notaFiscal.versao_schema}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Classificação */}
            <Card className="border-primary">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileWarning className="h-5 w-5 text-primary" />
                  Classificação da Nota
                </CardTitle>
                <CardDescription>
                  Defina o tipo de operação para correto tratamento fiscal e de estoque
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Select 
                  value={classificacao || undefined} 
                  onValueChange={(v) => setClassificacao(v as ClassificacaoNota)}
                >
                  <SelectTrigger className="w-full md:w-96">
                    <SelectValue placeholder="Selecione a classificação..." />
                  </SelectTrigger>
                  <SelectContent>
                    {CLASSIFICACOES_NOTA.map(c => (
                      <SelectItem key={c.value} value={c.value}>
                        <div className="flex flex-col">
                          <span>{c.label}</span>
                          <span className="text-xs text-muted-foreground">{c.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* Tabs para detalhes */}
            <Tabs defaultValue="entidades" className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="entidades">Entidades</TabsTrigger>
                <TabsTrigger value="itens">Itens ({parsedResult.itens.length})</TabsTrigger>
                <TabsTrigger value="impostos">Impostos</TabsTrigger>
                <TabsTrigger value="transporte">Transporte</TabsTrigger>
                <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
              </TabsList>

              {/* Entidades */}
              <TabsContent value="entidades" className="space-y-4">
                {/* Emitente */}
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Emitente (Fornecedor)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">CNPJ</p>
                        <p className="font-mono">{formatCNPJ(parsedResult.emitente.documento)}</p>
                      </div>
                      <div className="md:col-span-2">
                        <p className="text-muted-foreground text-xs">Razão Social</p>
                        <p className="font-medium">{parsedResult.emitente.razao_social}</p>
                      </div>
                      {parsedResult.emitente.nome_fantasia && (
                        <div>
                          <p className="text-muted-foreground text-xs">Nome Fantasia</p>
                          <p>{parsedResult.emitente.nome_fantasia}</p>
                        </div>
                      )}
                      {parsedResult.emitente.ie && (
                        <div>
                          <p className="text-muted-foreground text-xs">IE</p>
                          <p className="font-mono">{parsedResult.emitente.ie}</p>
                        </div>
                      )}
                      {parsedResult.emitente.crt && (
                        <div>
                          <p className="text-muted-foreground text-xs">CRT</p>
                          <p>{parsedResult.emitente.crt}</p>
                        </div>
                      )}
                    </div>
                    {parsedResult.emitente.endereco && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-xs text-muted-foreground mb-1">Endereço</p>
                        <p className="text-sm">
                          {parsedResult.emitente.endereco.logradouro}, {parsedResult.emitente.endereco.numero}
                          {parsedResult.emitente.endereco.complemento && ` - ${parsedResult.emitente.endereco.complemento}`}
                          <br />
                          {parsedResult.emitente.endereco.bairro} - {parsedResult.emitente.endereco.municipio}/{parsedResult.emitente.endereco.uf}
                          <br />
                          CEP: {parsedResult.emitente.endereco.cep}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Destinatário */}
                {parsedResult.destinatario && (
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        Destinatário
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground text-xs">
                            {parsedResult.destinatario.tipo_pessoa === 'PJ' ? 'CNPJ' : 'CPF'}
                          </p>
                          <p className="font-mono">{formatCNPJ(parsedResult.destinatario.documento)}</p>
                        </div>
                        <div className="md:col-span-2">
                          <p className="text-muted-foreground text-xs">Razão Social</p>
                          <p className="font-medium">{parsedResult.destinatario.razao_social}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Transportadora */}
                {parsedResult.transportadora?.documento && (
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Truck className="h-4 w-4" />
                        Transportadora
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground text-xs">CNPJ</p>
                          <p className="font-mono">{formatCNPJ(parsedResult.transportadora.documento)}</p>
                        </div>
                        <div className="md:col-span-2">
                          <p className="text-muted-foreground text-xs">Razão Social</p>
                          <p className="font-medium">{parsedResult.transportadora.razao_social}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Itens */}
              <TabsContent value="itens">
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Link className="h-4 w-4" />
                      Vinculação e Conversão de Itens
                    </CardTitle>
                    <CardDescription>
                      Vincule cada item a um produto cadastrado ou deixe em branco para criar automaticamente
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {parsedResult.itens.map((itemData, index) => {
                        const preview = calcularPreview(index, itemData.item);
                        const config = itemConfigs[index] || { unidadeInterna: 'g', fatorConversao: 1 };
                        const vinculoId = itemVinculos[index];
                        
                        return (
                          <div key={index} className="border rounded-lg p-4 space-y-3">
                            {/* Cabeçalho do item */}
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded">
                                    #{itemData.item.n_item}
                                  </span>
                                  <span className="text-xs font-mono text-muted-foreground">
                                    NCM: {itemData.item.ncm}
                                  </span>
                                  <span className="text-xs font-mono text-muted-foreground">
                                    CFOP: {itemData.item.cfop}
                                  </span>
                                </div>
                                <p className="font-medium">{itemData.item.descricao}</p>
                                <p className="text-sm text-muted-foreground">
                                  Cód: {itemData.item.codigo_produto} | EAN: {itemData.item.ean || '-'}
                                </p>
                                
                                {/* Rastros/Lotes */}
                                {itemData.rastros.length > 0 && (
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {itemData.rastros.map((r, ri) => (
                                      <StatusBadge key={ri} variant="info">
                                        Lote: {r.numero_lote} | Val: {formatDate(r.data_validade || '')}
                                      </StatusBadge>
                                    ))}
                                  </div>
                                )}
                                {itemData.rastros.length === 0 && classificacao && (() => {
                                  const tipo = resolveTipoItem(index, itemData.item.descricao);
                                  if (tipoExigeLote(tipo)) {
                                    const pendente = !config.loteManual?.trim() || !config.dataValidadeManual?.trim();
                                    return (
                                      <div className="mt-3 space-y-2">
                                        <p className="text-xs font-medium text-amber-700">Rastreabilidade obrigatória (ativo)</p>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                          <div className="space-y-1">
                                            <Label className="text-xs">Nº do lote *</Label>
                                            <Input
                                              className="h-9"
                                              value={config.loteManual || ''}
                                              onChange={e => updateItemConfig(index, 'loteManual', e.target.value)}
                                              placeholder="Ex: HS50-231109"
                                            />
                                          </div>
                                          <div className="space-y-1">
                                            <Label className="text-xs">Validade *</Label>
                                            <Input
                                              type="date"
                                              className="h-9"
                                              value={config.dataValidadeManual || ''}
                                              onChange={e => updateItemConfig(index, 'dataValidadeManual', e.target.value)}
                                            />
                                          </div>
                                          <div className="space-y-1">
                                            <Label className="text-xs">Fabricação</Label>
                                            <Input
                                              type="date"
                                              className="h-9"
                                              value={config.dataFabManual || ''}
                                              onChange={e => updateItemConfig(index, 'dataFabManual', e.target.value)}
                                            />
                                          </div>
                                        </div>
                                        {pendente && (
                                          <p className="text-xs text-destructive">
                                            Informe o nº do lote e a validade para importar este item.
                                          </p>
                                        )}
                                      </div>
                                    );
                                  }
                                  return (
                                    <p className="mt-2 text-xs text-muted-foreground italic">
                                      sem lote (embalagem) — será registrado como S/L
                                    </p>
                                  );
                                })()}
                              </div>
                              <div className="text-right">
                                <p className="font-semibold">{formatCurrency(itemData.item.valor_total)}</p>
                                <p className="text-sm text-muted-foreground">
                                  {itemData.item.quantidade_comercial} {itemData.item.unidade_comercial} × {formatCurrency(itemData.item.valor_unitario_comercial)}
                                </p>
                                {/* Impostos resumidos */}
                                <div className="mt-1 text-xs text-muted-foreground">
                                  {itemData.impostos.icms_valor && (
                                    <span className="mr-2">ICMS: {formatCurrency(itemData.impostos.icms_valor)}</span>
                                  )}
                                  {itemData.impostos.ipi_valor && (
                                    <span>IPI: {formatCurrency(itemData.impostos.ipi_valor)}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            
                            <Separator />
                            
                            {/* Vinculação manual */}
                            <div className="space-y-1.5">
                              <Label className="text-xs flex items-center gap-1">
                                <Link className="h-3 w-3" />
                                Vincular a Item Cadastrado
                              </Label>
                              <ItemVinculoSelector
                                xmlDescricao={itemData.item.descricao}
                                xmlCodigo={itemData.item.codigo_produto}
                                xmlNcm={itemData.item.ncm}
                                xmlEan={itemData.item.ean}
                                xmlUnidade={itemData.item.unidade_comercial}
                                xmlQuantidade={itemData.item.quantidade_comercial}
                                selectedItemId={vinculoId}
                                onSelect={(item, fator) => handleItemVinculo(index, item, fator)}
                              />
                            </div>
                            
                            <Separator />
                            
                            {/* Configuração de conversão — linha 1: inputs */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
                              <div className="space-y-1.5">
                                <Label className="text-xs font-medium">Unidade Interna</Label>
                                <Select 
                                  value={config.unidadeInterna} 
                                  onValueChange={(v) => updateItemConfig(index, 'unidadeInterna', v)}
                                >
                                  <SelectTrigger className="h-9">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {UNIDADES_INTERNAS.map(u => (
                                      <SelectItem key={u.value} value={u.value}>
                                        {u.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              
                              <div className="space-y-1.5">
                                <Label className="text-xs font-medium">Fator de Conversão</Label>
                                <Input
                                  type="number"
                                  step="any"
                                  min="0.0001"
                                  value={config.fatorConversao}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    updateItemConfig(index, 'fatorConversao', val === '' ? 1 : parseFloat(val));
                                  }}
                                  className="h-9"
                                />
                              </div>

                              {/* Tipo de Potência inline */}
                              <div className="space-y-1.5">
                                <Label className="text-xs font-medium flex items-center gap-1">
                                  <Beaker className="h-3 w-3 text-amber-600" />
                                  Tipo de Potência
                                </Label>
                                <Select
                                  value={config.tipoPotencia || 'NENHUMA'}
                                  onValueChange={(v) => {
                                    updateItemConfig(index, 'tipoPotencia' as any, v);
                                    if (v === 'NENHUMA') {
                                      updateItemConfig(index, 'potenciaValor' as any, 0);
                                      updateItemConfig(index, 'potenciaUnidade' as any, '');
                                    } else {
                                      updateItemConfig(index, 'potenciaUnidade' as any, 
                                        v === 'UI_POR_GRAMA' ? 'UI/g' : v === 'MG_POR_GRAMA' ? 'mg/g' : '%'
                                      );
                                    }
                                  }}
                                >
                                  <SelectTrigger className="h-9">
                                    <SelectValue placeholder="Sem potência" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="NENHUMA">Sem potência</SelectItem>
                                    <SelectItem value="UI_POR_GRAMA">UI/g (vitaminas)</SelectItem>
                                    <SelectItem value="MG_POR_GRAMA">mg/g (concentração)</SelectItem>
                                    <SelectItem value="PERCENTUAL">% (percentual)</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              {/* Valor da potência (só aparece se tipo selecionado) */}
                              {config.tipoPotencia && config.tipoPotencia !== 'NENHUMA' ? (
                                <div className="space-y-1.5">
                                  <Label className="text-xs font-medium">
                                    Valor ({config.potenciaUnidade || 'UI/g'})
                                  </Label>
                                  <Input
                                    type="number"
                                    step="any"
                                    min="0"
                                    placeholder={config.tipoPotencia === 'UI_POR_GRAMA' ? 'Ex: 40000000' : 'Ex: 500'}
                                    value={config.potenciaValor || ''}
                                    onChange={(e) => updateItemConfig(index, 'potenciaValor' as any, e.target.value ? parseFloat(e.target.value) : 0)}
                                    className="h-9"
                                  />
                                </div>
                              ) : (
                                <div />
                              )}
                            </div>

                            {/* Card Resultado — largura total, layout horizontal */}
                            {preview && (
                              <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
                                <div className="flex items-center gap-2 mb-2">
                                  <Calculator className="h-4 w-4 text-primary" />
                                  <span className="text-sm font-semibold text-primary">Resultado da Conversão</span>
                                  <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">✓ OK</span>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                  <div className="space-y-0.5">
                                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Qtd Interna</p>
                                    <p className="font-bold text-foreground">
                                      {preview.qtdInterna.toLocaleString('pt-BR', { maximumFractionDigits: 4 })} <span className="font-normal text-muted-foreground">{preview.unidade}</span>
                                    </p>
                                  </div>
                                  <div className="space-y-0.5">
                                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Custo / {preview.unidade}</p>
                                    <p className="font-bold text-primary">{formatCurrency(preview.custoUnitario)}</p>
                                  </div>
                                  <div className="space-y-0.5">
                                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Total NF-e</p>
                                    <p className="font-bold text-foreground">{formatCurrency(preview.qtdInterna * preview.custoUnitario)}</p>
                                  </div>
                                  {config.tipoPotencia && config.tipoPotencia !== 'NENHUMA' && config.potenciaValor ? (
                                    <div className="space-y-0.5">
                                      <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                                        <Beaker className="h-3 w-3 text-amber-600" /> Potência (COA)
                                      </p>
                                      <p className="font-bold text-amber-700 dark:text-amber-400">
                                        {config.tipoPotencia === 'UI_POR_GRAMA'
                                          ? `${Number(config.potenciaValor).toLocaleString('pt-BR')} UI/g`
                                          : config.tipoPotencia === 'MG_POR_GRAMA'
                                          ? `${config.potenciaValor} mg/g`
                                          : `${config.potenciaValor}%`}
                                      </p>
                                    </div>
                                  ) : (
                                    <div className="space-y-0.5">
                                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Potência (COA)</p>
                                      <p className="text-xs text-muted-foreground italic">Não informada</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Impostos */}
              <TabsContent value="impostos">
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Scale className="h-4 w-4" />
                      Totais de Impostos
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-xs text-muted-foreground">BC ICMS</p>
                        <p className="font-semibold">{formatCurrency(parsedResult.totaisImpostos.icms_base_calculo)}</p>
                      </div>
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-xs text-muted-foreground">ICMS</p>
                        <p className="font-semibold">{formatCurrency(parsedResult.totaisImpostos.icms_valor)}</p>
                      </div>
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-xs text-muted-foreground">ICMS ST</p>
                        <p className="font-semibold">{formatCurrency(parsedResult.totaisImpostos.icms_st_valor)}</p>
                      </div>
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-xs text-muted-foreground">IPI</p>
                        <p className="font-semibold">{formatCurrency(parsedResult.totaisImpostos.valor_ipi)}</p>
                      </div>
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-xs text-muted-foreground">PIS</p>
                        <p className="font-semibold">{formatCurrency(parsedResult.totaisImpostos.valor_pis)}</p>
                      </div>
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-xs text-muted-foreground">COFINS</p>
                        <p className="font-semibold">{formatCurrency(parsedResult.totaisImpostos.valor_cofins)}</p>
                      </div>
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-xs text-muted-foreground">Frete</p>
                        <p className="font-semibold">{formatCurrency(parsedResult.totaisImpostos.valor_frete)}</p>
                      </div>
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-xs text-muted-foreground">Desconto</p>
                        <p className="font-semibold">{formatCurrency(parsedResult.totaisImpostos.valor_desconto)}</p>
                      </div>
                    </div>
                    <Separator className="my-4" />
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-muted-foreground">Total Produtos</p>
                        <p className="text-xl font-semibold">{formatCurrency(parsedResult.totaisImpostos.valor_produtos)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-muted-foreground">Total NF-e</p>
                        <p className="text-2xl font-bold text-primary">{formatCurrency(parsedResult.totaisImpostos.valor_nota)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Transporte */}
              <TabsContent value="transporte">
                <div className="space-y-4">
                  {parsedResult.transporte && (
                    <Card>
                      <CardHeader className="py-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Truck className="h-4 w-4" />
                          Dados do Transporte
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground text-xs">Modalidade Frete</p>
                            <p className="font-medium">{parsedResult.transporte.modalidade_frete}</p>
                          </div>
                          {parsedResult.transporte.veiculo_placa && (
                            <div>
                              <p className="text-muted-foreground text-xs">Placa Veículo</p>
                              <p className="font-mono">{parsedResult.transporte.veiculo_placa}-{parsedResult.transporte.veiculo_uf}</p>
                            </div>
                          )}
                          {parsedResult.transporte.reboque_placa && (
                            <div>
                              <p className="text-muted-foreground text-xs">Placa Reboque</p>
                              <p className="font-mono">{parsedResult.transporte.reboque_placa}-{parsedResult.transporte.reboque_uf}</p>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {parsedResult.volumes.length > 0 && (
                    <Card>
                      <CardHeader className="py-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Box className="h-4 w-4" />
                          Volumes ({parsedResult.volumes.length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {parsedResult.volumes.map((vol, i) => (
                            <div key={i} className="flex items-center gap-4 p-2 bg-muted rounded text-sm">
                              <span><strong>{vol.quantidade}x</strong> {vol.especie || 'Volume'}</span>
                              {vol.marca && <span>Marca: {vol.marca}</span>}
                              {vol.peso_bruto && <span>Peso Bruto: {vol.peso_bruto} kg</span>}
                              {vol.peso_liquido && <span>Peso Líquido: {vol.peso_liquido} kg</span>}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </TabsContent>

              {/* Financeiro */}
              <TabsContent value="financeiro">
                <div className="space-y-4">
                  {parsedResult.fatura && (
                    <Card>
                      <CardHeader className="py-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Receipt className="h-4 w-4" />
                          Fatura
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground text-xs">Número</p>
                            <p className="font-mono">{parsedResult.fatura.numero_fatura || '-'}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs">Valor Original</p>
                            <p>{formatCurrency(parsedResult.fatura.valor_original || 0)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs">Desconto</p>
                            <p>{formatCurrency(parsedResult.fatura.valor_desconto || 0)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs">Valor Líquido</p>
                            <p className="font-semibold">{formatCurrency(parsedResult.fatura.valor_liquido || 0)}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {parsedResult.duplicatas.length > 0 && (
                    <Card>
                      <CardHeader className="py-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <DollarSign className="h-4 w-4" />
                          Duplicatas ({parsedResult.duplicatas.length})
                          <StatusBadge variant="warning">Serão geradas como Contas a Pagar</StatusBadge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {parsedResult.duplicatas.map((dup, i) => (
                            <div key={i} className="flex items-center justify-between p-3 bg-muted rounded">
                              <div>
                                <span className="font-mono text-sm">Parcela {dup.numero}</span>
                                <span className="text-muted-foreground mx-2">•</span>
                                <span className="text-sm">Venc: {formatDate(dup.data_vencimento)}</span>
                              </div>
                              <span className="font-semibold">{formatCurrency(dup.valor)}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {parsedResult.pagamentos.length > 0 && (
                    <Card>
                      <CardHeader className="py-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <CreditCard className="h-4 w-4" />
                          Formas de Pagamento
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {parsedResult.pagamentos.map((pag, i) => (
                            <div key={i} className="flex items-center justify-between p-3 bg-muted rounded">
                              <span className="text-sm">Tipo: {pag.forma_pagamento}</span>
                              <span className="font-semibold">{formatCurrency(pag.valor)}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {parsedResult.duplicatas.length === 0 && parsedResult.pagamentos.length === 0 && (
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center text-muted-foreground">
                          <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                          <p>Nenhuma informação de pagamento/duplicata no XML</p>
                          <p className="text-sm">Será gerada uma conta a pagar única com vencimento hoje</p>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </TabsContent>
            </Tabs>

            {/* Actions */}
            <div className="flex justify-between">
              <Button variant="outline" onClick={resetImport}>
                Cancelar
              </Button>
              <div className="flex gap-2">
                <Button 
                  variant="outline"
                  onClick={handleOpenFiscalReview}
                  disabled={!classificacao || importBloqueado}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Revisar Fiscal
                </Button>
                <Button 
                  onClick={handleOpenFiscalReview}
                  disabled={!classificacao || importBloqueado}
                  size="lg"
                >
                  <Check className="h-4 w-4 mr-2" />
                  Confirmar Importação
                </Button>
              </div>
            </div>

            {/* Modal de Revisão Fiscal */}
            <FiscalReviewDialog
              open={fiscalReviewOpen}
              onOpenChange={setFiscalReviewOpen}
              parsedResult={parsedResult}
              onConfirm={handleFiscalReviewConfirm}
            />
          </motion.div>
        )}

        {/* Step 3: Processing */}
        {step === 'processing' && (
          <motion.div
            key="processing"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col items-center justify-center py-20"
          >
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-lg font-medium">Importando NF-e...</p>
            <p className="text-muted-foreground">Criando entidades, produtos, lotes e contas a pagar</p>
          </motion.div>
        )}

        {/* Step 4: Complete */}
        {step === 'complete' && (
          <motion.div
            key="complete"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center py-8">
                  <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mb-4">
                    <CheckCircle2 className="h-8 w-8 text-success" />
                  </div>
                  <h2 className="text-xl font-semibold mb-2">Importação Concluída!</h2>
                  <p className="text-muted-foreground mb-6">
                    NF-e {parsedResult?.notaFiscal.numero} importada com sucesso
                  </p>
                  
                  {importStats && (
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6 w-full max-w-2xl">
                      <div className="p-3 bg-muted rounded-lg text-center">
                        <p className="text-2xl font-bold text-primary">{importStats.entidadesCriadas}</p>
                        <p className="text-xs text-muted-foreground">Entidades</p>
                      </div>
                      <div className="p-3 bg-muted rounded-lg text-center">
                        <p className="text-2xl font-bold text-primary">{importStats.produtosCriados}</p>
                        <p className="text-xs text-muted-foreground">Produtos Novos</p>
                      </div>
                      <div className="p-3 bg-muted rounded-lg text-center">
                        <p className="text-2xl font-bold text-primary">{importStats.produtosVinculados}</p>
                        <p className="text-xs text-muted-foreground">Produtos Vinculados</p>
                      </div>
                      <div className="p-3 bg-muted rounded-lg text-center">
                        <p className="text-2xl font-bold text-primary">{importStats.lotesCriados}</p>
                        <p className="text-xs text-muted-foreground">Lotes Criados</p>
                      </div>
                      <div className="p-3 bg-muted rounded-lg text-center">
                        <p className="text-2xl font-bold text-primary">{importStats.contasPagarGeradas}</p>
                        <p className="text-xs text-muted-foreground">Contas a Pagar</p>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={resetImport}>
                      Importar Outra NF-e
                    </Button>
                    <Button variant="outline" onClick={goToHistory}>
                      Ver Histórico
                    </Button>
                    <Button onClick={() => navigate('/cadastros/produtos')}>
                      Ver Produtos
                    </Button>
                    <Button variant="secondary" onClick={() => navigate('/financeiro/contas-pagar')}>
                      Ver Contas a Pagar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
