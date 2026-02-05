import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useTransportadorasDisponiveis } from "@/hooks/use-entidades-extended";
import type { FretePadrao } from "@/types/entidades";

interface LogisticaTabProps {
  data: {
    frete_padrao: string;
    janela_recebimento: string;
    observacoes_entrega: string;
    transportadora_preferencial_entidade_id: string;
    prazo_medio_entrega_dias: number | null;
    pedido_minimo: number | null;
    lead_time_dias: number | null;
  };
  onChange: (field: string, value: any) => void;
}

export function LogisticaTab({ data, onChange }: LogisticaTabProps) {
  const { data: transportadoras = [] } = useTransportadorasDisponiveis();

  return (
    <div className="space-y-6">
      {/* Frete e Janela */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Frete Padrão</Label>
          <Select value={data.frete_padrao} onValueChange={(v) => onChange("frete_padrao", v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CIF">CIF (Frete por conta do remetente)</SelectItem>
              <SelectItem value="FOB">FOB (Frete por conta do destinatário)</SelectItem>
              <SelectItem value="INDEFINIDO">Indefinido</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Janela de Recebimento</Label>
          <Input
            value={data.janela_recebimento}
            onChange={(e) => onChange("janela_recebimento", e.target.value)}
            placeholder="Ex: 08:00 - 17:00"
          />
        </div>
      </div>

      {/* Transportadora Preferencial */}
      <div className="space-y-2">
        <Label>Transportadora Preferencial</Label>
        <Select 
          value={data.transportadora_preferencial_entidade_id || "none"} 
          onValueChange={(v) => onChange("transportadora_preferencial_entidade_id", v === "none" ? null : v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione uma transportadora" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Nenhuma</SelectItem>
            {transportadoras.map((t: any) => (
              <SelectItem key={t.id} value={t.id}>
                {t.razao_social} {t.nome_fantasia ? `(${t.nome_fantasia})` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Prazos e Valores */}
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Prazo Médio Entrega (dias)</Label>
          <Input
            type="number"
            min="0"
            value={data.prazo_medio_entrega_dias ?? ''}
            onChange={(e) => onChange("prazo_medio_entrega_dias", e.target.value ? parseInt(e.target.value) : null)}
          />
        </div>
        <div className="space-y-2">
          <Label>Pedido Mínimo (R$)</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={data.pedido_minimo ?? ''}
            onChange={(e) => onChange("pedido_minimo", e.target.value ? parseFloat(e.target.value) : null)}
          />
        </div>
        <div className="space-y-2">
          <Label>Lead Time (dias)</Label>
          <Input
            type="number"
            min="0"
            value={data.lead_time_dias ?? ''}
            onChange={(e) => onChange("lead_time_dias", e.target.value ? parseInt(e.target.value) : null)}
          />
          <p className="text-xs text-muted-foreground">
            Tempo médio entre pedido e entrega
          </p>
        </div>
      </div>

      {/* Observações */}
      <div className="space-y-2">
        <Label>Observações de Entrega</Label>
        <Textarea
          value={data.observacoes_entrega}
          onChange={(e) => onChange("observacoes_entrega", e.target.value)}
          rows={4}
          placeholder="Instruções especiais para entrega, restrições de acesso, etc."
        />
      </div>
    </div>
  );
}
