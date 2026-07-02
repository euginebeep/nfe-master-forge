// ============================================================
// FOLHA DE PESAGEM - PADRÃO INDUSTRIAL PROFISSIONAL A4
// Formato ANVISA/ISO - Boas Práticas de Fabricação
// ============================================================
import type { OPDadosPDF, OPMateriaPrimaPDF } from '@/types/op-pdf';

interface OPFolhaPesagemProps {
  op: OPDadosPDF;
  materiasPrimas: OPMateriaPrimaPDF[];
}

export function OPFolhaPesagem({ op, materiasPrimas }: OPFolhaPesagemProps) {
  const mpOrdenadas = [...materiasPrimas].sort((a, b) => 
    (a.ordem_mistura || 999) - (b.ordem_mistura || 999)
  );

  const itensCriticos = mpOrdenadas.filter(mp => mp.pesagem_critica);
  const ativos = mpOrdenadas.filter(mp => mp.categoria === 'ATIVO');
  const excipientes = mpOrdenadas.filter(mp => mp.categoria !== 'ATIVO');

  const formatarQuantidade = (valorG: number) => {
    if (!valorG) return { valor: '-', unidade: '', balanca: '-' };
    if (valorG >= 1000) return { valor: (valorG / 1000).toFixed(4), unidade: 'kg', balanca: '2 casas decimais' };
    if (valorG >= 1) return { valor: valorG.toFixed(4), unidade: 'g', balanca: '3 ou 4 casas' };
    if (valorG >= 0.001) return { valor: (valorG * 1000).toFixed(4), unidade: 'mg', balanca: '4 ou 5 casas (analítica)' };
    return { valor: (valorG * 1000000).toFixed(2), unidade: 'mcg', balanca: '5+ casas (ultra-analítica)' };
  };

  const formatarTolerancia = (min: number, max: number) => {
    const minFmt = formatarQuantidade(min);
    const maxFmt = formatarQuantidade(max);
    return `${minFmt.valor} - ${maxFmt.valor} ${maxFmt.unidade}`;
  };

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  return (
    <div id="section-pesagem" className="bg-white print:text-[9px]">
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
            <div className="text-[9px] text-slate-500 uppercase font-semibold mb-1">Total de Cápsulas</div>
            <div className="text-sm font-bold text-orange-600">{(op.total_capsulas_com_acrescimo || 0).toLocaleString()} un</div>
          </div>
          <div className="p-3">
            <div className="text-[9px] text-slate-500 uppercase font-semibold mb-1">Data Fabricação</div>
            <div className="text-sm font-bold text-slate-800">{formatDate(op.data_fabricacao)}</div>
          </div>
        </div>
        <div className="grid grid-cols-4 divide-x divide-slate-300 border-t border-slate-300">
          <div className="p-3">
            <div className="text-[9px] text-slate-500 uppercase font-semibold mb-1">Fórmula</div>
            <div className="text-sm font-bold text-slate-800">{op.formula_codigo || '-'}</div>
          </div>
          <div className="p-3">
            <div className="text-[9px] text-slate-500 uppercase font-semibold mb-1">Data Validade</div>
            <div className="text-sm font-bold text-slate-800">{formatDate(op.data_validade)}</div>
          </div>
          <div className="p-3">
            <div className="text-[9px] text-slate-500 uppercase font-semibold mb-1">Responsável Técnico</div>
            <div className="text-sm font-bold text-slate-800">{op.rt_nome || '-'}</div>
          </div>
          <div className="p-3">
            <div className="text-[9px] text-slate-500 uppercase font-semibold mb-1">Conselho/Registro</div>
            <div className="text-sm font-bold text-slate-800">{op.rt_tipo_conselho || ''} {op.rt_numero_registro || '-'}</div>
          </div>
        </div>
        <div className="grid grid-cols-4 divide-x divide-slate-300 border-t border-slate-300 bg-slate-50">
          <div className="p-3">
            <div className="text-[9px] text-slate-500 uppercase font-semibold mb-1">Balança Analítica — N° Série</div>
            <div className="text-sm font-bold text-slate-800 font-mono">
              {(op as any).balanca_numero_serie || '_______________'}
            </div>
          </div>
          <div className="p-3">
            <div className="text-[9px] text-slate-500 uppercase font-semibold mb-1">Última Calibração</div>
            <div className="text-sm font-bold text-slate-800">
              {(op as any).balanca_ultima_calibracao
                ? new Date((op as any).balanca_ultima_calibracao).toLocaleDateString('pt-BR')
                : '___/___/______'}
            </div>
          </div>
          <div className="p-3">
            <div className="text-[9px] text-slate-500 uppercase font-semibold mb-1">Próxima Calibração</div>
            <div className="text-sm font-bold text-slate-800">
              {(op as any).balanca_proxima_calibracao
                ? new Date((op as any).balanca_proxima_calibracao).toLocaleDateString('pt-BR')
                : '___/___/______'}
            </div>
          </div>
          <div className="p-3">
            <div className="text-[9px] text-slate-500 uppercase font-semibold mb-1">Status Calibração</div>
            <div className="text-sm font-bold" style={{
              color: (op as any).balanca_proxima_calibracao &&
                new Date((op as any).balanca_proxima_calibracao) > new Date()
                ? '#15803d' : '#dc2626'
            }}>
              {(op as any).balanca_proxima_calibracao &&
                new Date((op as any).balanca_proxima_calibracao) > new Date()
                ? '✓ CALIBRADA' : '⚠ VERIFICAR'}
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* BLOCO 2: ALERTA DE ATIVOS CRÍTICOS                             */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {itensCriticos.length > 0 && (
        <div className="border-2 border-red-600 bg-red-50 mb-4">
          <div className="bg-red-600 px-4 py-2">
            <h2 className="text-sm font-bold uppercase tracking-wide text-white flex items-center gap-2">
              <span>⚠️</span> 2. ATENÇÃO: {itensCriticos.length} ATIVO(S) CRÍTICO(S)
            </h2>
          </div>
          <div className="p-4 text-xs text-red-800">
            <p className="mb-2"><strong>Itens marcados como CRÍTICOS exigem DUPLA CONFERÊNCIA.</strong></p>
            <p className="font-bold text-red-900">⛔ PROIBIDA A PESAGEM DIRETA NO LOTE FINAL — Seguir procedimento de PRÉ-MIX obrigatório.</p>
          </div>
          
          {/* DISTRIBUIÇÃO GEOMÉTRICA */}
          <div className="border-t border-red-300 p-4">
            <h3 className="font-bold text-sm text-red-800 mb-3">PROCEDIMENTO DE DISTRIBUIÇÃO GEOMÉTRICA:</h3>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-red-100">
                  <th className="border border-red-300 px-2 py-2 text-center w-[8%]">Passo</th>
                  <th className="border border-red-300 px-2 py-2 text-left w-[62%]">Descrição</th>
                  <th className="border border-red-300 px-2 py-2 text-center w-[15%]">Proporção</th>
                  <th className="border border-red-300 px-2 py-2 text-center w-[15%]">Conforme</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { passo: 1, texto: 'Pesar o ativo em balança analítica (4-5 casas)', prop: '1:0' },
                  { passo: 2, texto: 'Adicionar quantidade IGUAL de Excipiente Base', prop: '1:1' },
                  { passo: 3, texto: 'Homogeneizar por 2 minutos com movimentos circulares', prop: '-' },
                  { passo: 4, texto: 'Dobrar o volume com mais Excipiente Base, homogeneizar 2 min', prop: '1:2' },
                  { passo: 5, texto: 'Repetir passo 4 até completar volume total do Excipiente Base', prop: 'Progressivo' },
                  { passo: 6, texto: 'Homogeneização final por 5 minutos', prop: 'Final' },
                ].map(step => (
                  <tr key={step.passo} className="bg-white">
                    <td className="border border-red-200 px-2 py-2 text-center font-bold">{step.passo}</td>
                    <td className="border border-red-200 px-2 py-2">{step.texto}</td>
                    <td className="border border-red-200 px-2 py-2 text-center font-mono text-red-600">{step.prop}</td>
                    <td className="border border-red-200 px-2 py-2 text-center">☐</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* BLOCO 3: PESAGEM DE ATIVOS                                     */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* Condições Ambientais — RDC 243/2018, IN 28/2018 e RDC 843/2024 */}
      <div className="border-2 border-blue-300 mb-3 bg-blue-50">
        <div className="bg-blue-300 px-3 py-1">
          <span className="text-xs font-bold uppercase text-blue-900">
            Condições Ambientais — RDC 243/2018, IN 28/2018 e RDC 843/2024
          </span>
        </div>
        <div className="grid grid-cols-4 divide-x divide-blue-200 p-2">
          <div className="px-3">
            <div className="text-[8px] text-slate-500 uppercase">Temperatura</div>
            <div className="text-xs mt-1">_______ °C</div>
          </div>
          <div className="px-3">
            <div className="text-[8px] text-slate-500 uppercase">Umidade Relativa</div>
            <div className="text-xs mt-1">_______ %</div>
          </div>
          <div className="px-3">
            <div className="text-[8px] text-slate-500 uppercase">Verificado por</div>
            <div className="text-xs mt-1">_________________</div>
          </div>
          <div className="px-3">
            <div className="text-[8px] text-slate-500 uppercase">Hora</div>
            <div className="text-xs mt-1">_______</div>
          </div>
        </div>
      </div>

      <div className="border-2 border-red-600 mb-4">
        <div className="bg-red-600 px-4 py-2 flex items-center gap-3">
          <span className="flex items-center justify-center w-7 h-7 bg-white text-red-600 rounded-full font-bold text-sm">{itensCriticos.length > 0 ? 3 : 2}</span>
          <h2 className="text-sm font-bold uppercase tracking-wide text-white">PESAGEM DE ATIVOS</h2>
          <span className="ml-auto text-white text-xs">{ativos.length} item(ns)</span>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-red-100">
              <th className="border border-red-200 px-2 py-2 text-center w-[5%]">Ord.</th>
              <th className="border border-red-200 px-2 py-2 text-left w-[22%]">Insumo</th>
              <th className="border border-red-200 px-2 py-2 text-center w-[8%]">Tipo</th>
              <th className="border border-red-200 px-2 py-2 text-right w-[12%]">Qtd. Teórica</th>
              <th className="border border-slate-400 px-2 py-2 w-[14%]">Qtd. Pesada (real)</th>
              <th className="border border-slate-400 px-2 py-2 w-[10%]">Balança Nº</th>
              <th className="border border-red-200 px-2 py-2 text-right w-[14%]">Tolerância ±10%</th>
              <th className="border border-red-200 px-2 py-2 text-center w-[10%]">Lote MP</th>
              <th className="border border-red-200 px-2 py-2 text-center w-[12%]">Peso Real</th>
              <th className="border border-red-200 px-2 py-2 text-center w-[10%]">Pesado Por</th>
              <th className="border border-red-200 px-2 py-2 text-center w-[7%]">☑</th>
            </tr>
          </thead>
          <tbody>
            {ativos.length === 0 ? (
              <tr><td colSpan={11} className="border border-red-200 p-3 text-center text-slate-400 italic">Nenhum ativo cadastrado</td></tr>
            ) : (
              ativos.map((mp, idx) => {
                const qtd = formatarQuantidade(mp.quantidade_teorica_g);
                return (
                  <tr key={mp.id || idx} className={mp.pesagem_critica ? 'bg-amber-50' : 'bg-white'}>
                    <td className="border border-red-200 px-2 py-3 text-center">
                      <span className="inline-flex items-center justify-center w-6 h-6 bg-red-600 text-white rounded-full text-[10px] font-bold">{mp.ordem_mistura || idx + 1}</span>
                    </td>
                    <td className="border border-red-200 px-2 py-3">
                      <div className="font-semibold">{mp.insumo_nome}</div>
                      {mp.pesagem_critica && <span className="inline-block mt-1 px-2 py-0.5 bg-red-600 text-white rounded text-[9px] font-bold">CRÍTICO</span>}
                    </td>
                    <td className="border border-red-200 px-2 py-3 text-center">
                      {mp.pesagem_critica ? (
                        <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-[9px]">Crítica</span>
                      ) : (
                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px]">Padrão</span>
                      )}
                    </td>
                    <td className="border border-red-200 px-2 py-3 text-right font-mono font-semibold">{qtd.valor} {qtd.unidade}</td>
                    <td className="border border-slate-400 px-2 py-3 w-[14%]">&nbsp;</td>
                    <td className="border border-slate-400 px-2 py-3 w-[10%]">&nbsp;</td>
                    <td className="border border-red-200 px-2 py-3 text-right text-[9px] text-slate-500">{formatarTolerancia(mp.quantidade_minima_g, mp.quantidade_maxima_g)}</td>
                    <td className="border border-red-200 px-2 py-3"><div className="border-b-2 border-slate-400 min-h-[20px]">&nbsp;</div></td>
                    <td className="border border-red-200 px-2 py-3">
                      <div className="border-b-2 border-slate-400 min-h-[20px]">&nbsp;</div>
                      <div className="text-[8px] text-slate-400 mt-0.5 text-center">{qtd.unidade}</div>
                    </td>
                    <td className="border border-red-200 px-2 py-3"><div className="border-b-2 border-slate-400 min-h-[20px]">&nbsp;</div></td>
                    <td className="border border-red-200 px-2 py-3 text-center text-xl">☐</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* BLOCO 4: PESAGEM DE EXCIPIENTES                                */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="border-2 border-green-600 mb-4">
        <div className="bg-green-600 px-4 py-2 flex items-center gap-3">
          <span className="flex items-center justify-center w-7 h-7 bg-white text-green-600 rounded-full font-bold text-sm">{itensCriticos.length > 0 ? 4 : 3}</span>
          <h2 className="text-sm font-bold uppercase tracking-wide text-white">PESAGEM DE EXCIPIENTES</h2>
          <span className="ml-auto text-white text-xs">{excipientes.length} item(ns)</span>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-green-100">
              <th className="border border-green-200 px-2 py-2 text-center w-[5%]">Ord.</th>
              <th className="border border-green-200 px-2 py-2 text-left w-[22%]">Insumo</th>
              <th className="border border-green-200 px-2 py-2 text-center w-[10%]">Categoria</th>
              <th className="border border-green-200 px-2 py-2 text-right w-[12%]">Qtd. Teórica</th>
              <th className="border border-slate-400 px-2 py-2 w-[14%]">Qtd. Pesada (real)</th>
              <th className="border border-slate-400 px-2 py-2 w-[10%]">Balança Nº</th>
              <th className="border border-green-200 px-2 py-2 text-right w-[14%]">Tolerância ±10%</th>
              <th className="border border-green-200 px-2 py-2 text-center w-[10%]">Lote MP</th>
              <th className="border border-green-200 px-2 py-2 text-center w-[12%]">Peso Real</th>
              <th className="border border-green-200 px-2 py-2 text-center w-[10%]">Pesado Por</th>
              <th className="border border-green-200 px-2 py-2 text-center w-[5%]">☑</th>
            </tr>
          </thead>
          <tbody>
            {excipientes.length === 0 ? (
              <tr><td colSpan={11} className="border border-green-200 p-3 text-center text-slate-400 italic">Nenhum excipiente cadastrado</td></tr>
            ) : (
              excipientes.map((mp, idx) => {
                const qtd = formatarQuantidade(mp.quantidade_teorica_g);
                const catLabel = mp.categoria === 'EXCIPIENTE_BASE' ? 'Base (QSP)' : 'Tecnológico';
                return (
                  <tr key={mp.id || idx} className="bg-white">
                    <td className="border border-green-200 px-2 py-3 text-center">
                      <span className="inline-flex items-center justify-center w-6 h-6 bg-green-600 text-white rounded-full text-[10px] font-bold">{mp.ordem_mistura || ativos.length + idx + 1}</span>
                    </td>
                    <td className="border border-green-200 px-2 py-3 font-semibold">{mp.insumo_nome}</td>
                    <td className="border border-green-200 px-2 py-3 text-center">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] ${mp.categoria === 'EXCIPIENTE_BASE' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                        {catLabel}
                      </span>
                    </td>
                    <td className="border border-green-200 px-2 py-3 text-right font-mono font-semibold">{qtd.valor} {qtd.unidade}</td>
                    <td className="border border-slate-400 px-2 py-3 w-[14%]">&nbsp;</td>
                    <td className="border border-slate-400 px-2 py-3 w-[10%]">&nbsp;</td>
                    <td className="border border-green-200 px-2 py-3 text-right text-[9px] text-slate-500">{formatarTolerancia(mp.quantidade_minima_g, mp.quantidade_maxima_g)}</td>
                    <td className="border border-green-200 px-2 py-3"><div className="border-b-2 border-slate-400 min-h-[20px]">&nbsp;</div></td>
                    <td className="border border-green-200 px-2 py-3">
                      <div className="border-b-2 border-slate-400 min-h-[20px]">&nbsp;</div>
                      <div className="text-[8px] text-slate-400 mt-0.5 text-center">{qtd.unidade}</div>
                    </td>
                    <td className="border border-green-200 px-2 py-3"><div className="border-b-2 border-slate-400 min-h-[20px]">&nbsp;</div></td>
                    <td className="border border-green-200 px-2 py-3 text-center text-xl">☐</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* BLOCO 5: REFERÊNCIA DE BALANÇAS                                */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="border-2 border-slate-600 bg-slate-50 mb-4">
        <div className="bg-slate-600 px-4 py-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-white">
            📋 REFERÊNCIA DE BALANÇAS
          </h2>
        </div>
        <div className="p-4">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-200">
                <th className="border border-slate-300 px-3 py-2 text-left">Faixa de Peso</th>
                <th className="border border-slate-300 px-3 py-2 text-left">Tipo de Balança</th>
                <th className="border border-slate-300 px-3 py-2 text-center">Precisão</th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-white">
                <td className="border border-slate-300 px-3 py-2 font-semibold">≥ 1 kg</td>
                <td className="border border-slate-300 px-3 py-2">Semi-analítica</td>
                <td className="border border-slate-300 px-3 py-2 text-center font-mono">2 casas decimais</td>
              </tr>
              <tr className="bg-slate-50">
                <td className="border border-slate-300 px-3 py-2 font-semibold">1g a 1kg</td>
                <td className="border border-slate-300 px-3 py-2">Semi-analítica</td>
                <td className="border border-slate-300 px-3 py-2 text-center font-mono">3 ou 4 casas</td>
              </tr>
              <tr className="bg-white">
                <td className="border border-slate-300 px-3 py-2 font-semibold">1mg a 1g</td>
                <td className="border border-slate-300 px-3 py-2">Analítica</td>
                <td className="border border-slate-300 px-3 py-2 text-center font-mono">4 ou 5 casas</td>
              </tr>
              <tr className="bg-amber-50">
                <td className="border border-slate-300 px-3 py-2 font-bold text-amber-700">&lt; 1mg</td>
                <td className="border border-slate-300 px-3 py-2 font-bold text-amber-700">Ultra-analítica</td>
                <td className="border border-slate-300 px-3 py-2 text-center font-mono font-bold text-amber-700">5+ casas</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* BLOCO 6: ASSINATURAS                                           */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="border-2 border-slate-800 mt-6">
        <div className="bg-slate-800 px-4 py-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-white">
            ASSINATURAS E APROVAÇÕES
          </h2>
        </div>
        <div className="grid grid-cols-3 divide-x divide-slate-300">
          {[
            { cargo: 'Operador de Pesagem', funcao: 'Execução' },
            { cargo: 'Conferente', funcao: 'Verificação' },
            { cargo: 'Responsável Técnico', funcao: 'Liberação da Pesagem' },
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

      {/* CABEÇALHO COM LOGO E ENDEREÇO */}
      {op.empresa_logo_url && (
        <div className="mb-4 pb-2 border-b-2 border-slate-300 flex items-center gap-4">
          <img src={op.empresa_logo_url} alt="Logo" style={{ maxHeight: '60px', maxWidth: '150px', objectFit: 'contain' }} />
          <div className="flex-1">
            <div className="text-sm font-bold text-slate-800">{op.empresa_nome || 'Empresa não identificada'}</div>
            <div className="text-[8px] text-slate-600">{op.empresa_endereco || ''}</div>
            <div className="text-[8px] text-slate-600">CNPJ: {op.empresa_cnpj || '-'}</div>
          </div>
        </div>
      )}
      {!op.empresa_logo_url && (
        <div className="mb-4 pb-2 border-b-2 border-slate-300">
          <div className="text-sm font-bold text-slate-800">{op.empresa_nome || 'Empresa não identificada'}</div>
          <div className="text-[8px] text-slate-600">{op.empresa_endereco || ''}</div>
          <div className="text-[8px] text-slate-600">CNPJ: {op.empresa_cnpj || '-'}</div>
        </div>
      )}

      {/* RODAPÉ */}
      <div className="mt-4 pt-2 border-t-2 border-slate-400 flex justify-between text-[8px] text-slate-500">
        <div>{op.empresa_nome || 'Empresa não identificada'} | Documento de Produção Industrial</div>
        <div>{op.codigo} | Gerado em {new Date().toLocaleString('pt-BR')}</div>
        <div>Controle ANVISA/BPF</div>
      </div>
    </div>
  );
}
