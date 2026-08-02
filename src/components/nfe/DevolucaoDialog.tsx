import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type DestinacaoDevolucao = "INDUSTRIALIZACAO" | "COMERCIALIZACAO" | "USO_CONSUMO" | "ATIVO";

type ItemDevolucao = {
  id: string;
  codigo_fornecedor?: string | null;
  descricao?: string | null;
  sku?: string | null;
  qcom: number;
  ucom?: string | null;
  ja_devolvido: number;
  devolvivel: boolean;
  motivo_bloqueio?: string | null;
  lote_fornecedor?: string | null;
  saldo_estoque?: number | null;
  selecionado: boolean;
  quantidade: number;
};

const DESTINACOES: Array<{ value: DestinacaoDevolucao; label: string }> = [
  { value: "INDUSTRIALIZACAO", label: "Industrialização" },
  { value: "COMERCIALIZACAO", label: "Comercialização" },
  { value: "USO_CONSUMO", label: "Uso e consumo" },
  { value: "ATIVO", label: "Ativo" },
];

const ERROS_DEVOLUCAO: Record<string, string> = {
  nota_entrada_sem_xml: "Sem XML, impossível espelhar impostos da origem",
  item_sem_nitem_da_origem: "Reimportar o XML da nota antes de devolver",
  quantidade_maior_que_a_original: "Não pode devolver mais do que foi recebido",
  fornecedor_sem_endereco_cadastrado: "Completar cadastro do fornecedor",
  emitente_sem_municipio_ibge_ou_uf: "Completar configurações da empresa",
};

export function traduzirErroDevolucao(error: unknown) {
  const partes = [
    (error as { message?: string })?.message,
    (error as { code?: string })?.code,
    (error as { details?: string })?.details,
    (error as { hint?: string })?.hint,
  ].filter(Boolean);
  const texto = partes.join(" ");

  for (const [codigo, mensagem] of Object.entries(ERROS_DEVOLUCAO)) {
    if (texto.includes(codigo)) return mensagem;
  }

  return texto ? `Falha ao gerar devolução: ${texto}` : "Falha ao gerar devolução: o servidor não retornou detalhes";
}

function normalizarQuantidade(valor: string | number, maximo: number) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return 0;
  return Math.min(Math.max(numero, 0), maximo);
}

function formatarQuantidade(valor: number) {
  return valor.toLocaleString("pt-BR", { maximumFractionDigits: 4 });
}

function fmtDataBr(iso?: string | null) {
  if (!iso) return "";
  const d = String(iso).slice(0, 10);
  const [y, m, day] = d.split("-");
  if (!y || !m || !day) return d;
  return `${day}/${m}/${y}`;
}

export type DevolucaoDialogProps = {
  notaEntradaId: string;
  /** Quando presente: refaz — gera nova e só depois apaga o rascunho antigo */
  substituirNotaSaidaId?: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConcluido: (novaNotaId: string) => void;
  /** Rótulo opcional da NF de origem (ex.: "444378/1") se já conhecido */
  notaEntradaLabel?: string;
};

