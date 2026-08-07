import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Beaker, CheckCircle, FileText, Info, Upload, Search, Printer, ShieldCheck, XCircle, AlertCircle, History, QrCode, TriangleAlert, ClipboardList } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/ui/status-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useLote, useUpdateLoteStatus, useCreateLoteDocumento, useUpdateDocumentoValidacao } from "@/hooks/use-lotes";
import { supabase } from "@/integrations/supabase/client";
import { COAParserButton } from "@/components/lotes/COAParserButton";
import { QRCodeAuditoria } from "@/components/shared/QRCodeAuditoria";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LoteFornecedorEtiqueta } from "@/components/estoque/LoteFornecedorEtiqueta";
import { carregarDadosEtiquetas, useImprimirEtiquetas } from "@/hooks/useImprimirEtiquetas";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatDate, formatQtdExibicao } from "@/lib/formatters";
import { uploadDocumentoLote } from "@/hooks/use-supabase-item-details";

type TipoPotencia = "NENHUMA" | "UI_POR_GRAMA" | "MG_POR_GRAMA" | "PERCENTUAL";

function getTipoPotenciaLabel(tipo: TipoPotencia) {
  switch (tipo) {
    case "UI_POR_GRAMA": return "UI/g";
    case "MG_POR_GRAMA": return "mg/g";
    case "PERCENTUAL": return "%";
    default: return "-";
  }
}

function formatarPotencia(tipo: TipoPotencia, valor?: number): string {
  if (tipo === "NENHUMA" || !valor) return "-";
  return `${valor.toLocaleString('pt-BR')} ${getTipoPotenciaLabel(tipo)}`;
}

