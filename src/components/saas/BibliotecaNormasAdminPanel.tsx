/**
 * BibliotecaNormasAdminPanel
 *
 * Painel exclusivo do administrador SaaS (/saas) para gerenciar a base global
 * de legislação do Copilot Regulatório.
 *
 * REGRA: normas aprovadas aqui ficam disponíveis para TODOS os tenants.
 * Nenhum tenant pode adicionar ou modificar normas — apenas consultar.
 *
 * Fluxo:
 * 1. Admin cola o texto completo da norma (PDF copiado ou digitado)
 * 2. Clica em "Salvar Texto" — fica com status "Aguardando aprovação"
 * 3. Admin revisa e clica em "Aprovar e Processar" → dispara legislacao-ingest
 * 4. Edge Function chunka, gera embeddings e grava em legislacao_chunks
 * 5. Norma fica disponível para consulta em todos os tenants
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  BookOpen, Upload, CheckCircle2, Clock, AlertTriangle, Loader2,
  ExternalLink, RefreshCw, FileText, Zap, Eye, Edit3, ShieldAlert, Globe
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { invokeEdge } from "@/lib/edge-invoke";

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
  texto_completo: string | null;
  created_at: string;
}

interface ChunkCount {
  fonte_id: string;
  count: number;
}

// ─── Labels de categoria ─────────────────────────────────────────────────────

const CATEGORIA_LABELS: Record<string, { label: string; color: string }> = {
  NUCLEO_SUPLEMENTO:                  { label: "Núcleo Suplemento", color: "bg-green-100 text-green-800 border-green-200" },
  ATUALIZACAO_IN28:                   { label: "Atualização IN 28", color: "bg-blue-100 text-blue-800 border-blue-200" },
  ROTULAGEM:                          { label: "Rotulagem", color: "bg-purple-100 text-purple-800 border-purple-200" },
  BPF_GERAL:                          { label: "BPF Geral", color: "bg-orange-100 text-orange-800 border-orange-200" },
  APOIO_PERGUNTAS_RESPOSTAS:          { label: "P&R Oficial", color: "bg-cyan-100 text-cyan-800 border-cyan-200" },
  REFERENCIA_MEDICAMENTO_NAO_APLICAVEL: { label: "⚠️ Medicamento (não aplicável)", color: "bg-red-100 text-red-800 border-red-200" },
};

// ─── Componente ──────────────────────────────────────────────────────────────

export function BibliotecaNormasAdminPanel() {
  const queryClient = useQueryClient();

  // Estado do dialog de edição
  const [fonteEditando, setFonteEditando] = useState<LegislacaoFonte | null>(null);
  const [textoEdit, setTextoEdit] = useState("");
  const [processando, setProcessando] = useState<string | null>(null);

  // Estado do dialog de nova norma
  const [novaFonteOpen, setNovaFonteOpen] = useState(false);
  const [novaFonte, setNovaFonte] = useState({
    tipo: "RDC",
    numero: "",
    ano: new Date().getFullYear(),
    titulo: "",
    categoria: "NUCLEO_SUPLEMENTO",
    url_oficial: "",
    texto_completo: "",
  });

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: fontes = [], isLoading, refetch } = useQuery<LegislacaoFonte[]>({
    queryKey: ["saas-legislacao-fontes"],
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

  const { data: chunkCounts = [] } = useQuery<ChunkCount[]>({
    queryKey: ["saas-chunk-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("legislacao_chunks")
        .select("fonte_id")
        .then(({ data, error }) => {
          if (error) throw error;
          const counts: Record<string, number> = {};
          (data || []).forEach(r => {
            counts[r.fonte_id] = (counts[r.fonte_id] || 0) + 1;
          });
          return { data: Object.entries(counts).map(([fonte_id, count]) => ({ fonte_id, count })), error: null };
        });
      if (error) throw error;
      return data || [];
    },
  });

  const chunkMap: Record<string, number> = {};
  chunkCounts.forEach(c => { chunkMap[c.fonte_id] = c.count; });

  // ── Mutations ──────────────────────────────────────────────────────────────

  const salvarTexto = useMutation({
    mutationFn: async ({ id, texto }: { id: string; texto: string }) => {
      const { error } = await supabase
        .from("legislacao_fontes")
        .update({ texto_completo: texto, status: "AGUARDANDO_APROVACAO" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saas-legislacao-fontes"] });
      toast.success("Texto salvo. Agora revise e aprove para processar.");
      setFonteEditando(null);
    },
    onError: () => toast.error("Erro ao salvar texto."),
  });

  const criarFonte = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("legislacao_fontes")
        .insert({
          ...novaFonte,
          status: novaFonte.texto_completo ? "AGUARDANDO_APROVACAO" : "PENDENTE_TEXTO",
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saas-legislacao-fontes"] });
      toast.success("Norma adicionada à base.");
      setNovaFonteOpen(false);
      setNovaFonte({ tipo: "RDC", numero: "", ano: new Date().getFullYear(), titulo: "", categoria: "NUCLEO_SUPLEMENTO", url_oficial: "", texto_completo: "" });
    },
    onError: () => toast.error("Erro ao criar norma."),
  });

  // ── Handler: Aprovar e Processar (dispara ingest) ──────────────────────────

  const aprovarEProcessar = async (fonte: LegislacaoFonte) => {
    if (!fonte.texto_completo?.trim()) {
      toast.error("Adicione o texto completo da norma antes de processar.");
      return;
    }
    setProcessando(fonte.id);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user?.id) {
        toast.error("Sessão inválida. Faça login novamente para aprovar a norma.");
        return;
      }

      const { data, error } = await invokeEdge<{
        chunks_gerados?: number;
        fonte?: string;
      }>("legislacao-ingest", {
        fonte_id: fonte.id,
        aprovado_por: user.id, // uuid do admin logado (coluna é uuid)
      });
      if (error) throw new Error(error);
      toast.success(`✅ ${data?.chunks_gerados} trechos processados para ${data?.fonte}. Disponível para todos os tenants.`);
      queryClient.invalidateQueries({ queryKey: ["saas-legislacao-fontes"] });
      queryClient.invalidateQueries({ queryKey: ["saas-chunk-counts"] });
    } catch (err) {
      toast.error(`Erro ao processar: ${String(err)}`);
    } finally {
      setProcessando(null);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const totalChunks = Object.values(chunkMap).reduce((a, b) => a + b, 0);
  const fontesAtivas = fontes.filter(f => f.aprovado_por);
  const fontesPendentes = fontes.filter(f => !f.aprovado_por && f.texto_completo);
  const fontesSemTexto = fontes.filter(f => !f.texto_completo);

  return (
    <div className="space-y-6">
      {/* Cabeçalho + métricas */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="w-5 h-5 text-green-700" />
            <h2 className="text-lg font-bold text-gray-900">Base Global de Legislação</h2>
            <Badge variant="outline" className="text-xs border-green-300 text-green-700 flex items-center gap-1">
              <Globe className="w-3 h-3" /> Global — todos os tenants
            </Badge>
          </div>
          <p className="text-xs text-gray-500">
            Normas aprovadas aqui ficam disponíveis para consulta em <strong>todos os tenants</strong>. Nenhum tenant pode modificar a base.
          </p>
        </div>
        <Button size="sm" onClick={() => setNovaFonteOpen(true)} className="bg-green-700 hover:bg-green-800">
          <FileText className="w-3.5 h-3.5 mr-1.5" /> Adicionar Norma
        </Button>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Normas ativas", value: fontesAtivas.length, icon: CheckCircle2, color: "text-green-600" },
          { label: "Aguardando aprovação", value: fontesPendentes.length, icon: Clock, color: "text-amber-500" },
          { label: "Sem texto", value: fontesSemTexto.length, icon: AlertTriangle, color: "text-red-500" },
          { label: "Trechos indexados", value: totalChunks.toLocaleString("pt-BR"), icon: Zap, color: "text-blue-600" },
        ].map(m => (
          <Card key={m.label} className="border-0 shadow-sm">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <m.icon className={`w-4 h-4 ${m.color}`} />
                <div>
                  <p className="text-lg font-black leading-none">{m.value}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">{m.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Aviso RDC 658/2022 */}
      <Alert className="border-amber-300 bg-amber-50">
        <ShieldAlert className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800 text-xs">
          <strong>Regra de curadoria:</strong> Nunca adicione a RDC 658/2022 como norma aplicável a suplementos alimentares — ela é BPF de <strong>medicamentos</strong>.
          Para suplementos: <strong>RDC 243/2018</strong> (requisitos sanitários) e <strong>RDC 275/2002</strong> (BPF alimentos).
        </AlertDescription>
      </Alert>

      {/* Tabela de normas */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Catálogo de Normas</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-3.5 h-3.5 mr-1" /> Atualizar
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="text-xs">Norma</TableHead>
                <TableHead className="text-xs">Título</TableHead>
                <TableHead className="text-xs">Categoria</TableHead>
                <TableHead className="text-xs text-center">Trechos</TableHead>
                <TableHead className="text-xs text-center">Status</TableHead>
                <TableHead className="text-xs text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-xs text-gray-400"><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Carregando...</TableCell></TableRow>
              ) : fontes.map(f => (
                <TableRow key={f.id} className="hover:bg-gray-50/50">
                  <TableCell className="text-xs font-semibold whitespace-nowrap">
                    {f.tipo} {f.numero}/{f.ano}
                  </TableCell>
                  <TableCell className="text-xs text-gray-700 max-w-[280px]">
                    <div className="truncate">{f.titulo}</div>
                    <a href={f.url_oficial} target="_blank" rel="noopener noreferrer"
                      className="text-[10px] text-blue-400 hover:underline flex items-center gap-0.5 mt-0.5">
                      Fonte oficial <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </TableCell>
                  <TableCell>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${
                      CATEGORIA_LABELS[f.categoria]?.color || "bg-gray-100 text-gray-700 border-gray-200"
                    }`}>
                      {CATEGORIA_LABELS[f.categoria]?.label || f.categoria}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    {chunkMap[f.id] ? (
                      <span className="text-xs font-semibold text-green-700">{chunkMap[f.id]}</span>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {f.aprovado_por ? (
                      <span className="inline-flex items-center gap-1 text-[10px] text-green-700 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3" /> Ativa
                      </span>
                    ) : f.texto_completo ? (
                      <span className="inline-flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                        <Clock className="w-3 h-3" /> Aguardando aprovação
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full">
                        <AlertTriangle className="w-3 h-3" /> Sem texto
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {/* Botão: editar/adicionar texto */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => { setFonteEditando(f); setTextoEdit(f.texto_completo || ""); }}
                      >
                        <Edit3 className="w-3 h-3 mr-1" />
                        {f.texto_completo ? "Editar" : "Adicionar texto"}
                      </Button>
                      {/* Botão: aprovar e processar */}
                      {f.texto_completo && !f.aprovado_por && (
                        <Button
                          size="sm"
                          className="h-7 text-xs bg-green-700 hover:bg-green-800"
                          disabled={processando === f.id}
                          onClick={() => aprovarEProcessar(f)}
                        >
                          {processando === f.id ? (
                            <Loader2 className="w-3 h-3 animate-spin mr-1" />
                          ) : (
                            <Zap className="w-3 h-3 mr-1" />
                          )}
                          Aprovar e Processar
                        </Button>
                      )}
                      {/* Botão: reprocessar (já aprovada) */}
                      {f.aprovado_por && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          disabled={processando === f.id}
                          onClick={() => aprovarEProcessar(f)}
                        >
                          {processando === f.id ? (
                            <Loader2 className="w-3 h-3 animate-spin mr-1" />
                          ) : (
                            <RefreshCw className="w-3 h-3 mr-1" />
                          )}
                          Reprocessar
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ── Dialog: Editar texto da norma ─────────────────────────────────── */}
      <Dialog open={!!fonteEditando} onOpenChange={() => setFonteEditando(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-green-700" />
              {fonteEditando?.tipo} {fonteEditando?.numero}/{fonteEditando?.ano}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Cole o texto completo da norma. Pode ser copiado do PDF oficial ou do site da ANVISA.
              Após salvar, clique em "Aprovar e Processar" para indexar os trechos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Alert className="border-blue-200 bg-blue-50">
              <AlertDescription className="text-blue-800 text-xs">
                <strong>Dica:</strong> Copie o texto diretamente do PDF da norma (Ctrl+A → Ctrl+C no visualizador de PDF).
                O sistema divide automaticamente por artigos, parágrafos e anexos.
              </AlertDescription>
            </Alert>
            <Textarea
              value={textoEdit}
              onChange={e => setTextoEdit(e.target.value)}
              placeholder={`Cole aqui o texto completo da ${fonteEditando?.tipo} ${fonteEditando?.numero}/${fonteEditando?.ano}...\n\nArt. 1° ...\nArt. 2° ...\n\nAnexo I — ...`}
              rows={20}
              className="text-xs font-mono resize-none"
            />
            <p className="text-[10px] text-gray-400">
              {textoEdit.length.toLocaleString("pt-BR")} caracteres · ~{Math.ceil(textoEdit.split(/\s+/).length / 500)} páginas estimadas
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFonteEditando(null)}>Cancelar</Button>
            <Button
              className="bg-green-700 hover:bg-green-800"
              disabled={!textoEdit.trim() || salvarTexto.isPending}
              onClick={() => fonteEditando && salvarTexto.mutate({ id: fonteEditando.id, texto: textoEdit })}
            >
              {salvarTexto.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
              Salvar Texto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Nova norma ────────────────────────────────────────────── */}
      <Dialog open={novaFonteOpen} onOpenChange={setNovaFonteOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-green-700" />
              Adicionar Nova Norma
            </DialogTitle>
            <DialogDescription className="text-xs">
              Preencha os metadados da norma. O texto pode ser adicionado depois.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select value={novaFonte.tipo} onValueChange={v => setNovaFonte(p => ({ ...p, tipo: v }))}>
                <SelectTrigger className="h-8 text-xs mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["RDC", "IN", "RN", "RE", "PORTARIA", "LEI", "DECRETO", "OUTRO"].map(t => (
                    <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Número</Label>
              <Input className="h-8 text-xs mt-1" value={novaFonte.numero} onChange={e => setNovaFonte(p => ({ ...p, numero: e.target.value }))} placeholder="243" />
            </div>
            <div>
              <Label className="text-xs">Ano</Label>
              <Input className="h-8 text-xs mt-1" type="number" value={novaFonte.ano} onChange={e => setNovaFonte(p => ({ ...p, ano: Number(e.target.value) }))} />
            </div>
          </div>

          <div>
            <Label className="text-xs">Título completo</Label>
            <Input className="h-8 text-xs mt-1" value={novaFonte.titulo} onChange={e => setNovaFonte(p => ({ ...p, titulo: e.target.value }))} placeholder="Dispõe sobre os requisitos sanitários dos suplementos alimentares..." />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Categoria</Label>
              <Select value={novaFonte.categoria} onValueChange={v => setNovaFonte(p => ({ ...p, categoria: v }))}>
                <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORIA_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k} className="text-xs">{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">URL Oficial</Label>
              <Input className="h-8 text-xs mt-1" value={novaFonte.url_oficial} onChange={e => setNovaFonte(p => ({ ...p, url_oficial: e.target.value }))} placeholder="https://www.gov.br/anvisa/..." />
            </div>
          </div>

          <div>
            <Label className="text-xs">Texto completo (opcional — pode adicionar depois)</Label>
            <Textarea
              className="text-xs font-mono mt-1"
              rows={8}
              value={novaFonte.texto_completo}
              onChange={e => setNovaFonte(p => ({ ...p, texto_completo: e.target.value }))}
              placeholder="Cole o texto da norma aqui (opcional)..."
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setNovaFonteOpen(false)}>Cancelar</Button>
            <Button
              className="bg-green-700 hover:bg-green-800"
              disabled={!novaFonte.numero || !novaFonte.titulo || criarFonte.isPending}
              onClick={() => criarFonte.mutate()}
            >
              {criarFonte.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <BookOpen className="w-4 h-4 mr-2" />}
              Adicionar Norma
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
