// ============================================================
// FORMULADOR INDUSTRIAL - FICHA TÉCNICA PDF
// ============================================================

import { useMemo, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/use-company";
import { 
  FlaskConical, Scale, CheckCircle2, AlertTriangle, 
  FileText, Printer, Beaker
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RodapeBrainX } from "@/components/shared/RodapeBrainX";
import { APP_VERSION } from "@/lib/app-version";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  Formula, 
  FormulaItem, 
  TabelaNutricional,
} from "@/types/formulador-industrial";
import {
  calcularCapsulaIndustrial,
  calcularCapsulasPorDose,
  CodigoVeiculoBase,
  EXCIPIENTES_INDUSTRIAIS,
  CAPSULA_PESO_ALVO_MG,
  CAPSULA_TAMANHO_PADRAO,
  DENSIDADE_PADRAO_KG_L,
  type TamanhoCapsula,
} from "@/lib/formulador-industrial-rules";
import { formatarUnidadeInformada } from "@/lib/unidades-dose";
import { fmtMassaAtivos } from "@/lib/fmt-massa-ativos";
import { CAPSULA_CONST } from "@/lib/capsula-industrial-rpc";

interface FichaTecnicaPDFProps {
  formula: Formula;
  itens: FormulaItem[];
  tabela?: TabelaNutricional | null;
  trigger?: React.ReactNode;
}

