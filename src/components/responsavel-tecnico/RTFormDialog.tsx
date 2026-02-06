import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useResponsavelTecnicoCRUD } from "@/hooks/use-responsaveis-tecnicos";
import { useUploadFile } from "@/hooks/use-files";
import { CONSELHOS, UFS_BRASIL, type ResponsavelTecnico, type TipoConselho } from "@/types/responsavel-tecnico";
import { Loader2, Upload, FileText } from "lucide-react";

const rtSchema = z.object({
  nome_completo: z.string().min(5, "Nome deve ter pelo menos 5 caracteres"),
  cpf: z.string().min(11, "CPF inválido").max(14),
  email: z.string().email("E-mail inválido"),
  telefone: z.string().optional(),
  tipo_conselho: z.enum(['CRN', 'CRQ', 'CRF']),
  numero_registro: z.string().min(3, "Número de registro inválido"),
  uf_conselho: z.string().length(2, "Selecione a UF"),
  validade_registro: z.string().min(1, "Informe a validade do registro"),
});

type RTFormData = z.infer<typeof rtSchema>;

interface RTFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rtParaEditar?: ResponsavelTecnico | null;
}

export function RTFormDialog({ open, onOpenChange, rtParaEditar }: RTFormDialogProps) {
  const { createRT, updateRT } = useResponsavelTecnicoCRUD();
  const uploadFile = useUploadFile();

  const form = useForm<RTFormData>({
    resolver: zodResolver(rtSchema),
    defaultValues: {
      nome_completo: "",
      cpf: "",
      email: "",
      telefone: "",
      tipo_conselho: "CRQ",
      numero_registro: "",
      uf_conselho: "SP",
      validade_registro: "",
    },
  });

  useEffect(() => {
    if (rtParaEditar) {
      form.reset({
        nome_completo: rtParaEditar.nome_completo,
        cpf: rtParaEditar.cpf,
        email: rtParaEditar.email,
        telefone: rtParaEditar.telefone || "",
        tipo_conselho: rtParaEditar.tipo_conselho,
        numero_registro: rtParaEditar.numero_registro,
        uf_conselho: rtParaEditar.uf_conselho,
        validade_registro: rtParaEditar.validade_registro,
      });
    } else {
      form.reset({
        nome_completo: "",
        cpf: "",
        email: "",
        telefone: "",
        tipo_conselho: "CRQ",
        numero_registro: "",
        uf_conselho: "SP",
        validade_registro: "",
      });
    }
  }, [rtParaEditar, form]);

  const onSubmit = async (data: RTFormData) => {
    try {
      if (rtParaEditar) {
        await updateRT.mutateAsync({
          id: rtParaEditar.id,
          ...data,
        });
      } else {
        await createRT.mutateAsync({
          ...data,
          status: 'ATIVO',
        } as any);
      }
      onOpenChange(false);
    } catch (error) {
      // Erro já tratado pelo hook
    }
  };

  const isLoading = createRT.isPending || updateRT.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {rtParaEditar ? "Editar Responsável Técnico" : "Novo Responsável Técnico"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Dados Pessoais */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Dados Pessoais
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="nome_completo"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Nome Completo *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Nome completo do profissional" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="cpf"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CPF *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="000.000.000-00" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="telefone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="(00) 00000-0000" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>E-mail *</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" placeholder="email@exemplo.com" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Conselho Profissional */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Conselho Profissional
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="tipo_conselho"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Conselho *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(CONSELHOS).map(([key, value]) => (
                            <SelectItem key={key} value={key}>
                              <span className="font-medium">{value.nome}</span>
                              <span className="text-xs text-muted-foreground ml-2">
                                ({value.descricao})
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="numero_registro"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número de Registro *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="00000" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="uf_conselho"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>UF *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {UFS_BRASIL.map((uf) => (
                            <SelectItem key={uf} value={uf}>
                              {uf}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="validade_registro"
                  render={({ field }) => (
                    <FormItem className="col-span-3">
                      <FormLabel>Validade do Registro *</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Upload de Documento */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Documento Comprobatório
              </h3>
              <div className="border-2 border-dashed rounded-lg p-6 text-center">
                <FileText className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground mb-2">
                  Arraste ou clique para enviar a carteira profissional ou certidão do conselho
                </p>
                <p className="text-xs text-muted-foreground">
                  PDF ou JPG até 5MB
                </p>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="hidden"
                  id="documento-rt"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      await uploadFile.mutateAsync({ file, sensivel: true });
                    }
                  }}
                />
                <Button 
                  type="button" 
                  variant="outline" 
                  className="mt-3"
                  onClick={() => document.getElementById('documento-rt')?.click()}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Selecionar Arquivo
                </Button>
              </div>
            </div>

            {/* Botões */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {rtParaEditar ? "Salvar Alterações" : "Cadastrar RT"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
