// ============================================================
// CHECKLIST OPERACIONAL IMPRIMÍVEL - OP MASTER
// Padrão ANVISA (RDC 243, IN 28, BPF)
// ============================================================

import { useState } from 'react';
import { 
  ClipboardCheck, CheckCircle2, Circle, AlertTriangle,
  Printer, Clock, User, Calendar, Package
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { CHECKLIST_PADRAO as CENTRALIZED_CHECKLIST } from '@/types/op-industrial';

interface ChecklistItem {
  id: string;
  codigo: string;
  descricao: string;
  categoria: 'PRE_PRODUCAO' | 'DURANTE_PRODUCAO' | 'POS_PRODUCAO' | 'QC';
  obrigatorio: boolean;
  verificado: boolean;
  verificado_por?: string;
  verificado_em?: string;
}

interface OPChecklistOperacionalProps {
  opCodigo: string;
  opLote: string;
  opProduto: string;
  checklist: ChecklistItem[];
  statusOP: string;
  onVerificar?: (id: string) => Promise<boolean>;
  modoPrint?: boolean;
}

const CATEGORIAS = [
  { key: 'PRE_PRODUCAO', label: 'PRÉ-PRODUÇÃO', icon: Package },
  { key: 'DURANTE_PRODUCAO', label: 'DURANTE PRODUÇÃO', icon: ClipboardCheck },
  { key: 'POS_PRODUCAO', label: 'PÓS-PRODUÇÃO', icon: CheckCircle2 },
  { key: 'QC', label: 'CONTROLE DE QUALIDADE', icon: AlertTriangle },
] as const;

// Checklist padrão industrial se não houver items do banco
// Checklist padrão industrial vindo do sistema centralizado
const CHECKLIST_PADRAO_LOCAL = CENTRALIZED_CHECKLIST.map(item => ({
  codigo: item.codigo || 'CH-00',
  descricao: item.item,
  categoria: item.categoria,
  obrigatorio: item.obrigatorio,
}));

export function OPChecklistOperacional({
  opCodigo,
  opLote,
  opProduto,
  checklist,
  statusOP,
  onVerificar,
  modoPrint = false,
}: OPChecklistOperacionalProps) {
  const [loading, setLoading] = useState<string | null>(null);
  
  // Usar checklist do banco ou padrão
  const items: ChecklistItem[] = checklist.length > 0 
    ? checklist 
    : CHECKLIST_PADRAO_LOCAL.map((item, idx) => ({
        ...item,
        id: `padrao-${idx}`,
        verificado: false,
        verificado_por: undefined,
        verificado_em: undefined,
      }));
  
  const itemsPorCategoria = CATEGORIAS.map(cat => ({
    ...cat,
    items: items.filter(i => i.categoria === cat.key),
    total: items.filter(i => i.categoria === cat.key).length,
    verificados: items.filter(i => i.categoria === cat.key && i.verificado).length,
  }));
  
  const totalItems = items.length;
  const totalVerificados = items.filter(i => i.verificado).length;
  const progresso = totalItems > 0 ? Math.round((totalVerificados / totalItems) * 100) : 0;
  const podeEditar = statusOP === 'EM_PRODUCAO';
  
  const handleVerificar = async (id: string) => {
    if (!onVerificar || !podeEditar) return;
    setLoading(id);
    try {
      await onVerificar(id);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className={cn('space-y-6', modoPrint && 'print:text-sm')}>
      {/* Cabeçalho do Checklist */}
      <Card className="print:border-2">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ClipboardCheck className="h-5 w-5 text-primary" />
                CHECKLIST OPERACIONAL - ANVISA BPF
              </CardTitle>
              <CardDescription className="mt-1">
                {opCodigo} • Lote: {opLote} • {opProduto}
              </CardDescription>
            </div>
            
            {!modoPrint && (
              <Button variant="outline" onClick={() => window.print()}>
                <Printer className="h-4 w-4 mr-2" />
                Imprimir Checklist
              </Button>
            )}
          </div>
        </CardHeader>
        
        <CardContent className="pt-0">
          {/* Barra de Progresso */}
          <div className="flex items-center gap-4 mb-4">
            <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
              <div 
                className={cn(
                  'h-full transition-all duration-500',
                  progresso === 100 ? 'bg-secondary' : 'bg-primary'
                )}
                style={{ width: `${progresso}%` }}
              />
            </div>
            <div className="text-right shrink-0">
              <span className="text-2xl font-bold">{progresso}%</span>
              <p className="text-xs text-muted-foreground">{totalVerificados}/{totalItems} itens</p>
            </div>
          </div>
          
          {progresso < 100 && (
            <p className="text-sm text-warning flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Checklist incompleto: {totalItems - totalVerificados} item(s) pendente(s)
            </p>
          )}
          
          {progresso === 100 && (
            <p className="text-sm text-secondary flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Checklist 100% completo - OP liberada para finalização
            </p>
          )}
        </CardContent>
      </Card>

      {/* Seções por Categoria */}
      {itemsPorCategoria.map((categoria) => {
        const IconCategoria = categoria.icon;
        const categoriaCompleta = categoria.verificados === categoria.total && categoria.total > 0;
        
        return (
          <Card 
            key={categoria.key}
            className={cn(
              'print:break-inside-avoid',
              categoriaCompleta && 'border-secondary/50 bg-secondary/5'
            )}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <IconCategoria className={cn('h-5 w-5', categoriaCompleta ? 'text-secondary' : 'text-primary')} />
                  {categoria.label}
                </CardTitle>
                <Badge variant={categoriaCompleta ? 'secondary' : 'outline'}>
                  {categoria.verificados}/{categoria.total}
                </Badge>
              </div>
            </CardHeader>
            
            <CardContent className="pt-0">
              <div className="space-y-2">
                {categoria.items.map((item) => (
                  <div 
                    key={item.id}
                    className={cn(
                      'flex items-start gap-3 p-3 rounded-lg border transition-colors',
                      item.verificado 
                        ? 'bg-secondary/10 border-secondary/30' 
                        : 'bg-background hover:bg-muted/50'
                    )}
                  >
                    {/* Checkbox ou ícone */}
                    {modoPrint ? (
                      <div className="w-5 h-5 border-2 rounded mt-0.5 shrink-0 flex items-center justify-center">
                        {item.verificado && <Check className="h-4 w-4" />}
                      </div>
                    ) : podeEditar && !item.verificado ? (
                      <Checkbox
                        id={item.id}
                        checked={item.verificado}
                        disabled={loading === item.id}
                        onCheckedChange={() => handleVerificar(item.id)}
                        className="mt-0.5"
                      />
                    ) : (
                      <div className="mt-0.5">
                        {item.verificado ? (
                          <CheckCircle2 className="h-5 w-5 text-secondary" />
                        ) : (
                          <Circle className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                    )}
                    
                    {/* Conteúdo */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">{item.codigo}</span>
                        {item.obrigatorio && (
                          <Badge variant="outline" className="text-xs h-5">Obrigatório</Badge>
                        )}
                      </div>
                      <p className={cn(
                        'text-sm',
                        item.verificado && 'line-through text-muted-foreground'
                      )}>
                        {item.descricao}
                      </p>
                      
                      {item.verificado && item.verificado_por && (
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {item.verificado_por}
                          {item.verificado_em && (
                            <>
                              <span className="mx-1">•</span>
                              <Clock className="h-3 w-3" />
                              {new Date(item.verificado_em).toLocaleString('pt-BR')}
                            </>
                          )}
                        </p>
                      )}
                    </div>
                    
                    {/* Linha para assinatura manual (print) */}
                    {modoPrint && !item.verificado && (
                      <div className="w-32 shrink-0 text-right">
                        <div className="h-6 border-b border-muted-foreground" />
                        <p className="text-xs text-muted-foreground mt-0.5">Rubrica</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Assinaturas Finais (Print) */}
      <Card className="print:break-inside-avoid">
        <CardContent className="pt-6">
          <h3 className="font-bold mb-4 flex items-center gap-2">
            <User className="h-5 w-5" />
            ASSINATURAS DE LIBERAÇÃO
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <Label className="text-xs text-muted-foreground">OPERADOR RESPONSÁVEL</Label>
              <div className="h-12 border-b-2 border-foreground mt-2" />
              <p className="text-xs text-muted-foreground mt-1">Nome / Assinatura / Data</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">SUPERVISOR DE PRODUÇÃO</Label>
              <div className="h-12 border-b-2 border-foreground mt-2" />
              <p className="text-xs text-muted-foreground mt-1">Nome / Assinatura / Data</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">RESPONSÁVEL TÉCNICO (RT)</Label>
              <div className="h-12 border-b-2 border-foreground mt-2" />
              <p className="text-xs text-muted-foreground mt-1">Nome / Registro / Assinatura</p>
            </div>
          </div>
          
          <Separator className="my-6" />
          
          <div className="text-center text-xs text-muted-foreground space-y-1">
            <p>Este documento é parte integrante da Ordem de Produção {opCodigo}</p>
            <p>Lote: {opLote} • Impresso em: {new Date().toLocaleString('pt-BR')}</p>
            <p className="font-medium">Arquivo por 5 anos conforme RDC 243/2018 - ANVISA</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Componente Check para print
function Check({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
      <path d="M5 12l5 5L20 7" />
    </svg>
  );
}
