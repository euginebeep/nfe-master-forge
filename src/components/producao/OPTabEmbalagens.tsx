// ============================================================
// ABA EMBALAGENS & ROTULAGEM - OP MASTER
// Gestão de potes, tampas, rótulos, selos, etc.
// ============================================================

import { useState, useEffect } from 'react';
import { 
  Package, Plus, Upload, CheckCircle2, Clock, 
  FileText, Trash2, Eye, ImageIcon, Box
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface Embalagem {
  id: string;
  tipo_embalagem: string;
  insumo_id?: string;
  insumo_nome: string;
  lote_id?: string;
  numero_lote?: string;
  quantidade_planejada: number;
  quantidade_consumida: number;
  custo_unitario: number;
  custo_total: number;
  status: string;
  created_at: string;
}

interface Anexo {
  id: string;
  tipo_anexo: string;
  nome_arquivo: string;
  hash_sha256: string;
  versao: number;
  congelado_em: string;
  created_at: string;
}

interface OPTabEmbalagensProps {
  opId: string;
  status: string;
  quantidadeFrascos: number;
}

const TIPOS_EMBALAGEM = [
  { value: 'POTE', label: 'Pote/Frasco' },
  { value: 'TAMPA', label: 'Tampa' },
  { value: 'SELO', label: 'Selo/Lacre' },
  { value: 'ROTULO', label: 'Rótulo' },
  { value: 'CAIXA', label: 'Caixa' },
  { value: 'DESSECANTE', label: 'Dessecante' },
  { value: 'SACHE', label: 'Sachê' },
  { value: 'OUTRO', label: 'Outro' },
];

export function OPTabEmbalagens({ opId, status, quantidadeFrascos }: OPTabEmbalagensProps) {
  const [embalagens, setEmbalagens] = useState<Embalagem[]>([]);
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [rotuloConferido, setRotuloConferido] = useState(false);

  // Form state
  const [newEmbalagem, setNewEmbalagem] = useState({
    tipo_embalagem: 'POTE',
    insumo_nome: '',
    numero_lote: '',
    quantidade_planejada: quantidadeFrascos,
    custo_unitario: 0,
  });

  useEffect(() => {
    loadData();
  }, [opId]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Carregar embalagens
      const { data: embData } = await supabase
        .from('op_embalagens')
        .select('*')
        .eq('op_id', opId)
        .order('created_at', { ascending: true });

      setEmbalagens((embData || []) as Embalagem[]);

      // Carregar anexos (rótulos, etc)
      const { data: anexosData } = await supabase
        .from('op_anexos')
        .select('*')
        .eq('op_id', opId)
        .order('created_at', { ascending: false });

      setAnexos((anexosData || []) as Anexo[]);
    } catch (error) {
      console.error('Erro ao carregar embalagens:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddEmbalagem = async () => {
    if (!newEmbalagem.insumo_nome) {
      toast.error('Informe o nome do item');
      return;
    }

    try {
      const { error } = await supabase.from('op_embalagens').insert({
        op_id: opId,
        tipo_embalagem: newEmbalagem.tipo_embalagem,
        insumo_nome: newEmbalagem.insumo_nome,
        numero_lote: newEmbalagem.numero_lote || null,
        quantidade_planejada: newEmbalagem.quantidade_planejada,
        custo_unitario: newEmbalagem.custo_unitario,
        custo_total: newEmbalagem.quantidade_planejada * newEmbalagem.custo_unitario,
        status: 'PENDENTE',
      });

      if (error) throw error;

      toast.success('Embalagem adicionada!');
      setShowAddDialog(false);
      setNewEmbalagem({
        tipo_embalagem: 'POTE',
        insumo_nome: '',
        numero_lote: '',
        quantidade_planejada: quantidadeFrascos,
        custo_unitario: 0,
      });
      loadData();
    } catch (error) {
      console.error('Erro ao adicionar embalagem:', error);
      toast.error('Erro ao adicionar embalagem');
    }
  };

  const handleConfirmarEmbalagem = async (id: string) => {
    try {
      const { error } = await supabase
        .from('op_embalagens')
        .update({ 
          status: 'CONFERIDO',
          quantidade_consumida: embalagens.find(e => e.id === id)?.quantidade_planejada || 0
        })
        .eq('id', id);

      if (error) throw error;
      toast.success('Embalagem conferida!');
      loadData();
    } catch (error) {
      console.error('Erro ao confirmar:', error);
      toast.error('Erro ao confirmar embalagem');
    }
  };

  const handleRemoveEmbalagem = async (id: string) => {
    try {
      const { error } = await supabase
        .from('op_embalagens')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Embalagem removida');
      loadData();
    } catch (error) {
      console.error('Erro ao remover:', error);
      toast.error('Erro ao remover embalagem');
    }
  };

  const custoTotalEmbalagens = embalagens.reduce((sum, e) => sum + (e.custo_total || 0), 0);
  const embalagensPendentes = embalagens.filter(e => e.status === 'PENDENTE').length;
  const embalagensConferidas = embalagens.filter(e => e.status === 'CONFERIDO').length;

  const canEdit = status !== 'FINALIZADA' && status !== 'CANCELADA';

  return (
    <div className="space-y-6">
      {/* Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Box className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-2xl font-bold">{embalagens.length}</p>
            <p className="text-xs text-muted-foreground">Itens</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Clock className="h-5 w-5 mx-auto mb-1 text-warning" />
            <p className="text-2xl font-bold">{embalagensPendentes}</p>
            <p className="text-xs text-muted-foreground">Pendentes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <CheckCircle2 className="h-5 w-5 mx-auto mb-1 text-success" />
            <p className="text-2xl font-bold">{embalagensConferidas}</p>
            <p className="text-xs text-muted-foreground">Conferidas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Package className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-2xl font-bold">R$ {custoTotalEmbalagens.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Custo Total</p>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Embalagens */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Embalagens ({embalagens.length})
              </CardTitle>
              <CardDescription>Potes, tampas, selos, rótulos e outros materiais de embalagem</CardDescription>
            </div>
            {canEdit && (
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {embalagens.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhuma embalagem cadastrada. Clique em "Adicionar" para começar.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Lote</TableHead>
                  <TableHead className="text-right">Qtd Plan.</TableHead>
                  <TableHead className="text-right">Custo Unit.</TableHead>
                  <TableHead className="text-right">Custo Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {embalagens.map((emb) => (
                  <TableRow key={emb.id}>
                    <TableCell>
                      <Badge variant="outline">
                        {TIPOS_EMBALAGEM.find(t => t.value === emb.tipo_embalagem)?.label || emb.tipo_embalagem}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{emb.insumo_nome}</TableCell>
                    <TableCell className="font-mono text-sm">{emb.numero_lote || '-'}</TableCell>
                    <TableCell className="text-right">{emb.quantidade_planejada.toLocaleString()}</TableCell>
                    <TableCell className="text-right">R$ {emb.custo_unitario.toFixed(4)}</TableCell>
                    <TableCell className="text-right font-medium">R$ {emb.custo_total.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge 
                        variant={emb.status === 'CONFERIDO' ? 'default' : 'secondary'}
                        className={emb.status === 'CONFERIDO' ? 'bg-success' : ''}
                      >
                        {emb.status === 'CONFERIDO' ? 'Conferido' : 'Pendente'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {canEdit && emb.status === 'PENDENTE' && (
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleConfirmarEmbalagem(emb.id)}
                            title="Confirmar"
                          >
                            <CheckCircle2 className="h-4 w-4 text-success" />
                          </Button>
                        )}
                        {canEdit && (
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleRemoveEmbalagem(emb.id)}
                            title="Remover"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Anexos / Rótulo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Rótulo e Anexos
          </CardTitle>
          <CardDescription>
            Upload do rótulo usado nesta produção (versão congelada com hash)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {anexos.filter(a => a.tipo_anexo === 'ROTULO').length === 0 ? (
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">Nenhum rótulo anexado</p>
              <Button variant="outline" size="sm" className="mt-2" disabled>
                <Upload className="h-4 w-4 mr-2" />
                Upload Rótulo
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {anexos.filter(a => a.tipo_anexo === 'ROTULO').map((anexo) => (
                <div key={anexo.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">{anexo.nome_arquivo}</p>
                      <p className="text-xs text-muted-foreground">
                        Versão {anexo.versao} • Hash: {anexo.hash_sha256.slice(0, 16)}...
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon">
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Conferência do Rótulo */}
          <div className="flex items-center space-x-2 pt-4 border-t">
            <Checkbox 
              id="conferencia-rotulo" 
              checked={rotuloConferido}
              onCheckedChange={(checked) => setRotuloConferido(checked as boolean)}
              disabled={!canEdit}
            />
            <Label htmlFor="conferencia-rotulo" className="text-sm">
              Confirmo que o rótulo foi verificado e está correto para esta produção
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Dialog Adicionar Embalagem */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Embalagem</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo de Embalagem</Label>
              <Select 
                value={newEmbalagem.tipo_embalagem} 
                onValueChange={(v) => setNewEmbalagem({ ...newEmbalagem, tipo_embalagem: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_EMBALAGEM.map((tipo) => (
                    <SelectItem key={tipo.value} value={tipo.value}>
                      {tipo.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Nome/Descrição do Item *</Label>
              <Input
                placeholder="Ex: Pote PET 150ml Âmbar"
                value={newEmbalagem.insumo_nome}
                onChange={(e) => setNewEmbalagem({ ...newEmbalagem, insumo_nome: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Lote (opcional)</Label>
                <Input
                  placeholder="Ex: EMB-2025-001"
                  value={newEmbalagem.numero_lote}
                  onChange={(e) => setNewEmbalagem({ ...newEmbalagem, numero_lote: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Quantidade</Label>
                <Input
                  type="number"
                  value={newEmbalagem.quantidade_planejada}
                  onChange={(e) => setNewEmbalagem({ ...newEmbalagem, quantidade_planejada: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Custo Unitário (R$)</Label>
              <Input
                type="number"
                step="0.0001"
                value={newEmbalagem.custo_unitario}
                onChange={(e) => setNewEmbalagem({ ...newEmbalagem, custo_unitario: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancelar</Button>
            <Button onClick={handleAddEmbalagem}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
