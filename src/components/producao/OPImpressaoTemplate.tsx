import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import type { OPIndustrialData } from '@/types/op-industrial';

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
            company:companies(*),
            op_materias_primas(*),
            op_embalagens(*),
            op_pesagens_criticas(*),
            op_controle_qualidade(*),
            op_controle_perdas(*),
            op_checklist(*),
            op_assinaturas_rt(*)
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
  const formatarQtd = (valor: number, unidade: string = 'g'): string => {
    if (valor < 1 && unidade === 'g') {
      return `${(valor * 1000).toFixed(4)} mg`;
    }
    return `${valor.toFixed(4)} ${unidade}`;
  };

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
    <div ref={containerRef} style={{ width: '100%', backgroundColor: '#fff' }}>
      <style>{`
        :root {
          --ink: #14110d;
          --ink-2: #4a453c;
          --line: #ddd7c9;
          --line-2: #bcb4a4;
          --gold: #b8860b;
          --gold-soft: #f5edd6;
          --zebra: #faf8f2;
          --blank: #c3bcac;
          --warn: #a8341f;
        }
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        body {
          font-family: "Helvetica Neue", Arial, sans-serif;
          color: var(--ink-2);
          font-size: 8.8pt;
          line-height: 1.28;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .page {
          break-after: page;
          width: 210mm;
          height: 297mm;
          padding: 9mm;
          margin: 0 auto;
          background: white;
          box-shadow: 0 0 0 1px #ddd;
        }
        .page:last-child {
          break-after: auto;
        }
        .footer {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          height: 14mm;
          padding: 0 9mm;
          font-size: 6.2px;
          color: #8f887a;
          font-family: Arial, sans-serif;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: white;
          border-top: 1px solid #ddd7c9;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .footer-left {
          flex: 1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .footer-left b {
          color: #4a453c;
          font-weight: 700;
        }
        .footer-right {
          flex: 1;
          text-align: right;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .footer-right b {
          color: #b8860b;
          font-weight: 700;
        }
        @media print {
          body {
            margin: 0;
            padding: 0;
          }
          .page {
            width: auto;
            height: auto;
            margin: 0;
            padding: 9mm;
            padding-bottom: 18mm;
            box-shadow: none;
            page-break-after: always;
          }
          .page:last-child {
            page-break-after: avoid;
          }
          .footer {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
          }
        }
        .phdr {
          border: 1px solid var(--ink);
          border-radius: 6px;
          overflow: hidden;
          margin-bottom: 9px;
        }
        .phdr .top {
          display: grid;
          grid-template-columns: 48px 1fr 96px;
          gap: 9px;
          padding: 6px;
          background: var(--gold-soft);
          align-items: center;
        }
        .phdr .logo {
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: white;
          border-radius: 3px;
          font-size: 7px;
          font-weight: 800;
          text-align: center;
          color: var(--ink);
        }
        .phdr .logo img {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
        }
        .phdr .logo b {
          display: block;
          line-height: 1;
        }
        .phdr .logo span {
          display: block;
          font-size: 5px;
          font-weight: 400;
        }
        .phdr .fase-k {
          font-size: 9px;
          font-weight: 800;
          color: var(--ink);
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }
        .phdr .fase-t {
          font-size: 8px;
          color: var(--ink-2);
          font-weight: 600;
          margin-top: 2px;
        }
        .phdr .fase-p {
          font-size: 7px;
          color: #666;
          margin-top: 2px;
        }
        .phdr .op-code {
          text-align: right;
        }
        .phdr .op-code .c {
          font-size: 11px;
          font-weight: 800;
          color: var(--gold);
          letter-spacing: 1px;
        }
        .phdr .op-code .l {
          font-size: 7px;
          color: var(--ink-2);
          margin-top: 2px;
        }
        .phdr .band {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 1px;
          background: var(--line);
          padding: 1px;
        }
        .phdr .band .b {
          background: white;
          padding: 4px;
          font-size: 7px;
        }
        .phdr .band .k {
          font-weight: 700;
          color: var(--ink);
          margin-bottom: 2px;
        }
        .phdr .band .v {
          font-size: 8px;
          color: var(--ink-2);
          font-weight: 600;
        }
        .sec {
          display: flex;
          align-items: center;
          gap: 6px;
          margin: 8px 0 6px 0;
          border-bottom: 1px solid var(--line-2);
          padding-bottom: 3px;
        }
        .sec .n {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: var(--gold);
          color: white;
          font-weight: 800;
          font-size: 9px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .sec h2 {
          font-size: 9px;
          font-weight: 800;
          color: var(--ink);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin: 0;
          flex: 1;
        }
        .sec .cnt {
          font-size: 7px;
          color: #999;
          font-weight: 600;
        }
        .sec .cnt.warn {
          color: var(--warn);
          font-weight: 700;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 6px 0;
          font-size: 8px;
        }
        th {
          background: var(--gold-soft);
          color: var(--ink);
          font-weight: 700;
          padding: 4px;
          text-align: left;
          border: 1px solid var(--line);
        }
        th.c {
          text-align: center;
        }
        th.qc {
          text-align: center;
        }
        th.num {
          text-align: right;
        }
        td {
          padding: 4px;
          border: 1px solid var(--line);
        }
        tr:nth-child(even) {
          background: var(--zebra);
        }
        td.c {
          text-align: center;
        }
        td.qc {
          text-align: center;
          background: #fafafa;
        }
        td.num {
          text-align: right;
          font-family: monospace;
        }
        td.warn {
          background: #fbeee9;
          color: var(--warn);
          font-weight: 700;
        }
        .box {
          display: inline-block;
          width: 10px;
          height: 10px;
          border: 1px solid var(--ink-2);
          margin-right: 3px;
          vertical-align: middle;
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 6px;
          margin: 6px 0;
        }
        .grid.c4 {
          grid-template-columns: repeat(4, 1fr);
        }
        .cell {
          border: 1px solid var(--line);
          padding: 6px;
          background: white;
        }
        .cell .k {
          font-size: 7px;
          font-weight: 700;
          color: var(--ink);
          margin-bottom: 3px;
        }
        .cell .v {
          font-size: 8px;
          color: var(--ink-2);
          font-weight: 600;
        }
        .cell .v.blank {
          border-bottom: 1px solid var(--ink);
          min-height: 16px;
          display: flex;
          align-items: flex-end;
        }
        .signs {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin: 12px 0;
        }
        .sign {
          text-align: center;
        }
        .sign .line {
          border-bottom: 1px solid var(--ink);
          height: 40px;
          margin-bottom: 4px;
        }
        .sign .who {
          font-size: 8px;
          font-weight: 600;
          color: var(--ink);
          margin-bottom: 2px;
        }
        .sign .role {
          font-size: 7px;
          color: var(--ink-2);
          font-weight: 600;
          margin-bottom: 4px;
        }
        .sign .date {
          font-size: 7px;
          color: #999;
        }
        ul.rules {
          list-style: none;
          margin: 6px 0;
          padding-left: 0;
        }
        ul.rules li {
          font-size: 8px;
          margin-bottom: 4px;
          padding-left: 12px;
          position: relative;
          color: var(--ink-2);
          line-height: 1.3;
        }
        ul.rules li:before {
          content: "•";
          position: absolute;
          left: 0;
          font-weight: 800;
          color: var(--gold);
        }
        ul.rules li b {
          font-weight: 700;
          color: var(--ink);
        }
        ul.rules li b.warn {
          color: var(--warn);
        }
        .fill {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .cover {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          height: 100%;
        }
        .cover .logo-large {
          width: 80px;
          height: 80px;
          margin: 0 auto 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--gold-soft);
          border-radius: 6px;
        }
        .cover .logo-large img {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
        }
        .cover .logo-large b {
          font-size: 24px;
          display: block;
          line-height: 1;
        }
        .cover .logo-large span {
          font-size: 12px;
          font-weight: 400;
          display: block;
        }
        .cover .op {
          font-size: 30px;
          font-weight: 800;
          color: var(--ink);
          letter-spacing: 1px;
        }
        .cover .prod {
          font-size: 12px;
          color: var(--ink);
          font-weight: 700;
          margin-top: 6px;
        }
        .cover .grid {
          margin-top: 14px;
        }
        .idx {
          margin-top: 18px;
        }
        .idx .h {
          font-size: 9px;
          font-weight: 800;
          color: var(--ink);
          letter-spacing: 0.5px;
          text-transform: uppercase;
          margin-bottom: 6px;
        }
        .idx .row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 6px 0;
          border-bottom: 1px solid var(--line);
        }
        .idx .no {
          width: 20px;
          height: 20px;
          border-radius: 5px;
          background: var(--gold);
          color: #fff;
          font-weight: 800;
          font-size: 9px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .idx .ph {
          font-size: 8px;
          font-weight: 700;
          color: var(--ink);
        }
        .idx .nm {
          font-size: 7px;
          color: var(--ink-2);
          margin-top: 2px;
        }
      `}</style>

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

          <div className="cover grid">
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
                    <td className="num">{formatarQtd(item.quantidade_teorica_g)}</td>
                    <td className="qc"></td>
                    <td className="qc c"></td>
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
                    <td className="num">{formatarQtd(item.quantidade_teorica_g)}</td>
                    <td className="qc"></td>
                    <td className="qc c"></td>
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
                    <td className="num">{formatarQtd(item.quantidade_teorica_g)}</td>
                    <td className="qc"></td>
                    <td className="qc c"></td>
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
                    <td className="qc"></td>
                    <td className="qc c"></td>
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
