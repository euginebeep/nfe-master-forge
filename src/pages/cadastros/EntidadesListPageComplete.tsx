import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Plus, Eye, Filter, MapPin, Phone, Mail } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useHybridEntidades, type HybridEntidade } from "@/hooks/use-hybrid-data";
import { EntidadeFormDialogComplete } from "@/components/entidades/EntidadeFormDialogComplete";
import { formatDocument, formatPhone } from "@/lib/formatters";
import { TenantAccessDiagnostic } from "@/components/diagnostics/TenantAccessDiagnostic";

const PAPEL_LABELS: Record<string, string> = {
  CLIENTE: "Cliente",
  FORNECEDOR: "Fornecedor",
  TRANSPORTADORA: "Transportadora",
  TERCEIRIZADO: "Terceirizado",
  VENDEDOR: "Vendedor",
  AFILIADO: "Afiliado",
  REPRESENTANTE: "Representante",
  OUTRO: "Outro",
};

const STATUS_VARIANTS: Record<string, "success" | "warning" | "error"> = {
  ATIVO: "success",
  BLOQUEADO: "error",
  INATIVO: "warning",
  HOMOLOGACAO: "warning",
};

const CLASSIFICACAO_VARIANTS: Record<string, "success" | "info" | "error" | "warning" | "muted"> = {
  VIP: "info",
  REGULAR: "muted",
  RISCO: "warning",
  RESTRITO: "error",
  PROBLEMA: "error",
};

const UF_OPTIONS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

type EntidadeListItem = HybridEntidade & {
  cidade: string | null;
  uf: string | null;
  endereco_completo: string | null;
  cep: string | null;
  telefone: string | null;
  email: string | null;
};

function achatarEntidade(e: HybridEntidade): EntidadeListItem {
  const end =
    e.entidade_enderecos?.find((x: { principal?: boolean | null }) => x.principal) ??
    e.entidade_enderecos?.[0];
  const ctt =
    e.entidade_contatos?.find((x: { preferencial?: boolean | null }) => x.preferencial) ??
    e.entidade_contatos?.[0] ??
    e._primaryContact;

  return {
    ...e,
    cidade: end?.cidade ?? null,
    uf: end?.uf ?? null,
    endereco_completo: end
      ? [end.logradouro, end.nro, end.bairro].filter(Boolean).join(", ")
      : null,
    cep: end?.cep ?? null,
    telefone: ctt?.telefone ?? null,
    email: ctt?.email ?? null,
  };
}

