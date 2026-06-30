import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerGlobalShortcuts } from "./lib/keyboard-shortcuts";
import { toast } from "sonner";
import { centralToast } from "./components/ui/central-toast";
import { registerSW } from "virtual:pwa-register";
import { purgeLegacyCertificatePassword } from "./lib/local-db";

// Remediação de segurança: remove a senha do certificado digital A1 que a
// tela antiga de configurações chegou a salvar em texto puro no localStorage
// (ver use-local-company.ts / EmpresaSettingsPage). Roda uma vez por
// navegador, sem efeito em quem nunca teve esse dado salvo.
purgeLegacyCertificatePassword();

// --- Garantia de "sempre versão nova" ---
// REGRA FUNDAMENTAL: o sistema NUNCA recarrega automaticamente.
// Um reload automático apaga formulários abertos e faz o usuário perder trabalho.
// Fluxo: SW novo detectado → toast discreto → usuário decide quando recarregar.
const isInIframe = (() => {
  try { return window.self !== window.top; } catch { return true; }
})();
const host = window.location.hostname;
const isPreviewHost =
  host.includes("id-preview--") ||
  host === "localhost" ||
  host === "127.0.0.1";

if (isInIframe || isPreviewHost) {
  // Preview/dev: desregistrar SW e limpar caches — SEM reload automático
  if ("serviceWorker" in navigator) {
    Promise.all([
      navigator.serviceWorker.getRegistrations().then((regs) =>
        Promise.all(regs.map((r) => r.unregister()))
      ),
      typeof caches !== "undefined"
        ? caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
        : Promise.resolve(),
    ]).catch(() => {});
    // Não há window.location.reload() — nunca recarregar automaticamente
  }
} else {
  // Produção: NÃO recarregar automaticamente — isso apaga formulários abertos.
  // Apenas avisa o usuário (toast discreto) quando houver nova versão; ele
  // recarrega manualmente quando quiser.

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

  let notified = false;
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      if (notified) return;
      notified = true;
      // Aviso não-bloqueante. O usuário decide quando recarregar.
      try {
        toast("Nova versão disponível", {
          description: "Recarregue quando puder para aplicar as atualizações.",
          duration: Infinity,
          action: {
            label: "Recarregar agora",
            onClick: () => updateSW(true),
          },
        });
      } catch {}
    },
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      // Checagem a cada 15 minutos. Apenas dispara o toast, nunca recarrega sozinho.
      const checkUpdate = () => registration.update().catch(() => {});
      setInterval(checkUpdate, 15 * 60 * 1000);
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