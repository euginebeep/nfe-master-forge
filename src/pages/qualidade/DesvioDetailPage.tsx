import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronRight, Save, ShieldAlert, CheckCircle2, Lock } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Switch } from "@/components/ui/switch";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Separator } from "@/components/ui/separator";
import {
  useDesvioDetail,
  isFaseAtiva,
  getProximaFase,
  FASES_LABELS,
  type DesvioCompleto,
  type PlanoAcaoItem,
} from "@/hooks/use-desvio-detail";
import { cn } from "@/lib/utils";

const FASES = ['IDENTIFICACAO', 'CONTENCAO', 'RCA', 'PLANO_ACAO', 'IMPLEMENTACAO', 'VERIFICACAO', 'ENCERRAMENTO'] as const;

export default function DesvioDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === "novo";
  const { data: desvio, isLoading, salvar, avancarFase } = useDesvioDetail(isNew ? undefined : id);

  const [form, setForm] = useState<Partial<DesvioCompleto>>({
    codigo: "",
    tipo: "NAO_CONFORMIDADE",
    severidade: "MEDIA",
    descricao: "",
    status: "ABERTO",
    fase_atual: "IDENTIFICACAO",
    rca_metodo: "5_PORQUES",
    plano_acoes: [],
  });
  const [activeTab, setActiveTab] = useState("IDENTIFICACAO");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (desvio && !loaded) {
      setForm({
        ...desvio,
        plano_acoes: Array.isArray(desvio.plano_acoes) ? desvio.plano_acoes : [],
      });
      setActiveTab(desvio.fase_atual || "IDENTIFICACAO");
      setLoaded(true);
    }
  }, [desvio, loaded]);

  useEffect(() => {
    if (isNew && !loaded) {
      const seq = Date.now().toString().slice(-6);
      setForm(f => ({ ...f, codigo: `DEV-${new Date().getFullYear()}-${seq}` }));
      setLoaded(true);
    }
  }, [isNew, loaded]);

  const update = (field: string, value: any) => setForm(f => ({ ...f, [field]: value }));

  const faseAtual = form.fase_atual || "IDENTIFICACAO";
  const isTabEditable = (fase: string) => fase === faseAtual;
  const isTabAccessible = (fase: string) => isFaseAtiva(faseAtual, fase);

  const handleSave = async () => {
    if (!form.descricao) return;
    const payload = { ...form };
    if (isNew) {
      delete payload.id;
    } else {
      payload.id = id;
    }
    const result = await salvar.mutateAsync(payload);
    if (isNew && result?.id) {
      navigate(`/qualidade/desvios/${result.id}`, { replace: true });
    }
  };

  const handleAvancar = async () => {
    const prox = getProximaFase(faseAtual);
    if (!prox || !form.id) return;
    // Save current data first
    await salvar.mutateAsync({ ...form, id: form.id });
    await avancarFase.mutateAsync({ desvioId: form.id, proximaFase: prox });
    setForm(f => ({ ...f, fase_atual: prox, status: undefined }));
    setActiveTab(prox);
  };

  if (isLoading && !isNew) return <LoadingSpinner fullPage text="Carregando desvio..." />;

  const proxFase = getProximaFase(faseAtual);

  // Plano de ação helpers
  const acoes: PlanoAcaoItem[] = (form.plano_acoes as PlanoAcaoItem[]) || [];
  const addAcao = () => {
    const nova: PlanoAcaoItem = { id: crypto.randomUUID(), descricao: "", responsavel: "", prazo: "", status: "PENDENTE" };
    update("plano_acoes", [...acoes, nova]);
  };
  const updateAcao = (idx: number, field: string, value: string) => {
    const updated = [...acoes];
    updated[idx] = { ...updated[idx], [field]: value };
    update("plano_acoes", updated);
  };
  const removeAcao = (idx: number) => {
    update("plano_acoes", acoes.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={isNew ? "Novo Desvio / CAPA" : `Desvio ${form.codigo || ""}`}
        description={isNew ? "Registrar novo desvio com workflow CAPA completo" : `Fase atual: ${FASES_LABELS[faseAtual]}`}
        icon={ShieldAlert}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/qualidade/desvios")}>
              <ArrowLeft className="h-4 w-4 mr-2" />Voltar
            </Button>
            <Button onClick={handleSave} disabled={salvar.isPending || !form.descricao}>
              <Save className="h-4 w-4 mr-2" />{salvar.isPending ? "Salvando..." : "Salvar"}
            </Button>
            {!isNew && proxFase && (
              <Button variant="default" className="bg-success hover:bg-success/90" onClick={handleAvancar} disabled={avancarFase.isPending}>
                <ChevronRight className="h-4 w-4 mr-2" />
                Avançar para {FASES_LABELS[proxFase]}
              </Button>
            )}
          </div>
        }
      />

      {/* Progress bar */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-1">
            {FASES.map((fase, idx) => {
              const isActive = fase === faseAtual;
              const isDone = isFaseAtiva(faseAtual, fase) && fase !== faseAtual;
              const isLocked = !isFaseAtiva(faseAtual, fase);
              return (
                <div key={fase} className="flex items-center flex-1">
                  <button
                    onClick={() => isTabAccessible(fase) && setActiveTab(fase)}
                    disabled={isLocked}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium w-full transition-all",
                      isActive && "bg-primary text-primary-foreground shadow-sm",
                      isDone && "bg-success/10 text-success cursor-pointer hover:bg-success/20",
                      isLocked && "bg-muted text-muted-foreground/50 cursor-not-allowed",
                      !isActive && !isDone && !isLocked && "bg-muted text-muted-foreground cursor-pointer hover:bg-muted/80"
                    )}
                  >
                    {isDone ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> : isLocked ? <Lock className="h-3.5 w-3.5 shrink-0" /> : <span className="h-3.5 w-3.5 shrink-0 rounded-full bg-current opacity-40" />}
                    <span className="truncate">{FASES_LABELS[fase]}</span>
                  </button>
                  {idx < FASES.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0 mx-0.5" />}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Tab content */}
      <Tabs value={activeTab} onValueChange={v => isTabAccessible(v) && setActiveTab(v)}>
        <TabsList className="sr-only">
          {FASES.map(f => <TabsTrigger key={f} value={f}>{FASES_LABELS[f]}</TabsTrigger>)}
        </TabsList>

        {/* 1. IDENTIFICAÇÃO */}
        <TabsContent value="IDENTIFICACAO">
          <Card>
            <CardHeader><CardTitle>Identificação do Desvio</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div><Label>Código</Label><Input value={form.codigo || ""} onChange={e => update("codigo", e.target.value)} disabled={!isTabEditable("IDENTIFICACAO")} /></div>
                <div><Label>Tipo</Label>
                  <Select value={form.tipo || ""} onValueChange={v => update("tipo", v)} disabled={!isTabEditable("IDENTIFICACAO")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NAO_CONFORMIDADE">Não Conformidade</SelectItem>
                      <SelectItem value="DESVIO_PROCESSO">Desvio de Processo</SelectItem>
                      <SelectItem value="RECLAMACAO">Reclamação</SelectItem>
                      <SelectItem value="AUDITORIA">Auditoria</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Severidade</Label>
                  <Select value={form.severidade || ""} onValueChange={v => update("severidade", v)} disabled={!isTabEditable("IDENTIFICACAO")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BAIXA">Baixa</SelectItem>
                      <SelectItem value="MEDIA">Média</SelectItem>
                      <SelectItem value="ALTA">Alta</SelectItem>
                      <SelectItem value="CRITICA">Crítica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Descrição do Desvio *</Label><Textarea value={form.descricao || ""} onChange={e => update("descricao", e.target.value)} rows={3} disabled={!isTabEditable("IDENTIFICACAO")} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Prazo para Resolução</Label><Input type="date" value={form.prazo || ""} onChange={e => update("prazo", e.target.value)} disabled={!isTabEditable("IDENTIFICACAO")} /></div>
                <div><Label>Status</Label><Input value={form.status || "ABERTO"} disabled className="bg-muted" /></div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 2. CONTENÇÃO */}
        <TabsContent value="CONTENCAO">
          <Card>
            <CardHeader><CardTitle>Ação de Contenção Imediata</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div><Label>Descrição da Contenção</Label><Textarea value={form.contencao_descricao || ""} onChange={e => update("contencao_descricao", e.target.value)} rows={3} disabled={!isTabEditable("CONTENCAO")} placeholder="Descreva as ações imediatas tomadas para conter o problema..." /></div>
              <div className="grid grid-cols-3 gap-4">
                <div><Label>Responsável</Label><Input value={form.contencao_responsavel || ""} onChange={e => update("contencao_responsavel", e.target.value)} disabled={!isTabEditable("CONTENCAO")} /></div>
                <div><Label>Data Início</Label><Input type="date" value={form.contencao_data_inicio || ""} onChange={e => update("contencao_data_inicio", e.target.value)} disabled={!isTabEditable("CONTENCAO")} /></div>
                <div><Label>Data Fim</Label><Input type="date" value={form.contencao_data_fim || ""} onChange={e => update("contencao_data_fim", e.target.value)} disabled={!isTabEditable("CONTENCAO")} /></div>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={!!form.contencao_eficaz} onCheckedChange={v => update("contencao_eficaz", v)} disabled={!isTabEditable("CONTENCAO")} />
                <Label>Contenção foi eficaz?</Label>
              </div>
              <div><Label>Evidências</Label><Textarea value={form.contencao_evidencias || ""} onChange={e => update("contencao_evidencias", e.target.value)} rows={2} disabled={!isTabEditable("CONTENCAO")} placeholder="Referências, fotos, documentos..." /></div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 3. RCA */}
        <TabsContent value="RCA">
          <Card>
            <CardHeader><CardTitle>Análise de Causa Raiz (RCA)</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Método de Análise</Label>
                  <Select value={form.rca_metodo || "5_PORQUES"} onValueChange={v => update("rca_metodo", v)} disabled={!isTabEditable("RCA")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5_PORQUES">5 Porquês</SelectItem>
                      <SelectItem value="ISHIKAWA">Diagrama de Ishikawa</SelectItem>
                      <SelectItem value="PARETO">Análise de Pareto</SelectItem>
                      <SelectItem value="FMEA">FMEA</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Descrição da Análise</Label><Textarea value={form.rca_descricao || ""} onChange={e => update("rca_descricao", e.target.value)} rows={3} disabled={!isTabEditable("RCA")} placeholder="Descreva o processo de investigação da causa raiz..." /></div>
              {(form.rca_metodo === "5_PORQUES" || !form.rca_metodo) && (
                <div className="space-y-3 border rounded-lg p-4 bg-muted/30">
                  <h4 className="font-medium text-sm">5 Porquês</h4>
                  {[1, 2, 3, 4, 5].map(n => (
                    <div key={n}><Label>Por quê {n}?</Label><Input value={(form as any)[`rca_por_que_${n}`] || ""} onChange={e => update(`rca_por_que_${n}`, e.target.value)} disabled={!isTabEditable("RCA")} placeholder={`Resposta ${n}...`} /></div>
                  ))}
                </div>
              )}
              <div><Label>Conclusão / Causa Raiz Identificada</Label><Textarea value={form.rca_conclusao || ""} onChange={e => update("rca_conclusao", e.target.value)} rows={2} disabled={!isTabEditable("RCA")} placeholder="Qual foi a causa raiz identificada?" /></div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 4. PLANO DE AÇÃO */}
        <TabsContent value="PLANO_ACAO">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Plano de Ação (CAPA)</CardTitle>
                {isTabEditable("PLANO_ACAO") && (
                  <Button size="sm" onClick={addAcao}>+ Adicionar Ação</Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div><Label>Ação Corretiva Geral</Label><Textarea value={form.acao_corretiva || ""} onChange={e => update("acao_corretiva", e.target.value)} rows={2} disabled={!isTabEditable("PLANO_ACAO")} /></div>
              <div><Label>Ação Preventiva Geral</Label><Textarea value={form.acao_preventiva || ""} onChange={e => update("acao_preventiva", e.target.value)} rows={2} disabled={!isTabEditable("PLANO_ACAO")} /></div>
              <Separator />
              <h4 className="font-medium text-sm">Ações Individuais</h4>
              {acoes.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma ação cadastrada. Clique em "+ Adicionar Ação".</p>}
              {acoes.map((acao, idx) => (
                <div key={acao.id} className="border rounded-lg p-4 space-y-3 bg-muted/20">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline">Ação #{idx + 1}</Badge>
                    {isTabEditable("PLANO_ACAO") && <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeAcao(idx)}>Remover</Button>}
                  </div>
                  <div><Label>Descrição</Label><Textarea value={acao.descricao} onChange={e => updateAcao(idx, "descricao", e.target.value)} rows={2} disabled={!isTabEditable("PLANO_ACAO")} /></div>
                  <div className="grid grid-cols-3 gap-4">
                    <div><Label>Responsável</Label><Input value={acao.responsavel} onChange={e => updateAcao(idx, "responsavel", e.target.value)} disabled={!isTabEditable("PLANO_ACAO")} /></div>
                    <div><Label>Prazo</Label><Input type="date" value={acao.prazo} onChange={e => updateAcao(idx, "prazo", e.target.value)} disabled={!isTabEditable("PLANO_ACAO")} /></div>
                    <div><Label>Status</Label>
                      <Select value={acao.status} onValueChange={v => updateAcao(idx, "status", v)} disabled={!isTabEditable("PLANO_ACAO")}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PENDENTE">Pendente</SelectItem>
                          <SelectItem value="EM_ANDAMENTO">Em Andamento</SelectItem>
                          <SelectItem value="CONCLUIDA">Concluída</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 5. IMPLEMENTAÇÃO */}
        <TabsContent value="IMPLEMENTACAO">
          <Card>
            <CardHeader><CardTitle>Implementação das Ações</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div><Label>Observações da Implementação</Label><Textarea value={form.impl_observacoes || ""} onChange={e => update("impl_observacoes", e.target.value)} rows={3} disabled={!isTabEditable("IMPLEMENTACAO")} placeholder="Descreva como as ações foram implementadas..." /></div>
              <div className="grid grid-cols-3 gap-4">
                <div><Label>Responsável</Label><Input value={form.impl_responsavel || ""} onChange={e => update("impl_responsavel", e.target.value)} disabled={!isTabEditable("IMPLEMENTACAO")} /></div>
                <div><Label>Data Início</Label><Input type="date" value={form.impl_data_inicio || ""} onChange={e => update("impl_data_inicio", e.target.value)} disabled={!isTabEditable("IMPLEMENTACAO")} /></div>
                <div><Label>Data Fim</Label><Input type="date" value={form.impl_data_fim || ""} onChange={e => update("impl_data_fim", e.target.value)} disabled={!isTabEditable("IMPLEMENTACAO")} /></div>
              </div>
              <div><Label>Evidências da Implementação</Label><Textarea value={form.impl_evidencias || ""} onChange={e => update("impl_evidencias", e.target.value)} rows={2} disabled={!isTabEditable("IMPLEMENTACAO")} placeholder="Fotos, registros, documentos comprobatórios..." /></div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 6. VERIFICAÇÃO */}
        <TabsContent value="VERIFICACAO">
          <Card>
            <CardHeader><CardTitle>Verificação de Eficácia</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div><Label>Método de Verificação</Label><Textarea value={form.verif_metodo || ""} onChange={e => update("verif_metodo", e.target.value)} rows={2} disabled={!isTabEditable("VERIFICACAO")} placeholder="Como foi verificada a eficácia das ações?" /></div>
              <div><Label>Resultado da Verificação</Label><Textarea value={form.verif_resultado || ""} onChange={e => update("verif_resultado", e.target.value)} rows={3} disabled={!isTabEditable("VERIFICACAO")} placeholder="Descreva os resultados obtidos..." /></div>
              <div className="grid grid-cols-3 gap-4">
                <div><Label>Responsável</Label><Input value={form.verif_responsavel || ""} onChange={e => update("verif_responsavel", e.target.value)} disabled={!isTabEditable("VERIFICACAO")} /></div>
                <div><Label>Data da Verificação</Label><Input type="date" value={form.verif_data || ""} onChange={e => update("verif_data", e.target.value)} disabled={!isTabEditable("VERIFICACAO")} /></div>
                <div className="flex items-end gap-3 pb-1">
                  <Switch checked={!!form.verif_eficaz} onCheckedChange={v => update("verif_eficaz", v)} disabled={!isTabEditable("VERIFICACAO")} />
                  <Label>Ações foram eficazes?</Label>
                </div>
              </div>
              <div><Label>Evidências</Label><Textarea value={form.verif_evidencias || ""} onChange={e => update("verif_evidencias", e.target.value)} rows={2} disabled={!isTabEditable("VERIFICACAO")} /></div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 7. ENCERRAMENTO */}
        <TabsContent value="ENCERRAMENTO">
          <Card>
            <CardHeader><CardTitle>Encerramento do CAPA</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Aprovado por</Label><Input value={form.encerramento_aprovado_por || ""} onChange={e => update("encerramento_aprovado_por", e.target.value)} disabled={!isTabEditable("ENCERRAMENTO")} /></div>
                <div><Label>Data de Encerramento</Label><Input type="date" value={form.encerramento_data || ""} onChange={e => update("encerramento_data", e.target.value)} disabled={!isTabEditable("ENCERRAMENTO")} /></div>
              </div>
              <div><Label>Observações Finais</Label><Textarea value={form.encerramento_observacoes || ""} onChange={e => update("encerramento_observacoes", e.target.value)} rows={3} disabled={!isTabEditable("ENCERRAMENTO")} /></div>
              <div><Label>Lições Aprendidas</Label><Textarea value={form.encerramento_licoes_aprendidas || ""} onChange={e => update("encerramento_licoes_aprendidas", e.target.value)} rows={3} disabled={!isTabEditable("ENCERRAMENTO")} placeholder="O que aprendemos com este desvio? Como evitar recorrências?" /></div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
