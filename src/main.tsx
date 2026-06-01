import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerGlobalShortcuts } from "./lib/keyboard-shortcuts";
import { toast } from "sonner";
import { centralToast } from "./components/ui/central-toast";
import { registerSW } from "virtual:pwa-register";

// Auto-atualiza o app sempre que houver nova versão publicada,
// evitando que o usuário fique vendo a tela antiga em cache.
registerSW({
  immediate: true,
  onNeedRefresh() {
    window.location.reload();
  },
  onRegisteredSW(_swUrl, registration) {
    // Verifica novas versões periodicamente
    if (registration) {
      setInterval(() => registration.update().catch(() => {}), 60 * 1000);
    }
  },
});

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