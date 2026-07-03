import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import type { OPIndustrialData } from '@/types/op-industrial';
import { calcularDistribuicaoGeometrica } from '@/lib/distribuicao-geometrica';

interface OPImpressaoProps {
  opId?: string;
  autoprint?: boolean;
}

/**
 * Componente para renderizar e imprimir a OP em 7 páginas A4
 * Integra dados reais do Supabase com template HTML profissional
 * 
 * Uso:
 * - Rota: /producao/ordens/:id/imprimir
 * - window.print() é chamado automaticamente se autoprint=true
 */
export function OPImpressaoTemplate({ opId: propOpId, autoprint = true }: OPImpressaoProps) {
  const { id: routeOpId } = useParams<{ id: string }>();
  const opId = propOpId || routeOpId;
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [opData, setOpData] = useState<OPIndustrialData | null>(null);
  const [companyData, setCompanyData] = useState<any>(null);
  const [logoUrl, setLogoUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!opId) {
      setError('ID da OP não fornecido');
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const { data: op, error: opError } = await supabase
          .from('ordens_producao_industrial')
          .select(`
            *,
            company:company(*),
            op_materias_primas(*),
            op_embalagens(*),
            op_pesagens_criticas(*),
            op_controle_qualidade(*),
            op_controle_perdas(*),
            op_checklist(*),
            op_assinaturas_rt!op_assinaturas_rt_op_id_fkey(*)
          `)
          .eq('id', opId)
          .single();

        if (opError) throw opError;
        if (!op) throw new Error('OP não encontrada');

        setOpData(op);
        setCompanyData(op.company);
      } catch (err) {
        console.error('Erro ao buscar dados da OP:', err);
        const errorMsg = err instanceof Error ? err.message : JSON.stringify(err);
        setError(`Erro ao carregar OP: ${errorMsg}`);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [opId]);

  // TAREFA 1: Corrigir logo async com useEffect
  useEffect(() => {
    if (!companyData?.logo_file_id) return;
    
    supabase.storage
      .from('company-assets')
      .createSignedUrl(companyData.logo_file_id, 3600)
      .then(({ data }) => setLogoUrl(data?.signedUrl || ''))
      .catch(err => console.error('Erro ao obter URL do logo:', err));
  }, [companyData]);

  useEffect(() => {
    if (autoprint && !loading && opData) {
      setTimeout(() => window.print(), 500);
    }
  }, [loading, opData, autoprint]);

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p>Carregando dados da OP...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px', color: 'red' }}>
        <p>Erro: {error}</p>
      </div>
    );
  }

  if (!opData || !companyData) {
    return (
      <div style={{ padding: '20px' }}>
        <p>Nenhum dado encontrado</p>
      </div>
    );
  }

  // Agrupar materias primas por categoria
  const materiasPrimas = opData.op_materias_primas || [];
  const ativos = materiasPrimas.filter(m => m?.categoria === 'ATIVO');
  const excipienteBase = materiasPrimas.filter(m => m?.categoria === 'EXCIPIENTE_BASE');
  const excipienteTec = materiasPrimas.filter(m => m?.categoria === 'EXCIPIENTE_TECNOLOGICO');

  // Helpers
  // Peso em GRAMAS → unidade humana (mg/g/kg), vírgula decimal, no máx. 3 casas, sem zeros à direita.
  const formatarQtd = (valorG: number | null | undefined): string => {
    if (valorG == null || isNaN(Number(valorG))) return '—';
    const g = Number(valorG);
    let n: number, u: string;
    if (g < 1)         { n = g * 1000; u = 'mg'; }
    else if (g < 1000) { n = g;        u = 'g';  }
    else               { n = g / 1000; u = 'kg'; }
    return `${n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} ${u}`;
  };

  // Pesagem crítica: < 1 g (micro-dose)
  const ehCritico = (valorG: number | null | undefined) =>
    valorG != null && !isNaN(Number(valorG)) && Number(valorG) < 1;

  const formatarData = (data: string | null): string => {
    if (!data) return '';
    return new Date(data).toLocaleDateString('pt-BR');
  };

  const perdas = opData.op_controle_perdas?.[0];
  const checklistCat = (cat: string) =>
    (opData.op_checklist || []).filter((c: any) => c.categoria === cat)
      .sort((a: any, b: any) => (a.ordem || 0) - (b.ordem || 0));
  const pesoAlvo = opData.peso_capsula_mg || 500;

  // TAREFA 2: Componente FaseHeader reutilizável
  const FaseHeader = ({ faseK, faseT }: { faseK: string; faseT: string }) => (
    <div className="phdr">
      <div className="top">
        <div className="logo">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" />
          ) : (
            <>
              <b>{companyData.nome_fantasia?.substring(0, 2).toUpperCase()}</b>
              <span>{companyData.nome_fantasia?.substring(0, 5).toUpperCase()}</span>
            </>
          )}
        </div>
        <div>
          <div className="fase-k">{faseK}</div>
          <div className="fase-t">{faseT}</div>
          <div className="fase-p">{opData.produto_nome}</div>
        </div>
        <div className="op-code">
          <div className="c">{opData.codigo}</div>
          <div className="l">Lote {opData.lote_produto_acabado}</div>
        </div>
      </div>
      <div className="band">
        <div className="b"><div className="k">Quantidade</div><div className="v">{opData.quantidade_frascos} fr × {opData.capsulas_por_frasco} un</div></div>
        <div className="b"><div className="k">Total c/ acréscimo</div><div className="v">{opData.total_capsulas_com_acrescimo?.toLocaleString('pt-BR')} un</div></div>
        <div className="b"><div className="k">Resp. técnico</div><div className="v">{opData.rt_nome}</div></div>
        <div className="b"><div className="k">Conselho</div><div className="v">{opData.rt_tipo_conselho}-{opData.rt_uf_conselho} {opData.rt_numero_registro}</div></div>
        <div className="b"><div className="k">Fabricação</div><div className="v">{formatarData(opData.data_fabricacao)}</div></div>
        <div className="b"><div className="k">Validade</div><div className="v">{formatarData(opData.data_validade)}</div></div>
      </div>
    </div>
  );

  return (
    <div ref={containerRef} className="op-doc" style={{ width: '100%' }}>
      <style>{`

        /* ===== BrainX · OP impressão — CSS escopado em .op-doc ===== */
        .op-doc{
          --ink:#14110d; --ink-2:#4a453c; --line:#ddd7c9; --line-2:#bcb4a4;
          --gold:#b8860b; --gold-soft:#f5edd6; --zebra:#faf8f2; --blank:#c3bcac; --warn:#a8341f;
          font-family:"Helvetica Neue",Arial,sans-serif; color:var(--ink-2);
          font-size:12px; line-height:1.35;
          -webkit-print-color-adjust:exact; print-color-adjust:exact;
        }
        .op-doc *{ box-sizing:border-box; margin:0; padding:0; }

        /* folha: em TELA flui como página branca; em IMPRESSÃO vira A4 real */
        .op-doc .page{ background:#fff; break-after:page; }
        .op-doc .page:last-child{ break-after:auto; }
        @media screen{
          .op-doc{ background:#eef0ea; padding:18px 0; }
          .op-doc .page{
            width:100%; max-width:820px; min-height:auto;
            padding:34px 36px; margin:0 auto 20px;
            border-radius:4px; box-shadow:0 1px 0 #dcdfd7, 0 10px 30px -20px rgba(0,0,0,.35);
          }
          .op-doc .footer{ display:none; }
        }
        @media print{
          /* Ocultar tudo exceto o documento */
          body > *:not(.op-doc) { display:none !important; }
          body { margin:0; padding:0; background:#fff; }
          
          .op-doc{ background:#fff; padding:0; margin:0; width:100%; }
          .op-doc .page{ width:210mm; height:297mm; padding:9mm; margin:0; box-shadow:none; }
          .op-doc .footer{
            position:fixed; bottom:0; left:0; right:0; height:14mm; padding:0 9mm;
            display:flex; align-items:center; justify-content:space-between;
            font-size:6.2px; color:#8f887a; font-family:Arial,sans-serif;
          }
        }
        .op-doc .footer-left b{ color:#4a453c; } .op-doc .footer-right{ text-align:right; }

        /* barra de ações (só em tela) */
        .op-doc .op-toolbar{ max-width:820px; margin:0 auto 14px; display:flex; align-items:center; justify-content:space-between; gap:12px; padding:10px 14px; background:#fff; border:1px solid var(--line); border-radius:8px; font-size:12px; color:var(--ink-2); }
        .op-doc .op-toolbar button{ border:0; background:var(--ink); color:#fff; font-weight:700; font-size:12px; padding:9px 16px; border-radius:8px; cursor:pointer; font-family:inherit; }
        .op-doc .op-toolbar button:hover{ background:#000; }
        @media print{ .op-doc .op-toolbar{ display:none; } }

        /* faixa de identificação por fase */
        .op-doc .phdr{ border:1px solid var(--ink); border-radius:6px; overflow:hidden; margin-bottom:12px; }
        .op-doc .phdr .top{ display:grid; grid-template-columns:auto 1fr auto; gap:14px; align-items:center; padding:9px 12px; border-bottom:1px solid var(--line); }
        .op-doc .logo{ width:52px; height:52px; border:2px solid var(--gold); border-radius:9px; background:var(--gold-soft); display:flex; flex-direction:column; align-items:center; justify-content:center; color:var(--ink); overflow:hidden; flex:none; }
        .op-doc .logo img{ width:100%; height:100%; object-fit:contain; }
        .op-doc .logo b{ font-size:17px; line-height:1; } .op-doc .logo span{ font-size:6px; letter-spacing:1px; color:var(--gold); font-weight:800; margin-top:1px; }
        .op-doc .logo-large{ width:66px; height:66px; }
        .op-doc .fase-k{ font-size:9px; letter-spacing:2px; color:var(--gold); font-weight:800; text-transform:uppercase; }
        .op-doc .fase-t{ font-size:16px; font-weight:800; color:var(--ink); letter-spacing:-.01em; }
        .op-doc .fase-p{ font-size:11px; color:var(--ink-2); }
        .op-doc .op-code{ text-align:right; } .op-doc .op-code .c{ font-size:17px; font-weight:800; color:var(--ink); } .op-doc .op-code .l{ font-size:11px; }
        .op-doc .band{ display:grid; grid-template-columns:repeat(6,1fr); background:var(--zebra); }
        .op-doc .band .b{ padding:6px 10px; border-right:1px solid var(--line); }
        .op-doc .band .b:last-child{ border-right:0; }
        .op-doc .band .k{ font-size:8px; letter-spacing:.5px; text-transform:uppercase; color:var(--gold); font-weight:800; }
        .op-doc .band .v{ font-size:12px; color:var(--ink); font-weight:700; }

        /* seções */
        .op-doc .sec{ display:flex; align-items:center; gap:8px; margin:14px 0 6px; }
        .op-doc .sec .n{ min-width:18px; height:18px; padding:0 4px; border-radius:4px; background:var(--gold); color:#fff; font-size:11px; font-weight:800; display:flex; align-items:center; justify-content:center; }
        .op-doc .sec h2{ font-size:12px; font-weight:800; color:var(--ink); letter-spacing:.3px; text-transform:uppercase; }
        .op-doc .sec .cnt{ margin-left:auto; font-size:10px; color:var(--ink-2); }

        /* tabelas */
        .op-doc table{ width:100%; border-collapse:collapse; font-size:11px; }
        .op-doc thead th{ background:var(--ink); color:#fff; font-weight:700; text-align:left; padding:6px 8px; font-size:9px; letter-spacing:.3px; text-transform:uppercase; }
        .op-doc tbody td{ padding:6px 8px; border-bottom:1px solid var(--line); vertical-align:middle; }
        .op-doc tbody tr:nth-child(even){ background:var(--zebra); }
        .op-doc td.num, .op-doc th.num{ text-align:right; font-variant-numeric:tabular-nums; }
        .op-doc td.c, .op-doc th.c{ text-align:center; }
        .op-doc .qc{ background:#fffdf6; } .op-doc .fill{ color:var(--blank); }
        .op-doc .box{ display:inline-block; width:12px; height:12px; border:1.3px solid var(--ink-2); border-radius:2px; vertical-align:-2px; }
        .op-doc .warn{ color:var(--warn); font-weight:700; }
        .op-doc .tag{ font-size:8px; font-weight:800; padding:1px 6px; border-radius:20px; background:var(--gold-soft); color:#8a6608; text-transform:uppercase; display:inline-block; }
        .op-doc .tag.e{ background:#eef1f4; color:#4a586b; }

        /* regras / notas */
        .op-doc .rules{ border:1px solid var(--gold); border-radius:6px; background:#fffdf6; padding:9px 13px; font-size:11px; }
        .op-doc .rules li{ margin:3px 0; list-style:none; padding-left:16px; position:relative; }
        .op-doc .rules li:before{ content:"▸"; color:var(--gold); position:absolute; left:0; font-weight:800; }
        .op-doc .note{ font-size:10px; margin-top:5px; }

        /* grids de campos */
        .op-doc .grid{ display:grid; border:1px solid var(--line-2); border-radius:5px; overflow:hidden; }
        .op-doc .grid.c4{ grid-template-columns:repeat(4,1fr); } .op-doc .grid.c3{ grid-template-columns:repeat(3,1fr); }
        .op-doc .grid .cell{ padding:7px 10px; border-right:1px solid var(--line); border-bottom:1px solid var(--line); }
        .op-doc .grid.c4 .cell:nth-child(4n){ border-right:0; } .op-doc .grid.c3 .cell:nth-child(3n){ border-right:0; }
        .op-doc .grid .k{ font-size:8px; letter-spacing:.5px; text-transform:uppercase; color:var(--gold); font-weight:800; }
        .op-doc .grid .v{ font-size:12px; color:var(--ink); font-weight:700; margin-top:1px; } .op-doc .grid .v.blank{ color:var(--blank); font-weight:500; }

        /* assinaturas */
        .op-doc .signs{ display:grid; grid-template-columns:repeat(3,1fr); gap:16px; margin-top:16px; break-inside:avoid; }
        .op-doc .sign{ padding-top:26px; } .op-doc .sign .line{ border-top:1.3px solid var(--ink); }
        .op-doc .sign .who{ font-size:12px; font-weight:800; color:var(--ink); margin-top:5px; min-height:14px; }
        .op-doc .sign .role{ font-size:8px; letter-spacing:.6px; text-transform:uppercase; color:var(--gold); font-weight:800; margin-top:1px; }
        .op-doc .sign .reg{ font-size:10px; margin-top:2px; } .op-doc .sign .date{ font-size:9px; margin-top:5px; }

        /* capa */
        .op-doc .cover{ border:2px solid var(--ink); border-radius:10px; padding:26px 30px; margin-top:6px; }
        .op-doc .cover .co{ font-size:10px; letter-spacing:4px; color:var(--gold); font-weight:800; }
        .op-doc .cover h1{ font-size:19px; color:var(--ink); margin:5px 0 3px; letter-spacing:1px; }
        .op-doc .cover .op{ font-size:38px; font-weight:800; color:var(--ink); letter-spacing:1px; }
        .op-doc .cover .prod{ font-size:14px; color:var(--ink); font-weight:700; margin-top:7px; }
        .op-doc .cover .grid{ margin-top:16px; }
        .op-doc .idx{ margin-top:20px; }
        .op-doc .idx .h{ font-size:12px; font-weight:800; color:var(--ink); letter-spacing:.5px; text-transform:uppercase; margin-bottom:7px; }
        .op-doc .idx .row{ display:flex; align-items:center; gap:12px; padding:8px 0; border-bottom:1px solid var(--line); }
        .op-doc .idx .no{ width:24px; height:24px; border-radius:5px; background:var(--gold); color:#fff; font-weight:800; font-size:11px; display:flex; align-items:center; justify-content:center; flex:none; }
        .op-doc .idx .ph{ font-size:8px; letter-spacing:1px; color:var(--gold); font-weight:800; text-transform:uppercase; }
        .op-doc .idx .nm{ font-size:13px; color:var(--ink); font-weight:700; }
      
      `}</style>

      {!autoprint && (
        <div className="op-toolbar">
          <span>Pré-visualização do documento A4 · {opData.codigo}</span>
          <button type="button" onClick={() => window.open(`/producao/ordens/${opId}/imprimir`, '_blank')}>
            🖨️ Imprimir / Salvar PDF (A4)
          </button>
        </div>
      )}

      {/* ===== CAPA ===== */}
      <div className="page">
        <div className="cover">
          <div>
            <div className="logo-large">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" />
              ) : (
                <>
                  <b>{companyData.nome_fantasia?.substring(0, 2).toUpperCase()}</b>
                  <span>{companyData.nome_fantasia?.substring(0, 5).toUpperCase()}</span>
                </>
              )}
            </div>
            <div style={{ textAlign: 'center' }}>
              <div className="op">{opData.codigo}</div>
              <div className="prod">{opData.produto_nome}</div>
              <div style={{ fontSize: '9px', color: '#999', marginTop: '6px' }}>
                Lote {opData.lote_produto_acabado}
              </div>
            </div>
          </div>

          <div className="grid c4" style={{ marginTop: '16px' }}>
            <div className="cell"><div className="k">Empresa</div><div className="v">{companyData.nome_fantasia}</div></div>
            <div className="cell"><div className="k">Responsável Técnico</div><div className="v">{opData.rt_nome}</div></div>
            <div className="cell"><div className="k">Conselho</div><div className="v">{opData.rt_tipo_conselho}-{opData.rt_uf_conselho}</div></div>
            <div className="cell"><div className="k">Registro</div><div className="v">{opData.rt_numero_registro}</div></div>
            <div className="cell"><div className="k">Data Fabricação</div><div className="v">{formatarData(opData.data_fabricacao)}</div></div>
            <div className="cell"><div className="k">Validade</div><div className="v">{formatarData(opData.data_validade)}</div></div>
            <div className="cell"><div className="k">Quantidade</div><div className="v">{opData.quantidade_frascos} fr</div></div>
            <div className="cell"><div className="k">Total</div><div className="v">{opData.total_capsulas_com_acrescimo?.toLocaleString('pt-BR')} un</div></div>
          </div>

          <div className="idx">
            <div className="h">Índice de páginas</div>
            {[
              { no: 1, ph: 'CAPA', nm: 'Folha de Rosto' },
              { no: 2, ph: 'Fase 1 — Pré-produção', nm: 'Folha de Separação de Materiais' },
              { no: 3, ph: 'Fase 2 — Pesagem', nm: 'Folha de Pesagem de Matérias-Primas' },
              { no: 4, ph: 'Fase 3 — Mistura', nm: 'Folha de Ordem de Mistura' },
              { no: 5, ph: 'Fase 4 — Encapsulamento', nm: 'Folha de Encapsulamento' },
              { no: 6, ph: 'Fase 5 — Embalagem', nm: 'Folha de Embalagem e Rotulagem' },
              { no: 7, ph: 'Verificações', nm: 'Checklist Operacional e Liberação do Lote' }
            ].map(item => (
              <div key={item.no} className="row">
                <div className="no">{item.no}</div>
                <div>
                  <div className="ph">{item.ph}</div>
                  <div className="nm">{item.nm}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ fontSize: '7.6px', marginTop: '16px', color: '#8f887a' }}>
            {companyData.nome_fantasia} · Total de páginas: 7 · Rastreabilidade ANVISA/BPF · Gerado em {formatarData(new Date().toISOString())}
          </div>
        </div>
      </div>

      {/* ===== FASE 1 — SEPARAÇÃO ===== */}
      <div className="page">
        <FaseHeader faseK="FASE 1 · PRÉ-PRODUÇÃO" faseT="Folha de Separação de Materiais" />

        {ativos.length > 0 && (
          <>
            <div className="sec"><span className="n">1</span><h2>Ativos (Princípios ativos)</h2><span className="cnt">{ativos.length} itens</span></div>
            <table>
              <thead>
                <tr>
                  <th className="c" style={{ width: '20px' }}>Ord.</th>
                  <th>Insumo</th>
                  <th className="num" style={{ width: '64px' }}>Teórica</th>
                  <th className="qc" style={{ width: '60px' }}>Lote MP</th>
                  <th className="qc c" style={{ width: '56px' }}>Validade</th>
                  <th className="qc c" style={{ width: '22px' }}><span className="box"></span></th>
                  <th className="qc" style={{ width: '96px' }}>Conferido por</th>
                </tr>
              </thead>
              <tbody>
                {ativos.map((item, idx) => (
                  <tr key={item.id}>
                    <td className="c">{idx + 1}</td>
                    <td>{item.insumo_nome}</td>
                    <td className="num">
                      {formatarQtd(item.quantidade_teorica_g)}
                      {ehCritico(item.quantidade_teorica_g) && (
                        <span className="tag" style={{ background:'#fbeee9', color:'#a8341f', marginLeft:'5px' }}>
                          ⚠ balança analítica · dupla conferência
                        </span>
                      )}
                    </td>
                    <td className="qc">{item.numero_lote || '—'}</td>
                    <td className="qc c">{item.data_validade ? formatarData(item.data_validade) : '—'}</td>
                    <td className="qc c"></td>
                    <td className="qc"></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {excipienteBase.length > 0 && (
          <>
            <div className="sec"><span className="n">2</span><h2>Excipiente base (Q.S.P.)</h2><span className="cnt">{excipienteBase.length} item</span></div>
            <table>
              <thead>
                <tr>
                  <th className="c" style={{ width: '20px' }}>Ord.</th>
                  <th>Insumo</th>
                  <th className="num" style={{ width: '64px' }}>Teórica</th>
                  <th className="qc" style={{ width: '60px' }}>Lote MP</th>
                  <th className="qc c" style={{ width: '56px' }}>Validade</th>
                  <th className="qc c" style={{ width: '22px' }}><span className="box"></span></th>
                  <th className="qc" style={{ width: '96px' }}>Conferido por</th>
                </tr>
              </thead>
              <tbody>
                {excipienteBase.map((item, idx) => (
                  <tr key={item.id}>
                    <td className="c">{ativos.length + idx + 1}</td>
                    <td>{item.insumo_nome}</td>
                    <td className="num">
                      {formatarQtd(item.quantidade_teorica_g)}
                      {ehCritico(item.quantidade_teorica_g) && (
                        <span className="tag" style={{ background:'#fbeee9', color:'#a8341f', marginLeft:'5px' }}>
                          ⚠ balança analítica · dupla conferência
                        </span>
                      )}
                    </td>
                    <td className="qc">{item.numero_lote || '—'}</td>
                    <td className="qc c">{item.data_validade ? formatarData(item.data_validade) : '—'}</td>
                    <td className="qc c"></td>
                    <td className="qc"></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {excipienteTec.length > 0 && (
          <>
            <div className="sec"><span className="n">3</span><h2>Excipientes tecnológicos</h2><span className="cnt">{excipienteTec.length} itens</span></div>
            <table>
              <thead>
                <tr>
                  <th className="c" style={{ width: '20px' }}>Ord.</th>
                  <th>Insumo</th>
                  <th className="num" style={{ width: '64px' }}>Teórica</th>
                  <th className="qc" style={{ width: '60px' }}>Lote MP</th>
                  <th className="qc c" style={{ width: '56px' }}>Validade</th>
                  <th className="qc c" style={{ width: '22px' }}><span className="box"></span></th>
                  <th className="qc" style={{ width: '96px' }}>Conferido por</th>
                </tr>
              </thead>
              <tbody>
                {excipienteTec.map((item, idx) => (
                  <tr key={item.id}>
                    <td className="c">{ativos.length + excipienteBase.length + idx + 1}</td>
                    <td>{item.insumo_nome}</td>
                    <td className="num">
                      {formatarQtd(item.quantidade_teorica_g)}
                      {ehCritico(item.quantidade_teorica_g) && (
                        <span className="tag" style={{ background:'#fbeee9', color:'#a8341f', marginLeft:'5px' }}>
                          ⚠ balança analítica · dupla conferência
                        </span>
                      )}
                    </td>
                    <td className="qc">{item.numero_lote || '—'}</td>
                    <td className="qc c">{item.data_validade ? formatarData(item.data_validade) : '—'}</td>
                    <td className="qc c"></td>
                    <td className="qc"></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {opData.op_embalagens && opData.op_embalagens.length > 0 && (
          <>
            <div className="sec"><span className="n">4</span><h2>Materiais de embalagem</h2><span className="cnt">{opData.op_embalagens.length} itens</span></div>
            <table>
              <thead>
                <tr>
                  <th className="c" style={{ width: '20px' }}>Ord.</th>
                  <th>Material</th>
                  <th className="num" style={{ width: '64px' }}>Necessária</th>
                  <th className="qc" style={{ width: '60px' }}>Lote</th>
                  <th className="qc c" style={{ width: '56px' }}>Validade</th>
                  <th className="qc c" style={{ width: '22px' }}><span className="box"></span></th>
                  <th className="qc" style={{ width: '96px' }}>Conferido por</th>
                </tr>
              </thead>
              <tbody>
                {opData.op_embalagens.map((item: any, idx: number) => (
                  <tr key={item.id}>
                    <td className="c">{idx + 1}</td>
                    <td>{item.insumo_nome}</td>
                    <td className="num">{item.quantidade_planejada} un</td>
                    <td className="qc">{item.numero_lote || '—'}</td>
                    <td className="qc c">{item.data_validade ? formatarData(item.data_validade) : '—'}</td>
                    <td className="qc c"></td>
                    <td className="qc"></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      {/* ===== FASE 2 — PESAGEM ===== */}
      <div className="page">
        <FaseHeader faseK="FASE 2 · PESAGEM" faseT="Folha de Pesagem de Matérias-Primas" />

        <div className="sec"><span className="n">1</span><h2>Condições ambientais</h2><span className="cnt">RDC 243/2018 · IN 28/2018 · RDC 843/2024</span></div>
        <div className="grid c4">
          <div className="cell"><div className="k">Temperatura</div><div className="v blank">______ °C</div></div>
          <div className="cell"><div className="k">Umidade relativa</div><div className="v blank">______ %</div></div>
          <div className="cell"><div className="k">Verificado por</div><div className="v blank">____________</div></div>
          <div className="cell"><div className="k">Hora</div><div className="v blank">______</div></div>
        </div>

        <div className="sec"><span className="n">2</span><h2>Pesagem de ativos</h2><span className="cnt">{ativos.length} itens · tolerância ±10%</span></div>
        <table>
          <thead><tr>
            <th className="c" style={{width:'20px'}}>Ord.</th><th>Insumo</th>
            <th className="num" style={{width:'64px'}}>Teórica</th>
            <th className="qc c" style={{width:'52px'}}>Balança nº</th>
            <th className="qc c" style={{width:'60px'}}>Peso real</th>
            <th className="qc" style={{width:'80px'}}>Lote MP</th>
            <th className="qc" style={{width:'70px'}}>Pesado por</th>
            <th className="qc c" style={{width:'20px'}}><span className="box"></span></th>
          </tr></thead>
          <tbody>{ativos.map((item,idx)=>(
            <tr key={item.id}>
              <td className="c">{idx+1}</td><td>{item.insumo_nome}</td>
              <td className="num">{formatarQtd(item.quantidade_teorica_g)}</td>
              <td className="qc"></td><td className="qc"></td><td className="qc"></td><td className="qc"></td><td className="qc c"></td>
            </tr>))}
          </tbody>
        </table>

        <div className="sec"><span className="n">3</span><h2>Pesagem de excipientes</h2><span className="cnt">{excipienteTec.length + excipienteBase.length} itens</span></div>
        <table>
          <thead><tr>
            <th className="c" style={{width:'20px'}}>Ord.</th><th>Insumo</th><th style={{width:'76px'}}>Categoria</th>
            <th className="num" style={{width:'64px'}}>Teórica</th>
            <th className="qc c" style={{width:'52px'}}>Balança nº</th>
            <th className="qc c" style={{width:'60px'}}>Peso real</th>
            <th className="qc" style={{width:'76px'}}>Lote MP</th>
            <th className="qc c" style={{width:'20px'}}><span className="box"></span></th>
          </tr></thead>
          <tbody>{[...excipienteTec, ...excipienteBase].map((item,idx)=>(
            <tr key={item.id}>
              <td className="c">{ativos.length+idx+1}</td><td>{item.insumo_nome}</td>
              <td>{item.categoria === 'EXCIPIENTE_BASE' ? 'Base (QSP)' : 'Tecnológico'}</td>
              <td className="num">{formatarQtd(item.quantidade_teorica_g)}</td>
              <td className="qc"></td><td className="qc"></td><td className="qc"></td><td className="qc c"></td>
            </tr>))}
          </tbody>
        </table>

        <div className="rules" style={{ marginBottom:'8px' }}>
          <b className="warn">Itens abaixo de 1 g são pesagem crítica:</b> usar balança analítica
          (mín. 4 casas decimais) e registrar dupla conferência (operador + conferente).
        </div>

        <div className="sec"><span className="n">4</span><h2>Referência de balanças</h2></div>
        <table>
          <thead><tr><th>Faixa de peso</th><th>Tipo de balança</th><th>Precisão</th></tr></thead>
          <tbody>
            <tr><td>≥ 1 kg</td><td>Semi-analítica</td><td>2 casas decimais</td></tr>
            <tr><td>1 g a 1 kg</td><td>Semi-analítica</td><td>3 ou 4 casas</td></tr>
            <tr><td>1 mg a 1 g</td><td>Analítica</td><td>4 ou 5 casas</td></tr>
            <tr><td>&lt; 1 mg</td><td>Ultra-analítica</td><td>5+ casas</td></tr>
          </tbody>
        </table>

        <div className="sec"><span className="n">5</span><h2>Assinaturas e aprovações</h2></div>
        <div className="signs">
          <div className="sign"><div className="line"></div><div className="who">&nbsp;</div><div className="role">Operador de pesagem</div><div className="date">Data/Hora: ____/____/______ __:__</div></div>
          <div className="sign"><div className="line"></div><div className="who">&nbsp;</div><div className="role">Conferente · verificação</div><div className="date">Data/Hora: ____/____/______ __:__</div></div>
          <div className="sign"><div className="line"></div><div className="who">{opData.rt_nome}</div><div className="role">RT · liberação da pesagem</div><div className="date">Data/Hora: ____/____/______ __:__</div></div>
        </div>
      </div>

      {/* ===== FASE 3 — MISTURA ===== */}
      <div className="page">
        <FaseHeader faseK="FASE 3 · MISTURA" faseT="Folha de Ordem de Mistura" />

        <div className="sec"><span className="n">1</span><h2>Regras obrigatórias de mistura</h2></div>
        <ul className="rules">
          <li><b>Homogeneização:</b> mínimo 5 minutos entre cada adição de componente.</li>
          <li><b>Dióxido de Silício:</b> adicionar ANTES do Talco para melhor fluidez.</li>
          <li><b className="warn">Estearato de Magnésio: SEMPRE adicionar POR ÚLTIMO</b> — máximo 2 minutos de mistura.</li>
          <li><b>Ambiente:</b> temperatura 15–25 °C · umidade relativa &lt; 60%.</li>
        </ul>

        {/* Distribuição geométrica para ativos < 1 g */}
        {ativos.filter(a => Number(a.quantidade_teorica_g) < 1).map((ativo) => {
          const passos = calcularDistribuicaoGeometrica(
            Number(ativo.quantidade_teorica_g) * 1000,      // ativo em mg
            (excipienteBase[0]?.quantidade_teorica_g ?? 0) * 1000 // diluente (amido) em mg
          );
          return (
            <div key={ativo.id}>
              <div className="sec"><span className="n warn" style={{ background:'var(--warn)' }}>⚠</span>
                <h2>Pré-mix / diluição geométrica — {ativo.insumo_nome}</h2>
                <span className="cnt">ativo ultra-crítico &lt; 1 g</span></div>
              <table>
                <thead><tr><th className="c" style={{width:'34px'}}>Passo</th><th>Descrição</th>
                  <th className="num" style={{width:'96px'}}>Massa adicionada</th>
                  <th className="num" style={{width:'96px'}}>Massa total</th>
                  <th className="c" style={{width:'80px'}}>Tempo</th></tr></thead>
                <tbody>{passos.map(p => (
                  <tr key={p.passo}><td className="c">{p.passo}</td><td>{p.descricao}</td>
                    <td className="num">{p.massa_adicionada}</td><td className="num">{p.massa_total}</td>
                    <td className="c">{p.tempo_mistura}</td></tr>
                ))}</tbody>
              </table>
              <div className="note warn">Homogeneizar cada etapa antes de adicionar a próxima; nunca adicionar o ativo direto na massa total.</div>
            </div>
          );
        })}

        <div className="sec"><span className="n">2</span><h2>Sequência de mistura</h2></div>
        <table>
          <thead><tr>
            <th className="c" style={{width:'30px'}}>Etapa</th><th>Componente</th>
            <th className="num" style={{width:'90px'}}>Quantidade</th><th style={{width:'96px'}}>Função</th>
            <th className="qc c" style={{width:'54px'}}>Início</th><th className="qc c" style={{width:'54px'}}>Fim</th>
            <th className="qc c" style={{width:'60px'}}>Tempo real</th>
          </tr></thead>
          <tbody>{(opData.op_materias_primas||[])
            .slice().sort((a:any,b:any)=>(a.ordem_mistura||0)-(b.ordem_mistura||0))
            .map((item:any,idx:number)=>{
              const ultimo = /estearato/i.test(item.insumo_nome || '');
              return (
              <tr key={item.id} style={ultimo ? {background:'#fbeee9'} : undefined}>
                <td className={"c"+(ultimo?" warn":"")}>{idx+1}</td>
                <td className={ultimo?"warn":undefined}>{item.insumo_nome}{ultimo?" (ÚLTIMO)":""}</td>
                <td className="num">{formatarQtd(item.quantidade_teorica_g)}</td>
                <td>{item.categoria === 'ATIVO' ? 'Princípio ativo' : (item.funcao_tecnologica || 'Excipiente')}</td>
                <td className="qc"></td><td className="qc"></td><td className="qc"></td>
              </tr>);
            })}
          </tbody>
        </table>

        <div className="sec"><span className="n">3</span><h2>Controle de qualidade — pó final</h2></div>
        <table>
          <thead><tr><th>Teste</th><th className="qc" style={{width:'130px'}}>Resultado</th><th className="c" style={{width:'96px'}}>Conforme?</th><th className="qc">Observação</th></tr></thead>
          <tbody>{['Aparência do pó','Cor','Fluidez','Homogeneidade visual','Ausência de grumos'].map((t)=>(
            <tr key={t}><td>{t}</td><td className="qc"></td><td className="c fill"><span className="box"></span> Sim &nbsp; <span className="box"></span> Não</td><td className="qc"></td></tr>
          ))}</tbody>
        </table>

        <div className="sec"><span className="n">4</span><h2>Assinaturas e aprovações</h2></div>
        <div className="signs">
          <div className="sign"><div className="line"></div><div className="who">&nbsp;</div><div className="role">Operador de mistura</div><div className="date">Data/Hora: ____/____/______ __:__</div></div>
          <div className="sign"><div className="line"></div><div className="who">&nbsp;</div><div className="role">Conferente · verificação</div><div className="date">Data/Hora: ____/____/______ __:__</div></div>
          <div className="sign"><div className="line"></div><div className="who">{opData.rt_nome}</div><div className="role">RT · liberação da mistura</div><div className="date">Data/Hora: ____/____/______ __:__</div></div>
        </div>
      </div>

      {/* ===== FASE 4 — ENCAPSULAMENTO ===== */}
      <div className="page">
        <FaseHeader faseK="FASE 4 · ENCAPSULAMENTO" faseT="Folha de Encapsulamento" />

        <div className="sec"><span className="n">1</span><h2>Setup da encapsuladora</h2></div>
        <table>
          <thead><tr><th>Item de verificação</th><th style={{width:'150px'}}>Parâmetro</th><th className="c" style={{width:'60px'}}>Verif.</th><th className="qc" style={{width:'120px'}}>Responsável</th></tr></thead>
          <tbody>
            <tr><td>Limpeza do equipamento</td><td>Visualmente limpo</td><td className="c fill"><span className="box"></span> OK</td><td className="qc"></td></tr>
            <tr><td>Troca de placas (se aplicável)</td><td>Tamanho {opData.tamanho_capsula || 0}</td><td className="c fill"><span className="box"></span> OK</td><td className="qc"></td></tr>
            <tr><td>Ajuste de dosagem</td><td>{pesoAlvo} mg ± 5%</td><td className="c fill"><span className="box"></span> OK</td><td className="qc"></td></tr>
            <tr><td>Teste de peso (10 cápsulas)</td><td>Dentro da tolerância</td><td className="c fill"><span className="box"></span> OK</td><td className="qc"></td></tr>
            <tr><td>Fechamento das cápsulas</td><td>Sem vazamento de pó</td><td className="c fill"><span className="box"></span> OK</td><td className="qc"></td></tr>
          </tbody>
        </table>

        <div className="sec"><span className="n">2</span><h2>Controle de peso durante produção</h2><span className="cnt">a cada 30 min ou 1.000 cáps · alvo {pesoAlvo} mg (±5%)</span></div>
        <table>
          <thead><tr><th style={{width:'54px'}}>Hora</th><th className="c">C.1</th><th className="c">C.2</th><th className="c">C.3</th><th className="c">C.4</th><th className="c">C.5</th><th className="c">Média</th><th className="c">Desvio</th><th className="c" style={{width:'40px'}}>OK?</th><th className="qc" style={{width:'80px'}}>Operador</th></tr></thead>
          <tbody>{[0,1,2,3].map(i=>(
            <tr key={i}><td className="qc"></td><td className="qc"></td><td className="qc"></td><td className="qc"></td><td className="qc"></td><td className="qc"></td><td className="qc"></td><td className="qc"></td><td className="c"><span className="box"></span></td><td className="qc"></td></tr>
          ))}</tbody>
        </table>

        <div className="sec"><span className="n">3</span><h2>Controle de qualidade e rendimento</h2></div>
        <div className="grid c4">
          <div className="cell"><div className="k">Planejada (+{perdas?.acrescimo_percentual ?? 5}%)</div><div className="v">{(perdas?.quantidade_com_acrescimo ?? opData.total_capsulas_com_acrescimo)?.toLocaleString('pt-BR')} un</div></div>
          <div className="cell"><div className="k">Produzida</div><div className="v blank">______</div></div>
          <div className="cell"><div className="k">Aprovada</div><div className="v blank">______</div></div>
          <div className="cell"><div className="k">Rendimento</div><div className="v blank">______ %</div></div>
        </div>

        <div className="sec"><span className="n">4</span><h2>Amostra de retenção</h2><span className="cnt">RDC 243/2018 · obrigatório BPF</span></div>
        <div className="grid c4">
          <div className="cell"><div className="k">Qtd. retida</div><div className="v blank">mín. 1 frasco</div></div>
          <div className="cell"><div className="k">Localização</div><div className="v blank">ex.: Prateleira A3-B2</div></div>
          <div className="cell"><div className="k">Data de coleta</div><div className="v">{formatarData(opData.data_fabricacao)}</div></div>
          <div className="cell"><div className="k">Descarte após</div><div className="v">validade + 12 meses</div></div>
        </div>

        <div className="sec"><span className="n">5</span><h2>Assinaturas e aprovações</h2></div>
        <div className="signs">
          <div className="sign"><div className="line"></div><div className="who">&nbsp;</div><div className="role">Operador de encapsulamento</div><div className="date">Data/Hora: ____/____/______ __:__</div></div>
          <div className="sign"><div className="line"></div><div className="who">&nbsp;</div><div className="role">Conferente · verificação</div><div className="date">Data/Hora: ____/____/______ __:__</div></div>
          <div className="sign"><div className="line"></div><div className="who">{opData.rt_nome}</div><div className="role">RT · liberação</div><div className="date">Data/Hora: ____/____/______ __:__</div></div>
        </div>
      </div>

      {/* ===== FASE 5 — EMBALAGEM ===== */}
      <div className="page">
        <FaseHeader faseK="FASE 5 · EMBALAGEM" faseT="Folha de Embalagem e Rotulagem" />

        <div className="sec"><span className="n">1</span><h2>Conferência de materiais de embalagem</h2><span className="cnt">{opData.op_embalagens?.length || 0} itens</span></div>
        <table>
          <thead><tr>
            <th className="c" style={{width:'20px'}}>Ord.</th><th>Material</th><th style={{width:'104px'}}>Tipo</th>
            <th className="num" style={{width:'70px'}}>Necessária</th><th className="qc" style={{width:'80px'}}>Lote</th>
            <th className="qc c" style={{width:'56px'}}>Qtd. usada</th><th className="qc c" style={{width:'20px'}}><span className="box"></span></th>
          </tr></thead>
          <tbody>{(opData.op_embalagens||[]).map((item:any,idx:number)=>(
            <tr key={item.id}><td className="c">{idx+1}</td><td>{item.insumo_nome}</td><td>{item.tipo_embalagem}</td>
              <td className="num">{item.quantidade_planejada} un</td><td className="qc"></td><td className="qc"></td><td className="qc c"></td></tr>
          ))}</tbody>
        </table>

        <div className="sec"><span className="n">2</span><h2>Conferência de rótulo</h2><span className="cnt warn">verificar ANTES de aplicar</span></div>
        <table>
          <thead><tr><th>Item de verificação</th><th className="c" style={{width:'96px'}}>Conforme?</th><th className="qc">Observação</th></tr></thead>
          <tbody>{[
            'Nome do produto confere com a OP',`Lote impresso: ${opData.lote_produto_acabado}`,
            'Data de fabricação impressa corretamente','Data de validade impressa corretamente',
            'Tabela nutricional presente e legível','Ingredientes listados corretamente',
            'Modo de uso / conservação presentes','Dados do fabricante presentes',
            'Registro / Dispensa ANVISA presente','Alegações conforme permitido pela ANVISA'
          ].map((t)=>(
            <tr key={t}><td>{t}</td><td className="c fill"><span className="box"></span> Sim <span className="box"></span> Não</td><td className="qc"></td></tr>
          ))}</tbody>
        </table>

        <div className="sec"><span className="n">3</span><h2>Envase, rotulagem e contagem final</h2></div>
        <div className="grid c4">
          <div className="cell"><div className="k">Frascos envasados</div><div className="v blank">______</div></div>
          <div className="cell"><div className="k">Frascos rotulados</div><div className="v blank">______</div></div>
          <div className="cell"><div className="k">Aprovados p/ expedição</div><div className="v blank">______</div></div>
          <div className="cell"><div className="k">Rejeitados</div><div className="v blank">______</div></div>
        </div>

        <div className="sec"><span className="n">4</span><h2>Assinaturas e aprovações</h2></div>
        <div className="signs">
          <div className="sign"><div className="line"></div><div className="who">&nbsp;</div><div className="role">Operador de embalagem</div><div className="date">Data/Hora: ____/____/______ __:__</div></div>
          <div className="sign"><div className="line"></div><div className="who">&nbsp;</div><div className="role">Conferente · verificação</div><div className="date">Data/Hora: ____/____/______ __:__</div></div>
          <div className="sign"><div className="line"></div><div className="who">{opData.rt_nome}</div><div className="role">RT · liberação final</div><div className="date">Data/Hora: ____/____/______ __:__</div></div>
        </div>
      </div>

      {/* ===== CHECKLIST OPERACIONAL ===== */}
      <div className="page">
        <FaseHeader faseK="VERIFICAÇÕES" faseT="Checklist Operacional e Liberação do Lote" />

        <ul className="rules" style={{marginBottom:'8px'}}>
          <li>Marcar cada item após verificação completa. Itens obrigatórios: 100% concluídos para liberar o lote.</li>
          <li>Não-conformidades devem ser registradas no bloco específico e comunicadas ao RT.</li>
          <li>Documento parte do dossiê de produção — arquivar por 5 anos.</li>
        </ul>

        {([
          ['PRE_PRODUCAO','Pré-produção'],['DURANTE_PRODUCAO','Durante a produção'],
          ['POS_PRODUCAO','Pós-produção'],['QC','Controle de qualidade']
        ] as const).map(([cat,label])=>{
          const itens = checklistCat(cat);
          if (!itens.length) return null;
          return (
            <table key={cat} style={{marginBottom:'6px'}}>
              <thead><tr><th className="c" style={{width:'20px'}}><span className="box"></span></th><th>{label} · {itens.length} itens</th><th className="c" style={{width:'90px'}}>Responsável</th><th className="c" style={{width:'50px'}}>Hora</th><th className="c" style={{width:'56px'}}>Data</th></tr></thead>
              <tbody>{itens.map((c:any)=>(
                <tr key={c.id}><td className="c"><span className="box"></span></td><td>{c.item}</td><td className="qc"></td><td className="qc"></td><td className="qc"></td></tr>
              ))}</tbody>
            </table>
          );
        })}

        <div className="sec"><span className="n warn" style={{background:'var(--warn)'}}>!</span><h2>Registro de não-conformidades</h2><span className="cnt">se houver</span></div>
        <table>
          <thead><tr><th className="c" style={{width:'18px'}}>#</th><th>Descrição</th><th>Ação corretiva</th><th style={{width:'90px'}}>Responsável</th><th className="c" style={{width:'80px'}}>Status</th><th className="c" style={{width:'56px'}}>Data</th></tr></thead>
          <tbody>{[1,2,3].map(n=>(
            <tr key={n}><td className="c">{n}</td><td className="qc"></td><td className="qc"></td><td className="qc"></td><td className="c fill"><span className="box"></span> Resolvido</td><td className="qc"></td></tr>
          ))}</tbody>
        </table>

        <div className="sec"><span className="n" style={{background:'#2e7d32'}}>✓</span><h2>Liberação do lote</h2></div>
        <div className="grid" style={{gridTemplateColumns:'1fr 1fr'}}>
          <div className="cell"><div className="k">Checklist 100% concluído?</div><div className="v fill"><span className="box"></span> Sim &nbsp; <span className="box"></span> Não</div></div>
          <div className="cell"><div className="k">Lote liberado para expedição?</div><div className="v fill"><span className="box"></span> Sim &nbsp; <span className="box"></span> Não</div></div>
          <div className="cell"><div className="k">Não-conformidades resolvidas?</div><div className="v fill"><span className="box"></span> Sim &nbsp; <span className="box"></span> Não &nbsp; <span className="box"></span> N/A</div></div>
          <div className="cell"><div className="k">Documentação completa?</div><div className="v fill"><span className="box"></span> Sim &nbsp; <span className="box"></span> Não</div></div>
        </div>

        <div className="sec"><span className="n">✎</span><h2>Assinaturas e aprovações finais</h2></div>
        <div className="signs">
          <div className="sign"><div className="line"></div><div className="who">&nbsp;</div><div className="role">Supervisor de produção</div><div className="date">Data/Hora: ____/____/______ __:__</div></div>
          <div className="sign"><div className="line"></div><div className="who">&nbsp;</div><div className="role">Controle de qualidade · QC</div><div className="date">Data/Hora: ____/____/______ __:__</div></div>
          <div className="sign"><div className="line"></div><div className="who">{opData.rt_nome}</div><div className="role">RT · liberação final do lote</div><div className="date">Data/Hora: ____/____/______ __:__</div></div>
        </div>
      </div>

      {/* RODAPÉ DINÂMICO — Aparece em todas as páginas na impressão */}
      <div className="footer">
        <div className="footer-left">
          <b>{companyData.nome_fantasia}</b> · RT: {opData.rt_nome} ({opData.rt_tipo_conselho}-{opData.rt_uf_conselho} {opData.rt_numero_registro})
        </div>
        <div className="footer-right">
          Lote {opData.lote_produto_acabado} · {formatarData(opData.data_fabricacao)} · Gerado por <b>www.brainx.erp</b> · Pág <span className="pageNumber">1</span>/<span className="totalPages">7</span>
        </div>
      </div>
    </div>
  );
}
