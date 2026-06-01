// ============================================================
// FOLHA DE CHECKLIST OPERACIONAL - PADRÃO INDUSTRIAL A4
// Formato ANVISA/ISO - Boas Práticas de Fabricação
// ============================================================

import React from "react";
import type { OPDadosPDF, ChecklistItemPDF } from '@/types/op-pdf';

interface OPFolhaChecklistProps {
  op: OPDadosPDF;
  checklist?: ChecklistItemPDF[];
}

export const OPFolhaChecklist = React.forwardRef<HTMLDivElement, OPFolhaChecklistProps>(
  function OPFolhaChecklist({ op, checklist = [] }, ref) {
  const checklistFinal = checklist.length > 0 ? checklist : gerarChecklistPadrao();
  
  const checklistAgrupado: Record<string, ChecklistItemPDF[]> = {};
  checklistFinal.forEach(item => {
    const cat = item.categoria || 'OUTROS';
    if (!checklistAgrupado[cat]) {
      checklistAgrupado[cat] = [];
    }
    checklistAgrupado[cat].push(item);
  });

  const categorias = [
    { key: 'PRE_PRODUCAO', nome: 'PRÉ-PRODUÇÃO', cor: 'blue' },
    { key: 'DURANTE_PRODUCAO', nome: 'DURANTE PRODUÇÃO', cor: 'amber' },
    { key: 'POS_PRODUCAO', nome: 'PÓS-PRODUÇÃO', cor: 'green' },
    { key: 'QC', nome: 'CONTROLE DE QUALIDADE', cor: 'purple' },
    { key: 'OUTROS', nome: 'OUTROS', cor: 'slate' },
  ];

  const formatDate = (dateStr: unknown) => {
    if (!dateStr || typeof dateStr !== 'string') return '-';
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  return (
    <div ref={ref} id="section-checklist" className="bg-white print:text-[9px]">
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
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* BLOCO 2: INSTRUÇÕES                                            */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="border-2 border-amber-500 bg-amber-50 mb-4">
        <div className="bg-amber-500 px-4 py-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-white flex items-center gap-2">
            <span>⚠️</span> 2. INSTRUÇÕES OBRIGATÓRIAS
          </h2>
        </div>
        <div className="p-4 text-xs text-amber-900">
          <ul className="list-disc list-inside space-y-1">
            <li>Marcar <strong>☑</strong> cada item após verificação completa</li>
            <li>Itens marcados como <strong>OBRIGATÓRIO</strong> devem ser 100% concluídos para liberação do lote</li>
            <li>Qualquer não-conformidade deve ser registrada no bloco específico e comunicada ao RT</li>
            <li>Este documento é parte integrante do dossiê de produção e deve ser arquivado por 5 anos</li>
          </ul>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* BLOCOS 3-6: CHECKLISTS POR CATEGORIA                           */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {categorias.map((cat, catIdx) => {
        const itens = checklistAgrupado[cat.key] || [];
        if (itens.length === 0) return null;
        
        const bgColor = cat.cor === 'blue' ? 'bg-blue-600' : 
                       cat.cor === 'amber' ? 'bg-amber-600' :
                       cat.cor === 'green' ? 'bg-green-600' :
                       cat.cor === 'purple' ? 'bg-purple-600' : 'bg-slate-600';
        const borderColor = cat.cor === 'blue' ? 'border-blue-600' : 
                           cat.cor === 'amber' ? 'border-amber-600' :
                           cat.cor === 'green' ? 'border-green-600' :
                           cat.cor === 'purple' ? 'border-purple-600' : 'border-slate-600';
        const lightBg = cat.cor === 'blue' ? 'bg-blue-50' : 
                       cat.cor === 'amber' ? 'bg-amber-50' :
                       cat.cor === 'green' ? 'bg-green-50' :
                       cat.cor === 'purple' ? 'bg-purple-50' : 'bg-slate-50';
        
        return (
          <div key={cat.key} className={`border-2 ${borderColor} mb-4`}>
            <div className={`${bgColor} px-4 py-2 flex items-center gap-3`}>
              <span className="flex items-center justify-center w-7 h-7 bg-white text-slate-700 rounded-full font-bold text-sm">{catIdx + 3}</span>
              <h2 className="text-sm font-bold uppercase tracking-wide text-white">{cat.nome}</h2>
              <span className="ml-auto text-white text-xs">{itens.length} itens</span>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className={lightBg}>
                  <th className="border border-slate-200 px-2 py-2 text-center w-[5%]">☑</th>
                  <th className="border border-slate-200 px-2 py-2 text-left w-[45%]">Item de Verificação</th>
                  <th className="border border-slate-200 px-2 py-2 text-center w-[10%]">Obrig.?</th>
                  <th className="border border-slate-200 px-2 py-2 text-center w-[18%]">Responsável</th>
                  <th className="border border-slate-200 px-2 py-2 text-center w-[11%]">Hora</th>
                  <th className="border border-slate-200 px-2 py-2 text-center w-[11%]">Data</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((item, idx) => (
                  <tr key={item.id || idx} className="bg-white">
                    <td className="border border-slate-200 px-2 py-3 text-center text-base">☐</td>
                    <td className="border border-slate-200 px-2 py-3">
                      <div>{item.item || item.descricao}</div>
                      <div className="text-[8px] text-slate-400 mt-1 ml-6">
                        Obs: _________________________________________________
                      </div>
                    </td>
                    <td className="border border-slate-200 px-2 py-3 text-center">
                      {item.obrigatorio !== false ? (
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-[9px] font-bold">SIM</span>
                      ) : (
                        <span className="text-slate-400">Não</span>
                      )}
                    </td>
                    <td className="border border-slate-200 px-2 py-3"><div className="border-b-2 border-slate-400 min-h-[20px]">&nbsp;</div></td>
                    <td className="border border-slate-200 px-2 py-3"><div className="border-b-2 border-slate-400 min-h-[20px]">&nbsp;</div></td>
                    <td className="border border-slate-200 px-2 py-3"><div className="border-b-2 border-slate-400 min-h-[20px]">&nbsp;</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {cat.key === 'QC' && (
              <div className="border-2 border-purple-400 mt-3 bg-purple-50">
                <div className="bg-purple-400 px-3 py-1">
                  <span className="text-xs font-bold uppercase text-white">
                    Amostra de Retenção — Obrigatório BPF
                  </span>
                </div>
                <div className="grid grid-cols-2 divide-x divide-purple-200 p-2">
                  <div className="px-3 py-1">
                    <div className="text-[8px] text-slate-500 uppercase">
                      Quantidade retida (unidades)
                    </div>
                    <div className="text-xs mt-1 border-b border-slate-400 pb-1">
                      &nbsp;
                    </div>
                  </div>
                  <div className="px-3 py-1">
                    <div className="text-[8px] text-slate-500 uppercase">
                      Localização física (câmara/prateleira/posição)
                    </div>
                    <div className="text-xs mt-1 border-b border-slate-400 pb-1">
                      &nbsp;
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 divide-x divide-purple-200 border-t border-purple-200">
                  <div className="px-3 py-1">
                    <div className="text-[8px] text-slate-500 uppercase">
                      Separado por
                    </div>
                    <div className="text-xs mt-1 border-b border-slate-400 pb-1">
                      &nbsp;
                    </div>
                  </div>
                  <div className="px-3 py-1">
                    <div className="text-[8px] text-slate-500 uppercase">
                      Data / Hora
                    </div>
                    <div className="text-xs mt-1 border-b border-slate-400 pb-1">
                      &nbsp;
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* BLOCO: NÃO-CONFORMIDADES                                       */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="border-2 border-red-600 mb-4">
        <div className="bg-red-600 px-4 py-2 flex items-center gap-3">
          <span className="text-white text-lg">🚨</span>
          <h2 className="text-sm font-bold uppercase tracking-wide text-white">
            REGISTRO DE NÃO-CONFORMIDADES
          </h2>
          <span className="ml-auto text-white text-xs">(se houver)</span>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-red-50">
              <th className="border border-red-200 px-2 py-2 text-center w-[5%]">#</th>
              <th className="border border-red-200 px-2 py-2 text-left w-[32%]">Descrição da Não-Conformidade</th>
              <th className="border border-red-200 px-2 py-2 text-left w-[25%]">Ação Corretiva</th>
              <th className="border border-red-200 px-2 py-2 text-center w-[15%]">Responsável</th>
              <th className="border border-red-200 px-2 py-2 text-center w-[12%]">Status</th>
              <th className="border border-red-200 px-2 py-2 text-center w-[11%]">Data</th>
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3].map(linha => (
              <tr key={linha} className="bg-white">
                <td className="border border-red-200 px-2 py-3 text-center font-bold text-red-600">{linha}</td>
                <td className="border border-red-200 px-2 py-3"><div className="border-b-2 border-slate-400 min-h-[24px]">&nbsp;</div></td>
                <td className="border border-red-200 px-2 py-3"><div className="border-b-2 border-slate-400 min-h-[24px]">&nbsp;</div></td>
                <td className="border border-red-200 px-2 py-3"><div className="border-b-2 border-slate-400 min-h-[20px]">&nbsp;</div></td>
                <td className="border border-red-200 px-2 py-3 text-center text-[9px]">☐ Resolvido</td>
                <td className="border border-red-200 px-2 py-3"><div className="border-b-2 border-slate-400 min-h-[20px]">&nbsp;</div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* BLOCO: LIBERAÇÃO DO LOTE                                       */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="border-2 border-green-600 mb-4">
        <div className="bg-green-600 px-4 py-2 flex items-center gap-3">
          <span className="text-white text-lg">✅</span>
          <h2 className="text-sm font-bold uppercase tracking-wide text-white">
            LIBERAÇÃO DO LOTE
          </h2>
        </div>
        <table className="w-full text-xs">
          <tbody>
            <tr className="bg-green-50">
              <td className="border border-green-200 px-3 py-3 w-[30%] font-bold">Checklist 100% concluído?</td>
              <td className="border border-green-200 px-3 py-3 w-[20%]">☐ SIM &nbsp;&nbsp; ☐ NÃO</td>
              <td className="border border-green-200 px-3 py-3 w-[30%] font-bold">Lote liberado para expedição?</td>
              <td className="border border-green-200 px-3 py-3 w-[20%]">☐ SIM &nbsp;&nbsp; ☐ NÃO</td>
            </tr>
            <tr className="bg-white">
              <td className="border border-green-200 px-3 py-3 font-medium">Não-conformidades resolvidas?</td>
              <td className="border border-green-200 px-3 py-3">☐ SIM &nbsp;&nbsp; ☐ NÃO &nbsp;&nbsp; ☐ N/A</td>
              <td className="border border-green-200 px-3 py-3 font-medium">Documentação completa?</td>
              <td className="border border-green-200 px-3 py-3">☐ SIM &nbsp;&nbsp; ☐ NÃO</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* BLOCO: OBSERVAÇÕES GERAIS                                      */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="border-2 border-slate-600 mb-4">
        <div className="bg-slate-600 px-4 py-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-white">OBSERVAÇÕES GERAIS</h2>
        </div>
        <div className="p-4 bg-white min-h-[50px]">&nbsp;</div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* BLOCO: ASSINATURAS                                             */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="border-2 border-slate-800 mt-6">
        <div className="bg-slate-800 px-4 py-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-white">
            ASSINATURAS E APROVAÇÕES FINAIS
          </h2>
        </div>
        <div className="grid grid-cols-3 divide-x divide-slate-300">
          {[
            { cargo: 'Supervisor de Produção', funcao: 'Verificação Operacional' },
            { cargo: 'Controle de Qualidade', funcao: 'Análise e Aprovação QC' },
            { cargo: 'Responsável Técnico', funcao: 'Liberação Final do Lote' },
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
);

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
