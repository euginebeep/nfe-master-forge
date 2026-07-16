// src/pages/regulatorio/HomologacaoRTPage.tsx
//
// Central de conferência do Responsável Técnico.
// A RT vê cada vínculo insumo → constituinte ANVISA proposto pelo sistema,
// com o teor extraído do COA, e confirma ou contesta item a item.
//
// Match por âncora: o sistema SUGERE; a RT confirma com 1 clique.
// Nunca confirma sozinho. Em dúvida → lista ranqueada ou busca manual.

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  FlaskConical,
  Sparkles,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import {
  useVinculosPendentes,
  useDecidirVinculo,
  useItensSemVinculoConfirmado,
  useConfirmarSugestaoVinculo,
  buscarConstituintesManual,
  type VinculoPendente,
} from "@/hooks/useHomologacaoRT";
import {
  useSugerirConstituintes,
  confiancaDaLista,
  type SugestaoConstituinte,
} from "@/hooks/useSugerirConstituintes";

function nivelDeAtencao(v: VinculoPendente): "ok" | "atencao" | "critico" {
  const obs = (v.observacao ?? "").toUpperCase();
  if (obs.includes("ESTOUROU") || obs.includes("VENCIDO")) return "critico";
  if (obs.includes("ATENCAO") || obs.includes("AMARELO")) return "atencao";
  return "ok";
}

function BadgeConfianca({ confianca }: { confianca: string }) {
  if (confianca === "alta") {
    return (
      <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white">
        Sugestão alta
      </Badge>
    );
  }
  if (confianca === "media") {
    return <Badge variant="secondary">Várias opções</Badge>;
  }
  return <Badge variant="outline">Não identificado</Badge>;
}

