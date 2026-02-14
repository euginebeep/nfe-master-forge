import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  maskCEP, maskPhone, maskCPF, maskCNPJ, maskCPFCNPJ,
  maskMoeda, maskNCM, maskChaveNFe, maskIE, cleanMask
} from "@/lib/masks";
import { AlertCircle, CheckCircle2 } from "lucide-react";

export type MaskType = 'cep' | 'phone' | 'cpf' | 'cnpj' | 'cpfcnpj' | 'moeda' | 'ncm' | 'chave_nfe' | 'ie' | 'im';

interface MaskedInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  mask: MaskType;
  value: string;
  onChange: (value: string) => void;
  uf?: string;
  showValidation?: boolean;
  error?: string;
}

const maskFns: Record<MaskType, (val: string, uf?: string) => string> = {
  cep: maskCEP,
  phone: maskPhone,
  cpf: maskCPF,
  cnpj: maskCNPJ,
  cpfcnpj: maskCPFCNPJ,
  moeda: maskMoeda,
  ncm: maskNCM,
  chave_nfe: maskChaveNFe,
  ie: (val) => maskIE(val),
  im: (val) => val.replace(/\D/g, ''),
};

const placeholders: Record<MaskType, string> = {
  cep: '00000-000',
  phone: '(00) 00000-0000',
  cpf: '000.000.000-00',
  cnpj: '00.000.000/0000-00',
  cpfcnpj: 'CPF ou CNPJ',
  moeda: 'R$ 0,00',
  ncm: '0000.00.00',
  chave_nfe: '0000 0000 0000 ...',
  ie: 'Inscrição Estadual',
  im: 'Inscrição Municipal',
};

const validators: Record<MaskType, (val: string) => boolean> = {
  cep: (v) => cleanMask(v).length === 8,
  phone: (v) => { const d = cleanMask(v); return d.length >= 10 && d.length <= 11; },
  cpf: (v) => cleanMask(v).length === 11,
  cnpj: (v) => cleanMask(v).length === 14,
  cpfcnpj: (v) => { const d = cleanMask(v); return d.length === 11 || d.length === 14; },
  moeda: () => true,
  ncm: (v) => cleanMask(v).length === 8,
  chave_nfe: (v) => cleanMask(v).length === 44,
  ie: (v) => v === 'ISENTO' || cleanMask(v).length >= 2,
  im: (v) => cleanMask(v).length >= 2,
};

const MaskedInput = React.forwardRef<HTMLInputElement, MaskedInputProps>(
  ({ mask, value, onChange, uf, showValidation = true, error, className, ...props }, ref) => {
    const [isTouched, setIsTouched] = React.useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const fn = maskFns[mask];
      onChange(fn ? fn(e.target.value, uf) : e.target.value);
    };

    const valid = !value || !value.trim() ? true : (validators[mask]?.(value) ?? true);
    const showStatus = showValidation && isTouched && value && value.trim() !== '';

    return (
      <div className="relative">
        <Input
          ref={ref}
          type="text"
          value={value}
          onChange={handleChange}
          onBlur={() => setIsTouched(true)}
          placeholder={placeholders[mask] || ''}
          className={cn(
            showStatus && valid && "pr-10 border-primary",
            showStatus && !valid && "pr-10 border-destructive",
            error && "border-destructive",
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
        {error && (
          <p className="text-xs text-destructive mt-1">{error}</p>
        )}
      </div>
    );
  }
);

MaskedInput.displayName = "MaskedInput";

export { MaskedInput };
