// ============================================================
// FOLHA DE EMBALAGEM E ROTULAGEM - FORMATO A4
// ============================================================

import { OPCabecalhoPDF, OPRodapePDF, OPAssinaturasPDF } from './OPCabecalhoPDF';

interface OPFolhaEmbalagemProps {
  op: any;
  embalagens?: any[];
}

export function OPFolhaEmbalagem({ op, embalagens = [] }: OPFolhaEmbalagemProps) {
  const totalFrascos = op.quantidade_frascos || 100;
  const capsPorFrasco = op.capsulas_por_frasco || 60;
  
  // Calcular embalagens se não fornecidas
  const embalagensFinal = embalagens.length > 0 ? embalagens : calcularEmbalagensPadrao(op);

  return (
    <div id="section-embalagem" className="bg-white p-6 text-sm print:p-0">
      <OPCabecalhoPDF 
        op={op} 
        tituloSecao="FOLHA DE EMBALAGEM E ROTULAGEM"
        subtitulo="Fase 5 - Envase, Rotulagem e Fechamento"
      />

      {/* ESPECIFICAÇÕES */}
      <div className="section">
        <div className="section-title">
          ESPECIFICAÇÕES DE EMBALAGEM
        </div>
        <div className="op-info-grid">
          <div className="op-info-box">
            <label>Total de Frascos</label>
            <div className="value">{totalFrascos.toLocaleString()}</div>
          </div>
          <div className="op-info-box">
            <label>Unidades por Frasco</label>
            <div className="value">{capsPorFrasco} cápsulas</div>
          </div>
          <div className="op-info-box">
            <label>Lote do Produto</label>
            <div className="value">{op.lote_produto_acabado || '-'}</div>
          </div>
          <div className="op-info-box">
            <label>Data de Validade</label>
            <div className="value">{op.data_validade ? new Date(op.data_validade).toLocaleDateString('pt-BR') : '-'}</div>
          </div>
        </div>
      </div>

      {/* MATERIAIS DE EMBALAGEM */}
      <div className="section">
        <div className="section-title">
          CONFERÊNCIA DE MATERIAIS DE EMBALAGEM
        </div>
        <table>
          <thead>
            <tr>
              <th style={{ width: '5%' }}>Ord.</th>
              <th style={{ width: '25%' }}>Material</th>
              <th style={{ width: '12%' }}>Tipo</th>
              <th style={{ width: '12%' }} className="text-right">Qtd. Necessária</th>
              <th style={{ width: '12%' }}>Lote</th>
              <th style={{ width: '10%' }} className="text-right">Qtd. Usada</th>
              <th style={{ width: '12%' }}>Conferido</th>
              <th style={{ width: '12%' }}>Hora</th>
            </tr>
          </thead>
          <tbody>
            {embalagensFinal.map((emb: any, idx: number) => (
              <tr key={emb.id || idx}>
                <td className="text-center">
                  <span className="ordem-num">{idx + 1}</span>
                </td>
                <td><strong>{emb.descricao || emb.insumo_nome}</strong></td>
                <td>{emb.tipo}</td>
                <td className="text-right" style={{ fontFamily: 'Consolas, monospace' }}>
                  {emb.quantidade_necessaria?.toLocaleString()} {emb.unidade}
                </td>
                <td><span className="campo-vazio" style={{ width: '100%', display: 'block' }}>&nbsp;</span></td>
                <td className="text-right"><span className="campo-vazio" style={{ width: '100%', display: 'block' }}>&nbsp;</span></td>
                <td><span className="campo-vazio" style={{ width: '100%', display: 'block' }}>&nbsp;</span></td>
                <td><span className="campo-vazio" style={{ width: '100%', display: 'block' }}>&nbsp;</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* CHECKLIST DE ROTULAGEM */}
      <div className="section">
        <div className="section-title">
          CONFERÊNCIA DE RÓTULO
          <span className="section-subtitle"> - Verificar ANTES de aplicar</span>
        </div>
        <table>
          <thead>
            <tr>
              <th style={{ width: '50%' }}>Item de Verificação</th>
              <th style={{ width: '15%' }}>Conforme?</th>
              <th style={{ width: '35%' }}>Observação</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Nome do produto confere com OP</td>
              <td className="text-center">☐ Sim &nbsp; ☐ Não</td>
              <td><span className="campo-vazio" style={{ width: '100%', display: 'block' }}>&nbsp;</span></td>
            </tr>
            <tr>
              <td>Lote impresso: <strong>{op.lote_produto_acabado || '________'}</strong></td>
              <td className="text-center">☐ Sim &nbsp; ☐ Não</td>
              <td><span className="campo-vazio" style={{ width: '100%', display: 'block' }}>&nbsp;</span></td>
            </tr>
            <tr>
              <td>Data de fabricação impressa corretamente</td>
              <td className="text-center">☐ Sim &nbsp; ☐ Não</td>
              <td><span className="campo-vazio" style={{ width: '100%', display: 'block' }}>&nbsp;</span></td>
            </tr>
            <tr>
              <td>Data de validade impressa corretamente</td>
              <td className="text-center">☐ Sim &nbsp; ☐ Não</td>
              <td><span className="campo-vazio" style={{ width: '100%', display: 'block' }}>&nbsp;</span></td>
            </tr>
            <tr>
              <td>Tabela nutricional presente e legível</td>
              <td className="text-center">☐ Sim &nbsp; ☐ Não</td>
              <td><span className="campo-vazio" style={{ width: '100%', display: 'block' }}>&nbsp;</span></td>
            </tr>
            <tr>
              <td>Ingredientes listados corretamente</td>
              <td className="text-center">☐ Sim &nbsp; ☐ Não</td>
              <td><span className="campo-vazio" style={{ width: '100%', display: 'block' }}>&nbsp;</span></td>
            </tr>
            <tr>
              <td>Modo de uso/conservação presentes</td>
              <td className="text-center">☐ Sim &nbsp; ☐ Não</td>
              <td><span className="campo-vazio" style={{ width: '100%', display: 'block' }}>&nbsp;</span></td>
            </tr>
            <tr>
              <td>Dados do fabricante/importador presentes</td>
              <td className="text-center">☐ Sim &nbsp; ☐ Não</td>
              <td><span className="campo-vazio" style={{ width: '100%', display: 'block' }}>&nbsp;</span></td>
            </tr>
            <tr>
              <td>Registro/Dispensa ANVISA presente</td>
              <td className="text-center">☐ Sim &nbsp; ☐ Não</td>
              <td><span className="campo-vazio" style={{ width: '100%', display: 'block' }}>&nbsp;</span></td>
            </tr>
            <tr>
              <td>Alegações conforme permitido ANVISA</td>
              <td className="text-center">☐ Sim &nbsp; ☐ Não</td>
              <td><span className="campo-vazio" style={{ width: '100%', display: 'block' }}>&nbsp;</span></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* REGISTRO DE ENVASE */}
      <div className="section">
        <div className="section-title">
          REGISTRO DE ENVASE E FECHAMENTO
        </div>
        <table>
          <tbody>
            <tr>
              <td style={{ width: '25%' }}><strong>Hora de Início Envase:</strong></td>
              <td style={{ width: '25%' }}><span className="campo-vazio campo-vazio-lg">&nbsp;</span></td>
              <td style={{ width: '25%' }}><strong>Hora de Término:</strong></td>
              <td style={{ width: '25%' }}><span className="campo-vazio campo-vazio-lg">&nbsp;</span></td>
            </tr>
            <tr>
              <td><strong>Frascos Envasados:</strong></td>
              <td><span className="campo-vazio campo-vazio-lg">&nbsp;</span></td>
              <td><strong>Frascos Rejeitados:</strong></td>
              <td><span className="campo-vazio campo-vazio-lg">&nbsp;</span></td>
            </tr>
            <tr>
              <td><strong>Hora Início Rotulagem:</strong></td>
              <td><span className="campo-vazio campo-vazio-lg">&nbsp;</span></td>
              <td><strong>Hora Término:</strong></td>
              <td><span className="campo-vazio campo-vazio-lg">&nbsp;</span></td>
            </tr>
            <tr>
              <td><strong>Frascos Rotulados:</strong></td>
              <td><span className="campo-vazio campo-vazio-lg">&nbsp;</span></td>
              <td><strong>Rótulos Descartados:</strong></td>
              <td><span className="campo-vazio campo-vazio-lg">&nbsp;</span></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* CONTAGEM FINAL */}
      <div className="section">
        <div className="section-title">
          CONTAGEM FINAL E LIBERAÇÃO
        </div>
        <table>
          <tbody>
            <tr className="row-excipiente">
              <td style={{ width: '40%' }}><strong>Total de Frascos Produzidos:</strong></td>
              <td><span className="campo-vazio campo-vazio-lg">&nbsp;</span> frascos</td>
            </tr>
            <tr>
              <td><strong>Frascos Aprovados para Expedição:</strong></td>
              <td><span className="campo-vazio campo-vazio-lg">&nbsp;</span> frascos</td>
            </tr>
            <tr>
              <td><strong>Frascos em Quarentena:</strong></td>
              <td><span className="campo-vazio campo-vazio-lg">&nbsp;</span> frascos</td>
            </tr>
            <tr>
              <td><strong>Frascos Rejeitados:</strong></td>
              <td><span className="campo-vazio campo-vazio-lg">&nbsp;</span> frascos</td>
            </tr>
            <tr>
              <td><strong>Motivo da Rejeição (se houver):</strong></td>
              <td><span className="campo-vazio" style={{ width: '100%', display: 'block' }}>&nbsp;</span></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* UPLOAD DE RÓTULO */}
      <div className="section">
        <div className="section-title">
          ANEXO OBRIGATÓRIO - ARTE FINAL DO RÓTULO
        </div>
        <div style={{ border: '2px dashed #ccc', padding: '20px', textAlign: 'center', background: '#fafafa' }}>
          <p style={{ margin: 0, fontSize: '10px' }}>☐ Cópia do rótulo final aplicado anexada a este documento</p>
          <p style={{ margin: '10px 0 0 0', fontSize: '9px', color: '#666' }}>
            (Colar aqui uma amostra do rótulo ou anexar cópia impressa)
          </p>
        </div>
      </div>

      {/* Assinaturas */}
      <OPAssinaturasPDF
        assinaturas={[
          { cargo: 'Operador de Embalagem', subtitulo: 'Nome / Data / Hora' },
          { cargo: 'Conferente', subtitulo: 'Nome / Data / Hora' },
          { cargo: 'Responsável Técnico', subtitulo: 'Liberação Final' },
        ]}
      />

      <OPRodapePDF op={op} />
    </div>
  );
}

// Função auxiliar
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
