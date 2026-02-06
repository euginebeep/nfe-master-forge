// ============================================================
// FORMULADOR INDUSTRIAL - CRIAR NOVA FÓRMULA
// ============================================================

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, FlaskConical, Save, AlertTriangle, Beaker, Droplets, Package } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useFormulaCRUD } from "@/hooks/use-formulador-industrial";
import { TipoApresentacao, TipoVeiculoBase } from "@/types/formulador-industrial";

export default function NovaFormulaPage() {
  const navigate = useNavigate();
  const { criar } = useFormulaCRUD();
  const [saving, setSaving] = useState(false);

  // Form state
  const [form, setForm] = useState({
    nome_formula: "",
    tipo_apresentacao: "CAPSULA" as TipoApresentacao,
    observacoes_tecnicas: "",
    // Cápsula
    peso_capsula_alvo_mg: 490,
    peso_capsula_nominal_mg: 500,
    tipo_capsula: "00",
    excipiente_padrao: "AMIDO" as TipoVeiculoBase,
    // Líquido
    volume_frasco_ml: 30,
    volume_por_dose_ml: 1,
    gotas_por_ml: 20,
    // Pó
    peso_por_dose_g: 10,
    doses_por_pote: 30,
  });

  const handleSubmit = async () => {
    if (!form.nome_formula.trim()) {
      return;
    }

    setSaving(true);
    try {
      const formula = await criar({
        nome_formula: form.nome_formula,
        tipo_apresentacao: form.tipo_apresentacao,
        observacoes_tecnicas: form.observacoes_tecnicas || undefined,
        status: 'RASCUNHO',
        // Campos específicos por tipo
        ...(form.tipo_apresentacao === 'CAPSULA' && {
          peso_capsula_alvo_mg: form.peso_capsula_alvo_mg,
          peso_capsula_nominal_mg: form.peso_capsula_nominal_mg,
          tipo_capsula: form.tipo_capsula,
          excipiente_padrao: form.excipiente_padrao,
        }),
        ...(form.tipo_apresentacao === 'LIQUIDO' && {
          volume_frasco_ml: form.volume_frasco_ml,
          volume_por_dose_ml: form.volume_por_dose_ml,
          gotas_por_ml: form.gotas_por_ml,
        }),
        ...(form.tipo_apresentacao === 'PO' && {
          peso_por_dose_g: form.peso_por_dose_g,
          doses_por_pote: form.doses_por_pote,
        }),
      });

      if (formula) {
        navigate(`/producao/formulas/${formula.id}/editar`);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Nova Fórmula Industrial"
        description="Configuração inicial da fórmula"
        icon={FlaskConical}
        actions={
          <Button variant="outline" onClick={() => navigate("/producao/formulas")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        }
      />

      <div className="max-w-3xl space-y-6">
        {/* Nome da Fórmula */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Identificação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome da Fórmula *</Label>
              <Input
                id="nome"
                value={form.nome_formula}
                onChange={(e) => setForm(prev => ({ ...prev, nome_formula: e.target.value }))}
                placeholder="Ex: Vitamina D3 2000 UI + K2 100mcg"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="obs">Observações Técnicas</Label>
              <Textarea
                id="obs"
                value={form.observacoes_tecnicas}
                onChange={(e) => setForm(prev => ({ ...prev, observacoes_tecnicas: e.target.value }))}
                placeholder="Informações técnicas relevantes..."
              />
            </div>
          </CardContent>
        </Card>

        {/* Tipo de Apresentação */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tipo de Apresentação</CardTitle>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={form.tipo_apresentacao}
              onValueChange={(v) => setForm(prev => ({ ...prev, tipo_apresentacao: v as TipoApresentacao }))}
              className="grid grid-cols-3 gap-4"
            >
              <div>
                <RadioGroupItem value="CAPSULA" id="capsula" className="peer sr-only" />
                <Label
                  htmlFor="capsula"
                  className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-secondary [&:has([data-state=checked])]:border-secondary cursor-pointer"
                >
                  <Beaker className="h-8 w-8 mb-2" />
                  <span className="font-medium">Cápsula</span>
                  <span className="text-xs text-muted-foreground">Padrão industrial</span>
                </Label>
              </div>
              <div>
                <RadioGroupItem value="LIQUIDO" id="liquido" className="peer sr-only" />
                <Label
                  htmlFor="liquido"
                  className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-secondary [&:has([data-state=checked])]:border-secondary cursor-pointer"
                >
                  <Droplets className="h-8 w-8 mb-2" />
                  <span className="font-medium">Líquido</span>
                  <span className="text-xs text-muted-foreground">Frasco em mL</span>
                </Label>
              </div>
              <div>
                <RadioGroupItem value="PO" id="po" className="peer sr-only" />
                <Label
                  htmlFor="po"
                  className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-secondary [&:has([data-state=checked])]:border-secondary cursor-pointer"
                >
                  <Package className="h-8 w-8 mb-2" />
                  <span className="font-medium">Pó</span>
                  <span className="text-xs text-muted-foreground">Pote/Sachê</span>
                </Label>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Configurações específicas por tipo */}
        {form.tipo_apresentacao === 'CAPSULA' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Configuração de Cápsula</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="bg-muted/50">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Padrão Industrial:</strong> Cápsula 00 com 500mg nominal, 490mg alvo.
                  Excipientes tecnológicos: Sílica 2% + Estearato 1% + Talco 5% (fixos).
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Peso Nominal (mg)</Label>
                  <Input
                    type="number"
                    value={form.peso_capsula_nominal_mg}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">Fixo: 500 mg</p>
                </div>
                <div className="space-y-2">
                  <Label>Peso Alvo (mg)</Label>
                  <Input
                    type="number"
                    value={form.peso_capsula_alvo_mg}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">Fixo: 490 mg</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tamanho da Cápsula</Label>
                  <Input
                    value={form.tipo_capsula}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">Tamanho 00</p>
                </div>
                <div className="space-y-2">
                  <Label>Veículo Base (Q.S.P.)</Label>
                  <Select 
                    value={form.excipiente_padrao}
                    onValueChange={(v) => setForm(prev => ({ ...prev, excipiente_padrao: v as TipoVeiculoBase }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AMIDO">Amido de Milho</SelectItem>
                      <SelectItem value="CELULOSE">Celulose Microcristalina</SelectItem>
                      <SelectItem value="PRE_BLEND">Pré-blend Industrial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {form.tipo_apresentacao === 'LIQUIDO' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Configuração de Líquido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Volume do Frasco (mL)</Label>
                  <Input
                    type="number"
                    value={form.volume_frasco_ml}
                    onChange={(e) => setForm(prev => ({ ...prev, volume_frasco_ml: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Volume por Dose (mL)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={form.volume_por_dose_ml}
                    onChange={(e) => setForm(prev => ({ ...prev, volume_por_dose_ml: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Gotas por mL</Label>
                  <Input
                    type="number"
                    value={form.gotas_por_ml}
                    onChange={(e) => setForm(prev => ({ ...prev, gotas_por_ml: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-secondary">
                    {form.volume_por_dose_ml > 0 ? Math.floor(form.volume_frasco_ml / form.volume_por_dose_ml) : 0}
                  </div>
                  <div className="text-xs text-muted-foreground">Doses por frasco</div>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-secondary">
                    {form.volume_por_dose_ml * form.gotas_por_ml}
                  </div>
                  <div className="text-xs text-muted-foreground">Gotas por dose</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {form.tipo_apresentacao === 'PO' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Configuração de Pó</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Peso por Dose (g)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={form.peso_por_dose_g}
                    onChange={(e) => setForm(prev => ({ ...prev, peso_por_dose_g: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Doses por Pote</Label>
                  <Input
                    type="number"
                    value={form.doses_por_pote}
                    onChange={(e) => setForm(prev => ({ ...prev, doses_por_pote: parseInt(e.target.value) || 0 }))}
                  />
                </div>
              </div>

              <Separator />

              <div className="p-4 bg-muted rounded-lg text-center">
                <div className="text-2xl font-bold text-secondary">
                  {(form.peso_por_dose_g * form.doses_por_pote).toFixed(0)} g
                </div>
                <div className="text-xs text-muted-foreground">Peso total do pote</div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Botões de ação */}
        <div className="flex justify-end gap-4">
          <Button variant="outline" onClick={() => navigate("/producao/formulas")}>
            Cancelar
          </Button>
          <Button 
            className="bg-secondary hover:bg-secondary/90"
            onClick={handleSubmit}
            disabled={!form.nome_formula.trim() || saving}
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Salvando..." : "Criar e Adicionar Ativos"}
          </Button>
        </div>
      </div>
    </div>
  );
}
