import { useEffect, useState } from "react";

type PersistEnvelope<T> = {
  __ts: number;
  __data: T;
};

export type FormPersistOptions = {
  /** TTL em horas; padrão 12. Rascunhos mais antigos são descartados. */
  ttlHoras?: number;
  /**
   * Se false, inicia sempre com `initial` (não restaura do storage).
   * Útil quando a UI precisa perguntar "retomar ou começar do zero".
   * Padrão: true.
   */
  restore?: boolean;
  /**
   * Se false, não grava no sessionStorage (ex.: enquanto o diálogo de
   * retomar está aberto). Padrão: true.
   */
  persist?: boolean;
};

function storageKeyFor(key: string) {
  return `draft:${key}`;
}

function isEnvelope(value: unknown): value is PersistEnvelope<unknown> {
  return !!value && typeof value === "object" && "__data" in (value as object);
}

/** Lê o rascunho respeitando TTL, sem alterar o React state. */
export function readPersistedForm<T>(
  key: string,
  ttlHoras = 12,
): { data: T; ts: number } | null {
  const storageKey = storageKeyFor(key);
  try {
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) return null;
    const env = JSON.parse(raw);
    const ts = typeof env?.__ts === "number" ? env.__ts : Date.now();
    if (env?.__ts && Date.now() - env.__ts > ttlHoras * 3600_000) {
      sessionStorage.removeItem(storageKey);
      return null;
    }
    const data = (isEnvelope(env) ? env.__data : env) as T;
    return { data, ts };
  } catch {
    return null;
  }
}

/** Remove rascunhos de edição órfãos (prefixo `:edit:`) acima do TTL. */
export function purgeExpiredFormPersists(prefix: string, ttlHoras = 12) {
  const limite = ttlHoras * 3600_000;
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const k = sessionStorage.key(i);
      if (!k?.startsWith(prefix)) continue;
      try {
        const env = JSON.parse(sessionStorage.getItem(k) || "{}");
        if (env?.__ts && Date.now() - env.__ts > limite) {
          sessionStorage.removeItem(k);
        } else if (!env?.__ts && !isEnvelope(env)) {
          // formato antigo sem timestamp — trata como expirado para órfãos de edição
          if (k.includes(":edit:")) sessionStorage.removeItem(k);
        }
      } catch {
        sessionStorage.removeItem(k);
      }
    }
  } catch {
    /* ignore */
  }
}

export function useFormPersist<T>(
  key: string,
  initial: T,
  options: FormPersistOptions = {},
) {
  const { ttlHoras = 12, restore = true, persist = true } = options;
  const storageKey = storageKeyFor(key);

  const [state, setState] = useState<T>(() => {
    if (!restore) return initial;
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (!raw) return initial;
      const env = JSON.parse(raw);
      if (env?.__ts && Date.now() - env.__ts > ttlHoras * 3600_000) {
        sessionStorage.removeItem(storageKey);
        return initial;
      }
      return (env?.__data ?? env) as T; // aceita formato antigo
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    if (!persist) return;
    try {
      sessionStorage.setItem(
        storageKey,
        JSON.stringify({ __ts: Date.now(), __data: state } satisfies PersistEnvelope<T>),
      );
    } catch {
      /* ignore */
    }
  }, [storageKey, state, persist]);

  const clear = (resetTo: T = initial) => {
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
    setState(resetTo);
  };

  return [state, setState, clear] as const;
}
