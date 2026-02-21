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
import { Checkbox } from "@/components/ui/checkbox";
import {
  FileSignature, Send, Download, MessageSquare, Upload,
  CheckCircle2, Clock, Shield, AlertTriangle, Mail
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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
  "50_50": "50/50",
  CARTAO: "Cartão",
  BOLETO: "Boleto",
  "30_60_90": "30/60/90",
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

  if (!orcamento) return null;

  const orc = orcamento as any;
  const valorFinal = Number(orc.valor_final || 0);
  const precisaAmbos = valorFinal > VALOR_LIMITE_SIMPLES;

  // Status das etapas
  const contratoEnviado = !!orc.contrato_enviado_em;
  const comprovantePago = !!orc.comprovante_pagamento_em;
  const gerenciaAprovada = !!orc.gerencia_aprovado_em;
  const contratoAssinado = !!orc.contrato_assinado_em;

  // Regra: acima do limite precisa dos dois; abaixo basta um
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

  // Gerar texto do contrato para copiar/download
  const gerarTextoContrato = () => {
    const fp = FORMAS_PAGAMENTO_LABELS[orc.forma_pagamento || "A_VISTA"] || orc.forma_pagamento;
    const desconto = Number(orc.desconto_percentual || 0);
    return `CONTRATO DE PRESTAÇÃO DE SERVIÇOS

CONTRATANTE: ${orcamento.cliente_nome}
${orcamento.cliente_documento ? `CNPJ/CPF: ${orcamento.cliente_documento}` : ""}
${orcamento.cliente_endereco ? `Endereço: ${orcamento.cliente_endereco}` : ""}

REFERÊNCIA: ${orcamento.codigo}
DATA: ${orc.data_orcamento ? format(new Date(orc.data_orcamento), "dd/MM/yyyy") : format(new Date(), "dd/MM/yyyy")}

FORMA DE PAGAMENTO: ${fp}
VALOR TOTAL: R$ ${Number(orc.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
${desconto > 0 ? `DESCONTO: ${desconto}%\nVALOR FINAL: R$ ${valorFinal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : ""}

${orcamento.observacoes ? `OBSERVAÇÕES: ${orcamento.observacoes}` : ""}

VENDEDOR: ${orc.vendedor_nome || "—"}

---
Ao assinar este contrato, o CONTRATANTE concorda com os termos e condições descritos acima.

Assinatura do Contratante: _________________________
Data: ___/___/______
`;
  };

  const handleEnviarEmail = async () => {
    const texto = gerarTextoContrato();
    // Usar mailto como fallback
    const subject = encodeURIComponent(`Contrato - ${orcamento.codigo}`);
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSignature className="h-5 w-5" />
            Contrato — {orcamento.codigo}
            <Badge variant={podeConverter ? "default" : "secondary"} className="ml-2">
              {podeConverter ? "Pronto para converter" : (orc.contrato_status || "PENDENTE")}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
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
                  <Button size="sm" variant="outline" onClick={handleEnviarEmail} disabled={saving}>
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
