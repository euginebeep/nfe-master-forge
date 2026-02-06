import { useState } from "react";
import { Database, Trash2, AlertTriangle, Loader2, Download, Shield } from "lucide-react";
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

// Tabelas do backend que podem ser limpas
const BACKEND_TABLES = [
  { key: "itens", label: "Produtos/Insumos", cascade: ["item_fornecedores", "item_alias", "estoque_lotes"] },
  { key: "entidades", label: "Entidades (Fornecedores/Clientes)", cascade: ["entidade_contatos", "entidade_enderecos", "entidade_papeis", "entidade_comercial_crm", "entidade_financeiro_config", "entidade_fiscal_config", "entidade_logistica_config", "entidade_documentos"] },
  { key: "estoque_lotes", label: "Lotes de Estoque", cascade: ["lote_documentos"] },
  { key: "notas_entrada", label: "Notas de Entrada", cascade: ["notas_entrada_itens"] },
  { key: "item_fornecedores", label: "Vínculos Item-Fornecedor", cascade: [] },
  { key: "item_alias", label: "Aliases de Itens", cascade: [] },
  { key: "entidade_contatos", label: "Contatos de Entidades", cascade: [] },
  { key: "entidade_enderecos", label: "Endereços de Entidades", cascade: [] },
  { key: "audit_log", label: "Logs de Auditoria", cascade: [] },
  { key: "arquivos", label: "Arquivos", cascade: [] },
];

type TableKey = typeof BACKEND_TABLES[number]["key"];

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

  const confirmTable = BACKEND_TABLES.find(t => t.key === confirmKey);
  const canConfirm = confirmText.trim().toUpperCase() === "APAGAR";

  const fetchCounts = async () => {
    setLoading(true);
    const newCounts: TableCounts = {};

    for (const table of BACKEND_TABLES) {
      try {
        const { count, error } = await supabase
          .from(table.key as any)
          .select("*", { count: "exact", head: true });

        if (!error && count !== null) {
          newCounts[table.key] = count;
        } else {
          newCounts[table.key] = 0;
        }
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
      const { data, error } = await supabase
        .from(tableKey as any)
        .select("*");

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

      toast.success(`Backup de ${tableKey} exportado com sucesso!`);
    } catch (error) {
      console.error("Error exporting:", error);
      toast.error(`Erro ao exportar ${tableKey}`);
    } finally {
      setExporting(null);
    }
  };

  const handleDelete = async (tableKey: string) => {
    setDeleting(tableKey);
    const table = BACKEND_TABLES.find(t => t.key === tableKey);
    if (!table) return;

    try {
      // Registrar no audit_log antes de apagar
      await supabase.from("audit_log").insert({
        entidade: tableKey,
        acao: "LIMPEZA_TOTAL",
        payload: {
          tabelas_afetadas: [tableKey, ...table.cascade],
          registros_antes: counts[tableKey] || 0,
          usuario_acao: "admin",
          timestamp: new Date().toISOString(),
        },
      });

      // Apagar cascata (tabelas dependentes primeiro)
      for (const cascadeTable of table.cascade) {
        // Para tabelas com FK, precisamos apagar registros relacionados
        // Mas como temos CASCADE no banco, podemos apenas apagar a principal
      }

      // Apagar registros da tabela principal
      const { error } = await supabase
        .from(tableKey as any)
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000"); // Trick para deletar todos

      if (error) throw error;

      toast.success(`Tabela ${table.label} limpa com sucesso!`);
      await fetchCounts();
    } catch (error) {
      console.error("Error deleting:", error);
      toast.error(`Erro ao limpar ${table.label}`);
    } finally {
      setDeleting(null);
      setConfirmKey(null);
      setConfirmText("");
    }
  };

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
          <Button variant="outline" onClick={fetchCounts} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Shield className="h-4 w-4 mr-2" />}
            {loading ? "Carregando..." : "Verificar Contagens"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
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
                      disabled={exporting === table.key || count === 0}
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
                      disabled={deleting === table.key || count === 0}
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
    </Card>
  );
}
