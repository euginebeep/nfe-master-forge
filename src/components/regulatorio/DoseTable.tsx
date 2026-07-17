import { Loader2, Pill } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  montarGruposLimites,
  useAnvisaLimitesGrupos,
} from '@/hooks/useAnvisaLimitesGrupos';
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

function formatLimite(valor: number | null): string {
  return valor != null ? String(valor) : '—';
}

export function DoseTable({
  constituinte,
  compact = false,
}: {
  constituinte: AnvisaConstituinte;
  compact?: boolean;
}) {
  const { data: limitesRpc, isLoading, isError } = useAnvisaLimitesGrupos(constituinte.id);
  const grupos = montarGruposLimites(constituinte, limitesRpc);

  if (grupos.length === 0) {
    if (compact) return null;
    return (
      <p className="text-sm text-muted-foreground">
        Limites não estabelecidos
      </p>
    );
  }

  if (isLoading) {
    return (
      <div className={`flex items-center gap-2 text-muted-foreground ${compact ? 'text-xs' : 'text-sm'}`}>
        <Loader2 className={`animate-spin ${compact ? 'w-3 h-3' : 'w-4 h-4'}`} />
        Carregando limites…
      </div>
    );
  }

  if (isError) {
    return (
      <p className={`text-destructive ${compact ? 'text-xs' : 'text-sm'}`}>
        Não foi possível carregar os limites parseados.
      </p>
    );
  }

  const conversao = getConversaoUI(constituinte.nome_tecnico, constituinte.nome_generico);
  const mostrarUI = conversao && grupos.some(g =>
    g.unidade?.toLowerCase() === conversao.unidadeOrigem
  );

  const headClass = compact ? 'text-xs py-1 h-auto' : undefined;
  const cellClass = compact ? 'text-xs py-1' : undefined;

  const table = (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className={headClass}>{compact ? 'Faixa etária' : 'Grupo'}</TableHead>
          <TableHead className={headClass}>{compact ? 'Mín.' : 'Mínimo'}</TableHead>
          <TableHead className={headClass}>{compact ? 'Máx.' : 'Máximo'}</TableHead>
          <TableHead className={headClass}>{compact ? 'Un.' : 'Unidade'}</TableHead>
          {mostrarUI && <TableHead className={headClass}>Equiv. UI</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {grupos.map(g => {
          const minUI = conversao ? formatUI(g.min as number, conversao.fator, conversao.unidadeOrigem, g.unidade || '') : null;
          const maxUI = conversao ? formatUI(g.max as number, conversao.fator, conversao.unidadeOrigem, g.unidade || '') : null;
          return (
            <TableRow key={g.label}>
              <TableCell className={`font-medium ${cellClass ?? ''}`}>{g.label}</TableCell>
              <TableCell className={cellClass}>{formatLimite(g.min)}</TableCell>
              <TableCell className={cellClass}>{formatLimite(g.max)}</TableCell>
              <TableCell className={cellClass}>{g.unidade ?? '—'}</TableCell>
              {mostrarUI && (
                <TableCell className={`text-muted-foreground ${cellClass ?? ''}`}>
                  {minUI && maxUI ? `${minUI}${compact ? '–' : ' – '}${maxUI}` : minUI || maxUI || '—'}
                </TableCell>
              )}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );

  if (compact) {
    return (
      <div className="mt-2">
        <p className="text-xs font-medium mb-1 flex items-center gap-1">
          <Pill className="w-3 h-3" /> Doses diárias autorizadas:
        </p>
        {table}
      </div>
    );
  }

  return table;
}

// Exportar para reutilizar no ConsultaANVISACard
export { getConversaoUI, formatUI };
