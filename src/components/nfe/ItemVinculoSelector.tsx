import { useState, useMemo, useEffect } from "react";
import { Link, Unlink, Search, Package, Check, Loader2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import type { LocalItem } from "@/hooks/use-local-itens";
import { parseUnidade, calcularFatorConversao } from "@/lib/unidade-parser";
import { calcularSimilaridade } from "@/lib/item-similaridade";

interface ItemVinculoSelectorProps {
  xmlDescricao: string;
  xmlCodigo: string;
  xmlNcm?: string;
  xmlEan?: string;
  xmlUnidade?: string;  // Unidade do XML (pode ter número embutido)
  xmlQuantidade?: number;  // Quantidade do XML
  selectedItemId?: string;
  onSelect: (item: LocalItem | null, fatorCalculado?: number) => void;  // Retorna fator calculado
}

// ---------------------------------------------------------------
// Componente
// ---------------------------------------------------------------

export function ItemVinculoSelector({
  xmlDescricao,
  xmlCodigo,
  xmlNcm,
  xmlEan,
  xmlUnidade,
  xmlQuantidade,
  selectedItemId,
  onSelect,
}: ItemVinculoSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [itens, setItens] = useState<LocalItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Buscar itens do Supabase quando o dialog abre
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    supabase
      .from("itens")
      .select(
        "id, sku_interno, descricao_interna, descricao_comercial, tipo_item, ncm, ean, unidade_interna, unidade_fornecedor, fator_conversao, controla_lote, controla_validade, criticidade, ativo"
      )
      .eq("ativo", true)
      .order("descricao_interna", { ascending: true })
      .then(({ data, error }) => {
        if (!error && data) {
          setItens(
            data.map((row) => ({
              id: row.id,
              sku_interno: row.sku_interno ?? "",
              descricao_interna: row.descricao_interna,
              descricao_comercial: row.descricao_comercial ?? undefined,
              tipo_item: row.tipo_item as LocalItem["tipo_item"],
              ncm: row.ncm ?? undefined,
              ean: row.ean ?? undefined,
              unidade_interna: (row.unidade_interna ?? "g") as LocalItem["unidade_interna"],
              unidade_fornecedor: (row.unidade_fornecedor ?? "kg") as LocalItem["unidade_fornecedor"],
              fator_conversao: row.fator_conversao ?? 1,
              controla_lote: row.controla_lote,
              controla_validade: row.controla_validade,
              criticidade: (row.criticidade ?? "NORMAL") as LocalItem["criticidade"],
              higroscopico: false,
              armazenamento: "AMBIENTE",
              exige_premix: false,
              ativo: row.ativo,
            }))
          );
        }
        setLoading(false);
      });
  }, [open]);

  // Item selecionado
  const selectedItem = useMemo(() => {
    if (!selectedItemId) return null;
    return itens.find((i) => i.id === selectedItemId) || null;
  }, [selectedItemId, itens]);

  // Filtrar itens baseado na busca manual
  const filteredItens = useMemo(() => {
    if (!search.trim()) return itens;
    const searchLower = search.toLowerCase().trim();
    return itens.filter(
      (i) =>
        i.descricao_interna.toLowerCase().includes(searchLower) ||
        (i.sku_interno ?? "").toLowerCase().includes(searchLower) ||
        (i.ncm ?? "").includes(search) ||
        (i.ean ?? "").includes(search) ||
        (i.descricao_comercial ?? "").toLowerCase().includes(searchLower)
    );
  }, [itens, search]);

  // ---------------------------------------------------------------
  // Sugestões automáticas — lógica corrigida
  //
  // Hierarquia de match (da mais para a menos precisa):
  //   1. EAN exato → confiança 100%, mostra imediatamente
  //   2. Similaridade de descrição ≥ 55% → mostra com score
  //   3. NCM igual + similaridade ≥ 30% → mostra com score menor
  //   4. NCM igual puro (sem similaridade) → NÃO mostra
  //      (evita sugerir "Citrus Sinensis" para "Feno Grego")
  // ---------------------------------------------------------------
  const sugestoes = useMemo(() => {
    type SugestaoItem = {
      item: LocalItem;
      score: number;
      motivo: "EAN" | "Descrição" | "NCM+Desc";
    };

    const candidatos: SugestaoItem[] = [];

    // 1. Match por EAN (perfeito)
    if (xmlEan && xmlEan !== "SEM GTIN") {
      const byEan = itens.find((i) => i.ean === xmlEan);
      if (byEan) {
        candidatos.push({ item: byEan, score: 100, motivo: "EAN" });
      }
    }

    // 2. Match por similaridade de descrição (independente de NCM)
    if (xmlDescricao) {
      itens.forEach((item) => {
        // Pular se já está como candidato por EAN
        if (candidatos.some((c) => c.item.id === item.id)) return;

        const score = calcularSimilaridade(xmlDescricao, item.descricao_interna);

        // Threshold alto para sugestão por descrição pura: ≥ 55%
        if (score >= 55) {
          candidatos.push({ item, score, motivo: "Descrição" });
        }
        // Threshold menor se NCM também coincide: ≥ 30%
        else if (score >= 30 && xmlNcm && item.ncm === xmlNcm) {
          candidatos.push({ item, score, motivo: "NCM+Desc" });
        }
        // NCM igual sem similaridade de descrição → NÃO sugere
      });
    }

    // Ordenar por score decrescente e limitar a 3 sugestões
    return candidatos
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }, [itens, xmlEan, xmlNcm, xmlDescricao]);

  const handleSelect = (item: LocalItem) => {
    try {
      let fatorCalculado = item.fator_conversao || 1;
      if (xmlUnidade && xmlQuantidade) {
        const unidadeParsed = parseUnidade(xmlUnidade, xmlQuantidade);
        fatorCalculado = calcularFatorConversao(
          unidadeParsed.unidade,
          item.unidade_interna,
          unidadeParsed.multiplicador
        );
      }
      onSelect(item, fatorCalculado);
      setOpen(false);
    } catch (e: any) {
      toast.error(`Falha ao vincular item: ${e?.message || e?.code || 'erro desconhecido'}`);
    }
  };

  const handleDesvincular = () => {
    onSelect(null);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {selectedItem ? (
          <div className="flex-1 p-2 border rounded-lg bg-primary/5 border-primary/20">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Link className="h-4 w-4 text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {selectedItem.descricao_interna}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    SKU: {selectedItem.sku_interno} | {selectedItem.tipo_item}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 h-8 w-8"
                onClick={handleDesvincular}
              >
                <Unlink className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full justify-start gap-2">
                <Search className="h-4 w-4" />
                <span className="text-muted-foreground">
                  Vincular a item existente...
                </span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Link className="h-5 w-5" />
                  Vincular Item do XML
                </DialogTitle>
                <DialogDescription>
                  Selecione um item cadastrado para vincular ao produto da NF-e
                </DialogDescription>
              </DialogHeader>

              {/* Info do item XML */}
              <div className="p-3 bg-muted rounded-lg text-sm">
                <p className="font-medium mb-1">{xmlDescricao}</p>
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span>Código: {xmlCodigo}</span>
                  {xmlNcm && <span>NCM: {xmlNcm}</span>}
                  {xmlEan && xmlEan !== "SEM GTIN" && (
                    <span>EAN: {xmlEan}</span>
                  )}
                </div>
              </div>

              <Separator />

              {loading ? (
                <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">Carregando itens cadastrados...</span>
                </div>
              ) : (
                <>
                  {/* Sugestões automáticas — só aparecem se há match real */}
                  {sugestoes.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <Star className="h-3 w-3" />
                        Sugestões por similaridade de nome
                      </Label>
                      <div className="space-y-1">
                        {sugestoes.map(({ item, score, motivo }) => (
                          <button
                            key={item.id}
                            onClick={() => handleSelect(item)}
                            className="w-full p-2 border rounded-lg text-left hover:bg-accent transition-colors flex items-center gap-2"
                          >
                            <Package className="h-4 w-4 text-primary shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {item.descricao_interna}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                SKU: {item.sku_interno} | NCM: {item.ncm || "-"} | {item.tipo_item}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Badge
                                variant={score >= 80 ? "default" : score >= 55 ? "secondary" : "outline"}
                                className="text-xs"
                              >
                                {motivo}
                              </Badge>
                              <span className="text-xs text-muted-foreground w-8 text-right">
                                {score}%
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                      <Separator />
                    </div>
                  )}

                  {/* Busca manual */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">
                      Buscar no cadastro ({itens.length} itens)
                    </Label>
                    <Command className="rounded-lg border">
                      <CommandInput
                        placeholder="Buscar por descrição, SKU, NCM, EAN..."
                        value={search}
                        onValueChange={setSearch}
                      />
                      <CommandList className="max-h-[250px] overflow-y-auto">
                        <CommandEmpty>
                          Nenhum item encontrado. O item será criado
                          automaticamente na importação.
                        </CommandEmpty>
                        <CommandGroup>
                          {filteredItens.map((item) => (
                            <CommandItem
                              key={item.id}
                              value={`${item.descricao_interna} ${item.sku_interno} ${item.ncm ?? ""} ${item.ean ?? ""}`}
                              onSelect={() => handleSelect(item)}
                              className="flex items-center gap-2 cursor-pointer"
                            >
                              <Package className="h-4 w-4 text-muted-foreground" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">
                                  {item.descricao_interna}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  SKU: {item.sku_interno} | NCM:{" "}
                                  {item.ncm || "-"} | {item.tipo_item}
                                </p>
                              </div>
                              {item.id === selectedItemId && (
                                <Check className="h-4 w-4 text-primary" />
                              )}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </div>
                </>
              )}

              {/* Rodapé */}
              <Separator />
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Não encontrou? O item será criado automaticamente na
                  importação.
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setOpen(false)}
                >
                  Cancelar
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}
