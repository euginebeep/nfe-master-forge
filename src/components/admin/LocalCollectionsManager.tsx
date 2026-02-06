import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Download, RefreshCw, Trash2, Loader2 } from "lucide-react";
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

  const refresh = () => {
    const definedKeys = new Set(collections.map((c) => c.key));

    const definedRows: CollectionRow[] = collections.map((c) => {
      const storageKey = `${storagePrefix}${c.key}`;
      const count = getCountFromStorage(storageKey);
      return {
        key: c.key,
        label: c.label,
        storageKey,
        exists: localStorage.getItem(storageKey) !== null,
        count,
      };
    });

    // extras: any legacy_erp_* key not listed in collections
    const extraRows: CollectionRow[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(storagePrefix)) continue;

      const suffix = k.slice(storagePrefix.length);
      if (definedKeys.has(suffix)) continue;

      extraRows.push({
        key: suffix,
        label: `Chave extra: ${suffix}`,
        storageKey: k,
        exists: true,
        count: getCountFromStorage(k),
        isExtra: true,
      });
    }

    extraRows.sort((a, b) => a.key.localeCompare(b.key));

    setRows([...definedRows, ...extraRows]);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const deleteOne = (row: CollectionRow) => {
    localStorage.removeItem(row.storageKey);

    // Recriar empresa mínima se apagou company
    if (row.key === "company") {
      seedInitialData();
    }

    // Notificar listeners (listas, páginas, etc.)
    window.dispatchEvent(
      new CustomEvent("localdb:change", {
        detail: { collection: row.key },
      })
    );

    refresh();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>Coleções do ERP</CardTitle>
            <CardDescription>
              Verifique se todas as coleções locais existem e apague dados por coleção.
            </CardDescription>
          </div>
          <Button variant="outline" onClick={refresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
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
              “Apagar” remove os dados somente deste navegador (armazenamento local). Para apagar dados do backend,
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
