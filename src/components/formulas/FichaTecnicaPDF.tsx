import { useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FileText, Printer, Download, AlertTriangle, Droplets } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FormulaIndustrial, CAPSULAS_CAPACIDADE } from "@/types/formulas-industrial";

interface FichaTecnicaPDFProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formula: FormulaIndustrial | null;
}

export function FichaTecnicaPDF({
  open,
  onOpenChange,
  formula,
}: FichaTecnicaPDFProps) {
  const capsInfo = useMemo(() => {
    if (!formula) return null;
    return CAPSULAS_CAPACIDADE[formula.tipo_capsula];
  }, [formula]);

  const handlePrint = () => {
    window.print();
  };

  if (!formula) return null;

  const totalCapsulas = formula.numero_doses * formula.capsulas_por_dose;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto print:max-w-none print:m-0 print:p-0">
        <DialogHeader className="print:hidden">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-secondary" />
            Ficha Técnica da Fórmula
          </DialogTitle>
        </DialogHeader>

        {/* Conteúdo da Ficha Técnica */}
        <div className="space-y-6 print:space-y-4 print:text-[10pt] print:p-8">
          {/* Cabeçalho */}
          <div className="border-b pb-4">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-2xl font-bold print:text-xl">{formula.nome}</h1>
                <p className="text-muted-foreground font-mono">{formula.codigo}</p>
              </div>
              <div className="text-right">
                <Badge variant="outline" className="font-mono">
                  Versão {formula.versao}
                </Badge>
                <p className="text-sm text-muted-foreground mt-1">
                  {format(new Date(formula.updated_at), "dd/MM/yyyy", { locale: ptBR })}
                </p>
              </div>
            </div>
          </div>

          {/* Informações Gerais */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:grid-cols-4">
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Produto</p>
              <p className="font-semibold">{formula.produto_nome || '-'}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Cápsula</p>
              <p className="font-semibold">{formula.tipo_capsula} ({formula.capacidade_alvo_mg}mg)</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Cápsulas/Dose</p>
              <p className="font-semibold">{formula.capsulas_por_dose}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Total de Cápsulas</p>
              <p className="font-semibold">{totalCapsulas} ({formula.numero_doses} doses)</p>
            </div>
          </div>

          <Separator />

          {/* Tabela de Ingredientes */}
          <div>
            <h2 className="text-lg font-semibold mb-3 print:text-base">Composição por Cápsula</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Ingrediente</TableHead>
                  <TableHead className="text-right">Dose</TableHead>
                  <TableHead className="text-right">Peso a Pesar</TableHead>
                  <TableHead className="text-right">Custo/Cáps</TableHead>
                  <TableHead className="text-center">Obs.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {formula.ingredientes.map((ing, idx) => (
                  <TableRow key={ing.id}>
                    <TableCell className="font-mono text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell>
                      <div>
                        <span className="font-medium">{ing.nome_interno}</span>
                        {ing.nome_rotulo !== ing.nome_interno && (
                          <p className="text-xs text-muted-foreground">{ing.nome_rotulo}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {ing.dose_por_capsula.toFixed(2)} {ing.unidade_dose}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      {ing.peso_a_pesar_mg.toFixed(2)} mg
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">
                      {ing.custo_por_capsula 
                        ? `R$ ${ing.custo_por_capsula.toFixed(4)}`
                        : '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      {ing.higroscopico && (
                        <span title="Higroscópico">
                          <Droplets className="h-4 w-4 text-primary inline" />
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                
                {/* Excipientes */}
                {formula.excipientes.map((exc) => (
                  <TableRow key={exc.id} className="bg-muted/30">
                    <TableCell></TableCell>
                    <TableCell>
                      <span className="text-muted-foreground">{exc.nome}</span>
                      {exc.tipo === 'QSP' && (
                        <Badge variant="outline" className="ml-2 text-xs">Q.S.P.</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">
                      {exc.tipo === 'PERCENTUAL_FIXO' && exc.valor_percentual
                        ? `${exc.valor_percentual}%`
                        : 'Q.S.P.'}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {exc.peso_mg.toFixed(2)} mg
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">
                      {exc.custo_por_capsula 
                        ? `R$ ${exc.custo_por_capsula.toFixed(4)}`
                        : '-'}
                    </TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                ))}

                {/* Totais */}
                <TableRow className="font-semibold border-t-2">
                  <TableCell colSpan={3} className="text-right">PESO TOTAL POR CÁPSULA:</TableCell>
                  <TableCell className="text-right font-mono">
                    {formula.peso_total_capsula_mg.toFixed(2)} mg
                  </TableCell>
                  <TableCell className="text-right font-mono text-primary">
                    R$ {formula.custo_total_capsula?.toFixed(4) || '0.0000'}
                  </TableCell>
                  <TableCell></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <Separator />

          {/* Resumo de Custos */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 print:grid-cols-3">
            <div className="bg-primary/10 rounded-lg p-4">
              <p className="text-xs text-muted-foreground">Peso Total/Cápsula</p>
              <p className="text-xl font-bold">{formula.peso_total_capsula_mg.toFixed(1)} mg</p>
              <p className="text-xs text-muted-foreground">
                Ocupação: {formula.percentual_ocupacao.toFixed(1)}%
              </p>
            </div>
            <div className="bg-secondary/10 rounded-lg p-4">
              <p className="text-xs text-muted-foreground">Custo por Cápsula</p>
              <p className="text-xl font-bold">
                R$ {formula.custo_total_capsula?.toFixed(4) || '0.0000'}
              </p>
            </div>
            <div className="bg-accent/10 rounded-lg p-4">
              <p className="text-xs text-muted-foreground">Custo Total do Lote</p>
              <p className="text-xl font-bold">
                R$ {formula.custo_total_lote?.toFixed(2) || '0.00'}
              </p>
              <p className="text-xs text-muted-foreground">
                {totalCapsulas} cápsulas
              </p>
            </div>
          </div>

          {/* Alertas */}
          {formula.alertas.length > 0 && (
            <>
              <Separator />
              <div>
                <h2 className="text-lg font-semibold mb-3 print:text-base flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-warning" />
                  Alertas e Observações
                </h2>
                <div className="space-y-2">
                  {formula.alertas.map((alerta, idx) => (
                    <div 
                      key={idx}
                      className={`p-3 rounded-lg border ${
                        alerta.severidade === 'error' 
                          ? 'bg-destructive/10 border-destructive/20' 
                          : alerta.severidade === 'warning'
                            ? 'bg-warning/10 border-warning/20'
                            : 'bg-muted/50'
                      }`}
                    >
                      <p className="font-medium text-sm">{alerta.mensagem}</p>
                      {alerta.sugestoes && alerta.sugestoes.length > 0 && (
                        <ul className="text-xs text-muted-foreground mt-1 list-disc list-inside">
                          {alerta.sugestoes.map((sug, i) => (
                            <li key={i}>{sug}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Rodapé */}
          <div className="text-xs text-muted-foreground border-t pt-4 print:fixed print:bottom-0 print:left-0 print:right-0 print:p-4 print:bg-background">
            <div className="flex justify-between">
              <span>Gerado em: {format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
              <span>{formula.codigo} • v{formula.versao}</span>
            </div>
          </div>
        </div>

        {/* Botões de ação */}
        <div className="flex justify-end gap-2 pt-4 print:hidden">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Imprimir
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
