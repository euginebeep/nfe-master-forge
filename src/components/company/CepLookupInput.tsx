import { useState, useCallback } from "react";
import { Search, Loader2, MapPin, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { buscarCep, isValidCep, formatCep, type EnderecoViaCep } from "@/lib/viacep";
import { toast } from "sonner";

interface CepLookupInputProps {
  value: string;
  onChange: (cep: string) => void;
  onAddressFound?: (address: EnderecoViaCep) => void;
  className?: string;
  disabled?: boolean;
}

/**
 * Input de CEP com busca automática via ViaCEP
 * Preenche automaticamente os campos de endereço ao encontrar o CEP
 */
export function CepLookupInput({ 
  value, 
  onChange, 
  onAddressFound,
  className,
  disabled 
}: CepLookupInputProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [found, setFound] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!isValidCep(value)) {
      toast.error('CEP inválido. Digite 8 dígitos.');
      return;
    }

    setIsLoading(true);
    setFound(false);

    try {
      const address = await buscarCep(value);
      
      if (address) {
        setFound(true);
        toast.success('Endereço encontrado!');
        onAddressFound?.(address);
      } else {
        toast.error('CEP não encontrado');
      }
    } catch (error) {
      toast.error('Erro ao buscar CEP. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  }, [value, onAddressFound]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newValue = e.target.value.replace(/\D/g, '');
    if (newValue.length > 8) newValue = newValue.slice(0, 8);
    
    // Auto-formatar
    if (newValue.length > 5) {
      newValue = `${newValue.slice(0, 5)}-${newValue.slice(5)}`;
    }
    
    onChange(newValue);
    setFound(false);

    // Auto-buscar quando completar 8 dígitos
    if (newValue.replace(/\D/g, '').length === 8) {
      setTimeout(() => {
        const cleanCep = newValue.replace(/\D/g, '');
        if (cleanCep.length === 8) {
          handleSearch();
        }
      }, 500);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  };

  return (
    <div className={cn("flex gap-2", className)}>
      <div className="relative flex-1">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="00000-000"
          className={cn(
            "pl-9 pr-9",
            found && "border-emerald-500 focus-visible:ring-emerald-500"
          )}
          disabled={disabled || isLoading}
          maxLength={9}
        />
        {found && (
          <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500" />
        )}
      </div>
      <Button 
        type="button"
        variant="outline" 
        size="icon"
        onClick={handleSearch}
        disabled={disabled || isLoading || !isValidCep(value)}
        title="Buscar CEP"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Search className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}
