import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import type { OPIndustrialData } from '@/types/op-industrial';
import { SIMBOLO_MICROGRAMA } from '@/lib/unidades-dose';

interface OPImpressaoProps {
  opId?: string;
  autoprint?: boolean;
}

/**
 * OP Industrial — Registro de Produção de Lote (BPF) em A4.
 * Documento único, data-driven, padrão para todos os tenants.
 * Rota: /producao/ordens/:id/imprimir  (autoprint quando autoprint=true)
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
    if (!opId) { setError('ID da OP não fornecido'); setLoading(false); return; }
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

        const company = op.company as any;
        const dataEvento =
          (op as any).data_inicio ||
          (op as any).created_at ||
          new Date().toISOString();
        const companyId = (op as any).company_id || company?.id;

        if (companyId && company) {
          const { empresaRazaoSocialEm, empresaRtEm } = await import('@/lib/empresa-historico');
          const razao = await empresaRazaoSocialEm(
            companyId,
            dataEvento,
            company.razao_social || company.nome_fantasia || '—',
          );
          const rt = await empresaRtEm(companyId, dataEvento);
          setCompanyData({
            ...company,
            razao_social: razao,
            // RT histórico sobrescreve campos da OP só na impressão quando a RPC responder
            ...(rt
              ? {
                  _rt_historico: rt,
                }
              : {}),
          });
        } else {
          setCompanyData(company);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : JSON.stringify(err);
        setError(`Erro ao carregar OP: ${errorMsg}`);
      } finally { setLoading(false); }
    };
    fetchData();
  }, [opId]);

  useEffect(() => {
    if (!companyData?.logo_file_id) return;
    (async () => {
      try {
        const { data: arquivo } = await supabase
          .from('arquivos')
          .select('storage_key')
          .eq('id', companyData.logo_file_id)
          .maybeSingle();
        if (!arquivo?.storage_key) return;
        const { data: signed } = await supabase.storage
          .from('erp-files')
          .createSignedUrl(arquivo.storage_key, 3600);
        setLogoUrl(signed?.signedUrl || '');
      } catch (err) {
        console.error('Erro ao carregar logo da empresa na OP:', err);
      }
    })();
  }, [companyData]);

  useEffect(() => {
    if (autoprint && !loading && opData) setTimeout(() => window.print(), 500);
  }, [loading, opData, autoprint]);

  if (loading) return <div style={{ padding: 20, textAlign: 'center' }}><p>Carregando dados da OP...</p></div>;
  if (error) return <div style={{ padding: 20, color: 'red' }}><p>Erro: {error}</p></div>;
  if (!opData || !companyData) return <div style={{ padding: 20 }}><p>Nenhum dado encontrado</p></div>;

  // ===== agrupamentos =====
  const mps = opData.op_materias_primas || [];
  const ativos = mps.filter((m: any) => m?.categoria === 'ATIVO');
  const excipienteBase = mps.filter((m: any) => m?.categoria === 'EXCIPIENTE_BASE');
  const excipienteTec = mps.filter((m: any) => m?.categoria === 'EXCIPIENTE_TECNOLOGICO');
  const embalagens = opData.op_embalagens || [];
  const perdas = opData.op_controle_perdas?.[0];

  // ===== helpers =====
  const op: any = opData; // acesso seguro a campos novos (ainda não tipados)
  const totalCaps = Number(opData.total_capsulas_com_acrescimo) || 0;
  const formatarQtd = (valorG: number | null | undefined): string => {
    if (valorG == null || isNaN(Number(valorG))) return '—';
    const g = Number(valorG); let n: number, u: string;
    if (g < 1) { n = g * 1000; u = 'mg'; } else if (g < 1000) { n = g; u = 'g'; } else { n = g / 1000; u = 'kg'; }
    return `${n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} ${u}`;
  };
  // massa por cápsula a partir da quantidade teórica do lote (g) → mg/cápsula
  const porCapsula = (valorG: number | null | undefined): string => {
    if (valorG == null || totalCaps <= 0) return '—';
    const mg = (Number(valorG) * 1000) / totalCaps;
    if (mg < 1) return `${(mg * 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${SIMBOLO_MICROGRAMA}`;
    return `${mg.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} mg`;
  };
  const ehCritico = (g: number | null | undefined) => g != null && !isNaN(Number(g)) && Number(g) < 1;
  const formatarData = (d: string | null): string => d ? new Date(d).toLocaleDateString('pt-BR') : '';
  const checklistCat = (cat: string) => (opData.op_checklist || []).filter((c: any) => c.categoria === cat).sort((a: any, b: any) => (a.ordem || 0) - (b.ordem || 0));
  const pesoAlvo = op.peso_capsula_mg || 500;
  const rtHist = (companyData as any)?._rt_historico;
  const conselho = rtHist
    ? `${rtHist.tipo_conselho || ''}-${rtHist.uf_conselho || ''} ${rtHist.numero_registro || ''}`.trim()
    : `${opData.rt_tipo_conselho || ''}-${opData.rt_uf_conselho || ''} ${opData.rt_numero_registro || ''}`.trim();
  const rtNome = rtHist?.nome || opData.rt_nome || null;

  // ===== campos de empresa/cliente (novos — com fallback seguro) =====
  const fabNome = (companyData as any).razao_social || companyData.nome_fantasia || '—';
  const fabCnpj = (companyData as any).cnpj || '';
  const fabEndereco = [
    (companyData as any).endereco_logradouro,
    (companyData as any).endereco_nro,
    (companyData as any).endereco_bairro,
    (companyData as any).endereco_cidade && (companyData as any).endereco_uf
      ? `${(companyData as any).endereco_cidade}/${(companyData as any).endereco_uf}`
      : (companyData as any).endereco_cidade || (companyData as any).endereco_uf,
    (companyData as any).endereco_cep ? `CEP ${(companyData as any).endereco_cep}` : null,
  ].filter(Boolean).join(' · ');
  const clienteNome = (opData as any).cliente_nome || null; // null = produção própria
  const clienteCnpj = (opData as any).cliente_cnpj || '';
  const statusLabel = (op.status || 'PLANEJADA').toUpperCase();
  const Logo = ({ big = false }: { big?: boolean }) => (
    <div className={`logo${big ? ' logo-large' : ''}`}>
      {logoUrl ? <img src={logoUrl} alt="Logo" /> : <><b>{(companyData.nome_fantasia || companyData.razao_social || 'OP').substring(0, 2).toUpperCase()}</b><span>{(companyData.nome_fantasia || companyData.razao_social || '').substring(0, 5).toUpperCase()}</span></>}
    </div>
  );

  // ===== cabeçalho padrão (barra estilo documento controlado) =====
  const PBar = () => (
    <div className="pbar">
      <Logo />
      <div>
        <div className="fabn">{fabNome}</div>
        <div className="fabd">{fabCnpj && `CNPJ ${fabCnpj}`}{fabEndereco && ` · ${fabEndereco}`}</div>
        <div className="cli">Fabricado para: {clienteNome ? `${clienteNome}${clienteCnpj ? ` · CNPJ ${clienteCnpj}` : ''}` : 'Produção própria'}</div>
      </div>
      <div className="r"><div className="k">Ordem de Produção</div><div className="opn">{opData.codigo}</div><div className="st">{statusLabel}</div></div>
    </div>
  );
  const FaseHeader = ({ faseK, faseT }: { faseK: string; faseT: string }) => (
    <>
      <PBar />
      <div className="ptitle"><div className="t">{faseT}</div><div className="s">{faseK} · Lote {opData.lote_produto_acabado}{op.formula_codigo ? ` · Fórmula ${op.formula_codigo}` : ''}</div></div>
      <div className="band">
        <div className="b"><div className="k">Quantidade</div><div className="v">{opData.quantidade_frascos} fr × {opData.capsulas_por_frasco} un</div></div>
        <div className="b"><div className="k">Total c/ acréscimo</div><div className="v">{totalCaps.toLocaleString('pt-BR')} un</div></div>
        <div className="b"><div className="k">Resp. técnico</div><div className="v">{rtNome}</div></div>
        <div className="b"><div className="k">Conselho</div><div className="v">{conselho}</div></div>
        <div className="b"><div className="k">Fabricação</div><div className="v">{formatarData(opData.data_fabricacao)}</div></div>
        <div className="b"><div className="k">Validade</div><div className="v">{formatarData(opData.data_validade)}</div></div>
      </div>
    </>
  );
  const Signs = ({ a, b, c }: { a: string; b: string; c: string }) => (
    <div className="signs">
      <div className="sign"><div className="line" /><div className="who">&nbsp;</div><div className="role">{a}</div><div className="date">Data/Hora: ____/____/______ __:__</div></div>
      <div className="sign"><div className="line" /><div className="who">&nbsp;</div><div className="role">{b}</div><div className="date">Data/Hora: ____/____/______ __:__</div></div>
      <div className="sign"><div className="line" /><div className="who">{rtNome}</div><div className="role">{c}</div><div className="date">Data/Hora: ____/____/______ __:__</div></div>
    </div>
  );

  return (
    <div ref={containerRef} className="op-doc" style={{ width: '100%' }}>
      <style>{`
        .op-doc{ --ink:#14110d; --ink-2:#4a453c; --line:#ddd7c9; --line-2:#bcb4a4; --gold:#b8860b; --gold-soft:#f5edd6; --zebra:#faf8f2; --blank:#c3bcac; --warn:#a8341f;
          font-family:"Helvetica Neue",Arial,sans-serif; color:var(--ink-2); font-size:11px; line-height:1.3; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
        .op-doc *{ box-sizing:border-box; margin:0; padding:0; }
        .op-doc .page{ background:#fff; break-after:page; }
        .op-doc .page:last-child{ break-after:auto; }
        @media screen{ .op-doc{ background:#eef0ea; padding:18px 0; } .op-doc .page{ width:100%; max-width:820px; padding:30px 32px; margin:0 auto 18px; border-radius:4px; box-shadow:0 1px 0 #dcdfd7,0 10px 30px -20px rgba(0,0,0,.35); } .op-doc .footer{ display:none; } .op-doc .op-toolbar{ max-width:820px; margin:0 auto 12px; display:flex; align-items:center; justify-content:space-between; gap:12px; padding:10px 14px; background:#fff; border:1px solid var(--line); border-radius:8px; font-size:12px; } .op-doc .op-toolbar button{ border:0; background:var(--ink); color:#fff; font-weight:700; font-size:12px; padding:9px 16px; border-radius:8px; cursor:pointer; font-family:inherit; } }
        @page{ size:A4; margin:0; }
        @media print{ html,body{ margin:0!important; } .op-doc{ background:#fff; padding:0; } .op-doc .page{ width:210mm; height:297mm; min-height:auto; padding:9mm 8mm 15mm; margin:0; box-shadow:none; overflow:hidden; page-break-after:always; break-after:page; } .op-doc .page:last-child{ page-break-after:auto; break-after:auto; } .op-doc .op-toolbar{ display:none; } .op-doc .footer{ position:fixed; bottom:0; left:0; right:0; height:12mm; padding:0 8mm; display:flex; align-items:center; justify-content:space-between; font-size:6px; color:#8f887a; } }
        .op-doc .pbar{ display:grid; grid-template-columns:auto 1fr auto; gap:12px; align-items:center; padding-bottom:7px; border-bottom:2.5px solid var(--ink); }
        .op-doc .logo{ width:46px; height:46px; border:2px solid var(--gold); border-radius:9px; background:var(--gold-soft); display:flex; flex-direction:column; align-items:center; justify-content:center; color:var(--ink); flex:none; overflow:hidden; }
        .op-doc .logo img{ width:100%; height:100%; object-fit:contain; } .op-doc .logo b{ font-size:15px; line-height:1; } .op-doc .logo span{ font-size:5px; letter-spacing:1px; color:var(--gold); font-weight:800; } .op-doc .logo-large{ width:56px; height:56px; }
        .op-doc .pbar .fabn{ font-size:13px; font-weight:800; color:var(--ink); } .op-doc .pbar .fabd{ font-size:7px; color:var(--ink-2); margin-top:1px; } .op-doc .pbar .cli{ font-size:7px; color:var(--gold); font-weight:800; margin-top:2px; text-transform:uppercase; letter-spacing:.3px; }
        .op-doc .pbar .r{ text-align:right; } .op-doc .pbar .r .k{ font-size:6.4px; letter-spacing:2px; color:var(--gold); font-weight:800; text-transform:uppercase; } .op-doc .pbar .r .opn{ font-size:16px; font-weight:800; color:var(--ink); } .op-doc .pbar .r .st{ display:inline-block; margin-top:2px; background:var(--ink); color:#fff; font-size:6.6px; font-weight:800; letter-spacing:1px; padding:2px 9px; border-radius:12px; }
        .op-doc .ptitle{ display:flex; justify-content:space-between; align-items:baseline; margin:6px 0 8px; } .op-doc .ptitle .t{ font-size:14px; font-weight:800; color:var(--ink); } .op-doc .ptitle .s{ font-size:8px; color:var(--ink-2); }
        .op-doc .band{ display:grid; grid-template-columns:repeat(6,1fr); background:var(--zebra); border:1px solid var(--line); border-radius:6px; overflow:hidden; margin-bottom:10px; }
        .op-doc .band .b{ padding:5px 9px; border-right:1px solid var(--line); } .op-doc .band .b:last-child{ border-right:0; }
        .op-doc .band .k{ font-size:6.4px; letter-spacing:.4px; text-transform:uppercase; color:var(--gold); font-weight:800; } .op-doc .band .v{ font-size:10px; color:var(--ink); font-weight:700; }
        .op-doc .sec{ display:flex; align-items:center; gap:7px; margin:11px 0 5px; } .op-doc .sec .n{ min-width:16px; height:16px; padding:0 4px; border-radius:4px; background:var(--gold); color:#fff; font-size:9px; font-weight:800; display:flex; align-items:center; justify-content:center; } .op-doc .sec h2{ font-size:10px; font-weight:800; color:var(--ink); letter-spacing:.3px; text-transform:uppercase; } .op-doc .sec .cnt{ margin-left:auto; font-size:8px; color:var(--ink-2); }
        .op-doc table{ width:100%; border-collapse:collapse; font-size:9px; } .op-doc thead th{ background:var(--ink); color:#fff; font-weight:700; text-align:left; padding:4px 6px; font-size:7px; letter-spacing:.2px; text-transform:uppercase; }
        .op-doc tbody td{ padding:4px 6px; border-bottom:1px solid var(--line); vertical-align:middle; } .op-doc tbody tr:nth-child(even){ background:var(--zebra); }
        .op-doc td.num,.op-doc th.num{ text-align:right; font-variant-numeric:tabular-nums; } .op-doc td.c,.op-doc th.c{ text-align:center; }
        .op-doc .qc{ background:#fffdf6; } .op-doc .fill{ color:var(--blank); } .op-doc .box{ display:inline-block; width:9px; height:9px; border:1.1px solid var(--ink-2); border-radius:2px; vertical-align:-1px; } .op-doc .warn{ color:var(--warn); font-weight:700; }
        .op-doc .tag{ font-size:6.4px; font-weight:800; padding:1px 5px; border-radius:20px; background:var(--gold-soft); color:#8a6608; text-transform:uppercase; } .op-doc .tag.e{ background:#eef1f4; color:#4a586b; } .op-doc .tag.r{ background:#fbeee9; color:#a8341f; }
        .op-doc .grid{ display:grid; border:1px solid var(--line-2); border-radius:5px; overflow:hidden; } .op-doc .grid.c2{ grid-template-columns:repeat(2,1fr); } .op-doc .grid.c3{ grid-template-columns:repeat(3,1fr); } .op-doc .grid.c4{ grid-template-columns:repeat(4,1fr); }
        .op-doc .grid .cell{ padding:5px 9px; border-right:1px solid var(--line); border-bottom:1px solid var(--line); } .op-doc .grid.c4 .cell:nth-child(4n){ border-right:0; } .op-doc .grid.c3 .cell:nth-child(3n){ border-right:0; } .op-doc .grid.c2 .cell:nth-child(2n){ border-right:0; }
        .op-doc .grid .k{ font-size:6.4px; letter-spacing:.4px; text-transform:uppercase; color:var(--gold); font-weight:800; } .op-doc .grid .v{ font-size:10px; color:var(--ink); font-weight:700; margin-top:1px; } .op-doc .grid .v.blank{ color:var(--blank); font-weight:500; }
        .op-doc .comp tfoot td{ background:var(--gold-soft); font-weight:800; color:var(--ink); border-top:1.5px solid var(--gold); } .op-doc .comp td.mg{ text-align:right; font-weight:700; color:var(--ink); }
        .op-doc .fabcli{ display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:11px; } .op-doc .fabcli .card{ border:1px solid var(--line-2); border-radius:6px; padding:8px 11px; } .op-doc .fabcli .t{ font-size:6.4px; letter-spacing:1px; text-transform:uppercase; color:var(--gold); font-weight:800; } .op-doc .fabcli .nm{ font-size:9px; font-weight:800; color:var(--ink); margin-top:2px; } .op-doc .fabcli .d{ font-size:7px; margin-top:1px; }
        .op-doc .hashbox{ display:flex; gap:12px; align-items:center; border:1px solid var(--line-2); border-radius:8px; padding:10px 12px; margin-top:11px; background:var(--zebra); } .op-doc .hashbox .qt{ font-size:6.4px; letter-spacing:1px; text-transform:uppercase; color:var(--gold); font-weight:800; } .op-doc .hashbox .qh{ font-family:monospace; font-size:7px; color:var(--ink-2); word-break:break-all; margin-top:3px; }
        .op-doc .signs{ display:grid; grid-template-columns:repeat(3,1fr); gap:14px; margin-top:12px; break-inside:avoid; } .op-doc .sign{ padding-top:22px; } .op-doc .sign .line{ border-top:1.3px solid var(--ink); } .op-doc .sign .who{ font-size:9px; font-weight:800; color:var(--ink); margin-top:4px; min-height:11px; } .op-doc .sign .role{ font-size:6.4px; letter-spacing:.5px; text-transform:uppercase; color:var(--gold); font-weight:800; margin-top:1px; } .op-doc .sign .date{ font-size:7px; margin-top:4px; }
        .op-doc .rules{ border:1px solid var(--gold); border-radius:6px; background:#fffdf6; padding:7px 12px; font-size:9px; } .op-doc .rules li{ margin:2px 0; list-style:none; padding-left:14px; position:relative; } .op-doc .rules li:before{ content:"▸"; color:var(--gold); position:absolute; left:0; font-weight:800; }
        .op-doc .obs{ font-size:6.6px; color:var(--blank); border-bottom:1px dotted var(--line-2); margin-top:2px; } .op-doc .footer .fl b{ color:#4a453c; }
      `}</style>

      {!autoprint && (
        <div className="op-toolbar">
          <span>Pré-visualização · {opData.codigo}</span>
          <button type="button" onClick={() => window.open(`/producao/ordens/${opId}/imprimir`, '_blank')}>🖨️ Imprimir / Salvar PDF (A4)</button>
        </div>
      )}

      {/* ===== PÁGINA 1 — FOLHA DE ROSTO ===== */}
      <div className="page">
        <PBar />
        <div className="ptitle"><div className="t">{opData.produto_nome}</div><div className="s">Registro de produção de lote · Documento controlado (BPF)</div></div>

        <div className="sec"><span className="n">1</span><h2>Identificação do lote</h2></div>
        <div className="grid c4">
          <div className="cell"><div className="k">Fórmula</div><div className="v">{op.formula_codigo || '—'}</div></div>
          <div className="cell"><div className="k">Lote do produto acabado</div><div className="v">{opData.lote_produto_acabado}</div></div>
          <div className="cell"><div className="k">Fabricação</div><div className="v">{formatarData(opData.data_fabricacao)}</div></div>
          <div className="cell"><div className="k">Validade</div><div className="v">{formatarData(opData.data_validade)}</div></div>
          <div className="cell"><div className="k">Frascos</div><div className="v">{opData.quantidade_frascos}</div></div>
          <div className="cell"><div className="k">Cápsulas (+acréscimo)</div><div className="v">{totalCaps.toLocaleString('pt-BR')}</div></div>
          <div className="cell"><div className="k">Cápsula</div><div className="v">#{op.tamanho_capsula ?? 0} · {pesoAlvo} mg</div></div>
          <div className="cell"><div className="k">Excipiente base</div><div className="v">{excipienteBase[0]?.insumo_nome || 'Amido (QSP)'}</div></div>
          <div className="cell" style={{ gridColumn: 'span 2' }}><div className="k">Responsável técnico</div><div className="v">{rtNome} · {conselho}</div></div>
          <div className="cell" style={{ gridColumn: 'span 2' }}><div className="k">Responsável de produção</div><div className="v">{op.responsavel_producao_nome || '—'}</div></div>
        </div>

        <div className="sec"><span className="n">2</span><h2>Composição por cápsula</h2><span className="cnt">enchimento {pesoAlvo} mg</span></div>
        <table className="comp">
          <thead><tr><th>Componente</th><th style={{ width: '90px' }}>Categoria</th><th className="c" style={{ width: '78px' }}>Por cápsula</th><th className="num" style={{ width: '80px' }}>No lote</th></tr></thead>
          <tbody>
            {[...ativos, ...excipienteTec, ...excipienteBase].map((m: any) => (
              <tr key={m.id}>
                <td>{m.insumo_nome}</td>
                <td>{m.categoria === 'ATIVO' ? 'Ativo' : m.categoria === 'EXCIPIENTE_BASE' ? 'Veículo base (QSP)' : (m.funcao || 'Excipiente')}</td>
                <td className="mg c">{porCapsula(m.quantidade_teorica_g)}</td>
                <td className="num">{formatarQtd(m.quantidade_teorica_g)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr><td colSpan={2}>Total de enchimento por cápsula</td><td className="mg c">{pesoAlvo} mg</td><td className="num">{formatarQtd(op.peso_mistura_kg ? op.peso_mistura_kg * 1000 : null)}</td></tr></tfoot>
        </table>

        <div className="sec"><span className="n">3</span><h2>Parâmetros de fabricação</h2></div>
        <div className="grid c4">
          <div className="cell"><div className="k">Peso da mistura</div><div className="v">{op.peso_mistura_kg ? `${op.peso_mistura_kg.toLocaleString('pt-BR')} kg` : '—'}</div></div>
          <div className="cell"><div className="k">Densidade do pó</div><div className="v">{op.densidade_kg_l ? `${op.densidade_kg_l} kg/L` : '—'}</div></div>
          <div className="cell"><div className="k">Volume de pó</div><div className="v">{op.volume_po_l ? `≈ ${op.volume_po_l} L` : '—'}</div></div>
          <div className="cell"><div className="k">Sílica sachê</div><div className="v">{op.silica_sache ? '1 g / frasco' : '—'}</div></div>
          <div className="cell"><div className="k">Sala / máquina</div><div className="v blank">______ / ______</div></div>
          <div className="cell"><div className="k">Turno</div><div className="v blank">______</div></div>
          <div className="cell"><div className="k">Temp. / umidade início</div><div className="v blank">___°C / ___%</div></div>
          <div className="cell"><div className="k">Registro/Notificação ANVISA</div><div className="v">{op.registro_anvisa_produto || '___________'}</div></div>
        </div>

        <div className="fabcli">
          <div className="card"><div className="t">Fabricante</div><div className="nm">{fabNome}</div><div className="d">{fabCnpj && `CNPJ ${fabCnpj}`}{fabEndereco && ` · ${fabEndereco}`}</div><div className="d">AFE ANVISA: {(companyData as any).afe_anvisa || '__________'} · Licença Sanitária: {(companyData as any).licenca_sanitaria || '__________'}</div></div>
          <div className="card"><div className="t">Fabricado para (cliente / marca)</div><div className="nm">{clienteNome || 'Produção própria'}</div><div className="d">CNPJ do cliente: {clienteCnpj || '— (não aplicável)'}</div></div>
        </div>

        {op.hash_documento && (
          <div className="hashbox"><div><div className="qt">Rastreabilidade verificável — Controle ANVISA/BPF</div><div className="qh">SHA-256: {op.hash_documento}</div><div className="qh">{fabEndereco ? 'www.brainxerp.com/audit/lote/…' : ''}</div></div></div>
        )}
      </div>

      {/* ===== FASE 1 — SEPARAÇÃO ===== */}
      <div className="page">
        <FaseHeader faseK="FASE 1 · PRÉ-PRODUÇÃO" faseT="Folha de Separação de Materiais" />
        <div className="sec"><span className="n">1</span><h2>Ativos e princípios ativos</h2><span className="cnt">{ativos.length} itens</span></div>
        <table><thead><tr><th className="c" style={{ width: '18px' }}>Ord.</th><th>Insumo</th><th className="num" style={{ width: '60px' }}>Qtd. necessária</th><th className="qc" style={{ width: '76px' }}>Lote MP</th><th className="qc c" style={{ width: '50px' }}>Validade</th><th className="qc c" style={{ width: '16px' }}><span className="box" /></th><th className="qc" style={{ width: '74px' }}>Executado por</th><th className="qc" style={{ width: '74px' }}>Conferido por</th></tr></thead>
          <tbody>{ativos.map((m: any, i: number) => (<tr key={m.id}><td className="c">{i + 1}</td><td>{m.insumo_nome}{ehCritico(m.quantidade_teorica_g) && <span className="tag r" style={{ marginLeft: 5 }}>⚠ crítico</span>}</td><td className="num">{formatarQtd(m.quantidade_teorica_g)}</td><td className="qc">{m.numero_lote || '—'}</td><td className="qc c">{m.data_validade ? formatarData(m.data_validade) : '—'}</td><td className="qc c" /><td className="qc" /><td className="qc" /></tr>))}</tbody></table>
        {excipienteBase.length > 0 && (<><div className="sec"><span className="n">2</span><h2>Excipiente base (Q.S.P.)</h2></div>
        <table><thead><tr><th className="c" style={{ width: '18px' }}>Ord.</th><th>Insumo</th><th className="num" style={{ width: '60px' }}>Qtd. necessária</th><th className="qc" style={{ width: '76px' }}>Lote MP</th><th className="qc c" style={{ width: '50px' }}>Validade</th><th className="qc c" style={{ width: '16px' }}><span className="box" /></th><th className="qc" style={{ width: '74px' }}>Executado por</th><th className="qc" style={{ width: '74px' }}>Conferido por</th></tr></thead>
          <tbody>{excipienteBase.map((m: any, i: number) => (<tr key={m.id}><td className="c">{i + 1}</td><td>{m.insumo_nome} <span className="tag e">Q.S.P.</span></td><td className="num">{formatarQtd(m.quantidade_teorica_g)}</td><td className="qc">{m.numero_lote || '—'}</td><td className="qc c">{m.data_validade ? formatarData(m.data_validade) : '—'}</td><td className="qc c" /><td className="qc" /><td className="qc" /></tr>))}</tbody></table></>)}
        {excipienteTec.length > 0 && (<><div className="sec"><span className="n">3</span><h2>Excipientes tecnológicos</h2><span className="cnt">{excipienteTec.length} itens</span></div>
        <table><thead><tr><th className="c" style={{ width: '18px' }}>Ord.</th><th>Insumo</th><th style={{ width: '66px' }}>Função</th><th className="num" style={{ width: '60px' }}>Qtd. necessária</th><th className="qc" style={{ width: '76px' }}>Lote MP</th><th className="qc c" style={{ width: '16px' }}><span className="box" /></th><th className="qc" style={{ width: '70px' }}>Executado por</th><th className="qc" style={{ width: '70px' }}>Conferido por</th></tr></thead>
          <tbody>{excipienteTec.map((m: any, i: number) => (<tr key={m.id}><td className="c">{i + 1}</td><td>{m.insumo_nome}{m.adicionar_por_ultimo && <span className="warn"> ⚠ por último</span>}</td><td>{m.funcao || 'Tecnológico'}</td><td className="num">{formatarQtd(m.quantidade_teorica_g)}</td><td className="qc">{m.numero_lote || '—'}</td><td className="qc c" /><td className="qc" /><td className="qc" /></tr>))}</tbody></table></>)}
        {embalagens.length > 0 && (<><div className="sec"><span className="n">4</span><h2>Materiais de embalagem</h2><span className="cnt">{embalagens.length} itens</span></div>
        <table><thead><tr><th className="c" style={{ width: '18px' }}>Ord.</th><th>Material</th><th style={{ width: '96px' }}>Tipo</th><th className="num" style={{ width: '56px' }}>Necessária</th><th className="qc" style={{ width: '72px' }}>Lote</th><th className="qc c" style={{ width: '16px' }}><span className="box" /></th><th className="qc" style={{ width: '74px' }}>Conferido por</th></tr></thead>
          <tbody>{embalagens.map((e: any, i: number) => (<tr key={e.id}><td className="c">{i + 1}</td><td>{e.material_nome || e.insumo_nome}</td><td>{e.tipo || '—'}</td><td className="num">{e.quantidade_necessaria != null ? `${Number(e.quantidade_necessaria).toLocaleString('pt-BR')} un` : '—'}</td><td className="qc">{e.numero_lote || '—'}</td><td className="qc c" /><td className="qc" /></tr>))}</tbody></table></>)}
        <div className="sec"><span className="n">5</span><h2>Assinaturas e aprovações</h2></div>
        <Signs a="Separado por · execução" b="Conferido por · verificação" c="Responsável técnico · liberação" />
      </div>

      {/* ===== FASE 2 — PESAGEM ===== */}
      <div className="page">
        <FaseHeader faseK="FASE 2 · PESAGEM" faseT="Folha de Pesagem de Matérias-Primas" />
        <div className="sec"><span className="n">1</span><h2>Condições ambientais</h2><span className="cnt">RDC 243/2018 · IN 28/2018 · RDC 843/2024</span></div>
        <div className="grid c4"><div className="cell"><div className="k">Temperatura</div><div className="v blank">______ °C</div></div><div className="cell"><div className="k">Umidade relativa</div><div className="v blank">______ %</div></div><div className="cell"><div className="k">Verificado por</div><div className="v blank">__________</div></div><div className="cell"><div className="k">Hora</div><div className="v blank">______</div></div></div>
        <div className="sec"><span className="n">2</span><h2>Pesagem de ativos e excipientes</h2><span className="cnt">tolerância ±10%</span></div>
        <table><thead><tr><th className="c" style={{ width: '15px' }}>#</th><th>Insumo</th><th style={{ width: '48px' }}>Categoria</th><th className="num" style={{ width: '48px' }}>Teórica</th><th className="qc c" style={{ width: '40px' }}>Balança nº</th><th className="qc c" style={{ width: '44px' }}>Peso real</th><th className="qc" style={{ width: '58px' }}>Lote MP</th><th className="qc" style={{ width: '60px' }}>Pesado por</th><th className="qc" style={{ width: '60px' }}>Conferido por</th><th className="qc c" style={{ width: '15px' }}><span className="box" /></th></tr></thead>
          <tbody>{[...ativos, ...excipienteTec, ...excipienteBase].map((m: any, i: number) => (<tr key={m.id}><td className="c">{i + 1}</td><td>{m.insumo_nome}{ehCritico(m.quantidade_teorica_g) && <span className="tag r" style={{ marginLeft: 4 }}>⚠ analítica</span>}</td><td>{m.categoria === 'ATIVO' ? 'Ativo' : m.categoria === 'EXCIPIENTE_BASE' ? 'Base (QSP)' : 'Tecnológico'}</td><td className="num">{formatarQtd(m.quantidade_teorica_g)}</td><td className="qc" /><td className="qc" /><td className="qc">{m.numero_lote || ''}</td><td className="qc" /><td className="qc" /><td className="qc c" /></tr>))}</tbody></table>
        <div className="sec"><span className="n">3</span><h2>Referência de balanças</h2></div>
        <table><thead><tr><th>Faixa de peso</th><th>Tipo de balança</th><th>Precisão</th></tr></thead><tbody><tr><td>≥ 1 kg</td><td>Semi-analítica</td><td>2 casas decimais</td></tr><tr><td>1 g a 1 kg</td><td>Semi-analítica</td><td>3 ou 4 casas</td></tr><tr><td>1 mg a 1 g</td><td>Analítica</td><td>4 ou 5 casas</td></tr><tr><td>&lt; 1 mg</td><td>Ultra-analítica</td><td>5+ casas</td></tr></tbody></table>
        <div className="sec"><span className="n">4</span><h2>Assinaturas e aprovações</h2></div>
        <Signs a="Operador de pesagem · execução" b="Conferente · verificação" c="RT · liberação da pesagem" />
      </div>

      {/* ===== FASE 3 — MISTURA ===== */}
      <div className="page">
        <FaseHeader faseK="FASE 3 · MISTURA" faseT="Folha de Ordem de Mistura" />
        <div className="sec"><span className="n">1</span><h2>Regras obrigatórias de mistura</h2></div>
        <ul className="rules"><li><b>Homogeneização:</b> mínimo 5 min entre cada adição.</li><li><b>Dióxido de Silício</b> antes do Talco.</li><li><b className="warn">Estearato de Magnésio POR ÚLTIMO</b> — máx. 2 min.</li><li><b>Ambiente:</b> 15–25 °C · umidade &lt; 60%.</li></ul>
        <div className="sec"><span className="n">2</span><h2>Sequência de mistura</h2><span className="cnt">ordem e tempos-alvo</span></div>
        <table><thead><tr><th className="c" style={{ width: '26px' }}>Etapa</th><th>Componente</th><th className="num" style={{ width: '90px' }}>Quantidade</th><th style={{ width: '86px' }}>Função</th><th className="c" style={{ width: '58px' }}>Tempo</th><th className="qc c" style={{ width: '42px' }}>Início</th><th className="qc c" style={{ width: '42px' }}>Fim</th></tr></thead>
          <tbody>
            <tr><td className="c">1</td><td>Ativos pesados</td><td className="num">{formatarQtd(ativos.reduce((s: number, m: any) => s + Number(m.quantidade_teorica_g || 0), 0))}</td><td>Princípios ativos</td><td className="c">5 min</td><td className="qc" /><td className="qc" /></tr>
            {excipienteBase.map((m: any) => (<tr key={m.id}><td className="c">2</td><td>{m.insumo_nome}</td><td className="num">{formatarQtd(m.quantidade_teorica_g)}</td><td>Q.S.P. / diluente</td><td className="c">10 min</td><td className="qc" /><td className="qc" /></tr>))}
            {excipienteTec.map((m: any, i: number) => (<tr key={m.id} style={m.adicionar_por_ultimo ? { background: '#fbeee9' } : undefined}><td className={`c${m.adicionar_por_ultimo ? ' warn' : ''}`}>{3 + i}</td><td className={m.adicionar_por_ultimo ? 'warn' : undefined}>{m.insumo_nome}{m.adicionar_por_ultimo && ' (ÚLTIMO)'}</td><td className="num">{formatarQtd(m.quantidade_teorica_g)}</td><td>{m.funcao || 'Excipiente'}</td><td className={`c${m.adicionar_por_ultimo ? ' warn' : ''}`}>{m.adicionar_por_ultimo ? 'MÁX 2 min' : '3 min'}</td><td className="qc" /><td className="qc" /></tr>))}
          </tbody></table>
        <div className="sec"><span className="n">3</span><h2>Registro de execução da mistura</h2><span className="cnt">tempo real por etapa</span></div>
        <table><thead><tr><th className="c" style={{ width: '26px' }}>Etapa</th><th>Componente</th><th className="num" style={{ width: '80px' }}>Qtd. teórica</th><th className="qc c" style={{ width: '42px' }}>Início</th><th className="qc c" style={{ width: '42px' }}>Fim</th><th className="qc c" style={{ width: '48px' }}>Tempo real</th><th className="qc" style={{ width: '74px' }}>Operador</th><th className="qc" style={{ width: '74px' }}>Conferente</th></tr></thead>
          <tbody>
            <tr><td className="c">1</td><td>Ativos pesados</td><td className="num">{formatarQtd(ativos.reduce((s: number, m: any) => s + Number(m.quantidade_teorica_g || 0), 0))}</td><td className="qc" /><td className="qc" /><td className="qc" /><td className="qc" /><td className="qc" /></tr>
            {excipienteBase.map((m: any) => (<tr key={m.id}><td className="c">2</td><td>{m.insumo_nome}</td><td className="num">{formatarQtd(m.quantidade_teorica_g)}</td><td className="qc" /><td className="qc" /><td className="qc" /><td className="qc" /><td className="qc" /></tr>))}
            {excipienteTec.map((m: any, i: number) => (<tr key={m.id}><td className="c">{3 + i}</td><td>{m.insumo_nome}{m.adicionar_por_ultimo && <span className="warn"> (último)</span>}</td><td className="num">{formatarQtd(m.quantidade_teorica_g)}</td><td className="qc" /><td className="qc" /><td className="qc" /><td className="qc" /><td className="qc" /></tr>))}
          </tbody></table>
        <div className="sec"><span className="n">4</span><h2>Controle de qualidade — pó final</h2></div>
        <table><thead><tr><th>Teste</th><th className="qc" style={{ width: '110px' }}>Resultado</th><th className="c" style={{ width: '86px' }}>Conforme?</th><th className="qc">Observação</th></tr></thead>
          <tbody>{['Aparência do pó', 'Cor', 'Fluidez', 'Homogeneidade visual', 'Ausência de grumos'].map((t) => (<tr key={t}><td>{t}</td><td className="qc" /><td className="c fill"><span className="box" /> Sim <span className="box" /> Não</td><td className="qc" /></tr>))}</tbody></table>
        <div className="grid c2" style={{ marginTop: 6 }}><div className="cell"><div className="k">Temperatura ambiente</div><div className="v blank">______ °C</div></div><div className="cell"><div className="k">Umidade relativa</div><div className="v blank">______ %</div></div></div>
        <div className="sec"><span className="n">5</span><h2>Assinaturas e aprovações</h2></div>
        <Signs a="Operador de mistura · execução" b="Conferente · verificação" c="RT · liberação da mistura" />
      </div>

      {/* ===== FASE 4 — ENCAPSULAMENTO ===== */}
      <div className="page">
        <FaseHeader faseK="FASE 4 · ENCAPSULAMENTO" faseT="Folha de Encapsulamento" />
        <div className="sec"><span className="n">1</span><h2>Setup da encapsuladora</h2></div>
        <table><thead><tr><th>Item de verificação</th><th style={{ width: '126px' }}>Parâmetro</th><th className="c" style={{ width: '54px' }}>Verif.</th><th className="qc" style={{ width: '104px' }}>Responsável</th></tr></thead>
          <tbody>{[['Limpeza do equipamento', 'Visualmente limpo'], ['Troca de placas (se aplicável)', `Tamanho ${op.tamanho_capsula ?? 0}`], ['Ajuste de dosagem', `${pesoAlvo} mg ± 5%`], ['Teste de peso (10 cápsulas)', 'Dentro da tolerância'], ['Fechamento das cápsulas', 'Sem vazamento de pó']].map(([a, b]) => (<tr key={a}><td>{a}</td><td>{b}</td><td className="c fill"><span className="box" /> OK</td><td className="qc" /></tr>))}</tbody></table>
        <div className="sec"><span className="n">2</span><h2>Controle de peso durante produção</h2><span className="cnt">a cada 30 min · alvo {pesoAlvo} mg</span></div>
        <table><thead><tr><th style={{ width: '42px' }}>Hora</th><th className="c">C.1</th><th className="c">C.2</th><th className="c">C.3</th><th className="c">C.4</th><th className="c">C.5</th><th className="c">Média</th><th className="c">Desvio</th><th className="c" style={{ width: '32px' }}>OK?</th><th className="qc" style={{ width: '66px' }}>Operador</th></tr></thead>
          <tbody>{[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (<tr key={i}><td className="qc" /><td className="qc" /><td className="qc" /><td className="qc" /><td className="qc" /><td className="qc" /><td className="qc" /><td className="qc" /><td className="c"><span className="box" /></td><td className="qc" /></tr>))}</tbody></table>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginTop: 6 }}>
          <div className="grid c3"><div className="cell" style={{ gridColumn: 'span 3', background: 'var(--zebra)' }}><div className="k" style={{ color: 'var(--ink)' }}>4A · Tempos de produção</div></div><div className="cell"><div className="k">Hora início</div><div className="v blank">____</div></div><div className="cell"><div className="k">Hora término</div><div className="v blank">____</div></div><div className="cell"><div className="k">Tempo total</div><div className="v blank">____</div></div></div>
          <div className="grid c3"><div className="cell" style={{ gridColumn: 'span 3', background: 'var(--zebra)' }}><div className="k" style={{ color: 'var(--ink)' }}>4B · Quantidades</div></div><div className="cell"><div className="k">Produzidas</div><div className="v blank">____</div></div><div className="cell"><div className="k">Rejeitadas</div><div className="v blank">____</div></div><div className="cell"><div className="k">Aprovadas</div><div className="v blank">____</div></div></div>
        </div>
        <div className="sec"><span className="n">3</span><h2>Controle de qualidade e rendimento</h2></div>
        <div className="grid c4"><div className="cell"><div className="k">Planejada (+{perdas?.acrescimo_percentual ?? 5}%)</div><div className="v">{(perdas?.quantidade_com_acrescimo ?? totalCaps).toLocaleString('pt-BR')} un</div></div><div className="cell"><div className="k">Produzida</div><div className="v blank">____</div></div><div className="cell"><div className="k">Aprovada</div><div className="v blank">____</div></div><div className="cell"><div className="k">Perda / % · rendimento</div><div className="v blank">__ / __% · __%</div></div></div>
        <div className="sec"><span className="n">4</span><h2>Observações / ocorrências</h2></div>
        <div style={{ border: '1px solid var(--line-2)', borderRadius: 5, height: 30, background: '#fffdf6' }} />
        <div className="sec"><span className="n">5</span><h2>Amostra de retenção</h2><span className="cnt">RDC 243/2018 · BPF</span></div>
        <div className="grid c4"><div className="cell"><div className="k">Qtd. retida</div><div className="v blank">mín. 1 frasco</div></div><div className="cell"><div className="k">Localização</div><div className="v blank">câmara/prat./posição</div></div><div className="cell"><div className="k">Data de coleta</div><div className="v">{formatarData(opData.data_fabricacao)}</div></div><div className="cell"><div className="k">Descarte após</div><div className="v">validade + 12 meses</div></div><div className="cell" style={{ gridColumn: 'span 4' }}><div className="k">Responsável pela coleta / assinatura</div><div className="v blank">__________________________</div></div></div>
        <div className="sec"><span className="n">6</span><h2>Assinaturas e aprovações</h2></div>
        <Signs a="Operador de encapsulamento" b="Conferente · verificação" c="RT · liberação" />
      </div>

      {/* ===== FASE 5 — EMBALAGEM ===== */}
      <div className="page">
        <FaseHeader faseK="FASE 5 · EMBALAGEM" faseT="Folha de Embalagem e Rotulagem" />
        <div className="sec"><span className="n">1</span><h2>Conferência de materiais de embalagem</h2></div>
        <table><thead><tr><th className="c" style={{ width: '15px' }}>#</th><th>Material</th><th style={{ width: '92px' }}>Tipo</th><th className="num" style={{ width: '54px' }}>Necessária</th><th className="qc" style={{ width: '66px' }}>Lote</th><th className="qc c" style={{ width: '46px' }}>Qtd. usada</th><th className="qc" style={{ width: '64px' }}>Conferido por</th><th className="qc c" style={{ width: '38px' }}>Hora</th><th className="qc c" style={{ width: '15px' }}><span className="box" /></th></tr></thead>
          <tbody>{embalagens.map((e: any, i: number) => (<tr key={e.id}><td className="c">{i + 1}</td><td>{e.material_nome || e.insumo_nome}</td><td>{e.tipo || '—'}</td><td className="num">{e.quantidade_necessaria != null ? `${Number(e.quantidade_necessaria).toLocaleString('pt-BR')} un` : '—'}</td><td className="qc">{e.numero_lote || '—'}</td><td className="qc" /><td className="qc" /><td className="qc" /><td className="qc c" /></tr>))}</tbody></table>
        <div className="sec"><span className="n">2</span><h2>Conferência de rótulo</h2><span className="cnt warn">verificar ANTES de aplicar</span></div>
        <table><thead><tr><th>Item de verificação</th><th className="c" style={{ width: '86px' }}>Conforme?</th><th className="qc">Observação</th></tr></thead>
          <tbody>{['Nome do produto confere com a OP', `Lote impresso: ${opData.lote_produto_acabado}`, 'Data de fabricação impressa corretamente', 'Data de validade impressa corretamente', 'Tabela nutricional presente e legível', 'Ingredientes listados corretamente', 'Modo de uso / conservação presentes', 'Dados do fabricante presentes', 'Registro / Dispensa ANVISA presente', 'Alegações conforme permitido pela ANVISA'].map((t) => (<tr key={t}><td>{t}</td><td className="c fill"><span className="box" /> Sim <span className="box" /> Não</td><td className="qc" /></tr>))}</tbody></table>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginTop: 6 }}>
          <div className="grid c2"><div className="cell" style={{ gridColumn: 'span 2', background: 'var(--zebra)' }}><div className="k" style={{ color: 'var(--ink)' }}>4A · Envase</div></div><div className="cell"><div className="k">Hora início</div><div className="v blank">____</div></div><div className="cell"><div className="k">Hora término</div><div className="v blank">____</div></div><div className="cell"><div className="k">Frascos envasados</div><div className="v blank">____</div></div><div className="cell"><div className="k">Frascos rejeitados</div><div className="v blank">____</div></div></div>
          <div className="grid c2"><div className="cell" style={{ gridColumn: 'span 2', background: 'var(--zebra)' }}><div className="k" style={{ color: 'var(--ink)' }}>4B · Rotulagem</div></div><div className="cell"><div className="k">Hora início</div><div className="v blank">____</div></div><div className="cell"><div className="k">Hora término</div><div className="v blank">____</div></div><div className="cell"><div className="k">Frascos rotulados</div><div className="v blank">____</div></div><div className="cell"><div className="k">Rótulos descartados</div><div className="v blank">____</div></div></div>
        </div>
        <div className="sec"><span className="n">3</span><h2>Contagem final e liberação</h2></div>
        <div className="grid c4"><div className="cell"><div className="k">Total produzidos</div><div className="v blank">____ fr</div></div><div className="cell"><div className="k">Aprovados p/ expedição</div><div className="v blank">____ fr</div></div><div className="cell"><div className="k">Em quarentena</div><div className="v blank">____ fr</div></div><div className="cell"><div className="k">Rejeitados</div><div className="v blank">____ fr</div></div><div className="cell" style={{ gridColumn: 'span 4' }}><div className="k">Motivo da rejeição (se houver)</div><div className="v blank">________________________________</div></div></div>
        <div className="sec"><span className="n">4</span><h2>Assinaturas e aprovações</h2></div>
        <Signs a="Operador de embalagem" b="Conferente · verificação" c="RT · liberação final" />
      </div>

      {/* ===== CHECKLIST (2 páginas) ===== */}
      {(() => {
        const pre = ['Remoção total de insumos e embalagens da OP anterior', 'Remoção de rótulos e documentos do lote anterior', 'Limpeza e sanitização (Álcool 70%) de bancadas e utensílios', 'Misturador / equipamentos limpos, secos e identificados', 'Verificação de ausência de resíduos em frestas/placas', 'Conferência de lotes e validades das MPs da nova OP', 'Balança nivelada, limpa e com calibração em dia'];
        const dur = ['Pesagem de ativos críticos com dupla conferência registrada', 'Conferência de pesos reais dentro da tolerância (±10%)', 'Ordem de mistura e tempos de homogeneização seguidos', 'Limpeza concorrente de equipamentos entre bateladas', 'Ajuste e teste de peso médio na encapsuladora', 'Monitoramento de temperatura e umidade da sala'];
        const pos = ['Contagem final de unidades e conciliação de rendimento', 'Conferência de lote e validade nos frascos/rótulos', 'Amostra de retenção coletada e identificada', 'Upload do rótulo final e fotos do produto no sistema', 'Limpeza final e organização da área para próxima OP'];
        const cq = ['Teste de peso médio aprovado (conforme farmacopeia)', 'Avaliação organoléptica (cor, odor, aspecto)', 'Teste de desintegração / fluidez conforme aplicável', 'Dossiê de produção completo e assinado pelo RT'];
        const ClHead = () => (<thead><tr><th className="c" style={{ width: '15px' }}><span className="box" /></th><th>Item de verificação</th><th className="c" style={{ width: '32px' }}>Obrig.</th><th className="qc" style={{ width: '74px' }}>Responsável</th><th className="qc c" style={{ width: '38px' }}>Hora</th><th className="qc c" style={{ width: '44px' }}>Data</th></tr></thead>);
        const ClBody = ({ items }: { items: string[] }) => (<tbody>{items.map((t) => (<tr key={t}><td className="c"><span className="box" /></td><td>{t}<div className="obs">Obs: __________________________________________</div></td><td className="c">SIM</td><td className="qc" /><td className="qc" /><td className="qc" /></tr>))}</tbody>);
        return (<>
          <div className="page">
            <FaseHeader faseK="VERIFICAÇÕES" faseT="Checklist Operacional e Liberação do Lote" />
            <ul className="rules" style={{ marginBottom: 5 }}><li>Marcar ☑ cada item após verificação. Itens obrigatórios 100% para liberar o lote.</li><li>Não-conformidades registradas no bloco específico e comunicadas ao RT.</li><li>Documento parte do dossiê — arquivar por 5 anos.</li></ul>
            <div className="sec"><span className="n">1</span><h2>Pré-produção</h2><span className="cnt">{pre.length} itens</span></div>
            <table><ClHead /><ClBody items={pre} /></table>
            <div className="sec"><span className="n">2</span><h2>Durante a produção</h2><span className="cnt">{dur.length} itens</span></div>
            <table><ClHead /><ClBody items={dur} /></table>
          </div>
          <div className="page">
            <FaseHeader faseK="VERIFICAÇÕES (cont.)" faseT="Checklist Operacional e Liberação do Lote" />
            <div className="sec"><span className="n">3</span><h2>Pós-produção</h2><span className="cnt">{pos.length} itens</span></div>
            <table><ClHead /><ClBody items={pos} /></table>
            <div className="sec"><span className="n">4</span><h2>Controle de qualidade</h2><span className="cnt">{cq.length} itens</span></div>
            <table><ClHead /><ClBody items={cq} /></table>
            <div className="sec"><span className="n">5</span><h2>Amostra de retenção — obrigatório BPF</h2></div>
            <div className="grid c4"><div className="cell"><div className="k">Quantidade retida (un)</div><div className="v blank">mín. 1 frasco</div></div><div className="cell"><div className="k">Localização (câmara/prat./pos.)</div><div className="v blank">__________</div></div><div className="cell"><div className="k">Separado por</div><div className="v blank">__________</div></div><div className="cell"><div className="k">Data / hora</div><div className="v blank">__________</div></div></div>
            <div className="sec"><span className="n warn" style={{ background: 'var(--warn)' }}>!</span><h2>Registro de não-conformidades</h2><span className="cnt">se houver</span></div>
            <table><thead><tr><th className="c" style={{ width: '14px' }}>#</th><th>Descrição</th><th>Ação corretiva</th><th style={{ width: '78px' }}>Responsável</th><th className="c" style={{ width: '72px' }}>Status</th><th className="c" style={{ width: '44px' }}>Data</th></tr></thead>
              <tbody>{[1, 2, 3].map((n) => (<tr key={n}><td className="c">{n}</td><td className="qc" /><td className="qc" /><td className="qc" /><td className="c fill"><span className="box" /> Resolvido</td><td className="qc" /></tr>))}</tbody></table>
            <div className="sec"><span className="n" style={{ background: '#2e7d32' }}>✓</span><h2>Liberação do lote</h2></div>
            <div className="grid c2"><div className="cell"><div className="k">Checklist 100% concluído?</div><div className="v fill"><span className="box" /> Sim <span className="box" /> Não</div></div><div className="cell"><div className="k">Lote liberado para expedição?</div><div className="v fill"><span className="box" /> Sim <span className="box" /> Não</div></div><div className="cell"><div className="k">Não-conformidades resolvidas?</div><div className="v fill"><span className="box" /> Sim <span className="box" /> Não <span className="box" /> N/A</div></div><div className="cell"><div className="k">Documentação completa?</div><div className="v fill"><span className="box" /> Sim <span className="box" /> Não</div></div></div>
            <div className="rules" style={{ margin: '8px 0' }}><li><b>Declaração do RT:</b> Declaro que revisei todas as etapas deste registro, que os controles foram executados conforme as Boas Práticas de Fabricação e a legislação ANVISA vigente, e libero o lote {opData.lote_produto_acabado} para expedição.{op.hash_documento ? ` Assinatura eletrônica · hash ${op.hash_documento.substring(0, 16)}…` : ''}</li></div>
            <Signs a="Supervisor de produção · verificação" b="Controle de qualidade · aprovação" c="RT · liberação final do lote" />
          </div>
        </>);
      })()}

      {/* rodapé (impressão) */}
      <div className="footer">
        <span className="fl"><b>{fabNome}</b>{fabCnpj && ` · CNPJ ${fabCnpj}`} · Controle ANVISA/BPF</span>
        <span>Documento gerado por www.brainxerp.com · Lote {opData.lote_produto_acabado} · {opData.codigo}</span>
      </div>
    </div>
  );
}
