import { useState } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Package, AlertCircle, CheckCircle, Clock } from 'lucide-react';

export default function RequisicoesCompraPage() {
  const { data: requisicoes = [], isLoading } = useQuery({
    queryKey: ['requisicoes-compra'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('requisicoes_compra')
        .select(`
          id,
          op_id,
          status,
          origem,
          created_at,
          ordens_producao_industrial(codigo),
          requisicoes_compra_itens(
            id,
            item_id,
            item_nome,
            quantidade_necessaria,
            quantidade_disponivel,
            quantidade_faltante,
            unidade
          )
        `)
        .in('status', ['ABERTA', 'PARCIAL'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      ABERTA: { variant: 'destructive', label: 'Aberta', icon: AlertCircle },
      PARCIAL: { variant: 'warning', label: 'Parcial', icon: Clock },
      ATENDIDA: { variant: 'default', label: 'Atendida', icon: CheckCircle },
    };
    const config = variants[status] || variants.ABERTA;
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Requisições de Compra"
        description="Itens necessários para as ordens de produção em stand-by"
      />

      <Tabs defaultValue="aberta" className="space-y-4">
        <TabsList>
          <TabsTrigger value="aberta">Abertas</TabsTrigger>
          <TabsTrigger value="parcial">Parciais</TabsTrigger>
          <TabsTrigger value="todas">Todas</TabsTrigger>
        </TabsList>

        <TabsContent value="aberta" className="space-y-4">
          {requisicoes.filter((r: any) => r.status === 'ABERTA').map((req: any) => (
            <RequisicaoCard key={req.id} requisicao={req} />
          ))}
        </TabsContent>

        <TabsContent value="parcial" className="space-y-4">
          {requisicoes.filter((r: any) => r.status === 'PARCIAL').map((req: any) => (
            <RequisicaoCard key={req.id} requisicao={req} />
          ))}
        </TabsContent>

        <TabsContent value="todas" className="space-y-4">
          {requisicoes.map((req: any) => (
            <RequisicaoCard key={req.id} requisicao={req} />
          ))}
        </TabsContent>
      </Tabs>

      {requisicoes.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Nenhuma requisição de compra aberta</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function RequisicaoCard({ requisicao }: { requisicao: any }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">
              OP {requisicao.ordens_producao_industrial?.codigo || 'N/A'}
            </CardTitle>
            <CardDescription>Requisição #{requisicao.id.slice(0, 8)}</CardDescription>
          </div>
          {requisicao.status === 'ABERTA' ? (
            <Badge variant="destructive">Aberta</Badge>
          ) : (
            <Badge variant="warning">Parcial</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Necessário</TableHead>
                <TableHead className="text-right">Disponível</TableHead>
                <TableHead className="text-right">Faltante</TableHead>
                <TableHead>Unidade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requisicao.requisicoes_compra_itens?.map((item: any) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.item_nome}</TableCell>
                  <TableCell className="text-right">{item.quantidade_necessaria.toFixed(2)}</TableCell>
                  <TableCell className="text-right">{item.quantidade_disponivel.toFixed(2)}</TableCell>
                  <TableCell className="text-right">
                    <span className="text-red-600 font-semibold">
                      {item.quantidade_faltante.toFixed(2)}
                    </span>
                  </TableCell>
                  <TableCell>{item.unidade}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              Total de itens faltantes: {requisicao.requisicoes_compra_itens?.length || 0}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
