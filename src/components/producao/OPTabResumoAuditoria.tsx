// ============================================================
// ABA RESUMO & AUDITORIA - OP MASTER
// QR Code, RT, Status e Trilha de Auditoria
// ============================================================

import { useState, useEffect } from 'react';
import { 
  QrCode, User, Shield, Calendar, Package, 
  FileText, Clock, CheckCircle2, AlertTriangle,
  Eye, Copy, ExternalLink
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface OPResumo {
  id: string;
  codigo: string;
  produto_nome: string;
  lote_produto_acabado: string;
  data_fabricacao: string;
  data_validade: string;
  status: string;
  quantidade_frascos: number;
  capsulas_por_frasco: number;
  total_capsulas: number;
  total_capsulas_com_acrescimo: number;
  acrescimo_percentual: number;
  formula_codigo?: string;
  formula_versao?: number;
  excipiente_base: string;
  tipo_capsula: string;
  cliente_nome?: string;
  pedido_numero?: string;
  rt_nome?: string;
  rt_tipo_conselho?: string;
  rt_numero_registro?: string;
  rt_uf_conselho?: string;
  rt_vinculado_em?: string;
  responsavel_producao_nome?: string;
  qr_code_token?: string;
  qr_code_hash?: string;
  turno?: string;
  linha_producao?: string;
  maquina?: string;
  created_at: string;
  updated_at: string;
}

interface AuditEvent {
  id: string;
  tipo_evento: string;
  descricao: string;
  usuario_nome?: string;
  created_at: string;
}

interface OPTabResumoAuditoriaProps {
  op: OPResumo;
}

export function OPTabResumoAuditoria({ op }: OPTabResumoAuditoriaProps) {
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);

  useEffect(() => {
    loadAuditEvents();
  }, [op.id]);

  const loadAuditEvents = async () => {
    setIsLoadingAudit(true);
    try {
      const { data } = await supabase
        .from('audit_trail_imutavel')
        .select('id, tipo_evento, descricao, usuario_nome, created_at')
        .eq('entidade_id', op.id)
        .order('created_at', { ascending: false })
        .limit(20);

      setAuditEvents((data || []) as AuditEvent[]);
    } catch (error) {
      console.error('Erro ao carregar auditoria:', error);
    } finally {
      setIsLoadingAudit(false);
    }
  };

  const copyQRLink = () => {
    const url = `${window.location.origin}/op/verify/${op.id}?sig=${op.qr_code_hash}`;
    navigator.clipboard.writeText(url);
    toast.success('Link de verificação copiado!');
  };

  const openQRPage = () => {
    const url = `/op/verify/${op.id}?sig=${op.qr_code_hash}`;
    window.open(url, '_blank');
  };

  const getStatusConfig = (status: string) => {
    const config: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string; icon: React.ReactNode }> = {
      PLANEJADA: { variant: 'outline', label: 'Planejada', icon: <Clock className="h-3 w-3" /> },
      AGUARDANDO_MATERIAIS: { variant: 'outline', label: 'Aguardando Materiais', icon: <Package className="h-3 w-3" /> },
      EM_PRODUCAO: { variant: 'default', label: 'Em Produção', icon: <FileText className="h-3 w-3" /> },
      FINALIZADA: { variant: 'secondary', label: 'Finalizada', icon: <CheckCircle2 className="h-3 w-3" /> },
      BLOQUEADA: { variant: 'destructive', label: 'Bloqueada', icon: <AlertTriangle className="h-3 w-3" /> },
      CANCELADA: { variant: 'destructive', label: 'Cancelada', icon: <AlertTriangle className="h-3 w-3" /> },
    };
    return config[status] || config.PLANEJADA;
  };

  const statusConfig = getStatusConfig(op.status);

  return (
    <div className="space-y-6">
      {/* Header com QR Code e Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* QR Code Card */}
        <Card className="md:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <QrCode className="h-4 w-4" />
              QR Code Inviolável
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="aspect-square bg-muted rounded-lg flex items-center justify-center">
              <QrCode className="h-24 w-24 text-foreground" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={copyQRLink}>
                <Copy className="h-3 w-3 mr-1" />
                Copiar
              </Button>
              <Button variant="outline" size="sm" className="flex-1" onClick={openQRPage}>
                <ExternalLink className="h-3 w-3 mr-1" />
                Verificar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Token: {op.qr_code_token?.slice(0, 8)}...
            </p>
          </CardContent>
        </Card>

        {/* Informações Principais */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{op.codigo}</CardTitle>
              <Badge variant={statusConfig.variant} className="flex items-center gap-1">
                {statusConfig.icon}
                {statusConfig.label}
              </Badge>
            </div>
            <CardDescription>{op.produto_nome}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Lote PA</Label>
                <p className="font-mono font-bold text-primary">{op.lote_produto_acabado}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Fabricação</Label>
                <p className="font-medium">{new Date(op.data_fabricacao).toLocaleDateString('pt-BR')}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Validade</Label>
                <p className="font-medium">{new Date(op.data_validade).toLocaleDateString('pt-BR')}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Fórmula</Label>
                <p className="font-mono">{op.formula_codigo || 'Manual'} {op.formula_versao && `v${op.formula_versao}`}</p>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Frascos</Label>
                <p className="text-xl font-bold">{op.quantidade_frascos.toLocaleString()}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Caps/Frasco</Label>
                <p className="text-xl font-bold">{op.capsulas_por_frasco}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Total</Label>
                <p className="text-xl font-bold">{op.total_capsulas.toLocaleString()}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">+{op.acrescimo_percentual}%</Label>
                <p className="text-xl font-bold text-success">{op.total_capsulas_com_acrescimo.toLocaleString()}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Cápsula</Label>
                <p className="font-medium">{op.tipo_capsula}</p>
              </div>
            </div>

            {/* Cliente/Pedido */}
            {(op.cliente_nome || op.pedido_numero) && (
              <>
                <Separator />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Cliente</Label>
                    <p className="font-medium">{op.cliente_nome || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Pedido</Label>
                    <p className="font-mono">{op.pedido_numero || '-'}</p>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Responsável Técnico */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <User className="h-4 w-4" />
            Responsável Técnico (Obrigatório ANVISA)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {op.rt_nome ? (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="md:col-span-2">
                <Label className="text-xs text-muted-foreground">Nome Completo</Label>
                <p className="font-medium">{op.rt_nome}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Conselho</Label>
                <Badge variant="outline">{op.rt_tipo_conselho}</Badge>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Registro</Label>
                <p className="font-mono">{op.rt_numero_registro}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">UF</Label>
                <p className="font-medium">{op.rt_uf_conselho}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-warning">
              <AlertTriangle className="h-4 w-4" />
              <p className="text-sm">Nenhum RT vinculado a esta OP. Obrigatório para produção.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Equipe e Infraestrutura */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Package className="h-4 w-4" />
            Equipe e Infraestrutura
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground">Responsável Produção</Label>
              <p className="font-medium">{op.responsavel_producao_nome || '-'}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Excipiente Base</Label>
              <p className="font-medium">{op.excipiente_base}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Turno</Label>
              <p className="font-medium">{op.turno || '-'}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Linha</Label>
              <p className="font-medium">{op.linha_producao || '-'}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Máquina</Label>
              <p className="font-medium">{op.maquina || '-'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Trilha de Auditoria */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Trilha de Auditoria (Últimas 20 ações)
          </CardTitle>
          <CardDescription>Registro imutável de todas as operações</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingAudit ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : auditEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum evento registrado.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {auditEvents.map((event) => (
                <div key={event.id} className="flex items-start gap-3 text-sm border-l-2 border-muted pl-3 py-1">
                  <div className="flex-1">
                    <p className="font-medium">{event.descricao}</p>
                    <p className="text-xs text-muted-foreground">
                      {event.usuario_nome || 'Sistema'} • {new Date(event.created_at).toLocaleString('pt-BR')}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0">
                    {event.tipo_evento}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Metadados */}
      <div className="text-xs text-muted-foreground text-center space-y-1">
        <p>Criado em: {new Date(op.created_at).toLocaleString('pt-BR')}</p>
        <p>Última atualização: {new Date(op.updated_at).toLocaleString('pt-BR')}</p>
      </div>
    </div>
  );
}
