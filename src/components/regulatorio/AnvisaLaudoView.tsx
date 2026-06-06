import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Printer, FileCode, Copy, RefreshCw, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { toast } from "sonner";

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
          <Card className="bg-slate-900/50">
            <CardContent className="pt-6 italic text-muted-foreground whitespace-pre-wrap">
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
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.ativos.map((ativo, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{ativo.nome}</TableCell>
                  <TableCell>{ativo.dose} {ativo.unidade}</TableCell>
                  <TableCell><Badge variant="outline">Verificado</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
