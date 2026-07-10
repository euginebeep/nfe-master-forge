import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  ArrowLeft,
  Loader2,
  Mail,
  MessageCircle,
  Save,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  buildTextoListaPuraRfq,
  ListaPuraCompraPanel,
} from '@/components/compras/ListaPuraCompraPanel';
import { useCompanyBranding } from '@/hooks/use-company-branding';
import { useFormPersist } from '@/hooks/use-form-persist';
import type { HybridEntidade } from '@/hooks/use-hybrid-data';
import { STATUS_REQ } from '@/hooks/use-requisicoes-compra';
import {
  montarRfqParaFornecedores,
  type BlocoRfqFornecedor,
  type ItemCestaCompra,
} from '@/lib/rfq-compra';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { ITENS_EM_RFQ_QUERY_KEY } from '@/hooks/use-itens-em-rfq';
import { toast } from 'sonner';

export interface RfqDraftPersist {
  itemIds: string[];
  fornecedorIds: string[];
}

interface RfqComposerProps {
  itensCesta: ItemCestaCompra[];
  fornecedores: HybridEntidade[];
  loadingFornecedores?: boolean;
  persistKey: string;
  onVoltar: () => void;
  onConfirmado?: () => void;
}

function labelFornecedor(nome: string | null | undefined, fantasia?: string | null) {
  return (fantasia || nome || 'Fornecedor').trim();
}

function contatoFornecedor(fornecedor: HybridEntidade | undefined) {
  const contatos = fornecedor?.entidade_contatos || [];
  const preferencial = contatos.find((c) => c?.preferencial) || contatos[0];
  if (!preferencial) return { telefone: null as string | null, email: null as string | null };

  const telefone =
    (preferencial.whatsapp as string | undefined) ||
    (preferencial.telefone as string | undefined) ||
    null;
  const email = (preferencial.email as string | undefined) || null;
  return { telefone, email };
}

function normalizarTelefoneWa(telefone: string | null): string | null {
  if (!telefone) return null;
  const digits = telefone.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('55')) return digits;
  if (digits.length >= 10) return `55${digits}`;
  return digits;
}

async function marcarRequisicoesDaCestaEmRfq(itemIds: string[]): Promise<number> {
  if (itemIds.length === 0) return 0;

  const { data: linhas, error: linhasErr } = await supabase
    .from('requisicoes_compra_itens')
    .select('requisicao_id')
    .in('item_id', itemIds);

  if (linhasErr) throw linhasErr;

  const requisicaoIds = [
    ...new Set((linhas || []).map((l) => l.requisicao_id).filter(Boolean)),
  ] as string[];

  if (requisicaoIds.length === 0) return 0;

  const { data: atualizadas, error } = await supabase
    .from('requisicoes_compra')
    .update({ status: STATUS_REQ.EM_RFQ, updated_at: new Date().toISOString() })
    .in('id', requisicaoIds)
    .eq('status', STATUS_REQ.ABERTA)
    .select('id');

  if (error) throw error;
  return (atualizadas || []).length;
}

