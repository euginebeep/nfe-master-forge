import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Printer, FileDown, Copy, RefreshCw, AlertCircle, CheckCircle, Info, Brain, FileCode } from 'lucide-react';
import { toast } from "sonner";
import { ANVISA_LIMITS, VD_REFERENCE } from "@/lib/anvisa-limits";
import { exportLaudoA4 } from "@/lib/exportLaudoA4";
import { cn } from "@/lib/utils";

const normalizeProductName = (value: unknown) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const uniqueProductsByName = (items: any[] = []) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = normalizeProductName(item?.nome || item?.produto || item?.name);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

interface AnvisaLaudoViewProps {
  data: {
    status_geral: string;
    alertas: Array<{ tipo: 'err' | 'warn' | 'ok' | 'info'; titulo: string; corpo: string }>;
    analise_ia: string;
    alegacoes_permitidas: string[];
    alegacoes_proibidas: string[];
    avisos_rotulo: string[];
    sugestao_capsulas: { n: number; tamanho: string; frasco: number; obs: string };
    produto: string;
    cliente?: string;
    ativos: any[];
    multiplos_produtos?: any[];
  };
  onReset: () => void;
  onSelectProduct?: (produto: any) => void;
}

export const AnvisaLaudoView: React.FC<AnvisaLaudoViewProps> = ({ data, onReset, onSelectProduct }) => {
  const handlePrint = () => window.print();
  const produtosUnicos = uniqueProductsByName(data.multiplos_produtos || []);

  const handleExportLaudo = () => {
    try {
      exportLaudoA4(data);
      toast.success("Laudo gerado. Use 'Salvar como PDF' na janela de impressão.");
    } catch (e: any) {
      toast.error("Falha ao gerar laudo: " + (e?.message || 'erro'));
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Link copiado!");
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APROVADO': return 'bg-green-950/30 border-green-900/50 text-green-400';
      case 'APROVADO COM RESSALVAS': return 'bg-yellow-950/30 border-yellow-900/50 text-yellow-400';
      case 'BLOQUEADO': return 'bg-red-950/30 border-red-900/50 text-red-400';
      default: return 'bg-slate-900 border-slate-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center print:hidden">
        <h2 className="text-xl font-bold">Laudo de Conformidade</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint}><Printer className="w-4 h-4 mr-2" /> Imprimir</Button>
          <Button variant="default" size="sm" onClick={handleExportLaudo}><FileDown className="w-4 h-4 mr-2" /> Exportar Laudo (A4/PDF)</Button>
          <Button variant="outline" size="sm" onClick={handleCopyLink}><Copy className="w-4 h-4 mr-2" /> Copiar link</Button>
          <Button variant="default" size="sm" onClick={onReset}><RefreshCw className="w-4 h-4 mr-2" /> Nova análise</Button>
        </div>
      </div>

      <div id="laudo-content" className="space-y-8 bg-background p-8 border rounded-lg shadow-sm">
        {produtosUnicos.length > 1 && (
          <section className="print:hidden mb-8 border-b pb-6">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <FileCode className="w-5 h-5 text-primary" /> 
              Todos os Produtos Checados ({produtosUnicos.length})
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {produtosUnicos.map((p, idx) => {
                const isSelected = data.produto === (p.nome || p.produto);
                return (
                  <Button 
                    key={idx}
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    className={cn(
                      "text-xs truncate transition-all",
                      isSelected ? "ring-2 ring-primary ring-offset-2" : ""
                    )}
                    onClick={() => onSelectProduct?.(p)}
                  >
                    <CheckCircle className={cn("w-3 h-3 mr-1", isSelected ? "opacity-100" : "opacity-0")} />
                    {p.nome || p.produto}
                  </Button>
                );
              })}
            </div>
          </section>
        )}

        <section className="text-center space-y-2 border-b pb-6">
          <h1 className="text-3xl font-bold tracking-tight">Relatório de Conformidade Regulatória</h1>
          <p className="text-muted-foreground">BrainX ERP — Módulo ANVISA Checker</p>
        </section>

        <section className="grid md:grid-cols-2 gap-8">
          <div>
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">Dados do Produto</h3>
            <p className="text-lg font-bold">{data.produto}</p>
            {data.cliente && <p className="text-sm">Cliente: {data.cliente}</p>}
          </div>
          <div className="text-right">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">Status Geral</h3>
            <Badge className={`text-sm px-4 py-1 font-bold ${getStatusColor(data.status_geral)}`}>
              {data.status_geral}
            </Badge>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-lg font-bold border-l-4 border-primary pl-3">Alertas e Alertas de Atenção</h3>
          <div className="grid gap-3">
            {data.alertas.map((alerta, i) => (
              <div key={i} className={`p-4 rounded-lg flex gap-4 items-start ${
                alerta.tipo === 'err' ? 'bg-red-950/30 border border-red-900/50' : 
                alerta.tipo === 'warn' ? 'bg-yellow-950/30 border border-yellow-900/50' : 
                'bg-green-950/30 border border-green-900/50'
              }`}>
                {alerta.tipo === 'err' ? <AlertCircle className="w-5 h-5 text-red-400 mt-0.5" /> : 
                 alerta.tipo === 'warn' ? <AlertCircle className="w-5 h-5 text-yellow-400 mt-0.5" /> : 
                 <CheckCircle className="w-5 h-5 text-green-400 mt-0.5" />}
                <div>
                  <h4 className="font-bold">{alerta.titulo}</h4>
                  <p className="text-sm opacity-90">{alerta.corpo}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-lg font-bold border-l-4 border-primary pl-3">Análise Técnica</h3>
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Brain className="w-4 h-4 text-primary" /> Análise BrainX IA
              </CardTitle>
            </CardHeader>
            <CardContent className="italic text-muted-foreground whitespace-pre-wrap text-sm">
              {data.analise_ia}
            </CardContent>
          </Card>
        </section>

        <section className="space-y-4">
          <h3 className="text-lg font-bold border-l-4 border-primary pl-3">Tabela de Ativos Verificados</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ativo/Ingrediente</TableHead>
                <TableHead>Dose</TableHead>
                <TableHead>Limite ANVISA</TableHead>
                <TableHead>Referência</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.ativos.map((ativo, i) => {
                const key = (ativo.key || ativo.anvisaKey || '').toLowerCase();
                const limit = key ? ANVISA_LIMITS[key] : null;
                const doseNum = parseFloat(ativo.dose);
                const nomeAtivo = ativo.nome || ativo.name || '-';
                
                let status = 'VERIFICAR';
                if (limit) {
                  if (!limit.auth) status = 'BLOQUEADO';
                  else if (limit.max !== null && doseNum > limit.max) status = 'ATENCAO';
                  else if (doseNum < limit.min) status = 'ATENCAO';
                  else status = 'APROVADO';
                }

                return (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{nomeAtivo}</TableCell>
                    <TableCell>{ativo.dose} {ativo.unit}</TableCell>
                    <TableCell>{limit?.max ? `${limit.max} ${limit.unit}` : 'NE'}</TableCell>
                    <TableCell className="text-[10px] text-muted-foreground">{limit?.norm || '-'}</TableCell>
                    <TableCell>
                      <Badge className={
                        status === 'APROVADO' ? 'bg-green-500/20 text-green-500' :
                        status === 'ATENCAO' ? 'bg-yellow-500/20 text-yellow-500' :
                        status === 'BLOQUEADO' ? 'bg-red-500/20 text-red-500' :
                        'bg-orange-500/20 text-orange-500'
                      }>
                        {status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}

            </TableBody>
          </Table>
        </section>

        <section className="space-y-4">
          <h3 className="text-lg font-bold border-l-4 border-primary pl-3">Tabela Nutricional Corrigida (RDC 429/2020 · IN 28/2018)</h3>
          <div className="border-2 border-black p-4 rounded-none bg-white max-w-md mx-auto shadow-sm text-black font-sans">
            <h4 className="text-center font-black text-xl border-b-2 border-black pb-1 mb-2 tracking-tighter italic">INFORMAÇÃO NUTRICIONAL (CORRIGIDA)</h4>
            <div className="border-2 border-black">
              <div className="flex justify-between items-center border-b-2 border-black bg-white px-2 py-1 font-bold text-[10px] uppercase">
                <span className="w-1/2 border-r-2 border-black pr-2">Nutriente</span>
                <span className="w-1/4 border-r-2 border-black px-2 text-center">Qtd/Dose</span>
                <span className="w-1/4 pl-2 text-center">%VD*</span>
              </div>
              
              <div className="divide-y-2 divide-black">
                {data.ativos.map((ativo, i) => {
                  const key = (ativo.key || ativo.anvisaKey || '').toLowerCase();
                  const vdRef = key ? VD_REFERENCE[key] : null;
                  const limit = key ? ANVISA_LIMITS[key] : null;
                  const nomeAtivo = ativo.nome || ativo.name || 'Indefinido';
                  const doseOriginal = parseFloat(ativo.dose) || 0;
                  const unitOriginal = ativo.unit || '';
                  let doseCorrigida = doseOriginal;
                  let unitCorrigida = unitOriginal;
                  let corrigido = false;
                  if (limit && limit.auth && limit.max != null && doseOriginal > limit.max) {
                    doseCorrigida = limit.max;
                    unitCorrigida = limit.unit;
                    corrigido = true;
                  }
                  let doseMg = doseCorrigida;
                  const u = (unitCorrigida || '').toLowerCase();
                  if (u === 'mcg') doseMg /= 1000;
                  if (u === 'g') doseMg *= 1000;
                  const percentVD = vdRef ? Math.round((doseMg / vdRef) * 100) : null;

                  return (
                    <div key={i} className="flex justify-between items-center text-[11px] font-bold">
                      <span className="w-1/2 border-r-2 border-black px-2 py-1">{nomeAtivo}</span>
                      <span className="w-1/4 border-r-2 border-black px-2 py-1 text-center">
                        {corrigido ? (
                          <>
                            <span className="line-through text-gray-400 font-medium block">{ativo.dose} {unitOriginal}</span>
                            <span className="text-green-600">Tabela Nutricional Corrigida: {doseCorrigida} {unitCorrigida}</span>
                          </>
                        ) : (
                          <>{ativo.dose} {ativo.unit}</>
                        )}
                      </span>
                      <span className="w-1/4 px-2 py-1 text-center">
                        {percentVD !== null ? `${percentVD}%` : '**'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-2 space-y-1">
              <p className="text-[8px] leading-tight text-black italic">
                * % Valores Diários com base em uma dieta de 2.000 kcal ou 8.400 kJ. Seus valores diários podem ser maiores ou menores dependendo de suas necessidades energéticas.
              </p>
              <p className="text-[8px] text-black font-bold uppercase">
                ** VD não estabelecido pela ANVISA.
              </p>
              <p className="text-[8px] text-green-700 font-bold">
                ⚙ Doses ajustadas automaticamente conforme limites máximos da IN 28/2018 e Painel ANVISA Power BI.
              </p>
            </div>
          </div>
        </section>


        {(() => {
          const corrigidos = data.ativos.filter(ativo => {
            const key = (ativo.key || ativo.anvisaKey || '').toLowerCase();
            const limit = key ? ANVISA_LIMITS[key] : null;
            const doseOriginal = parseFloat(ativo.dose) || 0;
            return limit && limit.auth && limit.max != null && doseOriginal > limit.max;
          });

          if (corrigidos.length === 0) return null;

          return (
            <section className="space-y-4">
              <h3 className="text-lg font-bold border-l-4 border-green-600 pl-3 text-green-600">Resumo Técnico de Ajustes (Rastreabilidade)</h3>
              <p className="text-sm text-muted-foreground">Os itens abaixo foram ajustados automaticamente para garantir conformidade com os limites máximos da IN 28/2018 e Painel Power BI.</p>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-green-500/10 hover:bg-green-500/10">
                      <TableHead>Nutriente</TableHead>
                      <TableHead className="text-center">Dose Original</TableHead>
                      <TableHead className="text-center">Dose Corrigida</TableHead>
                      <TableHead>Regra / Limite</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {corrigidos.map((ativo, i) => {
                      const key = (ativo.key || ativo.anvisaKey || '').toLowerCase();
                      const limit = ANVISA_LIMITS[key];
                      return (
                        <TableRow key={i}>
                          <TableCell className="font-bold">{ativo.nome || ativo.name}</TableCell>
                          <TableCell className="text-center line-through text-muted-foreground">{ativo.dose} {ativo.unit}</TableCell>
                          <TableCell className="text-center font-bold text-green-600">{limit.max} {limit.unit}</TableCell>
                          <TableCell className="text-[10px] text-muted-foreground italic">Teto IN 28/2018 ({limit.max} {limit.unit})</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </section>
          );
        })()}

        <section className="space-y-4">
          <h3 className="text-lg font-bold border-l-4 border-primary pl-3">Cálculo de Cápsulas</h3>
          <Card className="bg-muted/30">
            <CardContent className="pt-6">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div><p className="text-xs text-muted-foreground mb-1 uppercase">Dose sugerida</p><p className="text-xl font-bold">{data.sugestao_capsulas.n} caps</p></div>
                <div><p className="text-xs text-muted-foreground mb-1 uppercase">Tamanho</p><p className="text-xl font-bold">{data.sugestao_capsulas.tamanho}</p></div>
                <div><p className="text-xs text-muted-foreground mb-1 uppercase">Frasco</p><p className="text-xl font-bold">{data.sugestao_capsulas.frasco} unid</p></div>
              </div>
              {data.sugestao_capsulas.obs && <p className="mt-4 text-sm text-center italic text-muted-foreground">{data.sugestao_capsulas.obs}</p>}
            </CardContent>
          </Card>
        </section>

        <section className="grid md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <h3 className="text-lg font-bold border-l-4 border-green-500 pl-3">Alegações Permitidas</h3>
            <ul className="space-y-2">
              {data.alegacoes_permitidas.map((al, i) => (
                <li key={i} className="flex gap-2 text-sm items-start"><CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" /> {al}</li>
              ))}
            </ul>
          </div>
          <div className="space-y-4">
            <h3 className="text-lg font-bold border-l-4 border-red-500 pl-3">Alegações Proibidas</h3>
            <ul className="space-y-2">
              {data.alegacoes_proibidas.map((al, i) => (
                <li key={i} className="flex gap-2 text-sm items-start"><AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" /> {al}</li>
              ))}
              {data.avisos_rotulo.map((av, i) => (
                <li key={`av-${i}`} className="flex gap-2 text-sm items-start font-semibold"><Info className="w-4 h-4 text-primary mt-0.5 shrink-0" /> {av}</li>
              ))}
            </ul>
          </div>
        </section>

        <footer className="mt-12 pt-8 border-t text-[10px] text-muted-foreground space-y-2">
          <p>* %VD com base em uma dieta de 2.000 kcal ou 8.400 kJ. Seus valores diários podem ser maiores ou menores dependendo de suas necessidades energéticas.</p>
          <p>** VD não estabelecido pela ANVISA.</p>
        </footer>
      </div>
    </div>
  );
};
