import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, KeyRound, CheckCircle2, X } from "lucide-react";
import { useUnlockSession } from "@/hooks/use-unlock-session";
import { useState } from "react";
import { UnlockDialog } from "./UnlockDialog";

export function UnlockStatusCard() {
  const { isUnlocked, remainingLabel, session, clear } = useUnlockSession();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Card className={`mt-6 border-2 ${isUnlocked ? "border-success/40 bg-success/5" : "border-destructive/30 bg-destructive/5"}`}>
        <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg ${isUnlocked ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
              {isUnlocked ? <CheckCircle2 className="h-5 w-5" /> : <ShieldAlert className="h-5 w-5" />}
            </div>
            <div>
              <p className="font-semibold text-sm">
                Operações Críticas — {isUnlocked ? "DESBLOQUEADO" : "BLOQUEADO"}
              </p>
              {isUnlocked && session ? (
                <p className="text-xs text-muted-foreground">
                  Código <span className="font-mono">{session.challenge_code}</span> · expira em <strong className="text-success">{remainingLabel}</strong>
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Solicite um código ao admin SaaS para liberar ações destrutivas (limpeza, exclusão em massa, etc.)
                </p>
              )}
              {isUnlocked && session?.escopo?.length ? (
                <div className="flex gap-1 mt-1 flex-wrap">
                  {session.escopo.map((e) => (
                    <Badge key={e} variant="outline" className="text-xs">{e}</Badge>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          <div className="flex gap-2">
            {isUnlocked ? (
              <Button size="sm" variant="outline" onClick={clear}>
                <X className="h-3.5 w-3.5 mr-1" /> Encerrar
              </Button>
            ) : (
              <Button size="sm" onClick={() => setOpen(true)}>
                <KeyRound className="h-3.5 w-3.5 mr-1" /> Solicitar desbloqueio
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
      <UnlockDialog open={open} onOpenChange={setOpen} />
    </>
  );
}