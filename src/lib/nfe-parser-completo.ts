// ============================================
// PARSER COMPLETO DE NF-e XML
// Captura TODOS os campos do XML sem exceção
// ============================================

import type {
  NFeParseResult,
  EntidadeXML,
  TipoOperacaoNFe,
  FinalidadeNFe,
  AmbienteNFe,
  StatusSEFAZ,
  ClassificacaoNota,
  ModalidadeFrete,
} from '@/types/nfe-completa';

// ============================================
// HELPERS
// ============================================
function getTextContent(element: Element | null, tagName: string): string {
  if (!element) return '';
  const child = element.getElementsByTagName(tagName)[0];
  return child?.textContent?.trim() || '';
}

function getFloat(element: Element | null, tagName: string): number {
  const text = getTextContent(element, tagName);
  return text ? parseFloat(text) : 0;
}

function getInt(element: Element | null, tagName: string): number {
  const text = getTextContent(element, tagName);
  return text ? parseInt(text, 10) : 0;
}

function getAllElements(parent: Element | Document, tagName: string): Element[] {
  return Array.from(parent.getElementsByTagName(tagName));
}

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

function mapModalidadeFrete(mod: string): ModalidadeFrete {
  switch (mod) {
    case '0': return 'CIF';
    case '1': return 'FOB';
    case '2': return 'TERCEIROS';
    case '3': return 'PROPRIO_REMETENTE';
    case '4': return 'PROPRIO_DESTINATARIO';
    case '9': return 'SEM_FRETE';
    default: return 'SEM_FRETE';
  }
}

function mapFinalidade(fin: string): FinalidadeNFe {
  switch (fin) {
    case '1': return 'NORMAL';
    case '2': return 'COMPLEMENTAR';
    case '3': return 'AJUSTE';
    case '4': return 'DEVOLUCAO';
    default: return 'NORMAL';
  }
}

function mapAmbiente(amb: string): AmbienteNFe {
  return amb === '1' ? 'PRODUCAO' : 'HOMOLOGACAO';
}

function mapTipoOperacao(tpNF: string): TipoOperacaoNFe {
  return tpNF === '0' ? 'ENTRADA' : 'SAIDA';
}

function inferClassificacao(cfops: string[], naturezaOp: string): ClassificacaoNota {
  const nat = naturezaOp.toUpperCase();
  
  if (nat.includes('REMESSA') && nat.includes('INDUSTRIALIZA')) return 'REMESSA_INDUSTRIALIZACAO';
  if (nat.includes('RETORNO') && nat.includes('INDUSTRIALIZA')) return 'RETORNO_INDUSTRIALIZACAO';
  if (nat.includes('DEVOLU')) return 'OUTRO';
  if (nat.includes('ATIVO') || nat.includes('IMOBILIZADO')) return 'ATIVO_IMOBILIZADO';
  if (nat.includes('CONSUMO') || nat.includes('USO')) return 'MATERIAL_USO_CONSUMO';
  
  // Inferir por CFOP
  const cfopSet = new Set(cfops.map(c => c.substring(0, 1)));
  if (cfopSet.has('1') || cfopSet.has('2') || cfopSet.has('3')) {
    // Entradas - analisar último dígito
    const cfopCategories = cfops.map(c => c.substring(1, 3));
    if (cfopCategories.some(c => ['01', '02', '03', '04', '05', '06', '07'].includes(c))) {
      return 'MATERIA_PRIMA';
    }
  }
  
  return 'MATERIA_PRIMA'; // Default para entrada
}

