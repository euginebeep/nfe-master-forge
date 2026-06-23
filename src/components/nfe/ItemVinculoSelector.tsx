import { useState, useMemo, useEffect } from "react";
import { Link, Unlink, Search, Package, Check, Loader2 } from "lucide-react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { StatusBadge } from "@/components/ui/status-badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import type { LocalItem } from "@/hooks/use-local-itens";

interface ItemVinculoSelectorProps {
  xmlDescricao: string;
  xmlCodigo: string;
  xmlNcm?: string;
  xmlEan?: string;
  selectedItemId?: string;
  onSelect: (item: LocalItem | null) => void;
}

export function ItemVinculoSelector({
  xmlDescricao,
  xmlCodigo,
  xmlNcm,
  xmlEan,
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
          // Mapear para o tipo LocalItem (compatibilidade)
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

  // Filtrar itens baseado na busca
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

  // Sugestões automáticas (match por EAN ou NCM)
  const sugestoes = useMemo(() => {
    const matches: LocalItem[] = [];

    // Match por EAN (mais preciso)
    if (xmlEan && xmlEan !== "SEM GTIN") {
      const byEan = itens.find((i) => i.ean === xmlEan);
      if (byEan) matches.push(byEan);
    }

    // Match por NCM + descrição similar
    if (xmlNcm) {
      const byNcm = itens.filter(
        (i) => i.ncm === xmlNcm && !matches.includes(i)
      );
      matches.push(...byNcm.slice(0, 3));
    }

    // Match por descrição similar (fuzzy simples)
    if (matches.length === 0 && xmlDescricao) {
      const palavras = xmlDescricao.toLowerCase().split(/\s+/).filter(p => p.length > 3);
      const byDesc = itens.filter(i => {
        const desc = i.descricao_interna.toLowerCase();
        return palavras.some(p => desc.includes(p));
      });
      matches.push(...byDesc.slice(0, 3));
    }

    return matches;
  }, [itens, xmlEan, xmlNcm, xmlDescricao]);

  const handleSelect = (item: LocalItem) => {
    onSelect(item);
    setOpen(false);
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
                  {/* Sugestões automáticas */}
                  {sugestoes.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">
                        Sugestões (match automático)
                      </Label>
                      <div className="space-y-1">
                        {sugestoes.map((item) => (
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
                                SKU: {item.sku_interno} | NCM:{" "}
                                {item.ncm || "-"} | {item.tipo_item}
                              </p>
                            </div>
                            <StatusBadge variant="success" className="shrink-0">
                              {item.ean === xmlEan
                                ? "EAN"
                                : item.ncm === xmlNcm
                                ? "NCM"
                                : "Desc."}
                            </StatusBadge>
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
                      <CommandList>
                        <CommandEmpty>
                          Nenhum item encontrado. O item será criado
                          automaticamente na importação.
                        </CommandEmpty>
                        <CommandGroup>
                          <ScrollArea className="h-[250px]">
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
                          </ScrollArea>
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </div>
                </>
              )}

              {/* Opção de criar novo */}
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
