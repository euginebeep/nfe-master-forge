import { useMemo, useState } from "react";
import { Pill, Download, TrendingUp, TrendingDown, Package } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LocalDb } from "@/lib/local-db";
import { LocalItem, LocalEstoqueLote } from "@/hooks/use-local-itens";
import { formatCurrency } from "@/lib/formatters";

interface CapsulaSummary {
  itemId: string;
  sku: string;
  descricao: string;
  marca: string;
  tamanho: string;
  material: string;
  cor: string;
  fornecedorId?: string;
  fornecedorNome?: string;
  quantidadeTotal: number;
  custoMedio: number;
  custoTotal: number;
  lotes: number;
  ultimaCompra?: string;
}

export default function RelatorioCapsulasPage() {
  const [groupBy, setGroupBy] = useState<'marca' | 'fornecedor' | 'tamanho'>('marca');

  const capsulas = useMemo(() => {
    const itens = LocalDb.getCollection<LocalItem>('itens')
      .filter(i => i.tipo_item === 'CAPSULA' || i.tipo_item === 'CAPSULA_VAZIA');
    
    const lotes = LocalDb.getCollection<LocalEstoqueLote>('estoque_lotes');
    const entidades = LocalDb.getCollection<any>('entidades');

    const summaries: CapsulaSummary[] = [];

    itens.forEach(item => {
      const itemLotes = lotes.filter(l => l.item_id === item.id);
      
      // Agrupar por fornecedor se necessário
      const fornecedoresMap = new Map<string, LocalEstoqueLote[]>();
      
      itemLotes.forEach(lote => {
        const key = lote.fornecedor_id || 'sem_fornecedor';
        if (!fornecedoresMap.has(key)) {
          fornecedoresMap.set(key, []);
        }
        fornecedoresMap.get(key)!.push(lote);
      });

      if (fornecedoresMap.size === 0) {
        // Item sem lotes
        summaries.push({
          itemId: item.id,
          sku: item.sku_interno,
          descricao: item.descricao_interna,
          marca: item.capsula_marca || 'Não informada',
          tamanho: item.capsula_tamanho || '-',
          material: item.capsula_material || '-',
          cor: item.capsula_cor || '-',
          quantidadeTotal: 0,
          custoMedio: 0,
          custoTotal: 0,
          lotes: 0,
        });
      } else {
        fornecedoresMap.forEach((lotesDoFornecedor, fornecedorKey) => {
          const fornecedor = fornecedorKey !== 'sem_fornecedor' 
            ? entidades.find((e: any) => e.id === fornecedorKey) 
            : null;
          
          const quantidadeTotal = lotesDoFornecedor.reduce((acc, l) => acc + l.quantidade_interna, 0);
          const custoTotal = lotesDoFornecedor.reduce((acc, l) => acc + (l.custo_unitario_interno * l.quantidade_interna), 0);
          const custoMedio = quantidadeTotal > 0 ? custoTotal / quantidadeTotal : 0;
          
          const ultimaCompra = lotesDoFornecedor
            .map(l => l.nota_data)
            .filter(Boolean)
            .sort()
            .reverse()[0];

          summaries.push({
            itemId: item.id,
            sku: item.sku_interno,
            descricao: item.descricao_interna,
            marca: item.capsula_marca || 'Não informada',
            tamanho: item.capsula_tamanho || '-',
            material: item.capsula_material || '-',
            cor: item.capsula_cor || '-',
            fornecedorId: fornecedor?.id,
            fornecedorNome: fornecedor?.nome_fantasia || fornecedor?.razao_social || 'Sem fornecedor',
            quantidadeTotal,
            custoMedio,
            custoTotal,
            lotes: lotesDoFornecedor.length,
            ultimaCompra,
          });
        });
      }
    });

    return summaries;
  }, []);

  const grouped = useMemo(() => {
    const groups = new Map<string, CapsulaSummary[]>();
    
    capsulas.forEach(cap => {
      let key = '';
      if (groupBy === 'marca') key = cap.marca;
      else if (groupBy === 'fornecedor') key = cap.fornecedorNome || 'Sem fornecedor';
      else if (groupBy === 'tamanho') key = cap.tamanho === '-' ? 'Não informado' : `Tamanho ${cap.tamanho}`;
      
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(cap);
    });

    return Array.from(groups.entries())
      .map(([name, items]) => ({
        name,
        items,
        totalQtd: items.reduce((acc, i) => acc + i.quantidadeTotal, 0),
        totalCusto: items.reduce((acc, i) => acc + i.custoTotal, 0),
        custoMedio: items.reduce((acc, i) => acc + i.custoTotal, 0) / 
                   Math.max(1, items.reduce((acc, i) => acc + i.quantidadeTotal, 0)),
      }))
      .sort((a, b) => b.totalCusto - a.totalCusto);
  }, [capsulas, groupBy]);

  const totals = useMemo(() => ({
    quantidade: capsulas.reduce((acc, c) => acc + c.quantidadeTotal, 0),
    custo: capsulas.reduce((acc, c) => acc + c.custoTotal, 0),
    items: capsulas.length,
  }), [capsulas]);

  const exportCSV = () => {
    const headers = ['SKU', 'Descrição', 'Marca', 'Tamanho', 'Material', 'Cor', 'Fornecedor', 'Qtd (un)', 'Custo Médio', 'Custo Total', 'Lotes'];
    const rows = capsulas.map(c => [
      c.sku,
      c.descricao,
      c.marca,
      c.tamanho,
      c.material,
      c.cor,
      c.fornecedorNome || '',
      c.quantidadeTotal,
      c.custoMedio.toFixed(6),
      c.custoTotal.toFixed(2),
      c.lotes,
    ]);

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
      <PageHeader
        title="Relatório de Cápsulas"
        description="Análise de custos por fornecedor, marca e tamanho"
        icon={Pill}
        actions={
          <Button onClick={exportCSV} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        }
      />

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total em Estoque</p>
                <p className="text-2xl font-bold">{totals.quantidade.toLocaleString('pt-BR')} un</p>
              </div>
              <Package className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Custo Total</p>
                <p className="text-2xl font-bold">{formatCurrency(totals.custo)}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Custo Médio/un</p>
                <p className="text-2xl font-bold">
                  {totals.quantidade > 0 
                    ? formatCurrency(totals.custo / totals.quantidade)
                    : 'R$ 0,00'}
                </p>
              </div>
              <TrendingDown className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Tipos Cadastrados</p>
                <p className="text-2xl font-bold">{totals.items}</p>
              </div>
              <Pill className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtro de Agrupamento */}
      <div className="flex items-center gap-4 mb-6">
        <span className="text-sm font-medium">Agrupar por:</span>
        <Select value={groupBy} onValueChange={(v) => setGroupBy(v as any)}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="marca">Marca</SelectItem>
            <SelectItem value="fornecedor">Fornecedor</SelectItem>
            <SelectItem value="tamanho">Tamanho</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabela Agrupada */}
      {grouped.map(group => (
        <Card key={group.name} className="mb-4">
          <CardHeader className="py-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{group.name}</CardTitle>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-muted-foreground">
                  {group.totalQtd.toLocaleString('pt-BR')} un
                </span>
                <Badge variant="outline">
                  Custo Médio: {formatCurrency(group.custoMedio)}/un
                </Badge>
                <span className="font-semibold">{formatCurrency(group.totalCusto)}</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Tamanho</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead>Cor</TableHead>
                  {groupBy !== 'fornecedor' && <TableHead>Fornecedor</TableHead>}
                  {groupBy !== 'marca' && <TableHead>Marca</TableHead>}
                  <TableHead className="text-right">Qtd (un)</TableHead>
                  <TableHead className="text-right">Custo/un</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.items.map((cap, idx) => (
                  <TableRow key={`${cap.itemId}-${cap.fornecedorId || idx}`}>
                    <TableCell className="font-mono text-sm">{cap.sku}</TableCell>
                    <TableCell>{cap.descricao}</TableCell>
                    <TableCell>{cap.tamanho !== '-' ? `Tam ${cap.tamanho}` : '-'}</TableCell>
                    <TableCell>{cap.material}</TableCell>
                    <TableCell>{cap.cor}</TableCell>
                    {groupBy !== 'fornecedor' && <TableCell>{cap.fornecedorNome || '-'}</TableCell>}
                    {groupBy !== 'marca' && <TableCell>{cap.marca}</TableCell>}
                    <TableCell className="text-right">{cap.quantidadeTotal.toLocaleString('pt-BR')}</TableCell>
                    <TableCell className="text-right font-mono">
                      {cap.custoMedio > 0 ? formatCurrency(cap.custoMedio) : '-'}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {cap.custoTotal > 0 ? formatCurrency(cap.custoTotal) : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}

      {grouped.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Pill className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Nenhuma cápsula cadastrada ainda. Cadastre cápsulas em Produtos com tipo "Cápsula Vazia".
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
