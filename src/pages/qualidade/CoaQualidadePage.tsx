import { useMemo, useState } from "react";
import { FileCheck, Filter, Search } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserCompanyId } from "@/hooks/use-user-company";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

type LoteCoaRow = {
  id: string;
  numero_lote: string;
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

export default function CoaQualidadePage() {
  const { data: companyId } = useUserCompanyId();
  const queryClient = useQueryClient();
  const [statusFiltro, setStatusFiltro] = useState<CoaStatusFiltro>("todos");
  const [search, setSearch] = useState("");
  const [validandoId, setValidandoId] = useState<string | null>(null);

  const { data: lotes = [], isLoading } = useQuery({
    queryKey: ["coa-qualidade-lotes", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estoque_lotes")
        .select(`
          id,
          numero_lote,
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

  const handleValidar = (lote: LoteCoaRow) => {
    const doc = getCoaDoc(lote);
    if (!doc || doc.status_validacao === "VALIDADO") return;
    setValidandoId(doc.id);
    validarCoa.mutate(doc.id);
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["coa-qualidade-lotes"] });
    queryClient.invalidateQueries({ queryKey: ["estoque-lotes"] });
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
          return (
            <StatusBadge variant={COA_STATUS_VARIANT[status]}>
              {COA_STATUS_LABEL[status]}
            </StatusBadge>
          );
        },
      },
      {
        key: "acoes",
        header: "Ações",
        render: (item: LoteCoaRow) => {
          const status = getCoaStatus(item);
          const doc = getCoaDoc(item);

          return (
            <div className="flex gap-1 flex-wrap">
              {doc?.arquivo?.storage_key && (
                <VerPdfButton storageKey={doc.arquivo.storage_key} />
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
            </div>
          );
        },
      },
    ],
    [validandoId]
  );

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
    </div>
  );
}
