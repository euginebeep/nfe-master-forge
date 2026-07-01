// ============================================================
// FORMULADOR INDUSTRIAL - EDITOR DE FÓRMULA
// VERSÃO DEFINITIVA - REGRAS INDUSTRIAIS FIXAS
// ============================================================

import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { 
  ArrowLeft, FlaskConical, Save, Plus, Trash2, AlertTriangle, 
  CheckCircle, Scale, Percent, Beaker, Package, Info, BookOpen, HelpCircle
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogTrigger, DialogDescription,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  useFormula, 
  useFormulaCRUD, 
  useFormulaItensCRUD,
  useConversoesUnidades,
  useAprovarFormula,
} from "@/hooks/use-formulador-industrial";
import { 
  FormulaItem, 
  UnidadeInformada,
  validarFormula,
} from "@/types/formulador-industrial";
import {
  calcularCapsulaIndustrial,
  isAtivoCritico,
  verificarSugestaoPremix,
  converterUIparaMG,
  converterMCGparaMG,
  getNomeVeiculoBase,
  EXCIPIENTES_INDUSTRIAIS,
  TOTAL_PERCENTUAL_TECNOLOGICOS,
  CodigoVeiculoBase,
  CAPSULA_TAMANHO_PADRAO, DENSIDADE_PADRAO_KG_L, CAPSULA_PESO_MIN_MG,
  sugerirPesoAlvoMg, validarPesoAlvoFisico, type TamanhoCapsula,
  calcularCapsulasPorDose,
} from "@/lib/formulador-industrial-rules";
import { ItemSelector } from "@/components/formulador/ItemSelector";
import { ConsultaRegulatoriaANVISA } from "@/components/formulador/ConsultaRegulatoriaANVISA";
import { useCustoFormula } from "@/hooks/use-custo-formula";
import { useHybridItens } from "@/hooks/use-hybrid-data";
import { 
  verificarAtivoUltraCritico, 
  determinarClassificacaoRisco,
  gerarAlertasUltraCritico,
  type ClassificacaoRisco,
  ALERTA_ULTRA_CRITICO_PADRAO,
} from "@/lib/ativo-ultra-critico";
import { toast } from "sonner";

