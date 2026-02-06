import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAssinaturaRT } from "@/hooks/use-responsaveis-tecnicos";
import { gerarHashSHA256 } from "@/types/responsavel-tecnico";
import { Loader2, Shield, CheckCircle2, FileSignature } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AssinaturaRTDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opId: string;
  opCodigo: string;
  rtId: string;
  rtNome: string;
  rtConselho: string;
  dadosOP: Record<string, unknown>;
  onSuccess?: () => void;
}

export function AssinaturaRTDialog({
  open,
  onOpenChange,
  opId,
  opCodigo,
  rtId,
  rtNome,
  rtConselho,
  dadosOP,
  onSuccess,
}: AssinaturaRTDialogProps) {
  const [aceiteDeclaracao, setAceiteDeclaracao] = useState(false);
  const [assinando, setAssinando] = useState(false);
  const { assinarOP } = useAssinaturaRT();

  const handleAssinar = async () => {
    if (!aceiteDeclaracao) return;

    setAssinando(true);
    try {
      // Gerar hash da OP
      const dadosParaHash = JSON.stringify({
        opId,
        opCodigo,
        rtId,
        dadosOP,
        timestamp: Date.now(),
      });
      const hashOP = await gerarHashSHA256(dadosParaHash);

      await assinarOP.mutateAsync({
        opId,
        rtId,
        hashOP,
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      // Erro já tratado pelo hook
    } finally {
      setAssinando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <FileSignature className="w-6 h-6 text-primary" />
            </div>
            <div>
              <DialogTitle>Declaração de Responsabilidade Técnica</DialogTitle>
              <DialogDescription>
                Ordem de Produção: {opCodigo}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Informações do RT */}
          <div className="bg-muted/50 rounded-lg p-4">
            <p className="text-sm font-medium mb-1">Responsável Técnico</p>
            <p className="font-semibold">{rtNome}</p>
            <p className="text-sm text-muted-foreground">{rtConselho}</p>
          </div>

          {/* Texto da Declaração */}
          <div className="border rounded-lg p-4 bg-card">
            <p className="text-sm font-medium mb-3 flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              Declaração Legal
            </p>
            <div className="text-sm text-muted-foreground space-y-2">
              <p>
                Eu, <span className="font-medium text-foreground">{rtNome}</span>, 
                inscrito(a) no <span className="font-medium text-foreground">{rtConselho}</span>, 
                na qualidade de Responsável Técnico, <strong>DECLARO</strong> que:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Revisei e aprovo todos os procedimentos desta Ordem de Produção</li>
                <li>Os insumos e matérias-primas estão em conformidade com as especificações</li>
                <li>O processo de fabricação atende às Boas Práticas de Fabricação (BPF)</li>
                <li>Assumo responsabilidade técnica integral pelo lote produzido</li>
                <li>Esta declaração é legalmente vinculante conforme legislação ANVISA vigente</li>
              </ul>
            </div>
          </div>

          {/* Data/Hora */}
          <div className="text-sm text-muted-foreground text-center">
            {format(new Date(), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
          </div>

          {/* Checkbox de Aceite */}
          <div className="flex items-start gap-3 p-4 border rounded-lg bg-warning/5 border-warning/30">
            <Checkbox
              id="aceite-declaracao"
              checked={aceiteDeclaracao}
              onCheckedChange={(checked) => setAceiteDeclaracao(checked === true)}
            />
            <Label htmlFor="aceite-declaracao" className="text-sm cursor-pointer">
              <span className="font-medium">Li e concordo com a declaração acima.</span>
              <br />
              <span className="text-muted-foreground">
                Entendo que esta assinatura digital tem validade legal e será registrada de forma imutável.
              </span>
            </Label>
          </div>

          {/* Aviso de Imutabilidade */}
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Esta assinatura será registrada com IP, data/hora e hash criptográfico SHA-256.
              <strong> Não pode ser alterada ou excluída após confirmação.</strong>
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={assinando}>
            Cancelar
          </Button>
          <Button 
            onClick={handleAssinar} 
            disabled={!aceiteDeclaracao || assinando}
          >
            {assinando ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Assinando...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Assinar Digitalmente
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
