// ============================================================
// LISTA DE PESAGEM INDUSTRIAL - MOTOR OP MASTER
// Formato profissional ANVISA com exibição detalhada por insumo
// ============================================================

import { useState } from 'react';
import { 
  Scale, AlertTriangle, Check, Siren, 
  Beaker, Droplets, Package, CircleDot,
  ChevronDown, ChevronRight, Pencil
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { OPMateriaPrima, OPPesagemCritica } from '@/types/op-industrial';

interface OPTabPesagemIndustrialProps {
  materiasPrimas: OPMateriaPrima[];
  pesagensCriticas: OPPesagemCritica[];
  statusOP: string;
  totalCapsulas: number;
  pesoCapsula: number;
  onRegistrarPesagem?: (id: string, pesoReal: number, lote: string) => Promise<boolean>;
  onRegistrarConferencia?: (id: string, conferente: string) => Promise<boolean>;
}

// Formatação de quantidades em múltiplas unidades
function formatarQuantidade(valorG: number): {
  g: string;
  mg: string;
  mcg: string;
  kg: string;
} {
  return {
    kg: (valorG / 1000).toFixed(6),
    g: valorG.toFixed(4),
    mg: (valorG * 1000).toFixed(4),
    mcg: (valorG * 1000000).toFixed(2),
  };
}

// Determinar unidade ideal de exibição
function unidadeIdeal(valorG: number): { valor: string; unidade: string; balanca: string } {
  if (valorG >= 1000) {
    return { 
      valor: (valorG / 1000).toFixed(4), 
      unidade: 'kg', 
      balanca: '2 casas decimais (precisão 0,01 kg)' 
    };
  } else if (valorG >= 1) {
    return { 
      valor: valorG.toFixed(4), 
      unidade: 'g', 
      balanca: '3 ou 4 casas decimais' 
    };
  } else if (valorG >= 0.001) {
    return { 
      valor: (valorG * 1000).toFixed(4), 
      unidade: 'mg', 
      balanca: '4 ou 5 casas decimais (analítica)' 
    };
  } else {
    return { 
      valor: (valorG * 1000000).toFixed(2), 
      unidade: 'mcg', 
      balanca: '5+ casas decimais (ultra-analítica)' 
    };
  }
}

// Determinar classificação de risco
function classificarRisco(item: OPMateriaPrima): {
  nivel: 'NORMAL' | 'ATENCAO' | 'CRITICO' | 'ULTRA_CRITICO';
  cor: string;
  bgCor: string;
} {
  if (item.motivo_critico?.includes('ULTRA') || (item.quantidade_teorica_g < 0.001)) {
    return { nivel: 'ULTRA_CRITICO', cor: 'text-destructive', bgCor: 'bg-destructive/10 border-destructive/30' };
  }
  if (item.pesagem_critica || item.quantidade_teorica_g < 0.01) {
    return { nivel: 'CRITICO', cor: 'text-warning', bgCor: 'bg-warning/10 border-warning/30' };
  }
  if (item.quantidade_teorica_g < 0.1) {
    return { nivel: 'ATENCAO', cor: 'text-muted-foreground', bgCor: 'bg-muted/50 border-muted' };
  }
  return { nivel: 'NORMAL', cor: 'text-foreground', bgCor: 'bg-background border-border' };
}

// Componente de Card de Insumo Industrial
function InsumoCard({
  item,
  numero,
  pesagemCritica,
  totalCapsulas,
  statusOP,
  onRegistrarPesagem,
  onRegistrarConferencia,
}: {
  item: OPMateriaPrima;
  numero: number;
  pesagemCritica?: OPPesagemCritica;
  totalCapsulas: number;
  statusOP: string;
  onRegistrarPesagem?: (id: string, pesoReal: number, lote: string) => Promise<boolean>;
  onRegistrarConferencia?: (id: string, conferente: string) => Promise<boolean>;
}) {
  const [expandido, setExpandido] = useState(item.pesagem_critica);
  const [dialogPesagem, setDialogPesagem] = useState(false);
  const [pesoReal, setPesoReal] = useState('');
  const [loteUsado, setLoteUsado] = useState(item.numero_lote || '');
  const [conferente1, setConferente1] = useState('');
  const [conferente2, setConferente2] = useState('');
  
  const risco = classificarRisco(item);
  const qtd = formatarQuantidade(item.quantidade_teorica_g);
  const ideal = unidadeIdeal(item.quantidade_teorica_g);
  const qtdPorCapsula = item.quantidade_teorica_mg || (totalCapsulas > 0 ? item.quantidade_teorica_g / totalCapsulas * 1000 : 0);
  
  const funcaoTecnologica = 
    item.categoria === 'EXCIPIENTE_TECNOLOGICO' 
      ? item.insumo_nome.includes('Silício') ? 'Antiumectante / Deslizante'
      : item.insumo_nome.includes('Talco') ? 'Deslizante / Carga'
      : item.insumo_nome.includes('Estearato') ? 'Lubrificante (SEMPRE ÚLTIMO)'
      : 'Excipiente Tecnológico'
    : item.categoria === 'EXCIPIENTE_BASE' ? 'Diluente / Veículo Q.S.P.'
    : 'Ativo';

  const isPesado = item.quantidade_real_g !== null && item.quantidade_real_g !== undefined;
  const podeEditar = statusOP === 'EM_PRODUCAO' || statusOP === 'PLANEJADA' || statusOP === 'AGUARDANDO_MATERIAIS';

  const handleSalvarPesagem = async () => {
    if (!onRegistrarPesagem) return;
    const peso = parseFloat(pesoReal.replace(',', '.'));
    if (isNaN(peso)) return;
    
    const success = await onRegistrarPesagem(item.id, peso, loteUsado);
    if (success) {
      setDialogPesagem(false);
    }
  };

  return (
    <>
      <Card className={cn('transition-all', risco.bgCor, expandido && 'ring-2 ring-primary/30')}>
        {/* Header do Card */}
        <div 
          className="p-4 cursor-pointer hover:bg-muted/30 transition-colors"
          onClick={() => setExpandido(!expandido)}
        >
          <div className="flex items-start justify-between gap-4">
            {/* Ordem e Nome */}
            <div className="flex items-start gap-4 flex-1">
              <div className={cn(
                'w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg shrink-0',
                isPesado ? 'bg-secondary text-secondary-foreground' : 'bg-foreground text-background'
              )}>
                {isPesado ? <Check className="h-6 w-6" /> : numero}
              </div>
              
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-lg">{item.insumo_nome}</h3>
                  {(risco.nivel === 'CRITICO' || risco.nivel === 'ULTRA_CRITICO') && (
                    <Badge variant="destructive" className="flex items-center gap-1">
                      <Siren className="h-3 w-3" />
                      {risco.nivel === 'ULTRA_CRITICO' ? 'ULTRA CRÍTICO' : 'CRÍTICO'}
                    </Badge>
                  )}
                </div>
                
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Badge variant="outline" className="text-xs">
                    {item.categoria === 'ATIVO' && 'ATIVO'}
                    {item.categoria === 'EXCIPIENTE_BASE' && 'EXCIPIENTE BASE'}
                    {item.categoria === 'EXCIPIENTE_TECNOLOGICO' && 'EXCIPIENTE TECNOLÓGICO'}
                  </Badge>
                  <span>•</span>
                  <span>{funcaoTecnologica}</span>
                </div>

                {item.motivo_critico && (
                  <p className="text-sm text-destructive flex items-center gap-1 mt-1">
                    <AlertTriangle className="h-3 w-3" />
                    {item.motivo_critico}
                  </p>
                )}
              </div>
            </div>
            
            {/* Quantidade Principal */}
            <div className="text-right shrink-0">
              <p className="text-2xl font-bold font-mono">{ideal.valor}</p>
              <p className="text-sm font-medium text-primary">{ideal.unidade}</p>
              {item.numero_lote && (
                <p className="text-xs text-muted-foreground mt-1">Lote: {item.numero_lote}</p>
              )}
              {item.data_validade && (
                <p className="text-xs text-muted-foreground">Validade: {new Date(item.data_validade).toLocaleDateString("pt-BR")}</p>
              )}
              {item.observacoes && item.observacoes.includes("QUARENTENA") && (
                <p className="text-xs text-amber-600 font-semibold mt-1">⚠️ Quarentena - Liberar RT</p>
              )}
            </div>
            
            {/* Expand Icon */}
            <div className="shrink-0 text-muted-foreground">
              {expandido ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
            </div>
          </div>
        </div>
        
        {/* Conteúdo Expandido */}
        {expandido && (
          <CardContent className="pt-0 space-y-4">
            <Separator />
            
            {/* Banner de Alerta para Críticos */}
            {(risco.nivel === 'CRITICO' || risco.nivel === 'ULTRA_CRITICO') && (
              <Alert variant="destructive" className="border-2">
                <Siren className="h-5 w-5" />
                <AlertTitle className="text-base">
                  ⚠️ ATIVO {risco.nivel === 'ULTRA_CRITICO' ? 'ULTRA ' : ''}CRÍTICO – PESAGEM COM DUPLA CONFERÊNCIA OBRIGATÓRIA
                </AlertTitle>
                <AlertDescription className="text-sm">
                  PROIBIDA PESAGEM DIRETA NO LOTE FINAL. Preparar PRÉ-MIX com distribuição geométrica.
                </AlertDescription>
              </Alert>
            )}

            {/* Grid de Informações */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Bloco: Dose por Cápsula */}
              <div className="p-3 bg-muted/30 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">DOSE POR CÁPSULA</p>
                <p className="font-mono font-bold text-lg">
                  {qtdPorCapsula < 1 
                    ? `${(qtdPorCapsula * 1000).toFixed(2)} mcg`
                    : `${qtdPorCapsula.toFixed(4)} mg`
                  }
                </p>
              </div>

              {/* Bloco: Quantidade Total */}
              <div className="p-3 bg-muted/30 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">QUANTIDADE TOTAL A PESAR</p>
                <div className="space-y-0.5">
                  <p className="font-mono font-bold text-lg">{ideal.valor} {ideal.unidade}</p>
                  <p className="text-xs text-muted-foreground">
                    = {qtd.g} g = {qtd.mg} mg
                  </p>
                </div>
              </div>

              {/* Bloco: Tolerância */}
              <div className="p-3 bg-muted/30 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">TOLERÂNCIA (±{item.tolerancia_percentual}%)</p>
                <p className="font-mono text-sm">
                  <span className="text-muted-foreground">Mín:</span> {(item.quantidade_minima_g ?? (item.quantidade_teorica_g != null ? item.quantidade_teorica_g * (1 - (item.tolerancia_percentual ?? 10) / 100) : null))?.toFixed(4) ?? '—'} g
                </p>
                <p className="font-mono text-sm">
                  <span className="text-muted-foreground">Máx:</span> {(item.quantidade_maxima_g ?? (item.quantidade_teorica_g != null ? item.quantidade_teorica_g * (1 + (item.tolerancia_percentual ?? 10) / 100) : null))?.toFixed(4) ?? '—'} g
                </p>
              </div>
            </div>

            {/* Bloco: Balança e Método */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 border rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">BALANÇA OBRIGATÓRIA</p>
                <p className="font-medium">{ideal.balanca}</p>
              </div>
              
              {(risco.nivel === 'CRITICO' || risco.nivel === 'ULTRA_CRITICO') && (
                <div className="p-3 border rounded-lg border-destructive/30">
                  <p className="text-xs text-muted-foreground mb-1">MÉTODO OBRIGATÓRIO</p>
                  <div className="space-y-1 text-sm">
                    <p className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-secondary" />
                      Preparar PRÉ-MIX
                    </p>
                    <p className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-secondary" />
                      Distribuição geométrica
                    </p>
                    <p className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-secondary" />
                      Conferência dupla obrigatória
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Bloco: Conferência Dupla */}
            {(risco.nivel === 'CRITICO' || risco.nivel === 'ULTRA_CRITICO') && (
              <div className="p-4 border-2 border-dashed border-destructive/50 rounded-lg bg-destructive/5">
                <p className="font-semibold mb-3 flex items-center gap-2">
                  <Scale className="h-4 w-4" />
                  CONFERÊNCIA DUPLA OBRIGATÓRIA
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs">CONFERENTE 1</Label>
                    <div className="h-8 border-b-2 border-foreground mt-1 flex items-end">
                      {pesagemCritica && pesagemCritica.operador_pesagem_nome && (
                        <span className="text-sm font-medium">{pesagemCritica.operador_pesagem_nome}</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">CONFERENTE 2</Label>
                    <div className="h-8 border-b-2 border-foreground mt-1 flex items-end">
                      {pesagemCritica && pesagemCritica.conferente_nome && (
                        <span className="text-sm font-medium">{pesagemCritica.conferente_nome}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Bloco: Peso Real e Lote */}
            <div className="flex items-center justify-between gap-4 p-3 bg-secondary/10 rounded-lg">
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-1">PESO REAL REGISTRADO</p>
                {isPesado ? (
                  <p className={cn(
                    'font-mono font-bold text-xl',
                    item.dentro_tolerancia ? 'text-secondary' : 'text-destructive'
                  )}>
                    {item.quantidade_real_g?.toFixed(4)} g
                    {item.dentro_tolerancia ? (
                      <Badge variant="secondary" className="ml-2">✓ DENTRO DA TOLERÂNCIA</Badge>
                    ) : (
                      <Badge variant="destructive" className="ml-2">✗ FORA DA TOLERÂNCIA</Badge>
                    )}
                  </p>
                ) : (
                  <p className="text-muted-foreground italic">Aguardando pesagem...</p>
                )}
              </div>
              
              {podeEditar && (
                <Button 
                  variant={isPesado ? "outline" : "default"}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDialogPesagem(true);
                  }}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  {isPesado ? 'Editar' : 'Registrar Pesagem'}
                </Button>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Dialog de Pesagem */}
      <Dialog open={dialogPesagem} onOpenChange={setDialogPesagem}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Pesagem - {item.insumo_nome}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="p-3 bg-muted rounded-lg text-sm">
              <p><strong>Quantidade Teórica:</strong> {ideal.valor} {ideal.unidade}</p>
              <p><strong>Tolerância:</strong> {(item.quantidade_minima_g ?? (item.quantidade_teorica_g != null ? item.quantidade_teorica_g * (1 - (item.tolerancia_percentual ?? 10) / 100) : null))?.toFixed(4) ?? '—'} g – {(item.quantidade_maxima_g ?? (item.quantidade_teorica_g != null ? item.quantidade_teorica_g * (1 + (item.tolerancia_percentual ?? 10) / 100) : null))?.toFixed(4) ?? '—'} g</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="pesoReal">Peso Real (g)</Label>
              <Input
                id="pesoReal"
                type="text"
                placeholder="0.0000"
                value={pesoReal}
                onChange={(e) => setPesoReal(e.target.value)}
                className="font-mono text-lg"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="loteUsado">Número do Lote Utilizado</Label>
              <Input
                id="loteUsado"
                placeholder="Ex: 2026010-001"
                value={loteUsado}
                onChange={(e) => setLoteUsado(e.target.value)}
              />
            </div>

            {(risco.nivel === 'CRITICO' || risco.nivel === 'ULTRA_CRITICO') && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label htmlFor="conferente1">Conferente 1 (Obrigatório)</Label>
                  <Input
                    id="conferente1"
                    placeholder="Nome do primeiro conferente"
                    value={conferente1}
                    onChange={(e) => setConferente1(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="conferente2">Conferente 2 (Obrigatório)</Label>
                  <Input
                    id="conferente2"
                    placeholder="Nome do segundo conferente"
                    value={conferente2}
                    onChange={(e) => setConferente2(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogPesagem(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSalvarPesagem}>
              Salvar Pesagem
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function OPTabPesagemIndustrial({
  materiasPrimas,
  pesagensCriticas,
  statusOP,
  totalCapsulas,
  pesoCapsula,
  onRegistrarPesagem,
  onRegistrarConferencia,
}: OPTabPesagemIndustrialProps) {
  // Ordenar por ordem de mistura
  const itensOrdenados = [...materiasPrimas].sort((a, b) => a.ordem_mistura - b.ordem_mistura);
  
  // Agrupar por categoria
  const ativos = itensOrdenados.filter(i => i.categoria === 'ATIVO');
  const excipienteBase = itensOrdenados.filter(i => i.categoria === 'EXCIPIENTE_BASE');
  const excipientesTec = itensOrdenados.filter(i => i.categoria === 'EXCIPIENTE_TECNOLOGICO');
  
  const temCriticos = materiasPrimas.some(i => i.pesagem_critica);
  const totalPesados = materiasPrimas.filter(i => i.quantidade_real_g !== null).length;
  const progresso = materiasPrimas.length > 0 ? (totalPesados / materiasPrimas.length) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Cabeçalho com Progresso */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Scale className="h-5 w-5" />
                Lista de Pesagem - Ordem de Mistura Industrial
              </CardTitle>
              <CardDescription className="mt-1">
                Ordem fixa ANVISA: Ativos → Excipiente Base → Dióxido de Silício → Talco → Estearato de Magnésio
              </CardDescription>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold">{totalPesados}/{materiasPrimas.length}</p>
              <p className="text-sm text-muted-foreground">itens pesados</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div 
              className={cn(
                'h-full transition-all duration-500',
                progresso === 100 ? 'bg-secondary' : 'bg-primary'
              )}
              style={{ width: `${progresso}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Alerta de Ativos Críticos */}
      {temCriticos && (
        <Alert variant="destructive" className="border-2">
          <Siren className="h-5 w-5" />
          <AlertTitle className="text-base">
            ⚠️ ATIVOS CRÍTICOS DETECTADOS – PESAGEM COM DUPLA CONFERÊNCIA OBRIGATÓRIA
          </AlertTitle>
          <AlertDescription>
            Esta OP contém {pesagensCriticas.length} ativo(s) com quantidade menor que 1mg ou em unidades UI/mcg.
            A pesagem desses itens exige registro de dois conferentes e é PROIBIDA a pesagem direta no lote final.
          </AlertDescription>
        </Alert>
      )}

      {/* Seção: ATIVOS */}
      {ativos.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Beaker className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-lg">1. ATIVOS ({ativos.length})</h2>
            <Badge variant="outline">Pesar primeiro</Badge>
          </div>
          <div className="space-y-3">
            {ativos.map((item, idx) => (
              <InsumoCard
                key={item.id}
                item={item}
                numero={item.ordem_mistura}
                pesagemCritica={pesagensCriticas.find(p => p.materia_prima_id === item.id)}
                totalCapsulas={totalCapsulas}
                statusOP={statusOP}
                onRegistrarPesagem={onRegistrarPesagem}
                onRegistrarConferencia={onRegistrarConferencia}
              />
            ))}
          </div>
        </div>
      )}

      {/* Seção: EXCIPIENTE BASE */}
      {excipienteBase.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-lg">2. EXCIPIENTE BASE - Q.S.P. ({excipienteBase.length})</h2>
            <Badge variant="outline">Diluente / Veículo</Badge>
          </div>
          <div className="space-y-3">
            {excipienteBase.map((item) => (
              <InsumoCard
                key={item.id}
                item={item}
                numero={item.ordem_mistura}
                totalCapsulas={totalCapsulas}
                statusOP={statusOP}
                onRegistrarPesagem={onRegistrarPesagem}
              />
            ))}
          </div>
        </div>
      )}

      {/* Seção: EXCIPIENTES TECNOLÓGICOS */}
      {excipientesTec.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Droplets className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-lg">3. EXCIPIENTES TECNOLÓGICOS ({excipientesTec.length})</h2>
            <Badge variant="outline" className="border-warning text-warning">Ordem fixa obrigatória</Badge>
          </div>
          <Alert className="border-warning/50 bg-warning/5">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <AlertDescription className="text-sm">
              <strong>Ordem de adição obrigatória:</strong> Dióxido de Silício → Talco → Estearato de Magnésio (SEMPRE por último).
              O Estearato deve ser misturado por no máximo 1 minuto para evitar problemas de fluidez.
            </AlertDescription>
          </Alert>
          <div className="space-y-3">
            {excipientesTec.map((item) => (
              <InsumoCard
                key={item.id}
                item={item}
                numero={item.ordem_mistura}
                totalCapsulas={totalCapsulas}
                statusOP={statusOP}
                onRegistrarPesagem={onRegistrarPesagem}
              />
            ))}
          </div>
        </div>
      )}

      {/* Legenda de Cores */}
      <Card className="bg-muted/30">
        <CardContent className="p-4">
          <p className="text-sm font-medium mb-2">Legenda de Classificação:</p>
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-background border" />
              <span>Normal</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-muted/50 border-muted border" />
              <span>Atenção (&lt; 100mg)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-warning/10 border-warning/30 border" />
              <span className="text-warning font-medium">Crítico (&lt; 10mg)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-destructive/10 border-destructive/30 border" />
              <span className="text-destructive font-medium">Ultra Crítico (&lt; 1mg)</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
