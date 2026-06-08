import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/ui/page-header";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Edit2, Power, PowerOff, Factory, Loader2 } from "lucide-react";

type Equipamento = {
  id: string;
  company_id: string;
  nome: string;
  tipo: "MISTURADOR_V" | "MISTURADOR_DUPLO_CONE" | "ENCAPSULADORA" | "BALANCA" | "OUTRO";
  volume_nominal_litros: number | null;
  fator_enchimento_maximo: number | null;
  fator_enchimento_minimo: number | null;
  fator_enchimento_padrao: number | null;
  capacidade_maxima_kg: number | null;
  capacidade_minima_kg: number | null;
  capacidade_padrao_kg: number | null;
  capacidade_maxima_com_aprovacao_kg: number | null;
  densidade_padrao_kg_l: number | null;
  numero_serie: string | null;
  observacoes: string | null;
  ativo: boolean;
  created_at: string;
};

const DEFAULT_FORM: Partial<Equipamento> = {
  nome: "Misturador em V 100L",
  tipo: "MISTURADOR_V",
  volume_nominal_litros: 100,
  fator_enchimento_maximo: 0.65,
  fator_enchimento_minimo: 0.15,
  fator_enchimento_padrao: 0.40,
  densidade_padrao_kg_l: 0.65,
  ativo: true,
  numero_serie: "",
  observacoes: "",
  capacidade_maxima_com_aprovacao_kg: null,
};

