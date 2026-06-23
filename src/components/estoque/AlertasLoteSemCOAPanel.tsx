import React from "react";
import { Bell, TriangleAlert, CheckCheck, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useAlertasLoteSemCOA } from "@/hooks/use-alertas-lote-sem-coa";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function AlertasLoteSemCOAPanel() {
  const navigate = useNavigate();
  const { alertas, naoLidos, carregando, marcarLido, marcarTodosLidos } =
    useAlertasLoteSemCOA();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="relative h-8 w-8 p-0">
          <Bell className="h-4 w-4" />
          {naoLidos > 0 && (
            <Badge
              className="absolute -top-1.5 -right-1.5 h-4 min-w-4 px-1 text-[10px] bg-amber-500 hover:bg-amber-500 border-0"
            >
              {naoLidos > 9 ? "9+" : naoLidos}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-96 p-0" align="end">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <TriangleAlert className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-semibold">Lotes liberados sem COA</span>
            {naoLidos > 0 && (
              <Badge variant="outline" className="text-amber-600 border-amber-300 text-xs">
                {naoLidos} novo{naoLidos > 1 ? "s" : ""}
              </Badge>
            )}
          </div>
          {naoLidos > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground"
              onClick={marcarTodosLidos}
            >
              <CheckCheck className="h-3 w-3 mr-1" />
              Marcar todos lidos
            </Button>
          )}
        </div>

        {/* Lista de alertas */}
        <ScrollArea className="max-h-80">
          {carregando ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              Carregando alertas...
            </div>
          ) : alertas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <CheckCheck className="h-8 w-8 text-green-400" />
              <p className="text-sm text-muted-foreground">Nenhuma liberação sem COA nos últimos 30 dias</p>
            </div>
          ) : (
            <div className="divide-y">
              {alertas.map((alerta) => (
                <div
                  key={alerta.id}
                  className={`px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors ${
                    !alerta.lido ? "bg-amber-50/60" : ""
                  }`}
                  onClick={() => {
                    marcarLido(alerta.id);
                    navigate(`/estoque/lotes/${alerta.lote_id}`);
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                      {!alerta.lido && (
                        <span className="mt-1.5 h-2 w-2 rounded-full bg-amber-500 flex-shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-amber-900 truncate">
                          {alerta.numero_lote || "Lote"} — {alerta.insumo_nome || "Insumo"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Por: {alerta.usuario_nome}
                          {alerta.coa_presente ? " • COA não validado" : " • Sem COA"}
                        </p>
                        <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                          {alerta.justificativa}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {alerta.created_at
                            ? format(new Date(alerta.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                            : "—"}
                        </p>
                      </div>
                    </div>
                    <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0 mt-1" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Rodapé */}
        {alertas.length > 0 && (
          <>
            <Separator />
            <div className="px-4 py-2 flex justify-between items-center">
              <p className="text-xs text-muted-foreground italic">
                Últimos 30 dias • {alertas.length} registro{alertas.length > 1 ? "s" : ""}
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => navigate("/estoque/dashboard-sem-coa")}
              >
                Ver dashboard →
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
