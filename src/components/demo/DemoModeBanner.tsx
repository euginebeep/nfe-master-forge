import { AlertTriangle } from 'lucide-react';
import { useAuthContext } from '@/contexts/AuthContext';

export function DemoModeBanner() {
  const { profile } = useAuthContext();
  if (!profile?.is_demo) return null;

  return (
    <div className="bg-amber-50 border-b-2 border-amber-400 text-amber-900 px-4 py-2 flex items-center justify-center gap-2 text-sm font-medium">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span>
        <strong>MODO DEMONSTRAÇÃO</strong> — Empresa fictícia. Os dados são reiniciados todo dia às 04:00.
        Emissão de NF-e, envio de e-mails e pagamentos estão desabilitados.
      </span>
    </div>
  );
}