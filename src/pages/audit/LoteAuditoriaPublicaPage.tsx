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
  FileCheck,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";
import { formatDate } from "@/lib/formatters";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Payload flat da RPC get_lote_publico (produção). */
type LotePublico = {
  ok: boolean;
  erro?: string;
  mensagem?: string;
  tipo_lote?: string;
  id?: string;
  numero_lote?: string;
  status?: string;
  /** quantidade normalizada (preferida); fallback legado: quantidade_recebida */
  quantidade?: number;
  quantidade_recebida?: number;
  unidade?: string;
  embalagem_qtd?: number | null;
  embalagem_unidade?: string | null;
  data_fab?: string | null;
  data_val?: string | null;
  recebido_em?: string | null;
  insumo?: {
    descricao?: string;
    sku?: string | null;
    armazenamento?: string | null;
    higroscopico?: boolean | null;
    controle_especial?: boolean | null;
    criticidade?: string | null;
    alerta?: string | null;
  };
  fornecedor?: {
    razao_social?: string;
    nome_fantasia?: string | null;
    documento?: string | null;
  } | null;
  nota_entrada?: {
    numero?: string | null;
    serie?: string | null;
    chave?: string | null;
    emissao?: string | null;
  } | null;
  empresa?: {
    razao_social?: string;
    nome_fantasia?: string | null;
    cnpj?: string | null;
    licenca_sanitaria?: string | null;
  } | null;
  coa?: { possui?: boolean; quantidade?: number } | null;
  rt?: {
    nome?: string | null;
    tipo_conselho?: string | null;
    numero_registro?: string | null;
    uf_conselho?: string | null;
  } | null;
  /** Presente só quando o usuário autenticado pertence ao tenant dono do lote. */
  tenant?: {
    nf_chave?: string | null;
    custo_unitario_interno?: number | null;
    potencia?: {
      tipo?: string | null;
      valor?: number | null;
      unidade?: string | null;
      validada_rt?: boolean | null;
      validada_em?: string | null;
    } | null;
    documentos?: Array<{
      tipo?: string | null;
      nome?: string | null;
      versao?: string | null;
      status?: string | null;
      data_emissao?: string | null;
    }> | null;
    scans?: {
      total?: number | null;
      ultimo?: string | null;
    } | null;
  } | null;
};

function fmt(value?: string | null) {
  if (!value) return "—";
  // formatDate trata date-only Postgres por troca de string (sem UTC−1 dia)
  return formatDate(value);
}

