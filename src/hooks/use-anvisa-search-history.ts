import { useCallback, useEffect, useState } from 'react';

const KEY = 'anvisa-search-history-v1';
const MAX = 20;

export type AnvisaHistoryEntry = {
  termo: string;
  exaustivo: boolean;
  ts: number;
};

function load(): AnvisaHistoryEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX) : [];
  } catch {
    return [];
  }
}

function persist(items: AnvisaHistoryEntry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX)));
  } catch {
    /* ignore */
  }
}

export function useAnvisaSearchHistory() {
  const [history, setHistory] = useState<AnvisaHistoryEntry[]>(() => load());

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setHistory(load());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const registrar = useCallback((termo: string, exaustivo: boolean) => {
    const t = (termo || '').trim();
    if (t.length < 2) return;
    setHistory((prev) => {
      const filtered = prev.filter(
        (e) => !(e.termo.toLowerCase() === t.toLowerCase() && e.exaustivo === exaustivo)
      );
      const next = [{ termo: t, exaustivo, ts: Date.now() }, ...filtered].slice(0, MAX);
      persist(next);
      return next;
    });
  }, []);

  const remover = useCallback((termo: string, exaustivo: boolean) => {
    setHistory((prev) => {
      const next = prev.filter(
        (e) => !(e.termo.toLowerCase() === termo.toLowerCase() && e.exaustivo === exaustivo)
      );
      persist(next);
      return next;
    });
  }, []);

  const limparHistorico = useCallback(() => {
    persist([]);
    setHistory([]);
  }, []);

  return { history, registrar, remover, limparHistorico };
}