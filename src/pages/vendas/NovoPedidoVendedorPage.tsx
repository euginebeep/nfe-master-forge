import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ShoppingCart, Plus, X, Wrench } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useUserCompanyId } from "@/hooks/use-user-company";
import { useVendedoresExternos, useTabelaPrecos } from "@/hooks/use-crm";
import { useEntidades } from "@/hooks/use-entidades";
import { useItens } from "@/hooks/use-itens";
import {
  checkEstoqueDisponivel,
  useConfirmarPedido,
  EstoqueCheck,
} from "@/hooks/use-pedido-vendedor";

const fmtBRL = (v: number) =>
  `R$ ${(v || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

interface LinhaProduto {
  item_id: string;
  item_nome: string;
  preco_minimo: number;
  preco_sugerido: number;
  quantidade_minima: number;
  preco_unitario: number;
  quantidade: number;
  estoque?: EstoqueCheck;
}

export default function NovoPedidoVendedorPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const leadId = params.get("lead_id");
  const vendedorIdParam = params.get("vendedor_id");

  const { data: companyId } = useUserCompanyId();
  const { data: vendedores = [] } = useVendedoresExternos(true);
  const { data: entidades = [] } = useEntidades({ papel: "CLIENTE" });
  const { data: itensTenant = [] } = useItens({ ativo: true });

  const [vendedorId, setVendedorId] = useState<string>("");
  const [clienteId, setClienteId] = useState<string>("");
  const [observacoes, setObservacoes] = useState("");
  const [dataEntrega, setDataEntrega] = useState("");
  const [linhas, setLinhas] = useState<LinhaProduto[]>([]);
  const [novoItemId, setNovoItemId] = useState<string>("");
  const [salvando, setSalvando] = useState(false);

  // Vendedor inicial
  useEffect(() => {
    if (vendedorIdParam) setVendedorId(vendedorIdParam);
    else if (!vendedorId && vendedores.length === 1) setVendedorId(vendedores[0].id);
  }, [vendedorIdParam, vendedores]); // eslint-disable-line

  // Preencher cliente a partir de lead
  useEffect(() => {
    if (!leadId) return;
    (async () => {
      const { data } = await supabase
        .from("oportunidades")
        .select("entidade_id")
        .eq("id", leadId)
        .maybeSingle();
      if (data?.entidade_id) setClienteId(data.entidade_id);
    })();
  }, [leadId]);

  const vendedorSelecionado = vendedores.find((v) => v.id === vendedorId);
  const { data: tabelaPrecos = [] } = useTabelaPrecos(vendedorId || null);
  const confirmar = useConfirmarPedido();

  // Sincroniza linhas iniciais com tabela de preços
  useEffect(() => {
    if (!tabelaPrecos.length) {
      setLinhas([]);
      return;
    }
    setLinhas((prev) => {
      const map = new Map(prev.map((l) => [l.item_id, l]));
      return tabelaPrecos.map((tp: any) => {
        const item = itensTenant.find((i: any) => i.id === tp.item_id);
        const existente = map.get(tp.item_id);
        return {
          item_id: tp.item_id,
          item_nome: item?.descricao_interna || "Produto",
          preco_minimo: Number(tp.preco_minimo) || 0,
          preco_sugerido: Number(tp.preco_sugerido) || 0,
          quantidade_minima: Number(tp.quantidade_minima) || 0,
          preco_unitario:
            existente?.preco_unitario ?? (Number(tp.preco_sugerido) || 0),
          quantidade: existente?.quantidade ?? 0,
          estoque: existente?.estoque,
        };
      });
    });
  }, [tabelaPrecos, itensTenant]);

  async function atualizarLinha(itemId: string, patch: Partial<LinhaProduto>) {
    setLinhas((prev) =>
      prev.map((l) => (l.item_id === itemId ? { ...l, ...patch } : l))
    );
    if (patch.quantidade !== undefined) {
      const qtd = Number(patch.quantidade) || 0;
      if (qtd > 0) {
        const est = await checkEstoqueDisponivel(itemId, qtd, companyId);
        setLinhas((prev) =>
          prev.map((l) => (l.item_id === itemId ? { ...l, estoque: est } : l))
        );
      } else {
        setLinhas((prev) =>
          prev.map((l) =>
            l.item_id === itemId ? { ...l, estoque: undefined } : l
          )
        );
      }
    }
  }

  function adicionarItem() {
    if (!novoItemId) return;
    if (linhas.some((l) => l.item_id === novoItemId)) {
      toast.warning("Produto já está na tabela");
      return;
    }
    const item = itensTenant.find((i: any) => i.id === novoItemId);
    if (!item) return;
    setLinhas((prev) => [
      ...prev,
      {
        item_id: novoItemId,
        item_nome: (item as any).descricao_interna || "Produto",
        preco_minimo: 0,
        preco_sugerido: 0,
        quantidade_minima: 0,
        preco_unitario: 0,
        quantidade: 0,
      },
    ]);
    setNovoItemId("");
  }

  function removerLinha(itemId: string) {
    setLinhas((prev) => prev.filter((l) => l.item_id !== itemId));
  }

  // Totais
  const totais = useMemo(() => {
    let doEstoque = 0;
    let emProducao = 0;
    let total = 0;
    const itensProducao: { nome: string; qtd: number }[] = [];
    for (const l of linhas) {
      const sub = (Number(l.quantidade) || 0) * (Number(l.preco_unitario) || 0);
      total += sub;
      if (l.estoque) {
        doEstoque += l.estoque.disponivel * (Number(l.preco_unitario) || 0);
        emProducao += l.estoque.paraProducao * (Number(l.preco_unitario) || 0);
        if (l.estoque.paraProducao > 0) {
          itensProducao.push({
            nome: l.item_nome,
            qtd: l.estoque.paraProducao,
          });
        }
      }
    }
    const comissaoPct = Number(vendedorSelecionado?.comissao_percent) || 0;
    const comissao = total * (comissaoPct / 100);
    return { doEstoque, emProducao, total, comissao, comissaoPct, itensProducao };
  }, [linhas, vendedorSelecionado]);

  async function salvar(status: "RASCUNHO" | "PENDENTE") {
    if (!companyId) {
      toast.error("Empresa não identificada");
      return;
    }
    if (status === "PENDENTE" && !clienteId) {
      toast.error("Selecione um cliente para confirmar o pedido");
      return;
    }
    const itensValidos = linhas.filter((l) => Number(l.quantidade) > 0);
    if (!itensValidos.length) {
      toast.error("Adicione ao menos um produto com quantidade");
      return;
    }
    // valida preço mínimo
    for (const l of itensValidos) {
      if (l.preco_minimo > 0 && l.preco_unitario < l.preco_minimo) {
        toast.error(
          `Preço de "${l.item_nome}" abaixo do mínimo (${fmtBRL(l.preco_minimo)})`
        );
        return;
      }
    }
    const pedidoMinimo = Number(vendedorSelecionado?.pedido_minimo) || 0;
    if (status === "PENDENTE" && pedidoMinimo > 0 && totais.total < pedidoMinimo) {
      const ok = window.confirm(
        `Total ${fmtBRL(totais.total)} abaixo do mínimo ${fmtBRL(pedidoMinimo)}. Confirmar mesmo assim?`
      );
      if (!ok) return;
    }

    setSalvando(true);
    try {
      const clienteNome =
        entidades.find((e: any) => e.id === clienteId)?.razao_social ||
        entidades.find((e: any) => e.id === clienteId)?.nome_fantasia ||
        null;

      const { data: pedido, error: errPedido } = await supabase
        .from("pedidos_vendedor")
        .insert({
          company_id: companyId,
          vendedor_id: vendedorId || null,
          cliente_id: clienteId || null,
          cliente_nome: clienteNome,
          observacoes: observacoes || null,
          status,
          valor_total: totais.total,
          comissao_percent: totais.comissaoPct,
          valor_comissao: totais.comissao,
        })
        .select("id")
        .single();
      if (errPedido) throw errPedido;

      const rows = itensValidos.map((l) => ({
        pedido_id: pedido.id,
        company_id: companyId,
        item_id: l.item_id,
        item_nome: l.item_nome,
        quantidade: l.quantidade,
        preco_unitario: l.preco_unitario,
        subtotal: l.quantidade * l.preco_unitario,
        status_item: "PENDENTE",
      }));
      const { error: errItens } = await supabase
        .from("pedido_vendedor_itens")
        .insert(rows);
      if (errItens) throw errItens;

      if (status === "RASCUNHO") {
        toast.success("Rascunho salvo");
      } else {
        const result = await confirmar.mutateAsync({
          pedidoId: pedido.id,
          companyId,
        });
        toast.success(
          `Pedido confirmado! ${result.ops_geradas} OP(s) gerada(s) automaticamente.`
        );
      }
      navigate("/vendas/crm");
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar pedido");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Novo pedido"
        description={
          vendedorSelecionado
            ? `${vendedorSelecionado.nome}${vendedorSelecionado.territorio ? " — " + vendedorSelecionado.territorio : ""}`
            : "Pedido de vendedor externo"
        }
        icon={ShoppingCart}
      />

      {/* Seção 1: Cabeçalho */}
      <Card>
        <CardHeader><CardTitle className="text-base">Cabeçalho</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Vendedor</Label>
            <Select value={vendedorId} onValueChange={setVendedorId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {vendedores.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Cliente</Label>
            <Select value={clienteId} onValueChange={setClienteId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {entidades.map((e: any) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.razao_social || e.nome_fantasia || "Sem nome"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>Observações</Label>
            <Textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={2}
            />
          </div>
          <div>
            <Label>Data de entrega desejada</Label>
            <Input
              type="date"
              value={dataEntrega}
              onChange={(e) => setDataEntrega(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Seção 2: Produtos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Produtos — Marca Própria</CardTitle>
          <p className="text-xs text-muted-foreground">
            Estoque verificado em tempo real
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Preço unit.</TableHead>
                  <TableHead>Qtd mínima</TableHead>
                  <TableHead>Quantidade</TableHead>
                  <TableHead>Estoque</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Subtotal</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhas.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-6">
                      {vendedorId
                        ? "Nenhum produto na tabela deste vendedor. Adicione abaixo."
                        : "Selecione um vendedor para carregar a tabela de preços."}
                    </TableCell>
                  </TableRow>
                )}
                {linhas.map((l) => {
                  const sub = (l.quantidade || 0) * (l.preco_unitario || 0);
                  const precoInvalido =
                    l.preco_minimo > 0 && l.preco_unitario < l.preco_minimo;
                  const est = l.estoque;
                  let estoqueCor = "text-muted-foreground";
                  let estoqueNum = "—";
                  if (est) {
                    estoqueNum = String(est.disponivel + est.paraProducao === 0
                      ? 0
                      : est.disponivel);
                    if (est.semEstoque) estoqueCor = "text-red-600";
                    else if (est.temEstoqueParcial) estoqueCor = "text-amber-600";
                    else estoqueCor = "text-emerald-600";
                  }
                  let statusBadge = (
                    <Badge variant="outline" className="text-muted-foreground">—</Badge>
                  );
                  if (l.quantidade > 0 && est) {
                    if (est.temEstoqueSuficiente)
                      statusBadge = (
                        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                          Do estoque
                        </Badge>
                      );
                    else if (est.temEstoqueParcial)
                      statusBadge = (
                        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
                          {est.disponivel} estoque + {est.paraProducao} produção
                        </Badge>
                      );
                    else
                      statusBadge = (
                        <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
                          {est.paraProducao} a produzir
                        </Badge>
                      );
                  }
                  return (
                    <TableRow key={l.item_id}>
                      <TableCell className="font-medium">{l.item_nome}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          value={l.preco_unitario}
                          onChange={(e) =>
                            atualizarLinha(l.item_id, {
                              preco_unitario: Number(e.target.value),
                            })
                          }
                          className={`w-28 ${precoInvalido ? "border-red-500 text-red-600" : ""}`}
                        />
                        {precoInvalido && (
                          <p className="text-[10px] text-red-600 mt-1">
                            Mín: {fmtBRL(l.preco_minimo)}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{l.quantidade_minima}</Badge>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          value={l.quantidade}
                          onChange={(e) =>
                            atualizarLinha(l.item_id, {
                              quantidade: Number(e.target.value),
                            })
                          }
                          className="w-24"
                        />
                      </TableCell>
                      <TableCell className={`font-semibold ${estoqueCor}`}>
                        {estoqueNum}
                      </TableCell>
                      <TableCell>{statusBadge}</TableCell>
                      <TableCell className="font-medium">{fmtBRL(sub)}</TableCell>
                      <TableCell>
                        {l.quantidade > 0 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removerLinha(l.item_id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex gap-2 mt-4 items-end">
            <div className="flex-1 max-w-md">
              <Label>Adicionar produto</Label>
              <Select value={novoItemId} onValueChange={setNovoItemId}>
                <SelectTrigger><SelectValue placeholder="Selecione um produto" /></SelectTrigger>
                <SelectContent>
                  {itensTenant.map((i: any) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.descricao_interna}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={adicionarItem} disabled={!novoItemId}>
              <Plus className="h-4 w-4 mr-2" /> Adicionar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Seção 3: Alerta de produção */}
      {totais.itensProducao.length > 0 && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="p-4 flex gap-3">
            <Wrench className="h-5 w-5 text-amber-600 mt-0.5" />
            <div className="text-sm space-y-1">
              <p className="font-semibold text-amber-800">
                Ordens de produção serão geradas automaticamente para:
              </p>
              <ul className="list-disc pl-5 text-amber-800">
                {totais.itensProducao.map((p) => (
                  <li key={p.nome}>
                    {p.qtd} un de {p.nome}
                  </li>
                ))}
              </ul>
              <p className="text-amber-700">Prazo estimado: 3 a 5 dias úteis</p>
              <p className="text-amber-700">
                Você receberá notificação quando estiver pronto para expedição.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Seção 4: Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">
              Do estoque (entrega imediata)
            </p>
            <p className="text-2xl font-bold text-emerald-600">
              {fmtBRL(totais.doEstoque)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Em produção</p>
            <p className="text-2xl font-bold text-amber-600">
              {fmtBRL(totais.emProducao)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">
              Sua comissão estimada ({totais.comissaoPct}%)
            </p>
            <p className="text-2xl font-bold text-primary">
              {fmtBRL(totais.comissao)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-between items-center border-t pt-4">
        <div>
          <p className="text-xs text-muted-foreground">Total do pedido</p>
          <p className="text-3xl font-bold">{fmtBRL(totais.total)}</p>
          {vendedorSelecionado &&
            Number(vendedorSelecionado.pedido_minimo) > 0 &&
            totais.total < Number(vendedorSelecionado.pedido_minimo) && (
              <p className="text-xs text-amber-600">
                Abaixo do mínimo {fmtBRL(Number(vendedorSelecionado.pedido_minimo))}
              </p>
            )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => salvar("RASCUNHO")}
            disabled={salvando}
          >
            Salvar rascunho
          </Button>
          <Button
            className="bg-emerald-600 hover:bg-emerald-700"
            onClick={() => salvar("PENDENTE")}
            disabled={salvando}
          >
            Confirmar pedido
          </Button>
        </div>
      </div>
    </div>
  );
}