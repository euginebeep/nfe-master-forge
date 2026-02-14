import { useState } from "react";
import { Shield, Search, ArrowRight, Package, Factory } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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

  // Buscar dados de rastreabilidade com join nos lotes de produto acabado
  const { data: rastreio, isLoading } = useQuery({
    queryKey: ["rastreabilidade"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rastreabilidade_lote_mp")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as RastreioItem[];
    },
  });

  // Buscar lotes de produto acabado para enriquecer
  const { data: lotesPA } = useQuery({
    queryKey: ["lotes-pa-rastreio"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lotes_produto_acabado")
        .select("id, numero_lote, produto_nome, data_fabricacao, status")
        .order("data_fabricacao", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
  });

  // Buscar lotes MP para enriquecer
  const { data: lotesMP } = useQuery({
    queryKey: ["lotes-mp-rastreio"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estoque_lotes")
        .select("id, numero_lote, item_id")
        .limit(500);
      if (error) throw error;
      return data || [];
    },
  });

  // Buscar itens para nomes
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

  const getLotePA = (id: string) => lotesPA?.find(l => l.id === id);
  const getLoteMP = (id: string) => lotesMP?.find(l => l.id === id);
  const getItem = (id: string) => itens?.find(i => i.id === id);

  // Agrupar por lote PA
  const agrupado = new Map<string, RastreioItem[]>();
  (rastreio || []).forEach(r => {
    const key = r.lote_produto_acabado_id;
    if (!agrupado.has(key)) agrupado.set(key, []);
    agrupado.get(key)!.push(r);
  });

  const filtered = Array.from(agrupado.entries()).filter(([paId]) => {
    if (!search) return true;
    const pa = getLotePA(paId);
    return pa?.numero_lote.toLowerCase().includes(search.toLowerCase()) ||
      pa?.produto_nome.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rastreabilidade MP → PA"
        description="Rastreamento completo de matérias-primas até o produto acabado (BPF/ANVISA)"
        icon={Shield}
      />

      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="pt-4 text-center"><div className="text-2xl font-bold">{agrupado.size}</div><p className="text-xs text-muted-foreground">Lotes PA Rastreados</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><div className="text-2xl font-bold">{rastreio?.length || 0}</div><p className="text-xs text-muted-foreground">Vínculos MP→PA</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><div className="text-2xl font-bold">{new Set(rastreio?.map(r => r.lote_mp_id)).size}</div><p className="text-xs text-muted-foreground">Lotes MP Utilizados</p></CardContent></Card>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por lote ou produto..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
      </div>

      {isLoading ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Carregando rastreabilidade...</CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
          <p>Nenhum registro de rastreabilidade encontrado.</p>
          <p className="text-sm mt-2">Os vínculos MP→PA são criados automaticamente ao finalizar uma OP.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-4">
          {filtered.map(([paId, items]) => {
            const pa = getLotePA(paId);
            return (
              <Card key={paId}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-3">
                    <Package className="h-5 w-5 text-primary" />
                    <div>
                      <span className="font-mono">{pa?.numero_lote || paId.slice(0, 8)}</span>
                      <span className="text-muted-foreground font-normal ml-3">{pa?.produto_nome || ""}</span>
                    </div>
                    {pa?.status && <Badge variant="outline">{pa.status}</Badge>}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Matéria-Prima</TableHead>
                        <TableHead>Lote MP</TableHead>
                        <TableHead className="text-right">Qtd Utilizada</TableHead>
                        <TableHead>Unidade</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map(r => {
                        const item = getItem(r.item_mp_id);
                        const loteMP = getLoteMP(r.lote_mp_id);
                        return (
                          <TableRow key={r.id}>
                            <TableCell className="font-medium">{item?.descricao_interna || "-"}</TableCell>
                            <TableCell className="font-mono">{loteMP?.numero_lote || r.lote_mp_id.slice(0, 8)}</TableCell>
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
    </div>
  );
}
