import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  ClipboardCheck,
  Plus,
  FileEdit,
  History,
  AlertCircle,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Search,
  Filter,
} from "lucide-react";
import { format, isBefore, subDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const CATEGORIAS_POP = {
  A_HIGIENIZACAO: { label: "Higienização", color: "bg-blue-100 text-blue-800" },
  B_PRAGAS: { label: "Pragas", color: "bg-orange-100 text-orange-800" },
  C_AGUA: { label: "Água", color: "bg-cyan-100 text-cyan-800" },
  D_MANIPULADORES: { label: "Manipuladores", color: "bg-purple-100 text-purple-800" },
  E_CALIBRACAO: { label: "Calibração", color: "bg-amber-100 text-amber-800" },
  F_TEMPERATURA: { label: "Temperatura/Umidade", color: "bg-emerald-100 text-emerald-800" },
  G_RECOLHIMENTO: { label: "Recolhimento", color: "bg-red-100 text-red-800" },
  H_MATERIAS_PRIMAS: { label: "Matérias-Primas", color: "bg-indigo-100 text-indigo-800" },
  I_PESAGEM: { label: "Pesagem", color: "bg-violet-100 text-violet-800" },
  J_CONTROLE_QUALIDADE: { label: "Qualidade", color: "bg-teal-100 text-teal-800" },
  K_ROTULAGEM: { label: "Rotulagem", color: "bg-lime-100 text-lime-800" },
  L_AMOSTRA_RETENCAO: { label: "Retenção", color: "bg-pink-100 text-pink-800" },
  OUTRO: { label: "Outro", color: "bg-slate-100 text-slate-800" },
};

const STATUS_POP = {
  ATIVO: { label: "Ativo", variant: "default" },
  RASCUNHO: { label: "Rascunho", variant: "secondary" },
  REVISAO: { label: "Em Revisão", variant: "outline" },
  OBSOLETO: { label: "Obsoleto", variant: "destructive" },
};

export default function POPsPage() {
  const queryClient = useQueryClient();
  const [filterCategoria, setFilterCategoria] = useState("TODAS");
  const [filterStatus, setFilterStatus] = useState("TODOS");
  const [searchTerm, setSearchTerm] = useState("");
  
  // Dialog States
  const [popDialogOpen, setPopDialogOpen] = useState(false);
  const [execDialogOpen, setExecDialogOpen] = useState(false);
  const [editingPop, setEditingPop] = useState<any>(null);
  
  // Queries
  const { data: pops, isLoading } = useQuery({
    queryKey: ["pops"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pops")
        .select(`
          *,
          pop_registros_execucao(
            data_execucao,
            resultado,
            executado_por
          )
        `)
        .order("codigo", { ascending: true });
      
      if (error) throw error;
      return data;
    },
  });

  const { data: rts } = useQuery({
    queryKey: ["responsaveis-tecnicos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("responsaveis_tecnicos")
        .select("id, nome");
      if (error) throw error;
      return data;
    },
  });

  // Mutations
  const popMutation = useMutation({
    mutationFn: async (values: any) => {
      if (editingPop) {
        const { error } = await supabase
          .from("pops")
          .update(values)
          .eq("id", editingPop.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("pops")
          .insert(values);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pops"] });
      toast.success(editingPop ? "POP atualizado" : "POP criado com sucesso");
      setPopDialogOpen(false);
      setEditingPop(null);
    },
    onError: (err: any) => toast.error(`Erro: ${err.message}`),
  });

  const execMutation = useMutation({
    mutationFn: async (values: any) => {
      const { error } = await supabase
        .from("pop_registros_execucao")
        .insert(values);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pops"] });
      toast.success("Execução registrada com sucesso");
      setExecDialogOpen(false);
    },
    onError: (err: any) => toast.error(`Erro: ${err.message}`),
  });

  // Filtered Data
  const filteredPops = useMemo(() => {
    if (!pops) return [];
    return pops.filter(pop => {
      const matchCat = filterCategoria === "TODAS" || pop.categoria === filterCategoria;
      const matchStatus = filterStatus === "TODOS" || pop.status === filterStatus;
      const matchSearch = pop.titulo.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          pop.codigo.toLowerCase().includes(searchTerm.toLowerCase());
      return matchCat && matchStatus && matchSearch;
    });
  }, [pops, filterCategoria, filterStatus, searchTerm]);

  const handleOpenPopDialog = (pop: any = null) => {
    setEditingPop(pop);
    setPopDialogOpen(true);
  };

  const getAlertStatus = (pop: any) => {
    const alerts = [];
    const now = new Date();
    
    // Próxima revisão vencida
    if (pop.data_proxima_revisao && isBefore(parseISO(pop.data_proxima_revisao), now)) {
      alerts.push("Revisão vencida");
    }
    
    // Sem execução recente (90 dias)
    const ultExec = pop.pop_registros_execucao?.[0];
    if (pop.status === 'ATIVO') {
      if (!ultExec) {
        alerts.push("Sem execução registrada");
      } else {
        const limiteExec = subDays(now, 90);
        if (isBefore(parseISO(ultExec.data_execucao), limiteExec)) {
          alerts.push("Sem execução há >90 dias");
        }
      }
    }
    
    return alerts;
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Procedimentos Operacionais Padrão (POPs)" 
        subtitle="RDC 275/2002 · RDC 843/2024"
      >
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setExecDialogOpen(true)}>
            <History className="w-4 h-4 mr-2" /> Registrar Execução
          </Button>
          <Button onClick={() => handleOpenPopDialog()}>
            <Plus className="w-4 h-4 mr-2" /> Novo POP
          </Button>
        </div>
      </PageHeader>

      <Card>
        <CardContent className="p-6 space-y-6">
          {/* Toolbar */}
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px] space-y-2">
              <Label>Buscar</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Código ou título..." 
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            
            <div className="w-[200px] space-y-2">
              <Label>Categoria</Label>
              <Select value={filterCategoria} onValueChange={setFilterCategoria}>
                <SelectTrigger>
                  <Filter className="w-3.5 h-3.5 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODAS">Todas as Categorias</SelectItem>
                  {Object.entries(CATEGORIAS_POP).map(([key, val]) => (
                    <SelectItem key={key} value={key}>{val.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-[150px] space-y-2">
              <Label>Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS">Todos</SelectItem>
                  {Object.entries(STATUS_POP).map(([key, val]) => (
                    <SelectItem key={key} value={key}>{val.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Código</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-center">Versão</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Próx. Revisão</TableHead>
                  <TableHead>Última Execução</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8">Carregando POPs...</TableCell></TableRow>
                ) : filteredPops.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum POP encontrado</TableCell></TableRow>
                ) : (
                  filteredPops.map((pop) => {
                    const alerts = getAlertStatus(pop);
                    const ultExec = pop.pop_registros_execucao?.[0];
                    
                    return (
                      <TableRow key={pop.id}>
                        <TableCell className="font-mono font-medium">{pop.codigo}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <span className="font-medium block">{pop.titulo}</span>
                            {alerts.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {alerts.map((a, i) => (
                                  <Badge key={i} variant="destructive" className="text-[10px] h-4 py-0">
                                    <AlertTriangle className="w-2.5 h-2.5 mr-1" /> {a}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={CATEGORIAS_POP[pop.categoria as keyof typeof CATEGORIAS_POP]?.color}>
                            {CATEGORIAS_POP[pop.categoria as keyof typeof CATEGORIAS_POP]?.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">{pop.versao}</TableCell>
                        <TableCell>
                          <Badge variant={STATUS_POP[pop.status as keyof typeof STATUS_POP]?.variant as any}>
                            {STATUS_POP[pop.status as keyof typeof STATUS_POP]?.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {pop.data_proxima_revisao ? format(parseISO(pop.data_proxima_revisao), "dd/MM/yyyy") : "-"}
                        </TableCell>
                        <TableCell>
                          {ultExec ? (
                            <div className="text-xs space-y-0.5">
                              <span className="font-medium flex items-center">
                                {ultExec.resultado === 'CONFORME' ? (
                                  <CheckCircle2 className="w-3 h-3 text-emerald-500 mr-1" />
                                ) : (
                                  <XCircle className="w-3 h-3 text-red-500 mr-1" />
                                )}
                                {format(parseISO(ultExec.data_execucao), "dd/MM/yy HH:mm")}
                              </span>
                              <span className="text-muted-foreground block truncate max-w-[120px]">por {ultExec.executado_por}</span>
                            </div>
                          ) : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => handleOpenPopDialog(pop)}>
                            <FileEdit className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* POP CRUD Dialog */}
      <Dialog open={popDialogOpen} onOpenChange={setPopDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingPop ? "Editar POP" : "Novo Procedimento (POP)"}</DialogTitle>
          </DialogHeader>
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const values = Object.fromEntries(fd.entries());
              popMutation.mutate(values);
            }}
            className="grid grid-cols-2 gap-4"
          >
            <div className="space-y-2">
              <Label>Código</Label>
              <Input name="codigo" defaultValue={editingPop?.codigo} required placeholder="Ex: POP-A-001" />
            </div>
            <div className="space-y-2">
              <Label>Versão</Label>
              <Input name="versao" defaultValue={editingPop?.versao || "1.0"} required />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Título do Procedimento</Label>
              <Input name="titulo" defaultValue={editingPop?.titulo} required placeholder="Ex: Higienização de Bancadas" />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select name="categoria" defaultValue={editingPop?.categoria || "A_HIGIENIZACAO"}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORIAS_POP).map(([key, val]) => (
                    <SelectItem key={key} value={key}>{val.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select name="status" defaultValue={editingPop?.status || "ATIVO"}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_POP).map(([key, val]) => (
                    <SelectItem key={key} value={key}>{val.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Frequência de Execução</Label>
              <Input name="frequencia" defaultValue={editingPop?.frequencia} placeholder="Ex: Diária, Semestral..." />
            </div>
            <div className="space-y-2">
              <Label>Data Próxima Revisão</Label>
              <Input name="data_proxima_revisao" type="date" defaultValue={editingPop?.data_proxima_revisao} />
            </div>
            <div className="space-y-2">
              <Label>Responsável Elaboração</Label>
              <Input name="responsavel_elaboracao" defaultValue={editingPop?.responsavel_elaboracao} />
            </div>
            <div className="space-y-2">
              <Label>Responsável Aprovação</Label>
              <Input name="responsavel_aprovacao" defaultValue={editingPop?.responsavel_aprovacao} />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Observações</Label>
              <Textarea name="observacoes" defaultValue={editingPop?.observacoes} rows={3} />
            </div>
            <DialogFooter className="col-span-2">
              <Button type="button" variant="ghost" onClick={() => setPopDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={popMutation.isPending}>Salvar POP</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Execution Register Dialog */}
      <Dialog open={execDialogOpen} onOpenChange={setExecDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Execução de POP</DialogTitle>
          </DialogHeader>
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const values = Object.fromEntries(fd.entries());
              execMutation.mutate(values);
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Procedimento (POP)</Label>
              <Select name="pop_id" required>
                <SelectTrigger><SelectValue placeholder="Selecione o POP..." /></SelectTrigger>
                <SelectContent>
                  {pops?.filter(p => p.status === 'ATIVO').map(pop => (
                    <SelectItem key={pop.id} value={pop.id}>{pop.codigo} - {pop.titulo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Executado por</Label>
                <Input name="executado_por" required placeholder="Nome do colaborador" />
              </div>
              <div className="space-y-2">
                <Label>Resultado</Label>
                <Select name="resultado" defaultValue="CONFORME">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CONFORME">Conforme</SelectItem>
                    <SelectItem value="NAO_CONFORME">Não Conforme</SelectItem>
                    <SelectItem value="PARCIALMENTE_CONFORME">Parcialmente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Observações / Ocorrências</Label>
              <Textarea name="observacoes" placeholder="Relate detalhes da execução..." />
            </div>
            <div className="space-y-2">
              <Label>Data Próxima Execução</Label>
              <Input name="proxima_execucao" type="date" />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setExecDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={execMutation.isPending}>Registrar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
