import { useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Copy, Download, Loader2, Printer } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EnviarFornecedorMenu } from '@/components/compras/EnviarFornecedorMenu';
import { imprimirListaPura } from '@/components/compras/ListaPuraCompraPanel';
import { usePedidoCompra, useMarcarPedidoEnviado } from '@/hooks/use-pedidos-compra';
import { useCompanyBranding } from '@/hooks/use-company-branding';
import { useHybridEntidade } from '@/hooks/use-hybrid-data';
import { contatoFornecedor } from '@/lib/fornecedor-contato-envio';
import { formatCurrency, formatDate } from '@/lib/formatters';
import {
  buildTextoPedidoCompra,
  calcularFretePedido,
  textoQuantidadeItem,
} from '@/lib/pedido-compra-documento';
import { toast } from 'sonner';

function formatEnviadoEm(date: string | null | undefined): string | null {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function statusBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  const s = (status || '').toUpperCase();
  if (s === 'CANCELADO') return 'destructive';
  if (s === 'RECEBIDO' || s === 'CONCLUIDO') return 'default';
  if (s === 'ENVIADO') return 'secondary';
  return 'outline';
}

export default function PedidoCompraDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const printRef = useRef<HTMLDivElement>(null);
  const { data, isLoading, isError, error } = usePedidoCompra(id);
  const { data: branding } = useCompanyBranding();
  const { data: fornecedor } = useHybridEntidade(data?.pedido.fornecedor_id ?? undefined);
  const marcarEnviado = useMarcarPedidoEnviado();

  const razaoSocial = branding?.razao_social || 'Empresa';
  const endereco = branding?.endereco || '';
  const cnpj = branding?.cnpj;

  const documento = useMemo(() => {
    if (!data) return null;
    const { pedido, itens } = data;
    const frete = calcularFretePedido(pedido.valor_total, itens, pedido.frete);
    const condicaoPrazo = [pedido.prazo_entrega, pedido.observacao]
      .filter(Boolean)
      .join(' · ') || null;

    return {
      frete,
      condicaoPrazo,
      texto: buildTextoPedidoCompra({
        razaoSocial,
        endereco,
        cnpj,
        numeroInterno: pedido.numero_interno,
        dataEmissao: formatDate(pedido.emitido_em),
        fornecedorNome: pedido.fornecedor_nome,
        itens,
        frete,
        valorTotal: pedido.valor_total,
        condicaoPrazo,
      }),
      assuntoEmail: `Pedido de Compra ${pedido.numero_interno} - ${razaoSocial}`,
    };
  }, [data, razaoSocial, endereco, cnpj]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        Carregando pedido…
      </div>
    );
  }

  if (isError || !data || !documento) {
    const e = error as { message?: string; code?: string };
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate('/compras/pedidos')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <p className="text-sm text-muted-foreground text-center py-8">
          {e?.message || e?.code || 'Pedido de compra não encontrado'}
        </p>
      </div>
    );
  }

  const { pedido, itens } = data;
  const { frete, condicaoPrazo, texto, assuntoEmail } = documento;
  const contato = contatoFornecedor(fornecedor);
  const enviadoEm = formatEnviadoEm(pedido.pedido_enviado_em);

  const handleImprimir = () => imprimirListaPura(printRef.current);

  const handleCopiarTexto = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success('Pedido copiado para a área de transferência');
    } catch {
      toast.error('Não foi possível copiar o texto');
    }
  };

  const handleBaixarImagem = async () => {
    if (!printRef.current) return;
    try {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(printRef.current, {
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      });
      const link = document.createElement('a');
      link.download = `pedido-${pedido.numero_interno.replace(/[^a-zA-Z0-9-]/g, '')}.png`;
      link.href = dataUrl;
      link.click();
      toast.success('Imagem baixada');
    } catch (err: unknown) {
      const e = err as { message?: string; code?: string };
      toast.error(e?.message || e?.code || 'Erro ao gerar imagem');
    }
  };

  const handleRegistrarEnvio = async () => {
    await marcarEnviado.mutateAsync(pedido.id);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 no-print">
        <Button variant="ghost" size="sm" onClick={() => navigate('/compras/pedidos')}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Voltar
        </Button>
      </div>

      <PageHeader
        title={`Pedido ${pedido.numero_interno}`}
        description={`Emitido em ${formatDate(pedido.emitido_em)} · ${pedido.fornecedor_nome}`}
      />

      {enviadoEm && (
        <Badge variant="secondary" className="text-xs">
          Enviado em {enviadoEm}
        </Badge>
      )}

      <div className="flex flex-col sm:flex-row flex-wrap gap-2 no-print">
        <Button variant="outline" onClick={handleCopiarTexto} className="flex-1 min-w-[140px]">
          <Copy className="h-4 w-4 mr-2" />
          Copiar
        </Button>
        <Button variant="outline" onClick={handleBaixarImagem} className="flex-1 min-w-[140px]">
          <Download className="h-4 w-4 mr-2" />
          Baixar PNG
        </Button>
        <Button variant="outline" onClick={handleImprimir} className="flex-1 min-w-[140px]">
          <Printer className="h-4 w-4 mr-2" />
          Imprimir
        </Button>
        <EnviarFornecedorMenu
          contato={contato}
          texto={texto}
          assuntoEmail={assuntoEmail}
          onEnviado={handleRegistrarEnvio}
        />
      </div>

      <Card>
        <CardContent className="p-6 space-y-6">
          <div ref={printRef} className="space-y-6 bg-white text-foreground">
            <div className="flex flex-wrap justify-between gap-4 border-b pb-4">
              <div className="space-y-1 min-w-0">
                {branding?.logo_url && (
                  <img
                    src={branding.logo_url}
                    alt=""
                    className="h-10 mb-2 object-contain"
                  />
                )}
                <p className="font-semibold text-base">{razaoSocial}</p>
                {cnpj && <p className="text-xs text-muted-foreground">CNPJ {cnpj}</p>}
                {endereco && <p className="text-xs text-muted-foreground">{endereco}</p>}
              </div>
              <div className="text-right space-y-1">
                <p className="font-bold text-lg">PEDIDO DE COMPRA</p>
                <p className="font-mono text-sm">{pedido.numero_interno}</p>
                <p className="text-sm text-muted-foreground">
                  {formatDate(pedido.emitido_em)}
                </p>
                <Badge variant={statusBadgeVariant(pedido.status)} className="mt-1">
                  {pedido.status}
                </Badge>
              </div>
            </div>

            <div className="rounded-md border p-4 bg-muted/30">
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                Fornecedor destino
              </p>
              <p className="font-medium">{pedido.fornecedor_nome}</p>
            </div>

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
                {itens.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      Nenhum item neste pedido
                    </TableCell>
                  </TableRow>
                ) : (
                  itens.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.item_nome}</TableCell>
                      <TableCell className="text-sm">{textoQuantidadeItem(item)}</TableCell>
                      <TableCell className="text-right">
                        {item.preco_unitario != null
                          ? formatCurrency(item.preco_unitario)
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {item.subtotal != null ? formatCurrency(item.subtotal) : '—'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
                {frete > 0 && (
                  <TableRow className="bg-muted/30">
                    <TableCell colSpan={3} className="text-sm text-muted-foreground">
                      Frete
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(frete)}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            <div className="flex flex-wrap justify-between gap-4 border-t pt-4">
              {condicaoPrazo && (
                <div className="text-sm text-muted-foreground max-w-md">
                  <p className="font-medium text-foreground">Condição / Prazo</p>
                  <p>{condicaoPrazo}</p>
                </div>
              )}
              <div className="text-right ml-auto">
                <p className="text-sm text-muted-foreground">Valor total do pedido</p>
                <p className="text-xl font-bold">{formatCurrency(pedido.valor_total)}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
