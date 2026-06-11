import React, { useState, useEffect, useRef } from 'react';
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
import { cn } from '@/lib/utils';
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
    im?: string; cnae?: string; crt?: string;
    endereco?: { logradouro: string; nro: string; complemento?: string; bairro: string; cidade: string; uf: string; cep: string; telefone?: string };
  } | null;
  destinatario: {
    cnpj: string; cpf: string; razaoSocial: string; ie: string; email?: string;
    endereco?: { logradouro: string; nro: string; complemento?: string; bairro: string; cidade: string; uf: string; cep: string; telefone?: string };
  } | null;
  ide: {
    naturezaOperacao: string; tipoOperacao: string; finalidade: string;
    ambiente: string; protocolo: string; dhRecebimento: string;
    cUF: string; cNF: string; indPag: string; tpEmis: string;
    dhSaiEnt: string; verProc: string;
    idDest: string; indPres: string;
  };
  protSefaz: {
    nProt: string; cStat: string; xMotivo: string; dhRecbto: string;
    verAplic: string; ambiente: string;
  } | null;
  respTec: {
    cnpj: string; xContato: string; email: string; fone: string;
  } | null;
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
    rastros: Array<{ nLot: string; qLot: number; dFab: string; dVal: string }>;
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
    const idDestMap: Record<string, string> = { '1': 'Operação interna', '2': 'Operação interestadual', '3': 'Operação com exterior' };
    const indPresMap: Record<string, string> = { '0': 'Não se aplica', '1': 'Presencial', '2': 'Internet', '3': 'Teleatendimento', '4': 'NFC-e entrega domicílio', '5': 'Presencial fora do estabelecimento', '9': 'Operação não presencial, outros' };
    const ideData = {
      naturezaOperacao: gt(ide, 'natOp'),
      tipoOperacao: gt(ide, 'tpNF') === '0' ? 'Entrada' : 'Saída',
      finalidade: { '1': 'NF-e normal', '2': 'Complementar', '3': 'Ajuste', '4': 'Devolução' }[gt(ide, 'finNFe')] || gt(ide, 'finNFe'),
      ambiente: gt(ide, 'tpAmb') === '1' ? 'Produção' : 'Homologação',
      protocolo: '',
      dhRecebimento: '',
      cUF: gt(ide, 'cUF'),
      cNF: gt(ide, 'cNF'),
      indPag: gt(ide, 'indPag'),
      tpEmis: gt(ide, 'tpEmis'),
      dhSaiEnt: gt(ide, 'dhSaiEnt'),
      verProc: '',
      idDest: idDestMap[gt(ide, 'idDest')] || gt(ide, 'idDest'),
      indPres: indPresMap[gt(ide, 'indPres')] || gt(ide, 'indPres'),
    };

    // protNFe
    const protNFe = doc.getElementsByTagName('protNFe')[0];
    const infProt = protNFe?.getElementsByTagName('infProt')[0];
    let protSefaz: XMLFullData['protSefaz'] = null;
    if (infProt) {
      ideData.protocolo = gt(infProt, 'nProt');
      ideData.dhRecebimento = gt(infProt, 'dhRecbto');
      protSefaz = {
        nProt: gt(infProt, 'nProt'),
        cStat: gt(infProt, 'cStat'),
        xMotivo: gt(infProt, 'xMotivo'),
        dhRecbto: gt(infProt, 'dhRecbto'),
        verAplic: gt(infProt, 'verAplic'),
        ambiente: gt(infProt, 'tpAmb') === '1' ? 'Produção' : gt(infProt, 'tpAmb') === '2' ? 'Homologação' : ideData.ambiente,
      };
    }
    const infNFe = doc.getElementsByTagName('infNFe')[0];
    ideData.verProc = gt(doc.getElementsByTagName('verProc')[0]?.parentElement || infNFe, 'verProc');

    // emit
    const emit = doc.getElementsByTagName('emit')[0];
    const enderEmit = emit?.getElementsByTagName('enderEmit')[0];
    const emitente = emit ? {
      cnpj: gt(emit, 'CNPJ'), razaoSocial: gt(emit, 'xNome'), nomeFantasia: gt(emit, 'xFant'), ie: gt(emit, 'IE'),
      im: gt(emit, 'IM'), cnae: gt(emit, 'CNAE'), crt: gt(emit, 'CRT'),
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
      email: gt(dest, 'email'),
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

      // Rastros (rastreabilidade de lotes)
      const rastroNodes = Array.from(prod?.getElementsByTagName('rastro') || []);
      const rastros = rastroNodes.map(r => ({
        nLot: gt(r, 'nLot'),
        qLot: gf(r, 'qLot'),
        dFab: gt(r, 'dFab'),
        dVal: gt(r, 'dVal'),
      }));

      return {
        nItem: parseInt(det.getAttribute('nItem') || '0'),
        cProd: gt(prod, 'cProd'), xProd: gt(prod, 'xProd'), ncm: gt(prod, 'NCM'),
        cfop: gt(prod, 'CFOP'), uCom: gt(prod, 'uCom'), qCom: gf(prod, 'qCom'),
        vUnCom: gf(prod, 'vUnCom'), vProd: gf(prod, 'vProd'), ean: gt(prod, 'cEAN'),
        cest: gt(prod, 'CEST'), infAdProd: gt(det, 'infAdProd'),
        rastros,
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

    // infRespTec
    const infRespTec = doc.getElementsByTagName('infRespTec')[0];
    const respTec: XMLFullData['respTec'] = infRespTec ? {
      cnpj: gt(infRespTec, 'CNPJ'),
      xContato: gt(infRespTec, 'xContato'),
      email: gt(infRespTec, 'email'),
      fone: gt(infRespTec, 'fone'),
    } : null;

    return { emitente, destinatario, ide: ideData, protSefaz, respTec, totais, transporte, cobranca, pagamentos, itensDetalhados, infCpl, infAdFisco };
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
    const emit = xmlData?.emitente;
    const dest = xmlData?.destinatario;
    const totais = xmlData?.totais;
    const transp = xmlData?.transporte;
    const cobr = xmlData?.cobranca;
    const pagamentos = xmlData?.pagamentos || [];
    const produtos = xmlData?.itensDetalhados || [];
    const ide = xmlData?.ide;
    const enderEmit = emit?.endereco;
    const enderDest = dest?.endereco;
    const tpNF = ide?.tipoOperacao === 'Entrada' ? '0' : '1';

    const fmtCNPJ = (c: string) => { const d = c.replace(/\D/g, ''); return d.length === 14 ? `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}` : c; };
    const fmtCEP = (c: string) => { const d = c.replace(/\D/g, ''); return d.length === 8 ? `${d.slice(0,5)}-${d.slice(5)}` : c; };
    const fmtFone = (f: string) => { const d = f.replace(/\D/g, ''); if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`; if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`; return f; };
    const fmtCurr = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const fmtDate = (d: string) => { if (!d) return '—'; try { const dt = new Date(d); return dt.toLocaleDateString('pt-BR'); } catch { return d; } };
    const fmtChave = (ch: string) => ch ? ch.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim() : '—';

    const prodRows = (produtos.length > 0 ? produtos : itens.map((i, idx) => ({
      nItem: idx + 1, cProd: i.codigo_fornecedor || '', xProd: i.descricao || '',
      ncm: i.ncm || '', cfop: i.cfop || '', uCom: i.ucom || '',
      qCom: i.qcom || 0, vUnCom: i.vuncom || 0, vProd: i.vprod || 0,
      icms: { orig: '', cst: '', vBC: 0, pICMS: 0, vICMS: 0 },
      ipi: { cst: '', vBC: 0, pIPI: 0, vIPI: 0 },
      infAdProd: '', rastros: [] as Array<{ nLot: string; qLot: number; dFab: string; dVal: string }>,
    }))).map((p: any) => {
      let rastroHtml = '';
      if (p.rastros?.length > 0) {
        rastroHtml = p.rastros.map((r: any) =>
          `<span style="color:#b45309;font-weight:600">Rastreabilidade:</span> <span>Lote: ${r.nLot} | Qtd: ${r.qLot}${r.dFab ? ` | Fab: ${fmtDate(r.dFab)}` : ''}${r.dVal ? ` | Val: ${fmtDate(r.dVal)}` : ''}</span>`
        ).join('<br/>');
      }
      let infHtml = '';
      if (p.infAdProd) {
        infHtml = `<div style="font-size:8px;color:#555;margin-top:2px">Informações Adicionais do Produto:<br/>${p.infAdProd}</div>`;
      }
      const extraRow = (rastroHtml || infHtml) ? `<tr><td colspan="14" style="border:1px solid #000;padding:2px 6px;background:#fffbeb;font-size:8px">${rastroHtml}${infHtml}</td></tr>` : '';

      return `<tr>
        <td class="c">${p.nItem}</td>
        <td class="c mono">${p.cProd}</td>
        <td class="c">${p.xProd}</td>
        <td class="c mono">${p.ncm}</td>
        <td class="c mono">${p.icms?.orig || ''}${p.icms?.cst || ''}</td>
        <td class="c mono">${p.cfop}</td>
        <td class="c">${p.uCom}</td>
        <td class="c r mono">${p.qCom?.toLocaleString('pt-BR', { minimumFractionDigits: 4 })}</td>
        <td class="c r mono">${fmtCurr(p.vUnCom)}</td>
        <td class="c r mono">${fmtCurr(0)}</td>
        <td class="c r mono">${fmtCurr(p.vProd)}</td>
        <td class="c r mono">${fmtCurr(p.icms?.vICMS || 0)}</td>
        <td class="c r mono">${p.icms?.pICMS ? p.icms.pICMS.toFixed(2) + '%' : ''}</td>
        <td class="c r mono">${fmtCurr(p.ipi?.vIPI || 0)}</td>
      </tr>${extraRow}`;
    }).join('');

    const dupHtml = cobr?.duplicatas?.length ? cobr.duplicatas.map(d => `${d.nDup} - ${fmtDate(d.dVenc)} - ${fmtCurr(d.vDup)}`).join(' | ') : '—';

    const pagHtml = pagamentos.length > 0 ? pagamentos.map(p => `<tr><td class="c">${p.descricao} (cód. ${p.tPag})</td><td class="c r mono" style="font-weight:700">${fmtCurr(p.vPag)}</td></tr>`).join('') : '<tr><td class="c" colspan="2" style="color:#999">Sem dados de pagamento</td></tr>';

    const fullHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>DANFE - NF-e ${nota.numero || ''}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Courier New', Courier, monospace; font-size: 10px; color: #000; background: #e8e8e8; padding: 20px 0; }
  .danfe-page { max-width: 210mm; margin: 0 auto; background: #fff; padding: 8mm; box-shadow: 0 2px 20px rgba(0,0,0,0.15); }
  @media print { body { background: #fff; padding: 0; } .danfe-page { box-shadow: none; padding: 5mm; max-width: none; } @page { margin: 6mm; size: A4 portrait; } }
  .mono { font-family: 'Courier New', Courier, monospace; }
  .c { border: 1px solid #000; padding: 2px 4px; vertical-align: top; }
  .r { text-align: right; }
  .lbl { font-size: 7px; text-transform: uppercase; color: #666; line-height: 1; margin-bottom: 1px; }
  .val { font-size: 10px; line-height: 1.3; font-weight: 500; }
  .section { background: #ddd; border: 1px solid #000; padding: 2px 6px; font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #333; }
  .section-blue { background: #1a3a6e; color: #fff; border: 1px solid #000; padding: 2px 6px; font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
  table { width: 100%; border-collapse: collapse; }
  .grid { display: grid; }
  .total-box { background: #1a3a6e; color: #fff; padding: 6px 12px; font-size: 13px; font-weight: 700; text-align: right; }
</style>
</head>
<body>
<div class="danfe-page">

<!-- RECEBEMOS STRIP -->
<table style="border:2px solid #000;margin-bottom:0">
<tr>
  <td class="c" style="padding:6px;width:75%">
    <div style="font-size:8px">RECEBEMOS DE <strong>${emit?.razaoSocial || nota.fornecedor?.razao_social || '—'}</strong> OS PRODUTOS CONSTANTES DA NOTA FISCAL INDICADA AO LADO</div>
    <table style="margin-top:8px"><tr>
      <td style="width:40%"><div class="lbl">DATA DE RECEBIMENTO</div><div style="border-top:1px solid #999;margin-top:12px"></div></td>
      <td><div class="lbl">IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR</div><div style="border-top:1px solid #999;margin-top:12px"></div></td>
    </tr></table>
  </td>
  <td class="c" style="text-align:center;vertical-align:middle;padding:6px">
    <div style="font-size:9px;font-weight:700">NF-e</div>
    <div style="font-size:14px;font-weight:800">Nº ${nota.numero ? nota.numero.padStart(9, '0') : '—'}</div>
    <div style="font-size:9px">Série ${nota.serie || '1'}</div>
  </td>
</tr>
</table>

<!-- HEADER: EMITENTE | DANFE | PROTOCOLO -->
<table style="border:2px solid #000;border-top:none">
<tr>
  <td class="c" style="width:38%;padding:6px;vertical-align:top">
    <div style="font-size:13px;font-weight:700;line-height:1.2">${emit?.razaoSocial || nota.fornecedor?.razao_social || '—'}</div>
    ${emit?.nomeFantasia ? `<div style="font-size:10px;margin-top:2px">${emit.nomeFantasia}</div>` : ''}
    <div style="font-size:9px;margin-top:2px;color:#444">
      CNPJ: ${emit?.cnpj ? fmtCNPJ(emit.cnpj) : '—'}<br/>
      IE: ${emit?.ie || '—'}<br/>
      ${enderEmit ? `${enderEmit.logradouro}, ${enderEmit.nro}${enderEmit.complemento ? ` ${enderEmit.complemento}` : ''}<br/>${enderEmit.bairro} — ${enderEmit.cidade}/${enderEmit.uf}<br/>CEP: ${fmtCEP(enderEmit.cep || '')}` : ''}
    </div>
  </td>
  <td class="c" style="width:15%;text-align:center;vertical-align:middle;padding:8px">
    <div style="font-size:20px;font-weight:800;letter-spacing:4px">DANFE</div>
    <div style="font-size:7px;color:#666;margin-top:2px">Documento Auxiliar da<br/>Nota Fiscal Eletrônica</div>
    <div style="margin-top:6px;font-size:8px">${tpNF === '0' ? '☒' : '☐'} ENTRADA &nbsp; ${tpNF === '1' ? '☒' : '☐'} SAÍDA</div>
    <div style="border-top:1px solid #ccc;margin-top:4px;padding-top:3px">
      <div style="font-size:12px;font-weight:700">Nº ${nota.numero ? nota.numero.padStart(9, '0') : '—'}</div>
      <div style="font-size:10px">Série ${nota.serie || '1'}</div>
      <div style="font-size:8px;margin-top:2px">Emissão: ${fmtDate(nota.dh_emissao || '')}</div>
    </div>
  </td>
  <td class="c" style="width:47%;vertical-align:top;padding:0">
    <div style="border-bottom:1px solid #000;padding:4px;text-align:center;background:#f8f8f8;font-weight:700;color:#0a6e00;font-size:10px">AUTORIZADO O USO DA NF-e</div>
    <div style="border-bottom:1px solid #000;padding:4px">
      <div class="lbl">PROTOCOLO DE AUTORIZAÇÃO</div>
      <div class="val mono" style="font-size:9px">${ide?.protocolo || '—'}</div>
      <div style="font-size:8px;color:#666">Recebimento: ${ide?.dhRecebimento ? fmtDate(ide.dhRecebimento) : '—'}</div>
    </div>
    <div style="border-bottom:1px solid #000;padding:4px">
      <div style="font-size:8px;color:#666">Nat. Op.: ${ide?.naturezaOperacao || '—'}</div>
      <div style="font-size:8px;color:#666">CFOP: ${produtos[0]?.cfop || '—'}</div>
    </div>
    <div style="padding:4px">
      <div class="lbl">CHAVE DE ACESSO</div>
      <div class="val mono" style="font-size:9px;letter-spacing:1px;font-weight:700">${fmtChave(nota.chave_nfe)}</div>
    </div>
  </td>
</tr>
</table>

<!-- EMITENTE SECTION -->
<div class="section-blue">EMITENTE</div>
<table>
<tr>
  <td class="c" colspan="2"><div class="lbl">RAZÃO SOCIAL</div><div class="val">${emit?.razaoSocial || nota.fornecedor?.razao_social || '—'}</div></td>
</tr>
<tr>
  <td class="c" style="width:60%"><div class="lbl">CNPJ/CPF</div><div class="val mono">${emit?.cnpj ? fmtCNPJ(emit.cnpj) : '—'}</div></td>
  <td class="c"><div class="lbl">INSCRIÇÃO ESTADUAL</div><div class="val">${emit?.ie || '—'}</div></td>
</tr>
<tr><td class="c" colspan="2"><div class="lbl">INSCRIÇÃO MUNICIPAL</div><div class="val">${emit?.im || '—'}</div></td></tr>
<tr><td class="c" colspan="2"><div class="lbl">ENDEREÇO</div><div class="val">${enderEmit ? `${enderEmit.logradouro}, ${enderEmit.nro}${enderEmit.complemento ? ` ${enderEmit.complemento}` : ''}` : '—'}</div></td></tr>
<tr>
  <td class="c"><div class="lbl">BAIRRO</div><div class="val">${enderEmit?.bairro || '—'}</div></td>
  <td class="c"><div class="lbl">MUNICÍPIO/UF</div><div class="val">${enderEmit ? `${enderEmit.cidade}/${enderEmit.uf}` : '—'}</div></td>
</tr>
<tr>
  <td class="c"><div class="lbl">CEP</div><div class="val mono">${enderEmit?.cep ? fmtCEP(enderEmit.cep) : '—'}</div></td>
  <td class="c"><div class="lbl">TELEFONE</div><div class="val">${enderEmit?.telefone ? fmtFone(enderEmit.telefone) : '—'}</div></td>
</tr>
</table>

<!-- DESTINATÁRIO -->
<div class="section-blue">DESTINATÁRIO / REMETENTE</div>
<table>
<tr>
  <td class="c" style="width:60%"><div class="lbl">RAZÃO SOCIAL / NOME</div><div class="val">${dest?.razaoSocial || '—'}</div></td>
  <td class="c"><div class="lbl">INSCRIÇÃO ESTADUAL</div><div class="val">${dest?.ie || '—'}</div></td>
</tr>
<tr>
  <td class="c"><div class="lbl">CNPJ/CPF</div><div class="val mono">${dest?.cnpj ? fmtCNPJ(dest.cnpj) : dest?.cpf || '—'}</div></td>
  <td class="c"><div class="lbl">INSCRIÇÃO ESTADUAL</div><div class="val">${dest?.ie || '—'}</div></td>
</tr>
<tr><td class="c" colspan="2"><div class="lbl">E-MAIL</div><div class="val">${dest?.email || '—'}</div></td></tr>
<tr><td class="c" colspan="2"><div class="lbl">ENDEREÇO</div><div class="val">${enderDest ? `${enderDest.logradouro}, ${enderDest.nro}${enderDest.complemento ? ` ${enderDest.complemento}` : ''}` : '—'}</div></td></tr>
<tr>
  <td class="c"><div class="lbl">BAIRRO</div><div class="val">${enderDest?.bairro || '—'}</div></td>
  <td class="c"><div class="lbl">MUNICÍPIO/UF</div><div class="val">${enderDest ? `${enderDest.cidade}/${enderDest.uf}` : '—'}</div></td>
</tr>
<tr><td class="c" colspan="2"><div class="lbl">CEP</div><div class="val mono">${enderDest?.cep ? fmtCEP(enderDest.cep) : '—'}</div></td></tr>
</table>

<!-- PRODUTOS -->
<div class="section-blue">PRODUTOS / SERVIÇOS</div>
<table style="font-size:8px">
<thead>
<tr style="background:#f0f0f0;font-weight:700;font-size:7px">
  <td class="c" style="text-align:center">#</td>
  <td class="c">Cód.</td>
  <td class="c">Descrição</td>
  <td class="c">NCM</td>
  <td class="c">CST</td>
  <td class="c">CFOP</td>
  <td class="c">Un</td>
  <td class="c r">Qtd</td>
  <td class="c r">V.Unit.</td>
  <td class="c r">Desc.</td>
  <td class="c r">V.Total</td>
  <td class="c r">ICMS</td>
  <td class="c r">%ICMS</td>
  <td class="c r">IPI</td>
</tr>
</thead>
<tbody>${prodRows}</tbody>
</table>

<!-- TOTAIS -->
<div class="section-blue">TOTAIS DA NF-E</div>
<table>
<tr>
  <td class="c"><div class="lbl">Valor dos Produtos</div><div class="val mono">${fmtCurr(totais?.vProd || nota.total_produtos || 0)}</div></td>
  <td class="c"><div class="lbl">Base de Cálculo ICMS</div><div class="val mono">${fmtCurr(totais?.vBC || 0)}</div></td>
  <td class="c"><div class="lbl">Valor do ICMS</div><div class="val mono">${fmtCurr(totais?.vICMS || 0)}</div></td>
  <td class="c" rowspan="2" style="vertical-align:middle;text-align:right;background:#1a3a6e;color:#fff;font-size:13px;font-weight:700;min-width:180px">
    <div style="font-size:8px;font-weight:400;color:#ccc">VALOR TOTAL DA NF-e</div>
    ${fmtCurr(totais?.vNF || nota.total_nota || 0)}
  </td>
</tr>
<tr>
  <td class="c"><div class="lbl">Valor do Frete</div><div class="val mono">${fmtCurr(totais?.vFrete || 0)}</div></td>
  <td class="c"><div class="lbl">Valor do Seguro</div><div class="val mono">${fmtCurr(totais?.vSeg || 0)}</div></td>
  <td class="c"><div class="lbl">Valor do IPI</div><div class="val mono">${fmtCurr(totais?.vIPI || 0)}</div></td>
</tr>
<tr>
  <td class="c"><div class="lbl">Desconto</div><div class="val mono">${fmtCurr(totais?.vDesc || 0)}</div></td>
  <td class="c"><div class="lbl">Outras Despesas</div><div class="val mono">${fmtCurr(totais?.vOutro || 0)}</div></td>
  <td class="c"><div class="lbl">V. Aprox. Tributos</div><div class="val mono">${fmtCurr(totais?.vTotTrib || 0)}</div></td>
  <td class="c"><div class="lbl">FATURA</div><div class="val mono">${cobr?.fatura ? `${cobr.fatura.nFat} - ${fmtCurr(cobr.fatura.vLiq)}` : '—'}</div></td>
</tr>
</table>

<!-- TRANSPORTE -->
<div class="section">TRANSPORTADOR / VOLUMES TRANSPORTADOS</div>
<table>
<tr>
  <td class="c" style="width:40%"><div class="lbl">RAZÃO SOCIAL</div><div class="val">${transp?.transportadora?.razaoSocial || '—'}</div></td>
  <td class="c"><div class="lbl">FRETE</div><div class="val">${transp?.modFrete || '—'}</div></td>
  <td class="c"><div class="lbl">CNPJ/CPF</div><div class="val mono">${transp?.transportadora?.cnpj || '—'}</div></td>
</tr>
<tr>
  <td class="c"><div class="lbl">ENDEREÇO</div><div class="val">${transp?.transportadora?.endereco || '—'}</div></td>
  <td class="c"><div class="lbl">MUNICÍPIO</div><div class="val">${transp?.transportadora?.municipio || '—'}</div></td>
  <td class="c"><div class="lbl">UF</div><div class="val">${transp?.transportadora?.uf || '—'}</div></td>
</tr>
</table>

<!-- PAGAMENTO -->
<div class="section">FORMAS DE PAGAMENTO</div>
<table style="font-size:9px">
<thead><tr style="background:#f0f0f0"><td class="c" style="font-weight:700">FORMA DE PAGAMENTO</td><td class="c r" style="font-weight:700;width:140px">VALOR</td></tr></thead>
<tbody>${pagHtml}</tbody>
</table>

<!-- DADOS ADICIONAIS -->
<div class="section">DADOS ADICIONAIS</div>
<table>
<tr>
  <td class="c" style="width:50%;min-height:60px;vertical-align:top"><div class="lbl">INFORMAÇÕES COMPLEMENTARES</div><div style="font-size:8px;margin-top:2px;white-space:pre-wrap">${xmlData?.infCpl || '—'}</div></td>
  <td class="c" style="width:50%;min-height:60px;vertical-align:top"><div class="lbl">RESERVADO AO FISCO</div><div style="font-size:8px;margin-top:2px">${xmlData?.infAdFisco || '—'}</div></td>
</tr>
</table>

<div style="text-align:center;font-size:7px;color:#999;margin-top:4px;padding:4px">
  Documento auxiliar da nota fiscal eletrônica para consulta. Não tem valor fiscal. Consulte a NF-e em www.nfe.fazenda.gov.br
</div>

</div>
</body>
</html>`;

    const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DANFE_NF-e_${nota.numero || 'NF'}_${(emit?.razaoSocial || nota.fornecedor?.razao_social || 'nota').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30)}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[98vw] xl:max-w-[1400px] w-full max-h-[98vh] p-0 gap-0 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b shrink-0 bg-background">
          <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <button onClick={() => onOpenChange(false)} className="mt-1 text-muted-foreground hover:text-foreground shrink-0">
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <h2 className="text-lg sm:text-xl font-bold truncate">NF-e Nº {nota.numero || '-'}</h2>
                  <span className="text-sm sm:text-base text-muted-foreground shrink-0">Série {nota.serie || '1'}</span>
                  <Badge variant={statusInfo.variant} className={cn("shrink-0", statusInfo.variant === 'default' ? 'bg-green-600 hover:bg-green-700' : '')}>
                    {statusInfo.label}
                  </Badge>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1 truncate max-w-full" title={`${formatDate(nota.dh_emissao || '')} · ${emitenteNome}`}>
                  Emissão: {formatDate(nota.dh_emissao || '')} · {emitenteNome}
                </p>
              </div>
            </div>
            <div className="flex gap-2 w-full sm:w-auto shrink-0">
              <Button onClick={handleDownloadDANFE} variant="outline" size="sm" className="flex-1 sm:flex-none">
                <FileDown className="h-4 w-4 mr-2" />
                <span className="inline">DANFE</span>
              </Button>
            </div>
          </div>

          {/* Chave de acesso */}
          <div className="mt-4 bg-muted/50 border rounded-lg px-3 sm:px-4 py-2 sm:py-2.5 overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
              <span className="text-[10px] sm:text-sm text-muted-foreground uppercase sm:normal-case font-semibold sm:font-normal">Chave de Acesso:</span>
              <span className="text-[11px] sm:text-sm font-mono break-all sm:break-normal select-all">{formatChave(nota.chave_nfe)}</span>
            </div>
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
// Tab: DANFE (Official Brazilian layout replica)
// ====================================================
const B = 'border-[#000]';
const CELL = `border ${B} px-2 py-1`;
const LBL = 'text-[8px] uppercase text-gray-500 leading-none mb-0.5';
const VAL = 'text-[11px] leading-tight font-medium';
const VAL_MONO = 'text-[11px] leading-tight font-mono font-medium';
const SECTION_HEADER = `${B} bg-gray-200 border px-2 py-[3px] text-[9px] font-bold uppercase tracking-wider text-gray-800`;

function formatCNPJ(cnpj: string): string {
  const d = cnpj.replace(/\D/g, '');
  if (d.length !== 14) return cnpj;
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
}
function formatCEP(cep: string): string {
  const d = cep.replace(/\D/g, '');
  if (d.length !== 8) return cep;
  return `${d.slice(0,5)}-${d.slice(5)}`;
}
function formatFone(fone: string): string {
  const d = fone.replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return fone;
}

function DCell({ label, value, className = '', mono = false }: { label: string; value?: string | number | null; className?: string; mono?: boolean }) {
  return (
    <div className={`${CELL} ${className}`}>
      <p className={LBL}>{label}</p>
      <p className={mono ? VAL_MONO : VAL}>{value ?? '—'}</p>
    </div>
  );
}

function TabDANFE({ nota, xmlData, itens }: { nota: NotaEntradaDB; xmlData: XMLFullData | null; itens: NotaEntradaItemDB[] }) {
  const emit = xmlData?.emitente;
  const dest = xmlData?.destinatario;
  const totais = xmlData?.totais;
  const transp = xmlData?.transporte;
  const cobr = xmlData?.cobranca;
  const pagamentos = xmlData?.pagamentos || [];
  const produtos = xmlData?.itensDetalhados || [];
  const ide = xmlData?.ide;

  const enderEmit = emit?.endereco;
  const enderDest = dest?.endereco;

  const tpNF = ide?.tipoOperacao === 'Entrada' ? '0' : '1';

  return (
    <div className="mx-auto bg-white text-black print:shadow-none" style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: '11px' }}>

      {/* ============ RECEBEMOS STRIP ============ */}
      <div className={`border-2 ${B}`}>
        <div className="grid grid-cols-[1fr_150px] border-b border-black">
          <div className={`border-r ${B} px-3 py-2`}>
            <p className="text-[9px] leading-snug">
              RECEBEMOS DE <span className="font-bold">{emit?.razaoSocial || nota.fornecedor?.razao_social || '—'}</span> OS PRODUTOS CONSTANTES DA NOTA FISCAL INDICADA AO LADO
            </p>
            <div className="grid grid-cols-[1fr_220px] mt-2">
              <div>
                <p className={LBL}>DATA DE RECEBIMENTO</p>
                <div className="border-t border-gray-300 mt-3"></div>
              </div>
              <div>
                <p className={LBL}>IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR</p>
                <div className="border-t border-gray-300 mt-3"></div>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-center justify-center text-center p-2">
            <p className="text-[10px] font-bold">NF-e</p>
            <p className="text-[14px] font-extrabold leading-tight">Nº: {nota.numero ? nota.numero.padStart(9, '0') : '—'}</p>
            <p className="text-[10px]">Série: {nota.serie || '1'}</p>
          </div>
        </div>
      </div>

      {/* ============ MAIN BODY ============ */}
      <div className={`border-2 border-t-0 ${B}`}>

        {/* ROW 1: EMITENTE | DANFE | BARCODE/CHAVE */}
        <div className="grid grid-cols-[1fr_170px_1fr] border-b border-black">
          {/* Emitente */}
          <div className={`border-r ${B} p-3 flex flex-col justify-between min-h-[110px]`}>
            <div>
              <p className="text-[14px] font-bold leading-tight">{emit?.razaoSocial || nota.fornecedor?.razao_social || '—'}</p>
              {emit?.nomeFantasia && <p className="text-[11px] mt-0.5">{emit.nomeFantasia}</p>}
            </div>
            {enderEmit && (
              <div className="mt-2 text-[10px] leading-snug text-gray-700">
                <p>{enderEmit.logradouro}, {enderEmit.nro}{enderEmit.complemento ? `, ${enderEmit.complemento}` : ''}</p>
                <p>{enderEmit.bairro} - CEP: {formatCEP(enderEmit.cep)}</p>
                <p>{enderEmit.cidade} - {enderEmit.uf}</p>
                {enderEmit.telefone && <p>Fone: {formatFone(enderEmit.telefone)}</p>}
              </div>
            )}
          </div>

          {/* DANFE title */}
          <div className={`border-r ${B} text-center py-3 flex flex-col items-center justify-between`}>
            <div>
              <p className="text-[20px] font-extrabold tracking-[5px] leading-none">DANFE</p>
              <p className="text-[7px] leading-tight mt-1 text-gray-500 px-1">Documento Auxiliar da<br/>Nota Fiscal Eletrônica</p>
            </div>
            <div className="mt-2 flex gap-3 text-[9px]">
              <span>{tpNF === '0' ? '☒' : '☐'} ENTRADA</span>
              <span>{tpNF === '1' ? '☒' : '☐'} SAÍDA</span>
            </div>
            <div className="mt-2 border-t border-gray-300 pt-1 w-full px-2">
              <p className="text-[13px] font-bold">Nº: {nota.numero ? nota.numero.padStart(9, '0') : '—'}</p>
              <p className="text-[11px]">Série: {nota.serie || '1'}</p>
              <p className="text-[9px] mt-1">Folha 1/1</p>
            </div>
          </div>

          {/* Barcode + Chave + Protocolo */}
          <div className="flex flex-col">
            <div className={`border-b ${B} p-2 flex items-center justify-center min-h-[45px]`}>
              <div className="flex gap-[1px]">
                {Array.from({ length: 50 }).map((_, i) => (
                  <div key={i} className="bg-black" style={{ width: i % 3 === 0 ? '2px' : '1px', height: '32px' }} />
                ))}
              </div>
            </div>
            <div className={`border-b ${B} px-2 py-1.5`}>
              <p className={LBL}>CHAVE DE ACESSO</p>
              <p className="text-[9px] font-mono font-bold tracking-[1px] leading-tight mt-0.5">{formatChave(nota.chave_nfe)}</p>
            </div>
            <div className={`border-b ${B} px-2 py-1 text-center`}>
              <p className="text-[7px] text-gray-500">Consulta de autenticidade no portal nacional da NF-e</p>
              <p className="text-[8px] font-bold">www.nfe.fazenda.gov.br/portal ou no site da Sefaz Autorizadora</p>
            </div>
            <div className="px-2 py-1.5">
              <p className={LBL}>PROTOCOLO DE AUTORIZAÇÃO DE USO</p>
              <p className="text-[10px] font-mono font-bold mt-0.5">
                {ide?.protocolo || '—'} - {ide?.dhRecebimento ? formatDate(ide.dhRecebimento) : '—'}
              </p>
            </div>
          </div>
        </div>

        {/* NATUREZA + PROTOCOLO */}
        <div className="grid grid-cols-[1fr_auto] border-b border-black">
          <DCell label="NATUREZA DA OPERAÇÃO" value={ide?.naturezaOperacao || '—'} />
          <DCell label="PROTOCOLO DE AUTORIZAÇÃO" value={`${ide?.protocolo || '—'} - ${ide?.dhRecebimento ? formatDate(ide.dhRecebimento) : '—'}`} className="min-w-[280px]" mono />
        </div>

        {/* IE, IE ST, CNPJ */}
        <div className="grid grid-cols-3 border-b border-black">
          <DCell label="INSCRIÇÃO ESTADUAL" value={emit?.ie || '—'} />
          <DCell label="INSCRIÇÃO ESTADUAL DO SUBST. TRIBUTÁRIO" value="—" />
          <DCell label="CNPJ" value={emit?.cnpj ? formatCNPJ(emit.cnpj) : '—'} mono />
        </div>

        {/* DESTINATÁRIO */}
        <div className={SECTION_HEADER}>DESTINATÁRIO / REMETENTE</div>

        <div className="grid grid-cols-[1fr_220px_140px] border-b border-black">
          <DCell label="NOME / RAZÃO SOCIAL" value={dest?.razaoSocial || '—'} />
          <DCell label="CNPJ / CPF" value={dest?.cnpj ? formatCNPJ(dest.cnpj) : dest?.cpf || '—'} mono />
          <DCell label="DATA DA EMISSÃO" value={formatDate(nota.dh_emissao || '')} />
        </div>

        <div className="grid grid-cols-[1fr_180px_120px_140px] border-b border-black">
          <DCell label="ENDEREÇO" value={enderDest ? `${enderDest.logradouro}, ${enderDest.nro}${enderDest.complemento ? ` - ${enderDest.complemento}` : ''}` : '—'} />
          <DCell label="BAIRRO / DISTRITO" value={enderDest?.bairro || '—'} />
          <DCell label="CEP" value={enderDest?.cep ? formatCEP(enderDest.cep) : '—'} mono />
          <DCell label="DATA ENTRADA / SAÍDA" value={ide?.dhSaiEnt ? formatDate(ide.dhSaiEnt) : '—'} />
        </div>

        <div className="grid grid-cols-[1fr_100px_180px_180px_140px] border-b border-black">
          <DCell label="MUNICÍPIO" value={enderDest?.cidade || '—'} />
          <DCell label="UF" value={enderDest?.uf || '—'} />
          <DCell label="FONE / FAX" value={enderDest?.telefone ? formatFone(enderDest.telefone) : '—'} />
          <DCell label="INSCRIÇÃO ESTADUAL" value={dest?.ie || '—'} />
          <DCell label="HORA ENTRADA / SAÍDA" value={ide?.dhSaiEnt ? new Date(ide.dhSaiEnt).toLocaleTimeString('pt-BR') : '—'} />
        </div>

        {/* FATURA / DUPLICATAS */}
        <div className={SECTION_HEADER}>FATURA / DUPLICATA</div>
        {cobr?.fatura ? (
          <div className="border-b border-black">
            <div className="grid grid-cols-3">
              <DCell label="NÚMERO" value={cobr.fatura.nFat} />
              <DCell label="VALOR LÍQUIDO" value={formatCurrency(cobr.fatura.vLiq)} mono />
              <div className={`${CELL}`}>
                <p className={LBL}>DUPLICATAS</p>
                {cobr?.duplicatas && cobr.duplicatas.length > 0 ? (
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                    {cobr.duplicatas.map((d, i) => (
                      <span key={i} className="text-[9px] font-mono">
                        {d.nDup} {formatDate(d.dVenc)} {formatCurrency(d.vDup)}
                      </span>
                    ))}
                  </div>
                ) : <p className={VAL}>—</p>}
              </div>
            </div>
          </div>
        ) : (
          <div className={`${CELL} border-b border-black`}><p className={VAL}>Sem dados de fatura</p></div>
        )}

        {/* CÁLCULO DO IMPOSTO */}
        <div className={SECTION_HEADER}>CÁLCULO DO IMPOSTO</div>

        <div className="grid grid-cols-5 border-b border-black">
          <DCell label="BASE DE CÁLC. DO ICMS" value={formatCurrency(totais?.vBC || 0)} mono />
          <DCell label="VALOR DO ICMS" value={formatCurrency(totais?.vICMS || 0)} mono />
          <DCell label="BASE DE CÁLC. ICMS S.T." value={formatCurrency(totais?.vBCST || 0)} mono />
          <DCell label="VALOR DO ICMS SUBST." value={formatCurrency(totais?.vST || 0)} mono />
          <DCell label="V. TOTAL PRODUTOS" value={formatCurrency(totais?.vProd || nota.total_produtos || 0)} mono />
        </div>

        <div className="grid grid-cols-7 border-b border-black">
          <DCell label="VALOR DO FRETE" value={formatCurrency(totais?.vFrete || 0)} mono />
          <DCell label="VALOR DO SEGURO" value={formatCurrency(totais?.vSeg || 0)} mono />
          <DCell label="DESCONTO" value={formatCurrency(totais?.vDesc || 0)} mono />
          <DCell label="OUTRAS DESPESAS" value={formatCurrency(totais?.vOutro || 0)} mono />
          <DCell label="VALOR DO IPI" value={formatCurrency(totais?.vIPI || 0)} mono />
          <DCell label="V. APROX. TRIBUTOS" value={formatCurrency(totais?.vTotTrib || 0)} mono />
          <DCell label="VALOR TOTAL DA NOTA" value={formatCurrency(totais?.vNF || nota.total_nota || 0)} mono className="bg-gray-100 font-bold" />
        </div>

        {/* TRANSPORTADOR / VOLUMES */}
        <div className={SECTION_HEADER}>TRANSPORTADOR / VOLUMES TRANSPORTADOS</div>

        <div className="grid grid-cols-[1fr_140px_100px_140px_50px_120px] border-b border-black">
          <DCell label="RAZÃO SOCIAL" value={transp?.transportadora?.razaoSocial || '—'} />
          <DCell label="FRETE POR CONTA" value={transp?.modFrete || '—'} />
          <DCell label="CÓDIGO ANTT" value={transp?.veiculo?.rntc || '—'} />
          <DCell label="PLACA DO VEÍCULO" value={transp?.veiculo?.placa || '—'} />
          <DCell label="UF" value={transp?.veiculo?.uf || '—'} />
          <DCell label="CNPJ / CPF" value={transp?.transportadora?.cnpj || '—'} mono />
        </div>

        <div className="grid grid-cols-[1fr_180px_50px_180px] border-b border-black">
          <DCell label="ENDEREÇO" value={transp?.transportadora?.endereco || '—'} />
          <DCell label="MUNICÍPIO" value={transp?.transportadora?.municipio || '—'} />
          <DCell label="UF" value={transp?.transportadora?.uf || '—'} />
          <DCell label="INSCRIÇÃO ESTADUAL" value={transp?.transportadora?.ie || '—'} />
        </div>

        <div className="grid grid-cols-6 border-b border-black">
          <DCell label="QUANTIDADE" value={transp?.volumes?.[0]?.qVol ? transp.volumes[0].qVol.toLocaleString('pt-BR', { minimumFractionDigits: 3 }) : '—'} mono />
          <DCell label="ESPÉCIE" value={transp?.volumes?.[0]?.especie || '—'} />
          <DCell label="MARCA" value={transp?.volumes?.[0]?.marca || '—'} />
          <DCell label="NUMERAÇÃO" value={transp?.volumes?.[0]?.nVol || '—'} />
          <DCell label="PESO BRUTO" value={transp?.volumes?.[0]?.pesoB ? transp.volumes[0].pesoB.toLocaleString('pt-BR', { minimumFractionDigits: 3 }) : '—'} mono />
          <DCell label="PESO LÍQUIDO" value={transp?.volumes?.[0]?.pesoL ? transp.volumes[0].pesoL.toLocaleString('pt-BR', { minimumFractionDigits: 3 }) : '—'} mono />
        </div>

        {/* DADOS DOS PRODUTOS */}
        <div className={SECTION_HEADER}>DADOS DOS PRODUTOS / SERVIÇOS</div>

        <div className="border-b border-black overflow-x-auto">
          <table className="w-full border-collapse" style={{ fontSize: '9px' }}>
            <thead>
              <tr className="bg-gray-100">
                <th className={`${CELL} text-left w-14`}>CÓDIGO<br/>PRODUTO</th>
                <th className={`${CELL} text-left`}>DESCRIÇÃO DO PRODUTO / SERVIÇO</th>
                <th className={`${CELL} text-center w-16`}>NCM/SH</th>
                <th className={`${CELL} text-center w-10`}>O/CST</th>
                <th className={`${CELL} text-center w-12`}>CFOP</th>
                <th className={`${CELL} text-center w-8`}>UN</th>
                <th className={`${CELL} text-right w-14`}>QUANT.</th>
                <th className={`${CELL} text-right w-16`}>VALOR<br/>UNIT.</th>
                <th className={`${CELL} text-right w-16`}>VALOR<br/>TOTAL</th>
                <th className={`${CELL} text-right w-14`}>B.CÁLC.<br/>ICMS</th>
                <th className={`${CELL} text-right w-14`}>VALOR<br/>ICMS</th>
                <th className={`${CELL} text-right w-14`}>VALOR<br/>IPI</th>
                <th className={`${CELL} text-right w-10`}>ALÍQ.<br/>ICMS</th>
                <th className={`${CELL} text-right w-10`}>ALÍQ.<br/>IPI</th>
              </tr>
            </thead>
            <tbody>
              {(produtos.length > 0 ? produtos : itens.map((i, idx) => ({
                nItem: idx + 1, cProd: i.codigo_fornecedor || '', xProd: i.descricao || '',
                ncm: i.ncm || '', cfop: i.cfop || '', uCom: i.ucom || '',
                qCom: i.qcom || 0, vUnCom: i.vuncom || 0, vProd: i.vprod || 0,
                icms: { orig: '', cst: '', vBC: 0, pICMS: 0, vICMS: 0 },
                ipi: { cst: '', vBC: 0, pIPI: 0, vIPI: 0 },
                infAdProd: '', rastros: [] as Array<{ nLot: string; qLot: number; dFab: string; dVal: string }>,
              }))).map((p: any) => (
                <React.Fragment key={p.nItem}>
                  <tr>
                    <td className={`${CELL} font-mono`}>{p.cProd}</td>
                    <td className={CELL}>
                      {p.xProd}
                    </td>
                    <td className={`${CELL} text-center font-mono`}>{p.ncm}</td>
                    <td className={`${CELL} text-center font-mono`}>{p.icms?.orig}{p.icms?.cst}</td>
                    <td className={`${CELL} text-center font-mono`}>{p.cfop}</td>
                    <td className={`${CELL} text-center`}>{p.uCom}</td>
                    <td className={`${CELL} text-right font-mono`}>{p.qCom?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td className={`${CELL} text-right font-mono`}>{p.vUnCom?.toLocaleString('pt-BR', { minimumFractionDigits: 4 })}</td>
                    <td className={`${CELL} text-right font-mono font-bold`}>{formatCurrency(p.vProd)}</td>
                    <td className={`${CELL} text-right font-mono`}>{formatCurrency(p.icms?.vBC || 0)}</td>
                    <td className={`${CELL} text-right font-mono`}>{formatCurrency(p.icms?.vICMS || 0)}</td>
                    <td className={`${CELL} text-right font-mono`}>{formatCurrency(p.ipi?.vIPI || 0)}</td>
                    <td className={`${CELL} text-right font-mono`}>{p.icms?.pICMS ? p.icms.pICMS.toFixed(2) : ''}</td>
                    <td className={`${CELL} text-right font-mono`}>{p.ipi?.pIPI ? p.ipi.pIPI.toFixed(2) : ''}</td>
                  </tr>
                  {/* Rastreabilidade + Info Adicional */}
                  {(p.rastros?.length > 0 || p.infAdProd) && (
                    <tr>
                      <td colSpan={14} className="border-l border-r border-b border-black px-3 py-1.5 bg-amber-50/60">
                        {p.rastros?.length > 0 && (
                          <div className="mb-1">
                            <span className="text-[8px] font-bold text-amber-700 uppercase">⟐ Rastreabilidade</span>
                            {p.rastros.map((r: any, ri: number) => (
                              <div key={ri} className="ml-2 mt-0.5 border border-amber-200 bg-amber-50 rounded px-2 py-1 inline-block mr-2">
                                <span className="text-[9px]">
                                  <span className="text-amber-700 font-semibold">Lote:</span> <span className="font-mono font-bold">{r.nLot}</span>
                                  <span className="ml-3 text-amber-700 font-semibold">Qtd:</span> <span className="font-mono">{r.qLot}</span>
                                  {r.dFab && <><span className="ml-3 text-amber-700 font-semibold">Fabricação:</span> <span className="font-mono">{formatDate(r.dFab)}</span></>}
                                  {r.dVal && <><span className="ml-3 text-amber-700 font-semibold">Validade:</span> <span className="font-mono">{formatDate(r.dVal)}</span></>}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                        {p.infAdProd && (
                          <div>
                            <span className="text-[8px] text-gray-500">Informações Adicionais do Produto:</span>
                            <p className="text-[9px] text-gray-700 mt-0.5">{p.infAdProd}</p>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* CÁLCULO DO ISSQN */}
        <div className={SECTION_HEADER}>CÁLCULO DO ISSQN</div>
        <div className="grid grid-cols-4 border-b border-black">
          <DCell label="INSCRIÇÃO MUNICIPAL" value={emit?.im || '—'} />
          <DCell label="VALOR TOTAL DOS SERVIÇOS" value="—" mono />
          <DCell label="BASE DE CÁLCULO DO ISSQN" value="—" mono />
          <DCell label="VALOR TOTAL DO ISSQN" value="—" mono />
        </div>

        {/* DADOS ADICIONAIS */}
        <div className={SECTION_HEADER}>DADOS ADICIONAIS</div>
        <div className="grid grid-cols-2 border-b border-black">
          <div className={`${CELL} min-h-[80px]`}>
            <p className={LBL}>INFORMAÇÕES COMPLEMENTARES</p>
            <p className="text-[9px] mt-1 whitespace-pre-wrap leading-snug">{xmlData?.infCpl || '—'}</p>
          </div>
          <div className={`${CELL} min-h-[80px]`}>
            <p className={LBL}>RESERVADO AO FISCO</p>
            <p className="text-[9px] mt-1 whitespace-pre-wrap leading-snug">{xmlData?.infAdFisco || '—'}</p>
          </div>
        </div>

        {/* PAGAMENTO */}
        <div className={SECTION_HEADER}>FORMAS DE PAGAMENTO</div>
        <div className="border-b border-black">
          <table className="w-full border-collapse" style={{ fontSize: '9px' }}>
            <thead>
              <tr className="bg-gray-100">
                <th className={`${CELL} text-left`}>FORMA DE PAGAMENTO</th>
                <th className={`${CELL} text-right w-36`}>VALOR</th>
              </tr>
            </thead>
            <tbody>
              {pagamentos.length > 0 ? pagamentos.map((p, i) => (
                <tr key={i}>
                  <td className={CELL}>{p.descricao} (cód. {p.tPag})</td>
                  <td className={`${CELL} text-right font-mono font-bold`}>{formatCurrency(p.vPag)}</td>
                </tr>
              )) : (
                <tr><td className={`${CELL} text-gray-400`} colSpan={2}>Sem dados de pagamento</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* RESPONSÁVEL TÉCNICO */}
        {xmlData?.respTec && (
          <>
            <div className={SECTION_HEADER}>RESPONSÁVEL TÉCNICO</div>
            <div className="grid grid-cols-4 border-b border-black">
              <DCell label="CNPJ" value={xmlData.respTec.cnpj ? formatCNPJ(xmlData.respTec.cnpj) : '—'} mono />
              <DCell label="CONTATO" value={xmlData.respTec.xContato || '—'} />
              <DCell label="E-MAIL" value={xmlData.respTec.email || '—'} />
              <DCell label="FONE" value={xmlData.respTec.fone ? formatFone(xmlData.respTec.fone) : '—'} />
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="text-center text-[7px] text-gray-400 mt-1 py-1">
        <p>Documento auxiliar da nota fiscal eletrônica para consulta. Não tem valor fiscal. Consulte a NF-e em www.nfe.fazenda.gov.br</p>
      </div>
    </div>
  );
}

// ====================================================
// Tab: Dados Gerais (card-based layout matching reference)
// ====================================================
function TabDadosGerais({ nota, xmlData }: { nota: NotaEntradaDB; xmlData: XMLFullData | null }) {
  const emit = xmlData?.emitente;
  const dest = xmlData?.destinatario;
  const ide = xmlData?.ide;
  const prot = xmlData?.protSefaz;
  const rt = xmlData?.respTec;

  return (
    <div className="space-y-6">
      {/* Row 1: Identificação + Protocolo SEFAZ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CardSection icon={<FileText className="h-4 w-4" />} title="Identificação da NF-e">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 gap-x-3 sm:gap-x-4 gap-y-3 sm:gap-y-4">
            <Field label="Número" value={nota.numero || '-'} bold />
            <Field label="Série" value={nota.serie || '-'} bold />
            <Field label="Natureza da Operação" value={ide?.naturezaOperacao || '-'} className="col-span-2 sm:col-span-3 md:col-span-2" />
            <Field label="Tipo de NF-e" value={ide?.tipoOperacao || '-'} />
            <Field label="Finalidade" value={ide?.finalidade || '-'} />
            <Field label="Destino" value={ide?.idDest || '-'} />
            <Field label="Data/Hora Emissão" value={formatDate(nota.dh_emissao || '')} />
            <Field label="Data/Hora Saída/Entrada" value={ide?.dhSaiEnt ? formatDate(ide.dhSaiEnt) : formatDate(nota.dh_emissao || '')} />
            <Field label="Ambiente" value={ide?.ambiente || '-'} />
            <Field label="Indicador de Presença" value={ide?.indPres || '-'} />
            <Field label="Versão do Processo" value={ide?.verProc || '-'} />
            <Field label="Código UF" value={ide?.cUF || '-'} />
          </div>
        </CardSection>

        <CardSection icon={<Hash className="h-4 w-4" />} title="Protocolo SEFAZ">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 gap-x-3 sm:gap-x-4 gap-y-3 sm:gap-y-4">
            <Field label="Número do Protocolo" value={prot?.nProt || ide?.protocolo || '-'} bold className="col-span-2 sm:col-span-3 md:col-span-2" />
            <Field label="Status" value={prot?.cStat || '-'} />
            <Field label="Motivo" value={prot?.xMotivo || '-'} className="col-span-2 sm:col-span-3 md:col-span-2" />
            <Field label="Data/Hora Recebimento" value={prot?.dhRecbto ? formatDate(prot.dhRecbto) : ide?.dhRecebimento ? formatDate(ide.dhRecebimento) : '-'} />
            <Field label="Versão Aplicativo" value={prot?.verAplic || '-'} />
            <Field label="Ambiente" value={prot?.ambiente || ide?.ambiente || '-'} />
          </div>
        </CardSection>
      </div>

      {/* Row 2: Emitente + Destinatário */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CardSection icon={<Building2 className="h-4 w-4" />} title="Emitente">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 gap-x-3 sm:gap-x-4 gap-y-3 sm:gap-y-4">
            <Field label="Razão Social" value={emit?.razaoSocial || nota.fornecedor?.razao_social || '-'} className="col-span-2 sm:col-span-3 md:col-span-2" />
            <Field label="Nome Fantasia" value={emit?.nomeFantasia || '-'} className="col-span-2 sm:col-span-3 md:col-span-2" />
            <Field label="CNPJ/CPF" value={emit?.cnpj ? formatCNPJ(emit.cnpj) : '-'} />
            <Field label="Inscrição Estadual" value={emit?.ie || '-'} />
            <Field label="Inscrição Municipal" value={emit?.im || '—'} />
            <Field label="CNAE" value={emit?.cnae || '—'} />
            <Field label="CRT" value={emit?.crt || '-'} />
            <Field label="Logradouro" value={emit?.endereco ? `${emit.endereco.logradouro}, ${emit.endereco.nro || ''}${emit.endereco.complemento ? ` ${emit.endereco.complemento}` : ''}` : '—'} className="col-span-2 sm:col-span-3 md:col-span-2" />
            <Field label="Bairro" value={emit?.endereco?.bairro || '—'} />
            <Field label="Município/UF" value={emit?.endereco ? `${emit.endereco.cidade}/${emit.endereco.uf}` : '—'} />
            <Field label="CEP" value={emit?.endereco?.cep ? formatCEP(emit.endereco.cep) : '—'} />
            <Field label="Telefone" value={emit?.endereco?.telefone || '—'} />
          </div>
        </CardSection>

        <CardSection icon={<Building2 className="h-4 w-4" />} title="Destinatário">
          {dest ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <Field label="Razão Social / Nome" value={dest.razaoSocial} />
              <Field label="CNPJ/CPF" value={dest.cnpj ? formatCNPJ(dest.cnpj) : dest.cpf || '-'} />
              <Field label="Inscrição Estadual" value={dest.ie || '—'} />
              <Field label="E-mail" value={dest.email || '—'} />
              {dest.endereco && (
                <>
                  <Field label="Logradouro" value={`${dest.endereco.logradouro}, ${dest.endereco.nro}${dest.endereco.complemento ? ` ${dest.endereco.complemento}` : ''}`} />
                  <Field label="Bairro" value={dest.endereco.bairro} />
                  <Field label="Município/UF" value={`${dest.endereco.cidade}/${dest.endereco.uf}`} />
                  <Field label="CEP" value={formatCEP(dest.endereco.cep)} />
                  <Field label="Telefone" value={dest.endereco.telefone || '—'} />
                </>
              )}
            </div>
          ) : <p className="text-muted-foreground text-sm">Não informado no XML</p>}
        </CardSection>
      </div>

      {/* Row 3: Informações Complementares + Responsável Técnico */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CardSection icon={<Info className="h-4 w-4" />} title="Informações Complementares">
          {(xmlData?.infCpl || xmlData?.infAdFisco) ? (
            <div className="text-sm space-y-2">
              {xmlData?.infAdFisco && <p>{xmlData.infAdFisco}</p>}
              {xmlData?.infCpl && <p>{xmlData.infCpl}</p>}
            </div>
          ) : <p className="text-muted-foreground text-sm">Sem informações complementares</p>}
        </CardSection>

        <CardSection icon={<Building2 className="h-4 w-4" />} title="Responsável Técnico">
          {rt ? (
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <Field label="CNPJ" value={rt.cnpj ? formatCNPJ(rt.cnpj) : '—'} />
              <Field label="Contato" value={rt.xContato || '—'} />
              <Field label="E-mail" value={rt.email || '—'} />
              <Field label="Telefone" value={rt.fone || '—'} />
            </div>
          ) : <p className="text-muted-foreground text-sm">Não informado no XML</p>}
        </CardSection>
      </div>
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
              <React.Fragment key={p.nItem}>
                <TableRow>
                  <TableCell className="font-mono text-xs">{p.nItem}</TableCell>
                  <TableCell className="font-mono text-xs">{p.cProd}</TableCell>
                  <TableCell className="text-sm">{p.xProd}</TableCell>
                  <TableCell className="font-mono text-xs">{p.ncm}</TableCell>
                  <TableCell className="font-mono text-xs">{p.cfop}</TableCell>
                  <TableCell className="text-xs">{p.uCom}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{p.qCom.toLocaleString('pt-BR', { minimumFractionDigits: 3 })}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{formatCurrency(p.vUnCom)}</TableCell>
                  <TableCell className="text-right font-mono text-xs font-medium">{formatCurrency(p.vProd)}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{formatCurrency(p.icms.vICMS)}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{formatCurrency(p.ipi.vIPI)}</TableCell>
                </TableRow>
                {(p.rastros?.length > 0 || p.infAdProd) && (
                  <TableRow className="border-t-0">
                    <TableCell colSpan={11} className="pt-0 pb-2 px-4">
                      {p.rastros?.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className="text-[10px] font-semibold text-amber-700 uppercase">⟐ Rastreabilidade</span>
                          {p.rastros.map((r: any, ri: number) => (
                            <span key={ri} className="inline-flex items-center gap-2 text-xs border border-amber-200 bg-amber-50 rounded px-2 py-0.5">
                              <span className="font-semibold">Lote: {r.nLot}</span>
                              <span>Qtd: {r.qLot}</span>
                              <span>Fab: {r.dFab}</span>
                              <span>Val: {r.dVal}</span>
                            </span>
                          ))}
                        </div>
                      )}
                      {p.infAdProd && (
                        <p className="text-xs text-muted-foreground mt-1">{p.infAdProd}</p>
                      )}
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
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
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
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
          <div className="border rounded-lg overflow-x-auto bg-card">
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
function CardSection({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="border rounded-lg p-4 space-y-3 overflow-hidden">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <span className="text-primary shrink-0">{icon}</span>
        {title}
      </div>
      {children}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2 sm:space-y-3">
      <h3 className="text-[10px] sm:text-sm font-bold text-muted-foreground uppercase tracking-wide px-1">{title}</h3>
      <div className="bg-card rounded-lg border p-3 sm:p-4 shadow-sm overflow-hidden">
        {children}
      </div>
    </div>
  );
}

function Field({ label, value, bold, className }: { label: string; value: string; bold?: boolean; className?: string }) {
  return (
    <div className={`min-w-0 flex flex-col ${className || ''}`}>
      <p className="text-[10px] sm:text-xs text-muted-foreground uppercase leading-tight truncate mb-0.5" title={label}>{label}</p>
      <p className={cn(
        "text-xs sm:text-sm break-words line-clamp-3 sm:line-clamp-none",
        bold ? "font-bold text-foreground" : "text-foreground/90 font-medium"
      )} title={String(value)}>
        {value}
      </p>
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
