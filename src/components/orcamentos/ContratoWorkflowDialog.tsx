import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FileSignature, Send, Download, MessageSquare, Upload,
  CheckCircle2, Clock, Shield, AlertTriangle, Mail, Eye
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Orcamento {
  id: string;
  codigo: string;
  cliente_nome: string;
  cliente_email?: string;
  cliente_whatsapp?: string;
  cliente_documento?: string;
  cliente_endereco?: string;
  valor_total: number;
  valor_final: number;
  contrato_status?: string;
  contrato_enviado_em?: string;
  contrato_enviado_via?: string;
  comprovante_pagamento_em?: string;
  comprovante_pagamento_obs?: string;
  gerencia_aprovado_por?: string;
  gerencia_aprovado_em?: string;
  gerencia_observacoes?: string;
  contrato_assinado_em?: string;
  contrato_conferido_por?: string;
  contrato_conferido_em?: string;
  forma_pagamento?: string;
  desconto_percentual?: number;
  vendedor_nome?: string;
  data_orcamento?: string;
  observacoes?: string;
}

interface ContratoWorkflowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orcamento: Orcamento | null;
  onUpdate: () => void;
}

const VALOR_LIMITE_SIMPLES = 5000;

const FORMAS_PAGAMENTO_LABELS: Record<string, string> = {
  A_VISTA: "À Vista",
  "50_50": "50% na confirmação do pedido e 50% na emissão da NF para despacho",
  CARTAO: "Cartão de Crédito",
  BOLETO: "Boleto Bancário",
  "30_60_90": "30/60/90 dias",
};

