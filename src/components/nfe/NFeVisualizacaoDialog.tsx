import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  FileDown,
  ArrowLeft,
  Building2,
  Truck,
  Package,
  Receipt,
  Calculator,
  FileText,
  Calendar,
  Hash,
  Info,
  Loader2,
  CreditCard,
  Code,
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { supabase } from '@/integrations/supabase/client';

// ====================================================
// Types
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
  fornecedor_razao?: string | null;
  fornecedor_cnpj?: string | null;
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

// Extended XML parsed data
interface XMLFullData {
  emitente: {
    cnpj: string; razaoSocial: string; nomeFantasia: string; ie: string;
    cnae?: string; crt?: string;
    endereco?: { logradouro: string; nro: string; complemento?: string; bairro: string; cidade: string; uf: string; cep: string; telefone?: string };
  } | null;
  destinatario: {
    cnpj: string; cpf: string; razaoSocial: string; ie: string;
    endereco?: { logradouro: string; nro: string; complemento?: string; bairro: string; cidade: string; uf: string; cep: string; telefone?: string };
  } | null;
  ide: {
    naturezaOperacao: string; tipoOperacao: string; finalidade: string;
    ambiente: string; protocolo: string; dhRecebimento: string;
    cUF: string; cNF: string; indPag: string; tpEmis: string;
    dhSaiEnt: string; verProc: string;
  };
  totais: {
    vBC: number; vICMS: number; vICMSDeson: number; vBCST: number; vST: number;
    vProd: number; vFrete: number; vSeg: number; vDesc: number; vOutro: number;
    vIPI: number; vPIS: number; vCOFINS: number; vNF: number; vTotTrib: number;
  };
  transporte: {
    modFrete: string;
    transportadora?: { cnpj: string; razaoSocial: string; ie: string; endereco?: string; uf?: string; municipio?: string };
    veiculo?: { placa: string; uf: string; rntc?: string };
    volumes: Array<{ qVol: number; especie: string; pesoL: number; pesoB: number; marca?: string; nVol?: string }>;
  } | null;
  cobranca: {
    fatura?: { nFat: string; vOrig: number; vDesc: number; vLiq: number };
    duplicatas: Array<{ nDup: string; dVenc: string; vDup: number }>;
  };
  pagamentos: Array<{ tPag: string; vPag: number; descricao: string }>;
  itensDetalhados: Array<{
    nItem: number; cProd: string; xProd: string; ncm: string; cfop: string;
    uCom: string; qCom: number; vUnCom: number; vProd: number; ean: string;
    cest?: string; infAdProd?: string;
    icms: { orig: string; cst: string; vBC: number; pICMS: number; vICMS: number };
    ipi: { cst: string; vBC: number; pIPI: number; vIPI: number };
    pis: { cst: string; vBC: number; pPIS: number; vPIS: number };
    cofins: { cst: string; vBC: number; pCOFINS: number; vCOFINS: number };
  }>;
  infCpl: string;
  infAdFisco: string;
}