export function DevolucaoDialog({
  notaEntradaId,
  substituirNotaSaidaId,
  open,
  onOpenChange,
  onConcluido,
  notaEntradaLabel,
}: DevolucaoDialogProps) {
  const ehRefazer = !!substituirNotaSaidaId;
  const [carregandoItens, setCarregandoItens] = useState(false);
  const [gerandoDevolucao, setGerandoDevolucao] = useState(false);
  const [itensDevolucao, setItensDevolucao] = useState<ItemDevolucao[]>([]);
  const [motivo, setMotivo] = useState("");
  const [destinacao, setDestinacao] = useState<DestinacaoDevolucao>("INDUSTRIALIZACAO");
  const [metaOrigem, setMetaOrigem] = useState<{
    numero?: string | number | null;
    serie?: string | number | null;
    data_emissao?: string | null;
    fornecedor?: string | null;
  } | null>(null);

  const { data: itensAtuais } = useQuery({
    queryKey: ["itens-nota-saida-refazer", substituirNotaSaidaId],
    queryFn: async () => {
      if (!substituirNotaSaidaId) return [] as Array<{ nota_entrada_item_id: string | null; quantidade: number }>;
      const { data, error } = await supabase
        .from("notas_saida_itens")
        .select("nota_entrada_item_id, quantidade")
        .eq("nota_saida_id", substituirNotaSaidaId);
      if (error) throw error;
      return (data || []) as Array<{ nota_entrada_item_id: string | null; quantidade: number }>;
    },
    enabled: open && !!substituirNotaSaidaId,
  });

  const { data: notaSaidaAtual } = useQuery({
    queryKey: ["nota-saida-refazer-meta", substituirNotaSaidaId],
    queryFn: async () => {
      if (!substituirNotaSaidaId) return null;
      const { data, error } = await supabase
        .from("notas_saida")
        .select("motivo_devolucao")
        .eq("id", substituirNotaSaidaId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: open && !!substituirNotaSaidaId,
  });

  const qtdPorItemAtual = useMemo(() => {
    const map = new Map<string, number>();
    for (const it of itensAtuais || []) {
      if (!it.nota_entrada_item_id) continue;
      const id = String(it.nota_entrada_item_id);
      map.set(id, (map.get(id) || 0) + Number(it.quantidade || 0));
    }
    return map;
  }, [itensAtuais]);

  // Ao refazer, espera os itens do rascunho atual para pré-selecionar quantidades corretas
  const prontoParaCarregar = open && !!notaEntradaId && (!ehRefazer || itensAtuais !== undefined);

  useEffect(() => {
    if (!prontoParaCarregar) return;
    let cancelado = false;

    (async () => {
      setCarregandoItens(true);
      setDestinacao("INDUSTRIALIZACAO");
      try {
        const { data, error } = await supabase.rpc("itens_devolviveis", {
          p_nota_entrada_id: notaEntradaId,
        });
        if (error) throw error;
        if (cancelado) return;

        const payload = (data || {}) as any;
        const ne = payload.nota_entrada || {};
        const forn = payload.fornecedor || {};
        setMetaOrigem({
          numero: ne.numero ?? ne.nNF,
          serie: ne.serie ?? ne.serie_nfe,
          data_emissao: ne.data_emissao ?? ne.dhEmi,
          fornecedor: forn.razao_social || forn.nome_fantasia || forn.nome || null,
        });

        const itensRpc = Array.isArray(payload.itens) ? payload.itens : [];
        const mapped: ItemDevolucao[] = itensRpc.map((it: any) => {
          const id = String(it.nota_entrada_item_id || it.id);
          const original = Number(it.quantidade_original ?? it.qcom ?? 0);
          const jaDev = Number(it.ja_devolvido || 0);
          // Ao refazer, a qtd do rascunho atual ainda conta em ja_devolvido — devolver ao máximo disponível
          const qtdAtual = qtdPorItemAtual.get(id) || 0;
          const max = Math.max(0, original - jaDev + (ehRefazer ? qtdAtual : 0));
          const preQtd = ehRefazer && qtdAtual > 0
            ? Math.min(qtdAtual, max || qtdAtual)
            : max;
          const bloqueado = it.devolvivel === false && !(ehRefazer && qtdAtual > 0);
          return {
            id,
            codigo_fornecedor: it.sku || it.codigo_fornecedor || null,
            descricao: it.descricao || null,
            sku: it.sku || null,
            qcom: original,
            ucom: it.unidade || it.ucom || null,
            ja_devolvido: jaDev,
            devolvivel: !bloqueado && max > 0,
            motivo_bloqueio: it.motivo_bloqueio || null,
            lote_fornecedor: it.lote_fornecedor || null,
            saldo_estoque: it.saldo_estoque != null ? Number(it.saldo_estoque) : null,
            selecionado: ehRefazer ? qtdAtual > 0 && max > 0 : max > 0 && !bloqueado,
            quantidade: preQtd > 0 ? preQtd : max,
          };
        });
        setItensDevolucao(mapped);
      } catch (e) {
        if (!cancelado) {
          toast.error(traduzirErroDevolucao(e));
          setItensDevolucao([]);
          setMetaOrigem(null);
        }
      } finally {
        if (!cancelado) setCarregandoItens(false);
      }
    })();

    return () => { cancelado = true; };
    // qtdPorItemAtual derivado de itensAtuais — reexecuta quando o rascunho atual chega
  }, [prontoParaCarregar, notaEntradaId, ehRefazer, itensAtuais]);

  useEffect(() => {
    if (!open) return;
    if (notaSaidaAtual?.motivo_devolucao) {
      setMotivo(String(notaSaidaAtual.motivo_devolucao));
    } else if (!ehRefazer) {
      setMotivo("");
    }
  }, [open, notaSaidaAtual?.motivo_devolucao, ehRefazer]);

  const atualizarItem = (itemId: string, patch: Partial<ItemDevolucao>) => {
    setItensDevolucao((atuais) =>
      atuais.map((notaItem) => (notaItem.id === itemId ? { ...notaItem, ...patch } : notaItem)),
    );
  };

  const maxDoItem = (notaItem: ItemDevolucao) => {
    const qtdAtual = qtdPorItemAtual.get(notaItem.id) || 0;
    return Math.max(0, notaItem.qcom - notaItem.ja_devolvido + (ehRefazer ? qtdAtual : 0));
  };

  const labelOrigem = useMemo(() => {
    if (notaEntradaLabel) return notaEntradaLabel;
    if (!metaOrigem) return null;
    const num = metaOrigem.numero != null ? String(metaOrigem.numero) : "—";
    const serie = metaOrigem.serie != null ? String(metaOrigem.serie) : "—";
    const forn = metaOrigem.fornecedor || "—";
    const data = fmtDataBr(metaOrigem.data_emissao);
    return `NF-e ${num} / série ${serie} — ${forn}${data ? ` — ${data}` : ""}`;
  }, [notaEntradaLabel, metaOrigem]);

  const gerarDevolucao = async () => {
    const motivoTrimmed = motivo.trim();
    if (!motivoTrimmed) {
      toast.error("Informe o motivo da devolução");
      return;
    }

    const selecionados = itensDevolucao.filter((notaItem) => notaItem.selecionado);
    if (selecionados.length === 0) {
      toast.error("Selecione ao menos um item para devolver");
      return;
    }

    const quantidadeInvalida = selecionados.find((notaItem) => {
      const max = maxDoItem(notaItem);
      return notaItem.quantidade <= 0 || notaItem.quantidade > max;
    });
    if (quantidadeInvalida) {
      toast.error("Não pode devolver mais do que foi recebido");
      return;
    }

    const todosIntegrais = selecionados.length === itensDevolucao.filter((i) => maxDoItem(i) > 0).length
      && selecionados.every((notaItem) => notaItem.quantidade === notaItem.qcom);
    const itensSelecionados = todosIntegrais
      ? null
      : selecionados.map((notaItem) => ({
          nota_entrada_item_id: notaItem.id,
          quantidade: notaItem.quantidade,
        }));

    setGerandoDevolucao(true);
    try {
      // 1. Gerar primeiro — se falhar, o rascunho antigo permanece
      const { data: notaId, error } = await (supabase as any).rpc("gerar_devolucao_de_nota_entrada", {
        p_nota_entrada_id: notaEntradaId,
        p_motivo: motivoTrimmed,
        p_itens: itensSelecionados,
        p_destinacao: destinacao,
      });
      if (error) throw error;

      const retorno = Array.isArray(notaId) ? notaId[0] : notaId;
      const novaNotaSaidaId = typeof retorno === "string"
        ? retorno
        : retorno?.id ?? retorno?.nota_saida_id;
      if (!novaNotaSaidaId) throw new Error("RPC gerar_devolucao_de_nota_entrada não retornou o ID");

      // 2. Só depois remove a antiga
      if (substituirNotaSaidaId) {
        const { error: delItensErr } = await supabase
          .from("notas_saida_itens")
          .delete()
          .eq("nota_saida_id", substituirNotaSaidaId);
        if (delItensErr) throw delItensErr;
        const { error: delNotaErr } = await supabase
          .from("notas_saida")
          .delete()
          .eq("id", substituirNotaSaidaId);
        if (delNotaErr) throw delNotaErr;
      }

      onOpenChange(false);
      onConcluido(String(novaNotaSaidaId));
    } catch (error) {
      toast.error(traduzirErroDevolucao(error));
    } finally {
      setGerandoDevolucao(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {ehRefazer ? "Refazer devolução" : "Gerar devolução"}
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-1 text-sm text-muted-foreground">
              {ehRefazer ? (
                <>
                  <p>
                    A devolução atual será substituída. Os impostos são recalculados a partir
                    do XML da nota de entrada — por isso não é possível editar diretamente.
                  </p>
                  {labelOrigem && (
                    <p className="text-foreground/90">
                      Nota de origem: {labelOrigem}
                    </p>
                  )}
                </>
              ) : (
                <p>
                  Selecione os itens e quantidades que devem compor o rascunho da nota fiscal de devolução.
                  {labelOrigem ? ` Origem: ${labelOrigem}.` : ""}
                </p>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="destinacao-devolucao-dialog">Destinação</Label>
            <Select
              value={destinacao}
              onValueChange={(value) => setDestinacao(value as DestinacaoDevolucao)}
              disabled={gerandoDevolucao}
            >
              <SelectTrigger id="destinacao-devolucao-dialog">
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
            <Label htmlFor="motivo-devolucao-dialog">Motivo da devolução *</Label>
            <Textarea
              id="motivo-devolucao-dialog"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Descreva o motivo obrigatório da devolução"
              disabled={gerandoDevolucao}
            />
          </div>

          <div className="space-y-2">
            <Label>Itens da nota</Label>
            <div className="rounded-md border">
              {carregandoItens || (ehRefazer && itensAtuais === undefined) ? (
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
                  {itensDevolucao.map((notaItem) => {
                    const max = maxDoItem(notaItem);
                    const disabled = gerandoDevolucao || max <= 0 || !notaItem.devolvivel;
                    return (
                      <div
                        key={notaItem.id}
                        className={`grid gap-3 p-3 sm:grid-cols-[auto_1fr_150px] sm:items-center ${disabled && !notaItem.selecionado ? "opacity-50" : ""}`}
                      >
                        <Checkbox
                          checked={notaItem.selecionado}
                          disabled={disabled && !notaItem.selecionado}
                          onCheckedChange={(checked) =>
                            atualizarItem(notaItem.id, { selecionado: checked === true })
                          }
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium">
                            {notaItem.descricao || "Item sem descrição"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {notaItem.codigo_fornecedor ? `${notaItem.codigo_fornecedor} · ` : ""}
                            Recebido: {formatarQuantidade(notaItem.qcom)} {notaItem.ucom || ""}
                            {notaItem.ja_devolvido > 0 && !ehRefazer && (
                              <> · já devolvido: {formatarQuantidade(notaItem.ja_devolvido)}</>
                            )}
                            {notaItem.lote_fornecedor && (
                              <> · lote {notaItem.lote_fornecedor}</>
                            )}
                            {notaItem.saldo_estoque != null && (
                              <> · saldo {formatarQuantidade(Number(notaItem.saldo_estoque))}</>
                            )}
                          </p>
                          {!notaItem.devolvivel && notaItem.motivo_bloqueio && (
                            <p className="text-[10px] text-destructive">{notaItem.motivo_bloqueio}</p>
                          )}
                        </div>
                        <div className="grid gap-1">
                          <Label className="text-xs" htmlFor={`qtd-devolucao-${notaItem.id}`}>
                            Quantidade
                          </Label>
                          <Input
                            id={`qtd-devolucao-${notaItem.id}`}
                            type="number"
                            min={0}
                            max={max}
                            step="any"
                            value={notaItem.quantidade}
                            disabled={gerandoDevolucao || !notaItem.selecionado}
                            onChange={(e) =>
                              atualizarItem(notaItem.id, {
                                quantidade: normalizarQuantidade(e.target.value, max),
                              })
                            }
                          />
                          <p className="text-[10px] text-muted-foreground">
                            máx {formatarQuantidade(max)} {notaItem.ucom || ""}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={gerandoDevolucao}>
            Cancelar
          </Button>
          <Button
            onClick={gerarDevolucao}
            disabled={gerandoDevolucao || carregandoItens || itensDevolucao.length === 0}
          >
            {gerandoDevolucao && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {gerandoDevolucao
              ? (ehRefazer ? "Refazendo..." : "Gerando...")
              : (ehRefazer ? "Confirmar e substituir" : "Confirmar devolução")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
