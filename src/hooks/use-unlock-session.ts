import { useEffect, useState, useCallback } from "react";

const STORAGE_KEY = "brainx_unlock_session";

export interface UnlockSession {
  challenge_id: string;
  challenge_code: string;
  desbloqueio_expira_em: string; // ISO
  escopo: string[];
}

function readSession(): UnlockSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UnlockSession;
    if (new Date(parsed.desbloqueio_expira_em).getTime() <= Date.now()) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function setUnlockSession(session: UnlockSession) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  window.dispatchEvent(new Event("brainx-unlock-changed"));
}

export function clearUnlockSession() {
  sessionStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event("brainx-unlock-changed"));
}

export function useUnlockSession() {
  const [session, setSession] = useState<UnlockSession | null>(() => readSession());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const refresh = () => setSession(readSession());
    window.addEventListener("brainx-unlock-changed", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("brainx-unlock-changed", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  useEffect(() => {
    if (!session) return;
    const id = setInterval(() => {
      const ms = new Date(session.desbloqueio_expira_em).getTime() - Date.now();
      if (ms <= 0) {
        clearUnlockSession();
        setSession(null);
      } else {
        setNow(Date.now());
      }
    }, 1000);
    return () => clearInterval(id);
  }, [session]);

  const expiresAt = session ? new Date(session.desbloqueio_expira_em).getTime() : 0;
  const remainingMs = session ? Math.max(0, expiresAt - now) : 0;

  const clear = useCallback(() => {
    clearUnlockSession();
    setSession(null);
  }, []);

  return {
    session,
    isUnlocked: !!session && remainingMs > 0,
    remainingMs,
    remainingLabel: formatRemaining(remainingMs),
    clear,
  };
}

function formatRemaining(ms: number) {
  if (ms <= 0) return "00:00";
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}