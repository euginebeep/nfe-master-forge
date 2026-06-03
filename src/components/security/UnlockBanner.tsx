import { useUnlockSession } from "@/hooks/use-unlock-session";
import { Button } from "@/components/ui/button";
import { ShieldAlert, X } from "lucide-react";

export function UnlockBanner() {
  const { isUnlocked, remainingLabel, session, clear } = useUnlockSession();
  if (!isUnlocked || !session) return null;

  return (
    <div className="sticky top-0 z-50 bg-destructive text-destructive-foreground px-4 py-2 flex items-center justify-between gap-3 text-sm shadow-md">
      <div className="flex items-center gap-2 min-w-0">
        <ShieldAlert className="h-4 w-4 shrink-0" />
        <span className="font-semibold">MODO DESBLOQUEIO ATIVO</span>
        <span className="opacity-90 hidden sm:inline">·</span>
        <span className="font-mono opacity-90 hidden sm:inline">{session.challenge_code}</span>
        <span className="opacity-90">·</span>
        <span className="font-mono font-bold">{remainingLabel}</span>
        <span className="opacity-75 hidden md:inline">restantes</span>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="bg-transparent border-destructive-foreground/40 text-destructive-foreground hover:bg-destructive-foreground/10"
        onClick={clear}
      >
        <X className="h-3.5 w-3.5 mr-1" /> Encerrar agora
      </Button>
    </div>
  );
}