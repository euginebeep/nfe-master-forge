import { useMemo, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

interface DANFEItem {
  numero_item?: number;
  codigo_produto?: string;
  descricao: string;
  ncm: string;
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
  origem?: string;
  rastros?: {
    numero_lote?: string;
    quantidade_lote?: number;
    data_fabricacao?: string;
    data_validade?: string;
  }[];
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
  // ISSQN (obrigatório no DANFE mesmo zerado)
  im?: string;
  valor_servicos?: number;
  bc_issqn?: number;
  valor_issqn?: number;
  itens: DANFEItem[];
  parcelas?: DANFEParcela[];
  info_complementares?: string;
  info_fisco?: string;
  ambiente?: "homologacao" | "producao";
  /** false = rascunho/não autorizado — marca d'água + impressão bloqueada */
  pode_imprimir?: boolean;
  em_contingencia?: boolean;
  contingencia_modo?: string | null;
  dh_contingencia?: string | null;
  justificativa_contingencia?: string | null;
  status?: string | null;
}

interface DANFEPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: DANFEData | null;
}

const ITEMS_PER_PAGE = 8;
const APP_VERSION =
  typeof __APP_VERSION__ !== "undefined" && __APP_VERSION__
    ? __APP_VERSION__
    : "6.0.0";

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtQtd = (v: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 4 });

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

