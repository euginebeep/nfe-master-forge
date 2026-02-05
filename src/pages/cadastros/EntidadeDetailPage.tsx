import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Building2, ArrowLeft, Save, Plus, Trash2, Star } from "lucide-react";
import { motion } from "framer-motion";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge } from "@/components/ui/status-badge";
import { 
  useLocalEntidade, 
  useUpdateEntidade, 
  useEntidadeContatos, 
  useEntidadeEnderecos,
  LocalEntidade,
  LocalEntidadeContato,
  LocalEntidadeEndereco
} from "@/hooks/use-local-entidades";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const PAPEIS = [
  { value: "FORNECEDOR", label: "Fornecedor" },
  { value: "CLIENTE", label: "Cliente" },
  { value: "TRANSPORTADORA", label: "Transportadora" },
  { value: "AFILIADO", label: "Afiliado" },
  { value: "VENDEDOR", label: "Vendedor" },
  { value: "OUTRO", label: "Outro" },
];

const CARGOS = [
  { value: "COMPRADOR", label: "Comprador" },
  { value: "VENDEDOR", label: "Vendedor" },
  { value: "FINANCEIRO", label: "Financeiro" },
  { value: "LOGISTICA", label: "Logistica" },
  { value: "QUALIDADE", label: "Qualidade" },
  { value: "FISCAL", label: "Fiscal" },
  { value: "OUTRO", label: "Outro" },
];

const TIPOS_ENDERECO = [
  { value: "FISCAL", label: "Fiscal" },
  { value: "ENTREGA", label: "Entrega" },
  { value: "COBRANCA", label: "Cobranca" },
];

