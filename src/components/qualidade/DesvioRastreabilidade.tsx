import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link2, Search, Package, Factory, Users, ShoppingCart, Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface RastreabilidadeProps {
  form: Record<string, any>;
  update: (field: string, value: any) => void;
  disabled?: boolean;
}

interface SearchResult {
  id: string;
  label: string;
  sublabel?: string;
}

const FONTES = [
  { value: "PRODUCAO", label: "Produção" },
  { value: "RECEBIMENTO", label: "Recebimento" },
  { value: "CLIENTE", label: "Reclamação de Cliente" },
  { value: "AUDITORIA", label: "Auditoria Interna" },
  { value: "ESTOQUE", label: "Estoque / Armazenagem" },
  { value: "OUTRO", label: "Outro" },
];

function useSearchField(table: string, searchFields: string[], labelField: string, sublabelField?: string, filters?: Record<string, any>) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState("");

  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    const timer = setTimeout(async () => {
      let q = supabase.from(table as any).select("*").limit(10);
      // Apply search across fields with ilike
      if (searchFields.length === 1) {
        q = q.ilike(searchFields[0], `%${query}%`);
      } else {
        q = q.or(searchFields.map(f => `${f}.ilike.%${query}%`).join(","));
      }
      if (filters) {
        Object.entries(filters).forEach(([k, v]) => {
          if (v) q = q.eq(k, v);
        });
      }
      const { data } = await q;
      if (data) {
        setResults(data.map((r: any) => ({
          id: r.id,
          label: r[labelField] || r.codigo || r.id,
          sublabel: sublabelField ? r[sublabelField] : undefined,
        })));
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, table, JSON.stringify(filters)]);

  return { query, setQuery, results, open, setOpen, selectedLabel, setSelectedLabel };
}

