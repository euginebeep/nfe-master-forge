// ============================================================
// FOLHA DE SEPARAÇÃO DE MATERIAIS - FORMATO A4 PROFISSIONAL
// Inclui matérias-primas E embalagens
// ============================================================

import { cn } from '@/lib/utils';

interface OPFolhaSeparacaoProps {
  op: any;
  materiasPrimas: any[];
  embalagens?: any[];
}

export function OPFolhaSeparacao({ op, materiasPrimas, embalagens = [] }: OPFolhaSeparacaoProps) {
  // Separar por categoria
  const ativos = materiasPrimas.filter(mp => mp.categoria === 'ATIVO');
  const excipienteBase = materiasPrimas.filter(mp => mp.categoria === 'EXCIPIENTE_BASE');
  const tecnologicos = materiasPrimas.filter(mp => mp.categoria === 'EXCIPIENTE_TECNOLOGICO');

  // Calcular embalagens se não fornecidas
  const embalagensFinal = embalagens.length > 0 ? embalagens : calcularEmbalagensPadrao(op);

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  const formatarQuantidade = (valor: number, unidade: string = 'g') => {
    if (!valor) return '-';
    if (valor >= 1000) {
      return `${(valor / 1000).toFixed(4)} kg`;
    }
    return `${valor.toFixed(4)} ${unidade}`;
  };

  return (
    <div className="bg-white border border-border rounded-lg shadow-sm overflow-hidden print:border-0 print:shadow-none print:rounded-none">
      {/* CABEÇALHO PRINCIPAL */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 text-white px-6 py-4 print:bg-slate-800">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-lg font-bold tracking-wide">ORDEM DE PRODUÇÃO INDUSTRIAL</h1>
            <p className="text-slate-300 text-sm mt-1">FOLHA DE SEPARAÇÃO DE MATERIAIS</p>
            <p className="text-slate-400 text-xs">Fase 1 - Pré-Produção</p>
          </div>
          <div className="text-right">
            <div className="text-xl font-mono font-bold">{op.codigo}</div>
            <div className="text-sm text-slate-300 mt-1">Lote: {op.lote_produto_acabado || '-'}</div>
          </div>
        </div>
      </div>

      {/* GRID DE INFORMAÇÕES */}
      <div className="grid grid-cols-4 gap-px bg-slate-200 border-b border-slate-200">
        <InfoBox label="Produto" value={op.produto_nome} />
        <InfoBox label="Quantidade" value={`${op.quantidade_frascos?.toLocaleString() || '-'} frascos × ${op.capsulas_por_frasco || '-'} un`} />
        <InfoBox label="Total c/ Acréscimo" value={`${op.total_capsulas_com_acrescimo?.toLocaleString() || '-'} unidades`} highlight />
        <InfoBox label="Data Fabricação" value={formatDate(op.data_fabricacao)} />
      </div>
      <div className="grid grid-cols-4 gap-px bg-slate-200 border-b border-slate-300">
        <InfoBox label="Responsável Técnico" value={op.rt_nome || '-'} />
        <InfoBox label="Conselho/Registro" value={`${op.rt_tipo_conselho || ''} ${op.rt_numero_registro || ''}${op.rt_uf_conselho ? '/' + op.rt_uf_conselho : ''}`} />
        <InfoBox label="Fórmula" value={op.formula_codigo || 'Manual'} />
        <InfoBox label="Data Validade" value={formatDate(op.data_validade)} />
      </div>

      <div className="p-6 space-y-6">
        {/* SEÇÃO 1: ATIVOS */}
        <SectionBlock
          numero={1}
          titulo="ATIVOS E PRINCÍPIOS ATIVOS"
          subtitulo="Separar conforme lista abaixo"
          corBorda="border-l-red-500"
          corFundo="bg-red-50"
        >
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-100 text-xs uppercase text-slate-600">
                <th className="border border-slate-300 px-3 py-2 w-12 text-center">Ord.</th>
                <th className="border border-slate-300 px-3 py-2 text-left">Insumo</th>
                <th className="border border-slate-300 px-3 py-2 w-24 text-center">Categoria</th>
                <th className="border border-slate-300 px-3 py-2 w-32 text-right">Qtd. Necessária</th>
                <th className="border border-slate-300 px-3 py-2 w-28 text-center">Lote MP</th>
                <th className="border border-slate-300 px-3 py-2 w-24 text-center">Validade</th>
                <th className="border border-slate-300 px-3 py-2 w-20 text-center">Separado</th>
                <th className="border border-slate-300 px-3 py-2 w-28 text-center">Conferido</th>
              </tr>
            </thead>
            <tbody>
              {ativos.map((mp, idx) => (
                <tr key={mp.id || idx} className={cn(mp.pesagem_critica && "bg-yellow-50")}>
                  <td className="border border-slate-300 px-3 py-2 text-center">
                    <span className="inline-flex items-center justify-center w-6 h-6 bg-red-600 text-white rounded-full text-xs font-bold">
                      {idx + 1}
                    </span>
                  </td>
                  <td className="border border-slate-300 px-3 py-2">
                    <div className="font-semibold text-slate-800">{mp.insumo_nome}</div>
                    {mp.pesagem_critica && (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="inline-block px-2 py-0.5 bg-red-600 text-white text-xs font-semibold rounded">
                          CRÍTICO
                        </span>
                        {mp.motivo_critico && (
                          <span className="text-xs text-slate-500">({mp.motivo_critico})</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="border border-slate-300 px-3 py-2 text-center text-slate-600">Ativo</td>
                  <td className="border border-slate-300 px-3 py-2 text-right font-mono font-semibold text-slate-800">
                    {formatarQuantidade(mp.quantidade_teorica_g)}
                  </td>
                  <td className="border border-slate-300 px-3 py-2">
                    <div className="h-6 border-b border-slate-400" />
                  </td>
                  <td className="border border-slate-300 px-3 py-2">
                    <div className="h-6 border-b border-slate-400" />
                  </td>
                  <td className="border border-slate-300 px-3 py-2 text-center text-xl">☐</td>
                  <td className="border border-slate-300 px-3 py-2">
                    <div className="h-6 border-b border-slate-400" />
                  </td>
                </tr>
              ))}
              {ativos.length === 0 && (
                <tr>
                  <td colSpan={8} className="border border-slate-300 px-3 py-4 text-center text-slate-400 italic">
                    Nenhum ativo cadastrado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </SectionBlock>

        {/* SEÇÃO 2: EXCIPIENTE BASE */}
        <SectionBlock
          numero={2}
          titulo="EXCIPIENTE BASE (Q.S.P.)"
          corBorda="border-l-green-500"
          corFundo="bg-green-50"
        >
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-100 text-xs uppercase text-slate-600">
                <th className="border border-slate-300 px-3 py-2 w-12 text-center">Ord.</th>
                <th className="border border-slate-300 px-3 py-2 text-left">Insumo</th>
                <th className="border border-slate-300 px-3 py-2 w-32 text-right">Qtd. Necessária</th>
                <th className="border border-slate-300 px-3 py-2 w-28 text-center">Lote MP</th>
                <th className="border border-slate-300 px-3 py-2 w-24 text-center">Validade</th>
                <th className="border border-slate-300 px-3 py-2 w-20 text-center">Separado</th>
                <th className="border border-slate-300 px-3 py-2 w-28 text-center">Conferido</th>
              </tr>
            </thead>
            <tbody>
              {excipienteBase.map((mp, idx) => (
                <tr key={mp.id || idx} className="bg-green-50/50">
                  <td className="border border-slate-300 px-3 py-2 text-center">
                    <span className="inline-flex items-center justify-center w-6 h-6 bg-green-600 text-white rounded-full text-xs font-bold">
                      {idx + 1}
                    </span>
                  </td>
                  <td className="border border-slate-300 px-3 py-2">
                    <span className="font-semibold text-slate-800">{mp.insumo_nome}</span>
                    <span className="ml-2 inline-block px-2 py-0.5 bg-green-600 text-white text-xs font-semibold rounded">
                      Q.S.P.
                    </span>
                  </td>
                  <td className="border border-slate-300 px-3 py-2 text-right font-mono font-semibold text-slate-800">
                    {formatarQuantidade(mp.quantidade_teorica_g)}
                  </td>
                  <td className="border border-slate-300 px-3 py-2">
                    <div className="h-6 border-b border-slate-400" />
                  </td>
                  <td className="border border-slate-300 px-3 py-2">
                    <div className="h-6 border-b border-slate-400" />
                  </td>
                  <td className="border border-slate-300 px-3 py-2 text-center text-xl">☐</td>
                  <td className="border border-slate-300 px-3 py-2">
                    <div className="h-6 border-b border-slate-400" />
                  </td>
                </tr>
              ))}
              {excipienteBase.length === 0 && (
                <tr>
                  <td colSpan={7} className="border border-slate-300 px-3 py-4 text-center text-slate-400 italic">
                    Nenhum excipiente base cadastrado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </SectionBlock>

        {/* SEÇÃO 3: EXCIPIENTES TECNOLÓGICOS */}
        <SectionBlock
          numero={3}
          titulo="EXCIPIENTES TECNOLÓGICOS"
          subtitulo="Dióxido de Silício, Talco, Estearato de Magnésio"
          corBorda="border-l-blue-500"
          corFundo="bg-blue-50"
        >
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-100 text-xs uppercase text-slate-600">
                <th className="border border-slate-300 px-3 py-2 w-12 text-center">Ord.</th>
                <th className="border border-slate-300 px-3 py-2 text-left">Insumo</th>
                <th className="border border-slate-300 px-3 py-2 w-28 text-center">Função</th>
                <th className="border border-slate-300 px-3 py-2 w-16 text-center">%</th>
                <th className="border border-slate-300 px-3 py-2 w-32 text-right">Qtd. Necessária</th>
                <th className="border border-slate-300 px-3 py-2 w-28 text-center">Lote MP</th>
                <th className="border border-slate-300 px-3 py-2 w-20 text-center">Separado</th>
                <th className="border border-slate-300 px-3 py-2 w-28 text-center">Conferido</th>
              </tr>
            </thead>
            <tbody>
              {tecnologicos.map((mp, idx) => {
                const funcao = mp.insumo_nome?.toLowerCase().includes('silício') ? 'Anti-umectante' :
                              mp.insumo_nome?.toLowerCase().includes('talco') ? 'Lubrificante' :
                              mp.insumo_nome?.toLowerCase().includes('estearato') ? 'Deslizante' : 'Tecnológico';
                const percentual = mp.insumo_nome?.toLowerCase().includes('silício') ? '2,0%' :
                                  mp.insumo_nome?.toLowerCase().includes('talco') ? '5,0%' :
                                  mp.insumo_nome?.toLowerCase().includes('estearato') ? '2,5%' : '-';
                const isEstearato = mp.insumo_nome?.toLowerCase().includes('estearato');
                
                return (
                  <tr key={mp.id || idx} className="bg-blue-50/50">
                    <td className="border border-slate-300 px-3 py-2 text-center">
                      <span className="inline-flex items-center justify-center w-6 h-6 bg-blue-600 text-white rounded-full text-xs font-bold">
                        {idx + 1}
                      </span>
                    </td>
                    <td className="border border-slate-300 px-3 py-2">
                      <div className="font-semibold text-slate-800">{mp.insumo_nome}</div>
                      {isEstearato && (
                        <div className="text-xs text-amber-600 font-medium mt-1">
                          ⚠ SEMPRE adicionar por último
                        </div>
                      )}
                    </td>
                    <td className="border border-slate-300 px-3 py-2 text-center text-slate-600">{funcao}</td>
                    <td className="border border-slate-300 px-3 py-2 text-center font-mono">{percentual}</td>
                    <td className="border border-slate-300 px-3 py-2 text-right font-mono font-semibold text-slate-800">
                      {formatarQuantidade(mp.quantidade_teorica_g)}
                    </td>
                    <td className="border border-slate-300 px-3 py-2">
                      <div className="h-6 border-b border-slate-400" />
                    </td>
                    <td className="border border-slate-300 px-3 py-2 text-center text-xl">☐</td>
                    <td className="border border-slate-300 px-3 py-2">
                      <div className="h-6 border-b border-slate-400" />
                    </td>
                  </tr>
                );
              })}
              {tecnologicos.length === 0 && (
                <tr>
                  <td colSpan={8} className="border border-slate-300 px-3 py-4 text-center text-slate-400 italic">
                    Nenhum excipiente tecnológico cadastrado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </SectionBlock>

        {/* SEÇÃO 4: MATERIAIS DE EMBALAGEM */}
        <SectionBlock
          numero={4}
          titulo="MATERIAIS DE EMBALAGEM"
          subtitulo="Potes, tampas, rótulos, lacres, sachês de sílica"
          corBorda="border-l-purple-500"
          corFundo="bg-purple-50"
        >
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-100 text-xs uppercase text-slate-600">
                <th className="border border-slate-300 px-3 py-2 w-12 text-center">Ord.</th>
                <th className="border border-slate-300 px-3 py-2 text-left">Material</th>
                <th className="border border-slate-300 px-3 py-2 w-28 text-center">Tipo</th>
                <th className="border border-slate-300 px-3 py-2 w-32 text-right">Qtd. Necessária</th>
                <th className="border border-slate-300 px-3 py-2 w-28 text-center">Lote</th>
                <th className="border border-slate-300 px-3 py-2 w-20 text-center">Separado</th>
                <th className="border border-slate-300 px-3 py-2 w-28 text-center">Conferido</th>
              </tr>
            </thead>
            <tbody>
              {embalagensFinal.map((emb: any, idx: number) => (
                <tr key={emb.id || idx} className="bg-purple-50/50">
                  <td className="border border-slate-300 px-3 py-2 text-center">
                    <span className="inline-flex items-center justify-center w-6 h-6 bg-purple-600 text-white rounded-full text-xs font-bold">
                      {idx + 1}
                    </span>
                  </td>
                  <td className="border border-slate-300 px-3 py-2">
                    <span className="font-semibold text-slate-800">{emb.descricao || emb.insumo_nome}</span>
                  </td>
                  <td className="border border-slate-300 px-3 py-2 text-center text-slate-600">{emb.tipo || 'Embalagem'}</td>
                  <td className="border border-slate-300 px-3 py-2 text-right font-mono font-semibold text-slate-800">
                    {emb.quantidade_necessaria?.toLocaleString() || '-'} {emb.unidade || 'un'}
                  </td>
                  <td className="border border-slate-300 px-3 py-2">
                    <div className="h-6 border-b border-slate-400" />
                  </td>
                  <td className="border border-slate-300 px-3 py-2 text-center text-xl">☐</td>
                  <td className="border border-slate-300 px-3 py-2">
                    <div className="h-6 border-b border-slate-400" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionBlock>

        {/* ÁREA DE ASSINATURAS */}
        <div className="border-t-2 border-slate-300 pt-6 mt-8">
          <div className="grid grid-cols-3 gap-8">
            <SignatureBlock title="Separado por" subtitle="Nome / Data / Hora" />
            <SignatureBlock title="Conferido por" subtitle="Nome / Data / Hora" />
            <SignatureBlock title="Liberado por" subtitle="Responsável Técnico" />
          </div>
        </div>

        {/* RODAPÉ */}
        <div className="border-t border-slate-200 pt-4 mt-6 text-center text-xs text-slate-500">
          Documento gerado em {new Date().toLocaleString('pt-BR')} | {op.codigo} | 
          Este documento é parte integrante do controle de produção e rastreabilidade ANVISA
        </div>
      </div>
    </div>
  );
}

// Componentes auxiliares
function InfoBox({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={cn("bg-white px-4 py-3", highlight && "bg-amber-50")}>
      <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">{label}</div>
      <div className={cn("font-semibold text-slate-800", highlight && "text-amber-700")}>{value}</div>
    </div>
  );
}

function SectionBlock({ 
  numero, 
  titulo, 
  subtitulo, 
  corBorda = "border-l-slate-500",
  corFundo = "bg-slate-50",
  children 
}: { 
  numero: number; 
  titulo: string; 
  subtitulo?: string;
  corBorda?: string;
  corFundo?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg overflow-hidden border border-slate-200 shadow-sm">
      <div className={cn("px-4 py-3 border-l-4", corBorda, corFundo)}>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center justify-center w-7 h-7 bg-slate-700 text-white rounded-full text-sm font-bold">
            {numero}
          </span>
          <div>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">{titulo}</h3>
            {subtitulo && <p className="text-xs text-slate-500 mt-0.5">{subtitulo}</p>}
          </div>
        </div>
      </div>
      <div className="p-4 bg-white">
        {children}
      </div>
    </div>
  );
}

function SignatureBlock({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="text-center">
      <div className="h-12 border-b-2 border-slate-400 mb-2" />
      <div className="text-sm font-semibold text-slate-700">{title}</div>
      <div className="text-xs text-slate-500">{subtitle}</div>
    </div>
  );
}

// Função auxiliar para calcular embalagens padrão
function calcularEmbalagensPadrao(op: any) {
  const qtdFrascos = op.quantidade_frascos || 100;
  const qtdComReserva = Math.ceil(qtdFrascos * 1.05);
  const totalCapsulas = op.total_capsulas_com_acrescimo || qtdFrascos * 60;
  const capsulasMaisReserva = Math.ceil(totalCapsulas * 1.10);

  const embalagens = [];
  
  if (op.tipo_apresentacao === 'CAPSULA' || !op.tipo_apresentacao) {
    embalagens.push({
      tipo: 'CÁPSULA VAZIA',
      descricao: op.capsula_item_nome || `Cápsula Gelatinosa ${op.tipo_capsula || '00'}`,
      quantidade_necessaria: capsulasMaisReserva,
      unidade: 'un'
    });
  }

  embalagens.push(
    { tipo: 'POTE', descricao: op.pote_item_nome || 'Pote PEAD Branco c/ Tampa', quantidade_necessaria: qtdComReserva, unidade: 'un' },
    { tipo: 'TAMPA', descricao: op.tampa_item_nome || 'Tampa Rosca c/ Lacre Indução', quantidade_necessaria: qtdComReserva, unidade: 'un' },
    { tipo: 'RÓTULO', descricao: 'Rótulo Adesivo Personalizado', quantidade_necessaria: qtdComReserva, unidade: 'un' },
    { tipo: 'LACRE', descricao: 'Lacre Termoencolhível', quantidade_necessaria: qtdComReserva, unidade: 'un' },
    { tipo: 'SÍLICA', descricao: op.silica_item_nome || 'Sachê Sílica Gel 1g', quantidade_necessaria: qtdComReserva, unidade: 'un' }
  );

  return embalagens;
}
