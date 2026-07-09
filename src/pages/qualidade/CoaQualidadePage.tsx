import { useMemo, useState } from "react";
import { AlertTriangle, FileCheck, Filter, Search } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserCompanyId } from "@/hooks/use-user-company";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImportarCoaNotaSeletor } from "@/components/nfe/ImportarCoaNotaDialog";
import { VerPdfButton } from "@/components/shared/VerPdfButton";
import { formatDate, formatNumber } from "@/lib/formatters";
import { toast } from "sonner";

type CoaStatusFiltro = "todos" | "SEM_COA" | "PENDENTE" | "VALIDADO";
type CoaStatus = "SEM_COA" | "PENDENTE" | "VALIDADO";

const MIN_JUSTIFICATIVA = 30;

type LoteCoaRow = {
  id: string;
  numero_lote: string;
  status: string;
  data_val: string | null;
  quantidade_original: number;
  unidade_original: string;
  item: { descricao_interna: string | null; sku_interno: string | null; tipo_item: string } | null;
  nota_entrada_item: {
    nota_entrada: { numero: string | null } | null;
  } | null;
  lote_documentos: {
    id: string;
    tipo_documento: string;
    status_validacao: string | null;
    arquivo: { storage_key: string | null; nome_original: string | null } | null;
  }[];
};

function erroMsg(err: unknown): string {
  const e = err as { message?: string; code?: string };
  return e?.message || e?.code || "Erro desconhecido";
}

function getCoaDoc(lote: LoteCoaRow) {
  return (lote.lote_documentos || []).find((d) => d.tipo_documento === "COA");
}

function getCoaStatus(lote: LoteCoaRow): CoaStatus {
  const doc = getCoaDoc(lote);
  if (!doc) return "SEM_COA";
  if (doc.status_validacao === "VALIDADO") return "VALIDADO";
  return "PENDENTE";
}

const COA_STATUS_LABEL: Record<CoaStatus, string> = {
  SEM_COA: "Sem COA",
  PENDENTE: "Pendente",
  VALIDADO: "Validado",
};

const COA_STATUS_VARIANT: Record<CoaStatus, "muted" | "warning" | "success"> = {
  SEM_COA: "muted",
  PENDENTE: "warning",
  VALIDADO: "success",
};

function podeLiberarComRessalva(lote: LoteCoaRow): boolean {
  if (lote.status !== "QUARENTENA") return false;
  const coaStatus = getCoaStatus(lote);
  return coaStatus === "SEM_COA" || coaStatus === "PENDENTE";
}

