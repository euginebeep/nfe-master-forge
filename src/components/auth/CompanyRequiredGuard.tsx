import { useCompany } from '@/hooks/use-company';
import { useLocation, Navigate } from 'react-router-dom';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Building2, ArrowRight, Users, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

/** Routes allowed even without a company registered */
const ALLOWED_ROUTES = [
  '/settings/empresa',
  '/settings/company',
  '/settings/admin-master',
  '/settings/clear-data',
  '/usuarios',
  '/settings/usuarios',
  '/onboarding',
];

function isRouteAllowed(pathname: string) {
  return ALLOWED_ROUTES.some(r => pathname.startsWith(r));
}

interface Props {
  children: React.ReactNode;
}

/**
 * Blocks all app routes until the admin registers the company.
 * Only allows: Users management, Admin Master, Clear Data, and Company Settings.
 */
export function CompanyRequiredGuard({ children }: Props) {
  const { data: company, isLoading } = useCompany();
  const location = useLocation();
  const navigate = useNavigate();

  if (isLoading) {
    return <LoadingSpinner fullPage text="Verificando empresa..." />;
  }

  // Company exists → allow everything
  if (company) {
    return <>{children}</>;
  }

  // No company → allow only specific routes
  if (isRouteAllowed(location.pathname)) {
    return <>{children}</>;
  }

  // Block with a prominent message
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg"
      >
        <Card className="border-2 border-destructive/30 shadow-xl">
          <CardContent className="p-8 text-center space-y-6">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-destructive/10 mx-auto">
              <Building2 className="h-10 w-10 text-destructive" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold">Cadastro da Empresa Obrigatório</h2>
              <p className="text-muted-foreground">
                Para utilizar o sistema, é necessário cadastrar os dados da sua empresa primeiro.
                Sem o cadastro, não é possível acessar os módulos do ERP.
              </p>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground text-left space-y-2">
              <p className="font-medium text-foreground">Enquanto isso, você pode:</p>
              <ul className="space-y-1 ml-4 list-disc">
                <li>Cadastrar e gerenciar usuários</li>
                <li>Acessar o painel administrativo</li>
                <li>Limpar dados do sistema</li>
              </ul>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                size="lg"
                className="gap-2"
                onClick={() => navigate('/settings/empresa')}
              >
                <Building2 className="h-4 w-4" />
                Cadastrar Empresa
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex justify-center gap-4 pt-2">
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 text-muted-foreground"
                onClick={() => navigate('/usuarios')}
              >
                <Users className="h-4 w-4" />
                Gerenciar Usuários
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 text-muted-foreground"
                onClick={() => navigate('/settings/admin-master')}
              >
                <Trash2 className="h-4 w-4" />
                Admin Master
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
