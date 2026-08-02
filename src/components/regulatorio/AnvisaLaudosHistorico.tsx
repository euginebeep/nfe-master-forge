import React from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, Loader2, Calendar, User, Ban } from 'lucide-react';
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const AnvisaLaudosHistorico: React.FC<{ onSelect: (laudo: any) => void }> = ({ onSelect }) => {
  const queryClient = useQueryClient();
  const { data: laudos, isLoading } = useQuery({
    queryKey: ['anvisa_laudos'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('anvisa_laudos')
        .select('*')
        .order('criado_em', { ascending: false });

      if (error) throw error;
      return data;
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('anvisa_laudos')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['anvisa_laudos'] });
      toast.success("Registro removido");
    },
    onError: (error: any) => {
      toast.error(error?.message || "Laudos emitidos são imutáveis e não podem ser apagados.");
    }
  });

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-muted/30 p-4 rounded-2xl border border-dashed border-muted-foreground/20">
        <div>
          <h3 className="font-bold text-lg">Histórico de Análises</h3>
          <p className="text-sm text-muted-foreground">
            {laudos?.length || 0} documento(s) · parecer da fórmula e validade do papel são badges separados
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

      {laudos?.map((laudo) => {
        const sv = String((laudo as any).status_validacao || "PRELIMINAR").toUpperCase();
        const invalidado = sv === "INVALIDADO";
        return (
        <Card
          key={laudo.id}
          className={cn(
            "group hover:border-primary/50 transition-all duration-300 shadow-sm hover:shadow-md",
            invalidado && "border-destructive/40",
          )}
        >
          <CardHeader className="pb-3">
            <div className="flex justify-between items-start mb-2 gap-2">
              <div className="flex flex-wrap gap-1">
                <Badge className={
                  laudo.status_geral === 'APROVADO' ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                  laudo.status_geral === 'BLOQUEADO' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                  'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                }>
                  {laudo.status_geral || "—"}
                </Badge>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px]",
                    sv === "VALIDADO_RT" && "border-green-600 text-green-700",
                    sv === "INVALIDADO" && "border-destructive text-destructive",
                    sv === "PRELIMINAR" && "border-amber-500 text-amber-700",
                  )}
                >
                  {sv}
                </Badge>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onSelect(laudo)}>
                  <Eye className="w-4 h-4" />
                </Button>
                {!invalidado && sv !== "VALIDADO_RT" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hover:text-destructive transition-colors"
                    title="Tentativa de exclusão — laudos emitidos são imutáveis no banco"
                    onClick={() => {
                      if (confirm("Tentar excluir este registro? Documentos emitidos são imutáveis.")) {
                        deleteMutation.mutate(laudo.id);
                      }
                    }}
                    disabled={deleteMutation.isPending}
                  >
                    <Ban className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
            <CardTitle className="text-lg line-clamp-2 leading-tight">
              {invalidado || sv !== "VALIDADO_RT"
                ? `Parecer — ${laudo.produto}`
                : laudo.produto}
            </CardTitle>
            {(laudo as any).protocolo && (
              <p className="text-xs font-mono text-muted-foreground mt-1">{(laudo as any).protocolo}</p>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {invalidado && (laudo as any).invalidado_motivo && (
              <p className="text-xs text-destructive line-clamp-3">{(laudo as any).invalidado_motivo}</p>
            )}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="w-3.5 h-3.5" />
              <span className="truncate">{laudo.cliente || 'Cliente não informado'}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="w-3.5 h-3.5" />
              <span>{format(new Date(laudo.criado_em || Date.now()), 'dd/MM/yyyy HH:mm')}</span>
            </div>
            <Button
              className="w-full mt-4 bg-muted hover:bg-primary hover:text-white transition-colors text-xs font-bold uppercase tracking-wider"
              variant="secondary"
              onClick={() => onSelect(laudo)}
            >
              Ver documento
            </Button>
          </CardContent>
        </Card>
        );
      })}
      {laudos?.length === 0 && (
        <div className="col-span-full text-center py-20 bg-muted/5 rounded-3xl border-2 border-dashed">
          <p className="text-muted-foreground">Nenhum documento gerado ainda.</p>
        </div>
      )}
      </div>
    </div>
  );
};
