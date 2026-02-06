// ============================================================
// CABEÇALHO PADRÃO PARA TODAS AS FOLHAS DA OP
// ============================================================

interface OPCabecalhoPDFProps {
  op: any;
  tituloSecao: string;
  subtitulo?: string;
}

export function OPCabecalhoPDF({ op, tituloSecao, subtitulo }: OPCabecalhoPDFProps) {
  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  return (
    <>
      {/* Cabeçalho */}
      <div className="op-header">
        <div className="op-header-left">
          <h1>ORDEM DE PRODUÇÃO INDUSTRIAL</h1>
          <div className="subtitle">{tituloSecao}</div>
          {subtitulo && <div className="subtitle">{subtitulo}</div>}
        </div>
        <div className="op-header-right">
          <div className="op-codigo">{op.codigo}</div>
          <div className="op-lote">Lote: {op.lote_produto_acabado || '-'}</div>
        </div>
      </div>

      {/* Grid de informações */}
      <div className="op-info-grid">
        <div className="op-info-box">
          <label>Produto</label>
          <div className="value">{op.produto_nome}</div>
        </div>
        <div className="op-info-box">
          <label>Quantidade</label>
          <div className="value">
            {op.quantidade_frascos?.toLocaleString()} frascos × {op.capsulas_por_frasco} un
          </div>
        </div>
        <div className="op-info-box">
          <label>Total c/ Acréscimo</label>
          <div className="value">
            {op.total_capsulas_com_acrescimo?.toLocaleString()} unidades
          </div>
        </div>
        <div className="op-info-box">
          <label>Data Fabricação</label>
          <div className="value">{formatDate(op.data_fabricacao)}</div>
        </div>
      </div>

      <div className="op-info-grid">
        <div className="op-info-box">
          <label>Responsável Técnico</label>
          <div className="value">{op.rt_nome || '-'}</div>
        </div>
        <div className="op-info-box">
          <label>Conselho/Registro</label>
          <div className="value">
            {op.rt_tipo_conselho} {op.rt_numero_registro}/{op.rt_uf_conselho}
          </div>
        </div>
        <div className="op-info-box">
          <label>Fórmula</label>
          <div className="value">{op.formula_codigo || 'Manual'}</div>
        </div>
        <div className="op-info-box">
          <label>Data Validade</label>
          <div className="value">{formatDate(op.data_validade)}</div>
        </div>
      </div>
    </>
  );
}

// Rodapé padrão
export function OPRodapePDF({ op }: { op: any }) {
  return (
    <div className="op-footer">
      <p>Documento gerado em {new Date().toLocaleString('pt-BR')} | {op.codigo} | Este documento é parte integrante do controle de produção e rastreabilidade ANVISA</p>
    </div>
  );
}

// Bloco de assinaturas
export function OPAssinaturasPDF({ 
  assinaturas 
}: { 
  assinaturas: Array<{ cargo: string; subtitulo?: string }> 
}) {
  return (
    <div className="assinatura-grid">
      {assinaturas.map((ass, idx) => (
        <div key={idx} className="assinatura-box">
          <div className="assinatura-linha" />
          <div className="assinatura-label">{ass.cargo}</div>
          {ass.subtitulo && <div className="assinatura-sublabel">{ass.subtitulo}</div>}
        </div>
      ))}
    </div>
  );
}
