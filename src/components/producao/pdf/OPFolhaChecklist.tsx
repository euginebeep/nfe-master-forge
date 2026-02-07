// ============================================================
// FOLHA DE CHECKLIST OPERACIONAL - FORMATO A4 PROFISSIONAL
// ============================================================

import { OPCabecalhoPDF, OPRodapePDF, OPAssinaturasPDF } from './OPCabecalhoPDF';

interface OPFolhaChecklistProps {
  op: any;
  checklist?: any[];
}

function gerarChecklistPadrao() {
  return [
    // PRÉ-PRODUÇÃO
    { categoria: 'PRE_PRODUCAO', item: 'Conferência de lotes das matérias-primas', obrigatorio: true },
    { categoria: 'PRE_PRODUCAO', item: 'Verificação de validade de todos os insumos', obrigatorio: true },
    { categoria: 'PRE_PRODUCAO', item: 'Limpeza e sanitização da área de pesagem', obrigatorio: true },
    { categoria: 'PRE_PRODUCAO', item: 'Calibração da balança conferida', obrigatorio: true },
    { categoria: 'PRE_PRODUCAO', item: 'Utensílios de pesagem limpos e identificados', obrigatorio: true },
    { categoria: 'PRE_PRODUCAO', item: 'Documentação da OP impressa e disponível', obrigatorio: true },
    // DURANTE PRODUÇÃO
    { categoria: 'DURANTE_PRODUCAO', item: 'Pesagem de ativos críticos com dupla conferência', obrigatorio: true },
    { categoria: 'DURANTE_PRODUCAO', item: 'Conferência de pesos dentro da tolerância (±10%)', obrigatorio: true },
    { categoria: 'DURANTE_PRODUCAO', item: 'Ordem de mistura seguida corretamente', obrigatorio: true },
    { categoria: 'DURANTE_PRODUCAO', item: 'Tempo de homogeneização respeitado', obrigatorio: true },
    { categoria: 'DURANTE_PRODUCAO', item: 'Estearato adicionado por último (máx. 2 min)', obrigatorio: true },
    { categoria: 'DURANTE_PRODUCAO', item: 'Limpeza de equipamentos entre etapas', obrigatorio: true },
    { categoria: 'DURANTE_PRODUCAO', item: 'Ajuste da encapsuladora realizado', obrigatorio: true },
    { categoria: 'DURANTE_PRODUCAO', item: 'Controle de peso durante encapsulamento', obrigatorio: true },
    // PÓS-PRODUÇÃO
    { categoria: 'POS_PRODUCAO', item: 'Contagem final de unidades produzidas', obrigatorio: true },
    { categoria: 'POS_PRODUCAO', item: 'Registro de perdas justificado', obrigatorio: true },
    { categoria: 'POS_PRODUCAO', item: 'Conferência do rótulo aplicado', obrigatorio: true },
    { categoria: 'POS_PRODUCAO', item: 'Upload do rótulo final no sistema', obrigatorio: true },
    { categoria: 'POS_PRODUCAO', item: 'Limpeza final da área', obrigatorio: true },
    // QC
    { categoria: 'QC', item: 'Teste de peso médio realizado', obrigatorio: true },
    { categoria: 'QC', item: 'Avaliação de aparência do pó', obrigatorio: true },
    { categoria: 'QC', item: 'Avaliação de fluidez do pó', obrigatorio: true },
    { categoria: 'QC', item: 'Avaliação de homogeneidade', obrigatorio: true },
    { categoria: 'QC', item: 'Laudo de liberação emitido', obrigatorio: true },
  ];
}

