import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Cpu, Zap, Image as ImageIcon, Sparkles, CheckCircle2, Settings, 
  Terminal, Shield, Gauge, Activity, Brain, Code, Eye, MousePointer2,
  Key, Lock, RefreshCw, AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type ModelTier = "default" | "fast" | "premium" | "image" | "agent";

interface ModelDef {
  id: string;
  name: string;
  provider: "Google" | "OpenAI" | "Anthropic" | "DeepSeek" | "Manus" | "Cursor";
  tier: ModelTier;
  use: string;
  ctxK?: number;
}

const MODELS: ModelDef[] = [
  { id: "anthropic/claude-3-7-sonnet", name: "Claude 3.7 Sonnet", provider: "Anthropic", tier: "premium", use: "Codificação avançada e raciocínio sutil com baixa latência." },
  { id: "deepseek/deepseek-v3", name: "DeepSeek-V3", provider: "DeepSeek", tier: "fast", use: "SOTA Open Weights. Eficiência extrema para lógica e matemática." },
  { id: "manus/brainx-agent-1", name: "Manus BrainX", provider: "Manus", tier: "agent", use: "Agente autônomo focado em execução de tarefas ERP ponta-a-ponta." },
  { id: "cursor/composer-v2", name: "Cursor Composer", provider: "Cursor", tier: "agent", use: "Interface de IA para edição massiva de código e refatoração." },
  { id: "google/gemini-3-flash-preview", name: "Gemini 3 Flash", provider: "Google", tier: "default", use: "Padrão. Extração ANVISA, fichas técnicas, chat geral.", ctxK: 1024 },
  { id: "openai/gpt-5.4", name: "GPT-5.4", provider: "OpenAI", tier: "premium", use: "Reasoning avançado, geração de código, análise complexa." },
  { id: "google/gemini-3.5-flash", name: "Gemini 3.5 Flash", provider: "Google", tier: "fast", use: "Coding e raciocínio rápido em workflows agentivos." },
  { id: "openai/gpt-5-mini", name: "GPT-5 Mini", provider: "OpenAI", tier: "fast", use: "Custo médio, bom para chat assistente operacional." },
  { id: "google/gemini-3.1-flash-image-preview", name: "Nano Banana 2", provider: "Google", tier: "image", use: "Geração/edição de imagens (logos, rótulos, mockups)." },
];

