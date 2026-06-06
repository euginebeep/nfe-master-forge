import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Upload, AlertCircle, Info, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface AssetRow {
  id: string;
  name: string;
  dose: string;
  unit: string;
  anvisaKey: string;
}

const ANVISA_KEYS = [
  "VITAMINA_A", "VITAMINA_D", "VITAMINA_E", "VITAMINA_K", "VITAMINA_C",
  "VITAMINA_B1", "VITAMINA_B2", "VITAMINA_B3", "VITAMINA_B5", "VITAMINA_B6",
  "BIOTINA", "ACIDO_FOLICO", "VITAMINA_B12", "CALCIO", "MAGNESIO",
  "FERRO", "ZINCO", "COBRE", "SELENIO", "CROMO", "MANGANES", "IODO",
  "POTASSIO", "FOSFORO", "FLUOR", "MOLIBDENIO", "COLINA", "LUTEINA",
  "ZEAXANTINA", "LICOPENO", "ASTAXANTINA", "OMEGA_3", "COENZIMA_Q10"
];

const AUDIENCES = [
  { value: "ADULTOS", label: "Adultos ≥19 anos" },
  { value: "GESTANTES", label: "Gestantes" },
  { value: "CRIANCAS_4_8", label: "Crianças 4-8 anos" },
  { value: "CRIANCAS_9_18", label: "Crianças 9-18 anos" },
  { value: "IDOSOS", label: "Idosos ≥65 anos" },
];

export function AnvisaCheckerForm() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [assets, setAssets] = useState<AssetRow[]>([
    { id: crypto.randomUUID(), name: "", dose: "", unit: "mg", anvisaKey: "" }
  ]);

  const addRow = () => {
    setAssets([...assets, { id: crypto.randomUUID(), name: "", dose: "", unit: "mg", anvisaKey: "" }]);
  };

  const removeRow = (id: string) => {
    setAssets(assets.filter(a => a.id !== id));
  };

  const updateAsset = (id: string, field: keyof AssetRow, value: string) => {
    setAssets(assets.map(a => a.id === id ? { ...a, [field]: value } : a));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    toast({
      title: "Analisando briefing",
      description: "A IA está processando seu documento...",
    });

    try {
      // Aqui chamaríamos a Edge Function anvisa-ai-verify
      // Simulando processamento por enquanto
      setTimeout(() => {
        setLoading(false);
        toast({
          title: "Extração concluída",
          description: "Os ativos foram detectados e preenchidos automaticamente.",
        });
      }, 2000);
    } catch (error) {
      setLoading(false);
      toast({
        variant: "destructive",
        title: "Erro no processamento",
        description: "Não foi possível analisar o arquivo.",
      });
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Coluna Esquerda: Formulário */}
      <div className="lg:col-span-2 space-y-6">
        <Card className="border-border/40 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-primary" />
              Seção A — Dados do produto
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="productName">Nome do produto *</Label>
              <Input id="productName" placeholder="Ex: Multivitamínico Premium" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="brand">Cliente / Marca</Label>
              <Input id="brand" placeholder="Nome da empresa" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Categoria / Objetivo</Label>
              <Input id="category" placeholder="Ex: Suplemento Alimentar" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="audience">Público-alvo</Label>
              <Select defaultValue="ADULTOS">
                <SelectTrigger id="audience">
                  <SelectValue placeholder="Selecione o público" />
                </SelectTrigger>
                <SelectContent>
                  {AUDIENCES.map(a => (
                    <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/40 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Upload className="w-5 h-5 text-primary" />
              Seção B — Upload de briefing
            </CardTitle>
            <CardDescription>
              Extraia ingredientes automaticamente de documentos Vitalnow
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative border-2 border-dashed border-muted rounded-xl p-8 transition-colors hover:border-primary/50 group">
              <input 
                type="file" 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                onChange={handleFileUpload}
                accept=".docx,.xlsx,.pdf,.zip"
              />
              <div className="flex flex-col items-center justify-center text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-primary/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Upload className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Arraste o briefing aqui ou clique</p>
                  <p className="text-xs text-muted-foreground mt-1">.docx, .xlsx, .pdf, .zip (máx 20MB)</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/40 shadow-sm overflow-hidden">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" />
              Seção C — Tabela de ativos
            </CardTitle>
          </CardHeader>
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="w-[30%]">Ativo/Ingrediente</TableHead>
                <TableHead className="w-[15%] text-center">Dose</TableHead>
                <TableHead className="w-[15%]">Unidade</TableHead>
                <TableHead>Chave ANVISA</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assets.map((asset) => (
                <TableRow key={asset.id} className="hover:bg-transparent">
                  <TableCell className="py-2">
                    <Input 
                      value={asset.name} 
                      onChange={(e) => updateAsset(asset.id, "name", e.target.value)}
                      placeholder="Nome do ativo" 
                      className="h-9"
                    />
                  </TableCell>
                  <TableCell className="py-2">
                    <Input 
                      value={asset.dose}
                      onChange={(e) => updateAsset(asset.id, "dose", e.target.value)}
                      className="text-center h-9" 
                      placeholder="0.00"
                    />
                  </TableCell>
                  <TableCell className="py-2">
                    <Select value={asset.unit} onValueChange={(v) => updateAsset(asset.id, "unit", v)}>
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["mg", "mcg", "g", "UI", "UFC", "FCC", "ml"].map(u => (
                          <SelectItem key={u} value={u}>{u}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="py-2">
                    <Select value={asset.anvisaKey} onValueChange={(v) => updateAsset(asset.id, "anvisaKey", v)}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Validar como..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {ANVISA_KEYS.map(k => (
                          <SelectItem key={k} value={k}>{k}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="py-2">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => removeRow(asset.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="p-4 bg-muted/10 border-t flex justify-between items-center">
            <Button variant="outline" size="sm" onClick={addRow} className="gap-2">
              <Plus className="w-4 h-4" /> Adicionar ativo
            </Button>
            <Button size="sm" className="bg-primary hover:bg-primary/90">
              Validar Fórmula
            </Button>
          </div>
        </Card>
      </div>

      {/* Coluna Direita: Dicas e Limites */}
      <div className="space-y-6">
        <Card className="bg-secondary/20 border-border/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Info className="w-4 h-4 text-primary" />
              Dicas Regulatórias
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-xs text-muted-foreground space-y-2 leading-relaxed">
              <p>• A IN 28/2018 define os limites para suplementos alimentares.</p>
              <p>• Certifique-se de que a unidade (mg/mcg) corresponde à chave ANVISA selecionada.</p>
              <p>• Probióticos devem ser declarados em UFC.</p>
            </div>
            <div className="p-3 bg-primary/5 rounded-lg border border-primary/10">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-primary" />
                <span className="text-xs font-bold text-primary uppercase tracking-wider">Alertas Críticos</span>
              </div>
              <p className="text-[11px] text-primary/70 font-medium">
                Vitamina A em doses superiores a 800mcg RE requer aviso de segurança para gestantes.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/40 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold">Limites Críticos (Adultos)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y text-[11px]">
              {[
                { name: "Vitamina D", limit: "50mcg (2000 UI)" },
                { name: "Zinco", limit: "29.59mg" },
                { name: "Vitamina B12", limit: "9.94mcg" },
                { name: "Cafeína", limit: "200mg (Produção)" }
              ].map((item) => (
                <div key={item.name} className="flex items-center justify-between p-3 hover:bg-muted/20">
                  <span className="text-muted-foreground font-medium">{item.name}</span>
                  <span className="font-bold">{item.limit}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
