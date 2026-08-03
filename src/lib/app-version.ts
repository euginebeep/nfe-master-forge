/**
 * Versão do app injetada pelo Vite a partir de package.json
 * (`vite.config.ts` → `__APP_VERSION__`). Fallback alinhado ao package.json.
 */
export const APP_VERSION =
  typeof __APP_VERSION__ !== "undefined" && __APP_VERSION__
    ? __APP_VERSION__
    : "6.0.0";
