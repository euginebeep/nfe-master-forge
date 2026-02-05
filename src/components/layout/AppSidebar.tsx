import { useLocation, Link } from "react-router-dom";
import {
  Building2,
  Users,
  Package,
  Truck,
  Settings,
  ChevronDown,
  LayoutDashboard,
  ShoppingCart,
  FileText,
  DollarSign,
  ClipboardList,
  Factory,
  FlaskConical,
  Boxes,
  BarChart3,
  Shield,
  MessageSquare,
  Store,
  ShieldAlert,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface MenuItem {
  title: string;
  url: string;
  icon: any;
  badge?: string;
}

interface MenuGroup {
  label: string;
  items: MenuItem[];
}

const menuGroups: MenuGroup[] = [
  {
    label: "Principal",
    items: [
      { title: "Dashboard", url: "/", icon: LayoutDashboard },
    ],
  },
  {
    label: "Cadastros",
    items: [
      { title: "Fornecedores", url: "/cadastros/fornecedores", icon: Truck },
      { title: "Clientes", url: "/cadastros/clientes", icon: Users },
      { title: "Transportadoras", url: "/cadastros/transportadoras", icon: ShoppingCart },
      { title: "Produtos/Insumos", url: "/cadastros/produtos", icon: Package },
    ],
  },
  {
    label: "Producao",
    items: [
      { title: "Formulador", url: "/producao/formulas", icon: FlaskConical, badge: "ANVISA" },
      { title: "Ordens de Producao", url: "/producao/ordens", icon: Factory },
    ],
  },
  {
    label: "Estoque",
    items: [
      { title: "Lotes", url: "/estoque/lotes", icon: Boxes },
      { title: "Movimentacoes", url: "/estoque/movimentacoes", icon: ClipboardList },
    ],
  },
  {
    label: "Compras",
    items: [
      { title: "Importar NF-e", url: "/compras/importar-nfe", icon: FileText },
      { title: "Notas de Entrada", url: "/compras/notas-entrada", icon: FileText },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { title: "Contas a Pagar", url: "/financeiro/pagar", icon: DollarSign },
      { title: "Contas a Receber", url: "/financeiro/receber", icon: DollarSign },
      { title: "Fluxo de Caixa", url: "/financeiro/fluxo", icon: BarChart3 },
    ],
  },
  {
    label: "Vendas",
    items: [
      { title: "CRM", url: "/vendas/crm", icon: MessageSquare },
      { title: "Pedidos", url: "/vendas/pedidos", icon: ShoppingCart },
      { title: "Marketplace", url: "/vendas/marketplace", icon: Store },
    ],
  },
  {
    label: "Relatorios",
    items: [
      { title: "Relatorios", url: "/relatorios", icon: BarChart3 },
      { title: "Auditoria", url: "/auditoria", icon: Shield },
    ],
  },
];

export function AppSidebar() {
  const location = useLocation();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  const isActive = (url: string) => {
    if (url === "/") return location.pathname === "/";
    return location.pathname.startsWith(url);
  };

  return (
    <Sidebar
      className={cn(
        "border-r border-sidebar-border transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
      collapsible="icon"
    >
      <SidebarHeader className="border-b border-sidebar-border bg-sidebar">
        <Link to="/" className="flex items-center gap-3 px-4 py-4">
          <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center shadow-lg">
            <Factory className="w-6 h-6 text-secondary-foreground" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-bold text-lg text-sidebar-foreground tracking-tight">LEGACY</span>
              <span className="text-xs text-sidebar-foreground/60 font-medium">ERP Industrial</span>
            </div>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2 py-4 bg-sidebar overflow-y-auto">
        {menuGroups.map((group) => (
          <Collapsible key={group.label} defaultOpen className="mb-1">
            <SidebarGroup>
              <CollapsibleTrigger className="w-full">
                <SidebarGroupLabel className="flex items-center justify-between px-3 py-2 text-[10px] font-semibold text-sidebar-foreground/50 uppercase tracking-widest hover:text-sidebar-foreground transition-colors">
                  {!collapsed && group.label}
                  {!collapsed && <ChevronDown className="w-3 h-3" />}
                </SidebarGroupLabel>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map((item) => (
                      <SidebarMenuItem key={item.url}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive(item.url)}
                          tooltip={collapsed ? item.title : undefined}
                        >
                          <Link
                            to={item.url}
                            className={cn(
                              "flex items-center gap-3 px-3 py-2.5 rounded-md transition-all duration-200",
                              isActive(item.url)
                                ? "bg-secondary text-secondary-foreground shadow-md"
                                : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                            )}
                          >
                            <item.icon className="w-5 h-5 shrink-0" />
                            {!collapsed && (
                              <span className="flex-1 text-sm font-medium">{item.title}</span>
                            )}
                            {!collapsed && item.badge && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-secondary/20 text-secondary-foreground">
                                {item.badge}
                              </span>
                            )}
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3 bg-sidebar">
        <Link
          to="/settings/empresa"
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-md transition-all duration-200",
            isActive("/settings/empresa")
              ? "bg-secondary text-secondary-foreground"
              : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
          )}
        >
          <Settings className="w-5 h-5 shrink-0" />
          {!collapsed && <span className="text-sm font-medium">Configuracoes</span>}
        </Link>
        <Link
          to="/settings/admin-master"
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-md transition-all duration-200",
            isActive("/settings/admin-master")
              ? "bg-destructive text-destructive-foreground"
              : "text-destructive/70 hover:bg-destructive/10 hover:text-destructive"
          )}
        >
          <ShieldAlert className="w-5 h-5 shrink-0" />
          {!collapsed && <span className="text-sm font-medium">Admin Master</span>}
        </Link>
        <Link
          to="/usuarios"
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-md transition-all duration-200",
            isActive("/usuarios")
              ? "bg-secondary text-secondary-foreground"
              : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
          )}
        >
          <Shield className="w-5 h-5 shrink-0" />
          {!collapsed && <span className="text-sm font-medium">Usuarios</span>}
        </Link>
      </SidebarFooter>
    </Sidebar>
  );
}
