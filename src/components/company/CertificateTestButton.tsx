import { useState } from "react";
import { ShieldCheck, Loader2, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";

interface CertificateTestButtonProps {
  certificateFileId?: string | null;
  certificatePassword?: string;
  companyCnpj?: string;
  onTestResult?: (result: CertificateTestResult) => void;
}

export interface CertificateTestResult {
  valid: boolean;
  subject?: string;
  issuer?: string;
  validFrom?: string;
  validTo?: string;
  daysUntilExpiry?: number;
  serialNumber?: string;
  certCnpj?: string;
  cnpjMatch?: boolean;
  cnpjWarning?: string;
  error?: string;
}

export function CertificateTestButton({ 
  certificateFileId, 
  certificatePassword,
  companyCnpj,
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
      const { supabase } = await import('@/integrations/supabase/client');
      const { data, error } = await supabase.functions.invoke("validate-certificate", {
        body: { fileId: certificateFileId, password: certificatePassword, companyCnpj },
      });
      if (error) throw error;

      const testResult: CertificateTestResult = data;
      setResult(testResult);
      onTestResult?.(testResult);

      // Mantém o cache do auto-validate (EmpresaSettingsPage) em sincronia —
      // sem isso, um teste manual recente não refletiria na próxima vez que a
      // página carregar, pois o auto-validate usaria o cache antigo.
      try {
        sessionStorage.setItem(
          `cert_validation_${certificateFileId}`,
          JSON.stringify({ result: testResult, cachedAt: Date.now() })
        );
      } catch {
        // sessionStorage indisponível (modo privado, etc) — não é crítico
      }

      if (testResult.valid) {
        if (testResult.daysUntilExpiry !== undefined && testResult.daysUntilExpiry < 30) {
          toast.warning(`Certificado válido, mas expira em ${testResult.daysUntilExpiry} dias!`);
        } else {
          toast.success("Certificado válido!");
        }
      } else {
        toast.error(testResult.error || "Certificado inválido");
      }
    } catch (error) {
      console.error('Certificate validation error:', error);
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

  const getExpiryColor = (days?: number) => {
    if (days === undefined) return "";
    if (days < 0) return "text-destructive";
    if (days < 30) return "text-yellow-600 dark:text-yellow-500";
    if (days < 90) return "text-orange-600 dark:text-orange-500";
    return "text-primary";
  };

  const getExpiryIcon = (days?: number) => {
    if (days === undefined) return null;
    if (days < 30) return "⚠️";
    if (days < 90) return "⏳";
    return "✓";
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
            Validando Certificado...
          </>
        ) : (
          <>
            <ShieldCheck className="h-4 w-4 mr-2" />
            Testar Certificado
          </>
        )}
      </Button>

      {result && (
        <Alert variant={result.valid ? "default" : "destructive"} className="animate-in fade-in slide-in-from-top-2">
          {result.valid ? (
            <CheckCircle2 className="h-4 w-4 text-primary" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <AlertTitle className="flex items-center gap-2">
            {result.valid ? "Certificado Válido" : "Certificado Inválido"}
            {result.valid && result.daysUntilExpiry !== undefined && result.daysUntilExpiry < 30 && (
              <span className="text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 px-2 py-0.5 rounded-full">
                Expira em breve
              </span>
            )}
          </AlertTitle>
          <AlertDescription>
            {result.valid ? (
              <div className="text-sm space-y-1.5 mt-2">
                <p><strong>Titular:</strong> {result.subject}</p>
                <p><strong>Emitido por:</strong> {result.issuer}</p>
                <p><strong>Válido de:</strong> {result.validFrom} <strong>até</strong> {result.validTo}</p>
                {result.certCnpj && (
                  <p><strong>CNPJ do Certificado:</strong> {result.certCnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')}</p>
                )}
                {result.cnpjWarning && (
                  <p className="text-yellow-600 dark:text-yellow-400 text-xs mt-1">⚠️ {result.cnpjWarning}</p>
                )}
                {result.serialNumber && (
                  <p className="text-muted-foreground text-xs"><strong>Nº Série:</strong> {result.serialNumber}</p>
                )}
                {result.daysUntilExpiry !== undefined && (
                  <div className={`flex items-center gap-2 font-medium mt-2 p-2 rounded-md bg-muted/50 ${getExpiryColor(result.daysUntilExpiry)}`}>
                    <Clock className="h-4 w-4" />
                    <span>
                      {result.daysUntilExpiry < 0 
                        ? `Expirado há ${Math.abs(result.daysUntilExpiry)} dias`
                        : `${result.daysUntilExpiry} dias até expirar`
                      } {getExpiryIcon(result.daysUntilExpiry)}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-1">{result.error}</p>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