/** CST no DANFE = origem (1 dígito) + CSOSN/CST concatenados — ex.: 0900 */
const cstColuna = (item: DANFEItem) => {
  const origem = String(item.origem ?? "0").replace(/\D/g, "").slice(-1) || "0";
  const cst = String(item.cst_icms || "").replace(/\D/g, "");
  return `${origem}${cst}`;
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
          width: 100%;
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

  const renderRastros = (item: DANFEItem) => {
    const rastros = item.rastros?.filter((rastro) =>
      rastro.numero_lote || rastro.data_fabricacao || rastro.data_validade
    ) || [];

    if (rastros.length === 0) return "—";

    return rastros.map((rastro, idx) => (
      <div key={`${rastro.numero_lote || "lote"}-${idx}`} style={{ marginBottom: idx < rastros.length - 1 ? "2px" : 0 }}>
        {rastro.numero_lote && <div><b>Lote:</b> {rastro.numero_lote}</div>}
        {rastro.data_fabricacao && <div><b>Fab:</b> {fmtData(rastro.data_fabricacao)}</div>}
        {rastro.data_validade && <div><b>Val:</b> {fmtData(rastro.data_validade)}</div>}
      </div>
    ));
  };

  const renderWatermarks = () => (
    <>
      {isRascunhoSemValor && (
        <div style={{
          position: "absolute",
          top: "45%",
          left: "50%",
          transform: "translate(-50%, -50%) rotate(-32deg)",
          fontSize: "22pt",
          fontWeight: "bold",
          color: "rgba(180,0,0,0.18)",
          whiteSpace: "nowrap",
          letterSpacing: "2px",
          pointerEvents: "none",
          zIndex: 20,
          WebkitPrintColorAdjust: "exact",
          printColorAdjust: "exact",
        } as React.CSSProperties}>
          SEM VALOR FISCAL — DOCUMENTO NÃO TRANSMITIDO
        </div>
      )}
      {emContingencia && (
        <div style={{
          position: "absolute",
          top: "62%",
          left: "50%",
          transform: "translate(-50%, -50%) rotate(-32deg)",
          fontSize: "28pt",
          fontWeight: "bold",
          color: "rgba(120,80,0,0.16)",
          whiteSpace: "nowrap",
          letterSpacing: "3px",
          pointerEvents: "none",
          zIndex: 20,
          WebkitPrintColorAdjust: "exact",
          printColorAdjust: "exact",
        } as React.CSSProperties}>
          DANFE em Contingência
        </div>
      )}
      {isHomolog && !isRascunhoSemValor && (
        <div style={{
          position: "absolute",
          top: "30%",
          left: "50%",
          transform: "translateX(-50%) rotate(-30deg)",
          fontSize: "40pt",
          fontWeight: "bold",
          color: "rgba(200,0,0,0.12)",
          whiteSpace: "nowrap",
          letterSpacing: "8px",
          pointerEvents: "none",
          zIndex: 10,
        }}>
          SEM VALOR FISCAL
        </div>
      )}
    </>
  );

  const renderCanhoto = () => (
    <table className="danfe" style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #000", marginBottom: "2mm" }}>
      <tbody>
        <tr>
          <td colSpan={3} style={{ ...cellStyle, fontSize: "6.5pt", padding: "2px 4px" }}>
            RECEBEMOS DE <b>{data.emit_razao}</b> OS PRODUTOS/SERVIÇOS CONSTANTES NA NOTA FISCAL INDICADA AO LADO. EMISSÃO: <b>{data.data_emissao || "—"}</b>
          </td>
          <td rowSpan={2} style={{ ...cellStyle, textAlign: "center", width: "120px", verticalAlign: "top", padding: "2px" }}>
            <div style={{ fontWeight: "bold", fontSize: "9pt" }}>NF-e</div>
            <div style={{ fontSize: "8pt" }}>Nº: {data.numero || "000.000.000"}</div>
            <div style={{ fontSize: "7pt" }}>SÉRIE: {data.serie || "1"}</div>
          </td>
        </tr>
        <tr>
          <td style={{ ...cellStyle, width: "30%", fontSize: "6pt" }}>DATA DE RECEBIMENTO</td>
          <td style={{ ...cellStyle, width: "30%", fontSize: "6pt" }}>IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR</td>
          <td style={{ ...cellStyle, fontSize: "6pt" }}>
            DESTINATÁRIO<br /><b style={{ fontSize: "7pt" }}>{data.dest_razao || "—"}</b>
          </td>
        </tr>
      </tbody>
    </table>
  );

  const renderHeader = (pageIdx: number) => (
    <table className="danfe" style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #000" }}>
      <tbody>
        <tr>
          <td style={{ ...cellStyle, width: "40%", verticalAlign: "top", padding: "4px 6px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "6px" }}>
              {data.emit_logo_url && (
                <img src={data.emit_logo_url} alt="Logo" style={{ maxHeight: "50px", maxWidth: "80px", objectFit: "contain" }} />
              )}
              <div>
                <div style={{ fontWeight: "bold", fontSize: "10pt", marginBottom: "2px" }}>
                  {data.emit_razao}
                </div>
                <div style={{ fontSize: "6.5pt", lineHeight: 1.4 }}>
                  {data.emit_logradouro && <>{data.emit_logradouro}{data.emit_numero ? `, ${data.emit_numero}` : ""}<br /></>}
                  {data.emit_bairro && <>{data.emit_bairro} – {data.emit_cidade} – {data.emit_uf}<br /></>}
                  {data.emit_cep && <>CEP: {data.emit_cep}<br /></>}
                  {data.emit_telefone && <>FONE: {data.emit_telefone}<br /></>}
                  {data.emit_site && <>{data.emit_site}<br /></>}
                </div>
              </div>
            </div>
          </td>
          <td style={{ ...cellStyle, width: "25%", verticalAlign: "top", textAlign: "center", padding: "4px" }}>
            <div style={{ fontWeight: "bold", fontSize: "12pt", letterSpacing: "2px" }}>DANFE</div>
            <div style={{ fontSize: "6pt", lineHeight: 1.3, margin: "2px 0" }}>
              DOCUMENTO AUXILIAR<br />DA NOTA FISCAL<br />ELETRÔNICA
            </div>
            <div style={{ fontSize: "7pt", margin: "3px 0" }}>
              {data.tipo_operacao === "0" ? "0 - Entrada" : "1 - Saída"}
            </div>
            <div style={{ fontSize: "7.5pt" }}>
              Nº <b>{data.numero || "000.000.000"}</b><br />
              SÉRIE: <b>{data.serie || "1"}</b><br />
              FOLHAS {pageIdx + 1}/{totalPages}
            </div>
          </td>
          <td style={{ ...cellStyle, width: "35%", verticalAlign: "top", padding: "4px" }}>
            <div style={{
              height: "40px",
              background: "repeating-linear-gradient(90deg, #000 0px, #000 1px, #fff 1px, #fff 3px)",
              marginBottom: "4px",
              opacity: 0.4,
            }} />
            <div style={{ fontSize: "6pt", textAlign: "center" }}>
              <b>CHAVE DE ACESSO</b><br />
              <span style={{ fontFamily: "monospace", fontSize: "7pt", letterSpacing: "1px" }}>
                {data.chave_acesso || "0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000"}
              </span>
            </div>
            <div style={{ fontSize: "5.5pt", textAlign: "center", marginTop: "3px", color: "#444" }}>
              {emContingencia
                ? "DANFE em Contingência — impresso em decorrência de problemas técnicos"
                : <>Consulta de autenticidade no portal nacional da NF-e<br />www.nfe.fazenda.gov.br/portal</>}
            </div>
            {emContingencia && (
              <div style={{ fontSize: "5.5pt", marginTop: "3px", textAlign: "left" }}>
                <div><b>Modo:</b> {data.contingencia_modo || "—"}</div>
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
    }}>
      Documento gerado com www.brainxerp.com — versão {APP_VERSION}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[900px] max-h-[95vh] overflow-y-auto p-4">
        <DialogHeader className="flex flex-row items-center justify-between no-print">
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
                fontFamily: "Arial, Helvetica, sans-serif",
                fontSize: "7.5pt",
                color: "#000",
                background: "#fff",
                maxWidth: "210mm",
                margin: "0 auto",
                padding: "4mm",
                lineHeight: 1.3,
                position: "relative",
                pageBreakAfter: pageIdx < totalPages - 1 ? "always" : "auto",
              }}
            >
              {renderWatermarks()}

              {/* Canhoto só na primeira folha */}
              {pageIdx === 0 && renderCanhoto()}
              {renderHeader(pageIdx)}

              {pageIdx === 0 && (
                <>
                  <table className="danfe" style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #000", borderTop: "none" }}>
                    <tbody>
                      <tr>
                        <td style={{ ...cellStyle, width: "60%" }}>
                          <LabelValue label="NATUREZA DA OPERAÇÃO" value={data.natureza_operacao} />
                        </td>
                        <td style={cellStyle}>
                          <LabelValue label="PROTOCOLO DE AUTORIZAÇÃO DE USO" value={data.protocolo || "RASCUNHO — Aguardando transmissão"} />
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <table className="danfe" style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #000", borderTop: "none" }}>
                    <tbody>
                      <tr>
                        <td style={{ ...cellStyle, width: "33%" }}>
                          <LabelValue label="INSCRIÇÃO ESTADUAL" value={data.emit_ie || "—"} />
                        </td>
                        <td style={{ ...cellStyle, width: "33%" }}>
                          <LabelValue label="INSCRIÇÃO ESTADUAL SUB. TRIBUTÁRIA" value={data.emit_ie_st || "—"} />
                        </td>
                        <td style={cellStyle}>
                          <LabelValue label="CNPJ" value={data.emit_cnpj} />
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <SectionTitle text="DESTINATÁRIO/REMETENTE" />
                  <table className="danfe" style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #000", borderTop: "none" }}>
                    <tbody>
                      <tr>
                        <td style={{ ...cellStyle, width: "55%" }}>
                          <LabelValue label="NOME/RAZÃO SOCIAL" value={data.dest_razao || "—"} />
                        </td>
                        <td style={{ ...cellStyle, width: "25%" }}>
                          <LabelValue label="CNPJ/CPF" value={data.dest_cnpj_cpf || "—"} />
                        </td>
                        <td style={cellStyle}>
                          <LabelValue label="DATA DA EMISSÃO" value={data.dest_data_emissao || data.data_emissao || "—"} />
                        </td>
                      </tr>
                      <tr>
                        <td style={{ ...cellStyle, width: "40%" }}>
                          <LabelValue label="ENDEREÇO" value={
                            [data.dest_logradouro, data.dest_numero].filter(Boolean).join(", ") || "—"
                          } />
                        </td>
                        <td style={{ ...cellStyle, width: "25%" }}>
                          <LabelValue label="BAIRRO/DISTRITO" value={data.dest_bairro || "—"} />
                        </td>
                        <td style={{ ...cellStyle, width: "15%" }}>
                          <LabelValue label="CEP" value={data.dest_cep || "—"} />
                        </td>
                        <td style={cellStyle}>
                          <LabelValue label="DATA DE SAÍDA/ENTRADA" value={data.data_saida_entrada || "—"} />
                        </td>
                      </tr>
                      <tr>
                        <td style={{ ...cellStyle, width: "40%" }}>
                          <LabelValue label="MUNICÍPIO" value={data.dest_cidade || "—"} />
                        </td>
                        <td style={cellStyle}>
                          <LabelValue label="FONE/FAX" value={data.dest_telefone || "—"} />
                        </td>
                        <td style={cellStyle}>
                          <LabelValue label="UF" value={data.dest_uf || "—"} />
                        </td>
                        <td style={cellStyle}>
                          <LabelValue label="INSCRIÇÃO ESTADUAL" value={data.dest_ie || "—"} />
                        </td>
                        <td style={cellStyle}>
                          <LabelValue label="HORA DE SAÍDA" value={data.hora_saida_entrada || "—"} />
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <SectionTitle text="FATURA / DUPLICATA" />
                  <div style={{ border: "1px solid #000", borderTop: "none", minHeight: "8mm", padding: "2px 4px", fontSize: "6.5pt" }}>
                    {(data.parcelas || []).length > 0 ? (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                        {(data.parcelas || []).map((p, i) => (
                          <span key={i} style={{ fontFamily: "monospace" }}>
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
                  <table className="danfe" style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #000", borderTop: "none" }}>
                    <tbody>
                      <tr>
                        <td style={cellStyle}><LabelValue label="BASE DE CÁLCULO ICMS" value={fmt(data.bc_icms)} /></td>
                        <td style={cellStyle}><LabelValue label="VALOR DO ICMS" value={fmt(data.valor_icms)} /></td>
                        <td style={cellStyle}><LabelValue label="BASE DE CÁLCULO ICMS ST" value={fmt(data.bc_icms_st)} /></td>
                        <td style={cellStyle}><LabelValue label="VALOR DO ICMS SUBSTITUIÇÃO" value={fmt(data.valor_icms_st)} /></td>
                        <td style={cellStyle}><LabelValue label="VALOR TOTAL DOS PRODUTOS" value={fmt(data.valor_produtos)} /></td>
                      </tr>
                      <tr>
                        <td style={cellStyle}><LabelValue label="VALOR DO FRETE" value={fmt(data.valor_frete)} /></td>
                        <td style={cellStyle}><LabelValue label="VALOR DO SEGURO" value={fmt(data.valor_seguro)} /></td>
                        <td style={cellStyle}><LabelValue label="DESCONTO" value={fmt(data.valor_desconto)} /></td>
                        <td style={cellStyle}><LabelValue label="OUTRAS DESPESAS ACESSÓRIAS" value={fmt(data.outras_despesas)} /></td>
                        <td style={cellStyle}><LabelValue label="VALOR DO IPI" value={fmt(data.valor_ipi)} /></td>
                        <td style={cellStyle}><LabelValue label="VALOR APROX. DOS TRIBUTOS" value={fmt(data.valor_aprox_tributos)} /></td>
                        <td style={cellStyle}><LabelValue label="VALOR TOTAL DA NOTA" value={fmt(data.valor_total)} bold /></td>
                      </tr>
                    </tbody>
                  </table>

                  <SectionTitle text="CALCULO DO ISSQN" />
                  <table className="danfe" style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #000", borderTop: "none" }}>
                    <tbody>
                      <tr>
                        <td style={cellStyle}><LabelValue label="INSCRIÇÃO MUNICIPAL" value={data.im || data.emit_im || "—"} /></td>
                        <td style={cellStyle}><LabelValue label="VALOR TOTAL DOS SERVIÇOS" value={fmt(data.valor_servicos ?? 0)} /></td>
                        <td style={cellStyle}><LabelValue label="BASE DE CÁLCULO DO ISSQN" value={fmt(data.bc_issqn ?? 0)} /></td>
                        <td style={cellStyle}><LabelValue label="VALOR DO ISSQN" value={fmt(data.valor_issqn ?? 0)} /></td>
                      </tr>
                    </tbody>
                  </table>

                  <SectionTitle text="TRANSPORTADOR/VOLUMES TRANSPORTADOS" />
                  <table className="danfe" style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #000", borderTop: "none" }}>
                    <tbody>
                      <tr>
                        <td style={{ ...cellStyle, width: "30%" }}><LabelValue label="RAZÃO SOCIAL" value={data.transp_razao || "—"} /></td>
                        <td style={cellStyle}><LabelValue label="FRETE POR CONTA" value={data.transp_frete_conta || "—"} /></td>
                        <td style={cellStyle}><LabelValue label="CÓDIGO ANTT" value={data.transp_codigo_antt || "—"} /></td>
                        <td style={cellStyle}><LabelValue label="PLACA DO VEÍC." value={data.transp_placa || "—"} /></td>
                        <td style={cellStyle}><LabelValue label="UF" value={data.transp_uf || "—"} /></td>
                        <td style={cellStyle}><LabelValue label="CNPJ/CPF" value={data.transp_cnpj_cpf || "—"} /></td>
                      </tr>
                      <tr>
                        <td style={{ ...cellStyle, width: "30%" }}><LabelValue label="ENDEREÇO" value={data.transp_logradouro || "—"} /></td>
                        <td colSpan={3} style={cellStyle}><LabelValue label="MUNICÍPIO" value={data.transp_cidade || "—"} /></td>
                        <td style={cellStyle}><LabelValue label="UF" value={data.transp_cidade_uf || "—"} /></td>
                        <td style={cellStyle}><LabelValue label="INSCRIÇÃO ESTADUAL" value={data.transp_ie || "—"} /></td>
                      </tr>
                    </tbody>
                  </table>
                </>
              )}

              <SectionTitle text="DADOS DO PRODUTO/SERVIÇO" />
              <table className="danfe" style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #000", borderTop: "none", fontSize: "6.5pt", tableLayout: "fixed" }}>
                <colgroup>
                  <col style={{ width: "5%" }} />
                  <col style={{ width: "20%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "6%" }} />
                  <col style={{ width: "5%" }} />
                  <col style={{ width: "5%" }} />
                  <col style={{ width: "4%" }} />
                  <col style={{ width: "6%" }} />
                  <col style={{ width: "7%" }} />
                  <col style={{ width: "7%" }} />
                  <col style={{ width: "6%" }} />
                  <col style={{ width: "6%" }} />
                  <col style={{ width: "5%" }} />
                  <col style={{ width: "3.5%" }} />
                  <col style={{ width: "3.5%" }} />
                </colgroup>
                <thead>
                  <tr style={{ background: "#f5f5f5" }}>
                    <th style={thStyle}>CÓD. PROD.</th>
                    <th style={{ ...thStyle, textAlign: "left" }}>DESCRIÇÃO DO PRODUTO/SERVIÇO</th>
                    <th style={{ ...thStyle, textAlign: "left" }}>LOTE / FAB. / VAL.</th>
                    <th style={thStyle}>NCM/SH</th>
                    <th style={thStyle}>CST</th>
                    <th style={thStyle}>CFOP</th>
                    <th style={thStyle}>UNID.</th>
                    <th style={numericThStyle}>QUANT.</th>
                    <th style={numericThStyle}>VALOR UNITÁRIO</th>
                    <th style={numericThStyle}>VALOR TOTAL</th>
                    <th style={numericThStyle}>B.CÁLC. ICMS</th>
                    <th style={numericThStyle}>VALOR ICMS</th>
                    <th style={numericThStyle}>VALOR IPI</th>
                    <th style={numericThStyle}>ALÍQ. ICMS</th>
                    <th style={numericThStyle}>ALÍQ. IPI</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItens.map((item, idx) => (
                    <tr key={`${pageIdx}-${idx}`}>
                      <td style={tdStyle}>{item.codigo_produto || item.numero_item || idx + 1}</td>
                      <td style={textTdStyle}>{item.descricao}</td>
                      <td style={traceTdStyle}>{renderRastros(item)}</td>
                      <td style={tdStyle}>{item.ncm}</td>
                      <td style={tdStyle}>{cstColuna(item)}</td>
                      <td style={tdStyle}>{item.cfop}</td>
                      <td style={tdStyle}>{item.unidade}</td>
                      <td style={numericTdStyle}>{fmtQtd(item.quantidade)}</td>
                      <td style={numericTdStyle}>{fmt(item.valor_unitario)}</td>
                      <td style={numericTdStyle}>{fmt(item.valor_total)}</td>
                      <td style={numericTdStyle}>{fmt(item.icms_base ?? item.valor_total)}</td>
                      <td style={numericTdStyle}>{fmt(item.icms_valor)}</td>
                      <td style={numericTdStyle}>{fmt(item.ipi_valor || 0)}</td>
                      <td style={numericTdStyle}>{fmt(item.icms_aliquota)}</td>
                      <td style={numericTdStyle}>{fmt(item.ipi_aliquota || 0)}</td>
                    </tr>
                  ))}
                  {pageItens.length < ITEMS_PER_PAGE &&
                    Array.from({ length: ITEMS_PER_PAGE - pageItens.length }).map((_, i) => (
                      <tr key={`empty-${pageIdx}-${i}`}>
                        {Array.from({ length: 15 }).map((_, j) => (
                          <td key={j} style={{ ...tdStyle, height: "14px" }}>&nbsp;</td>
                        ))}
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
                          <div style={{ fontSize: "6pt", fontWeight: "bold", marginBottom: "2px" }}>INFORMAÇÕES COMPLEMENTARES</div>
                          <div style={{ fontSize: "6.5pt", whiteSpace: "pre-wrap", minHeight: "20mm" }}>
                            {data.info_complementares || ""}
                            {isHomolog && "\nNF-E EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO - SEM VALOR FISCAL"}
                          </div>
                        </td>
                        <td style={{ ...cellStyle, width: "50%", verticalAlign: "top" }}>
                          <div style={{ fontSize: "6pt", fontWeight: "bold", marginBottom: "2px" }}>RESERVADO AO FISCO</div>
                          <div style={{ fontSize: "6.5pt", minHeight: "20mm" }}>{data.info_fisco || ""}</div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </>
              )}

              {renderFooter()}
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
  border: "1px solid #000",
  padding: "2px 3px",
  textAlign: "center",
  fontWeight: "bold",
  fontSize: "5.5pt",
  whiteSpace: "nowrap",
};

const numericThStyle: React.CSSProperties = {
  ...thStyle,
  textAlign: "right",
};

const tdStyle: React.CSSProperties = {
  border: "1px solid #000",
  padding: "1px 3px",
  textAlign: "center",
  fontSize: "6.5pt",
  fontFamily: "monospace",
};

const textTdStyle: React.CSSProperties = {
  ...tdStyle,
  textAlign: "left",
  fontSize: "6pt",
  fontFamily: "Arial, Helvetica, sans-serif",
  overflowWrap: "break-word",
};

const traceTdStyle: React.CSSProperties = {
  ...textTdStyle,
  fontSize: "5.5pt",
  lineHeight: 1.25,
};

const numericTdStyle: React.CSSProperties = {
  ...tdStyle,
  textAlign: "right",
  padding: "1px 4px",
  whiteSpace: "nowrap",
};

function LabelValue({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: "5.5pt", color: "#333", fontWeight: "bold" }}>{label}</div>
      <div style={{ fontSize: "7.5pt", fontWeight: bold ? "bold" : "normal" }}>{value}</div>
    </div>
  );
}

function SectionTitle({ text }: { text: string }) {
  return (
    <div style={{
      border: "1px solid #000",
      borderBottom: "none",
      padding: "1px 4px",
      fontSize: "6.5pt",
      fontWeight: "bold",
      background: "#f0f0f0",
    }}>
      {text}
    </div>
  );
}
