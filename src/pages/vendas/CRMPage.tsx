import { useState } from "react";
import { MessageSquare, Plus, Search, Phone, Mail, User } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function CRMPage() {
  const [search, setSearch] = useState("");

  // Placeholder data - leads/oportunidades
  const leads = [
    { id: "1", nome: "Joao Silva", empresa: "Farmacia Central", email: "joao@email.com", telefone: "+55 11 99999-1111", status: "NOVO", valor: 15000 },
    { id: "2", nome: "Maria Santos", empresa: "Loja Natural Life", email: "maria@email.com", telefone: "+55 11 99999-2222", status: "CONTATO", valor: 8500 },
    { id: "3", nome: "Pedro Costa", empresa: "Drogaria Saude", email: "pedro@email.com", telefone: "+55 11 99999-3333", status: "PROPOSTA", valor: 32000 },
    { id: "4", nome: "Ana Lima", empresa: "Academia Fitness", email: "ana@email.com", telefone: "+55 11 99999-4444", status: "FECHADO", valor: 12000 },
  ];

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "NOVO": return "info";
      case "CONTATO": return "warning";
      case "PROPOSTA": return "default";
      case "FECHADO": return "success";
      default: return "muted";
    }
  };

  const pipeline = {
    novo: leads.filter(l => l.status === "NOVO"),
    contato: leads.filter(l => l.status === "CONTATO"),
    proposta: leads.filter(l => l.status === "PROPOSTA"),
    fechado: leads.filter(l => l.status === "FECHADO"),
  };

  return (
    <div>
      <PageHeader
        title="CRM"
        description="Gestao de leads e oportunidades de venda"
        icon={MessageSquare}
        actions={
          <Button className="bg-secondary hover:bg-secondary/90">
            <Plus className="h-4 w-4 mr-2" />
            Novo Lead
          </Button>
        }
      />

      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar lead..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Kanban-style pipeline */}
      <div className="grid grid-cols-4 gap-4">
        {Object.entries(pipeline).map(([stage, stageLeads]) => (
          <div key={stage} className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold capitalize">{stage}</h3>
              <span className="text-sm text-muted-foreground">{stageLeads.length}</span>
            </div>
            <div className="space-y-3">
              {stageLeads.map((lead) => (
                <Card key={lead.id} className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                          {lead.nome.split(" ").map(n => n[0]).join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-sm">{lead.nome}</p>
                        <p className="text-xs text-muted-foreground">{lead.empresa}</p>
                      </div>
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Mail className="h-3 w-3" />
                        {lead.email}
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="h-3 w-3" />
                        {lead.telefone}
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t flex items-center justify-between">
                      <span className="text-sm font-semibold text-secondary">
                        R$ {lead.valor.toLocaleString("pt-BR")}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
