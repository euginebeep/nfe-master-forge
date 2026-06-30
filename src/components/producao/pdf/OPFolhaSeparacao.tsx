// ============================================================
// FOLHA DE SEPARAÇÃO DE MATERIAIS - PADRÃO INDUSTRIAL A4
// Formato ANVISA/ISO - Boas Práticas de Fabricação
// ============================================================

import { cn } from '@/lib/utils';
import type { OPDadosPDF, OPMateriaPrimaPDF, OPEmbalagemPDF } from '@/types/op-pdf';

interface OPFolhaSeparacaoProps {
  op: OPDadosPDF;
  materiasPrimas: OPMateriaPrimaPDF[];
  embalagens?: OPEmbalagemPDF[];
}

export function OPFolhaSeparacao({ op, materiasPrimas, embalagens = [] }: OPFolhaSeparacaoProps) {
  const ativos = materiasPrimas.filter(mp => mp.categoria === 'ATIVO');
  const excipienteBase = materiasPrimas.filter(mp => mp.categoria === 'EXCIPIENTE_BASE');
  const tecnologicos = materiasPrimas.filter(mp => mp.categoria === 'EXCIPIENTE_TECNOLOGICO');

  const embalagensFinal = embalagens.length > 0 ? embalagens : calcularEmbalagensPadrao(op);

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  const formatarQuantidade = (valor: number, unidade: string = 'g') => {
    if (!valor) return '-';
    if (valor >= 1000) return `${(valor / 1000).toFixed(4)} kg`;
    return `${valor.toFixed(4)} ${unidade}`;
  };

  return (
    <div id="section-separacao" className="bg-white print:text-[9px]">
      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* BLOCO 1: IDENTIFICAÇÃO DO PRODUTO                              */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="border-2 border-slate-800 mb-4">
        <div className="bg-slate-100 px-4 py-2 border-b border-slate-800">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-800">
            1. IDENTIFICAÇÃO DO PRODUTO E LOTE
          </h2>
        </div>
        <div className="grid grid-cols-4 divide-x divide-slate-300">
          <div className="p-3">
            <div className="text-[9px] text-slate-500 uppercase font-semibold mb-1">Produto</div>
            <div className="text-sm font-bold text-slate-800">{op.produto_nome || '-'}</div>
          </div>
          <div className="p-3">
            <div className="text-[9px] text-slate-500 uppercase font-semibold mb-1">Lote do Produto</div>
            <div className="text-sm font-bold text-slate-800 font-mono">{op.lote_produto_acabado || '-'}</div>
          </div>
          <div className="p-3">
            <div className="text-[9px] text-slate-500 uppercase font-semibold mb-1">Quantidade</div>
            <div className="text-sm font-bold text-slate-800">{op.quantidade_frascos?.toLocaleString() || '-'} frascos × {op.capsulas_por_frasco || 60} un</div>
          </div>
          <div className="p-3">
            <div className="text-[9px] text-slate-500 uppercase font-semibold mb-1">Total c/ Acréscimo</div>
            <div className="text-sm font-bold text-orange-600">{(op.total_capsulas_com_acrescimo || 0).toLocaleString()} un</div>
          </div>
        </div>
        <div className="grid grid-cols-4 divide-x divide-slate-300 border-t border-slate-300">
          <div className="p-3">
            <div className="text-[9px] text-slate-500 uppercase font-semibold mb-1">Responsável Técnico</div>
            <div className="text-sm font-bold text-slate-800">{op.rt_nome || '-'}</div>
          </div>
          <div className="p-3">
            <div className="text-[9px] text-slate-500 uppercase font-semibold mb-1">Conselho/Registro</div>
            <div className="text-sm font-bold text-slate-800">{op.rt_tipo_conselho || ''} {op.rt_numero_registro || '-'}{op.rt_uf_conselho ? '/' + op.rt_uf_conselho : ''}</div>
          </div>
          <div className="p-3">
            <div className="text-[9px] text-slate-500 uppercase font-semibold mb-1">Data Fabricação</div>
            <div className="text-sm font-bold text-slate-800">{formatDate(op.data_fabricacao)}</div>
          </div>
          <div className="p-3">
            <div className="text-[9px] text-slate-500 uppercase font-semibold mb-1">Data Validade</div>
            <div className="text-sm font-bold text-slate-800">{formatDate(op.data_validade)}</div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* BLOCO 2: SEPARAÇÃO DE ATIVOS                                   */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="border-2 border-red-600 mb-4">
        <div className="bg-red-600 px-4 py-2 flex items-center gap-3">
          <span className="flex items-center justify-center w-7 h-7 bg-white text-red-600 rounded-full font-bold text-sm">2</span>
          <h2 className="text-sm font-bold uppercase tracking-wide text-white">
            ATIVOS E PRINCÍPIOS ATIVOS
          </h2>
          <span className="ml-auto text-white text-xs">{ativos.length} item(ns)</span>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-red-50">
              <th className="border border-red-200 px-2 py-2 text-center w-[6%]">Ord.</th>
              <th className="border border-red-200 px-2 py-2 text-left w-[28%]">Insumo</th>
              <th className="border border-red-200 px-2 py-2 text-right w-[14%]">Qtd. Necessária</th>
              <th className="border border-red-200 px-2 py-2 text-center w-[13%]">Lote MP</th>
              <th className="border border-red-200 px-2 py-2 text-center w-[11%]">Validade</th>
              <th className="border border-red-200 px-2 py-2 text-center w-[8%]">☑</th>
              <th className="border border-red-200 px-2 py-2 text-center w-[20%]">Conferido Por</th>
            </tr>
          </thead>
          <tbody>
            {ativos.length === 0 ? (
              <tr><td colSpan={7} className="border border-red-200 p-3 text-center text-slate-400 italic">Nenhum ativo cadastrado</td></tr>
            ) : (
              ativos.map((mp, idx) => (
                <tr key={mp.id || idx} className={cn(mp.pesagem_critica && "bg-yellow-50")}>
                  <td className="border border-red-200 px-2 py-3 text-center">
                    <span className="inline-flex items-center justify-center w-6 h-6 bg-red-600 text-white rounded-full text-[10px] font-bold">{idx + 1}</span>
                  </td>
                  <td className="border border-red-200 px-2 py-3">
                    <div className="font-semibold text-slate-800">{mp.insumo_nome}</div>
                    {mp.pesagem_critica && (
                      <span className="inline-block mt-1 px-2 py-0.5 bg-red-600 text-white text-[9px] font-bold rounded">CRÍTICO</span>
                    )}
                  </td>
                  <td className="border border-red-200 px-2 py-3 text-right font-mono font-semibold">{formatarQuantidade(mp.quantidade_teorica_g)}</td>
                  <td className="border border-red-200 px-2 py-3"><div className="border-b-2 border-slate-400 min-h-[20px]">&nbsp;</div></td>
                  <td className="border border-red-200 px-2 py-3"><div className="border-b-2 border-slate-400 min-h-[20px]">&nbsp;</div></td>
                  <td className="border border-red-200 px-2 py-3 text-center text-xl">☐</td>
                  <td className="border border-red-200 px-2 py-3"><div className="border-b-2 border-slate-400 min-h-[20px]">&nbsp;</div></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* BLOCO 3: EXCIPIENTE BASE                                       */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="border-2 border-green-600 mb-4">
        <div className="bg-green-600 px-4 py-2 flex items-center gap-3">
          <span className="flex items-center justify-center w-7 h-7 bg-white text-green-600 rounded-full font-bold text-sm">3</span>
          <h2 className="text-sm font-bold uppercase tracking-wide text-white">
            EXCIPIENTE BASE (Q.S.P.)
          </h2>
          <span className="ml-auto text-white text-xs">{excipienteBase.length} item(ns)</span>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-green-50">
              <th className="border border-green-200 px-2 py-2 text-center w-[6%]">Ord.</th>
              <th className="border border-green-200 px-2 py-2 text-left w-[32%]">Insumo</th>
              <th className="border border-green-200 px-2 py-2 text-right w-[14%]">Qtd. Necessária</th>
              <th className="border border-green-200 px-2 py-2 text-center w-[13%]">Lote MP</th>
              <th className="border border-green-200 px-2 py-2 text-center w-[11%]">Validade</th>
              <th className="border border-green-200 px-2 py-2 text-center w-[8%]">☑</th>
              <th className="border border-green-200 px-2 py-2 text-center w-[16%]">Conferido Por</th>
            </tr>
          </thead>
          <tbody>
            {excipienteBase.length === 0 ? (
              <tr><td colSpan={7} className="border border-green-200 p-3 text-center text-slate-400 italic">Nenhum excipiente base cadastrado</td></tr>
            ) : (
              excipienteBase.map((mp, idx) => (
                <tr key={mp.id || idx} className="bg-green-50/50">
                  <td className="border border-green-200 px-2 py-3 text-center">
                    <span className="inline-flex items-center justify-center w-6 h-6 bg-green-600 text-white rounded-full text-[10px] font-bold">{idx + 1}</span>
                  </td>
                  <td className="border border-green-200 px-2 py-3">
                    <span className="font-semibold text-slate-800">{mp.insumo_nome}</span>
                    <span className="ml-2 inline-block px-2 py-0.5 bg-green-600 text-white text-[9px] font-bold rounded">Q.S.P.</span>
                  </td>
                  <td className="border border-green-200 px-2 py-3 text-right font-mono font-semibold">{formatarQuantidade(mp.quantidade_teorica_g)}</td>
                  <td className="border border-green-200 px-2 py-3"><div className="border-b-2 border-slate-400 min-h-[20px]">&nbsp;</div></td>
                  <td className="border border-green-200 px-2 py-3"><div className="border-b-2 border-slate-400 min-h-[20px]">&nbsp;</div></td>
                  <td className="border border-green-200 px-2 py-3 text-center text-xl">☐</td>
                  <td className="border border-green-200 px-2 py-3"><div className="border-b-2 border-slate-400 min-h-[20px]">&nbsp;</div></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* BLOCO 4: EXCIPIENTES TECNOLÓGICOS                              */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="border-2 border-blue-600 mb-4">
        <div className="bg-blue-600 px-4 py-2 flex items-center gap-3">
          <span className="flex items-center justify-center w-7 h-7 bg-white text-blue-600 rounded-full font-bold text-sm">4</span>
          <h2 className="text-sm font-bold uppercase tracking-wide text-white">
            EXCIPIENTES TECNOLÓGICOS
          </h2>
          <span className="ml-auto text-white text-xs">{tecnologicos.length} item(ns)</span>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-blue-50">
              <th className="border border-blue-200 px-2 py-2 text-center w-[6%]">Ord.</th>
              <th className="border border-blue-200 px-2 py-2 text-left w-[24%]">Insumo</th>
              <th className="border border-blue-200 px-2 py-2 text-center w-[14%]">Função</th>
              <th className="border border-blue-200 px-2 py-2 text-right w-[12%]">Qtd. Necessária</th>
              <th className="border border-blue-200 px-2 py-2 text-center w-[12%]">Lote MP</th>
              <th className="border border-blue-200 px-2 py-2 text-center w-[8%]">☑</th>
              <th className="border border-blue-200 px-2 py-2 text-center w-[16%]">Conferido Por</th>
            </tr>
          </thead>
          <tbody>
            {tecnologicos.length === 0 ? (
              <tr><td colSpan={7} className="border border-blue-200 p-3 text-center text-slate-400 italic">Nenhum excipiente tecnológico cadastrado</td></tr>
            ) : (
              tecnologicos.map((mp, idx) => {
                const funcao = mp.insumo_nome?.toLowerCase().includes('silício') ? 'Anti-umectante' :
                              mp.insumo_nome?.toLowerCase().includes('talco') ? 'Lubrificante' :
                              mp.insumo_nome?.toLowerCase().includes('estearato') ? 'Deslizante' : 'Tecnológico';
                const isEstearato = mp.insumo_nome?.toLowerCase().includes('estearato');
                return (
                  <tr key={mp.id || idx} className={isEstearato ? "bg-amber-50" : "bg-blue-50/50"}>
                    <td className="border border-blue-200 px-2 py-3 text-center">
                      <span className="inline-flex items-center justify-center w-6 h-6 bg-blue-600 text-white rounded-full text-[10px] font-bold">{idx + 1}</span>
                    </td>
                    <td className="border border-blue-200 px-2 py-3">
                      <div className="font-semibold text-slate-800">{mp.insumo_nome}</div>
                      {isEstearato && <div className="text-[9px] text-amber-600 font-semibold mt-1">⚠ SEMPRE adicionar por último</div>}
                    </td>
                    <td className="border border-blue-200 px-2 py-3 text-center text-slate-600">{funcao}</td>
                    <td className="border border-blue-200 px-2 py-3 text-right font-mono font-semibold">{formatarQuantidade(mp.quantidade_teorica_g)}</td>
                    <td className="border border-blue-200 px-2 py-3"><div className="border-b-2 border-slate-400 min-h-[20px]">&nbsp;</div></td>
                    <td className="border border-blue-200 px-2 py-3 text-center text-xl">☐</td>
                    <td className="border border-blue-200 px-2 py-3"><div className="border-b-2 border-slate-400 min-h-[20px]">&nbsp;</div></td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* BLOCO 5: MATERIAIS DE EMBALAGEM                                */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="border-2 border-purple-600 mb-4">
        <div className="bg-purple-600 px-4 py-2 flex items-center gap-3">
          <span className="flex items-center justify-center w-7 h-7 bg-white text-purple-600 rounded-full font-bold text-sm">5</span>
          <h2 className="text-sm font-bold uppercase tracking-wide text-white">
            MATERIAIS DE EMBALAGEM
          </h2>
          <span className="ml-auto text-white text-xs">{embalagensFinal.length} item(ns)</span>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-purple-50">
              <th className="border border-purple-200 px-2 py-2 text-center w-[6%]">Ord.</th>
              <th className="border border-purple-200 px-2 py-2 text-left w-[28%]">Material</th>
              <th className="border border-purple-200 px-2 py-2 text-center w-[12%]">Tipo</th>
              <th className="border border-purple-200 px-2 py-2 text-right w-[12%]">Qtd. Necessária</th>
              <th className="border border-purple-200 px-2 py-2 text-center w-[12%]">Lote</th>
              <th className="border border-purple-200 px-2 py-2 text-center w-[8%]">☑</th>
              <th className="border border-purple-200 px-2 py-2 text-center w-[14%]">Conferido Por</th>
            </tr>
          </thead>
          <tbody>
            {embalagensFinal.map((emb: any, idx: number) => (
              <tr key={emb.id || idx} className="bg-purple-50/50">
                <td className="border border-purple-200 px-2 py-3 text-center">
                  <span className="inline-flex items-center justify-center w-6 h-6 bg-purple-600 text-white rounded-full text-[10px] font-bold">{idx + 1}</span>
                </td>
                <td className="border border-purple-200 px-2 py-3 font-semibold">{emb.descricao || emb.insumo_nome}</td>
                <td className="border border-purple-200 px-2 py-3 text-center">
                  <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-[9px]">{emb.tipo || 'Embalagem'}</span>
                </td>
                <td className="border border-purple-200 px-2 py-3 text-right font-mono font-semibold">{emb.quantidade_necessaria?.toLocaleString() || '-'} {emb.unidade || 'un'}</td>
                <td className="border border-purple-200 px-2 py-3"><div className="border-b-2 border-slate-400 min-h-[20px]">&nbsp;</div></td>
                <td className="border border-purple-200 px-2 py-3 text-center text-xl">☐</td>
                <td className="border border-purple-200 px-2 py-3"><div className="border-b-2 border-slate-400 min-h-[20px]">&nbsp;</div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* BLOCO 6: ASSINATURAS                                           */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="border-2 border-slate-800 mt-6">
        <div className="bg-slate-800 px-4 py-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-white">
            6. ASSINATURAS E APROVAÇÕES
          </h2>
        </div>
        <div className="grid grid-cols-3 divide-x divide-slate-300">
          {[
            { cargo: 'Separado Por', funcao: 'Execução' },
            { cargo: 'Conferido Por', funcao: 'Verificação' },
            { cargo: 'Responsável Técnico', funcao: 'Liberação' },
          ].map((ass, idx) => (
            <div key={idx} className="p-4 text-center">
              <div className="border-b-2 border-slate-800 h-12 mb-2">&nbsp;</div>
              <div className="text-xs font-bold text-slate-800 uppercase">{ass.cargo}</div>
              <div className="text-[9px] text-slate-500">{ass.funcao}</div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-[9px]">
                <div>
                  <span className="text-slate-500">Nome:</span>
                  <div className="border-b border-slate-400 min-h-[14px]">&nbsp;</div>
                </div>
                <div>
                  <span className="text-slate-500">Data/Hora:</span>
                  <div className="border-b border-slate-400 min-h-[14px]">&nbsp;</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* RODAPÉ */}
      <div className="mt-4 pt-2 border-t-2 border-slate-400 flex justify-between text-[8px] text-slate-500">
        <div>{op.empresa_nome || 'Empresa não identificada'} | Documento de Produção Industrial</div>
        <div>{op.codigo} | Gerado em {new Date().toLocaleString('pt-BR')}</div>
        <div>Controle ANVISA/BPF</div>
      </div>
    </div>
  );
}

function calcularEmbalagensPadrao(op: any) {
  const qtdFrascos = op.quantidade_frascos || 100;
  const qtdComReserva = Math.ceil(qtdFrascos * 1.05);
  const totalCapsulas = op.total_capsulas_com_acrescimo || qtdFrascos * 60;
  const capsulasMaisReserva = Math.ceil(totalCapsulas * 1.10);

  const embalagens = [];
  
  if (op.tipo_apresentacao === 'CAPSULA' || !op.tipo_apresentacao) {
    embalagens.push({
      tipo: 'CAPSULA_VAZIA',
      descricao: `Cápsula Gelatinosa ${op.tipo_capsula || '00'}`,
      quantidade_necessaria: capsulasMaisReserva,
      unidade: 'un'
    });
  }

  embalagens.push(
    { tipo: 'POTE', descricao: 'Pote PEAD Branco c/ Tampa', quantidade_necessaria: qtdComReserva, unidade: 'un' },
    { tipo: 'TAMPA', descricao: 'Tampa Rosca c/ Lacre Indução', quantidade_necessaria: qtdComReserva, unidade: 'un' },
    { tipo: 'ROTULO', descricao: 'Rótulo Adesivo Personalizado', quantidade_necessaria: qtdComReserva, unidade: 'un' },
    { tipo: 'LACRE', descricao: 'Lacre Termoencolhível', quantidade_necessaria: qtdComReserva, unidade: 'un' },
    { tipo: 'SILICA_SACHE', descricao: 'Sachê Sílica Gel 1g', quantidade_necessaria: qtdComReserva, unidade: 'un' }
  );

  return embalagens;
}
