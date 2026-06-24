import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Factory, Search, Plus, Play, Check, Eye, 
  RefreshCw, Package, Calendar, AlertTriangle, 
  Lock, XCircle, Clock, Scale, Beaker, UserCheck,
  ClipboardCheck, QrCode
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CriarOPDialogMaster } from '@/components/producao/CriarOPDialogMaster';
import { AtribuirClienteWhiteLabelDialog } from '@/components/producao/AtribuirClienteWhiteLabelDialog';
import { AdminCleanupButton } from "@/components/admin/AdminCleanupButton";
import { useQueryClient } from '@tanstack/react-query';
import type { StatusOP } from '@/types/op-industrial';

interface OrdemProducaoDisplay {
  id: string;
  codigo: string;
  produto_nome: string;
  formula_id?: string;
  formula_codigo?: string;
  formula_versao?: number;
  quantidade_frascos: number;
  capsulas_por_frasco: number;
  total_capsulas: number;
  total_capsulas_com_acrescimo: number;
  acrescimo_percentual: number;
  lote_produto_acabado: string;
  lote_produto_acabado_id?: string;
  loteId?: string;
  tipo_op?: string;
  data_fabricacao: string;
  data_validade: string;
  tipo_capsula: string;
  excipiente_base: string;
  status: StatusOP;
  responsavel_producao_nome?: string;
  responsavel_tecnico_id?: string;
  rt_nome?: string;
  rt_tipo_conselho?: string;
  rt_numero_registro?: string;
  assinatura_rt_id?: string;
  qr_code_lote?: string;
  observacoes?: string;
  created_at: string;
  updated_at: string;
}

interface ClienteWhiteLabelOption {
  id: string;
  nome: string;
}

export default function OrdensProducaoIndustrialPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');          // valor digitado, imediato (UI)
  const [searchTerm, setSearchTerm] = useState('');   // valor debounced, usado na query
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterClienteId, setFilterClienteId] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');  // yyyy-mm-dd, vazio = sem limite
  const [dateTo, setDateTo] = useState<string>('');
  const [page, setPage] = useState(0);                // 0-indexed
  const [totalCount, setTotalCount] = useState(0);
  const PAGE_SIZE = 25;
  const [ordens, setOrdens] = useState<OrdemProducaoDisplay[]>([]);
  // Stats SEMPRE globais (só company_id via RLS) — nunca aplicam filterStatus,
  // senão os cards passam a ecoar o filtro ativo em vez de mostrar a visão
  // geral real (ex: filtrar "Bloqueadas" zerava todos os outros cards).
  const [statsOrdens, setStatsOrdens] = useState<{ status: StatusOP }[]>([]);
  const [clientesWhiteLabel, setClientesWhiteLabel] = useState<ClienteWhiteLabelOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogCriarOpen, setDialogCriarOpen] = useState(false);
  const [whiteLabelLote, setWhiteLabelLote] = useState<{loteId: string, loteNumero?: string, produtoNome?: string} | null>(null);

  // Debounce da busca — espera 400ms de pausa na digitação antes de consultar
  // o banco. Sem isso, cada tecla dispararia uma query nova.
  useEffect(() => {
    const t = setTimeout(() => setSearchTerm(search.trim()), 400);
    return () => clearTimeout(t);
  }, [search]);

  // Qualquer mudança de filtro/busca/período volta pra primeira página —
  // senão o usuário pode ficar "preso" numa página 5 que não existe mais
  // depois de filtrar pra um conjunto menor de resultados.
  useEffect(() => {
    setPage(0);
  }, [searchTerm, filterStatus, filterClienteId, dateFrom, dateTo]);

  // Atalhos de período — não força nenhum default (ficaria fácil esconder
  // dados sem querer); o usuário escolhe quando quer limitar.
  const aplicarPeriodoRapido = (dias: number | null) => {
    if (dias === null) {
      setDateFrom('');
      setDateTo('');
      return;
    }
    const hoje = new Date();
    const inicio = new Date();
    inicio.setDate(hoje.getDate() - dias);
    setDateFrom(inicio.toISOString().slice(0, 10));
    setDateTo(hoje.toISOString().slice(0, 10));
  };

  // Carrega a lista de clientes White Label que já têm algum lote atribuído
  // — só clientes com OP de fato aparecem no filtro, não a lista inteira de entidades.
  const carregarClientesWhiteLabel = useCallback(async () => {
    const { data, error } = await supabase
      .from('lotes_produto_acabado')
      .select('white_label_cliente_id, entidades:white_label_cliente_id(id, nome_fantasia, razao_social)')
      .not('white_label_cliente_id', 'is', null);

    if (error || !data) return;

    const vistos = new Map<string, string>();
    for (const row of data as any[]) {
      const ent = row.entidades;
      if (ent?.id && !vistos.has(ent.id)) {
        vistos.set(ent.id, ent.nome_fantasia || ent.razao_social || 'Cliente sem nome');
      }
    }
    setClientesWhiteLabel(Array.from(vistos, ([id, nome]) => ({ id, nome })));
  }, []);

  // Buscar OPs do Supabase
  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1) Stats — SEMPRE sem filtro nenhum (nem status, nem busca, nem período),
      // pra refletir a visão geral real da empresa, não do que está na tela.
      const { data: statsData, error: statsError } = await supabase
        .from('ordens_producao_industrial')
        .select('status');
      if (statsError) {
        console.error('Erro ao buscar stats de OPs:', statsError);
      } else {
        setStatsOrdens((statsData || []) as { status: StatusOP }[]);
      }

      // 2) Lista filtrada e paginada.
      let query = supabase
        .from('ordens_producao_industrial')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (filterStatus && filterStatus !== 'all') {
        query = query.eq('status', filterStatus);
      }

      // Busca server-side por código ou produto — precisa ser no banco porque
      // com paginação a busca client-side só acharia resultado na página carregada.
      if (searchTerm) {
        query = query.or(`codigo.ilike.%${searchTerm}%,produto_nome.ilike.%${searchTerm}%`);
      }

      // Período por data de fabricação. Sem isso, com BPF retendo histórico
      // pra sempre, a lista só cresce e cada refresh pega tudo de novo.
      if (dateFrom) {
        query = query.gte('data_fabricacao', dateFrom);
      }
      if (dateTo) {
        query = query.lte('data_fabricacao', dateTo);
      }

      // Filtro por cliente White Label: resolve os lotes desse cliente primeiro,
      // já que a OP não guarda cliente_id direto — o vínculo é via lote.
      if (filterClienteId !== 'all') {
        const { data: lotesCliente } = await supabase
          .from('lotes_produto_acabado')
          .select('id')
          .eq('white_label_cliente_id', filterClienteId);
        const loteIds = (lotesCliente || []).map((l: any) => l.id);
        if (loteIds.length === 0) {
          setOrdens([]);
          setTotalCount(0);
          setIsLoading(false);
          return;
        }
        query = query.in('lote_produto_acabado_id', loteIds);
      }

      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error, count } = await query.range(from, to);

      if (error) {
        console.error('Erro ao buscar OPs:', error);
        toast.error('Erro ao carregar ordens de produção');
        setOrdens([]);
        setTotalCount(0);
      } else {
        setOrdens((data || []) as OrdemProducaoDisplay[]);
        setTotalCount(count || 0);
      }
    } catch (err) {
      console.error('Erro ao buscar OPs:', err);
      setOrdens([]);
      setTotalCount(0);
    } finally {
      setIsLoading(false);
    }
  }, [filterStatus, filterClienteId, searchTerm, dateFrom, dateTo, page]);

  useEffect(() => {
    refresh();
    carregarClientesWhiteLabel();
  }, [refresh, carregarClientesWhiteLabel]);

  // Estatísticas — calculadas a partir de statsOrdens (global), nunca de ordens (filtrada)
  const stats = useMemo(() => ({
    total: statsOrdens.length,
    planejadas: statsOrdens.filter(op => op.status === 'PLANEJADA').length,
    aguardando: statsOrdens.filter(op => op.status === 'AGUARDANDO_MATERIAIS').length,
    emProducao: statsOrdens.filter(op => op.status === 'EM_PRODUCAO').length,
    finalizadas: statsOrdens.filter(op => op.status === 'FINALIZADA').length,
    bloqueadas: statsOrdens.filter(op => op.status === 'BLOQUEADA').length,
    canceladas: statsOrdens.filter(op => op.status === 'CANCELADA').length,
  }), [statsOrdens]);

  // Busca agora é server-side (ver refresh) — `ordens` já vem filtrada e
  // paginada do banco, não precisa filtrar de novo no client.
  const ordensFiltradas = ordens;

  const getStatusConfig = (status: StatusOP): { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string; icon: any; className?: string } => {
    const map: Record<StatusOP, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string; icon: any; className?: string }> = {
      PLANEJADA: { variant: 'outline', label: 'Planejada', icon: Calendar, className: 'border-muted-foreground/50' },
      AGUARDANDO_MATERIAIS: { variant: 'outline', label: 'Aguardando', icon: Clock, className: 'border-warning text-warning' },
      EM_PRODUCAO: { variant: 'default', label: 'Em Produção', icon: Play, className: 'bg-primary' },
      FINALIZADA: { variant: 'secondary', label: 'Finalizada', icon: Check, className: 'bg-secondary' },
      BLOQUEADA: { variant: 'destructive', label: 'Bloqueada', icon: Lock },
      CANCELADA: { variant: 'destructive', label: 'Cancelada', icon: XCircle },
    };
    return map[status] || map.PLANEJADA;
  };

  const handleOPCreated = () => {
    toast.success('Ordem de Produção criada com sucesso!');
    refresh();
  };

  return (
    <div>
      <PageHeader
        title="Ordens de Produção Industrial"
        description="Gestão completa de OPs com rastreabilidade ANVISA"
        icon={Factory}
        actions={
          <Button 
            className="bg-primary hover:bg-primary/90"
            onClick={() => setDialogCriarOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Criar OP
          </Button>
        }
      />

      {/* Info Industrial */}
      <Card className="mb-6 bg-muted/30 border-muted">
        <CardContent className="p-4 text-sm text-muted-foreground flex items-start gap-3">
          <Beaker className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="space-y-2">
            <p>
              <strong className="text-foreground">Motor OP MASTER - Sistema Industrial ANVISA:</strong>
            </p>
            <ul className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
              <li>✓ OP Manual ou baseada em Fórmula</li>
              <li>✓ Acréscimo industrial automático (+5%)</li>
              <li>✓ Lista de pesagem em ordem fixa</li>
              <li>✓ Pesagem crítica com dupla conferência</li>
              <li>✓ Checklist industrial obrigatório</li>
              <li>✓ Excipientes tecnológicos automáticos</li>
              <li>✓ Responsável Técnico vinculado</li>
              <li>✓ QR Code de rastreabilidade</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Cards de estatísticas */}
      <div className="grid grid-cols-7 gap-4 mb-6">
        <Card className="border-border">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </CardContent>
        </Card>
        <Card className="border-muted-foreground/30">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{stats.planejadas}</div>
            <div className="text-xs text-muted-foreground">Planejadas</div>
          </CardContent>
        </Card>
        <Card className="border-primary/50">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-primary">{stats.emProducao}</div>
            <div className="text-xs text-muted-foreground">Em Produção</div>
          </CardContent>
        </Card>
        <Card className="border-secondary/50">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-secondary">{stats.finalizadas}</div>
            <div className="text-xs text-muted-foreground">Finalizadas</div>
          </CardContent>
        </Card>
        <Card className="border-destructive/50">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-destructive">{stats.bloqueadas}</div>
            <div className="text-xs text-muted-foreground">Bloqueadas</div>
          </CardContent>
        </Card>
        <Card className="border-warning/50">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-warning">{stats.aguardando}</div>
            <div className="text-xs text-muted-foreground">Aguardando</div>
          </CardContent>
        </Card>
        <Card className="border-muted-foreground/20">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-muted-foreground">{stats.canceladas}</div>
            <div className="text-xs text-muted-foreground">Canceladas</div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por código ou produto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="PLANEJADA">Planejada</SelectItem>
            <SelectItem value="AGUARDANDO_MATERIAIS">Aguardando Materiais</SelectItem>
            <SelectItem value="EM_PRODUCAO">Em Produção</SelectItem>
            <SelectItem value="FINALIZADA">Finalizada</SelectItem>
            <SelectItem value="BLOQUEADA">Bloqueada</SelectItem>
            <SelectItem value="CANCELADA">Cancelada</SelectItem>
          </SelectContent>
        </Select>
        {clientesWhiteLabel.length > 0 && (
          <Select value={filterClienteId} onValueChange={setFilterClienteId}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Cliente White Label" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os clientes</SelectItem>
              {clientesWhiteLabel.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button variant="outline" size="icon" onClick={refresh} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
        <TooltipProvider>
          <AdminCleanupButton
            tableName="ordens_producao_industrial"
            tableLabel="Ordens de Produção"
            cascadeTables={["op_insumos_consumidos", "op_embalagens", "op_etapas", "op_anexos", "op_assinaturas_rt", "custos_op", "lotes_produto_acabado"]}
            dateColumn="created_at"
            onCleanupComplete={refresh}
          />
        </TooltipProvider>
      </div>

      {/* Filtro de período — por data de fabricação. Sem default forçado:
          começa em "Todos os períodos" pra nunca esconder dado sem o usuário pedir. */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <span className="text-sm text-muted-foreground shrink-0">Período (data de fabricação):</span>
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="w-40"
        />
        <span className="text-muted-foreground text-sm">até</span>
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="w-40"
        />
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => aplicarPeriodoRapido(7)}>7 dias</Button>
          <Button variant="ghost" size="sm" onClick={() => aplicarPeriodoRapido(30)}>30 dias</Button>
          <Button variant="ghost" size="sm" onClick={() => aplicarPeriodoRapido(90)}>90 dias</Button>
          <Button variant="ghost" size="sm" onClick={() => aplicarPeriodoRapido(null)}>Todos os períodos</Button>
        </div>
      </div>

      {/* Lista de OPs */}
      {ordensFiltradas.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Factory className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhuma OP encontrada</h3>
            <p className="text-muted-foreground mb-4">
              {search 
                ? 'Tente alterar os filtros de busca' 
                : 'Clique em "Criar OP" para iniciar uma nova ordem de produção'
              }
            </p>
            <Button onClick={() => setDialogCriarOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Nova OP
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Qtd. Frascos</TableHead>
                <TableHead className="text-right">Total Cáps.</TableHead>
                <TableHead>Lote PA</TableHead>
                <TableHead>Data Fab.</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ordensFiltradas.map((op) => {
                const statusConfig = getStatusConfig(op.status);
                const StatusIcon = statusConfig.icon;

                return (
                  <TableRow key={op.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell 
                      className="font-mono font-bold"
                      onClick={() => navigate(`/producao/ordens/${op.id}`)}
                    >
                      {op.codigo}
                      {op.formula_id && (
                        <Scale className="h-3 w-3 inline ml-2 text-primary" />
                      )}
                    </TableCell>
                    <TableCell onClick={() => navigate(`/producao/ordens/${op.id}`)}>
                      <div>
                        <p className="font-medium">{op.produto_nome}</p>
                        {op.formula_codigo && (
                          <p className="text-xs text-muted-foreground">
                            Fórmula: {op.formula_codigo} {op.formula_versao ? `v${op.formula_versao}` : ''}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={statusConfig.variant} className={`gap-1 ${statusConfig.className || ''}`}>
                        <StatusIcon className="h-3 w-3" />
                        {statusConfig.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {op.quantidade_frascos?.toLocaleString() || '-'}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {op.total_capsulas_com_acrescimo?.toLocaleString() || op.total_capsulas?.toLocaleString() || '-'}
                      {op.acrescimo_percentual > 0 && (
                        <span className="text-xs text-muted-foreground ml-1">
                          (+{op.acrescimo_percentual}%)
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono">{op.lote_produto_acabado || '-'}</TableCell>
                    <TableCell>
                      {op.data_fabricacao 
                        ? new Date(op.data_fabricacao).toLocaleDateString('pt-BR')
                        : '-'
                      }
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate">
                      {op.responsavel_producao_nome || '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {op.tipo_op === 'WHITE_LABEL' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-primary text-primary hover:bg-primary/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              const lid = op.lote_produto_acabado_id || op.loteId;
                              if (lid) {
                                setWhiteLabelLote({
                                  loteId: lid,
                                  loteNumero: op.lote_produto_acabado,
                                  produtoNome: op.produto_nome
                                });
                              } else {
                                toast.error('Lote não identificado para esta OP.');
                              }
                            }}
                          >
                            <Package className="h-4 w-4 mr-1" />
                            Atribuir Cliente
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/producao/ordens/${op.id}`)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Ver
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Paginação — server-side, 25 por página. Sem isso a tabela carrega
          tudo de uma vez e só piora conforme o histórico de OPs cresce. */}
      {totalCount > 0 && (
        <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
          <div>
            Mostrando {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} de {totalCount} OPs
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Anterior
            </Button>
            <span>Página {page + 1} de {Math.max(1, Math.ceil(totalCount / PAGE_SIZE))}</span>
            <Button
              variant="outline"
              size="sm"
              disabled={(page + 1) * PAGE_SIZE >= totalCount}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}

      {/* Dialog Criar OP */}
      <CriarOPDialogMaster
        open={dialogCriarOpen}
        onOpenChange={setDialogCriarOpen}
        onSuccess={handleOPCreated}
      />

      <AtribuirClienteWhiteLabelDialog 
        open={!!whiteLabelLote} 
        onOpenChange={(v) => !v && setWhiteLabelLote(null)} 
        loteId={whiteLabelLote?.loteId || ''} 
        loteNumero={whiteLabelLote?.loteNumero} 
        produtoNome={whiteLabelLote?.produtoNome} 
        onSuccess={() => { 
          setWhiteLabelLote(null); 
          refresh();
          queryClient.invalidateQueries({ queryKey: ['ordens-producao'] }); 
        }} 
      />
    </div>
  );
}
