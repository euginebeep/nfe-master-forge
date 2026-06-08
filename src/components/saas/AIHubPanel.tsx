import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Cpu, Zap, Image as ImageIcon, Sparkles, CheckCircle2, Settings, 
  Terminal, Shield, Gauge, Activity, Brain, Code, Eye, MousePointer2 
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
  { id: "google/gemini-3-flash-preview", name: "Gemini 3 Flash", provider: "Google", tier: "default", use: "Padrão. Extração ANVISA, fichas técnicas, chat geral.", ctxK: 1024 },
  { id: "anthropic/claude-3-7-sonnet", name: "Claude 3.7 Sonnet", provider: "Anthropic", tier: "premium", use: "Codificação avançada e raciocínio sutil com baixa latência." },
  { id: "deepseek/deepseek-v3", name: "DeepSeek-V3", provider: "DeepSeek", tier: "fast", use: "SOTA Open Weights. Eficiência extrema para lógica e matemática." },
  { id: "manus/brainx-agent-1", name: "Manus BrainX", provider: "Manus", tier: "agent", use: "Agente autônomo focado em execução de tarefas ERP ponta-a-ponta." },
  { id: "cursor/composer-v2", name: "Cursor Composer", provider: "Cursor", tier: "agent", use: "Interface de IA para edição massiva de código e refatoração." },
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

  return (
    <div className="space-y-4">
      <Card className="border-none shadow-sm bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Cpu className="h-5 w-5 text-primary" /> BrainX AI Models Hub
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Gateway Lovable AI · Sem chave externa · Cobrança via créditos do workspace</p>
          </div>
          <Badge variant="outline" className="bg-success/10 text-success border-success/20 font-bold">
            <CheckCircle2 className="h-3 w-3 mr-1" /> Gateway Operacional
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-3">
            <div className="p-3 rounded-lg bg-white border">
              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Modelo Padrão</p>
              <p className="text-sm font-black mt-1">Gemini 3 Flash</p>
            </div>
            <div className="p-3 rounded-lg bg-white border">
              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Chamadas (30d)</p>
              <p className="text-sm font-black mt-1">— req</p>
            </div>
            <div className="p-3 rounded-lg bg-white border">
              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Créditos</p>
              <p className="text-sm font-black mt-1">Workspace</p>
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
            <Card key={m.id} className={cn("p-4 transition-all hover:shadow-md", isDefault ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20" : "border-border")}>
              <div className="flex justify-between items-start mb-2 gap-2">
                <div className="flex flex-col">
                  <span className="font-black text-sm leading-tight">{m.name}</span>
                  <span className="text-[10px] text-muted-foreground font-mono">{m.provider}</span>
                </div>
                <Badge variant="outline" className={cn("text-[9px] font-bold", isDefault ? TIER_META.default.cls : meta.cls)}>
                  <Icon className="h-2.5 w-2.5 mr-0.5" /> {isDefault ? "PADRÃO" : meta.label}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mb-3 min-h-[2.5rem]">{m.use}</p>
              <code className="block text-[9px] bg-muted px-2 py-1 rounded font-mono text-muted-foreground mb-3 truncate">{m.id}</code>
              <div className="flex gap-2">
                {!isDefault && m.tier !== "image" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs h-8"
                    onClick={() => { setDefaultModel(m.id); toast.success(`${m.name} definido como padrão`); }}
                  >
                    Definir Padrão
                  </Button>
                )}
                <Button variant="ghost" size="sm" className="text-xs h-8 px-2" onClick={() => toast.info("Configuração avançada em breve")}>
                  <Settings className="h-3 w-3" />
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
