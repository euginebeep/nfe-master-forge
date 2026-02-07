// ============================================================
// FOLHA DE EMBALAGEM E ROTULAGEM - FORMATO A4 PROFISSIONAL
// ============================================================

import { OPCabecalhoPDF, OPRodapePDF, OPAssinaturasPDF } from './OPCabecalhoPDF';

interface OPFolhaEmbalagemProps {
  op: any;
  embalagens?: any[];
}

const InfoBox = ({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) => (
  <div className={`border rounded p-2 ${highlight ? 'bg-purple-50 border-purple-300' : 'bg-slate-50 border-slate-200'}`}>
    <div className="text-[9px] text-slate-500 uppercase tracking-wide">{label}</div>
    <div className={`text-sm font-semibold ${highlight ? 'text-purple-700' : 'text-slate-800'}`}>{value}</div>
  </div>
);

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

export function OPFolhaEmbalagem({ op, embalagens = [] }: OPFolhaEmbalagemProps) {
  const totalFrascos = op.quantidade_frascos || 100;
  const capsPorFrasco = op.capsulas_por_frasco || 60;
  
  const embalagensFinal = embalagens.length > 0 ? embalagens : calcularEmbalagensPadrao(op);

  return (
    <div id="section-embalagem" className="bg-white p-6 text-sm print:p-0 print:text-[10px]">
      {/* Cabeçalho */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 text-white p-4 rounded-t-lg mb-4 print:rounded-none">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-lg font-bold tracking-tight">FOLHA DE EMBALAGEM E ROTULAGEM</h1>
            <p className="text-slate-300 text-xs">Fase 5 - Envase, Rotulagem e Fechamento</p>
          </div>
          <div className="text-right">
            <div className="text-xl font-mono font-bold">{op.codigo}</div>
            <div className="text-xs text-slate-300">Lote: {op.lote_produto_acabado || '-'}</div>
          </div>
        </div>
      </div>

      {/* ESPECIFICAÇÕES */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <InfoBox label="Total de Frascos" value={`${totalFrascos.toLocaleString()} un`} highlight />
        <InfoBox label="Unidades por Frasco" value={`${capsPorFrasco} cápsulas`} />
        <InfoBox label="Lote do Produto" value={op.lote_produto_acabado || '-'} />
        <InfoBox label="Data de Validade" value={op.data_validade ? new Date(op.data_validade).toLocaleDateString('pt-BR') : '-'} />
      </div>

      <div className="grid grid-cols-4 gap-2 mb-4">
        <InfoBox label="Produto" value={op.produto_nome || '-'} />
        <InfoBox label="Data Fabricação" value={op.data_fabricacao ? new Date(op.data_fabricacao).toLocaleDateString('pt-BR') : '-'} />
        <InfoBox label="RT Responsável" value={op.rt_nome || '-'} />
        <InfoBox label="Registro RT" value={`${op.rt_tipo_conselho || ''} ${op.rt_numero_registro || '-'}`} />
      </div>

      {/* MATERIAIS DE EMBALAGEM */}
      <div className="mb-4">
        <div className="flex items-center gap-3 p-3 bg-purple-100 border-l-4 border-l-purple-500 mb-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-600 text-white font-bold text-sm">4</div>
          <div>
            <div className="font-bold text-sm uppercase tracking-wide text-purple-800">CONFERÊNCIA DE MATERIAIS DE EMBALAGEM</div>
            <div className="text-xs text-purple-600">Verificar lotes e quantidades antes do uso</div>
          </div>
        </div>
        
        <div className="overflow-hidden rounded border border-purple-200">
          <table className="w-full text-xs">
            <thead className="bg-purple-50">
              <tr>
                <th className="p-2 text-center w-[5%]">Ord.</th>
                <th className="p-2 text-left w-[25%]">Material</th>
                <th className="p-2 text-left w-[12%]">Tipo</th>
                <th className="p-2 text-right w-[12%]">Qtd. Necessária</th>
                <th className="p-2 text-center w-[12%]">Lote</th>
                <th className="p-2 text-center w-[10%]">Qtd. Usada</th>
                <th className="p-2 text-center w-[12%]">Conferido</th>
                <th className="p-2 text-center w-[12%]">Hora</th>
              </tr>
            </thead>
            <tbody>
              {embalagensFinal.map((emb: any, idx: number) => (
                <tr key={emb.id || idx} className="border-t bg-white">
                  <td className="p-2 text-center">
                    <span className="inline-flex items-center justify-center w-6 h-6 bg-purple-600 text-white rounded-full text-[10px] font-bold">
                      {idx + 1}
                    </span>
                  </td>
                  <td className="p-2 font-semibold">{emb.descricao || emb.insumo_nome}</td>
                  <td className="p-2">
                    <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[9px]">{emb.tipo}</span>
                  </td>
                  <td className="p-2 text-right font-mono font-semibold">
                    {emb.quantidade_necessaria?.toLocaleString()} {emb.unidade}
                  </td>
                  <td className="p-2"><div className="border-b border-slate-300 min-h-[16px]">&nbsp;</div></td>
                  <td className="p-2"><div className="border-b border-slate-300 min-h-[16px]">&nbsp;</div></td>
                  <td className="p-2"><div className="border-b border-slate-300 min-h-[16px]">&nbsp;</div></td>
                  <td className="p-2"><div className="border-b border-slate-300 min-h-[16px]">&nbsp;</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* CHECKLIST DE ROTULAGEM */}
      <div className="mb-4">
        <div className="flex items-center gap-3 p-3 bg-amber-100 border-l-4 border-l-amber-500 mb-3">
          <div className="font-bold text-sm uppercase tracking-wide text-amber-800">
            ⚠️ CONFERÊNCIA DE RÓTULO - Verificar ANTES de aplicar
          </div>
        </div>
        
        <div className="overflow-hidden rounded border border-amber-200">
          <table className="w-full text-xs">
            <thead className="bg-amber-50">
              <tr>
                <th className="p-2 text-left w-[50%]">Item de Verificação</th>
                <th className="p-2 text-center w-[15%]">Conforme?</th>
                <th className="p-2 text-left w-[35%]">Observação</th>
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
                'Dados do fabricante/importador presentes',
                'Registro/Dispensa ANVISA presente',
                'Alegações conforme permitido ANVISA',
              ].map((item, idx) => (
                <tr key={idx} className="border-t bg-white">
                  <td className="p-2">{item}</td>
                  <td className="p-2 text-center text-[10px]">☐ Sim &nbsp; ☐ Não</td>
                  <td className="p-2"><div className="border-b border-slate-300 min-h-[16px]">&nbsp;</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* REGISTRO DE ENVASE */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="border border-slate-200 rounded overflow-hidden">
          <div className="bg-slate-100 p-2 font-bold text-xs uppercase text-slate-700">Envase</div>
          <table className="w-full text-xs">
            <tbody>
              {[
                { label: 'Hora de Início Envase' },
                { label: 'Hora de Término' },
                { label: 'Frascos Envasados' },
                { label: 'Frascos Rejeitados' },
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
          <div className="bg-slate-100 p-2 font-bold text-xs uppercase text-slate-700">Rotulagem</div>
          <table className="w-full text-xs">
            <tbody>
              {[
                { label: 'Hora Início Rotulagem' },
                { label: 'Hora Término' },
                { label: 'Frascos Rotulados' },
                { label: 'Rótulos Descartados' },
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

      {/* CONTAGEM FINAL */}
      <div className="mb-4">
        <div className="flex items-center gap-3 p-3 bg-green-100 border-l-4 border-l-green-500 mb-3">
          <div className="font-bold text-sm uppercase tracking-wide text-green-800">CONTAGEM FINAL E LIBERAÇÃO</div>
        </div>
        
        <div className="overflow-hidden rounded border border-green-200">
          <table className="w-full text-xs">
            <tbody>
              <tr className="bg-green-50">
                <td className="p-2 w-[40%] font-bold text-green-800">Total de Frascos Produzidos:</td>
                <td className="p-2"><span className="inline-block border-b border-green-600 min-w-[80px]">&nbsp;</span> frascos</td>
              </tr>
              <tr className="border-t bg-white">
                <td className="p-2 font-medium">Frascos Aprovados para Expedição:</td>
                <td className="p-2"><span className="inline-block border-b border-slate-400 min-w-[80px]">&nbsp;</span> frascos</td>
              </tr>
              <tr className="border-t bg-white">
                <td className="p-2 font-medium">Frascos em Quarentena:</td>
                <td className="p-2"><span className="inline-block border-b border-slate-400 min-w-[80px]">&nbsp;</span> frascos</td>
              </tr>
              <tr className="border-t bg-white">
                <td className="p-2 font-medium">Frascos Rejeitados:</td>
                <td className="p-2"><span className="inline-block border-b border-slate-400 min-w-[80px]">&nbsp;</span> frascos</td>
              </tr>
              <tr className="border-t bg-white">
                <td className="p-2 font-medium">Motivo da Rejeição (se houver):</td>
                <td className="p-2"><div className="border-b border-slate-400 min-h-[16px]">&nbsp;</div></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* UPLOAD DE RÓTULO */}
      <div className="mb-4 border-2 border-dashed border-slate-300 rounded-lg p-4 bg-slate-50 text-center">
        <p className="text-sm font-medium text-slate-700">☐ Cópia do rótulo final aplicado anexada a este documento</p>
        <p className="text-xs text-slate-500 mt-1">(Colar aqui uma amostra do rótulo ou anexar cópia impressa)</p>
      </div>

      {/* Assinaturas */}
      <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t-2 border-slate-800">
        {[
          { cargo: 'Operador de Embalagem', subtitulo: 'Nome / Data / Hora' },
          { cargo: 'Conferente', subtitulo: 'Nome / Data / Hora' },
          { cargo: 'Responsável Técnico', subtitulo: 'Liberação Final' },
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
