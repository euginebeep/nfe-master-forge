import { useParams } from 'react-router-dom';
import { OPImpressaoTemplate } from '@/components/producao/OPImpressaoTemplate';

/**
 * Página dedicada para impressão da OP em tela cheia
 * Usa autoprint=true para abrir diálogo de impressão automaticamente
 */
export default function OrdemProducaoImpressaoPage() {
  const { id } = useParams<{ id: string }>();

  if (!id) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: 'red' }}>
        <p>Erro: ID da OP não fornecido</p>
      </div>
    );
  }

  return <OPImpressaoTemplate opId={id} autoprint={true} />;
}