function SearchInput({
  label, icon: Icon, value, onSelect, onClear, table, searchFields, labelField, sublabelField, disabled, filters, placeholder,
}: {
  label: string;
  icon: React.ElementType;
  value?: string;
  onSelect: (id: string, item: SearchResult) => void;
  onClear: () => void;
  table: string;
  searchFields: string[];
  labelField: string;
  sublabelField?: string;
  disabled?: boolean;
  filters?: Record<string, any>;
  placeholder?: string;
}) {
  const { query, setQuery, results, open, setOpen, selectedLabel, setSelectedLabel } = useSearchField(table, searchFields, labelField, sublabelField, filters);

  // Load selected label on mount
  useEffect(() => {
    if (value && !selectedLabel) {
      supabase.from(table as any).select("*").eq("id", value).maybeSingle().then(({ data }) => {
        if (data) setSelectedLabel((data as any)[labelField] || (data as any).codigo || value);
      });
    }
    if (!value) setSelectedLabel("");
  }, [value]);

  if (disabled) {
    return (
      <div>
        <Label className="flex items-center gap-1.5 text-xs"><Icon className="h-3.5 w-3.5" />{label}</Label>
        <Input value={selectedLabel || (value ? "ID: " + value.slice(0, 8) : "—")} disabled className="bg-muted text-xs" />
      </div>
    );
  }

  return (
    <div className="relative">
      <Label className="flex items-center gap-1.5 text-xs"><Icon className="h-3.5 w-3.5" />{label}</Label>
      {value && selectedLabel ? (
        <div className="flex items-center gap-2 mt-1">
          <Badge variant="secondary" className="text-xs max-w-[200px] truncate">{selectedLabel}</Badge>
          <button onClick={() => { onClear(); setSelectedLabel(""); }} className="text-xs text-destructive hover:underline">×</button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => query.length >= 2 && setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 200)}
            placeholder={placeholder || `Buscar ${label.toLowerCase()}...`}
            className="pl-8 text-xs h-9"
          />
          {open && results.length > 0 && (
            <div className="absolute z-50 top-full mt-1 w-full bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto">
              {results.map(r => (
                <button
                  key={r.id}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-accent transition-colors"
                  onMouseDown={() => {
                    onSelect(r.id, r);
                    setSelectedLabel(r.label);
                    setQuery("");
                    setOpen(false);
                  }}
                >
                  <div className="font-medium truncate">{r.label}</div>
                  {r.sublabel && <div className="text-muted-foreground truncate">{r.sublabel}</div>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function DesvioRastreabilidade({ form, update, disabled }: RastreabilidadeProps) {
  const fonte = form.fonte_desvio || "PRODUCAO";
  const isRecebimento = fonte === "RECEBIMENTO";
  const isCliente = fonte === "CLIENTE";

  // Auto-fill when OP is selected
  const handleOPSelect = async (opId: string) => {
    update("op_id", opId);
    const { data: op } = await supabase
      .from("ordens_producao_industrial")
      .select("lote_produto_acabado, formula_id, formulas(produto_final_id)")
      .eq("id", opId)
      .maybeSingle();
    if (op) {
      // Try to find the lot by lote_produto_acabado
      if (op.lote_produto_acabado) {
        const { data: lote } = await supabase
          .from("estoque_lotes")
          .select("id")
          .eq("numero_lote", op.lote_produto_acabado)
          .maybeSingle();
        if (lote) update("lote_id", lote.id);
      }
      // Auto-fill product
      const formula = op.formulas as any;
      if (formula?.produto_final_id) {
        update("produto_id", formula.produto_final_id);
      }
    }
  };

  // Auto-fill when Lote is selected
  const handleLoteSelect = async (loteId: string) => {
    update("lote_id", loteId);
    const { data: lote } = await supabase
      .from("estoque_lotes")
      .select("item_id")
      .eq("id", loteId)
      .maybeSingle();
    if (lote) {
      if (lote.item_id) update("produto_id", lote.item_id);
    }
  };

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Link2 className="h-4 w-4 text-primary" />
          Dados de Rastreabilidade
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Fonte do Desvio */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">Fonte do Desvio</Label>
            <Select value={fonte} onValueChange={v => update("fonte_desvio", v)} disabled={disabled}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {FONTES.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Links inteligentes */}
        <div className="grid grid-cols-2 gap-4">
          <SearchInput
            label="Ordem de Produção (OP)"
            icon={Factory}
            value={form.op_id}
            onSelect={(id) => handleOPSelect(id)}
            onClear={() => update("op_id", null)}
            table="ordens_producao_industrial"
            searchFields={["codigo", "lote_produto_acabado"]}
            labelField="codigo"
            sublabelField="lote_produto_acabado"
            disabled={disabled}
            placeholder="Buscar por código da OP..."
          />
          <SearchInput
            label="Lote"
            icon={Package}
            value={form.lote_id}
            onSelect={(id) => handleLoteSelect(id)}
            onClear={() => update("lote_id", null)}
            table="estoque_lotes"
            searchFields={["numero_lote"]}
            labelField="numero_lote"
            disabled={disabled}
            placeholder="Buscar lote..."
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <SearchInput
            label="Produto Acabado"
            icon={Package}
            value={form.produto_id}
            onSelect={(id) => update("produto_id", id)}
            onClear={() => update("produto_id", null)}
            table="itens"
            searchFields={["descricao_interna", "sku_interno"]}
            labelField="descricao_interna"
            sublabelField="sku_interno"
            disabled={disabled}
            placeholder="Buscar produto..."
          />
          <SearchInput
            label={`Matéria-Prima / Insumo${isRecebimento ? " *" : ""}`}
            icon={Package}
            value={form.insumo_id}
            onSelect={(id) => update("insumo_id", id)}
            onClear={() => update("insumo_id", null)}
            table="itens"
            searchFields={["descricao_interna", "sku_interno"]}
            labelField="descricao_interna"
            sublabelField="sku_interno"
            disabled={disabled}
            placeholder="Buscar insumo..."
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label className={cn("text-xs", isRecebimento && "font-semibold")}>
              Lote do Fornecedor{isRecebimento ? " *" : ""}
            </Label>
            <Input
              value={form.lote_fornecedor || ""}
              onChange={e => update("lote_fornecedor", e.target.value)}
              disabled={disabled}
              className="h-9 text-xs"
              placeholder="Nº lote do fornecedor"
            />
          </div>
          <SearchInput
            label={`Fornecedor${isRecebimento ? " *" : ""}`}
            icon={Truck}
            value={form.fornecedor_id}
            onSelect={(id) => update("fornecedor_id", id)}
            onClear={() => update("fornecedor_id", null)}
            table="entidades"
            searchFields={["razao_social", "nome_fantasia"]}
            labelField="razao_social"
            sublabelField="nome_fantasia"
            disabled={disabled}
            placeholder="Buscar fornecedor..."
          />
          <SearchInput
            label={`Cliente${isCliente ? " *" : ""}`}
            icon={Users}
            value={form.cliente_id}
            onSelect={(id) => update("cliente_id", id)}
            onClear={() => update("cliente_id", null)}
            table="entidades"
            searchFields={["razao_social", "nome_fantasia"]}
            labelField="razao_social"
            sublabelField="nome_fantasia"
            disabled={disabled}
            placeholder="Buscar cliente..."
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <SearchInput
            label={`Pedido de Venda${isCliente ? " *" : ""}`}
            icon={ShoppingCart}
            value={form.pedido_venda_id}
            onSelect={(id) => update("pedido_venda_id", id)}
            onClear={() => update("pedido_venda_id", null)}
            table="pedidos_venda"
            searchFields={["codigo"]}
            labelField="codigo"
            disabled={disabled}
            placeholder="Buscar pedido..."
          />
        </div>

        {/* Indicadores visuais de campos obrigatórios */}
        {(isRecebimento || isCliente) && (
          <div className="text-xs text-muted-foreground border-t pt-2">
            * Campos marcados são obrigatórios para a fonte "{FONTES.find(f => f.value === fonte)?.label}".
          </div>
        )}
      </CardContent>
    </Card>
  );
}
