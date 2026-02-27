// Modal de cadastro rápido de cliente - usado dentro do wizard OP
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Building2, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { LocalDb } from "@/lib/local-db";
import type { LocalEntidade } from "@/hooks/use-local-entidades";

interface QuickClienteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClienteCreated: (cliente: { id: string; razao_social: string; nome_fantasia?: string; documento: string }) => void;
  initialSearch?: string;
}

const PAPEIS = [
  { value: "CLIENTE", label: "Cliente" },
  { value: "FORNECEDOR", label: "Fornecedor" },
  { value: "TRANSPORTADORA", label: "Transportadora" },
];

export function QuickClienteModal({
  open,
  onOpenChange,
  onClienteCreated,
  initialSearch,
}: QuickClienteModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPapeis, setSelectedPapeis] = useState<string[]>(["CLIENTE"]);
  const [saveToBackend, setSaveToBackend] = useState(true);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm({
    defaultValues: {
      tipo_pessoa: "PJ",
      documento: "",
      razao_social: initialSearch || "",
      nome_fantasia: "",
      ie: "",
      status: "ATIVO",
      classificacao: "REGULAR",
    },
  });

  // Reset form when opening with new search
  useState(() => {
    if (open && initialSearch) {
      setValue("razao_social", initialSearch);
    }
  });

  const togglePapel = (papel: string) => {
    setSelectedPapeis((prev) =>
      prev.includes(papel) ? prev.filter((p) => p !== papel) : [...prev, papel]
    );
  };

  const onSubmit = async (data: any) => {
    if (selectedPapeis.length === 0) {
      toast.error("Selecione pelo menos um papel");
      return;
    }

    setIsLoading(true);
    try {
      const documentoLimpo = data.documento.replace(/\D/g, "");

      if (saveToBackend) {
        // Tentar salvar no Supabase
        const { data: existing } = await supabase
          .from("entidades")
          .select("id")
          .eq("documento", documentoLimpo)
          .maybeSingle();

        if (existing) {
          toast.error("Já existe uma entidade com este documento");
          setIsLoading(false);
          return;
        }

        // Inserir entidade
        const { data: entidade, error } = await supabase
          .from("entidades")
          .insert({
            tipo_pessoa: data.tipo_pessoa,
            documento: documentoLimpo,
            razao_social: data.razao_social,
            nome_fantasia: data.nome_fantasia || null,
            ie: data.ie || null,
            status: data.status,
            classificacao: data.classificacao,
          })
          .select()
          .single();

        if (error) throw error;

        // Inserir papéis
        if (selectedPapeis.length > 0 && entidade) {
          await supabase.from("entidade_papeis").insert(
            selectedPapeis.map((papel) => ({
              entidade_id: entidade.id,
              papel,
            }))
          );
        }

        toast.success("Cliente cadastrado com sucesso!");
        onClienteCreated({
          id: entidade.id,
          razao_social: entidade.razao_social,
          nome_fantasia: entidade.nome_fantasia || undefined,
          documento: entidade.documento,
        });
      } else {
        // Salvar localmente
        const existingLocal = LocalDb.query<LocalEntidade>(
          "entidades",
          (e) => e.documento === documentoLimpo
        );
        if (existingLocal.length > 0) {
          toast.error("Já existe uma entidade com este documento");
          setIsLoading(false);
          return;
        }

        const entidade = LocalDb.insert<LocalEntidade>("entidades", {
          tipo_pessoa: data.tipo_pessoa,
          documento: documentoLimpo,
          razao_social: data.razao_social,
          nome_fantasia: data.nome_fantasia || undefined,
          ie: data.ie || undefined,
          status: data.status,
          classificacao: data.classificacao,
          papeis: selectedPapeis as any[],
          tags: [],
        });

        toast.success("Cliente cadastrado localmente!");
        onClienteCreated({
          id: entidade.id,
          razao_social: entidade.razao_social,
          nome_fantasia: entidade.nome_fantasia,
          documento: entidade.documento,
        });
      }

      reset();
      setSelectedPapeis(["CLIENTE"]);
      onOpenChange(false);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error("Erro ao cadastrar cliente:", error);
      toast.error("Erro ao cadastrar: " + msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Cadastro Rápido de Cliente
          </DialogTitle>
          <DialogDescription>
            Cadastre um novo cliente sem sair do wizard da OP
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Tipo Pessoa e Documento */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                defaultValue="PJ"
                onValueChange={(v) => setValue("tipo_pessoa", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PJ">Pessoa Jurídica</SelectItem>
                  <SelectItem value="PF">Pessoa Física</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="documento">CNPJ/CPF *</Label>
              <Input
                id="documento"
                {...register("documento", { required: "Documento é obrigatório" })}
                placeholder="Insira o CNPJ ou CPF"
              />
              {errors.documento && (
                <p className="text-sm text-destructive">{errors.documento.message}</p>
              )}
            </div>
          </div>

          {/* Razão Social e Nome Fantasia */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="razao_social">Razão Social *</Label>
              <Input
                id="razao_social"
                {...register("razao_social", { required: "Razão social é obrigatória" })}
                placeholder="Insira a razão social da empresa"
              />
              {errors.razao_social && (
                <p className="text-sm text-destructive">{errors.razao_social.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="nome_fantasia">Nome Fantasia</Label>
              <Input id="nome_fantasia" {...register("nome_fantasia")} placeholder="Insira o nome fantasia" />
            </div>
          </div>

          {/* IE */}
          <div className="space-y-2">
            <Label htmlFor="ie">Inscrição Estadual</Label>
            <Input id="ie" {...register("ie")} placeholder="Insira a inscrição estadual (opcional)" />
          </div>

          {/* Papéis */}
          <div className="space-y-2">
            <Label>Papéis</Label>
            <div className="flex flex-wrap gap-4">
              {PAPEIS.map((papel) => (
                <div key={papel.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`quick-papel-${papel.value}`}
                    checked={selectedPapeis.includes(papel.value)}
                    onCheckedChange={() => togglePapel(papel.value)}
                  />
                  <label
                    htmlFor={`quick-papel-${papel.value}`}
                    className="text-sm cursor-pointer"
                  >
                    {papel.label}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Opção de salvar no backend */}
          <div className="flex items-center space-x-2 p-3 bg-muted rounded-lg">
            <Checkbox
              id="saveToBackend"
              checked={saveToBackend}
              onCheckedChange={(checked) => setSaveToBackend(checked as boolean)}
            />
            <label htmlFor="saveToBackend" className="text-sm cursor-pointer">
              Salvar no banco de dados (recomendado)
            </label>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Cadastrar Cliente"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
