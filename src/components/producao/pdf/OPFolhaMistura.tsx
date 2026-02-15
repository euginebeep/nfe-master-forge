// ============================================================
// FOLHA DE MISTURA - PADRÃO INDUSTRIAL PROFISSIONAL A4
// Formato ANVISA/ISO - Boas Práticas de Fabricação
// ============================================================
import type { OPDadosPDF, OPMateriaPrimaPDF } from '@/types/op-pdf';

interface OPFolhaMisturaProps {
  op: OPDadosPDF;
  materiasPrimas: OPMateriaPrimaPDF[];
}

export function OPFolhaMistura({ op, materiasPrimas }: OPFolhaMisturaProps) {
  const mpOrdenadas = [...materiasPrimas].sort((a, b) => 
    (a.ordem_mistura || 999) - (b.ordem_mistura || 999)
  );

  const ativos = mpOrdenadas.filter(mp => mp.categoria === 'ATIVO');
  const excipienteBase = mpOrdenadas.filter(mp => mp.categoria === 'EXCIPIENTE_BASE');
  const tecnologicos = mpOrdenadas.filter(mp => mp.categoria === 'EXCIPIENTE_TECNOLOGICO');

  const estearato = tecnologicos.find(t => t.insumo_nome?.toLowerCase().includes('estearato'));
  const silicio = tecnologicos.find(t => t.insumo_nome?.toLowerCase().includes('silício') || t.insumo_nome?.toLowerCase().includes('silica'));
  const talco = tecnologicos.find(t => t.insumo_nome?.toLowerCase().includes('talco'));

  const formatarQuantidade = (valorG: number) => {
    if (!valorG) return '-';
    if (valorG >= 1000) return `${(valorG / 1000).toFixed(3)} kg`;
    if (valorG >= 1) return `${valorG.toFixed(4)} g`;
    return `${(valorG * 1000).toFixed(4)} mg`;
  };

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  // Montar sequência de mistura
  const sequenciaMistura = [];
  let etapaNum = 1;
  
  if (ativos.some(a => a.pesagem_critica)) {
    sequenciaMistura.push({
      etapa: 0,
      componente: 'PRÉ-MIX DE ATIVOS CRÍTICOS',
      quantidade: 'Conforme Folha de Pesagem',
      funcao: 'Distribuição Geométrica',
      tempo: 'Conforme procedimento',
      critico: true
    });
  }

  sequenciaMistura.push({
    etapa: etapaNum++,
    componente: 'Ativos Pesados',
    quantidade: ativos.map(a => formatarQuantidade(a.quantidade_teorica_g)).join(' + ') || '-',
    funcao: 'Princípios Ativos',
    tempo: '5 minutos',
    critico: false
  });

  if (excipienteBase.length > 0) {
    sequenciaMistura.push({
      etapa: etapaNum++,
      componente: excipienteBase.map(e => e.insumo_nome).join(', '),
      quantidade: formatarQuantidade(excipienteBase.reduce((sum, e) => sum + (e.quantidade_teorica_g || 0), 0)),
      funcao: 'Q.S.P. / Diluente',
      tempo: '10 minutos',
      critico: false
    });
  }

  if (silicio) {
    sequenciaMistura.push({
      etapa: etapaNum++,
      componente: silicio.insumo_nome,
      quantidade: formatarQuantidade(silicio.quantidade_teorica_g),
      funcao: 'Anti-umectante (2%)',
      tempo: '3 minutos',
      critico: false
    });
  }

  if (talco) {
    sequenciaMistura.push({
      etapa: etapaNum++,
      componente: talco.insumo_nome,
      quantidade: formatarQuantidade(talco.quantidade_teorica_g),
      funcao: 'Lubrificante (5%)',
      tempo: '3 minutos',
      critico: false
    });
  }

  if (estearato) {
    sequenciaMistura.push({
      etapa: '⚠️',
      componente: estearato.insumo_nome + ' (ÚLTIMO)',
      quantidade: formatarQuantidade(estearato.quantidade_teorica_g),
      funcao: 'Deslizante (2,5%)',
      tempo: 'MÁX. 2 min!',
      critico: true
    });
  }

  return (
    <div id="section-mistura" className="bg-white print:text-[9px]">
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
            <div className="text-[9px] text-slate-500 uppercase font-semibold mb-1">Peso por Cápsula</div>
            <div className="text-sm font-bold text-slate-800">{op.peso_capsula_mg || 500} mg</div>
          </div>
        </div>
        <div className="grid grid-cols-4 divide-x divide-slate-300 border-t border-slate-300">
          <div className="p-3">
            <div className="text-[9px] text-slate-500 uppercase font-semibold mb-1">Fórmula</div>
            <div className="text-sm font-bold text-slate-800">{op.formula_codigo || '-'}</div>
          </div>
          <div className="p-3">
            <div className="text-[9px] text-slate-500 uppercase font-semibold mb-1">Data Fabricação</div>
            <div className="text-sm font-bold text-slate-800">{formatDate(op.data_fabricacao)}</div>
          </div>
          <div className="p-3">
            <div className="text-[9px] text-slate-500 uppercase font-semibold mb-1">Data Validade</div>
            <div className="text-sm font-bold text-slate-800">{formatDate(op.data_validade)}</div>
          </div>
          <div className="p-3">
            <div className="text-[9px] text-slate-500 uppercase font-semibold mb-1">Responsável Técnico</div>
            <div className="text-sm font-bold text-slate-800">{op.rt_nome || '-'}</div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* BLOCO 2: REGRAS OBRIGATÓRIAS DE MISTURA                        */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="border-2 border-amber-500 bg-amber-50 mb-4">
        <div className="bg-amber-500 px-4 py-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-white flex items-center gap-2">
            <span>⚠️</span> 2. REGRAS OBRIGATÓRIAS DE MISTURA
          </h2>
        </div>
        <div className="p-4">
          <table className="w-full text-xs">
            <tbody>
              <tr>
                <td className="py-2 pr-4 font-bold text-amber-900 w-1/4">Homogeneização:</td>
                <td className="py-2 text-amber-800">Mínimo 5 minutos entre cada adição de componente</td>
              </tr>
              <tr className="border-t border-amber-300">
                <td className="py-2 pr-4 font-bold text-amber-900">Dióxido de Silício:</td>
                <td className="py-2 text-amber-800">Adicionar ANTES do Talco para melhor fluidez</td>
              </tr>
              <tr className="border-t border-amber-300">
                <td className="py-2 pr-4 font-bold text-red-700">Estearato de Magnésio:</td>
                <td className="py-2 text-red-700 font-semibold">SEMPRE adicionar POR ÚLTIMO — Máximo 2 minutos de mistura</td>
              </tr>
              <tr className="border-t border-amber-300">
                <td className="py-2 pr-4 font-bold text-amber-900">Ambiente:</td>
                <td className="py-2 text-amber-800">Temperatura: 15-25°C | Umidade Relativa: &lt; 60%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* BLOCO 3: SEQUÊNCIA DE MISTURA (TABELA TÉCNICA)                 */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="border-2 border-slate-800 mb-4">
        <div className="bg-slate-800 px-4 py-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-white">
            3. SEQUÊNCIA DE MISTURA
          </h2>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-200">
              <th className="border-r border-slate-300 px-3 py-2 text-center w-[8%] font-bold">ETAPA</th>
              <th className="border-r border-slate-300 px-3 py-2 text-left w-[30%] font-bold">COMPONENTE</th>
              <th className="border-r border-slate-300 px-3 py-2 text-right w-[18%] font-bold">QUANTIDADE</th>
              <th className="border-r border-slate-300 px-3 py-2 text-center w-[22%] font-bold">FUNÇÃO</th>
              <th className="px-3 py-2 text-center w-[22%] font-bold">TEMPO DE MISTURA</th>
            </tr>
          </thead>
          <tbody>
            {sequenciaMistura.map((item, idx) => (
              <tr 
                key={idx} 
                className={`border-t border-slate-300 ${
                  item.critico ? 'bg-amber-100' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'
                }`}
              >
                <td className={`border-r border-slate-300 px-3 py-3 text-center font-bold ${
                  item.critico ? 'text-amber-700' : ''
                }`}>
                  {item.etapa}
                </td>
                <td className={`border-r border-slate-300 px-3 py-3 ${item.critico ? 'font-bold text-amber-800' : ''}`}>
                  {item.componente}
                </td>
                <td className="border-r border-slate-300 px-3 py-3 text-right font-mono">
                  {item.quantidade}
                </td>
                <td className="border-r border-slate-300 px-3 py-3 text-center text-slate-600">
                  {item.funcao}
                </td>
                <td className={`px-3 py-3 text-center font-semibold ${
                  item.critico ? 'text-red-700' : 'text-slate-700'
                }`}>
                  {item.tempo}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* BLOCO 4: REGISTRO DE EXECUÇÃO DA MISTURA                       */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="border-2 border-slate-800 mb-4">
        <div className="bg-slate-700 px-4 py-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-white">
            4. REGISTRO DE EXECUÇÃO DA MISTURA
          </h2>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-slate-300 px-2 py-2 text-center w-[7%]">Etapa</th>
              <th className="border border-slate-300 px-2 py-2 text-left w-[25%]">Componente</th>
              <th className="border border-slate-300 px-2 py-2 text-right w-[13%]">Qtd. Teórica</th>
              <th className="border border-slate-300 px-2 py-2 text-center w-[11%]">Hora Início</th>
              <th className="border border-slate-300 px-2 py-2 text-center w-[11%]">Hora Fim</th>
              <th className="border border-slate-300 px-2 py-2 text-center w-[11%]">Tempo Real</th>
              <th className="border border-slate-300 px-2 py-2 text-center w-[11%]">Operador</th>
              <th className="border border-slate-300 px-2 py-2 text-center w-[11%]">Conferente</th>
            </tr>
          </thead>
          <tbody>
            {sequenciaMistura.map((item, idx) => (
              <tr key={idx} className={item.critico ? 'bg-amber-50' : 'bg-white'}>
                <td className="border border-slate-300 px-2 py-3 text-center font-bold">{item.etapa}</td>
                <td className="border border-slate-300 px-2 py-3">{item.componente}</td>
                <td className="border border-slate-300 px-2 py-3 text-right font-mono text-[10px]">{item.quantidade}</td>
                <td className="border border-slate-300 px-2 py-3">
                  <div className="border-b-2 border-slate-400 min-h-[20px]">&nbsp;</div>
                </td>
                <td className="border border-slate-300 px-2 py-3">
                  <div className="border-b-2 border-slate-400 min-h-[20px]">&nbsp;</div>
                </td>
                <td className="border border-slate-300 px-2 py-3">
                  <div className="border-b-2 border-slate-400 min-h-[20px]">&nbsp;</div>
                </td>
                <td className="border border-slate-300 px-2 py-3">
                  <div className="border-b-2 border-slate-400 min-h-[20px]">&nbsp;</div>
                </td>
                <td className="border border-slate-300 px-2 py-3">
                  <div className="border-b-2 border-slate-400 min-h-[20px]">&nbsp;</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* BLOCO 5: CONTROLE DE QUALIDADE                                 */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="border-2 border-purple-600 mb-4">
        <div className="bg-purple-600 px-4 py-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-white flex items-center gap-2">
            <span>🔬</span> 5. CONTROLE DE QUALIDADE — PÓ FINAL
          </h2>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-purple-100">
              <th className="border border-purple-300 px-3 py-2 text-left w-[25%]">TESTE</th>
              <th className="border border-purple-300 px-3 py-2 text-left w-[30%]">RESULTADO</th>
              <th className="border border-purple-300 px-3 py-2 text-center w-[15%]">CONFORME?</th>
              <th className="border border-purple-300 px-3 py-2 text-left w-[30%]">OBSERVAÇÃO</th>
            </tr>
          </thead>
          <tbody>
            {['Aparência do pó', 'Cor', 'Fluidez', 'Homogeneidade visual', 'Ausência de grumos'].map((teste, idx) => (
              <tr key={idx} className="bg-white">
                <td className="border border-purple-200 px-3 py-3 font-medium">{teste}</td>
                <td className="border border-purple-200 px-3 py-3">
                  <div className="border-b-2 border-slate-400 min-h-[20px]">&nbsp;</div>
                </td>
                <td className="border border-purple-200 px-3 py-3 text-center">
                  <span className="inline-flex gap-4">
                    <span>☐ Sim</span>
                    <span>☐ Não</span>
                  </span>
                </td>
                <td className="border border-purple-200 px-3 py-3">
                  <div className="border-b-2 border-slate-400 min-h-[20px]">&nbsp;</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="p-3 bg-purple-50 border-t border-purple-300">
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="font-semibold text-purple-800">Temperatura ambiente:</span>
              <span className="inline-block ml-2 border-b-2 border-purple-400 min-w-[80px]">&nbsp;</span> °C
            </div>
            <div>
              <span className="font-semibold text-purple-800">Umidade relativa:</span>
              <span className="inline-block ml-2 border-b-2 border-purple-400 min-w-[80px]">&nbsp;</span> %
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* BLOCO 6: ASSINATURAS (RODAPÉ FIXO)                             */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="border-2 border-slate-800 mt-6">
        <div className="bg-slate-800 px-4 py-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-white">
            6. ASSINATURAS E APROVAÇÕES
          </h2>
        </div>
        <div className="grid grid-cols-3 divide-x divide-slate-300">
          {[
            { cargo: 'Operador de Mistura', funcao: 'Execução' },
            { cargo: 'Conferente', funcao: 'Verificação' },
            { cargo: 'Responsável Técnico', funcao: 'Liberação da Mistura' },
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

      {/* RODAPÉ DO DOCUMENTO */}
      <div className="mt-4 pt-2 border-t-2 border-slate-400 flex justify-between text-[8px] text-slate-500">
        <div>Vitalnow Industria Ltda | Documento de Produção Industrial</div>
        <div>{op.codigo} | Gerado em {new Date().toLocaleString('pt-BR')}</div>
        <div>Controle ANVISA/BPF</div>
      </div>
    </div>
  );
}