function EnviarFornecedorMenu({
  fornecedor,
  texto,
}: {
  fornecedor: HybridEntidade | undefined;
  texto: string;
}) {
  const { telefone, email } = contatoFornecedor(fornecedor);
  const waNum = normalizarTelefoneWa(telefone);
  const assunto = encodeURIComponent('Pedido de cotação');
  const corpo = encodeURIComponent(texto);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="flex-1 min-w-[140px]">
          <MessageCircle className="h-4 w-4 mr-2" />
          Enviar ao fornecedor
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          disabled={!waNum}
          onClick={() => {
            if (!waNum) {
              toast.error('Fornecedor sem telefone/WhatsApp cadastrado');
              return;
            }
            window.open(`https://wa.me/${waNum}?text=${corpo}`, '_blank', 'noopener,noreferrer');
          }}
        >
          <MessageCircle className="h-4 w-4 mr-2" />
          WhatsApp
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!email}
          onClick={() => {
            if (!email) {
              toast.error('Fornecedor sem e-mail cadastrado');
              return;
            }
            window.location.href = `mailto:${encodeURIComponent(email)}?subject=${assunto}&body=${corpo}`;
          }}
        >
          <Mail className="h-4 w-4 mr-2" />
          E-mail
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function RfqComposer({
  itensCesta,
  fornecedores,
  loadingFornecedores = false,
  persistKey,
  onVoltar,
  onConfirmado,
}: RfqComposerProps) {
  const queryClient = useQueryClient();
  const { data: branding } = useCompanyBranding();
  const numeroInterno = useMemo(() => `RFQ-${format(new Date(), 'yyyy-MMdd-HHmm')}`, []);

  const [draft, setDraft, clearDraft] = useFormPersist<RfqDraftPersist>(persistKey, {
    itemIds: itensCesta.map((i) => i.item_id),
    fornecedorIds: [],
  });

  const [fornecedoresEscolhidos, setFornecedoresEscolhidos] = useState<Set<string>>(() => {
    const fromDraft = new Set(draft.fornecedorIds || []);
    if (fromDraft.size > 0) return fromDraft;
    const sugeridos = new Set<string>();
    for (const item of itensCesta) {
      if (item.ultimo_fornecedor_id) sugeridos.add(item.ultimo_fornecedor_id);
    }
    return sugeridos;
  });

  const [confirmando, setConfirmando] = useState(false);

  const blocosRfq: BlocoRfqFornecedor[] = useMemo(() => {
    const escolhidos = fornecedores
      .filter((f) => fornecedoresEscolhidos.has(f.id))
      .map((f) => ({
        id: f.id,
        nome: labelFornecedor(f.razao_social, f.nome_fantasia),
      }));
    return montarRfqParaFornecedores(itensCesta, escolhidos);
  }, [fornecedores, fornecedoresEscolhidos, itensCesta]);

  const toggleFornecedor = (id: string, checked: boolean) => {
    setFornecedoresEscolhidos((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const salvarRascunho = () => {
    setDraft({
      itemIds: itensCesta.map((i) => i.item_id),
      fornecedorIds: [...fornecedoresEscolhidos],
    });
    toast.success('Rascunho salvo — você pode sair e voltar depois');
  };

  const handleConfirmar = async () => {
    if (fornecedoresEscolhidos.size === 0) {
      toast.error('Selecione ao menos um fornecedor');
      return;
    }

    setConfirmando(true);
    try {
      const qtd = await marcarRequisicoesDaCestaEmRfq(itensCesta.map((i) => i.item_id));
      await queryClient.invalidateQueries({ queryKey: ['requisicoes-compra'] });
      await queryClient.invalidateQueries({ queryKey: ['compras-necessidades-consolidadas'] });
      await queryClient.invalidateQueries({ queryKey: [...ITENS_EM_RFQ_QUERY_KEY] });
      clearDraft({ itemIds: [], fornecedorIds: [] });
      toast.success(
        qtd > 0
          ? `Cotação confirmada — ${qtd} requisição(ões) em RFQ`
          : 'Cotação confirmada — listas prontas para envio',
      );
      onConfirmado?.();
    } catch (err: unknown) {
      const e = err as { message?: string; code?: string };
      toast.error(e?.message || e?.code || 'Erro ao confirmar cotação');
    } finally {
      setConfirmando(false);
    }
  };

  const razaoSocial = branding?.razao_social || 'Empresa';
  const endereco = branding?.endereco || '';

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onVoltar} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          <div>
            <h2 className="text-lg font-semibold">Pedido de cotação (RFQ)</h2>
            <p className="text-sm text-muted-foreground">
              {numeroInterno} · {itensCesta.length} item{itensCesta.length !== 1 ? 's' : ''} na cesta
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={salvarRascunho} className="gap-2">
            <Save className="h-4 w-4" />
            Salvar rascunho
          </Button>
          <Button
            size="sm"
            onClick={handleConfirmar}
            disabled={confirmando || fornecedoresEscolhidos.size === 0}
          >
            {confirmando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Confirmar cotação
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[260px_1fr] gap-4 min-h-[480px]">
        <Card>
          <CardContent className="p-4 space-y-3">
            <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
              Fornecedores destino
            </p>
            {loadingFornecedores ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando…
              </div>
            ) : fornecedores.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum fornecedor cadastrado.</p>
            ) : (
              <ScrollArea className="h-[min(420px,55vh)] pr-2">
                <div className="space-y-2">
                  {fornecedores.map((f) => (
                    <label
                      key={f.id}
                      className="flex items-start gap-2 text-sm cursor-pointer rounded-md p-2 hover:bg-muted/60"
                    >
                      <Checkbox
                        className="mt-0.5"
                        checked={fornecedoresEscolhidos.has(f.id)}
                        onCheckedChange={(v) => toggleFornecedor(f.id, v === true)}
                      />
                      <span className="leading-snug">
                        {labelFornecedor(f.razao_social, f.nome_fantasia)}
                      </span>
                    </label>
                  ))}
                </div>
              </ScrollArea>
            )}
            <p className="text-[10px] text-muted-foreground">
              Sugestão: último fornecedor de cada item pré-marcado quando disponível.
            </p>
          </CardContent>
        </Card>

        <ScrollArea className="h-[min(640px,70vh)] pr-2">
          {fornecedoresEscolhidos.size === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">
              Selecione os fornecedores para visualizar as listas puras.
            </p>
          ) : (
            <div className="space-y-8">
              {blocosRfq.map((bloco, idx) => {
                const fornecedor = fornecedores.find((f) => f.id === bloco.fornecedorId);
                const texto = buildTextoListaPuraRfq(
                  numeroInterno,
                  razaoSocial,
                  endereco,
                  bloco.grupos,
                  bloco.fornecedorNome,
                );

                return (
                  <div key={bloco.fornecedorId ?? `bloco-${idx}`}>
                    <ListaPuraCompraPanel
                      numeroInterno={numeroInterno}
                      grupos={bloco.grupos}
                      tituloDocumento="PEDIDO DE COTAÇÃO"
                      fornecedorNome={bloco.fornecedorNome}
                      hidePreview
                      extraActions={
                        <EnviarFornecedorMenu fornecedor={fornecedor} texto={texto} />
                      }
                    />
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
