/**
 * Monta DANFEData a partir da RPC montar_payload_focus — fonte única do documento fiscal.
 * Evita divergência entre preview e o que a Focus transmite.
 */
import { montarPayloadFocus } from "@/lib/fiscal-rpc";
import { supabase } from "@/integrations/supabase/client";
import type { DANFEData, DANFEItem } from "@/components/nfe/DANFEPreviewDialog";

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function str(v: unknown, fallback = ""): string {
  if (v == null) return fallback;
  return String(v);
}

function formatDataBr(v: unknown): string {
  if (!v) return "";
  const s = String(v);
  // Já formatada
  if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("pt-BR");
}

function pickEndereco(obj: any) {
  const end = obj?.endereco || obj || {};
  return {
    logradouro: str(end.logradouro || end.endereco_logradouro || end.xLgr),
    numero: str(end.numero || end.nro || end.endereco_nro || end.nro),
    bairro: str(end.bairro || end.endereco_bairro || end.xBairro),
    cidade: str(end.nome_municipio || end.municipio || end.endereco_cidade || end.xMun),
    uf: str(end.uf || end.endereco_uf || end.UF),
    cep: str(end.cep || end.endereco_cep || end.CEP),
    telefone: str(end.telefone || end.fone || end.phone),
  };
}

function mapItem(item: any, idx: number): DANFEItem {
  const rastro = item?.rastro || item?.rastros?.[0] || item?.rastreabilidade || {};
  const lote =
    str(item.numero_lote || item.lote || rastro.numero_lote || rastro.nLote) || undefined;
  const fabricacao =
    formatDataBr(item.data_fabricacao || item.fabricacao || rastro.data_fabricacao || rastro.dFab) ||
    undefined;
  const validade =
    formatDataBr(item.data_validade || item.validade || rastro.data_validade || rastro.dVal) ||
    undefined;

  // Remover lote embutido na descrição se houver coluna própria
  let descricao = str(item.descricao || item.nome || item.xProd);
  if (lote) {
    descricao = descricao
      .replace(new RegExp(`\\s*[|/]?\\s*Lote:?\\s*${lote.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^\\n]*`, "i"), "")
      .trim();
  }

  return {
    numero_item: num(item.numero_item || item.nitem || item.numero, idx + 1),
    codigo: str(item.codigo || item.codigo_produto || item.cProd) || undefined,
    descricao,
    ncm: str(item.ncm || item.NCM),
    cst_icms: str(item.cst_icms || item.cst || item.CSOSN || item.csosn || "00"),
    cfop: str(item.cfop || item.CFOP),
    unidade: str(item.unidade || item.unidade_comercial || item.uCom || "UN"),
    quantidade: num(item.quantidade || item.quantidade_comercial || item.qCom),
    valor_unitario: num(item.valor_unitario || item.valor_unitario_comercial || item.vUnCom),
    valor_total: num(item.valor_total || item.valor_bruto || item.vProd),
    icms_aliquota: num(item.icms_aliquota || item.aliquota_icms || item?.icms?.aliquota),
    icms_valor: num(item.icms_valor || item.valor_icms || item?.icms?.valor),
    ipi_valor: num(item.ipi_valor || item.valor_ipi || item?.ipi?.valor),
    ipi_aliquota: num(item.ipi_aliquota || item.aliquota_ipi || item?.ipi?.aliquota),
    origem: str(item.origem || item.origem_icms || "0"),
    lote,
    data_fabricacao: fabricacao,
    data_validade: validade,
  };
}

async function resolveLogoUrl(): Promise<string | undefined> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) return undefined;

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.company_id) return undefined;

  const { data: company } = await supabase
    .from("company")
    .select("logo_file_id")
    .eq("id", profile.company_id)
    .maybeSingle();
  if (!company?.logo_file_id) return undefined;

  const { data: arquivo } = await supabase
    .from("arquivos")
    .select("storage_key")
    .eq("id", company.logo_file_id)
    .maybeSingle();
  if (!arquivo?.storage_key) return undefined;

  const { data: signed } = await supabase.storage
    .from("erp-files")
    .createSignedUrl(arquivo.storage_key, 3600);
  return signed?.signedUrl || undefined;
}

/**
 * Fonte única: RPC montar_payload_focus + logo via storage_key.
 */
