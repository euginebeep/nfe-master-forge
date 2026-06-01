import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerGlobalShortcuts } from "./lib/keyboard-shortcuts";
import { toast } from "sonner";
import { centralToast } from "./components/ui/central-toast";
import { registerSW } from "virtual:pwa-register";

// --- Garantia de "sempre versão nova" ---
// 1) No preview do editor (iframe / domínio lovable*), NUNCA registrar SW e
//    desregistrar qualquer um pré-existente + limpar caches.
// 2) Em produção, registrar com autoUpdate + reload imediato quando uma nova
//    versão tomar controle (controllerchange) ou quando houver refresh pendente.
const isInIframe = (() => {
  try { return window.self !== window.top; } catch { return true; }
})();
const host = window.location.hostname;
const isPreviewHost =
  host.includes("id-preview--") ||
  host.includes("lovableproject.com") ||
  host.includes("lovable.app");

if (isInIframe || isPreviewHost) {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((r) => r.unregister());
    });
    if (typeof caches !== "undefined") {
      caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
    }
  }
} else {
  // Recarrega assim que um SW novo assumir o controle desta página
  let reloading = false;
  navigator.serviceWorker?.addEventListener("controllerchange", () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      // Aplica a nova versão imediatamente (sem prompt)
      updateSW(true);
    },
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      // Checa novas versões a cada 30s e quando a aba volta ao foco
      setInterval(() => registration.update().catch(() => {}), 30 * 1000);
      window.addEventListener("focus", () => registration.update().catch(() => {}));
    },
  });
}

// Intercept sonner error/warning toasts → centralToast (centered, red, with icon)
const originalError = toast.error;
const originalWarning = toast.warning;

toast.error = (message: any, ...rest: any[]) => {
  const msg = typeof message === 'string' ? message : 'Erro';
  centralToast.error(msg);
  return '' as any;
};

toast.warning = (message: any, ...rest: any[]) => {
  const msg = typeof message === 'string' ? message : 'Atenção';
  centralToast.warning(msg);
  return '' as any;
};

// Register global keyboard shortcuts
registerGlobalShortcuts();

createRoot(document.getElementById("root")!).render(<App />);