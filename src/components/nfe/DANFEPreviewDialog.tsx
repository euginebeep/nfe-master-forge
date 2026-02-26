import { useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, X } from "lucide-react";

interface DANFEItem {
  numero_item?: number;
  descricao: string;
  ncm: string;
  cst_icms: string;
  cfop: string;
  unidade: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  icms_aliquota: number;
  icms_valor: number;
  ipi_valor?: number;
  ipi_aliquota?: number;
  origem?: string;
}

interface DANFEData {
  // Emitente
  emit_razao: string;
  emit_fantasia?: string;
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
  // Nota
  numero?: number | string;
  serie?: number | string;
  folha?: string;
  natureza_operacao: string;
  chave_acesso?: string;
  protocolo?: string;
  data_emissao?: string;
  tipo_operacao?: "0" | "1"; // 0=Entrada, 1=Saída
  // Destinatário
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
  // Transporte
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
  // Totais
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
  // Itens
  itens: DANFEItem[];
  // Info adicional
  info_complementares?: string;
  info_fisco?: string;
  // Status
  ambiente?: "homologacao" | "producao";
}

interface DANFEPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: DANFEData | null;
}

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtQtd = (v: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 4 });

export function DANFEPreviewDialog({ open, onOpenChange, data }: DANFEPreviewDialogProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    if (!printRef.current) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head><title>DANFE - Rascunho</title>
        <style>
          * { margin:0; padding:0; box-sizing:border-box; }
          body { font-family: Arial, sans-serif; font-size: 8pt; color: #000; background: #fff; }
          @page { size: A4 portrait; margin: 8mm; }
          @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        </style>
        </head>
        <body>${printRef.current.innerHTML}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 400);
  };

  if (!data) return null;

  const isHomolog = data.ambiente === "homologacao";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[900px] max-h-[95vh] overflow-y-auto p-4">
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle className="text-base">Pré-visualização DANFE — Rascunho</DialogTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-1" /> Imprimir
            </Button>
          </div>
        </DialogHeader>

        {/* DANFE Render */}
        <div ref={printRef}>
          <div style={{
            fontFamily: "Arial, Helvetica, sans-serif",
            fontSize: "7.5pt",
            color: "#000",
            background: "#fff",
            maxWidth: "210mm",
            margin: "0 auto",
            padding: "4mm",
            lineHeight: 1.3,
          }}>
            {/* Watermark for homologação */}
            {isHomolog && (
              <div style={{
                position: "relative",
                width: "100%",
                height: 0,
                overflow: "visible",
                zIndex: 10,
                pointerEvents: "none",
              }}>
                <div style={{
                  position: "absolute",
                  top: "200px",
                  left: "50%",
                  transform: "translateX(-50%) rotate(-30deg)",
                  fontSize: "48pt",
                  fontWeight: "bold",
                  color: "rgba(200,0,0,0.12)",
                  whiteSpace: "nowrap",
                  letterSpacing: "8px",
                }}>
                  SEM VALOR FISCAL
                </div>
              </div>
            )}

            {/* ═══ Recibo ═══ */}
            <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #000", marginBottom: "2mm" }}>
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

            {/* ═══ Cabeçalho Principal ═══ */}
            <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #000" }}>
              <tbody>
                <tr>
                  {/* Emitente */}
                  <td style={{ ...cellStyle, width: "40%", verticalAlign: "top", padding: "4px 6px" }}>
                    <div style={{ fontWeight: "bold", fontSize: "10pt", marginBottom: "2px" }}>
                      {data.emit_razao}
                    </div>
                    {data.emit_fantasia && data.emit_fantasia !== data.emit_razao && (
                      <div style={{ fontSize: "7pt", marginBottom: "1px" }}>{data.emit_fantasia}</div>
                    )}
                    <div style={{ fontSize: "6.5pt", lineHeight: 1.4 }}>
                      {data.emit_logradouro && <>{data.emit_logradouro}{data.emit_numero ? `, ${data.emit_numero}` : ""}<br /></>}
                      {data.emit_bairro && <>{data.emit_bairro}<br /></>}
                      {data.emit_cidade && <>{data.emit_cidade} - {data.emit_uf}<br /></>}
                      {data.emit_cep && <>CEP: {data.emit_cep}<br /></>}
                      {data.emit_telefone && <>TELEFONE: {data.emit_telefone}<br /></>}
                      {data.emit_email && <>E-MAIL: {data.emit_email}</>}
                    </div>
                  </td>

                  {/* DANFE Title */}
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
                      FOLHA: {data.folha || "1 de 1"}
                    </div>
                  </td>

                  {/* Barcode / Chave */}
                  <td style={{ ...cellStyle, width: "35%", verticalAlign: "top", padding: "4px" }}>
                    {/* Barcode placeholder */}
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
                      Consulta de autenticidade no portal nacional da NF-e<br />
                      www.nfe.fazenda.gov.br/portal
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* ═══ Natureza + Protocolo ═══ */}
            <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #000", borderTop: "none" }}>
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

            {/* ═══ IE / CNPJ Emitente ═══ */}
            <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #000", borderTop: "none" }}>
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

            {/* ═══ DESTINATÁRIO ═══ */}
            <SectionTitle text="DESTINATÁRIO/REMETENTE" />
            <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #000", borderTop: "none" }}>
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
                    <LabelValue label="DATA DE SAÍDA/ENTRADA" value="—" />
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
                    <LabelValue label="HORA DE SAÍDA" value="—" />
                  </td>
                </tr>
              </tbody>
            </table>

            {/* ═══ FATURA ═══ */}
            <SectionTitle text="FATURA" />
            <div style={{ border: "1px solid #000", borderTop: "none", minHeight: "8mm", padding: "2px 4px" }} />

            {/* ═══ CÁLCULO DO IMPOSTO ═══ */}
            <SectionTitle text="CÁLCULO DO IMPOSTO" />
            <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #000", borderTop: "none" }}>
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

            {/* ═══ TRANSPORTADOR ═══ */}
            <SectionTitle text="TRANSPORTADOR/VOLUMES TRANSPORTADOS" />
            <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #000", borderTop: "none" }}>
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

            {/* ═══ DADOS DO PRODUTO/SERVIÇO ═══ */}
            <SectionTitle text="DADOS DO PRODUTO/SERVIÇO" />
            <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #000", borderTop: "none", fontSize: "6.5pt" }}>
              <thead>
                <tr style={{ background: "#f5f5f5" }}>
                  <th style={thStyle}>CÓD. PROD.</th>
                  <th style={{ ...thStyle, textAlign: "left", width: "25%" }}>DESCRIÇÃO DO PRODUTO/SERVIÇO</th>
                  <th style={thStyle}>NCM/SH</th>
                  <th style={thStyle}>O/CST</th>
                  <th style={thStyle}>CFOP</th>
                  <th style={thStyle}>UNID.</th>
                  <th style={thStyle}>QUANT.</th>
                  <th style={thStyle}>VALOR UNITÁRIO</th>
                  <th style={thStyle}>VALOR TOTAL</th>
                  <th style={thStyle}>B.CÁLC. ICMS</th>
                  <th style={thStyle}>VALOR ICMS</th>
                  <th style={thStyle}>VALOR IPI</th>
                  <th style={thStyle}>ALÍQ. ICMS</th>
                  <th style={thStyle}>ALÍQ. IPI</th>
                </tr>
              </thead>
              <tbody>
                {data.itens.map((item, idx) => (
                  <tr key={idx}>
                    <td style={tdStyle}>{item.numero_item || idx + 1}</td>
                    <td style={{ ...tdStyle, textAlign: "left", fontSize: "6pt" }}>{item.descricao}</td>
                    <td style={tdStyle}>{item.ncm}</td>
                    <td style={tdStyle}>{item.origem || "0"}{item.cst_icms}</td>
                    <td style={tdStyle}>{item.cfop}</td>
                    <td style={tdStyle}>{item.unidade}</td>
                    <td style={tdStyle}>{fmtQtd(item.quantidade)}</td>
                    <td style={tdStyle}>{fmt(item.valor_unitario)}</td>
                    <td style={tdStyle}>{fmt(item.valor_total)}</td>
                    <td style={tdStyle}>{fmt(item.valor_total)}</td>
                    <td style={tdStyle}>{fmt(item.icms_valor)}</td>
                    <td style={tdStyle}>{fmt(item.ipi_valor || 0)}</td>
                    <td style={tdStyle}>{fmt(item.icms_aliquota)}</td>
                    <td style={tdStyle}>{fmt(item.ipi_aliquota || 0)}</td>
                  </tr>
                ))}
                {/* Empty rows to fill space */}
                {data.itens.length < 8 &&
                  Array.from({ length: 8 - data.itens.length }).map((_, i) => (
                    <tr key={`empty-${i}`}>
                      {Array.from({ length: 14 }).map((_, j) => (
                        <td key={j} style={{ ...tdStyle, height: "14px" }}>&nbsp;</td>
                      ))}
                    </tr>
                  ))}
              </tbody>
            </table>

            {/* ═══ DADOS ADICIONAIS ═══ */}
            <SectionTitle text="DADOS ADICIONAIS" />
            <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #000", borderTop: "none" }}>
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
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Helpers ───

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

const tdStyle: React.CSSProperties = {
  border: "1px solid #000",
  padding: "1px 3px",
  textAlign: "center",
  fontSize: "6.5pt",
  fontFamily: "monospace",
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
