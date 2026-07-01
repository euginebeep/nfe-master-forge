// ============================================================
// FORMULADOR INDUSTRIAL - CRIAR NOVA FÓRMULA
// ============================================================

import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, FlaskConical, Save, AlertTriangle, Beaker, Droplets, Package, Scale } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import {
  CAPSULA_TAMANHO_PADRAO, DENSIDADE_PADRAO_KG_L, CAPSULA_PESO_MIN_MG,
  sugerirPesoAlvoMg, validarPesoAlvoFisico, type TamanhoCapsula,
} from "@/lib/formulador-industrial-rules";

export default function NovaFormulaPage() {
  const navigate = useNavigate();
  const { criar } = useFormulaCRUD();
  const [saving, setSaving] = useState(false);

  // Form state
  const [form, setForm] = useState({
    nome_formula: "",
    tipo_apresentacao: "CAPSULA" as TipoApresentacao,
    observacoes_tecnicas: "",
    // Cápsula — máquina industrial só opera tamanho 00, então o tamanho
    // não é configurável. O que VARIA por fórmula é a massa que enche essa
    // cápsula, porque densidade do blend muda (minerais quelados vs.
    // colágeno fofo). peso_capsula_alvo_mg é a única fonte de verdade pra
    // essa massa — usada tanto no Q.S.P. da fórmula quanto na batelada da OP.
    peso_capsula_alvo_mg: sugerirPesoAlvoMg(DENSIDADE_PADRAO_KG_L, CAPSULA_TAMANHO_PADRAO),
    tipo_capsula: CAPSULA_TAMANHO_PADRAO,
    excipiente_padrao: "AMIDO" as TipoVeiculoBase,
    // Misturador — mesmo campo acima, usado pro cálculo de batelada
    densidade_aparente_kg_l: DENSIDADE_PADRAO_KG_L,  // medido em lab (picnômetro/Scott)
    // Líquido
    volume_frasco_ml: 30,
    volume_por_dose_ml: 1,
    gotas_por_ml: 20,
    // Pó
    peso_por_dose_g: 10,
    doses_por_pote: 30,
  });


  const validacaoCapsula = useMemo(
    () => validarPesoAlvoFisico(
      form.peso_capsula_alvo_mg,
      form.densidade_aparente_kg_l,
      form.tipo_capsula as TamanhoCapsula,
    ),
    [form.peso_capsula_alvo_mg, form.densidade_aparente_kg_l, form.tipo_capsula],
  );
  const handleSubmit = async () => {
    if (form.tipo_apresentacao === 'CAPSULA' && validacaoCapsula.nivel === 'error') {
      return; // nao salva formula fisicamente inviavel
    }
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
          // Espelhos legados — alguns hooks antigos ainda leem esses nomes.
          // Todos apontam pro mesmo valor; não editar separadamente.
          peso_capsula_nominal_mg: form.peso_capsula_alvo_mg,
          peso_enchimento_mg: form.peso_capsula_alvo_mg,
          tipo_capsula: form.tipo_capsula,
          excipiente_padrao: form.excipiente_padrao,
          densidade_aparente_kg_l: form.densidade_aparente_kg_l,
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
          <Card className="border-blue-200 bg-blue-50/30">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Scale className="h-4 w-4 text-blue-600" />
                Configuração de Cápsula
              </CardTitle>
              <CardDescription>
                A máquina opera cápsula tamanho {CAPSULA_TAMANHO_PADRAO} (fixo). O que varia por
                fórmula é a massa de pó que enche a cápsula, porque a densidade do blend muda.
                O peso alvo é validado contra o volume físico da cápsula. Meça a densidade em
                laboratório antes de aprovar.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tamanho da Cápsula</Label>
                  <Input value={form.tipo_capsula} disabled className="bg-muted" />
                  <p className="text-xs text-muted-foreground">Fixo: tamanho 0 (restrição da máquina)</p>
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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="peso_capsula_alvo_mg">
                    Peso de Enchimento Real (mg)
                    <span className="ml-1 text-xs text-muted-foreground">— pó apenas, sem cápsula vazia</span>
                  </Label>
                  <Input
                    id="peso_capsula_alvo_mg"
                    type="number"
                    step="1"
                    min="100"
                    max="2000"
                    value={form.peso_capsula_alvo_mg}
                    onChange={(e) => {
                      const val = e.target.value.trim();
                      const num = val === '' ? 490 : Math.max(100, Math.min(2000, parseFloat(val) || 490));
                      setForm(prev => ({ ...prev, peso_capsula_alvo_mg: num }));
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    Cápsula 0 padrão: 350–400 mg (ou até 500 mg com densidade baixa) de pó. Pese 10 cápsulas cheias, subtraia o peso das cascas vazias e divida por 10.
                    Default de 490mg só até você medir — não substitui a pesagem real.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="densidade_aparente_kg_l">
                    Densidade Aparente (kg/L)
                    <span className="ml-1 text-xs text-muted-foreground">— método picnômetro ou Scott</span>
                  </Label>
                  <Input
                    id="densidade_aparente_kg_l"
                    type="number"
                    step="0.01"
                    min="0.20"
                    max="1.50"
                    value={form.densidade_aparente_kg_l}
                    onChange={(e) => setForm(prev => ({ ...prev, densidade_aparente_kg_l: parseFloat(e.target.value) || 0.65 }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Típico suplementos: 0,45–0,80 kg/L. Pós densos (creatina): ~0,90. Pós leves (colágeno): ~0,40.
                    Default conservador: 0,65 kg/L.
                  </p>
                </div>
              </div>

              <Alert className="bg-blue-50 border-blue-200">
                <AlertTriangle className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800 text-xs">
                  Esse mesmo peso de enchimento é usado tanto pro Q.S.P. (excipiente que completa
                  a cápsula) quanto pro cálculo de bateladas do Misturador em V ao criar uma OP —
                  uma única medição alimenta os dois cálculos, sem números fixos divergentes.
                </AlertDescription>
              </Alert>
            </CardContent>

            {validacaoCapsula?.nivel === 'error' && (
              <Alert className="bg-red-50 border-red-200">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800 text-xs">
                  ❌ {validacaoCapsula.mensagem}
                </AlertDescription>
              </Alert>
            )}
            {validacaoCapsula?.nivel === 'warning' && (
              <Alert className="bg-yellow-50 border-yellow-200">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <AlertDescription className="text-yellow-800 text-xs">
                  ⚠️ {validacaoCapsula.mensagem}
                </AlertDescription>
              </Alert>
            )}
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
            disabled={!form.nome_formula.trim() || saving || (form.tipo_apresentacao === 'CAPSULA' && validacaoCapsula.nivel === 'error')}
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Salvando..." : "Criar e Adicionar Ativos"}
          </Button>
        </div>
      </div>
    </div>
  );
}
