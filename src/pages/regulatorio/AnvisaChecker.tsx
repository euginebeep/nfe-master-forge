import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnvisaCheckerForm } from "@/components/regulatorio/AnvisaCheckerForm";
import { TabelaNutricionalBuilder } from "@/components/regulatorio/TabelaNutricionalBuilder";
import { AnvisaLaudosHistorico } from "@/components/regulatorio/AnvisaLaudosHistorico";
import { AnvisaBaseConstituintes } from "@/components/regulatorio/AnvisaBaseConstituintes";
import { AnvisaLaudoView } from "@/components/regulatorio/AnvisaLaudoView";

export default function AnvisaChecker() {
  const [activeTab, setActiveTab] = useState("checker");
  const [selectedLaudo, setSelectedLaudo] = useState<any>(null);

  const handleLaudoGenerated = (laudo: any) => {
    setSelectedLaudo(laudo);
  };

  const handleReset = () => {
    setSelectedLaudo(null);
  };

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">ANVISA Checker</h1>
        <p className="text-muted-foreground">Validação regulatória de fórmulas e suplementos</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="checker">Checador de Fórmula</TabsTrigger>
          <TabsTrigger value="tabela">Tabela Nutricional</TabsTrigger>
          <TabsTrigger value="historico">Laudos Gerados</TabsTrigger>
          <TabsTrigger value="base">Base ANVISA</TabsTrigger>
        </TabsList>

        <TabsContent value="checker" className="space-y-6">
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

        <TabsContent value="historico">
          <AnvisaLaudosHistorico onSelect={(laudo) => {
            setSelectedLaudo(laudo);
            setActiveTab("checker");
          }} />
        </TabsContent>

        <TabsContent value="base">
          <AnvisaBaseConstituintes />
        </TabsContent>
      </Tabs>
    </div>
  );
}
