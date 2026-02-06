// ============================================================
// FORMULADOR INDUSTRIAL - EDITOR DE FÓRMULA
// VERSÃO DEFINITIVA - REGRAS INDUSTRIAIS FIXAS
// ============================================================

import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { 
  ArrowLeft, FlaskConical, Save, Plus, Trash2, AlertTriangle, 
  CheckCircle, Scale, Percent, Beaker, Package, Info, BookOpen
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
} from "@/lib/formulador-industrial-rules";
import { ItemSelector } from "@/components/formulador/ItemSelector";
import { ConsultaRegulatoriaANVISA } from "@/components/formulador/ConsultaRegulatoriaANVISA";
import { toast } from "sonner";

export default function EditarFormulaPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { formula, itens, loading, refresh } = useFormula(id);
  const { atualizar: atualizarFormula } = useFormulaCRUD();
  const { adicionar, atualizar, remover } = useFormulaItensCRUD();
  const { conversoes, buscarFator } = useConversoesUnidades();
  const { aprovar } = useAprovarFormula();

  // Estado local dos itens
  const [itensLocal, setItensLocal] = useState<FormulaItem[]>([]);
  const [novoItem, setNovoItem] = useState({
    nome_insumo: "",
    produto_materia_prima_id: null as string | null,
    quantidade_informada: 0,
    unidade_informada: "MG" as UnidadeInformada,
    exige_premix: false, // SEMPRE DESMARCADO por padrão
  });
  const [saving, setSaving] = useState(false);
  const [aprovando, setAprovando] = useState(false);

  // Sincronizar itens quando carregar
  useEffect(() => {
    if (itens.length > 0) {
      setItensLocal(itens);
    }
  }, [itens]);

  // CÁLCULOS INDUSTRIAIS COM REGRAS FIXAS
  const calculosIndustriais = useMemo(() => {
    if (!formula || formula.tipo_apresentacao !== 'CAPSULA') {
      return null;
    }

    const pesoAlvo = formula.peso_capsula_alvo_mg || 490;
    const totalAtivos = itensLocal.reduce((sum, i) => sum + (i.quantidade_convertida_mg || 0), 0);
    const veiculoBase = (formula.excipiente_padrao || 'AMIDO') as CodigoVeiculoBase;
    
    return calcularCapsulaIndustrial(totalAtivos, veiculoBase, pesoAlvo);
  }, [formula, itensLocal]);

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

    // Verificar fator de conversão para UI
    if (novoItem.unidade_informada === 'UI') {
      const fator = buscarFator(novoItem.nome_insumo);
      if (!fator) {
        toast.error(
          `Fator de conversão UI→mg não encontrado para "${novoItem.nome_insumo}". ` +
          `Cadastre o fator em: Produção → Formulador → Conversões de Unidades. ` +
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
      ativo_critico: ativoCritico,
      exige_premix: novoItem.exige_premix,
      ordem_mistura: itensLocal.length,
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
      const resultado = await aprovar(formula, itensLocal);
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
                disabled={aprovando || calculosIndustriais?.excedeu_capacidade}
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
                            ⚠️ Se o fator não estiver cadastrado, vá em:<br/>
                            <span className="font-mono bg-muted px-1 rounded">Produção → Formulador → Conversões de Unidades</span>
                          </p>
                          <p className="text-muted-foreground">
                            Cadastre o fator UI/mg do seu insumo específico (consulte o laudo/COA do fornecedor).
                          </p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </CardContent>
            </Card>
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
                            {item.ativo_critico && (
                              <Badge variant="destructive" className="text-xs">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Crítico
                              </Badge>
                            )}
                            {item.exige_premix && (
                              <Badge variant="outline" className="text-xs">
                                Pré-mix
                              </Badge>
                            )}
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
          {formula.tipo_apresentacao === 'CAPSULA' && calculosIndustriais && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Scale className="h-4 w-4" />
                  Resumo da Cápsula
                </CardTitle>
                <CardDescription>
                  Padrão industrial 500mg / 490mg alvo
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
