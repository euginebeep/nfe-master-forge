import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FlaskConical,
  Link2,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { CadastroRapidoInsumo } from '@/components/formulador/CadastroRapidoInsumo';
import { ItemSelector } from '@/components/formulador/ItemSelector';
import { useCriarFormulaDoLaudo } from '@/hooks/use-criar-formula-do-laudo';
import { getUserCompanyId } from '@/hooks/use-user-company';
import type { AtivoLaudo } from '@/lib/laudo-insumos';
import {
  ativoEntraNaMassa,
  chaveAtivoLaudo,
  resolverMatchLaudo,
} from '@/lib/laudo-insumos';
import { formatarUnidadeInformada } from '@/lib/unidades-dose';
import type { HybridItem } from '@/hooks/use-hybrid-data';
import { cn } from '@/lib/utils';

interface ResolverInsumosLaudoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  produtoNome: string;
  ativos: AtivoLaudo[];
}

type StatusLinha = 'carregando' | 'pendente' | 'sugerido' | 'confirmado';

interface LinhaMatchState {
  carregando: boolean;
  sugestao?: { id: string; nome: string; tipo: 'similar' | 'ia' };
}

function formatarDoseLaudo(ativo: AtivoLaudo): string {
  return `${ativo.dose} ${formatarUnidadeInformada(ativo.unit || 'mg')}`;
}

