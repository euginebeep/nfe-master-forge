import { useState } from "react";
import { GitMerge } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/**
 * Utilitário admin para mesclar duplicatas de itens via RPC mesclar_itens.
 * Exemplos ProLab (23/07): manter MP-2607-0784 ← absorver MP-2607-1008 (vazio);
 * manter MP-2603-1200 ← MP-2607-9177; manter MP-2606-8641 ← MP-2607-8524 (leva COA).
 */
export default function MesclarItensPage() {
  const [manter, setManter] = useState("");
  const [absorver, setAbsorver] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);

  const run = async () => {
    if (!manter.trim() || !absorver.trim()) {
      toast.error("Informe os dois UUIDs.");
      return;
    }
    setLoading(true);
    setResultado(null);
    try {
      const { data, error } = await (supabase as any).rpc("mesclar_itens", {
        p_item_manter: manter.trim(),
        p_item_absorver: absorver.trim(),
      });
      if (error) throw error;
      setResultado(JSON.stringify(data, null, 2));
      toast.success("Mesclagem concluída.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl space-y-6">
      <PageHeader
        title="Mesclar itens"
        description="Absorve um item duplicado no sobrevivente (RPC mesclar_itens)"
        icon={GitMerge}
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Parâmetros</CardTitle>
          <CardDescription>
            Reponta lotes, notas, fornecedores e aliases; depois chama excluir_item_seguro no absorvido.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>UUID item a manter</Label>
            <Input value={manter} onChange={(e) => setManter(e.target.value)} placeholder="uuid sobrevivente" className="font-mono text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label>UUID item a absorver</Label>
            <Input value={absorver} onChange={(e) => setAbsorver(e.target.value)} placeholder="uuid duplicata" className="font-mono text-xs" />
          </div>
          <Button onClick={() => void run()} disabled={loading}>
            {loading ? "Mesclando…" : "Mesclar"}
          </Button>
          {resultado && (
            <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-64">{resultado}</pre>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
