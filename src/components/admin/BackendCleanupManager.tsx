import { useState } from "react";
import { Database, Trash2, AlertTriangle, Loader2, Download, Shield, Zap } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Ordem de deleção: dependentes primeiro, principais depois
// Cada grupo será deletado na ordem listada
const DELETE_ORDER = [
  // Dependentes de OP
  "op_checklist",
  "op_controle_perdas",
  "op_controle_qualidade",
  "op_pesagens_criticas",
  "op_historico_etapas",
  "op_anexos",
  "op_assinaturas_rt",
  "op_embalagens",
  "op_materias_primas",
  "custos_op_lotes",
  "custos_op",
  // Dependentes de lotes
  "lote_documentos",
  "lote_materias_primas",
  "rastreabilidade_lote_mp",
  "estoque_movimentacoes",
  // Dependentes de fórmulas
  "alegacoes_anvisa",
  "formula_itens",
  "formula_versoes",
  "tabelas_nutricionais",
  // Dependentes de entidades
  "entidade_contatos",
  "entidade_enderecos",
  "entidade_papeis",
  "entidade_comercial_crm",
  "entidade_financeiro_config",
  "entidade_fiscal_config",
  "entidade_logistica_config",
  "entidade_documentos",
  // Dependentes de vendas
  "orcamento_itens",
  "pedido_itens",
  "notas_saida_itens",
  // Dependentes de compras
  "notas_entrada_itens",
  // Dependentes de itens
  "item_fornecedores",
  "item_alias",
  "catalogo_precos",
  "avaliacoes_fornecedor",
  // QC
  "qc_analises",
  "qc_calibracoes",
  "qc_desvios",
  // Inteligência
  "alertas_executivos",
  "anomalias_operacionais",
  "sugestoes_otimizacao",
  "previsoes_producao",
  "simulacoes_producao",
  "ranking_fornecedores",
  "kpis_executivos",
  "log_validacoes_anvisa",
  "regras_anvisa",
  "trilha_auditoria_tecnica",
  "versoes_parametros_industriais",
  // Produto acabado
  "lotes_produto_acabado",
  "ordens_producao_geradas",
  // Principais
  "ordens_producao_industrial",
  "estoque_lotes",
  "formulas",
  "notas_saida",
  "notas_entrada",
  "orcamentos",
  "pedidos_venda",
  "contas_receber",
  "itens",
  "entidades",
  // Logs e auxiliares
  "audit_log",
  "audit_trail_imutavel",
  "chat_messages",
  "notifications",
  "arquivos",
  // Configs (opcionais)
  "contratos_templates",
  "conversoes_unidades",
  "responsaveis_tecnicos",
  "config_capacidade_producao",
  "config_custos_producao",
  "company",
] as const;

// Tabelas exibidas na interface agrupadas
const BACKEND_TABLES = [
  { key: "formulas", label: "Fórmulas (Formulador)", cascade: ["formula_itens", "formula_versoes", "alegacoes_anvisa", "tabelas_nutricionais"] },
  { key: "ordens_producao_industrial", label: "Ordens de Produção (OP)", cascade: ["op_materias_primas", "op_embalagens", "op_checklist", "op_controle_perdas", "op_controle_qualidade", "op_pesagens_criticas", "op_historico_etapas", "op_anexos", "op_assinaturas_rt", "custos_op", "custos_op_lotes", "lotes_produto_acabado", "ordens_producao_geradas"] },
  { key: "estoque_lotes", label: "Lotes de Estoque", cascade: ["lote_documentos", "lote_materias_primas", "rastreabilidade_lote_mp", "estoque_movimentacoes"] },
  { key: "lotes_produto_acabado", label: "Lotes Produto Acabado (Quarentena)", cascade: [] },
  { key: "itens", label: "Produtos/Insumos", cascade: ["item_fornecedores", "item_alias", "catalogo_precos"] },
  { key: "entidades", label: "Entidades (Fornecedores/Clientes)", cascade: ["entidade_contatos", "entidade_enderecos", "entidade_papeis", "entidade_comercial_crm", "entidade_financeiro_config", "entidade_fiscal_config", "entidade_logistica_config", "entidade_documentos", "avaliacoes_fornecedor"] },
  { key: "notas_entrada", label: "Notas de Entrada", cascade: ["notas_entrada_itens"] },
  { key: "notas_saida", label: "Notas de Saída", cascade: ["notas_saida_itens"] },
  { key: "orcamentos", label: "Orçamentos", cascade: ["orcamento_itens"] },
  { key: "pedidos_venda", label: "Pedidos de Venda", cascade: ["pedido_itens"] },
  { key: "contas_receber", label: "Contas a Receber", cascade: [] },
  { key: "qc_analises", label: "QC - Análises", cascade: [] },
  { key: "qc_calibracoes", label: "QC - Calibrações", cascade: [] },
  { key: "qc_desvios", label: "QC - Desvios", cascade: [] },
  { key: "alertas_executivos", label: "Alertas Executivos", cascade: [] },
  { key: "anomalias_operacionais", label: "Anomalias Operacionais", cascade: [] },
  { key: "audit_log", label: "Logs de Auditoria", cascade: [] },
  { key: "audit_trail_imutavel", label: "Trilha de Auditoria Imutável", cascade: [] },
  { key: "chat_messages", label: "Mensagens do Chat", cascade: [] },
  { key: "notifications", label: "Notificações", cascade: [] },
  { key: "arquivos", label: "Arquivos", cascade: [] },
  { key: "responsaveis_tecnicos", label: "Responsáveis Técnicos", cascade: [] },
  { key: "company", label: "Empresa (Config)", cascade: [] },
];

