import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Printer, FileDown, Copy, RefreshCw, AlertCircle, CheckCircle, Info, Brain, FileCode, FlaskConical } from 'lucide-react';
import { toast } from "sonner";
import { ANVISA_LIMITS, VD_REFERENCE, validarAditivo, validarProbiotico } from "@/lib/anvisa-limits";
import { estiloStatusParecer } from "@/lib/anvisa-avaliar-ativo";
import { exportLaudoA4 } from "@/lib/exportLaudoA4";
import { useCompanyBranding } from "@/hooks/use-company-branding";
import { useRTAtivo } from "@/hooks/use-rt-ativo";
import { useAlegacoesBasePopulada } from "@/hooks/use-alegacoes-base-populada";
import { ResolverInsumosLaudoDialog } from "@/components/regulatorio/ResolverInsumosLaudoDialog";
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
    cliente_logo_url?: string | null;
    ativos: any[];
    multiplos_produtos?: any[];
    /** Validade do papel — distinto de status_geral (parecer da fórmula) */
    status_validacao?: string | null;
    invalidado_motivo?: string | null;
    invalidado_em?: string | null;
    protocolo?: string | null;
    emitido_em?: string | null;
    rt_nome?: string | null;
    rt_crf?: string | null;
  };
  onReset: () => void;
  onSelectProduct?: (produto: any) => void;
}

