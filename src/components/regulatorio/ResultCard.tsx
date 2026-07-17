import { useState } from 'react';
import { Shield, AlertTriangle, CheckCircle2, XCircle, ChevronDown, ChevronUp, Pill, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import type { AnvisaConstituinte } from '@/types/anvisa';
import { DoseTable } from './DoseTable';
import { PremixPoliticaPainel } from './PremixPoliticaPainel';
import { useAnvisaSync } from '@/hooks/use-anvisa-sync';

function limiteProxyDoConstituinte(c: AnvisaConstituinte): {
  limite_max_num: number | null;
  limite_unidade: string | null;
} {
  if (c.limite_max_num != null || c.limite_unidade) {
    return {
      limite_max_num: c.limite_max_num ?? null,
      limite_unidade: c.limite_unidade ?? null,
    };
  }
  const adult = c.limites_19_mais as { max?: number | string; unidade?: string } | null;
  const max = adult?.max;
  const num = typeof max === "number" ? max : typeof max === "string" && max !== "NE" && max !== "NA" ? Number(max) : null;
  return {
    limite_max_num: num != null && Number.isFinite(num) ? num : null,
    limite_unidade: adult?.unidade ?? null,
  };
}

export function ResultCard({
  constituinte,
}: {
  constituinte: AnvisaConstituinte & { _formaLabel?: string };
}) {
  const [expanded, setExpanded] = useState(false);
  const { sincronizarSubstancia, sincronizandoSubstancia } = useAnvisaSync();

  const handleVerificarANVISA = (e: React.MouseEvent) => {
    e.stopPropagation();
    sincronizarSubstancia(constituinte.nome_tecnico, {
      onSuccess: (data: Record<string, unknown>) => {
        toast.success('Verificação concluída via ANVISA', {
          description: (data?.analise as Record<string, string>)?.resumo_geral || 'Dados atualizados.',
        });
      },
      onError: (err: Error) => {
        toast.error('Erro ao verificar na ANVISA', { description: err.message });
      },
    });
  };

  return (
    <Card className={constituinte.is_proibido ? 'border-destructive border-2 bg-red-50/50 dark:bg-red-950/20 shadow-destructive/20 shadow-lg' : 'border-border'}>
      <CardHeader className="cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex flex-col gap-1">
              <CardTitle className="text-lg">
                {constituinte.nome_rotulo || constituinte.nome_tecnico}
              </CardTitle>
              {constituinte.nome_rotulo && (
                <span className="text-sm text-muted-foreground">Nome técnico: {constituinte.nome_tecnico}</span>
              )}
              {!constituinte.nome_rotulo && constituinte.nome_generico && (
                <span className="text-sm text-muted-foreground">{constituinte.nome_generico}</span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {constituinte._formaLabel && (
                <Badge variant="secondary" className="font-medium">
                  {constituinte._formaLabel}
                </Badge>
              )}
              <Badge variant="outline">{constituinte.categoria}</Badge>
              {constituinte.subcategoria && <Badge variant="secondary">{constituinte.subcategoria}</Badge>}
              {constituinte.is_proibido ? (
                <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />PROIBIDO</Badge>
              ) : (
                <Badge className="bg-green-600 text-white"><CheckCircle2 className="w-3 h-3 mr-1" />AUTORIZADO</Badge>
              )}
              <Badge variant="outline">{constituinte.norma_inclusao}</Badge>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-6 px-2"
                disabled={sincronizandoSubstancia}
                onClick={handleVerificarANVISA}
              >
                <RefreshCw className={`w-3 h-3 mr-1 ${sincronizandoSubstancia ? 'animate-spin' : ''}`} />
                Verificar ANVISA
              </Button>
            </div>
          </div>
      {expanded ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
        </div>

        {/* Always show doses summary and alegações */}
        <div className="mt-3 space-y-2" onClick={(e) => e.stopPropagation()}>
          {(() => {
            const lim = limiteProxyDoConstituinte(constituinte);
            return (
              <PremixPoliticaPainel
                constituinteId={constituinte.id}
                nome={constituinte.nome_tecnico}
                categoria={constituinte.categoria}
                limite_unidade={lim.limite_unidade}
                limite_max_num={lim.limite_max_num}
                editavel={false}
              />
            );
          })()}
          <DoseTable constituinte={constituinte} />
          {constituinte.alegacoes && constituinte.alegacoes.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-1">Alegações:</p>
              <ul className="space-y-0.5">
                {constituinte.alegacoes.map((a, i) => (
                  <li key={i} className="text-sm flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-600 mt-0.5 shrink-0" /> {a}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {constituinte.advertencias && constituinte.advertencias.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-950/30 rounded-md p-2 border border-amber-200 dark:border-amber-800">
              <p className="text-sm font-medium text-amber-700 dark:text-amber-400 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Advertências</p>
              <ul className="mt-1 space-y-0.5">
                {constituinte.advertencias.map((a, i) => (
                  <li key={i} className="text-xs text-amber-700 dark:text-amber-300">• {a}</li>
                ))}
              </ul>
            </div>
          )}
          {constituinte.grupos_nao_autorizados && constituinte.grupos_nao_autorizados.length > 0 && (
            <div>
              <p className="text-xs text-destructive font-medium">Não autorizado para: {constituinte.grupos_nao_autorizados.join(', ')}</p>
            </div>
          )}
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            {constituinte.cas_number && (
              <div><span className="text-muted-foreground">CAS:</span> <strong>{constituinte.cas_number}</strong></div>
            )}
            {constituinte.fonte_de && (
              <div><span className="text-muted-foreground">Fornece:</span> <strong>{constituinte.fonte_de}</strong></div>
            )}
            <div><span className="text-muted-foreground">Anexo:</span> <strong>{constituinte.anexo_origem}</strong></div>
          </div>

          {constituinte.nome_popular && constituinte.nome_popular.length > 0 && (
            <div>
              <p className="text-sm text-muted-foreground mb-1">Nomes populares:</p>
              <div className="flex flex-wrap gap-1">
                {constituinte.nome_popular.map((n, i) => <Badge key={i} variant="outline" className="text-xs">{n}</Badge>)}
              </div>
            </div>
          )}

          <Separator />

          <div>
            <h4 className="font-semibold mb-3 flex items-center gap-2"><Pill className="w-4 h-4" /> Doses Diárias Autorizadas</h4>
            <DoseTable constituinte={constituinte} />
          </div>

          {constituinte.alegacoes && constituinte.alegacoes.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-600" /> Alegações Permitidas</h4>
                <ul className="space-y-1">
                  {constituinte.alegacoes.map((a, i) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <span className="text-green-600 mt-0.5">•</span> {a}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}

          {constituinte.advertencias && constituinte.advertencias.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-500" /> Advertências Obrigatórias</h4>
                <ul className="space-y-1">
                  {constituinte.advertencias.map((a, i) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <span className="text-amber-500 mt-0.5">⚠</span> {a}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}

          {constituinte.grupos_nao_autorizados && constituinte.grupos_nao_autorizados.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2"><XCircle className="w-4 h-4 text-destructive" /> Grupos Não Autorizados</h4>
                <div className="flex flex-wrap gap-1">
                  {constituinte.grupos_nao_autorizados.map((g, i) => (
                    <Badge key={i} variant="destructive" className="text-xs">{g}</Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          {constituinte.referencias_especificacao && constituinte.referencias_especificacao.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="font-semibold mb-2 text-sm">Referências de Especificação (Art. 8º RDC 243/2018)</h4>
                <div className="flex flex-wrap gap-1">
                  {constituinte.referencias_especificacao.map((r, i) => (
                    <Badge key={i} variant="outline" className="text-xs">{r}</Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          <Separator />
          <Card className="bg-muted/50">
            <CardContent className="pt-4">
              <h4 className="font-bold mb-3 flex items-center gap-2"><Shield className="w-4 h-4" /> Dados para Fiscalização</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                <div><span className="text-muted-foreground">Base legal:</span><br /><strong>{constituinte.norma_inclusao}, {constituinte.anexo_origem}</strong></div>
                {constituinte.limites_19_mais && (
                  <>
                    <div><span className="text-muted-foreground">Dose máx. adulto:</span><br /><strong>{constituinte.limites_19_mais.max} {constituinte.limites_19_mais.unidade}/dia</strong></div>
                    <div><span className="text-muted-foreground">Dose mín. adulto:</span><br /><strong>{constituinte.limites_19_mais.min} {constituinte.limites_19_mais.unidade}/dia</strong></div>
                  </>
                )}
                <div><span className="text-muted-foreground">Advertências:</span><br /><strong>{constituinte.advertencias?.length || 0}</strong></div>
                <div><span className="text-muted-foreground">Alegações:</span><br /><strong>{constituinte.alegacoes?.length || 0}</strong></div>
                <div><span className="text-muted-foreground">Status:</span><br />
                  {constituinte.is_proibido
                    ? <span className="text-destructive font-bold">PROIBIDO</span>
                    : <span className="text-green-600 font-bold">AUTORIZADO</span>}
                </div>
              </div>
            </CardContent>
          </Card>
        </CardContent>
      )}
    </Card>
  );
}
