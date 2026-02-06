import { useState, useMemo } from "react";
import { Link, Unlink, Search, Plus, Package, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { LocalDb } from "@/lib/local-db";
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

  // Buscar itens cadastrados
  const itens = useMemo(() => {
    return LocalDb.getCollection<LocalItem>("itens").filter(i => i.ativo);
  }, [open]);

  // Item selecionado
  const selectedItem = useMemo(() => {
    if (!selectedItemId) return null;
    return itens.find(i => i.id === selectedItemId) || null;
  }, [selectedItemId, itens]);

  // Filtrar itens baseado na busca
  const filteredItens = useMemo(() => {
    if (!search) return itens;
    const searchLower = search.toLowerCase();
    return itens.filter(
      i =>
        i.descricao_interna.toLowerCase().includes(searchLower) ||
        i.sku_interno.toLowerCase().includes(searchLower) ||
        i.ncm?.includes(search) ||
        i.ean?.includes(search)
    );
  }, [itens, search]);

  // Sugestões automáticas (match por EAN ou NCM)
  const sugestoes = useMemo(() => {
    const matches: LocalItem[] = [];
    
    // Match por EAN (mais preciso)
    if (xmlEan && xmlEan !== "SEM GTIN") {
      const byEan = itens.find(i => i.ean === xmlEan);
      if (byEan) matches.push(byEan);
    }
    
    // Match por NCM + descrição similar
    if (xmlNcm) {
      const byNcm = itens.filter(i => i.ncm === xmlNcm && !matches.includes(i));
      matches.push(...byNcm.slice(0, 3));
    }
    
    return matches;
  }, [itens, xmlEan, xmlNcm]);

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
                  <p className="text-sm font-medium truncate">{selectedItem.descricao_interna}</p>
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
                <span className="text-muted-foreground">Vincular a item existente...</span>
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
                  {xmlEan && xmlEan !== "SEM GTIN" && <span>EAN: {xmlEan}</span>}
                </div>
              </div>

              <Separator />

              {/* Sugestões automáticas */}
              {sugestoes.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Sugestões (match automático)</Label>
                  <div className="space-y-1">
                    {sugestoes.map(item => (
                      <button
                        key={item.id}
                        onClick={() => handleSelect(item)}
                        className="w-full p-2 border rounded-lg text-left hover:bg-accent transition-colors flex items-center gap-2"
                      >
                        <Package className="h-4 w-4 text-primary shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.descricao_interna}</p>
                          <p className="text-xs text-muted-foreground">
                            SKU: {item.sku_interno} | NCM: {item.ncm || "-"} | {item.tipo_item}
                          </p>
                        </div>
                        <StatusBadge variant="success" className="shrink-0">
                          {item.ean === xmlEan ? "EAN" : "NCM"}
                        </StatusBadge>
                      </button>
                    ))}
                  </div>
                  <Separator />
                </div>
              )}

              {/* Busca manual */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Buscar no cadastro</Label>
                <Command className="rounded-lg border">
                  <CommandInput
                    placeholder="Buscar por descrição, SKU, NCM, EAN..."
                    value={search}
                    onValueChange={setSearch}
                  />
                  <CommandList>
                    <CommandEmpty>Nenhum item encontrado.</CommandEmpty>
                    <CommandGroup>
                      <ScrollArea className="h-[250px]">
                        {filteredItens.map(item => (
                          <CommandItem
                            key={item.id}
                            value={item.id}
                            onSelect={() => handleSelect(item)}
                            className="flex items-center gap-2 cursor-pointer"
                          >
                            <Package className="h-4 w-4 text-muted-foreground" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{item.descricao_interna}</p>
                              <p className="text-xs text-muted-foreground">
                                SKU: {item.sku_interno} | NCM: {item.ncm || "-"} | {item.tipo_item}
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

              {/* Opção de criar novo */}
              <Separator />
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Não encontrou? O item será criado automaticamente na importação.
                </p>
                <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
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
