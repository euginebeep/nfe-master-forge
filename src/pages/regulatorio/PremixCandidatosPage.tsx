import { useMemo, useState } from "react";
import { Beaker, Loader2, Search } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PremixPoliticaPainel } from "@/components/regulatorio/PremixPoliticaPainel";
import { useConstituintesCandidatosPremix } from "@/hooks/useConstituintesCandidatosPremix";

export default function PremixCandidatosPage() {
  const { data = [], isLoading, error } = useConstituintesCandidatosPremix();
  const [filtro, setFiltro] = useState("");
  const [selecionado, setSelecionado] = useState<string | null>(null);

  const lista = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    if (!q) return data;
    return data.filter(
      (c) =>
        c.nome_tecnico.toLowerCase().includes(q) ||
        (c.categoria || "").toLowerCase().includes(q),
    );
  }, [data, filtro]);

  const ativo = lista.find((c) => c.constituinte_id === selecionado) ?? lista[0] ?? null;

  return (
    <div className="container mx-auto py-6 space-y-6 animate-in fade-in duration-500">
      <PageHeader
        icon={Beaker}
        title="Candidatos a pré-mix"
        description="Micro-doses da base ANVISA com sugestão automática de proporção e solubilidade. A RT confirma ou ajusta — nada é imposto."
      />

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Filtrar por nome ou categoria…"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
        />
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando candidatos…
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive">
          Não foi possível listar candidatos. Aplique a migration
          constituintes_candidatos_premix se ainda não estiver no banco.
        </p>
      )}

      {!isLoading && !error && (
        <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
          <Card>
            <CardContent className="pt-4 space-y-1 max-h-[70vh] overflow-y-auto">
              <p className="text-xs text-muted-foreground mb-2">
                {lista.length} constituinte{lista.length !== 1 ? "s" : ""}
              </p>
              {lista.map((c) => {
                const sel = (ativo?.constituinte_id ?? null) === c.constituinte_id;
                return (
                  <button
                    key={c.constituinte_id}
                    type="button"
                    onClick={() => setSelecionado(c.constituinte_id)}
                    className={`w-full text-left rounded-md border px-3 py-2 transition-colors ${
                      sel
                        ? "border-primary/40 bg-primary/5"
                        : "border-border hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium text-foreground leading-tight">
                        {c.nome_tecnico}
                      </span>
                      <Badge
                        variant="outline"
                        className={
                          c.origem === "RT"
                            ? "text-primary border-primary/30 shrink-0"
                            : "text-muted-foreground shrink-0"
                        }
                      >
                        {c.origem}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {c.exige_premix && (
                        <Badge className="bg-amber-600 text-white text-[10px] hover:bg-amber-600">
                          Exige pré-mix
                        </Badge>
                      )}
                      {c.solubilidade_sugerida && (
                        <Badge variant="secondary" className="text-[10px]">
                          {c.solubilidade_sugerida}
                        </Badge>
                      )}
                      {c.proporcao_sugerida && (
                        <Badge variant="outline" className="text-[10px]">
                          {c.proporcao_sugerida}
                        </Badge>
                      )}
                      {c.limite_max_num != null && (
                        <span className="text-[10px] text-muted-foreground">
                          máx {c.limite_max_num} {c.limite_unidade}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
              {lista.length === 0 && (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  Nenhum candidato encontrado.
                </p>
              )}
            </CardContent>
          </Card>

          <div className="space-y-3">
            {ativo ? (
              <>
                <Card>
                  <CardContent className="pt-4 space-y-1">
                    <h3 className="font-semibold text-foreground">{ativo.nome_tecnico}</h3>
                    <p className="text-xs text-muted-foreground">
                      {ativo.categoria || "Sem categoria"} · origem {ativo.origem}
                    </p>
                  </CardContent>
                </Card>
                <PremixPoliticaPainel
                  constituinteId={ativo.constituinte_id}
                  nome={ativo.nome_tecnico}
                  categoria={ativo.categoria}
                  limite_unidade={ativo.limite_unidade}
                  limite_max_num={ativo.limite_max_num}
                  editavel
                />
              </>
            ) : (
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  Selecione um constituinte à esquerda.
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
