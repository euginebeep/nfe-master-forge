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
        // Buscar dados da OP
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
        setError(err instanceof Error ? err.message : 'Erro desconhecido');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [opId]);

  useEffect(() => {
    if (autoprint && !loading && opData) {
      // Aguardar renderização antes de imprimir
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
  const ativos = opData.op_materias_primas?.filter(m => m.categoria === 'ATIVO') || [];
  const excipienteBase = opData.op_materias_primas?.filter(m => m.categoria === 'EXCIPIENTE_BASE') || [];
  const excipienteTec = opData.op_materias_primas?.filter(m => m.categoria === 'EXCIPIENTE_TECNOLOGICO') || [];

  // Formatar quantidade com unidade
  const formatarQtd = (valor: number, unidade: string = 'g'): string => {
    if (valor < 1 && unidade === 'g') {
      return `${(valor * 1000).toFixed(4)} mg`;
    }
    return `${valor.toFixed(4)} ${unidade}`;
  };

  // Formatar data
  const formatarData = (data: string | null): string => {
    if (!data) return '';
    return new Date(data).toLocaleDateString('pt-BR');
  };

  // Obter URL assinada do logo
  const getLogoUrl = async (): Promise<string> => {
    if (!companyData?.logo_file_id) {
      return ''; // Usar placeholder se não houver logo
    }
    try {
      const { data } = await supabase.storage
        .from('company-assets')
        .createSignedUrl(companyData.logo_file_id, 3600);
      return data?.signedUrl || '';
    } catch (err) {
      console.error('Erro ao obter URL do logo:', err);
      return '';
    }
  };

  const logoUrl = getLogoUrl();

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
            box-shadow: none;
            page-break-after: always;
          }
          .page:last-child {
            page-break-after: avoid;
          }
        }
        /* Estilos do template */
        .phdr {
          border: 1px solid var(--ink);
          border-radius: 6px;
          overflow: hidden;
          margin-bottom: 9px;
        }
        .phdr .top {
          display: grid;
          grid-template-columns: auto 1fr auto;
          gap: 12px;
          align-items: center;
          padding: 7px 10px;
          border-bottom: 1px solid var(--line);
        }
        .logo {
          width: 46px;
          height: 46px;
          border: 2px solid var(--gold);
          border-radius: 9px;
          background: var(--gold-soft);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: var(--ink);
        }
        .logo img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          border-radius: 7px;
        }
        .logo b {
          font-size: 15px;
          line-height: 1;
        }
        .logo span {
          font-size: 5px;
          letter-spacing: 1px;
          color: var(--gold);
          font-weight: 800;
          margin-top: 1px;
        }
        .fase-k {
          font-size: 6.6px;
          letter-spacing: 2px;
          color: var(--gold);
          font-weight: 800;
        }
        .fase-t {
          font-size: 12px;
          font-weight: 800;
          color: var(--ink);
        }
        .fase-p {
          font-size: 8px;
          color: var(--ink-2);
        }
        .op-code {
          text-align: right;
        }
        .op-code .c {
          font-size: 13px;
          font-weight: 800;
          color: var(--ink);
        }
        .op-code .l {
          font-size: 8px;
        }
        .phdr .band {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          background: var(--zebra);
        }
        .phdr .band .b {
          padding: 4px 9px;
          border-right: 1px solid var(--line);
        }
        .phdr .band .b:last-child {
          border-right: 0;
        }
        .phdr .band .k {
          font-size: 6px;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          color: var(--gold);
          font-weight: 800;
        }
        .phdr .band .v {
          font-size: 9px;
          color: var(--ink);
          font-weight: 700;
        }
        .sec {
          display: flex;
          align-items: center;
          gap: 7px;
          margin: 9px 0 4px;
        }
        .sec .n {
          min-width: 15px;
          height: 15px;
          padding: 0 3px;
          border-radius: 4px;
          background: var(--gold);
          color: #fff;
          font-size: 8px;
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .sec h2 {
          font-size: 9px;
          font-weight: 800;
          color: var(--ink);
          letter-spacing: 0.4px;
          text-transform: uppercase;
        }
        .sec .cnt {
          margin-left: auto;
          font-size: 7.4px;
          color: var(--ink-2);
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 8px;
        }
        thead th {
          background: var(--ink);
          color: #fff;
          font-weight: 700;
          text-align: left;
          padding: 4px 6px;
          font-size: 6.6px;
          letter-spacing: 0.3px;
          text-transform: uppercase;
        }
        tbody td {
          padding: 4px 6px;
          border-bottom: 1px solid var(--line);
          vertical-align: middle;
        }
        tbody tr:nth-child(even) {
          background: var(--zebra);
        }
        td.num, th.num {
          text-align: right;
          font-variant-numeric: tabular-nums;
        }
        td.c, th.c {
          text-align: center;
        }
        .qc {
          background: #fffdf6;
        }
        .fill {
          color: var(--blank);
        }
        .box {
          display: inline-block;
          width: 9px;
          height: 9px;
          border: 1.2px solid var(--ink-2);
          border-radius: 2px;
          vertical-align: -1px;
        }
        .tag {
          font-size: 6px;
          font-weight: 800;
          padding: 1px 4px;
          border-radius: 20px;
          background: var(--gold-soft);
          color: #8a6608;
          text-transform: uppercase;
        }
        .tag.e {
          background: #eef1f4;
          color: #4a586b;
        }
        .grid {
          display: grid;
          border: 1px solid var(--line-2);
          border-radius: 5px;
          overflow: hidden;
        }
        .grid.c4 {
          grid-template-columns: repeat(4, 1fr);
        }
        .grid.c3 {
          grid-template-columns: repeat(3, 1fr);
        }
        .grid .cell {
          padding: 5px 8px;
          border-right: 1px solid var(--line);
          border-bottom: 1px solid var(--line);
        }
        .grid.c4 .cell:nth-child(4n) {
          border-right: 0;
        }
        .grid.c3 .cell:nth-child(3n) {
          border-right: 0;
        }
        .grid .k {
          font-size: 6.2px;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          color: var(--gold);
          font-weight: 800;
        }
        .grid .v {
          font-size: 9px;
          color: var(--ink);
          font-weight: 700;
          margin-top: 1px;
        }
        .grid .v.blank {
          color: var(--blank);
          font-weight: 500;
        }
        .cover {
          border: 2px solid var(--ink);
          border-radius: 10px;
          padding: 22px 26px;
          margin-top: 6px;
        }
        .cover .co {
          font-size: 8px;
          letter-spacing: 4px;
          color: var(--gold);
          font-weight: 800;
        }
        .cover h1 {
          font-size: 15px;
          color: var(--ink);
          margin: 4px 0 2px;
          letter-spacing: 2px;
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
          flex: none;
        }
        .idx .ph {
          font-size: 6.6px;
          letter-spacing: 1px;
          color: var(--gold);
          font-weight: 800;
          text-transform: uppercase;
        }
        .idx .nm {
          font-size: 10px;
          color: var(--ink);
          font-weight: 700;
        }
      `}</style>

      {/* CAPA / ÍNDICE */}
      <div className="page">
        <div className="cover">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="co">{companyData.nome_fantasia}</div>
              <h1>ORDEM DE PRODUÇÃO INDUSTRIAL</h1>
              <div className="op">{opData.codigo}</div>
              <div className="prod">
                {opData.produto_nome} · Lote {opData.lote_produto_acabado}
              </div>
            </div>
            <div className="logo" style={{ width: '64px', height: '64px' }}>
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" />
              ) : (
                <>
                  <b style={{ fontSize: '20px' }}>
                    {companyData.nome_fantasia?.substring(0, 2).toUpperCase()}
                  </b>
                  <span>{companyData.nome_fantasia?.substring(0, 5).toUpperCase()}</span>
                </>
              )}
            </div>
          </div>
          <div className="grid c4">
            <div className="cell">
              <div className="k">Total de cápsulas</div>
              <div className="v">{opData.total_capsulas_com_acrescimo?.toLocaleString('pt-BR')}</div>
            </div>
            <div className="cell">
              <div className="k">Frascos × un</div>
              <div className="v">
                {opData.quantidade_frascos} × {opData.capsulas_por_frasco}
              </div>
            </div>
            <div className="cell">
              <div className="k">Data de fabricação</div>
              <div className="v">{formatarData(opData.data_fabricacao)}</div>
            </div>
            <div className="cell">
              <div className="k">Data de validade</div>
              <div className="v">{formatarData(opData.data_validade)}</div>
            </div>
          </div>
          <div className="idx">
            <div className="h">📑 Índice do documento</div>
            <div className="row">
              <div className="no">1</div>
              <div>
                <div className="ph">Fase 1 — Pré-produção</div>
                <div className="nm">Folha de Separação de Materiais</div>
              </div>
            </div>
            <div className="row">
              <div className="no">2</div>
              <div>
                <div className="ph">Fase 2 — Pesagem</div>
                <div className="nm">Folha de Pesagem de Matérias-Primas</div>
              </div>
            </div>
            <div className="row">
              <div className="no">3</div>
              <div>
                <div className="ph">Fase 3 — Mistura</div>
                <div className="nm">Folha de Ordem de Mistura</div>
              </div>
            </div>
            <div className="row">
              <div className="no">4</div>
              <div>
                <div className="ph">Fase 4 — Encapsulamento</div>
                <div className="nm">Folha de Encapsulamento</div>
              </div>
            </div>
            <div className="row">
              <div className="no">5</div>
              <div>
                <div className="ph">Fase 5 — Embalagem</div>
                <div className="nm">Folha de Embalagem e Rotulagem</div>
              </div>
            </div>
            <div className="row">
              <div className="no">6</div>
              <div>
                <div className="ph">Verificações</div>
                <div className="nm">Checklist Operacional e Liberação do Lote</div>
              </div>
            </div>
          </div>
          <div style={{ fontSize: '7.6px', marginTop: '16px', color: '#8f887a' }}>
            {companyData.nome_fantasia} · Total de páginas: 7 · Rastreabilidade ANVISA/BPF · Gerado em{' '}
            {formatarData(new Date().toISOString())}
          </div>
        </div>
      </div>

      {/* FASE 1 — SEPARAÇÃO */}
      <div className="page">
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
              <div className="fase-k">FASE 1 · PRÉ-PRODUÇÃO</div>
              <div className="fase-t">Folha de Separação de Materiais</div>
              <div className="fase-p">{opData.produto_nome}</div>
            </div>
            <div className="op-code">
              <div className="c">{opData.codigo}</div>
              <div className="l">Lote {opData.lote_produto_acabado}</div>
            </div>
          </div>
          <div className="band">
            <div className="b">
              <div className="k">Quantidade</div>
              <div className="v">
                {opData.quantidade_frascos} fr × {opData.capsulas_por_frasco} un
              </div>
            </div>
            <div className="b">
              <div className="k">Total c/ acréscimo</div>
              <div className="v">{opData.total_capsulas_com_acrescimo?.toLocaleString('pt-BR')} un</div>
            </div>
            <div className="b">
              <div className="k">Resp. técnico</div>
              <div className="v">{opData.rt_nome}</div>
            </div>
            <div className="b">
              <div className="k">Conselho</div>
              <div className="v">
                {opData.rt_tipo_conselho}-{opData.rt_uf_conselho} {opData.rt_numero_registro}
              </div>
            </div>
            <div className="b">
              <div className="k">Fabricação</div>
              <div className="v">{formatarData(opData.data_fabricacao)}</div>
            </div>
            <div className="b">
              <div className="k">Validade</div>
              <div className="v">{formatarData(opData.data_validade)}</div>
            </div>
          </div>
        </div>

        {/* Ativos */}
        {ativos.length > 0 && (
          <>
            <div className="sec">
              <span className="n">1</span>
              <h2>Ativos e princípios ativos</h2>
              <span className="cnt">{ativos.length} itens</span>
            </div>
            <table>
              <thead>
                <tr>
                  <th className="c" style={{ width: '22px' }}>
                    Ord.
                  </th>
                  <th>Insumo</th>
                  <th className="num" style={{ width: '80px' }}>
                    Qtd. necessária
                  </th>
                  <th className="qc" style={{ width: '96px' }}>
                    Lote MP
                  </th>
                  <th className="qc c" style={{ width: '56px' }}>
                    Validade
                  </th>
                  <th className="qc c" style={{ width: '22px' }}>
                    <span className="box"></span>
                  </th>
                  <th className="qc" style={{ width: '96px' }}>
                    Conferido por
                  </th>
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

        {/* Excipiente Base */}
        {excipienteBase.length > 0 && (
          <>
            <div className="sec">
              <span className="n">2</span>
              <h2>Excipiente base (Q.S.P.)</h2>
              <span className="cnt">{excipienteBase.length} item</span>
            </div>
            <table>
              <thead>
                <tr>
                  <th className="c" style={{ width: '22px' }}>
                    Ord.
                  </th>
                  <th>Insumo</th>
                  <th className="num" style={{ width: '80px' }}>
                    Qtd. necessária
                  </th>
                  <th className="qc" style={{ width: '96px' }}>
                    Lote MP
                  </th>
                  <th className="qc c" style={{ width: '56px' }}>
                    Validade
                  </th>
                  <th className="qc c" style={{ width: '22px' }}>
                    <span className="box"></span>
                  </th>
                  <th className="qc" style={{ width: '96px' }}>
                    Conferido por
                  </th>
                </tr>
              </thead>
              <tbody>
                {excipienteBase.map((item, idx) => (
                  <tr key={item.id}>
                    <td className="c">{idx + 1}</td>
                    <td>
                      {item.insumo_nome} <span className="tag e">Q.S.P.</span>
                    </td>
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

        {/* Excipientes Tecnológicos */}
        {excipienteTec.length > 0 && (
          <>
            <div className="sec">
              <span className="n">3</span>
              <h2>Excipientes tecnológicos</h2>
              <span className="cnt">{excipienteTec.length} itens</span>
            </div>
            <table>
              <thead>
                <tr>
                  <th className="c" style={{ width: '22px' }}>
                    Ord.
                  </th>
                  <th>Insumo</th>
                  <th style={{ width: '74px' }}>Função</th>
                  <th className="num" style={{ width: '80px' }}>
                    Qtd. necessária
                  </th>
                  <th className="qc" style={{ width: '96px' }}>
                    Lote MP
                  </th>
                  <th className="qc c" style={{ width: '22px' }}>
                    <span className="box"></span>
                  </th>
                  <th className="qc" style={{ width: '80px' }}>
                    Conferido por
                  </th>
                </tr>
              </thead>
              <tbody>
                {excipienteTec.map((item, idx) => (
                  <tr key={item.id}>
                    <td className="c">{idx + 1}</td>
                    <td>{item.insumo_nome}</td>
                    <td>{item.funcao_tecnologica || '—'}</td>
                    <td className="num">{formatarQtd(item.quantidade_teorica_g)}</td>
                    <td className="qc"></td>
                    <td className="qc c"></td>
                    <td className="qc"></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* Materiais de Embalagem */}
        {opData.op_embalagens && opData.op_embalagens.length > 0 && (
          <>
            <div className="sec">
              <span className="n">4</span>
              <h2>Materiais de embalagem</h2>
              <span className="cnt">{opData.op_embalagens.length} itens</span>
            </div>
            <table>
              <thead>
                <tr>
                  <th className="c" style={{ width: '22px' }}>
                    Ord.
                  </th>
                  <th>Material</th>
                  <th className="c" style={{ width: '80px' }}>
                    Tipo
                  </th>
                  <th className="num" style={{ width: '80px' }}>
                    Quantidade
                  </th>
                  <th className="qc" style={{ width: '96px' }}>
                    Lote
                  </th>
                  <th className="qc c" style={{ width: '22px' }}>
                    <span className="box"></span>
                  </th>
                  <th className="qc" style={{ width: '80px' }}>
                    Conferido por
                  </th>
                </tr>
              </thead>
              <tbody>
                {opData.op_embalagens.map((item, idx) => (
                  <tr key={item.id}>
                    <td className="c">{idx + 1}</td>
                    <td>{item.insumo_nome}</td>
                    <td className="c">{item.tipo_embalagem}</td>
                    <td className="num">{item.quantidade_planejada}</td>
                    <td className="qc"></td>
                    <td className="qc c"></td>
                    <td className="qc"></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      {/* Placeholder para as outras 5 páginas */}
      <div className="page" style={{ padding: '20px' }}>
        <p style={{ color: '#999' }}>Página 3 — Fase 2: Pesagem (em desenvolvimento)</p>
      </div>
      <div className="page" style={{ padding: '20px' }}>
        <p style={{ color: '#999' }}>Página 4 — Fase 3: Mistura (em desenvolvimento)</p>
      </div>
      <div className="page" style={{ padding: '20px' }}>
        <p style={{ color: '#999' }}>Página 5 — Fase 4: Encapsulamento (em desenvolvimento)</p>
      </div>
      <div className="page" style={{ padding: '20px' }}>
        <p style={{ color: '#999' }}>Página 6 — Fase 5: Embalagem (em desenvolvimento)</p>
      </div>
      <div className="page" style={{ padding: '20px' }}>
        <p style={{ color: '#999' }}>Página 7 — Checklist (em desenvolvimento)</p>
      </div>
    </div>
  );
}
