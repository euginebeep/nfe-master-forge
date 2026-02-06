// ============================================================
// FOLHA DE ENCAPSULAMENTO - FORMATO A4
// ============================================================

import { OPCabecalhoPDF, OPRodapePDF, OPAssinaturasPDF } from './OPCabecalhoPDF';

interface OPFolhaEncapsulamentoProps {
  op: any;
}

export function OPFolhaEncapsulamento({ op }: OPFolhaEncapsulamentoProps) {
  const pesoCapsula = op.peso_capsula_mg || 500;
  const tipoCapsula = op.tipo_capsula || '00';
  const totalCapsulas = op.total_capsulas_com_acrescimo || 0;
  const totalFrascos = op.quantidade_frascos || 0;
  const capsPorFrasco = op.capsulas_por_frasco || 60;

  return (
    <div id="section-encapsulamento" className="bg-white p-6 text-sm print:p-0">
      <OPCabecalhoPDF 
        op={op} 
        tituloSecao="FOLHA DE ENCAPSULAMENTO"
        subtitulo="Fase 4 - Encapsulamento Semi-Automático"
      />

      {/* ESPECIFICAÇÕES */}
      <div className="section">
        <div className="section-title">
          ESPECIFICAÇÕES DE ENCAPSULAMENTO
        </div>
        <div className="op-info-grid">
          <div className="op-info-box">
            <label>Tipo de Cápsula</label>
            <div className="value">Tamanho {tipoCapsula}</div>
          </div>
          <div className="op-info-box">
            <label>Peso Nominal</label>
            <div className="value">{pesoCapsula} mg</div>
          </div>
          <div className="op-info-box">
            <label>Peso Alvo</label>
            <div className="value">{pesoCapsula - 10} - {pesoCapsula + 10} mg</div>
          </div>
          <div className="op-info-box">
            <label>Total a Produzir</label>
            <div className="value">{totalCapsulas.toLocaleString()} cápsulas</div>
          </div>
        </div>
      </div>

      {/* SETUP DA ENCAPSULADORA */}
      <div className="section">
        <div className="section-title">
          SETUP DA ENCAPSULADORA
        </div>
        <table>
          <thead>
            <tr>
              <th style={{ width: '40%' }}>Item de Verificação</th>
              <th style={{ width: '25%' }}>Parâmetro</th>
              <th style={{ width: '15%' }}>Verificado</th>
              <th style={{ width: '20%' }}>Responsável</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Limpeza do equipamento</td>
              <td>Visualmente limpo</td>
              <td className="text-center">☐ OK</td>
              <td><span className="campo-vazio" style={{ width: '100%', display: 'block' }}>&nbsp;</span></td>
            </tr>
            <tr>
              <td>Troca de placas (se aplicável)</td>
              <td>Tamanho {tipoCapsula}</td>
              <td className="text-center">☐ OK</td>
              <td><span className="campo-vazio" style={{ width: '100%', display: 'block' }}>&nbsp;</span></td>
            </tr>
            <tr>
              <td>Ajuste de dosagem</td>
              <td>{pesoCapsula} mg ± 5%</td>
              <td className="text-center">☐ OK</td>
              <td><span className="campo-vazio" style={{ width: '100%', display: 'block' }}>&nbsp;</span></td>
            </tr>
            <tr>
              <td>Teste de peso (10 cápsulas)</td>
              <td>Dentro da tolerância</td>
              <td className="text-center">☐ OK</td>
              <td><span className="campo-vazio" style={{ width: '100%', display: 'block' }}>&nbsp;</span></td>
            </tr>
            <tr>
              <td>Fechamento das cápsulas</td>
              <td>Sem vazamento de pó</td>
              <td className="text-center">☐ OK</td>
              <td><span className="campo-vazio" style={{ width: '100%', display: 'block' }}>&nbsp;</span></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* CONTROLE DE PESO */}
      <div className="section">
        <div className="section-title">
          CONTROLE DE PESO DURANTE PRODUÇÃO
          <span className="section-subtitle"> - Verificar a cada 30 minutos ou 1.000 cápsulas</span>
        </div>
        <table>
          <thead>
            <tr>
              <th style={{ width: '8%' }}>Hora</th>
              <th style={{ width: '10%' }}>Cáps. 1</th>
              <th style={{ width: '10%' }}>Cáps. 2</th>
              <th style={{ width: '10%' }}>Cáps. 3</th>
              <th style={{ width: '10%' }}>Cáps. 4</th>
              <th style={{ width: '10%' }}>Cáps. 5</th>
              <th style={{ width: '10%' }}>Média (mg)</th>
              <th style={{ width: '10%' }}>Desvio</th>
              <th style={{ width: '10%' }}>Conforme</th>
              <th style={{ width: '12%' }}>Operador</th>
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((linha) => (
              <tr key={linha}>
                <td><span className="campo-vazio" style={{ width: '100%', display: 'block' }}>&nbsp;</span></td>
                <td><span className="campo-vazio" style={{ width: '100%', display: 'block' }}>&nbsp;</span></td>
                <td><span className="campo-vazio" style={{ width: '100%', display: 'block' }}>&nbsp;</span></td>
                <td><span className="campo-vazio" style={{ width: '100%', display: 'block' }}>&nbsp;</span></td>
                <td><span className="campo-vazio" style={{ width: '100%', display: 'block' }}>&nbsp;</span></td>
                <td><span className="campo-vazio" style={{ width: '100%', display: 'block' }}>&nbsp;</span></td>
                <td><span className="campo-vazio" style={{ width: '100%', display: 'block' }}>&nbsp;</span></td>
                <td><span className="campo-vazio" style={{ width: '100%', display: 'block' }}>&nbsp;</span></td>
                <td className="text-center">☐</td>
                <td><span className="campo-vazio" style={{ width: '100%', display: 'block' }}>&nbsp;</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: '6px', fontSize: '8px', color: '#666' }}>
          Peso alvo: <strong>{pesoCapsula} mg</strong> | Tolerância: <strong>±5% ({pesoCapsula * 0.95} - {pesoCapsula * 1.05} mg)</strong>
        </div>
      </div>

      {/* REGISTRO DE PRODUÇÃO */}
      <div className="section">
        <div className="section-title">
          REGISTRO DE PRODUÇÃO
        </div>
        <div className="grid-2">
          <table>
            <tbody>
              <tr>
                <td style={{ width: '50%' }}><strong>Hora de Início:</strong></td>
                <td><span className="campo-vazio campo-vazio-lg">&nbsp;</span></td>
              </tr>
              <tr>
                <td><strong>Hora de Término:</strong></td>
                <td><span className="campo-vazio campo-vazio-lg">&nbsp;</span></td>
              </tr>
              <tr>
                <td><strong>Tempo Total:</strong></td>
                <td><span className="campo-vazio campo-vazio-lg">&nbsp;</span></td>
              </tr>
            </tbody>
          </table>
          <table>
            <tbody>
              <tr>
                <td style={{ width: '50%' }}><strong>Cápsulas Produzidas:</strong></td>
                <td><span className="campo-vazio campo-vazio-lg">&nbsp;</span></td>
              </tr>
              <tr>
                <td><strong>Cápsulas Rejeitadas:</strong></td>
                <td><span className="campo-vazio campo-vazio-lg">&nbsp;</span></td>
              </tr>
              <tr>
                <td><strong>Cápsulas Aprovadas:</strong></td>
                <td><span className="campo-vazio campo-vazio-lg">&nbsp;</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* CÁLCULO DE RENDIMENTO */}
      <div className="section">
        <div className="section-title">
          CÁLCULO DE RENDIMENTO
        </div>
        <table>
          <tbody>
            <tr>
              <td style={{ width: '40%' }}><strong>Quantidade Planejada:</strong></td>
              <td>{totalCapsulas.toLocaleString()} cápsulas (com 5% de acréscimo)</td>
            </tr>
            <tr>
              <td><strong>Quantidade Produzida:</strong></td>
              <td><span className="campo-vazio campo-vazio-lg">&nbsp;</span> cápsulas</td>
            </tr>
            <tr>
              <td><strong>Quantidade Aprovada:</strong></td>
              <td><span className="campo-vazio campo-vazio-lg">&nbsp;</span> cápsulas</td>
            </tr>
            <tr>
              <td><strong>Perda Total:</strong></td>
              <td><span className="campo-vazio campo-vazio-lg">&nbsp;</span> cápsulas (<span className="campo-vazio">&nbsp;</span>%)</td>
            </tr>
            <tr className="row-excipiente">
              <td><strong>Rendimento:</strong></td>
              <td><span className="campo-vazio campo-vazio-lg">&nbsp;</span>%</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* OBSERVAÇÕES */}
      <div className="section">
        <div className="section-title">
          OBSERVAÇÕES / OCORRÊNCIAS
        </div>
        <div style={{ border: '1px solid #ddd', minHeight: '60px', padding: '8px' }}>
          &nbsp;
        </div>
      </div>

      {/* Assinaturas */}
      <OPAssinaturasPDF
        assinaturas={[
          { cargo: 'Operador de Encapsulamento', subtitulo: 'Nome / Data / Hora' },
          { cargo: 'Conferente', subtitulo: 'Nome / Data / Hora' },
          { cargo: 'Responsável Técnico', subtitulo: 'Liberação' },
        ]}
      />

      <OPRodapePDF op={op} />
    </div>
  );
}