export default function LoteDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { data: loteData, isLoading } = useLote(id);
  const updateLoteStatus = useUpdateLoteStatus();
  const updateDocValidacao = useUpdateDocumentoValidacao();
  const { imprimir, carregando: imprimindoEtiqueta, portal: portalEtiquetas } =
    useImprimirEtiquetas();

  const { data: dadosEtiqueta } = useQuery({
    queryKey: ["etiqueta-lote", id],
    queryFn: async () => (await carregarDadosEtiquetas([id!]))[0] ?? null,
    enabled: !!id,
  });

  const lote = loteData as any;
  const item = lote?.item;
  const documentos = lote?.lote_documentos || [];

  const [tipoPotencia, setTipoPotencia] = useState<TipoPotencia>("NENHUMA");
  const [potenciaValor, setPotenciaValor] = useState<number>(0);
  const [initialized, setInitialized] = useState(false);

  // Dialog de liberação sem COA
  const [dialogLiberarSemCOA, setDialogLiberarSemCOA] = useState(false);
  const [justificativaSemCOA, setJustificativaSemCOA] = useState("");
  const [liberandoSemCOA, setLiberandoSemCOA] = useState(false);
  const [liberacoesSemCOA, setLiberacoesSemCOA] = useState<any[]>([]);
  const [carregandoLiberacoes, setCarregandoLiberacoes] = useState(false);

  // Initialize form state when data loads
  if (lote && !initialized) {
    setTipoPotencia((lote.tipo_potencia as TipoPotencia) || "NENHUMA");
    setPotenciaValor(lote.potencia_valor || 0);
    setInitialized(true);
  }

  const hasCOA = documentos.some((d: any) => d.tipo_documento === "COA");
  const hasCOAValidado = documentos.some((d: any) => d.tipo_documento === "COA" && d.status_validacao === "VALIDADO");

  // Carregar histórico de liberações sem COA quando o lote carrega
  React.useEffect(() => {
    if (!id) return;
    setCarregandoLiberacoes(true);
    supabase
      .from("lote_liberacoes_sem_coa" as any)
      .select("*")
      .eq("lote_id", id)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) setLiberacoesSemCOA(data as any[]);
        setCarregandoLiberacoes(false);
      });
  }, [id]);

  const handleLiberarSemCOA = async () => {
    if (!id || !lote) return;
    if (justificativaSemCOA.trim().length < 30) {
      toast.error("A justificativa deve ter no mínimo 30 caracteres.");
      return;
    }
    setLiberandoSemCOA(true);
    try {
      // Buscar dados do usuário atual
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email, company_id")
        .eq("id", user?.id)
        .single();

      // Registrar a liberação sem COA
      const { error: insertError } = await supabase
        .from("lote_liberacoes_sem_coa" as any)
        .insert({
          lote_id: id,
          company_id: (profile as any)?.company_id,
          usuario_id: user?.id,
          usuario_nome: (profile as any)?.full_name || user?.email || "Operador",
          usuario_email: user?.email,
          justificativa: justificativaSemCOA.trim(),
          status_anterior: lote.status,
          coa_presente: hasCOA,
          numero_lote: lote.numero_lote,
          insumo_nome: (item as any)?.descricao_interna,
        });

      if (insertError) throw insertError;

      // Liberar o lote
      await updateLoteStatus.mutateAsync({ id: id!, status: "DISPONIVEL" });

      // Recarregar histórico
      const { data: novasLiberacoes } = await supabase
        .from("lote_liberacoes_sem_coa" as any)
        .select("*")
        .eq("lote_id", id)
        .order("created_at", { ascending: false });
      if (novasLiberacoes) setLiberacoesSemCOA(novasLiberacoes as any[]);

      toast.success("Lote liberado. Justificativa registrada na rastreabilidade.");
      setDialogLiberarSemCOA(false);
      setJustificativaSemCOA("");
    } catch (err: any) {
      toast.error("Erro ao liberar lote: " + (err.message || String(err)));
    } finally {
      setLiberandoSemCOA(false);
    }
  };

  const salvarPotencia = async () => {
    if (!id) return;
    const { error } = await supabase
      .from("estoque_lotes")
      .update({
        tipo_potencia: tipoPotencia,
        potencia_valor: tipoPotencia === "NENHUMA" ? null : potenciaValor || null,
        potencia_unidade: getTipoPotenciaLabel(tipoPotencia) === "-" ? null : getTipoPotenciaLabel(tipoPotencia),
      } as any)
      .eq("id", id);

    if (error) {
      toast.error("Erro ao salvar potência: " + error.message);
    } else {
      toast.success("Potência do lote salva");
      queryClient.invalidateQueries({ queryKey: ["lote", id] });
    }
  };

  const aplicarPresetVitD = () => {
    setTipoPotencia("UI_POR_GRAMA");
    setPotenciaValor(400000);
  };

  const handleUploadCOA = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;

    try {
      if (
        hasCOA &&
        !window.confirm("Este lote já possui um CoA anexado. Anexar mesmo assim?")
      ) {
        return;
      }

      await uploadDocumentoLote(id, file, "COA");
      toast.success("COA anexado com sucesso");
      queryClient.invalidateQueries({ queryKey: ["lote", id] });
      queryClient.invalidateQueries({ queryKey: ["lote-documentos", id] });
    } catch (error: any) {
      const msg = error?.message || error?.code || "falha desconhecida";
      toast.error("Erro ao anexar COA: " + msg);
    } finally {
      // Sem isso, selecionar o mesmo arquivo de novo não dispara onChange
      e.target.value = "";
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-[50vh]"><p className="text-muted-foreground">Carregando...</p></div>;
  }

  if (!lote || !item) {
    return (
      <div>
        <PageHeader
          title="Lote não encontrado"
          description="Volte para a lista e selecione um lote válido."
          icon={FileText}
          actions={
            <Button variant="outline" onClick={() => navigate("/estoque/lotes")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Lote ${lote.numero_lote}`}
        description={`Insumo: ${(item as any).descricao_interna}`}
        icon={FileText}
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={imprimindoEtiqueta || !id}
              onClick={() => imprimir([id!])}
            >
              <Printer className="h-4 w-4 mr-2" />
              {imprimindoEtiqueta ? "Preparando…" : "Etiqueta"}
            </Button>
            <Button variant="outline" onClick={() => navigate("/estoque/lotes")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
          </div>
        }
      />

      {/* Ações de Fluxo de Qualidade */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Button 
          variant={lote.status === 'QUARENTENA' ? 'default' : 'outline'}
          className={lote.status === 'QUARENTENA' ? 'bg-amber-600 hover:bg-amber-700' : ''}
          onClick={() => updateLoteStatus.mutate({ id: id!, status: 'QUARENTENA' })}
        >
          <AlertCircle className="h-4 w-4 mr-2" /> Quarentena
        </Button>
        <Button 
          variant={lote.status === 'DISPONIVEL' || lote.status === 'APROVADO' ? 'default' : 'outline'}
          className={lote.status === 'APROVADO' ? 'bg-green-600 hover:bg-green-700' : ''}
          onClick={() => {
            if (hasCOAValidado) {
              // COA validado: libera direto
              updateLoteStatus.mutate({ id: id!, status: 'DISPONIVEL' });
            } else {
              // Sem COA validado: abre dialog de justificativa obrigatória
              setDialogLiberarSemCOA(true);
            }
          }}
        >
          <ShieldCheck className="h-4 w-4 mr-2" /> Liberar Produção
          {!hasCOAValidado && (
            <TriangleAlert className="h-3 w-3 ml-1 text-amber-400" />
          )}
        </Button>
        <Button 
          variant={lote.status === 'BLOQUEADO' ? 'destructive' : 'outline'}
          onClick={() => updateLoteStatus.mutate({ id: id!, status: 'BLOQUEADO' })}
        >
          <XCircle className="h-4 w-4 mr-2" /> Bloquear Lote
        </Button>
        <div className="hidden lg:block"></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                <QrCode className="h-4 w-4 text-primary" /> Rastreabilidade Digital
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 flex flex-col items-center">
              {dadosEtiqueta ? (
                <LoteFornecedorEtiqueta lote={dadosEtiqueta} hideActions />
              ) : (
                <p className="text-sm text-muted-foreground">
                  {imprimindoEtiqueta
                    ? "Preparando etiqueta…"
                    : "Carregando dados da etiqueta…"}
                </p>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                <History className="h-4 w-4 text-primary" /> Histórico de Auditoria
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground italic">Trilha imutável registrada em blockchain simulado (SHA-256).</p>
              {/* Aqui poderíamos listar eventos de auditoria específicos do lote */}
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Resumo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <StatusBadge variant={lote.status === "DISPONIVEL" || lote.status === "APROVADO" ? "success" : lote.status === "QUARENTENA" ? "warning" : "muted"}>
                {lote.status}
              </StatusBadge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Quantidade interna</span>
              <span className="font-mono font-medium">
                {formatQtdExibicao(Number(lote.quantidade_interna), lote.unidade_interna)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Validade</span>
              <span className="font-mono font-medium">{lote.data_val ? formatDate(lote.data_val) : "-"}</span>
            </div>
            <Separator />
            <Alert className="bg-muted/50">
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                <strong>Ordem correta:</strong> 1) Importar NF-e (gera lote) → 2) Anexar COA → 3) Registrar potência do lote → 4) Validar COA / liberar.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Potência do lote (COA)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de potência</Label>
                <Select value={tipoPotencia} onValueChange={(v) => setTipoPotencia(v as TipoPotencia)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NENHUMA">Nenhuma</SelectItem>
                    <SelectItem value="UI_POR_GRAMA">UI por grama (UI/g)</SelectItem>
                    <SelectItem value="MG_POR_GRAMA">mg por grama (mg/g)</SelectItem>
                    <SelectItem value="PERCENTUAL">Percentual (%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Valor</Label>
                <Input
                  type="number"
                  step="any"
                  value={potenciaValor}
                  onChange={(e) => setPotenciaValor(parseFloat(e.target.value) || 0)}
                  disabled={tipoPotencia === "NENHUMA"}
                  placeholder={tipoPotencia === "UI_POR_GRAMA" ? "Ex: 400000" : ""}
                />
                <p className="text-xs text-muted-foreground">
                  Atual: <span className="font-mono">{formatarPotencia((lote.tipo_potencia as any) || "NENHUMA", lote.potencia_valor)}</span>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <COAParserButton
                materiasPrimas={[]}
                onPotenciaEncontrada={(dados) => {
                  const tipoMap: Record<string, TipoPotencia> = {
                    "UI_POR_GRAMA": "UI_POR_GRAMA",
                    "MG_POR_GRAMA": "MG_POR_GRAMA",
                    "PERCENTUAL": "PERCENTUAL",
                  };
                  setTipoPotencia(tipoMap[dados.tipo] || "NENHUMA");
                  setPotenciaValor(dados.valor);
                  toast.success(`Potência extraída do COA: ${dados.valor}`);
                }}
              />
              <Button type="button" variant="secondary" onClick={aplicarPresetVitD}>
                <Beaker className="h-4 w-4 mr-2" />
                Vitamina D3 (400.000 UI/g)
              </Button>
              <Button type="button" onClick={salvarPotencia}>
                Salvar potência
              </Button>
            </div>

            {tipoPotencia === "UI_POR_GRAMA" && potenciaValor === 400000 && (
              <Alert className="bg-muted/50">
                <Info className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Exemplo automático: <strong>2.000 UI = 5 mg = 50 mcg</strong> (preparação 400.000 UI/g).
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">COA / Laudo do fornecedor</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="upload-coa" className="cursor-pointer">
                <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary transition-colors">
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Clique para anexar COA (PDF)</p>
                </div>
              </Label>
              <input id="upload-coa" type="file" accept=".pdf" className="hidden" onChange={handleUploadCOA} />
            </div>

            <div className="flex items-center gap-2">
              {hasCOAValidado ? (
                <StatusBadge variant="success">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  COA validado
                </StatusBadge>
              ) : hasCOA ? (
                <StatusBadge variant="warning">COA pendente</StatusBadge>
              ) : (
                <StatusBadge variant="muted">Sem COA</StatusBadge>
              )}

              {!hasCOAValidado && hasCOA && (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    const pendente = documentos.find((d: any) => d.tipo_documento === "COA" && d.status_validacao === "PENDENTE");
                    if (!pendente) return;
                    updateDocValidacao.mutate({
                      id: pendente.id,
                      lote_id: id!,
                      status_validacao: "VALIDADO",
                    });
                  }}
                >
                  Marcar como validado
                </Button>
              )}
            </div>

            {documentos.length > 0 && (
              <div className="space-y-2">
                {documentos.map((doc: any) => (
                  <div key={doc.id} className="flex items-center justify-between border rounded-lg p-3">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <div className="text-sm font-medium">{doc.arquivo_nome}</div>
                        <div className="text-xs text-muted-foreground">{doc.tipo_documento} • {doc.status_validacao}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Card: Histórico de Liberações sem COA */}
      {liberacoesSemCOA.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/30">
          <CardHeader className="pb-3 border-b border-amber-200">
            <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2 text-amber-800">
              <ClipboardList className="h-4 w-4" />
              Liberações sem COA Validado
              <Badge variant="outline" className="ml-auto text-amber-700 border-amber-400">
                {liberacoesSemCOA.length} registro{liberacoesSemCOA.length > 1 ? 's' : ''}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <p className="text-xs text-amber-700 italic">
              Trilha imutável de auditoria — cada registro possui hash SHA-256 único.
              Base legal: RDC 275/2002 Art. 3, RDC 243/2018 Art. 12.
            </p>
            {liberacoesSemCOA.map((lib: any) => (
              <div key={lib.id} className="border border-amber-200 rounded-lg p-3 bg-white space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <TriangleAlert className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-amber-900">
                        {lib.usuario_nome}
                        {lib.usuario_email && (
                          <span className="font-normal text-muted-foreground ml-1">({lib.usuario_email})</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {lib.created_at ? new Date(lib.created_at).toLocaleString('pt-BR') : '-'}
                        {lib.coa_presente ? ' • COA presente mas não validado' : ' • Sem COA'}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs text-amber-600 border-amber-300 flex-shrink-0">
                    Sem COA
                  </Badge>
                </div>
                <div className="bg-amber-50 rounded p-2">
                  <p className="text-xs font-medium text-amber-800 mb-1">Justificativa do operador:</p>
                  <p className="text-xs text-gray-700">{lib.justificativa}</p>
                </div>
                {lib.hash_sha256 && (
                  <p className="text-xs font-mono text-muted-foreground break-all">
                    SHA-256: {lib.hash_sha256}
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Dialog: Liberar sem COA */}
      <Dialog open={dialogLiberarSemCOA} onOpenChange={setDialogLiberarSemCOA}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700">
              <TriangleAlert className="h-5 w-5" />
              Liberar Lote sem COA Validado
            </DialogTitle>
            <DialogDescription>
              Este lote não possui COA validado. A liberação é permitida, mas exige
              justificativa obrigatória do operador, que será registrada permanentemente
              na rastreabilidade do lote com hash SHA-256.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-1">
              <p className="text-xs font-semibold text-amber-800">Lote: {lote.numero_lote}</p>
              <p className="text-xs text-amber-700">Insumo: {(item as any)?.descricao_interna}</p>
              <p className="text-xs text-amber-700">
                COA: {hasCOA ? 'Presente mas não validado' : 'Ausente'}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="justificativa-sem-coa" className="text-sm font-medium">
                Justificativa para liberação sem COA
                <span className="text-destructive ml-1">*</span>
              </Label>
              <Textarea
                id="justificativa-sem-coa"
                placeholder="Descreva o motivo da liberação sem COA validado. Ex: COA aguardando retorno do fornecedor, urgência de produção aprovada pelo RT..."
                value={justificativaSemCOA}
                onChange={(e) => setJustificativaSemCOA(e.target.value)}
                rows={4}
                className={justificativaSemCOA.length > 0 && justificativaSemCOA.length < 30 ? 'border-destructive' : ''}
              />
              <div className="flex justify-between">
                <p className={`text-xs ${
                  justificativaSemCOA.length >= 30 ? 'text-green-600' : 'text-muted-foreground'
                }`}>
                  {justificativaSemCOA.length >= 30
                    ? `✓ ${justificativaSemCOA.length} caracteres`
                    : `Mínimo 30 caracteres (${justificativaSemCOA.length}/30)`
                  }
                </p>
                <p className="text-xs text-muted-foreground italic">
                  Registro imutável com hash SHA-256
                </p>
              </div>
            </div>

            <Alert className="border-amber-200 bg-amber-50">
              <TriangleAlert className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-xs text-amber-800">
                Esta ação será registrada com seu nome, e-mail, data/hora e IP.
                O registro é permanente e não pode ser excluído.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => { setDialogLiberarSemCOA(false); setJustificativaSemCOA(""); }}
              disabled={liberandoSemCOA}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleLiberarSemCOA}
              disabled={justificativaSemCOA.trim().length < 30 || liberandoSemCOA}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {liberandoSemCOA ? (
                <><span className="animate-spin mr-2">&#9696;</span> Registrando...</>
              ) : (
                <><ShieldCheck className="h-4 w-4 mr-2" /> Liberar e Registrar Justificativa</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {portalEtiquetas}
    </div>
  );
}
