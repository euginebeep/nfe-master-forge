// ============================================================
// FORMULADOR INDUSTRIAL - VISUALIZAÇÃO TÉCNICA
// ============================================================

import { useNavigate, useParams } from "react-router-dom";
import { 
  ArrowLeft, FlaskConical, Edit, FileText, CheckCircle, 
  AlertTriangle, Scale, Clock, History, Download
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  useFormula, 
  useFormulaHistorico,
  useOPsGeradas,
  useTabelaNutricional,
} from "@/hooks/use-formulador-industrial";
import { StatusFormula, TipoApresentacao } from "@/types/formulador-industrial";
import { calcularCapsulaIndustrial, CodigoVeiculoBase } from "@/lib/formulador-industrial-rules";
import { FichaTecnicaPDF } from "@/components/formulador/FichaTecnicaPDF";

export default function VisualizarFormulaPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { formula, itens, loading } = useFormula(id);
  const { versoes } = useFormulaHistorico(id);
  const { ops } = useOPsGeradas(id);
  const { tabela } = useTabelaNutricional(id);

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

  const getStatusVariant = (status: StatusFormula) => {
    switch (status) {
      case "APROVADA": return "success";
      case "BLOQUEADA": return "destructive";
      default: return "warning";
    }
  };

  const getTipoLabel = (tipo: TipoApresentacao) => {
    switch (tipo) {
      case "CAPSULA": return "Cápsula";
      case "LIQUIDO": return "Líquido";
      case "PO": return "Pó";
    }
  };

  // Cálculos industriais
  const totalAtivos = itens.reduce((sum, i) => sum + (i.quantidade_convertida_mg || 0), 0);
  const pesoAlvo = formula.peso_capsula_alvo_mg || 490;
  const veiculoBase = (formula.excipiente_padrao || 'AMIDO') as CodigoVeiculoBase;
  const calculos = calcularCapsulaIndustrial(totalAtivos, veiculoBase, pesoAlvo);

  return (
    <div>
      <PageHeader
        title={formula.codigo_formula}
        description={formula.nome_formula}
        icon={FlaskConical}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/producao/formulas")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            {formula.status === 'APROVADA' && (
              <FichaTecnicaPDF 
                formula={formula} 
                itens={itens} 
                tabela={tabela}
              />
            )}
            {formula.status === 'RASCUNHO' && (
              <Button onClick={() => navigate(`/producao/formulas/${id}/editar`)}>
                <Edit className="h-4 w-4 mr-2" />
                Editar
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Info principal */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Informações Técnicas</CardTitle>
              <StatusBadge variant={getStatusVariant(formula.status) as any}>
                {formula.status === 'APROVADA' && <CheckCircle className="h-3 w-3 mr-1" />}
                {formula.status}
              </StatusBadge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase">Tipo</p>
                <p className="font-medium">{getTipoLabel(formula.tipo_apresentacao)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase">Versão</p>
                <p className="font-medium font-mono">v{formula.versao}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase">Total Ativos</p>
                <p className="font-medium">{itens.length}</p>
              </div>
            </div>

            {formula.tipo_apresentacao === 'CAPSULA' && (
              <>
                <Separator className="my-4" />
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Cápsula</p>
                    <p className="font-medium">{formula.tipo_capsula}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Peso Alvo</p>
                    <p className="font-medium font-mono">{pesoAlvo} mg</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Q.S.P.</p>
                    <p className="font-medium font-mono text-secondary">{calculos.veiculo_base_mg.toFixed(2)} mg</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Veículo</p>
                    <p className="font-medium">{formula.excipiente_padrao}</p>
                  </div>
                </div>
              </>
            )}

            {formula.tipo_apresentacao === 'LIQUIDO' && (
              <>
                <Separator className="my-4" />
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Volume Frasco</p>
                    <p className="font-medium font-mono">{formula.volume_frasco_ml} mL</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Volume/Dose</p>
                    <p className="font-medium font-mono">{formula.volume_por_dose_ml} mL</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Doses/Frasco</p>
                    <p className="font-medium font-mono">{formula.doses_por_frasco}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Gotas/Dose</p>
                    <p className="font-medium font-mono">{formula.gotas_por_dose}</p>
                  </div>
                </div>
              </>
            )}

            {formula.tipo_apresentacao === 'PO' && (
              <>
                <Separator className="my-4" />
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Peso/Dose</p>
                    <p className="font-medium font-mono">{formula.peso_por_dose_g} g</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Doses/Pote</p>
                    <p className="font-medium font-mono">{formula.doses_por_pote}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Peso Total</p>
                    <p className="font-medium font-mono">{formula.peso_total_pote_g} g</p>
                  </div>
                </div>
              </>
            )}

            {formula.observacoes_tecnicas && (
              <>
                <Separator className="my-4" />
                <div>
                  <p className="text-xs text-muted-foreground uppercase mb-2">Observações Técnicas</p>
                  <p className="text-sm">{formula.observacoes_tecnicas}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Auditoria */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Auditoria
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground uppercase">Criado em</p>
              <p>{formula.criado_em ? new Date(formula.criado_em).toLocaleString('pt-BR') : '-'}</p>
            </div>
            {formula.aprovado_em && (
              <div>
                <p className="text-xs text-muted-foreground uppercase">Aprovado em</p>
                <p>{new Date(formula.aprovado_em).toLocaleString('pt-BR')}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground uppercase">Última atualização</p>
              <p>{formula.updated_at ? new Date(formula.updated_at).toLocaleString('pt-BR') : '-'}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="ativos" className="space-y-4">
        <TabsList>
          <TabsTrigger value="ativos">
            <Scale className="h-4 w-4 mr-2" />
            Ativos
          </TabsTrigger>
          <TabsTrigger value="ops">
            <FileText className="h-4 w-4 mr-2" />
            OPs Geradas
          </TabsTrigger>
          <TabsTrigger value="historico">
            <History className="h-4 w-4 mr-2" />
            Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ativos">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Insumo</TableHead>
                    <TableHead className="text-right">Qtd. Informada</TableHead>
                    <TableHead className="text-right">Convertido (mg)</TableHead>
                    <TableHead className="text-center">Flags</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itens.map((item, index) => (
                    <TableRow key={item.id} className={item.ativo_critico ? "bg-destructive/5" : ""}>
                      <TableCell className="font-mono text-muted-foreground">{index + 1}</TableCell>
                      <TableCell className="font-medium">{item.nome_insumo}</TableCell>
                      <TableCell className="text-right font-mono">
                        {item.quantidade_informada} {item.unidade_informada.toLowerCase()}
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        {item.quantidade_convertida_mg.toFixed(4)} mg
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
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ops">
          <Card>
            <CardContent className="p-0">
              {ops.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  Nenhuma OP gerada para esta fórmula.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ops.map((op) => (
                      <TableRow key={op.id}>
                        <TableCell className="font-mono font-medium">{op.op_codigo}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{op.tipo_documento}</Badge>
                        </TableCell>
                        <TableCell>
                          {op.data_geracao ? new Date(op.data_geracao).toLocaleDateString('pt-BR') : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost">
                            <Download className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historico">
          <Card>
            <CardContent className="p-0">
              {versoes.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  Nenhuma versão registrada ainda.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Versão</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Motivo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {versoes.map((v) => (
                      <TableRow key={v.id}>
                        <TableCell className="font-mono">v{v.versao}</TableCell>
                        <TableCell>
                          {v.alterado_em ? new Date(v.alterado_em).toLocaleString('pt-BR') : '-'}
                        </TableCell>
                        <TableCell>{v.motivo_alteracao || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
