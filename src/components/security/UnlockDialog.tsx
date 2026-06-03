import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Copy, KeyRound, Loader2, ShieldAlert, CheckCircle2, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { setUnlockSession } from "@/hooks/use-unlock-session";
import { invokeEdge } from "@/lib/edge-invoke";

const ESCOPOS = [
  { id: "DELETE_DADOS", label: "Apagar dados (lotes, OPs, NFes, entidades)" },
  { id: "EDITAR_BLOQUEADOS", label: "Editar registros bloqueados (OP encerrada, lote assinado)" },
  { id: "RESET_TENANT", label: "Limpeza total / reset do tenant" },
  { id: "OUTRAS_ACOES", label: "Outras ações destrutivas" },
] as const;

type Step = "request" | "waiting" | "consume";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onUnlocked?: () => void;
}

export function UnlockDialog({ open, onOpenChange, onUnlocked }: Props) {
  const [step, setStep] = useState<Step>("request");
  const [motivo, setMotivo] = useState("");
  const [escopo, setEscopo] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const [challengeCode, setChallengeCode] = useState("");
  const [expiraEm, setExpiraEm] = useState<string | null>(null);
  const [statusDesafio, setStatusDesafio] = useState<string>("AGUARDANDO_ADMIN");

  const [tempPassword, setTempPassword] = useState("");

  useEffect(() => {
    if (!open) {
      setStep("request");
      setMotivo("");
      setEscopo([]);
      setChallengeCode("");
      setExpiraEm(null);
      setTempPassword("");
      setStatusDesafio("AGUARDANDO_ADMIN");
    }
  }, [open]);

  // Poll status enquanto aguardando
  useEffect(() => {
    if (step !== "waiting" || !challengeCode) return;
    const id = setInterval(async () => {
      const { data } = await supabase
        .from("unlock_challenges")
        .select("status")
        .eq("challenge_code", challengeCode)
        .maybeSingle();
      if (data?.status) {
        setStatusDesafio(data.status);
        if (data.status === "LIBERADO") {
          clearInterval(id);
          setStep("consume");
          toast.success("Admin SaaS liberou! Insira a senha temporária recebida.");
        }
      }
    }, 5000);
    return () => clearInterval(id);
  }, [step, challengeCode]);

  const handleRequest = async () => {
    if (motivo.trim().length < 10) {
      toast.error("Motivo deve ter ao menos 10 caracteres");
      return;
    }
    if (escopo.length === 0) {
      toast.error("Selecione ao menos um escopo");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await invokeEdge<{ challenge_code: string; expira_em: string }>(
        "unlock-request",
        { motivo, escopo }
      );
      if (error || !data) {
        toast.error(error || "Erro ao solicitar");
        return;
      }
      setChallengeCode(data.challenge_code);
      setExpiraEm(data.expira_em);
      setStep("waiting");
      toast.success("Código gerado! Envie ao admin SaaS.");
    } finally {
      setLoading(false);
    }
  };

  const handleConsume = async () => {
    if (!/^\d{8}$/.test(tempPassword)) {
      toast.error("Senha deve ter 8 dígitos");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await invokeEdge<any>("unlock-consume", {
        challenge_code: challengeCode,
        temp_password: tempPassword,
      });
      if (error || !data) {
        toast.error(error || "Senha inválida");
        return;
      }
      setUnlockSession({
        challenge_id: data.challenge_id,
        challenge_code: data.challenge_code,
        desbloqueio_expira_em: data.desbloqueio_expira_em,
        escopo: data.escopo || [],
      });
      toast.success("Modo desbloqueio ATIVO por 30 minutos");
      onOpenChange(false);
      onUnlocked?.();
    } finally {
      setLoading(false);
    }
  };

  const toggleEscopo = (id: string) => {
    setEscopo((prev) => (prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <ShieldAlert className="h-5 w-5" />
            Desbloqueio de Operação Crítica
          </DialogTitle>
          <DialogDescription>
            Para executar ações destrutivas, é necessária autorização do administrador SaaS.
          </DialogDescription>
        </DialogHeader>

        {step === "request" && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="motivo">Motivo (obrigatório, mín. 10 caracteres)</Label>
              <Textarea
                id="motivo"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ex.: Limpar dados de teste antes do go-live em produção"
                rows={3}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="mb-2 block">Escopo das ações</Label>
              <div className="space-y-2">
                {ESCOPOS.map((e) => (
                  <label key={e.id} className="flex items-start gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={escopo.includes(e.id)}
                      onCheckedChange={() => toggleEscopo(e.id)}
                    />
                    <span>{e.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={handleRequest} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <KeyRound className="h-4 w-4 mr-2" />}
                Gerar código
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "waiting" && (
          <div className="space-y-4">
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-center">
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Código do desafio</p>
              <p className="text-3xl font-mono font-bold tracking-wider text-primary">{challengeCode}</p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() => {
                  navigator.clipboard.writeText(challengeCode);
                  toast.success("Código copiado");
                }}
              >
                <Copy className="h-3.5 w-3.5 mr-1" /> Copiar
              </Button>
            </div>
            <div className="text-sm text-muted-foreground space-y-2">
              <p><strong>1.</strong> Envie este código ao administrador SaaS (WhatsApp / e-mail).</p>
              <p><strong>2.</strong> Aguarde a senha temporária de 8 dígitos.</p>
              <p><strong>3.</strong> Quando receber, clique em <em>"Já recebi a senha"</em>.</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              Status: <Badge variant="outline">{statusDesafio}</Badge>
              {expiraEm && <span>· Expira em {new Date(expiraEm).toLocaleString("pt-BR")}</span>}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
              <Button onClick={() => setStep("consume")}>
                <CheckCircle2 className="h-4 w-4 mr-2" /> Já recebi a senha
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "consume" && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Código</p>
              <p className="font-mono font-semibold">{challengeCode}</p>
            </div>
            <div>
              <Label htmlFor="temp-pw">Senha temporária (8 dígitos)</Label>
              <Input
                id="temp-pw"
                value={tempPassword}
                onChange={(e) => setTempPassword(e.target.value.replace(/\D/g, "").slice(0, 8))}
                placeholder="00000000"
                inputMode="numeric"
                maxLength={8}
                className="mt-1 font-mono text-center text-2xl tracking-widest"
                autoFocus
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Ao confirmar, será aberta uma janela de <strong>30 minutos</strong> com permissão para executar as ações destrutivas selecionadas.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("waiting")}>Voltar</Button>
              <Button onClick={handleConsume} disabled={loading || tempPassword.length !== 8} variant="destructive">
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <KeyRound className="h-4 w-4 mr-2" />}
                Desbloquear
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}