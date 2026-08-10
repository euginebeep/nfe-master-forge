import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { TIPO_ENDERECO_LABELS, type TipoEnderecoExtended, type EntidadeEnderecoExtended, isEstrangeiro } from "@/types/entidades";
import { CepLookupInput } from "@/components/company/CepLookupInput";
import { toast } from "sonner";

interface EnderecosTabProps {
  enderecos: EntidadeEnderecoExtended[];
  tipoPessoa?: string;
  onAdd: (endereco: Omit<EntidadeEnderecoExtended, 'id' | 'entidade_id' | 'created_at'>) => void;
  onUpdate: (id: string, endereco: Partial<EntidadeEnderecoExtended>) => void;
  onDelete: (id: string) => void;
}

const UF_OPTIONS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

const emptyEndereco = {
  tipo: 'FISCAL' as TipoEnderecoExtended,
  cep: '',
  logradouro: '',
  nro: '',
  compl: '',
  bairro: '',
  cidade: '',
  uf: '',
  pais: 'Brasil',
  cmun: '',
  cpais: '1058',
  referencia: '',
  contato_local_nome: '',
  contato_local_fone: '',
  principal: false,
};

function cmunValido(cmun?: string | null) {
  return /^[0-9]{7}$/.test(String(cmun || "").trim());
}

