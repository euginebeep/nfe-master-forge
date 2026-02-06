// ============================================================
// FORMULADOR INDUSTRIAL - EDITOR DE FÓRMULA
// Adicionar e gerenciar ativos com seleção de matéria-prima
// REGRAS INDUSTRIAIS DE EXCIPIENTES E PRÉ-MIX IMPLEMENTADAS
// ============================================================

import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { 
  ArrowLeft, FlaskConical, Save, Plus, Trash2, AlertTriangle, 
  CheckCircle, Scale, Percent, Beaker, GripVertical, Package, Info
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
  isAtivoCritico,
  sugerePremix,
  converterUIparaMG,
  converterMCGparaMG,
  calcularQSP,
  calcularPercentual,
  validarFormula,
} from "@/types/formulador-industrial";
import {
  calcularCapsulaIndustrial,
  calcularExcipientesTecnologicos,
  getNomeDiluente,
  gerarAlertasFormula,
  gerarDadosParaOP,
} from "@/lib/formulador-industrial-rules";
import { ItemSelector } from "@/components/formulador/ItemSelector";
import type { Item } from "@/types/erp";
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
    exige_premix: false,
  });
  const [saving, setSaving] = useState(false);
  const [aprovando, setAprovando] = useState(false);

  // Sincronizar itens quando carregar
  useEffect(() => {
    if (itens.length > 0) {
      setItensLocal(itens);
    }
  }, [itens]);

  // Cálculos da cápsula - MODELO INDUSTRIAL COMPLETO
  const calculosIndustriais = useMemo(() => {
    if (!formula || formula.tipo_apresentacao !== 'CAPSULA') {
      return null;
    }

    const pesoAlvo = formula.peso_capsula_alvo_mg || 490;
    const totalAtivos = itensLocal.reduce((sum, i) => sum + (i.quantidade_convertida_mg || 0), 0);
    const diluenteNome = getNomeDiluente(formula.excipiente_padrao || 'AMIDO');
    
    // Usar cálculo industrial que considera excipientes tecnológicos
    return calcularCapsulaIndustrial(pesoAlvo, totalAtivos, diluenteNome);
  }, [formula, itensLocal]);

  // Manter objeto legado para compatibilidade com UI existente
  const calculos = useMemo(() => {
    if (!calculosIndustriais) return null;
    
    return {
      pesoAlvo: calculosIndustriais.peso_alvo_mg,
      totalAtivos: calculosIndustriais.total_ativos_mg,
      totalExcipientesTecnologicos: calculosIndustriais.total_excipientes_tecnologicos_mg,
      excipientesTecnologicos: calculosIndustriais.excipientes_tecnologicos,
      qsp: calculosIndustriais.diluente_principal_mg,
      diluenteNome: calculosIndustriais.diluente_principal_nome,
      ocupacao: calculosIndustriais.ocupacao_percentual,
      excedeu: calculosIndustriais.excedeu_capacidade,
    };
  }, [calculosIndustriais]);

  // Contadores para alertas
  const ativosCriticos = itensLocal.filter(i => i.ativo_critico).length;
  const ativosComSugestaoPremix = itensLocal.filter(i => {
    const sugestao = sugerePremix(i.quantidade_convertida_mg, i.unidade_informada, false);
    return sugestao.sugerido && !i.exige_premix; // Só conta se não está marcado
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
        toast.error(`Fator de conversão não encontrado para "${novoItem.nome_insumo}". Cadastre em Conversões de Unidades.`);
        return;
      }
    }

    const quantidadeConvertida = converterParaMG(
      novoItem.quantidade_informada,
      novoItem.unidade_informada,
      novoItem.nome_insumo
    );

    // FLAG AUTOMÁTICA: Ativo crítico (não editável pelo usuário)
    const ativoCritico = isAtivoCritico(quantidadeConvertida, novoItem.unidade_informada);
    
    // SUGESTÃO DE PRÉ-MIX: Apenas informativa, checkbox permanece como usuário definiu
    // REGRA INDUSTRIAL: NÃO marcar automaticamente, apenas sugerir
    const sugestaoPremix = sugerePremix(quantidadeConvertida, novoItem.unidade_informada, false);
    
    if (sugestaoPremix.sugerido && !novoItem.exige_premix) {
      // Mostrar sugestão como alerta informativo, não impositivo
      toast.info(`Sugestão: Pré-mix recomendado para ${novoItem.nome_insumo} (${sugestaoPremix.motivo})`);
    }

    // IMPORTANTE: Se o item veio do localStorage (hybrid), não pode enviar o ID como FK
    // porque não existe na tabela itens do Supabase. Enviar null e manter apenas o nome.
    const item = await adicionar({
      formula_id: id,
      nome_insumo: novoItem.nome_insumo,
      produto_materia_prima_id: null, // Sempre null para evitar erro de FK com itens locais
      quantidade_informada: novoItem.quantidade_informada,
      unidade_informada: novoItem.unidade_informada,
      quantidade_convertida_mg: quantidadeConvertida,
      ativo_critico: ativoCritico, // FLAG automática
      exige_premix: novoItem.exige_premix, // NÃO automático - usuário decide
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

    // Validar
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
                disabled={aprovando || calculos?.excedeu}
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
                {/* Linha 1: Seletor de Matéria-prima OU Nome manual */}
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
                    <p className="text-xs text-muted-foreground">
                      Preenchido automaticamente ou digite manualmente
                    </p>
                  </div>
                </div>

                {/* Linha 2: Quantidade, Unidade, Pré-mix e Botão */}
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
                            Marque se o ativo requer diluição prévia com excipiente.
                            O sistema sugere quando detecta dosagens críticas.
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
                  <Alert className="mt-4 bg-muted/50">
                    <Beaker className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      <strong>Conversão UI:</strong> O sistema buscará o fator de conversão UI→mg 
                      automaticamente. Certifique-se de que a substância está cadastrada em Conversões de Unidades.
                    </AlertDescription>
                  </Alert>
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
                  Nenhum ativo adicionado. Adicione pelo menos um ativo para prosseguir.
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
                            {/* Sugestão de pré-mix (informativo) */}
                            {!item.exige_premix && sugerePremix(item.quantidade_convertida_mg, item.unidade_informada, false).sugerido && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <Badge variant="secondary" className="text-xs bg-muted text-muted-foreground">
                                      <Info className="h-3 w-3 mr-1" />
                                      Sugestão
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="text-xs">Pré-mix recomendado: {sugerePremix(item.quantidade_convertida_mg, item.unidade_informada, false).motivo}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
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
          {formula.tipo_apresentacao === 'CAPSULA' && calculos && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Scale className="h-4 w-4" />
                  Resumo da Cápsula
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Ocupação</span>
                    <span className={calculos.excedeu ? "text-destructive font-bold" : "font-medium"}>
                      {calculos.ocupacao.toFixed(1)}%
                    </span>
                  </div>
                  <Progress 
                    value={Math.min(calculos.ocupacao, 100)} 
                    className={calculos.excedeu ? "bg-destructive/20" : ""} 
                  />
                </div>

                <Separator />

                {/* RESUMO INDUSTRIAL COMPLETO */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Peso Alvo</span>
                    <span className="font-mono">{calculos.pesoAlvo} mg</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Ativos</span>
                    <span className="font-mono">{calculos.totalAtivos.toFixed(2)} mg</span>
                  </div>
                  
                  <Separator className="my-2" />
                  
                  {/* GRUPO A - Excipientes Tecnológicos */}
                  <div className="text-xs text-muted-foreground font-medium">
                    Excipientes Tecnológicos (automático):
                  </div>
                  {calculos.excipientesTecnologicos.map((exc) => (
                    <div key={exc.nome} className="flex justify-between text-xs text-muted-foreground pl-2">
                      <span>{exc.nome} ({exc.percentual}%)</span>
                      <span className="font-mono">{exc.quantidade_mg.toFixed(2)} mg</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal Tecnológicos</span>
                    <span className="font-mono">{calculos.totalExcipientesTecnologicos.toFixed(2)} mg</span>
                  </div>
                  
                  <Separator className="my-2" />
                  
                  {/* GRUPO B - Diluente Principal (Q.S.P.) */}
                  <div className="flex justify-between text-sm font-medium">
                    <span>Q.S.P. ({calculos.diluenteNome})</span>
                    <span className={`font-mono ${calculos.qsp <= 0 ? "text-destructive" : "text-secondary"}`}>
                      {calculos.qsp.toFixed(2)} mg
                    </span>
                  </div>
                </div>

                {calculos.excedeu && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      O peso dos ativos + excipientes excede a capacidade da cápsula!
                    </AlertDescription>
                  </Alert>
                )}

                {calculos.qsp <= 0 && !calculos.excedeu && (
                  <Alert className="bg-warning/10 border-warning">
                    <AlertTriangle className="h-4 w-4 text-warning" />
                    <AlertDescription className="text-xs">
                      Não há espaço para o diluente principal. Considere reduzir ativos.
                    </AlertDescription>
                  </Alert>
                )}

                <Separator />

                <div className="text-xs text-muted-foreground">
                  <p><strong>Diluente:</strong> {getNomeDiluente(formula.excipiente_padrao || 'AMIDO')}</p>
                  <p><strong>Tipo:</strong> Cápsula {formula.tipo_capsula}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Ativos críticos */}
          {itensLocal.filter(i => i.ativo_critico).length > 0 && (
            <Card className="border-destructive/50">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  Ativos Críticos
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
                  Ativos críticos exigem dupla conferência na pesagem. 
                  Pré-blend é <strong>recomendado</strong>, mas opcional.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Info do status */}
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
                  <>
                    <Badge variant="destructive">Bloqueada</Badge>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
