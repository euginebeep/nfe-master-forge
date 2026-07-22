import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Package,
  AlertTriangle,
  QrCode,
  Truck,
  Building2,
  Thermometer,
  FileCheck,
  Lock,
} from "lucide-react";
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
    scans?: { total?: number | null; ultimo?: string | null } | null;
  } | null;
};

function fmt(value?: string | null) {
  if (!value) return "—";
  // formatDate trata date-only do Postgres por troca de string (sem UTC−1 dia)
  return formatDate(value);
}

function fmtNum(n?: number | null) {
  if (n == null) return "—";
  return Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}

function formatarDoc(doc?: string | null) {
  if (!doc) return null;
  const n = doc.replace(/\D/g, "");
  if (n.length === 14)
    return n.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  if (n.length === 11)
    return n.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  return doc;
}

/** Dias até a validade. Parse local para não errar por fuso. */
function diasAteValidade(dataVal?: string | null): number | null {
  if (!dataVal) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dataVal).trim());
  const alvo = m
    ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    : new Date(dataVal);
  if (isNaN(alvo.getTime())) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  alvo.setHours(0, 0, 0, 0);
  return Math.round((alvo.getTime() - hoje.getTime()) / 86400000);
}

type Faixa = { rotulo: string; classe: string };

function faixaStatus(status: string): Faixa {
  switch (status) {
    case "QUARENTENA":
      return {
        rotulo: "QUARENTENA — NÃO UTILIZAR",
        classe: "bg-amber-400 text-amber-950 border-amber-600",
      };
    case "DISPONIVEL":
    case "APROVADO":
    case "LIBERADO":
      return {
        rotulo: "LIBERADO PARA PRODUÇÃO",
        classe: "bg-emerald-500 text-white border-emerald-700",
      };
    case "BLOQUEADO":
    case "REJEITADO":
      return {
        rotulo: "BLOQUEADO — NÃO UTILIZAR",
        classe: "bg-red-600 text-white border-red-800",
      };
    case "CONSUMIDO":
      return {
        rotulo: "CONSUMIDO",
        classe: "bg-slate-500 text-white border-slate-700",
      };
    default:
      return {
        rotulo: status || "SEM STATUS",
        classe: "bg-slate-200 text-slate-900 border-slate-400",
      };
  }
}

/** Bloco compacto rótulo/valor, no espírito da etiqueta impressa. */
function Campo({
  rotulo,
  children,
  className = "",
}: {
  rotulo: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        {rotulo}
      </p>
      <div className="font-semibold leading-tight">{children}</div>
    </div>
  );
}

