import { useMemo, useState } from "react";
import { Beaker, FlaskConical, Loader2, Save, Sun } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  politicaPreMix,
  resolverPoliticaEfetiva,
  type PremixPoliticaResultado,
} from "@/lib/premix-politica";
import {
  usePremixPoliticaOverride,
  useSalvarPremixPolitica,
} from "@/hooks/usePremixPolitica";

type Props = {
  constituinteId: string;
  nome: string;
  categoria?: string | null;
  limite_unidade?: string | null;
  limite_max_num?: number | null;
  /** Se false, só mostra o selo/sugestão (Consulta ANVISA). */
  editavel?: boolean;
};

function SeloBadges({ efetiva }: { efetiva: PremixPoliticaResultado & { origem: "rt" | "sugestao" } }) {
  if (!efetiva.exige_premix) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge className="bg-amber-600 text-white hover:bg-amber-600">
        <Beaker className="w-3 h-3 mr-1" />
        Exige pré-mix
      </Badge>
      {efetiva.solubilidade !== "INDEFINIDA" && (
        <Badge variant="outline">{efetiva.solubilidade}</Badge>
      )}
      {efetiva.proporcao_sugerida && (
        <Badge variant="secondary">{efetiva.proporcao_sugerida}</Badge>
      )}
      {efetiva.origem === "rt" ? (
        <Badge variant="outline" className="text-primary border-primary/30">
          Confirmado RT
        </Badge>
      ) : (
        <Badge variant="outline" className="text-muted-foreground">
          Sugestão — RT revisa
        </Badge>
      )}
      {efetiva.precisa_protecao_luz && (
        <Badge variant="outline" className="text-amber-700 border-amber-300">
          <Sun className="w-3 h-3 mr-1" /> Luz
        </Badge>
      )}
    </div>
  );
}

export function PremixPoliticaPainel({
  constituinteId,
  nome,
  categoria,
  limite_unidade,
  limite_max_num,
  editavel = false,
}: Props) {
  const sugestao = useMemo(
    () =>
      politicaPreMix({
        nome,
        categoria,
        limite_unidade,
        limite_max_num,
      }),
    [nome, categoria, limite_unidade, limite_max_num],
  );

  const { data: override, isLoading } = usePremixPoliticaOverride(constituinteId);
  const salvar = useSalvarPremixPolitica();

  const efetiva = useMemo(
    () => resolverPoliticaEfetiva(sugestao, override ?? null),
    [sugestao, override],
  );

  const [editando, setEditando] = useState(false);
  const [exige, setExige] = useState(true);
  const [solubilidade, setSolubilidade] = useState("HIDRO");
  const [fator, setFator] = useState("1000");
  const [veiculo, setVeiculo] = useState("");
  const [antiox, setAntiox] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="w-3 h-3 animate-spin" /> Política de pré-mix…
      </div>
    );
  }

  if (!sugestao.exige_premix && !override?.exige_premix) {
    return null;
  }

  const iniciarEdicao = () => {
    setExige(efetiva.exige_premix);
    setSolubilidade(efetiva.solubilidade);
    setFator(String(efetiva.fator_diluicao_sugerido ?? 1000));
    setVeiculo(efetiva.veiculo_sugerido ?? "");
    setAntiox(efetiva.precisa_antioxidante);
    setEditando(true);
  };

  const handleSalvar = async () => {
    try {
      await salvar.mutateAsync({
        constituinteId,
        exige_premix: exige,
        solubilidade,
        fator_diluicao: fator ? Number(fator) : null,
        veiculo: veiculo || null,
        precisa_antioxidante: antiox,
        precisa_protecao_luz: solubilidade === "LIPO",
      });
      toast.success("Política de pré-mix salva (decisão da RT)");
      setEditando(false);
    } catch (e: unknown) {
      const err = e as { message?: string };
      toast.error(err.message || "Falha ao salvar política de pré-mix");
    }
  };

  return (
    <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            <FlaskConical className="w-4 h-4 text-amber-700 shrink-0" />
            Pré-mix
          </div>
          <SeloBadges efetiva={efetiva} />
        </div>
        {editavel && !editando && (
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={iniciarEdicao}>
            Ajustar (RT)
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">{efetiva.motivo}</p>
      {efetiva.veiculo_sugerido && (
        <p className="text-xs">
          <span className="text-muted-foreground">Veículo: </span>
          {efetiva.veiculo_sugerido}
        </p>
      )}
      {efetiva.observacoes.length > 0 && (
        <ul className="text-[11px] text-muted-foreground space-y-0.5">
          {efetiva.observacoes.map((o) => (
            <li key={o}>• {o}</li>
          ))}
        </ul>
      )}

      {editavel && editando && (
        <div className="grid gap-3 sm:grid-cols-2 pt-2 border-t border-border/60">
          <div className="flex items-center justify-between gap-2 sm:col-span-2">
            <Label htmlFor={`exige-${constituinteId}`} className="text-xs">
              Exige pré-mix
            </Label>
            <Switch
              id={`exige-${constituinteId}`}
              checked={exige}
              onCheckedChange={setExige}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Solubilidade</Label>
            <Select value={solubilidade} onValueChange={setSolubilidade}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="LIPO">LIPO</SelectItem>
                <SelectItem value="HIDRO">HIDRO</SelectItem>
                <SelectItem value="INDEFINIDA">INDEFINIDA</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Fator de diluição (1:N)</Label>
            <Select value={fator} onValueChange={setFator}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">1:10</SelectItem>
                <SelectItem value="100">1:100</SelectItem>
                <SelectItem value="1000">1:1000</SelectItem>
                <SelectItem value="10000">1:10000</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">Veículo</Label>
            <Input
              className="h-8 text-xs"
              value={veiculo}
              onChange={(e) => setVeiculo(e.target.value)}
              placeholder="Ex.: MCC + antioxidante"
            />
          </div>
          <div className="flex items-center justify-between gap-2 sm:col-span-2">
            <Label htmlFor={`antiox-${constituinteId}`} className="text-xs">
              Precisa antioxidante
            </Label>
            <Switch
              id={`antiox-${constituinteId}`}
              checked={antiox}
              onCheckedChange={setAntiox}
            />
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <Button
              size="sm"
              className="h-7 text-xs"
              disabled={salvar.isPending}
              onClick={handleSalvar}
            >
              {salvar.isPending ? (
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              ) : (
                <Save className="w-3 h-3 mr-1" />
              )}
              Salvar decisão
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => setEditando(false)}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
