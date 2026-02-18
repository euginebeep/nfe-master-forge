import { useAuth } from '@/hooks/use-auth';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface ModuleGuardProps {
  /** ID do módulo (deve bater com SYSTEM_MODULES) */
  modulo: string;
  /** Título amigável do módulo para exibição */
  moduloLabel?: string;
  children: React.ReactNode;
}

/**
 * Protege uma página inteira baseado na permissão de visualização do módulo.
 * Admin sempre tem acesso. Outros usuários precisam ter `pode_visualizar = true`.
 */
export function ModuleGuard({ modulo, moduloLabel, children }: ModuleGuardProps) {
  const { canView, role, isLoading } = useAuth();
  const navigate = useNavigate();

  if (isLoading) {
    return <LoadingSpinner fullPage />;
  }

  if (!canView(modulo)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 p-8 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
          <ShieldAlert className="h-10 w-10 text-destructive" />
        </div>
        <div className="space-y-2 max-w-md">
          <h2 className="text-2xl font-bold">Acesso Restrito</h2>
          <p className="text-muted-foreground">
            Você não tem permissão para acessar o módulo{' '}
            <strong>{moduloLabel || modulo}</strong>.
          </p>
          <p className="text-sm text-muted-foreground">
            Entre em contato com o administrador do sistema para solicitar acesso.
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate('/')} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Voltar ao Dashboard
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
