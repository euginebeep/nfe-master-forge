import { useRef, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ShoppingCart, RefreshCw, CheckCircle2, AlertTriangle, ExternalLink,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { OPMateriaPrima } from '@/types/op-industrial';
import { somarEstoquePorItem, formatarQtdDeGramas } from '@/lib/conferencia-materiais';
import { setOpStatusAguardandoCompra } from '@/lib/op-status-update';

interface OPTabConferenciaMateriaisProps {
  opId: string;
  opStatus: string;
  materiasPrimas: OPMateriaPrima[];
  onRefresh: () => void;
}

interface LinhaOp {
  insumoId: string | undefined;
  insumoNome: string;
  necessarioG: number;
  estoqueG: number;
  faltaG: number;
  ok: boolean;
}

interface RequisicaoOP {
  id: string;
  numero_interno?: string | null;
}

export function OPTabConferenciaMateriais({
  opId,
  opStatus,
  materiasPrimas,
  onRefresh,
}: OPTabConferenciaMateriaisProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isGerando, setIsGerando] = useState(false);
  const [requisicaoLocal, setRequisicaoLocal] = useState<RequisicaoOP | null>(null);

  const itemIds = useMemo(
    () => [...new Set(materiasPrimas.map(mp => mp.insumo_id).filter(Boolean))] as string[],
    [materiasPrimas],
  );

  const { data: dadosExtras, isLoading } = useQuery({
    queryKey: ['op-conferencia-materiais', opId, itemIds],
    enabled: itemIds.length > 0,
    queryFn: async () => {
      const [lotesRes, reqRes] = await Promise.all([
        supabase
          .from('estoque_lotes')
          .select('item_id, quantidade_interna')
          .in('item_id', itemIds)
          .in('status', ['DISPONIVEL', 'QUARENTENA']),
        supabase
          .from('requisicoes_compra')
          .select('id, numero_interno')
          .eq('op_id', opId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      return {
        estoqueMap: somarEstoquePorItem(lotesRes.data || []),
        requisicao: reqRes.data as RequisicaoOP | null,
      };
    },
  });

  const requisicao = requisicaoLocal ?? dadosExtras?.requisicao ?? null;

  const linhas: LinhaOp[] = useMemo(() => {
    const estoqueMap = dadosExtras?.estoqueMap ?? {};

    return materiasPrimas.map(mp => {
      const necessarioG = mp.quantidade_teorica_g || 0;
      const estoqueG = mp.insumo_id ? (estoqueMap[mp.insumo_id] || 0) : 0;
      const faltaG = Math.max(necessarioG - estoqueG, 0);

      return {
        insumoId: mp.insumo_id,
        insumoNome: mp.insumo_nome,
        necessarioG,
        estoqueG,
        faltaG,
        ok: faltaG <= 0,
      };
    });
  }, [materiasPrimas, dadosExtras]);

  const handleGerarRequisicao = async () => {
    setIsGerando(true);
    try {
      const { data: prep, error: prepErr } = await supabase
        .rpc('preparar_op_materiais', { p_op_id: opId });

      if (prepErr) throw prepErr;

      const itensFaltantes = prep?.itens_para_comprar || 0;
      let usedFallback = false;

      if (itensFaltantes > 0) {
        const result = await setOpStatusAguardandoCompra(opId);
        usedFallback = result.usedFallback;
      }

      let numeroInterno = '';
      if (prep?.requisicao_id) {
        const { data: reqData } = await supabase
          .from('requisicoes_compra')
          .select('id, numero_interno')
          .eq('id', prep.requisicao_id)
          .single();

        if (reqData) {
          setRequisicaoLocal(reqData as RequisicaoOP);
          numeroInterno = reqData.numero_interno || '';
        }
      }

      queryClient.invalidateQueries({ queryKey: ['op-conferencia-materiais', opId] });
      onRefresh();

      if (itensFaltantes > 0) {
        const baseMsg = numeroInterno
          ? `Requisição ${numeroInterno} gerada — ${itensFaltantes} insumo(s) para comprar`
          : `Requisição gerada — ${itensFaltantes} insumo(s) para comprar`;
        toast.success(usedFallback ? `${baseMsg} (status: Aguardando Materiais)` : baseMsg);
      } else {
        toast.success('Materiais conferidos — estoque suficiente');
      }
    } catch (err: unknown) {
      const e = err as { message?: string; code?: string };
      toast.error(e?.message || e?.code || 'Erro ao gerar requisição');
    } finally {
      setIsGerando(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Conferência de Materiais
              </CardTitle>
              <CardDescription>
                Necessário × estoque × falta — cotação e compra no setor de Compras
              </CardDescription>
            </div>
            <Button onClick={handleGerarRequisicao} disabled={isGerando}>
              <RefreshCw className={cn('h-4 w-4 mr-2', isGerando && 'animate-spin')} />
              {isGerando ? 'Gerando...' : 'Gerar requisição'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {requisicao?.numero_interno && (
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg mb-4">
              <Badge variant="outline" className="font-mono text-sm">
                {requisicao.numero_interno}
              </Badge>
              <span className="text-sm text-muted-foreground">Requisição de compra vinculada</span>
              <Button
                variant="link"
                size="sm"
                className="ml-auto p-0 h-auto"
                onClick={() => navigate('/compras/requisicoes')}
              >
                Ver requisições
                <ExternalLink className="h-3 w-3 ml-1" />
              </Button>
            </div>
          )}

          {(opStatus === 'AGUARDANDO_COMPRA' || opStatus === 'AGUARDANDO_MATERIAIS') && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg mb-4 text-sm text-amber-800">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              OP aguardando {opStatus === 'AGUARDANDO_COMPRA' ? 'compra de materiais' : 'materiais'}
            </div>
          )}

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando estoque...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Insumo</TableHead>
                  <TableHead className="text-right">Necessário</TableHead>
                  <TableHead className="text-right">Em estoque</TableHead>
                  <TableHead className="text-right">Falta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhas.map((linha, idx) => (
                  <TableRow
                    key={linha.insumoId || idx}
                    className={cn(linha.ok ? 'bg-green-50/50' : 'bg-red-50/50')}
                  >
                    <TableCell className="font-medium">{linha.insumoNome}</TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatarQtdDeGramas(linha.necessarioG)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatarQtdDeGramas(linha.estoqueG)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {linha.ok ? (
                        <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          OK
                        </Badge>
                      ) : (
                        <span className="text-red-600 font-semibold">
                          {formatarQtdDeGramas(linha.faltaG)}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
