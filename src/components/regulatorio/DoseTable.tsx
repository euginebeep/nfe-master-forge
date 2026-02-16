import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { AnvisaConstituinte } from '@/types/anvisa';

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

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Grupo</TableHead>
          <TableHead>Mínimo</TableHead>
          <TableHead>Máximo</TableHead>
          <TableHead>Unidade</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {grupos.map(g => (
          <TableRow key={g.label}>
            <TableCell className="font-medium">{g.label}</TableCell>
            <TableCell>{g.data?.min ?? '—'}</TableCell>
            <TableCell>{g.data?.max ?? '—'}</TableCell>
            <TableCell>{g.data?.unidade ?? '—'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
