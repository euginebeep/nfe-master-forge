import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2, FileOutput } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { criarNotaSaida, traduzirErroRpcFiscal } from "@/lib/fiscal-rpc";

export interface OperacaoFiscalSaida {
  codigo: string;
  descricao: string;
  natureza_operacao: string | null;
  cfop_interno: string | null;
  cfop_interestadual: string | null;
  finalidade: string | null;
  exige_referencia: boolean | null;
  movimenta_estoque: boolean | null;
  gera_financeiro: boolean | null;
  observacao: string | null;
}

interface LinhaItem {
  item_id: string;
  descricao: string;
  quantidade: number;
  valor_unitario: string;
  lote_id: string;
}

interface NovaNotaSaidaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (notaId: string) => void;
}

/** Tipos de item por natureza da operação — ProLab não tem PA cadastrado. */
function tiposParaOperacao(codigo: string): string[] {
  const c = codigo.toUpperCase();
  if (c.startsWith("DEVOLUCAO_COMPRA") || c.includes("REMESSA_INDUSTRIALIZACAO") || c.includes("REMESSA_ANALISE") || c.includes("REMESSA_CONSERTO") || c.includes("REMESSA_DEPOSITO")) {
    return ["MP", "EMBALAGEM", "ROTULO", "CAPSULA_VAZIA", "SILICA", "TAMPA", "POTE", "OUTRO"];
  }
  if (c.includes("VENDA_PRODUCAO") || c.includes("TRANSFERENCIA_PRODUCAO") || c.includes("BONIFICACAO") || c.includes("REMESSA_AMOSTRA")) {
    return ["PA"];
  }
  if (c.includes("VENDA_REVENDA")) {
    return ["PA", "MP", "EMBALAGEM", "OUTRO"];
  }
  // Demais: amplo o suficiente para não esvaziar a lista
  return ["PA", "MP", "EMBALAGEM", "ROTULO", "CAPSULA_VAZIA", "OUTRO"];
}

