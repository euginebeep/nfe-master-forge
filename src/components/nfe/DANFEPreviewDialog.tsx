import { useMemo, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

interface DANFEItem {
  numero_item?: number;
  codigo_produto?: string;
  descricao: string;
  ncm: string;
  /** origem+CSOSN/CST já concatenado pela RPC — não recalcular */
  o_cst?: string;
  cst_icms: string;
  cfop: string;
  unidade: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  icms_base?: number;
  icms_aliquota: number;
  icms_valor: number;
  ipi_valor?: number;
  ipi_aliquota?: number;
  lote?: string;
  data_fabricacao?: string;
  data_validade?: string;
  informacoes_adicionais?: string;
}

interface DANFEParcela {
  numero_parcela?: number;
  data_vencimento?: string;
  valor?: number;
}

interface DANFEData {
  emit_razao: string;
  emit_fantasia?: string;
  emit_logo_url?: string;
  emit_site?: string;
  emit_logradouro?: string;
  emit_numero?: string;
  emit_complemento?: string;
  emit_bairro?: string;
  emit_cidade?: string;
  emit_uf?: string;
  emit_cep?: string;
  emit_telefone?: string;
  emit_email?: string;
  emit_cnpj: string;
  emit_ie?: string;
  emit_ie_st?: string;
  emit_im?: string;
  numero?: number | string;
  serie?: number | string;
  folha?: string;
  natureza_operacao: string;
  chave_acesso?: string;
  protocolo?: string;
  data_emissao?: string;
  data_saida_entrada?: string;
  hora_saida_entrada?: string;
  tipo_operacao?: "0" | "1";
  dest_razao?: string;
  dest_cnpj_cpf?: string;
  dest_logradouro?: string;
  dest_numero?: string;
  dest_complemento?: string;
  dest_bairro?: string;
  dest_cidade?: string;
  dest_uf?: string;
  dest_cep?: string;
  dest_telefone?: string;
  dest_ie?: string;
  dest_data_emissao?: string;
  transp_razao?: string;
  transp_frete_conta?: string;
  transp_codigo_antt?: string;
  transp_placa?: string;
  transp_uf?: string;
  transp_cnpj_cpf?: string;
  transp_logradouro?: string;
  transp_cidade?: string;
  transp_cidade_uf?: string;
  transp_ie?: string;
  bc_icms: number;
  valor_icms: number;
  bc_icms_st: number;
  valor_icms_st: number;
  valor_produtos: number;
  valor_frete: number;
  valor_seguro: number;
  valor_desconto: number;
  outras_despesas: number;
  valor_ipi: number;
  valor_aprox_tributos: number;
  valor_total: number;
  im?: string;
  valor_servicos?: number;
  bc_issqn?: number;
  valor_issqn?: number;
  itens: DANFEItem[];
  parcelas?: DANFEParcela[];
  info_complementares?: string;
  info_fisco?: string;
  ambiente?: "homologacao" | "producao";
  pode_imprimir?: boolean;
  em_contingencia?: boolean;
  contingencia_modo?: string | null;
  dh_contingencia?: string | null;
  justificativa_contingencia?: string | null;
  status?: string | null;
  /** Previsão quando ainda sem número definitivo */
  numero_previsto?: number | string | null;
  serie_prevista?: number | string | null;
}

interface DANFEPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: DANFEData | null;
}

const GRID = 24;
const Col24 = () => (
  <colgroup>
    {Array.from({ length: GRID }, (_, i) => (
      <col key={i} style={{ width: `${100 / GRID}%` }} />
    ))}
  </colgroup>
);

const tabelaBase: React.CSSProperties = {
  width: "100%",
  tableLayout: "fixed",
  borderCollapse: "collapse",
  border: "0.5pt solid #000",
};

const fmtNumeroNfeLocal = (n: number | string | null | undefined) => {
  const digits = String(n ?? "").replace(/\D/g, "");
  if (!digits) return "";
  const padded = digits.padStart(9, "0").slice(-9);
  return padded.replace(/(\d{3})(\d{3})(\d{3})/, "$1.$2.$3");
};

const ITEMS_PER_PAGE = 10;
const APP_VERSION =
  typeof __APP_VERSION__ !== "undefined" && __APP_VERSION__
    ? __APP_VERSION__
    : "6.0.0";

const fmt = (v: number) =>
  Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Quantidade: até 4 casas, sem zeros à direita */
const fmtQtd = (v: number) =>
  Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 4 });

