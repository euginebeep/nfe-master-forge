import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Megaphone, Plus, Trash2, Calendar, Globe, Building2, AlertCircle, Info, Flame, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Comunicado {
  id: string;
  titulo: string;
  conteudo: string;
  tipo: 'INFO' | 'AVISO' | 'MANUTENCAO' | 'URGENTE';
  ativo: boolean;
  alvo_tenant: string | null;
  alvo_tipo_empresa: string | null;
  link_acao: string | null;
  label_acao: string | null;
  expira_em: string | null;
  created_at: string;
  company?: {
    razao_social: string;
  };
}

export function ComunicadosPanel() {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newComunicado, setNewComunicado] = useState<Partial<Comunicado>>({
    tipo: 'INFO',
    ativo: true,
  });

  const { data: comunicados, isLoading } = useQuery({
    queryKey: ['saas-comunicados'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('saas_comunicados')
        .select('*, company:alvo_tenant(razao_social)')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Comunicado[];
    }
  });

  const { data: companies } = useQuery({
    queryKey: ['saas-companies-basic'],
    queryFn: async () => {
      const { data, error } = await supabase.from('company').select('id, razao_social').order('razao_social');
      if (error) throw error;
      return data;
    }
  });

  const createMutation = useMutation({
    mutationFn: async (comunicado: Partial<Comunicado>) => {
      const { data, error } = await supabase.from('saas_comunicados').insert([comunicado]);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saas-comunicados'] });
      setIsCreateOpen(false);
      setNewComunicado({ tipo: 'INFO', ativo: true });
      toast.success("Comunicado criado com sucesso!");
    },
    onError: (err: any) => {
      toast.error("Erro ao criar comunicado: " + err.message);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('saas_comunicados').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saas-comunicados'] });
      toast.success("Comunicado removido");
    }
  });

  const toggleAtivoMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string, ativo: boolean }) => {
      const { error } = await supabase.from('saas_comunicados').update({ ativo }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saas-comunicados'] });
    }
  });

  const getTipoBadge = (tipo: string) => {
    switch (tipo) {
      case 'URGENTE': return <Badge variant="destructive" className="gap-1"><Flame className="h-3 w-3" /> URGENTE</Badge>;
      case 'MANUTENCAO': return <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-200 gap-1"><Settings className="h-3 w-3" /> MANUTENÇÃO</Badge>;
      case 'AVISO': return <Badge variant="outline" className="bg-yellow-100 text-yellow-700 border-yellow-200 gap-1"><AlertCircle className="h-3 w-3" /> AVISO</Badge>;
      default: return <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200 gap-1"><Info className="h-3 w-3" /> INFORMAÇÃO</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2"><Megaphone className="h-5 w-5 text-primary" /> Comunicados e Avisos</h2>
          <p className="text-sm text-muted-foreground">Gerencie avisos globais ou direcionados que aparecerão nos dashboards dos tenants.</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 font-bold"><Plus className="h-4 w-4" /> Novo Comunicado</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Criar Novo Comunicado</DialogTitle>
              <DialogDescription>Preencha os dados do aviso que será exibido aos usuários.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="col-span-2 space-y-2">
                <Label>Título do Aviso</Label>
                <Input 
                  placeholder="Ex: Manutenção Programada" 
                  value={newComunicado.titulo || ''} 
                  onChange={e => setNewComunicado({...newComunicado, titulo: e.target.value})}
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Conteúdo (Markdown suportado)</Label>
                <Textarea 
                  placeholder="Descreva o comunicado detalhadamente..." 
                  className="min-h-[120px]"
                  value={newComunicado.conteudo || ''}
                  onChange={e => setNewComunicado({...newComunicado, conteudo: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo de Aviso</Label>
                <Select value={newComunicado.tipo} onValueChange={(v: any) => setNewComunicado({...newComunicado, tipo: v})}>
                  <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INFO">Informação (Azul)</SelectItem>
                    <SelectItem value="AVISO">Aviso (Amarelo)</SelectItem>
                    <SelectItem value="MANUTENCAO">Manutenção (Laranja)</SelectItem>
                    <SelectItem value="URGENTE">Urgente (Vermelho)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Expira em (opcional)</Label>
                <Input 
                  type="datetime-local" 
                  onChange={e => setNewComunicado({...newComunicado, expira_em: e.target.value ? new Date(e.target.value).toISOString() : null})}
                />
              </div>
              <div className="space-y-2">
                <Label>Alcance / Alvo</Label>
                <Select 
                  value={newComunicado.alvo_tenant || 'global'} 
                  onValueChange={(v) => setNewComunicado({...newComunicado, alvo_tenant: v === 'global' ? null : v})}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione o alvo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">Global (Todos os Tenants)</SelectItem>
                    {companies?.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.razao_social}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tipo de Empresa (Filtro)</Label>
                <Select 
                  value={newComunicado.alvo_tipo_empresa || 'todos'} 
                  onValueChange={(v) => setNewComunicado({...newComunicado, alvo_tipo_empresa: v === 'todos' ? null : v})}
                >
                  <SelectTrigger><SelectValue placeholder="Filtro por tipo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os Tipos</SelectItem>
                    <SelectItem value="farmacia">Farmácias</SelectItem>
                    <SelectItem value="industria">Indústrias</SelectItem>
                    <SelectItem value="distribuidora">Distribuidoras</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Texto do Botão (Ação)</Label>
                <Input 
                  placeholder="Ex: Ver Detalhes" 
                  value={newComunicado.label_acao || ''}
                  onChange={e => setNewComunicado({...newComunicado, label_acao: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>Link de Ação</Label>
                <Input 
                  placeholder="Ex: /financeiro ou https://..." 
                  value={newComunicado.link_acao || ''}
                  onChange={e => setNewComunicado({...newComunicado, link_acao: e.target.value})}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
              <Button 
                onClick={() => createMutation.mutate(newComunicado)}
                disabled={!newComunicado.titulo || !newComunicado.conteudo || createMutation.isPending}
              >
                Criar Comunicado
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-none shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Comunicado</TableHead>
                <TableHead>Alvo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Expira em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-10">Carregando...</TableCell></TableRow>
              ) : comunicados?.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground italic">Nenhum comunicado ativo.</TableCell></TableRow>
              ) : comunicados?.map(c => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-bold flex items-center gap-2">
                        {c.titulo}
                        {getTipoBadge(c.tipo)}
                      </span>
                      <span className="text-xs text-muted-foreground line-clamp-1">{c.conteudo}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-xs">
                      {c.alvo_tenant ? (
                        <Badge variant="secondary" className="gap-1"><Building2 className="h-3 w-3" /> {c.company?.razao_social}</Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1"><Globe className="h-3 w-3" /> Global</Badge>
                      )}
                      {c.alvo_tipo_empresa && (
                        <Badge variant="outline" className="capitalize">{c.alvo_tipo_empresa}</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className={c.ativo ? "text-success" : "text-muted-foreground"}
                      onClick={() => toggleAtivoMutation.mutate({ id: c.id, ativo: !c.ativo })}
                    >
                      {c.ativo ? "Ativo" : "Inativo"}
                    </Button>
                  </TableCell>
                  <TableCell className="text-xs">
                    {c.expira_em ? (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(c.expira_em), "dd/MM HH:mm")}
                      </div>
                    ) : "Nunca"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-destructive"
                      onClick={() => {
                        if (confirm("Deseja remover este comunicado?")) {
                          deleteMutation.mutate(c.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