// ====================================================
// XML Parser - Full extraction
// ====================================================
function parseXMLFull(xmlString: string): XMLFullData | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'text/xml');
    if (doc.querySelector('parsererror')) return null;

    const gt = (el: Element | null, tag: string) => {
      if (!el) return '';
      const c = el.getElementsByTagName(tag)[0];
      return c?.textContent?.trim() || '';
    };
    const gf = (el: Element | null, tag: string) => parseFloat(gt(el, tag)) || 0;

    // ide
    const ide = doc.getElementsByTagName('ide')[0];
    const ideData = {
      naturezaOperacao: gt(ide, 'natOp'),
      tipoOperacao: gt(ide, 'tpNF') === '0' ? 'Entrada' : 'Saída',
      finalidade: { '1': 'Normal', '2': 'Complementar', '3': 'Ajuste', '4': 'Devolução' }[gt(ide, 'finNFe')] || gt(ide, 'finNFe'),
      ambiente: gt(ide, 'tpAmb') === '1' ? 'Produção' : 'Homologação',
      protocolo: '',
      dhRecebimento: '',
      cUF: gt(ide, 'cUF'),
      cNF: gt(ide, 'cNF'),
      indPag: gt(ide, 'indPag'),
      tpEmis: gt(ide, 'tpEmis'),
      dhSaiEnt: gt(ide, 'dhSaiEnt'),
      verProc: '',
    };

    // protNFe
    const protNFe = doc.getElementsByTagName('protNFe')[0];
    if (protNFe) {
      ideData.protocolo = gt(protNFe, 'nProt');
      ideData.dhRecebimento = gt(protNFe, 'dhRecbto');
    }
    const infNFe = doc.getElementsByTagName('infNFe')[0];
    ideData.verProc = gt(doc.getElementsByTagName('infProt')[0] || infNFe, 'verProc');

    // emit
    const emit = doc.getElementsByTagName('emit')[0];
    const enderEmit = emit?.getElementsByTagName('enderEmit')[0];
    const emitente = emit ? {
      cnpj: gt(emit, 'CNPJ'), razaoSocial: gt(emit, 'xNome'), nomeFantasia: gt(emit, 'xFant'), ie: gt(emit, 'IE'),
      cnae: gt(emit, 'CNAE'), crt: gt(emit, 'CRT'),
      endereco: enderEmit ? {
        logradouro: gt(enderEmit, 'xLgr'), nro: gt(enderEmit, 'nro'), complemento: gt(enderEmit, 'xCpl'),
        bairro: gt(enderEmit, 'xBairro'), cidade: gt(enderEmit, 'xMun'), uf: gt(enderEmit, 'UF'),
        cep: gt(enderEmit, 'CEP'), telefone: gt(enderEmit, 'fone'),
      } : undefined,
    } : null;

    // dest
    const dest = doc.getElementsByTagName('dest')[0];
    const enderDest = dest?.getElementsByTagName('enderDest')[0];
    const destinatario = dest ? {
      cnpj: gt(dest, 'CNPJ'), cpf: gt(dest, 'CPF'), razaoSocial: gt(dest, 'xNome'), ie: gt(dest, 'IE'),
      endereco: enderDest ? {
        logradouro: gt(enderDest, 'xLgr'), nro: gt(enderDest, 'nro'), complemento: gt(enderDest, 'xCpl'),
        bairro: gt(enderDest, 'xBairro'), cidade: gt(enderDest, 'xMun'), uf: gt(enderDest, 'UF'),
        cep: gt(enderDest, 'CEP'), telefone: gt(enderDest, 'fone'),
      } : undefined,
    } : null;

    // ICMSTot
    const tot = doc.getElementsByTagName('ICMSTot')[0];
    const totais = {
      vBC: gf(tot, 'vBC'), vICMS: gf(tot, 'vICMS'), vICMSDeson: gf(tot, 'vICMSDeson'),
      vBCST: gf(tot, 'vBCST'), vST: gf(tot, 'vST'), vProd: gf(tot, 'vProd'),
      vFrete: gf(tot, 'vFrete'), vSeg: gf(tot, 'vSeg'), vDesc: gf(tot, 'vDesc'),
      vOutro: gf(tot, 'vOutro'), vIPI: gf(tot, 'vIPI'), vPIS: gf(tot, 'vPIS'),
      vCOFINS: gf(tot, 'vCOFINS'), vNF: gf(tot, 'vNF'), vTotTrib: gf(tot, 'vTotTrib'),
    };

    // transp
    const transp = doc.getElementsByTagName('transp')[0];
    let transporte: XMLFullData['transporte'] = null;
    if (transp) {
      const modFreteMap: Record<string, string> = {
        '0': 'CIF (Emitente)', '1': 'FOB (Destinatário)', '2': 'Terceiros',
        '3': 'Próprio Remetente', '4': 'Próprio Destinatário', '9': 'Sem Frete',
      };
      const transporta = transp.getElementsByTagName('transporta')[0];
      const veicTransp = transp.getElementsByTagName('veicTransp')[0];
      const vols = Array.from(transp.getElementsByTagName('vol'));
      transporte = {
        modFrete: modFreteMap[gt(transp, 'modFrete')] || gt(transp, 'modFrete'),
        transportadora: transporta ? {
          cnpj: gt(transporta, 'CNPJ'), razaoSocial: gt(transporta, 'xNome'), ie: gt(transporta, 'IE'),
          endereco: gt(transporta, 'xEnder'), uf: gt(transporta, 'UF'), municipio: gt(transporta, 'xMun'),
        } : undefined,
        veiculo: veicTransp ? { placa: gt(veicTransp, 'placa'), uf: gt(veicTransp, 'UF'), rntc: gt(veicTransp, 'RNTC') } : undefined,
        volumes: vols.map(v => ({
          qVol: gf(v, 'qVol'), especie: gt(v, 'esp'), pesoL: gf(v, 'pesoL'), pesoB: gf(v, 'pesoB'),
          marca: gt(v, 'marca'), nVol: gt(v, 'nVol'),
        })),
      };
    }

    // cobr
    const cobr = doc.getElementsByTagName('cobr')[0];
    const fat = cobr?.getElementsByTagName('fat')[0];
    const dups = cobr ? Array.from(cobr.getElementsByTagName('dup')) : [];
    const cobranca = {
      fatura: fat ? { nFat: gt(fat, 'nFat'), vOrig: gf(fat, 'vOrig'), vDesc: gf(fat, 'vDesc'), vLiq: gf(fat, 'vLiq') } : undefined,
      duplicatas: dups.map(d => ({ nDup: gt(d, 'nDup'), dVenc: gt(d, 'dVenc'), vDup: gf(d, 'vDup') })),
    };

    // pag
    const pagNode = doc.getElementsByTagName('pag')[0];
    const detPags = pagNode ? Array.from(pagNode.getElementsByTagName('detPag')) : [];
    const tPagMap: Record<string, string> = {
      '01': 'Dinheiro', '02': 'Cheque', '03': 'Cartão Crédito', '04': 'Cartão Débito',
      '05': 'Crédito Loja', '10': 'Vale Alimentação', '11': 'Vale Refeição',
      '12': 'Vale Presente', '13': 'Vale Combustível', '14': 'Duplicata Mercantil',
      '15': 'Boleto Bancário', '16': 'Depósito Bancário', '17': 'PIX', '90': 'Sem Pagamento', '99': 'Outros',
    };
    const pagamentos = detPags.map(d => {
      const code = gt(d, 'tPag');
      return { tPag: code, vPag: gf(d, 'vPag'), descricao: tPagMap[code] || `Código ${code}` };
    });

    // det (items with taxes)
    const dets = Array.from(doc.getElementsByTagName('det'));
    const itensDetalhados = dets.map(det => {
      const prod = det.getElementsByTagName('prod')[0];
      const imposto = det.getElementsByTagName('imposto')[0];
      
      // ICMS - find the actual CST node
      const icmsGroup = imposto?.getElementsByTagName('ICMS')[0];
      const icmsNode = icmsGroup ? (icmsGroup.children[0] || null) : null;
      
      // IPI
      const ipiGroup = imposto?.getElementsByTagName('IPI')[0];
      const ipiTrib = ipiGroup?.getElementsByTagName('IPITrib')[0];
      
      // PIS
      const pisGroup = imposto?.getElementsByTagName('PIS')[0];
      const pisNode = pisGroup ? (pisGroup.children[0] || null) : null;
      
      // COFINS
      const cofinsGroup = imposto?.getElementsByTagName('COFINS')[0];
      const cofinsNode = cofinsGroup ? (cofinsGroup.children[0] || null) : null;

      return {
        nItem: parseInt(det.getAttribute('nItem') || '0'),
        cProd: gt(prod, 'cProd'), xProd: gt(prod, 'xProd'), ncm: gt(prod, 'NCM'),
        cfop: gt(prod, 'CFOP'), uCom: gt(prod, 'uCom'), qCom: gf(prod, 'qCom'),
        vUnCom: gf(prod, 'vUnCom'), vProd: gf(prod, 'vProd'), ean: gt(prod, 'cEAN'),
        cest: gt(prod, 'CEST'), infAdProd: gt(det, 'infAdProd'),
        icms: {
          orig: gt(icmsNode, 'orig'), cst: gt(icmsNode, 'CST') || gt(icmsNode, 'CSOSN'),
          vBC: gf(icmsNode, 'vBC'), pICMS: gf(icmsNode, 'pICMS'), vICMS: gf(icmsNode, 'vICMS'),
        },
        ipi: {
          cst: gt(ipiGroup, 'CST'), vBC: gf(ipiTrib, 'vBC'),
          pIPI: gf(ipiTrib, 'pIPI'), vIPI: gf(ipiTrib, 'vIPI'),
        },
        pis: {
          cst: gt(pisNode, 'CST'), vBC: gf(pisNode, 'vBC'),
          pPIS: gf(pisNode, 'pPIS'), vPIS: gf(pisNode, 'vPIS'),
        },
        cofins: {
          cst: gt(cofinsNode, 'CST'), vBC: gf(cofinsNode, 'vBC'),
          pCOFINS: gf(cofinsNode, 'pCOFINS'), vCOFINS: gf(cofinsNode, 'vCOFINS'),
        },
      };
    });

    // infAdic
    const infAdic = doc.getElementsByTagName('infAdic')[0];
    const infCpl = gt(infAdic, 'infCpl');
    const infAdFisco = gt(infAdic, 'infAdFisco');

    return { emitente, destinatario, ide: ideData, totais, transporte, cobranca, pagamentos, itensDetalhados, infCpl, infAdFisco };
  } catch {
    return null;
  }
}

