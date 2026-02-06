import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { 
  ResultadoValidacaoCompleta, 
  ValidacaoItem,
} from '@/types/validador-anvisa';
import { 
  Shield, 
  ShieldAlert, 
  ShieldCheck, 
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileText,
  MessageSquareWarning,
} from 'lucide-react';

interface ValidadorANVISAPanelProps {
  resultado: ResultadoValidacaoCompleta | null;
  onValidar?: () => void;
  validando?: boolean;
  mostrarAcoes?: boolean;
}

export function ValidadorANVISAPanel({ 
  resultado, 
  onValidar, 
  validando = false,
  mostrarAcoes = true,
}: ValidadorANVISAPanelProps) {
  const [expandirDetalhes, setExpandirDetalhes] = useState(false);

  if (!resultado && mostrarAcoes) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Validação ANVISA
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Execute a validação automática para verificar conformidade regulatória.
          </p>
          <Button onClick={onValidar} disabled={validando}>
            {validando ? 'Validando...' : 'Executar Validação'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!resultado) return null;

  const getResultadoIcon = () => {
    switch (resultado.resultado_geral) {
      case 'OK':
        return <ShieldCheck className="h-5 w-5 text-green-600" />;
      case 'ALERTA':
        return <ShieldAlert className="h-5 w-5 text-yellow-600" />;
      case 'BLOQUEIO':
        return <ShieldAlert className="h-5 w-5 text-destructive" />;
    }
  };

  const getResultadoBadge = () => {
    switch (resultado.resultado_geral) {
      case 'OK':
        return <Badge className="bg-green-600">APROVADO</Badge>;
      case 'ALERTA':
        return <Badge variant="secondary" className="bg-yellow-500 text-white">COM ALERTAS</Badge>;
      case 'BLOQUEIO':
        return <Badge variant="destructive">BLOQUEADO</Badge>;
    }
  };

  const renderValidacaoItem = (item: ValidacaoItem) => {
    const getItemIcon = () => {
      switch (item.resultado) {
        case 'OK':
          return <CheckCircle2 className="h-4 w-4 text-green-600" />;
        case 'ALERTA':
          return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
        case 'BLOQUEIO':
          return <XCircle className="h-4 w-4 text-destructive" />;
      }
    };

    return (
      <div key={`${item.substancia}-${item.regra}`} className="flex items-start gap-2 p-2 rounded bg-muted/50">
        {getItemIcon()}
        <div className="flex-1 text-sm">
          <div className="font-medium">{item.substancia}</div>
          <div className="text-muted-foreground">{item.descricao}</div>
          {item.fonte_legal && (
            <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <FileText className="h-3 w-3" />
              {item.fonte_legal}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Status Principal */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              {getResultadoIcon()}
              Validação ANVISA
            </CardTitle>
            {getResultadoBadge()}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Resumo */}
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-2 rounded bg-green-50 dark:bg-green-950/30">
              <div className="text-lg font-bold text-green-600">
                {resultado.validacoes.filter(v => v.resultado === 'OK').length}
              </div>
              <div className="text-xs text-muted-foreground">Aprovados</div>
            </div>
            <div className="p-2 rounded bg-yellow-50 dark:bg-yellow-950/30">
              <div className="text-lg font-bold text-yellow-600">
                {resultado.alertas.length}
              </div>
              <div className="text-xs text-muted-foreground">Alertas</div>
            </div>
            <div className="p-2 rounded bg-red-50 dark:bg-red-950/30">
              <div className="text-lg font-bold text-destructive">
                {resultado.bloqueios.length}
              </div>
              <div className="text-xs text-muted-foreground">Bloqueios</div>
            </div>
          </div>

          {/* Bloqueios */}
          {resultado.bloqueios.length > 0 && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertTitle>Aprovação Bloqueada</AlertTitle>
              <AlertDescription>
                {resultado.bloqueios.length} irregularidade(s) impedem a aprovação.
              </AlertDescription>
            </Alert>
          )}

          {/* Alertas */}
          {resultado.alertas.length > 0 && resultado.bloqueios.length === 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Atenção</AlertTitle>
              <AlertDescription>
                {resultado.alertas.length} alerta(s) requerem atenção.
              </AlertDescription>
            </Alert>
          )}

          {/* Botão Expandir */}
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full"
            onClick={() => setExpandirDetalhes(!expandirDetalhes)}
          >
            {expandirDetalhes ? 'Ocultar Detalhes' : 'Ver Detalhes Completos'}
          </Button>

          {/* Detalhes Expandidos */}
          {expandirDetalhes && (
            <div className="space-y-4">
              <Separator />
              
              {/* Bloqueios */}
              {resultado.bloqueios.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm mb-2 text-destructive">Bloqueios ({resultado.bloqueios.length})</h4>
                  <div className="space-y-2">
                    {resultado.bloqueios.map(renderValidacaoItem)}
                  </div>
                </div>
              )}

              {/* Alertas */}
              {resultado.alertas.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm mb-2 text-yellow-600">Alertas ({resultado.alertas.length})</h4>
                  <div className="space-y-2">
                    {resultado.alertas.map(renderValidacaoItem)}
                  </div>
                </div>
              )}

              {/* Aprovados */}
              {resultado.validacoes.filter(v => v.resultado === 'OK').length > 0 && (
                <div>
                  <h4 className="font-medium text-sm mb-2 text-green-600">Aprovados</h4>
                  <ScrollArea className="h-40">
                    <div className="space-y-2">
                      {resultado.validacoes.filter(v => v.resultado === 'OK').map(renderValidacaoItem)}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Alegações Disponíveis */}
      {resultado.alegacoes_disponiveis.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Alegações Permitidas ({resultado.alegacoes_disponiveis.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-32">
              <ul className="space-y-1 text-sm">
                {resultado.alegacoes_disponiveis.map((alegacao, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="h-3 w-3 mt-1 text-green-600 flex-shrink-0" />
                    {alegacao}
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Avisos Obrigatórios */}
      {resultado.avisos_obrigatorios.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquareWarning className="h-4 w-4 text-yellow-600" />
              Avisos Obrigatórios no Rótulo ({resultado.avisos_obrigatorios.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {resultado.avisos_obrigatorios.map((aviso, i) => (
                <li key={i} className="flex items-start gap-2 text-yellow-700 dark:text-yellow-500">
                  <AlertTriangle className="h-3 w-3 mt-1 flex-shrink-0" />
                  {aviso}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
