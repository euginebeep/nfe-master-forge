import { useParams } from 'react-router-dom';
import { OPImpressaoTemplate } from '@/components/producao/OPImpressaoTemplate';

/**
 * Página de impressão da OP
 * Rota: /producao/ordens/:id/imprimir
 * 
 * Renderiza o template de 7 páginas A4 e chama window.print() automaticamente
 */
export function OrdemProducaoImpressaoPage() {
  const { id } = useParams<{ id: string }>();
  
  if (!id) {
    return <div>Erro: ID da OP não encontrado</div>;
  }
  
  return (
    <div style={{ width: '100%', backgroundColor: '#f5f5f5', padding: '10px' }}>
      <OPImpressaoTemplate opId={id} autoprint={true} />
    </div>
  );
}
