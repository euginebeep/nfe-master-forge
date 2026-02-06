// ============================================================
// EXCIPIENTES TECNOLÓGICOS - EDITOR
// Campos editáveis que ajustam automaticamente o diluente
// ============================================================

import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info, Lock, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EXCIPIENTES_TECNOLOGICOS, ExcipienteTecnologico } from "@/lib/formulador-industrial-rules";

export interface PercentuaisExcipientes {
  [nome: string]: number;
}

interface ExcipientesTecnologicosEditorProps {
  pesoAlvoMg: number;
  percentuais: PercentuaisExcipientes;
  onPercentuaisChange: (novos: PercentuaisExcipientes) => void;
  disabled?: boolean;
}

export function ExcipientesTecnologicosEditor({
  pesoAlvoMg,
  percentuais,
  onPercentuaisChange,
  disabled = false,
}: ExcipientesTecnologicosEditorProps) {
  const [editando, setEditando] = useState(false);

  // Handler para mudar um percentual específico
  const handlePercentualChange = (nome: string, valor: number, config: ExcipienteTecnologico) => {
    // Clampar valor entre min e max
    const novoValor = Math.max(config.percentual_min, Math.min(config.percentual_max, valor));
    onPercentuaisChange({
      ...percentuais,
      [nome]: novoValor,
    });
  };

  // Resetar para padrão
  const handleResetPadrao = () => {
    const padrao: PercentuaisExcipientes = {};
    EXCIPIENTES_TECNOLOGICOS.forEach(exc => {
      padrao[exc.nome] = exc.percentual_padrao;
    });
    onPercentuaisChange(padrao);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground font-medium flex items-center gap-2">
          Excipientes Tecnológicos
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-3 w-3" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs">
                <p className="text-xs">
                  Percentuais calculados sobre o peso alvo ({pesoAlvoMg} mg).
                  Ajuste os valores e o diluente principal será recalculado automaticamente.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        {!disabled && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-6 px-2 text-xs"
            onClick={() => setEditando(!editando)}
          >
            {editando ? <Lock className="h-3 w-3 mr-1" /> : <Unlock className="h-3 w-3 mr-1" />}
            {editando ? "Bloquear" : "Editar"}
          </Button>
        )}
      </div>

      {EXCIPIENTES_TECNOLOGICOS.filter(e => e.obrigatorio).map((exc) => {
        const percentual = percentuais[exc.nome] ?? exc.percentual_padrao;
        const quantidadeMg = (pesoAlvoMg * percentual) / 100;

        return (
          <div key={exc.nome} className="space-y-1">
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">{exc.nome}</span>
              <span className="font-mono text-muted-foreground">
                {quantidadeMg.toFixed(2)} mg
              </span>
            </div>
            
            {editando && !disabled ? (
              <div className="flex items-center gap-2">
                <Slider
                  value={[percentual]}
                  min={exc.percentual_min}
                  max={exc.percentual_max}
                  step={0.25}
                  onValueChange={([v]) => handlePercentualChange(exc.nome, v, exc)}
                  className="flex-1"
                />
                <Input
                  type="number"
                  value={percentual}
                  onChange={(e) => handlePercentualChange(exc.nome, parseFloat(e.target.value) || exc.percentual_padrao, exc)}
                  step={0.25}
                  min={exc.percentual_min}
                  max={exc.percentual_max}
                  className="w-16 h-6 text-xs font-mono text-center"
                />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 pl-2">
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary/50 rounded-full"
                    style={{ width: `${((percentual - exc.percentual_min) / (exc.percentual_max - exc.percentual_min)) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-mono text-muted-foreground w-10 text-right">
                  {percentual}%
                </span>
              </div>
            )}
          </div>
        );
      })}

      {editando && !disabled && (
        <Button 
          variant="ghost" 
          size="sm" 
          className="w-full h-6 text-xs text-muted-foreground"
          onClick={handleResetPadrao}
        >
          Restaurar Padrão Industrial
        </Button>
      )}
    </div>
  );
}
