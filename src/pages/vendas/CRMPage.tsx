import { Fragment, useEffect, useMemo, useState } from "react";
import {
  TrendingUp, Plus, Search, MapPin, Package, ArrowRight, ArrowUp,
  Users, Phone, Mail, Download, ChevronDown, ChevronRight, X, Archive, Edit
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useItens } from "@/hooks/use-itens";
import {
  useOportunidades, useMoverOportunidade, useCriarOportunidade, useAtualizarOportunidade,
  useArquivarOportunidade, useInteracoes, useRegistrarInteracao,
  useVendedoresExternos, useCriarVendedor, useAtualizarVendedor,
  useTabelaPrecos, useCriarTabelaPreco, useRemoverTabelaPreco,
  usePedidosVendedor, useMarcarComissaoPaga,
  Oportunidade, VendedorExterno,
} from "@/hooks/use-crm";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useFormPersist } from "@/hooks/use-form-persist";

const ETAPAS: Oportunidade["status"][] = ["LEAD", "CONTATO", "PROPOSTA", "NEGOCIACAO", "FECHADO", "PERDIDO"];
const ETAPA_LABEL: Record<string, string> = {
  LEAD: "Lead", CONTATO: "Contato", PROPOSTA: "Proposta",
  NEGOCIACAO: "Negociação", FECHADO: "Fechado", PERDIDO: "Perdido",
};
const ORIGENS = ["VENDEDOR_EXTERNO", "DIRETO", "INDICACAO", "INSTAGRAM", "SITE", "WHATSAPP"];
const ORIGEM_LABEL: Record<string, string> = {
  VENDEDOR_EXTERNO: "Vendedor externo", DIRETO: "Direto", INDICACAO: "Indicação",
  INSTAGRAM: "Instagram", SITE: "Site", WHATSAPP: "WhatsApp",
};
const UFS = ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"];

