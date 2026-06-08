import { motion } from "framer-motion";
import { 
  Building2, Users, Package, FileText, Boxes, ArrowRight, 
  Settings, ShoppingCart, Factory, BarChart3, Wallet,
  Lock
} from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserWelcomeCard } from "@/components/dashboard/UserWelcomeCard";
import { ExchangeRateCard } from "@/components/dashboard/ExchangeRateCard";
import { MarketIndicesCard } from "@/components/dashboard/MarketIndicesCard";
import { ExpiringLotsCard } from "@/components/dashboard/ExpiringLotsCard";
import { ConsultaANVISACard } from "@/components/dashboard/ConsultaANVISACard";
import { NewsFeedCard } from "@/components/dashboard/NewsFeedCard";
import { DashboardKPIsGrid } from "@/components/dashboard/DashboardKPIsGrid";
import { BirthdayCard } from "@/components/dashboard/BirthdayCard";
import { useAuth } from "@/hooks/use-auth";
import { AvisosPopup } from "@/components/AvisosPopup";

type AppRole = 'admin' | 'gerente' | 'supervisor' | 'operador' | 'visualizador';

interface Module {
  title: string;
  description: string;
  icon: React.ElementType;
  href: string;
  minRole: AppRole;
}

const modules: Module[] = [
  {
    title: "Empresa",
    description: "Configurações fiscais e NF-e",
    icon: Building2,
    href: "/settings/company",
    minRole: "admin",
  },
  {
    title: "Entidades",
    description: "Fornecedores, clientes e parceiros",
    icon: Users,
    href: "/cadastros/entidades",
    minRole: "visualizador",
  },
  {
    title: "Itens",
    description: "Matérias primas e produtos",
    icon: Package,
    href: "/cadastros/itens",
    minRole: "visualizador",
  },
  {
    title: "Importar NF-e",
    description: "Upload de XML de notas fiscais",
    icon: FileText,
    href: "/compras/nfe-import",
    minRole: "operador",
  },
  {
    title: "Lotes",
    description: "Controle de estoque por lote",
    icon: Boxes,
    href: "/estoque/lotes",
    minRole: "visualizador",
  },
  {
    title: "Compras",
    description: "Gestão de pedidos e notas",
    icon: ShoppingCart,
    href: "/compras/notas-entrada",
    minRole: "operador",
  },
  {
    title: "Produção",
    description: "Fórmulas e ordens de produção",
    icon: Factory,
    href: "/producao/formulas",
    minRole: "supervisor",
  },
  {
    title: "Financeiro",
    description: "Contas a pagar e receber",
    icon: Wallet,
    href: "/financeiro/contas-pagar",
    minRole: "gerente",
  },
  {
    title: "Relatórios",
    description: "Análises e indicadores",
    icon: BarChart3,
    href: "/relatorios",
    minRole: "supervisor",
  },
  {
    title: "Configurações",
    description: "Administração do sistema",
    icon: Settings,
    href: "/settings/empresa",
    minRole: "admin",
  },
];

// Role hierarchy for permission check
const roleHierarchy: AppRole[] = ['admin', 'gerente', 'supervisor', 'operador', 'visualizador'];

const Index = () => {
  const { profile, role, isLoading, isAuthenticated } = useAuth();

  // Check if user has access to a module
  const hasAccess = (minRole: AppRole): boolean => {
    if (!role) return false;
    const userRoleIndex = roleHierarchy.indexOf(role);
    const requiredRoleIndex = roleHierarchy.indexOf(minRole);
    return userRoleIndex <= requiredRoleIndex;
  };

  // Filter modules based on user role
  const accessibleModules = modules.filter(m => hasAccess(m.minRole));
  const lockedModules = modules.filter(m => !hasAccess(m.minRole));

  return (
    <div className="space-y-4 sm:space-y-6">
      <AvisosPopup />
      {/* User Welcome Section */}
      {isAuthenticated && (
        <UserWelcomeCard
          name={profile?.nome_completo || null}
          role={role}
          cargo={profile?.cargo || null}
          avatarUrl={profile?.avatar_url || null}
          sexo={profile?.sexo || null}
          isLoading={isLoading}
        />
      )}

      {/* Real KPIs */}
      {isAuthenticated && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Indicadores em Tempo Real</h3>
          <DashboardKPIsGrid />
        </div>
      )}

      {/* Alerts Row */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <ExpiringLotsCard />
        <ExchangeRateCard />
        <MarketIndicesCard />
        <ConsultaANVISACard />
      </div>

      {/* Aniversariantes */}
      {isAuthenticated && <BirthdayCard />}

      {/* News Feed */}
      <NewsFeedCard />

      {/* Modules Grid */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Módulos Disponíveis</h3>
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {accessibleModules.map((module, index) => (
            <motion.div
              key={module.href}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Link to={module.href}>
                <Card className="h-full hover:shadow-md transition-all cursor-pointer group hover:border-primary/50">
                  <CardHeader className="flex flex-row items-center gap-4 pb-2">
                    <div className="p-2.5 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      <module.icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-base">{module.title}</CardTitle>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm text-muted-foreground">{module.description}</p>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Locked Modules */}
      {lockedModules.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4 text-muted-foreground flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Módulos Restritos
          </h3>
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {lockedModules.map((module, index) => (
              <motion.div
                key={module.href}
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.6 }}
                transition={{ delay: 0.3 + index * 0.05 }}
              >
                <Card className="h-full opacity-50 cursor-not-allowed">
                  <CardHeader className="flex flex-row items-center gap-4 pb-2">
                    <div className="p-2.5 rounded-lg bg-muted text-muted-foreground">
                      <module.icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-base text-muted-foreground">{module.title}</CardTitle>
                    </div>
                    <Lock className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm text-muted-foreground">{module.description}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Requer: {module.minRole}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Index;
