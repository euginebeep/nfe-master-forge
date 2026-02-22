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
  Pencil, Lock, Unlock, Loader2, FileDown, X
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
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
  contrato_enviado_por?: string;
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
  const [sendStatus, setSendStatus] = useState<{ type: "idle" | "sending" | "success" | "error"; message: string }>({ type: "idle", message: "" });
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);

  // Edição do contrato
  const [contratoTexto, setContratoTexto] = useState("");
  const [editando, setEditando] = useState(false);
  const [senhaInput, setSenhaInput] = useState("");
  const [pedindoSenha, setPedindoSenha] = useState(false);
  const [contratoRevisado, setContratoRevisado] = useState(false);

  const { profile } = useAuth();
  const nomeUsuario = profile?.nome_completo || "Usuário";

  const { data: company } = useQuery({
    queryKey: ["company-contrato"],
    queryFn: async () => {
      const { data } = await supabase.from("company").select("*").limit(1).single();
      return data;
    },
    enabled: open,
  });

  // Busca URL do logo da empresa
  const { data: logoUrl } = useQuery({
    queryKey: ["company-logo-url", company?.logo_file_id],
    queryFn: async () => {
      if (!company?.logo_file_id) return null;
      const { data: arquivo } = await supabase
        .from("arquivos")
        .select("storage_key")
        .eq("id", company.logo_file_id)
        .single();
      if (!arquivo?.storage_key) return null;
      const { data } = supabase.storage.from("erp-files").getPublicUrl(arquivo.storage_key);
      return data?.publicUrl || null;
    },
    enabled: !!company?.logo_file_id && open,
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
    staleTime: 0,
    gcTime: 0,
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
      setSendStatus({ type: "idle", message: "" });
      setPdfBlobUrl(null);
    }
    return () => {
      // Cleanup PDF blob URL
      if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
    };
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
  const isSending = sendStatus.type === "sending";

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

  const gerarContratoHtml = () => {
    const paragrafos = contratoTexto.split("\n").map((line: string) => {
      const trimmed = line.trim();
      if (!trimmed) return "<br/>";
      if (trimmed.startsWith("CONTRATO DE INDUSTRIALIZAÇÃO")) return `<h1 style="text-align:center;font-size:16pt;font-weight:bold;margin:25px 0 20px;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #333;padding-bottom:10px;">${trimmed}</h1>`;
      if (trimmed.startsWith("--- PEDIDO DE COMPRA")) return `<div style="page-break-before:always;"></div><h1 style="text-align:center;font-size:16pt;font-weight:bold;margin:25px 0 20px;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #333;padding-bottom:10px;">PEDIDO DE COMPRA - ANEXO I</h1>`;
      if (/^\d+\.\s+(DO|DA|DAS|DOS|PARTES|E,)/.test(trimmed)) return `<h2 style="font-size:11pt;font-weight:bold;margin:18px 0 8px;text-transform:uppercase;">${trimmed}</h2>`;
      if (/^\d+\.\d+/.test(trimmed)) return `<p style="text-align:justify;margin:6px 0;">${trimmed}</p>`;
      if (/^[ivx]+\)/.test(trimmed)) return `<p style="text-align:justify;margin:3px 0 3px 30px;">${trimmed}</p>`;
      if (/^[a-z]\)/.test(trimmed)) return `<p style="text-align:justify;margin:3px 0 3px 30px;">${trimmed}</p>`;
      if (trimmed.startsWith("___")) return `<div style="text-align:center;margin:30px 0 5px;">${trimmed}</div>`;
      if (trimmed.startsWith("<table")) return trimmed;
      return `<p style="text-align:justify;margin:4px 0;">${trimmed}</p>`;
    }).join("\n");

    const empresaNome = company?.razao_social || "";
    const empresaCnpj = company?.cnpj || "";
    const empresaEndereco = [company?.endereco_logradouro, company?.endereco_nro && `nº ${company.endereco_nro}`, company?.endereco_bairro, company?.endereco_cidade, company?.endereco_uf, company?.endereco_cep].filter(Boolean).join(", ");
    const rodapeInfo = [empresaNome, empresaEndereco, company?.telefone && `Fone: ${company.telefone}`, (company?.email_financeiro || company?.email_fiscal) && `E-mail: ${company.email_financeiro || company.email_fiscal}`].filter(Boolean).join(" — ");
    const logoHtml = logoUrl ? `<img src="${logoUrl}" alt="Logo" style="max-height:70px;max-width:220px;margin-bottom:8px;display:block;margin-left:auto;margin-right:auto;" />` : "";

    return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Contrato - ${orcamento.codigo}</title>
