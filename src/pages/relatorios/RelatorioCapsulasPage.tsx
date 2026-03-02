import { useMemo, useState } from "react";
import { Pill, Download, TrendingUp, TrendingDown, Package } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLotes } from "@/hooks/use-lotes";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/formatters";

interface CapsulaSummary {
  itemId: string;
  sku: string;
  descricao: string;
  fornecedorNome?: string;
  quantidadeTotal: number;
  custoMedio: number;
  custoTotal: number;
  lotes: number;
}

export default function RelatorioCapsulasPage() {
  const [groupBy, setGroupBy] = useState<'fornecedor' | 'item'>('item');

  // Fetch capsule items from Supabase
  const { data: capsuleItems } = useQuery({
    queryKey: ['capsule-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('itens')
        .select('id, sku_interno, descricao_interna, tipo_item')
        .in('tipo_item', ['CAPSULA', 'CAPSULA_VAZIA']);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: allLotes } = useLotes();

  const capsulas = useMemo(() => {
    if (!capsuleItems || !allLotes) return [];
    const capsuleIds = new Set(capsuleItems.map(i => i.id));
    const capsuleLotes = allLotes.filter(l => capsuleIds.has(l.item?.id || ''));

    const summaries: CapsulaSummary[] = [];
    const groupMap = new Map<string, typeof capsuleLotes>();

    capsuleLotes.forEach(lote => {
      const key = groupBy === 'fornecedor'
        ? (lote.fornecedor?.id || 'sem_fornecedor')
        : lote.item?.id || 'unknown';
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(lote);
    });

    groupMap.forEach((lotes, _key) => {
      const first = lotes[0];
      const quantidadeTotal = lotes.reduce((acc, l) => acc + (l as any).quantidade_interna, 0);
      const custoTotal = lotes.reduce((acc, l) => acc + ((l as any).custo_unitario_interno * (l as any).quantidade_interna), 0);
      const custoMedio = quantidadeTotal > 0 ? custoTotal / quantidadeTotal : 0;

      summaries.push({
        itemId: first.item?.id || '',
        sku: first.item?.sku_interno || '',
        descricao: first.item?.descricao_interna || '',
        fornecedorNome: first.fornecedor?.razao_social || 'Sem fornecedor',
        quantidadeTotal,
        custoMedio,
        custoTotal,
        lotes: lotes.length,
      });
    });

    // Also add capsule items with no lotes
    capsuleItems.forEach(item => {
      if (!capsuleLotes.some(l => l.item?.id === item.id)) {
        summaries.push({
          itemId: item.id,
          sku: item.sku_interno,
          descricao: item.descricao_interna,
          quantidadeTotal: 0,
          custoMedio: 0,
          custoTotal: 0,
          lotes: 0,
        });
      }
    });

    return summaries;
  }, [capsuleItems, allLotes, groupBy]);

  const totals = useMemo(() => ({
    quantidade: capsulas.reduce((acc, c) => acc + c.quantidadeTotal, 0),
    custo: capsulas.reduce((acc, c) => acc + c.custoTotal, 0),
    items: capsulas.length,
  }), [capsulas]);

  const exportCSV = () => {
    const headers = ['SKU', 'Descrição', 'Fornecedor', 'Qtd (un)', 'Custo Médio', 'Custo Total', 'Lotes'];
    const rows = capsulas.map(c => [c.sku, c.descricao, c.fornecedorNome || '', c.quantidadeTotal, c.custoMedio.toFixed(6), c.custoTotal.toFixed(2), c.lotes]);
    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-capsulas-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <PageHeader title="Relatório de Cápsulas" description="Análise de custos por fornecedor e item" icon={Pill}
        actions={<Button onClick={exportCSV} variant="outline"><Download className="h-4 w-4 mr-2" />Exportar CSV</Button>} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Total em Estoque</p><p className="text-2xl font-bold">{totals.quantidade.toLocaleString('pt-BR')} un</p></div><Package className="h-8 w-8 text-muted-foreground" /></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Custo Total</p><p className="text-2xl font-bold">{formatCurrency(totals.custo)}</p></div><TrendingUp className="h-8 w-8 text-muted-foreground" /></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Tipos Cadastrados</p><p className="text-2xl font-bold">{totals.items}</p></div><Pill className="h-8 w-8 text-muted-foreground" /></div></CardContent></Card>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <span className="text-sm font-medium">Agrupar por:</span>
        <Select value={groupBy} onValueChange={(v) => setGroupBy(v as any)}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="item">Item</SelectItem>
            <SelectItem value="fornecedor">Fornecedor</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead className="text-right">Qtd (un)</TableHead>
                <TableHead className="text-right">Custo/un</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Lotes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {capsulas.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">Nenhuma cápsula cadastrada.</TableCell></TableRow>
              ) : capsulas.map((cap, idx) => (
                <TableRow key={`${cap.itemId}-${idx}`}>
                  <TableCell className="font-mono text-sm">{cap.sku}</TableCell>
                  <TableCell>{cap.descricao}</TableCell>
                  <TableCell>{cap.fornecedorNome || '-'}</TableCell>
                  <TableCell className="text-right">{cap.quantidadeTotal.toLocaleString('pt-BR')}</TableCell>
                  <TableCell className="text-right font-mono">{cap.custoMedio > 0 ? formatCurrency(cap.custoMedio) : '-'}</TableCell>
                  <TableCell className="text-right font-semibold">{cap.custoTotal > 0 ? formatCurrency(cap.custoTotal) : '-'}</TableCell>
                  <TableCell className="text-right">{cap.lotes}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
