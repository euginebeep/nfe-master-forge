import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { maskCEP, maskPhone } from "@/lib/masks";
import { maskIE, getIEPlaceholder, validateIE, maskIM, validateIM } from "@/lib/ie-validation";
import { AlertCircle, CheckCircle2 } from "lucide-react";

export type MaskType = 'cep' | 'phone' | 'ie' | 'im';

interface MaskedInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  mask: MaskType;
  value: string;
  onChange: (value: string) => void;
  uf?: string; // Required for IE validation
  showValidation?: boolean;
}

const MaskedInput = React.forwardRef<HTMLInputElement, MaskedInputProps>(
  ({ mask, value, onChange, uf, showValidation = true, className, ...props }, ref) => {
    const [isTouched, setIsTouched] = React.useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = e.target.value;
      let maskedValue: string;

      switch (mask) {
        case 'cep':
          maskedValue = maskCEP(rawValue);
          break;
        case 'phone':
          maskedValue = maskPhone(rawValue);
          break;
        case 'ie':
          maskedValue = maskIE(rawValue, uf || '');
          break;
        case 'im':
          maskedValue = maskIM(rawValue);
          break;
        default:
          maskedValue = rawValue;
      }

      onChange(maskedValue);
    };

    const getPlaceholder = (): string => {
      switch (mask) {
        case 'cep': return '00000-000';
        case 'phone': return '(00) 00000-0000';
        case 'ie': return uf ? getIEPlaceholder(uf) : 'Selecione UF primeiro';
        case 'im': return 'Inscrição Municipal';
        default: return '';
      }
    };

    const isValid = (): boolean => {
      if (!value || value.trim() === '') return true;
      
      switch (mask) {
        case 'cep':
          return value.replace(/\D/g, '').length === 8;
        case 'phone':
          const phoneDigits = value.replace(/\D/g, '');
          return phoneDigits.length >= 10 && phoneDigits.length <= 11;
        case 'ie':
          return validateIE(value, uf || '');
        case 'im':
          return validateIM(value);
        default:
          return true;
      }
    };

    const showStatus = showValidation && isTouched && value && value.trim() !== '';
    const valid = isValid();

    return (
      <div className="relative">
        <Input
          ref={ref}
          type="text"
          value={value}
          onChange={handleChange}
          onBlur={() => setIsTouched(true)}
          placeholder={getPlaceholder()}
          className={cn(
            showStatus && valid && "pr-10 border-primary",
            showStatus && !valid && "pr-10 border-destructive",
            className
          )}
          {...props}
        />
        {showStatus && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {valid ? (
              <CheckCircle2 className="h-4 w-4 text-primary" />
            ) : (
              <AlertCircle className="h-4 w-4 text-destructive" />
            )}
          </div>
        )}
      </div>
    );
  }
);

MaskedInput.displayName = "MaskedInput";

export { MaskedInput };
