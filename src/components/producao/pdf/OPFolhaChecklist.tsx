// ============================================================
// FOLHA DE CHECKLIST OPERACIONAL - FORMATO A4
// ============================================================

import { OPCabecalhoPDF, OPRodapePDF, OPAssinaturasPDF } from './OPCabecalhoPDF';

interface OPFolhaChecklistProps {
  op: any;
  checklist?: any[];
}

export function OPFolhaChecklist({ op, checklist = [] }: OPFolhaChecklistProps) {
  // Agrupar checklist por categoria
  const checklistAgrupado: Record<string, any[]> = {};
  
  // Se não houver checklist, criar padrão
  const checklistFinal = checklist.length > 0 ? checklist : gerarChecklistPadrao();
  
  checklistFinal.forEach(item => {
    const cat = item.categoria || 'OUTROS';
    if (!checklistAgrupado[cat]) {
      checklistAgrupado[cat] = [];
    }
    checklistAgrupado[cat].push(item);
  });

  const categorias = [
    { key: 'PRE_PRODUCAO', nome: 'PRÉ-PRODUÇÃO', cor: '#e3f2fd' },
    { key: 'DURANTE_PRODUCAO', nome: 'DURANTE PRODUÇÃO', cor: '#fff3e0' },
    { key: 'POS_PRODUCAO', nome: 'PÓS-PRODUÇÃO', cor: '#e8f5e9' },
    { key: 'QC', nome: 'CONTROLE DE QUALIDADE', cor: '#f3e5f5' },
    { key: 'OUTROS', nome: 'OUTROS', cor: '#fafafa' },
  ];

  return (
    <div id="section-checklist" className="bg-white p-6 text-sm print:p-0">
      <OPCabecalhoPDF 
        op={op} 
        tituloSecao="CHECKLIST OPERACIONAL"
        subtitulo="Verificações Obrigatórias de Produção"
      />

      {/* INSTRUÇÕES */}
      <div style={{ background: '#fff3cd', border: '1px solid #ffc107', padding: '8px', marginBottom: '12px', fontSize: '9px' }}>
        <strong>INSTRUÇÕES:</strong> Marcar ☑ cada item após verificação. Itens marcados como OBRIGATÓRIO devem ser 100% concluídos para liberação do lote. 
        Qualquer não-conformidade deve ser registrada nas observações e comunicada ao Responsável Técnico.
      </div>

      {/* CHECKLISTS POR CATEGORIA */}
      {categorias.map(cat => {
        const itens = checklistAgrupado[cat.key] || [];
        if (itens.length === 0) return null;
        
        return (
          <div key={cat.key} className="section">
            <div className="section-title" style={{ background: cat.cor }}>
              {cat.nome}
            </div>
            <table>
              <thead>
                <tr>
                  <th style={{ width: '5%' }}>☑</th>
                  <th style={{ width: '45%' }}>Item de Verificação</th>
                  <th style={{ width: '10%' }}>Obrig.?</th>
                  <th style={{ width: '20%' }}>Responsável</th>
                  <th style={{ width: '10%' }}>Hora</th>
                  <th style={{ width: '10%' }}>Data</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((item, idx) => (
                  <tr key={item.id || idx}>
                    <td className="text-center" style={{ fontSize: '14px' }}>☐</td>
                    <td>{item.item || item.descricao}</td>
                    <td className="text-center">
                      {item.obrigatorio !== false ? (
                        <span style={{ color: '#dc3545', fontWeight: 600 }}>SIM</span>
                      ) : (
                        <span style={{ color: '#666' }}>Não</span>
                      )}
                    </td>
                    <td><span className="campo-vazio" style={{ width: '100%', display: 'block' }}>&nbsp;</span></td>
                    <td><span className="campo-vazio" style={{ width: '100%', display: 'block' }}>&nbsp;</span></td>
                    <td><span className="campo-vazio" style={{ width: '100%', display: 'block' }}>&nbsp;</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}

      {/* REGISTRO DE NÃO-CONFORMIDADES */}
      <div className="section">
        <div className="section-title" style={{ background: '#f8d7da' }}>
          REGISTRO DE NÃO-CONFORMIDADES (se houver)
        </div>
        <table>
          <thead>
            <tr>
              <th style={{ width: '5%' }}>#</th>
              <th style={{ width: '35%' }}>Descrição da Não-Conformidade</th>
              <th style={{ width: '25%' }}>Ação Corretiva</th>
              <th style={{ width: '15%' }}>Responsável</th>
              <th style={{ width: '10%' }}>Status</th>
              <th style={{ width: '10%' }}>Data</th>
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3].map(linha => (
              <tr key={linha}>
                <td className="text-center">{linha}</td>
                <td><span className="campo-vazio" style={{ width: '100%', display: 'block', minHeight: '20px' }}>&nbsp;</span></td>
                <td><span className="campo-vazio" style={{ width: '100%', display: 'block', minHeight: '20px' }}>&nbsp;</span></td>
                <td><span className="campo-vazio" style={{ width: '100%', display: 'block' }}>&nbsp;</span></td>
                <td className="text-center">☐ Resolvido</td>
                <td><span className="campo-vazio" style={{ width: '100%', display: 'block' }}>&nbsp;</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* OBSERVAÇÕES GERAIS */}
      <div className="section">
        <div className="section-title">
          OBSERVAÇÕES GERAIS
        </div>
        <div style={{ border: '1px solid #ddd', minHeight: '60px', padding: '8px' }}>
          &nbsp;
        </div>
      </div>

      {/* LIBERAÇÃO DO LOTE */}
      <div className="section">
        <div className="section-title" style={{ background: '#d4edda' }}>
          LIBERAÇÃO DO LOTE
        </div>
        <table>
          <tbody>
            <tr>
              <td style={{ width: '30%' }}><strong>Checklist 100% concluído?</strong></td>
              <td style={{ width: '20%' }}>☐ SIM &nbsp;&nbsp; ☐ NÃO</td>
              <td style={{ width: '30%' }}><strong>Lote liberado para expedição?</strong></td>
              <td style={{ width: '20%' }}>☐ SIM &nbsp;&nbsp; ☐ NÃO</td>
            </tr>
            <tr>
              <td><strong>Não-conformidades resolvidas?</strong></td>
              <td>☐ SIM &nbsp;&nbsp; ☐ NÃO &nbsp;&nbsp; ☐ N/A</td>
              <td><strong>Documentação completa?</strong></td>
              <td>☐ SIM &nbsp;&nbsp; ☐ NÃO</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Assinaturas */}
      <OPAssinaturasPDF
        assinaturas={[
          { cargo: 'Supervisor de Produção', subtitulo: 'Nome / Data / Hora' },
          { cargo: 'Controle de Qualidade', subtitulo: 'Nome / Data / Hora' },
          { cargo: 'Responsável Técnico', subtitulo: 'Liberação Final do Lote' },
        ]}
      />

      <OPRodapePDF op={op} />
    </div>
  );
}

// Função auxiliar para gerar checklist padrão
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
