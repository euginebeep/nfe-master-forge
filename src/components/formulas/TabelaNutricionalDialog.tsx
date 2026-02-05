import { useMemo } from "react";
import { FileText, Download, Printer } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Formula, VD_REFERENCIA, TabelaNutricionalLinha } from "@/types/formulas";

interface TabelaNutricionalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formula: Formula | null;
}

// Mapear ingredientes para nutrientes conhecidos
function mapIngredienteParaNutriente(descricao: string): string | null {
  const desc = descricao.toLowerCase();
  
  if (desc.includes('vitamina a') || desc.includes('retinol') || desc.includes('beta-caroteno')) return 'Vitamina A';
  if (desc.includes('vitamina d') || desc.includes('colecalciferol')) return 'Vitamina D';
  if (desc.includes('vitamina e') || desc.includes('tocoferol')) return 'Vitamina E';
  if (desc.includes('vitamina k') || desc.includes('fitomenadiona') || desc.includes('menaquinona')) return 'Vitamina K';
  if (desc.includes('vitamina c') || desc.includes('ácido ascórbico') || desc.includes('acido ascorbico')) return 'Vitamina C';
  if (desc.includes('vitamina b1') || desc.includes('tiamina')) return 'Vitamina B1';
  if (desc.includes('vitamina b2') || desc.includes('riboflavina')) return 'Vitamina B2';
  if (desc.includes('vitamina b3') || desc.includes('niacina') || desc.includes('nicotinamida')) return 'Vitamina B3';
  if (desc.includes('vitamina b5') || desc.includes('ácido pantotênico') || desc.includes('pantotenato')) return 'Vitamina B5';
  if (desc.includes('vitamina b6') || desc.includes('piridoxina')) return 'Vitamina B6';
  if (desc.includes('vitamina b7') || desc.includes('biotina')) return 'Vitamina B7';
  if (desc.includes('vitamina b9') || desc.includes('ácido fólico') || desc.includes('folato')) return 'Vitamina B9';
  if (desc.includes('vitamina b12') || desc.includes('cobalamina') || desc.includes('metilcobalamina')) return 'Vitamina B12';
  if (desc.includes('cálcio') || desc.includes('calcio')) return 'Cálcio';
  if (desc.includes('ferro')) return 'Ferro';
  if (desc.includes('magnésio') || desc.includes('magnesio')) return 'Magnésio';
  if (desc.includes('zinco')) return 'Zinco';
  if (desc.includes('selênio') || desc.includes('selenio')) return 'Selênio';
  if (desc.includes('cobre')) return 'Cobre';
  if (desc.includes('manganês') || desc.includes('manganes')) return 'Manganês';
  if (desc.includes('cromo')) return 'Cromo';
  if (desc.includes('molibdênio') || desc.includes('molibdenio')) return 'Molibdênio';
  if (desc.includes('iodo')) return 'Iodo';
  if (desc.includes('fósforo') || desc.includes('fosforo')) return 'Fósforo';
  if (desc.includes('potássio') || desc.includes('potassio')) return 'Potássio';
  if (desc.includes('colina')) return 'Colina';
  
  return null;
}

// Converter unidades para o VD
function converterParaUnidadeVD(
  quantidade: number, 
  unidadeOrigem: string, 
  unidadeVD: string
): number {
  // Converter para a unidade base (mg ou mcg)
  let valorBase = quantidade;
  
  if (unidadeOrigem === 'g') {
    valorBase = quantidade * 1000; // g -> mg
  } else if (unidadeOrigem === 'mcg' && unidadeVD === 'mg') {
    valorBase = quantidade / 1000; // mcg -> mg
  } else if (unidadeOrigem === 'mg' && unidadeVD === 'mcg') {
    valorBase = quantidade * 1000; // mg -> mcg
  } else if (unidadeOrigem === 'UI') {
    // Conversões aproximadas de UI
    // Estas são estimativas - o cálculo real depende do ativo específico
    valorBase = quantidade * 0.025; // Padrão para vitamina D
  }
  
  return valorBase;
}

