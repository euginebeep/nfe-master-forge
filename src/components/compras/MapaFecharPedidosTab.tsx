import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Package } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { nomeFornecedor } from '@/components/compras/ItemCotacaoGrade';
import type { MapaItemConsolidado } from '@/hooks/use-mapa-consolidado';
import { useAprovarCompraFornecedor } from '@/hooks/use-pedidos-compra';
import { formatCurrency } from '@/lib/formatters';
import { formatarQtdItem } from '@/lib/requisicoes-compra';

interface LinhaPedidoFornecedor {
  itemId: string;
  itemNome: string;
  quantidade: number;
  unidade: string;
  precoUnitario: number;
  subtotal: number;
  freteLinha: number;
}

export interface GrupoFornecedorPedido {
  fornecedorId: string;
  fornecedorNome: string;
  linhas: LinhaPedidoFornecedor[];
  frete: number;
  totalItens: number;
  totalPedido: number;
}

export function agruparItensDecididosPorFornecedor(
  itensMapa: MapaItemConsolidado[],
): GrupoFornecedorPedido[] {
  const map = new Map<string, GrupoFornecedorPedido>();

  for (const entrada of itensMapa) {
    for (const cot of entrada.cotacoes) {
      const qtd = cot.qtd_alocada ?? 0;
      if (qtd <= 0 || cot.preco_unitario == null) continue;

      const subtotal = qtd * cot.preco_unitario;
      const freteLinha = cot.frete ?? 0;
      const unidade = cot.unidade_compra || entrada.necessidade.unidade || 'kg';

      const forn = entrada.fornecedores.find((f) => f.fornecedor_id === cot.fornecedor_id);
      const fornecedorNome = forn ? nomeFornecedor(forn) : 'Fornecedor';

      let grupo = map.get(cot.fornecedor_id);
      if (!grupo) {
        grupo = {
          fornecedorId: cot.fornecedor_id,
          fornecedorNome,
          linhas: [],
          frete: 0,
          totalItens: 0,
          totalPedido: 0,
        };
        map.set(cot.fornecedor_id, grupo);
      }

      grupo.linhas.push({
        itemId: entrada.necessidade.item_id,
        itemNome: entrada.necessidade.item_nome,
        quantidade: qtd,
        unidade,
        precoUnitario: cot.preco_unitario,
        subtotal,
        freteLinha,
      });
      grupo.frete = Math.max(grupo.frete, freteLinha);
      grupo.totalItens += subtotal;
    }
  }

  for (const grupo of map.values()) {
    grupo.totalPedido = grupo.totalItens + grupo.frete;
  }

  return [...map.values()].sort((a, b) =>
    a.fornecedorNome.localeCompare(b.fornecedorNome, 'pt-BR'),
  );
}

interface MapaFecharPedidosTabProps {
  itensMapa: MapaItemConsolidado[];
}

export function MapaFecharPedidosTab({ itensMapa }: MapaFecharPedidosTabProps) {
  const navigate = useNavigate();
  const aprovarFornecedor = useAprovarCompraFornecedor();
  const [gerandoFornecedorId, setGerandoFornecedorId] = useState<string | null>(null);

  const grupos = useMemo(
    () => agruparItensDecididosPorFornecedor(itensMapa),
    [itensMapa],
  );

  const handleGerarPedido = async (fornecedorId: string) => {
    setGerandoFornecedorId(fornecedorId);
    try {
      const result = await aprovarFornecedor.mutateAsync(fornecedorId);
      navigate(`/compras/pedidos/${result.pedido_id}`);
    } catch {
      // toast exibido pelo onError da mutation
    } finally {
      setGerandoFornecedorId(null);
    }
  };

  if (grupos.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-sm text-muted-foreground space-y-2">
          <Package className="h-10 w-10 mx-auto opacity-40" />
          <p>Alocar fornecedores na aba Comparar para fechar pedidos aqui.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {grupos.map((grupo) => {
        const gerando = gerandoFornecedorId === grupo.fornecedorId && aprovarFornecedor.isPending;

        return (
          <Card key={grupo.fornecedorId}>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">{grupo.fornecedorNome}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {grupo.linhas.length} item{grupo.linhas.length !== 1 ? 's' : ''}
                    {' · '}
                    Frete: {formatCurrency(grupo.frete)}
                  </p>
                </div>
                <p className="text-lg font-bold tabular-nums">
                  {formatCurrency(grupo.totalPedido)}
                </p>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Quantidade</TableHead>
                      <TableHead className="text-right">Preço unit.</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {grupo.linhas.map((linha) => (
                      <TableRow key={linha.itemId}>
                        <TableCell className="font-medium">{linha.itemNome}</TableCell>
                        <TableCell className="tabular-nums whitespace-nowrap">
                          {formatarQtdItem(linha.quantidade, linha.unidade)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(linha.precoUnitario)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {formatCurrency(linha.subtotal)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {grupo.frete > 0 && (
                      <TableRow className="bg-muted/30">
                        <TableCell colSpan={3} className="text-sm text-muted-foreground">
                          Frete (máx. entre itens)
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {formatCurrency(grupo.frete)}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
            <CardFooter className="border-t pt-4">
              <Button
                onClick={() => handleGerarPedido(grupo.fornecedorId)}
                disabled={gerando || aprovarFornecedor.isPending}
              >
                {gerando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Gerar pedido do {grupo.fornecedorNome}
              </Button>
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}
