import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { StatusBadge } from "@/components/ui/status-badge";
import { useResponsaveisTecnicosValidos } from "@/hooks/use-responsaveis-tecnicos";
import { 
  validarCompatibilidadeRT, 
  type TipoConselho,
  CONSELHOS 
} from "@/types/responsavel-tecnico";
import { AlertTriangle, UserCheck, ShieldAlert } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";

interface RTSelectorOPProps {
  tipoProduto: 'CAPSULA' | 'LIQUIDO' | 'PO' | 'CRITICO';
  value?: string;
  onChange: (rtId: string) => void;
  disabled?: boolean;
}

export function RTSelectorOP({ 
  tipoProduto, 
  value, 
  onChange, 
  disabled 
}: RTSelectorOPProps) {
  const { data: rtsValidos, isLoading } = useResponsaveisTecnicosValidos();
  
  // Filtrar RTs compatíveis com o tipo de produto
  const rtsCompativeis = (rtsValidos || []).filter(rt => 
    validarCompatibilidadeRT(rt.tipo_conselho, tipoProduto)
  );

  const rtSelecionado = rtsCompativeis.find(rt => rt.id === value);

  // Mensagem de compatibilidade
  const getMensagemCompatibilidade = () => {
    switch (tipoProduto) {
      case 'CAPSULA':
        return 'Produto encapsulado requer CRF ou CRQ';
      case 'CRITICO':
        return 'Fórmula crítica requer CRQ ou CRF';
      default:
        return 'CRN, CRQ ou CRF são aceitos';
    }
  };

  if (isLoading) {
    return <div className="h-10 bg-muted animate-pulse rounded-md" />;
  }

  if (rtsCompativeis.length === 0) {
    return (
      <Alert variant="destructive">
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Produção Bloqueada</AlertTitle>
        <AlertDescription>
          <p className="mb-2">
            Não há responsável técnico válido e compatível para este tipo de produto.
          </p>
          <p className="text-sm">
            {getMensagemCompatibilidade()}
          </p>
          <p className="text-xs mt-2 text-muted-foreground">
            Cadastre um RT com conselho válido em Cadastros → Responsáveis Técnicos
          </p>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <UserCheck className="w-4 h-4" />
        <span>{getMensagemCompatibilidade()}</span>
      </div>
      
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger>
          <SelectValue placeholder="Selecione o Responsável Técnico *" />
        </SelectTrigger>
        <SelectContent>
          {rtsCompativeis.map((rt) => {
            const diasRestantes = differenceInDays(
              new Date(rt.validade_registro), 
              new Date()
            );
            
            return (
              <SelectItem key={rt.id} value={rt.id}>
                <div className="flex items-center gap-3">
                  <div>
                    <span className="font-medium">{rt.nome_completo}</span>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <StatusBadge variant="info" className="text-[10px]">
                        {rt.tipo_conselho} {rt.numero_registro}/{rt.uf_conselho}
                      </StatusBadge>
                      {diasRestantes <= 30 && (
                        <span className="text-warning flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          {diasRestantes}d
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>

      {rtSelecionado && (
        <div className="bg-muted/50 rounded-lg p-3 text-sm">
          <div className="flex items-center gap-2 font-medium mb-1">
            <UserCheck className="w-4 h-4 text-success" />
            RT Selecionado
          </div>
          <p className="text-muted-foreground">
            {rtSelecionado.nome_completo} — {CONSELHOS[rtSelecionado.tipo_conselho].nome}{" "}
            {rtSelecionado.numero_registro}/{rtSelecionado.uf_conselho}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Válido até: {format(new Date(rtSelecionado.validade_registro), "dd/MM/yyyy", { locale: ptBR })}
          </p>
        </div>
      )}
    </div>
  );
}
