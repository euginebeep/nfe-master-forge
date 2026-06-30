import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Cpu, Zap, Image as ImageIcon, Sparkles, CheckCircle2, Settings,
  Terminal, Shield, Gauge, Activity, Brain, Eye, EyeOff,
  Key, Lock, RefreshCw, AlertCircle, Save, Loader2,
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
import { supabase } from "@/integrations/supabase/client";

// ─── Mapeamento provider → chave no banco ────────────────────────────────────
const PROVIDER_TO_CHAVE: Record<string, string> = {
  Google:    "gemini_api_key",
  Anthropic: "anthropic_api_key",
};

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

// ─── Helper: chamar saas-admin (mesmo padrão do SaasDashboardPage) ────────────
async function callSaasAdmin(action: string, body: Record<string, any> = {}) {
  const { data: sess } = await supabase.auth.getSession();
  if (!sess?.session) await supabase.auth.refreshSession();
  const { data, error } = await supabase.functions.invoke("saas-admin", {
    body: { action, ...body },
  });
  if (error) throw new Error(error.message || "saas-admin failed");
  return data;
}

export function AIHubPanel() {
  const [defaultModel, setDefaultModel] = useState("google/gemini-3-flash-preview");
  const [editingModel, setEditingModel] = useState<ModelDef | null>(null);

  // Estado das chaves: provider → valor digitado no input
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  // Status de cada chave no banco: provider → { configurado, mascarado }
  const [keyStatus, setKeyStatus] = useState<Record<string, { configurado: boolean; mascarado: string | null }>>({});
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [savingKey, setSavingKey] = useState<Record<string, boolean>>({});
  const [loadingKeys, setLoadingKeys] = useState(false);

  // ─── Carregar status das chaves do banco via saas-admin ──────────────────
  const loadKeyStatus = useCallback(async () => {
    setLoadingKeys(true);
    try {
      const data = await callSaasAdmin("get-ai-keys");
      const st: Record<string, { configurado: boolean; mascarado: string | null }> = {};
      for (const row of data?.keys || []) {
        // Mapear chave do banco → provider
        const provider = Object.entries(PROVIDER_TO_CHAVE).find(([, v]) => v === row.chave)?.[0];
        if (provider) {
          st[provider] = { configurado: row.configurado, mascarado: row.valor_mascarado };
        }
      }
      setKeyStatus(st);
    } catch (e: any) {
      // Silencioso — pode falhar se tabela ainda não existe
      console.warn("Falha ao carregar status das chaves:", e?.message);
    } finally {
      setLoadingKeys(false);
    }
  }, []);

  useEffect(() => {
    loadKeyStatus();
  }, [loadKeyStatus]);

  // ─── Salvar chave no banco via saas-admin ────────────────────────────────
  const saveApiKey = async (provider: string) => {
    const chave = PROVIDER_TO_CHAVE[provider];
    if (!chave) {
      toast.info(`Chave de ${provider} não é gerenciada pelo BrainX (use o Secret do provedor diretamente).`);
      return;
    }
    const valor = apiKeys[provider]?.trim() || "";
    setSavingKey((s) => ({ ...s, [provider]: true }));
    try {
      await callSaasAdmin("save-ai-key", { chave, valor: valor || null });
      toast.success(`Chave ${provider} salva com sucesso! Todos os módulos de IA já podem utilizá-la.`);
      setApiKeys((prev) => ({ ...prev, [provider]: "" })); // limpar input após salvar
      await loadKeyStatus(); // recarregar status
    } catch (e: any) {
      toast.error(`Erro ao salvar: ${e?.message || "?"}`);
    } finally {
      setSavingKey((s) => ({ ...s, [provider]: false }));
    }
  };

  const toggleKeyVisibility = (provider: string) => {
    setShowKeys((prev) => ({ ...prev, [provider]: !prev[provider] }));
  };

  return (
    <div className="space-y-4">
      {/* Header card */}
      <Card className="border-none shadow-sm bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Cpu className="h-5 w-5 text-primary" /> BrainX AI Models Hub
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">BrainX AI Gateway · Inteligência Unificada · Infraestrutura Proprietária</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={loadKeyStatus} disabled={loadingKeys} title="Recarregar status das chaves">
              <RefreshCw className={cn("h-4 w-4", loadingKeys && "animate-spin")} />
            </Button>
            <Badge variant="outline" className="bg-success/10 text-success border-success/20 font-bold text-[10px]">
              <CheckCircle2 className="h-3 w-3 mr-1" /> Infraestrutura Global Ativa
            </Badge>
          </div>
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

      {/* Cards de modelos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {MODELS.map((m) => {
          const meta = TIER_META[m.tier];
          const Icon = meta.icon;
          const isDefault = m.id === defaultModel;
          const chave = PROVIDER_TO_CHAVE[m.provider];
          const ks = keyStatus[m.provider];
          return (
            <Card key={m.id} className={cn("p-4 transition-all hover:shadow-md relative overflow-hidden", isDefault ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20" : "border-border")}>
              {m.tier === "agent" && (
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
                <div className="flex flex-col items-end gap-1">
                  <Badge variant="outline" className={cn("text-[9px] font-bold", isDefault ? TIER_META.default.cls : meta.cls)}>
                    <Icon className="h-2.5 w-2.5 mr-0.5" /> {isDefault ? "PADRÃO" : meta.label}
                  </Badge>
                  {/* Badge de status da chave — apenas para provedores gerenciados */}
                  {chave && (
                    ks?.configurado
                      ? <Badge variant="outline" className="text-[8px] bg-success/10 text-success border-success/20"><CheckCircle2 className="h-2.5 w-2.5 mr-0.5" /> KEY ATIVA</Badge>
                      : <Badge variant="outline" className="text-[8px] bg-destructive/10 text-destructive border-destructive/20"><AlertCircle className="h-2.5 w-2.5 mr-0.5" /> SEM CHAVE</Badge>
                  )}
                </div>
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

                      {/* ── Aba API Key — persistência real no banco ── */}
                      <TabsContent value="api" className="space-y-4 mt-0">
                        {!chave ? (
                          <Alert className="bg-muted/50 border-border rounded-xl">
                            <AlertCircle className="h-4 w-4 text-muted-foreground" />
                            <AlertTitle className="text-xs font-black uppercase tracking-wider">Chave gerenciada externamente</AlertTitle>
                            <AlertDescription className="text-[10px] text-muted-foreground leading-tight">
                              A chave de API de {m.provider} não é gerenciada pelo painel BrainX.
                              Configure-a diretamente no painel do provedor ou nos Secrets do Supabase.
                            </AlertDescription>
                          </Alert>
                        ) : (
                          <>
                            <Alert className="bg-primary/5 border-primary/20 rounded-xl">
                              <Lock className="h-4 w-4 text-primary" />
                              <AlertTitle className="text-xs font-black uppercase tracking-wider">Chave Global do Sistema</AlertTitle>
                              <AlertDescription className="text-[10px] text-muted-foreground leading-tight">
                                Esta chave é armazenada de forma segura no banco de dados e utilizada por
                                <strong> todos os tenants e usuários</strong> do ERP. Configurada aqui uma única vez pelo SaaS Owner.
                              </AlertDescription>
                            </Alert>

                            {/* Status atual da chave no banco */}
                            {keyStatus[m.provider] && (
                              <div className={cn(
                                "flex items-center justify-between p-3 rounded-xl border",
                                keyStatus[m.provider].configurado
                                  ? "bg-success/5 border-success/20"
                                  : "bg-destructive/5 border-destructive/20"
                              )}>
                                <div className="flex items-center gap-2">
                                  {keyStatus[m.provider].configurado
                                    ? <CheckCircle2 className="h-4 w-4 text-success" />
                                    : <AlertCircle className="h-4 w-4 text-destructive" />
                                  }
                                  <div>
                                    <p className="text-xs font-bold">
                                      {keyStatus[m.provider].configurado ? "Chave configurada" : "Chave não configurada"}
                                    </p>
                                    {keyStatus[m.provider].mascarado && (
                                      <p className="text-[10px] font-mono text-muted-foreground">
                                        {keyStatus[m.provider].mascarado}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <Button variant="ghost" size="icon" onClick={loadKeyStatus} disabled={loadingKeys}>
                                  <RefreshCw className={cn("h-3.5 w-3.5", loadingKeys && "animate-spin")} />
                                </Button>
                              </div>
                            )}

                            <div className="space-y-2 pt-1">
                              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                Nova chave {m.provider}
                                <Badge variant="outline" className="text-[8px] font-mono h-4">GLOBAL · TODOS OS TENANTS</Badge>
                              </Label>
                              <div className="flex gap-2">
                                <div className="relative flex-1">
                                  <Input
                                    type={showKeys[m.provider] ? "text" : "password"}
                                    placeholder={`Cole a nova chave ${m.provider}...`}
                                    className="h-10 rounded-xl font-mono text-xs pr-10"
                                    value={apiKeys[m.provider] || ""}
                                    onChange={(e) => setApiKeys({ ...apiKeys, [m.provider]: e.target.value })}
                                  />
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-0 top-0 h-10 w-10 hover:bg-transparent"
                                    onClick={() => toggleKeyVisibility(m.provider)}
                                  >
                                    {showKeys[m.provider]
                                      ? <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                                      : <EyeOff className="h-3.5 w-3.5 text-muted-foreground opacity-50" />
                                    }
                                  </Button>
                                </div>
                                <Button
                                  className="h-10 rounded-xl font-bold text-xs gap-2"
                                  onClick={() => saveApiKey(m.provider)}
                                  disabled={savingKey[m.provider] || !apiKeys[m.provider]?.trim()}
                                >
                                  {savingKey[m.provider]
                                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    : <Save className="h-3.5 w-3.5" />
                                  }
                                  SALVAR
                                </Button>
                              </div>
                              <p className="text-[10px] text-muted-foreground">
                                Deixe em branco e salve para <strong>remover</strong> a chave atual.
                              </p>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div className="p-3 rounded-xl border border-dashed flex items-center justify-between">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase">Quota Ativa</span>
                                <span className="text-xs font-black">UNLIMITED</span>
                              </div>
                              <div className="p-3 rounded-xl border border-dashed flex items-center justify-between">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase">Rate Limit</span>
                                <span className="text-xs font-black">10k RPM</span>
                              </div>
                            </div>
                          </>
                        )}
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
                          <p>[2026-06-21 10:00:01] INFO: Initializing {m.id}...</p>
                          <p>[2026-06-21 10:00:03] SUCCESS: Connection established (lat: 42ms)</p>
                          <p>[2026-06-21 10:00:45] TRACE: Prompt payload sent (tokens: 450)</p>
                          <p className="animate-pulse">[2026-06-21 10:00:47] WAITING: Stream sequence delta_01...</p>
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
                          onClick={() => toast.success("Configurações de tuning aplicadas.")}
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
