import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { X, ExternalLink, Info, Megaphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { extractInvokeError, invokeEdge } from "@/lib/edge-invoke";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

interface ParceirosBrainXProps {
  posicao?: 'DASHBOARD_LATERAL' | 'DASHBOARD_INFERIOR' | 'ANVISA_CHECKER' | 'PRODUCAO' | 'FORNECEDORES' | 'GLOBAL';
  className?: string;
}

export function ParceirosBrainX({ posicao = 'DASHBOARD_LATERAL', className }: ParceirosBrainXProps) {
  const { profile } = useAuth();
  const [campanha, setCampanha] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [fechado, setFechado] = useState(false);

  useEffect(() => {
    const fetchCampanha = async () => {
      // Verificar localStorage se foi fechado nas últimas 24h
      const fechadoAt = localStorage.getItem(`brainx_parceiro_fechado_${posicao}`);
      if (fechadoAt) {
        const diff = Date.now() - parseInt(fechadoAt);
        if (diff < 24 * 60 * 60 * 1000) {
          setFechado(true);
          setLoading(false);
          return;
        }
      }

      try {
        const companyId = profile?.company_id;
        // GET + headers customizados — extractInvokeError em vez de invokeEdge
        const response = await supabase.functions.invoke('brainx-parceiros', {
          method: 'GET',
          headers: {
            'x-company-id': companyId || '',
            'x-posicao': posicao
          }
        });

        const detail = await extractInvokeError(response);
        if (detail) throw new Error(detail);
        if (response.data?.campanha) {
          setCampanha(response.data.campanha);
        }
      } catch (err) {
        console.error("Erro ao buscar parceiro:", err);
      } finally {
        setLoading(false);
      }
    };

    if (profile?.company_id !== undefined) {
      fetchCampanha();
    }
  }, [profile?.company_id, posicao]);

  const handleClique = async () => {
    if (!campanha) return;
    
    try {
      const { error } = await invokeEdge('brainx-parceiros', {
        action: 'registrar-clique',
        campanha_id: campanha.id,
        company_id: profile?.company_id || '',
      });
      if (error) console.error("Erro ao registrar clique:", error);
    } catch (err) {
      console.error("Erro ao registrar clique:", err);
    }

    window.open(campanha.criativo.url_destino, '_blank');
  };

  const handleFechar = () => {
    setFechado(true);
    localStorage.setItem(`brainx_parceiro_fechado_${posicao}`, Date.now().toString());
  };

  if (fechado || (!loading && !campanha)) return null;

  if (loading) {
    return (
      <Card className={cn("overflow-hidden border-dashed animate-pulse", className)}>
        <CardHeader className="p-3 pb-0">
          <Skeleton className="h-4 w-24" />
        </CardHeader>
        <CardContent className="p-3">
          <Skeleton className="aspect-video w-full rounded-md mb-2" />
          <Skeleton className="h-3 w-full mb-1" />
          <Skeleton className="h-3 w-2/3" />
        </CardContent>
      </Card>
    );
  }

  const { criativo, parceiro } = campanha;

  return (
    <Card className={cn("overflow-hidden border-primary/20 hover:border-primary/40 transition-all shadow-sm group", className)}>
      <CardHeader className="p-3 pb-2 flex flex-row items-center justify-between space-y-0 bg-muted/30">
        <div className="flex items-center gap-1.5">
          <Megaphone className="h-3 w-3 text-primary" />
          <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
            Ecossistema BrainX 
            <Info className="h-2.5 w-2.5 opacity-40 cursor-help" />
          </CardTitle>
        </div>
        <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={handleFechar}>
          <X className="h-3 w-3" />
        </Button>
      </CardHeader>
      <CardContent className="p-3 pt-2">
        <div className="cursor-pointer" onClick={handleClique}>
          {criativo.tipo === 'IMAGEM' || criativo.tipo === 'GIF' ? (
            <div className="relative aspect-video rounded-md overflow-hidden mb-2 border bg-muted group-hover:shadow-md transition-all">
               <img 
                src={criativo.arquivo_url} 
                alt={criativo.titulo}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors flex items-center justify-center">
                 <ExternalLink className="text-white opacity-0 group-hover:opacity-100 h-5 w-5 drop-shadow-md" />
              </div>
            </div>
          ) : (
            <video 
              src={criativo.arquivo_url} 
              autoPlay 
              muted 
              loop 
              className="w-full aspect-video rounded-md mb-2 object-cover border"
            />
          )}
          
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs font-bold leading-tight group-hover:text-primary transition-colors line-clamp-2">
                {criativo.titulo}
              </h4>
              <Badge variant="outline" className="text-[8px] h-3 px-1 py-0 border-primary/30 text-primary uppercase font-bold bg-primary/5">
                {parceiro.segmento.replace('_', ' ')}
              </Badge>
            </div>
            <p className="text-[10px] text-muted-foreground leading-snug">
              Oferecido por <span className="font-semibold text-foreground/80">{parceiro.nome}</span>
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
