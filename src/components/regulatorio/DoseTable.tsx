import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { AnvisaConstituinte } from '@/types/anvisa';

// Conversões conhecidas: 1 mcg = X UI (ou 1 mg = X UI)
const CONVERSOES_UI: Record<string, { fator: number; unidadeOrigem: string }> = {
  'colecalciferol': { fator: 40, unidadeOrigem: 'mcg' },       // 1 mcg = 40 UI
  'ergocalciferol': { fator: 40, unidadeOrigem: 'mcg' },       // 1 mcg = 40 UI
  'vitamina d': { fator: 40, unidadeOrigem: 'mcg' },
  'retinol': { fator: 3.33, unidadeOrigem: 'mcg' },            // 1 mcg RAE = 3.33 UI
  'vitamina a': { fator: 3.33, unidadeOrigem: 'mcg' },
  'betacaroteno': { fator: 1.67, unidadeOrigem: 'mcg' },
  'tocoferol': { fator: 1.49, unidadeOrigem: 'mg' },           // 1 mg = 1.49 UI
  'vitamina e': { fator: 1.49, unidadeOrigem: 'mg' },
};

function getConversaoUI(nomeTecnico: string, nomeGenerico: string | null): { fator: number; unidadeOrigem: string } | null {
  const nomes = [nomeTecnico, nomeGenerico || ''].map(n => n.toLowerCase());
  for (const nome of nomes) {
    for (const [key, conv] of Object.entries(CONVERSOES_UI)) {
      if (nome.includes(key)) return conv;
    }
  }
  return null;
}

function formatUI(valor: number | string, fator: number, unidadeOrigem: string, unidadeDose: string): string | null {
  if (typeof valor !== 'number' || valor === 0) return null;
  if (unidadeDose.toLowerCase() !== unidadeOrigem) return null;
  const ui = Math.round(valor * fator);
  return `${ui} UI`;
}

export function DoseTable({ constituinte }: { constituinte: AnvisaConstituinte }) {
  const grupos = [
    { label: '0–6 meses', data: constituinte.limites_0_6_meses },
    { label: '7–11 meses', data: constituinte.limites_7_11_meses },
    { label: '1–3 anos', data: constituinte.limites_1_3_anos },
    { label: '4–8 anos', data: constituinte.limites_4_8_anos },
    { label: '9–18 anos', data: constituinte.limites_9_18_anos },
    { label: '≥19 anos', data: constituinte.limites_19_mais },
    { label: 'Gestantes', data: constituinte.limites_gestantes },
    { label: 'Lactantes', data: constituinte.limites_lactantes },
  ].filter(g => g.data);

  if (grupos.length === 0) return <p className="text-sm text-muted-foreground">Limites não estabelecidos</p>;

  const conversao = getConversaoUI(constituinte.nome_tecnico, constituinte.nome_generico);
  const mostrarUI = conversao && grupos.some(g => 
    g.data?.unidade?.toLowerCase() === conversao.unidadeOrigem
  );

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Grupo</TableHead>
          <TableHead>Mínimo</TableHead>
          <TableHead>Máximo</TableHead>
          <TableHead>Unidade</TableHead>
          {mostrarUI && <TableHead>Equiv. UI</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {grupos.map(g => {
          const minUI = conversao ? formatUI(g.data?.min as number, conversao.fator, conversao.unidadeOrigem, g.data?.unidade || '') : null;
          const maxUI = conversao ? formatUI(g.data?.max as number, conversao.fator, conversao.unidadeOrigem, g.data?.unidade || '') : null;
          return (
            <TableRow key={g.label}>
              <TableCell className="font-medium">{g.label}</TableCell>
              <TableCell>{g.data?.min ?? '—'}</TableCell>
              <TableCell>{g.data?.max ?? '—'}</TableCell>
              <TableCell>{g.data?.unidade ?? '—'}</TableCell>
              {mostrarUI && (
                <TableCell className="text-muted-foreground">
                  {minUI && maxUI ? `${minUI} – ${maxUI}` : minUI || maxUI || '—'}
                </TableCell>
              )}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

// Exportar para reutilizar no ConsultaANVISACard
export { getConversaoUI, formatUI };
