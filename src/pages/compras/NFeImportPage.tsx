import { useState, useCallback } from "react";
import { 
  FileText, Upload, Loader2, Check, AlertCircle, Building2, 
  Package, AlertTriangle, CheckCircle2, XCircle, Plus, Truck
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { parseNFeXML, formatCNPJ, formatCurrency, formatDate } from "@/lib/nfe-parser";
import { matchXmlItems, suggestTipoItem, type MatchedItem } from "@/lib/nfe-matcher";
import { LocalDb } from "@/lib/local-db";
import type { NFeXMLParsed } from "@/types/erp";
import type { LocalEntidade } from "@/hooks/use-local-entidades";
import type { LocalItem, LocalEstoqueLote, LocalItemFornecedor } from "@/hooks/use-local-itens";

const TIPOS_ITEM = [
  { value: "MP", label: "Matéria Prima" },
  { value: "EMBALAGEM", label: "Embalagem" },
  { value: "ROTULO", label: "Rótulo" },
  { value: "TAMPA", label: "Tampa" },
  { value: "POTE", label: "Pote" },
  { value: "SILICA", label: "Sílica" },
  { value: "CAPSULA_VAZIA", label: "Cápsula Vazia" },
  { value: "PA", label: "Produto Acabado" },
  { value: "OUTRO", label: "Outro" },
];

type ImportStep = 'upload' | 'preview' | 'processing' | 'complete';

export default function NFeImportPage() {
  const [step, setStep] = useState<ImportStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parsedNFe, setParsedNFe] = useState<NFeXMLParsed | null>(null);
  const [matchedItems, setMatchedItems] = useState<MatchedItem[]>([]);
  const [fornecedor, setFornecedor] = useState<LocalEntidade | null>(null);
  const [isNewFornecedor, setIsNewFornecedor] = useState(false);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setParsedNFe(null);
      setMatchedItems([]);
      setStep('upload');
    }
  }, []);

  const handleParse = async () => {
    if (!file) return;
    setParsing(true);
    
    try {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const xmlContent = ev.target?.result as string;
        const parsed = parseNFeXML(xmlContent);
        
        if (!parsed) {
          toast.error("Erro ao processar XML. Verifique se é um arquivo NF-e válido.");
          setParsing(false);
          return;
        }

        setParsedNFe(parsed);

        // Check if fornecedor exists
        const entidades = LocalDb.getCollection<LocalEntidade>('entidades');
        const existingForn = entidades.find(
          e => e.documento.replace(/\D/g, '') === parsed.emitente.cnpj.replace(/\D/g, '')
        );

        if (existingForn) {
          setFornecedor(existingForn);
          setIsNewFornecedor(false);
        } else {
          setIsNewFornecedor(true);
          // Create temporary fornecedor object for display
          setFornecedor({
            id: '',
            tipo_pessoa: 'PJ',
            documento: parsed.emitente.cnpj,
            razao_social: parsed.emitente.razaoSocial,
            nome_fantasia: parsed.emitente.nomeFantasia,
            ie: parsed.emitente.ie,
            status: 'ATIVO',
            classificacao: 'REGULAR',
            papeis: ['FORNECEDOR'],
            tags: [],
          } as LocalEntidade);
        }

        // Match items
        const matched = matchXmlItems(parsed.itens, parsed.emitente.cnpj);
        
        // Auto-suggest tipo for unmatched items
        matched.forEach(m => {
          if (!m.matchedProduct) {
            m.tipoClassificacao = suggestTipoItem(m.xmlItem.NCM || '', m.xmlItem.xProd);
          }
        });

        setMatchedItems(matched);
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

  const updateMatchedItem = (index: number, updates: Partial<MatchedItem>) => {
    setMatchedItems(prev => prev.map((item, i) => 
      i === index ? { ...item, ...updates } : item
    ));
  };

  const handleConfirmImport = async () => {
    if (!parsedNFe || matchedItems.length === 0) return;
    
    setStep('processing');

    try {
      let fornecedorId = fornecedor?.id;

      // 1. Create fornecedor if new
      if (isNewFornecedor && parsedNFe.emitente) {
        const newForn = LocalDb.insert<LocalEntidade>('entidades', {
          tipo_pessoa: 'PJ',
          documento: parsedNFe.emitente.cnpj,
          razao_social: parsedNFe.emitente.razaoSocial,
          nome_fantasia: parsedNFe.emitente.nomeFantasia,
          ie: parsedNFe.emitente.ie,
          status: 'ATIVO',
          classificacao: 'REGULAR',
          papeis: ['FORNECEDOR'],
          tags: ['IMPORTADO_XML'],
        });
        fornecedorId = newForn.id;

        // Create address
        if (parsedNFe.emitente.endereco) {
          LocalDb.insert('entidade_enderecos', {
            entidade_id: fornecedorId,
            tipo: 'FISCAL',
            logradouro: parsedNFe.emitente.endereco.logradouro,
            numero: parsedNFe.emitente.endereco.nro,
            bairro: parsedNFe.emitente.endereco.bairro,
            cidade: parsedNFe.emitente.endereco.cidade,
            uf: parsedNFe.emitente.endereco.uf,
            cep: parsedNFe.emitente.endereco.cep,
            pais: 'Brasil',
          });
        }

        // Create default contact
        LocalDb.insert('entidade_contatos', {
          entidade_id: fornecedorId,
          nome: 'Contato Principal',
          cargo: 'OUTRO',
          email: parsedNFe.emitente.email,
          telefone: parsedNFe.emitente.telefone,
          preferencial: true,
          aceita_whatsapp: true,
        });

        toast.success(`Fornecedor ${parsedNFe.emitente.razaoSocial} criado automaticamente`);
      }

      // 2. Process each item
      for (const matched of matchedItems) {
        let itemId = matched.matchedProduct?.id;
        let fatorConversao = matched.fatorConversao || 1;

        // Create new product if not matched
        if (!itemId && matched.tipoClassificacao) {
          const tipoItem = matched.tipoClassificacao as any;
          const isCritico = tipoItem === 'MP';
          
          const newItem = LocalDb.insert<LocalItem>('itens', {
            sku_interno: LocalDb.generateSKU(tipoItem),
            descricao_interna: matched.xmlItem.xProd,
            tipo_item: tipoItem,
            ncm: matched.xmlItem.NCM,
            ean: matched.xmlItem.cEAN !== 'SEM GTIN' ? matched.xmlItem.cEAN : undefined,
            unidade_interna: 'g',
            controla_lote: true,
            controla_validade: true,
            criticidade: isCritico ? 'CRITICO' : 'NORMAL',
            higroscopico: false,
            armazenamento: 'AMBIENTE',
            exige_premix: false,
            ativo: true,
          });
          itemId = newItem.id;

          // Link to fornecedor
          if (fornecedorId) {
            // Determine fator based on unidade
            const uCom = matched.xmlItem.uCom.toUpperCase();
            if (uCom === 'KG') fatorConversao = 1000;
            else if (uCom === 'G') fatorConversao = 1;
            else if (uCom === 'MG') fatorConversao = 0.001;
            else fatorConversao = 1;

            LocalDb.insert<LocalItemFornecedor>('item_fornecedores', {
              item_id: itemId,
              fornecedor_id: fornecedorId,
              codigo_fornecedor: matched.xmlItem.cProd,
              descricao_fornecedor: matched.xmlItem.xProd,
              unidade_compra_padrao: uCom.toLowerCase() as any,
              fator_para_unidade_interna: fatorConversao,
              fornecedor_preferencial: true,
              preco_referencia: matched.xmlItem.vUnCom,
            });
          }

          toast.success(`Produto ${matched.xmlItem.xProd.substring(0, 30)}... criado`);
        }

        // 3. Create lote if we have lote info
        if (itemId && (matched.loteManual?.numero || matched.xmlItem.rastro?.nLote)) {
          const loteNum = matched.loteManual?.numero || matched.xmlItem.rastro?.nLote || `LOTE-${Date.now()}`;
          const dataFab = matched.loteManual?.dataFab || matched.xmlItem.rastro?.dFab;
          const dataVal = matched.loteManual?.dataVal || matched.xmlItem.rastro?.dVal;
          
          const quantidadeOriginal = matched.xmlItem.qCom;
          const quantidadeInterna = quantidadeOriginal * fatorConversao;
          const custoUnitarioOriginal = matched.xmlItem.vUnCom;
          const custoUnitarioInterno = custoUnitarioOriginal / fatorConversao;

          // Check item criticidade for initial status
          const produto = LocalDb.getById<LocalItem>('itens', itemId);
          const isCriticoOuMP = produto?.tipo_item === 'MP' || 
                                produto?.criticidade === 'CRITICO' || 
                                produto?.criticidade === 'ULTRA';

          LocalDb.insert<LocalEstoqueLote>('estoque_lotes', {
            item_id: itemId,
            fornecedor_id: fornecedorId,
            numero_lote: loteNum,
            data_fab: dataFab,
            data_val: dataVal,
            quantidade_original: quantidadeOriginal,
            unidade_original: matched.xmlItem.uCom,
            quantidade_interna: quantidadeInterna,
            custo_unitario_original: custoUnitarioOriginal,
            custo_unitario_interno: custoUnitarioInterno,
            status: isCriticoOuMP ? 'QUARENTENA' : 'DISPONIVEL',
          });
        }
      }

      // 4. Log the import
      LocalDb.insert('arquivos', {
        nome_original: file?.name || 'nfe.xml',
        mime_type: 'application/xml',
        tamanho: file?.size || 0,
        storage_key: `nfe/${parsedNFe.chave}.xml`,
        sensivel: false,
      });

      setStep('complete');
      toast.success(`NF-e ${parsedNFe.numero} importada com sucesso!`);
      
    } catch (error) {
      console.error('Error importing NF-e:', error);
      toast.error("Erro ao importar NF-e");
      setStep('preview');
    }
  };

  const resetImport = () => {
    setStep('upload');
    setFile(null);
    setParsedNFe(null);
    setMatchedItems([]);
    setFornecedor(null);
    setIsNewFornecedor(false);
  };

  // Check if all items without match have classification
  const allItemsClassified = matchedItems.every(
    m => m.matchedProduct || m.tipoClassificacao
  );

  // Check if all items have lote info (required for MP/critical)
  const allLotesInformed = matchedItems.every(m => {
    const tipoItem = m.matchedProduct?.tipo_item || m.tipoClassificacao;
    if (tipoItem === 'MP' || tipoItem === 'PA') {
      return m.loteManual?.numero || m.xmlItem.rastro?.nLote;
    }
    return true;
  });

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title="Importar NF-e"
        description="Upload de XML para importação automática de notas fiscais"
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
                  <AlertCircle className="h-5 w-5 text-info" />
                  Instruções
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>1. Faça upload do arquivo XML da NF-e recebida</p>
                <p>2. O sistema irá extrair automaticamente: emitente, destinatário, transportadora e itens</p>
                <p>3. Itens serão vinculados por EAN, código do fornecedor ou descrição</p>
                <p>4. Informe manualmente os lotes caso não constem no XML</p>
                <p>5. Confirme a importação para gerar os lotes de estoque</p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Step 2: Preview */}
        {step === 'preview' && parsedNFe && (
          <motion.div
            key="preview"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {/* NF-e Header Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  NF-e {parsedNFe.numero} - Série {parsedNFe.serie}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Chave</p>
                    <p className="font-mono text-xs">{parsedNFe.chave}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Emissão</p>
                    <p>{formatDate(parsedNFe.dhEmissao)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total Produtos</p>
                    <p className="font-semibold">{formatCurrency(parsedNFe.total.totalProdutos)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total NF-e</p>
                    <p className="font-semibold">{formatCurrency(parsedNFe.total.totalNota)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Fornecedor */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Fornecedor (Emitente)
                  {isNewFornecedor && (
                    <StatusBadge variant="warning">NOVO</StatusBadge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">CNPJ</p>
                    <p className="font-mono">{formatCNPJ(parsedNFe.emitente.cnpj)}</p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-muted-foreground">Razão Social</p>
                    <p className="font-medium">{parsedNFe.emitente.razaoSocial}</p>
                  </div>
                </div>
                {isNewFornecedor && (
                  <p className="mt-3 text-sm text-warning flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Este fornecedor será cadastrado automaticamente
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Transportadora */}
            {parsedNFe.transportadora?.razaoSocial && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Truck className="h-5 w-5" />
                    Transportadora
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">CNPJ</p>
                      <p className="font-mono">{formatCNPJ(parsedNFe.transportadora.cnpj || '')}</p>
                    </div>
                    <div className="md:col-span-2">
                      <p className="text-muted-foreground">Razão Social</p>
                      <p className="font-medium">{parsedNFe.transportadora.razaoSocial}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Items */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Itens da Nota ({matchedItems.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {matchedItems.map((item, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded">
                            #{item.xmlItem.nItem}
                          </span>
                          {item.matchedProduct ? (
                            <StatusBadge variant="success">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              {item.matchType === 'EAN' ? 'EAN' : 
                               item.matchType === 'CODIGO_FORNECEDOR' ? 'Código' : 'NCM'}
                            </StatusBadge>
                          ) : (
                            <StatusBadge variant="warning">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Novo Item
                            </StatusBadge>
                          )}
                        </div>
                        <p className="font-medium">{item.xmlItem.xProd}</p>
                        <p className="text-sm text-muted-foreground">
                          cProd: {item.xmlItem.cProd} | NCM: {item.xmlItem.NCM || '-'} | 
                          EAN: {item.xmlItem.cEAN || '-'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatCurrency(item.xmlItem.vProd)}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.xmlItem.qCom} {item.xmlItem.uCom} × {formatCurrency(item.xmlItem.vUnCom)}
                        </p>
                      </div>
                    </div>

                    <Separator className="my-3" />

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Tipo Item */}
                      <div className="space-y-2">
                        <Label className="text-xs">Classificação</Label>
                        {item.matchedProduct ? (
                          <div className="h-9 px-3 flex items-center bg-muted rounded-md text-sm">
                            {TIPOS_ITEM.find(t => t.value === item.matchedProduct?.tipo_item)?.label}
                          </div>
                        ) : (
                          <Select
                            value={item.tipoClassificacao}
                            onValueChange={(v) => updateMatchedItem(index, { tipoClassificacao: v })}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                            <SelectContent>
                              {TIPOS_ITEM.map(t => (
                                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>

                      {/* Lote */}
                      <div className="space-y-2">
                        <Label className="text-xs">
                          Nº Lote
                          {(item.matchedProduct?.tipo_item === 'MP' || item.tipoClassificacao === 'MP') && (
                            <span className="text-destructive ml-1">*</span>
                          )}
                        </Label>
                        <Input
                          className="h-9"
                          value={item.loteManual?.numero || item.xmlItem.rastro?.nLote || ''}
                          onChange={(e) => updateMatchedItem(index, {
                            loteManual: {
                              ...item.loteManual,
                              numero: e.target.value,
                            }
                          })}
                          placeholder={item.xmlItem.rastro?.nLote ? 'Do XML' : 'Informe o lote'}
                        />
                      </div>

                      {/* Validade */}
                      <div className="space-y-2">
                        <Label className="text-xs">Validade</Label>
                        <Input
                          className="h-9"
                          type="date"
                          value={item.loteManual?.dataVal || item.xmlItem.rastro?.dVal || ''}
                          onChange={(e) => updateMatchedItem(index, {
                            loteManual: {
                              ...item.loteManual,
                              numero: item.loteManual?.numero || item.xmlItem.rastro?.nLote || '',
                              dataVal: e.target.value,
                            }
                          })}
                        />
                      </div>
                    </div>

                    {/* Matched product info */}
                    {item.matchedProduct && (
                      <div className="mt-3 p-2 bg-success/10 rounded text-sm">
                        <p className="text-success">
                          ✓ Vinculado a: <strong>{item.matchedProduct.sku_interno}</strong> - {item.matchedProduct.descricao_interna}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Validation Warnings */}
            {(!allItemsClassified || !allLotesInformed) && (
              <Card className="border-warning">
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3 text-warning">
                    <AlertTriangle className="h-5 w-5 shrink-0" />
                    <div className="text-sm">
                      {!allItemsClassified && (
                        <p>• Todos os itens novos precisam ter uma classificação</p>
                      )}
                      {!allLotesInformed && (
                        <p>• Itens de Matéria Prima precisam ter número de lote informado</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <div className="flex justify-between">
              <Button variant="outline" onClick={resetImport}>
                Cancelar
              </Button>
              <Button 
                onClick={handleConfirmImport}
                disabled={!allItemsClassified}
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
            <p className="text-muted-foreground">Criando fornecedor, produtos e lotes</p>
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
                    NF-e {parsedNFe?.numero} importada com sucesso. {matchedItems.length} itens processados.
                  </p>
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={resetImport}>
                      Importar Outra NF-e
                    </Button>
                    <Button onClick={() => window.location.href = '/cadastros/produtos'}>
                      Ver Produtos
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
