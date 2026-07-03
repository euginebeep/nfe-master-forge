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
          .op-doc{ background:#fff; padding:0; }
          .op-doc .page{ width:210mm; height:297mm; padding:9mm; margin:0 auto; box-shadow:none; }
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
        .op-doc .idx .row:last-child{ border-bottom:0; }
        .op-doc .idx .row .n{ font-weight:800; color:var(--ink); min-width:24px; }
        .op-doc .idx .row .t{ color:var(--ink-2); flex:1; }
      `}</style>

      {/* Página 1: Capa */}
      <div className="page">
        <div className="cover">
          <div className="co">ORDEM DE PRODUÇÃO</div>
          <h1>Produção Industrial</h1>
          <div className="op">{opData.codigo}</div>
          <div className="prod">{opData.produto_nome}</div>
          <div className="grid c4">
            <div className="cell"><div className="k">Fórmula</div><div className="v">{opData.formula_codigo}</div></div>
            <div className="cell"><div className="k">Lote</div><div className="v">{opData.lote_produto_acabado}</div></div>
            <div className="cell"><div className="k">Quantidade</div><div className="v">{opData.quantidade_frascos} fr</div></div>
            <div className="cell"><div className="k">Status</div><div className="v">{opData.status}</div></div>
          </div>
          <div className="idx">
            <div className="h">Conteúdo</div>
            <div className="row"><div className="n">1.</div><div className="t">Separação e Pesagem de Matérias-Primas</div></div>
            <div className="row"><div className="n">2.</div><div className="t">Preparação de Excipientes</div></div>
            <div className="row"><div className="n">3.</div><div className="t">Mistura e Distribuição Geométrica</div></div>
            <div className="row"><div className="n">4.</div><div className="t">Encapsulação</div></div>
            <div className="row"><div className="n">5.</div><div className="t">Embalagem</div></div>
            <div className="row"><div className="n">6.</div><div className="t">Controle de Qualidade</div></div>
            <div className="row"><div className="n">7.</div><div className="t">Assinaturas e Conformidade</div></div>
          </div>
        </div>
      </div>

      {/* Página 2: Separação e Pesagem */}
      <div className="page">
        <FaseHeader faseK="Fase 1" faseT="Separação e Pesagem" />
        <div className="sec"><div className="n">1</div><h2>Matérias-Primas (Ativos)</h2></div>
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Lote</th>
              <th>Validade</th>
              <th className="num">Qtd. Teórica</th>
              <th className="num">Qtd. Real</th>
              <th className="c">Conferência</th>
            </tr>
          </thead>
          <tbody>
            {ativos.map((item, i) => (
              <tr key={i}>
                <td>{item.nome_item}</td>
                <td className="qc">{item.numero_lote || '—'}</td>
                <td className="qc">{item.data_validade ? formatarData(item.data_validade) : '—'}</td>
                <td className="num">{formatarQtd(item.quantidade_mg)}{ehCritico(item.quantidade_mg) ? ' ⚠' : ''}</td>
                <td className="qc"><span className="fill">_______</span></td>
                <td className="c"><span className="box"></span></td>
              </tr>
            ))}
          </tbody>
        </table>
        {ativos.some(a => ehCritico(a.quantidade_mg)) && (
          <div className="rules" style={{ marginTop: '12px' }}>
            <strong>⚠ Pesagem Crítica Detectada</strong>
            <li>Use balança analítica (precisão ≥ 0,001 g)</li>
            <li>Dupla conferência obrigatória</li>
            <li>Registre na célula de quantidade real</li>
          </div>
        )}
      </div>

      {/* Página 3: Excipientes */}
      <div className="page">
        <FaseHeader faseK="Fase 2" faseT="Preparação de Excipientes" />
        <div className="sec"><div className="n">2</div><h2>Excipiente Base</h2></div>
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Lote</th>
              <th>Validade</th>
              <th className="num">Qtd. Teórica</th>
              <th className="num">Qtd. Real</th>
              <th className="c">Conferência</th>
            </tr>
          </thead>
          <tbody>
            {excipienteBase.map((item, i) => (
              <tr key={i}>
                <td>{item.nome_item}</td>
                <td className="qc">{item.numero_lote || '—'}</td>
                <td className="qc">{item.data_validade ? formatarData(item.data_validade) : '—'}</td>
                <td className="num">{formatarQtd(item.quantidade_mg)}</td>
                <td className="qc"><span className="fill">_______</span></td>
                <td className="c"><span className="box"></span></td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="sec" style={{ marginTop: '18px' }}><div className="n">2</div><h2>Excipiente Tecnológico</h2></div>
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Lote</th>
              <th>Validade</th>
              <th className="num">Qtd. Teórica</th>
              <th className="num">Qtd. Real</th>
              <th className="c">Conferência</th>
            </tr>
          </thead>
          <tbody>
            {excipienteTec.map((item, i) => (
              <tr key={i}>
                <td>{item.nome_item}</td>
                <td className="qc">{item.numero_lote || '—'}</td>
                <td className="qc">{item.data_validade ? formatarData(item.data_validade) : '—'}</td>
                <td className="num">{formatarQtd(item.quantidade_mg)}</td>
                <td className="qc"><span className="fill">_______</span></td>
                <td className="c"><span className="box"></span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Página 4: Mistura e Distribuição Geométrica */}
      <div className="page">
        <FaseHeader faseK="Fase 3" faseT="Mistura e Distribuição Geométrica" />
        
        {ativos.some(a => ehCritico(a.quantidade_mg)) && (
          <>
            <div className="sec"><div className="n">3</div><h2>Pré-Mix Geométrico</h2></div>
            <table>
              <thead>
                <tr>
                  <th>Passo</th>
                  <th>Descrição</th>
                  <th className="num">Massa (g)</th>
                  <th className="num">Tempo (min)</th>
                </tr>
              </thead>
              <tbody>
                {calcularDistribuicaoGeometrica(
                  ativos.filter(a => ehCritico(a.quantidade_mg)).map(a => ({ ...a, quantidade_mg: a.quantidade_mg || 0 })),
                  1000
                ).passos.map((passo, i) => (
                  <tr key={i}>
                    <td className="c">{passo.passo}</td>
                    <td>{passo.descricao}</td>
                    <td className="num">{passo.massa}</td>
                    <td className="num">{passo.tempo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <div className="sec"><div className="n">3</div><h2>Sequência de Mistura</h2></div>
        <div className="rules">
          <li>Adicionar ativos em pequenas porções</li>
          <li>Misturar por 5 minutos entre adições</li>
          <li>Verificar homogeneidade visual</li>
          <li>Registrar tempo de início e fim</li>
        </div>
      </div>

      {/* Página 5: Encapsulação */}
      <div className="page">
        <FaseHeader faseK="Fase 4" faseT="Encapsulação" />
        <div className="sec"><div className="n">4</div><h2>Parâmetros de Encapsulação</h2></div>
        <div className="grid c4">
          <div className="cell"><div className="k">Peso Alvo</div><div className="v">{formatarQtd(pesoAlvo)}</div></div>
          <div className="cell"><div className="k">Tolerância</div><div className="v">±5%</div></div>
          <div className="cell"><div className="k">Velocidade</div><div className="v">{opData.velocidade_encapsuladora || '—'} cáps/min</div></div>
          <div className="cell"><div className="k">Temperatura</div><div className="v">{opData.temperatura_ambiente || '—'}°C</div></div>
        </div>

        <div className="sec"><div className="n">4</div><h2>Pesagens Críticas</h2></div>
        <table>
          <thead>
            <tr>
              <th>Hora</th>
              <th className="num">Peso (mg)</th>
              <th className="c">Dentro Especificação</th>
              <th>Observações</th>
            </tr>
          </thead>
          <tbody>
            {(opData.op_pesagens_criticas || []).map((p, i) => (
              <tr key={i}>
                <td>{formatarData(p.data_pesagem)}</td>
                <td className="num">{formatarQtd(p.peso_mg)}</td>
                <td className="c"><span className="box"></span></td>
                <td className="qc">{p.observacoes || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Página 6: Embalagem */}
      <div className="page">
        <FaseHeader faseK="Fase 5" faseT="Embalagem" />
        <div className="sec"><div className="n">5</div><h2>Materiais de Embalagem</h2></div>
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Lote</th>
              <th>Validade</th>
              <th className="num">Qtd. Teórica</th>
              <th className="num">Qtd. Real</th>
              <th className="c">Conferência</th>
            </tr>
          </thead>
          <tbody>
            {(opData.op_embalagens || []).map((item, i) => (
              <tr key={i}>
                <td>{item.nome_item}</td>
                <td className="qc">{item.numero_lote || '—'}</td>
                <td className="qc">{item.data_validade ? formatarData(item.data_validade) : '—'}</td>
                <td className="num">{formatarQtd(item.quantidade_mg)}</td>
                <td className="qc"><span className="fill">_______</span></td>
                <td className="c"><span className="box"></span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Página 7: Controle de Qualidade e Assinaturas */}
      <div className="page">
        <FaseHeader faseK="Fase 6" faseT="Controle de Qualidade" />
        <div className="sec"><div className="n">6</div><h2>Checklist de Qualidade</h2></div>
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th className="c">Conforme</th>
              <th className="c">Não Conforme</th>
              <th>Observações</th>
            </tr>
          </thead>
          <tbody>
            {checklistCat('QUALIDADE').map((c, i) => (
              <tr key={i}>
                <td>{c.descricao}</td>
                <td className="c"><span className="box"></span></td>
                <td className="c"><span className="box"></span></td>
                <td className="qc">—</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="sec"><div className="n">7</div><h2>Assinaturas e Conformidade</h2></div>
        <div className="signs">
          <div className="sign">
            <div className="line"></div>
            <div className="who">{opData.rt_nome}</div>
            <div className="role">Responsável Técnico</div>
            <div className="reg">{opData.rt_tipo_conselho}: {opData.rt_numero_registro}/{opData.rt_uf_conselho}</div>
            <div className="date">{formatarData(new Date().toISOString())}</div>
          </div>
          <div className="sign">
            <div className="line"></div>
            <div className="who">_________________</div>
            <div className="role">Supervisor de Produção</div>
            <div className="date">{formatarData(new Date().toISOString())}</div>
          </div>
          <div className="sign">
            <div className="line"></div>
            <div className="who">_________________</div>
            <div className="role">Controle de Qualidade</div>
            <div className="date">{formatarData(new Date().toISOString())}</div>
          </div>
        </div>
      </div>

      <div className="footer">
        <div className="footer-left">BrainX ERP · OP <b>{opData.codigo}</b> · {formatarData(new Date().toISOString())}</div>
        <div className="footer-right">RT: {opData.rt_tipo_conselho}: {opData.rt_numero_registro}/{opData.rt_uf_conselho}</div>
      </div>
    </div>
  );
}
