import {
  Eye, Undo2, FileText, MoreHorizontal, Play, Loader2,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AnexarXmlButton } from '@/components/nfe/AnexarXmlButton';
import { DeleteNotaDialog } from '@/components/nfe/DeleteNotaDialog';
import type { NotaEntrada } from '@/hooks/use-notas-entrada';

interface NotaEntradaAcoesCellProps {
  item: NotaEntrada;
  processandoId: string | null;
  revertendoId: string | null;
  onView: (nota: NotaEntrada) => void;
  onProcessar: (nota: NotaEntrada) => void;
  onReverter: (nota: NotaEntrada) => void;
  onImportarCoa: (nota: NotaEntrada) => void;
  onRefresh: () => void;
}

function AcaoTooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

/** Célula de ações compacta — sem hooks (estado fica no NotasEntradaPage) */
export function NotaEntradaAcoesCell({
  item,
  processandoId,
  revertendoId,
  onView,
  onProcessar,
  onReverter,
  onImportarCoa,
  onRefresh,
}: NotaEntradaAcoesCellProps) {
  const processando = processandoId === item.id;
  const podeProcessar = (item.qtd_itens_vinculados || 0) >= (item.qtd_itens || 0);

  return (
    <div className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
      <AcaoTooltip label="Visualizar NF-e">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => onView(item)}
        >
          <Eye className="h-4 w-4" />
        </Button>
      </AcaoTooltip>

      {item.status === 'IMPORTADA' && (
        <AcaoTooltip label={podeProcessar ? 'Processar nota' : 'Vincule todos os itens primeiro'}>
          <Button
            variant="default"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => onProcessar(item)}
            disabled={processando || !podeProcessar}
          >
            {processando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>
        </AcaoTooltip>
      )}

      <AcaoTooltip label="Importar COA da nota">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-blue-600 hover:text-blue-700"
          onClick={() => onImportarCoa(item)}
        >
          <FileText className="h-4 w-4" />
        </Button>
      </AcaoTooltip>

      <DropdownMenu>
        <AcaoTooltip label="Mais ações">
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
        </AcaoTooltip>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem
            onClick={() => onReverter(item)}
            disabled={revertendoId === item.id}
            className="gap-2 text-destructive focus:text-destructive"
          >
            <Undo2 className="h-4 w-4" />
            Reverter importação
          </DropdownMenuItem>
          {!item.xml_raw && (
            <DropdownMenuItem
              onSelect={(e) => e.preventDefault()}
              className="gap-2 p-0 focus:bg-transparent"
            >
              <AnexarXmlButton
                notaId={item.id}
                chaveNfe={item.chave_nfe}
                onDone={onRefresh}
                variant="menu"
              />
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(e) => e.preventDefault()}
            className="p-0 focus:bg-transparent"
          >
            <DeleteNotaDialog
              notaId={item.id}
              notaNumero={item.numero}
              notaSerie={item.serie}
              fornecedorNome={item.fornecedor_nome_fantasia || item.fornecedor_razao || 'Desconhecido'}
              totalItens={item.qtd_itens || 0}
              onDeleted={onRefresh}
              variant="menu"
            />
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
