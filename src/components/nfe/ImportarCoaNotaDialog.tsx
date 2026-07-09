import { useRef, useState } from 'react';
import { FileText, Loader2, Upload } from 'lucide-react';
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
import { toast } from 'sonner';
import {
  extrairTextoPorPagina,
  parseCertificados,
  fatiarCertificado,
  type CertificadoCoa,
} from '@/lib/coa-splitter';
import {
  montarPreviewImportacaoCoa,
  lotesComCoaExistente,
  buscarCoasDosLotes,
  type PreviewImportacaoCoa,
  type CasamentoCertificado,
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
  notaId: string;
  notaNumero: string;
  onDone?: () => void;
  onFechar?: () => void;
}

/** Fluxo interno reutilizável (sem trigger/dialog wrapper) */
export function ImportarCoaNotaFlow({ notaId, notaNumero, onDone, onFechar }: ImportarCoaNotaFlowProps) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const [etapa, setEtapa] = useState<Etapa>('selecionar');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewImportacaoCoa | null>(null);
  const [progresso, setProgresso] = useState(0);
  const [resumo, setResumo] = useState<ResumoEnvio | null>(null);

  const resetar = () => {
    setEtapa('selecionar');
    setArquivo(null);
    setPreview(null);
    setProgresso(0);
    setResumo(null);
  };

  const processarArquivo = async (file: File) => {
    setArquivo(file);
    setEtapa('analisando');
    try {
      const paginas = await extrairTextoPorPagina(file);
      if (!paginas.length) {
        toast.error('PDF sem páginas legíveis ou arquivo vazio.');
        setEtapa('selecionar');
        return;
      }

      const certificados = parseCertificados(paginas);
      if (!certificados.length) {
        toast.error('Nenhum certificado encontrado no PDF. Verifique se contém campos "Insumo:" e "Lote do Fabricante:".');
        setEtapa('selecionar');
        return;
      }

      const prev = await montarPreviewImportacaoCoa(notaId, certificados);
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
            NF-e {notaNumero} — o sistema identificará certificados, casará com lotes pelo número
            do fabricante e mostrará um preview antes de anexar.
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
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg border p-3">
              <p className="text-2xl font-bold">{preview.certificados.length}</p>
              <p className="text-xs text-muted-foreground">Certificados</p>
            </div>
            <div className="rounded-lg border p-3 bg-green-50/50">
              <p className="text-2xl font-bold text-green-700">{totalCasados}</p>
              <p className="text-xs text-muted-foreground">Casaram ({totalLotesCasados} lote(s))</p>
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

          {preview.semCorrespondencia.length > 0 && (
            <div>
              <p className="text-sm font-medium text-amber-700 mb-2">Sem correspondência de lote</p>
              <ScrollArea className="h-28 rounded border border-amber-200 bg-amber-50/30">
                <ul className="p-2 text-xs space-y-1">
                  {preview.semCorrespondencia.map((c, idx) => (
                    <li key={idx} className="text-amber-800">
                      <strong>{c.insumo || '(sem insumo)'}</strong>
                      {' — lote fabricante: '}
                      <code>{c.loteFabricante || '(vazio)'}</code>
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

function CasamentoLinha({ casamento }: { casamento: CasamentoCertificado }) {
  const { certificado: c, lotes } = casamento;
  return (
    <div className="text-xs border-b last:border-0 pb-2">
      <p className="font-medium">{c.insumo || '(sem insumo)'}</p>
      <p className="text-muted-foreground">
        Lote fabricante: <code>{c.loteFabricante}</code> · págs {c.paginaInicio}–{c.paginaFim}
      </p>
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

/** Atalho no dashboard — seleciona nota antes do fluxo */
export function ImportarCoaNotaSeletor({
  notas,
  onDone,
}: {
  notas: { id: string; numero: string }[];
  onDone?: () => void;
}) {
  const [notaSelecionada, setNotaSelecionada] = useState<{ id: string; numero: string } | null>(null);
  const [open, setOpen] = useState(false);

  if (!notas.length) return null;

  const fechar = () => {
    setOpen(false);
    setNotaSelecionada(null);
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
              : 'Selecione a nota de entrada para importar o PDF compilado de COAs.'}
          </DialogDescription>
        </DialogHeader>

        {!notaSelecionada ? (
          <>
            <ScrollArea className="h-64">
              <div className="space-y-1">
                {notas.map((n) => (
                  <Button
                    key={n.id}
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => setNotaSelecionada(n)}
                  >
                    NF-e {n.numero}
                  </Button>
                ))}
              </div>
            </ScrollArea>
            <DialogFooter>
              <Button variant="outline" onClick={fechar}>Cancelar</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <Button
              variant="link"
              size="sm"
              className="px-0 h-auto"
              onClick={() => setNotaSelecionada(null)}
            >
              ← Trocar nota
            </Button>
            <ImportarCoaNotaFlow
              notaId={notaSelecionada.id}
              notaNumero={notaSelecionada.numero}
              onDone={() => { onDone?.(); }}
              onFechar={fechar}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