export function FichaTecnicaPDF({ formula, itens, tabela, trigger }: FichaTecnicaPDFProps) {
  // Dados da empresa
  const { data: company } = useCompany();
  
  // Estado para nomes do aprovador e criador
  const [nomes, setNomes] = useState<{aprovador?: string; criador?: string}>({});
  
  // Buscar nomes a partir dos IDs de usuário
  useEffect(() => {
    const ids = [(formula as any).aprovado_por, (formula as any).criado_por].filter(Boolean);
    if (!ids.length) return;
    
    supabase
      .from('profiles')
      .select('id, nome_completo')
      .in('id', ids)
      .then(({ data }) => {
        const map = Object.fromEntries((data || []).map((p: any) => [p.id, p.nome_completo]));
        setNomes({
          aprovador: map[(formula as any).aprovado_por],
          criador: map[(formula as any).criado_por],
        });
      });
  }, [formula]);
  
  // Cálculos industriais
  const totalAtivos = useMemo(() => 
    itens.reduce((sum, i) => sum + (i.quantidade_convertida_mg || 0), 0),
    [itens]
  );
  
  // Dados para o rodapé
  const dataGeracao = new Date().toLocaleString('pt-BR');
  const aprovadoEm = formula.aprovado_em ? new Date(formula.aprovado_em).toLocaleDateString('pt-BR') : 'N/A';
  const aprovadoPor = nomes.aprovador || 'Não registrado';
  const criadoPor = nomes.criador || 'Sistema';
  const codigoFicha = formula.codigo_formula || 'FRM-XXXX';
  const versaoFicha = formula.versao || 1;
  
  const veiculoBase = (formula.excipiente_padrao || 'AMIDO') as CodigoVeiculoBase;
  // Preferir valores oficiais gravados na aprovação (fonte única RPC)
  const nCapsulasOficial = formula.n_capsulas_por_dose;
  const previewCapsulas = calcularCapsulasPorDose(
    totalAtivos,
    formula.densidade_aparente_kg_l || DENSIDADE_PADRAO_KG_L,
    (formula.tipo_capsula as TamanhoCapsula) || CAPSULA_TAMANHO_PADRAO,
  );
  const capsulasPorDose = {
    ...previewCapsulas,
    n_capsulas: nCapsulasOficial || previewCapsulas.n_capsulas,
    massa_ativos_mg: formula.massa_ativos_dose_mg || previewCapsulas.massa_ativos_mg,
    peso_por_capsula_mg: formula.peso_por_capsula_mg || previewCapsulas.peso_por_capsula_mg,
  };
  const massaTotalDose = capsulasPorDose.n_capsulas * capsulasPorDose.peso_por_capsula_mg;
  const calculos = calcularCapsulaIndustrial(totalAtivos, veiculoBase, massaTotalDose);
  const densidadeDefault =
    formula.densidade_aparente_kg_l == null ||
    Number(formula.densidade_aparente_kg_l) === CAPSULA_CONST.DENSIDADE_DEFAULT_KG_L;

  const handlePrint = () => {
    window.print();
  };

  const getTipoLabel = () => {
    switch (formula.tipo_apresentacao) {
      case "CAPSULA": return "Cápsula";
      case "LIQUIDO": return "Líquido";
      case "PO": return "Pó";
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline">
            <FileText className="h-4 w-4 mr-2" />
            Ficha Técnica
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto print:max-w-full print:max-h-full print:overflow-visible">
        <DialogHeader className="print:hidden">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5" />
              Ficha Técnica - {formula.codigo_formula}
            </DialogTitle>
            <Button onClick={handlePrint} size="sm">
              <Printer className="h-4 w-4 mr-2" />
              Imprimir
            </Button>
          </div>
        </DialogHeader>

        {/* Conteúdo para impressão */}
        <div className="print:p-8 space-y-6" id="ficha-tecnica">
          {/* Cabeçalho */}
          <div className="border-b pb-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold">{formula.codigo_formula}</h1>
                <p className="text-lg text-muted-foreground">{formula.nome_formula}</p>
              </div>
              <div className="text-right">
                <Badge className="bg-emerald-500 text-white mb-2">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  APROVADA
                </Badge>
                <p className="text-sm text-muted-foreground">
                  Versão {formula.versao}
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Tipo:</span>
                <p className="font-medium">{getTipoLabel()}</p>
              </div>
              {formula.tipo_apresentacao === 'CAPSULA' && (
                <>
                  <div>
                    <span className="text-muted-foreground">Cápsula:</span>
                    <p className="font-medium">{formula.tipo_capsula}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Blend total da dose:</span>
                    <p className="font-medium">{massaTotalDose.toFixed(1)} mg</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Cápsulas por dose:</span>
                    <p className="font-medium">{capsulasPorDose.n_capsulas} × {capsulasPorDose.peso_por_capsula_mg.toFixed(1)} mg</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Veículo:</span>
                    <p className="font-medium">{formula.excipiente_padrao}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Grupo populacional:</span>
                    <p className="font-medium">
                      {(formula as { grupo_populacional_alvo?: string }).grupo_populacional_alvo || "— (obrigatório)"}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Densidade:</span>
                    <p className="font-medium flex items-center gap-1">
                      {formula.densidade_aparente_kg_l || CAPSULA_CONST.DENSIDADE_DEFAULT_KG_L} kg/L
                      {densidadeDefault && (
                        <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-700">
                          Default — confirmar RT
                        </Badge>
                      )}
                    </p>
                  </div>
                </>
              )}
              {formula.tipo_apresentacao === 'LIQUIDO' && (
                <>
                  <div>
                    <span className="text-muted-foreground">Volume:</span>
                    <p className="font-medium">{formula.volume_frasco_ml} mL</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Doses/Frasco:</span>
                    <p className="font-medium">{formula.doses_por_frasco}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Gotas/Dose:</span>
                    <p className="font-medium">{formula.gotas_por_dose}</p>
                  </div>
                </>
              )}
              {formula.tipo_apresentacao === 'PO' && (
                <>
                  <div>
                    <span className="text-muted-foreground">Peso/Dose:</span>
                    <p className="font-medium">{formula.peso_por_dose_g} g</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Doses/Pote:</span>
                    <p className="font-medium">{formula.doses_por_pote}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Peso Total:</span>
                    <p className="font-medium">{formula.peso_total_pote_g} g</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Composição */}
          <div>
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Scale className="h-4 w-4" />
              Composição por Dose
            </h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead>Ingrediente</TableHead>
                  <TableHead className="text-right">Quantidade Declarada</TableHead>
                  <TableHead className="text-right">Quantidade (mg)</TableHead>
                  <TableHead className="text-center">Observações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itens.map((item, idx) => (
                  <TableRow key={item.id} className={item.ativo_critico ? "bg-red-50 dark:bg-red-950/20" : ""}>
                    <TableCell className="font-mono text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell className="font-medium">
                      {item.nome_insumo}
                      {item.exige_premix && (
                        <p className="text-[11px] text-muted-foreground font-normal mt-0.5">
                          como pré-mix: massa diluída ≈ {fmtMassaAtivos(item.quantidade_convertida_mg)} mg de ativo
                          × fator de diluição (RPC constituintes_candidatos_premix); valor exato na OP pela potência do lote.
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {item.quantidade_informada} {formatarUnidadeInformada(item.unidade_informada)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      {fmtMassaAtivos(item.quantidade_convertida_mg)}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center gap-1">
                        {item.ativo_critico && (
                          <Badge variant="destructive" className="text-xs">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Crítico
                          </Badge>
                        )}
                        {item.exige_premix && (
                          <Badge variant="outline" className="text-xs">Pré-mix</Badge>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                
                {formula.tipo_apresentacao === 'CAPSULA' && calculos.veiculo_base_mg > 0 && (
                  <TableRow className="bg-muted/50 font-medium">
                    <TableCell></TableCell>
                    <TableCell>
                      <span className="flex items-center gap-2">
                        <Beaker className="h-4 w-4 text-primary" />
                        {calculos.veiculo_base_nome} (Q.S.P.)
                      </span>
                    </TableCell>
                    <TableCell className="text-right">-</TableCell>
                    <TableCell className="text-right font-mono text-primary">
                      {calculos.veiculo_base_mg.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="text-xs">Veículo Base</Badge>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            {formula.tipo_apresentacao === 'CAPSULA' && (
              <div className="mt-4 p-3 bg-muted/30 rounded-lg text-sm">
                <div className="flex justify-between">
                  <span>Total de Ativos:</span>
                  <span className="font-mono font-medium">{fmtMassaAtivos(totalAtivos)} mg</span>
                </div>
                <div className="flex justify-between">
                  <span>Excipientes Tecnológicos (8%):</span>
                  <span className="font-mono font-medium">{calculos.total_excipientes_tecnologicos_mg.toFixed(2)} mg</span>
                </div>
                <div className="flex justify-between">
                  <span>Q.S.P. (Veículo Base):</span>
                  <span className="font-mono font-medium text-primary">{calculos.veiculo_base_mg.toFixed(2)} mg</span>
                </div>
                <div className="flex justify-between font-semibold border-t pt-2 mt-2">
                  <span>Peso Total da Dose ({capsulasPorDose.n_capsulas} cápsulas):</span>
                  <span className="font-mono">{massaTotalDose.toFixed(1)} mg</span>
                </div>
              </div>
            )}
          </div>

          {/* Excipientes Tecnológicos */}
          {formula.tipo_apresentacao === 'CAPSULA' && (
            <div>
              <Separator className="my-6" />
              <h2 className="text-lg font-semibold mb-3">Excipientes Tecnológicos (Padrão Industrial)</h2>
              <div className="grid grid-cols-3 gap-4 text-sm">
                {calculos.excipientes_tecnologicos.map((exc) => (
                  <div key={exc.nome} className="p-3 bg-muted/30 rounded-lg">
                    <p className="font-medium">{exc.nome}</p>
                    <p className="text-muted-foreground">{exc.funcao}</p>
                    <p className="font-mono mt-1">{exc.percentual}% = {exc.quantidade_mg.toFixed(2)} mg</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tabela Nutricional */}
          {tabela && tabela.tabela_json_padrao_anvisa && Array.isArray(tabela.tabela_json_padrao_anvisa) && tabela.tabela_json_padrao_anvisa.length > 0 && (
            <div>
              <Separator className="my-6" />
              <h2 className="text-lg font-semibold mb-3">
                Informação Nutricional
              </h2>
              <div className="border rounded-lg overflow-hidden max-w-md">
                <div className="bg-muted/50 p-3 border-b">
                  <p className="font-semibold">
                    Porção de {tabela.porcao} {tabela.porcao_unidade}
                  </p>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nutriente</TableHead>
                      <TableHead className="text-right">Qtd./Porção</TableHead>
                      <TableHead className="text-right">%VDR*</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(tabela.tabela_json_padrao_anvisa as any[]).map((nut: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell>{nut.nutriente}</TableCell>
                        <TableCell className="text-right font-mono">
                          {nut.quantidade} {nut.unidade}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {nut.vd || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="bg-muted/50 p-2 border-t text-xs text-muted-foreground">
                  *%VDR — percentual dos Valores de Referência Diários fornecidos pela porção.
                </div>
              </div>
            </div>
          )}

          {/* Observações Técnicas */}
          {formula.observacoes_tecnicas && (
            <div>
              <Separator className="my-6" />
              <h2 className="text-lg font-semibold mb-2">Observações Técnicas</h2>
              <p className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">
                {formula.observacoes_tecnicas}
              </p>
            </div>
          )}

          {/* Ativos Críticos */}
          {itens.filter(i => i.ativo_critico).length > 0 && (
            <div>
              <Separator className="my-6" />
              <div className="border border-destructive/30 bg-destructive/5 rounded-lg p-4">
                <h2 className="text-lg font-semibold mb-2 flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  Ativos Críticos - Dupla Conferência
                </h2>
                <ul className="text-sm space-y-1">
                  {itens.filter(i => i.ativo_critico).map(item => (
                    <li key={item.id} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-destructive"></span>
                      <span className="font-medium">{item.nome_insumo}</span>
                      <span className="text-muted-foreground">
                        ({fmtMassaAtivos(item.quantidade_convertida_mg)} mg)
                      </span>
                      {item.exige_premix && (
                        <Badge variant="outline" className="text-xs">Pré-mix</Badge>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Rodapé com Empresa + BrainX + RT + Aprovador */}
          <div className="border-t pt-4 mt-6 text-xs text-muted-foreground space-y-2">
            <div className="font-semibold text-gray-800">
              {company?.razao_social || 'Empresa'} · CNPJ: {company?.cnpj || 'N/A'}
            </div>
            <div>
              <RodapeBrainX versao={APP_VERSION} extra={dataGeracao} />
            </div>
            <div>
              RT: <span className="font-medium">{aprovadoPor !== '—' ? aprovadoPor : 'a definir'}</span>
              {(company as any)?.rt_conselho || (company as any)?.conselho_profissional
                ? ` · ${(company as any).rt_conselho || (company as any).conselho_profissional}`
                : ''}
              {(company as any)?.rt_registro || (company as any)?.registro_profissional
                ? ` nº ${(company as any).rt_registro || (company as any).registro_profissional}`
                : ''}
            </div>
            <div>
              Elaborado por: <span className="font-medium">{criadoPor}</span> ·
              Aprovado/Liberado por: <span className="font-medium">{aprovadoPor}</span> em {aprovadoEm}
            </div>
            <div>
              Ficha {codigoFicha} · Versão {versaoFicha}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
