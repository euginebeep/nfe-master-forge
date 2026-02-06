// ============================================================
// FORMULADOR INDUSTRIAL - FICHA TÉCNICA PDF
// Geração de documento de fórmula aprovada com tabela nutricional
// ============================================================

import { useMemo } from "react";
import { 
  FlaskConical, Scale, CheckCircle2, AlertTriangle, 
  FileText, Printer, Beaker
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
  calcularQSP,
} from "@/types/formulador-industrial";

interface FichaTecnicaPDFProps {
  formula: Formula;
  itens: FormulaItem[];
  tabela?: TabelaNutricional | null;
  trigger?: React.ReactNode;
}

export function FichaTecnicaPDF({ formula, itens, tabela, trigger }: FichaTecnicaPDFProps) {
  // Cálculos
  const totalAtivos = useMemo(() => 
    itens.reduce((sum, i) => sum + (i.quantidade_convertida_mg || 0), 0),
    [itens]
  );
  
  const pesoAlvo = formula.peso_capsula_alvo_mg || 490;
  const qsp = calcularQSP(pesoAlvo, totalAtivos);

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
                    <span className="text-muted-foreground">Peso Alvo:</span>
                    <p className="font-medium">{pesoAlvo} mg</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Excipiente:</span>
                    <p className="font-medium">{formula.excipiente_padrao}</p>
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
                    <TableCell className="font-medium">{item.nome_insumo}</TableCell>
                    <TableCell className="text-right font-mono">
                      {item.quantidade_informada} {item.unidade_informada.toLowerCase()}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      {item.quantidade_convertida_mg.toFixed(4)}
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
                
                {formula.tipo_apresentacao === 'CAPSULA' && qsp > 0 && (
                  <TableRow className="bg-muted/50 font-medium">
                    <TableCell></TableCell>
                    <TableCell>
                      <span className="flex items-center gap-2">
                        <Beaker className="h-4 w-4 text-primary" />
                        {formula.excipiente_padrao} (Q.S.P.)
                      </span>
                    </TableCell>
                    <TableCell className="text-right">-</TableCell>
                    <TableCell className="text-right font-mono text-primary">
                      {qsp.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="text-xs">Excipiente</Badge>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            {formula.tipo_apresentacao === 'CAPSULA' && (
              <div className="mt-4 p-3 bg-muted/30 rounded-lg text-sm">
                <div className="flex justify-between">
                  <span>Total de Ativos:</span>
                  <span className="font-mono font-medium">{totalAtivos.toFixed(2)} mg</span>
                </div>
                <div className="flex justify-between">
                  <span>Q.S.P. (Excipiente):</span>
                  <span className="font-mono font-medium text-primary">{qsp.toFixed(2)} mg</span>
                </div>
                <div className="flex justify-between font-semibold border-t pt-2 mt-2">
                  <span>Peso Total da Cápsula:</span>
                  <span className="font-mono">{pesoAlvo} mg</span>
                </div>
              </div>
            )}
          </div>

          {/* Tabela Nutricional (se existir) */}
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
                      <TableHead className="text-right">%VD*</TableHead>
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
                  *% Valores Diários de referência com base em uma dieta de 2.000 kcal.
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
                  Ativos Críticos - Atenção Industrial
                </h2>
                <ul className="text-sm space-y-1">
                  {itens.filter(i => i.ativo_critico).map(item => (
                    <li key={item.id} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-destructive"></span>
                      <span className="font-medium">{item.nome_insumo}</span>
                      <span className="text-muted-foreground">
                        ({item.quantidade_convertida_mg.toFixed(4)} mg)
                      </span>
                      {item.exige_premix && (
                        <Badge variant="outline" className="text-xs">Requer pré-mix</Badge>
                      )}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground mt-3">
                  Ativos críticos (&lt;1mg ou UI/MCG) requerem pesagem de precisão e/ou pré-mistura.
                </p>
              </div>
            </div>
          )}

          {/* Rodapé */}
          <div className="border-t pt-4 mt-6 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <div>
                <p>Aprovado em: {formula.aprovado_em ? new Date(formula.aprovado_em).toLocaleString('pt-BR') : '-'}</p>
                <p>Gerado em: {new Date().toLocaleString('pt-BR')}</p>
              </div>
              <div className="text-right">
                <p>Documento gerado automaticamente</p>
                <p>Formulador Industrial - Sistema ERP</p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
