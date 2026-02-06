import { useState } from 'react';
import { 
  Package, Search, Check, AlertTriangle, Calendar, 
  ArrowRight, ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useLotes } from '@/hooks/use-lotes';
import { ItemPesagem, AlocacaoLoteOP } from '@/types/ordem-producao-industrial';

interface PickListLotesProps {
  itensPesagem: ItemPesagem[];
  alocacoesExistentes: AlocacaoLoteOP[];
  onAlocarLote: (
    insumoId: string,
    insumoNome: string,
    loteId: string,
    numeroLote: string,
    fornecedorNome: string,
    quantidade: number,
    custoUnitario: number
  ) => void;
}

export function PickListLotes({ itensPesagem, alocacoesExistentes, onAlocarLote }: PickListLotesProps) {
  const [dialogItem, setDialogItem] = useState<ItemPesagem | null>(null);
  const [search, setSearch] = useState('');
  
  const { data: lotes, isLoading } = useLotes({ status: 'DISPONIVEL' });

  // Itens que precisam de alocação (apenas ativos, não tecnológicos/veículo)
  const itensParaAlocar = itensPesagem.filter(
    item => item.categoria === 'ATIVO' || item.categoria === 'PREMIX'
  );

  // Verificar se item já está alocado
  const isAlocado = (insumoId?: string) => {
    if (!insumoId) return false;
    return alocacoesExistentes.some(a => a.insumo_id === insumoId);
  };

  // Filtrar lotes para o item selecionado
  const lotesFiltrados = dialogItem && lotes
    ? lotes.filter(lote => {
        // Filtrar por item_id se disponível
        if (dialogItem.insumo_id && lote.item_id !== dialogItem.insumo_id) return false;
        
        // Filtrar por busca
        if (search) {
          const searchLower = search.toLowerCase();
          return (
            lote.numero_lote.toLowerCase().includes(searchLower) ||
            lote.item?.descricao_interna.toLowerCase().includes(searchLower) ||
            lote.fornecedor?.razao_social.toLowerCase().includes(searchLower)
          );
        }
        return true;
      })
    : [];

  // Ordenar por validade (FIFO)
  const lotesSorted = [...lotesFiltrados].sort((a, b) => {
    if (!a.data_val) return 1;
    if (!b.data_val) return -1;
    return new Date(a.data_val).getTime() - new Date(b.data_val).getTime();
  });

  const handleAlocar = (lote: any) => {
    if (!dialogItem || !dialogItem.insumo_id) return;
    
    onAlocarLote(
      dialogItem.insumo_id,
      dialogItem.insumo_nome,
      lote.id,
      lote.numero_lote,
      lote.fornecedor?.razao_social || 'N/A',
      dialogItem.quantidade_lote_g,
      lote.custo_unitario_interno || 0
    );
    
    setDialogItem(null);
    setSearch('');
  };

  const getDiasParaVencer = (dataVal?: string) => {
    if (!dataVal) return null;
    const hoje = new Date();
    const validade = new Date(dataVal);
    const diffTime = validade.getTime() - hoje.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5 text-secondary" />
          Pick List por Lote
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          Aloque lotes específicos para cada insumo. O sistema sugere alocação FIFO (por validade).
        </p>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Insumo</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead className="text-right">Qtd. Necessária</TableHead>
              <TableHead>Lote Alocado</TableHead>
              <TableHead>Fornecedor</TableHead>
              <TableHead className="text-right">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {itensParaAlocar.map((item) => {
              const alocacao = alocacoesExistentes.find(a => a.insumo_id === item.insumo_id);
              const alocado = !!alocacao;

              return (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">
                    {item.insumo_nome}
                    {item.tipo_pesagem === 'CRITICA' && (
                      <Badge variant="destructive" className="ml-2 text-xs">CRÍTICO</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{item.categoria}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {item.quantidade_lote_g.toFixed(4)} g
                  </TableCell>
                  <TableCell>
                    {alocado ? (
                      <Badge variant="secondary" className="font-mono">
                        {alocacao.numero_lote}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {alocado ? alocacao.fornecedor_nome : '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    {alocado ? (
                      <Badge variant="secondary">
                        <Check className="h-3 w-3 mr-1" />
                        Alocado
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDialogItem(item)}
                      >
                        Selecionar Lote
                        <ArrowRight className="h-4 w-4 ml-1" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        {/* Dialog de seleção de lote */}
        <Dialog open={!!dialogItem} onOpenChange={() => { setDialogItem(null); setSearch(''); }}>
          <DialogContent className="max-w-4xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Selecionar Lote para: {dialogItem?.insumo_nome}
              </DialogTitle>
              <DialogDescription>
                Quantidade necessária: {dialogItem?.quantidade_lote_g.toFixed(4)} g
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar lote, produto ou fornecedor..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <ScrollArea className="h-[400px]">
                {isLoading ? (
                  <p className="text-center text-muted-foreground py-8">Carregando lotes...</p>
                ) : lotesSorted.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhum lote disponível encontrado
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Lote</TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead>Fornecedor</TableHead>
                        <TableHead className="text-center">Validade</TableHead>
                        <TableHead className="text-right">Disponível</TableHead>
                        <TableHead className="text-right">Custo/g</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lotesSorted.map((lote, idx) => {
                        const dias = getDiasParaVencer(lote.data_val);
                        const sugerido = idx === 0; // Primeiro é FIFO

                        return (
                          <TableRow 
                            key={lote.id}
                            className={sugerido ? 'bg-secondary/10' : ''}
                          >
                            <TableCell className="font-mono font-bold">
                              {lote.numero_lote}
                              {sugerido && (
                                <Badge className="ml-2" variant="secondary">FIFO</Badge>
                              )}
                            </TableCell>
                            <TableCell>{lote.item?.descricao_interna}</TableCell>
                            <TableCell>{lote.fornecedor?.razao_social || '-'}</TableCell>
                            <TableCell className="text-center">
                              {lote.data_val ? (
                                <div className="flex items-center justify-center gap-2">
                                  <Calendar className="h-4 w-4 text-muted-foreground" />
                                  {new Date(lote.data_val).toLocaleDateString('pt-BR')}
                                  {dias !== null && dias <= 90 && (
                                    <Badge 
                                      variant={dias <= 30 ? 'destructive' : 'outline'}
                                      className={`text-xs ${dias > 30 ? 'bg-yellow-100 text-yellow-800 border-yellow-300' : ''}`}
                                    >
                                      {dias}d
                                    </Badge>
                                  )}
                                </div>
                              ) : (
                                '-'
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {lote.quantidade_interna.toFixed(2)} {lote.item?.unidade_interna || 'g'}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {lote.custo_unitario_interno 
                                ? `R$ ${lote.custo_unitario_interno.toFixed(4)}`
                                : '-'
                              }
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                onClick={() => handleAlocar(lote)}
                                disabled={lote.quantidade_interna < (dialogItem?.quantidade_lote_g || 0)}
                              >
                                <Check className="h-4 w-4 mr-1" />
                                Alocar
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </ScrollArea>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => { setDialogItem(null); setSearch(''); }}>
                Cancelar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
