import { useState } from 'react';
import { Eye, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createSignedFileUrl } from '@/hooks/use-files';
import { PdfViewerDialog } from '@/components/shared/PdfViewerDialog';
import { toast } from 'sonner';

function erroMsg(err: unknown): string {
  const e = err as { message?: string; code?: string };
  return e?.message || e?.code || 'Erro desconhecido';
}

interface VerPdfButtonProps {
  storageKey?: string | null;
  title?: string;
  size?: 'sm' | 'default' | 'icon';
  className?: string;
}

/** Abre PDF do bucket privado erp-files no visualizador interno */
export function VerPdfButton({ storageKey, title, size = 'sm', className }: VerPdfButtonProps) {
  const [abrindo, setAbrindo] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  const handleAbrir = async () => {
    if (!storageKey?.trim()) {
      toast.error('Arquivo não disponível ou sem chave de storage');
      return;
    }
    setAbrindo(true);
    try {
      const url = await createSignedFileUrl(storageKey);
      setSignedUrl(url);
      setViewerOpen(true);
    } catch (err) {
      toast.error(erroMsg(err));
    } finally {
      setAbrindo(false);
    }
  };

  const handleViewerOpenChange = (open: boolean) => {
    setViewerOpen(open);
    if (!open) setSignedUrl(null);
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size={size}
        className={className}
        disabled={!storageKey?.trim() || abrindo}
        onClick={(e) => {
          e.stopPropagation();
          handleAbrir();
        }}
      >
        {abrindo ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
        ) : (
          <Eye className="h-3.5 w-3.5 mr-1" />
        )}
        Ver PDF
      </Button>

      <PdfViewerDialog
        open={viewerOpen}
        onOpenChange={handleViewerOpenChange}
        signedUrl={signedUrl}
        title={title || 'Documento PDF'}
      />
    </>
  );
}
