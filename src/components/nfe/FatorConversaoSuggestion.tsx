import { useEffect, useState } from "react";
import { AlertCircle, Check, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useFatorConversaoHistorico } from "@/hooks/use-fator-conversao-historico";
import type { LocalItem } from "@/hooks/use-local-itens";

interface FatorConversaoSuggestionProps {
  fornecedorId: string;
  itemId: string;
  item: LocalItem;
  unidadeXml: string;
  onConfirm: (fator: number) => void;
  onAdjust: () => void;
}

/**
 * Componente para sugerir automaticamente o fator de conversão
 * baseado no histórico de importações anteriores
 */
export function FatorConversaoSuggestion({
  fornecedorId,
  itemId,
  item,
  unidadeXml,
  onConfirm,
  onAdjust,
}: FatorConversaoSuggestionProps) {
  const { obterSugestao, buscarDesviosRecentes } = useFatorConversaoHistorico();
  const [sugestao, setSugestao] = useState<{
    fator: number;
    unidadeOrigem: string;
    unidadeDestino: string;
    confianca: number;
  } | null>(null);
  const [desvioRecente, setDesvioRecente] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const carregar = async () => {
      setLoading(true);
      try {
        // Obter sugestão de fator
        const resultado = await obterSugestao(fornecedorId, itemId);

        if (resultado) {
          setSugestao({
            fator: resultado.fator_conversao,
            unidadeOrigem: resultado.unidade_origem,
            unidadeDestino: resultado.unidade_destino,
            confianca: (resultado as any).taxa_aceitacao || 100,
          });

          // Verificar se há desvios recentes (últimos 7 dias)
          await buscarDesviosRecentes(fornecedorId, 7);
          // Se encontrou desvios, marcar como recente
          // (isso seria feito via callback do hook)
        }
      } catch (err) {
        console.error("Erro ao carregar sugestão de fator:", err);
      } finally {
        setLoading(false);
      }
    };

    carregar();
  }, [fornecedorId, itemId, obterSugestao, buscarDesviosRecentes]);

  if (loading || !sugestao) {
    return null;
  }

  // Verificar se o fator sugerido é diferente do cadastrado
  const fatorDiferente = sugestao.fator !== item.fator_conversao;

  return (
    <Alert className={`border-2 ${fatorDiferente ? "border-amber-300 bg-amber-50" : "border-green-300 bg-green-50"}`}>
      <AlertCircle className={`h-4 w-4 ${fatorDiferente ? "text-amber-600" : "text-green-600"}`} />
      <AlertDescription className="ml-2">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className={`font-semibold ${fatorDiferente ? "text-amber-900" : "text-green-900"}`}>
                {fatorDiferente ? "⚠️ Fator diferente detectado" : "✓ Fator confirmado"}
              </p>
              <p className={`text-sm ${fatorDiferente ? "text-amber-800" : "text-green-800"}`}>
                Histórico sugere: <strong>{sugestao.fator}</strong> ({sugestao.unidadeOrigem} → {sugestao.unidadeDestino})
              </p>
            </div>
            <div className="flex gap-1">
              <Badge
                className={`${
                  sugestao.confianca >= 90
                    ? "bg-green-100 text-green-700"
                    : sugestao.confianca >= 70
                      ? "bg-yellow-100 text-yellow-700"
                      : "bg-orange-100 text-orange-700"
                }`}
              >
                {Math.round(sugestao.confianca)}% confiança
              </Badge>
              {desvioRecente && (
                <Badge className="bg-red-100 text-red-700 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Desvio recente
                </Badge>
              )}
            </div>
          </div>

          {fatorDiferente && (
            <div className="text-sm text-amber-800 bg-white/50 p-2 rounded">
              <p>Fator cadastrado: <strong>{item.fator_conversao}</strong></p>
              <p className="mt-1 text-xs">
                Isso pode indicar que o fornecedor mudou de embalagem. Confirme o novo fator ou ajuste manualmente.
              </p>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              size="sm"
              className={`flex-1 ${fatorDiferente ? "bg-amber-600 hover:bg-amber-700" : "bg-green-600 hover:bg-green-700"}`}
              onClick={() => onConfirm(sugestao.fator)}
            >
              <Check className="h-3 w-3 mr-1" />
              Confirmar Fator {sugestao.fator}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onAdjust}
            >
              Ajustar Manualmente
            </Button>
          </div>
        </div>
      </AlertDescription>
    </Alert>
  );
}
