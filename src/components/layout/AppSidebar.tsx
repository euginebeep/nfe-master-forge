import { useLocation, Link, useNavigate } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";
import brainxLogo from "@/assets/brainx-logo.png";
import { LogoDemoERP } from "./LogoDemoERP";
import { useCompany } from "@/hooks/use-company";
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
  FileInput,
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
  HelpCircle,
  LogOut,
  Thermometer,
  Settings2,
  ClipboardCheck,
  ScrollText,
  Tag,
  BookOpen,
  FileCheck } from
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
  /** Se true, usa cores de destaque (vermelho claro) */
  danger?: boolean;
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
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, tooltip: "Visão geral do sistema com KPIs, alertas e notícias" },
  ]

},
{
  label: "Cadastros",
  modulo: "entidades",
  items: [
  { title: "Entidades", url: "/cadastros/entidades", icon: Building2, tooltip: "Cadastro completo de fornecedores, clientes e parceiros", modulo: "entidades" },
  { title: "Fornecedores", url: "/cadastros/fornecedores", icon: Factory, tooltip: "Gestão de fornecedores e condições comerciais", modulo: "entidades" },
  { title: "Clientes", url: "/cadastros/clientes", icon: Users, tooltip: "Cadastro e histórico de clientes da empresa", modulo: "entidades" },
  { title: "Transportadoras", url: "/cadastros/transportadoras", icon: Truck, tooltip: "Cadastro de transportadoras e meios de envio", modulo: "entidades" },
  { title: "Produtos/Insumos", url: "/cadastros/produtos", icon: Package, tooltip: "Cadastro de matérias-primas, insumos e produtos acabados", modulo: "itens" },
  ]

},
{
  label: "Suprimentos",
  modulo: "compras",
  items: [
  { title: "Comprar", url: "/compras/comprar", icon: ShoppingCart, tooltip: "Necessidades consolidadas: monta a cesta e gera cotação", modulo: "compras" },
  { title: "Mapa de cotação", url: "/compras/mapa", icon: ClipboardList, tooltip: "Compare preços e escolha fornecedor por item consolidado", modulo: "compras" },
  { title: "Pedidos de Compra", url: "/compras/pedidos", icon: Package, tooltip: "Pedidos de compra gerados após aprovação do mapa", modulo: "compras" },
  { title: "Importar NF-e", url: "/compras/importar-nfe", icon: FileInput, tooltip: "Importação de notas fiscais de entrada via XML", modulo: "compras" },
  { title: "Notas de Entrada", url: "/compras/notas-entrada", icon: FileText, tooltip: "Consulta e gestão de notas fiscais de compra recebidas", modulo: "compras" },
  { title: "Fator de Conversão", url: "/compras/fator-conversao", icon: BarChart3, tooltip: "Histórico de conversões de unidades por fornecedor com sugestões automáticas", modulo: "compras" },
  { title: "Acompanhamento", url: "/compras/requisicoes", icon: ClipboardList, tooltip: "Acompanhamento de requisições: cotação, aprovação, pedido e recebimento", modulo: "compras" }]

},
{
  label: "Estoque",
  modulo: "estoque",
  items: [
  { title: "Lotes", url: "/estoque/lotes", icon: Boxes, tooltip: "Consulta e gestão de lotes de matérias-primas e produtos", modulo: "estoque" },
  { title: "Lotes Reservados", url: "/estoque/lotes-reservados", icon: Tag, tooltip: "Reserva de números oficiais de lote (SKU-AAMM-NNNN-D) com trava anti-clonagem", modulo: "estoque" },
  { title: "Movimentações", url: "/estoque/movimentacoes", icon: ClipboardList, tooltip: "Histórico de entradas, saídas e ajustes de estoque", modulo: "estoque" }]

 },
 {
  label: "Produção",
  modulo: "producao",
  items: [
  { title: "Formulador", url: "/producao/formulas", icon: FlaskConical, badge: "ANVISA", tooltip: "Formulador industrial com validação ANVISA", modulo: "producao" },
  { title: "Ordens de Produção", url: "/producao/ordens", icon: Factory, tooltip: "Criação e acompanhamento de ordens de produção", modulo: "producao" },
  { title: "Dashboard Industrial", url: "/producao/dashboard", icon: BarChart3, tooltip: "Indicadores operacionais e análise de anomalias", modulo: "producao" },
  { title: "Dashboard Executivo", url: "/producao/executivo", icon: BarChart3, badge: "KPI", tooltip: "KPIs executivos e alertas estratégicos", modulo: "producao" },
  { title: "Equipamentos", url: "/settings/equipamentos", icon: Factory, tooltip: "Cadastro de misturadores, encapsuladoras e equipamentos de produção", modulo: "producao", adminOnly: true }]

},
{
  label: "Qualidade",
  modulo: "qualidade",
  items: [
  { title: "Quarentena", url: "/estoque/quarentena", icon: ShieldAlert, tooltip: "Lotes em quarentena aguardando liberação", modulo: "qualidade", danger: true },
  { title: "Controle de COA", url: "/qualidade/coa", icon: FileCheck, tooltip: "Importar, visualizar e validar COA/laudos dos lotes recebidos", modulo: "qualidade" },
  { title: "Desvios / CAPA", url: "/qualidade/desvios", icon: ShieldAlert, badge: "QC", tooltip: "Registro e tratamento de desvios e ações corretivas (CAPA)", modulo: "qualidade" },
  { title: "POPs", url: "/qualidade/pops", icon: ClipboardCheck, badge: "RDC 275", tooltip: "Gestão de Procedimentos Operacionais Padrão", modulo: "qualidade" },
  { title: "Análises", url: "/qualidade/analises", icon: FlaskConical, tooltip: "Análises laboratoriais e resultados de controle de qualidade", modulo: "qualidade" },
  { title: "Calibrações", url: "/qualidade/calibracoes", icon: Settings, tooltip: "Controle de calibração de instrumentos e equipamentos", modulo: "qualidade" },
  { title: "Rastreabilidade", url: "/estoque/rastreabilidade", icon: Shield, badge: "GMP", tooltip: "Rastreabilidade completa conforme exigências GMP e ANVISA", modulo: "qualidade" }]

},
{
  label: "Regulatório",
  modulo: "producao",
  items: [
  { title: "Consulta ANVISA", url: "/regulatorio/anvisa", icon: Shield, tooltip: "Consulta à base de dados ANVISA — constituintes e limites da IN 28/2018", modulo: "producao" },
  { title: "ANVISA Checker", url: "/regulatorio/anvisa-checker", icon: FlaskConical, tooltip: "Checador de fórmulas e verificação regulatória ANVISA", modulo: "producao" },
  { title: "Biblioteca do RT", url: "/regulatorio/biblioteca-rt", icon: BookOpen, badge: "IA", tooltip: "Copilot Regulatório — base de conhecimento ANVISA travada em fonte oficial (RDC 243/2018, RDC 275/2002, IN 28/2018)", modulo: "producao" },
  { title: "Resp. Técnicos", url: "/cadastros/responsaveis-tecnicos", icon: UserCheck, tooltip: "Gestão de responsáveis técnicos habilitados para produção", modulo: "producao" },
  { title: "Monitoramento Ambiental", url: "/ambiental/monitoramento", icon: Thermometer, badge: "ANVISA", tooltip: "Monitoramento de temperatura e umidade em tempo real", modulo: "producao" },
  { title: "Config. Sensores", url: "/ambiental/configuracao", icon: Settings2, tooltip: "Configurar credenciais eWeLink e mapear sensores por sala", modulo: "producao", adminOnly: true }]

 },
 {
  label: "Vendas",
  modulo: "vendas",
  items: [
  { title: "CRM", url: "/vendas/crm", icon: MessageSquare, tooltip: "Gestão de relacionamento e pipeline de vendas", modulo: "vendas" },
  { title: "Orçamentos", url: "/vendas/orcamentos", icon: FileText, tooltip: "Criação e acompanhamento de orçamentos para clientes", modulo: "vendas" },
  { title: "Pedidos", url: "/vendas/pedidos", icon: ShoppingCart, tooltip: "Controle de pedidos de venda e status de entrega", modulo: "vendas" },
  { title: "Expedição", url: "/expedicao", icon: Truck, tooltip: "Separação, despacho e rastreio de pedidos", modulo: "vendas" },
  { title: "Marketplace", url: "/vendas/marketplace", icon: Store, tooltip: "Catálogo de produtos para venda online e marketplace", modulo: "vendas" }]

 },
 {
  label: "Fiscal",
  modulo: "fiscal",
  items: [
  { title: "Notas de Saída", url: "/vendas/notas-saida", icon: FileOutput, tooltip: "Emissão e gestão de notas fiscais de saída (NF-e)", modulo: "fiscal" },
  { title: "Auditoria Fiscal", url: "/vendas/auditoria-fiscal", icon: ScrollText, tooltip: "Trilha de emissão, protocolo, cancelamento e reimpressão por empresa", modulo: "fiscal" }]

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
  label: "BI & Auditoria",
  modulo: "relatorios",
  items: [
  { title: "Relatórios", url: "/relatorios", icon: BarChart3, tooltip: "Relatórios gerenciais de produção, estoque e vendas", modulo: "relatorios" },
  { title: "Auditoria", url: "/auditoria", icon: Shield, tooltip: "Trilha de auditoria imutável de todas as operações do sistema", modulo: "relatorios" }]

},
 {
  label: "Comunicação",
  items: [
  { title: "Chat Interno", url: "/chat", icon: MessageCircle, tooltip: "Comunicação interna entre colaboradores da empresa" }]

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
{ to: "/faq", icon: HelpCircle, label: "Manual / FAQ", tooltip: "Manual completo do ERP com todas as instruções de uso" },
{ to: "/settings/company", icon: Settings, label: "Configuracoes", tooltip: "Configurações gerais da empresa e sistema", modulo: "configuracoes" },
{ to: "/settings/admin-master", icon: ShieldAlert, label: "Admin Master", tooltip: "Painel administrativo master — operações críticas do sistema", danger: true, adminOnly: true },
{ to: "/usuarios", icon: Shield, label: "Usuarios", tooltip: "Gestão de usuários, permissões e acessos ao sistema", modulo: "usuarios" }];




