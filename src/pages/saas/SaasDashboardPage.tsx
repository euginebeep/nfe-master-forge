import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Users, DollarSign, TrendingUp, Activity, Crown, UserPlus, UserX, Eye,
  Search, Filter, MoreVertical, ArrowUpRight, ArrowDownRight, RefreshCw
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend
} from "recharts";
import { cn } from "@/lib/utils";

// ─── Mock Data ───
const mockClients = [
  { id: "1", nome: "Pharma Solutions Ltda", cnpj: "12.345.678/0001-90", plano: "Enterprise", status: "ativo", mrr: 2500, usuarios: 15, ultimoAcesso: "2026-02-26", inicioContrato: "2025-06-01" },
  { id: "2", nome: "NutriVida Labs", cnpj: "98.765.432/0001-10", plano: "Professional", status: "ativo", mrr: 1200, usuarios: 8, ultimoAcesso: "2026-02-25", inicioContrato: "2025-08-15" },
  { id: "3", nome: "BioFormula Ind.", cnpj: "11.222.333/0001-44", plano: "Starter", status: "ativo", mrr: 499, usuarios: 3, ultimoAcesso: "2026-02-24", inicioContrato: "2025-11-01" },
  { id: "4", nome: "Caps & Co", cnpj: "55.666.777/0001-88", plano: "Professional", status: "trial", mrr: 0, usuarios: 5, ultimoAcesso: "2026-02-26", inicioContrato: "2026-02-10" },
  { id: "5", nome: "GreenPharma SA", cnpj: "33.444.555/0001-22", plano: "Enterprise", status: "ativo", mrr: 3800, usuarios: 25, ultimoAcesso: "2026-02-23", inicioContrato: "2025-03-20" },
  { id: "6", nome: "Manipula Fácil", cnpj: "77.888.999/0001-66", plano: "Starter", status: "cancelado", mrr: 0, usuarios: 0, ultimoAcesso: "2026-01-15", inicioContrato: "2025-09-01" },
  { id: "7", nome: "Dermacaps", cnpj: "44.333.222/0001-11", plano: "Professional", status: "inadimplente", mrr: 1200, usuarios: 6, ultimoAcesso: "2026-02-20", inicioContrato: "2025-07-10" },
  { id: "8", nome: "VitaPlus Farmácia", cnpj: "66.555.444/0001-33", plano: "Enterprise", status: "ativo", mrr: 2500, usuarios: 12, ultimoAcesso: "2026-02-26", inicioContrato: "2025-04-05" },
];

const revenueData = [
  { mes: "Set", mrr: 8200, clientes: 12 },
  { mes: "Out", mrr: 9800, clientes: 15 },
  { mes: "Nov", mrr: 11500, clientes: 18 },
  { mes: "Dez", mrr: 13200, clientes: 22 },
  { mes: "Jan", mrr: 14800, clientes: 26 },
  { mes: "Fev", mrr: 16400, clientes: 30 },
];

const planoData = [
  { name: "Starter", value: 3, color: "hsl(var(--info))" },
  { name: "Professional", value: 4, color: "hsl(var(--warning))" },
  { name: "Enterprise", value: 3, color: "hsl(var(--secondary))" },
];

const churnData = [
  { mes: "Set", churn: 2.1, novos: 3 },
  { mes: "Out", churn: 1.8, novos: 4 },
  { mes: "Nov", churn: 3.2, novos: 5 },
  { mes: "Dez", churn: 1.5, novos: 6 },
  { mes: "Jan", churn: 2.0, novos: 5 },
  { mes: "Fev", churn: 1.2, novos: 4 },
];

// ─── Components ───

interface MetricCardProps {
  title: string;
  value: string;
  change: number;
  icon: React.ElementType;
  variant?: "default" | "success" | "warning" | "danger";
}

function MetricCard({ title, value, change, icon: Icon, variant = "default" }: MetricCardProps) {
  const isPositive = change >= 0;
  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-4">
        <div className={cn(
          "p-3 rounded-lg",
          variant === "success" && "bg-success/10 text-success",
          variant === "warning" && "bg-warning/10 text-warning",
          variant === "danger" && "bg-destructive/10 text-destructive",
          variant === "default" && "bg-primary/10 text-primary",
        )}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">{title}</p>
          <p className="text-2xl font-bold mt-0.5">{value}</p>
        </div>
        <div className={cn(
          "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full",
          isPositive ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
        )}>
          {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          {Math.abs(change)}%
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    ativo: { label: "Ativo", className: "bg-success/10 text-success border-success/20" },
    trial: { label: "Trial", className: "bg-info/10 text-info border-info/20" },
    cancelado: { label: "Cancelado", className: "bg-muted text-muted-foreground border-border" },
    inadimplente: { label: "Inadimplente", className: "bg-destructive/10 text-destructive border-destructive/20" },
  };
  const s = map[status] || map.ativo;
  return <Badge variant="outline" className={cn("text-xs font-medium", s.className)}>{s.label}</Badge>;
}

