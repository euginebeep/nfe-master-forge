import { useEffect, useMemo, useState, useCallback } from "react";
import { AlertTriangle, Download, RefreshCw, Trash2, Loader2, Database, HardDrive } from "lucide-react";
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
import { seedInitialData } from "@/lib/local-db";
import { toast } from "sonner";

export type LocalCollectionDef = { key: string; label: string };

type CollectionRow = {
  key: string;
  label: string;
  storageKey: string;
  exists: boolean;
  count: number;
  isExtra?: boolean;
  /** Whether this collection is actively used in the ERP code */
  inUse: boolean;
  /** Which module uses this collection */
  module?: string;
};

/**
 * Collections actively used by the ERP codebase.
 * Mapped to the module that uses them.
 */
const ACTIVE_COLLECTIONS: Record<string, string> = {
  company: "Configurações",
  entidades: "⚠️ Legacy local (backend = entidades)",
  entidade_contatos: "⚠️ Legacy local (backend = entidade_contatos)",
  entidade_enderecos: "⚠️ Legacy local (backend = entidade_enderecos)",
  itens: "Cadastros / Estoque",
  item_fornecedores: "Cadastros / Compras",
  item_alias: "Cadastros / NF-e",
  estoque_lotes: "Estoque / Produção",
  lote_documentos: "Estoque / QC",
  notas_entrada: "NF-e Entrada (resumo simplificado)",
  notas_entrada_itens: "NF-e Entrada (itens resumo)",
  notas_fiscais: "NF-e Entrada (XML completo)",
  notas_fiscais_observacoes: "NF-e Entrada (observações)",
  notas_fiscais_itens: "NF-e Entrada (itens detalhados)",
  notas_fiscais_itens_impostos: "NF-e Entrada (impostos por item)",
  notas_fiscais_itens_rastros: "NF-e Entrada (rastreabilidade)",
  notas_fiscais_totais: "NF-e Entrada (totais impostos)",
  notas_fiscais_transporte: "NF-e Entrada (transporte)",
  notas_fiscais_volumes: "NF-e Entrada (volumes)",
  notas_fiscais_faturas: "NF-e Entrada (faturas)",
  notas_fiscais_duplicatas: "NF-e Entrada (duplicatas)",
  notas_fiscais_pagamentos: "NF-e Entrada (pagamentos)",
  contas_pagar: "Financeiro (gerado pela NF-e)",
  importacao_logs: "NF-e Importação (logs)",
  arquivos: "Documentos / Anexos",
  audit_log: "Auditoria",
  xml_backups: "Backup XML original",
};

function getCountFromStorage(storageKey: string): number {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.length : 1;
  } catch {
    return 0;
  }
}

