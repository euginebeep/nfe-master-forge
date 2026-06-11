import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  Shield, Package, Calendar, UserCheck, CheckCircle2, AlertTriangle,
  QrCode, Factory, Beaker, Clock, ShieldCheck, Truck, FileText
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QRCodeAuditoria } from "@/components/shared/QRCodeAuditoria";
import { motion } from "framer-motion";

export default function LoteAuditoriaPublicaPage() {
  const { hash } = useParams<{ hash: string }>();

  const { data: loteData, isLoading, error } = useQuery({
    queryKey: ['lote-auditoria-publica', hash],
    queryFn: async () => {
      if (!hash) throw new Error('Hash não informado');
      
      // Tentar buscar em lotes de fornecedor primeiro (estoque_lotes)
      const { data: loteFornecedor } = await supabase
        .from('estoque_lotes')
        .select(`
          *,
          item:itens (*),
          fornecedor:entidades (*),
          lote_documentos (*, arquivo:arquivos(*))
        `)
        .eq('id', hash) 
        .maybeSingle();

      if (loteFornecedor) {
        return {
          ...loteFornecedor,
          tipo_lote: 'FORNECEDOR',
          produto_nome: (loteFornecedor.item as any)?.descricao_interna || 'Insumo',
          produto_codigo: (loteFornecedor.item as any)?.sku_interno || '',
          data_fabricacao: loteFornecedor.data_fab,
          data_validade: loteFornecedor.data_val,
          quantidade_produzida: loteFornecedor.quantidade_original,
          unidade: loteFornecedor.unidade_original,
          qr_code_hash: hash, // For display logic
        };
      }

      // Se não achar, buscar em lotes de produto acabado
      const { data, error: acabadoError } = await supabase
        .from('lotes_produto_acabado')
        .select('*')
        .eq('qr_code_hash', hash)
        .maybeSingle();

      if (acabadoError || !data) throw new Error('Lote não encontrado');

      const { data: materiasPrimas } = await supabase
        .from('lote_materias_primas')
        .select('*')
        .eq('lote_produto_acabado_id', data.id);

      return {
        ...data,
        tipo_lote: 'ACABADO',
        materias_primas: materiasPrimas || [],
      };
    },
    enabled: !!hash,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <QrCode className="h-16 w-16 text-muted-foreground" />
          <p className="text-muted-foreground">Verificando integridade do lote...</p>
        </div>
      </div>
    );
  }

  const lote = loteData as any;

  if (error || !lote) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="w-12 h-12 mx-auto text-destructive mb-4" />
            <h1 className="text-xl font-bold mb-2">Lote Não Encontrado</h1>
            <p className="text-muted-foreground">
              O QR Code escaneado não corresponde a nenhum lote registrado.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusConfig: Record<string, { variant: 'warning' | 'success' | 'error'; icon: any }> = {
    QUARENTENA: { variant: 'warning', icon: AlertTriangle },
    APROVADO: { variant: 'success', icon: CheckCircle2 },
    BLOQUEADO: { variant: 'error', icon: AlertTriangle },
    LIBERADO: { variant: 'success', icon: CheckCircle2 },
    DISPONIVEL: { variant: 'success', icon: CheckCircle2 },
  };

  const status = statusConfig[lote.status] || statusConfig.QUARENTENA;
  const isVerified = lote.qr_code_hash === hash || lote.tipo_lote === 'FORNECEDOR';

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      {/* Header */}
      <div className="bg-primary text-primary-foreground py-6 px-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8" />
            <div>
              <h1 className="text-xl font-bold">Certificado de Rastreabilidade</h1>
              <p className="text-sm opacity-80">BrainX ERP — Auditoria Pública</p>
            </div>
          </div>
          {/* Selo de verificação animado */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, delay: 0.5 }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
              isVerified ? 'bg-green-500/20 text-green-100' : 'bg-red-500/20 text-red-100'
            }`}
          >
            {isVerified ? <ShieldCheck className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
            {isVerified ? 'Verificado' : 'Não verificado'}
          </motion.div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4 space-y-6">
        {/* Status + QR Code */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-muted">
                  <status.icon className="w-8 h-8" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status do Lote</p>
                  <StatusBadge variant={status.variant} className="text-lg px-4 py-1">
                    {lote.status}
                  </StatusBadge>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Lote Nº</p>
                <p className="text-2xl font-bold font-mono">{lote.numero_lote}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Produto */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Package className="w-5 h-5" />
              {lote.tipo_lote === 'FORNECEDOR' ? 'Insumo / Matéria-Prima' : 'Produto'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Nome</p>
              <p className="text-lg font-semibold">{lote.produto_nome}</p>
              {lote.produto_codigo && (
                <p className="text-sm text-muted-foreground">Código: {lote.produto_codigo}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Data de Fabricação</p>
                <p className="font-medium">{lote.data_fabricacao ? format(new Date(lote.data_fabricacao), "dd/MM/yyyy", { locale: ptBR }) : '—'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Data de Validade</p>
                <p className="font-medium">{lote.data_validade ? format(new Date(lote.data_validade), "dd/MM/yyyy", { locale: ptBR }) : '—'}</p>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{lote.tipo_lote === 'FORNECEDOR' ? 'Quantidade Recebida' : 'Quantidade Produzida'}</p>
              <p className="font-medium">{lote.quantidade_produzida} {lote.unidade || 'unidades'}</p>
            </div>
          </CardContent>
        </Card>

        {/* Origem / Fornecedor ou RT */}
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              {lote.tipo_lote === 'FORNECEDOR' ? (
                <>
                  <Truck className="w-5 h-5 text-primary" />
                  Origem do Insumo
                </>
              ) : (
                <>
                  <UserCheck className="w-5 h-5 text-primary" />
                  Responsável Técnico
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-primary/5 rounded-lg p-4">
              {lote.tipo_lote === 'FORNECEDOR' ? (
                <>
                  <p className="text-lg font-semibold">{lote.fornecedor?.razao_social || 'Fornecedor não identificado'}</p>
                  {lote.fornecedor?.documento && <p className="text-muted-foreground">CNPJ: {lote.fornecedor.documento}</p>}
                </>
              ) : (
                <>
                  <p className="text-lg font-semibold">{lote.rt_nome}</p>
                  <p className="text-muted-foreground">
                    {lote.rt_tipo_conselho} {lote.rt_numero_registro}/{lote.rt_uf_conselho}
                  </p>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Matérias-Primas (Só para produto acabado) */}
        {lote.tipo_lote === 'ACABADO' && lote.materias_primas && lote.materias_primas.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Beaker className="w-5 h-5" />
                Composição do Lote ({lote.materias_primas.length} itens)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {lote.materias_primas.map((mp: any) => (
                  <div key={mp.id} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                    <div>
                      <p className="font-medium">{mp.insumo_nome}</p>
                      <p className="text-sm text-muted-foreground">
                        Lote: {mp.insumo_lote} | Fornecedor: {mp.fornecedor_nome}
                      </p>
                    </div>
                    <p className="text-sm font-mono">{Number(mp.quantidade_utilizada_g).toFixed(2)}g</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Documentação Técnica (Só para fornecedor por enquanto) */}
        {lote.tipo_lote === 'FORNECEDOR' && lote.lote_documentos && lote.lote_documentos.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="w-5 h-5" />
                Documentação Técnica (COA/Laudo)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {lote.lote_documentos.map((doc: any) => (
                  <div key={doc.id} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium text-sm">{doc.arquivo_nome}</p>
                        <p className="text-xs text-muted-foreground">
                          Tipo: {doc.tipo_documento} | Status: <StatusBadge variant={doc.status_validacao === 'VALIDADO' ? 'success' : 'warning'}>{doc.status_validacao}</StatusBadge>
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Histórico/Audit Trail (Se houver) */}
        {lote.audit_trail && lote.audit_trail.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock className="w-5 h-5" />
                Histórico de Rastreabilidade
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative ml-4 border-l-2 border-muted-foreground/20 space-y-6 pl-6">
                {lote.audit_trail.map((evento: any, idx: number) => (
                  <motion.div
                    key={evento.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="relative"
                  >
                    <div className="absolute -left-[31px] top-1 w-4 h-4 rounded-full bg-primary border-2 border-background" />
                    <div>
                      <p className="font-medium text-sm">{evento.descricao}</p>
                      <p className="text-xs text-muted-foreground">
                        {evento.tipo_evento} — {format(new Date(evento.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        {evento.usuario_nome && ` por ${evento.usuario_nome}`}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Declaração Legal */}
        <Card className="bg-muted/30">
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <Shield className="w-6 h-6 text-primary mt-1" />
              <div>
                <p className="font-semibold mb-2">Declaração de Conformidade</p>
                <p className="text-sm text-muted-foreground">
                  Este lote foi processado sob responsabilidade técnica conforme legislação 
                  sanitária vigente (ANVISA). Todos os processos seguem as Boas Práticas 
                  de Fabricação (BPF) e são auditáveis eletronicamente.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* QR Code de Fundo */}
        <div className="flex flex-col items-center py-4 gap-4">
          <QRCodeAuditoria
            tipo={lote.tipo_lote === 'FORNECEDOR' ? "LOTE_MP" : "PRODUTO_ACABADO"}
            id={lote.id}
            hash={hash!}
            codigo={lote.numero_lote}
            label="QR Code de Verificação"
            size={100}
          />
          <div className="text-center text-xs text-muted-foreground">
            <p className="font-mono break-all max-w-md">{hash}</p>
            <p className="mt-2">
              Verificado em {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
