import { useEffect, useRef, useState } from 'react';
import { ExternalLink, Printer, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

function erroMsg(err: unknown): string {
  const e = err as { message?: string; code?: string };
  return e?.message || e?.code || 'Erro desconhecido';
}

interface PdfViewerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  signedUrl: string | null;
  title?: string;
}

/** Visualizador interno de PDF via signed URL (iframe) */
export function PdfViewerDialog({
  open,
  onOpenChange,
  signedUrl,
  title = 'Documento PDF',
}: PdfViewerDialogProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeErro, setIframeErro] = useState(false);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (open) {
      setIframeErro(false);
      setCarregando(true);
    }
  }, [open, signedUrl]);

  const handleFechar = () => {
    setIframeErro(false);
    setCarregando(true);
    onOpenChange(false);
  };

  const handleImprimir = () => {
    try {
      const win = iframeRef.current?.contentWindow;
      if (!win) throw new Error('Visualizador não disponível para impressão');
      win.focus();
      win.print();
    } catch (err) {
      toast.error(erroMsg(err));
      if (signedUrl) {
        window.open(signedUrl, '_blank', 'noopener,noreferrer');
      }
    }
  };

  const abrirNovaAba = () => {
    if (!signedUrl) return;
    const aba = window.open(signedUrl, '_blank', 'noopener,noreferrer');
    if (!aba) toast.error('Pop-up bloqueado pelo navegador');
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) handleFechar();
        else onOpenChange(true);
      }}
    >
      <DialogContent className="max-w-6xl w-[95vw] p-0 gap-0 overflow-hidden [&>button.absolute]:hidden">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3 bg-muted/30">
          <DialogTitle className="text-sm font-semibold truncate flex-1 m-0">
            {title}
          </DialogTitle>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleImprimir}
              disabled={!signedUrl || iframeErro}
            >
              <Printer className="h-4 w-4 mr-1" />
              Imprimir
            </Button>
            {signedUrl && (
              <Button type="button" variant="outline" size="sm" onClick={abrirNovaAba}>
                <ExternalLink className="h-4 w-4 mr-1" />
                Abrir em nova aba
              </Button>
            )}
            <Button type="button" variant="ghost" size="sm" onClick={handleFechar}>
              <X className="h-4 w-4 mr-1" />
              Fechar
            </Button>
          </div>
        </div>

        {signedUrl ? (
          iframeErro ? (
            <div className="flex flex-col items-center justify-center h-[80vh] gap-4 p-6 text-center">
              <p className="text-sm text-muted-foreground">
                Não foi possível exibir o PDF no visualizador interno.
              </p>
              <Button type="button" variant="outline" onClick={abrirNovaAba}>
                <ExternalLink className="h-4 w-4 mr-1" />
                Abrir em nova aba
              </Button>
            </div>
          ) : (
            <div className="relative w-full h-[80vh] bg-muted/20">
              {carregando && (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                  Carregando documento...
                </div>
              )}
              <iframe
                ref={iframeRef}
                src={signedUrl}
                title={title}
                className="w-full h-full border-0"
                onLoad={() => setCarregando(false)}
                onError={() => {
                  setIframeErro(true);
                  setCarregando(false);
                }}
              />
            </div>
          )
        ) : (
          <div className="flex items-center justify-center h-[80vh] text-sm text-muted-foreground">
            URL do documento indisponível
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
