import { useState, useEffect } from "react";
import { CONTRATO_INDUSTRIALIZACAO_TEMPLATE, substituirTags } from "@/lib/contrato-template";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  CheckCircle2, Clock, Shield, AlertTriangle, Mail, Eye,
  Pencil, Lock, Unlock
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
const SENHA_GERENCIA = "ger2026";

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

  // Edição do contrato
  const [contratoTexto, setContratoTexto] = useState("");
  const [editando, setEditando] = useState(false);
  const [senhaInput, setSenhaInput] = useState("");
  const [pedindoSenha, setPedindoSenha] = useState(false);
  const [contratoRevisado, setContratoRevisado] = useState(false);

  const { data: company } = useQuery({
    queryKey: ["company-contrato"],
    queryFn: async () => {
      const { data } = await supabase.from("company").select("*").limit(1).single();
      return data;
    },
    enabled: open,
  });

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

  // Gera texto do contrato usando template completo
  const gerarTextoContrato = () => {
    if (!orcamento) return "";
    const orc = orcamento as any;
    const fp = FORMAS_PAGAMENTO_LABELS[orc.forma_pagamento || "A_VISTA"] || orc.forma_pagamento;
    const desconto = Number(orc.desconto_percentual || 0);
    const valorFinal = Number(orc.valor_final || 0);
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

    // Gera tabela HTML dos produtos
    let tabelaProdutos = "";
    if (orcamentoItens && orcamentoItens.length > 0) {
      tabelaProdutos = `<table><thead><tr><th>Quantidade</th><th>Produto</th><th>Especificação</th><th>Valor Unit R$</th><th>Valor Total R$</th></tr></thead><tbody>`;
      let totalGeral = 0;
      orcamentoItens.forEach((item: any) => {
        const specs = [
          item.capsula_cor && `Cáps: ${item.capsula_cor}`,
          item.pote_cor && `Pote: ${item.pote_cor}`,
          item.tampa_cor && `Tampa: ${item.tampa_cor}`,
          item.unidades_por_frasco && `${item.unidades_por_frasco} un/pote`,
          item.incluir_silica ? "c/ Sílica" : "",
          item.rotulo || "",
        ].filter(Boolean).join(" | ");
        const vt = Number(item.valor_total || 0);
        totalGeral += vt;
        tabelaProdutos += `<tr><td>${item.quantidade}</td><td>${item.produto_nome}</td><td>${specs}</td><td>${Number(item.preco_unitario || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td><td>${vt.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td></tr>`;
      });
      tabelaProdutos += `<tr><td colspan="4"><strong>Total</strong></td><td><strong>${totalGeral.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong></td></tr></tbody></table>`;
    }

    // Usa o template completo (importado no topo)

    const valores: Record<string, string> = {
      EMPRESA_RAZAO_SOCIAL: empresaNome,
      EMPRESA_CNPJ: empresaCNPJ,
      EMPRESA_ENDERECO_COMPLETO: empresaEndereco,
      EMPRESA_CIDADE: company?.endereco_cidade || "[Cidade]",
      EMPRESA_UF: company?.endereco_uf || "[UF]",
      EMPRESA_TELEFONE: company?.telefone || "",
      EMPRESA_EMAIL: company?.email_financeiro || company?.email_fiscal || "",
      EMPRESA_REPRESENTANTE: "",
      EMPRESA_REPRESENTANTE_CPF: "",
      CLIENTE_NOME: orcamento.cliente_nome,
      CLIENTE_DOCUMENTO: orcamento.cliente_documento || "",
      CLIENTE_ENDERECO: orcamento.cliente_endereco || "",
      CLIENTE_REPRESENTANTE: "",
      CLIENTE_REPRESENTANTE_CPF: "",
      CLIENTE_REPRESENTANTE_RG: "",
      CLIENTE_EMAIL: orcamento.cliente_email || "",
      CLIENTE_WHATSAPP: orcamento.cliente_whatsapp || "",
      PEDIDO_NUMERO: orcamento.codigo,
      PEDIDO_DATA: dataContrato,
      TABELA_PRODUTOS: tabelaProdutos,
      VALOR_SUBTOTAL: `R$ ${Number(orc.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      DESCONTO_PERCENTUAL: desconto > 0 ? `${desconto}%` : "0%",
      VALOR_FINAL: `R$ ${valorFinal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      VALOR_FINAL_EXTENSO: "",
      FORMA_PAGAMENTO: fp,
      FORMA_PAGAMENTO_DETALHES: "",
      PRAZO_ENTREGA: "",
      LOCAL_ENTREGA: "",
      VENDEDOR_NOME: orc.vendedor_nome || "—",
      OBSERVACOES: orcamento.observacoes || "",
      DATA_CONTRATO: dataContrato,
      DATA_CONTRATO_CURTA: orc.data_orcamento ? format(new Date(orc.data_orcamento), "dd/MM/yyyy") : format(new Date(), "dd/MM/yyyy"),
    };

    return substituirTags(CONTRATO_INDUSTRIALIZACAO_TEMPLATE, valores);
  };

  // Gera o texto quando os dados carregam
  useEffect(() => {
    if (open && orcamento) {
      const texto = gerarTextoContrato();
      if (texto.trim()) {
        setContratoTexto(texto);
      }
      // Só reseta estados de edição quando abre pela primeira vez
    }
  }, [open, orcamento?.id, company?.id, orcamentoItens]);

  // Reset estados ao abrir
  useEffect(() => {
    if (open) {
      setContratoRevisado(false);
      setEditando(false);
      setPedindoSenha(false);
      setSenhaInput("");
    }
  }, [open]);

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

  // Pode enviar somente se revisou o contrato (ou já foi enviado antes)
  const podeEnviar = contratoRevisado || contratoEnviado;

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

  const handleDesbloquearEdicao = () => {
    if (senhaInput === SENHA_GERENCIA) {
      setEditando(true);
      setPedindoSenha(false);
      setSenhaInput("");
      toast.success("Edição desbloqueada pela gerência");
    } else {
      toast.error("Senha incorreta!");
      setSenhaInput("");
    }
  };

  const handleAprovarContrato = () => {
    setContratoRevisado(true);
    setEditando(false);
    toast.success("Contrato revisado e aprovado para envio!");
  };

  const handleEnviarEmail = async () => {
    const subject = encodeURIComponent(`Contrato de Industrialização - ${orcamento.codigo}`);
    const body = encodeURIComponent(contratoTexto);
    window.open(`mailto:${orcamento.cliente_email || ""}?subject=${subject}&body=${body}`);
    await updateField({
      contrato_enviado_em: new Date().toISOString(),
      contrato_enviado_via: "EMAIL",
      contrato_status: "ENVIADO",
    });
  };

  const handleEnviarWhatsApp = async () => {
    const phone = (orcamento.cliente_whatsapp || "").replace(/\D/g, "");
    const msg = encodeURIComponent(contratoTexto);
    window.open(`https://wa.me/55${phone}?text=${msg}`, "_blank");
    await updateField({
      contrato_enviado_em: new Date().toISOString(),
      contrato_enviado_via: "WHATSAPP",
      contrato_status: "ENVIADO",
    });
  };

  const handleDownloadPDF = async () => {
    // Gera PDF profissional via print
    const { gerarContratoPDF } = await import("@/lib/contrato-template");
    gerarContratoPDF(
      contratoTexto,
      company?.logo_file_id ? undefined : undefined,
      company?.razao_social || "",
      company?.cnpj || "",
      [company?.endereco_logradouro, company?.endereco_nro && `nº ${company.endereco_nro}`, company?.endereco_bairro, company?.endereco_cidade, company?.endereco_uf, company?.endereco_cep].filter(Boolean).join(", "),
      company?.telefone || "",
      company?.email_financeiro || company?.email_fiscal || ""
    );
    await updateField({
      contrato_enviado_em: new Date().toISOString(),
      contrato_enviado_via: "DOWNLOAD_PDF",
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
            {/* Barra de ações do contrato */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {editando ? (
                  <Badge variant="outline" className="gap-1 text-amber-600 border-amber-300">
                    <Unlock className="h-3 w-3" />
                    Modo Edição (Gerência)
                  </Badge>
                ) : contratoRevisado ? (
                  <Badge className="gap-1 bg-primary/10 text-primary border-primary/30">
                    <CheckCircle2 className="h-3 w-3" />
                    Contrato Aprovado para Envio
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1">
                    <Lock className="h-3 w-3" />
                    Somente Leitura
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-2">
                {!editando && !contratoRevisado && !contratoEnviado && (
                  <>
                    {pedindoSenha ? (
                      <div className="flex items-center gap-1">
                        <Input
                          type="password"
                          placeholder="Senha gerência"
                          value={senhaInput}
                          onChange={(e) => setSenhaInput(e.target.value)}
                          className="w-40 h-8 text-sm"
                          onKeyDown={(e) => e.key === "Enter" && handleDesbloquearEdicao()}
                        />
                        <Button size="sm" variant="outline" onClick={handleDesbloquearEdicao}>
                          <Unlock className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setPedindoSenha(false); setSenhaInput(""); }}>
                          Cancelar
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => setPedindoSenha(true)}>
                        <Pencil className="h-4 w-4 mr-1" />
                        Editar Contrato
                      </Button>
                    )}
                    <Button size="sm" onClick={handleAprovarContrato}>
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Aprovar e Liberar Envio
                    </Button>
                  </>
                )}
                {editando && (
                  <Button size="sm" onClick={handleAprovarContrato}>
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Salvar e Aprovar
                  </Button>
                )}
              </div>
            </div>

            {/* Texto do contrato */}
            <Card>
              <CardContent className="pt-4">
                {editando ? (
                  <Textarea
                    value={contratoTexto}
                    onChange={(e) => setContratoTexto(e.target.value)}
                    className="min-h-[400px] font-mono text-xs leading-relaxed"
                  />
                ) : (
                  <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-foreground max-h-[400px] overflow-y-auto p-3 bg-muted/30 rounded-md">
                    {contratoTexto}
                  </pre>
                )}
              </CardContent>
            </Card>

            {/* Ações de envio — só aparecem após aprovação */}
            {contratoEnviado ? (
              <Card>
                <CardContent className="pt-4">
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    Contrato enviado via <strong>{orc.contrato_enviado_via}</strong> em{" "}
                    {format(new Date(orc.contrato_enviado_em), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </div>
                </CardContent>
              </Card>
            ) : podeEnviar ? (
              <Card>
                <CardContent className="pt-4 space-y-3">
                  <p className="text-sm font-medium text-primary flex items-center gap-1">
                    <Send className="h-4 w-4" />
                    Contrato aprovado — escolha como enviar:
                  </p>
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
                </CardContent>
              </Card>
            ) : (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Revise o contrato acima. Se estiver correto, clique em <strong>"Aprovar e Liberar Envio"</strong>. Para corrigir, clique em <strong>"Editar Contrato"</strong> (requer senha de gerência).
                </AlertDescription>
              </Alert>
            )}
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
                  1. Contrato Enviado
                </CardTitle>
              </CardHeader>
              <CardContent>
                {contratoEnviado ? (
                  <div className="text-sm text-muted-foreground">
                    ✅ Enviado via <strong>{orc.contrato_enviado_via}</strong> em{" "}
                    {format(new Date(orc.contrato_enviado_em), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Vá até a aba "Visualizar Contrato", revise e envie.
                  </p>
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
