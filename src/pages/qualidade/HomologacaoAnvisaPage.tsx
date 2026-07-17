/**
 * Homologação ANVISA — fila de insumos sem vínculo (Qualidade).
 * Rota: /qualidade/homologacao-anvisa
 */

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Check,
  ExternalLink,
  FlaskConical,
  Loader2,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useItensSemVinculoAnvisa,
  useSugerirConstituintesEngine,
  useConfirmarVinculoAnvisa,
  buscarConstituinteAnvisa,
  type ItemSemVinculoFila,
  type SugestaoEngine,
} from "@/hooks/useHomologacaoAnvisa";

function StatusVinculoBadge({ status }: { status: string }) {
  const s = (status || "SEM_VINCULO").toUpperCase();
  if (s === "CONFIRMADO") {
    return <StatusBadge variant="success">Confirmado</StatusBadge>;
  }
  if (s === "PENDENTE") {
    return (
      <StatusBadge variant="warning">Sugerido, aguardando RT</StatusBadge>
    );
  }
  return <StatusBadge variant="muted">Sem vínculo</StatusBadge>;
}

function BadgeConfianca({ confianca }: { confianca: string }) {
  const c = (confianca || "").toLowerCase();
  if (c === "alta") {
    return (
      <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white">
        alta
      </Badge>
    );
  }
  if (c === "media") {
    return <Badge variant="secondary">média</Badge>;
  }
  return <Badge variant="outline">{confianca || "—"}</Badge>;
}

