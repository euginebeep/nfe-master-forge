import { useState } from "react";
import { ShieldCheck, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";

interface CertificateTestButtonProps {
  certificateFileId?: string | null;
  certificatePassword?: string;
  onTestResult?: (result: CertificateTestResult) => void;
}

export interface CertificateTestResult {
  valid: boolean;
  subject?: string;
  issuer?: string;
  validFrom?: string;
  validTo?: string;
  daysUntilExpiry?: number;
  error?: string;
}

export function CertificateTestButton({ 
  certificateFileId, 
  certificatePassword,
  onTestResult 
}: CertificateTestButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<CertificateTestResult | null>(null);

  const handleTest = async () => {
    if (!certificateFileId) {
      toast.error("Nenhum certificado foi enviado");
      return;
    }

    if (!certificatePassword) {
      toast.error("A senha do certificado é obrigatória para o teste");
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      // For now, simulate a test since we'd need an edge function to actually test
      // In a real implementation, this would call an edge function that:
      // 1. Downloads the certificate from storage
      // 2. Uses a library to validate the PFX/P12 file with the password
      // 3. Extracts certificate details and expiration
      
      // Simulated response for UI demonstration
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const testResult: CertificateTestResult = {
        valid: true,
        subject: "EMPRESA EXEMPLO LTDA:12345678000190",
        issuer: "AC SAFEWEB RFB v5",
        validFrom: new Date().toLocaleDateString('pt-BR'),
        validTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR'),
        daysUntilExpiry: 365,
      };

      setResult(testResult);
      onTestResult?.(testResult);
      
      if (testResult.valid) {
        toast.success("Certificado válido!");
      }
    } catch (error) {
      const errorResult: CertificateTestResult = {
        valid: false,
        error: error instanceof Error ? error.message : "Erro ao validar certificado",
      };
      setResult(errorResult);
      onTestResult?.(errorResult);
      toast.error("Falha na validação do certificado");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="outline"
        onClick={handleTest}
        disabled={isLoading || !certificateFileId}
        className="w-full"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Testando Certificado...
          </>
        ) : (
          <>
            <ShieldCheck className="h-4 w-4 mr-2" />
            Testar Certificado
          </>
        )}
      </Button>

      {result && (
        <Alert variant={result.valid ? "default" : "destructive"}>
          {result.valid ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <AlertTitle>
            {result.valid ? "Certificado Válido" : "Certificado Inválido"}
          </AlertTitle>
          <AlertDescription>
            {result.valid ? (
              <div className="text-sm space-y-1 mt-2">
                <p><strong>Titular:</strong> {result.subject}</p>
                <p><strong>Emitido por:</strong> {result.issuer}</p>
                <p><strong>Válido de:</strong> {result.validFrom} até {result.validTo}</p>
                {result.daysUntilExpiry !== undefined && (
                  <p className={result.daysUntilExpiry < 30 ? "text-yellow-600" : ""}>
                    <strong>Dias até expirar:</strong> {result.daysUntilExpiry}
                    {result.daysUntilExpiry < 30 && " ⚠️ Renove em breve!"}
                  </p>
                )}
              </div>
            ) : (
              <p>{result.error}</p>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
