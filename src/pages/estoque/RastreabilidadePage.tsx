import { useState } from "react";
import { Shield, Search, Package, Factory, ArrowDown, ArrowUp, QrCode } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { QRCodeAuditoria } from "@/components/shared/QRCodeAuditoria";
import { Skeleton } from "@/components/ui/skeleton";

interface RastreioItem {
  id: string;
  lote_produto_acabado_id: string;
  op_id: string;
  lote_mp_id: string;
  item_mp_id: string;
  quantidade_utilizada: number;
  unidade: string;
  created_at: string;
}

export default function RastreabilidadePage() {
  const [search, setSearch] = useState("");
  const [searchDireta, setSearchDireta] = useState("");

  // Rastreabilidade Reversa: PA → MP
  const { data: rastreio, isLoading } = useQuery({
    queryKey: ["rastreabilidade"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rastreabilidade_lote_mp")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as RastreioItem[];
    },
  });

  const { data: lotesPA } = useQuery({
    queryKey: ["lotes-pa-rastreio"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lotes_produto_acabado")
        .select("id, numero_lote, produto_nome, data_fabricacao, data_validade, status, qr_code_hash, rt_nome")
        .order("data_fabricacao", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: lotesMP } = useQuery({
    queryKey: ["lotes-mp-rastreio"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estoque_lotes")
        .select("id, numero_lote, item_id, fornecedor_id, data_val, status")
        .limit(500);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: itens } = useQuery({
    queryKey: ["itens-rastreio"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("itens")
        .select("id, descricao_interna, sku_interno")
        .limit(500);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: entidades } = useQuery({
    queryKey: ["entidades-rastreio"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entidades")
        .select("id, razao_social, nome_fantasia")
        .limit(500);
      if (error) throw error;
      return data || [];
    },
  });

  const getLotePA = (id: string) => lotesPA?.find(l => l.id === id);
  const getLoteMP = (id: string) => lotesMP?.find(l => l.id === id);
  const getItem = (id: string) => itens?.find(i => i.id === id);
  const getEntidade = (id: string) => entidades?.find(e => e.id === id);

  // --- REVERSA: PA → MP ---
  const agrupado = new Map<string, RastreioItem[]>();
  (rastreio || []).forEach(r => {
    const key = r.lote_produto_acabado_id;
    if (!agrupado.has(key)) agrupado.set(key, []);
    agrupado.get(key)!.push(r);
  });

  const filteredReversa = Array.from(agrupado.entries()).filter(([paId]) => {
    if (!search) return true;
    const pa = getLotePA(paId);
    return pa?.numero_lote.toLowerCase().includes(search.toLowerCase()) ||
      pa?.produto_nome.toLowerCase().includes(search.toLowerCase());
  });

  // --- DIRETA: MP → PA ---
  const agrupadoMP = new Map<string, RastreioItem[]>();
  (rastreio || []).forEach(r => {
    const key = r.lote_mp_id;
    if (!agrupadoMP.has(key)) agrupadoMP.set(key, []);
    agrupadoMP.get(key)!.push(r);
  });

  const filteredDireta = Array.from(agrupadoMP.entries()).filter(([mpId]) => {
    if (!searchDireta) return true;
    const mp = getLoteMP(mpId);
    const item = mp ? getItem(mp.item_id) : null;
    return mp?.numero_lote.toLowerCase().includes(searchDireta.toLowerCase()) ||
      item?.descricao_interna.toLowerCase().includes(searchDireta.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rastreabilidade Total"
        description="Rastreamento bidirecional MP ↔ PA (BPF/ANVISA)"
        icon={Shield}
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4 text-center"><div className="text-2xl font-bold">{agrupado.size}</div><p className="text-xs text-muted-foreground">Lotes PA</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><div className="text-2xl font-bold">{rastreio?.length || 0}</div><p className="text-xs text-muted-foreground">Vínculos</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><div className="text-2xl font-bold">{agrupadoMP.size}</div><p className="text-xs text-muted-foreground">Lotes MP</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><div className="text-2xl font-bold">{new Set(rastreio?.map(r => r.op_id)).size}</div><p className="text-xs text-muted-foreground">OPs Vinculadas</p></CardContent></Card>
      </div>

      <Tabs defaultValue="reversa">
        <TabsList>
          <TabsTrigger value="reversa" className="flex items-center gap-2">
            <ArrowDown className="h-4 w-4" />
            Reversa (PA → MP)
          </TabsTrigger>
          <TabsTrigger value="direta" className="flex items-center gap-2">
            <ArrowUp className="h-4 w-4" />
            Direta (MP → PA)
          </TabsTrigger>
        </TabsList>

        {/* Rastreabilidade Reversa */}
        <TabsContent value="reversa" className="space-y-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar lote PA ou produto..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
          </div>

          {isLoading ? (
            <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-40 w-full" />)}</div>
          ) : filteredReversa.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p>Nenhum registro de rastreabilidade encontrado.</p>
              <p className="text-sm mt-2">Os vínculos MP→PA são criados ao finalizar uma OP.</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-4">
              {filteredReversa.map(([paId, items]) => {
                const pa = getLotePA(paId);
                return (
                  <Card key={paId}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Package className="h-5 w-5 text-primary" />
                          <div>
                            <span className="font-mono">{pa?.numero_lote || paId.slice(0, 8)}</span>
                            <span className="text-muted-foreground font-normal ml-3">{pa?.produto_nome || ""}</span>
                          </div>
                          {pa?.status && <Badge variant="outline">{pa.status}</Badge>}
                        </div>
                        {pa?.qr_code_hash && (
                          <QRCodeAuditoria tipo="PRODUTO_ACABADO" id={paId} hash={pa.qr_code_hash} codigo={pa.numero_lote} size={64} showCard={false} />
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {pa?.rt_nome && (
                        <p className="text-xs text-muted-foreground mb-3">RT: {pa.rt_nome} | Fab: {pa.data_fabricacao} | Val: {pa.data_validade}</p>
                      )}
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Matéria-Prima</TableHead>
                            <TableHead>Lote MP</TableHead>
                            <TableHead>Fornecedor</TableHead>
                            <TableHead className="text-right">Qtd Utilizada</TableHead>
                            <TableHead>Un</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {items.map(r => {
                            const item = getItem(r.item_mp_id);
                            const loteMP = getLoteMP(r.lote_mp_id);
                            const fornecedor = loteMP?.fornecedor_id ? getEntidade(loteMP.fornecedor_id) : null;
                            return (
                              <TableRow key={r.id}>
                                <TableCell className="font-medium">{item?.descricao_interna || "-"}</TableCell>
                                <TableCell className="font-mono">{loteMP?.numero_lote || r.lote_mp_id.slice(0, 8)}</TableCell>
                                <TableCell className="text-sm">{fornecedor?.nome_fantasia || fornecedor?.razao_social || "-"}</TableCell>
                                <TableCell className="text-right font-mono">{Number(r.quantidade_utilizada).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</TableCell>
                                <TableCell>{r.unidade}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Rastreabilidade Direta */}
        <TabsContent value="direta" className="space-y-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar lote MP ou insumo..." value={searchDireta} onChange={e => setSearchDireta(e.target.value)} className="pl-10" />
          </div>

          {isLoading ? (
            <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-40 w-full" />)}</div>
          ) : filteredDireta.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p>Nenhum lote de MP com rastreio encontrado.</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-4">
              {filteredDireta.map(([mpId, items]) => {
                const mp = getLoteMP(mpId);
                const mpItem = mp ? getItem(mp.item_id) : null;
                const fornecedor = mp?.fornecedor_id ? getEntidade(mp.fornecedor_id) : null;
                return (
                  <Card key={mpId}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-3">
                        <Factory className="h-5 w-5 text-primary" />
                        <div>
                          <span className="font-mono">{mp?.numero_lote || mpId.slice(0, 8)}</span>
                          <span className="text-muted-foreground font-normal ml-3">{mpItem?.descricao_interna || ""}</span>
                        </div>
                        {mp?.status && <Badge variant="outline">{mp.status}</Badge>}
                        {fornecedor && <Badge variant="secondary">{fornecedor.nome_fantasia || fornecedor.razao_social}</Badge>}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground mb-3">
                        Este lote MP foi utilizado em {items.length} produto(s) acabado(s):
                      </p>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Lote PA</TableHead>
                            <TableHead>Produto</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Qtd Consumida</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {items.map(r => {
                            const pa = getLotePA(r.lote_produto_acabado_id);
                            return (
                              <TableRow key={r.id}>
                                <TableCell className="font-mono">{pa?.numero_lote || r.lote_produto_acabado_id.slice(0, 8)}</TableCell>
                                <TableCell>{pa?.produto_nome || "-"}</TableCell>
                                <TableCell>{pa?.status && <Badge variant="outline">{pa.status}</Badge>}</TableCell>
                                <TableCell className="text-right font-mono">{Number(r.quantidade_utilizada).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} {r.unidade}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
