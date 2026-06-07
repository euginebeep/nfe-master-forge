import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users, DollarSign, TrendingUp, Crown, UserX, Eye, Search,
  RefreshCw, Ban, Unlock, Trash2, Mail, Building2, AlertTriangle, Loader2, LogOut, Lock, ShieldCheck, FileText,
  LifeBuoy, MessageSquare, Megaphone, Cpu, Activity, StickyNote
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { UnlockChallengesPanel } from "@/components/saas/UnlockChallengesPanel";
import { DemoLeadsPanel } from "@/components/saas/DemoLeadsPanel";

// ─── Types ───

interface CompanyUser {
  id: string;
  nome: string;
  email: string;
  status: string;
  ultimo_acesso: string | null;
  created_at: string;
}

interface StripeInfo {
  status: string;
  plan?: string | null;
  current_period_end?: string;
  cancel_at_period_end?: boolean;
}

interface SaasCompany {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string;
  telefone: string | null;
  created_at: string;
  total_usuarios: number;
  owner_email: string;
  owner_nome: string;
  tickets_abertos: number;
  usuarios: CompanyUser[];
  stripe?: StripeInfo;
}

// ─── Helpers ───

function getSubscriptionStatus(stripe?: StripeInfo): { label: string; variant: string } {
  if (!stripe) return { label: "Sem dados", variant: "muted" };
  switch (stripe.status) {
    case "active": return { label: "Ativo", variant: "success" };
    case "trialing": return { label: "Trial", variant: "info" };
    case "past_due": return { label: "Inadimplente", variant: "destructive" };
    case "canceled": return { label: "Cancelado", variant: "muted" };
    default: return { label: stripe.status, variant: "muted" };
  }
}

function StatusBadge({ stripe }: { stripe?: StripeInfo }) {
  const { label, variant } = getSubscriptionStatus(stripe);
  const classes: Record<string, string> = {
    success: "bg-success/10 text-success border-success/20",
    info: "bg-info/10 text-info border-info/20",
    destructive: "bg-destructive/10 text-destructive border-destructive/20",
    muted: "bg-muted text-muted-foreground border-border",
  };
  return <Badge variant="outline" className={cn("text-xs font-medium", classes[variant] || classes.muted)}>{label}</Badge>;
}

