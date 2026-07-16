/**
 * Regulatório → Biblioteca do RT
 *
 * Copilot Regulatório travado em fonte oficial.
 * A IA NUNCA responde sem citar pelo menos um chunk da base.
 *
 * Referências: RDC 243/2018, RDC 275/2002, IN 28/2018 (suplementos alimentares)
 * NÃO aplicável: RDC 658/2022 (BPF de medicamentos)
 */

import React, { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  BookOpen, Search, GraduationCap, FileCheck, Radar,
  ExternalLink, AlertTriangle, CheckCircle2, Clock, ShieldAlert, Shield,
  ChevronRight, Loader2, Send, FileText, RefreshCw, Check, X
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
    numero: string;
    ano: number;
    url_oficial: string;
    categoria: string;
  }>;
}

// ─── Mapa de categorias ──────────────────────────────────────────────────────

const CATEGORIA_LABELS: Record<string, { label: string; color: string }> = {
  NUCLEO_SUPLEMENTO:                  { label: "Núcleo Suplemento", color: "bg-green-100 text-green-800 border-green-200" },
  ATUALIZACAO_IN28:                   { label: "Atualização IN 28", color: "bg-blue-100 text-blue-800 border-blue-200" },
  ROTULAGEM:                          { label: "Rotulagem", color: "bg-purple-100 text-purple-800 border-purple-200" },
  BPF_GERAL:                          { label: "BPF Geral", color: "bg-orange-100 text-orange-800 border-orange-200" },
  APOIO_PERGUNTAS_RESPOSTAS:          { label: "P&R Oficial", color: "bg-cyan-100 text-cyan-800 border-cyan-200" },
  REFERENCIA_MEDICAMENTO_NAO_APLICAVEL: { label: "⚠️ Medicamento (não aplicável)", color: "bg-red-100 text-red-800 border-red-200" },
};

const TRILHA_ICONS: Record<string, string> = {
  POPS: "📋", TABELA_NUTRICIONAL: "🥗", BPF: "🏭", ROTULAGEM: "🏷️",
  ALEGACOES: "✅", LIMITES_DOSE: "⚖️", ESTABILIDADE: "🧪", FISCALIZACAO: "🔍",
};

// ─── Componente principal ────────────────────────────────────────────────────

