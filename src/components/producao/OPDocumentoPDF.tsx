import { useRef } from 'react';
import { 
  FileText, Printer, Factory, Scale, FlaskConical, 
  AlertTriangle, CheckCircle, Users, Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { OrdemProducaoIndustrial, ORDEM_MISTURA_INDUSTRIAL } from '@/types/ordem-producao-industrial';

interface OPDocumentoPDFProps {
  op: OrdemProducaoIndustrial;
}

export function OPDocumentoPDF({ op }: OPDocumentoPDFProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>OP ${op.codigo}</title>
          <style>
            @page { size: A4; margin: 15mm; }
            body { 
              font-family: 'Segoe UI', Arial, sans-serif; 
              font-size: 11px; 
              line-height: 1.4;
              color: #1a1a1a;
            }
            .header { 
              display: flex; 
              justify-content: space-between; 
              align-items: center;
              border-bottom: 2px solid #333;
              padding-bottom: 10px;
              margin-bottom: 15px;
            }
            .header h1 { font-size: 18px; margin: 0; }
            .header .codigo { font-size: 14px; color: #666; }
            .section { margin-bottom: 15px; }
            .section-title { 
              font-size: 12px; 
              font-weight: 600; 
              background: #f0f0f0; 
              padding: 5px 10px;
              margin-bottom: 8px;
              border-left: 3px solid #333;
            }
            .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
            .grid-4 { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 10px; }
            .info-box { padding: 8px; background: #fafafa; border: 1px solid #e0e0e0; }
            .info-box label { font-size: 9px; color: #666; text-transform: uppercase; }
            .info-box .value { font-size: 12px; font-weight: 600; }
            table { width: 100%; border-collapse: collapse; font-size: 10px; }
            th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
            th { background: #f5f5f5; font-weight: 600; }
            .critico { background: #fff3cd !important; }
            .critico-badge { 
              background: #dc3545; 
              color: white; 
              padding: 2px 6px; 
              border-radius: 3px; 
              font-size: 9px;
              font-weight: 600;
            }
            .ordem-num { 
              display: inline-block; 
              width: 24px; 
              height: 24px; 
              background: #333; 
              color: white; 
              text-align: center; 
              line-height: 24px; 
              border-radius: 50%;
              font-weight: 600;
            }
            .assinatura-box {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 20px;
              margin-top: 30px;
            }
            .assinatura {
              border-top: 1px solid #333;
              padding-top: 5px;
              text-align: center;
              font-size: 10px;
            }
            .alerta {
              background: #fff3cd;
              border: 1px solid #ffc107;
              padding: 10px;
              margin-bottom: 15px;
            }
            .alerta-titulo { font-weight: 600; color: #856404; }
            .diluicao-passo {
              display: flex;
              align-items: center;
              gap: 10px;
              padding: 8px;
              background: #f8f9fa;
              margin-bottom: 5px;
              border-left: 3px solid #17a2b8;
            }
            @media print {
              .no-print { display: none !important; }
            }
          </style>
        </head>
        <body>
          ${content.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const itensCriticos = op.itens_pesagem.filter(i => i.tipo_pesagem === 'CRITICA');

  return (
    <div>
      <Button onClick={handlePrint} variant="outline" className="mb-4">
        <Printer className="h-4 w-4 mr-2" />
        Imprimir OP
      </Button>

      <div ref={printRef} className="bg-white p-6 text-sm">
        {/* Cabeçalho */}
        <div className="flex justify-between items-start border-b-2 border-foreground pb-4 mb-6">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Factory className="h-5 w-5" />
              ORDEM DE PRODUÇÃO INDUSTRIAL
            </h1>
            <p className="text-muted-foreground">{op.produto_nome}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-mono font-bold">{op.codigo}</p>
            <p className="text-sm text-muted-foreground">
              Fórmula: {op.formula_codigo} v{op.formula_versao}
            </p>
          </div>
        </div>

        {/* Informações Gerais */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="p-3 bg-muted rounded">
            <p className="text-xs text-muted-foreground uppercase">Quantidade</p>
            <p className="text-lg font-bold">{op.quantidade_com_acrescimo.toLocaleString()}</p>
            <p className="text-xs">({op.quantidade_planejada} + {op.acrescimo_producao_percentual}%)</p>
          </div>
          <div className="p-3 bg-muted rounded">
            <p className="text-xs text-muted-foreground uppercase">Lote PA</p>
            <p className="text-lg font-bold font-mono">{op.lote_produto_acabado}</p>
          </div>
          <div className="p-3 bg-muted rounded">
            <p className="text-xs text-muted-foreground uppercase">Data Fabricação</p>
            <p className="text-lg font-bold">
              {op.data_fabricacao ? new Date(op.data_fabricacao).toLocaleDateString('pt-BR') : '-'}
            </p>
          </div>
          <div className="p-3 bg-muted rounded">
            <p className="text-xs text-muted-foreground uppercase">Responsável</p>
            <p className="text-lg font-bold">{op.responsavel_tecnico || '-'}</p>
          </div>
        </div>

        {/* Alerta de Ativos Críticos */}
        {itensCriticos.length > 0 && (
          <div className="bg-warning/20 border border-warning p-4 rounded mb-6">
            <div className="flex items-center gap-2 font-bold text-warning mb-2">
              <AlertTriangle className="h-5 w-5" />
              ATENÇÃO: {itensCriticos.length} ATIVO(S) CRÍTICO(S)
            </div>
            <p className="text-sm">
              Os itens marcados como CRÍTICOS exigem DUPLA CONFERÊNCIA na pesagem.
              Seguir procedimento de distribuição geométrica quando aplicável.
            </p>
          </div>
        )}

        {/* Procedimento de Distribuição Geométrica */}
        {op.procedimentos_diluicao.length > 0 && (
          <Card className="mb-6 border-info">
            <CardHeader className="py-3 bg-info/10">
              <CardTitle className="text-sm flex items-center gap-2">
                <FlaskConical className="h-4 w-4" />
                PROCEDIMENTO DE DILUIÇÃO GEOMÉTRICA
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {op.procedimentos_diluicao.map((proc, idx) => (
                <div key={idx} className="mb-4 last:mb-0">
                  <p className="font-medium mb-2">
                    {proc.ativo_nome} ({proc.quantidade_ativo_mg.toFixed(4)} mg)
                  </p>
                  <div className="space-y-2">
                    {proc.passos.map((passo) => (
                      <div key={passo.passo} className="flex items-center gap-3 p-2 bg-muted rounded text-xs">
                        <span className="w-6 h-6 rounded-full bg-foreground text-background flex items-center justify-center font-bold">
                          {passo.passo}
                        </span>
                        <div className="flex-1">
                          <p>{passo.descricao}</p>
                          {passo.observacao && (
                            <p className="text-muted-foreground">{passo.observacao}</p>
                          )}
                        </div>
                        <Badge variant="outline">{passo.proporcao}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Lista de Pesagem */}
        <Card className="mb-6">
          <CardHeader className="py-3 bg-muted">
            <CardTitle className="text-sm flex items-center gap-2">
              <Scale className="h-4 w-4" />
              LISTA DE PESAGEM - ORDEM INDUSTRIAL
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Ordem</TableHead>
                  <TableHead>Insumo</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-center">Tipo</TableHead>
                  <TableHead className="text-right">Qtd. Fórmula</TableHead>
                  <TableHead className="text-right">Qtd. Lote (g)</TableHead>
                  <TableHead className="text-right">Tolerância</TableHead>
                  <TableHead>Lote MP</TableHead>
                  <TableHead>Pesado</TableHead>
                  <TableHead>Conferido</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {op.itens_pesagem.map((item) => (
                  <TableRow 
                    key={item.id}
                    className={item.tipo_pesagem === 'CRITICA' ? 'bg-warning/10' : ''}
                  >
                    <TableCell>
                      <span className="w-7 h-7 rounded-full bg-foreground text-background flex items-center justify-center font-bold text-xs">
                        {item.ordem}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">
                      {item.insumo_nome}
                      {item.motivo_critico && (
                        <p className="text-xs text-muted-foreground">{item.motivo_critico}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {item.categoria}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {item.tipo_pesagem === 'CRITICA' ? (
                        <Badge variant="destructive" className="text-xs">CRÍTICA</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">PADRÃO</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {item.quantidade_formula_mg.toFixed(4)} mg
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold">
                      {item.quantidade_lote_g.toFixed(4)} g
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      <span className="text-muted-foreground">
                        {item.quantidade_minima_g.toFixed(4)} - {item.quantidade_maxima_g.toFixed(4)}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {item.numero_lote || '________'}
                    </TableCell>
                    <TableCell className="text-xs">
                      {item.pesado_por || '________________'}
                    </TableCell>
                    <TableCell className="text-xs">
                      {item.tipo_pesagem === 'CRITICA' ? (
                        item.conferido_por || '________________'
                      ) : (
                        <span className="text-muted-foreground">N/A</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Ordem de Mistura */}
        <Card className="mb-6">
          <CardHeader className="py-3 bg-muted">
            <CardTitle className="text-sm">ORDEM DE MISTURA INDUSTRIAL (FIXA)</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-3 gap-4">
              {ORDEM_MISTURA_INDUSTRIAL.map((item) => (
                <div key={item.ordem} className="flex items-center gap-3 p-2 bg-muted/50 rounded">
                  <span className="w-6 h-6 rounded-full bg-foreground text-background flex items-center justify-center font-bold text-xs">
                    {item.ordem}
                  </span>
                  <div className="text-xs">
                    <p className="font-medium">{item.descricao}</p>
                    <p className="text-muted-foreground">{item.categoria}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Controle de Qualidade */}
        <Card className="mb-6">
          <CardHeader className="py-3 bg-muted">
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              CONTROLE DE QUALIDADE
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Teste</TableHead>
                  <TableHead>Resultado</TableHead>
                  <TableHead className="text-center">Conforme</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>Aparência do pó</TableCell>
                  <TableCell>{op.controle_qualidade?.aparencia_po || '________________________'}</TableCell>
                  <TableCell className="text-center">
                    <span className="inline-block w-4 h-4 border border-foreground mr-2" /> Sim
                    <span className="inline-block w-4 h-4 border border-foreground ml-4 mr-2" /> Não
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Fluidez</TableCell>
                  <TableCell>{op.controle_qualidade?.fluidez || '________________________'}</TableCell>
                  <TableCell className="text-center">
                    <span className="inline-block w-4 h-4 border border-foreground mr-2" /> Sim
                    <span className="inline-block w-4 h-4 border border-foreground ml-4 mr-2" /> Não
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Homogeneidade</TableCell>
                  <TableCell>{op.controle_qualidade?.homogeneidade || '________________________'}</TableCell>
                  <TableCell className="text-center">
                    <span className="inline-block w-4 h-4 border border-foreground mr-2" /> Sim
                    <span className="inline-block w-4 h-4 border border-foreground ml-4 mr-2" /> Não
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Peso médio cápsulas (mg)</TableCell>
                  <TableCell>{op.controle_qualidade?.peso_medio_capsulas_mg || '________'} mg</TableCell>
                  <TableCell className="text-center">
                    <span className="inline-block w-4 h-4 border border-foreground mr-2" /> Sim
                    <span className="inline-block w-4 h-4 border border-foreground ml-4 mr-2" /> Não
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <div className="mt-4 p-3 border rounded">
              <p className="text-xs font-medium mb-2">Observações QC:</p>
              <p className="text-xs text-muted-foreground min-h-[40px]">
                {op.controle_qualidade?.observacoes || ''}
              </p>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="inline-block w-24 h-8 border-2 border-secondary rounded mr-2" />
                <span className="font-bold text-secondary">APROVADO</span>
              </div>
              <div className="text-center">
                <div className="inline-block w-24 h-8 border-2 border-destructive rounded mr-2" />
                <span className="font-bold text-destructive">REPROVADO</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Assinaturas */}
        <div className="grid grid-cols-3 gap-8 mt-8 pt-8 border-t">
          <div className="text-center">
            <div className="border-t border-foreground pt-2">
              <p className="text-xs font-medium">Responsável Técnico</p>
              <p className="text-xs text-muted-foreground">Data: ____/____/________</p>
            </div>
          </div>
          <div className="text-center">
            <div className="border-t border-foreground pt-2">
              <p className="text-xs font-medium">Operador</p>
              <p className="text-xs text-muted-foreground">Data: ____/____/________</p>
            </div>
          </div>
          <div className="text-center">
            <div className="border-t border-foreground pt-2">
              <p className="text-xs font-medium">Controle de Qualidade</p>
              <p className="text-xs text-muted-foreground">Data: ____/____/________</p>
            </div>
          </div>
        </div>

        {/* Rodapé */}
        <div className="mt-8 pt-4 border-t text-center text-xs text-muted-foreground">
          <p>Documento gerado em {new Date().toLocaleString('pt-BR')}</p>
          <p>Este documento é parte integrante do controle de produção e rastreabilidade ANVISA</p>
        </div>
      </div>
    </div>
  );
}