function PlanBadge({ plano }: { plano: string }) {
  const map: Record<string, string> = {
    Starter: "bg-info/10 text-info border-info/20",
    Professional: "bg-warning/10 text-warning border-warning/20",
    Enterprise: "bg-secondary/10 text-secondary border-secondary/20",
  };
  return <Badge variant="outline" className={cn("text-xs font-medium", map[plano] || "")}>{plano}</Badge>;
}

// ─── Page ───

export default function SaasDashboardPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [planoFilter, setPlanoFilter] = useState("todos");

  const totalMRR = mockClients.filter(c => c.status === "ativo").reduce((s, c) => s + c.mrr, 0);
  const totalClientes = mockClients.filter(c => c.status !== "cancelado").length;
  const totalUsuarios = mockClients.reduce((s, c) => s + c.usuarios, 0);
  const churnRate = 1.2;

  const filtered = mockClients.filter(c => {
    if (search && !c.nome.toLowerCase().includes(search.toLowerCase()) && !c.cnpj.includes(search)) return false;
    if (statusFilter !== "todos" && c.status !== statusFilter) return false;
    if (planoFilter !== "todos" && c.plano !== planoFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Crown className="h-6 w-6 text-secondary" />
            Painel SaaS — Clientes
          </h1>
          <p className="page-description">Controle de assinantes, receita recorrente e métricas do seu SaaS</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm"><RefreshCw className="h-4 w-4 mr-1" /> Atualizar</Button>
          <Button size="sm" className="bg-secondary hover:bg-secondary/90 text-secondary-foreground">
            <UserPlus className="h-4 w-4 mr-1" /> Novo Cliente
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="MRR Total"
          value={`R$ ${totalMRR.toLocaleString("pt-BR")}`}
          change={10.8}
          icon={DollarSign}
          variant="success"
        />
        <MetricCard
          title="Clientes Ativos"
          value={totalClientes.toString()}
          change={15.4}
          icon={Users}
        />
        <MetricCard
          title="Usuários Totais"
          value={totalUsuarios.toString()}
          change={8.2}
          icon={Activity}
        />
        <MetricCard
          title="Churn Rate"
          value={`${churnRate}%`}
          change={-0.8}
          icon={UserX}
          variant={churnRate > 3 ? "danger" : "success"}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* MRR Evolution */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-secondary" />
              Evolução MRR
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="mrrGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--secondary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--secondary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="mes" className="text-xs fill-muted-foreground" />
                <YAxis className="text-xs fill-muted-foreground" tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <RechartsTooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => [`R$ ${v.toLocaleString("pt-BR")}`, "MRR"]}
                />
                <Area type="monotone" dataKey="mrr" stroke="hsl(var(--secondary))" fill="url(#mrrGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Distribution by Plan */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Distribuição por Plano</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={planoData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={4} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {planoData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Churn vs Novos */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Churn vs Novos Clientes</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={churnData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="mes" className="text-xs fill-muted-foreground" />
              <YAxis className="text-xs fill-muted-foreground" />
              <RechartsTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="novos" fill="hsl(var(--secondary))" name="Novos" radius={[4, 4, 0, 0]} />
              <Bar dataKey="churn" fill="hsl(var(--destructive))" name="Churn %" radius={[4, 4, 0, 0]} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Client List */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="text-base">Clientes SaaS</CardTitle>
            <div className="flex gap-2 flex-wrap">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar cliente..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9 w-52"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36 h-9">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos Status</SelectItem>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="inadimplente">Inadimplente</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
              <Select value={planoFilter} onValueChange={setPlanoFilter}>
                <SelectTrigger className="w-36 h-9">
                  <SelectValue placeholder="Plano" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos Planos</SelectItem>
                  <SelectItem value="Starter">Starter</SelectItem>
                  <SelectItem value="Professional">Professional</SelectItem>
                  <SelectItem value="Enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="table-responsive">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">MRR</TableHead>
                  <TableHead className="text-center">Usuários</TableHead>
                  <TableHead>Último Acesso</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.nome}</TableCell>
                    <TableCell className="text-muted-foreground text-xs font-mono">{c.cnpj}</TableCell>
                    <TableCell><PlanBadge plano={c.plano} /></TableCell>
                    <TableCell><StatusBadge status={c.status} /></TableCell>
                    <TableCell className="text-right font-medium">
                      {c.mrr > 0 ? `R$ ${c.mrr.toLocaleString("pt-BR")}` : "—"}
                    </TableCell>
                    <TableCell className="text-center">{c.usuarios}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {new Date(c.ultimoAcesso).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Nenhum cliente encontrado
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
