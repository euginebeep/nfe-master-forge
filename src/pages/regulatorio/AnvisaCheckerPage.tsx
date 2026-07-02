import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnvisaCheckerForm } from "@/components/regulatorio/AnvisaCheckerForm";
import { TabelaNutricionalBuilder } from "@/components/regulatorio/TabelaNutricionalBuilder";
import { AnvisaLaudosHistorico } from "@/components/regulatorio/AnvisaLaudosHistorico";
import { AnvisaBaseConstituintes } from "@/components/regulatorio/AnvisaBaseConstituintes";
import { AnvisaLaudoView } from "@/components/regulatorio/AnvisaLaudoView";
import { FlaskConical, FileText, LayoutList, Database } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function AnvisaCheckerPage() {
  const [activeTab, setActiveTab] = useState("formula");
  const [selectedLaudo, setSelectedLaudo] = useState<any>(null);
  const [tabelaData, setTabelaData] = useState<any>(null);


  const handleLaudoGenerated = async (laudo: any) => {
    setSelectedLaudo(laudo);
    setTabelaData(laudo.resultado_ia);
    setActiveTab("laudos"); // Vai direto para a aba de laudos após gerar

    // Persistir o laudo (histórico + rastreabilidade). Grava UMA vez, para qualquer
    // fluxo (fórmula OU arquivo/imagem). Não bloqueia a exibição se a gravação falhar.
    try {
      // Se o laudo já veio do histórico (já tem id), não re-inserir
      if (laudo?.id) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .maybeSingle();
      if (!profile?.company_id) return;

      // Suporta 1 produto (análise de fórmula) ou vários (ZIP com múltiplos briefings).
      const lista = Array.isArray(laudo?.multiplos_produtos) && laudo.multiplos_produtos.length > 0
        ? laudo.multiplos_produtos
        : [laudo?.resultado_ia || laudo || {}];

      const registros = lista.map((p: any) => ({
        company_id: profile.company_id,
        produto: p?.nome || p?.produto || laudo?.produto || "Produto",
        cliente: p?.cliente || laudo?.cliente || null,
        cliente_logo_url: laudo?.cliente_logo_url || null,
        cliente_nome_exibicao: laudo?.cliente_nome_exibicao || p?.cliente || laudo?.cliente || null,
        status_geral: p?.status_geral || "VERIFICAR",
        payload_entrada: { ativos: p?.ativos || [] },
        resultado_ia: p,
        criado_por: user.id,
      }));

      await supabase.from("anvisa_laudos").insert(registros);
    } catch (e) {
      console.error("Falha ao gravar laudo ANVISA:", e);
    }
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
          <AnvisaCheckerForm onResult={handleLaudoGenerated} />
        </TabsContent>

        <TabsContent value="tabela">
          <TabelaNutricionalBuilder initialData={tabelaData} />
        </TabsContent>

        <TabsContent value="laudos">
          {selectedLaudo ? (
            <AnvisaLaudoView 
              data={{
                ...selectedLaudo.resultado_ia,
                produto: selectedLaudo.produto,
                cliente: selectedLaudo.cliente,
                cliente_logo_url: selectedLaudo.cliente_logo_url || null,
                ativos: selectedLaudo.payload_entrada?.ativos || [],
                multiplos_produtos: selectedLaudo.multiplos_produtos
              }} 
              onReset={() => {
                setSelectedLaudo(null);
                setActiveTab("formula");
              }} 
              onSelectProduct={(p) => {
                setSelectedLaudo({
                  ...selectedLaudo,
                  produto: p.nome || p.produto,
                  resultado_ia: p,
                  payload_entrada: { ativos: p.ativos }
                });
              }}
            />
          ) : (
            <AnvisaLaudosHistorico onSelect={(laudo) => {
              setSelectedLaudo(laudo);
              setTabelaData(laudo.resultado_ia);
            }} />
          )}
        </TabsContent>

        <TabsContent value="base">
          <AnvisaBaseConstituintes />
        </TabsContent>
      </Tabs>
    </div>
  );
}
