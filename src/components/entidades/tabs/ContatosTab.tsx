import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { Plus, Pencil, Trash2, Phone, Mail } from "lucide-react";
import { DEPARTAMENTO_LABELS, type Departamento, type PreferenciaContato, type EntidadeContatoExtended } from "@/types/entidades";

interface ContatosTabProps {
  contatos: EntidadeContatoExtended[];
  onAdd: (contato: Omit<EntidadeContatoExtended, 'id' | 'entidade_id' | 'created_at'>) => void;
  onUpdate: (id: string, contato: Partial<EntidadeContatoExtended>) => void;
  onDelete: (id: string) => void;
}

const emptyContato = {
  nome: '',
  departamento: 'OUTRO' as Departamento,
  cargo: '',
  telefone: '',
  whatsapp: '',
  email: '',
  preferencia_contato: 'INDIFERENTE' as PreferenciaContato,
  preferencial: false,
  aceita_whatsapp: true,
  observacoes: '',
};

export function ContatosTab({ contatos, onAdd, onUpdate, onDelete }: ContatosTabProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyContato);

  const openNew = () => {
    setEditingId(null);
    setForm(emptyContato);
    setDialogOpen(true);
  };

  const openEdit = (contato: EntidadeContatoExtended) => {
    setEditingId(contato.id);
    setForm({
      nome: contato.nome,
      departamento: contato.departamento as Departamento,
      cargo: contato.cargo || '',
      telefone: contato.telefone || '',
      whatsapp: contato.whatsapp || '',
      email: contato.email || '',
      preferencia_contato: contato.preferencia_contato as PreferenciaContato,
      preferencial: contato.preferencial,
      aceita_whatsapp: contato.aceita_whatsapp,
      observacoes: contato.observacoes || '',
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (editingId) {
      onUpdate(editingId, form);
    } else {
      onAdd(form);
    }
    setDialogOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-medium">Contatos</h3>
        <Button size="sm" onClick={openNew}>
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Contato
        </Button>
      </div>

      {contatos.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground border rounded-md">
          Nenhum contato cadastrado
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Departamento</TableHead>
              <TableHead>Cargo</TableHead>
              <TableHead>Contatos</TableHead>
              <TableHead>Principal</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contatos.map((contato) => (
              <TableRow key={contato.id}>
                <TableCell className="font-medium">{contato.nome}</TableCell>
                <TableCell>
                  <StatusBadge variant="default">
                    {DEPARTAMENTO_LABELS[contato.departamento as Departamento] || contato.departamento}
                  </StatusBadge>
                </TableCell>
                <TableCell>{contato.cargo || '-'}</TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1 text-sm">
                    {contato.whatsapp && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {contato.whatsapp}
                      </span>
                    )}
                    {contato.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" /> {contato.email}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {contato.preferencial && <StatusBadge variant="success">Principal</StatusBadge>}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(contato)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onDelete(contato.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Contato' : 'Novo Contato'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Departamento</Label>
                <Select value={form.departamento} onValueChange={(v) => setForm({ ...form, departamento: v as Departamento })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(DEPARTAMENTO_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Cargo</Label>
                <Input value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} placeholder="(00) 0000-0000" />
              </div>
              <div className="space-y-2">
                <Label>WhatsApp</Label>
                <Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="(00) 00000-0000" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} type="email" />
            </div>

            <div className="space-y-2">
              <Label>Preferência de Contato</Label>
              <Select value={form.preferencia_contato} onValueChange={(v) => setForm({ ...form, preferencia_contato: v as PreferenciaContato })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                  <SelectItem value="EMAIL">E-mail</SelectItem>
                  <SelectItem value="LIGACAO">Ligação</SelectItem>
                  <SelectItem value="INDIFERENTE">Indiferente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-6">
              <div className="flex items-center gap-2">
                <Switch checked={form.preferencial} onCheckedChange={(v) => setForm({ ...form, preferencial: v })} />
                <Label>Contato Principal</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.aceita_whatsapp} onCheckedChange={(v) => setForm({ ...form, aceita_whatsapp: v })} />
                <Label>Aceita WhatsApp</Label>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} rows={2} />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={!form.nome}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