export function NovaNotaSaidaDialog({ open, onOpenChange, onCreated }: NovaNotaSaidaDialogProps) {
  const [ops, setOps] = useState<OperacaoFiscalSaida[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [itensCat, setItensCat] = useState<any[]>([]);
  const [lotes, setLotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [operacao, setOperacao] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [obs, setObs] = useState("");
  const [chave, setChave] = useState("");
  const [modFrete, setModFrete] = useState("9");
  const [valorFrete, setValorFrete] = useState("0");
  const [linhas, setLinhas] = useState<LinhaItem[]>([
    { item_id: "", descricao: "", quantidade: 1, valor_unitario: "", lote_id: "" },
  ]);

  const opSel = useMemo(() => ops.find((o) => o.codigo === operacao), [ops, operacao]);
  const tipos = useMemo(() => tiposParaOperacao(operacao || "VENDA_PRODUCAO"), [operacao]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    (async () => {
      try {
        const [{ data: opsData, error: opsErr }, { data: cliData, error: cliErr }] = await Promise.all([
          (supabase as any)
            .from("operacoes_fiscais_saida")
            .select("*")
            .order("descricao"),
          supabase
            .from("entidades")
            .select("id, razao_social, nome_fantasia, documento")
            .eq("status", "ATIVO")
            .order("razao_social"),
        ]);
        if (opsErr) throw opsErr;
        if (cliErr) throw cliErr;
        setOps((opsData || []) as OperacaoFiscalSaida[]);
        setClientes(cliData || []);
        if (opsData?.[0]?.codigo) setOperacao(opsData[0].codigo);
      } catch (e) {
        toast.error(traduzirErroRpcFiscal(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [open]);

  useEffect(() => {
    if (!open || !operacao) return;
    (async () => {
      const { data, error } = await supabase
        .from("itens")
        .select("id, descricao_interna, sku_interno, ncm, tipo_item, unidade_interna")
        .eq("ativo", true)
        .in("tipo_item", tipos as any)
        .order("descricao_interna");
      if (error) {
        toast.error(error.message);
        return;
      }
      setItensCat(data || []);
    })();
  }, [open, operacao, tipos]);

  const carregarLotes = async (itemId: string) => {
    if (!itemId || !opSel?.movimenta_estoque) {
      setLotes([]);
      return;
    }
    const { data } = await supabase
      .from("estoque_lotes")
      .select("id, numero_lote, quantidade_interna, status, data_val")
      .eq("item_id", itemId)
      .order("data_val", { ascending: true });
    setLotes(data || []);
  };

  const salvar = async () => {
    if (!operacao) {
      toast.error("Selecione a operação.");
      return;
    }
    if (!clienteId) {
      toast.error("Selecione o destinatário.");
      return;
    }
    if (opSel?.exige_referencia) {
      const digits = chave.replace(/\D/g, "");
      if (digits.length !== 44) {
        toast.error("Informe a chave de acesso da NF-e de origem (44 dígitos).");
        return;
      }
    }
    const itensPayload = [];
    for (const l of linhas) {
      if (!l.item_id) {
        toast.error("Selecione o item em todas as linhas.");
        return;
      }
      if (!l.quantidade || l.quantidade <= 0) {
        toast.error("Quantidade inválida.");
        return;
      }
      const vu = l.valor_unitario.trim() === "" ? null : Number(l.valor_unitario.replace(",", "."));
      if (opSel?.gera_financeiro && (vu == null || !Number.isFinite(vu) || vu < 0)) {
        toast.error("Operação com circulação financeira exige preço unitário.");
        return;
      }
      if (opSel?.movimenta_estoque && !l.lote_id) {
        toast.error("Selecione o lote para itens com movimentação de estoque.");
        return;
      }
      itensPayload.push({
        item_id: l.item_id,
        quantidade: l.quantidade,
        valor_unitario: vu,
        lote_id: l.lote_id || null,
      });
    }

    setSaving(true);
    try {
      const notaId = await criarNotaSaida({
        operacao,
        clienteId,
        itens: itensPayload,
        observacao: obs || null,
        chaveReferenciada: opSel?.exige_referencia ? chave.replace(/\D/g, "") : null,
        modalidadeFrete: modFrete,
        valorFrete: Number(valorFrete.replace(",", ".")) || 0,
      });
      toast.success("Rascunho de NF-e criado");
      onOpenChange(false);
      onCreated(notaId);
    } catch (e) {
      toast.error(traduzirErroRpcFiscal(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileOutput className="h-5 w-5" />
            Nova NF-e de saída
          </DialogTitle>
          <DialogDescription>
            Escolha a operação pelo nome — CFOP e natureza vêm do catálogo fiscal.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Operação *</Label>
              <Select value={operacao} onValueChange={setOperacao}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a operação" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {ops.map((o) => (
                    <SelectItem key={o.codigo} value={o.codigo}>
                      {o.descricao}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {opSel && (
                <p className="text-xs text-muted-foreground">
                  Natureza: {opSel.natureza_operacao || "—"}
                  {opSel.cfop_interno ? ` · CFOP int. ${opSel.cfop_interno}` : ""}
                  {opSel.cfop_interestadual ? ` / inter. ${opSel.cfop_interestadual}` : ""}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Destinatário *</Label>
              <Select value={clienteId} onValueChange={setClienteId}>
                <SelectTrigger>
                  <SelectValue placeholder="Cliente / destinatário" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.razao_social || c.nome_fantasia} {c.documento ? `· ${c.documento}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {opSel?.exige_referencia && (
              <div className="space-y-2">
                <Label>Chave de acesso referenciada (44 dígitos) *</Label>
                <Input
                  value={chave}
                  onChange={(e) => setChave(e.target.value.replace(/\D/g, "").slice(0, 44))}
                  placeholder="44 dígitos"
                  className="font-mono"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Modalidade frete</Label>
                <Select value={modFrete} onValueChange={setModFrete}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0 - Remetente (CIF)</SelectItem>
                    <SelectItem value="1">1 - Destinatário (FOB)</SelectItem>
                    <SelectItem value="2">2 - Terceiros</SelectItem>
                    <SelectItem value="9">9 - Sem transporte</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Valor frete</Label>
                <Input value={valorFrete} onChange={(e) => setValorFrete(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Itens *</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setLinhas((p) => [
                      ...p,
                      { item_id: "", descricao: "", quantidade: 1, valor_unitario: "", lote_id: "" },
                    ])
                  }
                >
                  <Plus className="h-4 w-4 mr-1" /> Linha
                </Button>
              </div>
              {itensCat.length === 0 && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                  Nenhum item do tipo esperado para esta operação ({tipos.join(", ")}).
                  Cadastre o item ou escolha outra operação.
                </p>
              )}
              <div className="space-y-3">
                {linhas.map((linha, idx) => (
                  <div key={idx} className="border rounded-md p-3 space-y-2">
                    <div className="flex gap-2">
                      <Select
                        value={linha.item_id || undefined}
                        onValueChange={(v) => {
                          const item = itensCat.find((i) => i.id === v);
                          setLinhas((prev) =>
                            prev.map((p, i) =>
                              i === idx
                                ? {
                                    ...p,
                                    item_id: v,
                                    descricao: item?.descricao_interna || "",
                                    lote_id: "",
                                  }
                                : p
                            )
                          );
                          void carregarLotes(v);
                        }}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Item" />
                        </SelectTrigger>
                        <SelectContent className="max-h-64">
                          {itensCat.map((i) => (
                            <SelectItem key={i.id} value={i.id}>
                              {i.sku_interno ? `${i.sku_interno} — ` : ""}
                              {i.descricao_interna}
                              {!i.ncm ? " (sem NCM)" : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {linhas.length > 1 && (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => setLinhas((p) => p.filter((_, i) => i !== idx))}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-xs">Qtd</Label>
                        <Input
                          type="number"
                          min={0}
                          step="any"
                          value={linha.quantidade}
                          onChange={(e) =>
                            setLinhas((prev) =>
                              prev.map((p, i) =>
                                i === idx ? { ...p, quantidade: Number(e.target.value) || 0 } : p
                              )
                            )
                          }
                        />
                      </div>
                      <div>
                        <Label className="text-xs">
                          Valor unit. {opSel?.gera_financeiro ? "*" : "(opc.)"}
                        </Label>
                        <Input
                          value={linha.valor_unitario}
                          onChange={(e) =>
                            setLinhas((prev) =>
                              prev.map((p, i) =>
                                i === idx ? { ...p, valor_unitario: e.target.value } : p
                              )
                            )
                          }
                        />
                      </div>
                      {opSel?.movimenta_estoque && (
                        <div>
                          <Label className="text-xs">Lote *</Label>
                          <Select
                            value={linha.lote_id || undefined}
                            onValueChange={(v) =>
                              setLinhas((prev) =>
                                prev.map((p, i) => (i === idx ? { ...p, lote_id: v } : p))
                              )
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Lote" />
                            </SelectTrigger>
                            <SelectContent>
                              {lotes.map((l) => (
                                <SelectItem key={l.id} value={l.id}>
                                  {l.numero_lote} · {l.status} · saldo {l.quantidade_interna}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Observação</Label>
              <Textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={salvar} disabled={saving || loading}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Criar rascunho
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
