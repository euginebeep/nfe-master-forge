// ============================================================
// MÓDULO PRÉ-MIX E DISTRIBUIÇÃO GEOMÉTRICA
// Para Ativos Ultra-Críticos - ANVISA BPF
// ============================================================

import { 
  Siren, Scale, Clock, Check, AlertTriangle,
  ChevronRight, Beaker, Layers
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { SIMBOLO_MICROGRAMA } from '@/lib/unidades-dose';
import { cn } from '@/lib/utils';
import { calcularDistribuicaoGeometrica } from '@/lib/distribuicao-geometrica';

interface AtivoCritico {
  id: string;
  nome: string;
  quantidade_mg: number;
  quantidade_g: number;
  potencia_coa?: number;
  potencia_unidade?: string;
  fator_correcao?: number;
  metodo_distribuicao?: string;
}

interface OPPreMixGeometricoProps {
  ativosCriticos: AtivoCritico[];
  diluenteNome: string;
  diluenteQuantidadeTotal: number;
}



export function OPPreMixGeometrico({ 
  ativosCriticos, 
  diluenteNome,
  diluenteQuantidadeTotal 
}: OPPreMixGeometricoProps) {
  if (ativosCriticos.length === 0) return null;

  return (
    <div className="space-y-6 print:break-before-page">
      {/* Alerta Principal */}
      <Alert variant="destructive" className="border-4 border-destructive">
        <Siren className="h-6 w-6" />
        <AlertTitle className="text-xl font-bold">
          ⚠️ ATIVOS ULTRA CRÍTICOS – PROCEDIMENTO OBRIGATÓRIO
        </AlertTitle>
        <AlertDescription className="text-base mt-2">
          <ul className="list-disc list-inside space-y-1">
            <li><strong>PROIBIDO</strong> pesar diretamente no lote final</li>
            <li><strong>OBRIGATÓRIO</strong> preparar PRÉ-MIX individual para cada ativo</li>
            <li><strong>OBRIGATÓRIO</strong> usar distribuição geométrica progressiva</li>
            <li><strong>OBRIGATÓRIO</strong> conferência dupla com assinatura</li>
            <li><strong>OBRIGATÓRIO</strong> balança analítica (4 ou 5 casas decimais)</li>
          </ul>
        </AlertDescription>
      </Alert>

      {/* Card para cada Ativo Crítico */}
      {ativosCriticos.map((ativo, index) => {
        const proporção = ativo.quantidade_g > 0 
          ? Math.round(diluenteQuantidadeTotal / ativo.quantidade_g)
          : 1000;
        const passosGeometricos = calcularDistribuicaoGeometrica(
          ativo.quantidade_mg, // Converter para mg (já vem em mg)
          Math.min(diluenteQuantidadeTotal * 0.1, 50) * 1000 // Converter para mg
        );
        const massaFinalPremix = (ativo.quantidade_mg + Math.min(diluenteQuantidadeTotal * 0.1, 50) * 1000) / 1000; // Voltar para g para exibição

        return (
          <Card key={ativo.id} className="border-2 border-destructive/50 bg-destructive/5">
            <CardHeader className="bg-destructive/10">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-destructive">
                    <Siren className="h-5 w-5" />
                    ATIVO {index + 1}: {ativo.nome}
                  </CardTitle>
                  <CardDescription className="text-foreground mt-1">
                    Classificação: ULTRA CRÍTICO | Método: {ativo.metodo_distribuicao || 'Distribuição Geométrica'}
                  </CardDescription>
                </div>
                <Badge variant="destructive" className="text-sm">
                  PREMIX OBRIGATÓRIO
                </Badge>
              </div>
            </CardHeader>
            
            <CardContent className="pt-4 space-y-6">
              {/* PASSO 1: Preparar Pré-Mix */}
              <div className="p-4 border-2 border-dashed border-destructive/50 rounded-lg">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center font-bold">
                    1
                  </div>
                  <h3 className="font-bold text-lg">PREPARAR PRÉ-MIX</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="p-3 bg-background rounded-lg border">
                    <Label className="text-xs text-muted-foreground">QUANTIDADE DO ATIVO</Label>
                    {ativo.quantidade_g >= 0.001 ? (
                      <>
                        <p className="font-mono font-bold text-xl">{ativo.quantidade_g.toFixed(4)} g</p>
                        <p className="text-xs text-muted-foreground">= {(ativo.quantidade_g * 1000).toFixed(4)} mg</p>
                      </>
                    ) : (
                      <>
                        <p className="font-mono font-bold text-xl">{(ativo.quantidade_g * 1000).toFixed(4)} mg</p>
                        <p className="text-xs text-muted-foreground">= {(ativo.quantidade_g * 1000000).toFixed(2)} {SIMBOLO_MICROGRAMA}</p>
                      </>
                    )}
                  </div>
                  
                  <div className="p-3 bg-background rounded-lg border">
                    <Label className="text-xs text-muted-foreground">DILUENTE PARA PRÉ-MIX</Label>
                    <p className="font-mono font-bold text-xl">
                      {Math.min(diluenteQuantidadeTotal * 0.1, 50).toFixed(2)} g
                    </p>
                    <p className="text-xs text-muted-foreground">{diluenteNome}</p>
                  </div>
                  
                  <div className="p-3 bg-background rounded-lg border">
                    <Label className="text-xs text-muted-foreground">PROPORÇÃO / MASSA FINAL</Label>
                    <p className="font-mono font-bold text-xl">1:{proporção > 1000 ? '1.000+' : proporção}</p>
                    <p className="text-xs text-muted-foreground">Total: {massaFinalPremix.toFixed(2)} g</p>
                  </div>
                </div>

                {ativo.potencia_coa && (
                  <div className="p-3 bg-muted/50 rounded-lg mb-4">
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <Label className="text-xs text-muted-foreground">POTÊNCIA (COA)</Label>
                        <p className="font-medium">{ativo.potencia_coa.toLocaleString()} {ativo.potencia_unidade || 'UI/g'}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">FATOR DE CORREÇÃO</Label>
                        <p className="font-medium">{ativo.fator_correcao?.toFixed(4) || '1.0000'}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">FONTE</Label>
                        <p className="font-medium">COA / Laudo Técnico</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* PASSO 2: Distribuição Geométrica */}
              <div className="p-4 border-2 border-dashed border-primary/50 rounded-lg">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                    2
                  </div>
                  <h3 className="font-bold text-lg">DISTRIBUIÇÃO GEOMÉTRICA</h3>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2">
                        <th className="text-left p-2 w-16">Passo</th>
                        <th className="text-left p-2">Descrição</th>
                        <th className="text-right p-2">Massa Adicionada</th>
                        <th className="text-right p-2">Massa Total</th>
                        <th className="text-right p-2">Tempo Mistura</th>
                        <th className="text-center p-2 w-16">✓</th>
                      </tr>
                    </thead>
                    <tbody>
                      {passosGeometricos.map((p) => (
                        <tr key={p.passo} className="border-b hover:bg-muted/50">
                          <td className="p-2">
                            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center font-bold">
                              {p.passo}
                            </div>
                          </td>
                          <td className="p-2 font-medium">{p.descricao}</td>
                          <td className="p-2 text-right font-mono">{p.massa_adicionada}</td>
                          <td className="p-2 text-right font-mono font-bold">{p.massa_total}</td>
                          <td className="p-2 text-right">{p.tempo_mistura}</td>
                          <td className="p-2 text-center">
                            <Checkbox />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 p-3 bg-warning/10 border border-warning/30 rounded-lg">
                  <p className="text-sm flex items-center gap-2">
                    <Clock className="h-4 w-4 text-warning" />
                    <strong>Tempo mínimo total de mistura:</strong> {passosGeometricos.length * 2 + 3} minutos
                  </p>
                </div>
              </div>

              {/* PASSO 3: Incorporação */}
              <div className="p-4 border-2 border-dashed border-secondary/50 rounded-lg">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center font-bold">
                    3
                  </div>
                  <h3 className="font-bold text-lg">INCORPORAÇÃO NO LOTE FINAL</h3>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Checkbox id={`inc-${ativo.id}-1`} />
                    <Label htmlFor={`inc-${ativo.id}-1`} className="cursor-pointer">
                      Verificar homogeneidade visual do pré-mix
                    </Label>
                  </div>
                  <div className="flex items-center gap-3">
                    <Checkbox id={`inc-${ativo.id}-2`} />
                    <Label htmlFor={`inc-${ativo.id}-2`} className="cursor-pointer">
                      Adicionar pré-mix ao lote conforme ordem de mistura
                    </Label>
                  </div>
                  <div className="flex items-center gap-3">
                    <Checkbox id={`inc-${ativo.id}-3`} />
                    <Label htmlFor={`inc-${ativo.id}-3`} className="cursor-pointer">
                      Homogeneizar por no mínimo 5 minutos após incorporação
                    </Label>
                  </div>
                </div>
              </div>

              {/* Conferência Dupla */}
              <div className="p-4 bg-destructive/10 border-2 border-destructive/30 rounded-lg">
                <div className="flex items-center gap-2 mb-4">
                  <Scale className="h-5 w-5 text-destructive" />
                  <h3 className="font-bold">CONFERÊNCIA DUPLA OBRIGATÓRIA</h3>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <Label className="text-xs text-muted-foreground">CONFERENTE 1</Label>
                    <div className="h-10 border-b-2 border-foreground mt-2" />
                    <p className="text-xs text-muted-foreground mt-1">Nome e Assinatura</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">CONFERENTE 2</Label>
                    <div className="h-10 border-b-2 border-foreground mt-2" />
                    <p className="text-xs text-muted-foreground mt-1">Nome e Assinatura</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-6 mt-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">DATA/HORA</Label>
                    <div className="h-8 border-b border-muted-foreground mt-2" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">BALANÇA UTILIZADA (Nº PATRIMÔNIO)</Label>
                    <div className="h-8 border-b border-muted-foreground mt-2" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
