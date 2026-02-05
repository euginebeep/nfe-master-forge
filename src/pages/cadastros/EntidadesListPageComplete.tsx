import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Plus, Eye, Filter, Search } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocalEntidades, useLocalEntidade, LocalEntidade, LocalEntidadeEndereco } from "@/hooks/use-local-entidades";
import { EntidadeFormDialogComplete } from "@/components/entidades/EntidadeFormDialogComplete";
import { formatDocument } from "@/lib/formatters";
import { LocalDb } from "@/lib/local-db";

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

export default function EntidadesListPageComplete() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [papelFilter, setPapelFilter] = useState<string>("all");
  const [classificacaoFilter, setClassificacaoFilter] = useState<string>("all");
  const [ufFilter, setUfFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: entidadesBase, isLoading, refresh } = useLocalEntidades({
    papel: papelFilter !== "all" ? papelFilter : undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
  });

  // Get all enderecos for enrichment
  const allEnderecos = LocalDb.getCollection<LocalEntidadeEndereco>('entidade_enderecos');

  // Apply additional filters and enrich with enderecos
  const entidades = entidadesBase.map(e => ({
    ...e,
    enderecos: allEnderecos.filter(end => end.entidade_id === e.id),
  })).filter(e => {
    if (classificacaoFilter !== "all" && e.classificacao !== classificacaoFilter) return false;
    if (ufFilter !== "all" && !e.enderecos?.some(end => end.uf === ufFilter)) return false;
    return true;
  });

  const getEnderecoFiscal = (entidade: typeof entidades[0]) => {
    const fiscal = entidade.enderecos?.find(e => e.tipo === 'FISCAL');
    if (fiscal) return `${fiscal.cidade}/${fiscal.uf}`;
    const any = entidade.enderecos?.[0];
    if (any) return `${any.cidade}/${any.uf}`;
    return '-';
  };

  const getContatoPrincipal = (entidade: LocalEntidade) => {
    const contact = (entidade as any)._primaryContact;
    if (contact) return contact.whatsapp || contact.telefone || contact.email || '-';
    return '-';
  };

  const columns = [
    {
      key: "codigo_interno",
      header: "Código",
      sortable: true,
      render: (item: typeof entidades[0]) => (
        <span className="font-mono text-sm">{(item as any).codigo_interno || '-'}</span>
      ),
    },
    {
      key: "razao_social",
      header: "Nome/Razão Social",
      sortable: true,
      render: (item: typeof entidades[0]) => (
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
      render: (item: typeof entidades[0]) => (
        <span className="font-mono text-sm">{formatDocument(item.documento)}</span>
      ),
    },
    {
      key: "papeis",
      header: "Papéis",
      render: (item: typeof entidades[0]) => (
        <div className="flex flex-wrap gap-1">
          {item.papeis?.map((papel, idx) => (
            <StatusBadge key={idx} variant="muted" className="text-xs">
              {PAPEL_LABELS[papel] || papel}
            </StatusBadge>
          ))}
        </div>
      ),
    },
    {
      key: "cidade_uf",
      header: "Cidade/UF",
      render: (item: typeof entidades[0]) => getEnderecoFiscal(item),
    },
    {
      key: "contato",
      header: "Contato",
      render: (item: typeof entidades[0]) => (
        <span className="text-sm">{getContatoPrincipal(item)}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (item: typeof entidades[0]) => (
        <StatusBadge variant={STATUS_VARIANTS[item.status] || "muted"}>
          {item.status}
        </StatusBadge>
      ),
    },
    {
      key: "classificacao",
      header: "Classificação",
      render: (item: typeof entidades[0]) => (
        <StatusBadge variant={CLASSIFICACAO_VARIANTS[item.classificacao || 'REGULAR'] || "muted"}>
          {item.classificacao || "REGULAR"}
        </StatusBadge>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "w-16",
      render: (item: typeof entidades[0]) => (
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
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Entidade
          </Button>
        }
      />

      <DataTable
        data={entidades}
        columns={columns}
        loading={isLoading}
        searchable
        searchPlaceholder="Buscar por nome, documento, telefone ou email..."
        searchKeys={["documento", "razao_social", "nome_fantasia"]}
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
                {UF_OPTIONS.map(uf => (
                  <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />

      <EntidadeFormDialogComplete
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={() => refresh()}
      />
    </div>
  );
}
