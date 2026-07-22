import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Shield,
  Package,
  Calendar,
  AlertTriangle,
  QrCode,
  ShieldCheck,
  Truck,
  Building2,
  Thermometer,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type LotePublicoPayload = {
  ok: boolean;
  mensagem?: string;
  tipo_lote?: string;
  lote?: {
    id: string;
    numero_lote: string;
    status: string;
    quantidade_original: number;
    unidade_original: string;
    data_fab: string | null;
    data_val: string | null;
    recebido_em: string | null;
    observacoes_qc: string | null;
    insumo: {
      descricao: string;
      sku: string | null;
      tipo_item: string | null;
      armazenamento: string | null;
      texto_alerta: string | null;
      unidade_interna: string | null;
    };
    fornecedor: {
      razao_social: string;
      nome_fantasia: string | null;
      documento: string | null;
    } | null;
    empresa: {
      razao_social: string;
      nome_fantasia: string | null;
      cnpj: string | null;
      site: string | null;
      afe_anvisa: string | null;
      licenca_sanitaria: string | null;
    } | null;
    nota_entrada: {
      numero: string | null;
      serie: string | null;
      dh_emissao: string | null;
    } | null;
  };
};

function fmt(value?: string | null) {
  if (!value) return "—";
  try {
    return format(new Date(value), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return "—";
  }
}

export default function LoteAuditoriaPublicaPage() {
  const { hash } = useParams<{ hash: string }>();

  const { data: loteData, isLoading, error } = useQuery({
    queryKey: ["lote-auditoria-publica", hash],
    queryFn: async (): Promise<LotePublicoPayload> => {
      if (!hash) throw new Error("Código não informado");

      if (!UUID_RE.test(hash)) throw new Error("Código inválido");

      const { data, error: rpcError } = await supabase.rpc("get_lote_publico", {
        p_id: hash,
      });
      if (rpcError) throw rpcError;
      const payload = data as LotePublicoPayload | null;
      if (!payload?.ok) throw new Error(payload?.mensagem ?? "Lote não encontrado");
      return payload;
    },
    enabled: !!hash,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <QrCode className="h-16 w-16 text-muted-foreground" />
          <p className="text-muted-foreground">Verificando integridade do lote...</p>
        </div>
      </div>
    );
  }

  if (error || !loteData?.lote) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="w-12 h-12 mx-auto text-destructive mb-4" />
            <h1 className="text-xl font-bold mb-2">
              {(error as Error)?.message === "Código inválido"
                ? "Código inválido"
                : (error as Error)?.message?.includes("Muitas consultas")
                ? "Muitas consultas"
                : "Lote Não Encontrado"}
            </h1>
            <p className="text-muted-foreground">
              {(error as Error)?.message ||
                "O QR Code escaneado não corresponde a nenhum lote registrado."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const lote = loteData.lote;
  const status = (lote.status || "").toUpperCase();
  const statusVariant =
    status === "QUARENTENA"
      ? "warning"
      : status === "BLOQUEADO" || status === "REJEITADO"
      ? "error"
      : status === "DISPONIVEL" || status === "APROVADO" || status === "LIBERADO"
      ? "success"
      : "muted";

  const empresaNome =
    lote.empresa?.nome_fantasia || lote.empresa?.razao_social || "BrainX ERP";

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      <div className="bg-primary text-primary-foreground py-6 px-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Shield className="w-8 h-8 shrink-0" />
            <div className="min-w-0">
              <h1 className="text-xl font-bold truncate">Certificado de Rastreabilidade</h1>
              <p className="text-sm opacity-80 truncate">{empresaNome}</p>
            </div>
          </div>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, delay: 0.3 }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium bg-green-500/20 text-green-100 shrink-0"
          >
            <ShieldCheck className="h-5 w-5" />
            Verificado
          </motion.div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4 space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Status do Lote</p>
                <StatusBadge variant={statusVariant as any} className="text-lg px-4 py-1 mt-1">
                  {lote.status}
                </StatusBadge>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Lote Nº</p>
                <p className="text-2xl font-bold font-mono">{lote.numero_lote}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Package className="w-5 h-5" />
              Insumo / Matéria-Prima
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Nome</p>
              <p className="text-lg font-semibold">{lote.insumo.descricao}</p>
              {lote.insumo.sku && (
                <p className="text-sm text-muted-foreground">SKU: {lote.insumo.sku}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" /> Fabricação
                </p>
                <p className="font-medium">{fmt(lote.data_fab)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" /> Validade
                </p>
                <p className="font-medium">{fmt(lote.data_val)}</p>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Quantidade recebida</p>
              <p className="font-medium">
                {Number(lote.quantidade_original).toLocaleString("pt-BR")}{" "}
                {lote.unidade_original}
              </p>
            </div>
            {lote.insumo.armazenamento && (
              <div className="flex items-start gap-2 text-sm">
                <Thermometer className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <span>{lote.insumo.armazenamento}</span>
              </div>
            )}
            {lote.insumo.texto_alerta && (
              <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                ⚠ {lote.insumo.texto_alerta}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Truck className="w-5 h-5 text-primary" />
              Origem do Insumo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-primary/5 rounded-lg p-4 space-y-1">
              <p className="text-lg font-semibold">
                {lote.fornecedor?.razao_social || "Fornecedor não identificado"}
              </p>
              {lote.fornecedor?.documento && (
                <p className="text-muted-foreground">
                  CNPJ/CPF: {lote.fornecedor.documento}
                </p>
              )}
              {lote.nota_entrada?.numero && (
                <p className="text-sm text-muted-foreground">
                  NF-e {lote.nota_entrada.numero}
                  {lote.nota_entrada.serie ? `/${lote.nota_entrada.serie}` : ""}
                  {lote.nota_entrada.dh_emissao
                    ? ` · ${fmt(lote.nota_entrada.dh_emissao)}`
                    : ""}
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                Recebido em: {fmt(lote.recebido_em)}
              </p>
            </div>
          </CardContent>
        </Card>

        {lote.empresa && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Building2 className="w-5 h-5" />
                Empresa receptora
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p className="font-semibold text-base">{lote.empresa.razao_social}</p>
              {lote.empresa.cnpj && <p>CNPJ {lote.empresa.cnpj}</p>}
              {lote.empresa.afe_anvisa && <p>AFE: {lote.empresa.afe_anvisa}</p>}
              {lote.empresa.licenca_sanitaria && (
                <p>Licença: {lote.empresa.licenca_sanitaria}</p>
              )}
            </CardContent>
          </Card>
        )}

        <p className="text-center text-xs text-muted-foreground pb-8">
          Consulta pública via QR · dados sem custo, saldo ou cliente · BrainX ERP
        </p>
      </div>
    </div>
  );
}
