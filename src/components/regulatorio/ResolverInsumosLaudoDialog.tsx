import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FlaskConical,
  Link2,
  Loader2,
  Plus,
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
import type { AtivoLaudo } from '@/lib/laudo-insumos';
import {
  ativoEntraNaMassa,
  chaveAtivoLaudo,
} from '@/lib/laudo-insumos';
import type { HybridItem } from '@/hooks/use-hybrid-data';
import { cn } from '@/lib/utils';

interface ResolverInsumosLaudoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  produtoNome: string;
  ativos: AtivoLaudo[];
}

export function ResolverInsumosLaudoDialog({
  open,
  onOpenChange,
  produtoNome,
  ativos,
}: ResolverInsumosLaudoDialogProps) {
  const { criarDoLaudo, casarInsumo, buscarNomeInsumo } = useCriarFormulaDoLaudo();
  const [resolucoes, setResolucoes] = useState<Record<string, string>>({});
  const [nomesResolvidos, setNomesResolvidos] = useState<Record<string, string>>({});
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

  const ativosMassa = linhas.filter((l) => l.naMassa);
  const ativosForaMassa = linhas.filter((l) => !l.naMassa && l.ativo.nome?.trim());

  useEffect(() => {
    if (!open) return;

    const inicial: Record<string, string> = {};
    const nomesIniciais: Record<string, string> = {};
    linhas.forEach(({ ativo, key, naMassa }) => {
      if (!naMassa) return;
      const id = casarInsumo(ativo.nome);
      if (id) {
        inicial[key] = id;
        const nome = buscarNomeInsumo(id);
        if (nome) nomesIniciais[key] = nome;
      }
    });
    setResolucoes(inicial);
    setNomesResolvidos(nomesIniciais);
    setCadastroAtivo(null);
    setVincularKey(null);
    setCriando(false);
  }, [open, linhas, casarInsumo, buscarNomeInsumo]);

  const pendentesKeys = ativosMassa
    .filter(({ key }) => !resolucoes[key])
    .map(({ key }) => key);

  const todosResolvidos = ativosMassa.length > 0 && pendentesKeys.length === 0;

  const marcarResolvido = (key: string, item: HybridItem) => {
    setResolucoes((prev) => ({ ...prev, [key]: item.id }));
    setNomesResolvidos((prev) => ({ ...prev, [key]: item.descricao_interna }));
    setCadastroAtivo(null);
    setVincularKey(null);
  };

  const handleCriarFormula = async () => {
    if (!todosResolvidos) return;
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
              Produto: <strong>{produtoNome}</strong>. Todos os ativos que entram na massa
              precisam estar vinculados a um insumo do cadastro.
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
              {pendentesKeys.length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    {pendentesKeys.length} ativo(s) pendente(s) de vínculo com o cadastro.
                  </AlertDescription>
                </Alert>
              )}

              {ativosMassa.map(({ ativo, key }) => {
                const insumoId = resolucoes[key];
                const nomeInsumo =
                  nomesResolvidos[key] || (insumoId ? buscarNomeInsumo(insumoId) : null);
                const resolvido = Boolean(insumoId);

                return (
                  <div
                    key={key}
                    className={cn(
                      'rounded-lg border p-4 space-y-3',
                      resolvido ? 'border-green-500/40 bg-green-500/5' : 'border-amber-500/40 bg-amber-500/5',
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{ativo.nome}</p>
                        <p className="text-sm text-muted-foreground">
                          {ativo.dose} {ativo.unit}
                        </p>
                      </div>
                      <Badge variant={resolvido ? 'default' : 'secondary'}>
                        {resolvido ? (
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            OK
                          </span>
                        ) : (
                          'Pendente'
                        )}
                      </Badge>
                    </div>

                    {resolvido ? (
                      <p className="text-sm text-green-700">
                        Vinculado a: <strong>{nomeInsumo}</strong>
                      </p>
                    ) : (
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
                    {ativo.nome} — {ativo.dose} {ativo.unit}
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
              disabled={!todosResolvidos || criando || ativosMassa.length === 0}
              onClick={handleCriarFormula}
            >
              {criando ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Criando fórmula...
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
          onCreated={(item) => marcarResolvido(cadastroAtivo.key, item)}
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
                if (item) marcarResolvido(vincularKey, item);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
