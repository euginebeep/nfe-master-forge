import { useState } from "react";
import { Trash2, AlertTriangle, Loader2, Calendar, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";

interface AdminCleanupButtonProps {
  tableName: string;
  tableLabel: string;
  cascadeTables?: string[];
  dateColumn?: string; // Column to filter by date (e.g., "created_at", "criado_em")
  onCleanupComplete?: () => void;
}

export function AdminCleanupButton({
  tableName,
  tableLabel,
  cascadeTables = [],
  dateColumn = "created_at",
  onCleanupComplete,
}: AdminCleanupButtonProps) {
  const [open, setOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const canConfirm = confirmText.trim().toUpperCase() === "APAGAR";

  const handleOpen = () => {
    setOpen(true);
    setConfirmText("");
    setPreviewCount(null);
    setDateFrom("");
    setDateTo("");
  };

  const handlePreviewCount = async () => {
    setLoadingPreview(true);
    try {
      let query = supabase
        .from(tableName as any)
        .select("*", { count: "exact", head: true });

      if (dateFrom) {
        query = query.gte(dateColumn, dateFrom);
      }
      if (dateTo) {
        query = query.lte(dateColumn, dateTo + "T23:59:59");
      }

      const { count, error } = await query;

      if (error) {
        console.error("Erro ao contar registros:", error);
        toast.error("Erro ao contar registros");
      } else {
        setPreviewCount(count || 0);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      // Registrar no audit_log antes de apagar
      await supabase.from("audit_log").insert({
        entidade: tableName,
        acao: "LIMPEZA_SELETIVA",
        payload: {
          tabela: tableName,
          tabelas_cascade: cascadeTables,
          filtro_data_inicio: dateFrom || null,
          filtro_data_fim: dateTo || null,
          registros_previstos: previewCount,
          usuario_acao: "admin",
          timestamp: new Date().toISOString(),
        },
      });

      // Construir query de delete
      let query = supabase
        .from(tableName as any)
        .delete();

      if (dateFrom || dateTo) {
        // Com filtro de data
        if (dateFrom) {
          query = query.gte(dateColumn, dateFrom);
        }
        if (dateTo) {
          query = query.lte(dateColumn, dateTo + "T23:59:59");
        }
      } else {
        // Deletar tudo - trick para deletar todos os registros
        query = query.neq("id", "00000000-0000-0000-0000-000000000000");
      }

      const { error } = await query;

      if (error) {
        console.error("Erro ao excluir:", error);
        toast.error(`Erro ao limpar ${tableLabel}`);
      } else {
        toast.success(`${tableLabel} limpo(a) com sucesso!`, {
          description: dateFrom || dateTo 
            ? `Registros entre ${dateFrom || "início"} e ${dateTo || "hoje"} removidos.`
            : "Todos os registros foram removidos.",
        });
        onCleanupComplete?.();
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro inesperado ao limpar dados");
    } finally {
      setLoading(false);
      setOpen(false);
      setConfirmText("");
    }
  };

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
            onClick={handleOpen}
          >
            <ShieldAlert className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Admin: Limpar {tableLabel}</p>
        </TooltipContent>
      </Tooltip>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Limpar {tableLabel}
            </DialogTitle>
            <DialogDescription>
              Esta ação irá excluir permanentemente os registros selecionados.
              {cascadeTables.length > 0 && (
                <span className="block mt-1 text-xs">
                  Tabelas dependentes: {cascadeTables.join(", ")}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Filtro por data */}
            <div className="p-4 rounded-lg bg-muted/50 border space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Calendar className="h-4 w-4" />
                Filtrar por período (opcional)
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="date-from" className="text-xs">De</Label>
                  <Input
                    id="date-from"
                    type="date"
                    value={dateFrom}
                    onChange={(e) => {
                      setDateFrom(e.target.value);
                      setPreviewCount(null);
                    }}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="date-to" className="text-xs">Até</Label>
                  <Input
                    id="date-to"
                    type="date"
                    value={dateTo}
                    onChange={(e) => {
                      setDateTo(e.target.value);
                      setPreviewCount(null);
                    }}
                    className="mt-1"
                  />
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={handlePreviewCount}
                disabled={loadingPreview}
              >
                {loadingPreview ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                {previewCount !== null 
                  ? `${previewCount} registro(s) encontrado(s)`
                  : "Verificar quantidade"
                }
              </Button>
              {!dateFrom && !dateTo && (
                <p className="text-xs text-muted-foreground text-center">
                  Sem filtro: todos os registros serão excluídos
                </p>
              )}
            </div>

            {/* Aviso */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
              <div className="text-sm">
                <p className="font-semibold text-destructive">Ação irreversível!</p>
                <p className="text-muted-foreground">
                  Os dados serão permanentemente excluídos e não poderão ser recuperados.
                </p>
              </div>
            </div>

            {/* Confirmação */}
            <div>
              <Label htmlFor="confirm-delete" className="text-sm">
                Digite <strong className="text-destructive">APAGAR</strong> para confirmar:
              </Label>
              <Input
                id="confirm-delete"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="APAGAR"
                className="mt-2"
                autoComplete="off"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={!canConfirm || loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Confirmar Exclusão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