export default function EntidadesListPageComplete() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [papelFilter, setPapelFilter] = useState<string>("all");
  const [classificacaoFilter, setClassificacaoFilter] = useState<string>("all");
  const [ufFilter, setUfFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: entidadesData, isLoading, refetch } = useHybridEntidades({
    papel: papelFilter !== "all" ? papelFilter : undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
  });

  const entidades = useMemo(() => {
    const achatado = (entidadesData || []).map(achatarEntidade);
    return achatado.filter((e) => {
      if (classificacaoFilter !== "all" && e.classificacao !== classificacaoFilter) return false;
      if (ufFilter !== "all") {
        if (e.uf !== ufFilter) return false;
      }
      return true;
    });
  }, [entidadesData, classificacaoFilter, ufFilter]);

  const columns = [
    {
      key: "codigo_interno",
      header: "Código",
      sortable: true,
      render: (item: EntidadeListItem) => (
        <span className="font-mono text-sm tabular-nums">
          {(item as HybridEntidade & { codigo_interno?: string }).codigo_interno || "—"}
        </span>
      ),
    },
    {
      key: "razao_social",
      header: "Nome/Razão Social",
      sortable: true,
      render: (item: EntidadeListItem) => (
        <div>
          <p className="font-medium">{item.razao_social}</p>
          {item.nome_fantasia && (
            <p className="text-sm text-muted-foreground">{item.nome_fantasia}</p>
          )}
        </div>
      ),
    },
    {
      key: "documento",
      header: "CPF/CNPJ",
      sortable: true,
      render: (item: EntidadeListItem) => (
        <span className="font-mono text-sm tabular-nums whitespace-nowrap">
          {formatDocument(item.documento)}
        </span>
      ),
    },
    {
      key: "papeis",
      header: "Papéis",
      render: (item: EntidadeListItem) =>
        item.papeis && item.papeis.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {item.papeis.map((papel, idx) => (
              <StatusBadge key={idx} variant="muted" className="text-xs">
                {PAPEL_LABELS[papel] || papel}
              </StatusBadge>
            ))}
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "cidade_uf",
      header: "Cidade/UF",
      render: (item: EntidadeListItem) =>
        item.cidade ? (
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="truncate">{item.cidade}</span>
            {item.uf && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                {item.uf}
              </span>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "contato",
      header: "Contato",
      render: (item: EntidadeListItem) =>
        item.telefone || item.email ? (
          <div className="flex flex-col gap-0.5 min-w-0">
            {item.telefone && (
              <a href={`tel:${item.telefone}`} className="flex items-center gap-1 hover:underline">
                <Phone className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="tabular-nums">{formatPhone(item.telefone)}</span>
              </a>
            )}
            {item.email && (
              <a
                href={`mailto:${item.email}`}
                className="flex items-center gap-1 hover:underline text-muted-foreground truncate"
              >
                <Mail className="h-3 w-3 shrink-0" />
                <span className="truncate text-[10px]">{item.email}</span>
              </a>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "status",
      header: "Status",
      render: (item: EntidadeListItem) => (
        <StatusBadge variant={STATUS_VARIANTS[item.status] || "muted"}>
          {item.status}
        </StatusBadge>
      ),
    },
    {
      key: "classificacao",
      header: "Classificação",
      render: (item: EntidadeListItem) => (
        <StatusBadge variant={CLASSIFICACAO_VARIANTS[item.classificacao || "REGULAR"] || "muted"}>
          {item.classificacao || "REGULAR"}
        </StatusBadge>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "w-16",
      render: (item: EntidadeListItem) => (
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/cadastros/entidades/${item.id}`);
          }}
        >
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Entidades"
        description="Clientes, fornecedores, transportadoras e parceiros"
        icon={Users}
        actions={
          <div className="flex gap-2">
            <TenantAccessDiagnostic table="entidades" contextLabel="Entidades" visibleCount={entidades.length} />
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Entidade
            </Button>
          </div>
        }
      />

      <DataTable
        data={entidades}
        columns={columns}
        loading={isLoading}
        searchable
        searchPlaceholder="Buscar por nome, documento, telefone ou email..."
        searchKeys={["documento", "razao_social", "nome_fantasia", "telefone", "email", "cidade"]}
        onRowClick={(item) => navigate(`/cadastros/entidades/${item.id}`)}
        emptyMessage="Nenhuma entidade cadastrada"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-28">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="ATIVO">Ativo</SelectItem>
                <SelectItem value="INATIVO">Inativo</SelectItem>
                <SelectItem value="BLOQUEADO">Bloqueado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={papelFilter} onValueChange={setPapelFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Papel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="CLIENTE">Cliente</SelectItem>
                <SelectItem value="FORNECEDOR">Fornecedor</SelectItem>
                <SelectItem value="TRANSPORTADORA">Transportadora</SelectItem>
                <SelectItem value="TERCEIRIZADO">Terceirizado</SelectItem>
                <SelectItem value="VENDEDOR">Vendedor</SelectItem>
                <SelectItem value="AFILIADO">Afiliado</SelectItem>
                <SelectItem value="REPRESENTANTE">Representante</SelectItem>
              </SelectContent>
            </Select>
            <Select value={classificacaoFilter} onValueChange={setClassificacaoFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Classificação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="VIP">VIP</SelectItem>
                <SelectItem value="REGULAR">Regular</SelectItem>
                <SelectItem value="RISCO">Risco</SelectItem>
                <SelectItem value="RESTRITO">Restrito</SelectItem>
              </SelectContent>
            </Select>
            <Select value={ufFilter} onValueChange={setUfFilter}>
              <SelectTrigger className="w-24">
                <SelectValue placeholder="UF" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {UF_OPTIONS.map((uf) => (
                  <SelectItem key={uf} value={uf}>
                    {uf}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />

      <EntidadeFormDialogComplete
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={() => refetch()}
      />
    </div>
  );
}
