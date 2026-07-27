import { useState } from 'react';
import { ShieldCheck, PenLine } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useAssinaturaRT,
  useResponsaveisTecnicosValidos,
} from '@/hooks/use-responsaveis-tecnicos';

const DECLARACAO_RT =
  'Declaro, na qualidade de Responsável Técnico, que revisei esta Ordem de Produção, suas matérias-primas, lotes e pesagens, e que o lote produzido está em conformidade para liberação.';

export interface OPAssinaturaRTCardOp {
  id: string;
  status: string;
  assinatura_rt_id?: string | null;
  assinatura_rt_hash?: string | null;
  rt_assinatura_timestamp?: string | null;
  rt_nome?: string | null;
  rt_tipo_conselho?: string | null;
  rt_numero_registro?: string | null;
  rt_uf_conselho?: string | null;
}

interface OPAssinaturaRTCardProps {
  op: OPAssinaturaRTCardOp;
  onAssinado?: () => void;
}

function formatBarretos(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function OPAssinaturaRTCard({ op, onAssinado }: OPAssinaturaRTCardProps) {
  const { data: rts = [], isLoading: rtsLoading } = useResponsaveisTecnicosValidos();
  const { assinarOP } = useAssinaturaRT();
  const [rtId, setRtId] = useState('');
  const [aceite, setAceite] = useState(false);

  if (op.status !== 'FINALIZADA') {
    return (
      <Card className="mt-4 border-dashed bg-muted/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2 text-muted-foreground">
            <ShieldCheck className="h-4 w-4" />
            Assinatura do Responsável Técnico
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            A assinatura do RT fica disponível após a finalização da OP.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (op.assinatura_rt_id) {
    const conselho = [op.rt_tipo_conselho, op.rt_numero_registro, op.rt_uf_conselho]
      .filter(Boolean)
      .join(' ')
      .replace(/^(\S+)\s+(\S+)\s+(\S+)$/, '$1 $2/$3');
    const hashPreview = (op.assinatura_rt_hash || '').slice(0, 16);

    return (
      <Card className="mt-4 border-secondary/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-secondary" />
            Assinatura do Responsável Técnico
          </CardTitle>
          <CardDescription>
            Assinatura permanente — não pode ser editada nem excluída.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p><span className="text-muted-foreground">RT:</span> {op.rt_nome || '—'}</p>
          <p><span className="text-muted-foreground">Conselho:</span> {conselho || '—'}</p>
          <p>
            <span className="text-muted-foreground">Assinado em (Barretos, UTC−3):</span>{' '}
            {formatBarretos(op.rt_assinatura_timestamp)}
          </p>
          <p className="font-mono text-xs">
            <span className="text-muted-foreground">Hash OP:</span> {hashPreview || '—'}…
          </p>
        </CardContent>
      </Card>
    );
  }

  const podeAssinar = !!rtId && aceite && !assinarOP.isPending;

  return (
    <Card className="mt-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <PenLine className="h-4 w-4" />
          Assinatura do Responsável Técnico
        </CardTitle>
        <CardDescription>
          A assinatura é permanente e não pode ser editada nem excluída. Ao assinar, o lote de
          Produto Acabado em QUARENTENA será liberado.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Responsável Técnico</Label>
          {rtsLoading ? (
            <p className="text-sm text-muted-foreground">Carregando RTs válidos…</p>
          ) : (
            <Select value={rtId} onValueChange={setRtId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o RT" />
              </SelectTrigger>
              <SelectContent>
                {rts.map((rt) => (
                  <SelectItem key={rt.id} value={rt.id}>
                    {rt.nome_completo} ({rt.tipo_conselho} {rt.numero_registro}/{rt.uf_conselho})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="rounded-md border bg-muted/30 p-3 text-sm leading-relaxed">
          {DECLARACAO_RT}
        </div>

        <div className="flex items-start gap-2">
          <Checkbox
            id="aceite-rt"
            checked={aceite}
            onCheckedChange={(v) => setAceite(v === true)}
          />
          <Label htmlFor="aceite-rt" className="text-sm font-normal leading-snug cursor-pointer">
            Li e aceito a declaração acima.
          </Label>
        </div>

        <Button
          disabled={!podeAssinar}
          onClick={() => {
            assinarOP.mutate(
              { opId: op.id, rtId },
              { onSuccess: () => onAssinado?.() },
            );
          }}
        >
          {assinarOP.isPending ? 'Assinando…' : 'Assinar e liberar lote'}
        </Button>
      </CardContent>
    </Card>
  );
}
