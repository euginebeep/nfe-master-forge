// ============================================================
// FOLHA DE MISTURA - FORMATO A4
// Ordem fixa de mistura industrial
// ============================================================

import { OPCabecalhoPDF, OPRodapePDF, OPAssinaturasPDF } from './OPCabecalhoPDF';

interface OPFolhaMisturaProps {
  op: any;
  materiasPrimas: any[];
}

export function OPFolhaMistura({ op, materiasPrimas }: OPFolhaMisturaProps) {
  // Ordenar por ordem de mistura
  const mpOrdenadas = [...materiasPrimas].sort((a, b) => 
    (a.ordem_mistura || 999) - (b.ordem_mistura || 999)
  );

  // Agrupar por categoria para ordem de mistura
  const ativos = mpOrdenadas.filter(mp => mp.categoria === 'ATIVO');
  const excipienteBase = mpOrdenadas.filter(mp => mp.categoria === 'EXCIPIENTE_BASE');
  const tecnologicos = mpOrdenadas.filter(mp => mp.categoria === 'EXCIPIENTE_TECNOLOGICO');

  // Encontrar estearato (sempre último)
  const estearato = tecnologicos.find(t => 
    t.insumo_nome.toLowerCase().includes('estearato')
  );
  const outrosTecnologicos = tecnologicos.filter(t => 
    !t.insumo_nome.toLowerCase().includes('estearato')
  );

  const formatarQuantidade = (valorG: number) => {
    if (valorG >= 1000) return `${(valorG / 1000).toFixed(3)} kg`;
    if (valorG >= 1) return `${valorG.toFixed(4)} g`;
    return `${(valorG * 1000).toFixed(4)} mg`;
  };

  return (
    <div id="section-mistura" className="bg-white p-6 text-sm print:p-0">
      <OPCabecalhoPDF 
        op={op} 
        tituloSecao="FOLHA DE ORDEM DE MISTURA"
        subtitulo="Fase 3 - Mistura Industrial"
      />

      {/* REGRAS DE MISTURA */}
      <div className="section">
        <div className="section-title">
          REGRAS OBRIGATÓRIAS DE MISTURA
        </div>
        <div style={{ padding: '10px', background: '#fff3cd', border: '1px solid #ffc107', marginBottom: '12px' }}>
          <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '9px' }}>
            <li><strong>Homogeneização:</strong> Mínimo 5 minutos entre cada adição de componente</li>
            <li><strong>Dióxido de Silício:</strong> Adicionar ANTES do Talco para melhor fluidez</li>
            <li><strong>Estearato de Magnésio:</strong> SEMPRE adicionar POR ÚLTIMO (máx. 2 min de mistura)</li>
            <li><strong>Temperatura:</strong> Ambiente controlado (15-25°C) / Umidade &lt; 60%</li>
          </ul>
        </div>
      </div>

      {/* ORDEM DE MISTURA DETALHADA */}
      <div className="section">
        <div className="section-title">
          SEQUÊNCIA DE MISTURA
        </div>

        {/* ETAPA 1: PRÉ-MIX (se houver ativos críticos) */}
        {ativos.some(a => a.pesagem_critica) && (
          <div className="etapa-mistura" style={{ background: '#f8d7da', borderColor: '#dc3545' }}>
            <div className="etapa-num" style={{ color: '#dc3545' }}>0</div>
            <div className="etapa-descricao">
              <strong>PRÉ-MIX DE ATIVOS CRÍTICOS</strong>
              <div style={{ fontSize: '8px', color: '#721c24' }}>
                Executar distribuição geométrica conforme Folha de Pesagem
              </div>
            </div>
            <div className="etapa-tempo">Conforme procedimento</div>
          </div>
        )}

        {/* ETAPA 1: ATIVOS */}
        <div className="etapa-mistura">
          <div className="etapa-num">1</div>
          <div className="etapa-descricao">
            <strong>ADICIONAR ATIVOS</strong>
            <div style={{ fontSize: '8px', color: '#666' }}>
              {ativos.map(a => a.insumo_nome).join(', ') || 'Nenhum ativo'}
            </div>
          </div>
          <div className="etapa-tempo">Homogeneizar 5 min</div>
        </div>

        {/* ETAPA 2: EXCIPIENTE BASE */}
        <div className="etapa-mistura" style={{ background: '#e8f5e9', borderColor: '#28a745' }}>
          <div className="etapa-num">2</div>
          <div className="etapa-descricao">
            <strong>ADICIONAR EXCIPIENTE BASE (Q.S.P.)</strong>
            <div style={{ fontSize: '8px', color: '#666' }}>
              {excipienteBase.map(e => `${e.insumo_nome} - ${formatarQuantidade(e.quantidade_teorica_g)}`).join(', ') || 'Não definido'}
            </div>
          </div>
          <div className="etapa-tempo">Homogeneizar 10 min</div>
        </div>

        {/* ETAPA 3: DIÓXIDO DE SILÍCIO */}
        {outrosTecnologicos.filter(t => t.insumo_nome.toLowerCase().includes('silício')).map((tec, idx) => (
          <div key={idx} className="etapa-mistura" style={{ background: '#e3f2fd', borderColor: '#2196f3' }}>
            <div className="etapa-num">3</div>
            <div className="etapa-descricao">
              <strong>ADICIONAR {tec.insumo_nome.toUpperCase()}</strong>
              <div style={{ fontSize: '8px', color: '#666' }}>
                {formatarQuantidade(tec.quantidade_teorica_g)} - Função: Anti-umectante
              </div>
            </div>
            <div className="etapa-tempo">Homogeneizar 3 min</div>
          </div>
        ))}

        {/* ETAPA 4: TALCO */}
        {outrosTecnologicos.filter(t => t.insumo_nome.toLowerCase().includes('talco')).map((tec, idx) => (
          <div key={idx} className="etapa-mistura" style={{ background: '#e3f2fd', borderColor: '#2196f3' }}>
            <div className="etapa-num">4</div>
            <div className="etapa-descricao">
              <strong>ADICIONAR {tec.insumo_nome.toUpperCase()}</strong>
              <div style={{ fontSize: '8px', color: '#666' }}>
                {formatarQuantidade(tec.quantidade_teorica_g)} - Função: Lubrificante
              </div>
            </div>
            <div className="etapa-tempo">Homogeneizar 3 min</div>
          </div>
        ))}

        {/* ETAPA 5: ESTEARATO (ÚLTIMO) */}
        {estearato && (
          <div className="etapa-mistura" style={{ background: '#fff3cd', borderColor: '#ffc107' }}>
            <div className="etapa-num">5</div>
            <div className="etapa-descricao">
              <strong>⚠️ ADICIONAR {estearato.insumo_nome.toUpperCase()} - ÚLTIMO!</strong>
              <div style={{ fontSize: '8px', color: '#856404' }}>
                {formatarQuantidade(estearato.quantidade_teorica_g)} - Função: Deslizante | <strong>MÁXIMO 2 MIN DE MISTURA!</strong>
              </div>
            </div>
            <div className="etapa-tempo" style={{ color: '#856404', fontWeight: 700 }}>MÁX. 2 min!</div>
          </div>
        )}
      </div>

      {/* REGISTRO DE MISTURA */}
      <div className="section">
        <div className="section-title">
          REGISTRO DE EXECUÇÃO DA MISTURA
        </div>
        <table>
          <thead>
            <tr>
              <th style={{ width: '8%' }}>Etapa</th>
              <th style={{ width: '30%' }}>Componente</th>
              <th style={{ width: '12%' }}>Quantidade</th>
              <th style={{ width: '12%' }}>Hora Início</th>
              <th style={{ width: '12%' }}>Hora Fim</th>
              <th style={{ width: '13%' }}>Tempo Real</th>
              <th style={{ width: '13%' }}>Operador</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="text-center">1</td>
              <td>Ativos</td>
              <td>-</td>
              <td><span className="campo-vazio" style={{ width: '100%', display: 'block' }}>&nbsp;</span></td>
              <td><span className="campo-vazio" style={{ width: '100%', display: 'block' }}>&nbsp;</span></td>
              <td><span className="campo-vazio" style={{ width: '100%', display: 'block' }}>&nbsp;</span></td>
              <td><span className="campo-vazio" style={{ width: '100%', display: 'block' }}>&nbsp;</span></td>
            </tr>
            <tr className="row-excipiente">
              <td className="text-center">2</td>
              <td>Excipiente Base (Q.S.P.)</td>
              <td>{excipienteBase[0] ? formatarQuantidade(excipienteBase[0].quantidade_teorica_g) : '-'}</td>
              <td><span className="campo-vazio" style={{ width: '100%', display: 'block' }}>&nbsp;</span></td>
              <td><span className="campo-vazio" style={{ width: '100%', display: 'block' }}>&nbsp;</span></td>
              <td><span className="campo-vazio" style={{ width: '100%', display: 'block' }}>&nbsp;</span></td>
              <td><span className="campo-vazio" style={{ width: '100%', display: 'block' }}>&nbsp;</span></td>
            </tr>
            {outrosTecnologicos.map((tec, idx) => (
              <tr key={idx}>
                <td className="text-center">{3 + idx}</td>
                <td>{tec.insumo_nome}</td>
                <td>{formatarQuantidade(tec.quantidade_teorica_g)}</td>
                <td><span className="campo-vazio" style={{ width: '100%', display: 'block' }}>&nbsp;</span></td>
                <td><span className="campo-vazio" style={{ width: '100%', display: 'block' }}>&nbsp;</span></td>
                <td><span className="campo-vazio" style={{ width: '100%', display: 'block' }}>&nbsp;</span></td>
                <td><span className="campo-vazio" style={{ width: '100%', display: 'block' }}>&nbsp;</span></td>
              </tr>
            ))}
            {estearato && (
              <tr className="row-critico">
                <td className="text-center">{3 + outrosTecnologicos.length}</td>
                <td><strong>{estearato.insumo_nome} (ÚLTIMO)</strong></td>
                <td>{formatarQuantidade(estearato.quantidade_teorica_g)}</td>
                <td><span className="campo-vazio" style={{ width: '100%', display: 'block' }}>&nbsp;</span></td>
                <td><span className="campo-vazio" style={{ width: '100%', display: 'block' }}>&nbsp;</span></td>
                <td><span className="campo-vazio" style={{ width: '100%', display: 'block' }}>&nbsp;</span></td>
                <td><span className="campo-vazio" style={{ width: '100%', display: 'block' }}>&nbsp;</span></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* CONTROLE DE QUALIDADE DA MISTURA */}
      <div className="section">
        <div className="section-title">
          CONTROLE DE QUALIDADE - PÓ FINAL
        </div>
        <table>
          <thead>
            <tr>
              <th style={{ width: '25%' }}>Teste</th>
              <th style={{ width: '35%' }}>Resultado</th>
              <th style={{ width: '15%' }}>Conforme?</th>
              <th style={{ width: '25%' }}>Observação</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Aparência do pó</td>
              <td><span className="campo-vazio" style={{ width: '100%', display: 'block' }}>&nbsp;</span></td>
              <td className="text-center">☐ Sim &nbsp; ☐ Não</td>
              <td><span className="campo-vazio" style={{ width: '100%', display: 'block' }}>&nbsp;</span></td>
            </tr>
            <tr>
              <td>Cor</td>
              <td><span className="campo-vazio" style={{ width: '100%', display: 'block' }}>&nbsp;</span></td>
              <td className="text-center">☐ Sim &nbsp; ☐ Não</td>
              <td><span className="campo-vazio" style={{ width: '100%', display: 'block' }}>&nbsp;</span></td>
            </tr>
            <tr>
              <td>Fluidez</td>
              <td><span className="campo-vazio" style={{ width: '100%', display: 'block' }}>&nbsp;</span></td>
              <td className="text-center">☐ Sim &nbsp; ☐ Não</td>
              <td><span className="campo-vazio" style={{ width: '100%', display: 'block' }}>&nbsp;</span></td>
            </tr>
            <tr>
              <td>Homogeneidade visual</td>
              <td><span className="campo-vazio" style={{ width: '100%', display: 'block' }}>&nbsp;</span></td>
              <td className="text-center">☐ Sim &nbsp; ☐ Não</td>
              <td><span className="campo-vazio" style={{ width: '100%', display: 'block' }}>&nbsp;</span></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Assinaturas */}
      <OPAssinaturasPDF
        assinaturas={[
          { cargo: 'Operador de Mistura', subtitulo: 'Nome / Data / Hora' },
          { cargo: 'Conferente', subtitulo: 'Nome / Data / Hora' },
          { cargo: 'Responsável Técnico', subtitulo: 'Liberação da Mistura' },
        ]}
      />

      <OPRodapePDF op={op} />
    </div>
  );
}
