import { useState, useCallback } from "react";
import { Search, Loader2, CheckCircle2, AlertCircle, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  formatCNPJ, 
  cleanCNPJ, 
  isValidCNPJFormat, 
  lookupCNPJ, 
  mapToCRT, 
  mapToRegimeTributario,
  formatCNAEWithDescription,
  type CNPJData 
} from "@/lib/cnpj-lookup";

interface CNPJLookupInputProps {
  value: string;
  onChange: (value: string) => void;
  onDataFound?: (data: {
    razao_social: string;
    nome_fantasia: string;
    cnae: string;
    crt: string;
    regime_tributario: string;
    endereco_logradouro: string;
    endereco_nro: string;
    endereco_compl: string;
    endereco_bairro: string;
    endereco_cep: string;
    endereco_uf: string;
    endereco_cidade: string;
    endereco_cmun: string;
    telefone: string;
    email_fiscal: string;
    ie?: string;
    im?: string;
  }) => void;
  disabled?: boolean;
}

export function CNPJLookupInput({ value, onChange, onDataFound, disabled }: CNPJLookupInputProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [lookupSuccess, setLookupSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const formatted = formatCNPJ(raw);
    onChange(formatted);
    setLookupSuccess(false);
    setError(null);

    // Auto-lookup when 14 digits are typed
    const digits = cleanCNPJ(raw);
    if (digits.length === 14 && !lookupSuccess && onDataFound) {
      // Small delay to let state update, then trigger lookup
      setTimeout(() => {
        onChange(formatCNPJ(digits));
        triggerLookup(digits);
      }, 100);
    }
  };

  const triggerLookup = useCallback(async (rawValue?: string) => {
    const checkValue = rawValue || value;
    if (!isValidCNPJFormat(checkValue)) {
      setError("CNPJ inválido: deve conter 14 dígitos");
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const data = await lookupCNPJ(checkValue);
      if (data && onDataFound) {
        onDataFound({
          razao_social: data.razao_social || "",
          nome_fantasia: data.nome_fantasia || "",
          cnae: data.cnae_fiscal ? formatCNAEWithDescription(data.cnae_fiscal, data.cnae_fiscal_descricao) : "",
          crt: mapToCRT(data),
          regime_tributario: mapToRegimeTributario(data),
          endereco_logradouro: data.logradouro || "",
          endereco_nro: data.numero || "",
          endereco_compl: data.complemento || "",
          endereco_bairro: data.bairro || "",
          endereco_cep: data.cep?.replace(/\D/g, "") || "",
          endereco_uf: data.uf || "",
          endereco_cidade: data.municipio || "",
          endereco_cmun: data.codigo_municipio?.toString() || "",
          telefone: data.telefone || "",
          email_fiscal: data.email || "",
          ie: data.inscricao_estadual || "",
        });
        setLookupSuccess(true);
        toast.success("Dados da empresa carregados com sucesso!");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Erro ao consultar CNPJ";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [value, onDataFound]);

  const handleLookup = useCallback(() => triggerLookup(), [triggerLookup]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (isValidCNPJFormat(value) && !isLoading) {
        handleLookup();
      }
      // Move focus to next focusable element in the page
      const allFocusables = Array.from(document.querySelectorAll<HTMLElement>(
        'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled])'
      ));
      const idx = allFocusables.indexOf(e.target as HTMLElement);
      if (idx >= 0 && idx < allFocusables.length - 1) {
        setTimeout(() => allFocusables[idx + 1]?.focus(), 100);
      }
    }
  };

  // Auto-lookup on blur
  const handleBlur = useCallback(() => {
    if (isValidCNPJFormat(value) && !lookupSuccess && onDataFound) {
      handleLookup();
    }
  }, [value, lookupSuccess, onDataFound, handleLookup]);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            value={value}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder="00.000.000/0000-00"
            disabled={disabled || isLoading}
            className={lookupSuccess ? "pr-10 border-primary" : error ? "border-destructive" : ""}
          />
          {lookupSuccess && (
            <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={handleLookup}
          disabled={disabled || isLoading || !isValidCNPJFormat(value)}
          title="Buscar dados na Receita Federal"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
        </Button>
      </div>
      
      {error && (
        <Alert variant="destructive" className="animate-in fade-in slide-in-from-top-2">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erro na consulta do CNPJ</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>{error}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              onClick={() => setError(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