function ListaSugestoes({
  sugestoes,
  carregando,
  destaqueId,
  onEscolher,
  disabled,
}: {
  sugestoes: SugestaoConstituinte[] | undefined;
  carregando?: boolean;
  destaqueId?: string | null;
  onEscolher: (s: SugestaoConstituinte) => void;
  disabled?: boolean;
}) {
  const conf = confiancaDaLista(sugestoes);

  if (carregando) {
    return <p className="text-sm text-muted-foreground">Calculando sugestão por âncora…</p>;
  }

  if (!sugestoes?.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Não identificado automaticamente — use a busca manual. O sistema não sugere
        âncora errada.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm">
        <Sparkles className="h-4 w-4 text-emerald-600" />
        <span className="font-medium">Sugestão por elemento âncora</span>
        <BadgeConfianca confianca={conf} />
        {sugestoes[0]?.ancora && (
          <Badge variant="outline" className="font-mono text-xs">
            {sugestoes[0].ancora}
          </Badge>
        )}
      </div>
      <ul className="space-y-2">
        {sugestoes.map((s, idx) => {
          const top = idx === 0 && conf === "alta";
          const mesmoDoVinculo = destaqueId && s.constituinte_id === destaqueId;
          return (
            <li
              key={s.constituinte_id}
              className={
                top
                  ? "rounded-md border border-emerald-500/50 bg-emerald-50 dark:bg-emerald-950/30 p-3 flex flex-wrap items-center justify-between gap-2"
                  : "rounded-md border p-3 flex flex-wrap items-center justify-between gap-2"
              }
            >
              <div className="text-sm">
                <p className="font-medium">
                  {s.nome_tecnico}
                  {mesmoDoVinculo && (
                    <span className="ml-2 text-xs text-muted-foreground">(já proposto)</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground font-mono">
                  score {s.score.toFixed(2)}
                </p>
              </div>
              <Button
                size="sm"
                variant={top ? "default" : "outline"}
                disabled={disabled}
                onClick={() => onEscolher(s)}
              >
                {top ? "Confirmar" : "Escolher esta"}
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function BuscaManual({
  onEscolher,
  disabled,
}: {
  onEscolher: (id: string, nome: string) => void;
  disabled?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState<
    Array<{ id: string; nome_tecnico: string; limite_max_num: number | null; limite_unidade: string | null }>
  >([]);
  const [buscando, setBuscando] = useState(false);

  async function buscar() {
    setBuscando(true);
    try {
      const rows = await buscarConstituintesManual(termo);
      setResultados(rows);
      if (!rows.length) toast.message("Nenhum constituinte encontrado");
    } catch (e: unknown) {
      const err = e as { message?: string };
      toast.error(err.message ?? "Falha na busca");
    } finally {
      setBuscando(false);
    }
  }

  if (!aberto) {
    return (
      <Button variant="ghost" size="sm" className="gap-1" onClick={() => setAberto(true)}>
        <Search className="h-3.5 w-3.5" />
        Nenhuma destas / buscar manual
      </Button>
    );
  }

  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex gap-2">
        <Input
          placeholder="Buscar constituinte ANVISA…"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && buscar()}
        />
        <Button variant="outline" onClick={buscar} disabled={buscando || termo.trim().length < 2}>
          Buscar
        </Button>
      </div>
      <ul className="space-y-1 max-h-48 overflow-auto">
        {resultados.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-2 text-sm py-1">
            <span>
              {r.nome_tecnico}
              {r.limite_max_num != null && (
                <span className="text-muted-foreground ml-2 text-xs">
                  máx {r.limite_max_num} {r.limite_unidade ?? ""}
                </span>
              )}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={disabled}
              onClick={() => onEscolher(r.id, r.nome_tecnico)}
            >
              Confirmar
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CardSugestaoItem({
  itemId,
  itemNome,
  vinculoIdExistente,
}: {
  itemId: string;
  itemNome: string;
  vinculoIdExistente?: string | null;
}) {
  const { data: sugestoes, isLoading } = useSugerirConstituintes(itemId);
  const confirmar = useConfirmarSugestaoVinculo();

  async function escolher(constituinteId: string, nome: string) {
    try {
      await confirmar.mutateAsync({
        itemId,
        constituinteId,
        vinculoIdExistente,
      });
      toast.success(`${itemNome} → ${nome} confirmado`);
    } catch (e: unknown) {
      const err = e as { message?: string };
      toast.error(`Não foi possível confirmar: ${err.message ?? "erro"}`);
    }
  }

  return (
    <Card className="border-l-4 border-l-sky-500">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-muted-foreground" />
          {itemNome}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <ListaSugestoes
          sugestoes={sugestoes}
          carregando={isLoading}
          onEscolher={(s) => escolher(s.constituinte_id, s.nome_tecnico)}
          disabled={confirmar.isPending}
        />
        <BuscaManual
          disabled={confirmar.isPending}
          onEscolher={(id, nome) => escolher(id, nome)}
        />
      </CardContent>
    </Card>
  );
}

function SugestoesNoVinculoPendente({ v }: { v: VinculoPendente }) {
  const { data: sugestoes, isLoading } = useSugerirConstituintes(v.item_id);
  const confirmar = useConfirmarSugestaoVinculo();
  const top = sugestoes?.[0];
  const diverge =
    top && top.constituinte_id !== v.constituinte_id && top.confianca === "alta";

  async function escolher(constituinteId: string, nome: string) {
    try {
      await confirmar.mutateAsync({
        itemId: v.item_id,
        constituinteId,
        vinculoIdExistente: v.id,
      });
      toast.success(`${v.item_nome} → ${nome} confirmado`);
    } catch (e: unknown) {
      const err = e as { message?: string };
      toast.error(`Não foi possível confirmar: ${err.message ?? "erro"}`);
    }
  }

  return (
    <div className="space-y-2 border-t pt-3">
      {diverge && (
        <p className="text-sm text-amber-700 dark:text-amber-400 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          A âncora sugere <strong>{top.nome_tecnico}</strong>, diferente do vínculo
          proposto. Confira antes de homologar o mineral/vitamina errado.
        </p>
      )}
      <ListaSugestoes
        sugestoes={sugestoes}
        carregando={isLoading}
        destaqueId={v.constituinte_id}
        onEscolher={(s) => escolher(s.constituinte_id, s.nome_tecnico)}
        disabled={confirmar.isPending}
      />
      <BuscaManual
        disabled={confirmar.isPending}
        onEscolher={(id, nome) => escolher(id, nome)}
      />
    </div>
  );
}

export default function HomologacaoRTPage() {
  const { data: vinculos, isLoading } = useVinculosPendentes();
  const { data: semVinculo, isLoading: loadingSem } = useItensSemVinculoConfirmado();
  const decidir = useDecidirVinculo();
  const [obsPorId, setObsPorId] = useState<Record<string, string>>({});
  const [teorPorId, setTeorPorId] = useState<Record<string, Partial<VinculoPendente>>>({});

  const pendentesIds = useMemo(
    () => new Set((vinculos ?? []).map((v) => v.item_id)),
    [vinculos],
  );

  /** Itens sem vínculo confirmado e sem card pendente (evita duplicar). */
  const filaSugestao = useMemo(
    () => (semVinculo ?? []).filter((i) => !pendentesIds.has(i.id)).slice(0, 40),
    [semVinculo, pendentesIds],
  );

  const total = vinculos?.length ?? 0;
  const criticos = useMemo(
    () => (vinculos ?? []).filter((v) => nivelDeAtencao(v) === "critico").length,
    [vinculos],
  );

  async function confirmar(v: VinculoPendente) {
    const edit = teorPorId[v.id] ?? {};
    try {
      await decidir.mutateAsync({
        vinculoId: v.id,
        acao: "confirmado",
        teorMin: edit.teor_min_pct ?? v.teor_min_pct,
        teorNominal: edit.teor_nominal_pct ?? v.teor_nominal_pct,
        teorMax: edit.teor_max_pct ?? v.teor_max_pct,
        observacaoRT: obsPorId[v.id] || null,
      });
      toast.success(`${v.item_nome} confirmado`);
    } catch (e: unknown) {
      const err = e as { message?: string; code?: string };
      toast.error(`Não foi possível confirmar: ${err.message || err.code || "erro"}`);
    }
  }

  async function contestar(v: VinculoPendente) {
    if (!obsPorId[v.id]?.trim()) {
      toast.error("Descreva o motivo antes de contestar.");
      return;
    }
    try {
      await decidir.mutateAsync({
        vinculoId: v.id,
        acao: "rejeitado",
        observacaoRT: obsPorId[v.id],
      });
      toast.success(`${v.item_nome} contestado`);
    } catch (e: unknown) {
      const err = e as { message?: string; code?: string };
      toast.error(`Não foi possível contestar: ${err.message || err.code || "erro"}`);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Conferência do Responsável Técnico"
        description="Confira cada vínculo insumo → constituinte ANVISA. O sistema sugere pelo elemento âncora (magnésio, zinco, D3…); você confirma. Nada entra em fórmula até a confirmação."
      />

      {total > 0 && (
        <div className="flex flex-wrap gap-3">
          <Badge variant="secondary" className="text-sm">
            {total} pendente{total > 1 ? "s" : ""}
          </Badge>
          {criticos > 0 && (
            <Badge variant="destructive" className="text-sm gap-1">
              <AlertTriangle className="h-3.5 w-3.5" />
              {criticos} com alerta (lote vencido ou fora de especificação)
            </Badge>
          )}
        </div>
      )}

      {isLoading && <p className="text-muted-foreground">Carregando fila…</p>}

      {!isLoading && total === 0 && filaSugestao.length === 0 && !loadingSem && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <ShieldCheck className="mx-auto mb-3 h-10 w-10 text-emerald-500" />
            Nenhum vínculo aguardando conferência. Toda matéria-prima em uso está confirmada.
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {(vinculos ?? []).map((v) => {
          const nivel = nivelDeAtencao(v);
          const borda =
            nivel === "critico" ? "border-l-4 border-l-red-500"
            : nivel === "atencao" ? "border-l-4 border-l-amber-500"
            : "border-l-4 border-l-emerald-500";

          return (
            <Card key={v.id} className={borda}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FlaskConical className="h-4 w-4 text-muted-foreground" />
                    {v.item_nome}
                    <span className="text-muted-foreground font-normal">→</span>
                    <span className="text-primary">{v.constituinte_nome}</span>
                  </CardTitle>
                  {v.norma && <Badge variant="outline">{v.norma}</Badge>}
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="text-sm space-y-1">
                    <p className="text-muted-foreground">Ensaio no laudo do fornecedor</p>
                    <p className="font-mono">{v.ensaio_coa ?? "—"}</p>
                    <p className="text-muted-foreground pt-1">Base de cálculo</p>
                    <p className="font-mono">{v.base_calculo ?? "—"}</p>
                  </div>
                  <div className="text-sm space-y-1">
                    <p className="text-muted-foreground">Limite máximo IN 28 (por dose)</p>
                    <p className="font-medium">
                      {v.limite_max_num != null
                        ? `${v.limite_max_num} ${v.limite_unidade ?? ""}`
                        : "não estabelecido"}
                    </p>
                    {v.fonte_url && (
                      <a href={v.fonte_url} target="_blank" rel="noreferrer"
                         className="inline-flex items-center gap-1 text-primary hover:underline pt-1">
                        Texto oficial <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {(["teor_min_pct", "teor_nominal_pct", "teor_max_pct"] as const).map((campo, i) => (
                    <div key={campo}>
                      <label className="text-xs text-muted-foreground">
                        {["Teor mínimo", "Teor nominal", "Teor máximo"][i]}
                      </label>
                      <Input
                        type="number" step="0.01"
                        defaultValue={v[campo] ?? ""}
                        onChange={(e) =>
                          setTeorPorId((s) => ({
                            ...s,
                            [v.id]: { ...s[v.id], [campo]: e.target.value === "" ? null : Number(e.target.value) },
                          }))
                        }
                      />
                    </div>
                  ))}
                </div>

                {v.observacao && (
                  <p className="text-sm rounded-md bg-muted/50 p-3">{v.observacao}</p>
                )}

                <Textarea
                  placeholder="Observação da conferência (obrigatória para contestar)"
                  value={obsPorId[v.id] ?? ""}
                  onChange={(e) => setObsPorId((s) => ({ ...s, [v.id]: e.target.value }))}
                />

                <div className="flex gap-3">
                  <Button onClick={() => confirmar(v)} disabled={decidir.isPending}>
                    Conferi e confirmo
                  </Button>
                  <Button variant="outline" onClick={() => contestar(v)} disabled={decidir.isPending}>
                    Contestar
                  </Button>
                </div>

                <SugestoesNoVinculoPendente v={v} />
              </CardContent>
            </Card>
          );
        })}
      </div>

      {(filaSugestao.length > 0 || loadingSem) && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Insumos sem vínculo confirmado</h2>
            <p className="text-sm text-muted-foreground">
              Pré-seleção por âncora (magnésio, zinco, cromo, colecalciferol…). Confirme com
              um clique ou busque manualmente — o sistema nunca homologa sozinho.
            </p>
          </div>
          {loadingSem && (
            <p className="text-muted-foreground text-sm">Carregando insumos…</p>
          )}
          {filaSugestao.map((item) => (
            <CardSugestaoItem
              key={item.id}
              itemId={item.id}
              itemNome={item.descricao_interna}
            />
          ))}
          {(semVinculo?.length ?? 0) > 40 && (
            <p className="text-xs text-muted-foreground">
              Mostrando os 40 primeiros de {semVinculo?.length}. Confirme alguns para ver os
              demais.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