function getDataFromStorage(storageKey: string): unknown {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function LocalCollectionsManager({
  storagePrefix,
  collections,
}: {
  storagePrefix: string;
  collections: LocalCollectionDef[];
}) {
  const [rows, setRows] = useState<CollectionRow[]>([]);
  const [confirmKey, setConfirmKey] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [exporting, setExporting] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const confirmRow = useMemo(
    () => (confirmKey ? rows.find((r) => r.key === confirmKey) : undefined),
    [confirmKey, rows]
  );

  const handleExport = (row: CollectionRow) => {
    setExporting(row.key);
    try {
      const data = getDataFromStorage(row.storageKey);
      if (!data) {
        toast.error("Nenhum dado para exportar");
        return;
      }

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup_${row.key}_${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`Backup de ${row.label} exportado!`);
    } catch (error) {
      console.error("Error exporting:", error);
      toast.error("Erro ao exportar dados");
    } finally {
      setExporting(null);
    }
  };

  const canConfirm = confirmText.trim().toUpperCase() === "APAGAR";

  const refresh = useCallback(() => {
    setRefreshing(true);
    
    const definedKeys = new Set(collections.map((c) => c.key));

    const definedRows: CollectionRow[] = collections.map((c) => {
      const storageKey = `${storagePrefix}${c.key}`;
      const count = getCountFromStorage(storageKey);
      const inUse = c.key in ACTIVE_COLLECTIONS;
      return {
        key: c.key,
        label: c.label,
        storageKey,
        exists: localStorage.getItem(storageKey) !== null,
        count,
        inUse,
        module: ACTIVE_COLLECTIONS[c.key],
      };
    });

    // extras: any legacy_erp_* key not listed in collections
    const extraRows: CollectionRow[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(storagePrefix)) continue;

      const suffix = k.slice(storagePrefix.length);
      if (definedKeys.has(suffix)) continue;

      const inUse = suffix in ACTIVE_COLLECTIONS;
      extraRows.push({
        key: suffix,
        label: `Chave extra: ${suffix}`,
        storageKey: k,
        exists: true,
        count: getCountFromStorage(k),
        isExtra: true,
        inUse,
        module: ACTIVE_COLLECTIONS[suffix],
      });
    }

    extraRows.sort((a, b) => a.key.localeCompare(b.key));

    setRows([...definedRows, ...extraRows]);
    
    // Visual feedback
    setTimeout(() => {
      setRefreshing(false);
      toast.success("Coleções atualizadas com sucesso!");
    }, 300);
  }, [collections, storagePrefix]);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen for localdb:change events to auto-refresh
  useEffect(() => {
    const handler = () => refresh();
    window.addEventListener("localdb:change", handler);
    return () => window.removeEventListener("localdb:change", handler);
  }, [refresh]);

  const deleteOne = (row: CollectionRow) => {
    localStorage.removeItem(row.storageKey);

    if (row.key === "company") {
      seedInitialData();
    }

    window.dispatchEvent(
      new CustomEvent("localdb:change", {
        detail: { collection: row.key },
      })
    );

    toast.success(`${row.label} apagada com sucesso`);
  };

  // Summary stats
  const totalCollections = rows.length;
  const withData = rows.filter(r => r.count > 0).length;
  const totalRecords = rows.reduce((sum, r) => sum + r.count, 0);
  const inUseCount = rows.filter(r => r.inUse).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Coleções do ERP (localStorage)
            </CardTitle>
            <CardDescription>
              Verifique se todas as coleções locais existem e apague dados por coleção.
            </CardDescription>
            <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
              <span>{totalCollections} coleções</span>
              <span>{withData} com dados</span>
              <span>{totalRecords} registros total</span>
              <span>{inUseCount} em uso ativo</span>
            </div>
          </div>
          <Button variant="outline" onClick={refresh} disabled={refreshing}>
            {refreshing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="border rounded-lg divide-y">
          {rows.map((r) => {
            const statusVariant = r.count > 0 ? "success" : r.exists ? "muted" : "warning";
            const statusLabel = r.count > 0 ? "Com dados" : r.exists ? "Vazia" : "Ausente";

            return (
              <div key={r.storageKey} className="flex items-center justify-between gap-4 px-4 py-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{r.label}</span>
                    {r.isExtra && <StatusBadge variant="warning">Extra</StatusBadge>}
                    {r.inUse && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                        {r.module}
                      </span>
                    )}
                    {!r.inUse && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                        Sem uso
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground font-mono truncate">{r.storageKey}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge variant={statusVariant as any}>
                    {statusLabel} • {r.count}
                  </StatusBadge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExport(r)}
                    disabled={exporting === r.key || r.count === 0}
                    title="Exportar backup JSON"
                  >
                    {exporting === r.key ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      setConfirmKey(r.key);
                      setConfirmText("");
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Apagar
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-start gap-3 p-3 rounded-lg border">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold">Atenção</p>
            <p className="text-muted-foreground">
              "Apagar" remove os dados somente deste navegador (armazenamento local). Para apagar dados do backend,
              use a ferramenta de migração/limpeza do backend (se necessário).
            </p>
          </div>
        </div>
      </CardContent>

      <AlertDialog open={!!confirmKey} onOpenChange={(open) => !open && setConfirmKey(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Confirmar exclusão da coleção
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                Você está prestes a apagar os dados da coleção: <strong>{confirmRow?.label}</strong>
              </p>
              <div className="pt-2">
                <Label htmlFor="confirm-text" className="text-foreground">
                  Digite <strong className="text-destructive">APAGAR</strong> para confirmar:
                </Label>
                <Input
                  id="confirm-text"
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
              disabled={!canConfirm || !confirmRow}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
              onClick={() => {
                if (!confirmRow) return;
                deleteOne(confirmRow);
                setConfirmKey(null);
                setConfirmText("");
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
