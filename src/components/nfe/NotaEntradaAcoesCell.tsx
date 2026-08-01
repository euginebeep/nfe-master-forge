import { useState } from 'react';
import { Eye, Undo2, Tag, FileOutput, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { AnexarXmlButton } from '@/components/nfe/AnexarXmlButton';
import { DeleteNotaDialog } from '@/components/nfe/DeleteNotaDialog';
import type { NotaEntrada } from '@/hooks/use-notas-entrada';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type DestinacaoDevolucao = 'INDUSTRIALIZACAO' | 'COMERCIALIZACAO' | 'USO_CONSUMO' | 'ATIVO';

interface ItemDevolucao {
  id: string;
  codigo_fornecedor?: string | null;
  descricao?: string | null;
  qcom: number;
  ucom?: string | null;
  selecionado: boolean;
  quantidade: number;
}

const DESTINACOES: Array<{ value: DestinacaoDevolucao; label: string }> = [
  { value: 'INDUSTRIALIZACAO', label: 'Industrialização' },
  { value: 'COMERCIALIZACAO', label: 'Comercialização' },
  { value: 'USO_CONSUMO', label: 'Uso e consumo' },
  { value: 'ATIVO', label: 'Ativo' },
];

const ERROS_DEVOLUCAO: Record<string, string> = {
  nota_entrada_sem_xml: 'Sem XML, impossível espelhar impostos da origem',
  item_sem_nitem_da_origem: 'Reimportar o XML da nota antes de devolver',
  quantidade_maior_que_a_original: 'Não pode devolver mais do que foi recebido',
  fornecedor_sem_endereco_cadastrado: 'Completar cadastro do fornecedor',
  emitente_sem_municipio_ibge_ou_uf: 'Completar configurações da empresa',
};

function traduzirErroDevolucao(error: unknown) {
  const partes = [
    (error as { message?: string })?.message,
    (error as { code?: string })?.code,
    (error as { details?: string })?.details,
    (error as { hint?: string })?.hint,
  ].filter(Boolean);
  const texto = partes.join(' ');

  for (const [codigo, mensagem] of Object.entries(ERROS_DEVOLUCAO)) {
    if (texto.includes(codigo)) return mensagem;
  }

  return texto ? `Falha ao gerar devolução: ${texto}` : 'Falha ao gerar devolução: o servidor não retornou detalhes';
}

function normalizarQuantidade(valor: string | number, maximo: number) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return 0;
  return Math.min(Math.max(numero, 0), maximo);
}

function formatarQuantidade(valor: number) {
  return valor.toLocaleString('pt-BR', { maximumFractionDigits: 4 });
}

interface NotaEntradaAcoesCellProps {
  item: NotaEntrada;
  processandoId: string | null;
  revertendoId: string | null;
  imprimindoEtiquetas?: boolean;
  onView: (nota: NotaEntrada) => void;
  onProcessar: (nota: NotaEntrada) => void;
  onReverter: (nota: NotaEntrada) => void;
  onImprimirEtiquetas?: (nota: NotaEntrada) => void;
  onRefresh: () => void;
}

