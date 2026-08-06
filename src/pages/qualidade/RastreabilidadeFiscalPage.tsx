import { useCallback, useMemo, useRef, useState, type RefObject } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileSearch,
  Link2,
  Printer,
  Search,
  Shield,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/use-company";
import { RodapeBrainX } from "@/components/shared/RodapeBrainX";
import { QrLoteScannerButton } from "@/components/qualidade/QrLoteScanner";
import { registrarAuditoria } from "@/lib/audit-logger";
import { cn } from "@/lib/utils";
import type {
  ConsultaHistoricoItem,
  DossieFiscalizacao,
  DossieLacuna,
  DossieMateriaPrima,
  ModoRastreio,
  RastreabilidadeReversa,
} from "@/types/rastreabilidade-fiscal";

const HIST_KEY = "brainx_rastreabilidade_consultas";

function fmtData(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v.length === 10 ? `${v}T12:00:00` : v);
  if (Number.isNaN(d.getTime())) return v;
  return format(d, "dd/MM/yyyy", { locale: ptBR });
}

function fmtDataHora(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return format(d, "dd/MM/yyyy HH:mm", { locale: ptBR });
}

function fmtNum(v?: number | null, digits = 2) {
  if (v == null || !Number.isFinite(Number(v))) return "—";
  return Number(v).toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

function textoLacuna(l: DossieLacuna): string {
  if (typeof l === "string") return l;
  if (l?.texto) return String(l.texto);
  return JSON.stringify(l);
}

function semLote(lote?: string | null) {
  const s = String(lote || "").trim();
  return !s || /\*\*\*\s*SEM LOTE/i.test(s) || /^SEM LOTE/i.test(s);
}

function loadHistorico(): ConsultaHistoricoItem[] {
  try {
    const raw = sessionStorage.getItem(HIST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, 30) : [];
  } catch {
    return [];
  }
}

function pushHistorico(item: ConsultaHistoricoItem) {
  const prev = loadHistorico();
  const next = [item, ...prev].slice(0, 30);
  try {
    sessionStorage.setItem(HIST_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

async function detectarModos(lote: string): Promise<{ pa: boolean; insumo: boolean }> {
  const [paRes, mpRes] = await Promise.all([
    supabase
      .from("ordens_producao_industrial")
      .select("id")
      .eq("lote_produto_acabado", lote)
      .limit(1),
    supabase.from("estoque_lotes").select("id").eq("numero_lote", lote).limit(1),
  ]);
  return {
    pa: !paRes.error && (paRes.data?.length ?? 0) > 0,
    insumo: !mpRes.error && (mpRes.data?.length ?? 0) > 0,
  };
}

function MateriasPrimasTable({ rows }: { rows: DossieMateriaPrima[] }) {
  const sorted = useMemo(
    () =>
      [...rows].sort(
        (a, b) => Number(a.ordem_mistura ?? 0) - Number(b.ordem_mistura ?? 0),
      ),
    [rows],
  );

  const maxOrd = sorted.reduce((m, r) => Math.max(m, Number(r.ordem_mistura ?? 0)), 0);
  const lubIdx = sorted.findIndex((r) => /LUBRIFICANTE/i.test(String(r.papel || "")));
  const lubOrd = lubIdx >= 0 ? Number(sorted[lubIdx].ordem_mistura ?? 0) : null;
  const algoAposLub =
    lubOrd != null && sorted.some((r) => Number(r.ordem_mistura ?? 0) > lubOrd);

  return (
    <div className="space-y-2">
      {algoAposLub && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Desvio de BPF — ordem de mistura</AlertTitle>
          <AlertDescription>
            Há insumo com <code>ordem_mistura</code> maior que o lubrificante (estearato).
            O lubrificante deve ser o último (ordem {lubOrd}; máximo na fórmula {maxOrd}).
          </AlertDescription>
        </Alert>
      )}
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14">Ord</TableHead>
              <TableHead>Insumo</TableHead>
              <TableHead>Papel</TableHead>
              <TableHead>Lote</TableHead>
              <TableHead className="text-right">Teórico</TableHead>
              <TableHead className="text-right">Real</TableHead>
              <TableHead>Faixa</TableHead>
              <TableHead className="text-center">Tol.</TableHead>
              <TableHead className="text-center">CoA</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((r, i) => {
              const badLote = semLote(r.lote);
              const badTol = r.dentro_tolerancia === false;
              const badCoa = r.coa_anexado === false;
              return (
                <TableRow
                  key={`${r.ordem_mistura}-${r.insumo}-${i}`}
                  className={cn(
                    (badLote || badTol) && "bg-red-50 dark:bg-red-950/30",
                  )}
                >
                  <TableCell className="font-mono text-xs">{r.ordem_mistura ?? "—"}</TableCell>
                  <TableCell>
                    <div className="font-medium text-sm">{r.insumo || "—"}</div>
                    {r.fornecedor && (
                      <div className="text-[11px] text-muted-foreground">{r.fornecedor}</div>
                    )}
                    {badTol && r.justificativa && (
                      <div className="text-xs text-red-700 mt-1">
                        Justificativa: {r.justificativa}
                      </div>
                    )}
                    {!badTol && r.justificativa && (
                      <div className="text-xs text-amber-700 mt-1">{r.justificativa}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">{r.papel || "—"}</TableCell>
                  <TableCell
                    className={cn(
                      "font-mono text-xs",
                      badLote && "text-red-700 font-semibold",
                    )}
                  >
                    {badLote ? "*** SEM LOTE *** ⚠" : r.lote}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {fmtNum(r.teorico_g)} g
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {r.real_g == null ? "—" : `${fmtNum(r.real_g)} g`}
                  </TableCell>
                  <TableCell className="text-xs">{r.faixa_g || (r.tolerancia_pct != null ? `±${r.tolerancia_pct}%` : "—")}</TableCell>
                  <TableCell className="text-center">
                    {r.dentro_tolerancia === true && (
                      <span className="text-emerald-700">✓</span>
                    )}
                    {r.dentro_tolerancia === false && (
                      <span className="text-red-700 font-bold">⚠</span>
                    )}
                    {r.dentro_tolerancia == null && (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {r.coa_anexado === true && <span className="text-emerald-700">✓</span>}
                    {badCoa && <span className="text-red-700 font-bold">✗</span>}
                    {r.coa_anexado == null && <span className="text-muted-foreground">—</span>}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function DossieView({
  data,
  company,
  printRef,
}: {
  data: DossieFiscalizacao;
  company: {
    razao_social?: string | null;
    cnpj?: string | null;
    afe_anvisa?: string | null;
    licenca_sanitaria?: string | null;
  } | null;
  printRef: RefObject<HTMLDivElement | null>;
}) {
  const lacunas = data.lacunas || [];
  const apto = !!data.apto_para_fiscalizacao;
  const mps = data.materias_primas || [];

  return (
    <div ref={printRef} className="space-y-4 dossie-print-root">
      <div className="print-only hidden print:block mb-4 border-b pb-3">
        <div className="font-semibold text-base">{company?.razao_social || "—"}</div>
        <div className="text-xs text-muted-foreground">
          CNPJ {company?.cnpj || "—"} · AFE {company?.afe_anvisa || "pendente no cadastro"} ·
          Licença sanitária {company?.licenca_sanitaria || "pendente no cadastro"}
        </div>
        <div className="text-xs mt-1">
          Dossiê de fiscalização · gerado em {fmtDataHora(data.gerado_em)}
        </div>
      </div>

      <Alert
        variant={apto ? "default" : "destructive"}
        className={cn(apto && "border-emerald-300 bg-emerald-50/60")}
      >
        {apto ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-700" />
        ) : (
          <AlertTriangle className="h-5 w-5" />
        )}
        <AlertTitle className="text-base">
          {apto
            ? "APTO PARA FISCALIZAÇÃO"
            : `${lacunas.length} PENDÊNCIA${lacunas.length === 1 ? "" : "S"}`}
        </AlertTitle>
        <AlertDescription>
          Lote {data.produto?.lote || data.lote || "—"}
          {data.produto?.nome ? ` · ${data.produto.nome}` : ""}
        </AlertDescription>
      </Alert>

      {lacunas.length > 0 && (
        <Card className="border-amber-300 bg-amber-50/40">
          <CardHeader className="py-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-700" />
              Lacunas (listar antes do fiscal perguntar)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              {lacunas.map((l, i) => (
                <li key={i}>{textoLacuna(l)}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base">Produto</CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-2 text-sm">
          <div><span className="text-muted-foreground">Nome:</span> {data.produto?.nome || "—"}</div>
          <div><span className="text-muted-foreground">Lote:</span> {data.produto?.lote || "—"}</div>
          <div><span className="text-muted-foreground">Fabricação:</span> {fmtData(data.produto?.fabricacao)}</div>
          <div><span className="text-muted-foreground">Validade:</span> {fmtData(data.produto?.validade)}</div>
          <div><span className="text-muted-foreground">Marca:</span> {data.produto?.marca || "—"}</div>
          <div><span className="text-muted-foreground">Destino:</span> {data.produto?.destino || "—"}</div>
          <div><span className="text-muted-foreground">Cliente:</span> {data.produto?.cliente || "—"}</div>
          <div><span className="text-muted-foreground">Fórmula:</span> {data.produto?.formula || "—"}</div>
          <div><span className="text-muted-foreground">Apresentação:</span> {data.produto?.apresentacao || "—"}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base">Produção</CardTitle>
          <CardDescription>{data.producao?.op || "—"} · {data.producao?.status || "—"}</CardDescription>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-3 gap-2 text-sm">
          <div>Potes pedido: <b>{fmtNum(data.producao?.potes_pedido, 0)}</b></div>
          <div>Previstos: <b>{fmtNum(data.producao?.potes_previstos, 0)}</b></div>
          <div>Produzidos: <b>{fmtNum(data.producao?.potes_produzidos, 0)}</b></div>
          <div>Margem: <b>{fmtNum(data.producao?.margem_pct)}%</b></div>
          <div>Excedente: <b>{fmtNum(data.producao?.excedentes, 0)}</b></div>
          <div>Rendimento: <b>{fmtNum(data.producao?.rendimento_pct)}%</b></div>
          <div className="sm:col-span-3">
            Destino excedente: {data.producao?.destino_excedente || "—"}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base">Matérias-primas (ordem de mistura)</CardTitle>
          <CardDescription>
            Ordem real de adição — conferir contra o POP. Estearato/lubrificante por último.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {mps.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma MP retornada.</p>
          ) : (
            <MateriasPrimasTable rows={mps} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base">Responsabilidade técnica</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {!data.responsabilidade_tecnica?.length ? (
            <p className="text-amber-800">Sem assinatura do responsável técnico registrada.</p>
          ) : (
            <ul className="space-y-2">
              {data.responsabilidade_tecnica.map((rt, i) => (
                <li key={i} className="rounded border p-2">
                  <div><b>{String(rt.rt || rt.nome || "RT")}</b> {rt.conselho ? `· ${rt.conselho}` : ""}</div>
                  <div className="text-xs text-muted-foreground">
                    {fmtDataHora(String(rt.data || ""))}
                    {rt.hash_op ? ` · hash OP ${rt.hash_op}` : ""}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base">Controle de qualidade</CardTitle>
        </CardHeader>
        <CardContent className="text-sm grid sm:grid-cols-2 gap-2">
          {!data.controle_qualidade ? (
            <p className="text-amber-800 sm:col-span-2">Sem controle de qualidade do pó registrado.</p>
          ) : (
            <>
              <div>Aparência: {String(data.controle_qualidade.aparencia ?? "—")}</div>
              <div>Fluidez: {String(data.controle_qualidade.fluidez ?? "—")}</div>
              <div>Peso médio: {fmtNum(data.controle_qualidade.peso_medio as number | null)}</div>
              <div>Desvio: {fmtNum(data.controle_qualidade.desvio as number | null)}</div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base">ANVISA</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          <div>Status: {data.anvisa?.status || "—"}</div>
          <div>Resumo: {data.anvisa?.resumo || "—"}</div>
          <div className="text-xs text-muted-foreground">
            Carimbado em: {fmtDataHora(data.anvisa?.carimbado_em)}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base">Checklist BPF</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          Verificados {fmtNum(data.checklist_bpf?.verificados, 0)} / {fmtNum(data.checklist_bpf?.total, 0)}
          {" · "}
          Obrigatórios pendentes:{" "}
          <b className={Number(data.checklist_bpf?.obrigatorios_pendentes || 0) > 0 ? "text-red-700" : ""}>
            {fmtNum(data.checklist_bpf?.obrigatorios_pendentes, 0)}
          </b>
        </CardContent>
      </Card>

      {(data.marco_legal?.length ?? 0) > 0 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base">Marco legal</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 text-sm space-y-1">
              {data.marco_legal!.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="pt-4 border-t text-xs text-muted-foreground space-y-1">
        <div>Gerado em {fmtDataHora(data.gerado_em)}</div>
        <RodapeBrainX />
      </div>
    </div>
  );
}

function RecallView({
  data,
  onAbrirDossie,
}: {
  data: RastreabilidadeReversa;
  onAbrirDossie: (lotePa: string) => void;
}) {
  return (
    <div className="space-y-4">
      <Alert className="border-amber-300 bg-amber-50/50">
        <Shield className="h-5 w-5 text-amber-700" />
        <AlertTitle>
          ALCANCE DO RECALL: {data.alcance_do_recall ?? 0} destino
          {Number(data.alcance_do_recall) === 1 ? "" : "s"}
        </AlertTitle>
        <AlertDescription>{data.conclusao || "—"}</AlertDescription>
      </Alert>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base">Lote(s) de insumo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(data.lotes || []).map((l) => (
            <div key={l.lote_id || l.numero_lote || ""} className="rounded border p-3 text-sm grid sm:grid-cols-2 gap-1">
              <div><span className="text-muted-foreground">Insumo:</span> {l.insumo || "—"}</div>
              <div><span className="text-muted-foreground">Lote:</span> <b className="font-mono">{l.numero_lote}</b></div>
              <div><span className="text-muted-foreground">Fornecedor:</span> {l.fornecedor || "—"}</div>
              <div><span className="text-muted-foreground">Marca:</span> {l.marca_fornecedor || l.marca_origem || "—"}</div>
              <div><span className="text-muted-foreground">Status:</span> {l.status || "—"}</div>
              <div><span className="text-muted-foreground">Saldo:</span> {fmtNum(l.saldo)} {l.unidade || ""}</div>
              <div><span className="text-muted-foreground">Validade:</span> {fmtData(l.validade)}</div>
            </div>
          ))}
          {!data.lotes?.length && (
            <p className="text-sm text-muted-foreground">Nenhum registro de estoque.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base">Ordens de produção que usaram o lote</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>OP</TableHead>
                <TableHead>Lote PA</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Fab.</TableHead>
                <TableHead>Val.</TableHead>
                <TableHead>Destino / cliente</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data.ordens_de_producao || []).map((op, i) => (
                <TableRow key={`${op.op}-${i}`}>
                  <TableCell className="font-mono text-xs">{op.op || "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{op.lote_produto_acabado || "—"}</TableCell>
                  <TableCell className="text-sm">{op.produto || "—"}</TableCell>
                  <TableCell className="text-xs">{fmtData(op.fabricacao)}</TableCell>
                  <TableCell className="text-xs">{fmtData(op.validade)}</TableCell>
                  <TableCell className="text-xs">
                    {op.destino || "—"}
                    {op.cliente ? ` · ${op.cliente}` : ""}
                    {op.marca ? ` · ${op.marca}` : ""}
                  </TableCell>
                  <TableCell>
                    {op.lote_produto_acabado && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onAbrirDossie(op.lote_produto_acabado!)}
                      >
                        <Link2 className="h-3.5 w-3.5 mr-1" /> Dossiê
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {!data.ordens_de_producao?.length && (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground text-sm">
                    Nenhuma OP vinculada.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base">Notas de saída (venda direta do insumo)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nota</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Destinatário</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead className="text-right">Qtd</TableHead>
                <TableHead>Chave</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data.notas_de_saida || []).map((n, i) => (
                <TableRow key={`${n.nota}-${i}`}>
                  <TableCell className="font-medium">{n.nota || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{n.status || "—"}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{n.destinatario || "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{n.documento || "—"}</TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {fmtNum(n.quantidade)} {n.unidade || ""}
                  </TableCell>
                  <TableCell className="font-mono text-[10px] max-w-[220px] break-all">
                    {String(n.status || "").toUpperCase() === "AUTORIZADO"
                      ? n.chave || "—"
                      : n.chave
                        ? `${String(n.chave).slice(0, 10)}…`
                        : "—"}
                  </TableCell>
                </TableRow>
              ))}
              {!data.notas_de_saida?.length && (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground text-sm">
                    Nenhuma NF-e de saída deste lote.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="text-xs text-muted-foreground">
        Gerado em {fmtDataHora(data.gerado_em)} · <RodapeBrainX />
      </div>
    </div>
  );
}

export default function RastreabilidadeFiscalPage() {
  const { data: company } = useCompany();
  const printRef = useRef<HTMLDivElement>(null);
  const [loteInput, setLoteInput] = useState("");
  const [modoPref, setModoPref] = useState<ModoRastreio | "auto">("auto");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [disponiveis, setDisponiveis] = useState<{ pa: boolean; insumo: boolean }>({
    pa: false,
    insumo: false,
  });
  const [aba, setAba] = useState<"pa" | "insumo">("pa");
  const [dossie, setDossie] = useState<DossieFiscalizacao | null>(null);
  const [recall, setRecall] = useState<RastreabilidadeReversa | null>(null);
  const [historico, setHistorico] = useState<ConsultaHistoricoItem[]>(() => loadHistorico());
  const [loteConsultado, setLoteConsultado] = useState<string>("");

  const buscar = useCallback(
    async (loteRaw?: string, forcarModo?: ModoRastreio) => {
      const lote = String(loteRaw ?? loteInput).trim();
      if (!lote) {
        setErro("Informe o número do lote.");
        return;
      }
      setLoading(true);
      setErro(null);
      setDossie(null);
      setRecall(null);
      setLoteConsultado(lote);

      try {
        const det = await detectarModos(lote);
        setDisponiveis(det);

        const modo: ModoRastreio | "ambos" | "nenhum" = (() => {
          if (forcarModo === "pa") return det.pa ? "pa" : "nenhum";
          if (forcarModo === "insumo") return det.insumo ? "insumo" : "nenhum";
          if (modoPref === "pa") return det.pa ? "pa" : det.insumo ? "insumo" : "nenhum";
          if (modoPref === "insumo") return det.insumo ? "insumo" : det.pa ? "pa" : "nenhum";
          if (det.pa && det.insumo) return "ambos";
          if (det.pa) return "pa";
          if (det.insumo) return "insumo";
          return "nenhum";
        })();

        if (modo === "nenhum") {
          const msg =
            modoPref === "pa" || forcarModo === "pa"
              ? `Nenhuma ordem de produção para o lote ${lote}. Se for insumo (recall), troque o modo.`
              : modoPref === "insumo" || forcarModo === "insumo"
                ? `Nenhum lote de estoque ${lote}. Se for produto acabado, troque o modo.`
                : `Lote ${lote} não encontrado como produto acabado nem como insumo.`;
          setErro(msg);
          const hist = pushHistorico({
            em: new Date().toISOString(),
            lote,
            modo: "ambos",
            encontrado: false,
          });
          setHistorico(hist);
          void registrarAuditoria({
            tipo: "ACAO_UI",
            descricao: `Consulta rastreabilidade sem resultado: ${lote}`,
            entidade_tipo: "LOTE",
            entidade_id: lote,
            entidade_codigo: lote,
            dados_evento: { encontrado: false, modo_pref: modoPref },
          });
          return;
        }

        let dossieData: DossieFiscalizacao | null = null;
        let recallData: RastreabilidadeReversa | null = null;

        if (modo === "pa" || modo === "ambos") {
          const { data, error } = await supabase.rpc("dossie_fiscalizacao", {
            p_lote_pa: lote,
          });
          if (error) throw error;
          dossieData = data as DossieFiscalizacao;
          setDossie(dossieData);
        }
        if (modo === "insumo" || modo === "ambos") {
          const { data, error } = await supabase.rpc("rastreabilidade_reversa", {
            p_lote_insumo: lote,
          });
          if (error) throw error;
          recallData = data as RastreabilidadeReversa;
          setRecall(recallData);
        }

        if (modo === "ambos") setAba("pa");
        else setAba(modo);

        const encontrado =
          !!(dossieData?.encontrado || recallData?.encontrado) ||
          modo === "pa" ||
          modo === "insumo" ||
          modo === "ambos";

        if (dossieData && dossieData.encontrado === false) {
          setErro(dossieData.mensagem || `Nenhuma ordem de produção para o lote ${lote}`);
        }
        if (recallData && recallData.encontrado === false && !dossieData?.encontrado) {
          setErro(recallData.mensagem || `Nenhum destino para o lote ${lote}`);
        }

        const hist = pushHistorico({
          em: new Date().toISOString(),
          lote,
          modo: modo === "ambos" ? "ambos" : modo,
          encontrado: !!(dossieData?.encontrado || recallData?.encontrado || encontrado),
        });
        setHistorico(hist);

        void registrarAuditoria({
          tipo: "ACAO_UI",
          descricao: `Consulta rastreabilidade ${modo}: ${lote}`,
          entidade_tipo: "LOTE",
          entidade_id: lote,
          entidade_codigo: lote,
          dados_evento: {
            modo,
            apto: dossieData?.apto_para_fiscalizacao ?? null,
            alcance: recallData?.alcance_do_recall ?? null,
          },
        });
      } catch (e: any) {
        setErro(e?.message || "Falha na consulta");
      } finally {
        setLoading(false);
      }
    },
    [loteInput, modoPref],
  );

  const imprimir = () => {
    if (!printRef.current) return;
    window.print();
  };

  const mostrarAbas = disponiveis.pa && disponiveis.insumo && dossie && recall;

  return (
    <div>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .dossie-print-root, .dossie-print-root * { visibility: visible !important; }
          .dossie-print-root { position: absolute; left: 0; top: 0; width: 100%; padding: 12mm; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
        }
      `}</style>

      <div className="no-print">
        <PageHeader
          title="Rastreabilidade e dossiê"
          description="Dossiê de fiscalização (PA) e recall reverso (insumo) — RDC 275 / RDC 843"
          icon={FileSearch}
        />
      </div>

      <Card className="mb-4 no-print">
        <CardContent className="pt-4 space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8 font-mono"
                placeholder="Lote (ex.: 260727-871 ou H24081301)"
                value={loteInput}
                onChange={(e) => setLoteInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void buscar();
                }}
              />
            </div>
            <QrLoteScannerButton
              onRead={(lote) => {
                setLoteInput(lote);
                void buscar(lote);
              }}
            />
            <Button onClick={() => void buscar()} disabled={loading}>
              {loading ? "Buscando…" : "Buscar"}
            </Button>
            {dossie?.encontrado && (
              <Button variant="outline" onClick={imprimir}>
                <Printer className="h-4 w-4 mr-2" /> Imprimir dossiê
              </Button>
            )}
          </div>

          <RadioGroup
            value={modoPref}
            onValueChange={(v) => setModoPref(v as ModoRastreio | "auto")}
            className="flex flex-wrap gap-4"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="auto" id="modo-auto" />
              <Label htmlFor="modo-auto">Detectar automaticamente</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="pa" id="modo-pa" />
              <Label htmlFor="modo-pa">Produto acabado (dossiê)</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="insumo" id="modo-insumo" />
              <Label htmlFor="modo-insumo">Insumo (recall)</Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {erro && (
        <Alert className="mb-4 no-print" variant="default">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Sem resultado</AlertTitle>
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}

      {mostrarAbas && (
        <Tabs
          value={aba}
          onValueChange={(v) => setAba(v as "pa" | "insumo")}
          className="mb-4 no-print"
        >
          <TabsList>
            <TabsTrigger value="pa">Dossiê (PA)</TabsTrigger>
            <TabsTrigger value="insumo">Recall (insumo)</TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {dossie?.encontrado && (!mostrarAbas || aba === "pa") && (
        <DossieView data={dossie} company={company} printRef={printRef} />
      )}

      {recall?.encontrado && (!mostrarAbas || aba === "insumo") && (
        <div className={cn(mostrarAbas && aba !== "insumo" && "hidden", "no-print")}>
          <RecallView
            data={recall}
            onAbrirDossie={(lotePa) => {
              setLoteInput(lotePa);
              setModoPref("pa");
              void buscar(lotePa, "pa");
            }}
          />
        </div>
      )}

      {historico.length > 0 && (
        <Card className="mt-6 no-print">
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Histórico desta sessão</CardTitle>
            <CardDescription>
              Também registrado na trilha de auditoria (ACAO_UI). Em inspeção, demonstra
              que a empresa consulta os próprios lotes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="text-xs space-y-1">
              {historico.slice(0, 10).map((h, i) => (
                <li key={`${h.em}-${i}`} className="flex flex-wrap gap-2">
                  <span className="text-muted-foreground">{fmtDataHora(h.em)}</span>
                  <button
                    type="button"
                    className="font-mono underline-offset-2 hover:underline"
                    onClick={() => {
                      setLoteInput(h.lote);
                      void buscar(h.lote);
                    }}
                  >
                    {h.lote}
                  </button>
                  <Badge variant="secondary">{h.modo}</Badge>
                  <span>{h.encontrado ? "ok" : "não encontrado"}</span>
                </li>
              ))}
            </ul>
            {loteConsultado && (
              <>
                <Separator className="my-2" />
                <p className="text-[11px] text-muted-foreground">
                  Última consulta: {loteConsultado}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
