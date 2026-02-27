import { useLocation, Link, useNavigate } from "react-router-dom";
import {
  Building2,
  Users,
  Package,
  FileSearch,
  PieChart,
  Truck,
  Settings,
  ChevronDown,
  LayoutDashboard,
  ShoppingCart,
  FileText,
  FileOutput,
  DollarSign,
  ClipboardList,
  Factory,
  FlaskConical,
  Boxes,
  BarChart3,
  Shield,
  MessageSquare,
  MessageCircle,
  Store,
  ShieldAlert,
  FileArchive,
  Database,
  UserCheck,
  Map,
  LogOut } from
"lucide-react";
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
  useSidebar } from
"@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger } from
"@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger } from
"@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

interface MenuItem {
  title: string;
  url: string;
  icon: React.ComponentType<{className?: string;}>;
  badge?: string;
  tooltip: string;
  /** Módulo de permissão correspondente (deve bater com os IDs de SYSTEM_MODULES) */
  modulo?: string;
  /** Se true, aparece apenas para admin */
  adminOnly?: boolean;
}

interface MenuGroup {
  label: string;
  /** Módulo-pai que controla a visibilidade do grupo inteiro */
  modulo?: string;
  items: MenuItem[];
}

// Mapeamento dos itens do menu para os módulos de permissão
const menuGroups: MenuGroup[] = [
{
  label: "Principal",
  items: [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, tooltip: "Visão geral do sistema com KPIs, alertas e notícias" },
  { title: "Chat Interno", url: "/chat", icon: MessageCircle, tooltip: "Comunicação interna entre colaboradores da empresa" },
  { title: "Roadmap", url: "/roadmap", icon: Map, tooltip: "Mapa de evolução e próximas funcionalidades do BrainX" }]

},
{
  label: "Cadastros",
  modulo: "entidades",
  items: [
  { title: "Entidades", url: "/cadastros/entidades", icon: Building2, tooltip: "Cadastro completo de fornecedores, clientes e parceiros", modulo: "entidades" },
  { title: "Fornecedores", url: "/cadastros/fornecedores", icon: Truck, tooltip: "Gestão de fornecedores e condições comerciais", modulo: "entidades" },
  { title: "Clientes", url: "/cadastros/clientes", icon: Users, tooltip: "Cadastro e histórico de clientes da empresa", modulo: "entidades" },
  { title: "Transportadoras", url: "/cadastros/transportadoras", icon: ShoppingCart, tooltip: "Cadastro de transportadoras e meios de envio", modulo: "entidades" },
  { title: "Produtos/Insumos", url: "/cadastros/produtos", icon: Package, tooltip: "Cadastro de matérias-primas, insumos e produtos acabados", modulo: "itens" },
  { title: "Responsáveis Técnicos", url: "/cadastros/responsaveis-tecnicos", icon: UserCheck, badge: "RT", tooltip: "Gestão de responsáveis técnicos habilitados para produção", modulo: "producao" }]

},
{
  label: "Producao",
  modulo: "producao",
  items: [
  { title: "Formulador", url: "/producao/formulas", icon: FlaskConical, badge: "ANVISA", tooltip: "Formulador industrial com validação ANVISA", modulo: "producao" },
  { title: "Ordens de Producao", url: "/producao/ordens", icon: Factory, tooltip: "Criação e acompanhamento de ordens de produção", modulo: "producao" },
  { title: "Dashboard Industrial", url: "/producao/dashboard", icon: BarChart3, tooltip: "Indicadores operacionais e análise de anomalias", modulo: "producao" },
  { title: "Dashboard Executivo", url: "/producao/executivo", icon: BarChart3, badge: "KPI", tooltip: "KPIs executivos e alertas estratégicos", modulo: "producao" }]

},
{
  label: "Estoque",
  modulo: "estoque",
  items: [
  { title: "Quarentena", url: "/estoque/quarentena", icon: ShieldAlert, tooltip: "Lotes em quarentena aguardando liberação", modulo: "estoque" },
  { title: "Lotes", url: "/estoque/lotes", icon: Boxes, tooltip: "Consulta e gestão de lotes de matérias-primas e produtos", modulo: "estoque" },
  { title: "Movimentacoes", url: "/estoque/movimentacoes", icon: ClipboardList, tooltip: "Histórico de entradas, saídas e ajustes de estoque", modulo: "estoque" },
  { title: "Rastreabilidade", url: "/estoque/rastreabilidade", icon: Shield, badge: "GMP", tooltip: "Rastreabilidade completa conforme exigências GMP e ANVISA", modulo: "estoque" }]

},
{
  label: "Compras",
  modulo: "compras",
  items: [
  { title: "Importar NF-e", url: "/compras/importar-nfe", icon: FileText, tooltip: "Importação de notas fiscais de entrada via XML", modulo: "compras" },
  { title: "Notas de Entrada", url: "/compras/notas-entrada", icon: FileText, tooltip: "Consulta e gestão de notas fiscais de compra recebidas", modulo: "compras" }]

},
{
  label: "Financeiro",
  modulo: "financeiro",
  items: [
  { title: "Contas a Pagar", url: "/financeiro/pagar", icon: DollarSign, tooltip: "Gestão de contas a pagar e vencimentos futuros", modulo: "financeiro" },
  { title: "Contas a Receber", url: "/financeiro/receber", icon: DollarSign, tooltip: "Controle de recebimentos e inadimplência de clientes", modulo: "financeiro" },
  { title: "Fluxo de Caixa", url: "/financeiro/fluxo", icon: BarChart3, tooltip: "Projeção e análise de fluxo de caixa da empresa", modulo: "financeiro" },
  { title: "Conciliação", url: "/financeiro/conciliacao", icon: FileSearch, tooltip: "Conciliação bancária e financeira", modulo: "financeiro" },
  { title: "DRE Gerencial", url: "/financeiro/dre", icon: PieChart, badge: "DRE", tooltip: "Demonstrativo de resultados gerencial da empresa", modulo: "financeiro" }]

},
{
  label: "Vendas",
  modulo: "vendas",
  items: [
  { title: "CRM", url: "/vendas/crm", icon: MessageSquare, tooltip: "Gestão de relacionamento e pipeline de vendas", modulo: "vendas" },
  { title: "Orçamentos", url: "/vendas/orcamentos", icon: FileText, tooltip: "Criação e acompanhamento de orçamentos para clientes", modulo: "vendas" },
  { title: "Pedidos", url: "/vendas/pedidos", icon: ShoppingCart, tooltip: "Controle de pedidos de venda e status de entrega", modulo: "vendas" },
  { title: "Notas de Saída", url: "/vendas/notas-saida", icon: FileOutput, tooltip: "Emissão e gestão de notas fiscais de saída (NF-e)", modulo: "vendas" },
  { title: "Marketplace", url: "/vendas/marketplace", icon: Store, tooltip: "Catálogo de produtos para venda online e marketplace", modulo: "vendas" }]

},
{
  label: "Qualidade",
  modulo: "estoque",
  items: [
  { title: "Desvios / CAPA", url: "/qualidade/desvios", icon: ShieldAlert, badge: "QC", tooltip: "Registro e tratamento de desvios e ações corretivas (CAPA)", modulo: "estoque" },
  { title: "Análises", url: "/qualidade/analises", icon: FlaskConical, tooltip: "Análises laboratoriais e resultados de controle de qualidade", modulo: "estoque" },
  { title: "Calibrações", url: "/qualidade/calibracoes", icon: Settings, tooltip: "Controle de calibração de instrumentos e equipamentos", modulo: "estoque" }]

},
{
  label: "Regulatorio",
  modulo: "producao",
  items: [
  { title: "Consulta ANVISA", url: "/regulatorio/anvisa", icon: Shield, badge: "IN28", tooltip: "Consulta à base de dados ANVISA — constituintes e limites da IN 28/2018", modulo: "producao" }]

},
{
  label: "Relatorios",
  modulo: "relatorios",
  items: [
  { title: "Relatorios", url: "/relatorios", icon: BarChart3, tooltip: "Relatórios gerenciais de produção, estoque e vendas", modulo: "relatorios" },
  { title: "Auditoria", url: "/auditoria", icon: Shield, tooltip: "Trilha de auditoria imutável de todas as operações do sistema", modulo: "relatorios" }]

},
];


