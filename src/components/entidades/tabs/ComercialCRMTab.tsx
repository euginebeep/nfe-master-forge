import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { ORIGEM_LEAD_LABELS, ETAPA_FUNIL_LABELS, type OrigemLead, type EtapaFunil, type CanalPreferido } from "@/types/entidades";

interface ComercialCRMTabProps {
  data: {
    origem_lead: string;
    etapa_funil: string;
    score: number;
    tabela_preco_padrao: string;
    canal_preferido: string;
    desconto_maximo_percent: number;
    comissao_padrao_percent: number;
    observacoes_comerciais: string;
  };
  onChange: (field: string, value: any) => void;
}

const ETAPA_COLORS: Record<EtapaFunil, string> = {
  LEAD: 'text-blue-600',
  CONTATADO: 'text-yellow-600',
  APRESENTACAO: 'text-orange-600',
  PROPOSTA: 'text-purple-600',
  FECHADO: 'text-green-600',
  PERDIDO: 'text-red-600',
};

export function ComercialCRMTab({ data, onChange }: ComercialCRMTabProps) {
  return (
    <div className="space-y-6">
      {/* Origem e Funil */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Origem do Lead</Label>
          <Select value={data.origem_lead} onValueChange={(v) => onChange("origem_lead", v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(ORIGEM_LEAD_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Etapa do Funil</Label>
          <Select value={data.etapa_funil} onValueChange={(v) => onChange("etapa_funil", v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(ETAPA_FUNIL_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  <span className={ETAPA_COLORS[value as EtapaFunil]}>{label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Score e Canal */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Score (0-100)</Label>
          <div className="flex items-center gap-4">
            <Slider
              value={[data.score]}
              onValueChange={(v) => onChange("score", v[0])}
              max={100}
              step={1}
              className="flex-1"
            />
            <span className="w-12 text-center font-mono">{data.score}</span>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Canal Preferido</Label>
          <Select value={data.canal_preferido} onValueChange={(v) => onChange("canal_preferido", v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
              <SelectItem value="TELEFONE">Telefone</SelectItem>
              <SelectItem value="EMAIL">E-mail</SelectItem>
              <SelectItem value="VISITA">Visita</SelectItem>
              <SelectItem value="OUTRO">Outro</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tabela de Preço */}
      <div className="space-y-2">
        <Label>Tabela de Preço Padrão</Label>
        <Input
          value={data.tabela_preco_padrao}
          onChange={(e) => onChange("tabela_preco_padrao", e.target.value)}
          placeholder="Nome ou código da tabela de preço"
        />
      </div>

      {/* Desconto e Comissão */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Desconto Máximo (%)</Label>
          <Input
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={data.desconto_maximo_percent}
            onChange={(e) => onChange("desconto_maximo_percent", parseFloat(e.target.value) || 0)}
          />
        </div>
        <div className="space-y-2">
          <Label>Comissão Padrão (%)</Label>
          <Input
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={data.comissao_padrao_percent}
            onChange={(e) => onChange("comissao_padrao_percent", parseFloat(e.target.value) || 0)}
          />
        </div>
      </div>

      {/* Observações */}
      <div className="space-y-2">
        <Label>Observações Comerciais</Label>
        <Textarea
          value={data.observacoes_comerciais}
          onChange={(e) => onChange("observacoes_comerciais", e.target.value)}
          rows={4}
          placeholder="Histórico de negociações, preferências do cliente, etc."
        />
      </div>
    </div>
  );
}