export function TabelaNutricionalDialog({
  open,
  onOpenChange,
  formula,
}: TabelaNutricionalDialogProps) {
  const linhasTabela = useMemo(() => {
    if (!formula) return [];
    
    const linhas: TabelaNutricionalLinha[] = [];
    
    formula.ingredientes.forEach(ing => {
      const nutriente = mapIngredienteParaNutriente(ing.nome_rotulo || ing.item_descricao);
      const vdRef = nutriente ? VD_REFERENCIA[nutriente] : null;
      
      // Determinar unidade de exibição
      let unidade = ing.unidade_rotulo;
      let quantidade = ing.quantidade_rotulo;
      
      // Calcular %VD se disponível
      let vd_percent: number | undefined;
      if (vdRef) {
        const valorConvertido = converterParaUnidadeVD(quantidade, unidade, vdRef.unidade);
        vd_percent = Math.round((valorConvertido / vdRef.valor) * 100);
      }
      
      linhas.push({
        nutriente: ing.nome_rotulo || ing.item_descricao,
        quantidade: quantidade.toString(),
        unidade,
        vd_percent,
      });
    });
    
    return linhas;
  }, [formula]);

  const handlePrint = () => {
    window.print();
  };

  if (!formula) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-secondary" />
            Tabela Nutricional
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Cabeçalho */}
          <div className="text-center pb-2">
            <h3 className="font-semibold text-lg">{formula.nome_comercial || formula.nome}</h3>
            <p className="text-sm text-muted-foreground">
              Porção: 1 {formula.tipo_capsula === 'Sachê' ? 'sachê' : 'cápsula'} ({formula.capacidade_mg}mg)
            </p>
          </div>

          <Separator />

          {/* Tabela */}
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted">
                  <th className="text-left p-3 font-semibold">Quantidade por porção</th>
                  <th className="text-right p-3 font-semibold w-20">%VD*</th>
                </tr>
              </thead>
              <tbody>
                {linhasTabela.map((linha, idx) => (
                  <tr key={idx} className="border-t">
                    <td className="p-3">
                      <span className="font-medium">{linha.nutriente}</span>
                      <span className="text-muted-foreground ml-2">
                        {linha.quantidade} {linha.unidade}
                      </span>
                    </td>
                    <td className="text-right p-3">
                      {linha.vd_percent !== undefined ? (
                        <Badge 
                          variant={linha.vd_percent >= 100 ? "default" : "outline"}
                          className="font-mono"
                        >
                          {linha.vd_percent}%
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">**</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Rodapé */}
          <div className="text-xs text-muted-foreground space-y-1">
            <p>* Percentual de valores diários fornecidos por porção, com base em uma dieta de 2000kcal ou 8400kJ. Seus valores diários podem ser maiores ou menores dependendo de suas necessidades energéticas.</p>
            <p>** Valor diário não estabelecido.</p>
          </div>

          {/* Q.S.P. Info */}
          <div className="bg-muted/50 rounded-lg p-3 text-sm">
            <p className="font-medium">Outros ingredientes:</p>
            <p className="text-muted-foreground">
              {formula.excipiente_padrao || 'Maltodextrina'} (q.s.p. {formula.qsp_mg.toFixed(0)}mg)
              {formula.tipo_capsula !== 'Sachê' && formula.tipo_capsula !== 'Comprimido' && (
                <>, cápsula de {formula.tipo_capsula === 'Vegana' ? 'hidroxipropilmetilcelulose (HPMC)' : 'gelatina'}</>
              )}
            </p>
          </div>

          {/* Advertências */}
          {formula.ingredientes.some(i => i.higroscopico) && (
            <div className="bg-warning/10 border border-warning/20 rounded-lg p-3 text-sm text-warning">
              <p className="font-medium">⚠️ Atenção:</p>
              <p>Este produto contém ingredientes higroscópicos. Manter em local seco e fresco.</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Imprimir
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
