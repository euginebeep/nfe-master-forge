import { useState } from "react";
import { Factory, Plus, Search, Filter, Play, Pause, Check } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { Progress } from "@/components/ui/progress";

export default function OrdensProducaoPage() {
  const [search, setSearch] = useState("");

  // Placeholder data
  const ordens = [
    { id: "OP-2024-001", produto: "Vitamina D3 2000UI", quantidade: 1000, status: "EM_PRODUCAO", progresso: 65, data: "2024-01-15" },
    { id: "OP-2024-002", produto: "Multivitaminico Premium", quantidade: 500, status: "AGUARDANDO", progresso: 0, data: "2024-01-16" },
    { id: "OP-2024-003", produto: "Omega 3 EPA DHA", quantidade: 2000, status: "FINALIZADA", progresso: 100, data: "2024-01-14" },
  ];

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "EM_PRODUCAO": return "info";
      case "AGUARDANDO": return "warning";
      case "FINALIZADA": return "success";
      default: return "muted";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "EM_PRODUCAO": return "Em Producao";
      case "AGUARDANDO": return "Aguardando";
      case "FINALIZADA": return "Finalizada";
      default: return status;
    }
  };

  return (
    <div>
      <PageHeader
        title="Ordens de Producao"
        description="Gestao e acompanhamento de OPs"
        icon={Factory}
        actions={
          <Button className="bg-secondary hover:bg-secondary/90">
            <Plus className="h-4 w-4 mr-2" />
            Nova OP
          </Button>
        }
      />

      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar ordem de producao..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="outline" size="icon">
          <Filter className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-4">
        {ordens.map((op) => (
          <Card key={op.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div>
                    <p className="font-mono font-bold text-lg">{op.id}</p>
                    <p className="text-muted-foreground">{op.produto}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <StatusBadge variant={getStatusVariant(op.status) as any}>
                    {getStatusLabel(op.status)}
                  </StatusBadge>
                  <div className="flex gap-2">
                    {op.status === "AGUARDANDO" && (
                      <Button size="sm" variant="outline">
                        <Play className="h-4 w-4 mr-1" />
                        Iniciar
                      </Button>
                    )}
                    {op.status === "EM_PRODUCAO" && (
                      <>
                        <Button size="sm" variant="outline">
                          <Pause className="h-4 w-4 mr-1" />
                          Pausar
                        </Button>
                        <Button size="sm" className="bg-secondary hover:bg-secondary/90">
                          <Check className="h-4 w-4 mr-1" />
                          Finalizar
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-4 mb-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Quantidade</p>
                  <p className="font-semibold">{op.quantidade.toLocaleString()} un</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Data</p>
                  <p className="font-semibold">{op.data}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground uppercase mb-2">Progresso</p>
                  <div className="flex items-center gap-3">
                    <Progress value={op.progresso} className="flex-1" />
                    <span className="text-sm font-medium">{op.progresso}%</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