const fmtBRL = (v: number) => `R$ ${(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const iniciais = (s: string) => (s || "?").split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase();
const inicioMes = () => {
  const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

export default function CRMPage() {
  return (
    <div>
      <PageHeader
        title="CRM — Vendas"
        description="Pipeline de leads, pedidos e vendedores externos"
        icon={TrendingUp}
      />
      <Tabs defaultValue="pipeline" className="w-full">
        <TabsList className="grid w-full max-w-2xl grid-cols-4">
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="leads">Leads</TabsTrigger>
          <TabsTrigger value="vendedores">Vendedores</TabsTrigger>
          <TabsTrigger value="comissoes">Comissões</TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline" className="mt-4"><PipelineTab /></TabsContent>
        <TabsContent value="leads" className="mt-4"><LeadsTab /></TabsContent>
        <TabsContent value="vendedores" className="mt-4"><VendedoresTab /></TabsContent>
        <TabsContent value="comissoes" className="mt-4"><ComissoesTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ═══════════════════════ TAB 1: PIPELINE ═══════════════════════
function PipelineTab() {
  const { profile } = useAuth();
  const [filters, setFilters] = useFormPersist(`crm-pipeline:${profile?.company_id ?? "pending"}`, {
    busca: "",
    vendedorFiltro: "__all__",
    origemFiltro: "__all__",
    produtoFiltro: "__all__",
  });
  const { busca, vendedorFiltro, origemFiltro, produtoFiltro } = filters;
  const setBusca = (v: string) => setFilters((f) => ({ ...f, busca: v }));
  const setVendedorFiltro = (v: string) => setFilters((f) => ({ ...f, vendedorFiltro: v }));
  const setOrigemFiltro = (v: string) => setFilters((f) => ({ ...f, origemFiltro: v }));
  const setProdutoFiltro = (v: string) => setFilters((f) => ({ ...f, produtoFiltro: v }));

  const [selecionado, setSelecionado] = useState<Oportunidade | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const { data: oportunidades = [] } = useOportunidades({
    vendedor_id: vendedorFiltro === "__all__" ? null : vendedorFiltro === "__direto__" ? null : vendedorFiltro,
    origem: origemFiltro === "__all__" ? null : origemFiltro,
    busca,
  });
  const { data: vendedores = [] } = useVendedoresExternos(true);
  const { data: itens = [] } = useItens();
  const { data: pedidos = [] } = usePedidosVendedor();
  const mover = useMoverOportunidade();

  const filtrados = useMemo(() => {
    let rs = oportunidades;
    if (vendedorFiltro === "__direto__") rs = rs.filter(o => !o.vendedor_id);
    if (produtoFiltro !== "__all__") {
      const it = itens.find((i: any) => i.id === produtoFiltro);
      const nome = it?.descricao_interna?.toLowerCase() || "";
      rs = rs.filter(o => (o.produtos_interesse || "").toLowerCase().includes(nome));
    }
    return rs;
  }, [oportunidades, vendedorFiltro, produtoFiltro, itens]);

  // KPIs
  const ativos = filtrados.filter(o => o.status !== "FECHADO" && o.status !== "PERDIDO").length;
  const valorNeg = filtrados
    .filter(o => ["CONTATO", "PROPOSTA", "NEGOCIACAO"].includes(o.status))
    .reduce((s, o) => s + Number(o.valor_estimado || 0), 0);
  const fechadosMes = filtrados.filter(o => o.status === "FECHADO" && o.updated_at >= inicioMes()).length;
  const comissoesAPagar = pedidos
    .filter(p => p.status === "ENTREGUE" && !p.comissao_paga)
    .reduce((s, p) => s + Number(p.valor_comissao || 0), 0);
  const taxaConv = filtrados.length
    ? ((filtrados.filter(o => o.status === "FECHADO").length / filtrados.length) * 100).toFixed(1)
    : "0.0";

  const colunas: Record<string, Oportunidade[]> = {};
  ETAPAS.forEach(e => { colunas[e] = []; });
  filtrados.forEach(o => { (colunas[o.status] ||= []).push(o); });

  const onDrop = (status: string) => {
    if (draggedId) {
      mover.mutate({ id: draggedId, status });
      setDraggedId(null);
    }
  };

  const colHeaderCls = (etapa: string) =>
    etapa === "FECHADO" ? "bg-success/10 text-success border-success/30"
    : etapa === "PERDIDO" ? "bg-destructive/10 text-destructive border-destructive/30"
    : "bg-muted text-foreground";

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="pt-4"><div className="text-2xl font-bold">{ativos}</div><p className="text-xs text-muted-foreground">Leads ativos</p></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xl font-bold text-primary">{fmtBRL(valorNeg)}</div><p className="text-xs text-muted-foreground">Em negociação</p></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-2xl font-bold text-success">{fechadosMes}</div><p className="text-xs text-muted-foreground">Fechados no mês</p></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xl font-bold text-amber-500">{fmtBRL(comissoesAPagar)}</div><p className="text-xs text-muted-foreground">Comissões a pagar</p></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-2xl font-bold">{taxaConv}%</div><p className="text-xs text-muted-foreground">Conversão</p></CardContent></Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar lead..." value={busca} onChange={e => setBusca(e.target.value)} className="pl-10" />
        </div>
        <Select value={vendedorFiltro} onValueChange={setVendedorFiltro}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Vendedor" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos vendedores</SelectItem>
            <SelectItem value="__direto__">Direto (sem vendedor)</SelectItem>
            {vendedores.map(v => <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={origemFiltro} onValueChange={setOrigemFiltro}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Origem" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas origens</SelectItem>
            {ORIGENS.map(o => <SelectItem key={o} value={o}>{ORIGEM_LABEL[o]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={produtoFiltro} onValueChange={setProdutoFiltro}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Produto" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos produtos</SelectItem>
            {itens.slice(0, 100).map((i: any) => <SelectItem key={i.id} value={i.id}>{i.descricao_interna}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Legenda */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="inline-block w-1 h-3 bg-primary" /> Via vendedor externo</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-1 h-3 bg-success" /> Venda direta</span>
      </div>

      {/* Kanban */}
      <div className="overflow-x-auto pb-2">
        <div className="grid grid-cols-6 gap-3 min-w-[1100px]">
          {ETAPAS.map(etapa => {
            const items = colunas[etapa] || [];
            const total = items.reduce((s, o) => s + Number(o.valor_estimado || 0), 0);
            return (
              <div
                key={etapa}
                onDragOver={e => e.preventDefault()}
                onDrop={() => onDrop(etapa)}
                className="space-y-2"
              >
                <div className={`flex items-center justify-between px-3 py-2 rounded-md border ${colHeaderCls(etapa)}`}>
                  <div className="font-semibold text-sm">{ETAPA_LABEL[etapa]}</div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{items.length}</Badge>
                  </div>
                </div>
                <div className="text-[10px] text-muted-foreground px-1">{fmtBRL(total)}</div>
                <div className="min-h-[120px] space-y-2">
                  {items.map(lead => {
                    const viaVendedor = !!lead.vendedor_id;
                    const vend = vendedores.find(v => v.id === lead.vendedor_id);
                    return (
                      <Card
                        key={lead.id}
                        draggable
                        onDragStart={() => setDraggedId(lead.id)}
                        className={`cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow border-l-[3px] ${viaVendedor ? "border-l-primary" : "border-l-success"}`}
                      >
                        <CardContent className="p-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-7 w-7">
                              <AvatarFallback className="bg-primary text-primary-foreground text-[10px]">{iniciais(lead.empresa)}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-xs truncate">{lead.empresa}</p>
                              <p className="text-[10px] text-muted-foreground truncate">
                                {viaVendedor ? `Via ${vend?.nome || "vendedor"}` : "Venda direta"}
                              </p>
                            </div>
                          </div>
                          {lead.produtos_interesse && (
                            <p className="text-[10px] text-muted-foreground flex items-start gap-1 line-clamp-2">
                              <Package className="h-2.5 w-2.5 mt-0.5 shrink-0" />{lead.produtos_interesse}
                            </p>
                          )}
                          {(lead.cidade || lead.estado) && (
                            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <MapPin className="h-2.5 w-2.5" />{[lead.cidade, lead.estado].filter(Boolean).join("/")}
                            </p>
                          )}
                          <div className="flex items-center justify-between gap-1 pt-1 border-t">
                            <div className="flex flex-wrap gap-1">
                              <Badge variant="outline" className="text-[9px] h-4 px-1">{fmtBRL(Number(lead.valor_estimado || 0))}</Badge>
                              {lead.origem && <Badge variant="secondary" className="text-[9px] h-4 px-1">{ORIGEM_LABEL[lead.origem] || lead.origem}</Badge>}
                            </div>
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setSelecionado(lead)}>
                              <ArrowRight className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="h-1 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full ${lead.score >= 70 ? "bg-success" : lead.score >= 40 ? "bg-amber-500" : "bg-destructive"}`}
                              style={{ width: `${lead.score}%` }}
                            />
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <LeadDetailSheet
        lead={selecionado}
        onClose={() => setSelecionado(null)}
        vendedores={vendedores}
      />
    </div>
  );
}

