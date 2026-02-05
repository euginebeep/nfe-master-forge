import { useMemo } from "react";
import { FileText, Printer } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { 
  FormulaIndustrial, 
  VD_REFERENCIA_INDUSTRIAL,
  CAPSULAS_CAPACIDADE,
} from "@/types/formulas-industrial";

interface TabelaNutricionalIndustrialProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formula: FormulaIndustrial | null;
}

interface LinhaNutricional {
  nutriente: string;
  quantidade: number;
  unidade: string;
  vd_percent?: number;
}

// Mapear nome do insumo para nutriente conhecido
function mapearNutriente(nome: string): string | null {
  const n = nome.toLowerCase();
  
  // Vitaminas
  if (n.includes('vitamina a') || n.includes('retinol') || n.includes('beta-caroteno') || n.includes('betacaroteno')) return 'Vitamina A';
  if (n.includes('vitamina d3') || n.includes('colecalciferol')) return 'Vitamina D3';
  if (n.includes('vitamina d') && !n.includes('d3')) return 'Vitamina D';
  if (n.includes('vitamina e') || n.includes('tocoferol')) return 'Vitamina E';
  if (n.includes('vitamina k2') || n.includes('menaquinona') || n.includes('mk-7') || n.includes('mk7')) return 'Vitamina K2';
  if (n.includes('vitamina k') || n.includes('fitomenadiona') || n.includes('filoquinona')) return 'Vitamina K';
  if (n.includes('vitamina c') || n.includes('ácido ascórbico') || n.includes('acido ascorbico') || n.includes('ascorbato')) return 'Vitamina C';
  if (n.includes('vitamina b1') || n.includes('tiamina')) return 'Vitamina B1';
  if (n.includes('vitamina b2') || n.includes('riboflavina')) return 'Vitamina B2';
  if (n.includes('vitamina b3') || n.includes('niacina') || n.includes('nicotinamida')) return 'Vitamina B3';
  if (n.includes('vitamina b5') || n.includes('ácido pantotênico') || n.includes('pantotenato')) return 'Vitamina B5';
  if (n.includes('vitamina b6') || n.includes('piridoxina')) return 'Vitamina B6';
  if (n.includes('vitamina b7') || n.includes('biotina')) return 'Vitamina B7';
  if (n.includes('vitamina b9') || n.includes('ácido fólico') || n.includes('folato') || n.includes('metilfolato')) return 'Vitamina B9';
  if (n.includes('vitamina b12') || n.includes('cobalamina') || n.includes('metilcobalamina') || n.includes('cianocobalamina')) return 'Vitamina B12';
  
  // Minerais
  if (n.includes('cálcio') || n.includes('calcio') || n.includes('carbonato de cálcio') || n.includes('citrato de cálcio')) return 'Cálcio';
  if (n.includes('ferro') || n.includes('sulfato ferroso') || n.includes('bisglicinato de ferro')) return 'Ferro';
  if (n.includes('magnésio') || n.includes('magnesio') || n.includes('óxido de magnésio') || n.includes('citrato de magnésio')) return 'Magnésio';
  if (n.includes('zinco') || n.includes('sulfato de zinco') || n.includes('bisglicinato de zinco')) return 'Zinco';
  if (n.includes('selênio') || n.includes('selenio') || n.includes('selenometionina')) return 'Selênio';
  if (n.includes('cobre') || n.includes('gluconato de cobre')) return 'Cobre';
  if (n.includes('manganês') || n.includes('manganes')) return 'Manganês';
  if (n.includes('cromo') || n.includes('picolinato de cromo')) return 'Cromo';
  if (n.includes('molibdênio') || n.includes('molibdenio')) return 'Molibdênio';
  if (n.includes('iodo')) return 'Iodo';
  if (n.includes('fósforo') || n.includes('fosforo')) return 'Fósforo';
  if (n.includes('potássio') || n.includes('potassio')) return 'Potássio';
  if (n.includes('colina')) return 'Colina';
  
  return null;
}

// Converter unidades para o VD
function converterParaUnidadeVD(
  quantidade: number, 
  unidadeOrigem: string, 
  unidadeVD: string
): number {
  const origem = unidadeOrigem.toLowerCase();
  const destino = unidadeVD.toLowerCase();
  
  if (origem === destino) return quantidade;
  
  // Conversões
  if (origem === 'g' && destino === 'mg') return quantidade * 1000;
  if (origem === 'mg' && destino === 'mcg') return quantidade * 1000;
  if (origem === 'g' && destino === 'mcg') return quantidade * 1_000_000;
  if (origem === 'mcg' && destino === 'mg') return quantidade / 1000;
  if (origem === 'mg' && destino === 'g') return quantidade / 1000;
  
  // UI para vitaminas (aproximações)
  if (origem === 'ui') {
    // Vitamina D: 1 UI = 0.025 mcg
    if (destino === 'mcg') return quantidade * 0.025;
    if (destino === 'mg') return quantidade * 0.000025;
  }
  
  return quantidade;
}

