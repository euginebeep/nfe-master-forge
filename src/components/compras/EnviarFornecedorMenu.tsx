import { Mail, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ContatoFornecedor } from '@/lib/fornecedor-contato-envio';
import { normalizarTelefoneWa } from '@/lib/fornecedor-contato-envio';
import { toast } from 'sonner';

interface EnviarFornecedorMenuProps {
  contato: ContatoFornecedor;
  texto: string;
  assuntoEmail: string;
  onEnviado?: () => void | Promise<void>;
  className?: string;
  triggerLabel?: string;
}

export function EnviarFornecedorMenu({
  contato,
  texto,
  assuntoEmail,
  onEnviado,
  className,
  triggerLabel = 'Enviar ao fornecedor',
}: EnviarFornecedorMenuProps) {
  const waNum = normalizarTelefoneWa(contato.telefone);
  const corpo = encodeURIComponent(texto);
  const assunto = encodeURIComponent(assuntoEmail);

  const marcarEnviado = async () => {
    if (!onEnviado) return;
    try {
      await onEnviado();
    } catch (err: unknown) {
      const e = err as { message?: string; code?: string };
      toast.error(e?.message || e?.code || 'Erro ao registrar envio');
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className={className ?? 'flex-1 min-w-[140px]'}>
          <MessageCircle className="h-4 w-4 mr-2" />
          {triggerLabel}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          disabled={!waNum}
          onClick={async () => {
            if (!waNum) {
              toast.error('Fornecedor sem telefone/WhatsApp cadastrado');
              return;
            }
            window.open(`https://wa.me/${waNum}?text=${corpo}`, '_blank', 'noopener,noreferrer');
            await marcarEnviado();
          }}
        >
          <MessageCircle className="h-4 w-4 mr-2" />
          WhatsApp
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!contato.email}
          onClick={async () => {
            if (!contato.email) {
              toast.error('Fornecedor sem e-mail cadastrado');
              return;
            }
            window.location.href = `mailto:${encodeURIComponent(contato.email)}?subject=${assunto}&body=${corpo}`;
            await marcarEnviado();
          }}
        >
          <Mail className="h-4 w-4 mr-2" />
          E-mail
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