/** Célula de ações da tabela de notas de entrada. */
export function NotaEntradaAcoesCell({
  item,
  processandoId,
  revertendoId,
  imprimindoEtiquetas = false,
  onView,
  onProcessar,
  onReverter,
  onImprimirEtiquetas,
  onRefresh,
}: NotaEntradaAcoesCellProps) {
  const navigate = useNavigate();
  const [devolucaoOpen, setDevolucaoOpen] = useState(false);
  const [carregandoItens, setCarregandoItens] = useState(false);
  const [gerandoDevolucao, setGerandoDevolucao] = useState(false);
  const [itensDevolucao, setItensDevolucao] = useState<ItemDevolucao[]>([]);
  const [motivo, setMotivo] = useState('');
  const [destinacao, setDestinacao] = useState<DestinacaoDevolucao>('INDUSTRIALIZACAO');

  const carregarItensDevolucao = async () => {
    setCarregandoItens(true);
    try {
      const { data, error } = await supabase
        .from('notas_entrada_itens')
        .select('id, codigo_fornecedor, descricao, qcom, ucom')
        .eq('nota_entrada_id', item.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      setItensDevolucao((data || []).map((notaItem: any) => {
        const quantidadeOriginal = Number(notaItem.qcom ?? 0);
        return {
          id: notaItem.id,
          codigo_fornecedor: notaItem.codigo_fornecedor,
          descricao: notaItem.descricao,
          qcom: quantidadeOriginal,
          ucom: notaItem.ucom,
          selecionado: quantidadeOriginal > 0,
          quantidade: quantidadeOriginal,
        };
      }));
    } catch (error) {
      toast.error(traduzirErroDevolucao(error));
    } finally {
      setCarregandoItens(false);
    }
  };

  const abrirDevolucao = (open: boolean) => {
    setDevolucaoOpen(open);
    if (open) {
      setMotivo('');
      setDestinacao('INDUSTRIALIZACAO');
      void carregarItensDevolucao();
    }
  };

  const atualizarItemDevolucao = (itemId: string, patch: Partial<ItemDevolucao>) => {
    setItensDevolucao((atuais) =>
      atuais.map((notaItem) => (notaItem.id === itemId ? { ...notaItem, ...patch } : notaItem)),
    );
  };

  const gerarDevolucao = async () => {
    const motivoTrimmed = motivo.trim();
    if (!motivoTrimmed) {
      toast.error('Informe o motivo da devolução');
      return;
    }

    const selecionados = itensDevolucao.filter((notaItem) => notaItem.selecionado);
    if (selecionados.length === 0) {
      toast.error('Selecione ao menos um item para devolver');
      return;
    }

    const quantidadeInvalida = selecionados.find(
      (notaItem) => notaItem.quantidade <= 0 || notaItem.quantidade > notaItem.qcom,
    );
    if (quantidadeInvalida) {
      toast.error('Não pode devolver mais do que foi recebido');
      return;
    }

    const todosIntegrais = selecionados.length === itensDevolucao.length
      && selecionados.every((notaItem) => notaItem.quantidade === notaItem.qcom);
    const itensSelecionados = todosIntegrais
      ? null
      : selecionados.map((notaItem) => ({
          nota_entrada_item_id: notaItem.id,
          quantidade: notaItem.quantidade,
        }));

    setGerandoDevolucao(true);
    try {
      const { data: notaId, error } = await (supabase as any).rpc('gerar_devolucao_de_nota_entrada', {
        p_nota_entrada_id: item.id,
        p_motivo: motivoTrimmed,
        p_itens: itensSelecionados,
        p_destinacao: destinacao,
      });

      if (error) throw error;

      const retorno = Array.isArray(notaId) ? notaId[0] : notaId;
      const notaSaidaId = typeof retorno === 'string' ? retorno : retorno?.id ?? retorno?.nota_saida_id;

      toast.success('Devolução gerada como rascunho');
      setDevolucaoOpen(false);
      if (notaSaidaId) {
        navigate(`/vendas/notas-saida?nota=${encodeURIComponent(notaSaidaId)}`);
      } else {
        navigate('/vendas/notas-saida');
      }
    } catch (error) {
      toast.error(traduzirErroDevolucao(error));
    } finally {
      setGerandoDevolucao(false);
    }
  };

  return (
    <div className="flex gap-1">
      <Button
        variant="ghost"
        size="icon"
        onClick={(e) => { e.stopPropagation(); onView(item); }}
        title="Visualizar NF-e"
      >
        <Eye className="h-4 w-4" />
      </Button>
      {onImprimirEtiquetas && (
        <Button
          variant="ghost"
          size="icon"
          title="Imprimir etiquetas dos lotes desta NF"
          disabled={imprimindoEtiquetas}
          onClick={(e) => {
            e.stopPropagation();
            onImprimirEtiquetas(item);
          }}
        >
          <Tag className="h-4 w-4" />
        </Button>
      )}
      {item.status === 'IMPORTADA' && (
        <Button
          variant="default"
          size="sm"
          onClick={(e) => { e.stopPropagation(); onProcessar(item); }}
          disabled={processandoId === item.id || (item.qtd_itens_vinculados || 0) < (item.qtd_itens || 0)}
          title={item.qtd_itens_vinculados < (item.qtd_itens || 0) ? 'Vincule todos os itens primeiro' : 'Processar nota'}
          className="text-xs"
        >
          {processandoId === item.id ? 'Processando...' : 'Processar'}
        </Button>
      )}
      {item.status !== 'CANCELADA' && (
        <Dialog open={devolucaoOpen} onOpenChange={abrirDevolucao}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              title="Gerar nota de devolução"
              onClick={(e) => e.stopPropagation()}
            >
              <FileOutput className="h-4 w-4" />
              Gerar devolução
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <DialogHeader>
              <DialogTitle>Gerar devolução da NF-e {item.numero}/{item.serie}</DialogTitle>
              <DialogDescription>
                Selecione os itens e quantidades que devem compor o rascunho da nota fiscal de devolução.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor={`destinacao-devolucao-${item.id}`}>Destinação</Label>
                <Select value={destinacao} onValueChange={(value) => setDestinacao(value as DestinacaoDevolucao)}>
                  <SelectTrigger id={`destinacao-devolucao-${item.id}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DESTINACOES.map((opcao) => (
                      <SelectItem key={opcao.value} value={opcao.value}>
                        {opcao.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor={`motivo-devolucao-${item.id}`}>Motivo da devolução *</Label>
                <Textarea
                  id={`motivo-devolucao-${item.id}`}
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Descreva o motivo obrigatório da devolução"
                  disabled={gerandoDevolucao}
                />
              </div>

              <div className="space-y-2">
                <Label>Itens da nota</Label>
                <div className="rounded-md border">
                  {carregandoItens ? (
                    <div className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Carregando itens...
                    </div>
                  ) : itensDevolucao.length === 0 ? (
                    <div className="p-4 text-sm text-muted-foreground">
                      Nenhum item encontrado para esta nota.
                    </div>
                  ) : (
                    <div className="divide-y">
                      {itensDevolucao.map((notaItem) => (
                        <div key={notaItem.id} className="grid gap-3 p-3 sm:grid-cols-[auto_1fr_150px] sm:items-center">
                          <Checkbox
                            checked={notaItem.selecionado}
                            disabled={gerandoDevolucao || notaItem.qcom <= 0}
                            onCheckedChange={(checked) => atualizarItemDevolucao(notaItem.id, { selecionado: checked === true })}
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-medium">
                              {notaItem.descricao || 'Item sem descrição'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {notaItem.codigo_fornecedor ? `${notaItem.codigo_fornecedor} · ` : ''}
                              Recebido: {formatarQuantidade(notaItem.qcom)} {notaItem.ucom || ''}
                            </p>
                          </div>
                          <div className="grid gap-1">
                            <Label className="text-xs" htmlFor={`qtd-devolucao-${notaItem.id}`}>Quantidade</Label>
                            <Input
                              id={`qtd-devolucao-${notaItem.id}`}
                              type="number"
                              min={0}
                              max={notaItem.qcom}
                              step="any"
                              value={notaItem.quantidade}
                              disabled={gerandoDevolucao || !notaItem.selecionado}
                              onChange={(e) => atualizarItemDevolucao(notaItem.id, {
                                quantidade: normalizarQuantidade(e.target.value, notaItem.qcom),
                              })}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDevolucaoOpen(false)} disabled={gerandoDevolucao}>
                Cancelar
              </Button>
              <Button onClick={gerarDevolucao} disabled={gerandoDevolucao || carregandoItens || itensDevolucao.length === 0}>
                {gerandoDevolucao && <Loader2 className="h-4 w-4 animate-spin" />}
                {gerandoDevolucao ? 'Gerando...' : 'Confirmar devolução'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      <Button
        variant="ghost"
        size="icon"
        onClick={(e) => { e.stopPropagation(); onReverter(item); }}
        disabled={revertendoId === item.id}
        title="Reverter importação"
        className="text-destructive hover:text-destructive"
      >
        <Undo2 className="h-4 w-4" />
      </Button>
      {!item.xml_raw && (
        <div onClick={(e) => e.stopPropagation()}>
          <AnexarXmlButton notaId={item.id} chaveNfe={item.chave_nfe} onDone={onRefresh} />
        </div>
      )}
      <div onClick={(e) => e.stopPropagation()}>
        <DeleteNotaDialog
          notaId={item.id}
          notaNumero={item.numero}
          notaSerie={item.serie}
          fornecedorNome={item.fornecedor_nome_fantasia || item.fornecedor_razao || 'Desconhecido'}
          totalItens={item.qtd_itens || 0}
          onDeleted={onRefresh}
        />
      </div>
    </div>
  );
}