function formatCNPJ(cnpj: string) {
  const c = cnpj.replace(/\D/g, "");
  if (c.length !== 14) return cnpj;
  return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`;
}

export default function SaasDashboardPage() {
  const [authed, setAuthed] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const [companies, setCompanies] = useState<SaasCompany[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");

  // Dialogs
  const [detailCompany, setDetailCompany] = useState<SaasCompany | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: "block" | "unblock" | "delete" | "grant-access"; company: SaasCompany } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [grantDays, setGrantDays] = useState(30);

  const { data: leadsCount } = useQuery({
    queryKey: ['demo-leads-count'],
    queryFn: async () => {
      const { count, error } = await supabase.from('demo_leads').select('*', { count: 'exact', head: true });
      return count || 0;
    }
  });

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', session.user.id);
        const isAdmin = roles?.some(r => ['admin', 'saas_owner', 'saas_suporte'].includes(r.role));
        if (isAdmin) setAuthed(true);
      }
      setAuthLoading(false);
    };
    checkAuth();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPassword });
      if (error) { toast.error(error.message); return; }
      const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', data.user.id);
      const isAdmin = roles?.some(r => ['admin', 'saas_owner', 'saas_suporte'].includes(r.role));
      if (!isAdmin) {
        toast.error("Acesso restrito a administradores");
        await supabase.auth.signOut();
        return;
      }
      setAuthed(true);
      toast.success("Bem-vindo ao BrainX ERP SaaS!");
    } catch (err) {
      toast.error("Erro no login");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setAuthed(false);
    setCompanies([]);
  };

  const fetchCompanies = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("saas-admin?action=list");
      if (error) throw error;
      setCompanies(data?.companies || []);
    } catch (err) {
      toast.error("Erro ao carregar dados SaaS");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authed) fetchCompanies();
  }, [authed, fetchCompanies]);

  const handleAction = async (type: string, companyId: string) => {
    setActionLoading(true);
    try {
      const body: any = { company_id: companyId };
      if (type === "grant-access") body.days = grantDays;
      const { data, error } = await supabase.functions.invoke(`saas-admin?action=${type === "delete" ? "delete-company" : type}`, { body });
      if (error) throw error;
      toast.success("Operação realizada!");
      setConfirmAction(null);
      fetchCompanies();
    } catch (err) {
      toast.error("Erro na operação");
    } finally {
      setActionLoading(false);
    }
  };

  const filtered = companies.filter(c => {
    if (search && !c.razao_social.toLowerCase().includes(search.toLowerCase()) && !c.cnpj.includes(search)) return false;
    return true;
  });

  if (authLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/50">
        <Card className="w-full max-w-md border-t-4 border-t-primary shadow-2xl">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-4 p-4 rounded-2xl bg-primary/10 w-fit">
              <Crown className="h-10 w-10 text-primary" />
            </div>
            <CardTitle className="text-2xl font-black">BrainX ERP SaaS</CardTitle>
            <p className="text-muted-foreground text-sm font-medium">Painel Administrativo Operacional</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4 pt-4">
              <div className="space-y-1">
                <Label>Usuário Administrativo</Label>
                <Input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} placeholder="admin@brainx.com.br" required />
              </div>
              <div className="space-y-1">
                <Label>Chave de Acesso</Label>
                <Input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} placeholder="••••••••" required />
              </div>
              <Button type="submit" className="w-full h-11 font-bold" disabled={loginLoading}>
                {loginLoading ? <Loader2 className="animate-spin mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
                Acessar Painel SaaS
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20">
      {/* Sidebar Simulado no Topo */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-primary p-1.5 rounded-lg shadow-lg shadow-primary/20">
              <Crown className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="font-black text-lg tracking-tight">BrainX <span className="text-primary">SaaS Admin</span></h1>
              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest leading-none">Console Operacional</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
             <Button variant="ghost" size="sm" onClick={handleLogout} className="text-destructive hover:bg-destructive/10">
               <LogOut className="h-4 w-4 mr-2" /> Sair
             </Button>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto p-6 space-y-6">
        {/* Resumo Rápido */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-primary to-primary/80 text-white border-none shadow-lg shadow-primary/10">
            <CardContent className="pt-6">
              <p className="text-xs font-bold opacity-80 uppercase tracking-wider">Empresas Ativas</p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-black">{companies.filter(c => c.stripe?.status === "active").length}</span>
                <Badge className="bg-white/20 hover:bg-white/20 border-none text-[10px]">+2 esta semana</Badge>
              </div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm">
            <CardContent className="pt-6">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Tickets Abertos</p>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-3xl font-black text-warning">{companies.reduce((acc, c) => acc + c.tickets_abertos, 0)}</span>
                <div className="p-2 bg-warning/10 rounded-full"><LifeBuoy className="h-4 w-4 text-warning" /></div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm">
            <CardContent className="pt-6">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Usuários SaaS</p>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-3xl font-black">{companies.reduce((acc, c) => acc + c.total_usuarios, 0)}</span>
                <div className="p-2 bg-primary/10 rounded-full"><Users className="h-4 w-4 text-primary" /></div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm">
            <CardContent className="pt-6">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Novos Leads</p>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-3xl font-black">{leadsCount || 0}</span>
                <div className="p-2 bg-success/10 rounded-full"><TrendingUp className="h-4 w-4 text-success" /></div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="empresas" className="w-full space-y-4">
          <TabsList className="bg-white p-1 h-12 shadow-sm border border-border/50">
            <TabsTrigger value="empresas" className="gap-2 px-6"><Building2 className="h-4 w-4" /> Empresas</TabsTrigger>
            <TabsTrigger value="tickets" className="gap-2 px-6"><LifeBuoy className="h-4 w-4" /> Suporte</TabsTrigger>
            <TabsTrigger value="leads" className="gap-2 px-6"><MessageSquare className="h-4 w-4" /> Leads</TabsTrigger>
            <TabsTrigger value="comunicados" className="gap-2 px-6"><Megaphone className="h-4 w-4" /> Avisos</TabsTrigger>
            <TabsTrigger value="ia" className="gap-2 px-6"><Cpu className="h-4 w-4" /> IA Hub</TabsTrigger>
            <TabsTrigger value="logs" className="gap-2 px-6"><Activity className="h-4 w-4" /> Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="empresas" className="space-y-4">
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" /> Gestão de Tenants
                </CardTitle>
                <div className="flex gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="CNPJ, Razão Social..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 w-64 h-9" />
                  </div>
                  <Button size="sm" onClick={fetchCompanies} disabled={isLoading} variant="outline">
                    <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead>Identificação</TableHead>
                      <TableHead>Assinatura</TableHead>
                      <TableHead>Infra</TableHead>
                      <TableHead>Suporte</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(c => (
                      <TableRow key={c.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-bold">{c.nome_fantasia || c.razao_social}</span>
                            <span className="text-[10px] text-muted-foreground font-mono">{formatCNPJ(c.cnpj)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <StatusBadge stripe={c.stripe} />
                            <span className="text-xs font-medium text-muted-foreground">{c.stripe?.plan || "Trial"}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                           <div className="flex items-center gap-3">
                              <div className="flex flex-col">
                                <span className="text-xs font-bold">{c.total_usuarios} usuários</span>
                                <span className="text-[10px] text-muted-foreground">Cad. {format(new Date(c.created_at), "dd/MM/yy")}</span>
                              </div>
                           </div>
                        </TableCell>
                        <TableCell>
                          {c.tickets_abertos > 0 ? (
                            <Badge variant="warning" className="animate-pulse">1 Ticket</Badge>
                          ) : <span className="text-xs text-muted-foreground italic">Limpo</span>}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => setDetailCompany(c)}><Eye className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="text-warning" onClick={() => setConfirmAction({ type: "block", company: c })}><Ban className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setConfirmAction({ type: "delete", company: c })}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tickets">
            <Card className="border-none shadow-sm"><CardContent className="py-20 text-center text-muted-foreground"><LifeBuoy className="mx-auto h-12 w-12 opacity-20 mb-4" /> Módulo de Tickets Integrado (BrainX Support)</CardContent></Card>
          </TabsContent>
          <TabsContent value="leads">
            <DemoLeadsPanel />
          </TabsContent>
          <TabsContent value="ia">
             <Card className="border-none shadow-sm">
               <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Cpu className="h-5 w-5 text-primary" /> BrainX AI Models Hub</CardTitle></CardHeader>
               <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                     <Card className="p-4 border-primary/20 bg-primary/5">
                        <div className="flex justify-between items-start mb-2">
                           <Badge>Gemini 2.0 Flash</Badge>
                           <Badge variant="success" className="text-[10px]">PADRÃO</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mb-4">Modelo primário para extração ANVISA e análise de Fichas Técnicas.</p>
                        <Button variant="outline" size="sm" className="w-full">Configurar Tokens</Button>
                     </Card>
                  </div>
               </CardContent>
             </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Confirm Action Dialog */}
      <Dialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <DialogContent>
           <DialogHeader>
             <DialogTitle>Confirmar Operação</DialogTitle>
             <DialogDescription>Deseja realmente aplicar "{confirmAction?.type}" na empresa "{confirmAction?.company.razao_social}"?</DialogDescription>
           </DialogHeader>
           <DialogFooter>
             <Button variant="outline" onClick={() => setConfirmAction(null)}>Cancelar</Button>
             <Button variant={confirmAction?.type === "delete" ? "destructive" : "default"} onClick={() => handleAction(confirmAction!.type, confirmAction!.company.id)} disabled={actionLoading}>
               {actionLoading ? <Loader2 className="animate-spin mr-2" /> : null}
               Confirmar
             </Button>
           </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
