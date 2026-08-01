/**
 * Mapeia nota de entrada (XML parseado + registros) para DANFEData,
 * o mesmo formato usado pelo DANFE de saída (DanfeDocument).
 */
import type { DANFEData } from "@/components/nfe/DANFEPreviewDialog";

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function formatDataBr(v: unknown): string {
  if (!v) return "";
  const s = String(v);
  if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("pt-BR");
}

export function buildDanfeDataFromEntrada(params: {
  nota: any;
  xmlData: any | null;
  itens: any[];
  logoUrl?: string | null;
}): DANFEData {
  const { nota, xmlData, itens, logoUrl } = params;
  const emit = xmlData?.emitente;
  const dest = xmlData?.destinatario;
  const totais = xmlData?.totais;
  const transp = xmlData?.transporte;
  const ide = xmlData?.ide;
  const enderEmit = emit?.endereco;
  const enderDest = dest?.endereco;
  const produtos = xmlData?.itensDetalhados || [];

  const itensMapped =
    produtos.length > 0
      ? produtos.map((p: any, idx: number) => {
          const rastro =
            (Array.isArray(p?.rastros) && p.rastros[0]) ||
            p?.rastro ||
            p?.rastreabilidade ||
            {};
          const icms = p?.icms || {};
          const ipi = p?.ipi || {};
          return {
            numero_item: num(p.nItem || p.numero_item, idx + 1),
            codigo: p.cProd || p.codigo || undefined,
            descricao: p.xProd || p.descricao || "",
            ncm: p.NCM || p.ncm || "",
            cst_icms: String(icms.cst || p.CST || p.CSOSN || p.cst_icms || "00"),
            cfop: String(p.CFOP || p.cfop || ""),
            unidade: p.uCom || p.unidade || "UN",
            quantidade: num(p.qCom || p.quantidade),
            valor_unitario: num(p.vUnCom || p.valor_unitario),
            valor_total: num(p.vProd || p.valor_total),
            icms_aliquota: num(icms.pICMS ?? p.pICMS ?? p.icms_aliquota),
            icms_valor: num(icms.vICMS ?? p.vICMS ?? p.icms_valor),
            ipi_valor: num(ipi.vIPI ?? p.vIPI ?? p.ipi_valor),
            ipi_aliquota: num(ipi.pIPI ?? p.pIPI ?? p.ipi_aliquota),
            origem: String(icms.orig ?? p.orig ?? p.origem ?? "0"),
            lote: rastro.nLot || rastro.nLote || rastro.numero_lote || p.lote || undefined,
            data_fabricacao: formatDataBr(rastro.dFab || rastro.data_fabricacao) || undefined,
            data_validade: formatDataBr(rastro.dVal || rastro.data_validade) || undefined,
          };
        })
      : (itens || []).map((item: any, idx: number) => ({
          numero_item: num(item.numero_item, idx + 1),
          codigo: item.codigo_fornecedor || undefined,
          descricao: item.descricao || "",
          ncm: item.ncm || "",
          cst_icms: item.cst_icms || "00",
          cfop: item.cfop || "",
          unidade: item.ucom || item.unidade || "UN",
          quantidade: num(item.qcom ?? item.quantidade),
          valor_unitario: num(item.vuncom ?? item.valor_unitario),
          valor_total: num(item.vprod ?? item.valor_total),
          icms_aliquota: num(item.icms_aliquota),
          icms_valor: num(item.icms_valor),
          origem: item.origem || "0",
          lote: item.lote || undefined,
          data_fabricacao: formatDataBr(item.data_fabricacao) || undefined,
          data_validade: formatDataBr(item.data_validade) || undefined,
        }));

  const tpNF = ide?.tipoOperacao === "Entrada" ? ("0" as const) : ("1" as const);
  const dataEmissao = formatDataBr(nota.dh_emissao || ide?.dhEmi) || undefined;

  return {
    emit_razao: emit?.razaoSocial || nota.fornecedor?.razao_social || "—",
    emit_fantasia: emit?.nomeFantasia || undefined,
    emit_logo_url: logoUrl || undefined,
    emit_logradouro: enderEmit?.logradouro,
    emit_numero: enderEmit?.nro,
    emit_bairro: enderEmit?.bairro,
    emit_cidade: enderEmit?.cidade,
    emit_uf: enderEmit?.uf,
    emit_cep: enderEmit?.cep,
    emit_telefone: enderEmit?.telefone,
    emit_cnpj: emit?.cnpj || nota.fornecedor?.documento || "",
    emit_ie: emit?.ie || undefined,
    numero: nota.numero || undefined,
    serie: nota.serie || undefined,
    natureza_operacao: ide?.naturezaOperacao || "—",
    chave_acesso: nota.chave_nfe || undefined,
    protocolo: ide?.protocolo || undefined,
    data_emissao: dataEmissao,
    tipo_operacao: tpNF,
    dest_razao: dest?.razaoSocial || undefined,
    dest_cnpj_cpf: dest?.cnpj || dest?.cpf || undefined,
    dest_logradouro: enderDest?.logradouro,
    dest_numero: enderDest?.nro,
    dest_bairro: enderDest?.bairro,
    dest_cidade: enderDest?.cidade,
    dest_uf: enderDest?.uf,
    dest_cep: enderDest?.cep,
    dest_telefone: enderDest?.telefone,
    dest_ie: dest?.ie || undefined,
    dest_data_emissao: dataEmissao,
    bc_icms: num(totais?.vBC),
    valor_icms: num(totais?.vICMS),
    bc_icms_st: num(totais?.vBCST),
    valor_icms_st: num(totais?.vST),
    valor_produtos: num(totais?.vProd ?? nota.total_produtos),
    valor_frete: num(totais?.vFrete),
    valor_seguro: num(totais?.vSeg),
    valor_desconto: num(totais?.vDesc),
    outras_despesas: num(totais?.vOutro),
    valor_ipi: num(totais?.vIPI),
    valor_aprox_tributos: num(totais?.vTotTrib),
    valor_total: num(totais?.vNF ?? nota.total_nota),
    transp_razao: transp?.transportadora?.razaoSocial || undefined,
    transp_frete_conta: transp?.modFrete || undefined,
    transp_codigo_antt: transp?.veiculo?.rntc || undefined,
    transp_placa: transp?.veiculo?.placa || undefined,
    transp_uf: transp?.veiculo?.uf || undefined,
    transp_cnpj_cpf: transp?.transportadora?.cnpj || undefined,
    transp_logradouro: transp?.transportadora?.endereco || undefined,
    transp_cidade: transp?.transportadora?.municipio || undefined,
    transp_ie: transp?.transportadora?.ie || undefined,
    itens: itensMapped,
    info_complementares: xmlData?.infAdic || undefined,
    ambiente: "producao",
  };
}