export async function buildDanfeDataFromFocus(notaSaidaId: string): Promise<DANFEData> {
  const payload = await montarPayloadFocus(notaSaidaId);
  if (!payload || typeof payload !== "object") {
    throw new Error("montar_payload_focus não retornou o documento fiscal.");
  }

  const emit = (payload as any).emitente || (payload as any).emit || {};
  const dest = (payload as any).destinatario || (payload as any).dest || {};
  const emitEnd = pickEndereco(emit);
  const destEnd = pickEndereco(dest);
  const itensRaw =
    (payload as any).items ||
    (payload as any).itens ||
    (payload as any).produtos ||
    [];

  const logo = await resolveLogoUrl();

  const dataEmissaoRaw =
    (payload as any).data_emissao ||
    (payload as any).dataEmissao ||
    (payload as any).dhEmi;
  // Sem new Date() de "agora": se a RPC não trouxer data, deixar vazio (rascunho)
  const dataEmissao = dataEmissaoRaw ? formatDataBr(dataEmissaoRaw) : "";

  const numero = (payload as any).numero ?? (payload as any).numero_nfe;
  const serie = (payload as any).serie;

  return {
    emit_razao: str(emit.razao_social || emit.nome || emit.xNome, "—"),
    emit_fantasia: str(emit.nome_fantasia || emit.xFant) || undefined,
    emit_logo_url: logo,
    emit_logradouro: emitEnd.logradouro,
    emit_numero: emitEnd.numero,
    emit_bairro: emitEnd.bairro,
    emit_cidade: emitEnd.cidade,
    emit_uf: emitEnd.uf,
    emit_cep: emitEnd.cep,
    emit_telefone: emitEnd.telefone || str(emit.telefone),
    emit_email: str(emit.email) || undefined,
    emit_cnpj: str(emit.cpf_cnpj || emit.cnpj || emit.CNPJ),
    emit_ie: str(emit.inscricao_estadual || emit.ie || emit.IE) || undefined,
    numero: numero != null && numero !== "" ? numero : undefined,
    serie: serie != null && serie !== "" ? serie : undefined,
    natureza_operacao: str(
      (payload as any).natureza_operacao || (payload as any).natOp,
      "—"
    ),
    chave_acesso: str((payload as any).chave_acesso || (payload as any).chave_nfe) || undefined,
    protocolo: str((payload as any).protocolo || (payload as any).protocolo_autorizacao) || undefined,
    data_emissao: dataEmissao || undefined,
    tipo_operacao: "1",
    dest_razao: str(dest.razao_social || dest.nome || dest.xNome) || undefined,
    dest_cnpj_cpf: str(dest.cpf_cnpj || dest.cnpj || dest.cpf || dest.CNPJ || dest.CPF) || undefined,
    dest_logradouro: destEnd.logradouro || undefined,
    dest_numero: destEnd.numero || undefined,
    dest_bairro: destEnd.bairro || undefined,
    dest_cidade: destEnd.cidade || undefined,
    dest_uf: destEnd.uf || undefined,
    dest_cep: destEnd.cep || undefined,
    dest_telefone: destEnd.telefone || undefined,
    dest_ie: str(dest.inscricao_estadual || dest.ie || dest.IE) || undefined,
    dest_data_emissao: dataEmissao || undefined,
    bc_icms: num((payload as any).valor_bc_icms ?? (payload as any).base_calculo_icms ?? (payload as any).icms_base_calculo),
    valor_icms: num((payload as any).valor_icms),
    bc_icms_st: num((payload as any).valor_bc_icms_st ?? (payload as any).icms_valor_total_st),
    valor_icms_st: num((payload as any).valor_icms_st),
    valor_produtos: num((payload as any).valor_produtos ?? (payload as any).valor_itens),
    valor_frete: num((payload as any).valor_frete),
    valor_seguro: num((payload as any).valor_seguro),
    valor_desconto: num((payload as any).valor_desconto ?? (payload as any).desconto),
    outras_despesas: num((payload as any).valor_outras_despesas ?? (payload as any).outras_despesas),
    valor_ipi: num((payload as any).valor_ipi),
    valor_aprox_tributos: num((payload as any).valor_aproximado_tributos ?? (payload as any).valor_aprox_tributos),
    valor_total: num((payload as any).valor_total ?? (payload as any).valor_nfe),
    transp_frete_conta: str(
      (payload as any).modalidade_frete ??
        (payload as any).frete_por_conta ??
        (payload as any)?.transporte?.modalidade_frete
    ) || undefined,
    transp_razao: str((payload as any)?.transportador?.razao_social || (payload as any)?.transporte?.razao_social) || undefined,
    itens: (Array.isArray(itensRaw) ? itensRaw : []).map(mapItem),
    info_complementares: str(
      (payload as any).informacoes_adicionais_contribuinte ||
        (payload as any).informacoes_adicionais ||
        (payload as any).obs
    ) || undefined,
    ambiente: String((payload as any).ambiente || "").toLowerCase().includes("prod")
      ? "producao"
      : "homologacao",
  };
}
