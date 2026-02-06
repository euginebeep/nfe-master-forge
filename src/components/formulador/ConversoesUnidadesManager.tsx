// ============================================================
// GERENCIADOR DE CONVERSÕES UI → MG
// Permite cadastrar/editar fatores de conversão para vitaminas
// ============================================================

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  Plus, Trash2, Save, RefreshCw, Info, Beaker, Edit2, X, Check, AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

interface ConversaoUnidade {
  id: string;
  substancia: string;
  fator_ui_para_mg: number;
  conversao_ui_mcg?: number;
  potencia_faixa_min?: number;
  potencia_faixa_max?: number;
  classificacao_risco?: 'NORMAL' | 'ATENCAO' | 'CRITICO' | 'ULTRA_CRITICO';
  fonte_tecnica?: string;
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
}

export function ConversoesUnidadesManager() {
  const [conversoes, setConversoes] = useState<ConversaoUnidade[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<ConversaoUnidade | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    substancia: "",
    fator_ui_para_mg: "",
    fonte_tecnica: "",
  });

  const loadConversoes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("conversoes_unidades")
        .select("*")
        .order("substancia");

      if (error) throw error;
      setConversoes((data || []) as ConversaoUnidade[]);
    } catch (err) {
      console.error("Erro ao carregar conversões:", err);
      toast.error("Erro ao carregar conversões");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConversoes();
  }, []);

  const handleOpenNew = () => {
    setFormData({ substancia: "", fator_ui_para_mg: "", fonte_tecnica: "" });
    setEditingId(null);
    setDialogOpen(true);
  };

  const handleEdit = (conv: ConversaoUnidade) => {
    setFormData({
      substancia: conv.substancia,
      fator_ui_para_mg: conv.fator_ui_para_mg.toString(),
      fonte_tecnica: conv.fonte_tecnica || "",
    });
    setEditingId(conv.id);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.substancia.trim()) {
      toast.error("Nome da substância é obrigatório");
      return;
    }
    
    const fator = parseFloat(formData.fator_ui_para_mg);
    if (isNaN(fator) || fator <= 0) {
      toast.error("Fator de conversão inválido");
      return;
    }

    try {
      if (editingId) {
        // Update
        const { error } = await supabase
          .from("conversoes_unidades")
          .update({
            substancia: formData.substancia.trim(),
            fator_ui_para_mg: fator,
            fonte_tecnica: formData.fonte_tecnica.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingId);

        if (error) throw error;
        toast.success("Conversão atualizada!");
      } else {
        // Insert
        const { error } = await supabase
          .from("conversoes_unidades")
          .insert({
            substancia: formData.substancia.trim(),
            fator_ui_para_mg: fator,
            fonte_tecnica: formData.fonte_tecnica.trim() || null,
            ativo: true,
          });

        if (error) throw error;
        toast.success("Conversão cadastrada!");
      }

      setDialogOpen(false);
      loadConversoes();
    } catch (err) {
      console.error("Erro ao salvar:", err);
      toast.error("Erro ao salvar conversão");
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;

    try {
      const { error } = await supabase
        .from("conversoes_unidades")
        .delete()
        .eq("id", deleteConfirm.id);

      if (error) throw error;
      toast.success("Conversão excluída!");
      setDeleteConfirm(null);
      loadConversoes();
    } catch (err) {
      console.error("Erro ao excluir:", err);
      toast.error("Erro ao excluir conversão");
    }
  };

  const toggleAtivo = async (conv: ConversaoUnidade) => {
    try {
      const { error } = await supabase
        .from("conversoes_unidades")
        .update({ ativo: !conv.ativo, updated_at: new Date().toISOString() })
        .eq("id", conv.id);

      if (error) throw error;
      toast.success(conv.ativo ? "Conversão desativada" : "Conversão ativada");
      loadConversoes();
    } catch (err) {
      console.error("Erro ao atualizar:", err);
      toast.error("Erro ao atualizar status");
    }
  };

  // Helper para calcular exemplo
  const calcularExemplo = (fator: number) => {
    if (!fator || fator <= 0) return null;
    const uiPorMg = 1 / fator;
    return uiPorMg.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
  };

  return (
    <div className="space-y-6">
      {/* Header com explicação */}
      <Alert className="bg-primary/5 border-primary/20">
        <Info className="h-4 w-4 text-primary" />
        <AlertDescription className="text-sm">
          <strong>O que é isso?</strong> Aqui você cadastra os fatores de conversão de 
          <strong> UI (Unidade Internacional)</strong> para <strong>mg (miligramas)</strong>.
          <br />
          <span className="text-muted-foreground">
            Exemplo: Vitamina D3 → 1 UI = 0,000025 mg (ou seja, 40.000 UI = 1 mg).
            Consulte sempre o laudo/COA do fornecedor para valores precisos.
          </span>
        </AlertDescription>
      </Alert>

      {/* Ações */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Beaker className="h-5 w-5 text-primary" />
          Conversões UI → mg
        </h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadConversoes}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
          <Button size="sm" onClick={handleOpenNew}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Conversão
          </Button>
        </div>
      </div>

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Carregando...</div>
          ) : conversoes.length === 0 ? (
            <div className="p-8 text-center">
              <Beaker className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-medium mb-2">Nenhuma conversão cadastrada</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Cadastre os fatores de conversão para usar unidades UI nas fórmulas.
              </p>
              <Button onClick={handleOpenNew}>
                <Plus className="h-4 w-4 mr-2" />
                Cadastrar Primeira Conversão
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Substância</TableHead>
                  <TableHead className="text-right">Fator (1 UI = X mg)</TableHead>
                  <TableHead className="text-right">Equivalência</TableHead>
                  <TableHead>Fonte/Referência</TableHead>
                  <TableHead>Risco</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {conversoes.map((conv) => (
                  <TableRow key={conv.id} className={!conv.ativo ? "opacity-50" : ""}>
                    <TableCell className="font-medium">{conv.substancia}</TableCell>
                    <TableCell className="text-right font-mono">
                      {conv.fator_ui_para_mg.toFixed(6)} mg
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground text-sm">
                      {calcularExemplo(conv.fator_ui_para_mg)} UI = 1 mg
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">
                      {conv.fonte_tecnica || "-"}
                    </TableCell>
                    <TableCell>
                      {conv.classificacao_risco === 'ULTRA_CRITICO' && (
                        <Badge variant="destructive" className="text-xs">🚨 Ultra</Badge>
                      )}
                      {conv.classificacao_risco === 'CRITICO' && (
                        <Badge variant="secondary" className="text-xs bg-warning/20 text-warning-foreground">⚠️ Crítico</Badge>
                      )}
                      {conv.classificacao_risco === 'ATENCAO' && (
                        <Badge variant="outline" className="text-xs">📋 Atenção</Badge>
                      )}
                      {(!conv.classificacao_risco || conv.classificacao_risco === 'NORMAL') && (
                        <Badge variant="outline" className="text-xs text-muted-foreground">Normal</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleAtivo(conv)}
                        className={conv.ativo ? "text-green-600" : "text-muted-foreground"}
                      >
                        {conv.ativo ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <X className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(conv)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => setDeleteConfirm(conv)}
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

      {/* Exemplos de referência */}
      <Card className="bg-muted/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            Ativos Ultra Críticos - Referências Técnicas (USP)
          </CardTitle>
          <CardDescription className="text-xs">
            Use estes valores como referência. Sempre confirme com o COA/laudo do fornecedor.
            Ativos classificados como ULTRA CRÍTICO exigem <strong>diluição geométrica por pré-mistura</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-xs space-y-1">
          <p><strong className="text-destructive">🚨 Vitamina D3 (Colecalciferol):</strong> 1 UI = 0,025 mcg = 0,000025 mg | Potência: ~40M UI/g</p>
          <p><strong>Vitamina A (Retinol):</strong> 1 UI = 0,0003 mg (3.333 UI/mg)</p>
          <p><strong>Vitamina E (Tocoferol):</strong> 1 UI = 0,67 mg (1,49 UI/mg)</p>
          <p><strong>Vitamina K1:</strong> 1 UI = 0,001 mg (1.000 UI/mg)</p>
          <Separator className="my-2" />
          <p className="text-muted-foreground italic">
            💡 Fórmula de massa real: massa_mg = (dose_UI / potência_UI/g) × 1000
          </p>
        </CardContent>
      </Card>

      {/* Dialog de criação/edição */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Editar Conversão" : "Nova Conversão UI → mg"}
            </DialogTitle>
            <DialogDescription>
              Cadastre o fator de conversão de Unidade Internacional para miligramas.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="substancia">Nome da Substância *</Label>
              <Input
                id="substancia"
                placeholder="Ex: Vitamina D3 (Colecalciferol)"
                value={formData.substancia}
                onChange={(e) => setFormData({ ...formData, substancia: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fator">Fator de Conversão (1 UI = X mg) *</Label>
              <Input
                id="fator"
                type="number"
                step="0.000001"
                placeholder="Ex: 0.000025"
                value={formData.fator_ui_para_mg}
                onChange={(e) => setFormData({ ...formData, fator_ui_para_mg: e.target.value })}
              />
              {formData.fator_ui_para_mg && parseFloat(formData.fator_ui_para_mg) > 0 && (
                <p className="text-xs text-muted-foreground">
                  Equivalência: {calcularExemplo(parseFloat(formData.fator_ui_para_mg))} UI = 1 mg
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="fonte">Fonte/Referência Técnica (opcional)</Label>
              <Textarea
                id="fonte"
                placeholder="Ex: USP: 1 UI = 0.025 mcg"
                value={formData.fonte_tecnica}
                onChange={(e) => setFormData({ ...formData, fonte_tecnica: e.target.value })}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              <Save className="h-4 w-4 mr-2" />
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conversão?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a conversão de <strong>{deleteConfirm?.substancia}</strong>?
              Fórmulas que usem esta substância em UI deixarão de funcionar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
