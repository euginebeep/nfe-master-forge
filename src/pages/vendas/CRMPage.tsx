import { useState } from "react";
import { MessageSquare, Plus, Search, Phone, Mail, User, ArrowRight } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface LeadCRM {
  entidade_id: string;
  etapa_funil: string;
  origem_lead: string;
  score: number;
  canal_preferido: string;
  observacoes_comerciais: string | null;
  desconto_maximo_percent: number;
  comissao_padrao_percent: number;
  // joined
  razao_social?: string;
  nome_fantasia?: string;
  documento?: string;
  telefone?: string;
  email?: string;
}

const ETAPAS = ["LEAD", "CONTATO", "PROPOSTA", "NEGOCIACAO", "FECHADO", "PERDIDO"];

export default function CRMPage() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: leads, isLoading } = useQuery({
    queryKey: ["crm-leads"],
    queryFn: async () => {
      const { data: crmData, error } = await supabase
        .from("entidade_comercial_crm")
        .select("*")
        .order("score", { ascending: false });
      if (error) throw error;

      // Enrich with entidade data
      const entidadeIds = (crmData || []).map(c => c.entidade_id);
      if (entidadeIds.length === 0) return [];

      const { data: entidades } = await supabase
        .from("entidades")
        .select("id, razao_social, nome_fantasia, documento")
        .in("id", entidadeIds);

      const { data: contatos } = await supabase
        .from("entidade_contatos")
        .select("entidade_id, telefone, email, preferencial")
        .in("entidade_id", entidadeIds)
        .eq("preferencial", true);

      return (crmData || []).map(crm => {
        const ent = entidades?.find(e => e.id === crm.entidade_id);
        const contato = contatos?.find(c => c.entidade_id === crm.entidade_id);
        return {
          ...crm,
          razao_social: ent?.razao_social,
          nome_fantasia: ent?.nome_fantasia,
          documento: ent?.documento,
          telefone: contato?.telefone,
          email: contato?.email,
        } as LeadCRM;
      });
    },
  });

  const moverEtapa = useMutation({
    mutationFn: async ({ entidadeId, novaEtapa }: { entidadeId: string; novaEtapa: string }) => {
      const { error } = await supabase
        .from("entidade_comercial_crm")
        .update({ etapa_funil: novaEtapa, updated_at: new Date().toISOString() })
        .eq("entidade_id", entidadeId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-leads"] });
      toast.success("Lead atualizado");
    },
  });

  const pipeline: Record<string, LeadCRM[]> = {};
  ETAPAS.forEach(e => { pipeline[e] = []; });
  (leads || []).forEach(l => {
    const etapa = l.etapa_funil || "LEAD";
    if (!pipeline[etapa]) pipeline[etapa] = [];
    pipeline[etapa].push(l);
  });

  const filteredPipeline: Record<string, LeadCRM[]> = {};
  Object.entries(pipeline).forEach(([etapa, items]) => {
    filteredPipeline[etapa] = items.filter(l =>
      !search || l.razao_social?.toLowerCase().includes(search.toLowerCase()) ||
      l.nome_fantasia?.toLowerCase().includes(search.toLowerCase())
    );
  });

  const etapaLabel: Record<string, string> = {
    LEAD: "Lead", CONTATO: "Contato", PROPOSTA: "Proposta",
    NEGOCIACAO: "Negociação", FECHADO: "Fechado", PERDIDO: "Perdido",
  };

  const totalLeads = leads?.length || 0;
  const leadsAtivos = leads?.filter(l => l.etapa_funil !== "FECHADO" && l.etapa_funil !== "PERDIDO").length || 0;

  return (
    <div>
      <PageHeader
        title="CRM"
        description="Pipeline de vendas integrado ao cadastro de entidades"
        icon={MessageSquare}
      />

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card><CardContent className="pt-4"><div className="text-2xl font-bold">{totalLeads}</div><p className="text-xs text-muted-foreground">Total Leads</p></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-2xl font-bold text-primary">{leadsAtivos}</div><p className="text-xs text-muted-foreground">Ativos no Pipeline</p></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-2xl font-bold text-success">{pipeline.FECHADO?.length || 0}</div><p className="text-xs text-muted-foreground">Fechados</p></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-2xl font-bold text-destructive">{pipeline.PERDIDO?.length || 0}</div><p className="text-xs text-muted-foreground">Perdidos</p></CardContent></Card>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar lead..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando pipeline...</div>
      ) : totalLeads === 0 ? (
        <Card><CardContent className="py-12 text-center">
          <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="font-medium mb-2">Pipeline vazio</p>
          <p className="text-sm text-muted-foreground">Vá em Cadastros → Entidades e configure o CRM de um cliente para vê-lo aqui.</p>
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {ETAPAS.map(etapa => (
            <div key={etapa} className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h3 className="font-semibold text-sm">{etapaLabel[etapa]}</h3>
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{filteredPipeline[etapa]?.length || 0}</span>
              </div>
              <div className="space-y-2 min-h-[100px]">
                {(filteredPipeline[etapa] || []).map(lead => (
                  <Card key={lead.entidade_id} className="cursor-pointer hover:shadow-md transition-shadow">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                            {(lead.razao_social || "?").slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-xs truncate">{lead.nome_fantasia || lead.razao_social}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{lead.razao_social}</p>
                        </div>
                      </div>
                      {lead.telefone && <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Phone className="h-2.5 w-2.5" />{lead.telefone}</p>}
                      {lead.email && <p className="text-[10px] text-muted-foreground flex items-center gap-1 truncate"><Mail className="h-2.5 w-2.5" />{lead.email}</p>}
                      <div className="flex items-center justify-between mt-2 pt-2 border-t">
                        <span className="text-xs font-medium">Score: {lead.score || 0}</span>
                        {etapa !== "FECHADO" && etapa !== "PERDIDO" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-xs"
                            onClick={e => {
                              e.stopPropagation();
                              const idx = ETAPAS.indexOf(etapa);
                              if (idx < ETAPAS.length - 2) {
                                moverEtapa.mutate({ entidadeId: lead.entidade_id, novaEtapa: ETAPAS[idx + 1] });
                              }
                            }}
                          >
                            <ArrowRight className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
