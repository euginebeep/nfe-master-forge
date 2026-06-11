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
    const hadController = !!navigator.serviceWorker.controller;
    Promise.all([
      navigator.serviceWorker.getRegistrations().then((regs) =>
        Promise.all(regs.map((r) => r.unregister())),
      ),
      typeof caches !== "undefined"
        ? caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
        : Promise.resolve(),
    ])
      .then(() => {
        // Se a página atual ainda estava sendo controlada por um SW antigo,
        // recarrega UMA vez para descolar da HTML cacheada antiga.
        if (hadController && !sessionStorage.getItem("brainx_preview_sw_purged")) {
          sessionStorage.setItem("brainx_preview_sw_purged", "1");
          window.location.reload();
        }
      })
      .catch(() => {});
  }
} else {
  // Produção: registra o SW novo e força reload imediato em TODAS as abas
  // assim que detectar nova versão.
  let reloading = false;
  const reloadAllTabs = (reason: string) => {
    if (reloading) return;
    reloading = true;
    try {
      // Notifica outras abas abertas para recarregarem também
      const bc = new BroadcastChannel("brainx-sw");
      bc.postMessage({ type: "reload", reason, at: Date.now() });
      bc.close();
    } catch {}
    window.location.reload();
  };

  // Reload quando um SW novo assume o controle (skipWaiting+clientsClaim)
  navigator.serviceWorker?.addEventListener("controllerchange", () =>
    reloadAllTabs("controllerchange"),
  );

  // Reload sincronizado entre abas
  try {
    const bc = new BroadcastChannel("brainx-sw");
    bc.addEventListener("message", (e) => {
      if (e.data?.type === "reload" && !reloading) {
        reloading = true;
        window.location.reload();
      }
    });
  } catch {}

  // Desregistra qualquer SW órfão que não seja o nosso (scopes antigos, etc.)
  navigator.serviceWorker?.getRegistrations().then((regs) => {
    regs.forEach((r) => {
      const url = r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL || "";
      // Mantém apenas o SW raiz (/sw.js gerado pelo workbox)
      if (url && !/\/sw\.js(\?|$)/.test(url)) {
        r.unregister().catch(() => {});
      }
    });
  });

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      // Aplica a nova versão imediatamente, sem prompt
      updateSW(true);
    },
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      const checkUpdate = () => registration.update().catch(() => {});
      // Polling agressivo (15s) — não depende de foco/troca de aba
      setInterval(checkUpdate, 15 * 1000);
      // Eventos adicionais que costumam disparar troca de versão
      window.addEventListener("focus", checkUpdate);
      window.addEventListener("online", checkUpdate);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") checkUpdate();
      });
      // Checa logo após boot
      checkUpdate();
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