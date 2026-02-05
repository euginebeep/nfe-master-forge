import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Printer,
  FileDown,
  X,
  Building2,
  Truck,
  Package,
  Receipt,
  Calculator,
  FileText,
  Calendar,
  Hash,
  ClipboardList,
  Info,
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/formatters';
import type { NotaFiscalCompleta } from '@/types/nfe-completa';
import { LocalDb } from '@/lib/local-db';
import type { LocalEntidade } from '@/hooks/use-local-entidades';

const STORAGE_PREFIX = 'legacy_erp_';

function getNFeCollection<T>(collection: string): T[] {
  try {
    const data = localStorage.getItem(`${STORAGE_PREFIX}${collection}`);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

interface NFeVisualizacaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chaveNfe: string;
}

export function NFeVisualizacaoDialog({
  open,
  onOpenChange,
  chaveNfe,
}: NFeVisualizacaoDialogProps) {
  const [isPrinting, setIsPrinting] = useState(false);

  // Buscar nota fiscal
  const notas = getNFeCollection<NotaFiscalCompleta>('notas_fiscais');
  const nota = notas.find((n) => n.chave_acesso === chaveNfe);

  // Buscar itens da nota
  const todosItens = getNFeCollection<any>('notas_fiscais_itens');
  const itensNota = nota ? todosItens.filter((i) => i.nota_id === nota.id) : [];

  // Buscar impostos dos itens
  const todosImpostos = getNFeCollection<any>('notas_fiscais_itens_impostos');

  // Buscar totais
  const todosTotais = getNFeCollection<any>('notas_fiscais_totais');
  const totais = nota ? todosTotais.find((t) => t.nota_id === nota.id) : null;

  // Buscar transporte
  const todosTransportes = getNFeCollection<any>('notas_fiscais_transporte');
  const transporte = nota ? todosTransportes.find((t) => t.nota_id === nota.id) : null;

  // Buscar volumes
  const todosVolumes = getNFeCollection<any>('notas_fiscais_volumes');
  const volumes = nota ? todosVolumes.filter((v) => v.nota_id === nota.id) : [];

  // Buscar duplicatas
  const todasDuplicatas = getNFeCollection<any>('notas_fiscais_duplicatas');
  const duplicatas = nota ? todasDuplicatas.filter((d) => d.nota_id === nota.id) : [];

  // Buscar pagamentos
  const todosPagamentos = getNFeCollection<any>('notas_fiscais_pagamentos');

  // Buscar logs de importação/auditoria
  const todosLogs = getNFeCollection<any>('importacao_logs');
  const logsNota = nota ? todosLogs.filter((l) => l.nota_id === nota.id) : [];

  // Buscar observações da nota
  const todasObservacoes = getNFeCollection<any>('notas_fiscais_observacoes');
  const observacoes = nota ? todasObservacoes.filter((o) => o.nota_id === nota.id) : [];
  const pagamentos = nota ? todosPagamentos.filter((p) => p.nota_id === nota.id) : [];

  // Buscar entidades
  const entidades = LocalDb.getCollection<LocalEntidade>('entidades');
  const emitente = nota ? entidades.find((e) => e.id === nota.emitente_id) : null;
  const destinatario = nota ? entidades.find((e) => e.id === nota.destinatario_id) : null;

  const handlePrint = () => {
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 100);
  };

  const handleExportPDF = () => {
    // Usar a API de impressão do navegador para gerar PDF
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 100);
  };

  const formatFormaPagamento = (codigo: string) => {
    const formas: Record<string, string> = {
      '01': 'Dinheiro',
      '02': 'Cheque',
      '03': 'Cartão de Crédito',
      '04': 'Cartão de Débito',
      '05': 'Crédito Loja',
      '10': 'Vale Alimentação',
      '11': 'Vale Refeição',
      '12': 'Vale Presente',
      '13': 'Vale Combustível',
      '14': 'Duplicata Mercantil',
      '15': 'Boleto Bancário',
      '16': 'Depósito Bancário',
      '17': 'PIX',
      '18': 'Transferência',
      '19': 'Programa de Fidelidade',
      '90': 'Sem Pagamento',
      '99': 'Outros',
    };
    return formas[codigo] || `Código ${codigo}`;
  };

  const formatModalidadeFrete = (mod: string) => {
    const modalidades: Record<string, string> = {
      'CIF': 'CIF - Por conta do Emitente',
      'FOB': 'FOB - Por conta do Destinatário',
      'TERCEIROS': 'Por conta de Terceiros',
      'PROPRIO_REMETENTE': 'Próprio por conta do Remetente',
      'PROPRIO_DESTINATARIO': 'Próprio por conta do Destinatário',
      'SEM_FRETE': 'Sem ocorrência de Transporte',
    };
    return modalidades[mod] || mod;
  };

  if (!nota) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nota não encontrada</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            A nota fiscal com a chave informada não foi encontrada no sistema.
          </p>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] p-0">
        {/* Header com ações */}
        <div className="flex items-center justify-between p-4 border-b bg-muted/30 print:hidden">
          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6 text-primary" />
            <div>
              <h2 className="text-lg font-semibold">
                NF-e Nº {nota.numero} - Série {nota.serie}
              </h2>
              <p className="text-sm text-muted-foreground">
                Chave: {nota.chave_acesso}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint} disabled={isPrinting}>
              <Printer className="h-4 w-4 mr-2" />
              Imprimir
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={isPrinting}>
              <FileDown className="h-4 w-4 mr-2" />
              Exportar PDF
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <ScrollArea className="max-h-[calc(90vh-80px)]">
          <div className="p-6 space-y-6 print:p-0 print:m-0" id="nfe-content">
            {/* Cabeçalho para Impressão (só aparece na impressão) */}
            <div className="hidden print:block print:mb-4">
              <div className="text-center border-b-2 border-black pb-3 mb-4">
                <h1 className="text-xl font-bold">DOCUMENTO AUXILIAR - NF-e</h1>
                <p className="text-sm mt-1">Nota Fiscal Eletrônica</p>
              </div>
              <div className="flex justify-between text-sm mb-4">
                <div>
                  <p><strong>NF-e Nº:</strong> {nota.numero}</p>
                  <p><strong>Série:</strong> {nota.serie}</p>
                </div>
                <div className="text-right">
                  <p><strong>Emissão:</strong> {formatDate(nota.dh_emissao)}</p>
                  <p><strong>Status:</strong> {nota.status_sefaz}</p>
                </div>
              </div>
              <div className="text-xs mb-4 p-2 border bg-muted">
                <strong>Chave de Acesso:</strong><br />
                <span className="font-mono break-all">{nota.chave_acesso}</span>
              </div>
            </div>

            {/* Cabeçalho da Nota (tela) */}
            <div className="flex items-start justify-between print:hidden">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant={nota.status_sefaz === 'AUTORIZADA' ? 'default' : 'secondary'}>
                    {nota.status_sefaz}
                  </Badge>
                  <Badge variant="outline">{nota.ambiente}</Badge>
                  <Badge variant="outline">{nota.tipo_operacao}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  <strong>Natureza:</strong> {nota.natureza_operacao}
                </p>
              </div>
              <div className="text-right text-sm">
                <p><strong>Emissão:</strong> {formatDate(nota.dh_emissao)}</p>
                {nota.protocolo_autorizacao && (
                  <p><strong>Protocolo:</strong> {nota.protocolo_autorizacao}</p>
                )}
              </div>
            </div>

            <Separator />

            {/* Emitente e Destinatário */}
            <div className="grid grid-cols-2 gap-6">
              {/* Emitente */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-primary">
                  <Building2 className="h-4 w-4" />
                  EMITENTE
                </div>
                {emitente ? (
                  <div className="text-sm space-y-1 bg-muted/30 p-3 rounded-lg">
                    <p className="font-medium">{emitente.razao_social}</p>
                    {emitente.nome_fantasia && (
                      <p className="text-muted-foreground">{emitente.nome_fantasia}</p>
                    )}
                    <p>CNPJ: {emitente.documento}</p>
                    {emitente.ie && <p>IE: {emitente.ie}</p>}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Não informado</p>
                )}
              </div>

              {/* Destinatário */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-primary">
                  <Building2 className="h-4 w-4" />
                  DESTINATÁRIO
                </div>
                {destinatario ? (
                  <div className="text-sm space-y-1 bg-muted/30 p-3 rounded-lg">
                    <p className="font-medium">{destinatario.razao_social}</p>
                    {destinatario.nome_fantasia && (
                      <p className="text-muted-foreground">{destinatario.nome_fantasia}</p>
                    )}
                    <p>CNPJ: {destinatario.documento}</p>
                    {destinatario.ie && <p>IE: {destinatario.ie}</p>}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Não informado</p>
                )}
              </div>
            </div>

            <Separator />

            {/* Itens da Nota */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <Package className="h-4 w-4" />
                PRODUTOS / SERVIÇOS ({itensNota.length} itens)
              </div>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-12">#</TableHead>
                      <TableHead className="w-24">Código</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="w-20">NCM</TableHead>
                      <TableHead className="w-16">CFOP</TableHead>
                      <TableHead className="w-16 text-right">Qtd</TableHead>
                      <TableHead className="w-16">Un</TableHead>
                      <TableHead className="w-24 text-right">Vl. Unit.</TableHead>
                      <TableHead className="w-24 text-right">Vl. Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itensNota.map((item) => {
                      const impostosItem = todosImpostos.find((i) => i.nota_item_id === item.id);
                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono text-xs">{item.n_item}</TableCell>
                          <TableCell className="font-mono text-xs">{item.codigo_produto}</TableCell>
                          <TableCell className="text-sm">{item.descricao}</TableCell>
                          <TableCell className="font-mono text-xs">{item.ncm}</TableCell>
                          <TableCell className="font-mono text-xs">{item.cfop}</TableCell>
                          <TableCell className="text-right font-mono">
                            {item.quantidade_comercial?.toLocaleString('pt-BR', { minimumFractionDigits: 3 })}
                          </TableCell>
                          <TableCell className="text-xs">{item.unidade_comercial}</TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(item.valor_unitario_comercial)}
                          </TableCell>
                          <TableCell className="text-right font-mono font-medium">
                            {formatCurrency(item.valor_total)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            <Separator />

            {/* Totais e Impostos */}
            <div className="grid grid-cols-2 gap-6">
              {/* Impostos */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-primary">
                  <Calculator className="h-4 w-4" />
                  IMPOSTOS
                </div>
                <div className="bg-muted/30 p-4 rounded-lg space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Base de Cálculo ICMS:</span>
                    <span className="font-mono">{formatCurrency(totais?.icms_base_calculo || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Valor ICMS:</span>
                    <span className="font-mono">{formatCurrency(totais?.icms_valor || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Base de Cálculo ICMS ST:</span>
                    <span className="font-mono">{formatCurrency(totais?.icms_st_base_calculo || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Valor ICMS ST:</span>
                    <span className="font-mono">{formatCurrency(totais?.icms_st_valor || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Valor IPI:</span>
                    <span className="font-mono">{formatCurrency(totais?.valor_ipi || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Valor PIS:</span>
                    <span className="font-mono">{formatCurrency(totais?.valor_pis || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Valor COFINS:</span>
                    <span className="font-mono">{formatCurrency(totais?.valor_cofins || 0)}</span>
                  </div>
                </div>
              </div>

              {/* Totais */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-primary">
                  <Receipt className="h-4 w-4" />
                  TOTAIS
                </div>
                <div className="bg-muted/30 p-4 rounded-lg space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Valor dos Produtos:</span>
                    <span className="font-mono">{formatCurrency(totais?.valor_produtos || nota.total_produtos)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Valor do Frete:</span>
                    <span className="font-mono">{formatCurrency(totais?.valor_frete || nota.total_frete)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Valor do Seguro:</span>
                    <span className="font-mono">{formatCurrency(totais?.valor_seguro || nota.total_seguro)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Desconto:</span>
                    <span className="font-mono">{formatCurrency(totais?.valor_desconto || nota.total_desconto)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Outras Despesas:</span>
                    <span className="font-mono">{formatCurrency(totais?.valor_outros || nota.total_outros)}</span>
                  </div>
                  <Separator className="my-2" />
                  <div className="flex justify-between text-base font-semibold">
                    <span>VALOR TOTAL DA NOTA:</span>
                    <span className="font-mono text-primary">{formatCurrency(totais?.valor_nota || nota.total_nota)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Transporte */}
            {transporte && (
              <>
                <Separator />
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-primary">
                    <Truck className="h-4 w-4" />
                    TRANSPORTE
                  </div>
                  <div className="bg-muted/30 p-4 rounded-lg">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p><strong>Modalidade:</strong> {formatModalidadeFrete(transporte.modalidade_frete)}</p>
                        {transporte.transportadora_razao_social && (
                          <p><strong>Transportadora:</strong> {transporte.transportadora_razao_social}</p>
                        )}
                        {transporte.transportadora_cnpj && (
                          <p><strong>CNPJ:</strong> {transporte.transportadora_cnpj}</p>
                        )}
                      </div>
                      <div>
                        {transporte.veiculo_placa && (
                          <p><strong>Placa:</strong> {transporte.veiculo_placa} - {transporte.veiculo_uf}</p>
                        )}
                      </div>
                    </div>

                    {volumes.length > 0 && (
                      <div className="mt-4">
                        <p className="font-medium mb-2">Volumes:</p>
                        <div className="flex flex-wrap gap-4 text-sm">
                          {volumes.map((vol, idx) => (
                            <div key={idx} className="bg-background p-2 rounded border">
                              <span>{vol.quantidade}x {vol.especie || 'Volume'}</span>
                              {vol.peso_bruto && <span className="ml-2">({vol.peso_bruto} kg)</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Pagamento e Duplicatas */}
            {(pagamentos.length > 0 || duplicatas.length > 0) && (
              <>
                <Separator />
                <div className="grid grid-cols-2 gap-6">
                  {/* Formas de Pagamento */}
                  {pagamentos.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm font-medium text-primary">
                        <Receipt className="h-4 w-4" />
                        FORMAS DE PAGAMENTO
                      </div>
                      <div className="space-y-2">
                        {pagamentos.map((pag, idx) => (
                          <div key={idx} className="flex justify-between text-sm bg-muted/30 p-2 rounded">
                            <span>{formatFormaPagamento(pag.forma_pagamento)}</span>
                            <span className="font-mono">{formatCurrency(pag.valor)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Duplicatas */}
                  {duplicatas.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm font-medium text-primary">
                        <Calendar className="h-4 w-4" />
                        DUPLICATAS / VENCIMENTOS
                      </div>
                      <div className="space-y-2">
                        {duplicatas.map((dup, idx) => (
                          <div key={idx} className="flex justify-between text-sm bg-muted/30 p-2 rounded">
                            <span>
                              <strong>{dup.numero}</strong> - Venc: {formatDate(dup.data_vencimento)}
                            </span>
                            <span className="font-mono">{formatCurrency(dup.valor)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Observações da Nota */}
            {observacoes.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-primary">
                    <Info className="h-4 w-4" />
                    OBSERVAÇÕES DA NOTA
                  </div>
                  <div className="space-y-2">
                    {observacoes.map((obs, idx) => (
                      <div key={idx} className="bg-muted/30 p-3 rounded text-sm">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs">{obs.tipo}</Badge>
                          {obs.campo && <span className="text-xs text-muted-foreground">{obs.campo}</span>}
                        </div>
                        <p>{obs.texto}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Auditoria / Histórico de Importação */}
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <ClipboardList className="h-4 w-4" />
                AUDITORIA / HISTÓRICO
              </div>
              <div className="bg-muted/30 p-4 rounded-lg text-sm space-y-3">
                {/* Dados de importação */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-muted-foreground text-xs">Data de Importação</p>
                    <p className="font-medium">{formatDate(nota.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Última Atualização</p>
                    <p className="font-medium">{formatDate(nota.updated_at)}</p>
                  </div>
                  {nota.importado_por && (
                    <div>
                      <p className="text-muted-foreground text-xs">Importado por</p>
                      <p className="font-medium">{nota.importado_por}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-muted-foreground text-xs">Classificação</p>
                    <p className="font-medium">{nota.classificacao}</p>
                  </div>
                </div>

                {/* Log de ações */}
                {logsNota.length > 0 && (
                  <div className="mt-4 pt-3 border-t">
                    <p className="text-xs text-muted-foreground mb-2">Histórico de Ações:</p>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {logsNota.map((log, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-xs">
                          <span className="text-muted-foreground whitespace-nowrap">
                            {new Date(log.created_at).toLocaleString('pt-BR')}
                          </span>
                          <Badge variant="outline" className="text-xs shrink-0">{log.acao}</Badge>
                          {log.usuario && <span className="text-muted-foreground">por {log.usuario}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Hash do XML */}
                {nota.xml_hash_sha256 && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-xs text-muted-foreground">Hash SHA-256 do XML:</p>
                    <p className="font-mono text-xs break-all mt-1">{nota.xml_hash_sha256}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Informações Adicionais */}
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <Hash className="h-4 w-4" />
                INFORMAÇÕES TÉCNICAS
              </div>
              <div className="bg-muted/30 p-4 rounded-lg text-sm space-y-2">
                <p><strong>Chave de Acesso:</strong></p>
                <p className="font-mono text-xs break-all">{nota.chave_acesso}</p>
                {nota.protocolo_autorizacao && (
                  <p className="mt-2"><strong>Protocolo SEFAZ:</strong> {nota.protocolo_autorizacao}</p>
                )}
                {nota.dh_recebimento && (
                  <p><strong>Recebido SEFAZ:</strong> {formatDate(nota.dh_recebimento)}</p>
                )}
                {nota.digest_value && (
                  <>
                    <p className="mt-2"><strong>Digest Value:</strong></p>
                    <p className="font-mono text-xs break-all">{nota.digest_value}</p>
                  </>
                )}
                <div className="grid grid-cols-2 gap-2 mt-3 pt-2 border-t">
                  <p><strong>Versão Schema:</strong> {nota.versao_schema}</p>
                  <p><strong>Modelo:</strong> {nota.modelo}</p>
                  <p><strong>Finalidade:</strong> {nota.finalidade}</p>
                  <p><strong>Ambiente:</strong> {nota.ambiente}</p>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
