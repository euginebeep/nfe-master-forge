import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const INACTIVITY_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 hours
const EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];

export function useInactivityTimeout() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLogout = useCallback(async () => {
    toast.warning('Sessão expirada por inatividade. Faça login novamente.', { duration: 6000 });
    await supabase.auth.signOut();
    // Force full reload to clear all state and go to login
    window.location.href = '/auth';
  }, []);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(handleLogout, INACTIVITY_TIMEOUT_MS);
  }, [handleLogout]);

  useEffect(() => {
    // Start timer
    resetTimer();

    // Reset on user activity
    const handler = () => resetTimer();
    EVENTS.forEach(event => window.addEventListener(event, handler, { passive: true }));

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      EVENTS.forEach(event => window.removeEventListener(event, handler));
    };
  }, [resetTimer]);
}
