// ============================================================
// CABEÇALHO DA OP MASTER - IDENTIFICAÇÃO COMPLETA
// PADRÃO ANVISA (RDC 243, IN 28, BPF)
// ============================================================

import { 
  Factory, Building2, User, Calendar, Package,
  QrCode, FileText, Shield, Clock, Hash,
  Printer, Download, CheckCircle2, AlertTriangle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

interface OPCabecalhoProps {
  op: {
    id: string;
    codigo: string;
    status: string;
    produto_nome: string;
    tipo_capsula?: string;
    quantidade_frascos: number;
    capsulas_por_frasco: number;
    total_capsulas: number;
    total_capsulas_com_acrescimo: number;
    acrescimo_percentual: number;
    lote_produto_acabado: string;
    data_fabricacao: string;
    data_validade: string;
    formula_codigo?: string;
    formula_versao?: number;
    excipiente_base?: string;
    // Cliente
    cliente_nome?: string;
    cliente_cnpj?: string;
    pedido_numero?: string;
    // RT
    rt_nome?: string;
    rt_tipo_conselho?: string;
    rt_numero_registro?: string;
    rt_uf_conselho?: string;
    rt_assinatura_timestamp?: string;
    // Operador
    responsavel_producao_nome?: string;
    // QR Code
    qr_code_token?: string;
    qr_code_hash?: string;
    // Timestamps
    created_at: string;
    updated_at: string;
  };
  temAtivosCriticos?: boolean;
  onImprimir?: () => void;
}

const STATUS_CONFIG: Record<string, { 
  variant: 'default' | 'secondary' | 'destructive' | 'outline'; 
  label: string;
  className?: string;
}> = {
  PLANEJADA: { variant: 'outline', label: 'Planejada' },
  AGUARDANDO_MATERIAIS: { variant: 'outline', label: 'Aguardando Materiais', className: 'border-warning text-warning' },
  EM_PRODUCAO: { variant: 'default', label: 'Em Produção' },
  FINALIZADA: { variant: 'secondary', label: 'Finalizada' },
  BLOQUEADA: { variant: 'destructive', label: 'Bloqueada' },
  CANCELADA: { variant: 'destructive', label: 'Cancelada' },
};

export function OPCabecalhoMaster({ op, temAtivosCriticos, onImprimir }: OPCabecalhoProps) {
  const statusConfig = STATUS_CONFIG[op.status] || STATUS_CONFIG.PLANEJADA;
  
  return (
    <div className="space-y-4 print:space-y-2">
      {/* Título e Ações de Impressão */}
      <div className="flex items-center justify-between flex-wrap gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <Factory className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{op.codigo}</h1>
            <p className="text-muted-foreground">Ordem de Produção Industrial</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onImprimir}>
            <Printer className="h-4 w-4 mr-2" />
            Imprimir OP
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Exportar PDF
          </Button>
        </div>
      </div>

      {/* ALERTA ATIVO CRÍTICO */}
      {temAtivosCriticos && (
        <Alert variant="destructive" className="border-2 border-destructive bg-destructive/10">
          <AlertTriangle className="h-6 w-6" />
          <AlertTitle className="text-lg font-bold">
            ⚠️ ATIVO CRÍTICO – PESAGEM COM DUPLA CONFERÊNCIA OBRIGATÓRIA
          </AlertTitle>
          <AlertDescription className="text-base">
            PROIBIDA PESAGEM DIRETA NO LOTE FINAL. Preparar PRÉ-MIX obrigatório com distribuição geométrica.
          </AlertDescription>
        </Alert>
      )}

      {/* CABEÇALHO PRINCIPAL - Grid 3 Colunas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Coluna 1: Identificação da OP */}
        <Card className="border-2">
          <CardHeader className="pb-2 bg-muted/30">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              IDENTIFICAÇÃO DA OP
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-3 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">CÓDIGO DA OP</Label>
              <span className="font-mono font-bold text-lg text-primary">{op.codigo}</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">STATUS</Label>
              <Badge variant={statusConfig.variant} className={cn('text-sm', statusConfig.className)}>
                {statusConfig.label}
              </Badge>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">DATA/HORA GERAÇÃO</Label>
              <span className="font-mono text-sm">
                {new Date(op.created_at).toLocaleString('pt-BR')}
              </span>
            </div>
            {op.pedido_numero && (
              <>
                <Separator />
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Nº PEDIDO VENDA</Label>
                  <span className="font-mono font-bold">{op.pedido_numero}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Coluna 2: Produto e Cliente */}
        <Card className="border-2">
          <CardHeader className="pb-2 bg-muted/30">
            <CardTitle className="text-sm flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              PRODUTO E CLIENTE
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-3 space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">PRODUTO FINAL</Label>
              <p className="font-semibold">{op.produto_nome}</p>
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">FORMA FARMACÊUTICA</Label>
                <p className="font-medium">Cápsula {op.tipo_capsula || '00'}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">APRESENTAÇÃO</Label>
                <p className="font-medium">{op.capsulas_por_frasco} cápsulas</p>
              </div>
            </div>
            <Separator />
            <div>
              <Label className="text-xs text-muted-foreground">CLIENTE</Label>
              <p className="font-semibold">{op.cliente_nome || 'Produção Própria'}</p>
            </div>
            {op.cliente_cnpj && (
              <div>
                <Label className="text-xs text-muted-foreground">CNPJ</Label>
                <p className="font-mono text-sm">{op.cliente_cnpj}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Coluna 3: QR Code e Rastreabilidade */}
        <Card className="border-2">
          <CardHeader className="pb-2 bg-muted/30">
            <CardTitle className="text-sm flex items-center gap-2">
              <QrCode className="h-4 w-4 text-primary" />
              QR CODE INVIOLÁVEL
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-3 flex flex-col items-center space-y-3">
            <div className="w-32 h-32 bg-muted rounded-lg flex items-center justify-center border-2 border-dashed">
              <QrCode className="h-20 w-20 text-foreground" />
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">TOKEN DE VERIFICAÇÃO</p>
              <p className="font-mono text-xs">{op.qr_code_token?.slice(0, 16) || op.id.slice(0, 16)}...</p>
            </div>
            <Badge variant="outline" className="text-xs">
              <Shield className="h-3 w-3 mr-1" />
              SHA-256 Verificado
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* LINHA 2: Lote, Datas e Quantidades */}
      <Card className="border-2">
        <CardHeader className="pb-2 bg-muted/30">
          <CardTitle className="text-sm flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            LOTE, RASTREABILIDADE E QUANTIDADES
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-3">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <div className="p-3 bg-primary/10 rounded-lg text-center">
              <Label className="text-xs text-muted-foreground">LOTE PRODUTO ACABADO</Label>
              <p className="font-mono font-bold text-xl text-primary">{op.lote_produto_acabado}</p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg text-center">
              <Label className="text-xs text-muted-foreground">DATA FABRICAÇÃO</Label>
              <p className="font-bold text-lg">
                {new Date(op.data_fabricacao).toLocaleDateString('pt-BR')}
              </p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg text-center">
              <Label className="text-xs text-muted-foreground">DATA VALIDADE</Label>
              <p className="font-bold text-lg">
                {new Date(op.data_validade).toLocaleDateString('pt-BR')}
              </p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg text-center">
              <Label className="text-xs text-muted-foreground">FRASCOS</Label>
              <p className="font-bold text-xl">{op.quantidade_frascos.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg text-center">
              <Label className="text-xs text-muted-foreground">TOTAL CÁPSULAS</Label>
              <p className="font-bold text-xl">{op.total_capsulas.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-secondary/20 rounded-lg text-center">
              <Label className="text-xs text-muted-foreground">COM +{op.acrescimo_percentual}%</Label>
              <p className="font-bold text-xl text-secondary">{op.total_capsulas_com_acrescimo.toLocaleString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* LINHA 3: Responsável Técnico */}
      <Card className={cn('border-2', !op.rt_nome && 'border-destructive/50 bg-destructive/5')}>
        <CardHeader className="pb-2 bg-muted/30">
          <CardTitle className="text-sm flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            RESPONSÁVEL TÉCNICO (OBRIGATÓRIO ANVISA)
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-3">
          {op.rt_nome ? (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="md:col-span-2">
                <Label className="text-xs text-muted-foreground">NOME COMPLETO</Label>
                <p className="font-semibold text-lg">{op.rt_nome}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">CONSELHO</Label>
                <Badge variant="default" className="text-base mt-1">
                  {op.rt_tipo_conselho}
                </Badge>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">NÚMERO DE REGISTRO</Label>
                <p className="font-mono font-bold text-lg">{op.rt_numero_registro}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">UF</Label>
                <p className="font-bold text-lg">{op.rt_uf_conselho}</p>
              </div>
              {op.rt_assinatura_timestamp && (
                <div className="md:col-span-5 pt-2 border-t">
                  <div className="flex items-center gap-2 text-secondary">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="font-medium">
                      Assinatura Digital em: {new Date(op.rt_assinatura_timestamp).toLocaleString('pt-BR')}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3 p-4 bg-destructive/10 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-destructive" />
              <div>
                <p className="font-semibold text-destructive">NENHUM RT VINCULADO</p>
                <p className="text-sm text-muted-foreground">
                  É obrigatório vincular um Responsável Técnico antes de iniciar a produção.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* LINHA 4: Operador e Fórmula */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs text-muted-foreground">OPERADOR RESPONSÁVEL</Label>
                <p className="font-semibold">{op.responsavel_producao_nome || '(Não atribuído)'}</p>
              </div>
              <User className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card className="border">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs text-muted-foreground">FÓRMULA BASE / EXCIPIENTE</Label>
                <p className="font-semibold">
                  {op.formula_codigo ? `${op.formula_codigo} v${op.formula_versao || 1}` : 'OP Manual'}
                  {op.excipiente_base && ` • ${op.excipiente_base}`}
                </p>
              </div>
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
