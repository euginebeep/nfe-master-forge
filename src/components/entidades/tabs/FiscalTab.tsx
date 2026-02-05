import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { isEstrangeiro } from "@/types/entidades";
import { MaskedInput } from "@/components/ui/masked-input";
import { getIEPlaceholder } from "@/lib/ie-validation";

interface FiscalTabProps {
  data: {
    ie: string;
    im: string;
    cnae: string;
    crt: string;
    tipo_pessoa?: string;
  };
  fiscalConfig: {
    natureza_operacao_padrao: string;
    cfop_padrao_entrada: string;
    cfop_padrao_saida: string;
    cst_icms_padrao: string;
    cst_pis_padrao: string;
    cst_cofins_padrao: string;
    observacao_fiscal_padrao: string;
    bloquear_sem_cpf_cnpj_valido: boolean;
    bloquear_sem_ie_quando_exigido: boolean;
  };
  uf?: string; // UF for IE validation
  onChange: (field: string, value: any) => void;
  onFiscalConfigChange: (field: string, value: any) => void;
}

export function FiscalTab({ data, fiscalConfig, uf, onChange, onFiscalConfigChange }: FiscalTabProps) {
  const isForeign = isEstrangeiro(data.tipo_pessoa || 'PJ');
  return (
    <div className="space-y-6">
      {/* Alert for foreign entities */}
      {isForeign && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Entidades estrangeiras não possuem IE, IM, CNAE ou CRT brasileiros.
            Para operações de importação/exportação, utilize os campos de observação fiscal.
          </AlertDescription>
        </Alert>
      )}

      {/* Dados Fiscais Básicos */}
      <div>
        <h3 className="text-sm font-medium mb-4">Dados Fiscais</h3>
        <div className="grid grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label htmlFor="ie">
              Inscrição Estadual
              {uf && !isForeign && (
                <span className="text-xs text-muted-foreground ml-1">({uf})</span>
              )}
            </Label>
            <MaskedInput
              mask="ie"
              uf={uf || ''}
              value={isForeign ? "" : data.ie}
              onChange={(value) => onChange("ie", value)}
              disabled={isForeign}
              showValidation={!isForeign}
            />
            {!uf && !isForeign && (
              <p className="text-xs text-muted-foreground">Cadastre um endereço fiscal para validar IE</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="im">Inscrição Municipal</Label>
            <MaskedInput
              mask="im"
              value={isForeign ? "" : data.im}
              onChange={(value) => onChange("im", value)}
              disabled={isForeign}
              showValidation={!isForeign}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cnae">CNAE</Label>
            <Input
              id="cnae"
              value={isForeign ? "" : data.cnae}
              onChange={(e) => onChange("cnae", e.target.value)}
              placeholder={isForeign ? "N/A" : "0000-0/00"}
              disabled={isForeign}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="crt">CRT (Regime)</Label>
            <Input
              id="crt"
              value={isForeign ? "" : data.crt}
              onChange={(e) => onChange("crt", e.target.value)}
              placeholder={isForeign ? "N/A" : "1, 2 ou 3"}
              disabled={isForeign}
            />
          </div>
        </div>
      </div>

      {/* Configurações Padrão */}
      <div>
        <h3 className="text-sm font-medium mb-4">Configurações Padrão para Operações</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="natureza_operacao_padrao">Natureza Operação Padrão</Label>
            <Input
              id="natureza_operacao_padrao"
              value={fiscalConfig.natureza_operacao_padrao}
              onChange={(e) => onFiscalConfigChange("natureza_operacao_padrao", e.target.value)}
              placeholder="Ex: VENDA DE MERCADORIA"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cfop_padrao_entrada">CFOP Entrada Padrão</Label>
            <Input
              id="cfop_padrao_entrada"
              value={fiscalConfig.cfop_padrao_entrada}
              onChange={(e) => onFiscalConfigChange("cfop_padrao_entrada", e.target.value)}
              placeholder="Ex: 1102"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cfop_padrao_saida">CFOP Saída Padrão</Label>
            <Input
              id="cfop_padrao_saida"
              value={fiscalConfig.cfop_padrao_saida}
              onChange={(e) => onFiscalConfigChange("cfop_padrao_saida", e.target.value)}
              placeholder="Ex: 5102"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cst_icms_padrao">CST ICMS Padrão</Label>
            <Input
              id="cst_icms_padrao"
              value={fiscalConfig.cst_icms_padrao}
              onChange={(e) => onFiscalConfigChange("cst_icms_padrao", e.target.value)}
              placeholder="Ex: 00"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cst_pis_padrao">CST PIS Padrão</Label>
            <Input
              id="cst_pis_padrao"
              value={fiscalConfig.cst_pis_padrao}
              onChange={(e) => onFiscalConfigChange("cst_pis_padrao", e.target.value)}
              placeholder="Ex: 01"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cst_cofins_padrao">CST COFINS Padrão</Label>
            <Input
              id="cst_cofins_padrao"
              value={fiscalConfig.cst_cofins_padrao}
              onChange={(e) => onFiscalConfigChange("cst_cofins_padrao", e.target.value)}
              placeholder="Ex: 01"
            />
          </div>
        </div>
      </div>

      {/* Observação Fiscal */}
      <div className="space-y-2">
        <Label htmlFor="observacao_fiscal_padrao">Observação Fiscal Padrão</Label>
        <Textarea
          id="observacao_fiscal_padrao"
          value={fiscalConfig.observacao_fiscal_padrao}
          onChange={(e) => onFiscalConfigChange("observacao_fiscal_padrao", e.target.value)}
          rows={3}
          placeholder="Texto padrão para observações fiscais em documentos"
        />
      </div>

      {/* Toggles de Bloqueio */}
      <div>
        <h3 className="text-sm font-medium mb-4">Regras de Validação</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 border rounded-md">
            <div>
              <p className="font-medium">Bloquear sem CPF/CNPJ válido</p>
              <p className="text-sm text-muted-foreground">
                Impede operações se o documento estiver inválido
              </p>
            </div>
            <Switch
              checked={fiscalConfig.bloquear_sem_cpf_cnpj_valido}
              onCheckedChange={(v) => onFiscalConfigChange("bloquear_sem_cpf_cnpj_valido", v)}
            />
          </div>
          <div className="flex items-center justify-between p-3 border rounded-md">
            <div>
              <p className="font-medium">Bloquear sem IE quando exigido</p>
              <p className="text-sm text-muted-foreground">
                Impede operações se a IE estiver ausente para contribuinte
              </p>
            </div>
            <Switch
              checked={fiscalConfig.bloquear_sem_ie_quando_exigido}
              onCheckedChange={(v) => onFiscalConfigChange("bloquear_sem_ie_quando_exigido", v)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
