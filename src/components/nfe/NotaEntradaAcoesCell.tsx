import { useState } from 'react';
import { Eye, Undo2, Tag, FileOutput } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { AnexarXmlButton } from '@/components/nfe/AnexarXmlButton';
import { DeleteNotaDialog } from '@/components/nfe/DeleteNotaDialog';
import { DevolucaoDialog } from '@/components/nfe/DevolucaoDialog';
import type { NotaEntrada } from '@/hooks/use-notas-entrada';
import { toast } from 'sonner';

interface NotaEntradaAcoesCellProps {
  item: NotaEntrada;
  processandoId: string | null;
  revertendoId: string | null;
  imprimindoEtiquetas?: boolean;
  onView: (nota: NotaEntrada) => void;
  onProcessar: (nota: NotaEntrada) => void;
  onReverter: (nota: NotaEntrada) => void;
  onImprimirEtiquetas?: (nota: NotaEntrada) => void;
  onRefresh: () => void;
}

/** Célula de ações da tabela de notas de entrada. */
export function NotaEntradaAcoesCell({
  item,
  processandoId,
  revertendoId,
  imprimindoEtiquetas = false,
  onView,
  onProcessar,
  onReverter,
  onImprimirEtiquetas,
  onRefresh,
}: NotaEntradaAcoesCellProps) {
  const navigate = useNavigate();
  const [devolucaoOpen, setDevolucaoOpen] = useState(false);

  return (
    <div className="flex gap-1">
      <Button
        variant="ghost"
        size="icon"
        onClick={(e) => { e.stopPropagation(); onView(item); }}
        title="Visualizar NF-e"
      >
        <Eye className="h-4 w-4" />
      </Button>
      {onImprimirEtiquetas && (
        <Button
          variant="ghost"
          size="icon"
          title="Imprimir etiquetas dos lotes desta NF"
          disabled={imprimindoEtiquetas}
          onClick={(e) => {
            e.stopPropagation();
            onImprimirEtiquetas(item);
          }}
        >
          <Tag className="h-4 w-4" />
        </Button>
      )}
      {item.status === 'IMPORTADA' && (
        <Button
          variant="default"
          size="sm"
          onClick={(e) => { e.stopPropagation(); onProcessar(item); }}
          disabled={processandoId === item.id || (item.qtd_itens_vinculados || 0) < (item.qtd_itens || 0)}
          title={item.qtd_itens_vinculados < (item.qtd_itens || 0) ? 'Vincule todos os itens primeiro' : 'Processar nota'}
          className="text-xs"
        >
          {processandoId === item.id ? 'Processando...' : 'Processar'}
        </Button>
      )}
      {item.status !== 'CANCELADA' && (
        <>
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            title="Gerar nota de devolução"
            onClick={(e) => {
              e.stopPropagation();
              setDevolucaoOpen(true);
            }}
          >
            <FileOutput className="h-4 w-4" />
            Gerar devolução
          </Button>
          <div onClick={(e) => e.stopPropagation()}>
            <DevolucaoDialog
              notaEntradaId={item.id}
              open={devolucaoOpen}
              onOpenChange={setDevolucaoOpen}
              notaEntradaLabel={`NF-e ${item.numero}/${item.serie}${item.fornecedor_nome_fantasia || item.fornecedor_razao ? ` — ${item.fornecedor_nome_fantasia || item.fornecedor_razao}` : ''}`}
              onConcluido={(notaSaidaId) => {
                toast.success('Devolução gerada como rascunho');
                onRefresh();
                navigate(`/vendas/notas-saida?nota=${encodeURIComponent(notaSaidaId)}`);
              }}
            />
          </div>
        </>
      )}
      <Button
        variant="ghost"
        size="icon"
        onClick={(e) => { e.stopPropagation(); onReverter(item); }}
        disabled={revertendoId === item.id}
        title="Reverter importação"
        className="text-destructive hover:text-destructive"
      >
        <Undo2 className="h-4 w-4" />
      </Button>
      {!item.xml_raw && (
        <div onClick={(e) => e.stopPropagation()}>
          <AnexarXmlButton notaId={item.id} chaveNfe={item.chave_nfe} onDone={onRefresh} />
        </div>
      )}
      <div onClick={(e) => e.stopPropagation()}>
        <DeleteNotaDialog
          notaId={item.id}
          notaNumero={item.numero}
          notaSerie={item.serie}
          fornecedorNome={item.fornecedor_nome_fantasia || item.fornecedor_razao || 'Desconhecido'}
          totalItens={item.qtd_itens || 0}
          onDeleted={onRefresh}
        />
      </div>
    </div>
  );
}