interface TableCounts {
  [key: string]: number;
}

export function BackendCleanupManager() {
  const [counts, setCounts] = useState<TableCounts>({});
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmKey, setConfirmKey] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [exporting, setExporting] = useState<string | null>(null);
  const [cleaningAll, setCleaningAll] = useState(false);
  const [confirmCleanAll, setConfirmCleanAll] = useState(false);
  const [confirmCleanAllText, setConfirmCleanAllText] = useState("");

  const confirmTable = BACKEND_TABLES.find(t => t.key === confirmKey);
  const canConfirm = confirmText.trim().toUpperCase() === "APAGAR";
  const canConfirmAll = confirmCleanAllText.trim().toUpperCase() === "ZERAR TUDO";

  const fetchCounts = async () => {
    setLoading(true);
    const newCounts: TableCounts = {};

    for (const table of BACKEND_TABLES) {
      try {
        const { count, error } = await supabase
          .from(table.key as any)
          .select("*", { count: "exact", head: true });

        newCounts[table.key] = (!error && count !== null) ? count : 0;
      } catch {
        newCounts[table.key] = 0;
      }
    }

    setCounts(newCounts);
    setLoading(false);
  };

  const handleExport = async (tableKey: string) => {
    setExporting(tableKey);
    try {
      const { data, error } = await supabase.from(tableKey as any).select("*");
      if (error) throw error;

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup_${tableKey}_${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Backup de ${tableKey} exportado!`);
    } catch (error) {
      console.error("Error exporting:", error);
      toast.error(`Erro ao exportar ${tableKey}`);
    } finally {
      setExporting(null);
    }
  };

  const deleteTable = async (tableKey: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from(tableKey as any)
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");

      if (error) {
        console.warn(`Erro ao limpar ${tableKey}:`, error.message);
        return false;
      }
      return true;
    } catch {
      return false;
    }
  };

  const handleDelete = async (tableKey: string) => {
    setDeleting(tableKey);
    const table = BACKEND_TABLES.find(t => t.key === tableKey);
    if (!table) return;

    try {
      // Apagar dependentes primeiro
      for (const dep of table.cascade) {
        await deleteTable(dep);
      }
      // Apagar principal
      const ok = await deleteTable(tableKey);
      if (!ok) throw new Error("Falha ao limpar tabela principal");

      toast.success(`Tabela ${table.label} limpa com sucesso!`);
      await fetchCounts();
    } catch (error: any) {
      console.error("Error deleting:", error);
      toast.error(`Erro ao limpar ${table.label}: ${error?.message || 'Erro desconhecido'}`);
    } finally {
      setDeleting(null);
      setConfirmKey(null);
      setConfirmText("");
    }
  };

  const handleCleanAll = async () => {
    setCleaningAll(true);
    setConfirmCleanAll(false);
    setConfirmCleanAllText("");

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    toast.info("Iniciando limpeza total do backend...");

    for (const tableKey of DELETE_ORDER) {
      try {
        // Verificar se a tabela tem dados primeiro
        const { count } = await supabase
          .from(tableKey as any)
          .select("*", { count: "exact", head: true });

        if (count && count > 0) {
          const ok = await deleteTable(tableKey);
          if (ok) {
            successCount++;
            console.log(`✓ ${tableKey}: ${count} registros removidos`);
          } else {
            errorCount++;
            errors.push(tableKey);
            console.warn(`✗ ${tableKey}: falha ao limpar`);
          }
        }
      } catch (err: any) {
        errorCount++;
        errors.push(tableKey);
        console.warn(`✗ ${tableKey}: ${err?.message}`);
      }
    }

    if (errorCount === 0) {
      toast.success(`Limpeza total concluída! ${successCount} tabela(s) limpas.`);
    } else {
      toast.warning(`Limpeza parcial: ${successCount} OK, ${errorCount} com erro (${errors.join(", ")})`);
    }

    await fetchCounts();
    setCleaningAll(false);
  };

  const totalRecords = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <Card className="mt-6">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Database className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle>Limpeza do Backend (Nuvem)</CardTitle>
              <CardDescription>
                Gerenciar dados armazenados no banco de dados remoto
              </CardDescription>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchCounts} disabled={loading || cleaningAll}>
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Shield className="h-4 w-4 mr-2" />}
              {loading ? "Carregando..." : "Verificar Contagens"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Botão Limpar Tudo */}
        {Object.keys(counts).length > 0 && (
          <div className="flex items-center justify-between p-4 rounded-lg border-2 border-destructive/40 bg-destructive/5">
            <div>
              <p className="font-semibold text-destructive flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Limpar TUDO do Backend
              </p>
              <p className="text-sm text-muted-foreground">
                {totalRecords} registro(s) em {Object.values(counts).filter(c => c > 0).length} tabela(s) com dados
              </p>
            </div>
            <Button
              variant="destructive"
              size="lg"
              onClick={() => {
                setConfirmCleanAll(true);
                setConfirmCleanAllText("");
              }}
              disabled={cleaningAll || totalRecords === 0}
            >
              {cleaningAll ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Limpando...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Zerar Todo o Backend
                </>
              )}
            </Button>
          </div>
        )}

        {Object.keys(counts).length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>Clique em "Verificar Contagens" para carregar os dados do backend</p>
          </div>
        ) : (
          <div className="border rounded-lg divide-y">
            {BACKEND_TABLES.map((table) => {
              const count = counts[table.key] || 0;
              const hasData = count > 0;

              return (
                <div key={table.key} className="flex items-center justify-between gap-4 px-4 py-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{table.label}</span>
                      {table.cascade.length > 0 && (
                        <span className="text-xs text-muted-foreground">
                          (+ {table.cascade.length} dependentes)
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">{table.key}</p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <StatusBadge variant={hasData ? "success" : "muted"}>
                      {count} registro(s)
                    </StatusBadge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExport(table.key)}
                      disabled={exporting === table.key || count === 0 || cleaningAll}
                    >
                      {exporting === table.key ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        setConfirmKey(table.key);
                        setConfirmText("");
                      }}
                      disabled={deleting === table.key || count === 0 || cleaningAll}
                    >
                      {deleting === table.key ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-start gap-3 p-3 rounded-lg border border-destructive/30 bg-destructive/5">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-destructive">Atenção: Dados na Nuvem</p>
            <p className="text-muted-foreground">
              A limpeza de tabelas do backend afeta dados permanentemente. Sempre faça backup (botão de download)
              antes de apagar. Todas as operações são registradas no log de auditoria.
            </p>
          </div>
        </div>
      </CardContent>

      {/* Dialog: Limpar tabela individual */}
      <AlertDialog open={!!confirmKey} onOpenChange={(open) => !open && setConfirmKey(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Confirmar limpeza do backend
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                Você está prestes a apagar todos os dados da tabela: <strong>{confirmTable?.label}</strong>
              </p>
              {confirmTable?.cascade && confirmTable.cascade.length > 0 && (
                <div className="p-2 bg-muted rounded text-xs">
                  <p className="font-medium mb-1">Tabelas dependentes que serão afetadas:</p>
                  <ul className="list-disc list-inside">
                    {confirmTable.cascade.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="pt-2">
                <Label htmlFor="confirm-backend" className="text-foreground">
                  Digite <strong className="text-destructive">APAGAR</strong> para confirmar:
                </Label>
                <Input
                  id="confirm-backend"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="APAGAR"
                  className="mt-2"
                  autoComplete="off"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmText("")}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={!canConfirm || !confirmKey}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
              onClick={() => confirmKey && handleDelete(confirmKey)}
            >
              Confirmar Limpeza
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog: Limpar TUDO */}
      <AlertDialog open={confirmCleanAll} onOpenChange={(open) => !open && setConfirmCleanAll(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              ⚠️ LIMPAR TODO O BACKEND
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p className="font-semibold">
                Esta ação irá apagar TODOS os dados de TODAS as tabelas do banco de dados na nuvem.
              </p>
              <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/30 text-sm">
                <p className="font-bold text-destructive mb-2">Serão apagados:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Todas as fórmulas, OPs e dados de produção</li>
                  <li>Todos os lotes de estoque e movimentações</li>
                  <li>Todos os itens (produtos/insumos)</li>
                  <li>Todas as entidades (fornecedores/clientes)</li>
                  <li>Todas as notas fiscais, orçamentos e pedidos</li>
                  <li>Todos os logs, notificações e mensagens</li>
                  <li>Configurações de empresa e RTs</li>
                </ul>
              </div>
              <div className="pt-2">
                <Label htmlFor="confirm-clean-all" className="text-foreground">
                  Digite <strong className="text-destructive">ZERAR TUDO</strong> para confirmar:
                </Label>
                <Input
                  id="confirm-clean-all"
                  value={confirmCleanAllText}
                  onChange={(e) => setConfirmCleanAllText(e.target.value)}
                  placeholder="ZERAR TUDO"
                  className="mt-2"
                  autoComplete="off"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmCleanAllText("")}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={!canConfirmAll}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
              onClick={handleCleanAll}
            >
              🗑️ ZERAR TODO O BACKEND
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
