import { Store } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function MarketplacePage() {
  return (
    <div>
      <PageHeader
        title="Marketplace"
        description="Integracoes com marketplaces e e-commerce"
        icon={Store}
      />

      <div className="grid grid-cols-3 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="text-lg">Mercado Livre</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm mb-4">Integracao nao configurada</p>
            <button className="text-sm text-secondary font-medium">Configurar</button>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="text-lg">Amazon</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm mb-4">Integracao nao configurada</p>
            <button className="text-sm text-secondary font-medium">Configurar</button>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="text-lg">Shopee</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm mb-4">Integracao nao configurada</p>
            <button className="text-sm text-secondary font-medium">Configurar</button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
