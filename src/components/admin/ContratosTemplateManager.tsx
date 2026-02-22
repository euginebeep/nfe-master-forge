import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  FileText, Plus, Pencil, Trash2, Eye, Copy, Info, Image
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CONTRATO_INDUSTRIALIZACAO_TEMPLATE, TAGS_DISPONIVEIS } from "@/lib/contrato-template";

const TIPOS_CONTRATO = [
  { value: "INDUSTRIALIZACAO", label: "Industrialização por Encomenda" },
  { value: "PRESTACAO_SERVICO", label: "Prestação de Serviço" },
  { value: "FORNECIMENTO", label: "Fornecimento" },
  { value: "DISTRIBUICAO", label: "Distribuição" },
  { value: "CONFIDENCIALIDADE", label: "Confidencialidade (NDA)" },
  { value: "OUTRO", label: "Outro" },
];

export function ContratosTemplateManager() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tagsDialogOpen, setTagsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    nome: "",
    tipo: "INDUSTRIALIZACAO",
    descricao: "",
    logo_url: "",
    texto_template: "",
  });

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["contratos-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contratos_templates")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const upsertMutation = useMutation({
    mutationFn: async (template: typeof form & { id?: string }) => {
      if (template.id) {
        const { error } = await supabase
          .from("contratos_templates")
          .update({
            nome: template.nome,
            tipo: template.tipo,
            descricao: template.descricao,
            logo_url: template.logo_url,
            texto_template: template.texto_template,
            updated_at: new Date().toISOString(),
          } as any)
          .eq("id", template.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("contratos_templates")
          .insert({
            nome: template.nome,
            tipo: template.tipo,
            descricao: template.descricao,
            logo_url: template.logo_url,
            texto_template: template.texto_template,
          } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contratos-templates"] });
      toast.success(editingId ? "Template atualizado!" : "Template criado!");
      resetForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contratos_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contratos-templates"] });
      toast.success("Template excluído!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const resetForm = () => {
    setForm({ nome: "", tipo: "INDUSTRIALIZACAO", descricao: "", logo_url: "", texto_template: "" });
    setEditingId(null);
    setDialogOpen(false);
  };

  const handleEdit = (t: any) => {
    setForm({
      nome: t.nome,
      tipo: t.tipo,
      descricao: t.descricao || "",
      logo_url: t.logo_url || "",
      texto_template: t.texto_template,
    });
    setEditingId(t.id);
    setDialogOpen(true);
  };

  const handleNew = () => {
    resetForm();
    setDialogOpen(true);
  };

  const handleUsarModelo = () => {
    setForm((prev) => ({
      ...prev,
      nome: "Contrato de Industrialização por Encomenda",
      tipo: "INDUSTRIALIZACAO",
      descricao: "Contrato padrão de industrialização por encomenda conforme modelo legal completo (14 cláusulas + Pedido de Compra Anexo)",
      texto_template: CONTRATO_INDUSTRIALIZACAO_TEMPLATE,
    }));
    toast.success("Modelo carregado! Revise as tags e salve.");
  };

  const handleSave = () => {
    if (!form.nome || !form.texto_template) {
      toast.error("Nome e texto do template são obrigatórios");
      return;
    }
    upsertMutation.mutate({ ...form, id: editingId || undefined });
  };

  const inserirTag = (tag: string) => {
    setForm((prev) => ({
      ...prev,
      texto_template: prev.texto_template + `{{${tag}}}`,
    }));
  };

  return (
    <>
      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle>Templates de Contratos</CardTitle>
                <CardDescription>
                  Gerencie modelos de contrato com tags dinâmicas. A saída será sempre em PDF profissional.
                </CardDescription>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setTagsDialogOpen(true)}>
                <Info className="h-4 w-4 mr-1" />
                Ver Tags
              </Button>
              <Button size="sm" onClick={handleNew}>
                <Plus className="h-4 w-4 mr-1" />
                Novo Template
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : templates.length === 0 ? (
            <div className="text-center py-8 space-y-3">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Nenhum template cadastrado</p>
              <Button size="sm" onClick={handleNew}>Criar primeiro template</Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Logo</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((t: any) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.nome}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {TIPOS_CONTRATO.find((tc) => tc.value === t.tipo)?.label || t.tipo}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {t.logo_url ? (
                        <img src={t.logo_url} alt="Logo" className="h-8 w-auto rounded" />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(t.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => handleEdit(t)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => {
                            if (confirm("Excluir este template?")) deleteMutation.mutate(t.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Edição */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) resetForm(); else setDialogOpen(o); }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Template" : "Novo Template de Contrato"}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome do Template *</Label>
              <Input
                value={form.nome}
                onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))}
                placeholder="Ex: Contrato de Industrialização"
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo de Contrato</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm((p) => ({ ...p, tipo: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_CONTRATO.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Input
              value={form.descricao}
              onChange={(e) => setForm((p) => ({ ...p, descricao: e.target.value }))}
              placeholder="Breve descrição do uso deste template"
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <Image className="h-4 w-4" />
              URL da Logo (cabeçalho do contrato)
            </Label>
            <Input
              value={form.logo_url}
              onChange={(e) => setForm((p) => ({ ...p, logo_url: e.target.value }))}
              placeholder="https://seusite.com/logo.png (ou deixe vazio para usar a logo da empresa)"
            />
            {form.logo_url && (
              <img src={form.logo_url} alt="Preview logo" className="h-12 w-auto rounded border p-1" />
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Texto do Contrato (com tags) *</Label>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={handleUsarModelo}>
                  <Copy className="h-3 w-3 mr-1" />
                  Carregar Modelo Padrão
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setTagsDialogOpen(true)}>
                  <Info className="h-3 w-3 mr-1" />
                  Tags
                </Button>
              </div>
            </div>
            <Textarea
              value={form.texto_template}
              onChange={(e) => setForm((p) => ({ ...p, texto_template: e.target.value }))}
              rows={20}
              className="font-mono text-xs"
              placeholder="Cole ou digite o texto do contrato aqui. Use {{TAG}} para campos dinâmicos."
            />
            <p className="text-xs text-muted-foreground">
              Use <code className="bg-muted px-1 rounded">{`{{NOME_TAG}}`}</code> para inserir dados dinâmicos. Clique em "Ver Tags" para ver todas disponíveis.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>Cancelar</Button>
            <Button onClick={handleSave} disabled={upsertMutation.isPending}>
              {editingId ? "Salvar Alterações" : "Criar Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Tags */}
      <Dialog open={tagsDialogOpen} onOpenChange={setTagsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Tags Dinâmicas Disponíveis</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-4">
            Use essas tags no texto do template. Elas serão substituídas automaticamente pelos dados reais ao gerar o contrato.
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tag</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Exemplo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {TAGS_DISPONIVEIS.map((tag) => (
                <TableRow key={tag.tag}>
                  <TableCell>
                    <code className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs font-bold">
                      {`{{${tag.tag}}}`}
                    </code>
                  </TableCell>
                  <TableCell className="text-sm">{tag.descricao}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{tag.exemplo}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>
    </>
  );
}