export default function CoaQualidadePage() {
  const { data: companyId } = useUserCompanyId();
  const queryClient = useQueryClient();
  const [statusFiltro, setStatusFiltro] = useState<CoaStatusFiltro>("todos");
  const [search, setSearch] = useState("");
  const [validandoId, setValidandoId] = useState<string | null>(null);
  const [loteParaLiberar, setLoteParaLiberar] = useState<LoteCoaRow | null>(null);
  const [justificativa, setJustificativa] = useState("");
  const [dialogLiberarOpen, setDialogLiberarOpen] = useState(false);

  const { data: lotes = [], isLoading } = useQuery({
    queryKey: ["coa-qualidade-lotes", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estoque_lotes")
        .select(`
          id,
          numero_lote,
          status,
          data_val,
          quantidade_original,
          unidade_original,
          item:itens(descricao_interna, sku_interno, tipo_item),
          nota_entrada_item:notas_entrada_itens!estoque_lotes_nota_entrada_item_id_fkey(
            nota_entrada:notas_entrada!notas_entrada_itens_nota_entrada_id_fkey(numero)
          ),
          lote_documentos(
            id,
            tipo_documento,
            status_validacao,
            arquivo:arquivos(storage_key, nome_original)
          )
        `)
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return ((data || []) as unknown as LoteCoaRow[]).filter(
        (l) => l.item?.tipo_item === "MP"
      );
    },
  });

  const { data: liberacoesSemCoa = [] } = useQuery({
    queryKey: ["lote-liberacoes-sem-coa", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lote_liberacoes_sem_coa" as any)
        .select("lote_id")
        .eq("company_id", companyId!);

      if (error) throw error;
      return (data || []) as { lote_id: string }[];
    },
  });

  const lotesComRessalva = useMemo(
    () => new Set(liberacoesSemCoa.map((r) => r.lote_id)),
    [liberacoesSemCoa]
  );

  const { data: notasRecentes = [] } = useQuery({
    queryKey: ["notas-entrada-import-coa", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notas_entrada")
        .select("id, numero")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false })
        .limit(30);

      if (error) throw error;
      return (data || []) as { id: string; numero: string }[];
    },
  });

  const validarCoa = useMutation({
    mutationFn: async (docId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase
        .from("lote_documentos")
        .update({
          status_validacao: "VALIDADO",
          validado_por: user.id,
          validado_em: new Date().toISOString(),
        } as any)
        .eq("id", docId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coa-qualidade-lotes"] });
      queryClient.invalidateQueries({ queryKey: ["estoque-lotes"] });
      toast.success("COA validado com sucesso");
    },
    onError: (err) => toast.error(erroMsg(err)),
    onSettled: () => setValidandoId(null),
  });

  const liberarComRessalva = useMutation({
    mutationFn: async ({ lote, justificativaTexto }: { lote: LoteCoaRow; justificativaTexto: string }) => {
      const trimmed = justificativaTexto.trim();
      if (!trimmed) throw new Error("Justificativa é obrigatória");
      if (trimmed.length < MIN_JUSTIFICATIVA) {
        throw new Error(`Justificativa deve ter no mínimo ${MIN_JUSTIFICATIVA} caracteres`);
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("full_name, email, company_id")
        .eq("id", user.id)
        .single();

      if (profileError) throw profileError;

      const coaStatus = getCoaStatus(lote);
      const coaPresente = coaStatus === "PENDENTE";

      const { error: insertError } = await supabase
        .from("lote_liberacoes_sem_coa" as any)
        .insert({
          company_id: companyId || (profile as { company_id?: string })?.company_id,
          lote_id: lote.id,
          usuario_id: user.id,
          usuario_nome: (profile as { full_name?: string })?.full_name || user.email || "Operador",
          usuario_email: user.email,
          justificativa: trimmed,
          status_anterior: lote.status,
          coa_presente: coaPresente,
          numero_lote: lote.numero_lote,
          insumo_nome: lote.item?.descricao_interna,
        });

      if (insertError) throw insertError;

      const { error: updateError } = await supabase
        .from("estoque_lotes")
        .update({ status: "DISPONIVEL" } as any)
        .eq("id", lote.id)
        .eq("company_id", companyId!);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coa-qualidade-lotes"] });
      queryClient.invalidateQueries({ queryKey: ["estoque-lotes"] });
      queryClient.invalidateQueries({ queryKey: ["lote-liberacoes-sem-coa"] });
      queryClient.invalidateQueries({ queryKey: ["lote-liberacoes-sem-coa-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["quarentena-lotes"] });
      toast.success("Lote liberado com ressalva. Justificativa registrada na rastreabilidade.");
      fecharDialogLiberar();
    },
    onError: (err) => toast.error(erroMsg(err)),
  });

  const handleValidar = (lote: LoteCoaRow) => {
    const doc = getCoaDoc(lote);
    if (!doc || doc.status_validacao === "VALIDADO") return;
    setValidandoId(doc.id);
    validarCoa.mutate(doc.id);
  };

  const abrirDialogLiberar = (lote: LoteCoaRow) => {
    setLoteParaLiberar(lote);
    setJustificativa("");
    setDialogLiberarOpen(true);
  };

  const fecharDialogLiberar = () => {
    setDialogLiberarOpen(false);
    setLoteParaLiberar(null);
    setJustificativa("");
  };

  const confirmarLiberarComRessalva = () => {
    if (!loteParaLiberar) return;
    if (!justificativa.trim()) {
      toast.error("Justificativa é obrigatória");
      return;
    }
    if (justificativa.trim().length < MIN_JUSTIFICATIVA) {
      toast.error(`Justificativa deve ter no mínimo ${MIN_JUSTIFICATIVA} caracteres`);
      return;
    }
    liberarComRessalva.mutate({ lote: loteParaLiberar, justificativaTexto: justificativa });
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["coa-qualidade-lotes"] });
    queryClient.invalidateQueries({ queryKey: ["estoque-lotes"] });
    queryClient.invalidateQueries({ queryKey: ["lote-liberacoes-sem-coa"] });
  };

  const lotesFiltrados = useMemo(() => {
    let lista = lotes;
    if (statusFiltro !== "todos") {
      lista = lista.filter((l) => getCoaStatus(l) === statusFiltro);
    }
    if (!search.trim()) return lista;
    const q = search.trim().toLowerCase();
    return lista.filter((l) => {
      const texto = [
        l.numero_lote,
        l.item?.descricao_interna,
        l.item?.sku_interno,
        l.nota_entrada_item?.nota_entrada?.numero,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return texto.includes(q);
    });
  }, [lotes, statusFiltro, search]);

  const columns = useMemo(
    () => [
      {
        key: "produto",
        header: "Produto",
        sortable: true,
        render: (item: LoteCoaRow) => (
          <div>
            <p className="font-medium text-sm">{item.item?.descricao_interna || "—"}</p>
            {item.item?.sku_interno && (
              <p className="text-xs text-muted-foreground font-mono">{item.item.sku_interno}</p>
            )}
          </div>
        ),
      },
      {
        key: "nota",
        header: "Nº Nota",
        sortable: true,
        render: (item: LoteCoaRow) => (
          <span className="font-mono text-sm">
            {item.nota_entrada_item?.nota_entrada?.numero || "—"}
          </span>
        ),
      },
      {
        key: "numero_lote",
        header: "Lote",
        sortable: true,
        render: (item: LoteCoaRow) => (
          <span className="font-mono font-medium">{item.numero_lote}</span>
        ),
      },
      {
        key: "quantidade",
        header: "Quantidade",
        render: (item: LoteCoaRow) => (
          <span>
            {formatNumber(item.quantidade_original)}{" "}
            <span className="text-muted-foreground text-xs">{item.unidade_original}</span>
          </span>
        ),
      },
      {
        key: "validade",
        header: "Validade",
        sortable: true,
        render: (item: LoteCoaRow) => formatDate(item.data_val),
      },
      {
        key: "status_coa",
        header: "Status COA",
        render: (item: LoteCoaRow) => {
          const status = getCoaStatus(item);
          const comRessalva = lotesComRessalva.has(item.id);
          return (
            <div className="flex flex-col gap-1 items-start">
              <StatusBadge variant={COA_STATUS_VARIANT[status]}>
                {COA_STATUS_LABEL[status]}
              </StatusBadge>
              {comRessalva && (
                <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50 text-[10px]">
                  Liberado com ressalva
                </Badge>
              )}
            </div>
          );
        },
      },
      {
        key: "acoes",
        header: "Ações",
        render: (item: LoteCoaRow) => {
          const status = getCoaStatus(item);
          const doc = getCoaDoc(item);
          const mostrarLiberar = podeLiberarComRessalva(item);

          return (
            <div className="flex gap-1 flex-wrap">
              {doc?.arquivo?.storage_key && (
                <VerPdfButton
                  storageKey={doc.arquivo.storage_key}
                  title={doc.arquivo.nome_original || `COA — ${item.numero_lote}`}
                />
              )}
              {status === "PENDENTE" && doc && (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={validandoId === doc.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleValidar(item);
                  }}
                >
                  {validandoId === doc.id ? "Validando..." : "Validar"}
                </Button>
              )}
              {mostrarLiberar && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="text-amber-700 border-amber-300 hover:bg-amber-50"
                  disabled={liberarComRessalva.isPending}
                  onClick={(e) => {
                    e.stopPropagation();
                    abrirDialogLiberar(item);
                  }}
                >
                  Liberar com ressalva
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    [validandoId, lotesComRessalva, liberarComRessalva.isPending]
  );

  const coaStatusLoteLiberar = loteParaLiberar ? getCoaStatus(loteParaLiberar) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Controle de COA"
        description="Importar, visualizar e validar certificados de análise dos lotes de matéria-prima recebidos"
        icon={FileCheck}
        actions={
          <ImportarCoaNotaSeletor notas={notasRecentes} onDone={handleRefresh} />
        }
      />

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar produto, lote ou nota..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-3">
          <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
          <Select
            value={statusFiltro}
            onValueChange={(v) => setStatusFiltro(v as CoaStatusFiltro)}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Status COA" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              <SelectItem value="SEM_COA">Sem COA</SelectItem>
              <SelectItem value="PENDENTE">Pendente</SelectItem>
              <SelectItem value="VALIDADO">Validado</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {lotesFiltrados.length} lote(s)
          </span>
        </div>
      </div>

      <DataTable
        data={lotesFiltrados}
        columns={columns}
        loading={isLoading}
        searchable={false}
        emptyMessage="Nenhum lote de matéria-prima encontrado"
        pageSize={50}
      />

      <Dialog
        open={dialogLiberarOpen}
        onOpenChange={(open) => {
          if (!open) fecharDialogLiberar();
          else setDialogLiberarOpen(true);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="h-5 w-5" />
              Liberar com ressalva (sem COA validado)
            </DialogTitle>
            <DialogDescription>
              Liberação <strong>excepcional</strong> de lote em quarentena sem COA validado,
              sob responsabilidade da RT. A justificativa será registrada permanentemente na
              rastreabilidade (hash SHA-256) e o lote passará para disponível.
            </DialogDescription>
          </DialogHeader>

          {loteParaLiberar && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-1">
                <p className="text-xs font-semibold text-amber-800">
                  Lote: {loteParaLiberar.numero_lote}
                </p>
                <p className="text-xs text-amber-700">
                  Insumo: {loteParaLiberar.item?.descricao_interna || "—"}
                </p>
                <p className="text-xs text-amber-700">
                  COA: {coaStatusLoteLiberar === "PENDENTE" ? "Presente mas não validado" : "Ausente"}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="justificativa-ressalva" className="text-sm font-medium">
                  Justificativa da RT
                  <span className="text-destructive ml-1">*</span>
                </Label>
                <Textarea
                  id="justificativa-ressalva"
                  placeholder="Descreva o motivo excepcional da liberação sem COA validado. Ex.: fornecedor não fornece laudo (psyllium LEPUGE), urgência aprovada pelo RT..."
                  value={justificativa}
                  onChange={(e) => setJustificativa(e.target.value)}
                  rows={4}
                  className={
                    justificativa.length > 0 && justificativa.trim().length < MIN_JUSTIFICATIVA
                      ? "border-destructive"
                      : ""
                  }
                />
                <div className="flex justify-between">
                  <p
                    className={`text-xs ${
                      justificativa.trim().length >= MIN_JUSTIFICATIVA
                        ? "text-green-600"
                        : "text-muted-foreground"
                    }`}
                  >
                    {justificativa.trim().length >= MIN_JUSTIFICATIVA
                      ? `✓ ${justificativa.trim().length} caracteres`
                      : `Mínimo ${MIN_JUSTIFICATIVA} caracteres (${justificativa.trim().length}/${MIN_JUSTIFICATIVA})`}
                  </p>
                  <p className="text-xs text-muted-foreground italic">
                    Registro imutável com hash SHA-256
                  </p>
                </div>
              </div>

              <Alert className="border-amber-200 bg-amber-50">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-xs text-amber-800">
                  Esta ação será registrada com seu nome, e-mail e data/hora.
                  O registro é permanente e não pode ser excluído.
                </AlertDescription>
              </Alert>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={fecharDialogLiberar}
              disabled={liberarComRessalva.isPending}
            >
              Cancelar
            </Button>
            <Button
              variant="default"
              className="bg-amber-600 hover:bg-amber-700"
              disabled={
                liberarComRessalva.isPending ||
                !justificativa.trim() ||
                justificativa.trim().length < MIN_JUSTIFICATIVA
              }
              onClick={confirmarLiberarComRessalva}
            >
              {liberarComRessalva.isPending ? "Liberando..." : "Confirmar liberação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
