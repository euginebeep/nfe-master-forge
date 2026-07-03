// ============================================================
// CADASTRO RÁPIDO DE INSUMO (dentro do formulador)
// Fase 1: cria o insumo na hora, com sugestão de nome por IA
// (anvisa-resolve-name), e devolve o item recém-criado para
// já ficar selecionado na fórmula.
// Reutiliza a mutation canônica do cadastro (useCreateItem).
// ============================================================

import { useState, useEffect } from "react";
import { Sparkles, Loader2, Package } from "lucide-react";
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

// Enums válidos no banco (check constraint itens_tipo_item_check):
// 'MP','EMBALAGEM','ROTULO','TAMPA','POTE','SILICA','CAPSULA_VAZIA','PA','OUTRO'.
// Para insumo de fórmula o correto é MP (default do cadastro normal = matéria-prima ativa).
const UNIDADES = ["g", "mg", "kg", "un", "ml", "l"] as const;
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

  const [sugestoes, setSugestoes] = useState<string[]>([]);
  const [sugerindo, setSugerindo] = useState(false);

  // Reseta o formulário sempre que abrir com um novo termo
  useEffect(() => {
    if (open) {
      setNome(nomeInicial);
      setTipoItem("MP");
      setUnidadeInterna("g");
      setUnidadePesagem("g");
      setUnidadeDeclaracao("mg");
      setSugestoes([]);
      setSugerindo(false);
    }
  }, [open, nomeInicial]);

  const sugerirNome = async () => {
    const termo = nome.trim();
    if (!termo) return;
    setSugerindo(true);
    setSugestoes([]);
    try {
      // Mesma edge function e formato de body usados no resto do app
      // (ver src/hooks/use-anvisa-search.ts): { termo } -> { termos: [...] }
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
      // IA é só sugestão: nunca bloqueia o cadastro
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

    // Espelha os defaults do cadastro normal (ItemFormDialog): MP (matéria-prima ativa) => CRITICO.
    const criticidade = tipoItem === "MP" ? "CRITICO" : "NORMAL";

    try {
      const item = await createItem.mutateAsync({
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
      } as never);

      toast.success(`Insumo "${descricao}" cadastrado e selecionado`);
      onCreated(item as unknown as HybridItem);
      onOpenChange(false);
    } catch (err) {
      // Mensagem real do Supabase (a mutation também exibe via centralToast)
      const e = err as { message?: string; code?: string };
      toast.error("Erro ao cadastrar insumo: " + (e?.message || e?.code || "erro desconhecido"));
    }
  };

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
                placeholder="Ex: GABA"
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
                  {UNIDADES.map((u) => (
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
                  {UNIDADES.map((u) => (
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
                  {UNIDADES.map((u) => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={salvar} disabled={createItem.isPending || !nome.trim()}>
            {createItem.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Cadastrar e selecionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
