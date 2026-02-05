// NF-e XML Parser - Client-side parsing for NF-e model 55
import type { NFeXMLParsed, NFeItemParsed } from '@/types/erp';

function getTextContent(element: Element | null, tagName: string): string {
  if (!element) return '';
  const child = element.getElementsByTagName(tagName)[0];
  return child?.textContent?.trim() || '';
}

function getTextContentDirect(element: Element | null): string {
  return element?.textContent?.trim() || '';
}

export function parseNFeXML(xmlString: string): NFeXMLParsed | null {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

    // Check for parsing errors
    const parseError = xmlDoc.querySelector('parsererror');
    if (parseError) {
      console.error('XML Parse Error:', parseError.textContent);
      return null;
    }

    // Get infNFe - the main NF-e info container
    const infNFe = xmlDoc.getElementsByTagName('infNFe')[0];
    if (!infNFe) {
      console.error('infNFe not found in XML');
      return null;
    }

    // Extract chave from Id attribute (remove "NFe" prefix)
    const chave = infNFe.getAttribute('Id')?.replace('NFe', '') || '';

    // Get ide (identificação)
    const ide = xmlDoc.getElementsByTagName('ide')[0];
    const numero = getTextContent(ide, 'nNF');
    const serie = getTextContent(ide, 'serie');
    const modelo = getTextContent(ide, 'mod');
    const dhEmissao = getTextContent(ide, 'dhEmi') || getTextContent(ide, 'dEmi');

    // Get emit (emitente/fornecedor)
    const emit = xmlDoc.getElementsByTagName('emit')[0];
    const enderEmit = emit?.getElementsByTagName('enderEmit')[0];

    const emitente = {
      cnpj: getTextContent(emit, 'CNPJ'),
      razaoSocial: getTextContent(emit, 'xNome'),
      nomeFantasia: getTextContent(emit, 'xFant'),
      ie: getTextContent(emit, 'IE'),
      endereco: enderEmit ? {
        logradouro: getTextContent(enderEmit, 'xLgr'),
        nro: getTextContent(enderEmit, 'nro'),
        bairro: getTextContent(enderEmit, 'xBairro'),
        cidade: getTextContent(enderEmit, 'xMun'),
        uf: getTextContent(enderEmit, 'UF'),
        cep: getTextContent(enderEmit, 'CEP'),
        cMun: getTextContent(enderEmit, 'cMun'),
      } : undefined,
      email: getTextContent(emit, 'email'),
      telefone: getTextContent(emit, 'fone'),
    };

    // Get dest (destinatário)
    const dest = xmlDoc.getElementsByTagName('dest')[0];
    const enderDest = dest?.getElementsByTagName('enderDest')[0];

    const destinatario = {
      cnpj: getTextContent(dest, 'CNPJ'),
      cpf: getTextContent(dest, 'CPF'),
      razaoSocial: getTextContent(dest, 'xNome'),
      ie: getTextContent(dest, 'IE'),
      endereco: enderDest ? {
        logradouro: getTextContent(enderDest, 'xLgr'),
        nro: getTextContent(enderDest, 'nro'),
        bairro: getTextContent(enderDest, 'xBairro'),
        cidade: getTextContent(enderDest, 'xMun'),
        uf: getTextContent(enderDest, 'UF'),
        cep: getTextContent(enderDest, 'CEP'),
        cMun: getTextContent(enderDest, 'cMun'),
      } : undefined,
      email: getTextContent(dest, 'email'),
    };

    // Get transp (transportadora) - optional
    const transp = xmlDoc.getElementsByTagName('transp')[0];
    const transporta = transp?.getElementsByTagName('transporta')[0];
    
    const transportadora = transporta ? {
      cnpj: getTextContent(transporta, 'CNPJ'),
      razaoSocial: getTextContent(transporta, 'xNome'),
      ie: getTextContent(transporta, 'IE'),
    } : undefined;

    // Get det (items)
    const detElements = xmlDoc.getElementsByTagName('det');
    const itens: NFeItemParsed[] = [];

    for (let i = 0; i < detElements.length; i++) {
      const det = detElements[i];
      const prod = det.getElementsByTagName('prod')[0];
      const rastro = det.getElementsByTagName('rastro')[0];

      if (prod) {
        const item: NFeItemParsed = {
          nItem: parseInt(det.getAttribute('nItem') || String(i + 1), 10),
          cProd: getTextContent(prod, 'cProd'),
          cEAN: getTextContent(prod, 'cEAN') || getTextContent(prod, 'cEANTrib'),
          xProd: getTextContent(prod, 'xProd'),
          NCM: getTextContent(prod, 'NCM'),
          CFOP: getTextContent(prod, 'CFOP'),
          uCom: getTextContent(prod, 'uCom'),
          qCom: parseFloat(getTextContent(prod, 'qCom')) || 0,
          vUnCom: parseFloat(getTextContent(prod, 'vUnCom')) || 0,
          vProd: parseFloat(getTextContent(prod, 'vProd')) || 0,
        };

        // Parse rastro (lote info) if present
        if (rastro) {
          item.rastro = {
            nLote: getTextContent(rastro, 'nLote'),
            dFab: getTextContent(rastro, 'dFab'),
            dVal: getTextContent(rastro, 'dVal'),
            qLote: parseFloat(getTextContent(rastro, 'qLote')) || undefined,
          };
        }

        itens.push(item);
      }
    }

    // Get totals
    const ICMSTot = xmlDoc.getElementsByTagName('ICMSTot')[0];
    const totalProdutos = parseFloat(getTextContent(ICMSTot, 'vProd')) || 0;
    const totalNota = parseFloat(getTextContent(ICMSTot, 'vNF')) || 0;

    return {
      chave,
      numero,
      serie,
      modelo,
      dhEmissao,
      emitente,
      destinatario,
      transportadora,
      itens,
      total: {
        totalProdutos,
        totalNota,
      },
    };
  } catch (error) {
    console.error('Error parsing NF-e XML:', error);
    return null;
  }
}

// Helper to format CNPJ
export function formatCNPJ(cnpj: string): string {
  const cleaned = cnpj.replace(/\D/g, '');
  if (cleaned.length !== 14) return cnpj;
  return cleaned.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    '$1.$2.$3/$4-$5'
  );
}

// Helper to format currency
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

// Helper to format date from ISO or Brazilian format
export function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  
  try {
    // Try ISO format first
    if (dateStr.includes('T') || dateStr.includes('-')) {
      const date = new Date(dateStr);
      return date.toLocaleDateString('pt-BR');
    }
    // Already in dd/mm/yyyy format
    return dateStr;
  } catch {
    return dateStr;
  }
}
