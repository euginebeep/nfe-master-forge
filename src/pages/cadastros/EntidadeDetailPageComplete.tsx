import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Building2, ArrowLeft, Edit, Phone, Mail, MapPin, Globe, FileText, Wallet, Briefcase, Truck, History } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useEntidadeCompleta, useAuditoriaEntidade } from "@/hooks/use-entidades-extended";
import { EntidadeFormDialogComplete } from "@/components/entidades/EntidadeFormDialogComplete";
import { formatDocument } from "@/lib/formatters";
import { format } from "date-fns";
import { PAPEL_LABELS, DEPARTAMENTO_LABELS, TIPO_ENDERECO_LABELS, FORMA_PAGAMENTO_LABELS, ORIGEM_LEAD_LABELS, ETAPA_FUNIL_LABELS, TIPO_DOCUMENTO_LABELS } from "@/types/entidades";
import type { PapelEntidadeExtended, Departamento, TipoEnderecoExtended, TipoDocumentoEntidade } from "@/types/entidades";

const STATUS_VARIANTS: Record<string, "success" | "warning" | "error"> = {
  ATIVO: "success",
  BLOQUEADO: "error",
  INATIVO: "warning",
};

const CLASSIFICACAO_VARIANTS: Record<string, "success" | "info" | "error" | "warning" | "muted"> = {
  VIP: "info",
  REGULAR: "muted",
  RISCO: "warning",
  RESTRITO: "error",
};

