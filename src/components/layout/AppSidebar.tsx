import { useLocation, Link } from "react-router-dom";
import {
  Building2,
  Users,
  Package,
  FileText,
  Boxes,
  Settings,
  ChevronDown,
  LayoutDashboard,
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

const menuGroups = [
  {
    label: "Cadastros",
    items: [
      { title: "Empresa", url: "/settings/company", icon: Building2 },
      { title: "Entidades", url: "/cadastros/entidades", icon: Users },
      { title: "Itens", url: "/cadastros/itens", icon: Package },
    ],
  },
  {
    label: "Compras",
    items: [
      { title: "Importar NF-e", url: "/compras/nfe-import", icon: FileText },
    ],
  },
  {
    label: "Estoque",
    items: [
      { title: "Lotes", url: "/estoque/lotes", icon: Boxes },
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
      <SidebarHeader className="border-b border-sidebar-border">
        <Link to="/" className="flex items-center gap-3 px-4 py-4">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <LayoutDashboard className="w-5 h-5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-semibold text-sidebar-foreground">LEGACY</span>
              <span className="text-xs text-sidebar-foreground/60">ERP System</span>
            </div>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2 py-4">
        {menuGroups.map((group) => (
          <Collapsible key={group.label} defaultOpen className="mb-2">
            <SidebarGroup>
              <CollapsibleTrigger className="w-full">
                <SidebarGroupLabel className="flex items-center justify-between px-3 py-2 text-xs font-medium text-sidebar-foreground/60 uppercase tracking-wider hover:text-sidebar-foreground transition-colors">
                  {!collapsed && group.label}
                  {!collapsed && <ChevronDown className="w-4 h-4" />}
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
                              "flex items-center gap-3 px-3 py-2 rounded-md transition-colors",
                              isActive(item.url)
                                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                                : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                            )}
                          >
                            <item.icon className="w-5 h-5 shrink-0" />
                            {!collapsed && <span>{item.title}</span>}
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

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <Link
          to="/settings/company"
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-md transition-colors",
            "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
          )}
        >
          <Settings className="w-5 h-5 shrink-0" />
          {!collapsed && <span>Configuracoes</span>}
        </Link>
      </SidebarFooter>
    </Sidebar>
  );
}
