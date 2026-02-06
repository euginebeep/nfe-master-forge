import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Factory, Search, Plus, Play, Check, Eye, 
  RefreshCw, Package, Calendar, AlertTriangle, 
  Lock, XCircle, Clock, Scale, Beaker
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
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CriarOPDialog } from '@/components/producao/CriarOPDialog';
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
  data_fabricacao: string;
  data_validade: string;
  tipo_capsula: string;
  excipiente_base: string;
  status: StatusOP;
  responsavel_producao_nome?: string;
  observacoes?: string;
  created_at: string;
  updated_at: string;
}

export default function OrdensProducaoIndustrialPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [ordens, setOrdens] = useState<OrdemProducaoDisplay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogCriarOpen, setDialogCriarOpen] = useState(false);

  // Buscar OPs do Supabase
  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('ordens_producao_industrial')
        .select('*')
        .order('created_at', { ascending: false });

      if (filterStatus && filterStatus !== 'all') {
        query = query.eq('status', filterStatus);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Erro ao buscar OPs:', error);
        toast.error('Erro ao carregar ordens de produção');
        setOrdens([]);
      } else {
        setOrdens((data || []) as OrdemProducaoDisplay[]);
      }
    } catch (err) {
      console.error('Erro ao buscar OPs:', err);
      setOrdens([]);
    } finally {
      setIsLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Estatísticas
  const stats = useMemo(() => ({
    total: ordens.length,
    planejadas: ordens.filter(op => op.status === 'PLANEJADA').length,
    aguardando: ordens.filter(op => op.status === 'AGUARDANDO_MATERIAIS').length,
    emProducao: ordens.filter(op => op.status === 'EM_PRODUCAO').length,
    finalizadas: ordens.filter(op => op.status === 'FINALIZADA').length,
    bloqueadas: ordens.filter(op => op.status === 'BLOQUEADA').length,
  }), [ordens]);

  // Filtrar ordens
  const ordensFiltradas = ordens.filter(op => {
    const matchSearch = 
      op.codigo?.toLowerCase().includes(search.toLowerCase()) ||
      op.produto_nome?.toLowerCase().includes(search.toLowerCase());
    return matchSearch;
  });

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
        <CardContent className="p-4 text-sm text-muted-foreground flex items-center gap-3">
          <Beaker className="h-5 w-5 text-primary" />
          <div>
            <strong className="text-foreground">Sistema Industrial ANVISA:</strong> OP é um módulo independente. 
            Pode ser criada manualmente ou vinculada a uma fórmula aprovada. Inclui pick list, 
            pesagem crítica (dupla conferência), ordem de mistura fixa e controle de qualidade.
          </div>
        </CardContent>
      </Card>

      {/* Cards de estatísticas */}
      <div className="grid grid-cols-6 gap-4 mb-6">
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
        <Button variant="outline" size="icon" onClick={refresh} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
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
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/producao/ordens/${op.id}`)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Ver
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Dialog Criar OP */}
      <CriarOPDialog
        open={dialogCriarOpen}
        onOpenChange={setDialogCriarOpen}
        onSuccess={handleOPCreated}
      />
    </div>
  );
}