export default function EntidadeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { entidade, isLoading, refresh } = useLocalEntidade(id);
  const { update } = useUpdateEntidade();
  const { contatos, create: createContato, update: updateContato, remove: removeContato } = useEntidadeContatos(id);
  const { enderecos, create: createEndereco, update: updateEndereco, remove: removeEndereco } = useEntidadeEnderecos(id);

  const [formData, setFormData] = useState<Partial<LocalEntidade>>({});
  const [selectedPapeis, setSelectedPapeis] = useState<string[]>([]);
  const [showContatoForm, setShowContatoForm] = useState(false);
  const [showEnderecoForm, setShowEnderecoForm] = useState(false);
  const [editingContato, setEditingContato] = useState<LocalEntidadeContato | null>(null);
  const [editingEndereco, setEditingEndereco] = useState<LocalEntidadeEndereco | null>(null);
  const [deleteContatoId, setDeleteContatoId] = useState<string | null>(null);
  const [deleteEnderecoId, setDeleteEnderecoId] = useState<string | null>(null);

  useEffect(() => {
    if (entidade) {
      setFormData(entidade);
      setSelectedPapeis(entidade.papeis || []);
    }
  }, [entidade]);

  const handleSave = () => {
    if (!id) return;
    update(id, { ...formData, papeis: selectedPapeis } as Partial<LocalEntidade>);
    refresh();
  };

  const togglePapel = (papel: string) => {
    setSelectedPapeis(prev => 
      prev.includes(papel) 
        ? prev.filter(p => p !== papel)
        : [...prev, papel]
    );
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Carregando...</div>;
  }

  if (!entidade) {
    return <div className="flex items-center justify-center h-64">Entidade nao encontrada</div>;
  }

  return (
    <div>
      <PageHeader
        title={entidade.razao_social}
        description={entidade.nome_fantasia || entidade.documento}
        icon={Building2}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <Button onClick={handleSave}>
              <Save className="h-4 w-4 mr-2" />
              Salvar
            </Button>
          </div>
        }
      />

      <Tabs defaultValue="geral" className="mt-6">
        <TabsList>
          <TabsTrigger value="geral">Geral</TabsTrigger>
          <TabsTrigger value="papeis">Papeis</TabsTrigger>
          <TabsTrigger value="contatos">Contatos</TabsTrigger>
          <TabsTrigger value="enderecos">Enderecos</TabsTrigger>
          <TabsTrigger value="notas">Notas</TabsTrigger>
        </TabsList>

        {/* Tab Geral */}
        <TabsContent value="geral">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <CardHeader>
                <CardTitle>Dados Gerais</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tipo Pessoa</Label>
                    <Select 
                      value={formData.tipo_pessoa} 
                      onValueChange={(v) => setFormData({ ...formData, tipo_pessoa: v as any })}
                    >
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
                    <Label>CNPJ/CPF</Label>
                    <Input
                      value={formData.documento || ""}
                      onChange={(e) => setFormData({ ...formData, documento: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Razao Social</Label>
                    <Input
                      value={formData.razao_social || ""}
                      onChange={(e) => setFormData({ ...formData, razao_social: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Nome Fantasia</Label>
                    <Input
                      value={formData.nome_fantasia || ""}
                      onChange={(e) => setFormData({ ...formData, nome_fantasia: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Inscricao Estadual</Label>
                    <Input
                      value={formData.ie || ""}
                      onChange={(e) => setFormData({ ...formData, ie: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Inscricao Municipal</Label>
                    <Input
                      value={formData.im || ""}
                      onChange={(e) => setFormData({ ...formData, im: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>CNAE</Label>
                    <Input
                      value={formData.cnae || ""}
                      onChange={(e) => setFormData({ ...formData, cnae: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select 
                      value={formData.status} 
                      onValueChange={(v) => setFormData({ ...formData, status: v as any })}
                    >
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
                    <Select 
                      value={formData.classificacao} 
                      onValueChange={(v) => setFormData({ ...formData, classificacao: v as any })}
                    >
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

                <div className="space-y-2">
                  <Label>Site</Label>
                  <Input
                    value={formData.site || ""}
                    onChange={(e) => setFormData({ ...formData, site: e.target.value })}
                    placeholder="https://"
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* Tab Papeis */}
        <TabsContent value="papeis">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <CardHeader>
                <CardTitle>Papeis da Entidade</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {PAPEIS.map((papel) => (
                    <div key={papel.value} className="flex items-center space-x-3 p-3 border rounded-lg">
                      <Checkbox
                        id={`papel-${papel.value}`}
                        checked={selectedPapeis.includes(papel.value)}
                        onCheckedChange={() => togglePapel(papel.value)}
                      />
                      <label htmlFor={`papel-${papel.value}`} className="text-sm font-medium cursor-pointer">
                        {papel.label}
                      </label>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* Tab Contatos */}
        <TabsContent value="contatos">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Contatos</CardTitle>
                <Button size="sm" onClick={() => setShowContatoForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Contato
                </Button>
              </CardHeader>
              <CardContent>
                {contatos.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">Nenhum contato cadastrado</p>
                ) : (
                  <div className="space-y-3">
                    {contatos.map((contato) => (
                      <div key={contato.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-4">
                          {contato.preferencial && <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />}
                          <div>
                            <p className="font-medium">{contato.nome}</p>
                            <p className="text-sm text-muted-foreground">{contato.cargo}</p>
                          </div>
                          <div className="text-sm">
                            {contato.email && <p>{contato.email}</p>}
                            {contato.whatsapp && <p>{contato.whatsapp}</p>}
                            {contato.telefone && <p>{contato.telefone}</p>}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => {
                              setEditingContato(contato);
                              setShowContatoForm(true);
                            }}
                          >
                            Editar
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => setDeleteContatoId(contato.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* Tab Enderecos */}
        <TabsContent value="enderecos">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Enderecos</CardTitle>
                <Button size="sm" onClick={() => setShowEnderecoForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Endereco
                </Button>
              </CardHeader>
              <CardContent>
                {enderecos.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">Nenhum endereco cadastrado</p>
                ) : (
                  <div className="space-y-3">
                    {enderecos.map((endereco) => (
                      <div key={endereco.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <StatusBadge variant="muted">{endereco.tipo}</StatusBadge>
                          </div>
                          <p className="text-sm">
                            {endereco.logradouro}, {endereco.numero}
                            {endereco.complemento && ` - ${endereco.complemento}`}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {endereco.bairro} - {endereco.cidade}/{endereco.uf} - CEP: {endereco.cep}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => {
                              setEditingEndereco(endereco);
                              setShowEnderecoForm(true);
                            }}
                          >
                            Editar
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => setDeleteEnderecoId(endereco.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* Tab Notas */}
        <TabsContent value="notas">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <CardHeader>
                <CardTitle>Observacoes Internas</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={formData.observacoes || ""}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  rows={10}
                  placeholder="Adicione observacoes internas sobre esta entidade..."
                />
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>
      </Tabs>

      {/* Contato Form Dialog */}
      <ContatoFormDialog
        open={showContatoForm}
        onOpenChange={(open) => {
          setShowContatoForm(open);
          if (!open) setEditingContato(null);
        }}
        entidadeId={id!}
        contato={editingContato}
        onSave={(data) => {
          if (editingContato) {
            updateContato(editingContato.id, data);
          } else {
            createContato({ ...data, entidade_id: id! } as Omit<LocalEntidadeContato, 'id'>);
          }
          setShowContatoForm(false);
          setEditingContato(null);
        }}
      />

      {/* Endereco Form Dialog */}
      <EnderecoFormDialog
        open={showEnderecoForm}
        onOpenChange={(open) => {
          setShowEnderecoForm(open);
          if (!open) setEditingEndereco(null);
        }}
        entidadeId={id!}
        endereco={editingEndereco}
        onSave={(data) => {
          if (editingEndereco) {
            updateEndereco(editingEndereco.id, data);
          } else {
            createEndereco({ ...data, entidade_id: id! } as Omit<LocalEntidadeEndereco, 'id'>);
          }
          setShowEnderecoForm(false);
          setEditingEndereco(null);
        }}
      />

      {/* Delete Contato Confirmation */}
      <AlertDialog open={!!deleteContatoId} onOpenChange={() => setDeleteContatoId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Contato</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este contato?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                if (deleteContatoId) removeContato(deleteContatoId);
                setDeleteContatoId(null);
              }} 
              className="bg-destructive text-destructive-foreground"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Endereco Confirmation */}
      <AlertDialog open={!!deleteEnderecoId} onOpenChange={() => setDeleteEnderecoId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Endereco</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este endereco?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                if (deleteEnderecoId) removeEndereco(deleteEnderecoId);
                setDeleteEnderecoId(null);
              }} 
              className="bg-destructive text-destructive-foreground"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Contato Form Dialog Component
function ContatoFormDialog({ 
  open, 
  onOpenChange, 
  entidadeId, 
  contato, 
  onSave 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  entidadeId: string;
  contato: LocalEntidadeContato | null;
  onSave: (data: Partial<LocalEntidadeContato>) => void;
}) {
  const [formData, setFormData] = useState<Partial<LocalEntidadeContato>>({
    nome: "",
    cargo: "OUTRO",
    whatsapp: "",
    telefone: "",
    email: "",
    preferencial: false,
    aceita_whatsapp: true,
  });

  useEffect(() => {
    if (contato) {
      setFormData(contato);
    } else {
      setFormData({
        nome: "",
        cargo: "OUTRO",
        whatsapp: "",
        telefone: "",
        email: "",
        preferencial: false,
        aceita_whatsapp: true,
      });
    }
  }, [contato, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{contato ? "Editar Contato" : "Novo Contato"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome *</Label>
            <Input
              value={formData.nome || ""}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Cargo</Label>
            <Select 
              value={formData.cargo} 
              onValueChange={(v) => setFormData({ ...formData, cargo: v as any })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CARGOS.map((cargo) => (
                  <SelectItem key={cargo.value} value={cargo.value}>{cargo.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>WhatsApp</Label>
              <Input
                value={formData.whatsapp || ""}
                onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                placeholder="+55 11 99999-9999"
              />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input
                value={formData.telefone || ""}
                onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              type="email"
              value={formData.email || ""}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="preferencial"
                checked={formData.preferencial}
                onCheckedChange={(checked) => setFormData({ ...formData, preferencial: !!checked })}
              />
              <label htmlFor="preferencial" className="text-sm">Contato Preferencial</label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="aceita_whatsapp"
                checked={formData.aceita_whatsapp}
                onCheckedChange={(checked) => setFormData({ ...formData, aceita_whatsapp: !!checked })}
              />
              <label htmlFor="aceita_whatsapp" className="text-sm">Aceita WhatsApp</label>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={() => onSave(formData)}>Salvar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Endereco Form Dialog Component
function EnderecoFormDialog({ 
  open, 
  onOpenChange, 
  entidadeId, 
  endereco, 
  onSave 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  entidadeId: string;
  endereco: LocalEntidadeEndereco | null;
  onSave: (data: Partial<LocalEntidadeEndereco>) => void;
}) {
  const [formData, setFormData] = useState<Partial<LocalEntidadeEndereco>>({
    tipo: "FISCAL",
    logradouro: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    uf: "",
    cep: "",
    pais: "Brasil",
  });

  useEffect(() => {
    if (endereco) {
      setFormData(endereco);
    } else {
      setFormData({
        tipo: "FISCAL",
        logradouro: "",
        numero: "",
        complemento: "",
        bairro: "",
        cidade: "",
        uf: "",
        cep: "",
        pais: "Brasil",
      });
    }
  }, [endereco, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{endereco ? "Editar Endereco" : "Novo Endereco"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select 
              value={formData.tipo} 
              onValueChange={(v) => setFormData({ ...formData, tipo: v as any })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_ENDERECO.map((tipo) => (
                  <SelectItem key={tipo.value} value={tipo.value}>{tipo.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 space-y-2">
              <Label>Logradouro</Label>
              <Input
                value={formData.logradouro || ""}
                onChange={(e) => setFormData({ ...formData, logradouro: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Numero</Label>
              <Input
                value={formData.numero || ""}
                onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Complemento</Label>
              <Input
                value={formData.complemento || ""}
                onChange={(e) => setFormData({ ...formData, complemento: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Bairro</Label>
              <Input
                value={formData.bairro || ""}
                onChange={(e) => setFormData({ ...formData, bairro: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-1 space-y-2">
              <Label>CEP</Label>
              <Input
                value={formData.cep || ""}
                onChange={(e) => setFormData({ ...formData, cep: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Cidade</Label>
              <Input
                value={formData.cidade || ""}
                onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>UF</Label>
              <Input
                value={formData.uf || ""}
                onChange={(e) => setFormData({ ...formData, uf: e.target.value })}
                maxLength={2}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={() => onSave(formData)}>Salvar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