function formatarDoc(doc?: string | null) {
  if (!doc) return null;
  const n = doc.replace(/\D/g, "");
  if (n.length === 14) {
    return n.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  return doc;
}

export default function LoteAuditoriaPublicaPage() {
  const { hash } = useParams<{ hash: string }>();

  const { data: loteData, isLoading, error } = useQuery({
    queryKey: ["lote-auditoria-publica", hash],
    queryFn: async (): Promise<LotePublico> => {
      if (!hash) throw new Error("Código não informado");

      if (!UUID_RE.test(hash)) throw new Error("Código inválido");

      const { data, error: rpcError } = await supabase.rpc("get_lote_publico", {
        p_id: hash,
      });
      if (rpcError) throw rpcError;

      const payload = data as LotePublico | null;
      if (!payload?.ok) {
        throw new Error(payload?.mensagem ?? "Lote não encontrado");
      }
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

  if (error || !loteData?.ok) {
    const msg = (error as Error)?.message || loteData?.mensagem || "Lote não encontrado";
    const titulo =
      msg === "Código inválido"
        ? "Código inválido"
        : /muitas consultas|rate.?limit/i.test(msg)
        ? "Muitas consultas"
        : "Lote Não Encontrado";

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="w-12 h-12 mx-auto text-destructive mb-4" />
            <h1 className="text-xl font-bold mb-2">{titulo}</h1>
            <p className="text-muted-foreground">{msg}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const lote = loteData;
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
  const avisos: string[] = [];
  if (lote.insumo?.higroscopico) avisos.push("HIGROSCÓPICO — manter recipiente fechado");
  if (lote.insumo?.controle_especial) avisos.push("CONTROLE ESPECIAL");
  if (lote.insumo?.alerta) avisos.push(lote.insumo.alerta);

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
              {lote.tipo_lote === "ACABADO" ? "Produto" : "Insumo / Matéria-Prima"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Nome</p>
              <p className="text-lg font-semibold">{lote.insumo?.descricao || "—"}</p>
              {lote.insumo?.sku && (
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
              <p className="text-sm text-muted-foreground">Quantidade</p>
              <p className="font-medium">
                {Number(lote.quantidade ?? lote.quantidade_recebida ?? 0).toLocaleString("pt-BR")}{" "}
                {lote.unidade || ""}
              </p>
              {lote.embalagem_qtd != null &&
                lote.embalagem_unidade &&
                `${Number(lote.embalagem_qtd).toLocaleString("pt-BR")} ${lote.embalagem_unidade}`.toLowerCase() !==
                  `${Number(lote.quantidade ?? lote.quantidade_recebida ?? 0).toLocaleString("pt-BR")} ${lote.unidade || ""}`.toLowerCase() && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {Number(lote.embalagem_qtd).toLocaleString("pt-BR")} × {lote.embalagem_unidade}{" "}
                    (conforme NF)
                  </p>
                )}
            </div>
            {lote.insumo?.armazenamento && (
              <div className="flex items-start gap-2 text-sm">
                <Thermometer className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <span>{lote.insumo.armazenamento}</span>
              </div>
            )}
            {avisos.length > 0 && (
              <ul className="text-sm font-medium text-amber-700 dark:text-amber-400 space-y-1">
                {avisos.map((a) => (
                  <li key={a}>⚠ {a}</li>
                ))}
              </ul>
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
                  CNPJ/CPF: {formatarDoc(lote.fornecedor.documento)}
                </p>
              )}
              {lote.nota_entrada?.numero && (
                <p className="text-sm text-muted-foreground">
                  NF-e {lote.nota_entrada.numero}
                  {lote.nota_entrada.serie ? `/${lote.nota_entrada.serie}` : ""}
                  {lote.nota_entrada.emissao
                    ? ` · ${fmt(lote.nota_entrada.emissao)}`
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
              {lote.empresa.cnpj && <p>CNPJ {formatarDoc(lote.empresa.cnpj)}</p>}
              {lote.empresa.licenca_sanitaria && (
                <p>Licença: {lote.empresa.licenca_sanitaria}</p>
              )}
            </CardContent>
          </Card>
        )}

        {lote.coa && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileCheck className="w-5 h-5" />
                COA / Laudo
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              {lote.coa.possui
                ? `${lote.coa.quantidade ?? 1} documento(s) de COA vinculado(s)`
                : "Sem COA vinculado a este lote"}
            </CardContent>
          </Card>
        )}

        {lote.tenant != null && (
          <Card className="border-amber-500/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Shield className="w-5 h-5" />
                Informações internas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {lote.tenant.nf_chave && (
                <div>
                  <p className="text-muted-foreground">Chave da NF-e</p>
                  <p className="font-mono text-xs break-all">{lote.tenant.nf_chave}</p>
                </div>
              )}
              {lote.tenant.custo_unitario_interno != null && (
                <div>
                  <p className="text-muted-foreground">Custo unitário interno</p>
                  <p className="font-medium">
                    {Number(lote.tenant.custo_unitario_interno).toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </p>
                </div>
              )}
              {lote.tenant.potencia && (
                <div>
                  <p className="text-muted-foreground">Potência / teor</p>
                  <p className="font-medium">
                    {[
                      lote.tenant.potencia.tipo,
                      lote.tenant.potencia.valor != null
                        ? Number(lote.tenant.potencia.valor).toLocaleString("pt-BR")
                        : null,
                      lote.tenant.potencia.unidade,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  </p>
                  {(lote.tenant.potencia.validada_rt || lote.tenant.potencia.validada_em) && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {lote.tenant.potencia.validada_rt ? "Validada pelo RT" : "Não validada"}
                      {lote.tenant.potencia.validada_em
                        ? ` · ${fmt(lote.tenant.potencia.validada_em)}`
                        : ""}
                    </p>
                  )}
                </div>
              )}
              {Array.isArray(lote.tenant.documentos) && lote.tenant.documentos.length > 0 && (
                <div>
                  <p className="text-muted-foreground mb-2">Documentos / COA</p>
                  <ul className="space-y-2">
                    {lote.tenant.documentos.map((doc, i) => (
                      <li key={i} className="border-b border-border/50 pb-2 last:border-0">
                        <p className="font-medium">{doc.nome || doc.tipo || "Documento"}</p>
                        <p className="text-xs text-muted-foreground">
                          {[doc.tipo, doc.versao && `v${doc.versao}`, doc.status, doc.data_emissao && fmt(doc.data_emissao)]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {lote.tenant.scans && (
                <div>
                  <p className="text-muted-foreground">Scans do QR</p>
                  <p className="font-medium">
                    {lote.tenant.scans.total ?? 0} consulta(s)
                    {lote.tenant.scans.ultimo
                      ? ` · último em ${fmt(lote.tenant.scans.ultimo)}`
                      : ""}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {lote.tipo_lote === "ACABADO" && lote.rt?.nome && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Responsável Técnico</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-semibold">{lote.rt.nome}</p>
              <p className="text-muted-foreground text-sm">
                {[lote.rt.tipo_conselho, lote.rt.numero_registro, lote.rt.uf_conselho]
                  .filter(Boolean)
                  .join(" ")}
              </p>
            </CardContent>
          </Card>
        )}

        <p className="text-center text-xs text-muted-foreground pb-8">
          Consulta pública via QR · sem custo, saldo ou cliente · BrainX ERP
        </p>
      </div>
    </div>
  );
}
