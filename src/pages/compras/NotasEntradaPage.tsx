import { FileText } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";

export default function NotasEntradaPage() {
  return (
    <div>
      <PageHeader
        title="Notas de Entrada"
        description="Historico de notas fiscais importadas"
        icon={FileText}
      />

      <Card>
        <CardContent className="p-12 text-center">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Nenhuma Nota Importada</h3>
          <p className="text-muted-foreground">
            Importe notas fiscais XML na secao "Importar NF-e" para visualiza-las aqui.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
