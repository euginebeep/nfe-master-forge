import React from 'react';
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, Printer, Loader2, Calendar, User } from 'lucide-react';
import { format } from "date-fns";

export const AnvisaLaudosHistorico: React.FC<{ onSelect: (laudo: any) => void }> = ({ onSelect }) => {
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

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {laudos?.map((laudo) => (
        <Card key={laudo.id} className="group hover:border-primary/50 transition-all duration-300 shadow-sm hover:shadow-md">
          <CardHeader className="pb-3">
            <div className="flex justify-between items-start mb-2">
              <Badge className={
                laudo.status_geral === 'APROVADO' ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                laudo.status_geral === 'BLOQUEADO' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
              }>
                {laudo.status_geral}
              </Badge>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onSelect(laudo)}>
                  <Eye className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => window.print()}>
                  <Printer className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <CardTitle className="text-lg line-clamp-2 leading-tight">
              {laudo.produto}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="w-3.5 h-3.5" />
              <span className="truncate">{laudo.cliente || 'Cliente não informado'}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="w-3.5 h-3.5" />
              <span>{format(new Date(laudo.criado_em), 'dd/MM/yyyy HH:mm')}</span>
            </div>
            <Button 
              className="w-full mt-4 bg-muted hover:bg-primary hover:text-white transition-colors text-xs font-bold uppercase tracking-wider"
              variant="secondary"
              onClick={() => onSelect(laudo)}
            >
              Ver Laudo Completo
            </Button>
          </CardContent>
        </Card>
      ))}
      {laudos?.length === 0 && (
        <div className="col-span-full text-center py-20 bg-muted/5 rounded-3xl border-2 border-dashed">
          <p className="text-muted-foreground">Nenhum laudo gerado ainda.</p>
        </div>
      )}
    </div>
  );
};
