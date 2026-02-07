// ============================================================
// FOLHA DE PESAGEM DE MATÉRIAS-PRIMAS - FORMATO A4 PROFISSIONAL
// Inclui distribuição geométrica junto com pesagem
// ============================================================

import { OPCabecalhoPDF, OPRodapePDF, OPAssinaturasPDF } from './OPCabecalhoPDF';

interface OPFolhaPesagemProps {
  op: any;
  materiasPrimas: any[];
}

// Componentes auxiliares para layout consistente
const SectionHeader = ({ 
  numero, 
  titulo, 
  subtitulo, 
  corBg, 
  corBorda 
}: { 
  numero: number; 
  titulo: string; 
  subtitulo?: string; 
  corBg: string; 
  corBorda: string; 
}) => (
  <div 
    className={`flex items-center gap-3 p-3 border-l-4 mb-3 ${corBg} ${corBorda}`}
    style={{ pageBreakInside: 'avoid' }}
  >
    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-800 text-white font-bold text-sm">
      {numero}
    </div>
    <div>
      <div className="font-bold text-sm uppercase tracking-wide">{titulo}</div>
      {subtitulo && <div className="text-xs text-slate-600">{subtitulo}</div>}
    </div>
  </div>
);

const InfoBox = ({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) => (
  <div className={`border rounded p-2 ${highlight ? 'bg-amber-50 border-amber-300' : 'bg-slate-50 border-slate-200'}`}>
    <div className="text-[9px] text-slate-500 uppercase tracking-wide">{label}</div>
    <div className={`text-sm font-semibold ${highlight ? 'text-amber-700' : 'text-slate-800'}`}>{value}</div>
  </div>
);

export function OPFolhaPesagem({ op, materiasPrimas }: OPFolhaPesagemProps) {
  const mpOrdenadas = [...materiasPrimas].sort((a, b) => 
    (a.ordem_mistura || 999) - (b.ordem_mistura || 999)
  );

  const itensCriticos = mpOrdenadas.filter(mp => mp.pesagem_critica);
  const ativos = mpOrdenadas.filter(mp => mp.categoria === 'ATIVO');
  const excipientes = mpOrdenadas.filter(mp => mp.categoria !== 'ATIVO');

  const formatarQuantidade = (valorG: number) => {
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

  return (
    <div id="section-pesagem" className="bg-white p-6 text-sm print:p-0 print:text-[10px]">
      {/* Cabeçalho com visual profissional */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 text-white p-4 rounded-t-lg mb-4 print:rounded-none">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-lg font-bold tracking-tight">FOLHA DE PESAGEM</h1>
            <p className="text-slate-300 text-xs">Fase 2 - Pesagem Industrial de Matérias-Primas</p>
          </div>
          <div className="text-right">
            <div className="text-xl font-mono font-bold">{op.codigo}</div>
            <div className="text-xs text-slate-300">Lote: {op.lote_produto_acabado || '-'}</div>
          </div>
        </div>
      </div>

      {/* Grid de informações */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <InfoBox label="Produto" value={op.produto_nome || '-'} />
        <InfoBox label="Total Cápsulas" value={`${op.total_capsulas_com_acrescimo?.toLocaleString() || 0} un`} />
        <InfoBox label="RT Responsável" value={op.rt_nome || '-'} />
        <InfoBox label="Data Fabricação" value={op.data_fabricacao ? new Date(op.data_fabricacao).toLocaleDateString('pt-BR') : '-'} highlight />
      </div>

      {/* ALERTA DE ATIVOS CRÍTICOS */}
      {itensCriticos.length > 0 && (
        <div className="bg-red-50 border-2 border-red-500 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2 text-red-800 font-bold mb-2">
            <span className="text-lg">⚠️</span>
            <span className="uppercase tracking-wide">
              ATENÇÃO: {itensCriticos.length} ATIVO(S) CRÍTICO(S)
            </span>
          </div>
          <div className="text-red-700 text-xs">
            Itens marcados como <strong>CRÍTICOS</strong> exigem <strong>DUPLA CONFERÊNCIA</strong>.
            <br />
            <strong>PROIBIDA A PESAGEM DIRETA NO LOTE FINAL.</strong> Seguir procedimento de PRÉ-MIX obrigatório.
          </div>
        </div>
      )}

      {/* DISTRIBUIÇÃO GEOMÉTRICA (se houver ativos críticos) */}
      {itensCriticos.length > 0 && (
        <div className="mb-4">
          <SectionHeader 
            numero={0} 
            titulo="PROCEDIMENTO DE DISTRIBUIÇÃO GEOMÉTRICA" 
            subtitulo="Obrigatório para ativos críticos"
            corBg="bg-blue-50"
            corBorda="border-l-blue-500"
          />
          
          {itensCriticos.map((mp, idx) => {
            const qtd = formatarQuantidade(mp.quantidade_teorica_g);
            return (
              <div key={mp.id || idx} className="bg-blue-50 border border-blue-200 rounded p-3 mb-3">
                <div className="font-bold text-blue-800 mb-2 text-sm">
                  🔬 {mp.insumo_nome} - {qtd.valor} {qtd.unidade}
                </div>
                
                <div className="grid grid-cols-1 gap-1 text-xs">
                  {[
                    { passo: 1, texto: `Pesar ${qtd.valor} ${qtd.unidade} do ativo em balança ${qtd.balanca}`, prop: '1:0' },
                    { passo: 2, texto: 'Adicionar quantidade IGUAL de Excipiente Base (diluente)', prop: '1:1' },
                    { passo: 3, texto: 'Homogeneizar por 2 minutos com movimentos circulares', prop: '-' },
                    { passo: 4, texto: 'Dobrar o volume com mais Excipiente Base, homogeneizar 2 min', prop: '1:2' },
                    { passo: 5, texto: 'Repetir passo 4 até completar volume total do Excipiente Base', prop: 'Prog.' },
                    { passo: 6, texto: 'Homogeneização final por 5 minutos', prop: 'Final' },
                  ].map(step => (
                    <div key={step.passo} className="flex items-center gap-2 py-1 border-b border-blue-100 last:border-0">
                      <span className="flex items-center justify-center w-5 h-5 bg-blue-600 text-white rounded-full text-[10px] font-bold">
                        {step.passo}
                      </span>
                      <span className="flex-1">{step.texto}</span>
                      <span className="text-blue-600 font-semibold w-12 text-right">{step.prop}</span>
                    </div>
                  ))}
                </div>
                
                <div className="grid grid-cols-2 gap-4 mt-3 pt-2 border-t border-blue-200">
                  <div className="text-xs">
                    <span className="font-semibold">Conferente 1:</span>
                    <span className="inline-block ml-2 border-b border-slate-400 min-w-[100px]">&nbsp;</span>
                  </div>
                  <div className="text-xs">
                    <span className="font-semibold">Conferente 2:</span>
                    <span className="inline-block ml-2 border-b border-slate-400 min-w-[100px]">&nbsp;</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* SEÇÃO 1: ATIVOS */}
      <SectionHeader 
        numero={1} 
        titulo="PESAGEM DE ATIVOS" 
        subtitulo={`${ativos.length} insumo(s) ativo(s)`}
        corBg="bg-red-50"
        corBorda="border-l-red-500"
      />
      
      <div className="mb-4 overflow-hidden rounded border border-slate-200">
        <table className="w-full text-xs">
          <thead className="bg-red-100">
            <tr>
              <th className="p-2 text-left w-[4%]">Ord.</th>
              <th className="p-2 text-left w-[24%]">Insumo</th>
              <th className="p-2 text-left w-[8%]">Tipo</th>
              <th className="p-2 text-right w-[14%]">Qtd. Teórica</th>
              <th className="p-2 text-right w-[14%]">Tolerância ±10%</th>
              <th className="p-2 text-center w-[10%]">Lote MP</th>
              <th className="p-2 text-center w-[13%]">Peso Real</th>
              <th className="p-2 text-center w-[13%]">Pesado Por</th>
            </tr>
          </thead>
          <tbody>
            {ativos.length === 0 ? (
              <tr><td colSpan={8} className="p-3 text-center text-slate-400 italic">Nenhum ativo cadastrado</td></tr>
            ) : (
              ativos.map((mp, idx) => {
                const qtd = formatarQuantidade(mp.quantidade_teorica_g);
                return (
                  <tr key={mp.id || idx} className={`border-t ${mp.pesagem_critica ? 'bg-amber-50' : 'bg-white'}`}>
                    <td className="p-2 text-center">
                      <span className="inline-flex items-center justify-center w-6 h-6 bg-slate-800 text-white rounded-full text-[10px] font-bold">
                        {mp.ordem_mistura || idx + 1}
                      </span>
                    </td>
                    <td className="p-2">
                      <div className="font-semibold">{mp.insumo_nome}</div>
                      {mp.pesagem_critica && (
                        <span className="inline-block mt-1 px-2 py-0.5 bg-red-600 text-white rounded text-[9px] font-bold">
                          CRÍTICO
                        </span>
                      )}
                    </td>
                    <td className="p-2">
                      {mp.pesagem_critica ? (
                        <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-[9px]">Crítica</span>
                      ) : (
                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px]">Padrão</span>
                      )}
                    </td>
                    <td className="p-2 text-right font-mono font-semibold">
                      {qtd.valor} {qtd.unidade}
                    </td>
                    <td className="p-2 text-right text-[9px] text-slate-500">
                      {formatarTolerancia(mp.quantidade_minima_g, mp.quantidade_maxima_g)}
                    </td>
                    <td className="p-2">
                      <div className="border-b border-slate-300 min-h-[18px]">&nbsp;</div>
                    </td>
                    <td className="p-2">
                      <div className="border-b border-slate-300 min-h-[18px]">&nbsp;</div>
                      <div className="text-[8px] text-slate-400 mt-0.5">{qtd.unidade}</div>
                    </td>
                    <td className="p-2">
                      <div className="border-b border-slate-300 min-h-[18px]">&nbsp;</div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* SEÇÃO 2: EXCIPIENTES */}
      <SectionHeader 
        numero={2} 
        titulo="PESAGEM DE EXCIPIENTES" 
        subtitulo={`${excipientes.length} insumo(s)`}
        corBg="bg-green-50"
        corBorda="border-l-green-500"
      />
      
      <div className="mb-4 overflow-hidden rounded border border-slate-200">
        <table className="w-full text-xs">
          <thead className="bg-green-100">
            <tr>
              <th className="p-2 text-left w-[4%]">Ord.</th>
              <th className="p-2 text-left w-[24%]">Insumo</th>
              <th className="p-2 text-left w-[10%]">Categoria</th>
              <th className="p-2 text-right w-[14%]">Qtd. Teórica</th>
              <th className="p-2 text-right w-[14%]">Tolerância ±10%</th>
              <th className="p-2 text-center w-[10%]">Lote MP</th>
              <th className="p-2 text-center w-[12%]">Peso Real</th>
              <th className="p-2 text-center w-[12%]">Pesado Por</th>
            </tr>
          </thead>
          <tbody>
            {excipientes.length === 0 ? (
              <tr><td colSpan={8} className="p-3 text-center text-slate-400 italic">Nenhum excipiente cadastrado</td></tr>
            ) : (
              excipientes.map((mp, idx) => {
                const qtd = formatarQuantidade(mp.quantidade_teorica_g);
                const catLabel = mp.categoria === 'EXCIPIENTE_BASE' ? 'Base (QSP)' : 'Tecnológico';
                return (
                  <tr key={mp.id || idx} className="border-t bg-white">
                    <td className="p-2 text-center">
                      <span className="inline-flex items-center justify-center w-6 h-6 bg-green-600 text-white rounded-full text-[10px] font-bold">
                        {mp.ordem_mistura || ativos.length + idx + 1}
                      </span>
                    </td>
                    <td className="p-2 font-semibold">{mp.insumo_nome}</td>
                    <td className="p-2">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] ${
                        mp.categoria === 'EXCIPIENTE_BASE' 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {catLabel}
                      </span>
                    </td>
                    <td className="p-2 text-right font-mono font-semibold">
                      {qtd.valor} {qtd.unidade}
                    </td>
                    <td className="p-2 text-right text-[9px] text-slate-500">
                      {formatarTolerancia(mp.quantidade_minima_g, mp.quantidade_maxima_g)}
                    </td>
                    <td className="p-2">
                      <div className="border-b border-slate-300 min-h-[18px]">&nbsp;</div>
                    </td>
                    <td className="p-2">
                      <div className="border-b border-slate-300 min-h-[18px]">&nbsp;</div>
                      <div className="text-[8px] text-slate-400 mt-0.5">{qtd.unidade}</div>
                    </td>
                    <td className="p-2">
                      <div className="border-b border-slate-300 min-h-[18px]">&nbsp;</div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Nota sobre balança */}
      <div className="bg-slate-100 border border-slate-300 rounded p-3 mb-4 text-[9px]">
        <div className="font-bold text-slate-700 mb-1">📋 NOTA SOBRE BALANÇAS:</div>
        <div className="grid grid-cols-3 gap-2 text-slate-600">
          <div>• <strong>≥ 1g:</strong> Semi-analítica (3-4 casas)</div>
          <div>• <strong>1mg a 1g:</strong> Analítica (4-5 casas)</div>
          <div>• <strong>&lt; 1mg:</strong> Ultra-analítica (5+ casas)</div>
        </div>
      </div>

      {/* Conferência de Pesagem para Críticos */}
      {itensCriticos.length > 0 && (
        <>
          <SectionHeader 
            numero={3} 
            titulo="REGISTRO DE DUPLA CONFERÊNCIA - ATIVOS CRÍTICOS" 
            subtitulo="Obrigatório para liberação"
            corBg="bg-amber-50"
            corBorda="border-l-amber-500"
          />
          
          <div className="mb-4 overflow-hidden rounded border border-amber-300">
            <table className="w-full text-xs">
              <thead className="bg-amber-100">
                <tr>
                  <th className="p-2 text-left w-[25%]">Ativo</th>
                  <th className="p-2 text-right w-[15%]">Peso Teórico</th>
                  <th className="p-2 text-center w-[15%]">Peso Real</th>
                  <th className="p-2 text-center w-[15%]">Conferente 1</th>
                  <th className="p-2 text-center w-[15%]">Conferente 2</th>
                  <th className="p-2 text-center w-[15%]">Hora</th>
                </tr>
              </thead>
              <tbody>
                {itensCriticos.map((mp, idx) => {
                  const qtd = formatarQuantidade(mp.quantidade_teorica_g);
                  return (
                    <tr key={mp.id || idx} className="border-t bg-amber-50">
                      <td className="p-2 font-semibold">{mp.insumo_nome}</td>
                      <td className="p-2 text-right font-mono">{qtd.valor} {qtd.unidade}</td>
                      <td className="p-2"><div className="border-b border-slate-400 min-h-[18px]">&nbsp;</div></td>
                      <td className="p-2"><div className="border-b border-slate-400 min-h-[18px]">&nbsp;</div></td>
                      <td className="p-2"><div className="border-b border-slate-400 min-h-[18px]">&nbsp;</div></td>
                      <td className="p-2"><div className="border-b border-slate-400 min-h-[18px]">&nbsp;</div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Assinaturas */}
      <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t-2 border-slate-800">
        {[
          { cargo: 'Operador de Pesagem', subtitulo: 'Nome / Data / Hora' },
          { cargo: 'Conferente', subtitulo: 'Nome / Data / Hora' },
          { cargo: 'Responsável Técnico', subtitulo: 'Liberação da Pesagem' },
        ].map((ass, idx) => (
          <div key={idx} className="text-center">
            <div className="border-b border-slate-800 h-8 mb-1">&nbsp;</div>
            <div className="text-xs font-semibold">{ass.cargo}</div>
            <div className="text-[9px] text-slate-500">{ass.subtitulo}</div>
          </div>
        ))}
      </div>

      {/* Rodapé */}
      <div className="mt-4 pt-2 border-t border-slate-300 text-center text-[8px] text-slate-500">
        Documento gerado em {new Date().toLocaleString('pt-BR')} | {op.codigo} | Controle de produção e rastreabilidade ANVISA
      </div>
    </div>
  );
}
