import { ClipboardList } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";

export default function MovimentacoesPage() {
  return (
    <div>
      <PageHeader
        title="Movimentacoes de Estoque"
        description="Historico de entradas, saidas e transferencias"
        icon={ClipboardList}
      />

      <Card>
        <CardContent className="p-12 text-center">
          <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Modulo em Desenvolvimento</h3>
          <p className="text-muted-foreground">
            O historico de movimentacoes sera exibido aqui, incluindo entradas por NF-e, 
            consumo em OPs e ajustes de inventario.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