function parsePct(raw: string): number | null {
  const t = raw.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function LinhaInsumo({ item }: { item: ItemSemVinculoFila }) {
  const { data: sugestoes, isLoading } = useSugerirConstituintesEngine(item.item_id);
  const confirmar = useConfirmarVinculoAnvisa();

  const [constituinteId, setConstituinteId] = useState<string>("");
  const [constituinteNome, setConstituinteNome] = useState<string>("");
  const [buscaTermo, setBuscaTermo] = useState("");
  const [buscaResultados, setBuscaResultados] = useState<
    Array<{ id: string; nome_tecnico: string }>
  >([]);
  const [buscando, setBuscando] = useState(false);
  const [teorNominal, setTeorNominal] = useState("");
  const [teorMin, setTeorMin] = useState("");
  const [teorMax, setTeorMax] = useState("");
  const [observacao, setObservacao] = useState("");

  const top = sugestoes?.[0];
  const selecionadoId = constituinteId || top?.constituinte_id || "";
  const selecionadoNome =
    constituinteNome ||
    sugestoes?.find((s) => s.constituinte_id === selecionadoId)?.nome_tecnico ||
    top?.nome_tecnico ||
    "";

  function escolherSugestao(s: SugestaoEngine) {
    setConstituinteId(s.constituinte_id);
    setConstituinteNome(s.nome_tecnico);
  }

  async function buscarManual() {
    setBuscando(true);
    try {
      const rows = await buscarConstituinteAnvisa(buscaTermo);
      setBuscaResultados(rows);
      if (!rows.length) toast.message("Nenhum constituinte encontrado");
    } catch (e: unknown) {
      const err = e as { message?: string };
      toast.error(err.message ?? "Falha na busca");
    } finally {
      setBuscando(false);
    }
  }

  async function onConfirmar() {
    if (!selecionadoId) {
      toast.error("Selecione um constituinte antes de confirmar");
      return;
    }
    if (!item.company_id) {
      toast.error("company_id ausente neste item");
      return;
    }
    try {
      await confirmar.mutateAsync({
        itemId: item.item_id,
        companyId: item.company_id,
        constituinteId: selecionadoId,
        teorNominalPct: parsePct(teorNominal),
        teorMinPct: parsePct(teorMin),
        teorMaxPct: parsePct(teorMax),
        observacao: observacao.trim() || null,
      });
      toast.success(`${item.descricao_interna} → ${selecionadoNome} confirmado`);
    } catch (e: unknown) {
      const err = e as { message?: string };
      toast.error(err.message ?? "Não foi possível confirmar o vínculo");
    }
  }

  return (
    <TableRow className="align-top">
      <TableCell className="min-w-[200px]">
        <div className="space-y-1">
          <p className="font-medium text-sm leading-snug">{item.descricao_interna}</p>
          <p className="text-xs text-muted-foreground">
            {item.tipo_item ?? "—"}
            {item.unidade_interna ? ` · ${item.unidade_interna}` : ""}
          </p>
        </div>
      </TableCell>
      <TableCell className="text-center tabular-nums">{item.usos_em_formulas}</TableCell>
      <TableCell>
        <StatusVinculoBadge status={item.status_vinculo} />
      </TableCell>
      <TableCell className="min-w-[280px]">
        {isLoading ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Calculando sugestão…
          </p>
        ) : !sugestoes?.length ? (
          <p className="text-sm text-muted-foreground">
            Sem sugestão automática — use a busca abaixo.
          </p>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
              Engine <code className="text-[10px]">sugerir_constituintes</code>
            </div>
            <Select
              value={selecionadoId}
              onValueChange={(id) => {
                const s = sugestoes.find((x) => x.constituinte_id === id);
                if (s) escolherSugestao(s);
              }}
            >
              <SelectTrigger className="h-auto min-h-9 py-2 text-left">
                <SelectValue placeholder="Escolher constituinte" />
              </SelectTrigger>
              <SelectContent>
                {sugestoes.map((s) => (
                  <SelectItem key={s.constituinte_id} value={s.constituinte_id}>
                    {s.nome_tecnico} (score {s.score.toFixed(2)}, {s.confianca})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {top && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <BadgeConfianca confianca={top.confianca} />
                <span className="font-mono text-muted-foreground">
                  score {Number(top.score).toFixed(2)}
                </span>
                {top.ancora && (
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {top.ancora}
                  </Badge>
                )}
              </div>
            )}
          </div>
        )}

        <div className="mt-3 space-y-2 rounded-md border p-2">
          <p className="text-xs font-medium flex items-center gap-1">
            <Search className="h-3 w-3" />
            Corrigir constituinte (busca ANVISA)
          </p>
          <div className="flex gap-2">
            <Input
              placeholder="Ex.: colecalciferol, creatina…"
              value={buscaTermo}
              onChange={(e) => setBuscaTermo(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && buscarManual()}
              className="h-8 text-sm"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={buscando || buscaTermo.trim().length < 2}
              onClick={buscarManual}
            >
              {buscando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Buscar"}
            </Button>
          </div>
          {buscaResultados.length > 0 && (
            <ul className="space-y-1 max-h-28 overflow-auto">
              {buscaResultados.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate">{r.nome_tecnico}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 shrink-0"
                    onClick={() => {
                      setConstituinteId(r.id);
                      setConstituinteNome(r.nome_tecnico);
                      toast.message(`Selecionado: ${r.nome_tecnico}`);
                    }}
                  >
                    Usar
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {constituinteId && constituinteNome && (
            <p className="text-xs text-emerald-700 dark:text-emerald-400">
              Selecionado: <strong>{constituinteNome}</strong>
            </p>
          )}
        </div>
      </TableCell>
      <TableCell className="min-w-[160px]">
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-1">
            <div>
              <Label className="text-[10px] text-muted-foreground">Mín %</Label>
              <Input
                className="h-7 text-xs"
                value={teorMin}
                onChange={(e) => setTeorMin(e.target.value)}
                placeholder="—"
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Nom %</Label>
              <Input
                className="h-7 text-xs"
                value={teorNominal}
                onChange={(e) => setTeorNominal(e.target.value)}
                placeholder="—"
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Máx %</Label>
              <Input
                className="h-7 text-xs"
                value={teorMax}
                onChange={(e) => setTeorMax(e.target.value)}
                placeholder="—"
              />
            </div>
          </div>
          <Textarea
            className="min-h-[56px] text-xs"
            placeholder="Observação (opcional)"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
          />
          <Button
            size="sm"
            className="w-full gap-1"
            disabled={confirmar.isPending || !selecionadoId}
            onClick={onConfirmar}
          >
            {confirmar.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            Confirmar
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

export default function HomologacaoAnvisaPage() {
  const { data: itens, isLoading, error } = useItensSemVinculoAnvisa();
  const [filtro, setFiltro] = useState("");

  const filtrados = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    if (!q) return itens ?? [];
    return (itens ?? []).filter(
      (i) =>
        i.descricao_interna.toLowerCase().includes(q) ||
        (i.tipo_item ?? "").toLowerCase().includes(q) ||
        (i.status_vinculo ?? "").toLowerCase().includes(q),
    );
  }, [itens, filtro]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Homologação ANVISA"
        description="Fila de insumos que precisam de vínculo com constituinte IN 28/2018 — o engine sugere; a RT confirma ou corrige."
        icon={ShieldCheck}
      />

      <Alert>
        <FlaskConical className="h-4 w-4" />
        <AlertDescription className="text-sm">
          Fonte da fila: view <code>anvisa_itens_sem_vinculo</code>. Sugestões via{" "}
          <code>sugerir_constituintes</code>. Confirmação via{" "}
          <code>rt_confirmar_vinculo</code> com autoria da RT logada. Para conferência
          de teores de COA já vinculados, use{" "}
          <Link
            to="/regulatorio/homologacao-rt"
            className="underline inline-flex items-center gap-1"
          >
            Conferência do RT
            <ExternalLink className="h-3 w-3" />
          </Link>
          .
        </AlertDescription>
      </Alert>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-md flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-10"
            placeholder="Filtrar por descrição, tipo ou status…"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <StatusBadge variant="muted">Sem vínculo</StatusBadge>
          <StatusBadge variant="warning">Sugerido, aguardando RT</StatusBadge>
          <StatusBadge variant="success">Confirmado</StatusBadge>
        </div>
        <Badge variant="outline" className="tabular-nums">
          {filtrados.length} na fila
        </Badge>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            {(error as Error).message || "Erro ao carregar a fila"}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Insumo</TableHead>
                <TableHead className="text-center w-20">Usos</TableHead>
                <TableHead className="w-40">Status</TableHead>
                <TableHead>Sugestão do engine</TableHead>
                <TableHead className="w-48">Ação RT</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin inline mr-2" />
                    Carregando fila…
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && filtrados.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                    Nenhum insumo pendente de vínculo.
                  </TableCell>
                </TableRow>
              )}
              {filtrados.map((item) => (
                <LinhaInsumo key={item.item_id} item={item} />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
