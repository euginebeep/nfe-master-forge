// ============================================================
// SELETOR DE ITENS DE EMBALAGEM - Busca do Cadastro de Itens
// ============================================================

import { useState, useEffect, useMemo } from "react";
import { Search, Package, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { LocalDb } from "@/lib/local-db";
import type { TipoItem } from "@/types/erp";

export interface ItemEmbalagem {
  id: string;
  sku_interno?: string | null;
  descricao_interna: string;
  tipo_item: string;
  source?: "supabase" | "local";
}

interface EmbalagemItemSelectorProps {
  label: string;
  tiposFiltro: TipoItem[];
  value?: string; // id do item selecionado
  selectedItemName?: string; // nome para exibir quando já selecionado
  onSelect: (item: ItemEmbalagem | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function EmbalagemItemSelector({
  label,
  tiposFiltro,
  value,
  selectedItemName,
  onSelect,
  placeholder = "Buscar item...",
  disabled = false,
}: EmbalagemItemSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [itens, setItens] = useState<ItemEmbalagem[]>([]);
  const [loading, setLoading] = useState(false);

  // Buscar itens quando o popover abre ou o search muda
  useEffect(() => {
    if (!open) return;
    
    const fetchItens = async () => {
      setLoading(true);
      try {
        // Buscar do Supabase
        let query = supabase
          .from("itens")
          .select("id, sku_interno, descricao_interna, tipo_item")
          .eq("ativo", true)
          .in("tipo_item", tiposFiltro)
          .order("descricao_interna");
        
        if (search.length >= 2) {
          query = query.ilike("descricao_interna", `%${search}%`);
        }

        const { data: supabaseData } = await query.limit(50);

        // Buscar do LocalDb
        const searchLower = search.toLowerCase();
        const localItens = LocalDb.query<any>("itens", (item) => {
          if (!item.ativo) return false;
          if (!tiposFiltro.includes(item.tipo_item)) return false;
          if (search.length >= 2) {
            return item.descricao_interna?.toLowerCase().includes(searchLower);
          }
          return true;
        }).slice(0, 50);

        // Combinar resultados
        const supabaseItens: ItemEmbalagem[] = (supabaseData || []).map((i) => ({
          id: i.id,
          sku_interno: i.sku_interno,
          descricao_interna: i.descricao_interna,
          tipo_item: i.tipo_item,
          source: "supabase" as const,
        }));

        const localMapped: ItemEmbalagem[] = localItens.map((i: any) => ({
          id: i.id,
          sku_interno: i.sku_interno,
          descricao_interna: i.descricao_interna,
          tipo_item: i.tipo_item,
          source: "local" as const,
        }));

        // Deduplicar por id
        const combined: ItemEmbalagem[] = [...supabaseItens];
        localMapped.forEach((local) => {
          if (!combined.find((s) => s.id === local.id)) {
            combined.push(local);
          }
        });

        setItens(combined);
      } catch (error) {
        console.error("Erro ao buscar itens de embalagem:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchItens();
  }, [open, search, tiposFiltro]);

  const handleSelect = (item: ItemEmbalagem) => {
    onSelect(item);
    setOpen(false);
    setSearch("");
  };

  const handleClear = () => {
    onSelect(null);
    setSearch("");
  };

  const displayValue = selectedItemName || (value ? "Item selecionado" : "");

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full justify-between font-normal",
              !value && "text-muted-foreground"
            )}
            disabled={disabled}
          >
            <span className="truncate">
              {displayValue || placeholder}
            </span>
            <Package className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={placeholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                autoFocus
              />
            </div>
            <div className="flex gap-1 mt-2 flex-wrap">
              {tiposFiltro.map((tipo) => (
                <Badge key={tipo} variant="secondary" className="text-xs">
                  {tipo.replace(/_/g, " ")}
                </Badge>
              ))}
            </div>
          </div>

          <ScrollArea className="h-[250px]">
            {loading ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Carregando...
              </div>
            ) : itens.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                {search.length >= 2
                  ? "Nenhum item encontrado"
                  : "Digite ao menos 2 caracteres para buscar"}
              </div>
            ) : (
              <div className="p-1">
                {value && (
                  <div
                    className="px-3 py-2 text-sm cursor-pointer hover:bg-destructive/10 text-destructive rounded-md mb-1"
                    onClick={handleClear}
                  >
                    Limpar seleção
                  </div>
                )}
                {itens.map((item) => (
                  <div
                    key={item.id}
                    className={cn(
                      "px-3 py-2 cursor-pointer rounded-md hover:bg-muted",
                      value === item.id && "bg-primary/10"
                    )}
                    onClick={() => handleSelect(item)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {value === item.id && (
                          <Check className="h-4 w-4 text-primary" />
                        )}
                        <span className="text-sm font-medium truncate">
                          {item.descricao_interna}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {item.tipo_item}
                        </Badge>
                        {item.source === "local" && (
                          <Badge variant="secondary" className="text-xs">
                            Local
                          </Badge>
                        )}
                      </div>
                    </div>
                    {item.sku_interno && (
                      <div className="text-xs text-muted-foreground mt-0.5 pl-6">
                        SKU: {item.sku_interno}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>
    </div>
  );
}
