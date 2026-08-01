// ============================================================
// CADASTRO RÁPIDO DE INSUMO (dentro do formulador)
// Fase 1: cria o insumo na hora, com sugestão de nome por IA
// (anvisa-resolve-name), e devolve o item recém-criado para
// já ficar selecionado na fórmula.
// Reutiliza a mutation canônica do cadastro (useCreateItem).
// ============================================================

import { useState, useEffect, useCallback, useMemo } from "react";
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
import { invokeEdge } from "@/lib/edge-invoke";
import type { HybridItem } from "@/hooks/use-hybrid-data";
import {
  UNIDADES,
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

const BASES_UNIDADE_COMERCIAL: Record<string, { fatorBase: number; unidadeBase: string }> = {
  KG: { fatorBase: 1000, unidadeBase: "g" },
  G: { fatorBase: 1, unidadeBase: "g" },
  MG: { fatorBase: 0.001, unidadeBase: "g" },
  UN: { fatorBase: 1, unidadeBase: "un" },
  MI: { fatorBase: 1000, unidadeBase: "un" },
  MIL: { fatorBase: 1000, unidadeBase: "un" },
  L: { fatorBase: 1000, unidadeBase: "ml" },
};

function normalizarDescricaoItem(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function calcularFatorComercial(unidadeComercial: string): {
  fator: number;
  quantidade: number;
  unidade: string;
  unidadeBase: string;
} | null {
  const match = unidadeComercial
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ")
    .match(/^(\d+(?:[.,]\d+)?)\s*(KG|G|MG|UN|MI|MIL|L)$/);

  if (!match) return null;

  const quantidade = Number(match[1].replace(",", "."));
  const base = BASES_UNIDADE_COMERCIAL[match[2]];
  if (!Number.isFinite(quantidade) || quantidade <= 0 || !base) return null;

  return {
    fator: quantidade * base.fatorBase,
    quantidade,
    unidade: match[2],
    unidadeBase: base.unidadeBase,
  };
}

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
  const [ncm, setNcm] = useState<string>("");
  const [unidadeFornecedor, setUnidadeFornecedor] = useState<string>("1 KG");

  const [sugestoes, setSugestoes] = useState<string[]>([]);
  const [sugerindo, setSugerindo] = useState(false);
  const [conversao, setConversao] = useState<ConversaoRastreavel | null>(null);
  const [convertendo, setConvertendo] = useState(false);
  const [itemExistente, setItemExistente] = useState<HybridItem | null>(null);
  const [buscandoExistente, setBuscandoExistente] = useState(false);

  const fatorComercial = useMemo(
    () => calcularFatorComercial(unidadeFornecedor),
    [unidadeFornecedor],
  );

  // Reseta o formulário sempre que abrir com um novo termo
  useEffect(() => {
    if (open) {
      setNome(nomeInicial);
      setTipoItem("MP");
      setUnidadeInterna("g");
      setUnidadePesagem("g");
      setUnidadeDeclaracao("mg");
      setValorDeclaracao("");
      setNcm("");
      setUnidadeFornecedor("1 KG");
      setSugestoes([]);
      setSugerindo(false);
      setConversao(null);
      setItemExistente(null);
      setBuscandoExistente(false);
    }
  }, [open, nomeInicial]);

  const buscarItemExistente = useCallback(async (descricao: string): Promise<HybridItem | null> => {
    const alvo = normalizarDescricaoItem(descricao);
    if (!alvo) return null;

    const pageSize = 1000;
    let from = 0;

    while (true) {
      const { data, error } = await supabase
        .from("itens")
        .select(
          "id, sku_interno, descricao_interna, descricao_comercial, tipo_item, ncm, unidade_interna, unidade_pesagem, fator_conversao, controla_lote, controla_validade, criticidade, higroscopico, exige_premix, ativo, created_at, updated_at",
        )
        .eq("ativo", true)
        .order("descricao_interna")
        .range(from, from + pageSize - 1);

      if (error) throw error;

      const items = (data || []) as HybridItem[];
      const hit = items.find(
        (item) => normalizarDescricaoItem(item.descricao_interna) === alvo,
      );
      if (hit) return hit;
      if (items.length < pageSize) return null;

      from += pageSize;
    }
  }, []);

  useEffect(() => {
    if (!open) return;

    const descricao = nome.trim();
    if (!descricao) {
      setItemExistente(null);
      setBuscandoExistente(false);
      return;
    }

    let cancelado = false;
    setBuscandoExistente(true);
    const t = setTimeout(() => {
      void buscarItemExistente(descricao)
        .then((item) => {
          if (!cancelado) setItemExistente(item);
        })
        .catch(() => {
          if (!cancelado) setItemExistente(null);
        })
        .finally(() => {
          if (!cancelado) setBuscandoExistente(false);
        });
    }, 300);

    return () => {
      cancelado = true;
      clearTimeout(t);
    };
  }, [open, nome, buscarItemExistente]);

  const selecionarItemExistente = useCallback((item: HybridItem) => {
    toast.success(`Insumo existente "${item.descricao_interna}" selecionado`);
    onCreated(item);
    onOpenChange(false);
  }, [onCreated, onOpenChange]);

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
      const { data, error } = await invokeEdge<{ termos?: string[] }>("anvisa-resolve-name", { termo });
      if (error) throw new Error(error);
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

    let existente: HybridItem | null;
    try {
      existente = itemExistente ?? (await buscarItemExistente(descricao));
    } catch {
      toast.error("Não foi possível verificar se o insumo já existe. Cadastro bloqueado para evitar duplicidade.");
      return;
    }
    if (existente) {
      selecionarItemExistente(existente);
      return;
    }

    const ncmLimpo = ncm.replace(/\D/g, "");
    if (ncmLimpo.length !== 8) {
      toast.error("Informe o NCM com 8 dígitos antes de cadastrar.");
      return;
    }

    if (!fatorComercial) {
      toast.error("Informe a unidade comercial com quantidade e base. Exemplos: 1 KG, 25 KG, 5 MIL.");
      return;
    }

    if (unidadeInterna !== fatorComercial.unidadeBase) {
      toast.error(
        `Unidade interna incompatível: ${unidadeFornecedor} converte para ${fatorComercial.unidadeBase}.`,
      );
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
        ncm: ncmLimpo,
        unidade_interna: unidadeInterna,
        unidade_pesagem: unidadePesagem,
        unidade_declaracao: unidadeDeclaracao,
        unidade_fornecedor: unidadeFornecedor.trim().toUpperCase().replace(/\s+/g, " "),
        fator_conversao: fatorComercial.fator,
        embalagem_compra_qtd: fatorComercial.quantidade,
        embalagem_compra_unidade: fatorComercial.unidade,
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
            {itemExistente && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="font-medium">Insumo já cadastrado</p>
                    <p className="text-xs">
                      {itemExistente.sku_interno ? `${itemExistente.sku_interno} — ` : ""}
                      {itemExistente.descricao_interna}
                      {itemExistente.ncm ? ` · NCM ${itemExistente.ncm}` : ""}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => selecionarItemExistente(itemExistente)}
                    className="shrink-0"
                  >
                    Usar este item
                  </Button>
                </div>
              </div>
            )}
            {buscandoExistente && (
              <p className="text-xs text-muted-foreground">Verificando cadastro existente…</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="cri-ncm">NCM *</Label>
              <Input
                id="cri-ncm"
                value={ncm}
                onChange={(e) => setNcm(e.target.value)}
                placeholder="8 dígitos"
                inputMode="numeric"
                maxLength={10}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cri-unidade-fornecedor">Unidade comercial *</Label>
              <Input
                id="cri-unidade-fornecedor"
                value={unidadeFornecedor}
                onChange={(e) => {
                  const value = e.target.value;
                  const fator = calcularFatorComercial(value);
                  setUnidadeFornecedor(value);
                  if (fator) {
                    setUnidadeInterna(fator.unidadeBase);
                    setUnidadePesagem(fator.unidadeBase);
                  }
                }}
                placeholder="Ex: 1 KG, 25 KG, 5 MIL"
              />
              <p className={`text-xs ${fatorComercial ? "text-muted-foreground" : "text-destructive"}`}>
                {fatorComercial
                  ? `Fator: ${fatorComercial.fator} ${fatorComercial.unidadeBase}`
                  : "Use quantidade + KG, G, MG, UN, MI, MIL ou L."}
              </p>
            </div>
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
                  {UNIDADES.map((u) => (
                    <SelectItem key={u.value} value={u.value}>{u.value}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Un. pesagem</Label>
              <Select value={unidadePesagem} onValueChange={setUnidadePesagem}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UNIDADES.map((u) => (
                    <SelectItem key={u.value} value={u.value}>{u.value}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Un. declaração</Label>
              <Select value={unidadeDeclaracao} onValueChange={setUnidadeDeclaracao}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UNIDADES.map((u) => (
                    <SelectItem key={u.value} value={u.value}>{u.value}</SelectItem>
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
            {itemExistente ? "Selecionar existente" : "Cadastrar e selecionar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
