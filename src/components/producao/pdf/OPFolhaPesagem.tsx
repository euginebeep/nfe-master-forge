// ============================================================
// FOLHA DE PESAGEM DE MATÉRIAS-PRIMAS - FORMATO A4
// Inclui distribuição geométrica junto com pesagem
// ============================================================

import { OPCabecalhoPDF, OPRodapePDF, OPAssinaturasPDF } from './OPCabecalhoPDF';

interface OPFolhaPesagemProps {
  op: any;
  materiasPrimas: any[];
}

export function OPFolhaPesagem({ op, materiasPrimas }: OPFolhaPesagemProps) {
  // Ordenar por ordem de mistura
  const mpOrdenadas = [...materiasPrimas].sort((a, b) => 
    (a.ordem_mistura || 999) - (b.ordem_mistura || 999)
  );

  // Identificar itens críticos
  const itensCriticos = mpOrdenadas.filter(mp => mp.pesagem_critica);

  const formatarQuantidade = (valorG: number) => {
    if (valorG >= 1) {
      return { valor: valorG.toFixed(4), unidade: 'g', balanca: '3 ou 4 casas' };
    }
    if (valorG >= 0.001) {
      return { valor: (valorG * 1000).toFixed(4), unidade: 'mg', balanca: '4 ou 5 casas (analítica)' };
    }
    return { valor: (valorG * 1000000).toFixed(2), unidade: 'mcg', balanca: '5+ casas (ultra-analítica)' };
  };

  const formatarTolerancia = (min: number, max: number) => {
    const minFmt = formatarQuantidade(min);
    const maxFmt = formatarQuantidade(max);
    return `${minFmt.valor} - ${maxFmt.valor} ${maxFmt.unidade}`;
  };

  return (
    <div id="section-pesagem" className="bg-white p-6 text-sm print:p-0">
      <OPCabecalhoPDF 
        op={op} 
        tituloSecao="FOLHA DE PESAGEM DE MATÉRIAS-PRIMAS"
        subtitulo="Fase 2 - Pesagem Industrial"
      />

      {/* ALERTA DE ATIVOS CRÍTICOS */}
      {itensCriticos.length > 0 && (
        <div className="alert-critico">
          <div className="alert-critico-title">
            ⚠️ ATENÇÃO: {itensCriticos.length} ATIVO(S) CRÍTICO(S) IDENTIFICADO(S)
          </div>
          <div className="alert-critico-text">
            Os itens marcados como <strong>CRÍTICOS</strong> exigem <strong>DUPLA CONFERÊNCIA</strong> na pesagem.
            <br />
            <strong>PROIBIDA A PESAGEM DIRETA NO LOTE FINAL.</strong> Seguir procedimento de PRÉ-MIX obrigatório.
          </div>
        </div>
      )}

      {/* DISTRIBUIÇÃO GEOMÉTRICA (se houver ativos críticos) */}
      {itensCriticos.length > 0 && (
        <div className="section">
          <div className="section-title">
            PROCEDIMENTO DE DISTRIBUIÇÃO GEOMÉTRICA
            <span className="section-subtitle"> - Obrigatório para ativos críticos</span>
          </div>
          
          {itensCriticos.map((mp, idx) => {
            const qtd = formatarQuantidade(mp.quantidade_teorica_g);
            return (
              <div key={mp.id || idx} className="diluicao-box" style={{ marginBottom: '12px' }}>
                <div className="diluicao-title">
                  {mp.insumo_nome} - {qtd.valor} {qtd.unidade}
                </div>
                
                <div className="diluicao-passo">
                  <span className="passo-num">1</span>
                  <span className="passo-texto">
                    Pesar <strong>{qtd.valor} {qtd.unidade}</strong> do ativo em balança {qtd.balanca}
                  </span>
                  <span className="passo-proporcao">1:0</span>
                </div>
                
                <div className="diluicao-passo">
                  <span className="passo-num">2</span>
                  <span className="passo-texto">
                    Adicionar quantidade <strong>IGUAL</strong> de Excipiente Base (diluente)
                  </span>
                  <span className="passo-proporcao">1:1</span>
                </div>
                
                <div className="diluicao-passo">
                  <span className="passo-num">3</span>
                  <span className="passo-texto">
                    Homogeneizar por <strong>2 minutos</strong> com movimentos circulares
                  </span>
                  <span className="passo-proporcao">-</span>
                </div>
                
                <div className="diluicao-passo">
                  <span className="passo-num">4</span>
                  <span className="passo-texto">
                    <strong>Dobrar</strong> o volume com mais Excipiente Base, homogeneizar 2 min
                  </span>
                  <span className="passo-proporcao">1:2</span>
                </div>
                
                <div className="diluicao-passo">
                  <span className="passo-num">5</span>
                  <span className="passo-texto">
                    Repetir passo 4 até completar volume total do Excipiente Base
                  </span>
                  <span className="passo-proporcao">Progressivo</span>
                </div>
                
                <div className="diluicao-passo">
                  <span className="passo-num">6</span>
                  <span className="passo-texto">
                    Homogeneização final por <strong>5 minutos</strong>
                  </span>
                  <span className="passo-proporcao">Final</span>
                </div>
                
                <div style={{ marginTop: '8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <strong style={{ fontSize: '9px' }}>Conferente 1:</strong>
                    <span className="campo-vazio campo-vazio-lg" style={{ marginLeft: '8px' }}>&nbsp;</span>
                  </div>
                  <div>
                    <strong style={{ fontSize: '9px' }}>Conferente 2:</strong>
                    <span className="campo-vazio campo-vazio-lg" style={{ marginLeft: '8px' }}>&nbsp;</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* LISTA DE PESAGEM */}
      <div className="section">
        <div className="section-title">
          LISTA DE PESAGEM - ORDEM INDUSTRIAL
        </div>
        <table>
          <thead>
            <tr>
              <th style={{ width: '4%' }}>Ord.</th>
              <th style={{ width: '22%' }}>Insumo</th>
              <th style={{ width: '8%' }}>Cat.</th>
              <th style={{ width: '7%' }}>Tipo</th>
              <th style={{ width: '12%' }} className="text-right">Qtd. Teórica</th>
              <th style={{ width: '14%' }} className="text-right">Tolerância (±10%)</th>
              <th style={{ width: '10%' }}>Lote MP</th>
              <th style={{ width: '11%' }} className="text-right">Peso Real</th>
              <th style={{ width: '12%' }}>Pesado Por</th>
            </tr>
          </thead>
          <tbody>
            {mpOrdenadas.map((mp, idx) => {
              const qtd = formatarQuantidade(mp.quantidade_teorica_g);
              const categoria = mp.categoria === 'ATIVO' ? 'Ativo' :
                              mp.categoria === 'EXCIPIENTE_BASE' ? 'Base' :
                              mp.categoria === 'EXCIPIENTE_TECNOLOGICO' ? 'Técnico' : mp.categoria;
              
              return (
                <tr key={mp.id || idx} className={mp.pesagem_critica ? 'row-critico' : mp.categoria !== 'ATIVO' ? 'row-excipiente' : ''}>
                  <td className="text-center">
                    <span className="ordem-num">{mp.ordem_mistura || idx + 1}</span>
                  </td>
                  <td>
                    <strong>{mp.insumo_nome}</strong>
                    {mp.pesagem_critica && (
                      <div style={{ marginTop: '2px' }}>
                        <span className="badge badge-critico">CRÍTICO</span>
                      </div>
                    )}
                  </td>
                  <td>{categoria}</td>
                  <td className="text-center">
                    {mp.pesagem_critica ? (
                      <span className="badge badge-critico">Crítica</span>
                    ) : (
                      <span className="badge badge-normal">Padrão</span>
                    )}
                  </td>
                  <td className="text-right" style={{ fontFamily: 'Consolas, monospace', fontWeight: 600 }}>
                    {qtd.valor} {qtd.unidade}
                  </td>
                  <td className="text-right" style={{ fontSize: '8px' }}>
                    {formatarTolerancia(mp.quantidade_minima_g, mp.quantidade_maxima_g)}
                  </td>
                  <td>
                    <span className="campo-vazio" style={{ width: '100%', display: 'block' }}>&nbsp;</span>
                  </td>
                  <td className="text-right">
                    <span className="campo-vazio" style={{ width: '100%', display: 'block' }}>&nbsp;</span>
                    <span style={{ fontSize: '7px', color: '#666' }}>{qtd.unidade}</span>
                  </td>
                  <td>
                    <span className="campo-vazio" style={{ width: '100%', display: 'block' }}>&nbsp;</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        
        {/* Nota sobre balança */}
        <div style={{ marginTop: '8px', fontSize: '8px', color: '#666', padding: '6px', background: '#f5f5f5', border: '1px solid #ddd' }}>
          <strong>NOTA SOBRE BALANÇAS:</strong><br />
          • Quantidades ≥ 1g: Balança semi-analítica (3 ou 4 casas decimais)<br />
          • Quantidades entre 1mg e 1g: Balança analítica (4 ou 5 casas decimais)<br />
          • Quantidades &lt; 1mg: Balança ultra-analítica (5+ casas decimais)
        </div>
      </div>

      {/* Conferência de Pesagem para Críticos */}
      {itensCriticos.length > 0 && (
        <div className="section">
          <div className="section-title">
            REGISTRO DE DUPLA CONFERÊNCIA - ATIVOS CRÍTICOS
          </div>
          <table>
            <thead>
              <tr>
                <th style={{ width: '25%' }}>Ativo</th>
                <th style={{ width: '15%' }}>Peso Teórico</th>
                <th style={{ width: '15%' }}>Peso Real</th>
                <th style={{ width: '15%' }}>Conferente 1</th>
                <th style={{ width: '15%' }}>Conferente 2</th>
                <th style={{ width: '15%' }}>Hora</th>
              </tr>
            </thead>
            <tbody>
              {itensCriticos.map((mp, idx) => {
                const qtd = formatarQuantidade(mp.quantidade_teorica_g);
                return (
                  <tr key={mp.id || idx} className="row-critico">
                    <td><strong>{mp.insumo_nome}</strong></td>
                    <td className="text-right">{qtd.valor} {qtd.unidade}</td>
                    <td>
                      <span className="campo-vazio" style={{ width: '100%', display: 'block' }}>&nbsp;</span>
                    </td>
                    <td>
                      <span className="campo-vazio" style={{ width: '100%', display: 'block' }}>&nbsp;</span>
                    </td>
                    <td>
                      <span className="campo-vazio" style={{ width: '100%', display: 'block' }}>&nbsp;</span>
                    </td>
                    <td>
                      <span className="campo-vazio" style={{ width: '100%', display: 'block' }}>&nbsp;</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Assinaturas */}
      <OPAssinaturasPDF
        assinaturas={[
          { cargo: 'Operador de Pesagem', subtitulo: 'Nome / Data / Hora' },
          { cargo: 'Conferente', subtitulo: 'Nome / Data / Hora' },
          { cargo: 'Responsável Técnico', subtitulo: 'Liberação da Pesagem' },
        ]}
      />

      <OPRodapePDF op={op} />
    </div>
  );
}