/** Valor unitário: 2 a 4 casas */
const fmtUnit = (v: number) => {
  const n = Number(v || 0);
  const fixed = n.toFixed(4).replace(/\.?0+$/, "");
  const [intPart, dec = ""] = fixed.split(".");
  const intFmt = Number(intPart).toLocaleString("pt-BR");
  if (!dec) return `${intFmt},00`;
  if (dec.length === 1) return `${intFmt},${dec}0`;
  return `${intFmt},${dec}`;
};

const fmtData = (value?: string | null) => {
  if (!value) return "";
  const raw = String(value).trim();
  const datePart = raw.includes("T") ? raw.split("T")[0] : raw.split(" ")[0];
  const match = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : raw;
};

const fmtDataHora = (value?: string | null) => {
  if (!value) return "—";
  const raw = String(value).trim();
  try {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d.toLocaleString("pt-BR");
  } catch {
    /* ignore */
  }
  return raw;
};

const digitsOnly = (v?: string | null) => String(v || "").replace(/\D/g, "");

const fmtCnpjCpf = (v?: string | null) => {
  const d = digitsOnly(v);
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  return v || "—";
};

const fmtCep = (v?: string | null) => {
  const d = digitsOnly(v);
  if (d.length === 8) return d.replace(/^(\d{5})(\d{3})$/, "$1-$2");
  return v || "—";
};

const fmtFone = (v?: string | null) => {
  const d = digitsOnly(v);
  if (d.length === 10) return d.replace(/^(\d{2})(\d{4})(\d{4})$/, "($1) $2-$3");
  if (d.length === 11) return d.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
  return v || "";
};

const fmtChave = (v?: string | null) => {
  const d = digitsOnly(v);
  if (d.length !== 44) return v || "0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000";
  return d.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
};

/** Usa o_cst da RPC — não recalcular origem+CSOSN */
const cstColuna = (item: DANFEItem) => textFrom(item.o_cst, item.cst_icms) || "—";

const textFrom = (...values: any[]) => {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
};

