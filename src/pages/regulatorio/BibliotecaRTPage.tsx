/**
 * Regulatório → Biblioteca do RT
 *
 * Copilot Regulatório travado em fonte oficial.
 * A IA NUNCA responde sem citar pelo menos um chunk da base.
 *
 * Referências: RDC 243/2018, RDC 275/2002, IN 28/2018 (suplementos alimentares)
 * NÃO aplicável: RDC 658/2022 (BPF de medicamentos)
 */

import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdge } from "@/lib/edge-invoke";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  BookOpen, Search, GraduationCap, FileCheck, Radar,
  ExternalLink, AlertTriangle, CheckCircle2, ShieldAlert, Shield,
  ChevronRight, Loader2, Send, RefreshCw, Check, X, ClipboardList, Scale, Factory,
  FlaskConical, Tag, type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import {
  useAlertasNormativosPendentes,
  useMarcarAlertaRevisado,
  useConstituintesRequeremRehomologacao,
  invocarMonitorAnvisaDiario,
} from "@/hooks/useAlertasNormativos";

// ─── Tipos ──────────────────────────────────────────────────────────────────

interface LegislacaoFonte {
  id: string;
  tipo: string;
  numero: string;
  ano: number;
  titulo: string;
  categoria: string;
  url_oficial: string;
  status: string;
  aprovado_por: string | null;
  aprovado_em: string | null;
  data_publicacao: string | null;
}

interface TrilhaEstudo {
  id: string;
  titulo: string;
  categoria: string;
  nivel: string;
  conteudo_md: string;
  ordem: number;
}

interface MonitoramentoItem {
  id: string;
  fonte_monitorada: string;
  url: string;
  mudanca_detectada: boolean;
  resumo_mudanca: string | null;
  status_revisao: string;
  created_at: string;
}

interface RespostaRAG {
  resposta: string;
  encontrou_resposta: boolean;
  fontes: Array<{
    fonte_id: string;
    referencia: string;
    titulo: string;
    tipo?: string;
    numero: string;
    ano: number;
    url_oficial: string;
    categoria: string;
  }>;
}

// ─── Mapa de categorias (tokens do tema) ─────────────────────────────────────

const CATEGORIA_LABELS: Record<string, { label: string; color: string }> = {
  NUCLEO_SUPLEMENTO: {
    label: "Núcleo Suplemento",
    color: "bg-primary/10 text-primary border-primary/20",
  },
  ATUALIZACAO_IN28: {
    label: "Atualização IN 28",
    color: "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20",
  },
  ROTULAGEM: {
    label: "Rotulagem",
    color: "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/20",
  },
  BPF_GERAL: {
    label: "BPF Geral",
    color: "bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/20",
  },
  APOIO_PERGUNTAS_RESPOSTAS: {
    label: "P&R Oficial",
    color: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/20",
  },
  REFERENCIA_MEDICAMENTO_NAO_APLICAVEL: {
    label: "Medicamento (não aplicável)",
    color: "bg-destructive/10 text-destructive border-destructive/20",
  },
};

const TRILHA_ICONS: Record<string, LucideIcon> = {
  POPS: ClipboardList,
  TABELA_NUTRICIONAL: BookOpen,
  BPF: Factory,
  ROTULAGEM: Tag,
  ALEGACOES: CheckCircle2,
  LIMITES_DOSE: Scale,
  ESTABILIDADE: FlaskConical,
  FISCALIZACAO: Search,
};

const SUGESTOES_PERGUNTA = [
  "Quais são os 3 avisos obrigatórios no rótulo?",
  "Posso usar GABA em suplemento?",
  "Qual a diferença entre RDC 275/2002 e RDC 658/2022?",
  "Quais POPs são obrigatórios?",
  "Limite de cafeína por dose?",
];

function labelFonte(f: { tipo?: string; numero: string; ano: number; titulo?: string }) {
  if (f.tipo && f.tipo !== "OUTRO") return `${f.tipo} ${f.numero}/${f.ano}`;
  return f.titulo?.slice(0, 40) || `${f.numero}/${f.ano}`;
}

// ─── Componente principal ────────────────────────────────────────────────────