export default function LoteAuditoriaPublicaPage() {
  const { hash } = useParams<{ hash: string }>();

  const {
    data: loteData,
    isLoading,
    error,
  } = useQuery({
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
          <p className="text-muted-foreground">Verificando lote...</p>
        </div>
      </div>
    );
  }

  if (error || !loteData?.ok) {
    const msg =
      (error as Error)?.message || loteData?.mensagem || "Lote não encontrado";
    const titulo =
      msg === "Código inválido"
        ? "Código inválido"
        : /muitas consultas|rate.?limit/i.test(msg)
        ? "Muitas consultas"
        : "Lote não encontrado";

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-xl border bg-card p-8 text-center">
          <AlertTriangle className="w-12 h-12 mx-auto text-destructive mb-4" />
          <h1 className="text-xl font-bold mb-2">{titulo}</h1>
          <p className="text-muted-foreground">{msg}</p>
        </div>
      </div>
    );
  }

  const lote = loteData;
  const status = (lote.status || "").toUpperCase();
  const faixa = faixaStatus(status);
  const acabado = lote.tipo_lote === "ACABADO";

  const empresaNome =
    lote.empresa?.nome_fantasia || lote.empresa?.razao_social || "BrainX ERP";

  const qtd = lote.quantidade ?? lote.quantidade_recebida;
  const mostrarEmbalagem =
    lote.embalagem_qtd != null &&
    !!lote.embalagem_unidade &&
    `${fmtNum(lote.embalagem_qtd)} ${lote.embalagem_unidade}`.toLowerCase() !==
      `${fmtNum(qtd)} ${lote.unidade ?? ""}`.toLowerCase();

  const dias = diasAteValidade(lote.data_val);
  const vencido = dias != null && dias < 0;
  const venceLogo = dias != null && dias >= 0 && dias <= 30;

  const avisos: string[] = [];
  if (lote.insumo?.higroscopico) avisos.push("HIGROSCÓPICO — manter recipiente fechado");
  if (lote.insumo?.controle_especial) avisos.push("CONTROLE ESPECIAL");
  if (lote.insumo?.alerta) avisos.push(lote.insumo.alerta);

  return (
    <div className="min-h-screen bg-muted/40">
      <div className="mx-auto w-full max-w-lg p-3 space-y-3">
        {/* ---------- Cabeçalho compacto ---------- */}
        <header className="rounded-xl bg-primary px-4 py-3 text-primary-foreground">
          <p className="text-[11px] font-bold uppercase tracking-widest opacity-80">
            Rastreabilidade de lote
          </p>
          <h1 className="text-lg font-bold leading-tight">{empresaNome}</h1>
          {lote.empresa?.cnpj && (
            <p className="text-xs opacity-80">
              CNPJ {formatarDoc(lote.empresa.cnpj)}
              {lote.empresa.licenca_sanitaria
                ? ` · Lic. Sanit. ${lote.empresa.licenca_sanitaria}`
                : ""}
            </p>
          )}
        </header>

        {/* ---------- Faixa de status: a informação mais importante ---------- */}
        <div
          className={`rounded-xl border-2 px-4 py-3 text-center text-lg font-black uppercase tracking-wide ${faixa.classe}`}
        >
          {faixa.rotulo}
        </div>

        {/* ---------- Vencimento: alerta próprio ---------- */}
        {vencido && (
          <div className="rounded-xl border-2 border-red-800 bg-red-600 px-4 py-3 text-center text-white">
            <p className="text-lg font-black uppercase">Lote vencido</p>
            <p className="text-sm font-semibold">
              Validade expirou em {fmt(lote.data_val)} · há {Math.abs(dias!)} dia
              {Math.abs(dias!) === 1 ? "" : "s"}
            </p>
          </div>
        )}
        {venceLogo && (
          <div className="rounded-xl border-2 border-amber-600 bg-amber-100 px-4 py-2 text-center text-amber-950">
            <p className="font-bold uppercase">
              Vence em {dias} dia{dias === 1 ? "" : "s"}
            </p>
          </div>
        )}

        {/* ---------- Identificação ---------- */}
        <section className="rounded-xl border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold">
            <Package className="h-4 w-4" />
            {acabado ? "Produto acabado" : "Insumo / Matéria-prima"}
          </div>

          <div>
            <p className="text-xl font-bold uppercase leading-tight">
              {lote.insumo?.descricao || "—"}
            </p>
            {lote.insumo?.sku && (
              <p className="font-mono text-xs text-muted-foreground">
                SKU {lote.insumo.sku}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 border-y py-3">
            <Campo rotulo="Lote do fornecedor">
              <span className="font-mono text-lg tracking-wide">
                {lote.numero_lote}
              </span>
            </Campo>
            <Campo rotulo="Quantidade" className="text-right">
              <span className="text-2xl font-black">{fmtNum(qtd)}</span>{" "}
              <span className="text-sm">{lote.unidade}</span>
              {mostrarEmbalagem && (
                <p className="text-[11px] font-normal text-muted-foreground">
                  {fmtNum(lote.embalagem_qtd)} × {lote.embalagem_unidade} (NF)
                </p>
              )}
            </Campo>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="Fabricação">{fmt(lote.data_fab)}</Campo>
            <Campo rotulo="Validade" className="text-right">
              <span
                className={`text-lg font-black ${
                  vencido
                    ? "text-red-600"
                    : venceLogo
                    ? "text-amber-600"
                    : "underline decoration-2"
                }`}
              >
                {fmt(lote.data_val)}
              </span>
            </Campo>
          </div>

          {(lote.insumo?.armazenamento || avisos.length > 0) && (
            <div className="space-y-2 border-t pt-3">
              {lote.insumo?.armazenamento && (
                <div className="flex items-start gap-2 text-sm">
                  <Thermometer className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="font-semibold">{lote.insumo.armazenamento}</span>
                </div>
              )}
              {avisos.map((a) => (
                <p key={a} className="text-sm font-bold text-amber-700">
                  ⚠ {a}
                </p>
              ))}
            </div>
          )}
        </section>

        {/* ---------- Origem ---------- */}
        {!acabado && (
          <section className="rounded-xl border bg-card p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-bold">
              <Truck className="h-4 w-4" />
              Origem
            </div>
            <p className="font-semibold uppercase leading-tight">
              {lote.fornecedor?.razao_social || "Não informado"}
            </p>
            {lote.fornecedor?.documento && (
              <p className="font-mono text-xs text-muted-foreground">
                CNPJ {formatarDoc(lote.fornecedor.documento)}
              </p>
            )}
            <div className="grid grid-cols-2 gap-3 border-t pt-2 text-xs">
              <Campo rotulo="NF de entrada">
                {lote.nota_entrada?.numero
                  ? `${lote.nota_entrada.numero}${
                      lote.nota_entrada.serie ? `/${lote.nota_entrada.serie}` : ""
                    }`
                  : "—"}
              </Campo>
              <Campo rotulo="Recebido em" className="text-right">
                {fmt(lote.recebido_em)}
              </Campo>
            </div>
          </section>
        )}

        {/* ---------- Responsável técnico (produto acabado) ---------- */}
        {acabado && lote.rt?.nome && (
          <section className="rounded-xl border bg-card p-4 space-y-1">
            <div className="flex items-center gap-2 text-sm font-bold">
              <Building2 className="h-4 w-4" />
              Responsável técnico
            </div>
            <p className="font-semibold">{lote.rt.nome}</p>
            <p className="text-xs text-muted-foreground">
              {[lote.rt.tipo_conselho, lote.rt.numero_registro, lote.rt.uf_conselho]
                .filter(Boolean)
                .join(" ")}
            </p>
          </section>
        )}

        {/* ---------- COA ---------- */}
        <section className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-bold">
              <FileCheck className="h-4 w-4" />
              COA / Laudo
            </div>
            {lote.coa?.possui ? (
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-bold text-emerald-800">
                {lote.coa.quantidade} documento
                {(lote.coa.quantidade ?? 0) === 1 ? "" : "s"}
              </span>
            ) : (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-800">
                Sem COA vinculado
              </span>
            )}
          </div>
        </section>

        {/* ---------- Bloco interno: só para o tenant dono ---------- */}
        {lote.tenant != null && (
          <section className="rounded-xl border-2 border-dashed bg-card p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold">
              <Lock className="h-4 w-4" />
              Informações internas
              <span className="ml-auto rounded bg-muted px-2 py-0.5 text-[10px] font-bold uppercase">
                visível só para a empresa
              </span>
            </div>

            {lote.tenant.nf_chave && (
              <Campo rotulo="Chave da NF-e">
                <span className="break-all font-mono text-xs">
                  {lote.tenant.nf_chave}
                </span>
              </Campo>
            )}

            {lote.tenant.custo_unitario_interno != null && (
              <Campo rotulo="Custo unitário interno">
                {Number(lote.tenant.custo_unitario_interno).toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
                {lote.unidade ? ` / ${lote.unidade}` : ""}
              </Campo>
            )}

            {lote.tenant.potencia?.valor != null && (
              <Campo rotulo="Potência / teor">
                {fmtNum(lote.tenant.potencia.valor)} {lote.tenant.potencia.unidade}
                {lote.tenant.potencia.validada_rt ? (
                  <span className="ml-2 text-xs font-bold text-emerald-700">
                    validada pelo RT
                  </span>
                ) : (
                  <span className="ml-2 text-xs font-bold text-amber-700">
                    não validada
                  </span>
                )}
              </Campo>
            )}

            {!!lote.tenant.documentos?.length && (
              <Campo rotulo="Documentos">
                <ul className="space-y-1 text-sm font-normal">
                  {lote.tenant.documentos.map((d, i) => (
                    <li key={i} className="flex justify-between gap-2">
                      <span className="truncate">
                        {d.tipo} — {d.nome || "sem nome"}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {d.status}
                      </span>
                    </li>
                  ))}
                </ul>
              </Campo>
            )}

            {lote.tenant.scans?.total != null && (
              <Campo rotulo="Scans do QR">
                {lote.tenant.scans.total} consulta
                {lote.tenant.scans.total === 1 ? "" : "s"}
              </Campo>
            )}
          </section>
        )}

        <p className="pb-6 text-center text-[11px] leading-relaxed text-muted-foreground">
          Consulta pública via QR · sem custo, saldo ou cliente
          <br />
          <strong>BrainX ERP</strong> · brainxerp.com
        </p>
      </div>
    </div>
  );
}
