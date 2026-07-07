import { useState } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { abrirArquivoEmNovaAba } from '@/hooks/use-files';
import { toast } from 'sonner';

function erroMsg(err: unknown): string {
  const e = err as { message?: string; code?: string };
  return e?.message || e?.code || 'Erro desconhecido';
}

interface VerPdfButtonProps {
  storageKey?: string | null;
  size?: 'sm' | 'default' | 'icon';
  className?: string;
}

/** Abre PDF/arquivo do bucket privado erp-files via signed URL */
export function VerPdfButton({ storageKey, size = 'sm', className }: VerPdfButtonProps) {
  const [abrindo, setAbrindo] = useState(false);

  const handleAbrir = async () => {
    if (!storageKey?.trim()) {
      toast.error('Arquivo não disponível ou sem chave de storage');
      return;
    }
    setAbrindo(true);
    try {
      await abrirArquivoEmNovaAba(storageKey);
    } catch (err) {
      toast.error(erroMsg(err));
    } finally {
      setAbrindo(false);
    }
  };

  return (
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
        <ExternalLink className="h-3.5 w-3.5 mr-1" />
      )}
      Ver PDF
    </Button>
  );
}
