import { useMemo, useState } from "react";
import { AlertTriangle, FileCheck, Filter, Pencil, Search } from "lucide-react";
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
  data_fab: string | null;
  data_val: string | null;
  observacoes_qc: string | null;
  quantidade_original: number;
  unidade_original: string;
  item: { descricao_interna: string | null; sku_interno: string | null; tipo_item: string } | null;
  nota_entrada_item: {
    nota_entrada: { id: string; numero: string | null } | null;
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

type FormEditarLote = {
  numero_lote: string;
  data_fab: string;
  data_val: string;
};

function isoParaInputDate(val: string | null | undefined): string {
  if (!val) return "";
  return val.slice(0, 10);
}

function valorAuditavel(val: string | null | undefined, isDate = false): string {
  if (!val) return "(vazio)";
  return isDate ? formatDate(val) : val;
}

function montarLinhaAuditoriaCorrecao(
  usuarioNome: string,
  antigo: { numero_lote: string; data_fab: string | null; data_val: string | null },
  novo: FormEditarLote
): string {
  const hoje = new Date().toISOString().slice(0, 10);
  const partes: string[] = [];

  const numNovo = novo.numero_lote.trim();
  if (antigo.numero_lote.trim() !== numNovo) {
    partes.push(`numero_lote: ${antigo.numero_lote} -> ${numNovo}`);
  }

  const fabAntigo = isoParaInputDate(antigo.data_fab);
  if (fabAntigo !== novo.data_fab) {
    partes.push(
      `data_fab: ${valorAuditavel(antigo.data_fab, true)} -> ${novo.data_fab ? formatDate(novo.data_fab) : "(vazio)"}`
    );
  }

  const valAntigo = isoParaInputDate(antigo.data_val);
  if (valAntigo !== novo.data_val) {
    partes.push(
      `validade: ${valorAuditavel(antigo.data_val, true)} -> ${novo.data_val ? formatDate(novo.data_val) : "(vazio)"}`
    );
  }

  if (!partes.length) return "";
  return `[correção RT ${hoje} por ${usuarioNome}] ${partes.join("; ")}`;
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
  const [loteParaEditar, setLoteParaEditar] = useState<LoteCoaRow | null>(null);
  const [dialogEditarOpen, setDialogEditarOpen] = useState(false);
  const [formEditar, setFormEditar] = useState<FormEditarLote>({ numero_lote: "", data_fab: "", data_val: "" });
  const [confirmarEdicao, setConfirmarEdicao] = useState(false);
  const [nomeAuditor, setNomeAuditor] = useState("RT");

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
          data_fab,
          data_val,
          observacoes_qc,
          quantidade_original,
          unidade_original,
          item:itens(descricao_interna, sku_interno, tipo_item),
          nota_entrada_item:notas_entrada_itens!estoque_lotes_nota_entrada_item_id_fkey(
            nota_entrada:notas_entrada!notas_entrada_itens_nota_entrada_id_fkey(id, numero)
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

  /** Notas com pelo menos 1 lote MP sem documento COA — derivado da mesma lista da tabela */
  const notasComLotesSemCoa = useMemo(() => {
    const porNota = new Map<string, { id: string; numero: string; lotesSemCoa: number }>();

    for (const lote of lotes) {
      if (getCoaStatus(lote) !== "SEM_COA") continue;

      const nota = lote.nota_entrada_item?.nota_entrada;
      if (!nota?.id || !nota.numero) continue;

      const atual = porNota.get(nota.id);
      if (atual) {
        atual.lotesSemCoa += 1;
      } else {
        porNota.set(nota.id, { id: nota.id, numero: nota.numero, lotesSemCoa: 1 });
      }
    }

    return Array.from(porNota.values()).sort((a, b) => b.lotesSemCoa - a.lotesSemCoa);
  }, [lotes]);

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

  const salvarEdicaoLote = useMutation({
    mutationFn: async ({ lote, form }: { lote: LoteCoaRow; form: FormEditarLote }) => {
      const numeroNovo = form.numero_lote.trim();
      if (!numeroNovo) throw new Error("Número do lote é obrigatório");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", user.id)
        .single();

      if (profileError) throw profileError;

      const usuarioNome =
        (profile as { full_name?: string })?.full_name || user.email || "RT";

      const linhaAuditoria = montarLinhaAuditoriaCorrecao(
        usuarioNome,
        {
          numero_lote: lote.numero_lote,
          data_fab: lote.data_fab,
          data_val: lote.data_val,
        },
        form
      );

      if (!linhaAuditoria) throw new Error("Nenhum campo foi alterado");

      const observacoesAtuais = lote.observacoes_qc?.trim() || "";
      const observacoes_qc = observacoesAtuais
        ? `${observacoesAtuais}\n${linhaAuditoria}`
        : linhaAuditoria;

      const payload: Record<string, string | null> = {
        numero_lote: numeroNovo,
        data_fab: form.data_fab || null,
        data_val: form.data_val || null,
        observacoes_qc,
      };

      const { error } = await supabase
        .from("estoque_lotes")
        .update(payload as any)
        .eq("id", lote.id)
        .eq("company_id", companyId!);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coa-qualidade-lotes"] });
      queryClient.invalidateQueries({ queryKey: ["estoque-lotes"] });
      toast.success("Dados do lote atualizados");
      fecharDialogEditar();
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

  const abrirDialogEditar = (lote: LoteCoaRow) => {
    setLoteParaEditar(lote);
    setFormEditar({
      numero_lote: lote.numero_lote,
      data_fab: isoParaInputDate(lote.data_fab),
      data_val: isoParaInputDate(lote.data_val),
    });
    setConfirmarEdicao(false);
    setDialogEditarOpen(true);
  };

  const fecharDialogEditar = () => {
    setDialogEditarOpen(false);
    setLoteParaEditar(null);
    setConfirmarEdicao(false);
    setFormEditar({ numero_lote: "", data_fab: "", data_val: "" });
  };

  const linhaAuditoriaPreview = useMemo(() => {
    if (!loteParaEditar) return "";
    return montarLinhaAuditoriaCorrecao(
      nomeAuditor,
      {
        numero_lote: loteParaEditar.numero_lote,
        data_fab: loteParaEditar.data_fab,
        data_val: loteParaEditar.data_val,
      },
      formEditar
    );
  }, [loteParaEditar, formEditar, nomeAuditor]);

  const numeroLoteMudou =
    loteParaEditar != null &&
    loteParaEditar.numero_lote.trim() !== formEditar.numero_lote.trim();

  const temCoaAnexado = loteParaEditar ? !!getCoaDoc(loteParaEditar) : false;

  const solicitarSalvarEdicao = async () => {
    if (!loteParaEditar) return;
    if (!formEditar.numero_lote.trim()) {
      toast.error("Número do lote é obrigatório");
      return;
    }

    const previewAlteracoes = montarLinhaAuditoriaCorrecao(
      nomeAuditor,
      {
        numero_lote: loteParaEditar.numero_lote,
        data_fab: loteParaEditar.data_fab,
        data_val: loteParaEditar.data_val,
      },
      formEditar
    );
    if (!previewAlteracoes) {
      toast.error("Nenhum campo foi alterado");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, email")
          .eq("id", user.id)
          .single();
        setNomeAuditor(
          (profile as { full_name?: string })?.full_name || user.email || "RT"
        );
      }
    } catch {
      /* mantém nomeAuditor atual */
    }

    setConfirmarEdicao(true);
  };

  const confirmarSalvarEdicao = () => {
    if (!loteParaEditar) return;
    salvarEdicaoLote.mutate({ lote: loteParaEditar, form: formEditar });
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
              <Button
                type="button"
                size="sm"
                variant="ghost"
                title="Corrigir número do lote, fabricação ou validade"
                onClick={(e) => {
                  e.stopPropagation();
                  abrirDialogEditar(item);
                }}
              >
                <Pencil className="h-3.5 w-3.5 mr-1" />
                Editar lote
              </Button>
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
    [validandoId, lotesComRessalva, liberarComRessalva.isPending, salvarEdicaoLote.isPending]
  );

  const coaStatusLoteLiberar = loteParaLiberar ? getCoaStatus(loteParaLiberar) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Controle de COA"
        description="Importar, visualizar e validar certificados de análise dos lotes de matéria-prima recebidos"
        icon={FileCheck}
        actions={
          <ImportarCoaNotaSeletor
            notas={notasComLotesSemCoa}
            onDone={handleRefresh}
            emptyMessage="Todas as notas já têm COA"
          />
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

      <Dialog
        open={dialogEditarOpen}
        onOpenChange={(open) => {
          if (!open) fecharDialogEditar();
          else setDialogEditarOpen(true);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" />
              Editar lote
            </DialogTitle>
            <DialogDescription>
              Correção de dados de rastreabilidade pela RT. Alterações sensíveis serão registradas
              em <code className="text-xs">observacoes_qc</code> do lote.
            </DialogDescription>
          </DialogHeader>

          {loteParaEditar && !confirmarEdicao && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg border bg-muted/30 p-3 space-y-1 text-xs">
                <p className="font-semibold">{loteParaEditar.item?.descricao_interna || "—"}</p>
                <p className="text-muted-foreground">
                  NF-e {loteParaEditar.nota_entrada_item?.nota_entrada?.numero || "—"}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-numero-lote">
                  Número do lote
                  <span className="text-destructive ml-1">*</span>
                </Label>
                <Input
                  id="edit-numero-lote"
                  value={formEditar.numero_lote}
                  onChange={(e) =>
                    setFormEditar((f) => ({ ...f, numero_lote: e.target.value }))
                  }
                  className="font-mono"
                  placeholder="Ex.: número da embalagem física"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="edit-data-fab">Data de fabricação</Label>
                  <Input
                    id="edit-data-fab"
                    type="date"
                    value={formEditar.data_fab}
                    onChange={(e) =>
                      setFormEditar((f) => ({ ...f, data_fab: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-data-val">Validade</Label>
                  <Input
                    id="edit-data-val"
                    type="date"
                    value={formEditar.data_val}
                    onChange={(e) =>
                      setFormEditar((f) => ({ ...f, data_val: e.target.value }))
                    }
                  />
                </div>
              </div>

              {temCoaAnexado && numeroLoteMudou && (
                <Alert className="border-blue-200 bg-blue-50">
                  <AlertDescription className="text-xs text-blue-900">
                    Este lote já possui COA anexado. O documento permanece vinculado pelo
                    identificador interno do lote (<code>lote_id</code>), não pelo número exibido.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {loteParaEditar && confirmarEdicao && (
            <div className="space-y-4 py-2">
              <Alert className="border-amber-200 bg-amber-50">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-xs text-amber-900 space-y-2">
                  <p className="font-semibold">Confirmar correção de rastreabilidade</p>
                  <p>
                    Esta alteração será registrada permanentemente nas observações de QC do lote.
                    Revise os dados antes de confirmar.
                  </p>
                </AlertDescription>
              </Alert>
              <div className="rounded border p-3 bg-muted/20 text-xs font-mono whitespace-pre-wrap break-words">
                {linhaAuditoriaPreview}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            {!confirmarEdicao ? (
              <>
                <Button variant="outline" onClick={fecharDialogEditar}>
                  Cancelar
                </Button>
                <Button
                  onClick={solicitarSalvarEdicao}
                  disabled={
                    !formEditar.numero_lote.trim() ||
                    !montarLinhaAuditoriaCorrecao(
                      nomeAuditor,
                      {
                        numero_lote: loteParaEditar.numero_lote,
                        data_fab: loteParaEditar.data_fab,
                        data_val: loteParaEditar.data_val,
                      },
                      formEditar
                    )
                  }
                >
                  Salvar
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => setConfirmarEdicao(false)}
                  disabled={salvarEdicaoLote.isPending}
                >
                  Voltar
                </Button>
                <Button
                  className="bg-amber-600 hover:bg-amber-700"
                  onClick={confirmarSalvarEdicao}
                  disabled={salvarEdicaoLote.isPending}
                >
                  {salvarEdicaoLote.isPending ? "Salvando..." : "Confirmar correção"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
