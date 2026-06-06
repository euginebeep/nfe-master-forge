import React from 'react';
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, Printer, Loader2 } from 'lucide-react';
import { format } from "date-fns";

export const AnvisaLaudosHistorico: React.FC<{ onSelect: (laudo: any) => void }> = ({ onSelect }) => {
  const { data: laudos, isLoading } = useQuery({
    queryKey: ['anvisa_laudos'],
    queryFn: async () => {
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
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Produto</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Data</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {laudos?.map((laudo) => (
            <TableRow key={laudo.id}>
              <TableCell className="font-medium">{laudo.produto}</TableCell>
              <TableCell>{laudo.cliente || '-'}</TableCell>
              <TableCell>
                <Badge className={
                  laudo.status_geral === 'APROVADO' ? 'bg-green-950/30 text-green-400' :
                  laudo.status_geral === 'BLOQUEADO' ? 'bg-red-950/30 text-red-400' :
                  'bg-yellow-950/30 text-yellow-400'
                }>
                  {laudo.status_geral}
                </Badge>
              </TableCell>
              <TableCell>{format(new Date(laudo.criado_em), 'dd/MM/yyyy HH:mm')}</TableCell>
              <TableCell className="text-right space-x-2">
                <Button variant="ghost" size="sm" onClick={() => onSelect(laudo)}><Eye className="w-4 h-4 mr-1" /> Ver</Button>
                <Button variant="ghost" size="sm" onClick={() => window.print()}><Printer className="w-4 h-4 mr-1" /> Reimprimir</Button>
              </TableCell>
            </TableRow>
          ))}
          {laudos?.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center p-8 text-muted-foreground">Nenhum laudo encontrado.</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};