export function OPFolhaChecklist({ op, checklist = [] }: OPFolhaChecklistProps) {
  const checklistAgrupado: Record<string, any[]> = {};
  const checklistFinal = checklist.length > 0 ? checklist : gerarChecklistPadrao();
  
  checklistFinal.forEach(item => {
    const cat = item.categoria || 'OUTROS';
    if (!checklistAgrupado[cat]) {
      checklistAgrupado[cat] = [];
    }
    checklistAgrupado[cat].push(item);
  });

  const categorias = [
    { key: 'PRE_PRODUCAO', nome: 'PRÉ-PRODUÇÃO', cor: 'bg-blue-100', corBorda: 'border-l-blue-500', icone: '📋' },
    { key: 'DURANTE_PRODUCAO', nome: 'DURANTE PRODUÇÃO', cor: 'bg-amber-100', corBorda: 'border-l-amber-500', icone: '⚙️' },
    { key: 'POS_PRODUCAO', nome: 'PÓS-PRODUÇÃO', cor: 'bg-green-100', corBorda: 'border-l-green-500', icone: '✅' },
    { key: 'QC', nome: 'CONTROLE DE QUALIDADE', cor: 'bg-purple-100', corBorda: 'border-l-purple-500', icone: '🔬' },
    { key: 'OUTROS', nome: 'OUTROS', cor: 'bg-slate-100', corBorda: 'border-l-slate-500', icone: '📝' },
  ];

  return (
    <div id="section-checklist" className="bg-white p-6 text-sm print:p-0 print:text-[10px]">
      {/* Cabeçalho */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 text-white p-4 rounded-t-lg mb-4 print:rounded-none">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-lg font-bold tracking-tight">CHECKLIST OPERACIONAL</h1>
            <p className="text-slate-300 text-xs">Verificações Obrigatórias de Produção</p>
          </div>
          <div className="text-right">
            <div className="text-xl font-mono font-bold">{op.codigo}</div>
            <div className="text-xs text-slate-300">Lote: {op.lote_produto_acabado || '-'}</div>
          </div>
        </div>
      </div>

      {/* Grid de informações */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <div className="border rounded p-2 bg-slate-50 border-slate-200">
          <div className="text-[9px] text-slate-500 uppercase tracking-wide">Produto</div>
          <div className="text-sm font-semibold text-slate-800">{op.produto_nome || '-'}</div>
        </div>
        <div className="border rounded p-2 bg-slate-50 border-slate-200">
          <div className="text-[9px] text-slate-500 uppercase tracking-wide">Total Cápsulas</div>
          <div className="text-sm font-semibold text-slate-800">{op.total_capsulas_com_acrescimo?.toLocaleString() || 0} un</div>
        </div>
        <div className="border rounded p-2 bg-slate-50 border-slate-200">
          <div className="text-[9px] text-slate-500 uppercase tracking-wide">RT Responsável</div>
          <div className="text-sm font-semibold text-slate-800">{op.rt_nome || '-'}</div>
        </div>
        <div className="border rounded p-2 bg-amber-50 border-amber-300">
          <div className="text-[9px] text-slate-500 uppercase tracking-wide">Data Fabricação</div>
          <div className="text-sm font-semibold text-amber-700">{op.data_fabricacao ? new Date(op.data_fabricacao).toLocaleDateString('pt-BR') : '-'}</div>
        </div>
      </div>

      {/* INSTRUÇÕES */}
      <div className="bg-amber-50 border-2 border-amber-400 rounded-lg p-3 mb-4 text-xs">
        <strong className="text-amber-800">⚠️ INSTRUÇÕES:</strong>
        <span className="text-amber-900 ml-2">
          Marcar ☑ cada item após verificação. Itens OBRIGATÓRIO devem ser 100% concluídos para liberação. 
          Qualquer não-conformidade deve ser registrada e comunicada ao RT.
        </span>
      </div>

      {/* CHECKLISTS POR CATEGORIA */}
      {categorias.map(cat => {
        const itens = checklistAgrupado[cat.key] || [];
        if (itens.length === 0) return null;
        
        return (
          <div key={cat.key} className="mb-4">
            <div className={`flex items-center gap-3 p-3 ${cat.cor} border-l-4 ${cat.corBorda} mb-2`}>
              <span className="text-lg">{cat.icone}</span>
              <div className="font-bold text-sm uppercase tracking-wide">{cat.nome}</div>
              <span className="ml-auto text-xs text-slate-600">{itens.length} itens</span>
            </div>
            
            <div className="overflow-hidden rounded border border-slate-200">
              <table className="w-full text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="p-2 text-center w-[5%]">☑</th>
                    <th className="p-2 text-left w-[45%]">Item de Verificação</th>
                    <th className="p-2 text-center w-[10%]">Obrig.?</th>
                    <th className="p-2 text-center w-[18%]">Responsável</th>
                    <th className="p-2 text-center w-[11%]">Hora</th>
                    <th className="p-2 text-center w-[11%]">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {itens.map((item, idx) => (
                    <tr key={item.id || idx} className="border-t bg-white">
                      <td className="p-2 text-center text-base">☐</td>
                      <td className="p-2">{item.item || item.descricao}</td>
                      <td className="p-2 text-center">
                        {item.obrigatorio !== false ? (
                          <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-[9px] font-bold">SIM</span>
                        ) : (
                          <span className="text-slate-400">Não</span>
                        )}
                      </td>
                      <td className="p-2"><div className="border-b border-slate-300 min-h-[16px]">&nbsp;</div></td>
                      <td className="p-2"><div className="border-b border-slate-300 min-h-[16px]">&nbsp;</div></td>
                      <td className="p-2"><div className="border-b border-slate-300 min-h-[16px]">&nbsp;</div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {/* REGISTRO DE NÃO-CONFORMIDADES */}
      <div className="mb-4">
        <div className="flex items-center gap-3 p-3 bg-red-100 border-l-4 border-l-red-500 mb-2">
          <span className="text-lg">🚨</span>
          <div className="font-bold text-sm uppercase tracking-wide text-red-800">REGISTRO DE NÃO-CONFORMIDADES</div>
          <span className="ml-auto text-xs text-red-600">(se houver)</span>
        </div>
        
        <div className="overflow-hidden rounded border border-red-200">
          <table className="w-full text-xs">
            <thead className="bg-red-50">
              <tr>
                <th className="p-2 text-center w-[5%]">#</th>
                <th className="p-2 text-left w-[32%]">Descrição da Não-Conformidade</th>
                <th className="p-2 text-left w-[25%]">Ação Corretiva</th>
                <th className="p-2 text-center w-[15%]">Responsável</th>
                <th className="p-2 text-center w-[12%]">Status</th>
                <th className="p-2 text-center w-[11%]">Data</th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3].map(linha => (
                <tr key={linha} className="border-t bg-white">
                  <td className="p-2 text-center font-bold text-red-600">{linha}</td>
                  <td className="p-2"><div className="border-b border-slate-300 min-h-[20px]">&nbsp;</div></td>
                  <td className="p-2"><div className="border-b border-slate-300 min-h-[20px]">&nbsp;</div></td>
                  <td className="p-2"><div className="border-b border-slate-300 min-h-[16px]">&nbsp;</div></td>
                  <td className="p-2 text-center text-[9px]">☐ Resolvido</td>
                  <td className="p-2"><div className="border-b border-slate-300 min-h-[16px]">&nbsp;</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* OBSERVAÇÕES GERAIS */}
      <div className="mb-4">
        <div className="flex items-center gap-3 p-3 bg-slate-100 border-l-4 border-l-slate-500 mb-2">
          <div className="font-bold text-sm uppercase tracking-wide">OBSERVAÇÕES GERAIS</div>
        </div>
        <div className="border border-slate-300 rounded min-h-[50px] p-3 bg-white">
          &nbsp;
        </div>
      </div>

      {/* LIBERAÇÃO DO LOTE */}
      <div className="mb-4">
        <div className="flex items-center gap-3 p-3 bg-green-100 border-l-4 border-l-green-500 mb-2">
          <span className="text-lg">✅</span>
          <div className="font-bold text-sm uppercase tracking-wide text-green-800">LIBERAÇÃO DO LOTE</div>
        </div>
        
        <div className="overflow-hidden rounded border border-green-300">
          <table className="w-full text-xs">
            <tbody>
              <tr className="bg-green-50">
                <td className="p-2 w-[30%] font-bold">Checklist 100% concluído?</td>
                <td className="p-2 w-[20%]">☐ SIM &nbsp;&nbsp; ☐ NÃO</td>
                <td className="p-2 w-[30%] font-bold">Lote liberado para expedição?</td>
                <td className="p-2 w-[20%]">☐ SIM &nbsp;&nbsp; ☐ NÃO</td>
              </tr>
              <tr className="border-t bg-white">
                <td className="p-2 font-medium">Não-conformidades resolvidas?</td>
                <td className="p-2">☐ SIM &nbsp;&nbsp; ☐ NÃO &nbsp;&nbsp; ☐ N/A</td>
                <td className="p-2 font-medium">Documentação completa?</td>
                <td className="p-2">☐ SIM &nbsp;&nbsp; ☐ NÃO</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Assinaturas */}
      <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t-2 border-slate-800">
        {[
          { cargo: 'Supervisor de Produção', subtitulo: 'Nome / Data / Hora' },
          { cargo: 'Controle de Qualidade', subtitulo: 'Nome / Data / Hora' },
          { cargo: 'Responsável Técnico', subtitulo: 'Liberação Final do Lote' },
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
