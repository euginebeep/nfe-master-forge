import { useEffect, useMemo, useState } from "react";
import { Download, FilePlus, Info, PenLine } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { fmtDataHora } from "@/lib/fiscal-format";

export type CartaCorrecaoRow = {
  id: string;
  sequencia: number;
  correcao: string | null;
  caminho_pdf: string | null;
  protocolo: string | null;
  status_sefaz: string | null;
  mensagem_sefaz: string | null;
  registrada_em: string | null;
  registrada_por_nome: string | null;
  vigente: boolean | null;
  focus_nfe_id: string | null;
};

type Props = {
  notaId: string | null;
  focusNfeId?: string | null;
  ambiente?: string | null;
  podeNova?: boolean | null;
  qtdCartas?: number | null;
  pendingEmit?: boolean;
  onEmitir: (texto: string) => void;
  onBaixarPdf: (sequencia: number) => void;
  /** Controla só o formulário de nova CC-e; o card de histórico fica na página. */
  formOpen: boolean;
  onFormOpenChange: (open: boolean) => void;
};

export function useCartasCorrecao(notaId: string | null) {
  return useQuery({
    queryKey: ["cartas-correcao", notaId],
    enabled: !!notaId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("v_cartas_correcao")
        .select("*")
        .eq("nota_saida_id", notaId)
        .order("sequencia", { ascending: true });
      if (error) throw error;
      return (data || []) as CartaCorrecaoRow[];
    },
  });
}

export function CartasCorrecaoCard({
  notaId,
  podeNova,
  qtdCartas,
  onNova,
  onBaixarPdf,
}: {
  notaId: string;
  podeNova?: boolean | null;
  qtdCartas?: number | null;
  onNova: () => void;
  onBaixarPdf: (sequencia: number) => void;
}) {
  const { data: cartas = [], isLoading } = useCartasCorrecao(notaId);
  const total = qtdCartas ?? cartas.length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between py-3 space-y-0">
        <CardTitle className="text-sm flex items-center">
          Cartas de correção
          <Badge variant="secondary" className="ml-2">
            {total}/20
          </Badge>
        </CardTitle>
        {podeNova && (
          <Button size="sm" variant="outline" onClick={onNova}>
            <FilePlus className="h-4 w-4 mr-2" /> Nova carta
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {!isLoading && cartas.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma carta de correção registrada.</p>
        )}
        {cartas.map((c) => (
          <div
            key={c.id}
            className={cn(
              "rounded-md border p-3",
              c.vigente && "border-primary bg-primary/5",
            )}
          >
            <div className="flex items-center justify-between mb-2 gap-2">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">CC-e nº {c.sequencia}</span>
                {c.vigente && <Badge>Vigente</Badge>}
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onBaixarPdf(c.sequencia)}
                disabled={!c.caminho_pdf && !c.focus_nfe_id}
              >
                <Download className="h-4 w-4 mr-1" /> PDF
              </Button>
            </div>
            <p className="text-sm whitespace-pre-wrap">{c.correcao}</p>
            <p className="text-xs text-muted-foreground mt-2">
              {fmtDataHora(c.registrada_em)}
              {c.protocolo && ` · protocolo ${c.protocolo}`}
              {c.registrada_por_nome && ` · ${c.registrada_por_nome}`}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function NovaCartaCorrecaoDialog({
  open,
  onOpenChange,
  notaId,
  pending,
  onEmitir,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notaId: string | null;
  pending?: boolean;
  onEmitir: (texto: string) => void;
}) {
  const { data: cartas = [] } = useCartasCorrecao(notaId);
  const cceVigente = useMemo(() => cartas.find((c) => c.vigente), [cartas]);
  const [correcao, setCorrecao] = useState("");

  useEffect(() => {
    if (open) {
      setCorrecao(cceVigente?.correcao ?? "");
    }
  }, [open, cceVigente?.id, cceVigente?.correcao]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenLine className="h-5 w-5" />
            Carta de Correção (CC-e)
          </DialogTitle>
          <DialogDescription>
            Texto entre 15 e 1000 caracteres. Até 20 CC-e; a SEFAZ considera apenas a última.
          </DialogDescription>
        </DialogHeader>

        {cceVigente && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Esta carta <b>substitui</b> a CC-e nº {cceVigente.sequencia}. O texto foi
              pré-preenchido com o conteúdo anterior — mantenha as correções que continuam
              válidas e acrescente as novas.
            </AlertDescription>
          </Alert>
        )}

        <Alert variant="default">
          <AlertDescription className="text-xs">
            A carta de correção <b>não</b> pode alterar: valores, base de cálculo, alíquota,
            quantidade ou preço · dados que mudem remetente ou destinatário · data de emissão
            ou de saída · parcelas de venda a prazo.
            <br />
            Para esses casos: cancelamento (dentro do prazo) ou nota de devolução.
          </AlertDescription>
        </Alert>

        <div>
          <Label>Descrição da Correção</Label>
          <Textarea
            value={correcao}
            onChange={(e) => setCorrecao(e.target.value.slice(0, 1000))}
            maxLength={1000}
            rows={8}
            className="whitespace-pre-wrap"
            placeholder="Descreva a correção…"
          />
          <p className="text-xs text-muted-foreground mt-1">
            {correcao.length}/1000 (mínimo 15)
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={correcao.trim().length < 15 || correcao.trim().length > 1000 || pending}
            onClick={() => onEmitir(correcao.trim())}
          >
            {pending ? "Enviando…" : "Emitir CC-e"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Mantém Props exportado caso a página queira composição única. */
export type CartaCorrecaoDialogProps = Props;
