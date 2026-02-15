// ============================================================
// FOLHA DE EMBALAGEM E ROTULAGEM - PADRÃO INDUSTRIAL A4
// Formato ANVISA/ISO - Boas Práticas de Fabricação
// ============================================================
import type { OPDadosPDF, OPEmbalagemPDF } from '@/types/op-pdf';

interface OPFolhaEmbalagemProps {
  op: OPDadosPDF;
  embalagens?: OPEmbalagemPDF[];
}

export function OPFolhaEmbalagem({ op, embalagens = [] }: OPFolhaEmbalagemProps) {
  const totalFrascos = op.quantidade_frascos || 100;
  const capsPorFrasco = op.capsulas_por_frasco || 60;
  
  const embalagensFinal = embalagens.length > 0 ? embalagens : calcularEmbalagensPadrao(op);

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  return (
    <div id="section-embalagem" className="bg-white print:text-[9px]">
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
          <div className="p-3 bg-purple-50">
            <div className="text-[9px] text-slate-500 uppercase font-semibold mb-1">Total de Frascos</div>
            <div className="text-sm font-bold text-purple-700">{totalFrascos.toLocaleString()} un</div>
          </div>
          <div className="p-3">
            <div className="text-[9px] text-slate-500 uppercase font-semibold mb-1">Unidades por Frasco</div>
            <div className="text-sm font-bold text-slate-800">{capsPorFrasco} cápsulas</div>
          </div>
        </div>
        <div className="grid grid-cols-4 divide-x divide-slate-300 border-t border-slate-300">
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
          <div className="p-3">
            <div className="text-[9px] text-slate-500 uppercase font-semibold mb-1">Conselho/Registro</div>
            <div className="text-sm font-bold text-slate-800">{op.rt_tipo_conselho || ''} {op.rt_numero_registro || '-'}</div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* BLOCO 2: MATERIAIS DE EMBALAGEM                                */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="border-2 border-purple-600 mb-4">
        <div className="bg-purple-600 px-4 py-2 flex items-center gap-3">
          <span className="flex items-center justify-center w-7 h-7 bg-white text-purple-600 rounded-full font-bold text-sm">2</span>
          <h2 className="text-sm font-bold uppercase tracking-wide text-white">
            CONFERÊNCIA DE MATERIAIS DE EMBALAGEM
          </h2>
          <span className="ml-auto text-white text-xs">{embalagensFinal.length} item(ns)</span>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-purple-100">
              <th className="border border-purple-200 px-2 py-2 text-center w-[5%]">Ord.</th>
              <th className="border border-purple-200 px-2 py-2 text-left w-[25%]">Material</th>
              <th className="border border-purple-200 px-2 py-2 text-center w-[12%]">Tipo</th>
              <th className="border border-purple-200 px-2 py-2 text-right w-[12%]">Qtd. Necessária</th>
              <th className="border border-purple-200 px-2 py-2 text-center w-[12%]">Lote</th>
              <th className="border border-purple-200 px-2 py-2 text-center w-[10%]">Qtd. Usada</th>
              <th className="border border-purple-200 px-2 py-2 text-center w-[12%]">Conferido</th>
              <th className="border border-purple-200 px-2 py-2 text-center w-[12%]">Hora</th>
            </tr>
          </thead>
          <tbody>
            {embalagensFinal.map((emb: any, idx: number) => (
              <tr key={emb.id || idx} className="bg-white">
                <td className="border border-purple-200 px-2 py-3 text-center">
                  <span className="inline-flex items-center justify-center w-6 h-6 bg-purple-600 text-white rounded-full text-[10px] font-bold">{idx + 1}</span>
                </td>
                <td className="border border-purple-200 px-2 py-3 font-semibold">{emb.descricao || emb.insumo_nome}</td>
                <td className="border border-purple-200 px-2 py-3 text-center">
                  <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-[9px]">{emb.tipo}</span>
                </td>
                <td className="border border-purple-200 px-2 py-3 text-right font-mono font-semibold">{emb.quantidade_necessaria?.toLocaleString()} {emb.unidade}</td>
                <td className="border border-purple-200 px-2 py-3"><div className="border-b-2 border-slate-400 min-h-[20px]">&nbsp;</div></td>
                <td className="border border-purple-200 px-2 py-3"><div className="border-b-2 border-slate-400 min-h-[20px]">&nbsp;</div></td>
                <td className="border border-purple-200 px-2 py-3"><div className="border-b-2 border-slate-400 min-h-[20px]">&nbsp;</div></td>
                <td className="border border-purple-200 px-2 py-3"><div className="border-b-2 border-slate-400 min-h-[20px]">&nbsp;</div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* BLOCO 3: CONFERÊNCIA DE RÓTULO                                 */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="border-2 border-amber-500 mb-4">
        <div className="bg-amber-500 px-4 py-2 flex items-center gap-3">
          <span className="flex items-center justify-center w-7 h-7 bg-white text-amber-600 rounded-full font-bold text-sm">3</span>
          <h2 className="text-sm font-bold uppercase tracking-wide text-white flex items-center gap-2">
            <span>⚠️</span> CONFERÊNCIA DE RÓTULO — Verificar ANTES de aplicar
          </h2>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-amber-100">
              <th className="border border-amber-200 px-3 py-2 text-left w-[50%]">Item de Verificação</th>
              <th className="border border-amber-200 px-3 py-2 text-center w-[15%]">Conforme?</th>
              <th className="border border-amber-200 px-3 py-2 text-left w-[35%]">Observação</th>
            </tr>
          </thead>
          <tbody>
            {[
              `Nome do produto confere com OP`,
              `Lote impresso: ${op.lote_produto_acabado || '________'}`,
              'Data de fabricação impressa corretamente',
              'Data de validade impressa corretamente',
              'Tabela nutricional presente e legível',
              'Ingredientes listados corretamente',
              'Modo de uso/conservação presentes',
              'Dados do fabricante presentes',
              'Registro/Dispensa ANVISA presente',
              'Alegações conforme permitido ANVISA',
            ].map((item, idx) => (
              <tr key={idx} className="bg-white">
                <td className="border border-amber-200 px-3 py-3">{item}</td>
                <td className="border border-amber-200 px-3 py-3 text-center">
                  <span className="inline-flex gap-4">
                    <span>☐ Sim</span>
                    <span>☐ Não</span>
                  </span>
                </td>
                <td className="border border-amber-200 px-3 py-3"><div className="border-b-2 border-slate-400 min-h-[20px]">&nbsp;</div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* BLOCO 4: REGISTRO DE ENVASE E ROTULAGEM                        */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="border-2 border-slate-600">
          <div className="bg-slate-600 px-4 py-2">
            <h3 className="text-sm font-bold uppercase text-white">4A. ENVASE</h3>
          </div>
          <table className="w-full text-xs">
            <tbody>
              {[
                { label: 'Hora de Início Envase' },
                { label: 'Hora de Término' },
                { label: 'Frascos Envasados' },
                { label: 'Frascos Rejeitados' },
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
            <h3 className="text-sm font-bold uppercase text-white">4B. ROTULAGEM</h3>
          </div>
          <table className="w-full text-xs">
            <tbody>
              {[
                { label: 'Hora Início Rotulagem' },
                { label: 'Hora Término' },
                { label: 'Frascos Rotulados' },
                { label: 'Rótulos Descartados' },
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
      {/* BLOCO 5: CONTAGEM FINAL                                        */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="border-2 border-green-600 mb-4">
        <div className="bg-green-600 px-4 py-2 flex items-center gap-3">
          <span className="flex items-center justify-center w-7 h-7 bg-white text-green-600 rounded-full font-bold text-sm">5</span>
          <h2 className="text-sm font-bold uppercase tracking-wide text-white">
            CONTAGEM FINAL E LIBERAÇÃO
          </h2>
        </div>
        <table className="w-full text-xs">
          <tbody>
            <tr className="bg-green-50">
              <td className="border border-green-200 px-3 py-3 w-[40%] font-bold text-green-800">Total de Frascos Produzidos:</td>
              <td className="border border-green-200 px-3 py-3"><span className="inline-block border-b-2 border-green-600 min-w-[100px]">&nbsp;</span> frascos</td>
            </tr>
            <tr className="bg-white">
              <td className="border border-green-200 px-3 py-3 font-medium">Frascos Aprovados para Expedição:</td>
              <td className="border border-green-200 px-3 py-3"><span className="inline-block border-b-2 border-slate-400 min-w-[100px]">&nbsp;</span> frascos</td>
            </tr>
            <tr className="bg-white">
              <td className="border border-green-200 px-3 py-3 font-medium">Frascos em Quarentena:</td>
              <td className="border border-green-200 px-3 py-3"><span className="inline-block border-b-2 border-slate-400 min-w-[100px]">&nbsp;</span> frascos</td>
            </tr>
            <tr className="bg-white">
              <td className="border border-green-200 px-3 py-3 font-medium">Frascos Rejeitados:</td>
              <td className="border border-green-200 px-3 py-3"><span className="inline-block border-b-2 border-slate-400 min-w-[100px]">&nbsp;</span> frascos</td>
            </tr>
            <tr className="bg-white">
              <td className="border border-green-200 px-3 py-3 font-medium">Motivo da Rejeição (se houver):</td>
              <td className="border border-green-200 px-3 py-3"><div className="border-b-2 border-slate-400 min-h-[20px]">&nbsp;</div></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* BLOCO 6: AMOSTRA DE RÓTULO                                     */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="border-2 border-dashed border-slate-400 mb-4 p-4 bg-slate-50 text-center">
        <p className="text-sm font-medium text-slate-700">☐ Cópia do rótulo final aplicado anexada a este documento</p>
        <p className="text-xs text-slate-500 mt-1">(Colar aqui uma amostra do rótulo ou anexar cópia impressa)</p>
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
            { cargo: 'Operador de Embalagem', funcao: 'Execução' },
            { cargo: 'Conferente', funcao: 'Verificação' },
            { cargo: 'Responsável Técnico', funcao: 'Liberação Final' },
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
        <div>Vitalnow Industria Ltda | Documento de Produção Industrial</div>
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
