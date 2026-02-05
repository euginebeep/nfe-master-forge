import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { FORMA_PAGAMENTO_LABELS, type FormaPagamento } from "@/types/entidades";

interface FinanceiroTabProps {
  data: {
    condicao_pagamento_padrao: string;
    forma_pagamento_padrao: string;
    limite_credito: number;
    bloquear_inadimplencia: boolean;
    dias_tolerancia: number;
    categoria_financeira_padrao: string;
    centro_custo_padrao: string;
    email_nfe: string;
    email_boleto: string;
    importar_duplicatas_xml_gera_contas_pagar: boolean;
  };
  onChange: (field: string, value: any) => void;
}

export function FinanceiroTab({ data, onChange }: FinanceiroTabProps) {
  return (
    <div className="space-y-6">
      {/* Condições de Pagamento */}
      <div>
        <h3 className="text-sm font-medium mb-4">Condições de Pagamento</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Condição Padrão</Label>
            <Input
              value={data.condicao_pagamento_padrao}
              onChange={(e) => onChange("condicao_pagamento_padrao", e.target.value)}
              placeholder="Ex: 28/56, 30/60/90"
            />
            <p className="text-xs text-muted-foreground">
              Informe os dias separados por / (ex: 28/56 para 2 parcelas)
            </p>
          </div>
          <div className="space-y-2">
            <Label>Forma de Pagamento Padrão</Label>
            <Select value={data.forma_pagamento_padrao} onValueChange={(v) => onChange("forma_pagamento_padrao", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(FORMA_PAGAMENTO_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Limite e Tolerância */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Limite de Crédito (R$)</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={data.limite_credito}
            onChange={(e) => onChange("limite_credito", parseFloat(e.target.value) || 0)}
          />
        </div>
        <div className="space-y-2">
          <Label>Dias de Tolerância</Label>
          <Input
            type="number"
            min="0"
            value={data.dias_tolerancia}
            onChange={(e) => onChange("dias_tolerancia", parseInt(e.target.value) || 0)}
          />
          <p className="text-xs text-muted-foreground">
            Dias após vencimento antes de bloquear
          </p>
        </div>
      </div>

      {/* Categorias */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Categoria Financeira Padrão</Label>
          <Input
            value={data.categoria_financeira_padrao}
            onChange={(e) => onChange("categoria_financeira_padrao", e.target.value)}
            placeholder="Ex: Matéria Prima, Serviços"
          />
        </div>
        <div className="space-y-2">
          <Label>Centro de Custo Padrão</Label>
          <Input
            value={data.centro_custo_padrao}
            onChange={(e) => onChange("centro_custo_padrao", e.target.value)}
            placeholder="Ex: Produção, Administrativo"
          />
        </div>
      </div>

      {/* E-mails */}
      <div>
        <h3 className="text-sm font-medium mb-4">E-mails para Documentos</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>E-mail para NF-e</Label>
            <Input
              type="email"
              value={data.email_nfe}
              onChange={(e) => onChange("email_nfe", e.target.value)}
              placeholder="fiscal@empresa.com"
            />
          </div>
          <div className="space-y-2">
            <Label>E-mail para Boletos</Label>
            <Input
              type="email"
              value={data.email_boleto}
              onChange={(e) => onChange("email_boleto", e.target.value)}
              placeholder="financeiro@empresa.com"
            />
          </div>
        </div>
      </div>

      {/* Toggles */}
      <div>
        <h3 className="text-sm font-medium mb-4">Configurações</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 border rounded-md">
            <div>
              <p className="font-medium">Bloquear por Inadimplência</p>
              <p className="text-sm text-muted-foreground">
                Impede novas operações se houver títulos vencidos além da tolerância
              </p>
            </div>
            <Switch
              checked={data.bloquear_inadimplencia}
              onCheckedChange={(v) => onChange("bloquear_inadimplencia", v)}
            />
          </div>
          <div className="flex items-center justify-between p-3 border rounded-md">
            <div>
              <p className="font-medium">Importar Duplicatas do XML</p>
              <p className="text-sm text-muted-foreground">
                Gerar contas a pagar automaticamente ao importar NF-e
              </p>
            </div>
            <Switch
              checked={data.importar_duplicatas_xml_gera_contas_pagar}
              onCheckedChange={(v) => onChange("importar_duplicatas_xml_gera_contas_pagar", v)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
