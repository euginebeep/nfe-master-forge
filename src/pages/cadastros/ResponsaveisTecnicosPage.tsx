import { useState } from "react";
import { 
  UserCheck, 
  Plus, 
  Search, 
  Edit2, 
  ToggleLeft, 
  ToggleRight,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Download,
  Eye,
  Trash2,
  FileSearch
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  useResponsaveisTecnicos, 
  useResponsavelTecnicoCRUD 
} from "@/hooks/use-responsaveis-tecnicos";
import { useAuth } from "@/hooks/use-auth";
import { useGetFileUrl } from "@/hooks/use-files";
import { supabase } from "@/integrations/supabase/client";
import { RTFormDialog } from "@/components/responsavel-tecnico/RTFormDialog";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { ResponsavelTecnico, TipoConselho } from "@/types/responsavel-tecnico";
import { CONSELHOS } from "@/types/responsavel-tecnico";

export default function ResponsaveisTecnicosPage() {
  const { data: rts, isLoading } = useResponsaveisTecnicos();
  const { toggleStatus } = useResponsavelTecnicoCRUD();
  const { role } = useAuth();
  const getFileUrl = useGetFileUrl();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRT, setSelectedRT] = useState<ResponsavelTecnico | null>(null);

  const canManage = role === 'admin' || role === 'gerente';

  const handleViewContract = async (fileId: string) => {
    const { data: file } = await supabase
      .from('arquivos')
      .select('storage_key')
      .eq('id', fileId)
      .single();

    if (file?.storage_key) {
      const url = await getFileUrl.mutateAsync(file.storage_key);
      if (url) window.open(url, '_blank');
    }
  };

  const handleEdit = (rt: ResponsavelTecnico) => {
    setSelectedRT(rt);
    setDialogOpen(true);
  };

  const handleToggleStatus = (rt: ResponsavelTecnico) => {
    toggleStatus.mutate({
      id: rt.id,
      status: rt.status === 'ATIVO' ? 'INATIVO' : 'ATIVO',
    });
  };

  const filteredRTs = (rts || []).filter(rt =>
    rt.nome_completo.toLowerCase().includes(search.toLowerCase()) ||
    rt.cpf.includes(search) ||
    rt.numero_registro.includes(search)
  );

  // Estatísticas
  const stats = {
    total: rts?.length || 0,
    ativos: rts?.filter(r => r.status === 'ATIVO').length || 0,
    expirandoEm30Dias: rts?.filter(r => {
      const dias = differenceInDays(new Date(r.validade_registro), new Date());
      return dias >= 0 && dias <= 30 && r.status === 'ATIVO';
    }).length || 0,
    expirados: rts?.filter(r => {
      const dias = differenceInDays(new Date(r.validade_registro), new Date());
      return dias < 0;
    }).length || 0,
  };

  const getValidadeStatus = (rt: ResponsavelTecnico) => {
    const dias = differenceInDays(new Date(rt.validade_registro), new Date());
    if (dias < 0) return { variant: 'error' as const, label: 'Expirado' };
    if (dias <= 30) return { variant: 'warning' as const, label: `${dias}d restantes` };
    return { variant: 'success' as const, label: 'Válido' };
  };

  const columns = [
    { 
      key: "nome_completo", 
      header: "Nome Completo",
      render: (rt: ResponsavelTecnico) => (
        <div>
          <p className="font-medium">{rt.nome_completo}</p>
          <p className="text-xs text-muted-foreground">{rt.email}</p>
        </div>
      )
    },
    { 
      key: "cpf", 
      header: "CPF",
      render: (rt: ResponsavelTecnico) => (
        <span className="font-mono text-sm">{rt.cpf}</span>
      )
    },
    { 
      key: "conselho", 
      header: "Conselho",
      render: (rt: ResponsavelTecnico) => (
        <div className="space-y-1">
          <StatusBadge variant="info">
            {rt.tipo_conselho}
          </StatusBadge>
          <p className="text-xs text-muted-foreground">
            {rt.numero_registro}/{rt.uf_conselho}
          </p>
        </div>
      )
    },
    { 
      key: "validade", 
      header: "Validade Registro",
      render: (rt: ResponsavelTecnico) => {
        const status = getValidadeStatus(rt);
        return (
          <div className="space-y-1">
            <p className="text-sm">
              {format(new Date(rt.validade_registro), "dd/MM/yyyy", { locale: ptBR })}
            </p>
            <StatusBadge variant={status.variant}>
              {status.label}
            </StatusBadge>
          </div>
        );
      }
    },
    { 
      key: "status", 
      header: "Status",
      render: (rt: ResponsavelTecnico) => (
        <StatusBadge variant={rt.status === 'ATIVO' ? 'success' : 'muted'}>
          {rt.status}
        </StatusBadge>
      )
    },
    { 
      key: "acoes", 
      header: "Ações",
      render: (rt: ResponsavelTecnico) => (
        <div className="flex gap-2">
          {canManage && (
            <>
              <Button variant="ghost" size="icon" onClick={() => handleEdit(rt)} title="Editar">
                <Edit2 className="w-4 h-4" />
              </Button>
              
              {rt.regime_trabalho === 'PJ' && rt.contrato_prestacao_servico_id && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => handleViewContract(rt.contrato_prestacao_servico_id!)}
                  title="Visualizar Contrato PJ"
                >
                  <FileSearch className="w-4 h-4 text-primary" />
                </Button>
              )}

              {rt.regime_trabalho === 'CLT' && (
                <Button variant="ghost" size="icon" title="Visualizar Carteira com Registro">
                  <Eye className="w-4 h-4 text-info" />
                </Button>
              )}

              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => handleToggleStatus(rt)}
                title={rt.status === 'ATIVO' ? "Desativar" : "Ativar"}
              >
                {rt.status === 'ATIVO' ? (
                  <ToggleRight className="w-4 h-4 text-success" />
                ) : (
                  <ToggleLeft className="w-4 h-4 text-muted-foreground" />
                )}
              </Button>

              <Button variant="ghost" size="icon" className="text-destructive" title="Excluir">
                <Trash2 className="w-4 h-4" />
              </Button>
            </>
          )}
          {!canManage && (
            <Button variant="ghost" size="icon" onClick={() => handleEdit(rt)} title="Visualizar">
              <Eye className="w-4 h-4" />
            </Button>
          )}
        </div>
      )
    },
  ];

  return (
    <div>
      <PageHeader
        title="Responsáveis Técnicos"
        description="Gerenciamento de profissionais habilitados para produção (ANVISA)"
        icon={UserCheck}
        actions={
          <Button onClick={() => { setSelectedRT(null); setDialogOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            Novo RT
          </Button>
        }
      />

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase mb-1">Total Cadastrados</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase mb-1">Ativos</p>
            <p className="text-2xl font-bold text-success">{stats.ativos}</p>
          </CardContent>
        </Card>
        <Card className={stats.expirandoEm30Dias > 0 ? "border-warning" : ""}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-3 h-3 text-warning" />
              <p className="text-xs text-muted-foreground uppercase">Expirando (30d)</p>
            </div>
            <p className="text-2xl font-bold text-warning">{stats.expirandoEm30Dias}</p>
          </CardContent>
        </Card>
        <Card className={stats.expirados > 0 ? "border-destructive" : ""}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-3 h-3 text-destructive" />
              <p className="text-xs text-muted-foreground uppercase">Expirados</p>
            </div>
            <p className="text-2xl font-bold text-destructive">{stats.expirados}</p>
          </CardContent>
        </Card>
      </div>

      {/* Alerta de Compliance */}
      {(stats.expirandoEm30Dias > 0 || stats.expirados > 0) && (
        <div className="bg-warning/10 border border-warning rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-warning mt-0.5" />
            <div>
              <p className="font-semibold text-warning">Atenção: Registros com validade próxima</p>
              <p className="text-sm text-muted-foreground mt-1">
                Existem responsáveis técnicos com registro profissional prestes a expirar ou já expirados.
                Responsáveis com registro vencido não podem assinar OPs.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Busca */}
      <div className="mb-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, CPF ou registro..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Tabela */}
      <DataTable
        data={filteredRTs}
        columns={columns}
        emptyMessage="Nenhum responsável técnico cadastrado"
      />

      {/* Dialog de Formulário */}
      <RTFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        rtParaEditar={selectedRT}
      />
    </div>
  );
}