export function ContratoWorkflowDialog({
  open,
  onOpenChange,
  orcamento,
  onUpdate,
}: ContratoWorkflowDialogProps) {
  const [comprovanteObs, setComprovanteObs] = useState("");
  const [gerenciaObs, setGerenciaObs] = useState("");
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("contrato");

  // Buscar dados da empresa
  const { data: company } = useQuery({
    queryKey: ["company-contrato"],
    queryFn: async () => {
      const { data } = await supabase.from("company").select("*").limit(1).single();
      return data;
    },
    enabled: open,
  });

  // Buscar itens do orçamento
  const { data: orcamentoItens } = useQuery({
    queryKey: ["contrato-orcamento-itens", orcamento?.id],
    queryFn: async () => {
      if (!orcamento?.id) return [];
      const { data, error } = await supabase
        .from("orcamento_itens")
        .select("*")
        .eq("orcamento_id", orcamento.id)
        .order("ordem");
      if (error) throw error;
      return data || [];
    },
    enabled: !!orcamento?.id && open,
  });

  if (!orcamento) return null;

  const orc = orcamento as any;
  const valorFinal = Number(orc.valor_final || 0);
  const precisaAmbos = valorFinal > VALOR_LIMITE_SIMPLES;

  const contratoEnviado = !!orc.contrato_enviado_em;
  const comprovantePago = !!orc.comprovante_pagamento_em;
  const gerenciaAprovada = !!orc.gerencia_aprovado_em;
  const contratoAssinado = !!orc.contrato_assinado_em;

  const pagamentoOuGerenciaOK = precisaAmbos
    ? comprovantePago && gerenciaAprovada
    : comprovantePago || gerenciaAprovada;

  const podeConverter = contratoEnviado && pagamentoOuGerenciaOK && contratoAssinado;

  const updateField = async (fields: Record<string, any>) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("orcamentos")
        .update(fields as any)
        .eq("id", orcamento.id);
      if (error) throw error;
      toast.success("Atualizado com sucesso!");
      onUpdate();
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar");
    } finally {
      setSaving(false);
    }
  };

  const gerarTextoContrato = () => {
    const fp = FORMAS_PAGAMENTO_LABELS[orc.forma_pagamento || "A_VISTA"] || orc.forma_pagamento;
    const desconto = Number(orc.desconto_percentual || 0);
    const dataContrato = orc.data_orcamento
      ? format(new Date(orc.data_orcamento), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
      : format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });

    const empresaNome = company?.razao_social || "[EMPRESA]";
    const empresaCNPJ = company?.cnpj || "[CNPJ]";
    const empresaEndereco = [
      company?.endereco_logradouro,
      company?.endereco_nro && `nº ${company.endereco_nro}`,
      company?.endereco_bairro && `Bairro ${company.endereco_bairro}`,
      company?.endereco_cidade,
      company?.endereco_uf,
      company?.endereco_cep && `CEP: ${company.endereco_cep}`,
    ].filter(Boolean).join(", ");

    // Tabela de produtos
    let tabelaProdutos = "";
    if (orcamentoItens && orcamentoItens.length > 0) {
      tabelaProdutos = "| Qtd | Produto | Especificação | Valor Unit R$ | Valor Total R$ |\n";
      tabelaProdutos += "|-----|---------|---------------|---------------|----------------|\n";
      orcamentoItens.forEach((item: any) => {
        const specs = [
          item.capsula_cor && `Cáps: ${item.capsula_cor}`,
          item.pote_cor && `Pote: ${item.pote_cor}`,
          item.tampa_cor && `Tampa: ${item.tampa_cor}`,
          item.unidades_por_frasco && `${item.unidades_por_frasco} un/pote`,
          item.incluir_silica ? "c/ Sílica" : "",
          item.rotulo || "",
        ].filter(Boolean).join(" | ");
        tabelaProdutos += `| ${item.quantidade} | ${item.produto_nome} | ${specs} | ${Number(item.preco_unitario || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} | ${Number(item.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} |\n`;
      });
    }

    return `CONTRATO DE INDUSTRIALIZAÇÃO POR ENCOMENDA

PARTES:

${orcamento.cliente_nome}, ${orcamento.cliente_documento ? `inscrita no CNPJ/CPF sob nº ${orcamento.cliente_documento}` : ""}${orcamento.cliente_endereco ? `, com sede em ${orcamento.cliente_endereco}` : ""}, neste ato denominada CONTRATANTE.

${empresaNome}, com sede em ${empresaEndereco}, inscrita no CNPJ sob o nº ${empresaCNPJ}, neste ato denominada CONTRATADA.

Considerando que:
1. A CONTRATADA possui todas as licenças e autorizações para fabricação e que atende às Boas Práticas de Fabricação;
2. A CONTRATANTE é empresa que atua no mercado e que é de seu interesse que a CONTRATADA fabrique produtos sob encomenda;

Têm entre si, de maneira justa e acordada, o presente CONTRATO DE INDUSTRIALIZAÇÃO POR ENCOMENDA, ficando desde já aceito, pelas cláusulas abaixo descritas:

1. DO OBJETO
1.1. O presente tem como OBJETO a industrialização por encomenda, pela CONTRATADA, de produtos para a CONTRATANTE, segundo especificações e encomendas desta.

2. DO PROCESSO E DAS NORMAS DE INDUSTRIALIZAÇÃO
2.1. A fabricação dos produtos compreende as etapas da formulação, pesagem e mistura, encapsulamento e/ou compressão, envase, rotulagem, enfardamento e/ou encaixotamento.
2.2. A industrialização será realizada com atendimento das normas de Boas Práticas de Fabricação de Alimentos.

3. DOS PEDIDOS DE COMPRA
3.1. Os Pedidos formalizados pela CONTRATANTE deverão conter especificação, quantidade, preços, condições de pagamento e programações de entrega.

PEDIDO DE COMPRA — ANEXO I

Número do Pedido: ${orcamento.codigo}
Data: ${dataContrato}

CONTRATANTE: ${orcamento.cliente_nome}
${orcamento.cliente_documento ? `CNPJ/CPF: ${orcamento.cliente_documento}` : ""}
${orcamento.cliente_endereco ? `Endereço: ${orcamento.cliente_endereco}` : ""}

PRODUTOS:

${tabelaProdutos}
SUBTOTAL: R$ ${Number(orc.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
${desconto > 0 ? `DESCONTO: ${desconto}%\nVALOR FINAL: R$ ${valorFinal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : `VALOR TOTAL: R$ ${valorFinal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}

FORMA DE PAGAMENTO: ${fp}

${orcamento.observacoes ? `OBSERVAÇÕES: ${orcamento.observacoes}` : ""}

VENDEDOR: ${orc.vendedor_nome || "—"}

4. DA ENTREGA
4.1. O prazo de fabricação e entrega respeitará o cronograma e capacidade fabril da CONTRATADA.

5. DO PREÇO E PAGAMENTO
5.1. Em caso de atraso no pagamento, a CONTRATANTE deverá efetuar o pagamento acrescido de multa moratória de 2%, juros de mora de 1% ao mês e correção monetária.
5.2. Em caso de cancelamento de pedido já confirmado, aplica-se multa de 30% do valor do pedido.

6. DA CONFIDENCIALIDADE
6.1. As partes comprometem-se a manter a confidencialidade das informações relacionadas ao contrato.

7. DA VIGÊNCIA
7.1. O presente contrato vigora pelo prazo de 12 meses, renovando-se automaticamente.

8. DO FORO
8.1. Fica eleito o foro da comarca da sede da CONTRATADA para dirimir quaisquer dúvidas.

E, por estarem justas e convencionadas, as partes assinam o presente contrato.

${company?.endereco_cidade || "[Cidade]"}/${company?.endereco_uf || "[UF]"}, ${dataContrato}.


___________________________________________
${orcamento.cliente_nome}
${orcamento.cliente_documento ? `CNPJ/CPF: ${orcamento.cliente_documento}` : ""}
CONTRATANTE


___________________________________________
${empresaNome}
CNPJ: ${empresaCNPJ}
CONTRATADA
`;
  };

  const handleEnviarEmail = async () => {
    const texto = gerarTextoContrato();
    const subject = encodeURIComponent(`Contrato de Industrialização - ${orcamento.codigo}`);
    const body = encodeURIComponent(texto);
    window.open(`mailto:${orcamento.cliente_email || ""}?subject=${subject}&body=${body}`);
    await updateField({
      contrato_enviado_em: new Date().toISOString(),
      contrato_enviado_via: "EMAIL",
      contrato_status: "ENVIADO",
    });
  };

  const handleEnviarWhatsApp = async () => {
    const texto = gerarTextoContrato();
    const phone = (orcamento.cliente_whatsapp || "").replace(/\D/g, "");
    const msg = encodeURIComponent(texto);
    window.open(`https://wa.me/55${phone}?text=${msg}`, "_blank");
    await updateField({
      contrato_enviado_em: new Date().toISOString(),
      contrato_enviado_via: "WHATSAPP",
      contrato_status: "ENVIADO",
    });
  };

  const handleDownloadPDF = async () => {
    const texto = gerarTextoContrato();
    const blob = new Blob([texto], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Contrato_${orcamento.codigo}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    await updateField({
      contrato_enviado_em: new Date().toISOString(),
      contrato_enviado_via: "DOWNLOAD",
      contrato_status: "ENVIADO",
    });
  };

  const handleConfirmarComprovante = async () => {
    await updateField({
      comprovante_pagamento_em: new Date().toISOString(),
      comprovante_pagamento_obs: comprovanteObs || "Comprovante recebido",
      contrato_status: "EM_ANALISE",
    });
  };

  const handleAprovarGerencia = async () => {
    await updateField({
      gerencia_aprovado_em: new Date().toISOString(),
      gerencia_observacoes: gerenciaObs || "Aprovado pela gerência",
      contrato_status: "EM_ANALISE",
    });
  };

  const handleConfirmarAssinatura = async () => {
    await updateField({
      contrato_assinado_em: new Date().toISOString(),
      contrato_status: "ASSINADO",
    });
  };

  const StepIcon = ({ done }: { done: boolean }) =>
    done ? (
      <CheckCircle2 className="h-5 w-5 text-primary" />
    ) : (
      <Clock className="h-5 w-5 text-muted-foreground" />
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSignature className="h-5 w-5" />
            Contrato — {orcamento.codigo}
            <Badge variant={podeConverter ? "default" : "secondary"} className="ml-2">
              {podeConverter ? "Pronto para converter" : (orc.contrato_status || "PENDENTE")}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="contrato">
              <Eye className="h-4 w-4 mr-2" />
              Visualizar Contrato
            </TabsTrigger>
            <TabsTrigger value="workflow">
              <FileSignature className="h-4 w-4 mr-2" />
              Etapas do Workflow
            </TabsTrigger>
          </TabsList>

          {/* Tab Contrato */}
          <TabsContent value="contrato" className="space-y-4">
            {/* Resumo do pedido com tabela de itens */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Pedido de Compra — {orcamento.codigo}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Contratante</p>
                    <p className="font-medium">{orcamento.cliente_nome}</p>
                    {orcamento.cliente_documento && (
                      <p className="text-xs text-muted-foreground">{orcamento.cliente_documento}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Contratada</p>
                    <p className="font-medium">{company?.razao_social || "—"}</p>
                    <p className="text-xs text-muted-foreground">{company?.cnpj || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Vendedor</p>
                    <p className="font-medium">{orc.vendedor_nome || "—"}</p>
                  </div>
                </div>

                {/* Tabela de produtos */}
                {orcamentoItens && orcamentoItens.length > 0 && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Qtd</TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead>Especificação</TableHead>
                        <TableHead className="text-right">V. Unit</TableHead>
                        <TableHead className="text-right">V. Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orcamentoItens.map((item: any) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono">{item.quantidade}</TableCell>
                          <TableCell className="font-medium">{item.produto_nome}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {[
                              item.unidades_por_frasco && `${item.unidades_por_frasco} un`,
                              item.capsula_cor,
                              item.pote_cor && `Pote ${item.pote_cor}`,
                              item.tampa_cor && `Tampa ${item.tampa_cor}`,
                              item.incluir_silica ? "c/ Sílica" : null,
                              item.rotulo,
                            ].filter(Boolean).join(" • ")}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {Number(item.preco_unitario || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-right font-mono font-medium">
                            {Number(item.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}

                <div className="flex justify-between items-end pt-2 border-t">
                  <div className="text-sm">
                    <p className="text-muted-foreground">
                      Pagamento: <span className="font-medium text-foreground">{FORMAS_PAGAMENTO_LABELS[orc.forma_pagamento || "A_VISTA"] || orc.forma_pagamento}</span>
                    </p>
                  </div>
                  <div className="text-right space-y-1">
                    {Number(orc.desconto_percentual || 0) > 0 && (
                      <>
                        <p className="text-sm text-muted-foreground">
                          Subtotal: R$ {Number(orc.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-sm text-destructive">
                          Desconto: {orc.desconto_percentual}%
                        </p>
                      </>
                    )}
                    <p className="text-lg font-bold">
                      R$ {valorFinal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Ações de envio */}
            <Card>
              <CardContent className="pt-4">
                {contratoEnviado ? (
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    Contrato enviado via <strong>{orc.contrato_enviado_via}</strong> em{" "}
                    {format(new Date(orc.contrato_enviado_em), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm font-medium">Enviar contrato ao cliente:</p>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleEnviarEmail} disabled={saving}>
                        <Mail className="h-4 w-4 mr-1" />
                        Enviar por Email
                      </Button>
                      <Button size="sm" variant="outline" onClick={handleEnviarWhatsApp} disabled={saving}>
                        <MessageSquare className="h-4 w-4 mr-1" />
                        Enviar por WhatsApp
                      </Button>
                      <Button size="sm" variant="outline" onClick={handleDownloadPDF} disabled={saving}>
                        <Download className="h-4 w-4 mr-1" />
                        Baixar Contrato
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab Workflow */}
          <TabsContent value="workflow" className="space-y-4">
            {/* Resumo */}
            <div className="grid grid-cols-3 gap-3 p-3 bg-muted/50 rounded-lg text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Cliente</p>
                <p className="font-medium">{orcamento.cliente_nome}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Valor Final</p>
                <p className="font-bold text-secondary">
                  R$ {valorFinal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Regra</p>
                <p className="text-xs">
                  {precisaAmbos ? (
                    <span className="text-destructive font-medium">Comprovante + Gerência obrigatórios</span>
                  ) : (
                    <span className="text-primary font-medium">Comprovante OU Gerência</span>
                  )}
                </p>
              </div>
            </div>

            {precisaAmbos && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Valor acima de R$ {VALOR_LIMITE_SIMPLES.toLocaleString("pt-BR")} — exige comprovante de pagamento <strong>E</strong> aprovação da gerência.
                </AlertDescription>
              </Alert>
            )}

            {/* Etapa 1: Enviar Contrato */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <StepIcon done={contratoEnviado} />
                  1. Enviar Contrato
                </CardTitle>
              </CardHeader>
              <CardContent>
                {contratoEnviado ? (
                  <div className="text-sm text-muted-foreground">
                    ✅ Enviado via <strong>{orc.contrato_enviado_via}</strong> em{" "}
                    {format(new Date(orc.contrato_enviado_em), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleEnviarEmail} disabled={saving}>
                      <Mail className="h-4 w-4 mr-1" />
                      Email
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleEnviarWhatsApp} disabled={saving}>
                      <MessageSquare className="h-4 w-4 mr-1" />
                      WhatsApp
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleDownloadPDF} disabled={saving}>
                      <Download className="h-4 w-4 mr-1" />
                      Download
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Etapa 2: Comprovante de Pagamento */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <StepIcon done={comprovantePago} />
                  2. Comprovante de Pagamento
                </CardTitle>
              </CardHeader>
              <CardContent>
                {comprovantePago ? (
                  <div className="text-sm text-muted-foreground">
                    ✅ Confirmado em{" "}
                    {format(new Date(orc.comprovante_pagamento_em), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    {orc.comprovante_pagamento_obs && (
                      <span className="block mt-1">Obs: {orc.comprovante_pagamento_obs}</span>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Textarea
                      placeholder="Observações sobre o comprovante recebido..."
                      value={comprovanteObs}
                      onChange={(e) => setComprovanteObs(e.target.value)}
                      rows={2}
                    />
                    <Button
                      size="sm"
                      onClick={handleConfirmarComprovante}
                      disabled={saving || !contratoEnviado}
                    >
                      <Upload className="h-4 w-4 mr-1" />
                      Confirmar Recebimento
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Etapa 3: Liberação Gerência */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <StepIcon done={gerenciaAprovada} />
                  3. Liberação da Gerência
                  {!precisaAmbos && comprovantePago && (
                    <Badge variant="outline" className="text-xs">Opcional</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {gerenciaAprovada ? (
                  <div className="text-sm text-muted-foreground">
                    ✅ Aprovado em{" "}
                    {format(new Date(orc.gerencia_aprovado_em), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    {orc.gerencia_observacoes && (
                      <span className="block mt-1">Obs: {orc.gerencia_observacoes}</span>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Textarea
                      placeholder="Observações da gerência..."
                      value={gerenciaObs}
                      onChange={(e) => setGerenciaObs(e.target.value)}
                      rows={2}
                    />
                    <Button
                      size="sm"
                      onClick={handleAprovarGerencia}
                      disabled={saving || !contratoEnviado}
                    >
                      <Shield className="h-4 w-4 mr-1" />
                      Aprovar
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Etapa 4: Contrato Assinado */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <StepIcon done={contratoAssinado} />
                  4. Contrato Assinado e Conferido
                </CardTitle>
              </CardHeader>
              <CardContent>
                {contratoAssinado ? (
                  <div className="text-sm text-muted-foreground">
                    ✅ Assinado e conferido em{" "}
                    {format(new Date(orc.contrato_assinado_em), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </div>
                ) : (
                  <Button
                    size="sm"
                    onClick={handleConfirmarAssinatura}
                    disabled={saving || !contratoEnviado || !pagamentoOuGerenciaOK}
                  >
                    <FileSignature className="h-4 w-4 mr-1" />
                    Confirmar Assinatura Recebida
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Status final */}
            {podeConverter && (
              <Alert className="border-primary bg-primary/5">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <AlertDescription className="text-sm font-medium">
                  Todas as etapas foram cumpridas! O orçamento pode ser convertido em pedido.
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
