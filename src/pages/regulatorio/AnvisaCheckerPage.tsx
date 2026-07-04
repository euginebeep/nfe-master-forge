import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnvisaCheckerForm } from "@/components/regulatorio/AnvisaCheckerForm";
import { TabelaNutricionalBuilder } from "@/components/regulatorio/TabelaNutricionalBuilder";
import { AnvisaLaudosHistorico } from "@/components/regulatorio/AnvisaLaudosHistorico";
import { AnvisaBaseConstituintes } from "@/components/regulatorio/AnvisaBaseConstituintes";
import { AnvisaLaudoView } from "@/components/regulatorio/AnvisaLaudoView";
import { FlaskConical, FileText, LayoutList, Database } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useFormPersist } from "@/hooks/use-form-persist";

type PageDraft = {
  activeTab: string;
  selectedLaudo: any;
  tabelaData: any;
};

const initialPageDraft: PageDraft = {
  activeTab: "formula",
  selectedLaudo: null,
  tabelaData: null,
};

export default function AnvisaCheckerPage() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const [pageDraft, setPageDraft] = useFormPersist(
    `anvisa-checker:${profile?.company_id ?? "pending"}`,
    initialPageDraft,
  );

  const { activeTab, selectedLaudo, tabelaData } = pageDraft;
  const setActiveTab = (v: string) => setPageDraft((d) => ({ ...d, activeTab: v }));
  const setSelectedLaudo = (v: any) => setPageDraft((d) => ({ ...d, selectedLaudo: v }));
  const setTabelaData = (v: any) => setPageDraft((d) => ({ ...d, tabelaData: v }));


  const handleLaudoGenerated = async (laudo: any) => {
    setSelectedLaudo(laudo);
    setTabelaData(laudo.resultado_ia);
    setActiveTab("laudos");

    try {
      if (laudo?.id) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .maybeSingle();
      if (!profile?.company_id) return;

      const lista = Array.isArray(laudo?.multiplos_produtos) && laudo.multiplos_produtos.length > 0
        ? laudo.multiplos_produtos
        : [laudo?.resultado_ia || laudo || {}];

      const registros = lista.map((p: any) => ({
        company_id: profile.company_id,
        produto: p?.nome || p?.produto || laudo?.produto || "Produto",
        cliente: p?.cliente || laudo?.cliente || null,
        cliente_logo_url: laudo?.cliente_logo_url || null,
        cliente_nome_exibicao: laudo?.cliente_nome_exibicao || p?.cliente || laudo?.cliente || null,
        status_geral: p?.status_geral || laudo?.status_geral || "VERIFICAR",
        payload_entrada: { ativos: p?.ativos || laudo?.ativos || [] },
        resultado_ia: p,
        criado_por: user.id,
      }));

      const { error } = await supabase.from("anvisa_laudos").insert(registros);
      if (error) {
        console.error("Falha ao gravar laudo ANVISA:", error);
        toast.error("Falha ao salvar laudo: " + (error.message || error.code));
      } else {
        queryClient.invalidateQueries({ queryKey: ["anvisa_laudos"] });
      }
    } catch (e: unknown) {
      const err = e as { message?: string; code?: string };
      console.error("Falha ao gravar laudo ANVISA:", e);
      toast.error("Falha ao salvar laudo: " + (err?.message || err?.code || "erro desconhecido"));
    }
  };


  const handleReset = () => {
    setPageDraft((d) => ({ ...d, selectedLaudo: null, activeTab: "formula" }));
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
