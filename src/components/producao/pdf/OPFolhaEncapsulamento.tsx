// ============================================================
// FOLHA DE ENCAPSULAMENTO - PADRÃO INDUSTRIAL PROFISSIONAL A4
// Formato ANVISA/ISO - Boas Práticas de Fabricação
// ============================================================
import type { OPDadosPDF } from '@/types/op-pdf';
import { CAPSULA_PESO_ALVO_MG } from '@/lib/formulador-industrial-rules';

interface OPFolhaEncapsulamentoProps {
  op: OPDadosPDF;
}

export function OPFolhaEncapsulamento({ op }: OPFolhaEncapsulamentoProps) {
  const pesoCapsula = op.peso_capsula_mg || CAPSULA_PESO_ALVO_MG;
  const tipoCapsula = op.tipo_capsula || '00';
  const totalCapsulas = op.total_capsulas_com_acrescimo || 0;
  const totalFrascos = op.quantidade_frascos || 0;
  const capsPorFrasco = op.capsulas_por_frasco || 60;

  const pesoMin = Math.round(pesoCapsula * 0.95);
  const pesoMax = Math.round(pesoCapsula * 1.05);

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  return (
    <div id="section-encapsulamento" className="bg-white print:text-[9px]">
      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* BLOCO 1: IDENTIFICAÇÃO DO PRODUTO                              */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="border-2 border-slate-800 mb-4">
        <div className="bg-slate-100 px-4 py-2 border-b border-slate-800">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-800">
            1. IDENTIFICAÇÃO DO PRODUTO E ESPECIFICAÇÕES
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
            <div className="text-[9px] text-slate-500 uppercase font-semibold mb-1">Total a Produzir</div>
            <div className="text-sm font-bold text-orange-600">{totalCapsulas.toLocaleString()} cápsulas</div>
          </div>
          <div className="p-3">
            <div className="text-[9px] text-slate-500 uppercase font-semibold mb-1">Frascos</div>
            <div className="text-sm font-bold text-slate-800">{totalFrascos} × {capsPorFrasco} un</div>
          </div>
        </div>
        <div className="grid grid-cols-4 divide-x divide-slate-300 border-t border-slate-300">
          <div className="p-3 bg-blue-50">
            <div className="text-[9px] text-slate-500 uppercase font-semibold mb-1">Tipo de Cápsula</div>
            <div className="text-sm font-bold text-blue-700">Tamanho {tipoCapsula}</div>
          </div>
          <div className="p-3 bg-amber-50">
            <div className="text-[9px] text-slate-500 uppercase font-semibold mb-1">Peso Nominal</div>
            <div className="text-sm font-bold text-amber-700">{pesoCapsula} mg</div>
          </div>
          <div className="p-3">
            <div className="text-[9px] text-slate-500 uppercase font-semibold mb-1">Tolerância (±5%)</div>
            <div className="text-sm font-bold text-slate-800">{pesoMin} - {pesoMax} mg</div>
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
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* BLOCO 2: SETUP DA ENCAPSULADORA                                */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="border-2 border-blue-600 mb-4">
        <div className="bg-blue-600 px-4 py-2 flex items-center gap-3">
          <span className="flex items-center justify-center w-7 h-7 bg-white text-blue-600 rounded-full font-bold text-sm">2</span>
          <h2 className="text-sm font-bold uppercase tracking-wide text-white">
            SETUP DA ENCAPSULADORA
          </h2>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-blue-100">
              <th className="border border-blue-200 px-3 py-2 text-left w-[40%]">Item de Verificação</th>
              <th className="border border-blue-200 px-3 py-2 text-left w-[25%]">Parâmetro</th>
              <th className="border border-blue-200 px-3 py-2 text-center w-[12%]">Verificado</th>
              <th className="border border-blue-200 px-3 py-2 text-center w-[23%]">Responsável</th>
            </tr>
          </thead>
          <tbody>
            {[
              { item: 'Limpeza do equipamento', param: 'Visualmente limpo' },
              { item: 'Troca de placas (se aplicável)', param: `Tamanho ${tipoCapsula}` },
              { item: 'Ajuste de dosagem', param: `${pesoCapsula} mg ± 5%` },
              { item: 'Teste de peso (10 cápsulas)', param: 'Dentro da tolerância' },
              { item: 'Fechamento das cápsulas', param: 'Sem vazamento de pó' },
            ].map((row, idx) => (
              <tr key={idx} className="bg-white">
                <td className="border border-blue-200 px-3 py-3">{row.item}</td>
                <td className="border border-blue-200 px-3 py-3 text-slate-600">{row.param}</td>
                <td className="border border-blue-200 px-3 py-3 text-center">☐ OK</td>
                <td className="border border-blue-200 px-3 py-3"><div className="border-b-2 border-slate-400 min-h-[20px]">&nbsp;</div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* BLOCO 3: CONTROLE DE PESO DURANTE PRODUÇÃO                     */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="border-2 border-amber-500 mb-4">
        <div className="bg-amber-500 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center w-7 h-7 bg-white text-amber-600 rounded-full font-bold text-sm">3</span>
            <h2 className="text-sm font-bold uppercase tracking-wide text-white">
              CONTROLE DE PESO DURANTE PRODUÇÃO
            </h2>
          </div>
          <span className="text-white text-xs">Verificar a cada 30 min ou 1.000 cápsulas</span>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-amber-100">
              <th className="border border-amber-300 px-1 py-2 text-center w-[8%]">Hora</th>
              <th className="border border-amber-300 px-1 py-2 text-center w-[9%]">C.1</th>
              <th className="border border-amber-300 px-1 py-2 text-center w-[9%]">C.2</th>
              <th className="border border-amber-300 px-1 py-2 text-center w-[9%]">C.3</th>
              <th className="border border-amber-300 px-1 py-2 text-center w-[9%]">C.4</th>
              <th className="border border-amber-300 px-1 py-2 text-center w-[9%]">C.5</th>
              <th className="border border-amber-300 px-1 py-2 text-center w-[11%]">Média</th>
              <th className="border border-amber-300 px-1 py-2 text-center w-[10%]">Desvio</th>
              <th className="border border-amber-300 px-1 py-2 text-center w-[8%]">OK?</th>
              <th className="border border-amber-300 px-1 py-2 text-center w-[18%]">Operador</th>
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((linha) => (
              <tr key={linha} className="bg-white">
                <td className="border border-amber-200 px-1 py-2"><div className="border-b-2 border-slate-400 min-h-[18px]">&nbsp;</div></td>
                <td className="border border-amber-200 px-1 py-2"><div className="border-b-2 border-slate-400 min-h-[18px]">&nbsp;</div></td>
                <td className="border border-amber-200 px-1 py-2"><div className="border-b-2 border-slate-400 min-h-[18px]">&nbsp;</div></td>
                <td className="border border-amber-200 px-1 py-2"><div className="border-b-2 border-slate-400 min-h-[18px]">&nbsp;</div></td>
                <td className="border border-amber-200 px-1 py-2"><div className="border-b-2 border-slate-400 min-h-[18px]">&nbsp;</div></td>
                <td className="border border-amber-200 px-1 py-2"><div className="border-b-2 border-slate-400 min-h-[18px]">&nbsp;</div></td>
                <td className="border border-amber-200 px-1 py-2"><div className="border-b-2 border-slate-400 min-h-[18px]">&nbsp;</div></td>
                <td className="border border-amber-200 px-1 py-2"><div className="border-b-2 border-slate-400 min-h-[18px]">&nbsp;</div></td>
                <td className="border border-amber-200 px-1 py-2 text-center">☐</td>
                <td className="border border-amber-200 px-1 py-2"><div className="border-b-2 border-slate-400 min-h-[18px]">&nbsp;</div></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="p-3 bg-amber-50 border-t border-amber-300 text-xs">
          <strong>Referência:</strong> Peso alvo: <span className="font-mono font-bold">{pesoCapsula} mg</span> | 
          Tolerância: <span className="font-mono font-bold text-amber-700">±5% ({pesoMin} - {pesoMax} mg)</span>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* BLOCO 4: REGISTRO DE PRODUÇÃO                                  */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="border-2 border-slate-600">
          <div className="bg-slate-600 px-4 py-2">
            <h3 className="text-sm font-bold uppercase text-white">4A. TEMPOS DE PRODUÇÃO</h3>
          </div>
          <table className="w-full text-xs">
            <tbody>
              {[
                { label: 'Hora de Início' },
                { label: 'Hora de Término' },
                { label: 'Tempo Total' },
              ].map((row, idx) => (
                <tr key={idx} className="border-t border-slate-200">
                  <td className="px-3 py-3 w-1/2 font-medium bg-slate-50">{row.label}:</td>
                  <td className="px-3 py-3"><div className="border-b-2 border-slate-400 min-h-[20px]">&nbsp;</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="border-2 border-slate-600">
          <div className="bg-slate-600 px-4 py-2">
            <h3 className="text-sm font-bold uppercase text-white">4B. QUANTIDADES</h3>
          </div>
          <table className="w-full text-xs">
            <tbody>
              {[
                { label: 'Cápsulas Produzidas' },
                { label: 'Cápsulas Rejeitadas' },
                { label: 'Cápsulas Aprovadas' },
              ].map((row, idx) => (
                <tr key={idx} className="border-t border-slate-200">
                  <td className="px-3 py-3 w-1/2 font-medium bg-slate-50">{row.label}:</td>
                  <td className="px-3 py-3"><div className="border-b-2 border-slate-400 min-h-[20px]">&nbsp;</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* BLOCO 5: CONTROLE DE QUALIDADE / RENDIMENTO                    */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="border-2 border-green-600 mb-4">
        <div className="bg-green-600 px-4 py-2 flex items-center gap-3">
          <span className="flex items-center justify-center w-7 h-7 bg-white text-green-600 rounded-full font-bold text-sm">5</span>
          <h2 className="text-sm font-bold uppercase tracking-wide text-white">
            🔬 CONTROLE DE QUALIDADE E RENDIMENTO
          </h2>
        </div>
        <table className="w-full text-xs">
          <tbody>
            <tr className="bg-green-50">
              <td className="border border-green-200 px-3 py-3 w-[40%] font-bold text-green-800">Quantidade Planejada:</td>
              <td className="border border-green-200 px-3 py-3 font-mono font-bold">{totalCapsulas.toLocaleString()} cápsulas (c/ 5% acréscimo)</td>
            </tr>
            <tr className="bg-white">
              <td className="border border-green-200 px-3 py-3 font-medium">Quantidade Produzida:</td>
              <td className="border border-green-200 px-3 py-3"><span className="inline-block border-b-2 border-slate-400 min-w-[100px]">&nbsp;</span> cápsulas</td>
            </tr>
            <tr className="bg-white">
              <td className="border border-green-200 px-3 py-3 font-medium">Quantidade Aprovada:</td>
              <td className="border border-green-200 px-3 py-3"><span className="inline-block border-b-2 border-slate-400 min-w-[100px]">&nbsp;</span> cápsulas</td>
            </tr>
            <tr className="bg-white">
              <td className="border border-green-200 px-3 py-3 font-medium">Perda Total:</td>
              <td className="border border-green-200 px-3 py-3">
                <span className="inline-block border-b-2 border-slate-400 min-w-[80px]">&nbsp;</span> cápsulas 
                (<span className="inline-block border-b-2 border-slate-400 min-w-[40px]">&nbsp;</span>%)
              </td>
            </tr>
            <tr className="bg-green-100">
              <td className="border border-green-300 px-3 py-3 font-bold text-green-800">RENDIMENTO FINAL:</td>
              <td className="border border-green-300 px-3 py-3">
                <span className="inline-block border-b-2 border-green-600 min-w-[80px] font-mono font-bold">&nbsp;</span>%
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* BLOCO 6: OBSERVAÇÕES                                           */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="border-2 border-slate-600 mb-4">
        <div className="bg-slate-600 px-4 py-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-white">
            6. OBSERVAÇÕES / OCORRÊNCIAS
          </h2>
        </div>
        <div className="p-4 bg-white min-h-[60px]">
          &nbsp;
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* BLOCO: AMOSTRA DE RETENÇÃO — RDC 275/2002                      */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="border-2 border-emerald-600 mb-4">
        <div className="bg-emerald-600 px-4 py-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-white flex items-center gap-2">
            <span>🧪</span> AMOSTRA DE RETENÇÃO — RDC 275/2002
          </h2>
        </div>
        <div className="p-3 grid grid-cols-4 gap-3 text-xs bg-emerald-50">
          <div>
            <div className="text-[9px] text-emerald-800 uppercase font-semibold mb-1">Quantidade Retida</div>
            <div className="border-b-2 border-emerald-400 min-h-[22px] font-mono">&nbsp;</div>
            <div className="text-[8px] text-emerald-600 mt-0.5">mín. 1 frasco por lote</div>
          </div>
          <div>
            <div className="text-[9px] text-emerald-800 uppercase font-semibold mb-1">Localização Física</div>
            <div className="border-b-2 border-emerald-400 min-h-[22px]">&nbsp;</div>
            <div className="text-[8px] text-emerald-600 mt-0.5">ex: Prateleira A3-B2</div>
          </div>
          <div>
            <div className="text-[9px] text-emerald-800 uppercase font-semibold mb-1">Data de Coleta</div>
            <div className="border-b-2 border-emerald-400 min-h-[22px]">&nbsp;</div>
            <div className="text-[8px] text-emerald-600 mt-0.5">{new Date().toLocaleDateString('pt-BR')}</div>
          </div>
          <div>
            <div className="text-[9px] text-emerald-800 uppercase font-semibold mb-1">Descarte após</div>
            <div className="border-b-2 border-emerald-400 min-h-[22px]">&nbsp;</div>
            <div className="text-[8px] text-emerald-600 mt-0.5">validade + 12 meses</div>
          </div>
        </div>
        <div className="p-3 border-t border-emerald-200 grid grid-cols-2 gap-3 text-xs bg-white">
          <div>
            <span className="font-semibold text-emerald-800">Responsável pela coleta:</span>
            <div className="border-b-2 border-emerald-400 min-h-[18px] mt-1">&nbsp;</div>
          </div>
          <div>
            <span className="font-semibold text-emerald-800">Assinatura / Data/Hora:</span>
            <div className="border-b-2 border-emerald-400 min-h-[18px] mt-1">&nbsp;</div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* BLOCO 7: ASSINATURAS                                           */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="border-2 border-slate-800 mt-6">
        <div className="bg-slate-800 px-4 py-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-white">
            7. ASSINATURAS E APROVAÇÕES
          </h2>
        </div>
        <div className="grid grid-cols-3 divide-x divide-slate-300">
          {[
            { cargo: 'Operador de Encapsulamento', funcao: 'Execução' },
            { cargo: 'Conferente', funcao: 'Verificação' },
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
