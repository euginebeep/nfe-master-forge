import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Printer, FileCode, Copy, RefreshCw, AlertCircle, CheckCircle, Info, Brain } from 'lucide-react';
import { toast } from "sonner";
import { ANVISA_LIMITS, VD_REFERENCE } from "@/lib/anvisa-limits";

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
  };
  onReset: () => void;
}

export const AnvisaLaudoView: React.FC<AnvisaLaudoViewProps> = ({ data, onReset }) => {
  const handlePrint = () => window.print();

  const handleExportHTML = () => {
    const htmlContent = document.getElementById('laudo-content')?.innerHTML;
    if (!htmlContent) return;
    const blob = new Blob([`<html><head><title>Laudo - ${data.produto}</title></head><body>${htmlContent}</body></html>`], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `laudo-${data.produto}.html`;
    a.click();
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
          <Button variant="outline" size="sm" onClick={handleExportHTML}><FileCode className="w-4 h-4 mr-2" /> Exportar HTML</Button>
          <Button variant="outline" size="sm" onClick={handleCopyLink}><Copy className="w-4 h-4 mr-2" /> Copiar link</Button>
          <Button variant="default" size="sm" onClick={onReset}><RefreshCw className="w-4 h-4 mr-2" /> Nova análise</Button>
        </div>
      </div>

      <div id="laudo-content" className="space-y-8 bg-background p-8 border rounded-lg shadow-sm">
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
          <h3 className="text-lg font-bold border-l-4 border-primary pl-3">Tabela Nutricional (RDC 429/2020)</h3>
          <div className="border-2 border-primary/20 p-6 rounded-lg bg-slate-950 max-w-md mx-auto shadow-2xl">
            <h4 className="text-center font-black text-xl border-b-2 border-primary/20 pb-2 mb-4 tracking-tighter">INFORMAÇÃO NUTRICIONAL</h4>
            <div className="space-y-4">
              <div className="flex justify-between items-end border-b-2 border-primary/20 pb-1 font-bold text-[11px] uppercase tracking-wider">
                <span className="w-1/2">Nutriente</span>
                <span className="w-1/4 text-right">Qtd/Dose</span>
                <span className="w-1/4 text-right">%VD*</span>
              </div>
              
              <div className="divide-y divide-primary/10">
                {data.ativos.map((ativo, i) => {
                  const key = (ativo.key || ativo.anvisaKey || '').toLowerCase();
                  const vdRef = key ? VD_REFERENCE[key] : null;
                  const nomeAtivo = ativo.nome || ativo.name || 'Indefinido';
                  let doseMg = parseFloat(ativo.dose) || 0;
                  
                  // Normalização para cálculo de VD
                  const unit = (ativo.unit || '').toLowerCase();
                  if (unit === 'mcg') doseMg /= 1000;
                  if (unit === 'g') doseMg *= 1000;
                  
                  const percentVD = vdRef ? Math.round((doseMg / vdRef) * 100) : null;

                  return (
                    <div key={i} className="flex justify-between items-center py-2 text-[12px] font-medium transition-colors hover:bg-white/5">
                      <span className="w-1/2 text-primary/90">{nomeAtivo}</span>
                      <span className="w-1/4 text-right">{ativo.dose} {ativo.unit}</span>
                      <span className="w-1/4 text-right font-bold text-primary">
                        {percentVD !== null ? `${percentVD}%` : '**'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-primary/20 space-y-1">
              <p className="text-[9px] leading-tight text-muted-foreground/80 italic">
                * % Valores Diários com base em uma dieta de 2.000 kcal ou 8.400 kJ. Seus valores diários podem ser maiores ou menores dependendo de suas necessidades energéticas.
              </p>
              <p className="text-[9px] text-muted-foreground/80 font-bold uppercase">
                ** VD não estabelecido pela ANVISA.
              </p>
            </div>
          </div>
        </section>


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
