import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Building2, ArrowLeft, Edit, Phone, Mail, MapPin, Globe, FileText } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useEntidade } from "@/hooks/use-entidades";
import { EntidadeFormDialogComplete } from "@/components/entidades/EntidadeFormDialogComplete";
import { formatDocument } from "@/lib/formatters";
import { Skeleton } from "@/components/ui/skeleton";

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

const DEPARTAMENTO_LABELS: Record<string, string> = {
  COMPRADOR: "Compras",
  VENDEDOR: "Vendas",
  FINANCEIRO: "Financeiro",
  LOGISTICA: "Logística",
  QUALIDADE: "Qualidade",
  FISCAL: "Fiscal",
  OUTRO: "Outro",
};

const TIPO_ENDERECO_LABELS: Record<string, string> = {
  FISCAL: "Fiscal",
  ENTREGA: "Entrega",
  COBRANCA: "Cobrança",
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

export default function EntidadeDetailPageComplete() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: entidadeData, isLoading, refetch } = useEntidade(id);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  if (!entidadeData) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-muted-foreground">Entidade não encontrada</p>
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
      </div>
    );
  }

  const entidade = entidadeData as typeof entidadeData & { site?: string; contribuinte_icms?: string };
  const papeis = entidade.entidade_papeis?.map(p => p.papel) || [];
  const contatos = entidade.entidade_contatos || [];
  const enderecos = entidade.entidade_enderecos || [];

  const enderecoFiscal = enderecos.find(e => e.tipo === 'FISCAL') || enderecos[0];
  const contatoPrincipal = contatos.find(c => c.preferencial) || contatos[0];

  return (
    <div>
      <PageHeader
        title={entidade.razao_social}
        description={`${formatDocument(entidade.documento)}`}
        icon={Building2}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <Button onClick={() => setEditDialogOpen(true)}>
              <Edit className="h-4 w-4 mr-2" />
              Editar
            </Button>
          </div>
        }
      />

      {/* Header Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <StatusBadge variant={STATUS_VARIANTS[entidade.status] || "muted"}>
                {entidade.status}
              </StatusBadge>
              <StatusBadge variant={CLASSIFICACAO_VARIANTS[entidade.classificacao || 'REGULAR'] || "muted"}>
                {entidade.classificacao || 'REGULAR'}
              </StatusBadge>
            </div>
            <div className="flex flex-wrap gap-1">
              {papeis.map((papel, idx) => (
                <StatusBadge key={idx} variant="default" className="text-xs">
                  {PAPEL_LABELS[papel] || papel}
                </StatusBadge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Phone className="h-4 w-4" />
              <span className="text-xs">Contato Principal</span>
            </div>
            {contatoPrincipal ? (
              <div className="text-sm">
                <p className="font-medium">{contatoPrincipal.nome}</p>
                <p>{contatoPrincipal.whatsapp || contatoPrincipal.telefone || contatoPrincipal.email}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Não definido</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <MapPin className="h-4 w-4" />
              <span className="text-xs">Endereço Fiscal</span>
            </div>
            {enderecoFiscal ? (
              <div className="text-sm">
                <p>{enderecoFiscal.cidade}/{enderecoFiscal.uf}</p>
                <p className="text-muted-foreground truncate">{enderecoFiscal.logradouro}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Não definido</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Globe className="h-4 w-4" />
              <span className="text-xs">Site</span>
            </div>
            {entidade.site ? (
              <a href={entidade.site} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline truncate block">
                {entidade.site}
              </a>
            ) : (
              <p className="text-sm text-muted-foreground">Não informado</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="dados" className="mt-6">
        <TabsList>
          <TabsTrigger value="dados">Dados Gerais</TabsTrigger>
          <TabsTrigger value="enderecos">Endereços ({enderecos.length})</TabsTrigger>
          <TabsTrigger value="contatos">Contatos ({contatos.length})</TabsTrigger>
        </TabsList>

        {/* Dados Gerais Tab */}
        <TabsContent value="dados">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Dados Fiscais
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-6">
                <div>
                  <p className="text-sm text-muted-foreground">Tipo Pessoa</p>
                  <p className="font-medium">{entidade.tipo_pessoa === 'PJ' ? 'Pessoa Jurídica' : 'Pessoa Física'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Documento</p>
                  <p className="font-medium font-mono">{formatDocument(entidade.documento)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Inscrição Estadual</p>
                  <p className="font-medium">{entidade.ie || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Inscrição Municipal</p>
                  <p className="font-medium">{entidade.im || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">CNAE</p>
                  <p className="font-medium font-mono">{entidade.cnae || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">CRT</p>
                  <p className="font-medium">{entidade.crt || '-'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground">Nome Fantasia</p>
                  <p className="font-medium">{entidade.nome_fantasia || '-'}</p>
                </div>
              </div>

              {entidade.observacoes && (
                <>
                  <hr className="my-4" />
                  <div>
                    <p className="text-sm text-muted-foreground">Observações</p>
                    <p className="mt-1">{entidade.observacoes}</p>
                  </div>
                </>
              )}

              {entidade.tags && (entidade.tags as string[]).length > 0 && (
                <>
                  <hr className="my-4" />
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Tags</p>
                    <div className="flex flex-wrap gap-1">
                      {(entidade.tags as string[]).map((tag, idx) => (
                        <StatusBadge key={idx} variant="muted">{tag}</StatusBadge>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Endereços Tab */}
        <TabsContent value="enderecos">
          <Card>
            <CardContent className="pt-6">
              {enderecos.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Endereço</TableHead>
                      <TableHead>Bairro</TableHead>
                      <TableHead>Cidade/UF</TableHead>
                      <TableHead>CEP</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {enderecos.map((end) => (
                      <TableRow key={end.id}>
                        <TableCell>
                          <StatusBadge variant="default">
                            {TIPO_ENDERECO_LABELS[end.tipo] || end.tipo}
                          </StatusBadge>
                        </TableCell>
                        <TableCell>{end.logradouro}, {end.nro}</TableCell>
                        <TableCell>{end.bairro}</TableCell>
                        <TableCell>{end.cidade}/{end.uf}</TableCell>
                        <TableCell className="font-mono">{end.cep}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground text-center py-8">Nenhum endereço cadastrado</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contatos Tab */}
        <TabsContent value="contatos">
          <Card>
            <CardContent className="pt-6">
              {contatos.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Cargo</TableHead>
                      <TableHead>Telefone/WhatsApp</TableHead>
                      <TableHead>E-mail</TableHead>
                      <TableHead>Preferencial</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contatos.map((cont) => (
                      <TableRow key={cont.id}>
                        <TableCell className="font-medium">{cont.nome}</TableCell>
                        <TableCell>
                          <StatusBadge variant="muted">
                            {DEPARTAMENTO_LABELS[cont.cargo || ''] || cont.cargo || '-'}
                          </StatusBadge>
                        </TableCell>
                        <TableCell>{cont.whatsapp || cont.telefone || '-'}</TableCell>
                        <TableCell>{cont.email || '-'}</TableCell>
                        <TableCell>
                          {cont.preferencial && <StatusBadge variant="success">Sim</StatusBadge>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground text-center py-8">Nenhum contato cadastrado</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <EntidadeFormDialogComplete
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        entidade={entidadeData as any}
        onSuccess={() => {
          setEditDialogOpen(false);
          refetch();
        }}
      />
    </div>
  );
}
