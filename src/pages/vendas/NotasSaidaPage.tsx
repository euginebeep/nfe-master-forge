import { FileOutput, Clock } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function NotasSaidaPage() {
  return (
    <div>
      <PageHeader
        title="Notas de Saída"
        description="Emissão e consulta de NF-e de saída"
        icon={FileOutput}
      />

      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <Clock className="h-6 w-6 text-muted-foreground" />
            </div>
            <CardTitle>Em Desenvolvimento</CardTitle>
            <CardDescription>
              O módulo de Notas de Saída está sendo desenvolvido e estará disponível em breve.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center text-sm text-muted-foreground">
            <p>Funcionalidades planejadas:</p>
            <ul className="mt-2 space-y-1">
              <li>• Emissão de NF-e de venda</li>
              <li>• Consulta e cancelamento</li>
              <li>• Carta de correção</li>
              <li>• Impressão DANFE</li>
              <li>• Integração com SEFAZ</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