export default function EditarFormulaPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { formula, itens, loading, refresh } = useFormula(id);
  const { atualizar: atualizarFormula } = useFormulaCRUD();
  const { adicionar, atualizar, remover } = useFormulaItensCRUD();
  const { conversoes, buscarFator } = useConversoesUnidades();
  const { aprovar } = useAprovarFormula();
  const { data: itensHybrid = [] } = useHybridItens();

  // Montar insumosById a partir de useHybridItens
  const insumosById = useMemo(() => {
    const map: Record<string, any> = {};
    for (const item of itensHybrid) {
      map[item.id] = {
        custo_por_unidade_interna: (item as any).custo_por_unidade_interna || 0,
        unidade_interna: item.unidade_interna,
        custo_medio_atualizado_em: (item as any).custo_medio_atualizado_em,
        nome: item.descricao_interna,
      };
    }
    return map;
  }, [itensHybrid]);

  // Estado local dos itens
  const [itensLocal, setItensLocal] = useState<FormulaItem[]>([]);
  const [novoItem, setNovoItem] = useState({
    nome_insumo: "",
    produto_materia_prima_id: null as string | null,
    quantidade_informada: 0,
    unidade_informada: "MG" as UnidadeInformada,
    exige_premix: false, // SEMPRE DESMARCADO por padrão
  });
  const [alertaUltraCritico, setAlertaUltraCritico] = useState<{
    nome: string;
    alertas: string[];
    classificacao: ClassificacaoRisco;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [aprovando, setAprovando] = useState(false);
  const [overridesPorItem, setOverridesPorItem] = useState<Record<string, number>>({});
  const [custComplementosDose, setCustComplementosDose] = useState<number>(0);

  // Sincronizar itens quando carregar
  useEffect(() => {
    if (itens.length > 0) {
      setItensLocal(itens);
    }
    // Carregar overrides de preco salvos na formula
    if (formula?.custo_overrides_por_item) {
      setOverridesPorItem(formula.custo_overrides_por_item as Record<string, number>);
    }
    // Carregar custo de complementos salvo na formula
    if (formula?.custo_complementos_dose) {
      setCustComplementosDose(formula.custo_complementos_dose);
    }
  }, [itens, formula?.custo_overrides_por_item, formula?.custo_complementos_dose]);

  // CÁLCULOS INDUSTRIAIS COM REGRAS FIXAS
  const calculosIndustriais = useMemo(() => {
    if (!formula || formula.tipo_apresentacao !== 'CAPSULA') {
      return null;
    }

    const pesoAlvo = formula.peso_capsula_alvo_mg || CAPSULA_PESO_ALVO_MG;
    const totalAtivos = itensLocal.reduce((sum, i) => sum + (i.quantidade_convertida_mg || 0), 0);
    const veiculoBase = (formula.excipiente_padrao || 'AMIDO') as CodigoVeiculoBase;
    
    return calcularCapsulaIndustrial(totalAtivos, veiculoBase, pesoAlvo);
  }, [formula, itensLocal]);


  // Validação física da cápsula
  const validacaoCapsula = useMemo(() => {
    if (!formula || formula.tipo_apresentacao !== 'CAPSULA') {
      return null;
    }
    return validarPesoAlvoFisico(
      formula.peso_capsula_alvo_mg || CAPSULA_PESO_ALVO_MG,
      formula.densidade_aparente_kg_l || DENSIDADE_PADRAO_KG_L,
      formula.tipo_capsula as TamanhoCapsula,
    );
  }, [formula]);

  // FASE 2: Cálculo de cápsulas por dose
  const capsulasPorDose = useMemo(
    () => calcularCapsulasPorDose(
      itensLocal.reduce((s, i) => s + (i.quantidade_convertida_mg || 0), 0),
      formula?.densidade_aparente_kg_l ?? DENSIDADE_PADRAO_KG_L,
      (formula?.tipo_capsula as TamanhoCapsula) ?? CAPSULA_TAMANHO_PADRAO,
    ),
    [itensLocal, formula?.densidade_aparente_kg_l, formula?.tipo_capsula],
  );

  // FASE 3: Cálculo de custo estimado
  const formulaComComplementos = { ...formula, custo_complementos_dose: custComplementosDose };
  const custoFormula = useCustoFormula(formulaComComplementos, itensLocal, insumosById, overridesPorItem);

  // Contadores para alertas
  const ativosCriticos = itensLocal.filter(i => i.ativo_critico).length;
  const ativosComSugestaoPremix = itensLocal.filter(i => {
    const sugestao = verificarSugestaoPremix(i.quantidade_convertida_mg, i.unidade_informada, false);
    return sugestao.sugerido && !i.exige_premix;
  }).length;

  // Converter quantidade para mg
  const converterParaMG = (quantidade: number, unidade: UnidadeInformada, nomeInsumo: string): number => {
    if (unidade === 'MG') return quantidade;
    if (unidade === 'MCG') return converterMCGparaMG(quantidade);
    if (unidade === 'UI') {
      const fator = buscarFator(nomeInsumo);
      if (!fator) {
        toast.error(`Fator de conversão UI→mg não encontrado para: ${nomeInsumo}`);
        return 0;
      }
      return converterUIparaMG(quantidade, fator);
    }
    if (unidade === 'G') return quantidade * 1000;
    if (unidade === 'ML') return quantidade; // Manter para líquidos
    return quantidade;
  };

  // Adicionar novo item
  const handleAdicionarItem = async () => {
    if (!id || !novoItem.nome_insumo.trim() || novoItem.quantidade_informada <= 0) {
      return;
    }

    // Verificar se é ativo ultra crítico
    const infoUltraCritico = await verificarAtivoUltraCritico(novoItem.nome_insumo);
    
    // Verificar fator de conversão para UI
    if (novoItem.unidade_informada === 'UI') {
      const fator = buscarFator(novoItem.nome_insumo);
      if (!fator) {
        toast.error(
          `Fator de conversão UI→mg não encontrado para "${novoItem.nome_insumo}". ` +
          `Cadastre o fator em: Formulador → aba "Conversões UI". ` +
          `Consulte o laudo/COA do fornecedor para obter o valor correto (ex: Vitamina D3 = 40.000 UI/mg).`,
          { duration: 8000 }
        );
        return;
      }
    }

    const quantidadeConvertida = converterParaMG(
      novoItem.quantidade_informada,
      novoItem.unidade_informada,
      novoItem.nome_insumo
    );

    // Determinar classificação de risco
    const classificacaoRisco = infoUltraCritico?.classificacao_risco || 
      determinarClassificacaoRisco(quantidadeConvertida, novoItem.unidade_informada);
    
    // Se é ULTRA_CRÍTICO, forçar pré-mix e alertar
    let forcarPremix = novoItem.exige_premix;
    if (classificacaoRisco === 'ULTRA_CRITICO') {
      forcarPremix = true; // Obrigatório para ultra críticos
      const alertas = gerarAlertasUltraCritico(novoItem.nome_insumo, classificacaoRisco, quantidadeConvertida);
      setAlertaUltraCritico({
        nome: novoItem.nome_insumo,
        alertas,
        classificacao: classificacaoRisco,
      });
    }

    // FLAG AUTOMÁTICA: Ativo crítico (não editável)
    const ativoCritico = isAtivoCritico(quantidadeConvertida, novoItem.unidade_informada);
    
    // SUGESTÃO DE PRÉ-MIX: Apenas informativa
    // REGRA: Checkbox permanece DESMARCADO - usuário decide
    const sugestaoPremix = verificarSugestaoPremix(quantidadeConvertida, novoItem.unidade_informada, false);
    
    if (sugestaoPremix.sugerido && !novoItem.exige_premix) {
      toast.info(`Sugestão: Pré-mix recomendado para ${novoItem.nome_insumo} (${sugestaoPremix.motivo})`);
    }

    // Mapear unidade para banco (G/ML -> MG após conversão)
    const unidadeBanco = novoItem.unidade_informada === 'G' || novoItem.unidade_informada === 'ML' 
      ? 'MG' as const 
      : novoItem.unidade_informada as 'MG' | 'MCG' | 'UI';

    const item = await adicionar({
      formula_id: id,
      nome_insumo: novoItem.nome_insumo,
      produto_materia_prima_id: null,
      quantidade_informada: novoItem.quantidade_informada,
      unidade_informada: unidadeBanco,
      quantidade_convertida_mg: quantidadeConvertida,
      ativo_critico: ativoCritico || classificacaoRisco === 'ULTRA_CRITICO' || classificacaoRisco === 'CRITICO',
      exige_premix: forcarPremix,
      ordem_mistura: itensLocal.length,
      classificacao_risco: classificacaoRisco,
      metodo_distribuicao: classificacaoRisco === 'ULTRA_CRITICO' ? 'DISTRIBUICAO_GEOMETRICA_POR_PREMIX' : null,
    });

    if (item) {
      setItensLocal(prev => [...prev, item]);
      setNovoItem({
        nome_insumo: "",
        produto_materia_prima_id: null,
        quantidade_informada: 0,
        unidade_informada: "MG",
        exige_premix: false,
      });
      toast.success("Ativo adicionado");
    }
  };

  // Remover item
  const handleRemoverItem = async (itemId: string) => {
    const success = await remover(itemId);
    if (success) {
      setItensLocal(prev => prev.filter(i => i.id !== itemId));
      toast.success("Ativo removido");
    }
  };

  // Aprovar fórmula
  const handleAprovar = async () => {
    if (!formula) return;

    const validacao = validarFormula(formula, itensLocal, conversoes);
    if (!validacao.valido) {
      validacao.erros.forEach(e => toast.error(e));
      return;
    }

    if (validacao.alertas.length > 0) {
      validacao.alertas.forEach(a => toast.warning(a));
    }

    setAprovando(true);
    try {
      // FASE 2: Persistir campos de cápsulas por dose
      // FASE 3: Persistir overrides de preço e custo de complementos
      const formulaComCapsulasPorDose = {
        ...formula,
        n_capsulas_por_dose: capsulasPorDose?.n_capsulas,
        peso_por_capsula_mg: capsulasPorDose?.peso_por_capsula_mg,
        massa_ativos_dose_mg: capsulasPorDose?.massa_ativos_mg,
        custo_overrides_por_item: Object.keys(overridesPorItem).length > 0 ? overridesPorItem : null,
        custo_complementos_dose: custComplementosDose || 0,
      }
      
      const resultado = await aprovar(formulaComCapsulasPorDose, itensLocal);
      if (resultado) {
        navigate(`/producao/formulas/${id}`);
      }
    } finally {
      setAprovando(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-muted-foreground">
        Carregando fórmula...
      </div>
    );
  }

  if (!formula) {
    return (
      <div className="p-12 text-center">
        <FlaskConical className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">Fórmula não encontrada</h3>
        <Button onClick={() => navigate("/producao/formulas")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
      </div>
    );
  }

  const isReadOnly = formula.status !== 'RASCUNHO';

  return (
    <div>
      <PageHeader
        title={`Editar: ${formula.codigo_formula}`}
        description={formula.nome_formula}
        icon={FlaskConical}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/producao/formulas")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            {!isReadOnly && itensLocal.length > 0 && (
              <Button 
                className="bg-secondary hover:bg-secondary/90"
                onClick={handleAprovar}
                disabled={aprovando || calculosIndustriais?.excedeu_capacidade || (validacaoCapsula?.nivel === 'error') || capsulasPorDose?.nivel === 'error'}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                {aprovando ? "Aprovando..." : "Aprovar Fórmula"}
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna principal - Lista de ativos */}
        <div className="lg:col-span-2 space-y-6">
          {/* Form para adicionar ativo */}
          {!isReadOnly && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Adicionar Ativo
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-12 gap-4 items-end">
                  <div className="col-span-6 space-y-2">
                    <Label className="flex items-center gap-2">
                      <Package className="h-3.5 w-3.5" />
                      Matéria-prima do Cadastro
                    </Label>
                    <ItemSelector
                      value={novoItem.produto_materia_prima_id || undefined}
                      onSelect={(item) => {
                        if (item) {
                          setNovoItem(prev => ({ 
                            ...prev, 
                            produto_materia_prima_id: item.id,
                            nome_insumo: item.descricao_interna,
                          }));
                        } else {
                          setNovoItem(prev => ({ 
                            ...prev, 
                            produto_materia_prima_id: null,
                            nome_insumo: "",
                          }));
                        }
                      }}
                      placeholder="Buscar no cadastro de itens..."
                    />
                  </div>
                  <div className="col-span-6 space-y-2">
                    <Label>Nome do Insumo (ou manual)</Label>
                    <Input
                      value={novoItem.nome_insumo}
                      onChange={(e) => setNovoItem(prev => ({ ...prev, nome_insumo: e.target.value }))}
                      placeholder="Ex: Vitamina D3"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-12 gap-4 items-end">
                  <div className="col-span-3 space-y-2">
                    <Label>Quantidade</Label>
                    <Input
                      type="number"
                      step="any"
                      value={novoItem.quantidade_informada || ""}
                      onChange={(e) => setNovoItem(prev => ({ ...prev, quantidade_informada: parseFloat(e.target.value) || 0 }))}
                      placeholder="0"
                    />
                  </div>
                  <div className="col-span-3 space-y-2">
                    <Label>Unidade</Label>
                    <Select 
                      value={novoItem.unidade_informada}
                      onValueChange={(v) => setNovoItem(prev => ({ ...prev, unidade_informada: v as UnidadeInformada }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MG">mg</SelectItem>
                        <SelectItem value="MCG">mcg</SelectItem>
                        <SelectItem value="UI">UI</SelectItem>
                        <SelectItem value="G">g</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-3 flex items-center gap-2 pt-6">
                    <Checkbox
                      id="premix"
                      checked={novoItem.exige_premix}
                      onCheckedChange={(c) => setNovoItem(prev => ({ ...prev, exige_premix: !!c }))}
                    />
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Label htmlFor="premix" className="text-sm cursor-help flex items-center gap-1">
                            Pré-mix
                            <Info className="h-3 w-3 text-muted-foreground" />
                          </Label>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs max-w-xs">
                            Marque APENAS se necessário. O sistema sugere quando detecta doses críticas.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <div className="col-span-3">
                    <Button 
                      onClick={handleAdicionarItem}
                      disabled={!novoItem.nome_insumo.trim() || novoItem.quantidade_informada <= 0}
                      className="w-full"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar
                    </Button>
                  </div>
                </div>

                {novoItem.unidade_informada === 'UI' && (
                  <TooltipProvider>
                    <Tooltip delayDuration={0}>
                      <TooltipTrigger asChild>
                        <Alert className="mt-4 bg-warning/10 border-warning/30 cursor-help">
                          <Beaker className="h-4 w-4 text-warning" />
                          <AlertDescription className="text-xs">
                            <strong>Conversão UI → mg:</strong> O sistema buscará automaticamente o fator de conversão cadastrado. 
                            <span className="text-muted-foreground ml-1">Passe o mouse para mais detalhes.</span>
                          </AlertDescription>
                        </Alert>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-md p-4 space-y-3">
                        <div className="font-semibold text-sm border-b pb-2">
                          O que é a conversão UI → mg?
                        </div>
                        <div className="text-xs space-y-2">
                          <p>
                            <strong>UI (Unidade Internacional)</strong> é uma medida de atividade biológica usada para vitaminas 
                            e hormônios (como Vitamina D3, A, E). Porém, para pesagem na produção, precisamos converter para 
                            <strong> miligramas (mg)</strong>.
                          </p>
                          <p>
                            <strong>Exemplo prático:</strong><br/>
                            • Vitamina D3 pura: 1 mg = 40.000 UI<br/>
                            • Se você informar 2.000 UI, o sistema converte para 0,05 mg
                          </p>
                          <p className="text-warning font-medium">
                            ⚠️ Se o fator não estiver cadastrado:
                          </p>
                          <p className="text-muted-foreground">
                            Vá em <strong>Formulador → aba "Conversões UI"</strong> e cadastre o fator UI/mg. 
                            Consulte o laudo/COA do fornecedor para obter o valor correto.
                          </p>
                          <div className="mt-2 p-2 bg-muted rounded text-xs">
                            <strong>Exemplos de fatores comuns:</strong><br/>
                            • Vitamina D3: 40.000 UI = 1 mg<br/>
                            • Vitamina A: 3.333 UI = 1 mg<br/>
                            • Vitamina E: 1,49 UI = 1 mg
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </CardContent>
            </Card>
          )}

          {/* Alerta de Ativo Ultra Crítico */}
          {alertaUltraCritico && (
            <Alert className="border-destructive bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <AlertDescription>
                <div className="font-bold text-destructive mb-2 flex items-center gap-2">
                  🚨 ATIVO ULTRA CRÍTICO DETECTADO: {alertaUltraCritico.nome}
                </div>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  {alertaUltraCritico.alertas.map((alerta, idx) => (
                    <li key={idx}>{alerta}</li>
                  ))}
                </ul>
                <div className="mt-3 flex gap-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => setAlertaUltraCritico(null)}
                  >
                    Entendi
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Lista de ativos */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ativos da Fórmula</CardTitle>
              <CardDescription>
                {itensLocal.length} ativo(s) cadastrado(s)
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {itensLocal.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  Nenhum ativo adicionado.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">#</TableHead>
                      <TableHead>Insumo</TableHead>
                      <TableHead className="text-right">Qtd. Informada</TableHead>
                      <TableHead className="text-right">Convertido (mg)</TableHead>
                      <TableHead className="text-center">Flags</TableHead>
                      <TableHead className="text-center">Regulatório</TableHead>
                      {!isReadOnly && <TableHead className="w-12"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itensLocal.map((item, index) => (
                      <TableRow key={item.id} className={item.ativo_critico ? "bg-destructive/5" : ""}>
                        <TableCell className="font-mono text-muted-foreground">
                          {index + 1}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{item.nome_insumo}</div>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {item.quantidade_informada} {item.unidade_informada.toLowerCase()}
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium">
                          {item.quantidade_convertida_mg.toFixed(4)} mg
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center gap-1 flex-wrap">
                            {/* Classificação de risco */}
                            {(item as any).classificacao_risco === 'ULTRA_CRITICO' && (
                              <Badge variant="destructive" className="text-xs">
                                🚨 Ultra
                              </Badge>
                            )}
                            {item.ativo_critico && (item as any).classificacao_risco !== 'ULTRA_CRITICO' && (
                              <Badge variant="destructive" className="text-xs">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Crítico
                              </Badge>
                            )}
                            {/* Pré-mix */}
                            {item.exige_premix && (
                              <Badge variant="outline" className="text-xs bg-secondary/20">
                                Pré-mix ✓
                              </Badge>
                            )}
                            {/* Sugestão de pré-mix */}
                            {!item.exige_premix && verificarSugestaoPremix(item.quantidade_convertida_mg, item.unidade_informada, false).sugerido && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <Badge variant="secondary" className="text-xs bg-muted text-muted-foreground">
                                      <Info className="h-3 w-3 mr-1" />
                                      Sugestão
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="text-xs">
                                      Pré-mix recomendado: {verificarSugestaoPremix(item.quantidade_convertida_mg, item.unidade_informada, false).motivo}
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <ConsultaRegulatoriaANVISA
                            nomeAtivo={item.nome_insumo}
                            quantidadeMg={item.quantidade_convertida_mg}
                            trigger={
                              <Button variant="ghost" size="sm" className="h-7 px-2">
                                <BookOpen className="h-3.5 w-3.5" />
                              </Button>
                            }
                          />
                        </TableCell>
                        {!isReadOnly && (
                          <TableCell>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="text-destructive"
                              onClick={() => handleRemoverItem(item.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Coluna lateral - Resumo da cápsula */}
        <div className="space-y-6">
          {formula.tipo_apresentacao === 'CAPSULA' && (
            <Card className="border-blue-200 bg-blue-50/30">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Scale className="h-4 w-4 text-blue-600" />
                  Configuração de Cápsula
                </CardTitle>
                <CardDescription className="space-y-2">
                  <span className="block">
                    A máquina opera cápsula tamanho {CAPSULA_TAMANHO_PADRAO} (fixo), com volume
                    interno de ~{validacaoCapsula?.volume_ml} mL. Esse volume é constante — o que muda
                    por fórmula é <strong>quanto pó cabe nele</strong>, e isso depende da densidade do
                    blend: pó denso (minerais quelados) cabe mais massa; pó fofo (colágeno) cabe menos.
                    Por isso o peso alvo é validado contra a densidade que você informar.
                  </span>
                  <span className="block font-medium text-foreground">
                    Meça a densidade real do seu blend antes de aprovar — não use o valor padrão.
                  </span>

                  <Dialog>
                    <DialogTrigger asChild>
                      <button type="button" className="inline-flex items-center gap-1 text-blue-600 underline text-xs">
                        <HelpCircle className="h-3.5 w-3.5" /> Como medir a densidade?
                      </button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                      <DialogHeader>
                        <DialogTitle>Como medir a densidade aparente (kg/L)</DialogTitle>
                        <DialogDescription>
                          Método da proveta (ou béquer). A cápsula tem volume fixo; a densidade define
                          quantos mg cabem nela.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="text-sm space-y-3 text-muted-foreground">
                        <div>
                          <p className="font-medium text-foreground mb-1">Método da proveta</p>
                          <ol className="list-decimal pl-5 space-y-1">
                            <li>Prepare o blend final (todos os ativos + excipientes já misturados, como vai pra cápsula).</li>
                            <li>Pese a proveta seca e vazia e anote o peso.</li>
                            <li>Despeje o pó até uma marca conhecida (ex.: 100 mL). <strong>Não soque nem bata</strong> — deixe assentar naturalmente.</li>
                            <li>Pese a proveta com o pó e subtraia o peso da proveta vazia → massa do pó (g).</li>
                            <li>Calcule: <strong>densidade (kg/L) = massa do pó (g) ÷ volume (mL)</strong>.</li>
                            <li>Digite o valor no campo "Densidade Aparente".</li>
                          </ol>
                        </div>
                        <p className="rounded bg-muted p-2 text-foreground">
                          Exemplo: 74 g em 100 mL → 74 ÷ 100 = <strong>0,74 kg/L</strong>.
                          (kg/L = g/mL — não precisa converter.)
                        </p>
                        <p><strong>Com béquer:</strong> igual — pese vazio, coloque o pó até um volume graduado sem compactar, pese de novo, subtraia e divida. A proveta é mais precisa.</p>
                        <p><strong>Alternativa direta:</strong> encha 10 cápsulas na máquina, retire a casca, pese só o pó de cada uma, some e divida por 10. Esse número é o "Peso de Enchimento Real" que cabe no seu blend.</p>
                        <p className="text-amber-700">
                          Importante: use a densidade <strong>aparente</strong> (pó assentado, sem socar).
                          Se compactar/bater, você mede a densidade compactada, que é maior e superestima
                          quanto cabe — a encapsuladora enche por gravidade, sem soquete.
                        </p>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardDescription>
              </CardHeader>
            </Card>
          )}

          {formula.tipo_apresentacao === 'CAPSULA' && calculosIndustriais && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Scale className="h-4 w-4" />
                  Resumo da Cápsula
                </CardTitle>
                <CardDescription>
                  Padrão industrial 500mg alvo
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Barra de ocupação */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Ocupação de Ativos</span>
                    <span className={calculosIndustriais.excedeu_capacidade ? "text-destructive font-bold" : "font-medium"}>
                      {calculosIndustriais.ocupacao_percentual.toFixed(1)}%
                    </span>
                  </div>
                  <Progress 
                    value={Math.min(calculosIndustriais.ocupacao_percentual, 100)} 
                    className={calculosIndustriais.excedeu_capacidade ? "bg-destructive/20" : ""} 
                  />
                </div>

                <Separator />

                {/* Peso Alvo */}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Peso Alvo</span>
                  <span className="font-mono font-medium">{calculosIndustriais.peso_alvo_mg} mg</span>
                </div>

                {/* Total Ativos */}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Ativos</span>
                  <span className="font-mono">{calculosIndustriais.total_ativos_mg.toFixed(2)} mg</span>
                </div>

                <Separator />

                {/* EXCIPIENTES TECNOLÓGICOS FIXOS */}
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground font-medium flex items-center gap-2">
                    Excipientes Tecnológicos (FIXOS: {TOTAL_PERCENTUAL_TECNOLOGICOS}%)
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-3 w-3" />
                        </TooltipTrigger>
                        <TooltipContent side="left" className="max-w-xs">
                          <p className="text-xs">
                            Percentuais industriais fixos aplicados automaticamente em todas as cápsulas.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  
                  {calculosIndustriais.excipientes_tecnologicos.map((exc) => (
                    <div key={exc.nome} className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground">{exc.nome} ({exc.percentual}%)</span>
                      <span className="font-mono text-muted-foreground">{exc.quantidade_mg.toFixed(2)} mg</span>
                    </div>
                  ))}
                  
                  <div className="flex justify-between text-sm pt-1 border-t">
                    <span className="text-muted-foreground">Subtotal Tecnológicos</span>
                    <span className="font-mono">{calculosIndustriais.total_excipientes_tecnologicos_mg.toFixed(2)} mg</span>
                  </div>
                </div>

                <Separator />

                {/* VEÍCULO BASE (Q.S.P.) */}
                <div className="flex justify-between text-sm font-medium">
                  <span>Q.S.P. ({calculosIndustriais.veiculo_base_nome})</span>
                  <span className={`font-mono ${calculosIndustriais.qsp_negativo ? "text-destructive" : "text-secondary"}`}>
                    {calculosIndustriais.veiculo_base_mg.toFixed(2)} mg
                  </span>
                </div>

                {/* Alertas */}
                {calculosIndustriais.excedeu_capacidade && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      Peso excede a capacidade da cápsula!
                    </AlertDescription>
                  </Alert>
                )}

                {calculosIndustriais.qsp_negativo && !calculosIndustriais.excedeu_capacidade && (
                  <Alert className="bg-warning/10 border-warning">
                    <AlertTriangle className="h-4 w-4 text-warning" />
                    <AlertDescription className="text-xs">
                      Sem espaço para veículo base. Reduza ativos.
                    </AlertDescription>
                  </Alert>
                )}

                <Separator />

                <div className="text-xs text-muted-foreground">
                  <p><strong>Veículo:</strong> {getNomeVeiculoBase(formula.excipiente_padrao || 'AMIDO')}</p>
                  <p><strong>Cápsula:</strong> {formula.tipo_capsula}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {formula.tipo_apresentacao === 'CAPSULA' && capsulasPorDose && (
            <Card className={capsulasPorDose.nivel === 'error' ? 'border-red-200 bg-red-50/30' : capsulasPorDose.nivel === 'warning' ? 'border-amber-200 bg-amber-50/30' : 'border-green-200 bg-green-50/30'}>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Posologia Calculada
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded border p-3 text-sm">
                  <div className="font-medium mb-2">Dose: {capsulasPorDose.massa_ativos_mg} mg de ativos</div>
                  <div className="text-base font-bold">
                    → <strong>{capsulasPorDose.n_capsulas} cápsula(s)</strong> de ~{capsulasPorDose.peso_por_capsula_mg} mg cada
                  </div>
                  {capsulasPorDose.nivel !== 'ok' && (
                    <div className={capsulasPorDose.nivel === 'error' ? 'text-red-700 mt-2' : 'text-amber-700 mt-2'}>
                      {capsulasPorDose.mensagem}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* FASE 3: Custo Estimado */}
          {formula && itensLocal.length > 0 && (
            <Card className={custoFormula.parcial ? "border-amber-200 bg-amber-50/30" : "border-purple-200 bg-purple-50/30"}>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="h-4 w-4 text-purple-600" />
                  Custo Estimado (Material)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Aviso de custo parcial */}
                {custoFormula.parcial && (
                  <Alert className="border-amber-300 bg-amber-50">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-amber-800">
                      <strong>Custo Parcial</strong> — Faltam: {custoFormula.furos.join(", ")}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Tabela de ativos com custos */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2">Ativo</th>
                        <th className="text-right py-2">Massa (mg)</th>
                        <th className="text-right py-2">Custo/mg</th>
                        <th className="text-right py-2">Total</th>
                        <th className="text-left py-2">Data do Preço</th>
                      </tr>
                    </thead>
                    <tbody>
                      {custoFormula.linhas_ativos.map((linha, idx) => (
                        <tr key={idx} className={linha.furo ? "bg-red-50" : ""}>
                          <td className="text-left py-2 font-medium">{linha.nome}</td>
                          <td className="text-right py-2">{linha.massa_mg?.toFixed(2) || "-"}</td>
                          <td className="text-right py-2">
                            {linha.furo ? (
                              <span className="text-red-600 font-semibold text-xs">{linha.furo}</span>
                            ) : (
                              <span>{((linha.custo || 0) / (linha.massa_mg || 1)).toFixed(6)}</span>
                            )}
                          </td>
                          <td className="text-right py-2">
                            {linha.furo ? (
                              <Input
                                type="number"
                                step="0.0001"
                                placeholder="Digitar preço/mg"
                                className="w-24 text-xs border-red-300"
                                value={overridesPorItem[itensLocal.find(it => it.nome_insumo === linha.nome)?.id || ''] || ''}
                                onChange={(e) => {
                                  const item = itensLocal.find(it => it.nome_insumo === linha.nome);
                                  if (!item) return;
                                  const val = parseFloat(e.target.value);
                                  if (!isNaN(val) && val > 0) {
                                    setOverridesPorItem(prev => ({
                                      ...prev,
                                      [item.id]: val
                                    }));
                                  } else if (e.target.value === '') {
                                    setOverridesPorItem(prev => {
                                      const newOverrides = { ...prev };
                                      delete newOverrides[item.id];
                                      return newOverrides;
                                    });
                                  }
                                }}
                              />
                            ) : (
                              <span className="font-semibold">{linha.custo?.toFixed(4) || "-"}</span>
                            )}
                          </td>
                          <td className="text-left py-2 text-xs text-muted-foreground">
                            {linha.data_preco ? new Date(linha.data_preco).toLocaleDateString("pt-BR") : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Resumo de custos */}
                <div className="border-t pt-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Custo de Ativos:</span>
                    <span className="font-semibold">{custoFormula.custo_ativos_dose.toFixed(4)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Complementos (excipientes/cápsula/embalagem):</span>
                    <Input
                      type="number"
                      step="0.0001"
                      placeholder="Digitar custo"
                      className="w-32 text-xs"
                      value={custComplementosDose || ''}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setCustComplementosDose(isNaN(val) ? 0 : val);
                      }}
                    />
                  </div>
                  <div className="flex justify-between">
                    <span>Custo de Material:</span>
                    <span className="font-semibold">{custoFormula.custo_material_dose.toFixed(4)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Perda ({custoFormula.perda_pct}%):</span>
                    <span>{((custoFormula.custo_material_com_perda_dose - custoFormula.custo_material_dose).toFixed(4))}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2 font-bold">
                    <span>Custo por Dose (com perda):</span>
                    <span>{custoFormula.custo_material_com_perda_dose.toFixed(4)}</span>
                  </div>
                  {custoFormula.custo_por_pote !== null && (
                    <div className="flex justify-between border-t pt-2 font-bold text-purple-700">
                      <span>Custo por Pote:</span>
                      <span>{custoFormula.custo_por_pote.toFixed(2)}</span>
                    </div>
                  )}
                  {custoFormula.parcial && (
                    <div className="text-xs text-amber-700 italic pt-2">
                      * Total marcado como parcial — há itens sem preço
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {formula.tipo_apresentacao === 'CAPSULA' && (
            <Card className="border-blue-200 bg-blue-50/30">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Scale className="h-4 w-4 text-blue-600" />
                  Parâmetros do Misturador em V
                </CardTitle>
                <CardDescription>
                  Usados para calcular automaticamente o número de bateladas na OP.
                  Meça no laboratório antes de aprovar a fórmula.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="peso_enchimento_mg">
                      Peso de Enchimento Real (mg)
                      <span className="ml-1 text-xs text-muted-foreground">— pó apenas, sem cápsula vazia</span>
                    </Label>
                    <Input
                      id="peso_enchimento_mg"
                      type="number"
                      step="1"
                      min="100"
                      max="2000"
                      value={(formula as any).peso_enchimento_mg || (formula as any).peso_capsula_alvo_mg || CAPSULA_PESO_ALVO_MG}
                      onChange={async (e) => {
                        const val = parseFloat(e.target.value) || CAPSULA_PESO_ALVO_MG;
                        // Grava nos dois campos — peso_capsula_alvo_mg é o que
                        // alimenta o "Peso Alvo" exibido acima e o Q.S.P. da
                        // fórmula; peso_enchimento_mg alimenta a batelada da OP.
                        // Antes só este segundo era gravado aqui, então editar
                        // esse campo não atualizava o Peso Alvo mostrado nem
                        // o Q.S.P. real — os dois agora ficam sempre iguais.
                        await atualizarFormula(formula.id, {
                          peso_enchimento_mg: val,
                          peso_capsula_alvo_mg: val,
                        } as any);
                        refresh();
                      }}
                      disabled={isReadOnly}
                    />
                    <p className="text-xs text-muted-foreground">
                      Cápsula {formula.tipo_capsula}: cabe mais massa quanto maior a densidade do blend
                      (teto {validacaoCapsula?.teto_fisico_mg} mg na densidade atual). Para medir o real:
                      pese 10 cápsulas cheias, subtraia as cascas vazias e divida por 10 — não substitui a pesagem.
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
                      value={(formula as any).densidade_aparente_kg_l || 0.65}
                      onChange={async (e) => {
                        const val = parseFloat(e.target.value) || 0.65;
                        await atualizarFormula(formula.id, { densidade_aparente_kg_l: val });
                        refresh();
                      }}
                      disabled={isReadOnly}
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
                    Com esses dados o sistema calcula automaticamente quantas bateladas
                    cabem no Misturador em V 100L (máx. 65L úteis) ao criar uma OP.
                    Sem esses dados, usa o default de 0,65 kg/L.
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

          {/* Ativos críticos */}
          {ativosCriticos > 0 && (
            <Card className="border-destructive/50">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  Ativos Críticos ({ativosCriticos})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {itensLocal.filter(i => i.ativo_critico).map(item => (
                    <li key={item.id} className="flex items-center gap-2">
                      <div className="w-1 h-1 rounded-full bg-destructive" />
                      <span>{item.nome_insumo}</span>
                      <span className="text-muted-foreground font-mono text-xs">
                        ({item.quantidade_convertida_mg.toFixed(4)} mg)
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground mt-3">
                  Dupla conferência na pesagem recomendada.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Status */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm">
                {formula.status === 'RASCUNHO' && (
                  <>
                    <Badge variant="outline" className="bg-warning/10">Rascunho</Badge>
                    <span className="text-muted-foreground">Em edição</span>
                  </>
                )}
                {formula.status === 'APROVADA' && (
                  <>
                    <Badge variant="outline" className="bg-secondary/10 text-secondary">Aprovada</Badge>
                    <span className="text-muted-foreground">v{formula.versao}</span>
                  </>
                )}
                {formula.status === 'BLOQUEADA' && (
                  <Badge variant="destructive">Bloqueada</Badge>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
