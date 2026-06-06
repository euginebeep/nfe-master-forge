import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { AnvisaCheckerForm } from "@/components/regulatorio/AnvisaCheckerForm";
import { FlaskConical, FileText, LayoutList, Database } from "lucide-react";

export default function AnvisaCheckerPage() {
  const [activeTab, setActiveTab] = useState("formula");

  return (
    <div className="container mx-auto py-6 space-y-6 animate-in fade-in duration-500">
      <PageHeader 
        title="ANVISA Checker" 
        description="Verificação regulatória automática de fórmulas e rotulagem"
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-8">
          <TabsTrigger value="formula" className="flex items-center gap-2">
            <FlaskConical className="w-4 h-4" />
            <span className="hidden sm:inline">Checador de Fórmula</span>
          </TabsTrigger>
          <TabsTrigger value="tabela" className="flex items-center gap-2">
            <LayoutList className="w-4 h-4" />
            <span className="hidden sm:inline">Tabela Nutricional</span>
          </TabsTrigger>
          <TabsTrigger value="laudos" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">Laudos Gerados</span>
          </TabsTrigger>
          <TabsTrigger value="base" className="flex items-center gap-2">
            <Database className="w-4 h-4" />
            <span className="hidden sm:inline">Base ANVISA</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="formula">
          <AnvisaCheckerForm />
        </TabsContent>

        <TabsContent value="tabela">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <LayoutList className="w-12 h-12 mb-4 opacity-20" />
                <p>Módulo de Tabela Nutricional em desenvolvimento.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="laudos">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <FileText className="w-12 h-12 mb-4 opacity-20" />
                <p>Nenhum laudo gerado recentemente.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="base">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Database className="w-12 h-12 mb-4 opacity-20" />
                <p>Consulta direta à Base ANVISA.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
