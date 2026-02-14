import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ShieldAlert } from 'lucide-react';

type AppRole = 'admin' | 'gerente' | 'supervisor' | 'operador' | 'visualizador';

const ROLE_HIERARCHY: AppRole[] = ['admin', 'gerente', 'supervisor', 'operador', 'visualizador'];

interface Props {
  children: React.ReactNode;
  minRole?: AppRole;
}

export function ProtectedRoute({ children, minRole }: Props) {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState<AppRole | null>(null);
  const location = useLocation();

  useEffect(() => {
    let mounted = true;

    const checkAuth = async (userId?: string) => {
      if (userId && minRole) {
        const { data: roleData } = await supabase.rpc('get_user_role', { _user_id: userId });
        if (mounted) setUserRole(roleData as AppRole || 'visualizador');
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setIsAuthenticated(!!session);
      if (session?.user?.id) checkAuth(session.user.id);
      setIsLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setIsAuthenticated(!!session);
      if (session?.user?.id) checkAuth(session.user.id);
      setIsLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [minRole]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Verificando autenticação...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Check role-based access
  if (minRole && userRole) {
    const userLevel = ROLE_HIERARCHY.indexOf(userRole);
    const requiredLevel = ROLE_HIERARCHY.indexOf(minRole);
    if (userLevel > requiredLevel) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center max-w-md p-8">
            <ShieldAlert className="h-16 w-16 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Acesso Restrito</h2>
            <p className="text-muted-foreground mb-4">
              Você não tem permissão para acessar esta área. 
              Nível mínimo: <strong>{minRole}</strong>
            </p>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
}