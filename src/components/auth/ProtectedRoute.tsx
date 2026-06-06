import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2, ShieldAlert } from 'lucide-react';
import { useAuthContext } from '@/contexts/AuthContext';
import { useInactivityTimeout } from '@/hooks/use-inactivity-timeout';

type AppRole = 'admin' | 'gerente' | 'supervisor' | 'operador' | 'visualizador';

const ROLE_HIERARCHY: AppRole[] = ['admin', 'gerente', 'supervisor', 'operador', 'visualizador'];

interface Props {
  children: React.ReactNode;
  minRole?: AppRole;
}

export function ProtectedRoute({ children, minRole }: Props) {
  const { isLoading, isAuthenticated, role } = useAuthContext();
  const location = useLocation();

  // Prevent browser back/forward from showing cached pages
  useEffect(() => {
    const metaCache = document.createElement('meta');
    metaCache.httpEquiv = 'Cache-Control';
    metaCache.content = 'no-cache, no-store, must-revalidate';
    document.head.appendChild(metaCache);

    return () => {
      document.head.removeChild(metaCache);
    };
  }, []);

  // Inactivity timeout (2 hours)
  useInactivityTimeout();

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

  if (minRole && role) {
    const userLevel = ROLE_HIERARCHY.indexOf(role);
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
