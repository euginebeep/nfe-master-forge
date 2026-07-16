// ============================================================
// CADASTRO RÁPIDO DE INSUMO (dentro do formulador)
// Fase 1: cria o insumo na hora, com sugestão de nome por IA
// (anvisa-resolve-name), e devolve o item recém-criado para
// já ficar selecionado na fórmula.
// Reutiliza a mutation canônica do cadastro (useCreateItem).
// ============================================================

import { useState, useEffect, useCallback } from "react";
import { Sparkles, Loader2, Package, AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCreateItem } from "@/hooks/use-itens";
import type { HybridItem } from "@/hooks/use-hybrid-data";
import {
  UNIDADES_INSUMO,
  converterDeclaracaoInsumo,
  formatarMemorialConversao,
  type ConversaoRastreavel,
} from "@/lib/unidades";

// Enums válidos no banco (check constraint itens_tipo_item_check):
// 'MP','EMBALAGEM','ROTULO','TAMPA','POTE','SILICA','CAPSULA_VAZIA','PA','OUTRO'.
// Para insumo de fórmula o correto é MP (default do cadastro normal = matéria-prima ativa).
const TIPOS_ITEM = [
  { value: "MP", label: "Matéria-prima (ativo)" },
  { value: "OUTRO", label: "Outro" },
] as const;

interface CadastroRapidoInsumoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nomeInicial: string;
  onCreated: (item: HybridItem) => void;
}

