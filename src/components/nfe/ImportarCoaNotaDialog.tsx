import { useRef, useState } from 'react';
import { AlertTriangle, FileText, Loader2, Upload } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'sonner';
import {
  extrairTextoPorPagina,
  parseCertificados,
  fatiarCertificado,
  listarRotulosCampoEncontrados,
  type CertificadoCoa,
} from '@/lib/coa-splitter';
import {
  montarPreviewImportacaoCoa,
  lotesComCoaExistente,
  buscarCoasDosLotes,
  buscarNotaPorNumero,
  labelCampoCasamento,
  type PreviewImportacaoCoa,
  type CasamentoCertificado,
  type CasamentoRevisar,
} from '@/lib/coa-import';
import { uploadDocumentoLote } from '@/hooks/use-supabase-item-details';
import { VerPdfButton } from '@/components/shared/VerPdfButton';

type Etapa = 'selecionar' | 'analisando' | 'preview' | 'enviando' | 'concluido';

interface ResumoEnvio {
  anexados: number;
  pulados: number;
  erros: { lote: string; mensagem: string }[];
  lotesComCoa: { loteId: string; numeroLote: string; storageKey: string | null }[];
}

function erroMsg(err: unknown): string {
  const e = err as { message?: string; code?: string };
  return e?.message || e?.code || 'Erro desconhecido';
}

interface ImportarCoaNotaFlowProps {
  /** Null = PDF-first: o sistema resolve a nota pelo cabeçalho do certificado */
  notaId: string | null;
  notaNumero: string | null;
  onDone?: () => void;
  onFechar?: () => void;
  /** Chamado quando o PDF (ou o botão Trocar) resolve/muda a nota */
  onNotaResolvida?: (nota: { id: string; numero: string }) => void;
}

