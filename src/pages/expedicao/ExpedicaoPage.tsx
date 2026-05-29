import { useMemo, useState } from "react";
import { Truck, Package, CheckCircle2, FileText, Download } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUserCompanyId } from "@/hooks/use-user-company";
import { useEntidades } from "@/hooks/use-entidades";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

const fmtBRL = (v: number) =>
  `R$ ${(v || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
const fmtDate = (s?: string | null) =>
  s ? new Date(s).toLocaleDateString("pt-BR") : "—";
const fmtDateTime = (s?: string | null) =>
  s ? new Date(s).toLocaleString("pt-BR") : "—";

type Pedido = any;
type Romaneio = any;

function useFila(companyId?: string | null) {
  return useQuery({
    queryKey: ["expedicao-fila", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pedidos_vendedor")
        .select("*, vendedores_externos(nome), entidades(razao_social, nome_fantasia)")
        .in("status", ["PRONTO", "SEPARACAO"])
        .order("updated_at", { ascending: true });
      if (error) throw error;
      return data as Pedido[];
    },
  });
}

function useTransito(companyId?: string | null) {
  return useQuery({
    queryKey: ["expedicao-transito", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pedidos_vendedor")
        .select(
          "*, vendedores_externos(nome), entidades!pedidos_vendedor_cliente_id_fkey(razao_social, nome_fantasia), transportadora:entidades!pedidos_vendedor_transportadora_id_fkey(razao_social, nome_fantasia)"
        )
        .eq("status", "DESPACHADO")
        .order("data_despacho", { ascending: false });
      if (error) throw error;
      return data as Pedido[];
    },
  });
}

function useHistorico(companyId?: string | null, dias = 30) {
  return useQuery({
    queryKey: ["expedicao-historico", companyId, dias],
    enabled: !!companyId,
    queryFn: async () => {
      const desde = new Date();
      desde.setDate(desde.getDate() - dias);
      const { data, error } = await supabase
        .from("pedidos_vendedor")
        .select(
          "*, vendedores_externos(nome), entidades!pedidos_vendedor_cliente_id_fkey(razao_social, nome_fantasia), transportadora:entidades!pedidos_vendedor_transportadora_id_fkey(razao_social)"
        )
        .in("status", ["ENTREGUE", "CANCELADO"])
        .gte("updated_at", desde.toISOString())
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as Pedido[];
    },
  });
}

function useRomaneio(pedidoId: string) {
  return useQuery({
    queryKey: ["expedicao-romaneio", pedidoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expedicao_romaneio")
        .select("*")
        .eq("pedido_id", pedidoId)
        .order("created_at");
      if (error) throw error;
      return data as Romaneio[];
    },
  });
}

function nomeEntidade(e: any) {
  return e?.razao_social || e?.nome_fantasia || "—";
}

/* ------------------------------------------------------------------ */
/* Card individual de pedido na fila                                   */
/* ------------------------------------------------------------------ */
function PedidoFilaCard({
  pedido,
  companyId,
  transportadoras,
  onChange,
}: {
  pedido: Pedido;
  companyId: string;
  transportadoras: any[];
  onChange: () => void;
}) {
  const qc = useQueryClient();
  const { data: romaneio = [], refetch } = useRomaneio(pedido.id);
  const [transportadoraId, setTransportadoraId] = useState<string>(
    pedido.transportadora_id || ""
  );
  const [rastreio, setRastreio] = useState<string>(pedido.codigo_rastreio || "");
  const [volumes, setVolumes] = useState<number>(pedido.volumes || 1);

  async function iniciarSeparacao() {
    // buscar itens do pedido
    const { data: itens } = await supabase
      .from("pedido_vendedor_itens")
      .select("*")
      .eq("pedido_id", pedido.id);

    if (itens?.length) {
      const rows = itens.map((it: any) => ({
        company_id: companyId,
        pedido_id: pedido.id,
        item_id: it.item_id,
        produto_nome: it.item_nome,
        quantidade: it.quantidade,
      }));
      await supabase.from("expedicao_romaneio").insert(rows);
    }
    await supabase
      .from("pedidos_vendedor")
      .update({ status: "SEPARACAO", updated_at: new Date().toISOString() })
      .eq("id", pedido.id);
    toast.success("Separação iniciada");
    onChange();
    refetch();
  }

  async function toggleConferido(rom: Romaneio, checked: boolean) {
    await supabase
      .from("expedicao_romaneio")
      .update({
        conferido: checked,
        conferido_em: checked ? new Date().toISOString() : null,
      })
      .eq("id", rom.id);
    refetch();
  }

  async function confirmarDespacho() {
    if (!romaneio.length || romaneio.some((r) => !r.conferido)) {
      toast.error("Confira todos os itens antes de despachar");
      return;
    }
    if (!transportadoraId) {
      toast.error("Selecione a transportadora");
      return;
    }
    await supabase
      .from("pedidos_vendedor")
      .update({
        status: "DESPACHADO",
        transportadora_id: transportadoraId,
        codigo_rastreio: rastreio || null,
        volumes: Number(volumes) || null,
        data_despacho: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", pedido.id);
    toast.success("Pedido despachado com sucesso!");
    qc.invalidateQueries({ queryKey: ["expedicao-fila"] });
    qc.invalidateQueries({ queryKey: ["expedicao-transito"] });
    onChange();
  }

  const isPronto = pedido.status === "PRONTO";
  const isSeparacao = pedido.status === "SEPARACAO";

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-base">
              {pedido.numero || pedido.id.slice(0, 8)}
            </span>
            <span className="text-sm text-muted-foreground">
              {pedido.vendedores_externos?.nome || "—"}
            </span>
            <span className="text-sm">
              · {nomeEntidade(pedido.entidades) || pedido.cliente_nome}
            </span>
          </div>
          <Badge
            className={
              isPronto
                ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                : "bg-amber-100 text-amber-700 hover:bg-amber-100"
            }
          >
            {isPronto ? "Pronto para separar" : "Em separação"}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Confirmado em {fmtDateTime(pedido.updated_at)}
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Itens */}
          <div>
            <h4 className="text-sm font-semibold mb-2">Itens do pedido</h4>
            {isPronto && romaneio.length === 0 ? (
              <p className="text-sm text-muted-foreground border rounded p-3">
                Inicie a separação para gerar o romaneio.
              </p>
            ) : (
              <div className="border rounded">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead>Lote</TableHead>
                      <TableHead>Qtd</TableHead>
                      <TableHead>OK</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {romaneio.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="text-sm">{r.produto_nome}</TableCell>
                        <TableCell className="text-xs">
                          {r.numero_lote || "—"}
                        </TableCell>
                        <TableCell>{r.quantidade}</TableCell>
                        <TableCell>
                          <Checkbox
                            checked={!!r.conferido}
                            onCheckedChange={(c) => toggleConferido(r, !!c)}
                            disabled={!isSeparacao}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          {/* NF-e e despacho */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold">NF-e e despacho</h4>
            {pedido.nfe_numero ? (
              <div className="p-3 border rounded bg-emerald-50">
                <Badge className="bg-emerald-600 hover:bg-emerald-600">
                  NF-e emitida
                </Badge>
                <p className="text-sm mt-1">Nº {pedido.nfe_numero}</p>
                <p className="text-[10px] font-mono break-all text-muted-foreground">
                  {pedido.nfe_chave}
                </p>
              </div>
            ) : (
              <div className="p-3 border rounded bg-amber-50 flex items-center justify-between gap-2">
                <div>
                  <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
                    NF-e pendente
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1">
                    A NF-e pode ser emitida antes ou após a separação
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    toast.info("Emissor de NF-e disponível em /vendas/emissor-nfe")
                  }
                >
                  <FileText className="h-4 w-4 mr-1" /> Emitir NF-e
                </Button>
              </div>
            )}

            <div>
              <label className="text-xs font-medium">Transportadora</label>
              <Select
                value={transportadoraId}
                onValueChange={setTransportadoraId}
              >
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {transportadoras.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>
                      {nomeEntidade(t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium">Código de rastreio</label>
                <Input
                  value={rastreio}
                  onChange={(e) => setRastreio(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium">Volumes</label>
                <Input
                  type="number"
                  min={1}
                  value={volumes}
                  onChange={(e) => setVolumes(Number(e.target.value))}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4 border-t pt-3">
          {isPronto && (
            <Button onClick={iniciarSeparacao}>
              <Package className="h-4 w-4 mr-1" /> Iniciar separação
            </Button>
          )}
          {isSeparacao && (
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={confirmarDespacho}
            >
              <Truck className="h-4 w-4 mr-1" /> Confirmar despacho
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Página principal                                                    */
/* ------------------------------------------------------------------ */
export default function ExpedicaoPage() {
  const { data: companyId } = useUserCompanyId();
  const { data: transportadoras = [] } = useEntidades({ papel: "TRANSPORTADORA" });
  const qc = useQueryClient();

  const { data: fila = [], refetch: refetchFila } = useFila(companyId);
  const { data: transito = [], refetch: refetchTransito } = useTransito(companyId);
  const [periodo, setPeriodo] = useState(30);
  const { data: historico = [] } = useHistorico(companyId, periodo);

  const [confirmEntregaId, setConfirmEntregaId] = useState<string | null>(null);

  async function confirmarEntrega(pedidoId: string) {
    await supabase
      .from("pedidos_vendedor")
      .update({
        status: "ENTREGUE",
        data_entrega_confirmada: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", pedidoId);
    toast.success("Entrega confirmada. Comissão liberada para pagamento.");
    qc.invalidateQueries({ queryKey: ["expedicao-transito"] });
    qc.invalidateQueries({ queryKey: ["expedicao-historico"] });
    setConfirmEntregaId(null);
  }

  const metricas = useMemo(() => {
    const entregues = historico.filter((p: any) => p.status === "ENTREGUE");
    const total = entregues.reduce(
      (s: number, p: any) => s + (Number(p.valor_total) || 0),
      0
    );
    const prazos: number[] = [];
    let noPrazo = 0;
    for (const p of entregues) {
      if (p.data_despacho && p.data_entrega_confirmada) {
        const dias =
          (new Date(p.data_entrega_confirmada).getTime() -
            new Date(p.data_despacho).getTime()) /
          (1000 * 60 * 60 * 24);
        prazos.push(dias);
        if (dias <= 7) noPrazo += 1;
      }
    }
    const prazoMedio = prazos.length
      ? prazos.reduce((a, b) => a + b, 0) / prazos.length
      : 0;
    const pctPrazo = entregues.length
      ? (noPrazo / entregues.length) * 100
      : 0;
    return {
      qtd: entregues.length,
      valor: total,
      prazoMedio,
      pctPrazo,
    };
  }, [historico]);

  function exportarCSV() {
    const headers = [
      "Data",
      "Pedido",
      "Vendedor",
      "Cliente",
      "Valor",
      "NF-e",
      "Despacho",
      "Entrega",
      "Comissao paga",
      "Status",
    ];
    const rows = historico.map((p: any) => [
      fmtDate(p.updated_at),
      p.numero || p.id.slice(0, 8),
      p.vendedores_externos?.nome || "",
      nomeEntidade(p.entidades) || p.cliente_nome || "",
      Number(p.valor_total || 0).toFixed(2),
      p.nfe_numero || "",
      fmtDate(p.data_despacho),
      fmtDate(p.data_entrega_confirmada),
      p.comissao_paga ? "Sim" : "Não",
      p.status,
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `expedicao-historico-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Expedição"
        description="Separação, despacho e rastreio de pedidos"
        icon={Truck}
      />

      <Tabs defaultValue="fila" className="space-y-4">
        <TabsList>
          <TabsTrigger value="fila">Fila de expedição ({fila.length})</TabsTrigger>
          <TabsTrigger value="transito">Em trânsito ({transito.length})</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        {/* TAB 1 */}
        <TabsContent value="fila" className="space-y-4">
          {fila.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                <Package className="h-10 w-10 mx-auto mb-2 opacity-40" />
                Nenhum pedido aguardando expedição
              </CardContent>
            </Card>
          ) : (
            fila.map((p) => (
              <PedidoFilaCard
                key={p.id}
                pedido={p}
                companyId={companyId!}
                transportadoras={transportadoras as any[]}
                onChange={() => {
                  refetchFila();
                  refetchTransito();
                }}
              />
            ))
          )}
        </TabsContent>

        {/* TAB 2 */}
        <TabsContent value="transito">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Despacho</TableHead>
                    <TableHead>Pedido</TableHead>
                    <TableHead>Vendedor</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Transportadora</TableHead>
                    <TableHead>Rastreio</TableHead>
                    <TableHead>Volumes</TableHead>
                    <TableHead>Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transito.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="text-center text-muted-foreground py-6"
                      >
                        Nenhum pedido em trânsito
                      </TableCell>
                    </TableRow>
                  )}
                  {transito.map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-sm">
                        {fmtDate(p.data_despacho)}
                      </TableCell>
                      <TableCell>{p.numero || p.id.slice(0, 8)}</TableCell>
                      <TableCell>{p.vendedores_externos?.nome || "—"}</TableCell>
                      <TableCell>
                        {nomeEntidade(p.entidades) || p.cliente_nome}
                      </TableCell>
                      <TableCell>{nomeEntidade(p.transportadora)}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {p.codigo_rastreio || "—"}
                      </TableCell>
                      <TableCell>{p.volumes || "—"}</TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setConfirmEntregaId(p.id)}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Confirmar entrega
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3 */}
        <TabsContent value="historico" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Pedidos entregues</p>
                <p className="text-2xl font-bold">{metricas.qtd}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Valor total expedido</p>
                <p className="text-2xl font-bold">{fmtBRL(metricas.valor)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">
                  Prazo médio despacho→entrega
                </p>
                <p className="text-2xl font-bold">
                  {metricas.prazoMedio.toFixed(1)} d
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">% no prazo</p>
                <p className="text-2xl font-bold">
                  {metricas.pctPrazo.toFixed(0)}%
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="text-xs font-medium">Período</label>
              <Select
                value={String(periodo)}
                onValueChange={(v) => setPeriodo(Number(v))}
              >
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 dias</SelectItem>
                  <SelectItem value="60">60 dias</SelectItem>
                  <SelectItem value="90">90 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={exportarCSV} className="ml-auto">
              <Download className="h-4 w-4 mr-1" /> Exportar CSV
            </Button>
          </div>

          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Pedido</TableHead>
                    <TableHead>Vendedor</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>NF-e</TableHead>
                    <TableHead>Despacho</TableHead>
                    <TableHead>Entrega</TableHead>
                    <TableHead>Comissão</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historico.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={10}
                        className="text-center text-muted-foreground py-6"
                      >
                        Sem registros no período
                      </TableCell>
                    </TableRow>
                  )}
                  {historico.map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-xs">
                        {fmtDate(p.updated_at)}
                      </TableCell>
                      <TableCell>{p.numero || p.id.slice(0, 8)}</TableCell>
                      <TableCell>{p.vendedores_externos?.nome || "—"}</TableCell>
                      <TableCell>
                        {nomeEntidade(p.entidades) || p.cliente_nome}
                      </TableCell>
                      <TableCell>{fmtBRL(Number(p.valor_total) || 0)}</TableCell>
                      <TableCell className="text-xs">
                        {p.nfe_numero || "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {fmtDate(p.data_despacho)}
                      </TableCell>
                      <TableCell className="text-xs">
                        {fmtDate(p.data_entrega_confirmada)}
                      </TableCell>
                      <TableCell>
                        {p.comissao_paga ? (
                          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                            Paga
                          </Badge>
                        ) : (
                          <Badge variant="outline">Pendente</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            p.status === "ENTREGUE" ? "default" : "destructive"
                          }
                        >
                          {p.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={!!confirmEntregaId}
        onOpenChange={(o) => !o && setConfirmEntregaId(null)}
        title="Confirmar entrega"
        description="Confirmar que o pedido foi entregue ao cliente?"
        onConfirm={() => confirmEntregaId && confirmarEntrega(confirmEntregaId)}
      />
    </div>
  );
}