// ============================================
// PARSER PRINCIPAL
// ============================================
export function parseNFeCompleto(xmlString: string): NFeParseResult | null {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

    // Check for parsing errors
    const parseError = xmlDoc.querySelector('parsererror');
    if (parseError) {
      console.error('XML Parse Error:', parseError.textContent);
      return null;
    }

    // Get infNFe
    const infNFe = xmlDoc.getElementsByTagName('infNFe')[0];
    if (!infNFe) {
      console.error('infNFe not found');
      return null;
    }

    const chaveAcesso = infNFe.getAttribute('Id')?.replace('NFe', '') || '';
    const versaoSchema = infNFe.getAttribute('versao') || '4.00';

    // =========== IDE ===========
    const ide = xmlDoc.getElementsByTagName('ide')[0];
    const numero = getTextContent(ide, 'nNF');
    const serie = getTextContent(ide, 'serie');
    const modelo = getTextContent(ide, 'mod');
    const natOp = getTextContent(ide, 'natOp');
    const dhEmi = getTextContent(ide, 'dhEmi') || getTextContent(ide, 'dEmi');
    const dhSaiEnt = getTextContent(ide, 'dhSaiEnt');
    const tpNF = getTextContent(ide, 'tpNF');
    const finNFe = getTextContent(ide, 'finNFe');
    const tpAmb = getTextContent(ide, 'tpAmb');

    // =========== PROTOCOLO ===========
    const protNFe = xmlDoc.getElementsByTagName('protNFe')[0];
    const infProt = protNFe?.getElementsByTagName('infProt')[0];
    const protocolo = getTextContent(infProt, 'nProt');
    const dhRecbto = getTextContent(infProt, 'dhRecbto');
    const digVal = getTextContent(infProt, 'digVal');
    const cStat = getTextContent(infProt, 'cStat');
    
    let statusSefaz: StatusSEFAZ = 'PENDENTE';
    if (cStat === '100') statusSefaz = 'AUTORIZADA';
    else if (cStat === '101' || cStat === '135') statusSefaz = 'CANCELADA';
    else if (cStat === '110') statusSefaz = 'DENEGADA';

    // =========== EMITENTE ===========
    const emit = xmlDoc.getElementsByTagName('emit')[0];
    const emitente = parseEntidade(emit, 'emit');

    // =========== DESTINATÁRIO ===========
    const dest = xmlDoc.getElementsByTagName('dest')[0];
    const destinatario = dest ? parseEntidade(dest, 'dest') : undefined;

    // =========== TRANSPORTADORA ===========
    const transp = xmlDoc.getElementsByTagName('transp')[0];
    const transporta = transp?.getElementsByTagName('transporta')[0];
    const transportadora = transporta ? parseEntidade(transporta, 'transporta') : undefined;

    // =========== ITENS ===========
    const detElements = getAllElements(xmlDoc, 'det');
    const cfops: string[] = [];
    const itens = detElements.map(det => {
      const prod = det.getElementsByTagName('prod')[0];
      const imposto = det.getElementsByTagName('imposto')[0];
      const rastros = getAllElements(det, 'rastro');
      
      const cfop = getTextContent(prod, 'CFOP');
      if (cfop) cfops.push(cfop);

      return {
        item: {
          n_item: parseInt(det.getAttribute('nItem') || '1', 10),
          codigo_produto: getTextContent(prod, 'cProd'),
          ean: getTextContent(prod, 'cEAN') || getTextContent(prod, 'cEANTrib') || '',
          descricao: getTextContent(prod, 'xProd'),
          ncm: getTextContent(prod, 'NCM'),
          cest: getTextContent(prod, 'CEST') || undefined,
          cfop: cfop,
          unidade_comercial: getTextContent(prod, 'uCom'),
          quantidade_comercial: getFloat(prod, 'qCom'),
          valor_unitario_comercial: getFloat(prod, 'vUnCom'),
          valor_total: getFloat(prod, 'vProd'),
          unidade_tributaria: getTextContent(prod, 'uTrib') || undefined,
          quantidade_tributaria: getFloat(prod, 'qTrib') || undefined,
          valor_unitario_tributario: getFloat(prod, 'vUnTrib') || undefined,
          ean_tributario: getTextContent(prod, 'cEANTrib') || undefined,
          valor_frete: getFloat(prod, 'vFrete') || undefined,
          valor_seguro: getFloat(prod, 'vSeg') || undefined,
          valor_desconto: getFloat(prod, 'vDesc') || undefined,
          valor_outros: getFloat(prod, 'vOutro') || undefined,
          info_adicional: getTextContent(det, 'infAdProd') || undefined,
          numero_pedido_compra: getTextContent(prod, 'xPed') || undefined,
          item_pedido_compra: getTextContent(prod, 'nItemPed') || undefined,
        },
        impostos: parseImpostos(imposto),
        rastros: rastros.map(r => ({
          numero_lote: getTextContent(r, 'nLote'),
          quantidade: getFloat(r, 'qLote'),
          data_fabricacao: getTextContent(r, 'dFab') || undefined,
          data_validade: getTextContent(r, 'dVal') || undefined,
          codigo_agregacao: getTextContent(r, 'cAgreg') || undefined,
        })),
      };
    });

    // =========== TOTAIS ===========
    const ICMSTot = xmlDoc.getElementsByTagName('ICMSTot')[0];
    const totaisImpostos = {
      icms_base_calculo: getFloat(ICMSTot, 'vBC'),
      icms_valor: getFloat(ICMSTot, 'vICMS'),
      icms_desonerado: getFloat(ICMSTot, 'vICMSDeson'),
      fcp_uf_destino: getFloat(ICMSTot, 'vFCPUFDest'),
      icms_uf_destino: getFloat(ICMSTot, 'vICMSUFDest'),
      icms_uf_remet: getFloat(ICMSTot, 'vICMSUFRemet'),
      icms_st_base_calculo: getFloat(ICMSTot, 'vBCST'),
      icms_st_valor: getFloat(ICMSTot, 'vST'),
      fcp_st: getFloat(ICMSTot, 'vFCPST'),
      fcp_st_retido: getFloat(ICMSTot, 'vFCPSTRet'),
      valor_produtos: getFloat(ICMSTot, 'vProd'),
      valor_frete: getFloat(ICMSTot, 'vFrete'),
      valor_seguro: getFloat(ICMSTot, 'vSeg'),
      valor_desconto: getFloat(ICMSTot, 'vDesc'),
      valor_ii: getFloat(ICMSTot, 'vII'),
      valor_ipi: getFloat(ICMSTot, 'vIPI'),
      valor_ipi_devolvido: getFloat(ICMSTot, 'vIPIDevol'),
      valor_pis: getFloat(ICMSTot, 'vPIS'),
      valor_cofins: getFloat(ICMSTot, 'vCOFINS'),
      valor_outros: getFloat(ICMSTot, 'vOutro'),
      valor_nota: getFloat(ICMSTot, 'vNF'),
      valor_total_tributos: getFloat(ICMSTot, 'vTotTrib') || undefined,
    };

    // =========== TRANSPORTE ===========
    const modFrete = getTextContent(transp, 'modFrete');
    const veicTransp = transp?.getElementsByTagName('veicTransp')[0];
    const reboque = transp?.getElementsByTagName('reboque')[0];
    
    const transporte = transp ? {
      modalidade_frete: mapModalidadeFrete(modFrete),
      transportadora_cnpj: getTextContent(transporta, 'CNPJ') || undefined,
      transportadora_cpf: getTextContent(transporta, 'CPF') || undefined,
      transportadora_razao_social: getTextContent(transporta, 'xNome') || undefined,
      transportadora_ie: getTextContent(transporta, 'IE') || undefined,
      transportadora_endereco: getTextContent(transporta, 'xEnder') || undefined,
      transportadora_uf: getTextContent(transporta, 'UF') || undefined,
      transportadora_municipio: getTextContent(transporta, 'xMun') || undefined,
      veiculo_placa: getTextContent(veicTransp, 'placa') || undefined,
      veiculo_uf: getTextContent(veicTransp, 'UF') || undefined,
      veiculo_rntc: getTextContent(veicTransp, 'RNTC') || undefined,
      reboque_placa: getTextContent(reboque, 'placa') || undefined,
      reboque_uf: getTextContent(reboque, 'UF') || undefined,
      reboque_rntc: getTextContent(reboque, 'RNTC') || undefined,
    } : undefined;

    // =========== VOLUMES ===========
    const volElements = getAllElements(transp || xmlDoc, 'vol');
    const volumes = volElements.map(vol => ({
      quantidade: getInt(vol, 'qVol'),
      especie: getTextContent(vol, 'esp') || undefined,
      marca: getTextContent(vol, 'marca') || undefined,
      numeracao: getTextContent(vol, 'nVol') || undefined,
      peso_liquido: getFloat(vol, 'pesoL') || undefined,
      peso_bruto: getFloat(vol, 'pesoB') || undefined,
    }));

    // =========== COBRANÇA ===========
    const cobr = xmlDoc.getElementsByTagName('cobr')[0];
    const fat = cobr?.getElementsByTagName('fat')[0];
    const fatura = fat ? {
      numero_fatura: getTextContent(fat, 'nFat') || undefined,
      valor_original: getFloat(fat, 'vOrig') || undefined,
      valor_desconto: getFloat(fat, 'vDesc') || undefined,
      valor_liquido: getFloat(fat, 'vLiq') || undefined,
    } : undefined;

    const dupElements = getAllElements(cobr || xmlDoc, 'dup');
    const duplicatas = dupElements.map(dup => ({
      numero: getTextContent(dup, 'nDup'),
      data_vencimento: getTextContent(dup, 'dVenc'),
      valor: getFloat(dup, 'vDup'),
    }));

    // =========== PAGAMENTOS ===========
    const pag = xmlDoc.getElementsByTagName('pag')[0];
    const detPagElements = getAllElements(pag || xmlDoc, 'detPag');
    const pagamentos = detPagElements.map(detPag => {
      const card = detPag.getElementsByTagName('card')[0];
      return {
        forma_pagamento: getTextContent(detPag, 'tPag'),
        valor: getFloat(detPag, 'vPag'),
        tipo_integracao: getTextContent(card, 'tpIntegra') || undefined,
        cnpj_credenciadora: getTextContent(card, 'CNPJ') || undefined,
        bandeira: getTextContent(card, 'tBand') || undefined,
        cod_autorizacao: getTextContent(card, 'cAut') || undefined,
      };
    });

    // =========== OBSERVAÇÕES ===========
    const infAdic = xmlDoc.getElementsByTagName('infAdic')[0];
    const observacoes: NFeParseResult['observacoes'] = [];
    
    const infCpl = getTextContent(infAdic, 'infCpl');
    if (infCpl) {
      observacoes.push({ tipo: 'CONTRIBUINTE', texto: infCpl });
    }
    
    const infAdFisco = getTextContent(infAdic, 'infAdFisco');
    if (infAdFisco) {
      observacoes.push({ tipo: 'FISCO', texto: infAdFisco });
    }
    
    const obsCont = getAllElements(infAdic || xmlDoc, 'obsCont');
    obsCont.forEach(obs => {
      observacoes.push({
        tipo: 'CONTRIBUINTE',
        campo: obs.getAttribute('xCampo') || undefined,
        texto: getTextContent(obs, 'xTexto'),
      });
    });

    const obsFisco = getAllElements(infAdic || xmlDoc, 'obsFisco');
    obsFisco.forEach(obs => {
      observacoes.push({
        tipo: 'FISCO',
        campo: obs.getAttribute('xCampo') || undefined,
        texto: getTextContent(obs, 'xTexto'),
      });
    });

    // =========== RESULTADO ===========
    return {
      notaFiscal: {
        chave_acesso: chaveAcesso,
        numero,
        serie,
        modelo,
        natureza_operacao: natOp,
        dh_emissao: dhEmi,
        dh_saida_entrada: dhSaiEnt || undefined,
        tipo_operacao: mapTipoOperacao(tpNF),
        finalidade: mapFinalidade(finNFe),
        ambiente: mapAmbiente(tpAmb),
        status_sefaz: statusSefaz,
        protocolo_autorizacao: protocolo || undefined,
        dh_recebimento: dhRecbto || undefined,
        digest_value: digVal || undefined,
        versao_schema: versaoSchema,
        classificacao: inferClassificacao(cfops, natOp),
        total_produtos: totaisImpostos.valor_produtos,
        total_icms: totaisImpostos.icms_valor,
        total_icms_st: totaisImpostos.icms_st_valor,
        total_ipi: totaisImpostos.valor_ipi,
        total_pis: totaisImpostos.valor_pis,
        total_cofins: totaisImpostos.valor_cofins,
        total_frete: totaisImpostos.valor_frete,
        total_seguro: totaisImpostos.valor_seguro,
        total_desconto: totaisImpostos.valor_desconto,
        total_outros: totaisImpostos.valor_outros,
        total_nota: totaisImpostos.valor_nota,
        xml_hash_sha256: hashString(xmlString),
        xml_raw: xmlString,
      },
      observacoes,
      itens,
      totaisImpostos,
      transporte,
      volumes,
      fatura,
      duplicatas,
      pagamentos,
      emitente,
      destinatario,
      transportadora,
    };
  } catch (error) {
    console.error('Error parsing NF-e XML:', error);
    return null;
  }
}

