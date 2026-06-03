import { ReactNode, useState } from "react";
import { useUnlockSession } from "@/hooks/use-unlock-session";
import { UnlockDialog } from "./UnlockDialog";

interface Props {
  /** Render-prop: receives a function to invoke the protected action. */
  children: (args: { run: (action: () => void) => void; isUnlocked: boolean }) => ReactNode;
}

/**
 * Wrap destructive UI with this guard. The render-prop exposes `run(action)`:
 * if user already unlocked, calls action immediately; otherwise opens dialog
 * and runs the action after successful unlock.
 */
export function UnlockGuard({ children }: Props) {
  const { isUnlocked } = useUnlockSession();
  const [open, setOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const run = (action: () => void) => {
    if (isUnlocked) {
      action();
    } else {
      setPendingAction(() => action);
      setOpen(true);
    }
  };

  return (
    <>
      {children({ run, isUnlocked })}
      <UnlockDialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setPendingAction(null);
        }}
        onUnlocked={() => {
          pendingAction?.();
          setPendingAction(null);
        }}
      />
    </>
  );
}