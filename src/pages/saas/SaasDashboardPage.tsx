import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Users, DollarSign, TrendingUp, Crown, UserX, Eye, Search,
  RefreshCw, Ban, Unlock, Trash2, Mail, Building2, AlertTriangle, Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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
  trial_end?: string | null;
  trial_days_remaining?: number;
  amount?: number;
  currency?: string;
}

interface SaasCompany {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string;
  telefone: string | null;
  created_at: string;
  email_financeiro: string | null;
  email_fiscal: string | null;
  total_usuarios: number;
  owner_email: string;
  owner_nome: string;
  ultimo_acesso: string | null;
  usuarios: CompanyUser[];
  stripe?: StripeInfo;
}

// ─── Helpers ───

function getSubscriptionStatus(stripe?: StripeInfo): { label: string; variant: string } {
  if (!stripe) return { label: "Sem dados", variant: "muted" };
  switch (stripe.status) {
    case "active": return { label: "Ativo", variant: "success" };
    case "trialing": return { label: `Trial (${stripe.trial_days_remaining ?? '?'}d)`, variant: "info" };
    case "past_due": return { label: "Inadimplente", variant: "destructive" };
    case "canceled": return { label: "Cancelado", variant: "muted" };
    case "expired": return { label: "Expirado", variant: "destructive" };
    case "unpaid": return { label: "Não pago", variant: "destructive" };
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

// ─── Page ───

export default function SaasDashboardPage() {
  const [companies, setCompanies] = useState<SaasCompany[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");

  // Dialogs
  const [detailCompany, setDetailCompany] = useState<SaasCompany | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: "block" | "unblock" | "delete"; company: SaasCompany } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchCompanies = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("saas-admin", {
        body: null,
        headers: {},
      });
      
      // Try with query param approach
      const response = await supabase.functions.invoke("saas-admin?action=list");
      
      if (response.error) {
        console.error("Error fetching SaaS data:", response.error);
        toast.error("Erro ao carregar dados SaaS");
        return;
      }
      
      setCompanies(response.data?.companies || []);
    } catch (err) {
      console.error("Error:", err);
      toast.error("Erro ao carregar dados");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  const handleAction = async (type: "block" | "unblock" | "delete-company", companyId: string) => {
    setActionLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(`saas-admin?action=${type}`, {
        body: { company_id: companyId },
      });
      if (error || data?.error) {
        toast.error(data?.error || "Erro na operação");
        return;
      }
      toast.success(
        type === "block" ? "Empresa bloqueada" :
        type === "unblock" ? "Empresa desbloqueada" :
        "Empresa excluída"
      );
      setConfirmAction(null);
      setDetailCompany(null);
      await fetchCompanies();
    } catch (err) {
      toast.error("Erro na operação");
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Computed ───
  const totalActive = companies.filter(c => c.stripe?.status === "active").length;
  const totalTrialing = companies.filter(c => c.stripe?.status === "trialing").length;
  const totalUsers = companies.reduce((s, c) => s + c.total_usuarios, 0);
  const totalExpired = companies.filter(c => ["expired", "canceled", "past_due"].includes(c.stripe?.status || "")).length;

  const filtered = companies.filter(c => {
    if (search) {
      const s = search.toLowerCase();
      if (
        !c.razao_social.toLowerCase().includes(s) &&
        !c.cnpj.includes(s) &&
        !(c.nome_fantasia || "").toLowerCase().includes(s) &&
        !c.owner_email.toLowerCase().includes(s)
      ) return false;
    }
    if (statusFilter !== "todos") {
      if (statusFilter === "ativo" && c.stripe?.status !== "active") return false;
      if (statusFilter === "trial" && c.stripe?.status !== "trialing") return false;
      if (statusFilter === "inadimplente" && c.stripe?.status !== "past_due") return false;
      if (statusFilter === "expirado" && c.stripe?.status !== "expired") return false;
      if (statusFilter === "cancelado" && c.stripe?.status !== "canceled") return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Crown className="h-6 w-6 text-secondary" />
            Painel SaaS — Gestão de Assinantes
          </h1>
          <p className="page-description">Controle de empresas cadastradas, assinaturas e usuários do ERP</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchCompanies} disabled={isLoading}>
          <RefreshCw className={cn("h-4 w-4 mr-1", isLoading && "animate-spin")} />
          Atualizar
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="p-3 rounded-lg bg-success/10 text-success"><DollarSign className="h-5 w-5" /></div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Assinaturas Ativas</p>
              <p className="text-2xl font-bold">{totalActive}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="p-3 rounded-lg bg-info/10 text-info"><TrendingUp className="h-5 w-5" /></div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Em Trial</p>
              <p className="text-2xl font-bold">{totalTrialing}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="p-3 rounded-lg bg-primary/10 text-primary"><Users className="h-5 w-5" /></div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Usuários Totais</p>
              <p className="text-2xl font-bold">{totalUsers}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive"><UserX className="h-5 w-5" /></div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Expirados/Cancelados</p>
              <p className="text-2xl font-bold">{totalExpired}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Client List */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Empresas Assinantes ({filtered.length})
            </CardTitle>
            <div className="flex gap-2 flex-wrap">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar empresa, CNPJ, email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9 w-64"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40 h-9">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="inadimplente">Inadimplente</SelectItem>
                  <SelectItem value="expirado">Expirado</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Carregando dados...</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>CNPJ</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">Usuários</TableHead>
                    <TableHead>Cadastro</TableHead>
                    <TableHead className="text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div>
                          <span className="font-medium text-sm">{c.nome_fantasia || c.razao_social}</span>
                          {c.nome_fantasia && (
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">{c.razao_social}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs font-mono">{formatCNPJ(c.cnpj)}</TableCell>
                      <TableCell className="text-xs">{c.owner_email || "—"}</TableCell>
                      <TableCell>
                        {c.stripe?.plan ? (
                          <Badge variant="outline" className="text-xs">{c.stripe.plan}</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell><StatusBadge stripe={c.stripe} /></TableCell>
                      <TableCell className="text-center">{c.total_usuarios}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {format(new Date(c.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Detalhes" onClick={() => setDetailCompany(c)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost" size="icon" className="h-8 w-8 text-warning"
                            title={c.usuarios?.some(u => u.status === "BLOQUEADO") ? "Desbloquear" : "Bloquear"}
                            onClick={() => setConfirmAction({
                              type: c.usuarios?.some(u => u.status === "BLOQUEADO") ? "unblock" : "block",
                              company: c,
                            })}
                          >
                            {c.usuarios?.some(u => u.status === "BLOQUEADO") ? <Unlock className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                          </Button>
                          <Button
                            variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                            title="Excluir empresa" onClick={() => setConfirmAction({ type: "delete", company: c })}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && !isLoading && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        {companies.length === 0 ? "Nenhuma empresa cadastrada ainda" : "Nenhuma empresa encontrada com os filtros aplicados"}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!detailCompany} onOpenChange={() => setDetailCompany(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {detailCompany && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  {detailCompany.nome_fantasia || detailCompany.razao_social}
                </DialogTitle>
                <DialogDescription>{detailCompany.razao_social}</DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Company Info */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">CNPJ:</span>
                    <span className="ml-2 font-mono">{formatCNPJ(detailCompany.cnpj)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Email:</span>
                    <span className="ml-2">{detailCompany.owner_email || "—"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Telefone:</span>
                    <span className="ml-2">{detailCompany.telefone || "—"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Cadastro:</span>
                    <span className="ml-2">{format(new Date(detailCompany.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                  </div>
                </div>

                {/* Subscription Info */}
                {detailCompany.stripe && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Assinatura</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Status:</span>
                        <span className="ml-2"><StatusBadge stripe={detailCompany.stripe} /></span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Plano:</span>
                        <span className="ml-2">{detailCompany.stripe.plan || "Nenhum"}</span>
                      </div>
                      {detailCompany.stripe.current_period_end && (
                        <div>
                          <span className="text-muted-foreground">Válido até:</span>
                          <span className="ml-2">{format(new Date(detailCompany.stripe.current_period_end), "dd/MM/yyyy")}</span>
                        </div>
                      )}
                      {detailCompany.stripe.cancel_at_period_end && (
                        <div className="col-span-2">
                          <Badge variant="outline" className="bg-warning/10 text-warning text-xs">Cancelamento programado</Badge>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Users */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Usuários ({detailCompany.usuarios?.length || 0})</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Último Acesso</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(detailCompany.usuarios || []).map(u => (
                          <TableRow key={u.id}>
                            <TableCell className="text-sm">{u.nome}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{u.email}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={cn("text-xs",
                                u.status === "ATIVO" ? "bg-success/10 text-success" :
                                u.status === "BLOQUEADO" ? "bg-destructive/10 text-destructive" :
                                "bg-muted text-muted-foreground"
                              )}>{u.status}</Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {u.ultimo_acesso ? format(new Date(u.ultimo_acesso), "dd/MM/yy HH:mm") : "Nunca"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* Actions */}
                <div className="flex gap-2 justify-end">
                  {detailCompany.owner_email && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={`mailto:${detailCompany.owner_email}`}>
                        <Mail className="h-4 w-4 mr-1" /> Enviar Email
                      </a>
                    </Button>
                  )}
                  <Button
                    variant="outline" size="sm"
                    onClick={() => {
                      setDetailCompany(null);
                      setConfirmAction({
                        type: detailCompany.usuarios?.some(u => u.status === "BLOQUEADO") ? "unblock" : "block",
                        company: detailCompany,
                      });
                    }}
                  >
                    <Ban className="h-4 w-4 mr-1" />
                    {detailCompany.usuarios?.some(u => u.status === "BLOQUEADO") ? "Desbloquear" : "Bloquear"}
                  </Button>
                  <Button
                    variant="destructive" size="sm"
                    onClick={() => {
                      setDetailCompany(null);
                      setConfirmAction({ type: "delete", company: detailCompany });
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-1" /> Excluir
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm Action Dialog */}
      <Dialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <DialogContent>
          {confirmAction && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertTriangle className={cn("h-5 w-5", confirmAction.type === "delete" ? "text-destructive" : "text-warning")} />
                  {confirmAction.type === "block" && "Bloquear Empresa"}
                  {confirmAction.type === "unblock" && "Desbloquear Empresa"}
                  {confirmAction.type === "delete" && "Excluir Empresa"}
                </DialogTitle>
                <DialogDescription>
                  {confirmAction.type === "block" && `Todos os ${confirmAction.company.total_usuarios} usuários de "${confirmAction.company.nome_fantasia || confirmAction.company.razao_social}" serão bloqueados e não poderão acessar o ERP.`}
                  {confirmAction.type === "unblock" && `Todos os usuários de "${confirmAction.company.nome_fantasia || confirmAction.company.razao_social}" serão desbloqueados.`}
                  {confirmAction.type === "delete" && `ATENÇÃO: Esta ação é irreversível! A empresa "${confirmAction.company.nome_fantasia || confirmAction.company.razao_social}" e todos os seus ${confirmAction.company.total_usuarios} usuários serão permanentemente excluídos.`}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConfirmAction(null)} disabled={actionLoading}>Cancelar</Button>
                <Button
                  variant={confirmAction.type === "delete" ? "destructive" : "default"}
                  onClick={() => handleAction(
                    confirmAction.type === "delete" ? "delete-company" : confirmAction.type,
                    confirmAction.company.id
                  )}
                  disabled={actionLoading}
                >
                  {actionLoading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                  Confirmar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
