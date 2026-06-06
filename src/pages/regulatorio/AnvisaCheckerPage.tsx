import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnvisaCheckerForm } from "@/components/regulatorio/AnvisaCheckerForm";
import { TabelaNutricionalBuilder } from "@/components/regulatorio/TabelaNutricionalBuilder";
import { AnvisaLaudosHistorico } from "@/components/regulatorio/AnvisaLaudosHistorico";
import { AnvisaBaseConstituintes } from "@/components/regulatorio/AnvisaBaseConstituintes";
import { AnvisaLaudoView } from "@/components/regulatorio/AnvisaLaudoView";
import { FlaskConical, FileText, LayoutList, Database } from "lucide-react";

export default function AnvisaCheckerPage() {
  const [activeTab, setActiveTab] = useState("formula");
  const [selectedLaudo, setSelectedLaudo] = useState<any>(null);

  const handleLaudoGenerated = (laudo: any) => {
    setSelectedLaudo(laudo);
  };

  const handleReset = () => {
    setSelectedLaudo(null);
  };

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
          {selectedLaudo ? (
            <AnvisaLaudoView 
              data={{
                ...selectedLaudo.resultado_ia,
                produto: selectedLaudo.produto,
                cliente: selectedLaudo.cliente,
                ativos: selectedLaudo.payload_entrada.ativos
              }} 
              onReset={handleReset} 
            />
          ) : (
            <AnvisaCheckerForm onResult={handleLaudoGenerated} />
          )}
        </TabsContent>

        <TabsContent value="tabela">
          <TabelaNutricionalBuilder />
        </TabsContent>

        <TabsContent value="laudos">
          <AnvisaLaudosHistorico onSelect={(laudo) => {
            setSelectedLaudo(laudo);
            setActiveTab("formula");
          }} />
        </TabsContent>

        <TabsContent value="base">
          <AnvisaBaseConstituintes />
        </TabsContent>
      </Tabs>
    </div>
  );
}
