import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { 
  FileText, Upload, Loader2, Check, AlertCircle, Building2, 
  Package, CheckCircle2, Truck, Receipt, CreditCard, DollarSign,
  Scale, FileWarning, Info, Box
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { parseNFeCompleto, formatCNPJ, formatCurrency, formatDate, formatDateTime } from "@/lib/nfe-parser-completo";
import { checkNotaFiscalExists, importarNFeCompleta, type ImportStats } from "@/lib/local-db-nfe";
import type { NFeParseResult, ClassificacaoNota } from "@/types/nfe-completa";

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

type ImportStep = 'upload' | 'preview' | 'processing' | 'complete';

export default function NFeImportPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<ImportStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parsedResult, setParsedResult] = useState<NFeParseResult | null>(null);
  const [classificacao, setClassificacao] = useState<ClassificacaoNota | null>(null);
  const [importStats, setImportStats] = useState<ImportStats | null>(null);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setParsedResult(null);
      setClassificacao(null);
      setStep('upload');
    }
  }, []);

  const handleParse = async () => {
    if (!file) return;
    setParsing(true);
    
    try {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const xml = ev.target?.result as string;
        const parsed = parseNFeCompleto(xml);
        
        if (!parsed) {
          toast.error("Erro ao processar XML. Verifique se é um arquivo NF-e válido.");
          setParsing(false);
          return;
        }

        // Check for duplicate
        const existingNota = checkNotaFiscalExists(parsed.notaFiscal.chave_acesso);
        if (existingNota) {
          toast.error(`Esta NF-e já foi importada anteriormente (Nº ${existingNota.numero})`);
          setParsing(false);
          return;
        }

        setParsedResult(parsed);
        setClassificacao(parsed.notaFiscal.classificacao);
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

  const handleConfirmImport = async () => {
    if (!parsedResult || !classificacao) return;
    
    setStep('processing');

    try {
      // Simular delay para UX
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const result = importarNFeCompleta(parsedResult, classificacao);
      setImportStats(result.stats);
      
      setStep('complete');
      toast.success(`NF-e ${parsedResult.notaFiscal.numero} importada com sucesso!`);
      
    } catch (error) {
      console.error('Error importing NF-e:', error);
      toast.error("Erro ao importar NF-e");
      setStep('preview');
    }
  };

  const resetImport = () => {
    setStep('upload');
    setFile(null);
    setParsedResult(null);
    setClassificacao(null);
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
                  <CardContent className="pt-4">
                    <div className="space-y-3">
                      {parsedResult.itens.map((itemData, index) => (
                        <div key={index} className="border rounded-lg p-4">
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
                        </div>
                      ))}
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
              <Button 
                onClick={handleConfirmImport}
                disabled={!classificacao}
                size="lg"
              >
                <Check className="h-4 w-4 mr-2" />
                Confirmar Importação
              </Button>
            </div>
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
