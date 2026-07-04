import { useEffect, useState } from "react";

export function useFormPersist<T>(key: string, initial: T) {
  const storageKey = `draft:${key}`;
  const [state, setState] = useState<T>(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(state));
    } catch {}
  }, [storageKey, state]);
  const clear = (resetTo: T = initial) => {
    try {
      sessionStorage.removeItem(storageKey);
    } catch {}
    setState(resetTo);
  };
  return [state, setState, clear] as const;
}
