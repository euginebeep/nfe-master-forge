import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { isSuperDev, isGhostActive, stopGhost } from "@/lib/ghost-mode";
import { toast } from "sonner";

/**
 * Indicador invisível pro tenant. Só super dev vê (ponto vermelho discreto no canto).
 * Atalho Ctrl+Shift+G encerra a sessão de impersonation e volta pro /saas.
 */
export function GhostModeIndicator() {
  const navigate = useNavigate();
  const [active, setActive] = useState(false);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const dev = await isSuperDev();
      if (cancelled) return;
      setAllowed(dev);
      if (dev) {
        const ghost = await isGhostActive();
        if (!cancelled) setActive(ghost);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!allowed) return;
    const handler = async (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === "G" || e.key === "g")) {
        e.preventDefault();
        try {
          await stopGhost();
          setActive(false);
          toast.success("Modo fantasma encerrado.");
          navigate("/saas");
        } catch (err: any) {
          toast.error("Falha ao encerrar: " + (err?.message || "erro"));
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [allowed, navigate]);

  if (!allowed || !active) return null;

  return (
    <div
      title="Modo fantasma ativo — Ctrl+Shift+G para sair"
      style={{
        position: "fixed",
        bottom: 6,
        right: 6,
        width: 6,
        height: 6,
        borderRadius: "50%",
        background: "#ef4444",
        opacity: 0.6,
        zIndex: 99999,
        pointerEvents: "none",
      }}
    />
  );
}