// ============================================
// PARSER DE ENTIDADE
// ============================================
function parseEntidade(element: Element, tipo: 'emit' | 'dest' | 'transporta'): EntidadeXML {
  const cnpj = getTextContent(element, 'CNPJ');
  const cpf = getTextContent(element, 'CPF');
  
  const enderTag = tipo === 'emit' ? 'enderEmit' : tipo === 'dest' ? 'enderDest' : null;
  const ender = enderTag ? element.getElementsByTagName(enderTag)[0] : null;

  return {
    tipo_pessoa: cnpj ? 'PJ' : 'PF',
    documento: cnpj || cpf,
    razao_social: getTextContent(element, 'xNome'),
    nome_fantasia: getTextContent(element, 'xFant') || undefined,
    ie: getTextContent(element, 'IE') || undefined,
    im: getTextContent(element, 'IM') || undefined,
    cnae: getTextContent(element, 'CNAE') || undefined,
    crt: getTextContent(element, 'CRT') || undefined,
    suframa: getTextContent(element, 'ISUF') || undefined,
    email: getTextContent(element, 'email') || undefined,
    telefone: getTextContent(element, 'fone') || getTextContent(ender, 'fone') || undefined,
    endereco: ender ? {
      logradouro: getTextContent(ender, 'xLgr') || undefined,
      numero: getTextContent(ender, 'nro') || undefined,
      complemento: getTextContent(ender, 'xCpl') || undefined,
      bairro: getTextContent(ender, 'xBairro') || undefined,
      codigo_municipio: getTextContent(ender, 'cMun') || undefined,
      municipio: getTextContent(ender, 'xMun') || undefined,
      uf: getTextContent(ender, 'UF') || undefined,
      cep: getTextContent(ender, 'CEP') || undefined,
      codigo_pais: getTextContent(ender, 'cPais') || undefined,
      pais: getTextContent(ender, 'xPais') || undefined,
    } : undefined,
  };
}