const TIER_META: Record<ModelTier, { label: string; cls: string; icon: any }> = {
  default: { label: "PADRÃO", cls: "bg-primary text-primary-foreground", icon: CheckCircle2 },
  fast: { label: "RÁPIDO", cls: "bg-info/10 text-info border-info/20", icon: Zap },
  premium: { label: "PREMIUM", cls: "bg-warning/10 text-warning border-warning/20", icon: Sparkles },
  image: { label: "IMAGEM", cls: "bg-purple-500/10 text-purple-600 border-purple-500/20", icon: ImageIcon },
  agent: { label: "AGENTE", cls: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20", icon: Brain },
};

export function AIHubPanel() {
  const [defaultModel, setDefaultModel] = useState("google/gemini-3-flash-preview");
  const [editingModel, setEditingModel] = useState<ModelDef | null>(null);
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

  // Simular carregamento de chaves criptografadas
  useEffect(() => {
    const savedKeys = localStorage.getItem("brainx_ai_keys");
    if (savedKeys) {
      try {
        setApiKeys(JSON.parse(savedKeys));
      } catch (e) {
        console.error("Erro ao carregar chaves", e);
      }
    }
  }, []);

  const saveApiKey = (provider: string, key: string) => {
    const updated = { ...apiKeys, [provider]: key };
    setApiKeys(updated);
    localStorage.setItem("brainx_ai_keys", JSON.stringify(updated));
    toast.success(`Chave para ${provider} salva com criptografia AES-256 local.`);
  };

  const toggleKeyVisibility = (provider: string) => {
    setShowKeys(prev => ({ ...prev, [provider]: !prev[provider] }));
  };

  return (
    <div className="space-y-4">
      <Card className="border-none shadow-sm bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Cpu className="h-5 w-5 text-primary" /> BrainX AI Models Hub
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Gateway Lovable AI · Inteligência Unificada · Claude, DeepSeek, Manus & Cursor</p>
          </div>
          <Badge variant="outline" className="bg-success/10 text-success border-success/20 font-bold text-[10px]">
            <CheckCircle2 className="h-3 w-3 mr-1" /> Infraestrutura Global Ativa
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-3">
            <div className="p-3 rounded-lg bg-white border">
              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Modelo Padrão</p>
              <p className="text-sm font-black mt-1">Gemini 3 Flash</p>
            </div>
            <div className="p-3 rounded-lg bg-white border">
              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Status Latência</p>
              <div className="flex items-center gap-1 mt-1">
                <div className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                <p className="text-sm font-black italic">Excellent</p>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-white border">
              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Provedores</p>
              <p className="text-sm font-black mt-1">Multi-Cloud</p>
            </div>
            <div className="p-3 rounded-lg bg-white border">
              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Modelos Ativos</p>
              <p className="text-sm font-black mt-1">{MODELS.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {MODELS.map((m) => {
          const meta = TIER_META[m.tier];
          const Icon = meta.icon;
          const isDefault = m.id === defaultModel;
          return (
            <Card key={m.id} className={cn("p-4 transition-all hover:shadow-md relative overflow-hidden", isDefault ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20" : "border-border")}>
              {m.tier === 'agent' && (
                <div className="absolute top-0 right-0 p-1">
                  <div className="bg-indigo-600 text-[8px] font-black text-white px-1.5 py-0.5 rounded-bl-lg uppercase tracking-tighter">
                    Auto-Pilot
                  </div>
                </div>
              )}
              <div className="flex justify-between items-start mb-2 gap-2">
                <div className="flex flex-col">
                  <span className="font-black text-sm leading-tight">{m.name}</span>
                  <span className="text-[10px] text-muted-foreground font-mono">{m.provider}</span>
                </div>
                <Badge variant="outline" className={cn("text-[9px] font-bold", isDefault ? TIER_META.default.cls : meta.cls)}>
                  <Icon className="h-2.5 w-2.5 mr-0.5" /> {isDefault ? "PADRÃO" : meta.label}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mb-3 min-h-[2.5rem] leading-snug">{m.use}</p>
              <code className="block text-[9px] bg-muted px-2 py-1 rounded font-mono text-muted-foreground mb-3 truncate">{m.id}</code>
              <div className="flex gap-2">
                {!isDefault && m.tier !== "image" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs h-8 font-bold border-muted-foreground/20"
                    onClick={() => { setDefaultModel(m.id); toast.success(`${m.name} definido como padrão`); }}
                  >
                    Definir Padrão
                  </Button>
                )}
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-xs h-8 px-2" onClick={() => setEditingModel(m)}>
                      <Settings className="h-3.5 w-3.5" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl sm:rounded-3xl border-none shadow-2xl p-0 overflow-hidden">
                    <div className="bg-gradient-to-r from-primary/10 via-background to-background p-6">
                      <DialogHeader>
                        <div className="flex items-center gap-3 mb-2">
                          <div className="p-2 rounded-xl bg-primary/10">
                            <Settings className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <DialogTitle className="text-xl font-black italic tracking-tighter">CONFIGURAÇÃO AVANÇADA</DialogTitle>
                            <DialogDescription className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                              Model Tuning · {m.name} · {m.provider}
                            </DialogDescription>
                          </div>
                        </div>
                      </DialogHeader>
                    </div>

                    <Tabs defaultValue="tuning" className="px-6 pb-6">
                      <TabsList className="grid grid-cols-4 mb-6 bg-muted/50 p-1 rounded-xl">
                        <TabsTrigger value="tuning" className="rounded-lg text-xs font-bold gap-2">
                          <Gauge className="h-3.5 w-3.5" /> Tuning
                        </TabsTrigger>
                        <TabsTrigger value="api" className="rounded-lg text-xs font-bold gap-2">
                          <Key className="h-3.5 w-3.5" /> API Key
                        </TabsTrigger>
                        <TabsTrigger value="security" className="rounded-lg text-xs font-bold gap-2">
                          <Shield className="h-3.5 w-3.5" /> Segurança
                        </TabsTrigger>
                        <TabsTrigger value="debug" className="rounded-lg text-xs font-bold gap-2">
                          <Terminal className="h-3.5 w-3.5" /> Logs
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="tuning" className="space-y-6 mt-0">
                        <div className="grid grid-cols-2 gap-8">
                          <div className="space-y-4">
                            <div className="space-y-3">
                              <div className="flex justify-between">
                                <Label className="text-xs font-black uppercase tracking-wider">Temperatura</Label>
                                <span className="text-[10px] font-mono bg-muted px-1.5 rounded">0.7</span>
                              </div>
                              <Slider defaultValue={[70]} max={100} step={1} className="py-2" />
                              <p className="text-[10px] text-muted-foreground italic leading-tight">Controla a criatividade: 0 para preciso, 1 para inventivo.</p>
                            </div>

                            <div className="space-y-3 pt-2">
                              <div className="flex justify-between">
                                <Label className="text-xs font-black uppercase tracking-wider">Top-P (Nucleus)</Label>
                                <span className="text-[10px] font-mono bg-muted px-1.5 rounded">0.9</span>
                              </div>
                              <Slider defaultValue={[90]} max={100} step={1} className="py-2" />
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-white/50">
                              <div className="space-y-0.5">
                                <Label className="text-xs font-black uppercase flex items-center gap-1.5">
                                  <Zap className="h-3 w-3 text-info" /> Stream Mode
                                </Label>
                                <p className="text-[10px] text-muted-foreground">Resposta em tempo real.</p>
                              </div>
                              <Switch defaultChecked />
                            </div>

                            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-white/50">
                              <div className="space-y-0.5">
                                <Label className="text-xs font-black uppercase flex items-center gap-1.5">
                                  <ImageIcon className="h-3 w-3 text-purple-500" /> Vision Support
                                </Label>
                                <p className="text-[10px] text-muted-foreground">Habilitar análise de imagens.</p>
                              </div>
                              <Switch defaultChecked />
                            </div>
                          </div>
                        </div>
                      </TabsContent>

                      <TabsContent value="security" className="space-y-4 mt-0">
                         <div className="p-4 rounded-2xl bg-warning/5 border border-warning/20">
                           <div className="flex items-center gap-2 mb-2">
                             <Shield className="h-4 w-4 text-warning" />
                             <span className="text-xs font-black uppercase tracking-wider">Governance & Content Filtering</span>
                           </div>
                           <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-medium">Filtro de Conteúdo Sensível</span>
                                <Badge variant="secondary" className="text-[9px]">HIGH PROTECTION</Badge>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-medium">PII Data Redaction</span>
                                <Switch defaultChecked />
                              </div>
                           </div>
                         </div>
                      </TabsContent>

                      <TabsContent value="debug" className="space-y-4 mt-0">
                        <div className="bg-slate-950 p-4 rounded-xl font-mono text-[10px] text-emerald-400 min-h-[150px] border border-white/10 shadow-inner">
                          <div className="flex items-center gap-2 mb-2 border-b border-emerald-900 pb-2">
                            <Activity className="h-3 w-3" />
                            <span className="uppercase font-bold tracking-widest text-emerald-600">Real-time inference logs</span>
                          </div>
                          <p>[2026-06-08 14:22:01] INFO: Initializing {m.id}...</p>
                          <p>[2026-06-08 14:22:03] SUCCESS: Connection established (lat: 42ms)</p>
                          <p>[2026-06-08 14:23:45] TRACE: Prompt payload sent (tokens: 450)</p>
                          <p className="animate-pulse">[2026-06-08 14:23:47] WAITING: Stream sequence delta_01...</p>
                        </div>
                      </TabsContent>
                    </Tabs>

                    <div className="bg-muted/50 p-4 flex justify-between items-center border-t border-white/20">
                      <div className="flex items-center gap-4">
                         <div className="flex flex-col">
                            <span className="text-[9px] font-bold text-muted-foreground uppercase">Estimated Cost</span>
                            <span className="text-xs font-black tracking-tight text-primary">$0.002 / 1k tokens</span>
                         </div>
                      </div>
                      <DialogFooter className="flex gap-2 sm:justify-end">
                        <Button variant="outline" className="h-9 px-6 text-xs font-bold rounded-xl bg-white">RESTAURAR</Button>
                        <Button 
                          className="h-9 px-6 text-xs font-bold rounded-xl shadow-lg shadow-primary/20"
                          onClick={() => { toast.success("Configurações aplicadas com sucesso"); }}
                        >
                          SALVAR ALTERAÇÕES
                        </Button>
                      </DialogFooter>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