export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { role, profile, canView, isLoading, signOut } = useAuth();
  const { data: company } = useCompany();
  const companyPending = !company;

  const isAdmin = role === 'admin';

  // Estado de expansão por grupo, persistido em localStorage.
  const STORAGE_KEY = "brainx-sidebar-groups-open";
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return {};
  });

  // Abre automaticamente o grupo que contém a rota ativa (sem fechar os outros já abertos).
  useEffect(() => {
    const activeGroup = menuGroups.find((g) =>
      g.items.some((it) => location.pathname.startsWith(it.url))
    );
    if (activeGroup && openGroups[activeGroup.label] !== true) {
      setOpenGroups((prev) => ({ ...prev, [activeGroup.label]: true }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(openGroups));
    } catch {}
  }, [openGroups]);

  const isGroupOpen = (label: string) => openGroups[label] ?? false;
  const toggleGroup = useCallback((label: string, open: boolean) => {
    setOpenGroups((prev) => ({ ...prev, [label]: open }));
  }, []);

  const expandAll = () => {
    const all: Record<string, boolean> = {};
    menuGroups.forEach((g) => (all[g.label] = true));
    setOpenGroups(all);
  };
  const collapseAll = () => {
    const all: Record<string, boolean> = {};
    menuGroups.forEach((g) => (all[g.label] = false));
    setOpenGroups(all);
  };

  const handleSignOut = async () => {
    await signOut();
    // Force full page reload to clear all cached state
    window.location.href = '/auth';
  };

  const isActive = (url: string) => {
    if (url === "/dashboard") return location.pathname === "/dashboard";
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
          <Link to="/dashboard" className="flex items-center gap-1 md:gap-3 px-2 md:px-4 py-3 md:py-4">
            <img
              src={brainxLogo}
              alt="BrainX ERP"
              className={cn(
                "object-contain rounded shrink-0 transition-all duration-200",
                collapsed ? "w-[50px] h-[50px] md:w-[65px] md:h-[65px]" : "w-[64px] h-[64px] md:w-[87px] md:h-[87px] lg:w-[101px] lg:h-[101px]"
              )}
              loading="lazy"
            />
            {!collapsed &&
            <div className="flex flex-col">
                <span className="font-bold text-lg text-sidebar-foreground tracking-tight">BrainX ERP</span>
                <span className="text-xs text-sidebar-foreground/60 font-medium">Industrial</span>
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

        <SidebarHeader className="border-b border-sidebar-border/50 bg-sidebar">
          <Link to="/dashboard" className="flex items-center gap-1 md:gap-3 px-2 md:px-4 pt-3 md:pt-5 pb-0.5 md:pb-1">
            <div className="relative">
              <LogoDemoERP
                className={cn(
                  "shadow-lg shadow-black/20 relative z-0",
                  collapsed ? "w-[50px] h-[50px] md:w-[65px] md:h-[65px]" : "w-[64px] h-[64px] md:w-[87px] md:h-[87px] lg:w-[101px] lg:h-[101px]"
                )}
              />
            </div>
            {!collapsed &&
            <div className="flex flex-col min-w-0 -ml-4 relative z-10">
                <span className="font-bold text-base md:text-lg text-sidebar-foreground tracking-tight leading-tight truncate">
                  {profile?.is_demo ? 'BrainX Demo' : 'BrainX ERP'}
                </span>
                <span className="text-[10px] md:text-[11px] text-sidebar-foreground/50 font-medium tracking-wide flex items-center gap-1">
                  {profile?.is_demo ? 'Demonstração' : 'Industrial'}
                  {!profile?.is_demo && <span className="bg-primary/20 text-[9px] px-1 rounded-sm text-primary-foreground font-bold">Matriz</span>}
                </span>
              </div>
            }
          </Link>
        </SidebarHeader>

        <SidebarContent className="px-3 pt-[6px] pb-3 bg-sidebar overflow-y-auto scrollbar-thin">
          {menuGroups.map((group) => {
            const visibleItems = group.items.filter(isItemVisible);
            if (visibleItems.length === 0) return null;

            return (
              <Collapsible
                key={group.label}
                open={collapsed ? true : isGroupOpen(group.label)}
                onOpenChange={(o) => toggleGroup(group.label, o)}
                className="mb-2"
              >
                <SidebarGroup>
                  <CollapsibleTrigger className="w-full group" aria-label={`Alternar seção ${group.label}`}>
                    <SidebarGroupLabel className="flex items-center justify-between px-3 py-2 text-[11px] font-bold text-sidebar-foreground/75 uppercase tracking-wider hover:text-sidebar-foreground transition-colors duration-200">
                      {!collapsed && group.label}
                      {!collapsed && <ChevronDown className="w-3.5 h-3.5 transition-transform duration-200 group-data-[state=closed]:-rotate-90" />}
                    </SidebarGroupLabel>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarGroupContent>
                      <SidebarMenu className="space-y-0.5">
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
                                    "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group/item",
                                    isActive(item.url)
                                      ? item.danger
                                        ? "bg-red-500/20 text-red-400 shadow-lg shadow-red-500/10 font-bold"
                                        : "bg-secondary text-secondary-foreground shadow-lg shadow-secondary/20 font-semibold"
                                      : item.danger
                                        ? "text-red-400/80 hover:bg-red-500/10 hover:text-red-400"
                                        : "text-sidebar-foreground/75 hover:bg-sidebar-accent/80 hover:text-sidebar-foreground hover:translate-x-0.5"
                                  )}>

                                    <item.icon className={cn(
                                      "w-[18px] h-[18px] shrink-0 transition-colors duration-200",
                                      isActive(item.url) 
                                        ? item.danger ? "text-red-400" : "text-secondary-foreground" 
                                        : item.danger ? "text-red-400/50" : "text-sidebar-foreground/50 group-hover/item:text-sidebar-foreground/80"
                                    )} />
                                    {!collapsed &&
                                  <span className="flex-1 text-[13px] font-medium leading-tight">{item.title}</span>
                                  }
                                    {!collapsed && item.badge &&
                                  <span className={cn(
                                    "text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider",
                                    isActive(item.url)
                                      ? "bg-secondary-foreground/20 text-secondary-foreground"
                                      : "bg-sidebar-accent text-sidebar-foreground/60"
                                  )}>
                                        {item.badge}
                                      </span>
                                  }
                                  </Link>
                                </SidebarMenuButton>
                              </TooltipTrigger>
                              <TooltipContent side="right" className="max-w-[240px] text-xs">
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

        <SidebarFooter className="border-t border-sidebar-border/50 p-3 bg-sidebar space-y-1">
          {footerItems.filter(isFooterItemVisible).map((item) => {
            const { to, icon: Icon, label, tooltip, danger } = item as FooterItem;
            const highlight = companyPending && to === "/settings/company";
            return (
              <Tooltip key={to}>
                <TooltipTrigger asChild>
                  <Link
                    to={to}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group/footer text-sm",
                      danger
                        ? isActive(to)
                          ? "bg-red-500/20 text-red-400 shadow-lg shadow-red-500/10 font-bold"
                          : "text-red-400/80 hover:bg-red-500/10 hover:text-red-400"
                        : isActive(to)
                          ? "bg-secondary text-secondary-foreground shadow-lg shadow-secondary/20"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/80 hover:text-sidebar-foreground hover:translate-x-0.5",
                      highlight && "ring-2 ring-destructive/70 bg-destructive/15 text-destructive font-bold animate-pulse"
                    )}
                  >
                    <Icon className={cn(
                      "w-[18px] h-[18px] shrink-0 transition-colors duration-200",
                      isActive(to)
                        ? (danger ? "text-red-400" : "text-secondary-foreground")
                        : (danger ? "text-red-400/50" : "text-sidebar-foreground/50 group-hover/footer:text-sidebar-foreground/80"),
                      highlight && "text-destructive"
                    )} />
                    {!collapsed && (
                      <span className="flex-1 text-[13px] font-medium leading-tight flex items-center gap-2">
                        {label}
                        {highlight && (
                          <span className="ml-auto rounded-full bg-destructive px-1.5 py-0.5 text-[9px] font-bold uppercase text-destructive-foreground">
                            Pendente
                          </span>
                        )}
                      </span>
                    )}
                    {collapsed && highlight && (
                      <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-destructive animate-pulse" />
                    )}
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-[240px] text-xs">
                  <p className="font-semibold">{label}</p>
                  <p className="text-muted-foreground mt-0.5">
                    {highlight ? "Cadastro da empresa pendente — clique para completar" : tooltip}
                  </p>
                </TooltipContent>
              </Tooltip>
            );
          })}

          <div className="mt-1 pt-1 border-t border-sidebar-border/30">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 w-full text-destructive/60 hover:bg-destructive/10 hover:text-destructive"
                >
                  <LogOut className="w-[18px] h-[18px] shrink-0" />
                  {!collapsed && <span className="text-[13px] font-medium">Sair do Sistema</span>}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-[240px] text-xs">
                <p className="font-semibold">Sair</p>
                <p className="text-muted-foreground mt-0.5">Encerrar sessão e voltar à tela de login</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </SidebarFooter>
      </Sidebar>
    </TooltipProvider>);

}