<style>@page{size:A4;margin:20mm 20mm 25mm 20mm;}*{box-sizing:border-box;margin:0;padding:0;}body{font-family:'Times New Roman',Times,serif;font-size:11pt;line-height:1.5;color:#1a1a1a;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
.header{text-align:center;margin-bottom:20px;border-bottom:2px solid #333;padding-bottom:12px;}
table{width:100%;border-collapse:collapse;font-size:9pt;margin:10px 0;}th{background:#e8e8e8;font-weight:bold;text-align:left;padding:5px 6px;border:1px solid #999;}td{padding:4px 6px;border:1px solid #ccc;}tr:nth-child(even){background:#f7f7f7;}
.footer{position:fixed;bottom:0;left:0;right:0;text-align:center;font-size:7.5pt;color:#888;padding:8px 20mm;border-top:1px solid #ccc;background:#fafafa;}
.footer .compliance{font-size:7pt;color:#999;margin-top:3px;font-style:italic;}
@media screen{body{max-width:800px;margin:20px auto;padding:30px;border:1px solid #ddd;}.footer{position:relative;margin-top:40px;}}</style></head>
<body><div class="header">${logoHtml}${empresaNome ? `<div style="font-size:10pt;color:#333;font-weight:bold;">${empresaNome}</div>` : ""}${empresaCnpj ? `<div style="font-size:9pt;color:#555;">CNPJ: ${empresaCnpj}</div>` : ""}${empresaEndereco ? `<div style="font-size:8pt;color:#666;">${empresaEndereco}</div>` : ""}</div>
${paragrafos}
<div class="footer"><div>${rodapeInfo}</div><div class="compliance">Este documento é confidencial e protegido por sigilo contratual. A reprodução, distribuição ou uso não autorizado é proibida. Emitido eletronicamente — válido sem assinatura física conforme Art. 784, §3º do CPC. Documento gerado em ${new Date().toLocaleString("pt-BR")}.</div></div></body></html>`;
  };

  const handleEnviarEmail = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();

    if (!orcamento.cliente_email) {
      setSendStatus({ type: "error", message: "Email do cliente não cadastrado. Cadastre no cadastro de entidades." });
      return;
    }

    setSendStatus({ type: "sending", message: "Enviando contrato por email..." });

    try {
      const htmlBody = gerarContratoHtml();
      const { data, error } = await supabase.functions.invoke("send-contract-email", {
        body: {
          to: orcamento.cliente_email,
          subject: `Contrato de Industrialização - ${orcamento.codigo}`,
          htmlBody,
          senderName: nomeUsuario,
        },
      });

      if (error) throw new Error(error.message || "Erro ao enviar email");
      if (data && !data.success) throw new Error(data.error || "Falha no envio");

      await updateField({
        contrato_enviado_em: new Date().toISOString(),
        contrato_enviado_via: "EMAIL",
        contrato_enviado_por: nomeUsuario,
        contrato_status: "ENVIADO",
      });
      setSendStatus({ type: "success", message: `✓ Email enviado para ${orcamento.cliente_email} por ${nomeUsuario}` });
    } catch (err: any) {
      console.error("Erro email:", err);
      setSendStatus({ type: "error", message: `Falha no envio: ${err.message}` });
    }
  };

  const handleEnviarWhatsApp = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setSendStatus({ type: "error", message: "WhatsApp automático será configurado em breve. Use Email ou PDF por enquanto." });
  };

  const handleDownloadPDF = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setSendStatus({ type: "sending", message: "Gerando PDF do contrato..." });

    try {
      const htmlContent = gerarContratoHtml();
      const blob = new Blob([htmlContent], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      setPdfBlobUrl(url);
      setSendStatus({ type: "success", message: "PDF gerado com sucesso. Visualize abaixo." });

      await updateField({
        contrato_enviado_em: new Date().toISOString(),
        contrato_enviado_via: "DOWNLOAD_PDF",
        contrato_enviado_por: nomeUsuario,
        contrato_status: "ENVIADO",
      });
    } catch (err: any) {
      setSendStatus({ type: "error", message: `Erro ao gerar PDF: ${err.message}` });
    }
  };

  const handleSalvarPDF = () => {
    if (!pdfBlobUrl) return;
    const a = document.createElement("a");
    a.href = pdfBlobUrl;
    a.download = `Contrato-${orcamento.codigo}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success("Arquivo baixado!");
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
                  <div className="max-h-[400px] overflow-y-auto p-4 bg-muted/30 rounded-md">
                    {/* Logo da empresa */}
                    {logoUrl && (
                      <div className="text-center mb-3 pb-3 border-b border-border">
                        <img src={logoUrl} alt="Logo" className="h-16 max-w-[200px] mx-auto object-contain" />
                        {company?.razao_social && <p className="text-[10px] text-muted-foreground font-semibold mt-1">{company.razao_social}</p>}
                        {company?.cnpj && <p className="text-[9px] text-muted-foreground">CNPJ: {company.cnpj}</p>}
                      </div>
                    )}
                    <div
                      className="whitespace-pre-wrap text-xs leading-relaxed text-foreground prose prose-sm max-w-none [&_table]:w-full [&_table]:border-collapse [&_table]:text-[9px] [&_table]:my-2 [&_th]:bg-muted [&_th]:font-semibold [&_th]:text-left [&_th]:p-1.5 [&_th]:border [&_th]:border-border [&_td]:p-1.5 [&_td]:border [&_td]:border-border [&_tr:nth-child(even)]:bg-muted/30 [&_strong]:font-bold"
                      dangerouslySetInnerHTML={{
                        __html: contratoTexto
                          .replace(/\n/g, '<br/>')
                          .replace(
                            /CONTRATO DE INDUSTRIALIZAÇÃO POR ENCOMENDA/g,
                            '<div style="text-align:center;font-size:14px;font-weight:bold;margin:12px 0;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid currentColor;padding-bottom:8px;">CONTRATO DE INDUSTRIALIZAÇÃO POR ENCOMENDA</div>'
                          )
                          .replace(
                            /--- PEDIDO DE COMPRA - ANEXO I ---/g,
                            '<div style="text-align:center;font-size:14px;font-weight:bold;margin:16px 0 12px;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid currentColor;padding-bottom:8px;">PEDIDO DE COMPRA - ANEXO I</div>'
                          )
                      }}
                    />
                    {/* Rodapé de compliance */}
                    <div className="mt-6 pt-3 border-t border-border text-center">
                      <p className="text-[8px] text-muted-foreground italic">
                        Este documento é confidencial e protegido por sigilo contratual. A reprodução, distribuição ou uso não autorizado é proibida.
                        Emitido eletronicamente — válido sem assinatura física conforme Art. 784, §3º do CPC.
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Ações de envio — só aparecem após aprovação */}
            {contratoEnviado ? (
              <Card>
                <CardContent className="pt-4 space-y-3">
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    Contrato enviado via <strong>{orc.contrato_enviado_via}</strong> em{" "}
                    {format(new Date(orc.contrato_enviado_em), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    {orc.contrato_enviado_por && (
                      <span>por <strong>{orc.contrato_enviado_por}</strong></span>
                    )}
                  </div>
                  <div className="border-t pt-3">
                    <p className="text-xs text-muted-foreground mb-2">Reenviar contrato:</p>
                    <div className="flex gap-2 flex-wrap">
                      <Button size="sm" variant="outline" onClick={handleEnviarEmail} disabled={saving || isSending}>
                        {isSending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Mail className="h-4 w-4 mr-1" />}
                        Reenviar por Email
                      </Button>
                      <Button size="sm" variant="outline" onClick={handleEnviarWhatsApp} disabled={saving || isSending}>
                        <MessageSquare className="h-4 w-4 mr-1" />
                        Reenviar por WhatsApp
                      </Button>
                      <Button size="sm" variant="outline" onClick={handleDownloadPDF} disabled={saving || isSending}>
                        <Download className="h-4 w-4 mr-1" />
                        Baixar PDF
                      </Button>
                    </div>
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
                    <Button size="sm" onClick={handleEnviarEmail} disabled={saving || isSending}>
                      {isSending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Mail className="h-4 w-4 mr-1" />}
                      Enviar por Email
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleEnviarWhatsApp} disabled={saving || isSending}>
                      <MessageSquare className="h-4 w-4 mr-1" />
                      Enviar por WhatsApp
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleDownloadPDF} disabled={saving || isSending}>
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

            {/* Barra de Status de Envio */}
            {sendStatus.type !== "idle" && (
              <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
                sendStatus.type === "sending" ? "bg-muted/50 text-muted-foreground" :
                sendStatus.type === "success" ? "bg-primary/10 text-primary" :
                "bg-destructive/10 text-destructive"
              }`}>
                {sendStatus.type === "sending" && <Loader2 className="h-4 w-4 animate-spin" />}
                {sendStatus.type === "success" && <CheckCircle2 className="h-4 w-4" />}
                {sendStatus.type === "error" && <AlertTriangle className="h-4 w-4" />}
                <span className="flex-1">{sendStatus.message}</span>
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setSendStatus({ type: "idle", message: "" })}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}

            {/* Visualização inline do PDF */}
            {pdfBlobUrl && (
              <Card>
                <CardContent className="pt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium flex items-center gap-1">
                      <Eye className="h-4 w-4" /> Pré-visualização do Contrato
                    </p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={handleSalvarPDF}>
                        <FileDown className="h-4 w-4 mr-1" /> Salvar Arquivo
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setPdfBlobUrl(null)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <iframe
                    src={pdfBlobUrl}
                    className="w-full h-[400px] border rounded-md bg-white"
                    title="Contrato PDF"
                  />
                </CardContent>
              </Card>
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
                    {orc.contrato_enviado_por && (
                      <span> por <strong>{orc.contrato_enviado_por}</strong></span>
                    )}
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
