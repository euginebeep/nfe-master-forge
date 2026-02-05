import { useState } from "react";
import { FlaskConical, Plus, Search, Filter } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";

export default function FormulasListPage() {
  const [search, setSearch] = useState("");

  // Placeholder data - will be connected to LocalDb
  const formulas = [
    { id: "1", nome: "Vitamina D3 2000UI", tipo_capsula: "00", capacidade: "500mg", ativos: 3, status: "ATIVO" },
    { id: "2", nome: "Multivitaminico Premium", tipo_capsula: "0", capacidade: "600mg", ativos: 12, status: "ATIVO" },
    { id: "3", nome: "Omega 3 EPA DHA", tipo_capsula: "Softgel", capacidade: "1000mg", ativos: 2, status: "REVISAO" },
  ];

  return (
    <div>
      <PageHeader
        title="Formulador ANVISA"
        description="Gestao de formulas e fichas tecnicas de suplementos"
        icon={FlaskConical}
        actions={
          <Button className="bg-secondary hover:bg-secondary/90">
            <Plus className="h-4 w-4 mr-2" />
            Nova Formula
          </Button>
        }
      />

      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar formula..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="outline" size="icon">
          <Filter className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {formulas.map((formula) => (
          <Card key={formula.id} className="cursor-pointer hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">{formula.nome}</CardTitle>
                <StatusBadge variant={formula.status === "ATIVO" ? "success" : "warning"}>
                  {formula.status}
                </StatusBadge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs uppercase">Capsula</p>
                  <p className="font-medium">{formula.tipo_capsula}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase">Capacidade</p>
                  <p className="font-medium">{formula.capacidade}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase">Ativos</p>
                  <p className="font-medium">{formula.ativos}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {formulas.length === 0 && (
        <div className="text-center py-12">
          <FlaskConical className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">Nenhuma formula cadastrada</h3>
          <p className="text-muted-foreground">Clique em "Nova Formula" para comecar</p>
        </div>
      )}
    </div>
  );
}