// ============================================
// PARSER DE IMPOSTOS DO ITEM
// ============================================
function parseImpostos(imposto: Element | null): NFeParseResult['itens'][0]['impostos'] {
  if (!imposto) return {};

  // ICMS - pode ser ICMS00, ICMS10, ICMS20, etc.
  const icmsGroups = ['ICMS00', 'ICMS10', 'ICMS20', 'ICMS30', 'ICMS40', 'ICMS51', 'ICMS60', 'ICMS70', 'ICMS90', 'ICMSSN101', 'ICMSSN102', 'ICMSSN201', 'ICMSSN202', 'ICMSSN500', 'ICMSSN900'];
  let icmsEl: Element | null = null;
  const icmsParent = imposto.getElementsByTagName('ICMS')[0];
  for (const grp of icmsGroups) {
    const el = icmsParent?.getElementsByTagName(grp)[0];
    if (el) { icmsEl = el; break; }
  }

  // IPI
  const ipi = imposto.getElementsByTagName('IPI')[0];
  const ipiTrib = ipi?.getElementsByTagName('IPITrib')[0];
  const ipiNT = ipi?.getElementsByTagName('IPINT')[0];

  // PIS
  const pis = imposto.getElementsByTagName('PIS')[0];
  const pisAliq = pis?.getElementsByTagName('PISAliq')[0];
  const pisNT = pis?.getElementsByTagName('PISNT')[0];
  const pisOutr = pis?.getElementsByTagName('PISOutr')[0];
  const pisEl = pisAliq || pisNT || pisOutr;

  // COFINS
  const cofins = imposto.getElementsByTagName('COFINS')[0];
  const cofinsAliq = cofins?.getElementsByTagName('COFINSAliq')[0];
  const cofinsNT = cofins?.getElementsByTagName('COFINSNT')[0];
  const cofinsOutr = cofins?.getElementsByTagName('COFINSOutr')[0];
  const cofinsEl = cofinsAliq || cofinsNT || cofinsOutr;

  // II
  const ii = imposto.getElementsByTagName('II')[0];

  return {
    // ICMS
    icms_origem: getTextContent(icmsEl, 'orig') || undefined,
    icms_cst: getTextContent(icmsEl, 'CST') || getTextContent(icmsEl, 'CSOSN') || undefined,
    icms_base_calculo: getFloat(icmsEl, 'vBC') || undefined,
    icms_aliquota: getFloat(icmsEl, 'pICMS') || undefined,
    icms_valor: getFloat(icmsEl, 'vICMS') || undefined,
    icms_mod_bc: getTextContent(icmsEl, 'modBC') || undefined,
    
    // ICMS ST
    icms_st_base_calculo: getFloat(icmsEl, 'vBCST') || undefined,
    icms_st_aliquota: getFloat(icmsEl, 'pICMSST') || undefined,
    icms_st_valor: getFloat(icmsEl, 'vICMSST') || undefined,
    icms_st_mva: getFloat(icmsEl, 'pMVAST') || undefined,
    
    // ICMS Diferido/Desonerado
    icms_diferido_valor: getFloat(icmsEl, 'vICMSDif') || undefined,
    icms_desonerado_valor: getFloat(icmsEl, 'vICMSDeson') || undefined,
    icms_desonerado_motivo: getTextContent(icmsEl, 'motDesICMS') || undefined,
    
    // IPI
    ipi_cst: getTextContent(ipiTrib, 'CST') || getTextContent(ipiNT, 'CST') || undefined,
    ipi_base_calculo: getFloat(ipiTrib, 'vBC') || undefined,
    ipi_aliquota: getFloat(ipiTrib, 'pIPI') || undefined,
    ipi_valor: getFloat(ipiTrib, 'vIPI') || undefined,
    ipi_cnpj_produtor: getTextContent(ipi, 'CNPJProd') || undefined,
    
    // PIS
    pis_cst: getTextContent(pisEl, 'CST') || undefined,
    pis_base_calculo: getFloat(pisEl, 'vBC') || undefined,
    pis_aliquota: getFloat(pisEl, 'pPIS') || undefined,
    pis_valor: getFloat(pisEl, 'vPIS') || undefined,
    
    // COFINS
    cofins_cst: getTextContent(cofinsEl, 'CST') || undefined,
    cofins_base_calculo: getFloat(cofinsEl, 'vBC') || undefined,
    cofins_aliquota: getFloat(cofinsEl, 'pCOFINS') || undefined,
    cofins_valor: getFloat(cofinsEl, 'vCOFINS') || undefined,
    
    // II
    ii_base_calculo: getFloat(ii, 'vBC') || undefined,
    ii_despesas_aduaneiras: getFloat(ii, 'vDespAdu') || undefined,
    ii_valor: getFloat(ii, 'vII') || undefined,
    ii_iof: getFloat(ii, 'vIOF') || undefined,
  };
}

// ============================================
// HELPERS DE FORMATAÇÃO
// ============================================
export function formatCNPJ(cnpj: string): string {
  const cleaned = cnpj.replace(/\D/g, '');
  if (cleaned.length !== 14) return cnpj;
  return cleaned.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    '$1.$2.$3/$4-$5'
  );
}

export function formatCPF(cpf: string): string {
  const cleaned = cpf.replace(/\D/g, '');
  if (cleaned.length !== 11) return cpf;
  return cleaned.replace(
    /^(\d{3})(\d{3})(\d{3})(\d{2})$/,
    '$1.$2.$3-$4'
  );
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  try {
    if (dateStr.includes('T') || dateStr.includes('-')) {
      const date = new Date(dateStr);
      return date.toLocaleDateString('pt-BR');
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

export function formatDateTime(dateStr: string): string {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    return date.toLocaleString('pt-BR');
  } catch {
    return dateStr;
  }
}