export function CadastroRapidoInsumo({
  open,
  onOpenChange,
  nomeInicial,
  onCreated,
}: CadastroRapidoInsumoProps) {
  const createItem = useCreateItem();

  const [nome, setNome] = useState(nomeInicial);
  const [tipoItem, setTipoItem] = useState<string>("MP");
  const [unidadeInterna, setUnidadeInterna] = useState<string>("g");
  const [unidadePesagem, setUnidadePesagem] = useState<string>("g");
  const [unidadeDeclaracao, setUnidadeDeclaracao] = useState<string>("mg");
  const [valorDeclaracao, setValorDeclaracao] = useState<string>("");

  const [sugestoes, setSugestoes] = useState<string[]>([]);
  const [sugerindo, setSugerindo] = useState(false);
  const [conversao, setConversao] = useState<ConversaoRastreavel | null>(null);
  const [convertendo, setConvertendo] = useState(false);

  // Reseta o formulário sempre que abrir com um novo termo
  useEffect(() => {
    if (open) {
      setNome(nomeInicial);
      setTipoItem("MP");
      setUnidadeInterna("g");
      setUnidadePesagem("g");
      setUnidadeDeclaracao("mg");
      setValorDeclaracao("");
      setSugestoes([]);
      setSugerindo(false);
      setConversao(null);
    }
  }, [open, nomeInicial]);

  const recalcularConversao = useCallback(async () => {
    const valor = parseFloat(valorDeclaracao.replace(",", "."));
    const precisaUi = unidadeDeclaracao === "UI";
    const precisaMcgMg =
      (unidadeDeclaracao === "mcg" && unidadeInterna === "mg") ||
      (unidadeDeclaracao === "mg" && unidadeInterna === "mcg");

    if (!valorDeclaracao.trim() || !Number.isFinite(valor) || valor <= 0) {
      setConversao(null);
      return;
    }
    if (!precisaUi && !precisaMcgMg) {
      setConversao(null);
      return;
    }

    setConvertendo(true);
    try {
      const result = await converterDeclaracaoInsumo({
        nomeInsumo: nome.trim() || nomeInicial,
        valor,
        unidadeOrigem: unidadeDeclaracao,
        unidadeDestino: precisaUi
          ? "mcg"
          : unidadeDeclaracao === "mcg"
            ? "mg"
            : "mcg",
      });
      setConversao(result);
    } catch {
      setConversao({
        status: "indisponivel",
        valorOrigem: valor,
        unidadeOrigem: unidadeDeclaracao,
        valorDestino: null,
        unidadeDestino: null,
        fator: null,
        fonte_tecnica: null,
        substanciaMatch: null,
        mensagem: "Conversão indisponível, confirmar com RT.",
      });
    } finally {
      setConvertendo(false);
    }
  }, [valorDeclaracao, unidadeDeclaracao, unidadeInterna, nome, nomeInicial]);

  useEffect(() => {
    const t = setTimeout(() => {
      void recalcularConversao();
    }, 300);
    return () => clearTimeout(t);
  }, [recalcularConversao]);

  const sugerirNome = async () => {
    const termo = nome.trim();
    if (!termo) return;
    setSugerindo(true);
    setSugestoes([]);
    try {
      const { data, error } = await supabase.functions.invoke("anvisa-resolve-name", {
        body: { termo },
      });
      if (error) throw error;
      const termos: string[] = Array.isArray(data?.termos) ? data.termos : [];
      if (termos.length === 0) {
        toast.info("Nenhuma sugestão encontrada. Você pode salvar com o nome digitado.");
      }
      setSugestoes(termos);
    } catch {
      toast.info("Não consegui sugerir nomes agora. Você pode salvar com o nome digitado.");
    } finally {
      setSugerindo(false);
    }
  };

  const salvar = async () => {
    const descricao = nome.trim();
    if (!descricao) {
      toast.error("Informe o nome do insumo.");
      return;
    }

    // UI com valor: exige conversão OK — nunca converter em silêncio
    const valor = parseFloat(valorDeclaracao.replace(",", "."));
    const temValor = valorDeclaracao.trim() !== "" && Number.isFinite(valor) && valor > 0;
    if (unidadeDeclaracao === "UI" && temValor) {
      const result =
        conversao ??
        (await converterDeclaracaoInsumo({
          nomeInsumo: descricao,
          valor,
          unidadeOrigem: "UI",
          unidadeDestino: "mcg",
        }));
      if (result.status !== "ok") {
        toast.error(result.mensagem || "Conversão indisponível, confirmar com RT.");
        setConversao(result);
        return;
      }
    }

    // Espelha os defaults do cadastro normal (ItemFormDialog): MP => CRITICO.
    const criticidade = tipoItem === "MP" ? "CRITICO" : "NORMAL";

    const memorial =
      conversao?.status === "ok" ? formatarMemorialConversao(conversao) : null;

    try {
      const payload: Record<string, unknown> = {
        descricao_interna: descricao,
        tipo_item: tipoItem,
        criticidade,
        unidade_interna: unidadeInterna,
        unidade_pesagem: unidadePesagem,
        unidade_declaracao: unidadeDeclaracao,
        controla_lote: true,
        controla_validade: true,
        higroscopico: false,
        exige_premix: false,
        ativo: true,
      };

      // Persiste fator UI→mcg da linha oficial quando houver match
      if (conversao?.status === "ok" && conversao.unidadeOrigem === "UI") {
        if (conversao.unidadeDestino === "mcg" && conversao.fator != null) {
          payload.conversao_ui_mcg = conversao.fator;
        }
      }

      const item = await createItem.mutateAsync(payload as never);

      if (memorial) {
        toast.success(`Insumo "${descricao}" cadastrado`, {
          description: memorial,
        });
      } else {
        toast.success(`Insumo "${descricao}" cadastrado e selecionado`);
      }
      onCreated(item as unknown as HybridItem);
      onOpenChange(false);
    } catch (err) {
      const e = err as { message?: string; code?: string };
      toast.error("Erro ao cadastrar insumo: " + (e?.message || e?.code || "erro desconhecido"));
    }
  };

  const uiSemFator =
    unidadeDeclaracao === "UI" &&
    conversao &&
    (conversao.status === "indisponivel" || conversao.status === "ambiguo");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Cadastrar novo insumo
          </DialogTitle>
          <DialogDescription>
            Cadastro rápido: o insumo é criado e já fica selecionado na fórmula.
            Use mcg/UI para vitaminas — a conversão vem de conversoes_unidades.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Nome + sugestão IA */}
          <div className="space-y-2">
            <Label htmlFor="cri-nome">Nome do insumo *</Label>
            <div className="flex gap-2">
              <Input
                id="cri-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Vitamina D3"
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={sugerirNome}
                disabled={sugerindo || !nome.trim()}
                className="gap-2 shrink-0"
              >
                {sugerindo ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Sugerir nome (IA)
              </Button>
            </div>
            {sugestoes.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {sugestoes.map((s) => (
                  <Badge
                    key={s}
                    variant="secondary"
                    className="cursor-pointer hover:bg-primary/10 hover:text-primary"
                    onClick={() => setNome(s)}
                  >
                    {s}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Tipo */}
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={tipoItem} onValueChange={setTipoItem}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPOS_ITEM.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Unidades */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Unidade interna</Label>
              <Select value={unidadeInterna} onValueChange={setUnidadeInterna}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UNIDADES_INSUMO.map((u) => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Un. pesagem</Label>
              <Select value={unidadePesagem} onValueChange={setUnidadePesagem}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UNIDADES_INSUMO.map((u) => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Un. declaração</Label>
              <Select value={unidadeDeclaracao} onValueChange={setUnidadeDeclaracao}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UNIDADES_INSUMO.map((u) => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Valor na unidade de declaração (para conversão automática) */}
          <div className="space-y-2">
            <Label htmlFor="cri-valor">
              Valor declaração (opcional)
              {unidadeDeclaracao === "UI" ? " — UI" : unidadeDeclaracao === "mcg" ? " — mcg" : ""}
            </Label>
            <Input
              id="cri-valor"
              type="number"
              min={0}
              step="any"
              value={valorDeclaracao}
              onChange={(e) => setValorDeclaracao(e.target.value)}
              placeholder={unidadeDeclaracao === "UI" ? "Ex: 2000" : "Ex: 50"}
            />
            <p className="text-xs text-muted-foreground">
              Digite o valor na unidade escolhida; o sistema converte com fatores oficiais (nunca chute).
            </p>
          </div>

          {/* Memorial da conversão */}
          {(convertendo || conversao) && (
            <div
              className={`rounded-md border px-3 py-2 text-sm flex gap-2 items-start ${
                conversao?.status === "ok"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : uiSemFator
                    ? "border-amber-200 bg-amber-50 text-amber-900"
                    : "border-border bg-muted/40"
              }`}
            >
              {convertendo ? (
                <Loader2 className="h-4 w-4 mt-0.5 animate-spin shrink-0" />
              ) : conversao?.status === "ok" ? (
                <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              )}
              <div className="space-y-0.5">
                <p className="font-medium">
                  {convertendo
                    ? "Calculando conversão…"
                    : conversao?.status === "ok"
                      ? "Conversão automática"
                      : "Conversão bloqueada"}
                </p>
                <p className="text-xs leading-relaxed">
                  {conversao?.mensagem || "…"}
                </p>
                {conversao?.status === "ok" && (
                  <p className="text-[11px] opacity-80 font-mono">
                    {formatarMemorialConversao(conversao)}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={salvar}
            disabled={
              createItem.isPending ||
              !nome.trim() ||
              (unidadeDeclaracao === "UI" &&
                !!valorDeclaracao.trim() &&
                conversao?.status !== "ok" &&
                !convertendo)
            }
          >
            {createItem.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Cadastrar e selecionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
