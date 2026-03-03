import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useEstoqueMovimentacoes } from "@/hooks/use-estoque-movimentacoes";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NovaMovimentacaoDialog({ open, onOpenChange }: Props) {
  const { createMovimentacao } = useEstoqueMovimentacoes();
  const [tipo, setTipo] = useState("ENTRADA");
  const [itemId, setItemId] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [unidade, setUnidade] = useState("g");
  const [motivo, setMotivo] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const { data: itens = [] } = useQuery({
    queryKey: ['itens-select-mov'],
    queryFn: async () => {
      const { data } = await supabase
        .from('itens')
        .select('id, descricao_interna, sku_interno')
        .eq('ativo', true)
        .order('descricao_interna')
        .limit(500);
      return data || [];
    },
    enabled: open,
  });

  const handleSubmit = () => {
    if (!itemId || !quantidade || !motivo) return;
    createMovimentacao.mutate({
      tipo,
      item_id: itemId,
      quantidade: Number(quantidade),
      unidade,
      motivo,
      observacoes: observacoes || undefined,
      origem: 'MANUAL',
    }, {
      onSuccess: () => {
        onOpenChange(false);
        setTipo("ENTRADA");
        setItemId("");
        setQuantidade("");
        setMotivo("");
        setObservacoes("");
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Movimentação Manual</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ENTRADA">Entrada</SelectItem>
                <SelectItem value="SAIDA">Saída</SelectItem>
                <SelectItem value="AJUSTE">Ajuste</SelectItem>
                <SelectItem value="TRANSFERENCIA">Transferência</SelectItem>
                <SelectItem value="DEVOLUCAO">Devolução</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Item *</Label>
            <Select value={itemId} onValueChange={setItemId}>
              <SelectTrigger><SelectValue placeholder="Selecione o item" /></SelectTrigger>
              <SelectContent>
                {itens.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.sku_interno ? `${item.sku_interno} - ` : ''}{item.descricao_interna}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Quantidade *</Label>
              <Input type="number" value={quantidade} onChange={e => setQuantidade(e.target.value)} placeholder="0" min="0" step="0.01" />
            </div>
            <div>
              <Label>Unidade</Label>
              <Select value={unidade} onValueChange={setUnidade}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="g">g</SelectItem>
                  <SelectItem value="kg">kg</SelectItem>
                  <SelectItem value="mg">mg</SelectItem>
                  <SelectItem value="ml">ml</SelectItem>
                  <SelectItem value="L">L</SelectItem>
                  <SelectItem value="UN">UN</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Motivo *</Label>
            <Input value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ex: Ajuste de inventário" />
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Notas adicionais..." rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!itemId || !quantidade || !motivo || createMovimentacao.isPending}>
            {createMovimentacao.isPending ? 'Registrando...' : 'Registrar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
