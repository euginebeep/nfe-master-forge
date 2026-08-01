import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Undo2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  gerarDevolucaoDeNotaEntrada,
  traduzirErroRpcFiscal,
} from "@/lib/fiscal-rpc";

type Destinacao = "INDUSTRIALIZACAO" | "COMERCIALIZACAO" | "USO_CONSUMO" | "ATIVO";

interface ItemLinha {
  id: string;
  descricao: string;
  quantidadeMax: number;
  quantidade: number;
  selecionado: boolean;
  unidade: string;
}

interface GerarDevolucaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notaEntradaId: string | null;
  notaNumero?: string | null;
}

export function GerarDevolucaoDialog({
  open,
  onOpenChange,
  notaEntradaId,
  notaNumero,
}: GerarDevolucaoDialogProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [destinacao, setDestinacao] = useState<Destinacao>("INDUSTRIALIZACAO");
  const [itens, setItens] = useState<ItemLinha[]>([]);

  useEffect(() => {
    if (!open || !notaEntradaId) return;
    setMotivo("");
    setDestinacao("INDUSTRIALIZACAO");
    setLoading(true);
    (async () => {
      try {
        const { data, error } = await supabase
          .from("notas_entrada_itens")
          .select("id, descricao, qcom, ucom")
          .eq("nota_entrada_id", notaEntradaId)
          .order("numero_item", { ascending: true });
        if (error) throw error;
        setItens(
          (data || []).map((i) => ({
            id: i.id,
            descricao: i.descricao || "Item",
            quantidadeMax: Number(i.qcom || 0),
            quantidade: Number(i.qcom || 0),
            selecionado: true,
            unidade: i.ucom || "UN",
          }))
        );
      } catch (e) {
        toast.error(traduzirErroRpcFiscal(e));
        onOpenChange(false);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, notaEntradaId, onOpenChange]);

  const selecionados = useMemo(() => itens.filter((i) => i.selecionado), [itens]);
  const todosSelecionados =
    itens.length > 0 && selecionados.length === itens.length &&
    selecionados.every((i) => i.quantidade === i.quantidadeMax);

  const confirmar = async () => {
    if (!notaEntradaId) return;
    if (!motivo.trim()) {
      toast.error("Informe o motivo da devolução.");
      return;
    }
    if (selecionados.length === 0) {
      toast.error("Selecione ao menos um item.");
      return;
    }
    for (const i of selecionados) {
      if (i.quantidade <= 0) {
        toast.error(`Quantidade inválida em: ${i.descricao}`);
        return;
      }
      if (i.quantidade > i.quantidadeMax) {
        toast.error(`Quantidade maior que a original em: ${i.descricao}`);
        return;
      }
    }

    setSaving(true);
    try {
      const pItens = todosSelecionados
        ? null
        : selecionados.map((i) => ({
            nota_entrada_item_id: i.id,
            quantidade: i.quantidade,
          }));

      const notaId = await gerarDevolucaoDeNotaEntrada({
        notaEntradaId,
        motivo: motivo.trim(),
        itens: pItens,
        destinacao,
      });

      toast.success("Rascunho de devolução criado");
      onOpenChange(false);
      navigate(`/vendas/notas-saida?destaque=${notaId}`);
    } catch (e) {
      toast.error(traduzirErroRpcFiscal(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Undo2 className="h-5 w-5" />
            Gerar devolução
          </DialogTitle>
          <DialogDescription>
            {notaNumero
              ? `Espelha impostos e rastreabilidade da NF-e de entrada nº ${notaNumero}.`
              : "Espelha impostos e rastreabilidade da NF-e de entrada."}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="dev-motivo">Motivo *</Label>
              <Textarea
                id="dev-motivo"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Descreva o motivo da devolução"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Destinação</Label>
              <Select value={destinacao} onValueChange={(v) => setDestinacao(v as Destinacao)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INDUSTRIALIZACAO">Industrialização</SelectItem>
                  <SelectItem value="COMERCIALIZACAO">Comercialização</SelectItem>
                  <SelectItem value="USO_CONSUMO">Uso e consumo</SelectItem>
                  <SelectItem value="ATIVO">Ativo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Itens</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setItens((prev) => {
                      const allOn = prev.every((i) => i.selecionado);
                      return prev.map((i) => ({ ...i, selecionado: !allOn }));
                    })
                  }
                >
                  {itens.every((i) => i.selecionado) ? "Desmarcar todos" : "Selecionar todos"}
                </Button>
              </div>
              <div className="border rounded-md divide-y max-h-64 overflow-y-auto">
                {itens.map((item, idx) => (
                  <div key={item.id} className="flex items-start gap-3 p-3">
                    <Checkbox
                      checked={item.selecionado}
                      onCheckedChange={(checked) =>
                        setItens((prev) =>
                          prev.map((p, i) =>
                            i === idx ? { ...p, selecionado: !!checked } : p
                          )
                        )
                      }
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="text-sm font-medium truncate">{item.descricao}</p>
                      <p className="text-xs text-muted-foreground">
                        Máx. {item.quantidadeMax} {item.unidade}
                      </p>
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground">Qtd</Label>
                        <Input
                          type="number"
                          min={0}
                          max={item.quantidadeMax}
                          step="any"
                          className="h-8 w-28"
                          disabled={!item.selecionado}
                          value={item.quantidade}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            setItens((prev) =>
                              prev.map((p, i) =>
                                i === idx
                                  ? {
                                      ...p,
                                      quantidade: Number.isFinite(v)
                                        ? Math.min(v, p.quantidadeMax)
                                        : 0,
                                    }
                                  : p
                              )
                            );
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
                {itens.length === 0 && (
                  <p className="p-4 text-sm text-muted-foreground">Nenhum item nesta nota.</p>
                )}
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={confirmar} disabled={saving || loading || !motivo.trim()}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Gerar rascunho
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
