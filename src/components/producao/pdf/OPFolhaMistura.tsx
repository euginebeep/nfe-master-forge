// ============================================================
// FOLHA DE MISTURA - FORMATO A4 PROFISSIONAL
// Ordem fixa de mistura industrial
// ============================================================

import { OPCabecalhoPDF, OPRodapePDF, OPAssinaturasPDF } from './OPCabecalhoPDF';

interface OPFolhaMisturaProps {
  op: any;
  materiasPrimas: any[];
}

const InfoBox = ({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) => (
  <div className={`border rounded p-2 ${highlight ? 'bg-amber-50 border-amber-300' : 'bg-slate-50 border-slate-200'}`}>
    <div className="text-[9px] text-slate-500 uppercase tracking-wide">{label}</div>
    <div className={`text-sm font-semibold ${highlight ? 'text-amber-700' : 'text-slate-800'}`}>{value}</div>
  </div>
);

const EtapaBox = ({ 
  numero, 
  titulo, 
  descricao, 
  tempo, 
  corBg, 
  corBorda, 
  destaque = false 
}: { 
  numero: number | string; 
  titulo: string; 
  descricao: string; 
  tempo: string; 
  corBg: string; 
  corBorda: string; 
  destaque?: boolean;
}) => (
  <div className={`flex items-center gap-3 p-3 rounded border-l-4 mb-2 ${corBg} ${corBorda}`}>
    <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${
      destaque ? 'bg-amber-500 text-white' : 'bg-slate-800 text-white'
    }`}>
      {numero}
    </div>
    <div className="flex-1">
      <div className={`font-bold text-sm ${destaque ? 'text-amber-800' : 'text-slate-800'}`}>{titulo}</div>
      <div className="text-xs text-slate-600">{descricao}</div>
    </div>
    <div className={`text-xs font-semibold px-2 py-1 rounded ${
      destaque ? 'bg-amber-200 text-amber-800' : 'bg-slate-200 text-slate-700'
    }`}>
      {tempo}
    </div>
  </div>
);

export function OPFolhaMistura({ op, materiasPrimas }: OPFolhaMisturaProps) {
  const mpOrdenadas = [...materiasPrimas].sort((a, b) => 
    (a.ordem_mistura || 999) - (b.ordem_mistura || 999)
  );

  const ativos = mpOrdenadas.filter(mp => mp.categoria === 'ATIVO');
  const excipienteBase = mpOrdenadas.filter(mp => mp.categoria === 'EXCIPIENTE_BASE');
  const tecnologicos = mpOrdenadas.filter(mp => mp.categoria === 'EXCIPIENTE_TECNOLOGICO');

  const estearato = tecnologicos.find(t => t.insumo_nome.toLowerCase().includes('estearato'));
  const silicio = tecnologicos.find(t => t.insumo_nome.toLowerCase().includes('silício') || t.insumo_nome.toLowerCase().includes('silica'));
  const talco = tecnologicos.find(t => t.insumo_nome.toLowerCase().includes('talco'));
  const outrosTecnologicos = tecnologicos.filter(t => 
    !t.insumo_nome.toLowerCase().includes('estearato') &&
    !t.insumo_nome.toLowerCase().includes('silício') &&
    !t.insumo_nome.toLowerCase().includes('silica') &&
    !t.insumo_nome.toLowerCase().includes('talco')
  );

  const formatarQuantidade = (valorG: number) => {
    if (valorG >= 1000) return `${(valorG / 1000).toFixed(3)} kg`;
    if (valorG >= 1) return `${valorG.toFixed(4)} g`;
    return `${(valorG * 1000).toFixed(4)} mg`;
  };

  return (
    <div id="section-mistura" className="bg-white p-6 text-sm print:p-0 print:text-[10px]">
      {/* Cabeçalho */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 text-white p-4 rounded-t-lg mb-4 print:rounded-none">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-lg font-bold tracking-tight">FOLHA DE MISTURA</h1>
            <p className="text-slate-300 text-xs">Fase 3 - Ordem de Mistura Industrial</p>
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
        <InfoBox label="Peso/Cápsula" value={`${op.peso_capsula_mg || 500} mg`} />
        <InfoBox label="RT Responsável" value={op.rt_nome || '-'} />
      </div>

      {/* REGRAS DE MISTURA */}
      <div className="bg-amber-50 border-2 border-amber-400 rounded-lg p-4 mb-4">
        <div className="font-bold text-amber-800 mb-2 flex items-center gap-2">
          <span>⚠️</span> REGRAS OBRIGATÓRIAS DE MISTURA
        </div>
        <ul className="text-xs text-amber-900 space-y-1 list-disc list-inside">
          <li><strong>Homogeneização:</strong> Mínimo 5 minutos entre cada adição de componente</li>
          <li><strong>Dióxido de Silício:</strong> Adicionar ANTES do Talco para melhor fluidez</li>
          <li><strong>Estearato de Magnésio:</strong> SEMPRE adicionar POR ÚLTIMO (máx. 2 min de mistura)</li>
          <li><strong>Temperatura:</strong> Ambiente controlado (15-25°C) / Umidade &lt; 60%</li>
        </ul>
      </div>

      {/* SEQUÊNCIA DE MISTURA */}
      <div className="mb-4">
        <div className="flex items-center gap-3 p-3 bg-slate-100 border-l-4 border-l-slate-800 mb-3">
          <div className="font-bold text-sm uppercase tracking-wide">SEQUÊNCIA DE MISTURA</div>
        </div>

        {/* ETAPA 0: PRÉ-MIX (se houver ativos críticos) */}
        {ativos.some(a => a.pesagem_critica) && (
          <EtapaBox
            numero="0"
            titulo="PRÉ-MIX DE ATIVOS CRÍTICOS"
            descricao="Executar distribuição geométrica conforme Folha de Pesagem"
            tempo="Conforme proc."
            corBg="bg-red-50"
            corBorda="border-l-red-500"
            destaque
          />
        )}

        {/* ETAPA 1: ATIVOS */}
        <EtapaBox
          numero={1}
          titulo="ADICIONAR ATIVOS"
          descricao={ativos.map(a => a.insumo_nome).join(', ') || 'Nenhum ativo'}
          tempo="Homogeneizar 5 min"
          corBg="bg-red-50"
          corBorda="border-l-red-400"
        />

        {/* ETAPA 2: EXCIPIENTE BASE */}
        <EtapaBox
          numero={2}
          titulo="ADICIONAR EXCIPIENTE BASE (Q.S.P.)"
          descricao={excipienteBase.map(e => `${e.insumo_nome} - ${formatarQuantidade(e.quantidade_teorica_g)}`).join(', ') || 'Não definido'}
          tempo="Homogeneizar 10 min"
          corBg="bg-green-50"
          corBorda="border-l-green-500"
        />

        {/* ETAPA 3: DIÓXIDO DE SILÍCIO */}
        {silicio && (
          <EtapaBox
            numero={3}
            titulo={`ADICIONAR ${silicio.insumo_nome.toUpperCase()}`}
            descricao={`${formatarQuantidade(silicio.quantidade_teorica_g)} - Função: Anti-umectante`}
            tempo="Homogeneizar 3 min"
            corBg="bg-blue-50"
            corBorda="border-l-blue-500"
          />
        )}

        {/* ETAPA 4: TALCO */}
        {talco && (
          <EtapaBox
            numero={4}
            titulo={`ADICIONAR ${talco.insumo_nome.toUpperCase()}`}
            descricao={`${formatarQuantidade(talco.quantidade_teorica_g)} - Função: Lubrificante`}
            tempo="Homogeneizar 3 min"
            corBg="bg-blue-50"
            corBorda="border-l-blue-400"
          />
        )}

        {/* Outros tecnológicos */}
        {outrosTecnologicos.map((tec, idx) => (
          <EtapaBox
            key={tec.id || idx}
            numero={5 + idx}
            titulo={`ADICIONAR ${tec.insumo_nome.toUpperCase()}`}
            descricao={`${formatarQuantidade(tec.quantidade_teorica_g)}`}
            tempo="Homogeneizar 3 min"
            corBg="bg-blue-50"
            corBorda="border-l-blue-300"
          />
        ))}

        {/* ETAPA FINAL: ESTEARATO (ÚLTIMO) */}
        {estearato && (
          <EtapaBox
            numero="⚠️"
            titulo={`ADICIONAR ${estearato.insumo_nome.toUpperCase()} - ÚLTIMO!`}
            descricao={`${formatarQuantidade(estearato.quantidade_teorica_g)} - Função: Deslizante | MÁXIMO 2 MIN DE MISTURA!`}
            tempo="MÁX. 2 min!"
            corBg="bg-amber-100"
            corBorda="border-l-amber-500"
            destaque
          />
        )}
      </div>

      {/* REGISTRO DE EXECUÇÃO DA MISTURA */}
      <div className="mb-4">
        <div className="flex items-center gap-3 p-3 bg-slate-100 border-l-4 border-l-slate-800 mb-3">
          <div className="font-bold text-sm uppercase tracking-wide">REGISTRO DE EXECUÇÃO DA MISTURA</div>
        </div>
        
        <div className="overflow-hidden rounded border border-slate-200">
          <table className="w-full text-xs">
            <thead className="bg-slate-100">
              <tr>
                <th className="p-2 text-center w-[8%]">Etapa</th>
                <th className="p-2 text-left w-[28%]">Componente</th>
                <th className="p-2 text-right w-[12%]">Quantidade</th>
                <th className="p-2 text-center w-[12%]">Hora Início</th>
                <th className="p-2 text-center w-[12%]">Hora Fim</th>
                <th className="p-2 text-center w-[14%]">Tempo Real</th>
                <th className="p-2 text-center w-[14%]">Operador</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t bg-red-50">
                <td className="p-2 text-center font-bold">1</td>
                <td className="p-2">Ativos</td>
                <td className="p-2 text-right">-</td>
                <td className="p-2"><div className="border-b border-slate-300 min-h-[16px]">&nbsp;</div></td>
                <td className="p-2"><div className="border-b border-slate-300 min-h-[16px]">&nbsp;</div></td>
                <td className="p-2"><div className="border-b border-slate-300 min-h-[16px]">&nbsp;</div></td>
                <td className="p-2"><div className="border-b border-slate-300 min-h-[16px]">&nbsp;</div></td>
              </tr>
              <tr className="border-t bg-green-50">
                <td className="p-2 text-center font-bold">2</td>
                <td className="p-2">Excipiente Base (Q.S.P.)</td>
                <td className="p-2 text-right font-mono">{excipienteBase[0] ? formatarQuantidade(excipienteBase[0].quantidade_teorica_g) : '-'}</td>
                <td className="p-2"><div className="border-b border-slate-300 min-h-[16px]">&nbsp;</div></td>
                <td className="p-2"><div className="border-b border-slate-300 min-h-[16px]">&nbsp;</div></td>
                <td className="p-2"><div className="border-b border-slate-300 min-h-[16px]">&nbsp;</div></td>
                <td className="p-2"><div className="border-b border-slate-300 min-h-[16px]">&nbsp;</div></td>
              </tr>
              {silicio && (
                <tr className="border-t bg-blue-50">
                  <td className="p-2 text-center font-bold">3</td>
                  <td className="p-2">{silicio.insumo_nome}</td>
                  <td className="p-2 text-right font-mono">{formatarQuantidade(silicio.quantidade_teorica_g)}</td>
                  <td className="p-2"><div className="border-b border-slate-300 min-h-[16px]">&nbsp;</div></td>
                  <td className="p-2"><div className="border-b border-slate-300 min-h-[16px]">&nbsp;</div></td>
                  <td className="p-2"><div className="border-b border-slate-300 min-h-[16px]">&nbsp;</div></td>
                  <td className="p-2"><div className="border-b border-slate-300 min-h-[16px]">&nbsp;</div></td>
                </tr>
              )}
              {talco && (
                <tr className="border-t bg-blue-50">
                  <td className="p-2 text-center font-bold">4</td>
                  <td className="p-2">{talco.insumo_nome}</td>
                  <td className="p-2 text-right font-mono">{formatarQuantidade(talco.quantidade_teorica_g)}</td>
                  <td className="p-2"><div className="border-b border-slate-300 min-h-[16px]">&nbsp;</div></td>
                  <td className="p-2"><div className="border-b border-slate-300 min-h-[16px]">&nbsp;</div></td>
                  <td className="p-2"><div className="border-b border-slate-300 min-h-[16px]">&nbsp;</div></td>
                  <td className="p-2"><div className="border-b border-slate-300 min-h-[16px]">&nbsp;</div></td>
                </tr>
              )}
              {estearato && (
                <tr className="border-t bg-amber-100">
                  <td className="p-2 text-center font-bold text-amber-800">⚠️</td>
                  <td className="p-2 font-bold text-amber-800">{estearato.insumo_nome} (ÚLTIMO)</td>
                  <td className="p-2 text-right font-mono">{formatarQuantidade(estearato.quantidade_teorica_g)}</td>
                  <td className="p-2"><div className="border-b border-slate-300 min-h-[16px]">&nbsp;</div></td>
                  <td className="p-2"><div className="border-b border-slate-300 min-h-[16px]">&nbsp;</div></td>
                  <td className="p-2"><div className="border-b border-slate-300 min-h-[16px]">&nbsp;</div></td>
                  <td className="p-2"><div className="border-b border-slate-300 min-h-[16px]">&nbsp;</div></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CONTROLE DE QUALIDADE DA MISTURA */}
      <div className="mb-4">
        <div className="flex items-center gap-3 p-3 bg-purple-100 border-l-4 border-l-purple-500 mb-3">
          <div className="font-bold text-sm uppercase tracking-wide text-purple-800">CONTROLE DE QUALIDADE - PÓ FINAL</div>
        </div>
        
        <div className="overflow-hidden rounded border border-purple-200">
          <table className="w-full text-xs">
            <thead className="bg-purple-50">
              <tr>
                <th className="p-2 text-left w-[25%]">Teste</th>
                <th className="p-2 text-left w-[35%]">Resultado</th>
                <th className="p-2 text-center w-[15%]">Conforme?</th>
                <th className="p-2 text-left w-[25%]">Observação</th>
              </tr>
            </thead>
            <tbody>
              {['Aparência do pó', 'Cor', 'Fluidez', 'Homogeneidade visual'].map((teste, idx) => (
                <tr key={idx} className="border-t bg-white">
                  <td className="p-2 font-medium">{teste}</td>
                  <td className="p-2"><div className="border-b border-slate-300 min-h-[16px]">&nbsp;</div></td>
                  <td className="p-2 text-center text-[10px]">☐ Sim &nbsp; ☐ Não</td>
                  <td className="p-2"><div className="border-b border-slate-300 min-h-[16px]">&nbsp;</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Assinaturas */}
      <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t-2 border-slate-800">
        {[
          { cargo: 'Operador de Mistura', subtitulo: 'Nome / Data / Hora' },
          { cargo: 'Conferente', subtitulo: 'Nome / Data / Hora' },
          { cargo: 'Responsável Técnico', subtitulo: 'Liberação da Mistura' },
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
