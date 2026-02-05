import { useState } from "react";
import { useForm } from "react-hook-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useCreateEntidade, LocalEntidade } from "@/hooks/use-local-entidades";

interface EntidadeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialPapel?: string;
  onSuccess?: () => void;
}

const PAPEIS = [
  { value: "FORNECEDOR", label: "Fornecedor" },
  { value: "CLIENTE", label: "Cliente" },
  { value: "TRANSPORTADORA", label: "Transportadora" },
  { value: "AFILIADO", label: "Afiliado" },
  { value: "VENDEDOR", label: "Vendedor" },
  { value: "OUTRO", label: "Outro" },
];

export function EntidadeFormDialog({ open, onOpenChange, initialPapel, onSuccess }: EntidadeFormDialogProps) {
  const { create } = useCreateEntidade();
  const [selectedPapeis, setSelectedPapeis] = useState<string[]>(initialPapel ? [initialPapel] : []);
  
  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    defaultValues: {
      tipo_pessoa: "PJ",
      documento: "",
      razao_social: "",
      nome_fantasia: "",
      ie: "",
      im: "",
      cnae: "",
      crt: "",
      status: "ATIVO",
      classificacao: "REGULAR",
      site: "",
      observacoes: "",
    },
  });

  const onSubmit = (data: any) => {
    const entidade = create({
      ...data,
      papeis: selectedPapeis,
      tags: [],
    } as Omit<LocalEntidade, 'id'>, initialPapel);

    if (entidade) {
      reset();
      setSelectedPapeis(initialPapel ? [initialPapel] : []);
      onSuccess?.();
    }
  };

  const togglePapel = (papel: string) => {
    setSelectedPapeis(prev => 
      prev.includes(papel) 
        ? prev.filter(p => p !== papel)
        : [...prev, papel]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {initialPapel === "FORNECEDOR" && "Novo Fornecedor"}
            {initialPapel === "CLIENTE" && "Novo Cliente"}
            {initialPapel === "TRANSPORTADORA" && "Nova Transportadora"}
            {!initialPapel && "Nova Entidade"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Tipo Pessoa */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo Pessoa</Label>
              <Select defaultValue="PJ" onValueChange={(v) => register("tipo_pessoa").onChange({ target: { value: v } })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PJ">Pessoa Juridica</SelectItem>
                  <SelectItem value="PF">Pessoa Fisica</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="documento">CNPJ/CPF *</Label>
              <Input
                id="documento"
                {...register("documento", { required: "Documento e obrigatorio" })}
                placeholder="00.000.000/0000-00"
              />
              {errors.documento && (
                <p className="text-sm text-destructive">{errors.documento.message}</p>
              )}
            </div>
          </div>

          {/* Razao Social e Nome Fantasia */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="razao_social">Razao Social *</Label>
              <Input
                id="razao_social"
                {...register("razao_social", { required: "Razao social e obrigatoria" })}
              />
              {errors.razao_social && (
                <p className="text-sm text-destructive">{errors.razao_social.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="nome_fantasia">Nome Fantasia</Label>
              <Input id="nome_fantasia" {...register("nome_fantasia")} />
            </div>
          </div>

          {/* IE, IM, CNAE */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ie">Inscricao Estadual</Label>
              <Input id="ie" {...register("ie")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="im">Inscricao Municipal</Label>
              <Input id="im" {...register("im")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cnae">CNAE</Label>
              <Input id="cnae" {...register("cnae")} />
            </div>
          </div>

          {/* Status e Classificacao */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select defaultValue="ATIVO" onValueChange={(v) => register("status").onChange({ target: { value: v } })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ATIVO">Ativo</SelectItem>
                  <SelectItem value="BLOQUEADO">Bloqueado</SelectItem>
                  <SelectItem value="HOMOLOGACAO">Homologacao</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Classificacao</Label>
              <Select defaultValue="REGULAR" onValueChange={(v) => register("classificacao").onChange({ target: { value: v } })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="VIP">VIP</SelectItem>
                  <SelectItem value="REGULAR">Regular</SelectItem>
                  <SelectItem value="PROBLEMA">Problema</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Papeis */}
          <div className="space-y-2">
            <Label>Papeis</Label>
            <div className="flex flex-wrap gap-4">
              {PAPEIS.map((papel) => (
                <div key={papel.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`papel-${papel.value}`}
                    checked={selectedPapeis.includes(papel.value)}
                    onCheckedChange={() => togglePapel(papel.value)}
                  />
                  <label htmlFor={`papel-${papel.value}`} className="text-sm cursor-pointer">
                    {papel.label}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Site */}
          <div className="space-y-2">
            <Label htmlFor="site">Site</Label>
            <Input id="site" {...register("site")} placeholder="https://" />
          </div>

          {/* Observacoes */}
          <div className="space-y-2">
            <Label htmlFor="observacoes">Observacoes</Label>
            <Textarea id="observacoes" {...register("observacoes")} rows={3} />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit">Salvar</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
