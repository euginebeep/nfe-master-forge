import { useState } from 'react';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface DeleteNotaDialogProps {
  notaId: string;
  notaNumero: string;
  notaSerie: string;
  fornecedorNome: string;
  totalItens: number;
  onDeleted?: () => void;
  /** menu = item compacto no dropdown de ações */
  variant?: 'button' | 'menu';
}

export function DeleteNotaDialog({
  notaId,
  notaNumero,
  notaSerie,
  fornecedorNome,
  totalItens,
  onDeleted,
  variant = 'button',
}: DeleteNotaDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const handleDelete = async () => {
    setIsLoading(true);
    try {
      // Chamar RPC para excluir nota com cascata
      const { error } = await supabase.rpc('delete_nota_entrada_completa', {
        p_nota_id: notaId,
      });

      if (error) {
        toast.error(`Erro ao excluir: ${error.message}`);
        return;
      }

      toast.success(
        `NF-e ${notaNumero}/${notaSerie} excluída com sucesso!`
      );
      setOpen(false);
      onDeleted?.();
    } catch (err) {
      console.error('Erro ao excluir nota:', err);
      toast.error('Erro ao excluir a nota. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        {variant === 'menu' ? (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 h-8 px-2 font-normal text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
            Excluir nota
          </Button>
        ) : (
          <Button
            variant="destructive"
            size="sm"
            className="gap-2"
            title="Excluir nota"
          >
            <Trash2 className="h-4 w-4" />
            Excluir
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <AlertDialogTitle>Excluir Nota de Entrada?</AlertDialogTitle>
          </div>
        </AlertDialogHeader>
        <AlertDialogDescription className="space-y-3">
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
            <p className="font-semibold text-destructive">
              ⚠️ Esta ação é irreversível!
            </p>
          </div>

          <div className="space-y-2 text-sm">
            <p>
              <strong>NF-e:</strong> {notaNumero}/{notaSerie}
            </p>
            <p>
              <strong>Fornecedor:</strong> {fornecedorNome}
            </p>
            <p>
              <strong>Itens:</strong> {totalItens}
            </p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
            <p className="font-semibold text-amber-900">Será excluído:</p>
            <ul className="text-sm text-amber-800 space-y-1 ml-4 list-disc">
              <li>Nota de entrada e todos os itens</li>
              <li>Quantidades de estoque (reversão)</li>
              <li>Histórico de fator de conversão</li>
              <li>Movimentações de estoque relacionadas</li>
              <li>Documentos anexados</li>
            </ul>
          </div>

          <p className="text-xs text-muted-foreground italic">
            A exclusão será registrada na auditoria para conformidade.
          </p>
        </AlertDialogDescription>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isLoading}
            className="bg-destructive hover:bg-destructive/90"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Excluindo...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir Permanentemente
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
