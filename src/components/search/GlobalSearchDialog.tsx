import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import {
  Users, Package, Factory, Boxes, FileText, Settings, BarChart3, Search,
  Building2, ShoppingCart, Wallet, Bell
} from "lucide-react";

interface SearchResult {
  id: string;
  label: string;
  description?: string;
  icon: React.ElementType;
  href: string;
  group: string;
}

const staticPages: SearchResult[] = [
  { id: "home", label: "Dashboard", description: "Página inicial", icon: BarChart3, href: "/", group: "Páginas" },
  { id: "entidades", label: "Entidades", description: "Fornecedores, clientes, parceiros", icon: Users, href: "/cadastros/entidades", group: "Páginas" },
  { id: "itens", label: "Itens / Produtos", description: "Matérias primas e produtos", icon: Package, href: "/cadastros/itens", group: "Páginas" },
  { id: "lotes", label: "Lotes", description: "Controle de estoque por lote", icon: Boxes, href: "/estoque/lotes", group: "Páginas" },
  { id: "formulas", label: "Fórmulas", description: "Formulador industrial", icon: Factory, href: "/producao/formulas", group: "Páginas" },
  { id: "ordens", label: "Ordens de Produção", description: "OPs industriais", icon: Factory, href: "/producao/ordens", group: "Páginas" },
  { id: "nfe", label: "Importar NF-e", description: "Upload de XML", icon: FileText, href: "/compras/nfe-import", group: "Páginas" },
  { id: "notas-entrada", label: "Notas de Entrada", description: "Gestão de notas fiscais", icon: ShoppingCart, href: "/compras/notas-entrada", group: "Páginas" },
  { id: "pagar", label: "Contas a Pagar", description: "Obrigações financeiras", icon: Wallet, href: "/financeiro/contas-pagar", group: "Páginas" },
  { id: "receber", label: "Contas a Receber", description: "Recebíveis", icon: Wallet, href: "/financeiro/receber", group: "Páginas" },
  { id: "relatorios", label: "Relatórios", description: "Análises e indicadores", icon: BarChart3, href: "/relatorios", group: "Páginas" },
  { id: "notificacoes", label: "Notificações", description: "Central de avisos", icon: Bell, href: "/notificacoes", group: "Páginas" },
  { id: "empresa", label: "Configurações Empresa", description: "Dados fiscais e NF-e", icon: Building2, href: "/settings/company", group: "Páginas" },
  { id: "settings", label: "Configurações Gerais", description: "Administração do sistema", icon: Settings, href: "/settings/empresa", group: "Páginas" },
];

export function GlobalSearchDialog() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [dbResults, setDbResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const navigate = useNavigate();

  // Ctrl+K listener
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Search database
  const searchDb = useCallback(async (q: string) => {
    if (q.length < 2) { setDbResults([]); return; }
    setSearching(true);
    try {
      const search = `%${q}%`;
      const [entidades, itens, formulas, lotes] = await Promise.all([
        supabase.from("entidades").select("id, razao_social, documento, nome_fantasia").ilike("razao_social", search).limit(5),
        supabase.from("itens").select("id, descricao_interna, sku_interno").ilike("descricao_interna", search).limit(5),
        supabase.from("formulas").select("id, nome_formula, codigo_formula").ilike("nome_formula", search).limit(5),
        supabase.from("estoque_lotes").select("id, numero_lote, item_id").ilike("numero_lote", search).limit(5),
      ]);

      const results: SearchResult[] = [];
      entidades.data?.forEach((e) => results.push({
        id: `ent-${e.id}`, label: e.razao_social, description: e.documento,
        icon: Users, href: `/cadastros/entidades/${e.id}`, group: "Entidades"
      }));
      itens.data?.forEach((i) => results.push({
        id: `item-${i.id}`, label: i.descricao_interna, description: i.sku_interno || undefined,
        icon: Package, href: `/cadastros/itens/${i.id}`, group: "Itens"
      }));
      formulas.data?.forEach((f) => results.push({
        id: `form-${f.id}`, label: f.nome_formula, description: f.codigo_formula,
        icon: Factory, href: `/producao/formulas/${f.id}`, group: "Fórmulas"
      }));
      lotes.data?.forEach((l) => results.push({
        id: `lote-${l.id}`, label: l.numero_lote,
        icon: Boxes, href: `/estoque/lotes/${l.id}`, group: "Lotes"
      }));
      setDbResults(results);
    } catch { setDbResults([]); }
    setSearching(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => searchDb(query), 300);
    return () => clearTimeout(timer);
  }, [query, searchDb]);

  const filteredPages = useMemo(() => {
    if (!query) return staticPages;
    const lower = query.toLowerCase();
    return staticPages.filter(
      (p) => p.label.toLowerCase().includes(lower) || p.description?.toLowerCase().includes(lower)
    );
  }, [query]);

  const select = (result: SearchResult) => {
    setOpen(false);
    setQuery("");
    navigate(result.href);
  };

  // Group db results
  const groups = useMemo(() => {
    const map = new Map<string, SearchResult[]>();
    dbResults.forEach((r) => {
      const arr = map.get(r.group) || [];
      arr.push(r);
      map.set(r.group, arr);
    });
    return map;
  }, [dbResults]);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Buscar páginas, entidades, itens, fórmulas, lotes..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {searching ? "Buscando..." : "Nenhum resultado encontrado."}
        </CommandEmpty>

        {filteredPages.length > 0 && (
          <CommandGroup heading="Páginas">
            {filteredPages.map((p) => (
              <CommandItem key={p.id} onSelect={() => select(p)} className="gap-3">
                <p.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm">{p.label}</span>
                  {p.description && (
                    <span className="text-xs text-muted-foreground ml-2">{p.description}</span>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {Array.from(groups.entries()).map(([group, items]) => (
          <CommandGroup key={group} heading={group}>
            {items.map((r) => (
              <CommandItem key={r.id} onSelect={() => select(r)} className="gap-3">
                <r.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm">{r.label}</span>
                  {r.description && (
                    <span className="text-xs text-muted-foreground ml-2">{r.description}</span>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