export default function BibliotecaRTPage() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  // ── Estado da aba "Pergunte à Legislação" ──────────────────────────────────
  const [pergunta, setPergunta] = useState("");
  const [respostaRAG, setRespostaRAG] = useState<RespostaRAG | null>(null);
  const [buscando, setBuscando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Estado da aba "Trilhas de Estudo" ─────────────────────────────────────
  const [trilhaSelecionada, setTrilhaSelecionada] = useState<TrilhaEstudo | null>(null);

  // ── Estado da aba "Revisor de POP" ────────────────────────────────────────
  const [textoPOP, setTextoPOP] = useState("");
  const [revisandoPOP, setRevisandoPOP] = useState(false);
  const [resultadoRevisao, setResultadoRevisao] = useState<RespostaRAG | null>(null);

  // ── Queries ────────────────────────────────────────────────────────────────

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

  // ── Mutation: aprovar/descartar item do radar ──────────────────────────────
  const atualizarRadar = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "APROVADO" | "DESCARTADO" }) => {
      const { error } = await supabase
        .from("legislacao_monitoramento")
        .update({ status_revisao: status, revisado_por: user?.id, revisado_em: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["legislacao-monitoramento"] });
      toast.success("Status atualizado com sucesso.");
    },
  });

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handlePergunta = async () => {
    if (!pergunta.trim()) return;
    setBuscando(true);
    setRespostaRAG(null);
    try {
      const { data, error } = await supabase.functions.invoke("legislacao-rag-search", {
        body: {
          pergunta,
          company_id: profile?.company_id,
          usuario_id: user?.id,
        },
      });
      if (error) throw error;
      setRespostaRAG(data as RespostaRAG);
    } catch (err) {
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
      const perguntaRevisao = `Revise o seguinte texto de POP e identifique afirmações que podem não ter base nas normas ANVISA para suplementos alimentares (RDC 243/2018, RDC 275/2002, IN 28/2018). Para cada afirmação suspeita, indique se há ou não sustentação na base:\n\n${textoPOP}`;
      const { data, error } = await supabase.functions.invoke("legislacao-rag-search", {
        body: {
          pergunta: perguntaRevisao,
          company_id: profile?.company_id,
          usuario_id: user?.id,
        },
      });
      if (error) throw error;
      setResultadoRevisao(data as RespostaRAG);
    } catch (err) {
      toast.error("Erro ao revisar o POP. Tente novamente.");
    } finally {
      setRevisandoPOP(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const pendentes = monitoramento.filter(m => m.status_revisao === "PENDENTE" && m.mudanca_detectada);
  const { data: alertasPendentes = [], refetch: refetchAlertas } = useAlertasNormativosPendentes();
  const { data: rehomo = [] } = useConstituintesRequeremRehomologacao();
  const marcarAlerta = useMarcarAlertaRevisado();
  const [rodandoMonitor, setRodandoMonitor] = useState(false);

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
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="w-6 h-6 text-green-700" />
            <h1 className="text-2xl font-bold text-gray-900">Biblioteca do RT</h1>
            <Badge variant="outline" className="text-xs border-green-300 text-green-700">Copilot Regulatório</Badge>
            {alertasPendentes.length > 0 && (
              <Badge variant="destructive" className="text-xs">
                {alertasPendentes.length} alerta{alertasPendentes.length > 1 ? "s" : ""} normativo{alertasPendentes.length > 1 ? "s" : ""}
              </Badge>
            )}
          </div>
          <p className="text-sm text-gray-500">
            Base de conhecimento travada em fonte oficial ANVISA — RDC 243/2018 · RDC 275/2002 · IN 28/2018
          </p>
        </div>
        {pendentes.length > 0 && (
          <Badge className="bg-amber-500 text-white animate-pulse">
            {pendentes.length} atualização{pendentes.length > 1 ? "ões" : ""} pendente{pendentes.length > 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      {/* Aviso sobre RDC 658/2022 */}
      <Alert className="border-amber-300 bg-amber-50">
        <ShieldAlert className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800 text-xs">
          <strong>Atenção:</strong> A RDC 658/2022 é BPF de <strong>medicamentos</strong> e <strong>não se aplica</strong> a suplementos alimentares.
          Para suplementos, as normas aplicáveis são: <strong>RDC 243/2018</strong> (requisitos sanitários) e <strong>RDC 275/2002</strong> (BPF alimentos).
        </AlertDescription>
      </Alert>

      {/* Abas */}
      <Tabs defaultValue="copilot" className="space-y-4">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="copilot" className="flex items-center gap-1.5 text-xs">
            <Search className="w-3.5 h-3.5" /> Pergunte à Legislação
          </TabsTrigger>
          <TabsTrigger value="trilhas" className="flex items-center gap-1.5 text-xs">
            <GraduationCap className="w-3.5 h-3.5" /> Trilhas de Estudo
          </TabsTrigger>
          <TabsTrigger value="revisor" className="flex items-center gap-1.5 text-xs">
            <FileCheck className="w-3.5 h-3.5" /> Revisor de POP
          </TabsTrigger>
          <TabsTrigger value="radar" className="flex items-center gap-1.5 text-xs">
            <Radar className="w-3.5 h-3.5" />
            Radar de Atualizações
            {pendentes.length > 0 && (
              <span className="ml-1 bg-amber-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                {pendentes.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── ABA 1: Pergunte à Legislação ─────────────────────────────────── */}
        <TabsContent value="copilot" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Consulta à Base de Legislação</CardTitle>
              <CardDescription className="text-xs">
                Faça perguntas em linguagem natural. A resposta vem apenas de trechos carregados na base — nunca de conhecimento geral do modelo.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  placeholder="Ex: Qual é o limite de vitamina D por dia para suplementos?"
                  value={pergunta}
                  onChange={e => setPergunta(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handlePergunta()}
                  className="text-sm"
                />
                <Button onClick={handlePergunta} disabled={buscando || !pergunta.trim()} size="sm">
                  {buscando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>

              {/* Sugestões de perguntas */}
              <div className="flex flex-wrap gap-1.5">
                {[
                  "Quais são os 3 avisos obrigatórios no rótulo?",
                  "Posso usar GABA em suplemento?",
                  "Qual a diferença entre RDC 275/2002 e RDC 658/2022?",
                  "Quais POPs são obrigatórios?",
                  "Limite de cafeína por dose?",
                ].map(s => (
                  <button
                    key={s}
                    onClick={() => { setPergunta(s); setTimeout(handlePergunta, 100); }}
                    className="text-xs px-2 py-1 rounded-full border border-gray-200 hover:border-green-400 hover:bg-green-50 transition-colors text-gray-600"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Resposta */}
          {buscando && (
            <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
              <Loader2 className="w-4 h-4 animate-spin" />
              Consultando a base de legislação...
            </div>
          )}

          {respostaRAG && (
            <Card className={respostaRAG.encontrou_resposta ? "border-green-200" : "border-amber-200"}>
              <CardContent className="pt-4 space-y-4">
                {/* Indicador de fonte */}
                <div className="flex items-center gap-2">
                  {respostaRAG.encontrou_resposta ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  )}
                  <span className="text-xs text-gray-500">
                    {respostaRAG.encontrou_resposta
                      ? `Resposta baseada em ${respostaRAG.fontes.length} trecho(s) da base`
                      : "Informação não encontrada na base"}
                  </span>
                </div>

                {/* Texto da resposta */}
                <div className="prose prose-sm max-w-none text-gray-800">
                  <ReactMarkdown>{respostaRAG.resposta}</ReactMarkdown>
                </div>

                {/* Fontes citadas */}
                {respostaRAG.fontes.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Fontes citadas</p>
                    <div className="flex flex-wrap gap-2">
                      {respostaRAG.fontes.map((f, idx) => (
                        <a
                          key={idx}
                          href={f.url_oficial}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border font-medium hover:opacity-80 transition-opacity ${
                            CATEGORIA_LABELS[f.categoria]?.color || "bg-gray-100 text-gray-700 border-gray-200"
                          }`}
                        >
                          {f.tipo !== "OUTRO" ? `${f.tipo} ${f.numero}/${f.ano}` : f.titulo.slice(0, 40)}
                          {f.referencia && ` — ${f.referencia}`}
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      ))}
                    </div>
                    {respostaRAG.fontes.some(f => f.categoria === "REFERENCIA_MEDICAMENTO_NAO_APLICAVEL") && (
                      <Alert className="border-red-200 bg-red-50 mt-2">
                        <AlertTriangle className="h-3 w-3 text-red-600" />
                        <AlertDescription className="text-red-700 text-xs">
                          Uma das fontes citadas (RDC 658/2022) é norma de <strong>medicamentos</strong> e <strong>não se aplica</strong> a suplementos alimentares.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Base de normas — somente leitura para o tenant */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm text-gray-600">Base de Normas Ativas</CardTitle>
                <span className="text-[10px] text-gray-400 flex items-center gap-1">
                  <Shield className="w-3 h-3" /> Gerenciada pelo administrador do sistema
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {fontes.filter(f => f.aprovado_por).map(f => (
                  <div key={f.id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium flex-shrink-0 ${
                        CATEGORIA_LABELS[f.categoria]?.color || "bg-gray-100 text-gray-700 border-gray-200"
                      }`}>
                        {f.tipo !== "OUTRO" ? `${f.tipo} ${f.numero}/${f.ano}` : "DOC"}
                      </span>
                      <span className="text-xs text-gray-700 truncate">{f.titulo}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <span className="text-[10px] text-green-600 flex items-center gap-0.5">
                        <CheckCircle2 className="w-3 h-3" /> Ativa
                      </span>
                      <a href={f.url_oficial} target="_blank" rel="noopener noreferrer"
                        className="text-gray-400 hover:text-green-600 transition-colors">
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                ))}
                {fontes.filter(f => f.aprovado_por).length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-4">Nenhuma norma ativa ainda. O administrador do sistema está carregando a base.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── ABA 2: Trilhas de Estudo ──────────────────────────────────────── */}
        <TabsContent value="trilhas" className="space-y-4">
          {trilhaSelecionada ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{TRILHA_ICONS[trilhaSelecionada.categoria] || "📖"}</span>
                    <div>
                      <CardTitle className="text-base">{trilhaSelecionada.titulo}</CardTitle>
                      <Badge variant="outline" className="text-xs mt-1">
                        {trilhaSelecionada.nivel}
                      </Badge>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setTrilhaSelecionada(null)}>
                    ← Voltar
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none text-gray-800">
                  <ReactMarkdown>{trilhaSelecionada.conteudo_md}</ReactMarkdown>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {trilhas.map(t => (
                <Card
                  key={t.id}
                  className="cursor-pointer hover:border-green-400 hover:shadow-sm transition-all"
                  onClick={() => setTrilhaSelecionada(t)}
                >
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-3">
                      <span className="text-3xl">{TRILHA_ICONS[t.categoria] || "📖"}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-gray-900 leading-tight">{t.titulo}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <Badge variant="outline" className="text-[10px]">{t.nivel}</Badge>
                          <Badge variant="outline" className="text-[10px] text-green-700 border-green-200">
                            {t.categoria.replace(/_/g, " ")}
                          </Badge>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── ABA 3: Revisor de POP ─────────────────────────────────────────── */}
        <TabsContent value="revisor" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Revisor de POP</CardTitle>
              <CardDescription className="text-xs">
                Cole o texto de um POP. O sistema verifica cada afirmação contra a base de legislação e sinaliza trechos sem sustentação em norma oficial.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                placeholder="Cole aqui o texto do POP para revisão..."
                value={textoPOP}
                onChange={e => setTextoPOP(e.target.value)}
                rows={10}
                className="text-sm font-mono"
              />
              <Button
                onClick={handleRevisarPOP}
                disabled={revisandoPOP || !textoPOP.trim()}
                className="w-full"
              >
                {revisandoPOP ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Revisando contra a base...</>
                ) : (
                  <><FileCheck className="w-4 h-4 mr-2" /> Revisar POP</>
                )}
              </Button>
            </CardContent>
          </Card>

          {resultadoRevisao && (
            <Card className={resultadoRevisao.encontrou_resposta ? "border-blue-200" : "border-amber-200"}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-blue-600" />
                  Resultado da Revisão
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="prose prose-sm max-w-none text-gray-800">
                  <ReactMarkdown>{resultadoRevisao.resposta}</ReactMarkdown>
                </div>
                {resultadoRevisao.fontes.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Normas verificadas</p>
                    <div className="flex flex-wrap gap-1.5">
                      {resultadoRevisao.fontes.map((f, idx) => (
                        <a key={idx} href={f.url_oficial} target="_blank" rel="noopener noreferrer"
                          className={`text-xs px-2 py-0.5 rounded-full border font-medium hover:opacity-80 ${
                            CATEGORIA_LABELS[f.categoria]?.color || "bg-gray-100 text-gray-700 border-gray-200"
                          }`}>
                          {f.tipo !== "OUTRO" ? `${f.tipo} ${f.numero}/${f.ano}` : "DOC"} — {f.referencia}
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
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-sm">Radar de Atualizações ANVISA</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Cron diário 06h (pg_cron). O monitor só detecta e alerta — nunca publica nem homologa sozinho.
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
            <Alert className={alertasPendentes.some((a) => a.critico) ? "border-red-300 bg-red-50" : "border-amber-300 bg-amber-50"}>
              <AlertTriangle className={`h-4 w-4 ${alertasPendentes.some((a) => a.critico) ? "text-red-600" : "text-amber-600"}`} />
              <AlertDescription className={`text-sm ${alertasPendentes.some((a) => a.critico) ? "text-red-800" : "text-amber-800"}`}>
                <strong>
                  {alertasPendentes.length} alerta{alertasPendentes.length !== 1 ? "s" : ""} normativo{alertasPendentes.length !== 1 ? "s" : ""}
                </strong>{" "}
                pendente{alertasPendentes.length !== 1 ? "s" : ""} de revisão da RT
                {rehomo.length > 0 && (
                  <> · <strong>{rehomo.length}</strong> constituinte{rehomo.length > 1 ? "s" : ""} exige{rehomo.length === 1 ? "" : "m"} re-homologação</>
                )}
                . O sistema propõe; a RT decide.
              </AlertDescription>
            </Alert>
          )}

          {/* Alertas normativos (anvisa_alertas_normativos) */}
          {alertasPendentes.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-red-600" />
                Alertas normativos pendentes
              </h4>
              {alertasPendentes.map((a) => (
                <Card
                  key={a.id}
                  className={a.critico ? "border-l-4 border-l-red-500" : "border-l-4 border-l-amber-500"}
                >
                  <CardContent className="pt-3 pb-3 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold">{a.titulo}</span>
                          {a.critico && (
                            <Badge variant="destructive" className="text-[10px]">Crítico</Badge>
                          )}
                          {a.norma && (
                            <Badge variant="outline" className="text-[10px]">{a.norma}</Badge>
                          )}
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(a.created_at).toLocaleString("pt-BR")}
                          </span>
                        </div>
                        {a.descricao && (
                          <p className="text-xs text-muted-foreground whitespace-pre-wrap">{a.descricao}</p>
                        )}
                        {a.constituintes_afetados && a.constituintes_afetados.length > 0 && (
                          <p className="text-[11px] text-amber-800">
                            Possível impacto em {a.constituintes_afetados.length} constituinte(s) homologado(s) — reconfirmar limites.
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

          {pendentes.length > 0 && (
            <Alert className="border-amber-300 bg-amber-50">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 text-sm">
                <strong>{pendentes.length} mudança{pendentes.length > 1 ? "s" : ""} no radar</strong> (hash) aguardando revisão.
                Aprovar/descartar não altera a base sozinho — só registra a ciência da RT.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-3">
            {monitoramento.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-sm text-gray-400">
                  Nenhum registro de monitoramento ainda. O robô executa diariamente às 06h.
                </CardContent>
              </Card>
            ) : (
              monitoramento.map(item => (
                <Card key={item.id} className={
                  item.mudanca_detectada && item.status_revisao === "PENDENTE"
                    ? "border-amber-300 bg-amber-50/30"
                    : ""
                }>
                  <CardContent className="pt-3 pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          {item.mudanca_detectada ? (
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                          )}
                          <span className="text-xs font-semibold text-gray-700">{item.fonte_monitorada}</span>
                          <Badge variant="outline" className={`text-[10px] ${
                            item.status_revisao === "PENDENTE" ? "border-amber-300 text-amber-700" :
                            item.status_revisao === "APROVADO" ? "border-green-300 text-green-700" :
                            "border-gray-300 text-gray-500"
                          }`}>
                            {item.status_revisao}
                          </Badge>
                          <span className="text-[10px] text-gray-400">
                            {new Date(item.created_at).toLocaleDateString("pt-BR")}
                          </span>
                        </div>
                        {item.resumo_mudanca && (
                          <p className="text-xs text-gray-600 pl-5">{item.resumo_mudanca}</p>
                        )}
                        <a href={item.url} target="_blank" rel="noopener noreferrer"
                          className="text-[10px] text-blue-500 hover:underline pl-5 flex items-center gap-1">
                          {item.url.slice(0, 60)}... <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </div>

                      {item.status_revisao === "PENDENTE" && item.mudanca_detectada && (
                        <div className="flex gap-1.5 flex-shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-green-300 text-green-700 hover:bg-green-50"
                            onClick={() => atualizarRadar.mutate({ id: item.id, status: "APROVADO" })}
                          >
                            <Check className="w-3 h-3 mr-1" /> Aprovar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-red-200 text-red-600 hover:bg-red-50"
                            onClick={() => atualizarRadar.mutate({ id: item.id, status: "DESCARTADO" })}
                          >
                            <X className="w-3 h-3 mr-1" /> Descartar
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