export default function EntidadeDetailPageComplete() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: entidade, isLoading, refetch } = useEntidadeCompleta(id);
  const { data: auditoria = [] } = useAuditoriaEntidade(id);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Carregando...</div>;
  }

  if (!entidade) {
    return <div className="flex items-center justify-center h-64">Entidade não encontrada</div>;
  }

  const enderecoFiscal = entidade.entidade_enderecos?.find(e => e.tipo === 'FISCAL') || entidade.entidade_enderecos?.[0];
  const contatoPrincipal = entidade.entidade_contatos?.find(c => c.preferencial) || entidade.entidade_contatos?.[0];

  return (
    <div>
      <PageHeader
        title={entidade.razao_social}
        description={`${formatDocument(entidade.documento)}${entidade.codigo_interno ? ` • ${entidade.codigo_interno}` : ''}`}
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
              {entidade.entidade_papeis?.map(p => (
                <StatusBadge key={p.id} variant="default" className="text-xs">
                  {PAPEL_LABELS[p.papel as PapelEntidadeExtended] || p.papel}
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

      <Tabs defaultValue="fiscal" className="mt-6">
        <TabsList>
          <TabsTrigger value="fiscal">Fiscal</TabsTrigger>
          <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
          <TabsTrigger value="comercial">CRM</TabsTrigger>
          <TabsTrigger value="logistica">Logística</TabsTrigger>
          <TabsTrigger value="enderecos">Endereços ({entidade.entidade_enderecos?.length || 0})</TabsTrigger>
          <TabsTrigger value="contatos">Contatos ({entidade.entidade_contatos?.length || 0})</TabsTrigger>
          <TabsTrigger value="documentos">Documentos ({entidade.entidade_documentos?.length || 0})</TabsTrigger>
          <TabsTrigger value="auditoria">Auditoria</TabsTrigger>
        </TabsList>

        {/* Fiscal Tab */}
        <TabsContent value="fiscal">
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
              </div>

              {entidade.entidade_fiscal_config && (
                <>
                  <hr className="my-4" />
                  <h4 className="font-medium mb-4">Configurações Padrão</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">CFOP Entrada</p>
                      <p className="font-mono">{entidade.entidade_fiscal_config.cfop_padrao_entrada || '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">CFOP Saída</p>
                      <p className="font-mono">{entidade.entidade_fiscal_config.cfop_padrao_saida || '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Natureza Operação</p>
                      <p>{entidade.entidade_fiscal_config.natureza_operacao_padrao || '-'}</p>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Financeiro Tab */}
        <TabsContent value="financeiro">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                Dados Financeiros
              </CardTitle>
            </CardHeader>
            <CardContent>
              {entidade.entidade_financeiro_config ? (
                <div className="grid grid-cols-4 gap-6">
                  <div>
                    <p className="text-sm text-muted-foreground">Condição Pagamento</p>
                    <p className="font-medium">{entidade.entidade_financeiro_config.condicao_pagamento_padrao || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Forma Pagamento</p>
                    <p className="font-medium">{FORMA_PAGAMENTO_LABELS[entidade.entidade_financeiro_config.forma_pagamento_padrao as keyof typeof FORMA_PAGAMENTO_LABELS] || entidade.entidade_financeiro_config.forma_pagamento_padrao}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Limite de Crédito</p>
                    <p className="font-medium">R$ {Number(entidade.entidade_financeiro_config.limite_credito || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Dias Tolerância</p>
                    <p className="font-medium">{entidade.entidade_financeiro_config.dias_tolerancia || 0} dias</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">E-mail NF-e</p>
                    <p className="font-medium">{entidade.entidade_financeiro_config.email_nfe || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">E-mail Boleto</p>
                    <p className="font-medium">{entidade.entidade_financeiro_config.email_boleto || '-'}</p>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">Nenhuma configuração financeira definida</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Comercial/CRM Tab */}
        <TabsContent value="comercial">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5" />
                CRM / Comercial
              </CardTitle>
            </CardHeader>
            <CardContent>
              {entidade.entidade_comercial_crm ? (
                <div className="grid grid-cols-4 gap-6">
                  <div>
                    <p className="text-sm text-muted-foreground">Origem do Lead</p>
                    <p className="font-medium">{ORIGEM_LEAD_LABELS[entidade.entidade_comercial_crm.origem_lead as keyof typeof ORIGEM_LEAD_LABELS] || entidade.entidade_comercial_crm.origem_lead}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Etapa do Funil</p>
                    <StatusBadge variant="default">{ETAPA_FUNIL_LABELS[entidade.entidade_comercial_crm.etapa_funil as keyof typeof ETAPA_FUNIL_LABELS] || entidade.entidade_comercial_crm.etapa_funil}</StatusBadge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Score</p>
                    <p className="font-medium">{entidade.entidade_comercial_crm.score}/100</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Canal Preferido</p>
                    <p className="font-medium">{entidade.entidade_comercial_crm.canal_preferido}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Desconto Máximo</p>
                    <p className="font-medium">{entidade.entidade_comercial_crm.desconto_maximo_percent}%</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Comissão Padrão</p>
                    <p className="font-medium">{entidade.entidade_comercial_crm.comissao_padrao_percent}%</p>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">Nenhuma configuração CRM definida</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Logística Tab */}
        <TabsContent value="logistica">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Logística
              </CardTitle>
            </CardHeader>
            <CardContent>
              {entidade.entidade_logistica_config ? (
                <div className="grid grid-cols-4 gap-6">
                  <div>
                    <p className="text-sm text-muted-foreground">Frete Padrão</p>
                    <StatusBadge variant="default">{entidade.entidade_logistica_config.frete_padrao}</StatusBadge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Janela Recebimento</p>
                    <p className="font-medium">{entidade.entidade_logistica_config.janela_recebimento || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Prazo Médio Entrega</p>
                    <p className="font-medium">{entidade.entidade_logistica_config.prazo_medio_entrega_dias || '-'} dias</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Lead Time</p>
                    <p className="font-medium">{entidade.entidade_logistica_config.lead_time_dias || '-'} dias</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Pedido Mínimo</p>
                    <p className="font-medium">R$ {Number(entidade.entidade_logistica_config.pedido_minimo || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">Nenhuma configuração logística definida</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Endereços Tab */}
        <TabsContent value="enderecos">
          <Card>
            <CardContent className="pt-6">
              {entidade.entidade_enderecos?.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Endereço</TableHead>
                      <TableHead>Bairro</TableHead>
                      <TableHead>Cidade/UF</TableHead>
                      <TableHead>CEP</TableHead>
                      <TableHead>Principal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entidade.entidade_enderecos.map((end) => (
                      <TableRow key={end.id}>
                        <TableCell>
                          <StatusBadge variant="default">
                            {TIPO_ENDERECO_LABELS[end.tipo as TipoEnderecoExtended] || end.tipo}
                          </StatusBadge>
                        </TableCell>
                        <TableCell>{end.logradouro}, {end.nro}</TableCell>
                        <TableCell>{end.bairro}</TableCell>
                        <TableCell>{end.cidade}/{end.uf}</TableCell>
                        <TableCell className="font-mono">{end.cep}</TableCell>
                        <TableCell>
                          {end.principal && <StatusBadge variant="success">Sim</StatusBadge>}
                        </TableCell>
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
              {entidade.entidade_contatos?.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Departamento</TableHead>
                      <TableHead>Cargo</TableHead>
                      <TableHead>Telefone/WhatsApp</TableHead>
                      <TableHead>E-mail</TableHead>
                      <TableHead>Principal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entidade.entidade_contatos.map((contato) => (
                      <TableRow key={contato.id}>
                        <TableCell className="font-medium">{contato.nome}</TableCell>
                        <TableCell>
                          <StatusBadge variant="default">
                            {DEPARTAMENTO_LABELS[contato.departamento as Departamento] || contato.departamento}
                          </StatusBadge>
                        </TableCell>
                        <TableCell>{contato.cargo || '-'}</TableCell>
                        <TableCell>{contato.whatsapp || contato.telefone || '-'}</TableCell>
                        <TableCell>{contato.email || '-'}</TableCell>
                        <TableCell>
                          {contato.preferencial && <StatusBadge variant="success">Sim</StatusBadge>}
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

        {/* Documentos Tab */}
        <TabsContent value="documentos">
          <Card>
            <CardContent className="pt-6">
              {entidade.entidade_documentos?.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Arquivo</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Observações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entidade.entidade_documentos.map((doc) => (
                      <TableRow key={doc.id}>
                        <TableCell>
                          <StatusBadge variant="default">
                            {TIPO_DOCUMENTO_LABELS[doc.tipo as TipoDocumentoEntidade] || doc.tipo}
                          </StatusBadge>
                        </TableCell>
                        <TableCell className="font-medium">{doc.nome_arquivo}</TableCell>
                        <TableCell>{format(new Date(doc.created_at), 'dd/MM/yyyy')}</TableCell>
                        <TableCell className="max-w-48 truncate">{doc.observacoes || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground text-center py-8">Nenhum documento anexado</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Auditoria Tab */}
        <TabsContent value="auditoria">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Histórico de Alterações
              </CardTitle>
            </CardHeader>
            <CardContent>
              {auditoria.length ? (
                <div className="space-y-3">
                  {auditoria.map((evento: any) => (
                    <div key={evento.id} className="flex items-center gap-4 p-3 border rounded-md">
                      <StatusBadge variant={evento.acao === 'CREATE' ? 'success' : evento.acao === 'DELETE' ? 'error' : 'warning'}>
                        {evento.acao}
                      </StatusBadge>
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(evento.created_at), 'dd/MM/yyyy HH:mm:ss')}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">Nenhum evento registrado</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <EntidadeFormDialogComplete
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        entidade={entidade}
        onSuccess={() => refetch()}
      />
    </div>
  );
}
