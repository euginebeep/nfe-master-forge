import { 
  Package, Scale, Blend, Pill, FlaskConical, 
  Flame, Tag, Calendar, Hash, Box, 
  ClipboardCheck, FileText, Truck, Check
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type EtapaProducao = 
  | 'SEPARACAO_MP'
  | 'PESAGEM'
  | 'MISTURA'
  | 'ENCAPSULAMENTO'
  | 'ENVASE'
  | 'FECHAMENTO_INDUCAO'
  | 'ROTULACAO'
  | 'MARCACAO_VALIDADE'
  | 'CONTAGEM'
  | 'EMPACOTAMENTO'
  | 'CONFERENCIA'
  | 'EMISSAO_NF'
  | 'COLETA';

interface EtapaConfig {
  key: EtapaProducao;
  label: string;
  icon: React.ElementType;
}

const ETAPAS: EtapaConfig[] = [
  { key: 'SEPARACAO_MP', label: 'Separação MP', icon: Package },
  { key: 'PESAGEM', label: 'Pesagem', icon: Scale },
  { key: 'MISTURA', label: 'Mistura', icon: Blend },
  { key: 'ENCAPSULAMENTO', label: 'Encapsulamento', icon: Pill },
  { key: 'ENVASE', label: 'Envase', icon: FlaskConical },
  { key: 'FECHAMENTO_INDUCAO', label: 'Fechamento Indução', icon: Flame },
  { key: 'ROTULACAO', label: 'Rotulação', icon: Tag },
  { key: 'MARCACAO_VALIDADE', label: 'Data/Validade', icon: Calendar },
  { key: 'CONTAGEM', label: 'Contagem', icon: Hash },
  { key: 'EMPACOTAMENTO', label: 'Empacotamento', icon: Box },
  { key: 'CONFERENCIA', label: 'Conferência', icon: ClipboardCheck },
  { key: 'EMISSAO_NF', label: 'Emitir NF', icon: FileText },
  { key: 'COLETA', label: 'Coleta', icon: Truck },
];

interface EtapasProducaoTrackerProps {
  etapaAtual?: EtapaProducao | null;
  className?: string;
}

export function EtapasProducaoTracker({ etapaAtual, className }: EtapasProducaoTrackerProps) {
  const indiceAtual = etapaAtual ? ETAPAS.findIndex(e => e.key === etapaAtual) : -1;

  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {ETAPAS.map((etapa, index) => {
          const Icon = etapa.icon;
          const isConcluida = indiceAtual > index;
          const isAtual = indiceAtual === index;
          const isPendente = indiceAtual < index;
          
          return (
            <div key={etapa.key} className="flex items-center">
              {/* Etapa */}
              <div 
                className={cn(
                  "flex flex-col items-center min-w-[60px] px-1",
                  isAtual && "scale-110 z-10"
                )}
              >
                <div 
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center transition-all",
                    isConcluida && "bg-success text-success-foreground",
                    isAtual && "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 ring-offset-background animate-pulse",
                    isPendente && "bg-muted text-muted-foreground"
                  )}
                >
                  {isConcluida ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </div>
                <span 
                  className={cn(
                    "text-[10px] text-center mt-1 leading-tight max-w-[60px]",
                    isConcluida && "text-success font-medium",
                    isAtual && "text-primary font-bold",
                    isPendente && "text-muted-foreground"
                  )}
                >
                  {etapa.label}
                </span>
              </div>
              
              {/* Linha conectora */}
              {index < ETAPAS.length - 1 && (
                <div 
                  className={cn(
                    "w-4 h-0.5 transition-all",
                    isConcluida ? "bg-success" : "bg-muted"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { ETAPAS };
export type { EtapaConfig };