export function DANFEPreviewDialog({ open, onOpenChange, data }: DANFEPreviewDialogProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const pages = useMemo(() => {
    if (!data) return [] as DANFEItem[][];
    const itens = data.itens?.length ? data.itens : [];
    if (itens.length === 0) return [[]];
    const chunks: DANFEItem[][] = [];
    for (let i = 0; i < itens.length; i += ITEMS_PER_PAGE) {
      chunks.push(itens.slice(i, i + ITEMS_PER_PAGE));
    }
    return chunks;
  }, [data]);

  const totalPages = pages.length || 1;
  const podeImprimir = data?.pode_imprimir === true;
  const isRascunhoSemValor =
    !podeImprimir ||
    !data?.status ||
    ["RASCUNHO", "PROCESSANDO", "REJEITADO", "REJEITADA"].includes(String(data.status).toUpperCase());
  const emContingencia = !!data?.em_contingencia;
  const isHomolog = data?.ambiente === "homologacao";

  const handlePrint = () => {
    if (!printRef.current || !podeImprimir) return;
    const style = document.createElement("style");
    style.setAttribute("data-danfe-print", "true");
    style.textContent = `
      @media print {
        @page { size: A4 portrait; margin: 5mm; }
        body > *:not([data-danfe-print-root]) { display: none !important; }
        [data-danfe-print-root] {
          display: block !important;
          position: fixed;
          top: 0;
          left: 0;
          width: 200mm !important;
          transform: none !important;
          z-index: 99999;
          background: #fff;
        }
        [data-danfe-print-root] * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .danfe { width: 200mm; font-size: 8pt; }
        .danfe td, .danfe th { border: 0.5pt solid #000; padding: 1pt 2pt; }
        .no-print { display: none !important; }
        .danfe-page { page-break-after: always; }
        .danfe-page:last-child { page-break-after: auto; }
        table { page-break-inside: auto; }
        tr { page-break-inside: avoid; }
        thead { display: table-header-group; }
      }
    `;
    document.head.appendChild(style);
    const wrapper = document.createElement("div");
    wrapper.setAttribute("data-danfe-print-root", "true");
    wrapper.innerHTML = printRef.current.innerHTML;
    document.body.appendChild(wrapper);
    window.print();
    document.head.removeChild(style);
    document.body.removeChild(wrapper);
  };

  if (!data) return null;

  const renderItemDescricao = (item: DANFEItem) => (
    <div>
      <div>{item.descricao}</div>
      {(item.lote || item.data_fabricacao || item.data_validade) && (
        <div style={{ fontSize: "6pt", marginTop: "1px" }}>
          {item.lote && <>Lote: {item.lote}</>}
          {item.data_fabricacao && <> Fab: {fmtData(item.data_fabricacao)}</>}
          {item.data_validade && <> Val: {fmtData(item.data_validade)}</>}
        </div>
      )}
      {item.informacoes_adicionais && (
        <div style={{ fontSize: "5.5pt", color: "#333", marginTop: "1px" }}>{item.informacoes_adicionais}</div>
      )}
    </div>
  );

  const renderWatermarks = () => {
    const text = emContingencia
      ? "DANFE em Contingência"
      : isRascunhoSemValor
        ? "SEM VALOR FISCAL — DOCUMENTO NÃO TRANSMITIDO"
        : isHomolog
          ? "SEM VALOR FISCAL"
          : null;
    if (!text) return null;
    return (
      <div style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
        zIndex: 0,
        overflow: "hidden",
      }}>
        <div style={{
          transform: "rotate(-35deg)",
          fontSize: "36pt",
          fontWeight: 700,
          letterSpacing: "6px",
          color: "rgba(220, 38, 38, 0.07)",
          whiteSpace: "nowrap",
          WebkitPrintColorAdjust: "exact",
          printColorAdjust: "exact",
        } as React.CSSProperties}>
          {text}
        </div>
      </div>
    );
  };

  const renderCanhoto = () => (
    <table className="danfe" style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #000", marginBottom: "2mm" }}>
      <tbody>
        <tr>
          <td colSpan={3} style={{ ...cellStyle, fontSize: "6.5pt", padding: "2px 4px", minHeight: "7mm" }}>
            RECEBEMOS DE <b>{data.emit_razao}</b> OS PRODUTOS/SERVIÇOS CONSTANTES NA NOTA FISCAL INDICADA AO LADO. EMISSÃO: <b>{data.data_emissao || "—"}</b>
          </td>
          <td rowSpan={2} style={{ ...cellStyle, textAlign: "center", width: "120px", verticalAlign: "top", padding: "2px" }}>
            <div style={{ fontWeight: 700, fontSize: "9pt" }}>NF-e</div>
            <div style={{ fontSize: "8pt" }}>Nº: {data.numero || "000.000.000"}</div>
            <div style={{ fontSize: "7pt" }}>SÉRIE: {data.serie || "1"}</div>
          </td>
        </tr>
        <tr>
          <td style={{ ...cellStyle, width: "30%", fontSize: "6pt", minHeight: "7mm" }}>DATA DE RECEBIMENTO</td>
          <td style={{ ...cellStyle, width: "30%", fontSize: "6pt" }}>IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR</td>
          <td style={{ ...cellStyle, fontSize: "6pt" }}>
            DESTINATÁRIO<br /><b style={{ fontSize: "7pt" }}>{data.dest_razao || "—"}</b>
          </td>
        </tr>
      </tbody>
    </table>
  );

  const emitEnderecoLinha = [
    data.emit_logradouro,
    data.emit_numero,
  ].filter(Boolean).join(", ")
    + (data.emit_complemento ? ` - ${data.emit_complemento}` : "");

  const destEnderecoLinha = [
    data.dest_logradouro,
    data.dest_numero,
  ].filter(Boolean).join(", ")
    + (data.dest_complemento ? ` - ${data.dest_complemento}` : "");

  const numeroDefinitivo = data.numero != null && String(data.numero).trim() !== ""
    ? fmtNumeroNfeLocal(data.numero)
    : "";
  const numeroPrevisto = !numeroDefinitivo && data.numero_previsto != null
    ? fmtNumeroNfeLocal(data.numero_previsto)
    : "";
  const serieExibida = data.serie || data.serie_prevista || "1";

  const renderHeader = (pageIdx: number) => (
    <table className="danfe" style={{ ...tabelaBase }}>
      <Col24 />
      <tbody>
        <tr>
          <td colSpan={11} style={{ ...cellStyle, verticalAlign: "top", padding: "3mm 2mm" }}>
            <div style={{ display: "flex", gap: "3mm", alignItems: "flex-start" }}>
              {data.emit_logo_url && (
                <img
                  src={data.emit_logo_url}
                  alt=""
                  style={{ height: "18mm", maxWidth: "28mm", objectFit: "contain", flexShrink: 0 }}
                />
              )}
              <div style={{ fontSize: "6.5pt", lineHeight: 1.35, position: "relative", zIndex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: "8pt" }}>{data.emit_razao}</div>
                {data.emit_fantasia && <div style={{ fontWeight: 600 }}>{data.emit_fantasia}</div>}
                {emitEnderecoLinha && <div>{emitEnderecoLinha}</div>}
                {data.emit_bairro && <div>{data.emit_bairro}</div>}
                {(data.emit_cidade || data.emit_uf) && (
                  <div>{data.emit_cidade}{data.emit_uf ? `-${data.emit_uf}` : ""}</div>
                )}
                {data.emit_cep && <div>{fmtCep(data.emit_cep)}</div>}
                {data.emit_telefone && <div>Fone: {fmtFone(data.emit_telefone)}</div>}
              </div>
            </div>
          </td>
          <td colSpan={5} style={{ ...cellStyle, verticalAlign: "top", textAlign: "center", padding: "4px" }}>
            <div style={{ fontWeight: 700, fontSize: "13pt", letterSpacing: "3px" }}>DANFE</div>
            <div style={{ fontSize: "6pt", lineHeight: 1.3, margin: "2px 0" }}>
              DOCUMENTO AUXILIAR<br />DA NOTA FISCAL<br />ELETRÔNICA
            </div>
            <div style={{ fontSize: "7pt", margin: "3px 0" }}>
              {data.tipo_operacao === "0" ? <><b>0 - ENTRADA</b> &nbsp; 1 - SAÍDA</> : <>0 - ENTRADA &nbsp; <b>1 - SAÍDA</b></>}
            </div>
            <div style={{ fontSize: "7.5pt" }}>
              {numeroDefinitivo ? (
                <>Nº <b>{numeroDefinitivo}</b><br />SÉRIE: <b>{serieExibida}</b></>
              ) : (
                <>
                  Nº{" "}
                  <b title="Previsão. O número definitivo é atribuído na transmissão.">
                    {numeroPrevisto || "—"}{numeroPrevisto ? <sup>*</sup> : null}
                  </b>
                  <br />SÉRIE: <b>{serieExibida}</b>
                  {numeroPrevisto && <div style={{ fontSize: "5pt", color: "#666" }}>* número previsto</div>}
                </>
              )}
              <br />FOLHAS {pageIdx + 1}/{totalPages}
            </div>
          </td>
          <td colSpan={8} style={{ ...cellStyle, verticalAlign: "top", padding: "4px" }}>
            <div style={{
              height: "40px",
              background: "repeating-linear-gradient(90deg, #000 0px, #000 1px, #fff 1px, #fff 3px)",
              marginBottom: "4px",
              opacity: 0.4,
            }} />
            <div style={{ fontSize: "6pt", textAlign: "center" }}>
              <b>CHAVE DE ACESSO</b><br />
              <span style={{ fontFamily: "'Courier New', monospace", fontSize: "7.5pt", letterSpacing: "0.5px" }}>
                {fmtChave(data.chave_acesso)}
              </span>
            </div>
            <div style={{ fontSize: "5.5pt", textAlign: "center", marginTop: "3px", color: "#444" }}>
              {emContingencia
                ? "DANFE em Contingência — impresso em decorrência de problemas técnicos"
                : <>Consulta de autenticidade no portal nacional da NF-e<br />www.nfe.fazenda.gov.br/portal</>}
            </div>
            {emContingencia && (
              <div style={{ fontSize: "5.5pt", marginTop: "3px", textAlign: "left" }}>
                {data.contingencia_modo && <div><b>Modo:</b> {data.contingencia_modo}</div>}
                <div><b>dhContingência:</b> {fmtDataHora(data.dh_contingencia)}</div>
                <div><b>Justificativa:</b> {data.justificativa_contingencia || "—"}</div>
              </div>
            )}
          </td>
        </tr>
      </tbody>
    </table>
  );

  const renderFooter = () => (
    <div style={{
      marginTop: "3mm",
      textAlign: "center",
      fontSize: "5pt",
      color: "#666",
      fontFamily: "Arial, Helvetica, sans-serif",
      position: "relative",
      zIndex: 1,
    }}>
      Documento gerado com www.brainxerp.com — versão {APP_VERSION}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[820px] max-h-[95vh] overflow-y-auto p-2">
        <DialogHeader className="flex flex-row items-center justify-between no-print px-2 pt-2">
          <DialogTitle className="text-base">
            {podeImprimir ? "Pré-visualização DANFE" : "Pré-visualização DANFE — Sem valor fiscal"}
          </DialogTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handlePrint} disabled={!podeImprimir} title={!podeImprimir ? "Impressão liberada somente após autorização" : undefined}>
              <Printer className="h-4 w-4 mr-1" /> Imprimir
            </Button>
          </div>
        </DialogHeader>

        <div ref={printRef}>
          {pages.map((pageItens, pageIdx) => (
            <div
              key={`page-${pageIdx}`}
              className="danfe-page"
              style={{
                width: "200mm",
                transform: "scale(0.98)",
                transformOrigin: "top left",
                fontFamily: "Arial, Helvetica, sans-serif",
                fontSize: "7.5pt",
                color: "#000",
                background: "#fff",
                margin: "0 auto",
                padding: "2mm",
                lineHeight: 1.3,
                position: "relative",
                pageBreakAfter: pageIdx < totalPages - 1 ? "always" : "auto",
              }}
            >
              {renderWatermarks()}
              <div style={{ position: "relative", zIndex: 1 }}>
                {pageIdx === 0 && renderCanhoto()}
                {renderHeader(pageIdx)}

                {pageIdx === 0 && (
                  <>
                    <table className="danfe" style={{ ...tabelaBase, borderTop: "none" }}>
                      <Col24 />
                      <tbody>
                        <tr>
                          <td colSpan={14} style={{ ...cellStyle, minHeight: "7mm" }}>
                            <LabelValue label="NATUREZA DA OPERAÇÃO" value={data.natureza_operacao} />
                          </td>
                          <td colSpan={10} style={{ ...cellStyle, minHeight: "7mm" }}>
                            <LabelValue label="PROTOCOLO DE AUTORIZAÇÃO DE USO" value={data.protocolo || "RASCUNHO — Aguardando transmissão"} />
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    <table className="danfe" style={{ ...tabelaBase, borderTop: "none" }}>
                      <Col24 />
                      <tbody>
                        <tr>
                          <td colSpan={9} style={{ ...cellStyle, minHeight: "7mm" }}>
                            <LabelValue label="INSCRIÇÃO ESTADUAL" value={data.emit_ie || "—"} />
                          </td>
                          <td colSpan={8} style={{ ...cellStyle, minHeight: "7mm" }}>
                            <LabelValue label="INSCRIÇÃO ESTADUAL DO SUBST. TRIBUTÁRIO" value={data.emit_ie_st || "—"} />
                          </td>
                          <td colSpan={7} style={{ ...cellStyle, minHeight: "7mm" }}>
                            <LabelValue label="CNPJ" value={fmtCnpjCpf(data.emit_cnpj)} />
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    <SectionTitle text="DESTINATÁRIO/REMETENTE" />
                    <table className="danfe" style={{ ...tabelaBase, borderTop: "none" }}>
                      <Col24 />
                      <tbody>
                        <tr>
                          <td colSpan={13} style={{ ...cellStyle, minHeight: "7mm" }}>
                            <LabelValue label="NOME/RAZÃO SOCIAL" value={data.dest_razao || "—"} />
                          </td>
                          <td colSpan={6} style={{ ...cellStyle, minHeight: "7mm" }}>
                            <LabelValue label="CNPJ/CPF" value={fmtCnpjCpf(data.dest_cnpj_cpf)} />
                          </td>
                          <td colSpan={5} style={{ ...cellStyle, minHeight: "7mm" }}>
                            <LabelValue label="DATA DA EMISSÃO" value={data.dest_data_emissao || data.data_emissao || "—"} />
                          </td>
                        </tr>
                        <tr>
                          <td colSpan={13} style={{ ...cellStyle, minHeight: "7mm" }}>
                            <LabelValue label="ENDEREÇO" value={destEnderecoLinha || "—"} />
                          </td>
                          <td colSpan={4} style={{ ...cellStyle, minHeight: "7mm" }}>
                            <LabelValue label="BAIRRO/DISTRITO" value={data.dest_bairro || "—"} />
                          </td>
                          <td colSpan={3} style={{ ...cellStyle, minHeight: "7mm" }}>
                            <LabelValue label="CEP" value={fmtCep(data.dest_cep)} />
                          </td>
                          <td colSpan={4} style={{ ...cellStyle, minHeight: "7mm" }}>
                            <LabelValue label="DATA DE SAÍDA/ENTRADA" value={data.data_saida_entrada || "—"} />
                          </td>
                        </tr>
                        <tr>
                          <td colSpan={9} style={{ ...cellStyle, minHeight: "7mm" }}>
                            <LabelValue label="MUNICÍPIO" value={data.dest_cidade || "—"} />
                          </td>
                          <td colSpan={4} style={{ ...cellStyle, minHeight: "7mm" }}>
                            <LabelValue label="FONE/FAX" value={fmtFone(data.dest_telefone) || "—"} />
                          </td>
                          <td colSpan={2} style={{ ...cellStyle, minHeight: "7mm" }}>
                            <LabelValue label="UF" value={data.dest_uf || "—"} />
                          </td>
                          <td colSpan={5} style={{ ...cellStyle, minHeight: "7mm" }}>
                            <LabelValue label="INSCRIÇÃO ESTADUAL" value={data.dest_ie || "—"} />
                          </td>
                          <td colSpan={4} style={{ ...cellStyle, minHeight: "7mm" }}>
                            <LabelValue label="HORA DE SAÍDA" value={data.hora_saida_entrada || "—"} />
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    <SectionTitle text="FATURA / DUPLICATA" />
                    <div style={{ border: "0.5pt solid #000", borderTop: "none", minHeight: "8mm", padding: "2px 4px", fontSize: "6.5pt" }}>
                      {(data.parcelas || []).length > 0 ? (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                          {(data.parcelas || []).map((p, i) => (
                            <span key={i} style={{ fontFamily: "'Courier New', monospace" }}>
                              {String(p.numero_parcela ?? i + 1).padStart(3, "0")}
                              {" | "}
                              VENCIMENTO {fmtData(p.data_vencimento) || "—"}
                              {" | "}
                              VALOR R$ {fmt(Number(p.valor || 0))}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ color: "#666" }}>—</span>
                      )}
                    </div>

                    <SectionTitle text="CALCULO DO IMPOSTO" />
                    <table className="danfe" style={{ ...tabelaBase, borderTop: "none" }}>
                      <Col24 />
                      <tbody>
                        <tr>
                          <td colSpan={5} style={{ ...cellStyle, minHeight: "7mm" }}><LabelValue label="BASE DE CÁLCULO DO ICMS" value={fmt(data.bc_icms)} /></td>
                          <td colSpan={4} style={{ ...cellStyle, minHeight: "7mm" }}><LabelValue label="VALOR DO ICMS" value={fmt(data.valor_icms)} /></td>
                          <td colSpan={5} style={{ ...cellStyle, minHeight: "7mm" }}><LabelValue label="BASE DE CÁLCULO DO ICMS ST" value={fmt(data.bc_icms_st)} /></td>
                          <td colSpan={5} style={{ ...cellStyle, minHeight: "7mm" }}><LabelValue label="VALOR DO ICMS ST" value={fmt(data.valor_icms_st)} /></td>
                          <td colSpan={5} style={{ ...cellStyle, minHeight: "7mm" }}><LabelValue label="VALOR TOTAL DOS PRODUTOS" value={fmt(data.valor_produtos)} /></td>
                        </tr>
                        <tr>
                          <td colSpan={4} style={{ ...cellStyle, minHeight: "7mm" }}><LabelValue label="VALOR DO FRETE" value={fmt(data.valor_frete)} /></td>
                          <td colSpan={4} style={{ ...cellStyle, minHeight: "7mm" }}><LabelValue label="VALOR DO SEGURO" value={fmt(data.valor_seguro)} /></td>
                          <td colSpan={4} style={{ ...cellStyle, minHeight: "7mm" }}><LabelValue label="DESCONTO" value={fmt(data.valor_desconto)} /></td>
                          <td colSpan={4} style={{ ...cellStyle, minHeight: "7mm" }}><LabelValue label="OUTRAS DESPESAS ACESSÓRIAS" value={fmt(data.outras_despesas)} /></td>
                          <td colSpan={4} style={{ ...cellStyle, minHeight: "7mm" }}><LabelValue label="VALOR DO IPI" value={fmt(data.valor_ipi)} /></td>
                          <td colSpan={4} style={{ ...cellStyle, minHeight: "7mm" }}><LabelValue label="VALOR TOTAL DA NOTA" value={fmt(data.valor_total)} bold /></td>
                        </tr>
                      </tbody>
                    </table>

                    <SectionTitle text="CALCULO DO ISSQN" />
                    <table className="danfe" style={{ ...tabelaBase, borderTop: "none" }}>
                      <Col24 />
                      <tbody>
                        <tr>
                          <td colSpan={6} style={{ ...cellStyle, minHeight: "7mm" }}><LabelValue label="INSCRIÇÃO MUNICIPAL" value={data.im || data.emit_im || "—"} /></td>
                          <td colSpan={6} style={{ ...cellStyle, minHeight: "7mm" }}><LabelValue label="VALOR TOTAL DOS SERVIÇOS" value={fmt(data.valor_servicos ?? 0)} /></td>
                          <td colSpan={6} style={{ ...cellStyle, minHeight: "7mm" }}><LabelValue label="BASE DE CÁLCULO DO ISSQN" value={fmt(data.bc_issqn ?? 0)} /></td>
                          <td colSpan={6} style={{ ...cellStyle, minHeight: "7mm" }}><LabelValue label="VALOR DO ISSQN" value={fmt(data.valor_issqn ?? 0)} /></td>
                        </tr>
                      </tbody>
                    </table>

                    <SectionTitle text="TRANSPORTADOR/VOLUMES TRANSPORTADOS" />
                    <table className="danfe" style={{ ...tabelaBase, borderTop: "none" }}>
                      <Col24 />
                      <tbody>
                        <tr>
                          <td colSpan={8} style={{ ...cellStyle, minHeight: "7mm" }}><LabelValue label="RAZÃO SOCIAL" value={data.transp_razao || "—"} /></td>
                          <td colSpan={4} style={{ ...cellStyle, minHeight: "7mm" }}><LabelValue label="FRETE POR CONTA" value={data.transp_frete_conta || "—"} /></td>
                          <td colSpan={3} style={{ ...cellStyle, minHeight: "7mm" }}><LabelValue label="CÓDIGO ANTT" value={data.transp_codigo_antt || "—"} /></td>
                          <td colSpan={4} style={{ ...cellStyle, minHeight: "7mm" }}><LabelValue label="PLACA DO VEÍC." value={data.transp_placa || "—"} /></td>
                          <td colSpan={1} style={{ ...cellStyle, minHeight: "7mm" }}><LabelValue label="UF" value={data.transp_uf || "—"} /></td>
                          <td colSpan={4} style={{ ...cellStyle, minHeight: "7mm" }}><LabelValue label="CNPJ/CPF" value={fmtCnpjCpf(data.transp_cnpj_cpf)} /></td>
                        </tr>
                        <tr>
                          <td colSpan={8} style={{ ...cellStyle, minHeight: "7mm" }}><LabelValue label="ENDEREÇO" value={data.transp_logradouro || "—"} /></td>
                          <td colSpan={11} style={{ ...cellStyle, minHeight: "7mm" }}><LabelValue label="MUNICÍPIO" value={data.transp_cidade || "—"} /></td>
                          <td colSpan={1} style={{ ...cellStyle, minHeight: "7mm" }}><LabelValue label="UF" value={data.transp_cidade_uf || "—"} /></td>
                          <td colSpan={4} style={{ ...cellStyle, minHeight: "7mm" }}><LabelValue label="INSCRIÇÃO ESTADUAL" value={data.transp_ie || "—"} /></td>
                        </tr>
                      </tbody>
                    </table>
                  </>
                )}

                <SectionTitle text="DADOS DO PRODUTO/SERVIÇO" />
                <table
                  className="danfe"
                  style={{
                    width: "100%",
                    tableLayout: "fixed",
                    borderCollapse: "collapse",
                    border: "1px solid #000",
                    borderTop: "none",
                    fontSize: "6.5pt",
                  }}
                >
                  <colgroup>
                    <col style={{ width: "7%" }} />
                    <col style={{ width: "26%" }} />
                    <col style={{ width: "8%" }} />
                    <col style={{ width: "4%" }} />
                    <col style={{ width: "5%" }} />
                    <col style={{ width: "5%" }} />
                    <col style={{ width: "6%" }} />
                    <col style={{ width: "8%" }} />
                    <col style={{ width: "8%" }} />
                    <col style={{ width: "8%" }} />
                    <col style={{ width: "7%" }} />
                    <col style={{ width: "5%" }} />
                    <col style={{ width: "4%" }} />
                    <col style={{ width: "4%" }} />
                  </colgroup>
                  <thead>
                    <tr style={{ background: "#f5f5f5" }}>
                      <th style={thStyle}>CÓD. PROD.</th>
                      <th style={{ ...thStyle, textAlign: "left" }}>DESCRIÇÃO DO PRODUTO/SERVIÇO</th>
                      <th style={thStyle}>NCM/SH</th>
                      <th style={thStyle}>O/CST</th>
                      <th style={thStyle}>CFOP</th>
                      <th style={thStyle}>UNID.</th>
                      <th style={thNum}>QUANT.</th>
                      <th style={thNum}>VLR. UNIT.</th>
                      <th style={thNum}>VLR. TOTAL</th>
                      <th style={thNum}>BC ICMS</th>
                      <th style={thNum}>VLR. ICMS</th>
                      <th style={thNum}>VLR. IPI</th>
                      <th style={thNum}>ALÍQ.<br />ICMS</th>
                      <th style={thNum}>ALÍQ.<br />IPI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageItens.map((item, idx) => (
                      <tr key={`${pageIdx}-${idx}`}>
                        <td style={tdStyle}>{item.codigo_produto || item.numero_item || idx + 1}</td>
                        <td style={tdText}>{renderItemDescricao(item)}</td>
                        <td style={tdStyle}>{item.ncm}</td>
                        <td style={tdStyle}>{cstColuna(item)}</td>
                        <td style={tdStyle}>{item.cfop}</td>
                        <td style={tdStyle}>{item.unidade}</td>
                        <td style={tdNum}>{fmtQtd(item.quantidade)}</td>
                        <td style={tdNum}>{fmtUnit(item.valor_unitario)}</td>
                        <td style={tdNum}>{fmt(item.valor_total)}</td>
                        <td style={tdNum}>{fmt(item.icms_base ?? 0)}</td>
                        <td style={tdNum}>{fmt(item.icms_valor)}</td>
                        <td style={tdNum}>{fmt(item.ipi_valor || 0)}</td>
                        <td style={tdNum}>{fmt(item.icms_aliquota)}</td>
                        <td style={tdNum}>{fmt(item.ipi_aliquota || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {pageIdx === totalPages - 1 && (
                  <>
                    <SectionTitle text="DADOS ADICIONAIS" />
                    <table className="danfe" style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #000", borderTop: "none" }}>
                      <tbody>
                        <tr>
                          <td style={{ ...cellStyle, width: "50%", verticalAlign: "top", minHeight: "30mm" }}>
                            <div style={{ fontSize: "5.5pt", color: "#333", marginBottom: "2px" }}>INFORMAÇÕES COMPLEMENTARES</div>
                            <div style={{ fontSize: "6.5pt", whiteSpace: "pre-wrap", minHeight: "20mm" }}>
                              {data.info_complementares || ""}
                              {isHomolog && "\nNF-E EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO - SEM VALOR FISCAL"}
                            </div>
                          </td>
                          <td style={{ ...cellStyle, width: "50%", verticalAlign: "top" }}>
                            <div style={{ fontSize: "5.5pt", color: "#333", marginBottom: "2px" }}>RESERVADO AO FISCO</div>
                            <div style={{ fontSize: "6.5pt", minHeight: "20mm" }}>{data.info_fisco || ""}</div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </>
                )}

                {renderFooter()}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

const cellStyle: React.CSSProperties = {
  border: "1px solid #000",
  padding: "1px 4px",
  verticalAlign: "top",
  fontSize: "7pt",
};

const thStyle: React.CSSProperties = {
  border: "0.5pt solid #000",
  padding: "1pt 2pt",
  textAlign: "center",
  fontWeight: 600,
  fontSize: "5.5pt",
  lineHeight: 1.1,
  wordBreak: "break-word",
  whiteSpace: "normal",
  verticalAlign: "middle",
};

const thNum: React.CSSProperties = {
  ...thStyle,
  textAlign: "right",
};

const tdStyle: React.CSSProperties = {
  border: "0.5pt solid #000",
  padding: "1pt 2pt",
  textAlign: "center",
  fontSize: "6.5pt",
  fontFamily: "'Courier New', monospace",
  lineHeight: 1.15,
  wordBreak: "break-word",
  verticalAlign: "top",
};

const tdText: React.CSSProperties = {
  ...tdStyle,
  textAlign: "left",
  fontFamily: "Arial, Helvetica, sans-serif",
  fontSize: "6pt",
};

const tdNum: React.CSSProperties = {
  ...tdStyle,
  textAlign: "right",
};

function LabelValue({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div>
      <span style={{ fontSize: "5.5pt", color: "#333", fontWeight: 400, lineHeight: 1.1, display: "block" }}>{label}</span>
      <span style={{ fontSize: "7.5pt", fontWeight: bold ? 700 : 500, lineHeight: 1.2, display: "block", color: "#000" }}>{value}</span>
    </div>
  );
}

function SectionTitle({ text }: { text: string }) {
  return (
    <div style={{
      border: "1px solid #000",
      borderBottom: "none",
      padding: "1px 4px",
      fontSize: "6pt",
      fontWeight: 700,
      textTransform: "uppercase",
      background: "#f0f0f0",
    }}>
      {text}
    </div>
  );
}
