import { useEffect, useState } from 'react';
import { Link2, Loader2, Unlink } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  useDesvincularNotaPedido,
  useMarcarNotaAvulsa,
  usePedidosParaVinculo,
  useVincularNotaPedido,
} from '@/hooks/use-nota-pedido-vinculo';
import type { NotaEntrada } from '@/hooks/use-notas-entrada';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { toast } from 'sonner';

interface VincularNotaPedidoDialogProps {
  nota: NotaEntrada | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VincularNotaPedidoDialog({
  nota,
  open,
  onOpenChange,
}: VincularNotaPedidoDialogProps) {
  const [pedidoSelecionado, setPedidoSelecionado] = useState<string>('');
  const [motivoAvulsa, setMotivoAvulsa] = useState('');
  const [modoAvulsa, setModoAvulsa] = useState(false);

  const fornecedorId = nota?.fornecedor_id ?? null;
  const { data: pedidos = [], isLoading } = usePedidosParaVinculo(fornecedorId, open && !nota?.nota_avulsa);
  const vincular = useVincularNotaPedido();
  const desvincular = useDesvincularNotaPedido();
  const marcarAvulsa = useMarcarNotaAvulsa();

  const vinculada = !!nota?.pedido_id;
  const avulsa = !!nota?.nota_avulsa;
  const busy = vincular.isPending || desvincular.isPending || marcarAvulsa.isPending;

  useEffect(() => {
    if (!open) {
      setPedidoSelecionado('');
      setMotivoAvulsa('');
      setModoAvulsa(false);
      return;
    }
    if (nota?.pedido_id) {
      setPedidoSelecionado(nota.pedido_id);
    }
  }, [open, nota?.pedido_id]);

  const handleVincular = async () => {
    if (!nota || !pedidoSelecionado) return;
    const result = await vincular.mutateAsync({
      notaId: nota.id,
      pedidoId: pedidoSelecionado,
    });
    toast.success(
      `${result.itens_casados} itens casados, ${result.itens_sem_par_no_pedido} itens da nota sem correspondência no pedido`,
    );
    onOpenChange(false);
  };

  const handleDesvincular = async () => {
    if (!nota) return;
    await desvincular.mutateAsync(nota.id);
    toast.success('Nota desvinculada do pedido');
    onOpenChange(false);
  };

  const handleMarcarAvulsa = async () => {
    if (!nota) return;
    const motivo = motivoAvulsa.trim();
    if (!motivo) {
      toast.error('Informe o motivo para nota avulsa');
      return;
    }
    await marcarAvulsa.mutateAsync({ notaId: nota.id, motivo });
    toast.success('Nota marcada como avulsa');
    onOpenChange(false);
  };

  if (!nota) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Vincular ao pedido
          </DialogTitle>
          <DialogDescription>
            NF-e {nota.numero} · {nota.fornecedor_razao || nota.fornecedor_nome_fantasia || 'Fornecedor'}
          </DialogDescription>
        </DialogHeader>

        {vinculada && (
          <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm space-y-2">
            <p>
              Vinculada ao pedido{' '}
              <span className="font-semibold">{nota.pedido_numero || nota.pedido_id}</span>
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-amber-700 border-amber-300 hover:bg-amber-50"
              disabled={busy}
              onClick={handleDesvincular}
            >
              {desvincular.isPending ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Unlink className="h-3.5 w-3.5 mr-1.5" />
              )}
              Desvincular
            </Button>
          </div>
        )}

        {avulsa && (
          <div className="rounded-md border p-3 text-sm text-muted-foreground">
            Esta nota está marcada como avulsa.
            {nota.motivo_sem_pedido && (
              <p className="mt-1 text-foreground">
                <span className="font-medium">Motivo:</span> {nota.motivo_sem_pedido}
              </p>
            )}
          </div>
        )}

        {!vinculada && !avulsa && (
          <div className="space-y-4">
            {!fornecedorId ? (
              <p className="text-sm text-amber-700">
                Nota sem fornecedor identificado — não é possível listar pedidos compatíveis.
              </p>
            ) : isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando pedidos do fornecedor…
              </div>
            ) : pedidos.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum pedido EMITIDO ou RECEBIDO_PARCIAL para este fornecedor.
              </p>
            ) : (
              <div className="space-y-2">
                <Label>Pedidos disponíveis</Label>
                <RadioGroup value={pedidoSelecionado} onValueChange={setPedidoSelecionado}>
                  {pedidos.map((pedido) => (
                    <label
                      key={pedido.id}
                      className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/40"
                    >
                      <RadioGroupItem value={pedido.id} className="mt-0.5" />
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{pedido.numero_interno}</span>
                          <Badge variant="outline" className="text-[10px]">
                            {pedido.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(pedido.emitido_em)} · {formatCurrency(pedido.valor_total)}
                        </p>
                      </div>
                    </label>
                  ))}
                </RadioGroup>
              </div>
            )}

            <div className="border-t pt-4 space-y-3">
              {!modoAvulsa ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() => setModoAvulsa(true)}
                >
                  Esta nota não tem pedido (amostra/teste)
                </Button>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="motivo-avulsa">Motivo (obrigatório)</Label>
                  <Textarea
                    id="motivo-avulsa"
                    value={motivoAvulsa}
                    onChange={(e) => setMotivoAvulsa(e.target.value)}
                    placeholder="Ex.: amostra grátis do fornecedor, nota de teste…"
                    rows={3}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Fechar
          </Button>
          {!vinculada && !avulsa && modoAvulsa && (
            <Button type="button" variant="secondary" onClick={handleMarcarAvulsa} disabled={busy}>
              {marcarAvulsa.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Marcar como avulsa
            </Button>
          )}
          {!vinculada && !avulsa && !modoAvulsa && (
            <Button
              type="button"
              onClick={handleVincular}
              disabled={busy || !pedidoSelecionado || !fornecedorId}
            >
              {vincular.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Vincular
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
