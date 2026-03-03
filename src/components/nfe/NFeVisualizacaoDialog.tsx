import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Printer,
  FileDown,
  X,
  Building2,
  Truck,
  Package,
  Receipt,
  Calculator,
  FileText,
  Calendar,
  Hash,
  ClipboardList,
  Info,
  Loader2,
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { supabase } from '@/integrations/supabase/client';
import { parseNFeXML } from '@/lib/nfe-parser';

// ====================================================
// Types for Supabase-backed data
// ====================================================
interface NotaEntradaDB {
  id: string;
  chave_nfe: string;
  numero: string | null;
  serie: string | null;
  modelo: string | null;
  dh_emissao: string | null;
  fornecedor_id: string | null;
  total_produtos: number | null;
  total_nota: number | null;
  status: string;
  xml_raw: string | null;
  created_at: string;
  fornecedor?: { razao_social: string; documento?: string; nome_fantasia?: string; ie?: string } | null;
}

interface NotaEntradaItemDB {
  id: string;
  codigo_fornecedor: string | null;
  descricao: string | null;
  ncm: string | null;
  cfop: string | null;
  ucom: string | null;
  qcom: number | null;
  vuncom: number | null;
  vprod: number | null;
  ean: string | null;
}

// Parsed XML extra data
interface XMLExtraData {
  emitente: {
    cnpj: string;
    razaoSocial: string;
    nomeFantasia: string;
    ie: string;
    endereco?: {
      logradouro: string;
      nro: string;
      bairro: string;
      cidade: string;
      uf: string;
      cep: string;
    };
  } | null;
  destinatario: {
    cnpj: string;
    cpf: string;
    razaoSocial: string;
    ie: string;
    endereco?: {
      logradouro: string;
      nro: string;
      bairro: string;
      cidade: string;
      uf: string;
      cep: string;
    };
  } | null;
  transportadora?: { cnpj: string; razaoSocial: string; ie: string } | null;
  totais: {
    vBC: number; vICMS: number; vBCST: number; vST: number;
    vIPI: number; vPIS: number; vCOFINS: number;
    vFrete: number; vSeg: number; vDesc: number; vOutro: number;
  };
  naturezaOperacao: string;
  infAdFisco: string;
  infCpl: string;
}

function parseXMLExtras(xmlString: string): XMLExtraData | null {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
    if (xmlDoc.querySelector('parsererror')) return null;

    const getT = (el: Element | null, tag: string) => {
      if (!el) return '';
      const c = el.getElementsByTagName(tag)[0];
      return c?.textContent?.trim() || '';
    };
    const getF = (el: Element | null, tag: string) => parseFloat(getT(el, tag)) || 0;

    // ide
    const ide = xmlDoc.getElementsByTagName('ide')[0];
    const naturezaOperacao = getT(ide, 'natOp');

    // emit
    const emit = xmlDoc.getElementsByTagName('emit')[0];
    const enderEmit = emit?.getElementsByTagName('enderEmit')[0];
    const emitente = emit ? {
      cnpj: getT(emit, 'CNPJ'),
      razaoSocial: getT(emit, 'xNome'),
      nomeFantasia: getT(emit, 'xFant'),
      ie: getT(emit, 'IE'),
      endereco: enderEmit ? {
        logradouro: getT(enderEmit, 'xLgr'),
        nro: getT(enderEmit, 'nro'),
        bairro: getT(enderEmit, 'xBairro'),
        cidade: getT(enderEmit, 'xMun'),
        uf: getT(enderEmit, 'UF'),
        cep: getT(enderEmit, 'CEP'),
      } : undefined,
    } : null;

    // dest
    const dest = xmlDoc.getElementsByTagName('dest')[0];
    const enderDest = dest?.getElementsByTagName('enderDest')[0];
    const destinatario = dest ? {
      cnpj: getT(dest, 'CNPJ'),
      cpf: getT(dest, 'CPF'),
      razaoSocial: getT(dest, 'xNome'),
      ie: getT(dest, 'IE'),
      endereco: enderDest ? {
        logradouro: getT(enderDest, 'xLgr'),
        nro: getT(enderDest, 'nro'),
        bairro: getT(enderDest, 'xBairro'),
        cidade: getT(enderDest, 'xMun'),
        uf: getT(enderDest, 'UF'),
        cep: getT(enderDest, 'CEP'),
      } : undefined,
    } : null;

    // transp
    const transp = xmlDoc.getElementsByTagName('transp')[0];
    const transporta = transp?.getElementsByTagName('transporta')[0];
    const transportadora = transporta ? {
      cnpj: getT(transporta, 'CNPJ'),
      razaoSocial: getT(transporta, 'xNome'),
      ie: getT(transporta, 'IE'),
    } : null;

    // ICMSTot
    const ICMSTot = xmlDoc.getElementsByTagName('ICMSTot')[0];
    const totais = {
      vBC: getF(ICMSTot, 'vBC'),
      vICMS: getF(ICMSTot, 'vICMS'),
      vBCST: getF(ICMSTot, 'vBCST'),
      vST: getF(ICMSTot, 'vST'),
      vIPI: getF(ICMSTot, 'vIPI'),
      vPIS: getF(ICMSTot, 'vPIS'),
      vCOFINS: getF(ICMSTot, 'vCOFINS'),
      vFrete: getF(ICMSTot, 'vFrete'),
      vSeg: getF(ICMSTot, 'vSeg'),
      vDesc: getF(ICMSTot, 'vDesc'),
      vOutro: getF(ICMSTot, 'vOutro'),
    };

    // infAdic
    const infAdic = xmlDoc.getElementsByTagName('infAdic')[0];
    const infAdFisco = getT(infAdic, 'infAdFisco');
    const infCpl = getT(infAdic, 'infCpl');

    return { emitente, destinatario, transportadora, totais, naturezaOperacao, infAdFisco, infCpl };
  } catch {
    return null;
  }
}

