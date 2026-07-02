import { OPImpressaoTemplate } from '@/components/producao/OPImpressaoTemplate';

/**
 * Página de impressão da OP
 * Rota: /producao/ordens/:id/imprimir
 * 
 * Renderiza o template de 7 páginas A4 e chama window.print() automaticamente
 */
export function OrdemProducaoImpressaoPage() {
  return (
    <div style={{ width: '100%', backgroundColor: '#f5f5f5', padding: '10px' }}>
      <OPImpressaoTemplate autoprint={true} />
    </div>
  );
}