export const AnvisaLaudoView: React.FC<AnvisaLaudoViewProps> = ({ data, onReset, onSelectProduct }) => {
  const handlePrint = () => window.print();
  const produtosUnicos = uniqueProductsByName(data.multiplos_produtos || []);
  const { data: company } = useCompanyBranding();
  const { data: rt } = useRTAtivo();
  const { data: alegacoesBaseOk } = useAlegacoesBasePopulada();
  const [resolverOpen, setResolverOpen] = React.useState(false);

  const isMultiproduto = produtosUnicos.length > 1;
  const statusValidacao = String(data.status_validacao || "PRELIMINAR").toUpperCase();
  const ehLaudoValido = statusValidacao === "VALIDADO_RT";
  const ehInvalidado = statusValidacao === "INVALIDADO";
  const tituloDocumento = ehLaudoValido
    ? "Laudo de Conformidade Regulatória"
    : "Parecer preliminar — sem valor de laudo técnico";
  const motivoRebaixamento =
    data.invalidado_motivo
    && String(data.invalidado_motivo).startsWith("Rebaixado automaticamente na emissão")
      ? data.invalidado_motivo
      : null;
  const mostrarAlegacoes = !!alegacoesBaseOk;

  const handleExportLaudo = () => {
    try {
      if (ehInvalidado) {
        toast.error("Documento INVALIDADO — download bloqueado. Motivo: " + (data.invalidado_motivo || "—"));
        return;
      }
      if (!rt && !data.rt_nome) {
        toast.error("Cadastre um responsável técnico ativo antes de emitir.");
        return;
      }
      exportLaudoA4({
        ...data,
        status_validacao: statusValidacao,
        invalidado_motivo: data.invalidado_motivo || undefined,
        protocolo: data.protocolo || undefined,
        emitido_em: data.emitido_em || undefined,
        exibir_alegacoes: mostrarAlegacoes,
        alegacoes_permitidas: mostrarAlegacoes ? (data.alegacoes_permitidas || []) : [],
        alegacoes_proibidas: mostrarAlegacoes ? (data.alegacoes_proibidas || []) : [],
        multiplos_produtos: isMultiproduto ? produtosUnicos : data.multiplos_produtos,
        company: company ? {
          razao_social: company.razao_social,
          nome_fantasia: company.nome_fantasia,
          logo_url: company.logo_url,
          cnpj: company.cnpj,
          endereco: company.endereco
        } : undefined,
        rt: data.rt_nome ? {
          nome_completo: data.rt_nome,
          tipo_conselho: (data.rt_crf || "").split(" ")[0] || "CRF",
          numero_registro: data.rt_crf || "",
          uf_conselho: "",
        } : rt ? {
          nome_completo: rt.nome_completo,
          tipo_conselho: rt.tipo_conselho,
          numero_registro: rt.numero_registro,
          uf_conselho: rt.uf_conselho
        } : null
      });
      const msg = isMultiproduto
        ? `Documento multiproduto gerado (${produtosUnicos.length} produtos). Use 'Salvar como PDF'.`
        : "Documento gerado. Use 'Salvar como PDF' na janela de impressão.";
      toast.success(msg);
    } catch (e: any) {
      toast.error("Falha ao gerar documento: " + (e?.message || 'erro'));
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
        <h2 className="text-xl font-bold">{ehLaudoValido ? "Laudo de Conformidade" : "Parecer preliminar"}</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint} disabled={ehInvalidado}>
            <Printer className="w-4 h-4 mr-2" /> Imprimir
          </Button>
          <Button variant="default" size="sm" onClick={handleExportLaudo} disabled={ehInvalidado}>
            <FileDown className="w-4 h-4 mr-2" />
            {ehInvalidado
              ? "PDF bloqueado (INVALIDADO)"
              : isMultiproduto
                ? `Exportar documento (${produtosUnicos.length} produtos)`
                : "Exportar PDF (A4)"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleCopyLink}><Copy className="w-4 h-4 mr-2" /> Copiar link</Button>
          <Button variant="secondary" size="sm" onClick={() => setResolverOpen(true)}><FlaskConical className="w-4 h-4 mr-2" /> Criar fórmula a partir deste laudo</Button>
          <Button variant="default" size="sm" onClick={onReset}><RefreshCw className="w-4 h-4 mr-2" /> Nova análise</Button>
        </div>
      </div>

      <ResolverInsumosLaudoDialog
        open={resolverOpen}
        onOpenChange={setResolverOpen}
        produtoNome={data.produto}
        ativos={(data.ativos || []).map((a) => ({
          nome: a.nome || a.name || '',
          dose: Number(a.dose) || 0,
          unit: a.unit || 'mg',
          key: a.key || a.anvisaKey,
        }))}
      />

      <div id="laudo-content" className="space-y-8 bg-background p-8 border rounded-lg shadow-sm relative overflow-hidden">
        {ehInvalidado && (
          <div className="rounded-md border-2 border-destructive bg-destructive/10 px-4 py-3 text-destructive space-y-1">
            <p className="font-bold uppercase tracking-wide text-sm">Documento INVALIDADO</p>
            {data.invalidado_motivo && (
              <p className="text-sm">{data.invalidado_motivo}</p>
            )}
            {data.invalidado_em && (
              <p className="text-xs opacity-80">
                Em {new Date(data.invalidado_em).toLocaleString("pt-BR")}
              </p>
            )}
          </div>
        )}
        {motivoRebaixamento && !ehInvalidado && (
          <div className="rounded-md border border-amber-400 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-amber-900 dark:text-amber-100 text-sm">
            <p className="font-semibold">Emitido como preliminar</p>
            <p>{motivoRebaixamento}</p>
          </div>
        )}
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
          {company?.logo_url && (
            <img
              src={company.logo_url}
              alt={company.razao_social || "Logo"}
              className="mx-auto mb-3 max-h-20 object-contain"
            />
          )}
          {company?.razao_social && (
            <p className="text-lg font-extrabold text-primary">{company.razao_social}</p>
          )}
          {(company?.cnpj || company?.endereco) && (
            <p className="text-xs text-muted-foreground">
              {company?.cnpj ? `CNPJ: ${company.cnpj}` : ""}
              {company?.cnpj && company?.endereco ? " · " : ""}
              {company?.endereco || ""}
            </p>
          )}
          <h1 className="text-3xl font-bold tracking-tight pt-2">{tituloDocumento}</h1>
          <p className="text-muted-foreground">Módulo ANVISA Checker · RDC 429/2020 · IN 75/2020 · RDC 243/2018 · IN 28/2018</p>
          {data.protocolo && (
            <p className="text-sm font-mono font-semibold pt-1">Protocolo {data.protocolo}</p>
          )}
        </section>

        <section className="grid md:grid-cols-2 gap-8">
          <div>
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">Dados do Produto</h3>
            <p className="text-lg font-bold">{data.produto}</p>
            {data.cliente && <p className="text-sm">Cliente: {data.cliente}</p>}
            {(data.rt_nome || data.rt_crf) && (
              <p className="text-xs text-muted-foreground mt-1">
                RT: {data.rt_nome}{data.rt_crf ? ` · ${data.rt_crf}` : ""}
              </p>
            )}
          </div>
          <div className="text-right space-y-3">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Parecer da fórmula
              </h3>
              <Badge className={`text-sm px-4 py-1 font-bold ${getStatusColor(data.status_geral)}`}>
                {data.status_geral}
              </Badge>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Validade do documento
              </h3>
              <Badge
                variant="outline"
                className={cn(
                  "text-sm px-4 py-1 font-bold",
                  ehLaudoValido && "border-green-600 text-green-700",
                  ehInvalidado && "border-destructive text-destructive",
                  !ehLaudoValido && !ehInvalidado && "border-amber-500 text-amber-700",
                )}
              >
                {statusValidacao}
              </Badge>
            </div>
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
          <h3 className="text-lg font-bold border-l-4 border-primary pl-3">
            Pareceres por ativo
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              motor anvisa_avaliar_ativo · PENDENTE_VERIFICACAO ≠ NAO_AUTORIZADO
            </span>
          </h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ativo/Ingrediente</TableHead>
                <TableHead>Dose</TableHead>
                <TableHead>Limite oficial</TableHead>
                <TableHead>Referência</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.ativos.map((ativo, i) => {
                const parecer = ativo.parecer;
                const nomeAtivo = ativo.nome || ativo.name || '-';
                const statusMotor = String(
                  ativo.status_parecer || parecer?.status || '',
                ).toUpperCase();
                // Preferir motor SQL. Fallback legado só se ainda não houver parecer.
                const key = (ativo.key || ativo.anvisaKey || '').toLowerCase();
                const limitLegacy = key ? ANVISA_LIMITS[key] : null;
                let status = statusMotor;
                if (!status) {
                  status = 'PENDENTE_VERIFICACAO';
                  if (limitLegacy) {
                    const doseNum = parseFloat(ativo.dose);
                    if (!limitLegacy.auth) status = 'NAO_AUTORIZADO';
                    else if (limitLegacy.max != null && doseNum > limitLegacy.max) status = 'PENDENTE_VERIFICACAO';
                    else if (doseNum < limitLegacy.min) status = 'PENDENTE_VERIFICACAO';
                    else status = 'APROVADO';
                  }
                }
                const estilo = estiloStatusParecer(status);
                const limiteTexto =
                  parecer?.limite_texto
                  || (parecer?.limite_min_oficial != null || parecer?.limite_max_oficial != null
                    ? `${parecer?.limite_min_oficial ?? '—'} – ${parecer?.limite_max_oficial ?? '—'}`
                    : null)
                  || (limitLegacy?.max != null ? `${limitLegacy.max} ${limitLegacy.unit}` : '—');
                const norma = parecer?.norma_referencia || limitLegacy?.norm || '—';

                return (
                  <TableRow key={i}>
                    <TableCell className="font-medium">
                      <div>{nomeAtivo}</div>
                      {parecer?.motivo && (
                        <p className="text-[11px] text-muted-foreground font-normal mt-1 whitespace-pre-wrap">
                          {parecer.motivo}
                        </p>
                      )}
                      {parecer?.substituicao_sugerida && (
                        <p className="text-[11px] text-amber-800 dark:text-amber-200 font-normal mt-1">
                          Substituição (proposta funcional): {parecer.substituicao_sugerida}
                          {parecer.proposta_funcional ? ` — ${parecer.proposta_funcional}` : ''}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>{ativo.dose} {ativo.unit}</TableCell>
                    <TableCell className="text-xs">{limiteTexto}</TableCell>
                    <TableCell className="text-[10px] text-muted-foreground">{norma}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={estilo.className}>
                        {estilo.label}
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
                  let doseMg = Number(doseCorrigida) || 0;
                  const u = (unitCorrigida || '').toLowerCase();
                  if (u === 'mcg') doseMg /= 1000;
                  if (u === 'g') doseMg *= 1000;
                  const percentVD = vdRef ? Math.round((doseMg / vdRef.vd) * 100) : null;

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
                *Percentual de valores diários fornecidos pela porção.
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

        {mostrarAlegacoes && (
          <section className="grid md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h3 className="text-lg font-bold border-l-4 border-green-500 pl-3">Alegações Permitidas</h3>
              <ul className="space-y-2">
                {(data.alegacoes_permitidas || []).map((al, i) => (
                  <li key={i} className="flex gap-2 text-sm items-start"><CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" /> {al}</li>
                ))}
              </ul>
            </div>
            <div className="space-y-4">
              <h3 className="text-lg font-bold border-l-4 border-red-500 pl-3">Alegações Proibidas</h3>
              <ul className="space-y-2">
                {(data.alegacoes_proibidas || []).map((al, i) => (
                  <li key={i} className="flex gap-2 text-sm items-start"><AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" /> {al}</li>
                ))}
                {(data.avisos_rotulo || []).map((av, i) => (
                  <li key={`av-${i}`} className="flex gap-2 text-sm items-start font-semibold"><Info className="w-4 h-4 text-primary mt-0.5 shrink-0" /> {av}</li>
                ))}
              </ul>
            </div>
          </section>
        )}

        <section className="space-y-4">
          <h3 className="text-lg font-bold border-l-4 border-primary pl-3">Avisos Obrigatórios de Rotulagem (RDC 243/2018)</h3>
          <div className="grid gap-2">
            {[
              "\u201CEste produto n\u00e3o \u00e9 um medicamento\u201D",
              "\u201CN\u00e3o substitui uma alimenta\u00e7\u00e3o variada e equilibrada e um estilo de vida saud\u00e1vel\u201D",
              "\u201CManter fora do alcance de crian\u00e7as\u201D",
              "\u201CN\u00e3o exceder a dose di\u00e1ria recomendada\u201D",
              "N\u00famero do lote e data de validade obrigat\u00f3rios no r\u00f3tulo",
              "Nome e n\u00famero do Respons\u00e1vel T\u00e9cnico (CRN/CRF) obrigat\u00f3rios",
              "CNPJ e endere\u00e7o completo do fabricante obrigat\u00f3rios",
            ].map((av, i) => (
              <div key={i} className="text-sm bg-muted/40 border-l-4 border-primary rounded px-3 py-2">{av}</div>
            ))}
          </div>
        </section>

        {(() => {
          const ativos = (data.ativos || []) as any[];
          const aditivos: { nome: string; texto: string; ok: boolean }[] = [];
          const probioticos: { nome: string; texto: string; ok: boolean }[] = [];
          for (const a of ativos) {
            const nome = a?.nome || a?.name || "";
            if (!nome) continue;
            const prob = validarProbiotico(nome);
            if (prob.eProbiotico) {
              probioticos.push({ nome, texto: prob.avisoRotulo || "", ok: Boolean(prob.info) });
              continue;
            }
            const adt = validarAditivo(nome);
            if (adt.encontrado && adt.info) {
              aditivos.push({ nome, texto: `${adt.info.funcao} — ${adt.info.norm}${adt.info.obs ? " · " + adt.info.obs : ""}`, ok: adt.info.auth });
            }
          }
          if (aditivos.length === 0 && probioticos.length === 0) return null;
          return (
            <section className="space-y-4">
              <h3 className="text-lg font-bold border-l-4 border-primary pl-3">Aditivos e Probióticos (RDC 239/2018 · RDC 241/2018)</h3>
              {probioticos.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-primary">Probióticos — RDC 241/2018</p>
                  {probioticos.map((p, i) => (
                    <div key={`p-${i}`} className={cn("text-sm rounded px-3 py-2 border-l-4", p.ok ? "border-green-500 bg-green-50" : "border-amber-500 bg-amber-50")}>
                      <span className="font-bold">{p.nome}</span> — {p.ok ? "AUTORIZADO" : "VERIFICAR"}
                      {p.texto && <span className="block text-xs text-muted-foreground mt-0.5">{p.texto}</span>}
                    </div>
                  ))}
                </div>
              )}
              {aditivos.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-primary">Aditivos e coadjuvantes — RDC 239/2018</p>
                  {aditivos.map((a, i) => (
                    <div key={`a-${i}`} className={cn("text-sm rounded px-3 py-2 border-l-4", a.ok ? "border-green-500 bg-green-50" : "border-amber-500 bg-amber-50")}>
                      <span className="font-bold">{a.nome}</span> — {a.ok ? "AUTORIZADO" : "VERIFICAR"}
                      <span className="block text-xs text-muted-foreground mt-0.5">{a.texto}</span>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">Excipientes não listados devem ser verificados manualmente pelo RT contra a RDC 239/2018. Cepas probióticas exigem contagem viável (UFC) e identificação de linhagem (RDC 241/2018).</p>
            </section>
          );
        })()}

        <footer className="mt-12 pt-8 border-t text-[10px] text-muted-foreground space-y-2">
          <p>*Percentual de valores diários fornecidos pela porção.</p>
          <p>** VD não estabelecido pela ANVISA.</p>
        </footer>
      </div>
    </div>
  );
};
