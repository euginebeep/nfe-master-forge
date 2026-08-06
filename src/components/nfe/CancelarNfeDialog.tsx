import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fmtBRL, fmtDataHora } from "@/lib/fiscal-format";

export type NotaCancelamentoFields = {
  id: string;
  numero_formatado?: string | null;
  data_emissao?: string | null;
  pode_cancelar?: boolean | null;
  cancelamento_extemporaneo?: boolean | null;
  horas_desde_emissao?: number | null;
  horas_para_cancelar?: number | null;
  horas_limite_extemporaneo?: number | null;
  percentual_multa?: number | null;
  multa_estimada?: number | null;
  prazo_base_legal?: string | null;
  aviso_cancelamento_extemporaneo?: string | null;
  motivo_bloqueio_cancelamento?: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nota: NotaCancelamentoFields | null;
  pending?: boolean;
  onConfirm: (args: { justificativa: string; confirma_extemporaneo: boolean }) => void;
};

export function CancelarNfeDialog({
  open,
  onOpenChange,
  nota,
  pending,
  onConfirm,
}: Props) {
  const [justificativa, setJustificativa] = useState("");
  const [ciente, setCiente] = useState(false);

  useEffect(() => {
    if (open) {
      setJustificativa("");
      setCiente(false);
    }
  }, [open, nota?.id]);

  if (!nota) return null;

  const extemporaneo = !!nota.cancelamento_extemporaneo;
  const justificativaOk = justificativa.trim().length >= 15 && justificativa.trim().length <= 255;
  const podeConfirmar = justificativaOk && (!extemporaneo || ciente) && !pending;

  if (extemporaneo) {
    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent className="sm:max-w-lg">
          <AlertDialogHeader>
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-amber-100 dark:bg-amber-950 p-2 shrink-0">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <AlertDialogTitle>Cancelamento fora do prazo</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta operação está sujeita a multa.
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>

          <div className="rounded-md border bg-amber-50 dark:bg-amber-950/30 p-3 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Autorizada em</span>
              <span className="text-right">
                {fmtDataHora(nota.data_emissao)}
                {nota.horas_desde_emissao != null && (
                  <> — há {Math.round(Number(nota.horas_desde_emissao))}h</>
                )}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Prazo regulamentar</span>
              <span>
                24h — <b className="text-destructive">expirado</b>
              </span>
            </div>
            {nota.horas_limite_extemporaneo != null && (
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Aceito até</span>
                <span>{Math.round(Number(nota.horas_limite_extemporaneo))}h restantes</span>
              </div>
            )}
            <div className="flex justify-between gap-4 border-t pt-2">
              <span className="text-muted-foreground">
                Multa ({nota.percentual_multa ?? "—"}%)
              </span>
              <span className="font-semibold text-amber-700">
                {fmtBRL(nota.multa_estimada)}
              </span>
            </div>
            {nota.prazo_base_legal && (
              <p className="text-xs text-muted-foreground pt-1">{nota.prazo_base_legal}</p>
            )}
          </div>

          <Textarea
            value={justificativa}
            onChange={(e) => setJustificativa(e.target.value.slice(0, 255))}
            placeholder="Justificativa (15 a 255 caracteres)"
            maxLength={255}
            rows={3}
          />
          <p className="text-xs text-muted-foreground -mt-1">
            {justificativa.length}/255 (mínimo 15)
          </p>

          <div className="flex items-start gap-2 rounded-md border p-3">
            <Checkbox
              id="ciente-multa-cancel"
              checked={ciente}
              onCheckedChange={(v) => setCiente(!!v)}
            />
            <Label htmlFor="ciente-multa-cancel" className="text-sm font-normal leading-snug">
              Estou ciente de que este cancelamento gera multa de aproximadamente{" "}
              <b>{fmtBRL(nota.multa_estimada)}</b> e que o registro será encaminhado ao
              financeiro para recolhimento.
            </Label>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Não cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={!podeConfirmar}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                if (!podeConfirmar) return;
                onConfirm({ justificativa: justificativa.trim(), confirma_extemporaneo: true });
              }}
            >
              {pending ? "Cancelando…" : "Cancelar mesmo assim"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Cancelar NF-e {nota.numero_formatado || ""}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {nota.horas_para_cancelar != null && Number(nota.horas_para_cancelar) > 0
              ? `Dentro do prazo regulamentar — restam ${Math.floor(Number(nota.horas_para_cancelar))}h.`
              : "O cancelamento é irreversível. Justificativa entre 15 e 255 caracteres."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Textarea
          value={justificativa}
          onChange={(e) => setJustificativa(e.target.value.slice(0, 255))}
          placeholder="Justificativa (15 a 255 caracteres)"
          maxLength={255}
          rows={3}
        />
        <p className="text-xs text-muted-foreground">
          {justificativa.length}/255 (mínimo 15)
        </p>
        <AlertDialogFooter>
          <AlertDialogCancel>Não cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={!podeConfirmar}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={(e) => {
              e.preventDefault();
              if (!podeConfirmar) return;
              onConfirm({ justificativa: justificativa.trim(), confirma_extemporaneo: false });
            }}
          >
            {pending ? "Cancelando…" : "Confirmar cancelamento"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