export default function BibliotecaRTPage() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [aba, setAba] = useState("copilot");

  const [pergunta, setPergunta] = useState("");
  const [respostaRAG, setRespostaRAG] = useState<RespostaRAG | null>(null);
  const [buscando, setBuscando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [trilhaSelecionada, setTrilhaSelecionada] = useState<TrilhaEstudo | null>(null);

  const [textoPOP, setTextoPOP] = useState("");
  const [revisandoPOP, setRevisandoPOP] = useState(false);
  const [resultadoRevisao, setResultadoRevisao] = useState<RespostaRAG | null>(null);
  const [rodandoMonitor, setRodandoMonitor] = useState(false);

  const { data: fontes = [] } = useQuery<LegislacaoFonte[]>({
    queryKey: ["legislacao-fontes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("legislacao_fontes")
        .select("*")
        .order("categoria")
        .order("ano");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: trilhas = [] } = useQuery<TrilhaEstudo[]>({
    queryKey: ["trilhas-estudo"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trilhas_estudo")
        .select("*")
        .order("ordem");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: monitoramento = [], refetch: refetchMonitoramento } = useQuery<MonitoramentoItem[]>({
    queryKey: ["legislacao-monitoramento"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("legislacao_monitoramento")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: alertasPendentes = [], refetch: refetchAlertas } = useAlertasNormativosPendentes();
  const { data: rehomo = [] } = useConstituintesRequeremRehomologacao();
  const marcarAlerta = useMarcarAlertaRevisado();

  const atualizarRadar = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "APROVADO" | "DESCARTADO" }) => {
      const { error } = await supabase
        .from("legislacao_monitoramento")
        .update({
          status_revisao: status,
          revisado_por: user?.id,
          revisado_em: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["legislacao-monitoramento"] });
      toast.success("Status atualizado com sucesso.");
    },
  });

  const pendentes = monitoramento.filter(
    (m) => m.status_revisao === "PENDENTE" && m.mudanca_detectada,
  );
  const verificacoesOk = monitoramento.filter((m) => !m.mudanca_detectada);
  const totalPendencias = alertasPendentes.length + pendentes.length;
  const fontesAtivas = fontes.filter((f) => f.aprovado_por);

  const handlePergunta = async () => {
    if (!pergunta.trim()) return;
    setBuscando(true);
    setRespostaRAG(null);
    try {
      const { data, error } = await invokeEdge<RespostaRAG>("legislacao-rag-search", {
        pergunta,
        company_id: profile?.company_id,
        usuario_id: user?.id,
      });
      if (error) {
        toast.error(error);
        return;
      }
      setRespostaRAG(data as RespostaRAG);
    } catch {
      toast.error("Erro ao consultar a base. Tente novamente.");
    } finally {
      setBuscando(false);
    }
  };

  const handleRevisarPOP = async () => {
    if (!textoPOP.trim()) return;
    setRevisandoPOP(true);
    setResultadoRevisao(null);
    try {
      const perguntaRevisao =
        `Revise o seguinte texto de POP e identifique afirmações que podem não ter base nas normas ANVISA para suplementos alimentares (RDC 243/2018, RDC 275/2002, IN 28/2018). Para cada afirmação suspeita, indique se há ou não sustentação na base:\n\n${textoPOP}`;
      const { data, error } = await invokeEdge<RespostaRAG>("legislacao-rag-search", {
        pergunta: perguntaRevisao,
        company_id: profile?.company_id,
        usuario_id: user?.id,
      });
      if (error) {
        toast.error(error);
        return;
      }
      setResultadoRevisao(data as RespostaRAG);
    } catch {
      toast.error("Erro ao revisar o POP. Tente novamente.");
    } finally {
      setRevisandoPOP(false);
    }
  };

  const handleRodarMonitor = async () => {
    setRodandoMonitor(true);
    try {
      const data = await invocarMonitorAnvisaDiario();
      toast.success(
        `Monitor executado — ${data?.total_mudancas ?? 0} alerta(s), ${data?.total_fontes_inacessiveis ?? 0} fonte(s) inacessível(is)`,
      );
      await Promise.all([refetchMonitoramento(), refetchAlertas()]);
    } catch (e: unknown) {
      const err = e as { message?: string };
      toast.error(`Falha ao rodar monitor: ${err.message ?? "erro"}`);
    } finally {
      setRodandoMonitor(false);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6 animate-in fade-in duration-500">
      <PageHeader
        icon={BookOpen}
        title="Biblioteca do RT"
        description="Base de conhecimento travada em fonte oficial ANVISA — RDC 243/2018 · RDC 275/2002 · IN 28/2018"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs">
              Copilot Regulatório
            </Badge>
            {totalPendencias === 0 ? (
              <Badge
                variant="outline"
                className="text-xs border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
              >
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Base em dia
              </Badge>
            ) : (
              <Badge variant="destructive" className="text-xs">
                {totalPendencias} pendência{totalPendencias > 1 ? "s" : ""}
              </Badge>
            )}
          </div>
        }
      />

      <Alert className="border-amber-500/40 bg-amber-500/5">
        <ShieldAlert className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-xs text-foreground">
          <strong>Atenção:</strong> A RDC 658/2022 é BPF de <strong>medicamentos</strong> e{" "}
          <strong>não se aplica</strong> a suplementos alimentares. Para suplementos, use{" "}
          <strong>RDC 243/2018</strong> (requisitos sanitários) e <strong>RDC 275/2002</strong> (BPF
          alimentos).
        </AlertDescription>
      </Alert>

      <Tabs value={aba} onValueChange={setAba} className="w-full space-y-4">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 h-auto">
          <TabsTrigger value="copilot" className="flex items-center gap-1.5 text-xs sm:text-sm py-2">
            <Search className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Pergunte à Legislação</span>
          </TabsTrigger>
          <TabsTrigger value="trilhas" className="flex items-center gap-1.5 text-xs sm:text-sm py-2">
            <GraduationCap className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Trilhas de Estudo</span>
          </TabsTrigger>
          <TabsTrigger value="revisor" className="flex items-center gap-1.5 text-xs sm:text-sm py-2">
            <FileCheck className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Revisor de POP</span>
          </TabsTrigger>
          <TabsTrigger value="radar" className="flex items-center gap-1.5 text-xs sm:text-sm py-2">
            <Radar className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Radar</span>
            {totalPendencias > 0 && (
              <span className="ml-1 bg-amber-500 text-white text-[10px] rounded-full min-w-4 h-4 px-1 flex items-center justify-center">
                {totalPendencias}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── ABA 1: Pergunte à Legislação ─────────────────────────────────── */}
        <TabsContent value="copilot" className="space-y-4">
          <Card>
            <CardContent className="pt-6 space-y-3">
              <div>
                <h3 className="text-base font-semibold text-foreground">Consulta à Base de Legislação</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Faça perguntas em linguagem natural. A resposta vem apenas de trechos carregados na
                  base — nunca de conhecimento geral do modelo.
                </p>
              </div>
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  placeholder="Ex: Qual é o limite de vitamina D por dia para suplementos?"
                  value={pergunta}
                  onChange={(e) => setPergunta(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handlePergunta()}
                  className="text-sm"
                />
                <Button onClick={handlePergunta} disabled={buscando || !pergunta.trim()} size="sm">
                  {buscando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {SUGESTOES_PERGUNTA.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setPergunta(s);
                      setTimeout(handlePergunta, 100);
                    }}
                    className="text-xs px-2 py-1 rounded-md border border-border hover:border-primary/40 hover:bg-primary/5 transition-colors text-muted-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {buscando && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="w-4 h-4 animate-spin" />
              Consultando a base de legislação...
            </div>
          )}

          {respostaRAG && (
            <Card
              className={
                respostaRAG.encontrou_resposta
                  ? "border-emerald-500/30"
                  : "border-amber-500/40"
              }
            >
              <CardContent className="pt-4 space-y-4">
                <div className="flex items-center gap-2">
                  {respostaRAG.encontrou_resposta ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                  )}
                  <span className="text-xs text-muted-foreground">
                    {respostaRAG.encontrou_resposta
                      ? `Resposta baseada em ${respostaRAG.fontes.length} trecho(s) da base`
                      : "Informação não encontrada na base"}
                  </span>
                </div>

                <div className="prose prose-sm max-w-none text-foreground">
                  <ReactMarkdown>{respostaRAG.resposta}</ReactMarkdown>
                </div>

                {respostaRAG.fontes.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Fontes citadas
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {respostaRAG.fontes.map((f, idx) => (
                        <a
                          key={idx}
                          href={f.url_oficial}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border font-medium hover:opacity-80 transition-opacity ${
                            CATEGORIA_LABELS[f.categoria]?.color ||
                            "bg-muted text-foreground border-border"
                          }`}
                        >
                          {labelFonte(f)}
                          {f.referencia && ` — ${f.referencia}`}
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      ))}
                    </div>
                    {respostaRAG.fontes.some(
                      (f) => f.categoria === "REFERENCIA_MEDICAMENTO_NAO_APLICAVEL",
                    ) && (
                      <Alert className="border-destructive/30 bg-destructive/5 mt-2">
                        <AlertTriangle className="h-3 w-3 text-destructive" />
                        <AlertDescription className="text-destructive text-xs">
                          Uma das fontes citadas (RDC 658/2022) é norma de{" "}
                          <strong>medicamentos</strong> e <strong>não se aplica</strong> a
                          suplementos alimentares.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-medium text-foreground">Base de Normas Ativas</h3>
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Shield className="w-3 h-3" /> Gerenciada pelo administrador do sistema
                </span>
              </div>
              <div className="space-y-1">
                {fontesAtivas.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded border font-medium shrink-0 ${
                          CATEGORIA_LABELS[f.categoria]?.color ||
                          "bg-muted text-foreground border-border"
                        }`}
                      >
                        {f.tipo !== "OUTRO" ? `${f.tipo} ${f.numero}/${f.ano}` : "DOC"}
                      </span>
                      <span className="text-xs text-foreground truncate">{f.titulo}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                        <CheckCircle2 className="w-3 h-3" /> Ativa
                      </span>
                      <a
                        href={f.url_oficial}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-primary transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                ))}
                {fontesAtivas.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    Nenhuma norma ativa ainda. O administrador do sistema está carregando a base.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── ABA 2: Trilhas de Estudo ──────────────────────────────────────── */}
        <TabsContent value="trilhas" className="space-y-4">
          {trilhaSelecionada ? (
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    {(() => {
                      const Icon = TRILHA_ICONS[trilhaSelecionada.categoria] || BookOpen;
                      return (
                        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Icon className="w-4 h-4 text-primary" />
                        </div>
                      );
                    })()}
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold text-foreground">
                        {trilhaSelecionada.titulo}
                      </h3>
                      <Badge variant="outline" className="text-xs mt-1">
                        {trilhaSelecionada.nivel}
                      </Badge>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setTrilhaSelecionada(null)}>
                    ← Voltar
                  </Button>
                </div>
                <div className="prose prose-sm max-w-none text-foreground">
                  <ReactMarkdown>{trilhaSelecionada.conteudo_md}</ReactMarkdown>
                </div>
                <div className="pt-3 border-t border-border flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    Dúvida pontual? Consulte a base oficial pela aba Pergunte à Legislação.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setAba("copilot")}
                  >
                    <Search className="w-3 h-3 mr-1" />
                    Pergunte à Legislação
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {trilhas.map((t) => {
                const Icon = TRILHA_ICONS[t.categoria] || BookOpen;
                return (
                  <Card
                    key={t.id}
                    className="cursor-pointer hover:border-primary/40 transition-colors"
                    onClick={() => setTrilhaSelecionada(t)}
                  >
                    <CardContent className="pt-4">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Icon className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-foreground leading-tight">
                            {t.titulo}
                          </p>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <Badge variant="outline" className="text-[10px]">
                              {t.nivel}
                            </Badge>
                            <Badge variant="outline" className="text-[10px] text-primary border-primary/20">
                              {t.categoria.replace(/_/g, " ")}
                            </Badge>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── ABA 3: Revisor de POP ─────────────────────────────────────────── */}
        <TabsContent value="revisor" className="space-y-4">
          <Card>
            <CardContent className="pt-6 space-y-3">
              <div>
                <h3 className="text-base font-semibold text-foreground">Revisor de POP</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Cole o texto de um POP. O sistema verifica cada afirmação contra a base de
                  legislação e sinaliza trechos sem sustentação em norma oficial.
                </p>
              </div>
              <Textarea
                placeholder="Cole aqui o texto do POP para revisão..."
                value={textoPOP}
                onChange={(e) => setTextoPOP(e.target.value)}
                rows={10}
                className="text-sm font-mono"
              />
              <Button
                onClick={handleRevisarPOP}
                disabled={revisandoPOP || !textoPOP.trim()}
                className="w-full"
              >
                {revisandoPOP ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" /> Revisando contra a base...
                  </>
                ) : (
                  <>
                    <FileCheck className="w-4 h-4 mr-2" /> Revisar POP
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {resultadoRevisao && (
            <Card
              className={
                resultadoRevisao.encontrou_resposta
                  ? "border-primary/30"
                  : "border-amber-500/40"
              }
            >
              <CardContent className="pt-4 space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                  <FileCheck className="w-4 h-4 text-primary" />
                  Resultado da Revisão
                </h3>
                <div className="prose prose-sm max-w-none text-foreground">
                  <ReactMarkdown>{resultadoRevisao.resposta}</ReactMarkdown>
                </div>
                {resultadoRevisao.fontes.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Normas verificadas
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {resultadoRevisao.fontes.map((f, idx) => (
                        <a
                          key={idx}
                          href={f.url_oficial}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`text-xs px-2 py-0.5 rounded-md border font-medium hover:opacity-80 ${
                            CATEGORIA_LABELS[f.categoria]?.color ||
                            "bg-muted text-foreground border-border"
                          }`}
                        >
                          {labelFonte(f)} — {f.referencia}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── ABA 4: Radar de Atualizações ─────────────────────────────────── */}
        <TabsContent value="radar" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-sm text-foreground">Radar de Atualizações ANVISA</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Cron diário 06h (pg_cron). O monitor só detecta e alerta — nunca publica nem homologa
                sozinho.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={rodandoMonitor}
                onClick={handleRodarMonitor}
              >
                {rodandoMonitor ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Radar className="w-3.5 h-3.5 mr-1.5" />
                )}
                Rodar monitor agora
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  refetchMonitoramento();
                  refetchAlertas();
                }}
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Atualizar
              </Button>
            </div>
          </div>

          {(alertasPendentes.length > 0 || rehomo.length > 0) && (
            <Alert
              className={
                alertasPendentes.some((a) => a.critico)
                  ? "border-destructive/40 bg-destructive/5"
                  : "border-amber-500/40 bg-amber-500/5"
              }
            >
              <AlertTriangle
                className={`h-4 w-4 ${
                  alertasPendentes.some((a) => a.critico) ? "text-destructive" : "text-amber-600"
                }`}
              />
              <AlertDescription className="text-sm text-foreground">
                <strong>
                  {alertasPendentes.length} alerta
                  {alertasPendentes.length !== 1 ? "s" : ""} normativo
                  {alertasPendentes.length !== 1 ? "s" : ""}
                </strong>{" "}
                pendente{alertasPendentes.length !== 1 ? "s" : ""} de revisão da RT
                {rehomo.length > 0 && (
                  <>
                    {" "}
                    · <strong>{rehomo.length}</strong> constituinte
                    {rehomo.length > 1 ? "s" : ""} exige
                    {rehomo.length === 1 ? "" : "m"} re-homologação
                  </>
                )}
                . O sistema propõe; a RT decide.
              </AlertDescription>
            </Alert>
          )}

          {/* Grupo 1: Alertas normativos */}
          {alertasPendentes.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium flex items-center gap-2 text-foreground">
                <ShieldAlert className="w-4 h-4 text-destructive" />
                Alertas normativos pendentes
              </h4>
              {alertasPendentes.map((a) => (
                <Card
                  key={a.id}
                  className={
                    a.critico ? "border-l-4 border-l-destructive" : "border-l-4 border-l-amber-500"
                  }
                >
                  <CardContent className="pt-3 pb-3 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">{a.titulo}</span>
                          {a.critico && (
                            <Badge variant="destructive" className="text-[10px]">
                              Crítico
                            </Badge>
                          )}
                          {a.norma && (
                            <Badge variant="outline" className="text-[10px]">
                              {a.norma}
                            </Badge>
                          )}
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(a.created_at).toLocaleString("pt-BR")}
                          </span>
                        </div>
                        {a.descricao && (
                          <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                            {a.descricao}
                          </p>
                        )}
                        {a.constituintes_afetados && a.constituintes_afetados.length > 0 && (
                          <p className="text-[11px] text-amber-800 dark:text-amber-200">
                            Possível impacto em {a.constituintes_afetados.length} constituinte(s)
                            homologado(s) — reconfirmar limites.
                          </p>
                        )}
                        {a.fonte_url && (
                          <a
                            href={a.fonte_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-primary hover:underline inline-flex items-center gap-1"
                          >
                            Abrir fonte oficial <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          disabled={marcarAlerta.isPending}
                          onClick={() =>
                            marcarAlerta.mutate(
                              { id: a.id, status: "APROVADO" },
                              { onSuccess: () => toast.success("Alerta marcado como ciente") },
                            )
                          }
                        >
                          <Check className="w-3 h-3 mr-1" /> Ciente
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          disabled={marcarAlerta.isPending}
                          onClick={() =>
                            marcarAlerta.mutate(
                              { id: a.id, status: "DESCARTADO" },
                              { onSuccess: () => toast.message("Alerta descartado") },
                            )
                          }
                        >
                          Descartar
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Grupo 2: Mudanças a revisar */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-foreground">
              Mudanças a revisar
              {pendentes.length > 0 && (
                <span className="ml-2 text-xs font-normal text-amber-700 dark:text-amber-300">
                  ({pendentes.length})
                </span>
              )}
            </h4>

            {pendentes.length === 0 && alertasPendentes.length === 0 ? (
              <Card className="border-emerald-500/30 bg-emerald-500/5">
                <CardContent className="py-6 text-center text-sm text-emerald-700 dark:text-emerald-300 flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Nada pendente — nenhuma mudança ou alerta aguardando a RT.
                </CardContent>
              </Card>
            ) : pendentes.length === 0 ? (
              <Card>
                <CardContent className="py-4 text-center text-sm text-muted-foreground">
                  Nenhuma mudança de hash aguardando revisão.
                </CardContent>
              </Card>
            ) : (
              <>
                <Alert className="border-amber-500/40 bg-amber-500/5">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-foreground text-sm">
                    <strong>
                      {pendentes.length} mudança{pendentes.length > 1 ? "s" : ""} no radar
                    </strong>{" "}
                    (hash) aguardando revisão. Aprovar/descartar não altera a base sozinho — só
                    registra a ciência da RT.
                  </AlertDescription>
                </Alert>
                {pendentes.map((item) => (
                  <Card key={item.id} className="border-amber-500/40 bg-amber-500/5">
                    <CardContent className="pt-3 pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            <span className="text-xs font-semibold text-foreground">
                              {item.fonte_monitorada}
                            </span>
                            <Badge
                              variant="outline"
                              className="text-[10px] border-amber-500/40 text-amber-700 dark:text-amber-300"
                            >
                              MUDANÇA · PENDENTE
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(item.created_at).toLocaleDateString("pt-BR")}
                            </span>
                          </div>
                          {item.resumo_mudanca && (
                            <p className="text-xs text-muted-foreground pl-5">{item.resumo_mudanca}</p>
                          )}
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-primary hover:underline pl-5 inline-flex items-center gap-1"
                          >
                            {item.url.slice(0, 60)}... <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() =>
                              atualizarRadar.mutate({ id: item.id, status: "APROVADO" })
                            }
                          >
                            <Check className="w-3 h-3 mr-1" /> Aprovar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs text-destructive border-destructive/30 hover:bg-destructive/5"
                            onClick={() =>
                              atualizarRadar.mutate({ id: item.id, status: "DESCARTADO" })
                            }
                          >
                            <X className="w-3 h-3 mr-1" /> Descartar
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </>
            )}
          </div>

          {/* Grupo 3: Últimas verificações sem mudança (recolhido) */}
          {verificacoesOk.length > 0 && (
            <details className="group rounded-lg border border-border bg-muted/20">
              <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between gap-2 text-sm text-muted-foreground hover:text-foreground">
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  Últimas verificações sem mudança
                  <span className="text-xs">({verificacoesOk.length})</span>
                </span>
                <ChevronRight className="w-4 h-4 transition-transform group-open:rotate-90" />
              </summary>
              <div className="px-4 pb-3 space-y-2">
                <p className="text-[11px] text-muted-foreground">
                  O monitor rodou e não detectou alteração de conteúdo — não exige ação da RT.
                </p>
                {verificacoesOk.slice(0, 10).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 flex-wrap py-1.5 border-t border-border/50"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span className="text-xs font-medium text-foreground">
                      {item.fonte_monitorada}
                    </span>
                    <Badge variant="secondary" className="text-[10px]">
                      SEM MUDANÇA
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(item.created_at).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                ))}
              </div>
            </details>
          )}

          {monitoramento.length === 0 && alertasPendentes.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                Nenhum registro de monitoramento ainda. O robô executa diariamente às 06h.
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
