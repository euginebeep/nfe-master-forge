import { useState, useMemo } from "react";
import { Store, Search, Plus, DollarSign, Package, TrendingUp, Edit, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

export default function MarketplacePage() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const queryClient = useQueryClient();

  const { data: catalogoItems, isLoading } = useQuery({
    queryKey: ["catalogo-precos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("catalogo_precos")
        .select("*, itens(descricao_interna, sku_interno, tipo_item, unidade_interna)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: itensDisponiveis } = useQuery({
    queryKey: ["itens-pa"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("itens")
        .select("id, descricao_interna, sku_interno, tipo_item")
        .eq("tipo_item", "PRODUTO_ACABADO")
        .eq("ativo", true)
        .order("descricao_interna");
      if (error) throw error;
      return data;
    },
  });

  const upsertPreco = useMutation({
    mutationFn: async (data: any) => {
      if (data.id) {
        const { error } = await supabase
          .from("catalogo_precos")
          .update({
            preco_venda: data.preco_venda,
            preco_minimo: data.preco_minimo || null,
            margem_contribuicao: data.margem_contribuicao || null,
            ativo: data.ativo ?? true,
            vigencia_fim: data.vigencia_fim || null,
          })
          .eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("catalogo_precos")
          .insert({
            item_id: data.item_id,
            preco_venda: data.preco_venda,
            preco_minimo: data.preco_minimo || null,
            margem_contribuicao: data.margem_contribuicao || null,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["catalogo-precos"] });
      toast.success(editItem?.id ? "Preço atualizado" : "Preço cadastrado");
      setDialogOpen(false);
      setEditItem(null);
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const deletePreco = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("catalogo_precos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["catalogo-precos"] });
      toast.success("Preço removido");
    },
  });

  const filtered = useMemo(() => {
    if (!catalogoItems) return [];
    if (!search) return catalogoItems;
    const s = search.toLowerCase();
    return catalogoItems.filter((c: any) =>
      c.itens?.descricao_interna?.toLowerCase().includes(s) ||
      c.itens?.sku_interno?.toLowerCase().includes(s)
    );
  }, [catalogoItems, search]);

  const kpis = useMemo(() => {
    if (!catalogoItems) return { total: 0, ativos: 0, mediaPreco: 0, margemMedia: 0 };
    const ativos = catalogoItems.filter((c: any) => c.ativo);
    return {
      total: catalogoItems.length,
      ativos: ativos.length,
      mediaPreco: ativos.length ? ativos.reduce((s: number, c: any) => s + Number(c.preco_venda || 0), 0) / ativos.length : 0,
      margemMedia: ativos.filter((c: any) => c.margem_contribuicao).length
        ? ativos.reduce((s: number, c: any) => s + Number(c.margem_contribuicao || 0), 0) / ativos.filter((c: any) => c.margem_contribuicao).length
        : 0,
    };
  }, [catalogoItems]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    upsertPreco.mutate({
      id: editItem?.id,
      item_id: fd.get("item_id") as string,
      preco_venda: Number(fd.get("preco_venda")),
      preco_minimo: fd.get("preco_minimo") ? Number(fd.get("preco_minimo")) : null,
      margem_contribuicao: fd.get("margem_contribuicao") ? Number(fd.get("margem_contribuicao")) : null,
      ativo: true,
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Catálogo de Preços"
        description="Tabela de preços de produtos acabados, margens e vigências"
        icon={Store}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Package className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{kpis.total}</p>
              <p className="text-xs text-muted-foreground">Total no Catálogo</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <DollarSign className="h-8 w-8 text-success" />
            <div>
              <p className="text-2xl font-bold">{kpis.ativos}</p>
              <p className="text-xs text-muted-foreground">Preços Ativos</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-info" />
            <div>
              <p className="text-2xl font-bold">R$ {kpis.mediaPreco.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">Preço Médio</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-warning" />
            <div>
              <p className="text-2xl font-bold">{kpis.margemMedia.toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground">Margem Média</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por produto ou SKU..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button onClick={() => { setEditItem({}); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Novo Preço
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Store className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum preço cadastrado</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Preço Venda</TableHead>
                  <TableHead className="text-right">Preço Mínimo</TableHead>
                  <TableHead className="text-right">Margem %</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.itens?.descricao_interna || "—"}</TableCell>
                    <TableCell><Badge variant="outline">{item.itens?.sku_interno || "—"}</Badge></TableCell>
                    <TableCell className="text-right font-mono">R$ {Number(item.preco_venda).toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono">{item.preco_minimo ? `R$ ${Number(item.preco_minimo).toFixed(2)}` : "—"}</TableCell>
                    <TableCell className="text-right">{item.margem_contribuicao ? `${Number(item.margem_contribuicao).toFixed(1)}%` : "—"}</TableCell>
                    <TableCell>
                      <Badge className={item.ativo ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"}>
                        {item.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => { setEditItem(item); setDialogOpen(true); }}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deletePreco.mutate(item.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditItem(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editItem?.id ? "Editar Preço" : "Novo Preço"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!editItem?.id && (
              <div>
                <Label>Produto Acabado</Label>
                <Select name="item_id" required>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {itensDisponiveis?.map((it: any) => (
                      <SelectItem key={it.id} value={it.id}>{it.descricao_interna} ({it.sku_interno})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Preço de Venda (R$)</Label>
                <Input name="preco_venda" type="number" step="0.01" required defaultValue={editItem?.preco_venda || ""} />
              </div>
              <div>
                <Label>Preço Mínimo (R$)</Label>
                <Input name="preco_minimo" type="number" step="0.01" defaultValue={editItem?.preco_minimo || ""} />
              </div>
            </div>
            <div>
              <Label>Margem de Contribuição (%)</Label>
              <Input name="margem_contribuicao" type="number" step="0.1" defaultValue={editItem?.margem_contribuicao || ""} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={upsertPreco.isPending}>Salvar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}