export function ResolverInsumosLaudoDialog({
  open,
  onOpenChange,
  produtoNome,
  ativos,
}: ResolverInsumosLaudoDialogProps) {
  const { criarDoLaudo, buscarNomeInsumo, insumos } = useCriarFormulaDoLaudo();
  const [resolucoes, setResolucoes] = useState<Record<string, string>>({});
  const [nomesResolvidos, setNomesResolvidos] = useState<Record<string, string>>({});
  const [linhaStates, setLinhaStates] = useState<Record<string, LinhaMatchState>>({});
  const [cadastroAtivo, setCadastroAtivo] = useState<{ key: string; nome: string } | null>(null);
  const [vincularKey, setVincularKey] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);

  const linhas = useMemo(
    () =>
      ativos.map((ativo, index) => ({
        ativo,
        index,
        key: chaveAtivoLaudo(ativo, index),
        naMassa: ativoEntraNaMassa(ativo),
      })),
    [ativos],
  );

  const ativosMassa = useMemo(() => linhas.filter((l) => l.naMassa), [linhas]);
  const ativosForaMassa = useMemo(
    () => linhas.filter((l) => !l.naMassa && l.ativo.nome?.trim()),
    [linhas],
  );

  useEffect(() => {
    if (!open) return;

    let cancelado = false;

    const resolverTodos = async () => {
      setResolucoes({});
      setNomesResolvidos({});
      setCadastroAtivo(null);
      setVincularKey(null);
      setCriando(false);

      const loadingInicial: Record<string, LinhaMatchState> = {};
      ativosMassa.forEach(({ key }) => {
        loadingInicial[key] = { carregando: true };
      });
      setLinhaStates(loadingInicial);

      const companyId = await getUserCompanyId();
      const novasResolucoes: Record<string, string> = {};
      const novosNomes: Record<string, string> = {};
      const novosEstados: Record<string, LinhaMatchState> = {};

      await Promise.all(
        ativosMassa.map(async ({ ativo, key }) => {
          const resultado = await resolverMatchLaudo(ativo.nome, insumos, companyId);
          if (cancelado) return;

          if (resultado.tipo === 'exato' && resultado.insumoId) {
            novasResolucoes[key] = resultado.insumoId;
            novosNomes[key] =
              resultado.sugestaoNome ||
              insumos.find((i) => i.id === resultado.insumoId)?.descricao_interna ||
              ativo.nome;
            novosEstados[key] = { carregando: false };
          } else if (
            (resultado.tipo === 'similar' || resultado.tipo === 'ia') &&
            resultado.insumoId
          ) {
            novosEstados[key] = {
              carregando: false,
              sugestao: {
                id: resultado.insumoId,
                nome: resultado.sugestaoNome || ativo.nome,
                tipo: resultado.tipo,
              },
            };
          } else {
            novosEstados[key] = { carregando: false };
          }
        }),
      );

      if (!cancelado) {
        setResolucoes(novasResolucoes);
        setNomesResolvidos(novosNomes);
        setLinhaStates(novosEstados);
      }
    };

    resolverTodos();
    return () => {
      cancelado = true;
    };
  }, [open, ativosMassa, insumos]);

  const getStatus = (key: string): StatusLinha => {
    if (linhaStates[key]?.carregando) return 'carregando';
    if (resolucoes[key]) return 'confirmado';
    if (linhaStates[key]?.sugestao) return 'sugerido';
    return 'pendente';
  };

  const pendentesOuSugeridos = ativosMassa.filter(({ key }) => getStatus(key) !== 'confirmado');
  const todosConfirmados = ativosMassa.length > 0 && pendentesOuSugeridos.length === 0;
  const algumCarregando = ativosMassa.some(({ key }) => getStatus(key) === 'carregando');

  const confirmarSugestao = (key: string) => {
    const sug = linhaStates[key]?.sugestao;
    if (!sug) return;
    setResolucoes((prev) => ({ ...prev, [key]: sug.id }));
    setNomesResolvidos((prev) => ({ ...prev, [key]: sug.nome }));
    setLinhaStates((prev) => ({ ...prev, [key]: { carregando: false } }));
  };

  const trocarVinculo = (key: string) => {
    setResolucoes((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setNomesResolvidos((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setLinhaStates((prev) => ({ ...prev, [key]: { carregando: false } }));
    setVincularKey(key);
  };

  const marcarConfirmado = (key: string, item: HybridItem) => {
    setResolucoes((prev) => ({ ...prev, [key]: item.id }));
    setNomesResolvidos((prev) => ({ ...prev, [key]: item.descricao_interna }));
    setLinhaStates((prev) => ({ ...prev, [key]: { carregando: false } }));
    setCadastroAtivo(null);
    setVincularKey(null);
  };

  const handleCriarFormula = async () => {
    if (!todosConfirmados) return;
    setCriando(true);
    try {
      await criarDoLaudo(produtoNome, ativos, resolucoes);
      onOpenChange(false);
    } finally {
      setCriando(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-primary" />
              Resolver insumos antes de criar a fórmula
            </DialogTitle>
            <DialogDescription>
              Produto: <strong>{produtoNome}</strong>. Confirme cada vínculo sugerido antes de
              criar a fórmula — sugestões automáticas não são aplicadas sem sua aprovação.
            </DialogDescription>
          </DialogHeader>

          {ativosMassa.length === 0 ? (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Nenhum ativo na massa foi identificado neste laudo. Não é possível criar a fórmula.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-3">
              {pendentesOuSugeridos.length > 0 && !algumCarregando && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    {pendentesOuSugeridos.length} ativo(s) aguardando confirmação ou vínculo manual.
                  </AlertDescription>
                </Alert>
              )}

              {ativosMassa.map(({ ativo, key }) => {
                const status = getStatus(key);
                const sugestao = linhaStates[key]?.sugestao;
                const nomeInsumo =
                  nomesResolvidos[key] ||
                  (resolucoes[key] ? buscarNomeInsumo(resolucoes[key]) : null);

                return (
                  <div
                    key={key}
                    className={cn(
                      'rounded-lg border p-4 space-y-3',
                      status === 'confirmado' && 'border-green-500/40 bg-green-500/5',
                      status === 'sugerido' && 'border-blue-500/40 bg-blue-500/5',
                      status === 'pendente' && 'border-amber-500/40 bg-amber-500/5',
                      status === 'carregando' && 'border-muted bg-muted/30',
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{ativo.nome}</p>
                        <p className="text-sm text-muted-foreground">{formatarDoseLaudo(ativo)}</p>
                      </div>
                      <Badge
                        variant={
                          status === 'confirmado'
                            ? 'default'
                            : status === 'sugerido'
                              ? 'outline'
                              : 'secondary'
                        }
                      >
                        {status === 'carregando' && (
                          <span className="flex items-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Buscando...
                          </span>
                        )}
                        {status === 'confirmado' && (
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Confirmado
                          </span>
                        )}
                        {status === 'sugerido' && (
                          <span className="flex items-center gap-1">
                            <Sparkles className="h-3 w-3" />
                            Sugerido
                          </span>
                        )}
                        {status === 'pendente' && 'Pendente'}
                      </Badge>
                    </div>

                    {status === 'confirmado' && (
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm text-green-700">
                          ✓ Vinculado a: <strong>{nomeInsumo}</strong>
                        </p>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-xs h-7"
                          onClick={() => trocarVinculo(key)}
                        >
                          trocar
                        </Button>
                      </div>
                    )}

                    {status === 'sugerido' && sugestao && (
                      <div className="space-y-2">
                        <p className="text-sm">
                          Sugerido: <strong>{sugestao.nome}</strong>
                          <span className="text-muted-foreground">
                            {' '}
                            · {ativo.nome} · {formatarDoseLaudo(ativo)}
                          </span>
                          {sugestao.tipo === 'ia' && (
                            <Badge variant="secondary" className="ml-2 text-[10px]">
                              IA
                            </Badge>
                          )}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => confirmarSugestao(key)}
                          >
                            Confirmar
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => trocarVinculo(key)}
                          >
                            Trocar
                          </Button>
                        </div>
                      </div>
                    )}

                    {status === 'pendente' && (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          onClick={() => setCadastroAtivo({ key, nome: ativo.nome })}
                        >
                          <Plus className="h-4 w-4" />
                          Cadastrar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          onClick={() => setVincularKey(key)}
                        >
                          <Link2 className="h-4 w-4" />
                          Vincular
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {ativosForaMassa.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">
                  Fora da massa (não exigem insumo — viram observação técnica)
                </p>
                {ativosForaMassa.map(({ ativo, key }) => (
                  <div key={key} className="text-sm text-muted-foreground rounded border px-3 py-2">
                    {ativo.nome} — {formatarDoseLaudo(ativo)}
                  </div>
                ))}
              </div>
            </>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={!todosConfirmados || criando || algumCarregando || ativosMassa.length === 0}
              onClick={handleCriarFormula}
            >
              {criando ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Criando fórmula...
                </>
              ) : algumCarregando ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Analisando insumos...
                </>
              ) : (
                'Criar fórmula'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {cadastroAtivo && (
        <CadastroRapidoInsumo
          open
          onOpenChange={(isOpen) => {
            if (!isOpen) setCadastroAtivo(null);
          }}
          nomeInicial={cadastroAtivo.nome}
          onCreated={(item) => marcarConfirmado(cadastroAtivo.key, item)}
        />
      )}

      <Dialog open={vincularKey !== null} onOpenChange={(isOpen) => !isOpen && setVincularKey(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Vincular a insumo existente</DialogTitle>
            <DialogDescription>
              Busque no cadastro o insumo correspondente ao ativo do laudo.
            </DialogDescription>
          </DialogHeader>
          {vincularKey && (
            <ItemSelector
              value={resolucoes[vincularKey]}
              placeholder="Buscar insumo no cadastro..."
              onSelect={(item) => {
                if (item) marcarConfirmado(vincularKey, item);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
