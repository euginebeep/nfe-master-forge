// ============================================================
// CABEÇALHO PADRÃO PARA TODAS AS FOLHAS DA OP
// ============================================================
import type { OPDadosPDF } from '@/types/op-pdf';

interface OPCabecalhoPDFProps {
  op: OPDadosPDF;
  tituloSecao: string;
  subtitulo?: string;
  paginaAtual?: number;
  totalPaginas?: number;
  empresa_logo_url?: string | null;
  empresa_razao?: string;
  empresa_cnpj?: string;
  empresa_endereco?: string;
}

export function OPCabecalhoPDF({ op, tituloSecao, subtitulo, paginaAtual, totalPaginas, empresa_logo_url, empresa_razao, empresa_cnpj, empresa_endereco }: OPCabecalhoPDFProps) {
  const qrUrl = `${window.location.origin}/verificar-op/${op.codigo}`;

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  return (
    <>
      {/* Cabeçalho do Tenant (Logo + Dados) */}
      {(empresa_logo_url || empresa_razao) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', paddingBottom: '12px', borderBottom: '2px solid #1e293b' }}>
          {empresa_logo_url && (
            <img src={empresa_logo_url} alt="Logo" style={{ maxHeight: '50px', maxWidth: '120px', objectFit: 'contain' }} />
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e293b' }}>{empresa_razao || 'Empresa'}</div>
            <div style={{ fontSize: '10px', color: '#64748b' }}>CNPJ: {empresa_cnpj || '-'}</div>
            <div style={{ fontSize: '9px', color: '#64748b' }}>{empresa_endereco || ''}</div>
          </div>
        </div>
      )}

      {/* Cabeçalho */}
      <div className="op-header">
        <div className="op-header-left">
          <h1>ORDEM DE PRODUÇÃO INDUSTRIAL</h1>
          <div className="flex items-center gap-2">
            <div className="subtitle">{tituloSecao}</div>
            {paginaAtual && totalPaginas && (
              <div className="text-[9px] text-slate-500 font-mono ml-auto">
                Pág. {paginaAtual}/{totalPaginas}
              </div>
            )}
          </div>
          {subtitulo && <div className="subtitle">{subtitulo}</div>}
        </div>
        <div className="op-header-right" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
          <div className="op-codigo">{op.codigo}</div>
          <div className="op-lote">Lote: {op.lote_produto_acabado || '-'}</div>
          <div style={{ marginTop: '4px', border: '1px solid #cbd5e1', padding: '2px', borderRadius: '4px', background: '#fff' }}>
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=72x72&data=${encodeURIComponent(qrUrl)}&format=svg`}
              alt="QR verificação"
              width={72}
              height={72}
              style={{ display: 'block' }}
              crossOrigin="anonymous"
            />
          </div>
          <div style={{ fontSize: '7px', color: '#64748b', textAlign: 'center', maxWidth: '80px' }}>
            Escaneie para verificar autenticidade
          </div>
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
      
      {(op.temperatura_inicio || op.umidade_inicio) && (
        <div className="op-info-grid" style={{ borderTop: '1px solid #e2e8f0', background: '#f0fdf4' }}>
          <div className="op-info-box">
            <label>🌡 Temp. Início Produção</label>
            <div className="value" style={{ color: op.temperatura_inicio && op.temperatura_inicio > 25 ? '#dc2626' : '#15803d' }}>
              {op.temperatura_inicio ? `${op.temperatura_inicio.toFixed(1)} °C` : '-'}
            </div>
          </div>
          <div className="op-info-box">
            <label>💧 Umidade Início</label>
            <div className="value" style={{ color: op.umidade_inicio && op.umidade_inicio > 60 ? '#dc2626' : '#15803d' }}>
              {op.umidade_inicio ? `${op.umidade_inicio.toFixed(1)} %` : '-'}
            </div>
          </div>
          <div className="op-info-box">
            <label>Sala de Produção</label>
            <div className="value">{op.sala_producao || 'Produção'}</div>
          </div>
          <div className="op-info-box">
            <label>Conformidade Ambiental</label>
            <div className="value" style={{ color: (op.temperatura_inicio ?? 20) <= 25 && (op.umidade_inicio ?? 50) <= 60 ? '#15803d' : '#dc2626', fontWeight: 700 }}>
              {(op.temperatura_inicio ?? 20) <= 25 && (op.umidade_inicio ?? 50) <= 60 ? '✓ CONFORME' : '⚠ VERIFICAR'}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Rodapé padrão
export function OPRodapePDF({ op }: { op: OPDadosPDF }) {
  return (
    <div className="op-footer">
      <p>Documento gerado em {new Date().toLocaleString('pt-BR')} | {op.codigo} | Fabricação de suplemento alimentar conforme RDC 243/2018, IN 28/2018 e RDC 843/2024 (Boas Práticas de Fabricação). Documento controlado — gerado por BrainX ERP.</p>
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