// ====================================================
// Dialog Props
// ====================================================
interface NFeVisualizacaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chaveNfe: string;
}

export function NFeVisualizacaoDialog({
  open,
  onOpenChange,
  chaveNfe,
}: NFeVisualizacaoDialogProps) {
  const [nota, setNota] = useState<NotaEntradaDB | null>(null);
  const [itens, setItens] = useState<NotaEntradaItemDB[]>([]);
  const [xmlExtras, setXmlExtras] = useState<XMLExtraData | null>(null);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const printContainerRef = useRef<HTMLDivElement | null>(null);

  // Fetch from Supabase when dialog opens
  useEffect(() => {
    if (!open || !chaveNfe) return;

    setLoading(true);
    setNotFound(false);
    setNota(null);
    setItens([]);
    setXmlExtras(null);

    (async () => {
      try {
        // Fetch nota with fornecedor join
        const { data: notaData, error: notaError } = await supabase
          .from('notas_entrada')
          .select('*, fornecedor:entidades!notas_entrada_fornecedor_id_fkey(razao_social, documento, nome_fantasia, ie)')
          .eq('chave_nfe', chaveNfe)
          .maybeSingle();

        if (notaError) throw notaError;
        if (!notaData) {
          setNotFound(true);
          setLoading(false);
          return;
        }

        const typedNota = notaData as unknown as NotaEntradaDB;
        setNota(typedNota);

        // Fetch items
        const { data: itensData } = await supabase
          .from('notas_entrada_itens')
          .select('id, codigo_fornecedor, descricao, ncm, cfop, ucom, qcom, vuncom, vprod, ean')
          .eq('nota_entrada_id', typedNota.id);

        setItens((itensData || []) as unknown as NotaEntradaItemDB[]);

        // Parse xml_raw for extra details
        if (typedNota.xml_raw) {
          const extras = parseXMLExtras(typedNota.xml_raw);
          setXmlExtras(extras);
        }
      } catch (err) {
        console.error('Erro ao buscar nota:', err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, chaveNfe]);

  // Print container lifecycle
  useEffect(() => {
    if (!printContainerRef.current) {
      const div = document.createElement('div');
      div.id = 'nfe-print-portal';
      div.style.display = 'none';
      document.body.appendChild(div);
      printContainerRef.current = div;
    }
    return () => {
      if (printContainerRef.current && document.body.contains(printContainerRef.current)) {
        document.body.removeChild(printContainerRef.current);
        printContainerRef.current = null;
      }
    };
  }, []);

  const handlePrint = () => {
    if (!nota || !printContainerRef.current) return;
    setIsPrinting(true);
    printContainerRef.current.style.display = 'block';
    setTimeout(() => {
      window.print();
      if (printContainerRef.current) printContainerRef.current.style.display = 'none';
      setIsPrinting(false);
    }, 200);
  };

  // Loading state
  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <div className="flex items-center justify-center py-12 gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-muted-foreground">Carregando nota fiscal...</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Not found state
  if (notFound || !nota) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nota não encontrada</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            A nota fiscal com a chave informada não foi encontrada no sistema.
          </p>
        </DialogContent>
      </Dialog>
    );
  }

  // Resolve entity info - prefer xmlExtras (from raw XML), fallback to DB join
  const emitenteInfo: XMLExtraData['emitente'] = xmlExtras?.emitente || (nota.fornecedor ? {
    cnpj: (nota.fornecedor as any).documento || '',
    razaoSocial: nota.fornecedor.razao_social || '',
    nomeFantasia: (nota.fornecedor as any).nome_fantasia || '',
    ie: (nota.fornecedor as any).ie || '',
    endereco: undefined,
  } : null);

  const destinatarioInfo = xmlExtras?.destinatario || null;
  const transportadoraInfo = xmlExtras?.transportadora || null;
  const totais = xmlExtras?.totais || null;

  return (
    <>
      {/* Print portal */}
      {printContainerRef.current && createPortal(
        <NFePrintContent
          nota={nota}
          itens={itens}
          emitente={emitenteInfo}
          destinatario={destinatarioInfo}
          totais={totais}
          transportadora={transportadoraInfo}
          naturezaOperacao={xmlExtras?.naturezaOperacao || ''}
        />,
        printContainerRef.current
      )}

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[90vh] p-0">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b bg-muted/30">
            <div className="flex items-center gap-3">
              <FileText className="h-6 w-6 text-primary" />
              <div>
                <h2 className="text-lg font-semibold">
                  NF-e Nº {nota.numero || '-'} - Série {nota.serie || '-'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Chave: {nota.chave_nfe}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handlePrint} disabled={isPrinting}>
                <Printer className="h-4 w-4 mr-2" />
                Imprimir
              </Button>
              <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <ScrollArea className="max-h-[calc(90vh-80px)]">
            <div className="p-6 space-y-6">
              {/* Header info */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant={nota.status === 'PROCESSADA' ? 'default' : 'secondary'}>
                      {nota.status}
                    </Badge>
                    {nota.modelo && <Badge variant="outline">Modelo {nota.modelo}</Badge>}
                  </div>
                  {xmlExtras?.naturezaOperacao && (
                    <p className="text-sm text-muted-foreground">
                      <strong>Natureza:</strong> {xmlExtras.naturezaOperacao}
                    </p>
                  )}
                </div>
                <div className="text-right text-sm">
                  <p><strong>Emissão:</strong> {formatDate(nota.dh_emissao || '')}</p>
                </div>
              </div>

              <Separator />

              {/* Emitente e Destinatário */}
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-primary">
                    <Building2 className="h-4 w-4" />
                    EMITENTE (Fornecedor)
                  </div>
                  {emitenteInfo ? (
                    <div className="text-sm space-y-1 bg-muted/30 p-3 rounded-lg">
                      <p className="font-medium">{emitenteInfo.razaoSocial}</p>
                      {emitenteInfo.nomeFantasia && (
                        <p className="text-muted-foreground">{emitenteInfo.nomeFantasia}</p>
                      )}
                      {emitenteInfo.cnpj && <p>CNPJ: {emitenteInfo.cnpj}</p>}
                      {emitenteInfo.ie && <p>IE: {emitenteInfo.ie}</p>}
                      {emitenteInfo.endereco && (
                        <p className="text-muted-foreground text-xs mt-1">
                          {emitenteInfo.endereco.logradouro}, {emitenteInfo.endereco.nro} - {emitenteInfo.endereco.bairro}, {emitenteInfo.endereco.cidade}/{emitenteInfo.endereco.uf}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Não informado</p>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-primary">
                    <Building2 className="h-4 w-4" />
                    DESTINATÁRIO
                  </div>
                  {destinatarioInfo ? (
                    <div className="text-sm space-y-1 bg-muted/30 p-3 rounded-lg">
                      <p className="font-medium">{destinatarioInfo.razaoSocial}</p>
                      {destinatarioInfo.cnpj && <p>CNPJ: {destinatarioInfo.cnpj}</p>}
                      {destinatarioInfo.cpf && <p>CPF: {destinatarioInfo.cpf}</p>}
                      {destinatarioInfo.ie && <p>IE: {destinatarioInfo.ie}</p>}
                      {destinatarioInfo.endereco && (
                        <p className="text-muted-foreground text-xs mt-1">
                          {destinatarioInfo.endereco.logradouro}, {destinatarioInfo.endereco.nro} - {destinatarioInfo.endereco.bairro}, {destinatarioInfo.endereco.cidade}/{destinatarioInfo.endereco.uf}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Não informado</p>
                  )}
                </div>
              </div>

              <Separator />

              {/* Items */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-primary">
                  <Package className="h-4 w-4" />
                  PRODUTOS / SERVIÇOS ({itens.length} itens)
                </div>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-12">#</TableHead>
                        <TableHead className="w-24">Código</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead className="w-20">NCM</TableHead>
                        <TableHead className="w-16">CFOP</TableHead>
                        <TableHead className="w-16 text-right">Qtd</TableHead>
                        <TableHead className="w-16">Un</TableHead>
                        <TableHead className="w-24 text-right">Vl. Unit.</TableHead>
                        <TableHead className="w-24 text-right">Vl. Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {itens.map((item, idx) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono text-xs">{idx + 1}</TableCell>
                          <TableCell className="font-mono text-xs">{item.codigo_fornecedor || '-'}</TableCell>
                          <TableCell className="text-sm">{item.descricao || '-'}</TableCell>
                          <TableCell className="font-mono text-xs">{item.ncm || '-'}</TableCell>
                          <TableCell className="font-mono text-xs">{item.cfop || '-'}</TableCell>
                          <TableCell className="text-right font-mono">
                            {item.qcom?.toLocaleString('pt-BR', { minimumFractionDigits: 3 }) || '0'}
                          </TableCell>
                          <TableCell className="text-xs">{item.ucom || '-'}</TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(item.vuncom || 0)}
                          </TableCell>
                          <TableCell className="text-right font-mono font-medium">
                            {formatCurrency(item.vprod || 0)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <Separator />

              {/* Totais e Impostos */}
              <div className="grid grid-cols-2 gap-6">
                {/* Impostos (from XML) */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-primary">
                    <Calculator className="h-4 w-4" />
                    IMPOSTOS
                  </div>
                  <div className="bg-muted/30 p-4 rounded-lg space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Base de Cálculo ICMS:</span>
                      <span className="font-mono">{formatCurrency(totais?.vBC || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Valor ICMS:</span>
                      <span className="font-mono">{formatCurrency(totais?.vICMS || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Base de Cálculo ICMS ST:</span>
                      <span className="font-mono">{formatCurrency(totais?.vBCST || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Valor ICMS ST:</span>
                      <span className="font-mono">{formatCurrency(totais?.vST || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Valor IPI:</span>
                      <span className="font-mono">{formatCurrency(totais?.vIPI || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Valor PIS:</span>
                      <span className="font-mono">{formatCurrency(totais?.vPIS || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Valor COFINS:</span>
                      <span className="font-mono">{formatCurrency(totais?.vCOFINS || 0)}</span>
                    </div>
                  </div>
                </div>

                {/* Totais */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-primary">
                    <Receipt className="h-4 w-4" />
                    TOTAIS
                  </div>
                  <div className="bg-muted/30 p-4 rounded-lg space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Valor dos Produtos:</span>
                      <span className="font-mono">{formatCurrency(nota.total_produtos || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Valor do Frete:</span>
                      <span className="font-mono">{formatCurrency(totais?.vFrete || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Valor do Seguro:</span>
                      <span className="font-mono">{formatCurrency(totais?.vSeg || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Desconto:</span>
                      <span className="font-mono">{formatCurrency(totais?.vDesc || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Outras Despesas:</span>
                      <span className="font-mono">{formatCurrency(totais?.vOutro || 0)}</span>
                    </div>
                    <Separator className="my-2" />
                    <div className="flex justify-between text-base font-semibold">
                      <span>VALOR TOTAL DA NOTA:</span>
                      <span className="font-mono text-primary">{formatCurrency(nota.total_nota || 0)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Transporte */}
              {transportadoraInfo && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-primary">
                      <Truck className="h-4 w-4" />
                      TRANSPORTE
                    </div>
                    <div className="bg-muted/30 p-4 rounded-lg text-sm">
                      {transportadoraInfo.razaoSocial && (
                        <p><strong>Transportadora:</strong> {transportadoraInfo.razaoSocial}</p>
                      )}
                      {transportadoraInfo.cnpj && (
                        <p><strong>CNPJ:</strong> {transportadoraInfo.cnpj}</p>
                      )}
                      {transportadoraInfo.ie && (
                        <p><strong>IE:</strong> {transportadoraInfo.ie}</p>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Informações adicionais */}
              {(xmlExtras?.infCpl || xmlExtras?.infAdFisco) && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-primary">
                      <Info className="h-4 w-4" />
                      INFORMAÇÕES ADICIONAIS
                    </div>
                    <div className="bg-muted/30 p-4 rounded-lg text-sm space-y-2">
                      {xmlExtras?.infAdFisco && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Informações ao Fisco:</p>
                          <p className="text-xs">{xmlExtras.infAdFisco}</p>
                        </div>
                      )}
                      {xmlExtras?.infCpl && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Informações Complementares:</p>
                          <p className="text-xs">{xmlExtras.infCpl}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Auditoria */}
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-primary">
                  <ClipboardList className="h-4 w-4" />
                  AUDITORIA
                </div>
                <div className="bg-muted/30 p-4 rounded-lg text-sm">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-muted-foreground text-xs">Data de Importação</p>
                      <p className="font-medium">{formatDate(nota.created_at)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Status</p>
                      <p className="font-medium">{nota.status}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Technical info */}
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-primary">
                  <Hash className="h-4 w-4" />
                  INFORMAÇÕES TÉCNICAS
                </div>
                <div className="bg-muted/30 p-4 rounded-lg text-sm space-y-2">
                  <p><strong>Chave de Acesso:</strong></p>
                  <p className="font-mono text-xs break-all">{nota.chave_nfe}</p>
                  <div className="grid grid-cols-2 gap-2 mt-3 pt-2 border-t">
                    <p><strong>Modelo:</strong> {nota.modelo || '-'}</p>
                    <p><strong>Série:</strong> {nota.serie || '-'}</p>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ====================================================
// Print Content (simplified for Supabase data)
// ====================================================
function NFePrintContent({
  nota,
  itens,
  emitente,
  destinatario,
  totais,
  transportadora,
  naturezaOperacao,
}: {
  nota: NotaEntradaDB;
  itens: NotaEntradaItemDB[];
  emitente: XMLExtraData['emitente'];
  destinatario: XMLExtraData['destinatario'];
  totais: XMLExtraData['totais'] | null;
  transportadora: XMLExtraData['transportadora'];
  naturezaOperacao: string;
}) {
  return (
    <div className="nfe-print-container" style={{ fontFamily: 'Arial, sans-serif', fontSize: '10pt', color: '#000', background: '#fff' }}>
      <div style={{ textAlign: 'center', borderBottom: '2px solid #333', paddingBottom: '10px', marginBottom: '15px' }}>
        <h1 style={{ fontSize: '16pt', fontWeight: 'bold', margin: '0 0 5px 0' }}>DOCUMENTO AUXILIAR - NF-e</h1>
        <p style={{ margin: '2px 0', fontSize: '11pt' }}>Nota Fiscal Eletrônica</p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div>
          <p><strong>NF-e Nº:</strong> {nota.numero}</p>
          <p><strong>Série:</strong> {nota.serie}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p><strong>Emissão:</strong> {formatDate(nota.dh_emissao || '')}</p>
          {naturezaOperacao && <p><strong>Natureza:</strong> {naturezaOperacao}</p>}
        </div>
      </div>

      <div style={{ fontFamily: 'Courier New, monospace', fontSize: '9pt', background: '#f0f0f0', border: '1px solid #999', padding: '8px', marginBottom: '15px', wordBreak: 'break-all', textAlign: 'center' }}>
        <strong>Chave de Acesso:</strong><br />
        {nota.chave_nfe}
      </div>

      <div style={{ display: 'flex', gap: '20px', marginBottom: '15px' }}>
        <div style={{ flex: 1, border: '1px solid #ccc', padding: '10px', borderRadius: '4px' }}>
          <h3 style={{ fontSize: '10pt', fontWeight: 'bold', marginBottom: '8px' }}>EMITENTE</h3>
          {emitente ? (
            <>
              <p style={{ fontWeight: '600' }}>{emitente.razaoSocial}</p>
              {emitente.cnpj && <p>CNPJ: {emitente.cnpj}</p>}
              {emitente.ie && <p>IE: {emitente.ie}</p>}
            </>
          ) : <p>Não informado</p>}
        </div>
        <div style={{ flex: 1, border: '1px solid #ccc', padding: '10px', borderRadius: '4px' }}>
          <h3 style={{ fontSize: '10pt', fontWeight: 'bold', marginBottom: '8px' }}>DESTINATÁRIO</h3>
          {destinatario ? (
            <>
              <p style={{ fontWeight: '600' }}>{destinatario.razaoSocial}</p>
              {destinatario.cnpj && <p>CNPJ: {destinatario.cnpj}</p>}
              {destinatario.ie && <p>IE: {destinatario.ie}</p>}
            </>
          ) : <p>Não informado</p>}
        </div>
      </div>

      <h3 style={{ fontSize: '10pt', fontWeight: 'bold', marginBottom: '8px' }}>PRODUTOS ({itens.length} itens)</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8pt', marginBottom: '15px' }}>
        <thead>
          <tr style={{ background: '#f0f0f0' }}>
            <th style={{ border: '1px solid #ccc', padding: '4px', textAlign: 'left' }}>#</th>
            <th style={{ border: '1px solid #ccc', padding: '4px', textAlign: 'left' }}>Código</th>
            <th style={{ border: '1px solid #ccc', padding: '4px', textAlign: 'left' }}>Descrição</th>
            <th style={{ border: '1px solid #ccc', padding: '4px', textAlign: 'left' }}>NCM</th>
            <th style={{ border: '1px solid #ccc', padding: '4px', textAlign: 'left' }}>CFOP</th>
            <th style={{ border: '1px solid #ccc', padding: '4px', textAlign: 'right' }}>Qtd</th>
            <th style={{ border: '1px solid #ccc', padding: '4px', textAlign: 'left' }}>Un</th>
            <th style={{ border: '1px solid #ccc', padding: '4px', textAlign: 'right' }}>Vl. Unit.</th>
            <th style={{ border: '1px solid #ccc', padding: '4px', textAlign: 'right' }}>Vl. Total</th>
          </tr>
        </thead>
        <tbody>
          {itens.map((item, idx) => (
            <tr key={item.id}>
              <td style={{ border: '1px solid #ccc', padding: '3px' }}>{idx + 1}</td>
              <td style={{ border: '1px solid #ccc', padding: '3px' }}>{item.codigo_fornecedor || '-'}</td>
              <td style={{ border: '1px solid #ccc', padding: '3px' }}>{item.descricao || '-'}</td>
              <td style={{ border: '1px solid #ccc', padding: '3px' }}>{item.ncm || '-'}</td>
              <td style={{ border: '1px solid #ccc', padding: '3px' }}>{item.cfop || '-'}</td>
              <td style={{ border: '1px solid #ccc', padding: '3px', textAlign: 'right' }}>
                {item.qcom?.toLocaleString('pt-BR', { minimumFractionDigits: 3 }) || '0'}
              </td>
              <td style={{ border: '1px solid #ccc', padding: '3px' }}>{item.ucom || '-'}</td>
              <td style={{ border: '1px solid #ccc', padding: '3px', textAlign: 'right' }}>{formatCurrency(item.vuncom || 0)}</td>
              <td style={{ border: '1px solid #ccc', padding: '3px', textAlign: 'right', fontWeight: '600' }}>{formatCurrency(item.vprod || 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: 'flex', gap: '20px', marginBottom: '15px' }}>
        <div style={{ flex: 1, border: '1px solid #ccc', padding: '10px', borderRadius: '4px' }}>
          <h3 style={{ fontSize: '10pt', fontWeight: 'bold', marginBottom: '8px' }}>TOTAIS</h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span>Valor Produtos:</span>
            <span>{formatCurrency(nota.total_produtos || 0)}</span>
          </div>
          <div style={{ borderTop: '1px solid #999', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '11pt' }}>
            <span>TOTAL DA NOTA:</span>
            <span>{formatCurrency(nota.total_nota || 0)}</span>
          </div>
        </div>
      </div>

      <div style={{ marginTop: '20px', paddingTop: '10px', borderTop: '1px solid #ccc', fontSize: '8pt', color: '#666', textAlign: 'center' }}>
        <p>Documento gerado em {new Date().toLocaleString('pt-BR')} | Sistema ERP Industrial</p>
      </div>
    </div>
  );
}