// ═══════════════════════ LEAD DETAIL SHEET ═══════════════════════
function LeadDetailSheet({ lead, onClose, vendedores }: {
  lead: Oportunidade | null; onClose: () => void; vendedores: VendedorExterno[];
}) {
  const navigate = useNavigate();
  const [novaTipo, setNovaTipo] = useState("LIGACAO");
  const [novaDescricao, setNovaDescricao] = useState("");
  const { data: interacoes = [] } = useInteracoes(lead?.id || null);
  const registrar = useRegistrarInteracao();
  const mover = useMoverOportunidade();
  const arquivar = useArquivarOportunidade();

  if (!lead) return null;
  const vend = vendedores.find(v => v.id === lead.vendedor_id);
  const idx = ETAPAS.indexOf(lead.status);
  const proxima = idx >= 0 && idx < 4 ? ETAPAS[idx + 1] : null;

  const submitInteracao = () => {
    if (!novaDescricao.trim()) return;
    registrar.mutate(
      { oportunidade_id: lead.id, tipo: novaTipo, descricao: novaDescricao },
      { onSuccess: () => setNovaDescricao("") }
    );
  };

  return (
    <Sheet open={!!lead} onOpenChange={v => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-[480px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{lead.empresa}</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><Label className="text-xs">Contato</Label><p>{lead.contato_nome || "—"}</p></div>
            <div><Label className="text-xs">Telefone</Label><p>{lead.telefone || "—"}</p></div>
            <div className="col-span-2"><Label className="text-xs">E-mail</Label><p>{lead.email || "—"}</p></div>
            <div><Label className="text-xs">Cidade</Label><p>{[lead.cidade, lead.estado].filter(Boolean).join("/") || "—"}</p></div>
            <div><Label className="text-xs">Vendedor</Label><p>{vend?.nome || "Direto"}</p></div>
            <div><Label className="text-xs">Valor estimado</Label><p>{fmtBRL(Number(lead.valor_estimado || 0))}</p></div>
            <div><Label className="text-xs">Score</Label><p>{lead.score}/100</p></div>
          </div>
          {lead.produtos_interesse && (
            <div>
              <Label className="text-xs">Produtos de interesse</Label>
              <p className="text-sm whitespace-pre-wrap">{lead.produtos_interesse}</p>
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            {proxima && (
              <Button size="sm" onClick={() => mover.mutate({ id: lead.id, status: proxima })}>
                <ArrowUp className="h-3 w-3 mr-1" />Avançar → {ETAPA_LABEL[proxima]}
              </Button>
            )}
            {lead.status !== "PERDIDO" && (
              <Button size="sm" variant="destructive" onClick={() => mover.mutate({ id: lead.id, status: "PERDIDO" })}>
                Marcar perdido
              </Button>
            )}
            <Button size="sm" variant="secondary" onClick={() => {
              navigate(`/vendas/pedido-vendedor/novo?lead_id=${lead.id}`);
            }}>
              Converter em pedido
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { arquivar.mutate(lead.id); onClose(); }}>
              <Archive className="h-3 w-3 mr-1" />Arquivar
            </Button>
          </div>

          <div className="border-t pt-4">
            <Label className="text-sm font-semibold">Registrar interação</Label>
            <div className="flex gap-2 mt-2">
              <Select value={novaTipo} onValueChange={setNovaTipo}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["LIGACAO","EMAIL","REUNIAO","WHATSAPP","VISITA","OUTRO"].map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input placeholder="Descrição..." value={novaDescricao} onChange={e => setNovaDescricao(e.target.value)} />
              <Button size="sm" onClick={submitInteracao} disabled={!novaDescricao.trim()}>+</Button>
            </div>
          </div>

          <div>
            <Label className="text-sm font-semibold">Histórico</Label>
            <div className="space-y-2 mt-2">
              {interacoes.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma interação registrada.</p>}
              {interacoes.map(i => (
                <div key={i.id} className="text-xs border-l-2 border-primary pl-2 py-1">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-[10px] h-4">{i.tipo}</Badge>
                    <span className="text-muted-foreground">{new Date(i.created_at).toLocaleString("pt-BR")}</span>
                  </div>
                  <p className="mt-1">{i.descricao}</p>
                  {i.criado_por && <p className="text-[10px] text-muted-foreground">por {i.criado_por}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ═══════════════════════ TAB 2: LEADS LIST ═══════════════════════
function LeadsTab() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Oportunidade | null>(null);
  const { data: leads = [] } = useOportunidades();
  const { data: vendedores = [] } = useVendedoresExternos();
  const arquivar = useArquivarOportunidade();

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />Novo lead
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Vendedor</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Produtos</TableHead>
                <TableHead className="text-right">Valor est.</TableHead>
                <TableHead className="w-32">Score</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.length === 0 && (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Nenhum lead cadastrado</TableCell></TableRow>
              )}
              {leads.map(l => {
                const v = vendedores.find(x => x.id === l.vendedor_id);
                const cor = l.score >= 70 ? "bg-success" : l.score >= 40 ? "bg-amber-500" : "bg-destructive";
                return (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.empresa}</TableCell>
                    <TableCell className="text-sm">{l.contato_nome || "—"}</TableCell>
                    <TableCell className="text-sm">{v?.nome || <span className="text-muted-foreground">Direto</span>}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{ORIGEM_LABEL[l.origem || ""] || "—"}</Badge></TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate">{l.produtos_interesse || "—"}</TableCell>
                    <TableCell className="text-right text-sm">{fmtBRL(Number(l.valor_estimado || 0))}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 bg-muted rounded-full overflow-hidden">
                          <div className={`h-full ${cor}`} style={{ width: `${l.score}%` }} />
                        </div>
                        <span className="text-xs">{l.score}</span>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="secondary" className="text-[10px]">{ETAPA_LABEL[l.status]}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditing(l); setDialogOpen(true); }}>
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => arquivar.mutate(l.id)}>
                        <Archive className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <LeadFormDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} vendedores={vendedores} />
    </div>
  );
}

function LeadFormDialog({ open, onOpenChange, editing, vendedores }: {
  open: boolean; onOpenChange: (v: boolean) => void; editing: Oportunidade | null; vendedores: VendedorExterno[];
}) {
  const criar = useCriarOportunidade();
  const atualizar = useAtualizarOportunidade();
  const { profile } = useAuth();

  const initialLeadForm = {
    empresa: "", contato_nome: "", telefone: "", email: "",
    cidade: "", estado: "", origem: "DIRETO", vendedor_id: null as string | null,
    produtos_interesse: "", valor_estimado: 0, score: 50, observacoes: "",
  };

  const [form, setForm, clearForm] = useFormPersist(
    editing ? `crm-lead-edit:${editing.id}` : `crm-lead-form:${profile?.company_id ?? "pending"}`,
    initialLeadForm,
  );

  useEffect(() => {
    if (!open) return;
    if (editing) setForm({ ...editing });
  }, [open, editing?.id]);

  const submit = () => {
    if (!form.empresa?.trim()) { toast.error("Empresa é obrigatória"); return; }
    if (form.origem === "VENDEDOR_EXTERNO" && !form.vendedor_id) {
      toast.error("Vendedor é obrigatório para origem VENDEDOR_EXTERNO");
      return;
    }
    const payload: any = {
      ...form,
      valor_estimado: Number(form.valor_estimado) || 0,
      score: Number(form.score) || 50,
      vendedor_id: form.vendedor_id || null,
    };
    if (editing) {
      atualizar.mutate({ id: editing.id, dados: payload }, { onSuccess: () => onOpenChange(false) });
    } else {
      criar.mutate(payload, {
        onSuccess: () => {
          clearForm(initialLeadForm);
          onOpenChange(false);
        },
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editing ? "Editar lead" : "Novo lead"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><Label>Empresa *</Label><Input value={form.empresa} onChange={e => setForm({ ...form, empresa: e.target.value })} /></div>
          <div><Label>Contato</Label><Input value={form.contato_nome || ""} onChange={e => setForm({ ...form, contato_nome: e.target.value })} /></div>
          <div><Label>Telefone</Label><Input value={form.telefone || ""} onChange={e => setForm({ ...form, telefone: e.target.value })} /></div>
          <div className="col-span-2"><Label>E-mail</Label><Input value={form.email || ""} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
          <div><Label>Cidade</Label><Input value={form.cidade || ""} onChange={e => setForm({ ...form, cidade: e.target.value })} /></div>
          <div><Label>UF</Label>
            <Select value={form.estado || ""} onValueChange={v => setForm({ ...form, estado: v })}>
              <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
              <SelectContent>{UFS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Origem</Label>
            <Select value={form.origem} onValueChange={v => setForm({ ...form, origem: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ORIGENS.map(o => <SelectItem key={o} value={o}>{ORIGEM_LABEL[o]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Vendedor{form.origem === "VENDEDOR_EXTERNO" ? " *" : ""}</Label>
            <Select value={form.vendedor_id || "__none__"} onValueChange={v => setForm({ ...form, vendedor_id: v === "__none__" ? null : v })}>
              <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Nenhum</SelectItem>
                {vendedores.map(v => <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2"><Label>Produtos de interesse</Label>
            <Textarea rows={2} value={form.produtos_interesse || ""} onChange={e => setForm({ ...form, produtos_interesse: e.target.value })} />
          </div>
          <div><Label>Valor estimado (R$)</Label><Input type="number" value={form.valor_estimado || 0} onChange={e => setForm({ ...form, valor_estimado: e.target.value })} /></div>
          <div><Label>Score: {form.score}</Label>
            <Slider value={[form.score || 50]} min={0} max={100} step={1} onValueChange={v => setForm({ ...form, score: v[0] })} className="mt-3" />
          </div>
          <div className="col-span-2"><Label>Observações</Label>
            <Textarea rows={2} value={form.observacoes || ""} onChange={e => setForm({ ...form, observacoes: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit}>{editing ? "Salvar" : "Criar lead"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════ TAB 3: VENDEDORES ═══════════════════════
function VendedoresTab() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tabelaVendedor, setTabelaVendedor] = useState<VendedorExterno | null>(null);
  const { data: vendedores = [] } = useVendedoresExternos();
  const { data: pedidos = [] } = usePedidosVendedor();
  const atualizar = useAtualizarVendedor();

  return (
    <div className="space-y-4">
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-4">
          <p className="text-sm">
            <strong>Vendedores externos</strong> comercializam produtos de marca própria da fábrica.
            Cada vendedor tem território, tabela de preço mínimo e comissão próprios. Pedidos fechados geram automaticamente
            ordens de produção para o saldo não disponível em estoque.
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-2" />Cadastrar vendedor</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {vendedores.map(v => {
          const peds = pedidos.filter(p => p.vendedor_id === v.id && p.status !== "CANCELADO" && p.created_at >= inicioMes());
          const vendido = peds.reduce((s, p) => s + Number(p.valor_total || 0), 0);
          const comissao = peds.reduce((s, p) => s + Number(p.valor_comissao || 0), 0);
          const clientes = new Set(peds.map(p => p.cliente_id).filter(Boolean)).size;
          const meta = Number(v.meta_mensal || 0);
          const metaPerc = meta > 0 ? Math.min(100, (vendido / meta) * 100) : 0;
          const statusVend = !v.ativo ? "Inativo" : metaPerc < 60 ? "Meta em risco" : "Ativo";
          const statusCor = !v.ativo ? "bg-muted text-muted-foreground"
            : metaPerc < 60 ? "bg-amber-500/20 text-amber-700"
            : "bg-success/20 text-success";

          return (
            <Card key={v.id}>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-start gap-3">
                  <Avatar className="h-10 w-10"><AvatarFallback>{iniciais(v.nome)}</AvatarFallback></Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{v.nome}</p>
                    <p className="text-[10px] text-muted-foreground">Vendedor externo</p>
                    {v.territorio && <p className="text-xs flex items-center gap-1 mt-1"><MapPin className="h-3 w-3" />{v.territorio}</p>}
                  </div>
                  <Badge className={`text-[10px] ${statusCor}`}>{statusVend}</Badge>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center border-t border-b py-2">
                  <div><div className="text-xs font-bold">{fmtBRL(vendido)}</div><div className="text-[10px] text-muted-foreground">Mês</div></div>
                  <div><div className="text-xs font-bold">{clientes}</div><div className="text-[10px] text-muted-foreground">Clientes</div></div>
                  <div><div className="text-xs font-bold">{fmtBRL(comissao)}</div><div className="text-[10px] text-muted-foreground">Comissão</div></div>
                </div>

                {meta > 0 && (
                  <div>
                    <div className="flex justify-between text-[10px] text-muted-foreground"><span>Meta</span><span>{metaPerc.toFixed(0)}%</span></div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full ${metaPerc >= 100 ? "bg-success" : metaPerc >= 60 ? "bg-primary" : "bg-amber-500"}`} style={{ width: `${metaPerc}%` }} />
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-1">
                  {v.territorio && <Badge variant="outline" className="text-[9px]">{v.territorio}</Badge>}
                  <Badge variant="outline" className="text-[9px]">Comissão {v.comissao_percent}%</Badge>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Switch checked={v.ativo} onCheckedChange={c => atualizar.mutate({ id: v.id, dados: { ativo: c } })} />
                    <span className="text-xs">{v.ativo ? "Ativo" : "Inativo"}</span>
                  </div>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setTabelaVendedor(v)}>Tabela preços</Button>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {/* Card adicionar */}
        <Card className="border-dashed flex items-center justify-center min-h-[200px] cursor-pointer hover:bg-muted/50" onClick={() => setDialogOpen(true)}>
          <div className="text-center text-muted-foreground">
            <Plus className="h-8 w-8 mx-auto mb-2" />
            <p className="text-sm">Adicionar vendedor</p>
          </div>
        </Card>
      </div>

      <VendedorFormDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      <VendedorTabelaPrecosDialog vendedor={tabelaVendedor} onClose={() => setTabelaVendedor(null)} />
    </div>
  );
}

function VendedorFormDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const criar = useCriarVendedor();
  const [form, setForm] = useState<any>({
    nome: "", cpf: "", telefone: "", email: "", territorio: "",
    comissao_percent: 7.5, meta_mensal: 0, desconto_maximo_percent: 10, ativo: true,
  });

  const submit = () => {
    if (!form.nome?.trim()) { toast.error("Nome é obrigatório"); return; }
    criar.mutate({
      ...form,
      comissao_percent: Number(form.comissao_percent) || 0,
      meta_mensal: Number(form.meta_mensal) || 0,
      desconto_maximo_percent: Number(form.desconto_maximo_percent) || 0,
    }, { onSuccess: () => { onOpenChange(false); setForm({ nome: "", cpf: "", telefone: "", email: "", territorio: "", comissao_percent: 7.5, meta_mensal: 0, desconto_maximo_percent: 10, ativo: true }); } });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Cadastrar vendedor externo</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><Label>Nome *</Label><Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} /></div>
          <div><Label>CPF</Label><Input value={form.cpf} onChange={e => setForm({ ...form, cpf: e.target.value })} /></div>
          <div><Label>Telefone</Label><Input value={form.telefone} onChange={e => setForm({ ...form, telefone: e.target.value })} /></div>
          <div className="col-span-2"><Label>E-mail</Label><Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
          <div className="col-span-2"><Label>Território</Label><Input placeholder="SP/SC/PR" value={form.territorio} onChange={e => setForm({ ...form, territorio: e.target.value })} /></div>
          <div><Label>Comissão (%)</Label><Input type="number" step="0.1" value={form.comissao_percent} onChange={e => setForm({ ...form, comissao_percent: e.target.value })} /></div>
          <div><Label>Meta mensal (R$)</Label><Input type="number" value={form.meta_mensal} onChange={e => setForm({ ...form, meta_mensal: e.target.value })} /></div>
          <div><Label>Desconto máx. (%)</Label><Input type="number" step="0.1" value={form.desconto_maximo_percent} onChange={e => setForm({ ...form, desconto_maximo_percent: e.target.value })} /></div>
          <div className="flex items-center gap-2 pt-6"><Switch checked={form.ativo} onCheckedChange={v => setForm({ ...form, ativo: v })} /><Label>Ativo</Label></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit}>Cadastrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VendedorTabelaPrecosDialog({ vendedor, onClose }: { vendedor: VendedorExterno | null; onClose: () => void }) {
  const { data: precos = [] } = useTabelaPrecos(vendedor?.id || null);
  const { data: itens = [] } = useItens();
  const criar = useCriarTabelaPreco();
  const remover = useRemoverTabelaPreco();
  const [novo, setNovo] = useState({ item_id: "", preco_minimo: 0, preco_sugerido: 0, quantidade_minima: 1 });

  if (!vendedor) return null;

  const adicionar = () => {
    if (!novo.item_id) { toast.error("Selecione um produto"); return; }
    criar.mutate({
      vendedor_id: vendedor.id,
      item_id: novo.item_id,
      preco_minimo: Number(novo.preco_minimo) || 0,
      preco_sugerido: Number(novo.preco_sugerido) || 0,
      quantidade_minima: Number(novo.quantidade_minima) || 1,
    }, { onSuccess: () => setNovo({ item_id: "", preco_minimo: 0, preco_sugerido: 0, quantidade_minima: 1 }) });
  };

  return (
    <Dialog open={!!vendedor} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Tabela de preços — {vendedor.nome}</DialogTitle></DialogHeader>

        <div className="border rounded-md p-3 bg-muted/30 space-y-2">
          <Label className="text-sm font-semibold">Adicionar produto</Label>
          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-5">
              <Select value={novo.item_id} onValueChange={v => setNovo({ ...novo, item_id: v })}>
                <SelectTrigger><SelectValue placeholder="Produto" /></SelectTrigger>
                <SelectContent>
                  {itens.slice(0, 200).map((i: any) => <SelectItem key={i.id} value={i.id}>{i.descricao_interna}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Input className="col-span-2" type="number" placeholder="Preço mín" value={novo.preco_minimo} onChange={e => setNovo({ ...novo, preco_minimo: Number(e.target.value) })} />
            <Input className="col-span-2" type="number" placeholder="Preço sug" value={novo.preco_sugerido} onChange={e => setNovo({ ...novo, preco_sugerido: Number(e.target.value) })} />
            <Input className="col-span-2" type="number" placeholder="Qtd mín" value={novo.quantidade_minima} onChange={e => setNovo({ ...novo, quantidade_minima: Number(e.target.value) })} />
            <Button className="col-span-1" onClick={adicionar}><Plus className="h-4 w-4" /></Button>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produto</TableHead>
              <TableHead className="text-right">Preço mín</TableHead>
              <TableHead className="text-right">Preço sug</TableHead>
              <TableHead className="text-right">Qtd mín</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {precos.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Nenhum produto cadastrado</TableCell></TableRow>}
            {precos.map((p: any) => (
              <TableRow key={p.id}>
                <TableCell>{p.itens?.descricao_interna || "—"}</TableCell>
                <TableCell className="text-right">{fmtBRL(Number(p.preco_minimo))}</TableCell>
                <TableCell className="text-right">{fmtBRL(Number(p.preco_sugerido))}</TableCell>
                <TableCell className="text-right">{p.quantidade_minima}</TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => remover.mutate(p.id)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════ TAB 4: COMISSÕES ═══════════════════════
function ComissoesTab() {
  const [periodo, setPeriodo] = useState("mes_atual");
  const [vendedorFiltro, setVendedorFiltro] = useState("__all__");
  const [expandido, setExpandido] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState<{ vendedorId: string; nome: string } | null>(null);

  const intervalo = useMemo(() => {
    const fim = new Date();
    let inicio = new Date();
    if (periodo === "mes_atual") { inicio.setDate(1); inicio.setHours(0, 0, 0, 0); }
    else if (periodo === "mes_anterior") {
      inicio = new Date(fim.getFullYear(), fim.getMonth() - 1, 1);
      const fimMA = new Date(fim.getFullYear(), fim.getMonth(), 0, 23, 59, 59);
      return { inicio: inicio.toISOString(), fim: fimMA.toISOString() };
    } else if (periodo === "trimestre") {
      inicio = new Date(fim.getFullYear(), fim.getMonth() - 3, 1);
    }
    return { inicio: inicio.toISOString(), fim: fim.toISOString() };
  }, [periodo]);

  const { data: pedidos = [] } = usePedidosVendedor({
    vendedor_id: vendedorFiltro === "__all__" ? null : vendedorFiltro,
    inicio: intervalo.inicio, fim: intervalo.fim,
  });
  const { data: vendedores = [] } = useVendedoresExternos();
  const marcarPaga = useMarcarComissaoPaga();

  const totalAPagar = pedidos.filter(p => p.status === "ENTREGUE" && !p.comissao_paga).reduce((s, p) => s + Number(p.valor_comissao || 0), 0);
  const totalPago = pedidos.filter(p => p.comissao_paga).reduce((s, p) => s + Number(p.valor_comissao || 0), 0);
  const entregues = pedidos.filter(p => p.status === "ENTREGUE");
  const ticketMedio = entregues.length ? entregues.reduce((s, p) => s + Number(p.valor_total || 0), 0) / entregues.length : 0;

  // Best seller
  const porVendedor = new Map<string, { vendedor: VendedorExterno; pedidos: typeof pedidos; total: number; comissao: number }>();
  pedidos.forEach(p => {
    if (!p.vendedor_id) return;
    const v = vendedores.find(x => x.id === p.vendedor_id);
    if (!v) return;
    const cur = porVendedor.get(v.id) || { vendedor: v, pedidos: [], total: 0, comissao: 0 };
    cur.pedidos.push(p);
    if (p.status === "ENTREGUE") {
      cur.total += Number(p.valor_total || 0);
      cur.comissao += Number(p.valor_comissao || 0);
    }
    porVendedor.set(v.id, cur);
  });
  const ranking = [...porVendedor.values()].sort((a, b) => b.total - a.total);
  const melhor = ranking[0]?.vendedor.nome || "—";

  const exportarCSV = () => {
    const linhas = ["Vendedor;CPF;Territorio;Pedidos;Valor Total;% Comissao;Valor Comissao;Data Pagamento;Status"];
    ranking.forEach(r => {
      const pago = r.pedidos.find(p => p.comissao_paga)?.data_pagamento_comissao || "";
      const statusPag = r.pedidos.every(p => p.comissao_paga || p.status !== "ENTREGUE") ? "PAGO" : "PENDENTE";
      linhas.push([
        r.vendedor.nome, r.vendedor.cpf || "", r.vendedor.territorio || "",
        r.pedidos.filter(p => p.status === "ENTREGUE").length,
        r.total.toFixed(2).replace(".", ","), r.vendedor.comissao_percent,
        r.comissao.toFixed(2).replace(".", ","), pago, statusPag,
      ].join(";"));
    });
    const csv = "\uFEFF" + linhas.join("\n");
    const d = new Date();
    const nome = `comissoes_${String(d.getMonth() + 1).padStart(2, "0")}_${d.getFullYear()}.csv`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = nome;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={periodo} onValueChange={setPeriodo}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="mes_atual">Mês atual</SelectItem>
            <SelectItem value="mes_anterior">Mês anterior</SelectItem>
            <SelectItem value="trimestre">Último trimestre</SelectItem>
          </SelectContent>
        </Select>
        <Select value={vendedorFiltro} onValueChange={setVendedorFiltro}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos vendedores</SelectItem>
            {vendedores.map(v => <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" className="ml-auto" onClick={exportarCSV}>
          <Download className="h-4 w-4 mr-2" />Exportar CSV
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="pt-4"><div className="text-xl font-bold text-amber-600">{fmtBRL(totalAPagar)}</div><p className="text-xs text-muted-foreground">A pagar</p></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xl font-bold text-success">{fmtBRL(totalPago)}</div><p className="text-xs text-muted-foreground">Pago no período</p></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xl font-bold">{fmtBRL(ticketMedio)}</div><p className="text-xs text-muted-foreground">Ticket médio</p></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-sm font-bold truncate"><Users className="h-3 w-3 inline mr-1" />{melhor}</div><p className="text-xs text-muted-foreground">Melhor vendedor</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Vendedor</TableHead>
                <TableHead>Território</TableHead>
                <TableHead className="text-right">Pedidos</TableHead>
                <TableHead className="text-right">Valor vendido</TableHead>
                <TableHead className="text-right">% Comissão</TableHead>
                <TableHead className="text-right">Comissão bruta</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ranking.length === 0 && (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Sem pedidos no período</TableCell></TableRow>
              )}
              {ranking.map(r => {
                const aPagar = r.pedidos.filter(p => p.status === "ENTREGUE" && !p.comissao_paga);
                const status = aPagar.length === 0 ? "PAGO" : "PENDENTE";
                const isOpen = expandido === r.vendedor.id;
                return (
                  <Fragment key={r.vendedor.id}>
                    <TableRow key={r.vendedor.id} className="cursor-pointer" onClick={() => setExpandido(isOpen ? null : r.vendedor.id)}>
                      <TableCell>{isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</TableCell>
                      <TableCell className="font-medium">{r.vendedor.nome}</TableCell>
                      <TableCell className="text-sm">{r.vendedor.territorio || "—"}</TableCell>
                      <TableCell className="text-right">{r.pedidos.filter(p => p.status === "ENTREGUE").length}</TableCell>
                      <TableCell className="text-right">{fmtBRL(r.total)}</TableCell>
                      <TableCell className="text-right">{r.vendedor.comissao_percent}%</TableCell>
                      <TableCell className="text-right font-semibold">{fmtBRL(r.comissao)}</TableCell>
                      <TableCell>
                        <Badge className={status === "PAGO" ? "bg-success/20 text-success" : "bg-amber-500/20 text-amber-700"}>{status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {aPagar.length > 0 && (
                          <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); setConfirmar({ vendedorId: r.vendedor.id, nome: r.vendedor.nome }); }}>
                            Marcar pago
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                    {isOpen && (
                      <TableRow>
                        <TableCell colSpan={9} className="bg-muted/30 p-0">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Data</TableHead>
                                <TableHead>Nº pedido</TableHead>
                                <TableHead>Cliente</TableHead>
                                <TableHead className="text-right">Valor</TableHead>
                                <TableHead className="text-right">Comissão</TableHead>
                                <TableHead>Pagamento</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {r.pedidos.map(p => (
                                <TableRow key={p.id}>
                                  <TableCell className="text-xs">{new Date(p.created_at).toLocaleDateString("pt-BR")}</TableCell>
                                  <TableCell className="text-xs">{p.numero || "—"}</TableCell>
                                  <TableCell className="text-xs">{p.cliente_nome || "—"}</TableCell>
                                  <TableCell className="text-right text-xs">{fmtBRL(Number(p.valor_total))}</TableCell>
                                  <TableCell className="text-right text-xs">{fmtBRL(Number(p.valor_comissao))}</TableCell>
                                  <TableCell><Badge variant="outline" className="text-[10px]">{p.comissao_paga ? "PAGO" : p.status}</Badge></TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!confirmar}
        onOpenChange={v => !v && setConfirmar(null)}
        title="Confirmar pagamento"
        description={`Marcar todas as comissões pendentes de ${confirmar?.nome || ""} como pagas?`}
        onConfirm={() => { if (confirmar) marcarPaga.mutate(confirmar.vendedorId); setConfirmar(null); }}
      />
    </div>
  );
}