// Itens do footer que exigem permissões específicas
interface FooterItem {
  to: string;
  icon: React.ComponentType<{className?: string;}>;
  label: string;
  tooltip: string;
  danger?: boolean;
  modulo?: string;
  adminOnly?: boolean;
}

const footerItems: FooterItem[] = [
{ to: "/settings/empresa", icon: Settings, label: "Configuracoes", tooltip: "Configurações gerais da empresa e sistema", modulo: "configuracoes" },
{ to: "/settings/admin-master", icon: ShieldAlert, label: "Admin Master", tooltip: "Painel administrativo master — operações críticas do sistema", danger: true, adminOnly: true },
{ to: "/usuarios", icon: Shield, label: "Usuarios", tooltip: "Gestão de usuários, permissões e acessos ao sistema", modulo: "usuarios" }];


export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { role, canView, isLoading, signOut } = useAuth();

  const isAdmin = role === 'admin';

  const handleSignOut = async () => {
    await signOut();
    // Force full page reload to clear all cached state
    window.location.href = '/auth';
  };

  const isActive = (url: string) => {
    if (url === "/") return location.pathname === "/";
    return location.pathname.startsWith(url);
  };

  // Verifica se o item do menu é visível para o usuário atual
  const isItemVisible = (item: MenuItem): boolean => {
    if (isAdmin) return true;
    if (item.adminOnly) return false;
    if (!item.modulo) return true; // sem restrição de módulo
    return canView(item.modulo);
  };

  // Verifica se o item do footer é visível para o usuário atual
  const isFooterItemVisible = (item: FooterItem): boolean => {
    if (isAdmin) return true;
    if (item.adminOnly) return false;
    if (!item.modulo) return true;
    return canView(item.modulo);
  };

  if (isLoading) {
    return (
      <Sidebar className={cn("border-r border-sidebar-border", collapsed ? "w-16" : "w-64")} collapsible="icon">
        <SidebarHeader className="border-b border-sidebar-border bg-sidebar">
          <Link to="/" className="flex items-center gap-3 px-4 py-4">
            <img src="/brainx-logo.png" alt="BrainX" className="w-10 h-10 object-contain rounded" />
            {!collapsed &&
            <div className="flex flex-col">
                <span className="font-bold text-lg text-sidebar-foreground tracking-tight">BrainX</span>
                <span className="text-xs text-sidebar-foreground/60 font-medium">ERP Industrial</span>
              </div>
            }
          </Link>
        </SidebarHeader>
        <SidebarContent className="px-2 py-4 bg-sidebar">
          <div className="space-y-2 px-3">
            {[1, 2, 3, 4, 5].map((i) =>
            <div key={i} className="h-8 rounded bg-sidebar-accent/30 animate-pulse" />
            )}
          </div>
        </SidebarContent>
      </Sidebar>);

  }

  return (
    <TooltipProvider delayDuration={400}>
      <Sidebar
        className={cn(
          "border-r border-sidebar-border transition-all duration-300",
          collapsed ? "w-16" : "w-64"
        )}
        collapsible="icon">

        <SidebarHeader className="border-b border-sidebar-border bg-sidebar">
          <Link to="/" className="flex items-center gap-3 px-4 py-4">
            <img src="/brainx-logo.png" alt="BrainX" className="w-10 h-10 object-contain rounded" />
            {!collapsed &&
            <div className="flex flex-col">
                <span className="font-bold text-lg text-sidebar-foreground tracking-tight">BrainX</span>
                <span className="text-xs text-sidebar-foreground/60 font-medium">ERP Industrial</span>
              </div>
            }
          </Link>
        </SidebarHeader>

        <SidebarContent className="px-2 py-4 bg-sidebar overflow-y-auto">
          {menuGroups.map((group) => {
            // Filtra os itens visíveis do grupo
            const visibleItems = group.items.filter(isItemVisible);

            // Oculta o grupo inteiro se não tiver itens visíveis
            if (visibleItems.length === 0) return null;

            return (
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
                        {visibleItems.map((item) =>
                        <SidebarMenuItem key={item.url}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <SidebarMenuButton
                                asChild
                                isActive={isActive(item.url)}>

                                  <Link
                                  to={item.url}
                                  className={cn(
                                    "flex items-center gap-3 px-3 py-2.5 rounded-md transition-all duration-200",
                                    isActive(item.url) ?
                                    "bg-secondary text-secondary-foreground shadow-md" :
                                    "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                                  )}>

                                    <item.icon className="w-5 h-5 shrink-0" />
                                    {!collapsed &&
                                  <span className="flex-1 text-sm font-medium">{item.title}</span>
                                  }
                                    {!collapsed && item.badge &&
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-secondary/20 text-secondary-foreground">
                                        {item.badge}
                                      </span>
                                  }
                                  </Link>
                                </SidebarMenuButton>
                              </TooltipTrigger>
                              <TooltipContent side="right" className="max-w-[220px] text-xs">
                                <p className="font-semibold">{item.title}</p>
                                <p className="text-muted-foreground mt-0.5">{item.tooltip}</p>
                              </TooltipContent>
                            </Tooltip>
                          </SidebarMenuItem>
                        )}
                      </SidebarMenu>
                    </SidebarGroupContent>
                  </CollapsibleContent>
                </SidebarGroup>
              </Collapsible>);

          })}
        </SidebarContent>

        <SidebarFooter className="border-t border-sidebar-border p-3 bg-sidebar space-y-1">
          {footerItems.filter(isFooterItemVisible).map(({ to, icon: Icon, label, tooltip, danger }) =>
          <Tooltip key={to}>
              <TooltipTrigger asChild>
                <Link
                to={to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md transition-all duration-200",
                  danger ?
                  isActive(to) ?
                  "bg-destructive text-destructive-foreground" :
                  "text-destructive/70 hover:bg-destructive/10 hover:text-destructive" :
                  isActive(to) ?
                  "bg-secondary text-secondary-foreground" :
                  "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                )}>

                  <Icon className="w-5 h-5 shrink-0" />
                  {!collapsed && <span className="text-sm font-medium">{label}</span>}
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-[220px] text-xs">
                <p className="font-semibold">{label}</p>
                <p className="text-muted-foreground mt-0.5">{tooltip}</p>
              </TooltipContent>
            </Tooltip>
          )}

          {/* Botão Sair do Sistema */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-3 px-3 py-2.5 rounded-md transition-all duration-200 w-full text-destructive/80 hover:bg-destructive/10 hover:text-destructive"
              >
                <LogOut className="w-5 h-5 shrink-0" />
                {!collapsed && <span className="text-sm font-medium">Sair do Sistema</span>}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-[220px] text-xs">
              <p className="font-semibold">Sair</p>
              <p className="text-muted-foreground mt-0.5">Encerrar sessão e voltar à tela de login</p>
            </TooltipContent>
          </Tooltip>
        </SidebarFooter>
      </Sidebar>
    </TooltipProvider>);

}