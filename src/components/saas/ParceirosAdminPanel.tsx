import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Megaphone, Plus, Trash2, ExternalLink, Image as ImageIcon, Video, 
  BarChart3, Users, CheckCircle2, AlertCircle, Clock, Pause,
  Eye, TrendingUp, DollarSign, Loader2, Upload, Link as LinkIcon
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { useUploadFile } from "@/hooks/use-files";

export function ParceirosAdminPanel() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("campanhas");

  const { data: stats } = useQuery({
    queryKey: ['parceiros-stats'],
    queryFn: async () => {
      const { data: campanhas } = await supabase.from('brainx_campanhas').select('total_impressoes, total_cliques, ativo, aprovado');
      const { count: parceirosCount } = await supabase.from('brainx_parceiros').select('*', { count: 'exact', head: true });
      
      const totalImpressoes = campanhas?.reduce((acc, c) => acc + (c.total_impressoes || 0), 0) || 0;
      const totalCliques = campanhas?.reduce((acc, c) => acc + (c.total_cliques || 0), 0) || 0;
      const ctr = totalImpressoes > 0 ? (totalCliques / totalImpressoes * 100).toFixed(1) : "0";

      return {
        impressoes: totalImpressoes,
        cliques: totalCliques,
        ctr: ctr + "%",
        parceirosAtivos: parceirosCount || 0,
        campanhasAtivas: campanhas?.filter(c => c.ativo && c.aprovado).length || 0
      };
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2"><Megaphone className="h-5 w-5 text-primary" /> Ecossistema de Parceiros</h2>
          <p className="text-sm text-muted-foreground">Gerencie parceiros, criativos e campanhas publicitárias no ERP.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="border-none shadow-sm bg-primary/5">
          <CardContent className="pt-4">
            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Impressões (Total)</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-2xl font-black">{stats?.impressoes.toLocaleString()}</span>
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="pt-4">
            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Cliques (Total)</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-2xl font-black">{stats?.cliques.toLocaleString()}</span>
              <div className="p-1 bg-success/10 rounded-full"><CheckCircle2 className="h-3 w-3 text-success" /></div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="pt-4">
            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">CTR Médio</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-2xl font-black">{stats?.ctr}</span>
              <BarChart3 className="h-4 w-4 text-info" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="pt-4">
            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Parceiros</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-2xl font-black">{stats?.parceirosAtivos}</span>
              <Users className="h-4 w-4 text-warning" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="pt-4">
            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Ativas</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-2xl font-black text-primary">{stats?.campanhasAtivas}</span>
              <div className="animate-pulse h-2 w-2 rounded-full bg-success" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
          <TabsTrigger value="campanhas">Campanhas</TabsTrigger>
          <TabsTrigger value="parceiros">Parceiros</TabsTrigger>
          <TabsTrigger value="criativos">Criativos</TabsTrigger>
        </TabsList>

        <TabsContent value="campanhas" className="mt-4">
          <CampanhasTab />
        </TabsContent>
        <TabsContent value="parceiros" className="mt-4">
          <ParceirosTab />
        </TabsContent>
        <TabsContent value="criativos" className="mt-4">
           <CriativosTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CampanhasTab() {
  const queryClient = useQueryClient();
  const { data: campanhas, isLoading } = useQuery({
    queryKey: ['parceiros-campanhas-admin'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('brainx-parceiros', {
        method: 'GET',
        headers: { 'action': 'list-admin' }
      });
      if (error) throw error;
      return data.campanhas;
    }
  });

  const getStatusBadge = (c: any) => {
    const hoje = new Date().toISOString().slice(0, 10);
    if (!c.aprovado) return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Pendente Aprovação</Badge>;
    if (!c.ativo) return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">Pausada</Badge>;
    if (c.data_fim && c.data_fim < hoje) return <Badge variant="outline" className="bg-muted text-muted-foreground">Encerrada</Badge>;
    if (c.data_inicio > hoje) return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Agendada</Badge>;
    return <Badge variant="outline" className="bg-success/10 text-success border-success/20 animate-pulse">Ativa</Badge>;
  };

  return (
    <Card className="border-none shadow-sm overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/30">
        <div>
          <CardTitle className="text-sm font-bold uppercase tracking-wider">Gestão de Campanhas</CardTitle>
        </div>
        <Button size="sm" className="gap-2 font-bold"><Plus className="h-4 w-4" /> Nova Campanha</Button>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Campanha / Parceiro</TableHead>
              <TableHead>Posição</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Métricas</TableHead>
              <TableHead>Período</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-10">Carregando...</TableCell></TableRow>
            ) : campanhas?.map((c: any) => (
              <TableRow key={c.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-bold">{c.nome}</span>
                    <span className="text-xs text-muted-foreground">{c.parceiro?.nome}</span>
                  </div>
                </TableCell>
                <TableCell>
                   <Badge variant="secondary" className="text-[10px]">{c.posicao}</Badge>
                </TableCell>
                <TableCell>{getStatusBadge(c)}</TableCell>
                <TableCell>
                  <div className="flex flex-col text-xs">
                    <span className="font-bold">{c.total_impressoes || 0} imp.</span>
                    <span className="text-muted-foreground">{c.total_cliques || 0} cliques ({c.total_impressoes > 0 ? (c.total_cliques / c.total_impressoes * 100).toFixed(1) : 0}%)</span>
                  </div>
                </TableCell>
                <TableCell className="text-xs">
                   {format(new Date(c.data_inicio), 'dd/MM/yy')}
                   {c.data_fim ? ` - ${format(new Date(c.data_fim), 'dd/MM/yy')}` : ' ∞'}
                </TableCell>
                <TableCell className="text-right">
                   <Button variant="ghost" size="icon" title="Ver criativo"><Eye className="h-4 w-4" /></Button>
                   <Button variant="ghost" size="icon" className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function ParceirosTab() {
  const { data: parceiros, isLoading } = useQuery({
    queryKey: ['parceiros-list-admin'],
    queryFn: async () => {
      const { data, error } = await supabase.from('brainx_parceiros').select('*').order('nome');
      if (error) throw error;
      return data;
    }
  });

  return (
     <Card className="border-none shadow-sm overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/30">
          <CardTitle className="text-sm font-bold uppercase tracking-wider">Parceiros Comerciais</CardTitle>
          <Button size="sm" className="gap-2 font-bold"><Plus className="h-4 w-4" /> Novo Parceiro</Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Parceiro</TableHead>
                <TableHead>Segmento</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
               {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-10">Carregando...</TableCell></TableRow>
               ) : parceiros?.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell className="font-bold">{p.nome}</TableCell>
                  <TableCell><Badge variant="outline">{p.segmento}</Badge></TableCell>
                  <TableCell>
                    <div className="flex flex-col text-xs">
                      <span>{p.contato_nome}</span>
                      <span className="text-muted-foreground">{p.contato_email}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {p.ativo ? <Badge className="bg-success/10 text-success border-success/20">Ativo</Badge> : <Badge variant="secondary">Inativo</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                     <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
               ))}
            </TableBody>
          </Table>
        </CardContent>
     </Card>
  );
}

function CriativosTab() {
  const { data: criativos, isLoading } = useQuery({
    queryKey: ['parceiros-criativos-list-admin'],
    queryFn: async () => {
      const { data, error } = await supabase.from('brainx_criativos').select('*, brainx_parceiros(nome)').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  return (
    <Card className="border-none shadow-sm overflow-hidden">
       <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/30">
          <CardTitle className="text-sm font-bold uppercase tracking-wider">Biblioteca de Criativos</CardTitle>
          <Button size="sm" className="gap-2 font-bold"><Plus className="h-4 w-4" /> Novo Criativo</Button>
        </CardHeader>
        <CardContent className="p-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {isLoading ? "Carregando..." : criativos?.map((c: any) => (
              <Card key={c.id} className="overflow-hidden group">
                 <div className="aspect-video bg-muted relative">
                    {c.tipo === 'IMAGEM' || c.tipo === 'GIF' ? (
                       <img src={c.arquivo_url} className="w-full h-full object-cover" />
                    ) : (
                       <div className="flex items-center justify-center h-full"><Video className="h-8 w-8 opacity-20" /></div>
                    )}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                       <Button size="icon" variant="ghost" className="text-white"><Eye className="h-4 w-4" /></Button>
                       <Button size="icon" variant="ghost" className="text-white"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                 </div>
                 <div className="p-3">
                    <h5 className="text-xs font-bold line-clamp-1">{c.titulo}</h5>
                    <p className="text-[10px] text-muted-foreground">{c.brainx_parceiros?.nome}</p>
                 </div>
              </Card>
            ))}
          </div>
        </CardContent>
    </Card>
  );
}