// ====================================================
// Format chave with spaces
// ====================================================
function formatChave(chave: string): string {
  return chave.replace(/(\d{4})(?=\d)/g, '$1 ');
}

// ====================================================
// Status badge for NF-e
// ====================================================
function getStatusInfo(status: string) {
  const map: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    IMPORTADA: { label: 'IMPORTADA', variant: 'secondary' },
    PROCESSADA: { label: 'AUTORIZADA', variant: 'default' },
    CANCELADA: { label: 'CANCELADA', variant: 'destructive' },
  };
  return map[status] || { label: status, variant: 'outline' };
}

// ====================================================
// Dialog Props
// ====================================================
interface NFeVisualizacaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chaveNfe: string;
}

export function NFeVisualizacaoDialog({ open, onOpenChange, chaveNfe }: NFeVisualizacaoDialogProps) {
  const [nota, setNota] = useState<NotaEntradaDB | null>(null);
  const [itens, setItens] = useState<NotaEntradaItemDB[]>([]);
  const [xmlData, setXmlData] = useState<XMLFullData | null>(null);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!open || !chaveNfe) return;
    setLoading(true);
    setNotFound(false);
    setNota(null); setItens([]); setXmlData(null);

    (async () => {
      try {
        const { data: notaData, error } = await supabase
          .from('notas_entrada')
          .select('*, fornecedor:entidades!notas_entrada_fornecedor_id_fkey(razao_social, documento, nome_fantasia, ie)')
          .eq('chave_nfe', chaveNfe)
          .maybeSingle();
        if (error) throw error;
        if (!notaData) { setNotFound(true); setLoading(false); return; }

        const typed = notaData as unknown as NotaEntradaDB;
        setNota(typed);

        const { data: itensData } = await supabase
          .from('notas_entrada_itens')
          .select('id, codigo_fornecedor, descricao, ncm, cfop, ucom, qcom, vuncom, vprod, ean')
          .eq('nota_entrada_id', typed.id);
        setItens((itensData || []) as unknown as NotaEntradaItemDB[]);

        if (typed.xml_raw) {
          setXmlData(parseXMLFull(typed.xml_raw));
        }
      } catch (err) {
        console.error('Erro ao buscar nota:', err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, chaveNfe]);

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

  if (notFound || !nota) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <div className="py-8 text-center">
            <p className="text-lg font-medium">Nota não encontrada</p>
            <p className="text-sm text-muted-foreground mt-1">A chave informada não foi encontrada no sistema.</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const statusInfo = getStatusInfo(nota.status);
  const emitenteNome = xmlData?.emitente?.razaoSocial || nota.fornecedor?.razao_social || nota.fornecedor_razao || '';

  const handleDownloadDANFE = () => {
    // Simple print of the DANFE tab content
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[95vh] p-0 gap-0">
        {/* Header */}
        <div className="p-5 border-b">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <button onClick={() => onOpenChange(false)} className="mt-1 text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold">NF-e Nº {nota.numero || '-'}</h2>
                  <span className="text-muted-foreground">Série {nota.serie || '1'}</span>
                  <Badge variant={statusInfo.variant} className={statusInfo.variant === 'default' ? 'bg-green-600 hover:bg-green-700' : ''}>
                    {statusInfo.label}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Emissão: {formatDate(nota.dh_emissao || '')} · {emitenteNome}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleDownloadDANFE}>
              <FileDown className="h-4 w-4 mr-2" />
              Baixar DANFE
            </Button>
          </div>

          {/* Chave de acesso */}
          <div className="mt-4 bg-muted/50 border rounded-lg px-4 py-2.5">
            <span className="text-sm text-muted-foreground">Chave de Acesso: </span>
            <span className="text-sm font-mono">{formatChave(nota.chave_nfe)}</span>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="danfe" className="flex flex-col flex-1 min-h-0">
          <div className="border-b px-5">
            <TabsList className="bg-transparent h-auto p-0 gap-0">
              <TabsTrigger value="danfe" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5">
                <FileText className="h-4 w-4 mr-2" /> DANFE
              </TabsTrigger>
              <TabsTrigger value="dados" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5">
                <Info className="h-4 w-4 mr-2" /> Dados Gerais
              </TabsTrigger>
              <TabsTrigger value="produtos" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5">
                <Package className="h-4 w-4 mr-2" /> Produtos ({xmlData?.itensDetalhados?.length || itens.length})
              </TabsTrigger>
              <TabsTrigger value="impostos" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5">
                <Calculator className="h-4 w-4 mr-2" /> Impostos
              </TabsTrigger>
              <TabsTrigger value="transporte" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5">
                <Truck className="h-4 w-4 mr-2" /> Transporte
              </TabsTrigger>
              <TabsTrigger value="pagamento" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5">
                <CreditCard className="h-4 w-4 mr-2" /> Pagamento
              </TabsTrigger>
              <TabsTrigger value="duplicatas" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5">
                <Calendar className="h-4 w-4 mr-2" /> Duplicatas
              </TabsTrigger>
              <TabsTrigger value="xml" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5">
                <Code className="h-4 w-4 mr-2" /> XML Bruto
              </TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="flex-1 max-h-[calc(95vh-220px)]">
            {/* DANFE Tab */}
            <TabsContent value="danfe" className="mt-0 p-6">
              <TabDANFE nota={nota} xmlData={xmlData} itens={itens} />
            </TabsContent>

            {/* Dados Gerais */}
            <TabsContent value="dados" className="mt-0 p-6">
              <TabDadosGerais nota={nota} xmlData={xmlData} />
            </TabsContent>

            {/* Produtos */}
            <TabsContent value="produtos" className="mt-0 p-6">
              <TabProdutos xmlData={xmlData} itens={itens} />
            </TabsContent>

            {/* Impostos */}
            <TabsContent value="impostos" className="mt-0 p-6">
              <TabImpostos xmlData={xmlData} nota={nota} />
            </TabsContent>

            {/* Transporte */}
            <TabsContent value="transporte" className="mt-0 p-6">
              <TabTransporte xmlData={xmlData} />
            </TabsContent>

            {/* Pagamento */}
            <TabsContent value="pagamento" className="mt-0 p-6">
              <TabPagamento xmlData={xmlData} />
            </TabsContent>

            {/* Duplicatas */}
            <TabsContent value="duplicatas" className="mt-0 p-6">
              <TabDuplicatas xmlData={xmlData} />
            </TabsContent>

            {/* XML Bruto */}
            <TabsContent value="xml" className="mt-0 p-6">
              <TabXMLBruto xmlRaw={nota.xml_raw} />
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ====================================================
// Tab: DANFE (simplified visual representation)
// ====================================================
function TabDANFE({ nota, xmlData, itens }: { nota: NotaEntradaDB; xmlData: XMLFullData | null; itens: NotaEntradaItemDB[] }) {
  const emit = xmlData?.emitente;
  const dest = xmlData?.destinatario;
  const totais = xmlData?.totais;
  const produtos = xmlData?.itensDetalhados || [];

  return (
    <div className="max-w-4xl mx-auto border rounded-lg p-6 bg-background space-y-4 text-sm print:p-2">
      {/* Header */}
      <div className="text-center border-b pb-3">
        <h2 className="text-lg font-bold">DOCUMENTO AUXILIAR DA NOTA FISCAL ELETRÔNICA</h2>
        <p className="text-xs text-muted-foreground mt-1">0 - ENTRADA | 1 - SAÍDA</p>
      </div>

      {/* Emitente / Destinatário */}
      <div className="grid grid-cols-2 gap-4">
        <div className="border rounded p-3 space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Emitente</p>
          <p className="font-bold">{emit?.razaoSocial || nota.fornecedor?.razao_social || '-'}</p>
          {emit?.nomeFantasia && <p className="text-muted-foreground">{emit.nomeFantasia}</p>}
          <p>CNPJ: {emit?.cnpj || nota.fornecedor?.documento || '-'}</p>
          {emit?.ie && <p>IE: {emit.ie}</p>}
          {emit?.endereco && (
            <p className="text-xs text-muted-foreground">
              {emit.endereco.logradouro}, {emit.endereco.nro} - {emit.endereco.bairro}, {emit.endereco.cidade}/{emit.endereco.uf} - CEP: {emit.endereco.cep}
            </p>
          )}
        </div>
        <div className="border rounded p-3 space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Destinatário</p>
          {dest ? (
            <>
              <p className="font-bold">{dest.razaoSocial}</p>
              {dest.cnpj && <p>CNPJ: {dest.cnpj}</p>}
              {dest.cpf && <p>CPF: {dest.cpf}</p>}
              {dest.ie && <p>IE: {dest.ie}</p>}
              {dest.endereco && (
                <p className="text-xs text-muted-foreground">
                  {dest.endereco.logradouro}, {dest.endereco.nro} - {dest.endereco.bairro}, {dest.endereco.cidade}/{dest.endereco.uf}
                </p>
              )}
            </>
          ) : <p className="text-muted-foreground">Não informado</p>}
        </div>
      </div>

      {/* Chave e dados da nota */}
      <div className="border rounded p-3 space-y-1">
        <div className="flex justify-between">
          <div>
            <span className="text-xs text-muted-foreground">NF-e Nº </span>
            <span className="font-bold">{nota.numero}</span>
            <span className="text-xs text-muted-foreground ml-3">Série </span>
            <span className="font-bold">{nota.serie}</span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Emissão: </span>
            <span>{formatDate(nota.dh_emissao || '')}</span>
          </div>
        </div>
        <p className="font-mono text-xs break-all mt-1">Chave: {nota.chave_nfe}</p>
        {xmlData?.ide.protocolo && (
          <p className="text-xs text-muted-foreground">Protocolo: {xmlData.ide.protocolo}</p>
        )}
      </div>

      {/* Natureza */}
      {xmlData?.ide.naturezaOperacao && (
        <div className="border rounded p-3">
          <span className="text-xs text-muted-foreground">Natureza da Operação: </span>
          <span className="font-medium">{xmlData.ide.naturezaOperacao}</span>
        </div>
      )}

      {/* Produtos */}
      <div className="border rounded overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 text-xs">
              <TableHead className="w-10">#</TableHead>
              <TableHead className="w-20">Código</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="w-20">NCM</TableHead>
              <TableHead className="w-14">CFOP</TableHead>
              <TableHead className="w-14">Un</TableHead>
              <TableHead className="w-16 text-right">Qtd</TableHead>
              <TableHead className="w-24 text-right">Vl.Unit</TableHead>
              <TableHead className="w-24 text-right">Vl.Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(produtos.length > 0 ? produtos : itens.map((i, idx) => ({
              nItem: idx + 1, cProd: i.codigo_fornecedor || '', xProd: i.descricao || '',
              ncm: i.ncm || '', cfop: i.cfop || '', uCom: i.ucom || '',
              qCom: i.qcom || 0, vUnCom: i.vuncom || 0, vProd: i.vprod || 0,
            }))).map((p: any) => (
              <TableRow key={p.nItem} className="text-xs">
                <TableCell>{p.nItem}</TableCell>
                <TableCell className="font-mono">{p.cProd}</TableCell>
                <TableCell>{p.xProd}</TableCell>
                <TableCell className="font-mono">{p.ncm}</TableCell>
                <TableCell className="font-mono">{p.cfop}</TableCell>
                <TableCell>{p.uCom}</TableCell>
                <TableCell className="text-right font-mono">{p.qCom?.toLocaleString('pt-BR', { minimumFractionDigits: 3 })}</TableCell>
                <TableCell className="text-right font-mono">{formatCurrency(p.vUnCom)}</TableCell>
                <TableCell className="text-right font-mono font-medium">{formatCurrency(p.vProd)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Totais */}
      <div className="border rounded p-3 grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Row label="Valor dos Produtos" value={formatCurrency(totais?.vProd || nota.total_produtos || 0)} />
          <Row label="Frete" value={formatCurrency(totais?.vFrete || 0)} />
          <Row label="Seguro" value={formatCurrency(totais?.vSeg || 0)} />
          <Row label="Desconto" value={formatCurrency(totais?.vDesc || 0)} />
          <Row label="Outras Despesas" value={formatCurrency(totais?.vOutro || 0)} />
        </div>
        <div className="space-y-1">
          <Row label="ICMS" value={formatCurrency(totais?.vICMS || 0)} />
          <Row label="ICMS ST" value={formatCurrency(totais?.vST || 0)} />
          <Row label="IPI" value={formatCurrency(totais?.vIPI || 0)} />
          <Row label="PIS" value={formatCurrency(totais?.vPIS || 0)} />
          <Row label="COFINS" value={formatCurrency(totais?.vCOFINS || 0)} />
        </div>
        <div className="col-span-2 pt-2 border-t">
          <div className="flex justify-between text-base font-bold">
            <span>VALOR TOTAL DA NOTA</span>
            <span className="text-primary">{formatCurrency(totais?.vNF || nota.total_nota || 0)}</span>
          </div>
        </div>
      </div>

      {/* Info complementares */}
      {(xmlData?.infCpl || xmlData?.infAdFisco) && (
        <div className="border rounded p-3 text-xs space-y-1">
          <p className="font-semibold text-muted-foreground uppercase text-[10px]">Informações Complementares</p>
          {xmlData?.infAdFisco && <p>{xmlData.infAdFisco}</p>}
          {xmlData?.infCpl && <p>{xmlData.infCpl}</p>}
        </div>
      )}
    </div>
  );
}

// ====================================================
// Tab: Dados Gerais
// ====================================================
function TabDadosGerais({ nota, xmlData }: { nota: NotaEntradaDB; xmlData: XMLFullData | null }) {
  const emit = xmlData?.emitente;
  const dest = xmlData?.destinatario;
  const ide = xmlData?.ide;

  return (
    <div className="space-y-6">
      {/* Identificação da NF-e */}
      <Section title="Identificação">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Field label="Número" value={nota.numero || '-'} />
          <Field label="Série" value={nota.serie || '-'} />
          <Field label="Modelo" value={nota.modelo || '55'} />
          <Field label="Status" value={nota.status} />
          <Field label="Natureza da Operação" value={ide?.naturezaOperacao || '-'} />
          <Field label="Tipo" value={ide?.tipoOperacao || '-'} />
          <Field label="Finalidade" value={ide?.finalidade || '-'} />
          <Field label="Ambiente" value={ide?.ambiente || '-'} />
          <Field label="Data Emissão" value={formatDate(nota.dh_emissao || '')} />
          <Field label="Data Saída/Entrada" value={ide?.dhSaiEnt ? formatDate(ide.dhSaiEnt) : '-'} />
          <Field label="Protocolo" value={ide?.protocolo || '-'} />
          <Field label="Data Autorização" value={ide?.dhRecebimento ? formatDate(ide.dhRecebimento) : '-'} />
        </div>
      </Section>

      {/* Emitente */}
      <Section title="Emitente">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Field label="Razão Social" value={emit?.razaoSocial || nota.fornecedor?.razao_social || '-'} className="col-span-2" />
          <Field label="Nome Fantasia" value={emit?.nomeFantasia || '-'} />
          <Field label="CNPJ" value={emit?.cnpj || nota.fornecedor?.documento || '-'} />
          <Field label="IE" value={emit?.ie || '-'} />
          <Field label="CNAE" value={emit?.cnae || '-'} />
          <Field label="CRT" value={emit?.crt || '-'} />
          {emit?.endereco && (
            <>
              <Field label="Endereço" value={`${emit.endereco.logradouro}, ${emit.endereco.nro}`} className="col-span-2" />
              <Field label="Bairro" value={emit.endereco.bairro} />
              <Field label="Município" value={emit.endereco.cidade} />
              <Field label="UF" value={emit.endereco.uf} />
              <Field label="CEP" value={emit.endereco.cep} />
            </>
          )}
        </div>
      </Section>

      {/* Destinatário */}
      <Section title="Destinatário">
        {dest ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Field label="Razão Social" value={dest.razaoSocial} className="col-span-2" />
            <Field label="CNPJ" value={dest.cnpj || '-'} />
            <Field label="CPF" value={dest.cpf || '-'} />
            <Field label="IE" value={dest.ie || '-'} />
            {dest.endereco && (
              <>
                <Field label="Endereço" value={`${dest.endereco.logradouro}, ${dest.endereco.nro}`} className="col-span-2" />
                <Field label="Bairro" value={dest.endereco.bairro} />
                <Field label="Município" value={dest.endereco.cidade} />
                <Field label="UF" value={dest.endereco.uf} />
                <Field label="CEP" value={dest.endereco.cep} />
              </>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground">Não informado no XML</p>
        )}
      </Section>
    </div>
  );
}

// ====================================================
// Tab: Produtos
// ====================================================
function TabProdutos({ xmlData, itens }: { xmlData: XMLFullData | null; itens: NotaEntradaItemDB[] }) {
  const produtos = xmlData?.itensDetalhados || [];
  const hasXmlItems = produtos.length > 0;

  return (
    <div className="space-y-4">
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-10">#</TableHead>
              <TableHead className="w-24">Código</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="w-20">NCM</TableHead>
              <TableHead className="w-14">CFOP</TableHead>
              <TableHead className="w-14">Un</TableHead>
              <TableHead className="w-20 text-right">Qtd</TableHead>
              <TableHead className="w-24 text-right">Vl. Unit.</TableHead>
              <TableHead className="w-24 text-right">Vl. Total</TableHead>
              {hasXmlItems && <TableHead className="w-24 text-right">ICMS</TableHead>}
              {hasXmlItems && <TableHead className="w-24 text-right">IPI</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {hasXmlItems ? produtos.map(p => (
              <TableRow key={p.nItem}>
                <TableCell className="font-mono text-xs">{p.nItem}</TableCell>
                <TableCell className="font-mono text-xs">{p.cProd}</TableCell>
                <TableCell className="text-sm">
                  {p.xProd}
                  {p.infAdProd && <p className="text-xs text-muted-foreground mt-0.5">{p.infAdProd}</p>}
                </TableCell>
                <TableCell className="font-mono text-xs">{p.ncm}</TableCell>
                <TableCell className="font-mono text-xs">{p.cfop}</TableCell>
                <TableCell className="text-xs">{p.uCom}</TableCell>
                <TableCell className="text-right font-mono text-xs">{p.qCom.toLocaleString('pt-BR', { minimumFractionDigits: 3 })}</TableCell>
                <TableCell className="text-right font-mono text-xs">{formatCurrency(p.vUnCom)}</TableCell>
                <TableCell className="text-right font-mono text-xs font-medium">{formatCurrency(p.vProd)}</TableCell>
                <TableCell className="text-right font-mono text-xs">{formatCurrency(p.icms.vICMS)}</TableCell>
                <TableCell className="text-right font-mono text-xs">{formatCurrency(p.ipi.vIPI)}</TableCell>
              </TableRow>
            )) : itens.map((item, idx) => (
              <TableRow key={item.id}>
                <TableCell className="font-mono text-xs">{idx + 1}</TableCell>
                <TableCell className="font-mono text-xs">{item.codigo_fornecedor || '-'}</TableCell>
                <TableCell className="text-sm">{item.descricao || '-'}</TableCell>
                <TableCell className="font-mono text-xs">{item.ncm || '-'}</TableCell>
                <TableCell className="font-mono text-xs">{item.cfop || '-'}</TableCell>
                <TableCell className="text-xs">{item.ucom || '-'}</TableCell>
                <TableCell className="text-right font-mono text-xs">{item.qcom?.toLocaleString('pt-BR', { minimumFractionDigits: 3 })}</TableCell>
                <TableCell className="text-right font-mono text-xs">{formatCurrency(item.vuncom || 0)}</TableCell>
                <TableCell className="text-right font-mono text-xs font-medium">{formatCurrency(item.vprod || 0)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ====================================================
// Tab: Impostos
// ====================================================
function TabImpostos({ xmlData, nota }: { xmlData: XMLFullData | null; nota: NotaEntradaDB }) {
  const totais = xmlData?.totais;
  const produtos = xmlData?.itensDetalhados || [];

  return (
    <div className="space-y-6">
      {/* Totais gerais */}
      <Section title="Totais de Impostos">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Field label="Base Cálculo ICMS" value={formatCurrency(totais?.vBC || 0)} />
          <Field label="Valor ICMS" value={formatCurrency(totais?.vICMS || 0)} />
          <Field label="ICMS Desonerado" value={formatCurrency(totais?.vICMSDeson || 0)} />
          <Field label="Base Cálculo ICMS ST" value={formatCurrency(totais?.vBCST || 0)} />
          <Field label="Valor ICMS ST" value={formatCurrency(totais?.vST || 0)} />
          <Field label="Valor IPI" value={formatCurrency(totais?.vIPI || 0)} />
          <Field label="Valor PIS" value={formatCurrency(totais?.vPIS || 0)} />
          <Field label="Valor COFINS" value={formatCurrency(totais?.vCOFINS || 0)} />
          <Field label="Valor Total Tributos" value={formatCurrency(totais?.vTotTrib || 0)} />
          <Field label="Valor Frete" value={formatCurrency(totais?.vFrete || 0)} />
          <Field label="Valor Seguro" value={formatCurrency(totais?.vSeg || 0)} />
          <Field label="Valor Desconto" value={formatCurrency(totais?.vDesc || 0)} />
          <Field label="Outras Despesas" value={formatCurrency(totais?.vOutro || 0)} />
          <Field label="Valor Produtos" value={formatCurrency(totais?.vProd || nota.total_produtos || 0)} />
          <Field label="Valor Total NF-e" value={formatCurrency(totais?.vNF || nota.total_nota || 0)} bold />
        </div>
      </Section>

      {/* Per-item taxes */}
      {produtos.length > 0 && (
        <Section title="Impostos por Item">
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 text-xs">
                  <TableHead>#</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>ICMS Orig</TableHead>
                  <TableHead>ICMS CST</TableHead>
                  <TableHead className="text-right">ICMS BC</TableHead>
                  <TableHead className="text-right">ICMS %</TableHead>
                  <TableHead className="text-right">ICMS R$</TableHead>
                  <TableHead>IPI CST</TableHead>
                  <TableHead className="text-right">IPI %</TableHead>
                  <TableHead className="text-right">IPI R$</TableHead>
                  <TableHead>PIS CST</TableHead>
                  <TableHead className="text-right">PIS R$</TableHead>
                  <TableHead>COFINS CST</TableHead>
                  <TableHead className="text-right">COFINS R$</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {produtos.map(p => (
                  <TableRow key={p.nItem} className="text-xs">
                    <TableCell>{p.nItem}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{p.xProd}</TableCell>
                    <TableCell>{p.icms.orig}</TableCell>
                    <TableCell>{p.icms.cst}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(p.icms.vBC)}</TableCell>
                    <TableCell className="text-right font-mono">{p.icms.pICMS}%</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(p.icms.vICMS)}</TableCell>
                    <TableCell>{p.ipi.cst}</TableCell>
                    <TableCell className="text-right font-mono">{p.ipi.pIPI}%</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(p.ipi.vIPI)}</TableCell>
                    <TableCell>{p.pis.cst}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(p.pis.vPIS)}</TableCell>
                    <TableCell>{p.cofins.cst}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(p.cofins.vCOFINS)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Section>
      )}
    </div>
  );
}

// ====================================================
// Tab: Transporte
// ====================================================
function TabTransporte({ xmlData }: { xmlData: XMLFullData | null }) {
  const transp = xmlData?.transporte;

  if (!transp) {
    return <EmptyTab message="Dados de transporte não disponíveis no XML." />;
  }

  return (
    <div className="space-y-6">
      <Section title="Modalidade de Frete">
        <Field label="Tipo" value={transp.modFrete} />
      </Section>

      {transp.transportadora && (
        <Section title="Transportadora">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Field label="Razão Social" value={transp.transportadora.razaoSocial} className="col-span-2" />
            <Field label="CNPJ" value={transp.transportadora.cnpj || '-'} />
            <Field label="IE" value={transp.transportadora.ie || '-'} />
            {transp.transportadora.endereco && <Field label="Endereço" value={transp.transportadora.endereco} />}
            {transp.transportadora.uf && <Field label="UF" value={transp.transportadora.uf} />}
            {transp.transportadora.municipio && <Field label="Município" value={transp.transportadora.municipio} />}
          </div>
        </Section>
      )}

      {transp.veiculo && (
        <Section title="Veículo">
          <div className="grid grid-cols-3 gap-4">
            <Field label="Placa" value={transp.veiculo.placa} />
            <Field label="UF" value={transp.veiculo.uf} />
            <Field label="RNTC" value={transp.veiculo.rntc || '-'} />
          </div>
        </Section>
      )}

      {transp.volumes.length > 0 && (
        <Section title="Volumes">
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Qtd</TableHead>
                  <TableHead>Espécie</TableHead>
                  <TableHead>Marca</TableHead>
                  <TableHead>Numeração</TableHead>
                  <TableHead className="text-right">Peso Líquido</TableHead>
                  <TableHead className="text-right">Peso Bruto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transp.volumes.map((v, i) => (
                  <TableRow key={i}>
                    <TableCell>{v.qVol}</TableCell>
                    <TableCell>{v.especie || '-'}</TableCell>
                    <TableCell>{v.marca || '-'}</TableCell>
                    <TableCell>{v.nVol || '-'}</TableCell>
                    <TableCell className="text-right font-mono">{v.pesoL.toLocaleString('pt-BR', { minimumFractionDigits: 3 })} kg</TableCell>
                    <TableCell className="text-right font-mono">{v.pesoB.toLocaleString('pt-BR', { minimumFractionDigits: 3 })} kg</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Section>
      )}
    </div>
  );
}

// ====================================================
// Tab: Pagamento
// ====================================================
function TabPagamento({ xmlData }: { xmlData: XMLFullData | null }) {
  const pagamentos = xmlData?.pagamentos || [];

  if (pagamentos.length === 0) {
    return <EmptyTab message="Dados de pagamento não disponíveis no XML." />;
  }

  return (
    <div className="space-y-4">
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Código</TableHead>
              <TableHead>Forma de Pagamento</TableHead>
              <TableHead className="text-right">Valor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagamentos.map((p, i) => (
              <TableRow key={i}>
                <TableCell className="font-mono">{p.tPag}</TableCell>
                <TableCell>{p.descricao}</TableCell>
                <TableCell className="text-right font-mono font-medium">{formatCurrency(p.vPag)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex justify-end">
        <div className="bg-muted/50 rounded-lg px-4 py-2">
          <span className="text-sm text-muted-foreground mr-3">Total:</span>
          <span className="font-mono font-bold">{formatCurrency(pagamentos.reduce((s, p) => s + p.vPag, 0))}</span>
        </div>
      </div>
    </div>
  );
}

// ====================================================
// Tab: Duplicatas
// ====================================================
function TabDuplicatas({ xmlData }: { xmlData: XMLFullData | null }) {
  const cobr = xmlData?.cobranca;

  if (!cobr || (cobr.duplicatas.length === 0 && !cobr.fatura)) {
    return <EmptyTab message="Dados de cobrança/duplicatas não disponíveis no XML." />;
  }

  return (
    <div className="space-y-6">
      {cobr.fatura && (
        <Section title="Fatura">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Field label="Número" value={cobr.fatura.nFat} />
            <Field label="Valor Original" value={formatCurrency(cobr.fatura.vOrig)} />
            <Field label="Desconto" value={formatCurrency(cobr.fatura.vDesc)} />
            <Field label="Valor Líquido" value={formatCurrency(cobr.fatura.vLiq)} bold />
          </div>
        </Section>
      )}

      {cobr.duplicatas.length > 0 && (
        <Section title="Duplicatas">
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Número</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cobr.duplicatas.map((d, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono">{d.nDup}</TableCell>
                    <TableCell>{formatDate(d.dVenc)}</TableCell>
                    <TableCell className="text-right font-mono font-medium">{formatCurrency(d.vDup)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex justify-end mt-2">
            <div className="bg-muted/50 rounded-lg px-4 py-2">
              <span className="text-sm text-muted-foreground mr-3">Total Duplicatas:</span>
              <span className="font-mono font-bold">{formatCurrency(cobr.duplicatas.reduce((s, d) => s + d.vDup, 0))}</span>
            </div>
          </div>
        </Section>
      )}
    </div>
  );
}

// ====================================================
// Tab: XML Bruto
// ====================================================
function TabXMLBruto({ xmlRaw }: { xmlRaw: string | null }) {
  if (!xmlRaw) {
    return <EmptyTab message="XML original não disponível." />;
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(xmlRaw);
  };

  const handleDownload = () => {
    const blob = new Blob([xmlRaw], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'nfe.xml';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={handleCopy}>
          Copiar XML
        </Button>
        <Button variant="outline" size="sm" onClick={handleDownload}>
          <FileDown className="h-4 w-4 mr-2" />
          Download XML
        </Button>
      </div>
      <pre className="bg-muted/50 border rounded-lg p-4 text-xs font-mono overflow-x-auto max-h-[500px] overflow-y-auto whitespace-pre-wrap break-all">
        {xmlRaw}
      </pre>
    </div>
  );
}

// ====================================================
// Shared components
// ====================================================
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, value, bold, className }: { label: string; value: string; bold?: boolean; className?: string }) {
  return (
    <div className={className}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-sm ${bold ? 'font-bold text-primary' : ''}`}>{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}

function EmptyTab({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-16">
      <p className="text-muted-foreground">{message}</p>
    </div>
  );
}
