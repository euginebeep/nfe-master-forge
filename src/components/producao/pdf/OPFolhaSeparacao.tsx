// ============================================================
// FOLHA DE SEPARAÇÃO DE MATERIAIS - FORMATO A4
// Inclui matérias-primas E embalagens
// ============================================================

import { OPCabecalhoPDF, OPRodapePDF, OPAssinaturasPDF } from './OPCabecalhoPDF';

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

  // Garantir que Sílica está presente
  const temSilica = tecnologicos.some(t => 
    t.insumo_nome.toLowerCase().includes('silício') || 
    t.insumo_nome.toLowerCase().includes('silica')
  );

  // Calcular embalagens se não fornecidas
  const embalagensFinal = embalagens.length > 0 ? embalagens : calcularEmbalagensPadrao(op);

  const formatarQuantidade = (valor: number, unidade: string = 'g') => {
    if (valor >= 1000) {
      return `${(valor / 1000).toFixed(3)} kg`;
    }
    return `${valor.toFixed(4)} ${unidade}`;
  };

  return (
    <div id="section-separacao" className="bg-white p-6 text-sm print:p-0">
      <OPCabecalhoPDF 
        op={op} 
        tituloSecao="FOLHA DE SEPARAÇÃO DE MATERIAIS"
        subtitulo="Fase 1 - Pré-Produção"
      />

      {/* MATÉRIAS-PRIMAS - ATIVOS */}
      <div className="section">
        <div className="section-title">
          1. ATIVOS E PRINCÍPIOS ATIVOS
          <span className="section-subtitle"> - Separar conforme lista abaixo</span>
        </div>
        <table>
          <thead>
            <tr>
              <th style={{ width: '5%' }}>Ord.</th>
              <th style={{ width: '30%' }}>Insumo</th>
              <th style={{ width: '12%' }}>Categoria</th>
              <th style={{ width: '12%' }} className="text-right">Qtd. Necessária</th>
              <th style={{ width: '12%' }}>Lote MP</th>
              <th style={{ width: '10%' }}>Validade</th>
              <th style={{ width: '8%' }}>Separado</th>
              <th style={{ width: '11%' }}>Conferido</th>
            </tr>
          </thead>
          <tbody>
            {ativos.map((mp, idx) => (
              <tr key={mp.id || idx} className={mp.pesagem_critica ? 'row-critico' : ''}>
                <td className="text-center">
                  <span className="ordem-num">{idx + 1}</span>
                </td>
                <td>
                  <strong>{mp.insumo_nome}</strong>
                  {mp.pesagem_critica && (
                    <div style={{ marginTop: '2px' }}>
                      <span className="badge badge-critico">CRÍTICO</span>
                      {mp.motivo_critico && (
                        <span style={{ fontSize: '8px', marginLeft: '4px', color: '#666' }}>
                          ({mp.motivo_critico})
                        </span>
                      )}
                    </div>
                  )}
                </td>
                <td>Ativo</td>
                <td className="text-right" style={{ fontFamily: 'Consolas, monospace', fontWeight: 600 }}>
                  {formatarQuantidade(mp.quantidade_teorica_g)}
                </td>
                <td>
                  <span className="campo-vazio" style={{ width: '100%', display: 'block' }}>&nbsp;</span>
                </td>
                <td>
                  <span className="campo-vazio" style={{ width: '100%', display: 'block' }}>&nbsp;</span>
                </td>
                <td className="text-center">☐</td>
                <td>
                  <span className="campo-vazio" style={{ width: '100%', display: 'block' }}>&nbsp;</span>
                </td>
              </tr>
            ))}
            {ativos.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center" style={{ color: '#666' }}>
                  Nenhum ativo cadastrado
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* EXCIPIENTE BASE */}
      <div className="section">
        <div className="section-title">
          2. EXCIPIENTE BASE (Q.S.P.)
        </div>
        <table>
          <thead>
            <tr>
              <th style={{ width: '5%' }}>Ord.</th>
              <th style={{ width: '35%' }}>Insumo</th>
              <th style={{ width: '12%' }} className="text-right">Qtd. Necessária</th>
              <th style={{ width: '12%' }}>Lote MP</th>
              <th style={{ width: '10%' }}>Validade</th>
              <th style={{ width: '8%' }}>Separado</th>
              <th style={{ width: '13%' }}>Conferido</th>
            </tr>
          </thead>
          <tbody>
            {excipienteBase.map((mp, idx) => (
              <tr key={mp.id || idx} className="row-excipiente">
                <td className="text-center">
                  <span className="ordem-num">{idx + 1}</span>
                </td>
                <td>
                  <strong>{mp.insumo_nome}</strong>
                  <span className="badge badge-excipiente" style={{ marginLeft: '8px' }}>Q.S.P.</span>
                </td>
                <td className="text-right" style={{ fontFamily: 'Consolas, monospace', fontWeight: 600 }}>
                  {formatarQuantidade(mp.quantidade_teorica_g)}
                </td>
                <td>
                  <span className="campo-vazio" style={{ width: '100%', display: 'block' }}>&nbsp;</span>
                </td>
                <td>
                  <span className="campo-vazio" style={{ width: '100%', display: 'block' }}>&nbsp;</span>
                </td>
                <td className="text-center">☐</td>
                <td>
                  <span className="campo-vazio" style={{ width: '100%', display: 'block' }}>&nbsp;</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* EXCIPIENTES TECNOLÓGICOS */}
      <div className="section">
        <div className="section-title">
          3. EXCIPIENTES TECNOLÓGICOS
          <span className="section-subtitle"> - Dióxido de Silício, Talco, Estearato de Magnésio</span>
        </div>
        <table>
          <thead>
            <tr>
              <th style={{ width: '5%' }}>Ord.</th>
              <th style={{ width: '25%' }}>Insumo</th>
              <th style={{ width: '10%' }}>Função</th>
              <th style={{ width: '8%' }}>%</th>
              <th style={{ width: '12%' }} className="text-right">Qtd. Necessária</th>
              <th style={{ width: '12%' }}>Lote MP</th>
              <th style={{ width: '8%' }}>Separado</th>
              <th style={{ width: '12%' }}>Conferido</th>
            </tr>
          </thead>
          <tbody>
            {tecnologicos.map((mp, idx) => {
              const funcao = mp.insumo_nome.toLowerCase().includes('silício') ? 'Anti-umectante' :
                            mp.insumo_nome.toLowerCase().includes('talco') ? 'Lubrificante' :
                            mp.insumo_nome.toLowerCase().includes('estearato') ? 'Deslizante' : 'Tecnológico';
              const percentual = mp.insumo_nome.toLowerCase().includes('silício') ? '2,0%' :
                                mp.insumo_nome.toLowerCase().includes('talco') ? '5,0%' :
                                mp.insumo_nome.toLowerCase().includes('estearato') ? '2,5%' : '-';
              return (
                <tr key={mp.id || idx} className="row-excipiente">
                  <td className="text-center">
                    <span className="ordem-num">{idx + 1}</span>
                  </td>
                  <td>
                    <strong>{mp.insumo_nome}</strong>
                    {mp.insumo_nome.toLowerCase().includes('estearato') && (
                      <div style={{ fontSize: '8px', color: '#856404', marginTop: '2px' }}>
                        ⚠ SEMPRE adicionar por último
                      </div>
                    )}
                  </td>
                  <td>{funcao}</td>
                  <td className="text-center">{percentual}</td>
                  <td className="text-right" style={{ fontFamily: 'Consolas, monospace', fontWeight: 600 }}>
                    {formatarQuantidade(mp.quantidade_teorica_g)}
                  </td>
                  <td>
                    <span className="campo-vazio" style={{ width: '100%', display: 'block' }}>&nbsp;</span>
                  </td>
                  <td className="text-center">☐</td>
                  <td>
                    <span className="campo-vazio" style={{ width: '100%', display: 'block' }}>&nbsp;</span>
                  </td>
                </tr>
              );
            })}
            {!temSilica && (
              <tr className="row-critico">
                <td colSpan={8} style={{ color: '#721c24', fontWeight: 600 }}>
                  ⚠ ATENÇÃO: Dióxido de Silício não cadastrado! Verificar cadastro de excipientes.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* MATERIAIS DE EMBALAGEM */}
      <div className="section">
        <div className="section-title">
          4. MATERIAIS DE EMBALAGEM
          <span className="section-subtitle"> - Potes, tampas, rótulos, lacres, sachês de sílica</span>
        </div>
        <table>
          <thead>
            <tr>
              <th style={{ width: '5%' }}>Ord.</th>
              <th style={{ width: '30%' }}>Material</th>
              <th style={{ width: '12%' }}>Tipo</th>
              <th style={{ width: '12%' }} className="text-right">Qtd. Necessária</th>
              <th style={{ width: '12%' }}>Lote</th>
              <th style={{ width: '8%' }}>Separado</th>
              <th style={{ width: '13%' }}>Conferido</th>
            </tr>
          </thead>
          <tbody>
            {embalagensFinal.map((emb: any, idx: number) => (
              <tr key={emb.id || idx}>
                <td className="text-center">
                  <span className="ordem-num">{idx + 1}</span>
                </td>
                <td>
                  <strong>{emb.descricao || emb.insumo_nome}</strong>
                </td>
                <td>{emb.tipo || 'Embalagem'}</td>
                <td className="text-right" style={{ fontFamily: 'Consolas, monospace', fontWeight: 600 }}>
                  {emb.quantidade_necessaria?.toLocaleString() || '-'} {emb.unidade || 'un'}
                </td>
                <td>
                  <span className="campo-vazio" style={{ width: '100%', display: 'block' }}>&nbsp;</span>
                </td>
                <td className="text-center">☐</td>
                <td>
                  <span className="campo-vazio" style={{ width: '100%', display: 'block' }}>&nbsp;</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Assinaturas */}
      <OPAssinaturasPDF
        assinaturas={[
          { cargo: 'Separado por', subtitulo: 'Nome / Data / Hora' },
          { cargo: 'Conferido por', subtitulo: 'Nome / Data / Hora' },
          { cargo: 'Liberado por', subtitulo: 'Responsável Técnico' },
        ]}
      />

      <OPRodapePDF op={op} />
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
