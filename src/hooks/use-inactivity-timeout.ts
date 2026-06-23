import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Timeout de inatividade: 4 horas (era 2h — aumentado para não interromper trabalho longo)
const INACTIVITY_TIMEOUT_MS = 4 * 60 * 60 * 1000;
// Aviso 5 minutos antes de expirar
const WARNING_BEFORE_MS = 5 * 60 * 1000;

const EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];

export function useInactivityTimeout() {
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningToastIdRef = useRef<string | number | null>(null);

  const handleLogout = useCallback(async () => {
    // Dispensar toast de aviso se ainda estiver visível
    if (warningToastIdRef.current) {
      toast.dismiss(warningToastIdRef.current);
      warningToastIdRef.current = null;
    }
    await supabase.auth.signOut();
    window.location.href = '/auth';
  }, []);

  const resetTimer = useCallback(() => {
    // Cancelar timers anteriores
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);

    // Dispensar aviso anterior se o usuário voltou a interagir
    if (warningToastIdRef.current) {
      toast.dismiss(warningToastIdRef.current);
      warningToastIdRef.current = null;
    }

    // Agendar aviso 5 minutos antes de expirar
    warningTimerRef.current = setTimeout(() => {
      const id = toast('Sessão expirando em breve', {
        description: 'Você ficará desconectado em 5 minutos por inatividade. Clique aqui para continuar.',
        duration: WARNING_BEFORE_MS,
        action: {
          label: 'Continuar',
          onClick: () => resetTimer(),
        },
      });
      warningToastIdRef.current = id as string | number;
    }, INACTIVITY_TIMEOUT_MS - WARNING_BEFORE_MS);

    // Agendar logout
    logoutTimerRef.current = setTimeout(handleLogout, INACTIVITY_TIMEOUT_MS);
  }, [handleLogout]);

  useEffect(() => {
    resetTimer();

    const handler = () => resetTimer();
    EVENTS.forEach(event => window.addEventListener(event, handler, { passive: true }));

    return () => {
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      EVENTS.forEach(event => window.removeEventListener(event, handler));
    };
  }, [resetTimer]);
}
