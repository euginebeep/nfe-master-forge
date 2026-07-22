import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

interface FatorConversaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unidadeOrigem: string;
  unidadeDestino: string;
  fatorSugerido?: number;
  fatorAtual?: number;
  onConfirm: (fator: number) => void;
}

/**
 * Diálogo para ajuste manual de fator de conversão
 */
export function FatorConversaoDialog({
  open,
  onOpenChange,
  unidadeOrigem,
  unidadeDestino,
  fatorSugerido,
  fatorAtual,
  onConfirm,
}: FatorConversaoDialogProps) {
  const [fator, setFator] = useState(fatorSugerido?.toString() || fatorAtual?.toString() || "1");
  const [erro, setErro] = useState<string | null>(null);

  const handleConfirm = () => {
    const fatorNum = parseFloat(fator);

    if (isNaN(fatorNum) || fatorNum <= 0) {
      setErro("Fator deve ser um número positivo");
      return;
    }

    onConfirm(fatorNum);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajustar Fator de Conversão</DialogTitle>
          <DialogDescription>
            Defina o fator para converter de {unidadeOrigem} para {unidadeDestino}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {fatorSugerido && fatorAtual && fatorSugerido !== fatorAtual && (
            <Alert className="border-amber-300 bg-amber-50">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 ml-2">
                Fator sugerido: <strong>{fatorSugerido}</strong> | Fator atual: <strong>{fatorAtual}</strong>
              </AlertDescription>
            </Alert>
          )}

          <div>
            <Label htmlFor="fator">Fator de Conversão</Label>
            <Input
              id="fator"
              type="number"
              step="0.0001"
              min="0"
              value={fator}
              onChange={(e) => {
                setFator(e.target.value);
                setErro(null);
              }}
              placeholder="Ex: 1000"
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Exemplo: 1 {unidadeOrigem} = {fator} {unidadeDestino}
            </p>
          </div>

          {erro && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="ml-2">{erro}</AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2 justify-end pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirm}>
              Confirmar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

