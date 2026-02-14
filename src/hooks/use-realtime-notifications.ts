import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useRealtimeNotifications() {
  useEffect(() => {
    const channel = supabase
      .channel('db-changes')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
      }, (payload) => {
        const notif = payload.new as { title?: string; message?: string; type?: string };
        if (notif.type === 'error') {
          toast.error(notif.title || 'Alerta', { description: notif.message });
        } else if (notif.type === 'warning') {
          toast.warning(notif.title || 'Atenção', { description: notif.message });
        } else {
          toast.info(notif.title || 'Informação', { description: notif.message });
        }
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'qc_desvios',
      }, (payload) => {
        const desvio = payload.new as { codigo?: string; severidade?: string; descricao?: string };
        if (desvio.severidade === 'CRITICA' || desvio.severidade === 'MAIOR') {
          toast.error(`Desvio ${desvio.severidade}: ${desvio.codigo}`, {
            description: desvio.descricao,
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
}