export function EnderecosTab({ enderecos, tipoPessoa, onAdd, onUpdate, onDelete }: EnderecosTabProps) {
  const isForeign = isEstrangeiro(tipoPessoa || 'PJ');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyEndereco);

  const openNew = () => {
    setEditingId(null);
    setForm(emptyEndereco);
    setDialogOpen(true);
  };

  const openEdit = (endereco: EntidadeEnderecoExtended) => {
    setEditingId(endereco.id);
    setForm({
      tipo: endereco.tipo as TipoEnderecoExtended,
      cep: endereco.cep || '',
      logradouro: endereco.logradouro || '',
      nro: endereco.nro || '',
      compl: endereco.compl || '',
      bairro: endereco.bairro || '',
      cidade: endereco.cidade || '',
      uf: endereco.uf || '',
      pais: endereco.pais || 'Brasil',
      cmun: endereco.cmun || '',
      cpais: endereco.cpais || '1058',
      referencia: endereco.referencia || '',
      contato_local_nome: endereco.contato_local_nome || '',
      contato_local_fone: endereco.contato_local_fone || '',
      principal: endereco.principal || false,
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!isForeign && !cmunValido(form.cmun)) {
      toast.error(
        "Código IBGE do município é obrigatório (7 dígitos). Busque pelo CEP ou preencha manualmente.",
      );
      return;
    }
    if (!isForeign && !form.cep?.replace(/\D/g, "")) {
      toast.error("CEP é obrigatório para endereço no Brasil.");
      return;
    }
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
        <h3 className="text-sm font-medium">Endereços</h3>
        <Button size="sm" onClick={openNew}>
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Endereço
        </Button>
      </div>

      {enderecos.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground border rounded-md">
          Nenhum endereço cadastrado
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>Endereço</TableHead>
              <TableHead>Cidade/UF</TableHead>
              <TableHead>IBGE</TableHead>
              <TableHead>Principal</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {enderecos.map((end) => (
              <TableRow key={end.id}>
                <TableCell>
                  <StatusBadge variant="default">
                    {TIPO_ENDERECO_LABELS[end.tipo as TipoEnderecoExtended] || end.tipo}
                  </StatusBadge>
                </TableCell>
                <TableCell>
                  {end.logradouro}, {end.nro} {end.compl ? `- ${end.compl}` : ''} - {end.bairro}
                </TableCell>
                <TableCell>{end.cidade}/{end.uf}</TableCell>
                <TableCell>
                  {cmunValido(end.cmun) ? (
                    <span className="font-mono text-xs">{end.cmun}</span>
                  ) : (
                    <StatusBadge variant="error">Sem IBGE</StatusBadge>
                  )}
                </TableCell>
                <TableCell>
                  {end.principal && <StatusBadge variant="success">Principal</StatusBadge>}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(end)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onDelete(end.id)}>
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Endereço' : 'Novo Endereço'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v as TipoEnderecoExtended })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TIPO_ENDERECO_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>CEP {!isForeign && <span className="text-destructive">*</span>}</Label>
                {isForeign ? (
                  <Input value={form.cep} onChange={(e) => setForm({ ...form, cep: e.target.value })} placeholder="Código postal (opcional)" />
                ) : (
                  <CepLookupInput
                    value={form.cep}
                    onChange={(cep) => setForm((prev) => ({ ...prev, cep }))}
                    onAddressFound={(addr) =>
                      setForm((prev) => ({
                        ...prev,
                        cep: addr.cep || prev.cep,
                        logradouro: addr.logradouro || prev.logradouro,
                        bairro: addr.bairro || prev.bairro,
                        cidade: addr.cidade || prev.cidade,
                        uf: addr.uf || prev.uf,
                        cmun: addr.cmun || prev.cmun,
                        pais: addr.pais || prev.pais,
                        cpais: addr.cpais || prev.cpais || "1058",
                      }))
                    }
                  />
                )}
              </div>
              <div className="flex items-center gap-2 pt-8">
                <Switch checked={form.principal} onCheckedChange={(v) => setForm({ ...form, principal: v })} />
                <Label>Principal</Label>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 space-y-2">
                <Label>Logradouro</Label>
                <Input value={form.logradouro} onChange={(e) => setForm({ ...form, logradouro: e.target.value })} placeholder="Insira a rua, avenida ou logradouro" />
              </div>
              <div className="space-y-2">
                <Label>Número</Label>
                <Input value={form.nro} onChange={(e) => setForm({ ...form, nro: e.target.value })} placeholder="Insira o número" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Complemento</Label>
                <Input value={form.compl} onChange={(e) => setForm({ ...form, compl: e.target.value })} placeholder="Insira o complemento (sala, andar, bloco)" />
              </div>
              <div className="space-y-2">
                <Label>Bairro</Label>
                <Input value={form.bairro} onChange={(e) => setForm({ ...form, bairro: e.target.value })} placeholder="Insira o bairro" />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Cidade</Label>
                <Input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} placeholder="Insira a cidade" />
              </div>
              <div className="space-y-2">
                <Label>UF</Label>
                {isForeign ? (
                  <Input value={form.uf} onChange={(e) => setForm({ ...form, uf: e.target.value })} placeholder="Insira o estado ou província" />
                ) : (
                  <Select value={form.uf} onValueChange={(v) => setForm({ ...form, uf: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o estado" />
                    </SelectTrigger>
                    <SelectContent>
                      {UF_OPTIONS.map((uf) => (
                        <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="space-y-2">
                <Label>
                  Cód. IBGE (cMun) {!isForeign && <span className="text-destructive">*</span>}
                </Label>
                <Input
                  value={form.cmun}
                  onChange={(e) =>
                    setForm({ ...form, cmun: e.target.value.replace(/\D/g, "").slice(0, 7) })
                  }
                  placeholder="7 dígitos"
                  className={!isForeign && !cmunValido(form.cmun) ? "border-destructive" : ""}
                  maxLength={7}
                />
                <p className="text-[10px] text-muted-foreground">
                  Obrigatório no XML da NF-e. Preenchido automaticamente pelo CEP.
                </p>
              </div>
              <div className="space-y-2">
                <Label>País {isForeign && <span className="text-destructive">*</span>}</Label>
                <Input value={form.pais} onChange={(e) => setForm({ ...form, pais: e.target.value })} placeholder={isForeign ? "Insira o país" : "Brasil"} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Referência</Label>
              <Input value={form.referencia} onChange={(e) => setForm({ ...form, referencia: e.target.value })} placeholder="Insira um ponto de referência (ex: Próximo ao mercado)" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Contato Local (Nome)</Label>
                <Input value={form.contato_local_nome} onChange={(e) => setForm({ ...form, contato_local_nome: e.target.value })} placeholder="Insira o nome do responsável no local" />
              </div>
              <div className="space-y-2">
                <Label>Contato Local (Telefone)</Label>
                <Input value={form.contato_local_fone} onChange={(e) => setForm({ ...form, contato_local_fone: e.target.value })} placeholder="Insira o telefone do contato local" />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={!isForeign && !cmunValido(form.cmun)}>
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
