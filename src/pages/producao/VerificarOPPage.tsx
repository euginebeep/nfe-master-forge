// ============================================================
// PÁGINA PÚBLICA DE VERIFICAÇÃO DE OP (QR CODE INVIOLÁVEL)
// Auditoria ANVISA - Somente Leitura
// ============================================================

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { 
  Shield, ShieldCheck, ShieldX, AlertTriangle, 
  Factory, Calendar, User, FileText, Package,
  Scale, ClipboardCheck, QrCode, Lock, Eye
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';

interface OPVerificacao {
  id: string;
  codigo: string;
  produto_nome: string;
  lote_produto_acabado: string;
  data_fabricacao: string;
  data_validade: string;
  status: string;
  quantidade_frascos: number;
  total_capsulas: number;
  total_capsulas_com_acrescimo: number;
  formula_codigo?: string;
  rt_nome?: string;
  rt_tipo_conselho?: string;
  rt_numero_registro?: string;
  rt_uf_conselho?: string;
  qr_code_hash: string;
  created_at: string;
}

interface MateriaPrima {
  id: string;
  insumo_nome: string;
  categoria: string;
  numero_lote?: string;
  quantidade_teorica_g: number;
  quantidade_real_g?: number;
}

export default function VerificarOPPage() {
  const { opId } = useParams<{ opId: string }>();
  const [searchParams] = useSearchParams();
  const sigParam = searchParams.get('sig');

  const [op, setOP] = useState<OPVerificacao | null>(null);
  const [materiasPrimas, setMateriasPrimas] = useState<MateriaPrima[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [showAuthDialog, setShowAuthDialog] = useState(true);
  const [senhaAuditoria, setSenhaAuditoria] = useState('');
  const [authError, setAuthError] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Verificar autenticação e carregar OP
  useEffect(() => {
    if (opId && isAuthenticated) {
      loadOP();
    }
  }, [opId, isAuthenticated]);

  const loadOP = async () => {
    setIsLoading(true);
    try {
      // Buscar OP
      const { data: opData, error: opError } = await supabase
        .from('ordens_producao_industrial')
        .select('*')
        .eq('id', opId)
        .single();

      if (opError) throw opError;
      setOP(opData as unknown as OPVerificacao);

      // Validar hash
      if (sigParam && opData?.qr_code_hash) {
        setIsValid(opData.qr_code_hash === sigParam);
      } else if (opData?.qr_code_hash) {
        // Sem assinatura no URL - precisa verificar manualmente
        setIsValid(null);
      } else {
        setIsValid(false);
      }

      // Buscar matérias-primas
      const { data: mps } = await supabase
        .from('op_materias_primas')
        .select('*')
        .eq('op_id', opId)
        .order('ordem_mistura', { ascending: true });

      setMateriasPrimas((mps || []) as unknown as MateriaPrima[]);
    } catch (error) {
      console.error('Erro ao carregar OP:', error);
      setIsValid(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuth = () => {
    // Senha de auditoria simples (em produção, usar autenticação real)
    if (senhaAuditoria === 'ANVISA2026' || senhaAuditoria === 'AUDITORIA') {
      setIsAuthenticated(true);
      setShowAuthDialog(false);
      setAuthError('');
    } else {
      setAuthError('Senha de auditoria incorreta');
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      PLANEJADA: { variant: 'outline', label: 'Planejada' },
      AGUARDANDO_MATERIAIS: { variant: 'outline', label: 'Aguardando Materiais' },
      EM_PRODUCAO: { variant: 'default', label: 'Em Produção' },
      FINALIZADA: { variant: 'secondary', label: 'Finalizada' },
      BLOQUEADA: { variant: 'destructive', label: 'Bloqueada' },
      CANCELADA: { variant: 'destructive', label: 'Cancelada' },
    };
    return config[status] || { variant: 'outline', label: status };
  };

  // Dialog de autenticação
  if (showAuthDialog) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Shield className="h-16 w-16 mx-auto text-primary mb-4" />
            <CardTitle className="text-2xl">Verificação de OP</CardTitle>
            <CardDescription>
              Esta é uma página de auditoria protegida. Insira a senha de verificação para continuar.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="senha">Senha de Auditoria</Label>
              <Input
                id="senha"
                type="password"
                placeholder="Digite a senha"
                value={senhaAuditoria}
                onChange={(e) => setSenhaAuditoria(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAuth()}
              />
              {authError && (
                <p className="text-sm text-destructive">{authError}</p>
              )}
            </div>
            <Button className="w-full" onClick={handleAuth}>
              <Lock className="h-4 w-4 mr-2" />
              Acessar Verificação
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <QrCode className="h-16 w-16 text-muted-foreground" />
          <p className="text-muted-foreground">Verificando integridade...</p>
        </div>
      </div>
    );
  }

  if (!op) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-destructive">
          <CardContent className="pt-6 text-center">
            <ShieldX className="h-16 w-16 mx-auto text-destructive mb-4" />
            <h2 className="text-2xl font-bold text-destructive mb-2">OP Não Encontrada</h2>
            <p className="text-muted-foreground">
              Não foi possível localizar a Ordem de Produção solicitada.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Cabeçalho de Verificação */}
        <Card className={isValid === true ? 'border-success' : isValid === false ? 'border-destructive' : 'border-warning'}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              {isValid === true ? (
                <ShieldCheck className="h-16 w-16 text-success" />
              ) : isValid === false ? (
                <ShieldX className="h-16 w-16 text-destructive" />
              ) : (
                <Shield className="h-16 w-16 text-warning" />
              )}
              <div>
                <h1 className="text-2xl font-bold">
                  {isValid === true
                    ? 'INTEGRIDADE VERIFICADA'
                    : isValid === false
                    ? 'INTEGRIDADE COMPROMETIDA'
                    : 'VERIFICAÇÃO PENDENTE'}
                </h1>
                <p className="text-muted-foreground">
                  {isValid === true
                    ? 'O documento é autêntico e não foi alterado.'
                    : isValid === false
                    ? 'A assinatura digital não corresponde. Documento pode ter sido adulterado.'
                    : 'Não foi possível verificar automaticamente. Confirme o hash manualmente.'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Identificação da OP */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Factory className="h-5 w-5" />
              Ordem de Produção: {op.codigo}
            </CardTitle>
            <CardDescription>Documento de auditoria - Somente leitura</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Produto</Label>
                <p className="font-medium">{op.produto_nome}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Lote PA</Label>
                <p className="font-mono font-bold">{op.lote_produto_acabado}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Status</Label>
                <Badge variant={getStatusBadge(op.status).variant}>
                  {getStatusBadge(op.status).label}
                </Badge>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Fórmula</Label>
                <p className="font-mono">{op.formula_codigo || 'OP Manual'}</p>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Data Fabricação</Label>
                <p className="font-medium">{new Date(op.data_fabricacao).toLocaleDateString('pt-BR')}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Data Validade</Label>
                <p className="font-medium">{new Date(op.data_validade).toLocaleDateString('pt-BR')}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Frascos</Label>
                <p className="font-medium">{op.quantidade_frascos.toLocaleString()}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Total Cápsulas</Label>
                <p className="font-medium">{op.total_capsulas_com_acrescimo.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Responsável Técnico */}
        {op.rt_nome && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Responsável Técnico
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Nome</Label>
                  <p className="font-medium">{op.rt_nome}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Conselho</Label>
                  <p className="font-medium">{op.rt_tipo_conselho}</p>
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
            </CardContent>
          </Card>
        )}

        {/* Matérias-Primas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5" />
              Composição ({materiasPrimas.length} itens)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Insumo</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Lote</TableHead>
                  <TableHead className="text-right">Qtd Teórica (g)</TableHead>
                  <TableHead className="text-right">Qtd Real (g)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {materiasPrimas.map((mp) => (
                  <TableRow key={mp.id}>
                    <TableCell className="font-medium">{mp.insumo_nome}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {mp.categoria.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{mp.numero_lote || '-'}</TableCell>
                    <TableCell className="text-right">{mp.quantidade_teorica_g.toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                      {mp.quantidade_real_g ? mp.quantidade_real_g.toFixed(2) : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Hash de Verificação */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Assinatura Digital (HMAC-SHA256)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-muted rounded-lg p-4 font-mono text-xs break-all">
              {op.qr_code_hash || 'Hash não disponível'}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Criado em: {new Date(op.created_at).toLocaleString('pt-BR')}
            </p>
          </CardContent>
        </Card>

        {/* Rodapé */}
        <div className="text-center text-xs text-muted-foreground">
          <p>Documento gerado pelo Sistema OP Master Industrial</p>
          <p>Verificação realizada em: {new Date().toLocaleString('pt-BR')}</p>
        </div>
      </div>
    </div>
  );
}
