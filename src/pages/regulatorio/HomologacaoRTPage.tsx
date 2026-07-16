// src/pages/regulatorio/HomologacaoRTPage.tsx
//
// Central de conferência do Responsável Técnico.
// A RT vê cada vínculo insumo → constituinte ANVISA proposto pelo sistema,
// com o teor extraído do COA, e confirma ou contesta item a item.
//
// Filosofia: o sistema PROPÕE; o RT CONFERE e ASSINA.
// anvisa_avaliar_formula() só usa vínculo com status 'confirmado'.

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ExternalLink, ShieldCheck, AlertTriangle, FlaskConical } from "lucide-react";
import { toast } from "sonner";
import {
  useVinculosPendentes,
  useDecidirVinculo,
  type VinculoPendente,
} from "@/hooks/useHomologacaoRT";

function nivelDeAtencao(v: VinculoPendente): "ok" | "atencao" | "critico" {
  const obs = (v.observacao ?? "").toUpperCase();
  if (obs.includes("ESTOUROU") || obs.includes("VENCIDO")) return "critico";
  if (obs.includes("ATENCAO") || obs.includes("AMARELO")) return "atencao";
  return "ok";
}

export default function HomologacaoRTPage() {
  const { data: vinculos, isLoading } = useVinculosPendentes();
  const decidir = useDecidirVinculo();
  const [obsPorId, setObsPorId] = useState<Record<string, string>>({});
  const [teorPorId, setTeorPorId] = useState<Record<string, Partial<VinculoPendente>>>({});

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
        description="Confira cada vínculo insumo → constituinte ANVISA e o teor extraído do laudo do fornecedor. Nada é usado em fórmula até você confirmar."
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

      {!isLoading && total === 0 && (
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
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
