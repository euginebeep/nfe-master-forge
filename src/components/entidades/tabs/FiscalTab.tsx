import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

interface FiscalTabProps {
  data: {
    ie: string;
    im: string;
    cnae: string;
    crt: string;
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
  onChange: (field: string, value: any) => void;
  onFiscalConfigChange: (field: string, value: any) => void;
}

export function FiscalTab({ data, fiscalConfig, onChange, onFiscalConfigChange }: FiscalTabProps) {
  return (
    <div className="space-y-6">
      {/* Dados Fiscais Básicos */}
      <div>
        <h3 className="text-sm font-medium mb-4">Dados Fiscais</h3>
        <div className="grid grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label htmlFor="ie">Inscrição Estadual</Label>
            <Input
              id="ie"
              value={data.ie}
              onChange={(e) => onChange("ie", e.target.value)}
              placeholder="ISENTO ou número"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="im">Inscrição Municipal</Label>
            <Input
              id="im"
              value={data.im}
              onChange={(e) => onChange("im", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cnae">CNAE</Label>
            <Input
              id="cnae"
              value={data.cnae}
              onChange={(e) => onChange("cnae", e.target.value)}
              placeholder="0000-0/00"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="crt">CRT (Regime)</Label>
            <Input
              id="crt"
              value={data.crt}
              onChange={(e) => onChange("crt", e.target.value)}
              placeholder="1, 2 ou 3"
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