export default function EquipamentosPage() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEquipamento, setEditingEquipamento] = useState<Equipamento | null>(null);
  const [form, setForm] = useState<Partial<Equipamento>>(DEFAULT_FORM);

  const companyId = profile?.company_id;

  const { data: equipamentos, isLoading } = useQuery({
    queryKey: ["equipamentos", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("equipamentos")
        .select("*")
        .eq("company_id", companyId)
        .order("nome");
      if (error) throw error;
      return data as Equipamento[];
    },
    enabled: !!companyId,
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: Partial<Equipamento>) => {
      if (editingEquipamento) {
        const { error } = await supabase
          .from("equipamentos")
          .update(payload)
          .eq("id", editingEquipamento.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("equipamentos")
          .insert([{ 
            nome: payload.nome as string,
            tipo: payload.tipo,
            volume_nominal_litros: payload.volume_nominal_litros,
            fator_enchimento_maximo: payload.fator_enchimento_maximo,
            fator_enchimento_minimo: payload.fator_enchimento_minimo,
            fator_enchimento_padrao: payload.fator_enchimento_padrao,
            capacidade_maxima_kg: payload.capacidade_maxima_kg,
            capacidade_minima_kg: payload.capacidade_minima_kg,
            capacidade_padrao_kg: payload.capacidade_padrao_kg,
            capacidade_maxima_com_aprovacao_kg: payload.capacidade_maxima_com_aprovacao_kg,
            densidade_padrao_kg_l: payload.densidade_padrao_kg_l,
            numero_serie: payload.numero_serie,
            observacoes: payload.observacoes,
            ativo: payload.ativo,
            company_id: companyId 
          }]);
        if (error) throw error;
      }

    },
    onSuccess: () => {
      // Invalidar o queryKey exato que contém o companyId
      queryClient.invalidateQueries({ queryKey: ["equipamentos"] });
      toast.success(editingEquipamento ? "Equipamento atualizado" : "Equipamento cadastrado");
      setIsDialogOpen(false);
    },
    onError: (error) => {
      console.error(error);
      toast.error("Erro ao salvar equipamento");
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, activo }: { id: string; activo: boolean }) => {
      const { error } = await supabase
        .from("equipamentos")
        .update({ ativo: !activo })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipamentos"] });
      toast.success("Status atualizado");
    },
  });

  const handleOpenDialog = (equipamento?: Equipamento) => {
    if (equipamento) {
      setEditingEquipamento(equipamento);
      setForm(equipamento);
    } else {
      setEditingEquipamento(null);
      setForm(DEFAULT_FORM);
    }
    setIsDialogOpen(true);
  };

  // Cálculos automáticos
  const calculatedCapacities = useMemo(() => {
    const vol = Number(form.volume_nominal_litros) || 0;
    const dens = Number(form.densidade_padrao_kg_l) || 0;
    
    return {
      max: vol * (Number(form.fator_enchimento_maximo) || 0) * dens,
      min: vol * (Number(form.fator_enchimento_minimo) || 0) * dens,
      padrao: vol * (Number(form.fator_enchimento_padrao) || 0) * dens,
    };
  }, [form.volume_nominal_litros, form.fator_enchimento_maximo, form.fator_enchimento_minimo, form.fator_enchimento_padrao, form.densidade_padrao_kg_l]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...form,
      capacidade_maxima_kg: calculatedCapacities.max,
      capacidade_minima_kg: calculatedCapacities.min,
      capacidade_padrao_kg: calculatedCapacities.padrao,
    };
    saveMutation.mutate(payload);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <PageHeader
        title="Equipamentos de Produção"
        description="Misturadores, encapsuladoras e outros equipamentos cadastrados"
        icon={Factory}
        actions={
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Equipamento
          </Button>
        }
      />


      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Volume (L)</TableHead>
                <TableHead>Cap. Máxima (kg)</TableHead>
                <TableHead>Fator Enchimento Máx</TableHead>
                <TableHead>Densidade Padrão</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : equipamentos?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Nenhum equipamento cadastrado.
                  </TableCell>
                </TableRow>
              ) : (
                equipamentos?.map((eq) => (
                  <TableRow key={eq.id}>
                    <TableCell className="font-medium">{eq.nome}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{eq.tipo}</Badge>
                    </TableCell>
                    <TableCell>{eq.volume_nominal_litros || "—"}</TableCell>
                    <TableCell>{eq.capacidade_maxima_kg?.toFixed(2) || "—"}</TableCell>
                    <TableCell>{eq.fator_enchimento_maximo ? `${(eq.fator_enchimento_maximo * 100).toFixed(0)}%` : "—"}</TableCell>
                    <TableCell>{eq.densidade_padrao_kg_l || "—"}</TableCell>
                    <TableCell>
                      <Badge className={eq.ativo ? "bg-emerald-500" : "bg-slate-400"}>
                        {eq.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(eq)}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleStatusMutation.mutate({ id: eq.id, activo: eq.ativo })}
                        >
                          {eq.ativo ? <PowerOff className="w-4 h-4 text-destructive" /> : <Power className="w-4 h-4 text-emerald-500" />}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingEquipamento ? "Editar Equipamento" : "Novo Equipamento"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome do Equipamento</Label>
                <Input
                  id="nome"
                  value={form.nome || ""}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  placeholder="Ex: Misturador em V 100L"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tipo">Tipo</Label>
                <Select
                  value={form.tipo}
                  onValueChange={(v: any) => setForm({ ...form, tipo: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MISTURADOR_V">Misturador em V</SelectItem>
                    <SelectItem value="MISTURADOR_DUPLO_CONE">Misturador Duplo Cone</SelectItem>
                    <SelectItem value="ENCAPSULADORA">Encapsuladora</SelectItem>
                    <SelectItem value="BALANCA">Balança</SelectItem>
                    <SelectItem value="OUTRO">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="volume">Volume Nominal (L)</Label>
                <Input
                  id="volume"
                  type="number"
                  step="0.1"
                  value={form.volume_nominal_litros || ""}
                  onChange={(e) => setForm({ ...form, volume_nominal_litros: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="densidade">Densidade Padrão (kg/L)</Label>
                <Input
                  id="densidade"
                  type="number"
                  step="0.01"
                  value={form.densidade_padrao_kg_l || ""}
                  onChange={(e) => setForm({ ...form, densidade_padrao_kg_l: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="numero_serie">Nº de Série</Label>
                <Input
                  id="numero_serie"
                  value={form.numero_serie || ""}
                  onChange={(e) => setForm({ ...form, numero_serie: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fator_max">Fator Enchimento Máx (0-1)</Label>
                <Input
                  id="fator_max"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max="1"
                  value={form.fator_enchimento_maximo || ""}
                  onChange={(e) => setForm({ ...form, fator_enchimento_maximo: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fator_min">Fator Enchimento Mín (0-1)</Label>
                <Input
                  id="fator_min"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max="1"
                  value={form.fator_enchimento_minimo || ""}
                  onChange={(e) => setForm({ ...form, fator_enchimento_minimo: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fator_padrao">Fator Enchimento Padrão (0-1)</Label>
                <Input
                  id="fator_padrao"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max="1"
                  value={form.fator_enchimento_padrao || ""}
                  onChange={(e) => setForm({ ...form, fator_enchimento_padrao: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 bg-muted/30 p-4 rounded-lg">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase">Capacidade Máxima (kg)</Label>
                <Input
                  readOnly
                  className="bg-muted"
                  value={calculatedCapacities.max.toFixed(2)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase">Capacidade Mínima (kg)</Label>
                <Input
                  readOnly
                  className="bg-muted"
                  value={calculatedCapacities.min.toFixed(2)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase">Capacidade Padrão (kg)</Label>
                <Input
                  readOnly
                  className="bg-muted"
                  value={calculatedCapacities.padrao.toFixed(2)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cap_aprovacao">Capacidade Máxima com Aprovação RT (kg)</Label>
              <Input
                id="cap_aprovacao"
                type="number"
                step="0.1"
                value={form.capacidade_maxima_com_aprovacao_kg || ""}
                onChange={(e) => setForm({ ...form, capacidade_maxima_com_aprovacao_kg: Number(e.target.value) })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="obs">Observações</Label>
              <Textarea
                id="obs"
                value={form.observacoes || ""}
                onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                rows={3}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="ativo"
                checked={form.ativo}
                onCheckedChange={(checked) => setForm({ ...form, ativo: !!checked })}
              />
              <Label htmlFor="ativo">Equipamento Ativo</Label>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingEquipamento ? "Salvar Alterações" : "Cadastrar Equipamento"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