/** Fluxo interno reutilizável (sem trigger/dialog wrapper) */
export function ImportarCoaNotaFlow({
  notaId,
  notaNumero,
  onDone,
  onFechar,
  onNotaResolvida,
}: ImportarCoaNotaFlowProps) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const [etapa, setEtapa] = useState<Etapa>('selecionar');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewImportacaoCoa | null>(null);
  const [progresso, setProgresso] = useState(0);
  const [resumo, setResumo] = useState<ResumoEnvio | null>(null);
  const [trocandoNota, setTrocandoNota] = useState(false);

  const resetar = () => {
    setEtapa('selecionar');
    setArquivo(null);
    setPreview(null);
    setProgresso(0);
    setResumo(null);
  };

  const processarArquivo = async (file: File, notaOverride?: { id: string; numero: string } | null) => {
    setArquivo(file);
    setEtapa('analisando');
    try {
      const paginas = await extrairTextoPorPagina(file);
      const totalPaginas = paginas.length;
      const paginasComTexto = paginas.filter((p) => p.trim().length > 0);
      const nComTexto = paginasComTexto.length;

      if (totalPaginas === 0 || nComTexto === 0) {
        toast.error(
          `PDF sem camada de texto (provavelmente escaneado). ${totalPaginas} páginas lidas, nenhuma com texto extraível.`,
        );
        setEtapa('selecionar');
        return;
      }

      const certificados = parseCertificados(paginas);
      if (!certificados.length) {
        const diagnostico = paginas
          .map((p, idx) => {
            const rotulos = listarRotulosCampoEncontrados(p);
            const trecho = p.trim()
              ? (rotulos.length ? `rótulos: ${rotulos.join(', ')}` : 'nenhum rótulo conhecido')
              : 'sem texto';
            return `p${idx + 1}: ${trecho}`;
          })
          .join('; ');
        toast.error(
          `Nenhum certificado encontrado. ${totalPaginas} páginas, ${nComTexto} com texto. ${diagnostico}`,
        );
        setEtapa('selecionar');
        return;
      }

      const notaAtual = notaOverride === undefined
        ? (notaId && notaNumero ? { id: notaId, numero: notaNumero } : null)
        : notaOverride;

      let prev = await montarPreviewImportacaoCoa(notaAtual?.id ?? null, certificados, {
        notaNumeroSelecionada: notaAtual?.numero ?? null,
      });

      if (!notaAtual && prev.notaResolvidaPorPdf) {
        onNotaResolvida?.(prev.notaResolvidaPorPdf);
        prev = await montarPreviewImportacaoCoa(prev.notaResolvidaPorPdf.id, certificados, {
          notaNumeroSelecionada: prev.notaResolvidaPorPdf.numero,
        });
        toast.success(`Nota NF-e ${prev.notaExtraidaDoPdf ?? prev.notaResolvidaPorPdf?.numero} identificada no PDF`);
      } else if (!notaAtual && prev.notaExtraidaDoPdf && !prev.notaResolvidaPorPdf) {
        toast.message(`PDF indica NF ${prev.notaExtraidaDoPdf}, mas ela não foi encontrada no cadastro. Casando lotes em todo o estoque.`);
      }

      setPreview(prev);
      setEtapa('preview');
    } catch (err) {
      toast.error(`Erro ao analisar PDF: ${erroMsg(err)}`);
      setEtapa('selecionar');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Selecione um arquivo PDF.');
      return;
    }
    processarArquivo(file);
  };

  const trocarParaNotaDoPdf = async () => {
    if (!arquivo || !preview?.notaExtraidaDoPdf) return;
    setTrocandoNota(true);
    try {
      const encontrada = await buscarNotaPorNumero(preview.notaExtraidaDoPdf);
      if (!encontrada) {
        toast.error(`Nota ${preview.notaExtraidaDoPdf} não encontrada no cadastro.`);
        return;
      }
      onNotaResolvida?.(encontrada);
      await processarArquivo(arquivo, encontrada);
    } catch (err) {
      toast.error(`Erro ao trocar nota: ${erroMsg(err)}`);
    } finally {
      setTrocandoNota(false);
    }
  };

  const confirmarEnvio = async () => {
    if (!arquivo || !preview) return;

    const pares: { cert: CertificadoCoa; loteId: string; numeroLote: string }[] = [];
    for (const cas of preview.casamentos) {
      for (const lote of cas.lotes) {
        pares.push({ cert: cas.certificado, loteId: lote.id, numeroLote: lote.numero_lote });
      }
    }

    if (!pares.length) {
      toast.error('Nenhum lote casado para anexar.');
      return;
    }

    setEtapa('enviando');
    setProgresso(0);

    const loteIds = [...new Set(pares.map((p) => p.loteId))];
    let comCoa: Set<string>;
    try {
      comCoa = await lotesComCoaExistente(loteIds);
    } catch (err) {
      toast.error(`Erro ao verificar COAs existentes: ${erroMsg(err)}`);
      setEtapa('preview');
      return;
    }

    const resultado: ResumoEnvio = { anexados: 0, pulados: 0, erros: [], lotesComCoa: [] };
    const total = pares.length;
    const lotesUnicos = new Map<string, string>();

    for (let i = 0; i < pares.length; i++) {
      const { cert, loteId, numeroLote } = pares[i];
      lotesUnicos.set(loteId, numeroLote);
      setProgresso(Math.round(((i + 1) / total) * 100));

      if (comCoa.has(loteId)) {
        resultado.pulados++;
        continue;
      }

      try {
        const blob = await fatiarCertificado(arquivo, cert.paginaInicio, cert.paginaFim);
        const nome = `COA_${numeroLote}_p${cert.paginaInicio}-${cert.paginaFim}.pdf`;
        const pdfFile = new File([blob], nome, { type: 'application/pdf' });
        await uploadDocumentoLote(loteId, pdfFile, 'COA');
        comCoa.add(loteId);
        resultado.anexados++;
      } catch (err) {
        resultado.erros.push({ lote: numeroLote, mensagem: erroMsg(err) });
      }
    }

    try {
      const coas = await buscarCoasDosLotes([...lotesUnicos.keys()]);
      const coaPorLote = new Map(coas.map((c) => [c.loteId, c.storageKey]));
      resultado.lotesComCoa = [...lotesUnicos.entries()].map(([loteId, numeroLote]) => ({
        loteId,
        numeroLote,
        storageKey: coaPorLote.get(loteId) ?? null,
      }));
    } catch (err) {
      toast.error(`Erro ao buscar COAs anexados: ${erroMsg(err)}`);
    }

    setResumo(resultado);
    setEtapa('concluido');
    queryClient.invalidateQueries({ queryKey: ['lote-documentos'] });
    queryClient.invalidateQueries({ queryKey: ['estoque-lotes'] });
    queryClient.invalidateQueries({ queryKey: ['lote-liberacoes-sem-coa-dashboard'] });
    onDone?.();
  };

  const totalCasados = preview?.casamentos.length ?? 0;
  const totalLotesCasados = preview?.casamentos.reduce((s, c) => s + c.lotes.length, 0) ?? 0;
  const totalRevisar = preview?.revisarManualmente.length ?? 0;

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={handleFileChange}
      />

      {etapa === 'selecionar' && (
        <div className="flex flex-col items-center gap-4 py-6">
          <Upload className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground text-center">
            {notaNumero
              ? `NF-e ${notaNumero} — o PDF será lido e os lotes casados em todo o estoque (não só desta nota).`
              : 'Envie o PDF compilado. O sistema lê a NF e o lote no certificado e encontra a nota sozinho.'}
          </p>
          <Button onClick={() => inputRef.current?.click()}>
            Selecionar PDF compilado
          </Button>
        </div>
      )}

      {etapa === 'analisando' && (
        <div className="flex flex-col items-center gap-3 py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Analisando PDF e buscando lotes...</p>
        </div>
      )}

      {etapa === 'preview' && preview && (
        <div className="space-y-4">
          {preview.avisoNotaDivergente && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Certificado de outra nota</AlertTitle>
              <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span>{preview.avisoNotaDivergente}</span>
                {preview.notaExtraidaDoPdf && (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={trocandoNota}
                    onClick={trocarParaNotaDoPdf}
                  >
                    {trocandoNota ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      `Trocar para NF ${preview.notaExtraidaDoPdf}`
                    )}
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}

          {preview.notaExtraidaDoPdf && !preview.avisoNotaDivergente && (
            <p className="text-xs text-muted-foreground">
              NF no PDF: <strong>{preview.notaExtraidaDoPdf}</strong>
              {notaNumero ? ` · nota em uso: ${notaNumero}` : null}
            </p>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            <div className="rounded-lg border p-3">
              <p className="text-2xl font-bold">{preview.certificados.length}</p>
              <p className="text-xs text-muted-foreground">Certificados</p>
            </div>
            <div className="rounded-lg border p-3 bg-green-50/50">
              <p className="text-2xl font-bold text-green-700">{totalCasados}</p>
              <p className="text-xs text-muted-foreground">Casaram ({totalLotesCasados} lote(s))</p>
            </div>
            <div className="rounded-lg border p-3 bg-orange-50/50">
              <p className="text-2xl font-bold text-orange-700">{totalRevisar}</p>
              <p className="text-xs text-muted-foreground">Revisar manualmente</p>
            </div>
            <div className="rounded-lg border p-3 bg-amber-50/50">
              <p className="text-2xl font-bold text-amber-700">{preview.semCorrespondencia.length}</p>
              <p className="text-xs text-muted-foreground">Sem correspondência</p>
            </div>
          </div>

          {preview.casamentos.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">Casamentos encontrados</p>
              <ScrollArea className="h-40 rounded border">
                <div className="p-2 space-y-2">
                  {preview.casamentos.map((cas, idx) => (
                    <CasamentoLinha key={idx} casamento={cas} />
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {preview.revisarManualmente.length > 0 && (
            <div>
              <p className="text-sm font-medium text-orange-700 mb-2">
                Revisar manualmente (casamento ambíguo — não será anexado automaticamente)
              </p>
              <ScrollArea className="h-32 rounded border border-orange-200 bg-orange-50/30">
                <div className="p-2 space-y-2">
                  {preview.revisarManualmente.map((rev, idx) => (
                    <RevisarManualLinha key={idx} item={rev} />
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {preview.semCorrespondencia.length > 0 && (
            <div>
              <p className="text-sm font-medium text-amber-700 mb-2">Sem correspondência de lote</p>
              <ScrollArea className="h-28 rounded border border-amber-200 bg-amber-50/30">
                <ul className="p-2 text-xs space-y-1">
                  {preview.semCorrespondencia.map((c, idx) => (
                    <li key={idx} className="text-amber-800">
                      <strong>{c.insumo || '(sem insumo)'}</strong>
                      {' — '}
                      {c.loteFabricante ? (
                        <>fabricante: <code>{c.loteFabricante}</code></>
                      ) : null}
                      {c.loteFabricante && c.loteInterno ? ' · ' : null}
                      {c.loteInterno ? (
                        <>interno: <code>{c.loteInterno}</code></>
                      ) : null}
                      {!c.loteFabricante && !c.loteInterno ? (
                        <span className="text-muted-foreground">(sem lote no certificado)</span>
                      ) : null}
                      {c.validade ? <> · val. {c.validade}</> : null}
                      {c.conclusao ? <> · {c.conclusao}</> : null}
                      {' — págs '}{c.paginaInicio}–{c.paginaFim}
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            </div>
          )}

          {preview.lotesNotaSemCertificado.length > 0 && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">
                Lotes da nota sem certificado no PDF
              </p>
              <div className="flex flex-wrap gap-1">
                {preview.lotesNotaSemCertificado.map((l) => (
                  <Badge key={l.id} variant="outline" className="text-xs">
                    {l.numero_lote}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {etapa === 'enviando' && (
        <div className="space-y-3 py-4">
          <p className="text-sm text-muted-foreground">Anexando COAs aos lotes...</p>
          <Progress value={progresso} />
          <p className="text-xs text-center text-muted-foreground">{progresso}%</p>
        </div>
      )}

      {etapa === 'concluido' && resumo && (
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg border p-3 bg-green-50/50">
              <p className="text-xl font-bold text-green-700">{resumo.anexados}</p>
              <p className="text-xs">Anexados</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xl font-bold">{resumo.pulados}</p>
              <p className="text-xs">Pulados (já tinham COA)</p>
            </div>
            <div className="rounded-lg border p-3 bg-red-50/50">
              <p className="text-xl font-bold text-red-700">{resumo.erros.length}</p>
              <p className="text-xs">Erros</p>
            </div>
          </div>
          {resumo.erros.length > 0 && (
            <ScrollArea className="h-24 rounded border border-red-200">
              <ul className="p-2 text-xs space-y-1">
                {resumo.erros.map((e, i) => (
                  <li key={i} className="text-red-700">
                    Lote <code>{e.lote}</code>: {e.mensagem}
                  </li>
                ))}
              </ul>
            </ScrollArea>
          )}
          {resumo.lotesComCoa.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">Lotes com COA</p>
              <ScrollArea className="max-h-36 rounded border">
                <ul className="p-2 space-y-2">
                  {resumo.lotesComCoa.map((l) => (
                    <li key={l.loteId} className="flex items-center justify-between gap-2 text-xs">
                      <span>
                        <code>{l.numeroLote}</code>
                        {!l.storageKey && (
                          <span className="text-muted-foreground ml-1">(arquivo indisponível)</span>
                        )}
                      </span>
                      <VerPdfButton storageKey={l.storageKey} title={`COA — ${l.numeroLote}`} />
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            </div>
          )}
        </div>
      )}

      <DialogFooter>
        {etapa === 'preview' && (
          <>
            <Button variant="outline" onClick={resetar}>
              Escolher outro PDF
            </Button>
            <Button onClick={confirmarEnvio} disabled={!preview?.casamentos.length}>
              Confirmar e anexar ({totalLotesCasados} lote(s))
            </Button>
          </>
        )}
        {etapa === 'concluido' && (
          <Button onClick={onFechar}>Fechar</Button>
        )}
        {(etapa === 'selecionar' || etapa === 'analisando') && onFechar && (
          <Button variant="outline" onClick={onFechar}>Cancelar</Button>
        )}
      </DialogFooter>
    </>
  );
}

interface ImportarCoaNotaDialogProps {
  notaId: string;
  notaNumero: string;
  onDone?: () => void;
  /** Modo controlado — sem botão trigger (um dialog por página) */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ImportarCoaNotaDialog({
  notaId,
  notaNumero,
  onDone,
  open: openControlado,
  onOpenChange: onOpenChangeControlado,
}: ImportarCoaNotaDialogProps) {
  const [openInterno, setOpenInterno] = useState(false);
  const controlado = openControlado !== undefined;
  const open = controlado ? openControlado : openInterno;
  const setOpen = controlado ? (onOpenChangeControlado ?? (() => {})) : setOpenInterno;

  const handleFechar = () => setOpen(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!controlado && (
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            title="Importar COA da nota (PDF compilado)"
            className="text-blue-600 hover:text-blue-700"
            onClick={(e) => e.stopPropagation()}
          >
            <FileText className="h-4 w-4" />
          </Button>
        </DialogTrigger>
      )}

      <DialogContent className="max-w-2xl" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Importar COA da nota</DialogTitle>
          <DialogDescription>
            NF-e {notaNumero} — selecione o PDF compilado com os certificados de análise.
          </DialogDescription>
        </DialogHeader>
        {open && (
          <ImportarCoaNotaFlow
            notaId={notaId}
            notaNumero={notaNumero}
            onDone={onDone}
            onFechar={handleFechar}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function metaCertificado(c: CertificadoCoa): string {
  const parts: string[] = [];
  if (c.validade) parts.push(`val. ${c.validade}`);
  if (c.fabricacao) parts.push(`fab. ${c.fabricacao}`);
  if (c.conclusao) parts.push(c.conclusao);
  return parts.join(' · ');
}

function CasamentoLinha({ casamento }: { casamento: CasamentoCertificado }) {
  const { certificado: c, lotes, camposCasados } = casamento;
  const campoLabel = labelCampoCasamento(camposCasados);
  const meta = metaCertificado(c);
  return (
    <div className="text-xs border-b last:border-0 pb-2">
      <p className="font-medium">{c.insumo || '(sem insumo)'}</p>
      <p className="text-muted-foreground">
        {c.loteFabricante ? (
          <>Fabricante: <code>{c.loteFabricante}</code></>
        ) : null}
        {c.loteFabricante && c.loteInterno ? ' · ' : null}
        {c.loteInterno ? (
          <>Interno: <code>{c.loteInterno}</code></>
        ) : null}
        {c.nota ? <> · NF {c.nota}</> : null}
        {' · págs '}{c.paginaInicio}–{c.paginaFim}
      </p>
      {meta && <p className="text-muted-foreground text-[10px] mt-0.5">{meta}</p>}
      {campoLabel && (
        <p className="text-green-700 text-[10px] mt-0.5">
          Casou por: <strong>{campoLabel}</strong>
        </p>
      )}
      <div className="flex flex-wrap gap-1 mt-1">
        {lotes.map((l) => (
          <Badge key={l.id} variant="secondary" className="text-[10px]">
            {l.numero_lote}
            {l.nota_numero ? ` (NF ${l.nota_numero})` : ''}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function RevisarManualLinha({ item }: { item: CasamentoRevisar }) {
  const { certificado: c, lotes, motivo } = item;
  return (
    <div className="text-xs border-b last:border-0 border-orange-100 pb-2">
      <p className="font-medium text-orange-900">{c.insumo || '(sem insumo)'}</p>
      <p className="text-orange-800">
        {c.loteFabricante ? (
          <>Fabricante: <code>{c.loteFabricante}</code></>
        ) : null}
        {c.loteFabricante && c.loteInterno ? ' · ' : null}
        {c.loteInterno ? (
          <>Interno: <code>{c.loteInterno}</code></>
        ) : null}
      </p>
      <p className="text-orange-700 mt-0.5">{motivo}</p>
      <div className="flex flex-wrap gap-1 mt-1">
        {lotes.map((l) => (
          <Badge key={l.id} variant="outline" className="text-[10px] border-orange-300">
            {l.numero_lote}
          </Badge>
        ))}
      </div>
    </div>
  );
}

/** Atalho no dashboard — PDF primeiro; escolha manual de nota é exceção */
export function ImportarCoaNotaSeletor({
  notas,
  onDone,
  emptyMessage = 'Nenhuma nota disponível para importação',
}: {
  notas: { id: string; numero: string; lotesSemCoa?: number }[];
  onDone?: () => void;
  emptyMessage?: string;
}) {
  /** null = PDF-first; objeto = nota já escolhida (manual ou pelo PDF) */
  const [notaSelecionada, setNotaSelecionada] = useState<{ id: string; numero: string } | null>(null);
  /** 'pdf' mostra o fluxo direto; 'lista' pede escolha manual antes */
  const [tela, setTela] = useState<'pdf' | 'lista'>('pdf');
  const [open, setOpen] = useState(false);
  /** Só remonta o Flow ao mudar de modo/nota manual — NÃO ao auto-resolver NF do PDF */
  const [flowKey, setFlowKey] = useState(0);

  const fechar = () => {
    setOpen(false);
    setNotaSelecionada(null);
    setTela('pdf');
  };

  const labelNota = (n: { id: string; numero: string; lotesSemCoa?: number }) => {
    if (n.lotesSemCoa != null && n.lotesSemCoa > 0) {
      const sufixo = n.lotesSemCoa === 1 ? 'lote sem COA' : 'lotes sem COA';
      return `NF-e ${n.numero} — ${n.lotesSemCoa} ${sufixo}`;
    }
    return `NF-e ${n.numero}`;
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) fechar(); else setOpen(true); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <FileText className="h-4 w-4" />
          Importar COA da nota
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar COA da nota</DialogTitle>
          <DialogDescription>
            {notaSelecionada
              ? `NF-e ${notaSelecionada.numero}`
              : tela === 'lista'
                ? 'Selecione a nota de entrada (opcional — o PDF também identifica a NF sozinho).'
                : 'Envie o PDF: o sistema lê a NF e o lote no certificado e encontra a nota.'}
          </DialogDescription>
        </DialogHeader>

        {tela === 'lista' ? (
          <>
            {notas.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">{emptyMessage}</p>
            ) : (
              <ScrollArea className="h-64">
                <div className="space-y-1">
                  {notas.map((n) => (
                    <Button
                      key={n.id}
                      variant="ghost"
                      className="w-full justify-start"
                      onClick={() => {
                        setNotaSelecionada(n);
                        setTela('pdf');
                        setFlowKey((k) => k + 1);
                      }}
                    >
                      {labelNota(n)}
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            )}
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setTela('pdf');
                  setNotaSelecionada(null);
                  setFlowKey((k) => k + 1);
                }}
              >
                ← Voltar ao PDF
              </Button>
              <Button variant="outline" onClick={fechar}>Cancelar</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            {notaSelecionada && (
              <Button
                variant="link"
                size="sm"
                className="px-0 h-auto"
                onClick={() => {
                  setNotaSelecionada(null);
                  setFlowKey((k) => k + 1);
                }}
              >
                ← Limpar nota / outro PDF
              </Button>
            )}
            <ImportarCoaNotaFlow
              key={flowKey}
              notaId={notaSelecionada?.id ?? null}
              notaNumero={notaSelecionada?.numero ?? null}
              onNotaResolvida={(n) => setNotaSelecionada(n)}
              onDone={() => { onDone?.(); }}
              onFechar={fechar}
            />
            {!notaSelecionada && (
              <div className="border-t pt-3">
                <Button
                  variant="link"
                  size="sm"
                  className="px-0 h-auto"
                  onClick={() => setTela('lista')}
                >
                  Ou escolher a nota manualmente…
                </Button>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
