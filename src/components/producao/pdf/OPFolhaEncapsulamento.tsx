// ============================================================
// FOLHA DE ENCAPSULAMENTO - FORMATO A4 PROFISSIONAL
// ============================================================

import { OPCabecalhoPDF, OPRodapePDF, OPAssinaturasPDF } from './OPCabecalhoPDF';

interface OPFolhaEncapsulamentoProps {
  op: any;
}

const InfoBox = ({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) => (
  <div className={`border rounded p-2 ${highlight ? 'bg-amber-50 border-amber-300' : 'bg-slate-50 border-slate-200'}`}>
    <div className="text-[9px] text-slate-500 uppercase tracking-wide">{label}</div>
    <div className={`text-sm font-semibold ${highlight ? 'text-amber-700' : 'text-slate-800'}`}>{value}</div>
  </div>
);

export function OPFolhaEncapsulamento({ op }: OPFolhaEncapsulamentoProps) {
  const pesoCapsula = op.peso_capsula_mg || 500;
  const tipoCapsula = op.tipo_capsula || '00';
  const totalCapsulas = op.total_capsulas_com_acrescimo || 0;
  const totalFrascos = op.quantidade_frascos || 0;
  const capsPorFrasco = op.capsulas_por_frasco || 60;

  const pesoMin = Math.round(pesoCapsula * 0.95);
  const pesoMax = Math.round(pesoCapsula * 1.05);

  return (
    <div id="section-encapsulamento" className="bg-white p-6 text-sm print:p-0 print:text-[10px]">
      {/* Cabeçalho */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 text-white p-4 rounded-t-lg mb-4 print:rounded-none">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-lg font-bold tracking-tight">FOLHA DE ENCAPSULAMENTO</h1>
            <p className="text-slate-300 text-xs">Fase 4 - Encapsulamento Semi-Automático</p>
          </div>
          <div className="text-right">
            <div className="text-xl font-mono font-bold">{op.codigo}</div>
            <div className="text-xs text-slate-300">Lote: {op.lote_produto_acabado || '-'}</div>
          </div>
        </div>
      </div>

      {/* ESPECIFICAÇÕES */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <InfoBox label="Tipo de Cápsula" value={`Tamanho ${tipoCapsula}`} />
        <InfoBox label="Peso Nominal" value={`${pesoCapsula} mg`} highlight />
        <InfoBox label="Tolerância (±5%)" value={`${pesoMin} - ${pesoMax} mg`} />
        <InfoBox label="Total a Produzir" value={`${totalCapsulas.toLocaleString()} un`} />
      </div>

      <div className="grid grid-cols-4 gap-2 mb-4">
        <InfoBox label="Produto" value={op.produto_nome || '-'} />
        <InfoBox label="Frascos" value={`${totalFrascos} × ${capsPorFrasco} un`} />
        <InfoBox label="RT Responsável" value={op.rt_nome || '-'} />
        <InfoBox label="Data Fabricação" value={op.data_fabricacao ? new Date(op.data_fabricacao).toLocaleDateString('pt-BR') : '-'} />
      </div>

      {/* SETUP DA ENCAPSULADORA */}
      <div className="mb-4">
        <div className="flex items-center gap-3 p-3 bg-blue-100 border-l-4 border-l-blue-500 mb-3">
          <div className="font-bold text-sm uppercase tracking-wide text-blue-800">SETUP DA ENCAPSULADORA</div>
        </div>
        
        <div className="overflow-hidden rounded border border-slate-200">
          <table className="w-full text-xs">
            <thead className="bg-blue-50">
              <tr>
                <th className="p-2 text-left w-[40%]">Item de Verificação</th>
                <th className="p-2 text-left w-[25%]">Parâmetro</th>
                <th className="p-2 text-center w-[15%]">Verificado</th>
                <th className="p-2 text-center w-[20%]">Responsável</th>
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
                <tr key={idx} className="border-t bg-white">
                  <td className="p-2">{row.item}</td>
                  <td className="p-2 text-slate-600">{row.param}</td>
                  <td className="p-2 text-center">☐ OK</td>
                  <td className="p-2"><div className="border-b border-slate-300 min-h-[16px]">&nbsp;</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* CONTROLE DE PESO */}
      <div className="mb-4">
        <div className="flex items-center gap-3 p-3 bg-amber-100 border-l-4 border-l-amber-500 mb-3">
          <div className="font-bold text-sm uppercase tracking-wide text-amber-800">
            CONTROLE DE PESO DURANTE PRODUÇÃO
          </div>
          <div className="text-[10px] text-amber-700 ml-auto">Verificar a cada 30 min ou 1.000 cápsulas</div>
        </div>
        
        <div className="overflow-hidden rounded border border-slate-200">
          <table className="w-full text-xs">
            <thead className="bg-amber-50">
              <tr>
                <th className="p-2 text-center w-[8%]">Hora</th>
                <th className="p-2 text-center w-[9%]">C.1</th>
                <th className="p-2 text-center w-[9%]">C.2</th>
                <th className="p-2 text-center w-[9%]">C.3</th>
                <th className="p-2 text-center w-[9%]">C.4</th>
                <th className="p-2 text-center w-[9%]">C.5</th>
                <th className="p-2 text-center w-[11%]">Média (mg)</th>
                <th className="p-2 text-center w-[10%]">Desvio</th>
                <th className="p-2 text-center w-[10%]">OK?</th>
                <th className="p-2 text-center w-[16%]">Operador</th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((linha) => (
                <tr key={linha} className="border-t bg-white">
                  <td className="p-1"><div className="border-b border-slate-300 min-h-[14px] text-center">&nbsp;</div></td>
                  <td className="p-1"><div className="border-b border-slate-300 min-h-[14px]">&nbsp;</div></td>
                  <td className="p-1"><div className="border-b border-slate-300 min-h-[14px]">&nbsp;</div></td>
                  <td className="p-1"><div className="border-b border-slate-300 min-h-[14px]">&nbsp;</div></td>
                  <td className="p-1"><div className="border-b border-slate-300 min-h-[14px]">&nbsp;</div></td>
                  <td className="p-1"><div className="border-b border-slate-300 min-h-[14px]">&nbsp;</div></td>
                  <td className="p-1"><div className="border-b border-slate-300 min-h-[14px]">&nbsp;</div></td>
                  <td className="p-1"><div className="border-b border-slate-300 min-h-[14px]">&nbsp;</div></td>
                  <td className="p-1 text-center">☐</td>
                  <td className="p-1"><div className="border-b border-slate-300 min-h-[14px]">&nbsp;</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-2 text-[9px] text-slate-600 bg-slate-50 p-2 rounded border border-slate-200">
          <strong>Referência:</strong> Peso alvo: <span className="font-mono font-bold">{pesoCapsula} mg</span> | 
          Tolerância: <span className="font-mono font-bold">±5% ({pesoMin} - {pesoMax} mg)</span>
        </div>
      </div>

      {/* REGISTRO DE PRODUÇÃO */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="border border-slate-200 rounded overflow-hidden">
          <div className="bg-slate-100 p-2 font-bold text-xs uppercase text-slate-700">Tempos de Produção</div>
          <table className="w-full text-xs">
            <tbody>
              {[
                { label: 'Hora de Início', field: true },
                { label: 'Hora de Término', field: true },
                { label: 'Tempo Total', field: true },
              ].map((row, idx) => (
                <tr key={idx} className="border-t">
                  <td className="p-2 w-1/2 font-medium">{row.label}:</td>
                  <td className="p-2"><div className="border-b border-slate-300 min-h-[16px]">&nbsp;</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="border border-slate-200 rounded overflow-hidden">
          <div className="bg-slate-100 p-2 font-bold text-xs uppercase text-slate-700">Quantidades</div>
          <table className="w-full text-xs">
            <tbody>
              {[
                { label: 'Cápsulas Produzidas' },
                { label: 'Cápsulas Rejeitadas' },
                { label: 'Cápsulas Aprovadas' },
              ].map((row, idx) => (
                <tr key={idx} className="border-t">
                  <td className="p-2 w-1/2 font-medium">{row.label}:</td>
                  <td className="p-2"><div className="border-b border-slate-300 min-h-[16px]">&nbsp;</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* CÁLCULO DE RENDIMENTO */}
      <div className="mb-4">
        <div className="flex items-center gap-3 p-3 bg-green-100 border-l-4 border-l-green-500 mb-3">
          <div className="font-bold text-sm uppercase tracking-wide text-green-800">CÁLCULO DE RENDIMENTO</div>
        </div>
        
        <div className="overflow-hidden rounded border border-green-200">
          <table className="w-full text-xs">
            <tbody>
              <tr className="bg-green-50">
                <td className="p-2 w-[40%] font-medium">Quantidade Planejada:</td>
                <td className="p-2 font-mono font-bold">{totalCapsulas.toLocaleString()} cápsulas (c/ 5% acréscimo)</td>
              </tr>
              <tr className="border-t bg-white">
                <td className="p-2 font-medium">Quantidade Produzida:</td>
                <td className="p-2"><span className="inline-block border-b border-slate-400 min-w-[80px]">&nbsp;</span> cápsulas</td>
              </tr>
              <tr className="border-t bg-white">
                <td className="p-2 font-medium">Quantidade Aprovada:</td>
                <td className="p-2"><span className="inline-block border-b border-slate-400 min-w-[80px]">&nbsp;</span> cápsulas</td>
              </tr>
              <tr className="border-t bg-white">
                <td className="p-2 font-medium">Perda Total:</td>
                <td className="p-2">
                  <span className="inline-block border-b border-slate-400 min-w-[60px]">&nbsp;</span> cápsulas 
                  (<span className="inline-block border-b border-slate-400 min-w-[30px]">&nbsp;</span>%)
                </td>
              </tr>
              <tr className="border-t bg-green-100">
                <td className="p-2 font-bold text-green-800">RENDIMENTO FINAL:</td>
                <td className="p-2">
                  <span className="inline-block border-b border-green-600 min-w-[60px] font-mono font-bold">&nbsp;</span>%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* OBSERVAÇÕES */}
      <div className="mb-4">
        <div className="flex items-center gap-3 p-3 bg-slate-100 border-l-4 border-l-slate-500 mb-3">
          <div className="font-bold text-sm uppercase tracking-wide">OBSERVAÇÕES / OCORRÊNCIAS</div>
        </div>
        <div className="border border-slate-300 rounded min-h-[60px] p-3 bg-white">
          &nbsp;
        </div>
      </div>

      {/* Assinaturas */}
      <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t-2 border-slate-800">
        {[
          { cargo: 'Operador de Encapsulamento', subtitulo: 'Nome / Data / Hora' },
          { cargo: 'Conferente', subtitulo: 'Nome / Data / Hora' },
          { cargo: 'Responsável Técnico', subtitulo: 'Liberação' },
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
