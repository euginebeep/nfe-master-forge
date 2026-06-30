import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Megaphone, ExternalLink, X, AlertCircle, Info, Flame, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

interface Comunicado {
  id: string;
  titulo: string;
  conteudo: string;
  tipo: 'INFO' | 'AVISO' | 'MANUTENCAO' | 'URGENTE';
  link_acao: string | null;
  label_acao: string | null;
  alvo_tipo_empresa: string | null;
}

export function AvisosPopup() {
  const { profile, user } = useAuth();
  const queryClient = useQueryClient();
  const [currentAvisoIndex, setCurrentAvisoIndex] = useState(0);
  const [open, setOpen] = useState(false);

  const { data: avisos, isLoading } = useQuery({
    queryKey: ['my-avisos', profile?.company_id, user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      // 1. Pegar IDs de avisos já lidos
      const { data: lidos } = await supabase
        .from('saas_comunicados_lidos')
        .select('comunicado_id')
        .eq('user_id', user.id);
      
      const lidosIds = lidos?.map(l => l.comunicado_id) || [];

      // 2. Buscar dados da empresa do usuário (para tipo_empresa)
      const { data: companyData } = await supabase
        .from('companies')
        .select('tipo_empresa')
        .eq('id', profile?.company_id)
        .maybeSingle();

      const userTipoEmpresa = companyData?.tipo_empresa;

      // 3. Buscar avisos ativos que não foram lidos
      let query = supabase
        .from('saas_comunicados')
        .select('*')
        .eq('ativo', true)
        .or(`expira_em.is.null,expira_em.gt.${new Date().toISOString()}`);

      if (lidosIds.length > 0) {
        query = query.not('id', 'in', `(${lidosIds.join(',')})`);
      }

      const { data, error } = await query;
      if (error) throw error;

      // 4. Filtrar no cliente por tenant ou tipo
      const filtered = (data as Comunicado[]).filter(a => {
        // Se houver alvo_tipo_empresa, verificamos se bate com o tipo da empresa do usuário
        if (a.alvo_tipo_empresa) {
          return a.alvo_tipo_empresa === userTipoEmpresa;
        }
        return true;
      });

      return filtered;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5, // 5 minutos
  });

  useEffect(() => {
    if (avisos && avisos.length > 0) {
      setOpen(true);
    }
  }, [avisos]);

  const markAsReadMutation = useMutation({
    mutationFn: async (comunicadoId: string) => {
      if (!user?.id) return;
      await supabase.from('saas_comunicados_lidos').insert({
        user_id: user.id,
        comunicado_id: comunicadoId
      });
    },
    onSuccess: () => {
      if (avisos && currentAvisoIndex < avisos.length - 1) {
        setCurrentAvisoIndex(prev => prev + 1);
      } else {
        setOpen(false);
        queryClient.invalidateQueries({ queryKey: ['my-avisos'] });
      }
    }
  });

  if (isLoading || !avisos || avisos.length === 0) return null;

  const currentAviso = avisos[currentAvisoIndex];

  const getTipoStyles = (tipo: string) => {
    switch (tipo) {
      case 'URGENTE': return { 
        icon: <Flame className="h-6 w-6 text-destructive" />, 
        bg: "bg-destructive/10", 
        border: "border-destructive/20",
        title: "text-destructive"
      };
      case 'MANUTENCAO': return { 
        icon: <Settings className="h-6 w-6 text-orange-600" />, 
        bg: "bg-orange-50", 
        border: "border-orange-200",
        title: "text-orange-700"
      };
      case 'AVISO': return { 
        icon: <AlertCircle className="h-6 w-6 text-yellow-600" />, 
        bg: "bg-yellow-50", 
        border: "border-yellow-200",
        title: "text-yellow-700"
      };
      default: return { 
        icon: <Info className="h-6 w-6 text-blue-600" />, 
        bg: "bg-blue-50", 
        border: "border-blue-200",
        title: "text-blue-700"
      };
    }
  };

  const styles = getTipoStyles(currentAviso.tipo);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) markAsReadMutation.mutate(currentAviso.id);
    }}>
      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none shadow-2xl">
        <div className={cn("p-6 flex items-start gap-4", styles.bg, "border-b", styles.border)}>
          <div className="p-3 rounded-2xl bg-white shadow-sm">
            {styles.icon}
          </div>
          <div className="flex-1 pr-6">
            <h3 className={cn("text-xl font-black leading-tight", styles.title)}>{currentAviso.titulo}</h3>
            <p className="text-xs font-bold uppercase tracking-widest opacity-60 mt-0.5">Comunicado BrainX</p>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="absolute right-2 top-2 h-8 w-8 opacity-50 hover:opacity-100" 
            onClick={() => markAsReadMutation.mutate(currentAviso.id)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="p-8 space-y-6">
          <div className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
            {currentAviso.conteudo}
          </div>

          <div className="flex flex-col gap-3 pt-2">
            {currentAviso.link_acao && (
              <Button 
                className="w-full h-11 font-bold gap-2 shadow-lg" 
                onClick={() => {
                  if (currentAviso.link_acao?.startsWith('http')) {
                    window.open(currentAviso.link_acao, '_blank');
                  } else {
                    window.location.href = currentAviso.link_acao || '#';
                  }
                  markAsReadMutation.mutate(currentAviso.id);
                }}
              >
                {currentAviso.label_acao || "Ver mais detalhes"}
                <ExternalLink className="h-4 w-4" />
              </Button>
            )}
            <Button 
              variant="outline" 
              className="w-full h-11 font-bold text-muted-foreground border-dashed" 
              onClick={() => markAsReadMutation.mutate(currentAviso.id)}
              disabled={markAsReadMutation.isPending}
            >
              Entendido, fechar
            </Button>
          </div>

          {avisos.length > 1 && (
            <div className="flex justify-center gap-1.5">
              {avisos.map((_, i) => (
                <div key={i} className={cn("h-1.5 rounded-full transition-all", i === currentAvisoIndex ? "w-6 bg-primary" : "w-1.5 bg-muted")} />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
