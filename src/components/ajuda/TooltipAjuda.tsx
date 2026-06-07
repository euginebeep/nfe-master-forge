import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Info } from 'lucide-react';

interface TooltipAjudaProps {
  titulo: string;
  descricao: string;
  exemplo?: string;
  obrigatorio?: boolean;
  prazo?: string;
}

export function TooltipAjuda({
  titulo,
  descricao,
  exemplo,
  obrigatorio,
  prazo,
}: TooltipAjudaProps) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center justify-center text-muted-foreground hover:text-primary transition-colors align-middle"
            aria-label={`Ajuda: ${titulo}`}
          >
            <Info className="w-3.5 h-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs space-y-1.5 p-3">
          <p className="text-sm font-semibold text-foreground">{titulo}</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{descricao}</p>
          {exemplo && (
            <p className="text-[11px] text-primary bg-primary/5 rounded px-1.5 py-1 mt-1">
              <span className="font-semibold">Ex:</span> {exemplo}
            </p>
          )}
          {obrigatorio && (
            <p className="text-[11px] text-amber-700 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-300 rounded px-1.5 py-1">
              ⚠ Campo obrigatório
            </p>
          )}
          {prazo && (
            <p className="text-[11px] text-rose-700 bg-rose-50 dark:bg-rose-950/30 dark:text-rose-300 rounded px-1.5 py-1">
              ⏳ Prazo: {prazo}
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ── Tooltips pré-configurados para campos do BrainX ERP ──────────
export const TOOLTIPS = {
  numeroNotificacaoAnvisa: (
    <TooltipAjuda
      titulo="Nº de Notificação ANVISA"
      descricao="Código emitido pela ANVISA que comprova o registro do suplemento. Obrigatório para todos os suplementos comercializados no Brasil."
      exemplo="25351.123456/2024-78"
      obrigatorio
      prazo="Obrigatório a partir de set/2026 (RDC 990/2025)"
    />
  ),
  hashSha256: (
    <TooltipAjuda
      titulo="Hash SHA-256"
      descricao="Assinatura digital única de 64 caracteres que garante que o lote não foi alterado. Gerada automaticamente quando o RT assina a OP."
      exemplo="a3f5b2c8d9e1f4...e8b7c6d5"
    />
  ),
  statusLote: (
    <TooltipAjuda
      titulo="Status do Lote"
      descricao="QUARENTENA = aguardando liberação do RT. DISPONÍVEL = liberado para venda. ESGOTADO = sem saldo. BLOQUEADO = desvio crítico."
      exemplo="QUARENTENA → RT assina → DISPONÍVEL"
    />
  ),
  fefo: (
    <TooltipAjuda
      titulo="FEFO (First-Expire, First-Out)"
      descricao="O sistema usa primeiro o lote que vence antes. Evita perda por validade e cumpre exigência de BPF."
      exemplo="Lote A vence 12/2026 → sai antes do lote B (06/2027)"
    />
  ),
  toleranciaPercent: (
    <TooltipAjuda
      titulo="Tolerância de Pesagem"
      descricao="Margem aceitável (%) entre o peso real e o teórico. Acima disso, o sistema bloqueia a operação."
      exemplo="Tolerância 2% em 100g → aceita 98g a 102g"
    />
  ),
  estearatoMagnesio: (
    <TooltipAjuda
      titulo="Estearato de Magnésio"
      descricao="Lubrificante que vai SEMPRE por último na mistura e é misturado por no máximo 2 minutos. Se misturar mais, perde a fluidez na encapsuladora."
      exemplo="Misturar tudo → adicionar estearato → bater 1-2 min → parar"
    />
  ),
  amostrasRetencao: (
    <TooltipAjuda
      titulo="Amostra de Retenção"
      descricao="Quantidade mínima de cada lote guardada por toda a validade + 1 ano, para reanálise pela ANVISA em caso de denúncia."
      exemplo="Lote com val. 2027 → guardar amostra até 2028"
      obrigatorio
    />
  ),
  ncm: (
    <TooltipAjuda
      titulo="NCM"
      descricao="Nomenclatura Comum do Mercosul. Código fiscal de 8 dígitos que classifica o produto na NF-e. Define ICMS, IPI e tributação."
      exemplo="2106.90.30 (suplementos alimentares)"
      obrigatorio
    />
  ),
  qrCodeHash: (
    <TooltipAjuda
      titulo="QR Code de Rastreabilidade"
      descricao="Impresso na embalagem. Aponta para /audit/[lote] onde qualquer pessoa pode verificar a autenticidade e ver a assinatura do RT."
      exemplo="Cliente escaneia → vê histórico, COA, RT que liberou"
    />
  ),
};