export function TabelaNutricionalIndustrial({
  open,
  onOpenChange,
  formula,
}: TabelaNutricionalIndustrialProps) {
  const linhasNutricionais = useMemo(() => {
    if (!formula) return [];
    
    const linhas: LinhaNutricional[] = [];
    
    // Multiplicar pela quantidade de cápsulas por dose para obter a dose diária
    const capsPorDose = formula.capsulas_por_dose;
    
    formula.ingredientes
      .filter(ing => ing.categoria === 'ATIVO')
      .forEach(ing => {
        const nutriente = mapearNutriente(ing.nome_rotulo) || mapearNutriente(ing.nome_interno);
        const vdRef = nutriente ? VD_REFERENCIA_INDUSTRIAL[nutriente] : null;
        
        // Dose por dose (não por cápsula)
        const dosePorDose = ing.dose_por_capsula * capsPorDose;
        
        let vd_percent: number | undefined;
        if (vdRef) {
          const valorConvertido = converterParaUnidadeVD(
            dosePorDose, 
            ing.unidade_dose, 
            vdRef.unidade
          );
          vd_percent = Math.round((valorConvertido / vdRef.valor) * 100);
        }
        
        linhas.push({
          nutriente: ing.nome_rotulo || ing.nome_interno,
          quantidade: dosePorDose,
          unidade: ing.unidade_dose,
          vd_percent,
        });
      });
    
    return linhas;
  }, [formula]);

  const handlePrint = () => {
    window.print();
  };

  if (!formula) return null;

  const capsInfo = CAPSULAS_CAPACIDADE[formula.tipo_capsula];
  const porcao = formula.capsulas_por_dose === 1 
    ? `1 cápsula (${formula.peso_total_capsula_mg.toFixed(0)}mg)`
    : `${formula.capsulas_por_dose} cápsulas (${(formula.peso_total_capsula_mg * formula.capsulas_por_dose).toFixed(0)}mg)`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg print:max-w-none print:m-0">
        <DialogHeader className="print:hidden">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-secondary" />
            Tabela Nutricional
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 print:p-8">
          {/* Cabeçalho */}
          <div className="text-center pb-2">
            <h3 className="font-bold text-lg">{formula.produto_nome || formula.nome}</h3>
            <p className="text-sm text-muted-foreground">
              Porção: {porcao}
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
                {linhasNutricionais.map((linha, idx) => (
                  <tr key={idx} className="border-t">
                    <td className="p-3">
                      <span className="font-medium">{linha.nutriente}</span>
                      <span className="text-muted-foreground ml-2">
                        {linha.quantidade.toFixed(linha.unidade === 'UI' ? 0 : 2)} {linha.unidade}
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
                {linhasNutricionais.length === 0 && (
                  <tr>
                    <td colSpan={2} className="p-4 text-center text-muted-foreground">
                      Nenhum nutriente mapeado para esta fórmula
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Rodapé */}
          <div className="text-xs text-muted-foreground space-y-1">
            <p>* Percentual de valores diários fornecidos por porção, com base em uma dieta de 2000kcal ou 8400kJ. Seus valores diários podem ser maiores ou menores dependendo de suas necessidades energéticas.</p>
            <p>** Valor diário não estabelecido.</p>
          </div>

          {/* Outros ingredientes */}
          <div className="bg-muted/50 rounded-lg p-3 text-sm">
            <p className="font-medium">Outros ingredientes:</p>
            <p className="text-muted-foreground">
              {formula.excipientes.map(e => e.nome).join(', ')}
              {formula.tipo_capsula.includes('Vegana') 
                ? ', cápsula de hidroxipropilmetilcelulose (HPMC)'
                : ', cápsula de gelatina'}
            </p>
          </div>

          {/* Advertências para higroscópicos */}
          {formula.ingredientes.some(i => i.higroscopico) && (
            <div className="bg-warning/10 border border-warning/20 rounded-lg p-3 text-sm text-warning">
              <p className="font-medium">⚠️ Atenção:</p>
              <p>Este produto contém ingredientes sensíveis à umidade. Manter em local seco e fresco.</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 print:hidden">
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
