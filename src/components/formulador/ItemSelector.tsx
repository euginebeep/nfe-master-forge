// ============================================================
// SELETOR DE MATÉRIA-PRIMA DO CADASTRO DE ITENS
// Combobox com busca para selecionar itens do cadastro
// Usa hook híbrido para buscar dados do Supabase + localStorage
// ============================================================

import { useState, useMemo } from "react";
import { Check, ChevronsUpDown, Search, Package, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { useHybridItens, type HybridItem } from "@/hooks/use-hybrid-data";
import { Link } from "react-router-dom";

interface ItemSelectorProps {
  value?: string; // item_id selecionado
  onSelect: (item: HybridItem | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function ItemSelector({ 
  value, 
  onSelect, 
  placeholder = "Buscar no cadastro de itens...",
  disabled = false,
}: ItemSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Buscar TODOS os itens ativos usando hook híbrido (Supabase + localStorage)
  const { data: itens = [], isLoading } = useHybridItens({ ativo: true });

  // Filtrar itens baseado na busca
  const itensFiltrados = useMemo(() => {
    if (!search.trim()) return itens;
    const termo = search.toLowerCase();
    return itens.filter(item => 
      item.descricao_interna.toLowerCase().includes(termo) ||
      item.sku_interno?.toLowerCase().includes(termo) ||
      item.ean?.includes(termo)
    );
  }, [itens, search]);

  // Item selecionado atual
  const itemSelecionado = useMemo(() => 
    itens.find(i => i.id === value),
    [itens, value]
  );

  const handleSelect = (item: HybridItem) => {
    onSelect(item);
    setOpen(false);
    setSearch("");
  };

  const handleClear = () => {
    onSelect(null);
    setOpen(false);
    setSearch("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          {itemSelecionado ? (
            <div className="flex items-center gap-2 truncate">
              <Package className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="truncate">{itemSelecionado.descricao_interna}</span>
              {itemSelecionado.sku_interno && (
                <Badge variant="outline" className="text-xs shrink-0">
                  {itemSelecionado.sku_interno}
                </Badge>
              )}
            </div>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              placeholder="Buscar por nome, SKU ou EAN..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <CommandList>
            {isLoading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Carregando...
              </div>
            ) : itens.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-sm text-muted-foreground mb-3">
                  Nenhum item cadastrado no sistema.
                </p>
                <Link to="/cadastros/itens">
                  <Button variant="outline" size="sm" className="gap-2">
                    <ExternalLink className="h-4 w-4" />
                    Cadastrar Itens
                  </Button>
                </Link>
              </div>
            ) : itensFiltrados.length === 0 ? (
              <CommandEmpty>
                Nenhum item encontrado com "{search}".
              </CommandEmpty>
            ) : (
              <CommandGroup>
                {value && (
                  <CommandItem
                    onSelect={handleClear}
                    className="text-muted-foreground"
                  >
                    <span className="italic">Limpar seleção</span>
                  </CommandItem>
                )}
                {itensFiltrados.slice(0, 50).map((item) => (
                  <CommandItem
                    key={item.id}
                    value={item.id}
                    onSelect={() => handleSelect(item)}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Check
                        className={cn(
                          "h-4 w-4 shrink-0",
                          value === item.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{item.descricao_interna}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.tipo_item} • {item.unidade_interna} 
                          {item.sku_interno && ` • ${item.sku_interno}`}
                        </p>
                      </div>
                    </div>
                    {item.categoria_operacional && (
                      <Badge variant="secondary" className="text-xs shrink-0 ml-2">
                        {item.categoria_operacional}
                      </Badge>
                    )}
                  </CommandItem>
                ))}
                {itensFiltrados.length > 50 && (
                  <div className="py-2 px-4 text-xs text-muted-foreground text-center">
                    +{itensFiltrados.length - 50} itens. Refine a busca.
                  </div>
                )}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
