import { useState } from 'react';
import { 
  Factory, Search, Filter, Play, Check, Eye, 
  RefreshCw, FlaskConical, Package, Calendar,
  AlertTriangle, Lock, XCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
  useOrdensProducaoIndustrial,
  useOrdemProducaoIndustrialActions,
} from '@/hooks/use-ordem-producao-industrial';
import { StatusOP } from '@/types/ordem-producao-industrial';

export default function OrdensProducaoIndustrialPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const { data: ordens, isLoading, refresh, stats } = useOrdensProducaoIndustrial();
  const actions = useOrdemProducaoIndustrialActions();

  // Filtrar ordens
  const ordensFiltradas = ordens.filter(op => {
    const matchSearch = 
      op.codigo.toLowerCase().includes(search.toLowerCase()) ||
      op.produto_nome.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || op.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const getStatusConfig = (status: StatusOP): { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string; icon: any } => {
    const map: Record<StatusOP, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string; icon: any }> = {
      PLANEJADA: { variant: 'outline', label: 'Planejada', icon: Calendar },
      AGUARDANDO_MATERIAIS: { variant: 'outline', label: 'Aguardando', icon: Package },
      EM_PRODUCAO: { variant: 'default', label: 'Em Produção', icon: Play },
      FINALIZADA: { variant: 'secondary', label: 'Finalizada', icon: Check },
      BLOQUEADA: { variant: 'destructive', label: 'Bloqueada', icon: Lock },
      CANCELADA: { variant: 'destructive', label: 'Cancelada', icon: XCircle },
    };
    return map[status];
  };

  return (
    <div>
      <PageHeader
        title="Ordens de Produção Industrial"
        description="Gestão completa de OPs com rastreabilidade ANVISA"
        icon={Factory}
        actions={
          <Button 
            className="bg-secondary hover:bg-secondary/90"
            onClick={() => navigate('/producao/formulas')}
          >
            <FlaskConical className="h-4 w-4 mr-2" />
            Ir para Fórmulas
          </Button>
        }
      />

      {/* Info */}
      <Card className="mb-6 bg-muted/50">
        <CardContent className="p-4 text-sm text-muted-foreground">
          <strong>Sistema Industrial:</strong> As OPs são geradas automaticamente ao aprovar fórmulas. 
          Inclui pick list por lote, pesagem crítica com dupla conferência, distribuição geométrica e controle de qualidade.
        </CardContent>
      </Card>

      {/* Cards de estatísticas */}
      <div className="grid grid-cols-6 gap-4 mb-6">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </CardContent>
        </Card>
        <Card className="border-muted">
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
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{stats.aguardando}</div>
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
            <SelectItem value="EM_PRODUCAO">Em Produção</SelectItem>
            <SelectItem value="FINALIZADA">Finalizada</SelectItem>
            <SelectItem value="BLOQUEADA">Bloqueada</SelectItem>
            <SelectItem value="CANCELADA">Cancelada</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={refresh}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Lista de OPs */}
      {ordensFiltradas.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Factory className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhuma OP encontrada</h3>
            <p className="text-muted-foreground mb-4">
              {search ? 'Tente alterar os filtros de busca' : 'Aprove uma fórmula para gerar OPs'}
            </p>
            <Button onClick={() => navigate('/producao/formulas')}>
              <FlaskConical className="h-4 w-4 mr-2" />
              Ir para Fórmulas
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
                <TableHead className="text-right">Quantidade</TableHead>
                <TableHead>Lote PA</TableHead>
                <TableHead>Data Fab.</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead className="text-right">Custo</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ordensFiltradas.map((op) => {
                const statusConfig = getStatusConfig(op.status);
                const StatusIcon = statusConfig.icon;
                const temCriticos = op.itens_pesagem.some(i => i.tipo_pesagem === 'CRITICA');

                return (
                  <TableRow key={op.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell 
                      className="font-mono font-bold"
                      onClick={() => navigate(`/producao/ordens/${op.id}`)}
                    >
                      {op.codigo}
                      {temCriticos && (
                        <AlertTriangle className="h-3 w-3 inline ml-2 text-destructive" />
                      )}
                    </TableCell>
                    <TableCell onClick={() => navigate(`/producao/ordens/${op.id}`)}>
                      <div>
                        <p className="font-medium">{op.produto_nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {op.formula_codigo} v{op.formula_versao}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={statusConfig.variant} className="gap-1">
                        <StatusIcon className="h-3 w-3" />
                        {statusConfig.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {op.quantidade_com_acrescimo.toLocaleString()}
                      <span className="text-xs text-muted-foreground ml-1">
                        (+{op.acrescimo_producao_percentual}%)
                      </span>
                    </TableCell>
                    <TableCell className="font-mono">{op.lote_produto_acabado}</TableCell>
                    <TableCell>
                      {op.data_fabricacao 
                        ? new Date(op.data_fabricacao).toLocaleDateString('pt-BR')
                        : '-'
                      }
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate">
                      {op.responsavel_tecnico || '-'}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {op.custo_total_insumos > 0 
                        ? `R$ ${op.custo_total_insumos.toFixed(2)}`
                        : '-'
                      }
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
    </div>
  );
}
