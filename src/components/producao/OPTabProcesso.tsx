// ============================================================
// ABA PROCESSO PASSO A PASSO - GUIA DO OPERADOR
// Instruções detalhadas para produção industrial
// ============================================================

import { useState } from 'react';
import { 
  ListChecks, Package, Scale, Beaker, 
  FlaskRound, Box, Tag, Calendar, Hash,
  CheckCircle2, Circle, ArrowRight, AlertTriangle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { SIMBOLO_MICROGRAMA } from '@/lib/unidades-dose';

interface PassoProducao {
  numero: number;
  titulo: string;
  descricao: string;
  icon: React.ReactNode;
  instrucoes: string[];
  avisos?: string[];
  status: 'pendente' | 'em_andamento' | 'concluido';
}

interface OPTabProcessoProps {
  opId: string;
  status: string;
  tipoProduto: string;
  temAtivosCriticos: boolean;
  excipienteBase: string;
}

export function OPTabProcesso({ 
  opId, 
  status, 
  tipoProduto, 
  temAtivosCriticos,
  excipienteBase 
}: OPTabProcessoProps) {
  const [passoAtual, setPassoAtual] = useState(1);

  // Definição dos passos
  const passos: PassoProducao[] = [
    {
      numero: 1,
      titulo: 'Separação e Conferência',
      descricao: 'Separar todas as matérias-primas e conferir lotes',
      icon: <Package className="h-5 w-5" />,
      instrucoes: [
        'Separar todas as matérias-primas listadas na OP',
        'Conferir número do lote de cada item',
        'Verificar validade de todos os insumos',
        'Posicionar os itens na bancada na ordem de mistura',
        'Registrar conferência no checklist',
      ],
      avisos: temAtivosCriticos ? [
        'Esta OP contém ATIVOS CRÍTICOS que exigem pesagem com dupla conferência'
      ] : undefined,
      status: status === 'PLANEJADA' ? 'em_andamento' : 'concluido',
    },
    {
      numero: 2,
      titulo: 'Pesagem',
      descricao: 'Pesar todos os ingredientes na ordem correta',
      icon: <Scale className="h-5 w-5" />,
      instrucoes: [
        'Calibrar a balança antes de iniciar',
        'Pesar os ATIVOS primeiro, do maior para o menor volume',
        temAtivosCriticos ? '⚠️ Ativos críticos: dupla conferência obrigatória' : 'Conferir tolerância (±10%)',
        `Pesar o excipiente base (${excipienteBase}) - Q.S.P.`,
        'Pesar Dióxido de Silício (2%)',
        'Pesar Talco Farmacêutico (5%)',
        'Pesar Estearato de Magnésio (2,5%) - SEMPRE POR ÚLTIMO',
        'Registrar peso real de cada item',
      ],
      avisos: [
        'Ordem de pesagem é obrigatória conforme normas ANVISA',
        'Estearato de Magnésio deve ser sempre o último a ser pesado e misturado',
      ],
      status: 'pendente',
    },
    {
      numero: 3,
      titulo: 'Mistura',
      descricao: 'Homogeneizar os ingredientes na ordem industrial',
      icon: <Beaker className="h-5 w-5" />,
      instrucoes: [
        'Adicionar ativos de maior volume primeiro',
        'Homogeneizar por 2 minutos',
        'Adicionar ativos de menor volume',
        'Homogeneizar por 2 minutos',
        `Adicionar ${excipienteBase} (excipiente base)`,
        'Homogeneizar por 3 minutos',
        'Adicionar Dióxido de Silício',
        'Homogeneizar por 2 minutos',
        'Adicionar Talco Farmacêutico',
        'Homogeneizar por 2 minutos',
        '⚠️ POR ÚLTIMO: Adicionar Estearato de Magnésio',
        'Homogeneizar por 1 minuto (não mais que isso)',
      ],
      avisos: [
        'O tempo de mistura com Estearato deve ser curto para evitar problemas de fluidez',
        'Verificar homogeneidade visual antes de prosseguir',
      ],
      status: 'pendente',
    },
    {
      numero: 4,
      titulo: 'Encapsulamento',
      descricao: 'Enchimento das cápsulas na encapsuladora',
      icon: <FlaskRound className="h-5 w-5" />,
      instrucoes: [
        'Ajustar a encapsuladora para o tamanho de cápsula correto',
        'Realizar teste inicial com 10-20 cápsulas',
        'Verificar peso médio das cápsulas de teste',
        'Ajustar dosagem se necessário',
        'Iniciar produção em lote',
        'Coletar amostras a cada 500 cápsulas para verificação',
        'Registrar qualquer desvio ou ajuste realizado',
      ],
      avisos: [
        'Se o pó não estiver fluindo bem, verificar umidade e homogeneidade',
        'Não abrir a máquina durante operação para evitar contaminação',
      ],
      status: 'pendente',
    },
    {
      numero: 5,
      titulo: 'Envase e Rotulagem',
      descricao: 'Envasar nos frascos e aplicar rótulos',
      icon: <Box className="h-5 w-5" />,
      instrucoes: [
        'Conferir quantidade de cápsulas por frasco',
        'Adicionar dessecante se aplicável',
        'Fechar os frascos corretamente',
        'Aplicar selo de indução (se aplicável)',
        'Colar rótulo conferido',
        'Verificar legibilidade e posicionamento do rótulo',
        'Carimbar data de fabricação e validade',
        'Carimbar número do lote',
      ],
      status: 'pendente',
    },
    {
      numero: 6,
      titulo: 'Quarentena e Liberação',
      descricao: 'Conferência final e liberação do lote',
      icon: <CheckCircle2 className="h-5 w-5" />,
      instrucoes: [
        'Contagem final de unidades produzidas',
        'Calcular rendimento e registrar perdas',
        'Conferir amostra de retenção',
        'Preencher controle de qualidade',
        'Aguardar assinatura do Responsável Técnico',
        'Liberar lote para estoque',
        'Gerar documentação final da OP',
      ],
      status: 'pendente',
    },
  ];

  const progressoTotal = (passoAtual / passos.length) * 100;

  return (
    <div className="space-y-6">
      {/* Progresso Geral */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Progresso do Processo</span>
            <span className="text-sm text-muted-foreground">Etapa {passoAtual} de {passos.length}</span>
          </div>
          <Progress value={progressoTotal} className="h-3" />
        </CardContent>
      </Card>

      {/* Alerta de Ativos Críticos */}
      {temAtivosCriticos && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Atenção: Ativos Críticos</AlertTitle>
          <AlertDescription>
            Esta OP contém ativos com quantidade menor que 1mg ou em unidades UI/{SIMBOLO_MICROGRAMA}. 
            A pesagem desses itens exige dupla conferência com registro de dois operadores.
          </AlertDescription>
        </Alert>
      )}

      {/* Lista de Passos */}
      <div className="space-y-4">
        {passos.map((passo, index) => (
          <Card 
            key={passo.numero}
            className={cn(
              'transition-all',
              passoAtual === passo.numero && 'ring-2 ring-primary',
              passo.status === 'concluido' && 'bg-success/5 border-success/30'
            )}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center',
                    passo.status === 'concluido' ? 'bg-success text-success-foreground' :
                    passoAtual === passo.numero ? 'bg-primary text-primary-foreground' :
                    'bg-muted text-muted-foreground'
                  )}>
                    {passo.status === 'concluido' ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <span className="font-bold">{passo.numero}</span>
                    )}
                  </div>
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      {passo.icon}
                      {passo.titulo}
                    </CardTitle>
                    <CardDescription>{passo.descricao}</CardDescription>
                  </div>
                </div>
                <Badge variant={
                  passo.status === 'concluido' ? 'default' :
                  passo.status === 'em_andamento' ? 'secondary' :
                  'outline'
                } className={passo.status === 'concluido' ? 'bg-success' : ''}>
                  {passo.status === 'concluido' ? 'Concluído' :
                   passo.status === 'em_andamento' ? 'Em Andamento' : 'Pendente'}
                </Badge>
              </div>
            </CardHeader>
            
            {passoAtual === passo.numero && (
              <CardContent className="space-y-4">
                <Separator />
                
                {/* Instruções */}
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Instruções:</h4>
                  <ul className="space-y-1">
                    {passo.instrucoes.map((instrucao, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <Circle className="h-2 w-2 mt-2 shrink-0 fill-current" />
                        <span className={instrucao.startsWith('⚠️') ? 'text-warning font-medium' : ''}>
                          {instrucao}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Avisos */}
                {passo.avisos && passo.avisos.length > 0 && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Atenção</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc list-inside space-y-1">
                        {passo.avisos.map((aviso, i) => (
                          <li key={i} className="text-sm">{aviso}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Navegação */}
                <div className="flex justify-between pt-2">
                  <Button 
                    variant="outline" 
                    disabled={passoAtual === 1}
                    onClick={() => setPassoAtual(passoAtual - 1)}
                  >
                    Voltar
                  </Button>
                  <Button 
                    disabled={passoAtual === passos.length}
                    onClick={() => setPassoAtual(passoAtual + 1)}
                  >
                    Próximo
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      {/* Seção de Diagnóstico de Problemas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Sinais de Erro e Correções
          </CardTitle>
          <CardDescription>
            Problemas comuns e como resolver sem desmontar equipamentos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="p-3 border rounded-lg">
              <h4 className="font-medium text-sm mb-2">Pó não flui bem na encapsuladora</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Verificar se Estearato foi adicionado por último</li>
                <li>• Aumentar tempo de mistura com Dióxido de Silício</li>
                <li>• Verificar umidade do ambiente</li>
              </ul>
            </div>
            <div className="p-3 border rounded-lg">
              <h4 className="font-medium text-sm mb-2">Cápsulas com peso irregular</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Ajustar altura do dosador</li>
                <li>• Verificar homogeneidade da mistura</li>
                <li>• Conferir densidade aparente do pó</li>
              </ul>
            </div>
            <div className="p-3 border rounded-lg">
              <h4 className="font-medium text-sm mb-2">Cápsulas não fecham corretamente</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Verificar alinhamento das placas</li>
                <li>• Conferir tamanho correto das cápsulas</li>
                <li>• Ajustar pressão de fechamento</li>
              </ul>
            </div>
            <div className="p-3 border rounded-lg">
              <h4 className="font-medium text-sm mb-2">Mistura com grumos</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Peneirar ingredientes antes da mistura</li>
                <li>• Aumentar tempo de homogeneização</li>
                <li>• Verificar se ingredientes estão secos</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
