import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Cake } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { format, isToday, differenceInDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Aniversariante {
  id: string;
  nome_completo: string;
  cargo: string | null;
  avatar_url: string | null;
  data_nascimento: string;
  diasAte: number;
}

export function BirthdayCard({ compact = false, className }: { compact?: boolean; className?: string }) {
  const [aniversariantes, setAniversariantes] = useState<Aniversariante[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchAniversariantes() {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, nome_completo, cargo, avatar_url, data_nascimento')
          .not('data_nascimento', 'is', null);

        if (error) throw error;

        const hoje = new Date();
        const hojeAno = hoje.getFullYear();
        const aniversariantesProximos: Aniversariante[] = [];

        (data || []).forEach((p) => {
          if (!p.data_nascimento) return;
          const nascimento = parseISO(p.data_nascimento);
          let aniversario = new Date(hojeAno, nascimento.getMonth(), nascimento.getDate());
          if (aniversario < hoje && !isToday(aniversario)) {
            aniversario = new Date(hojeAno + 1, nascimento.getMonth(), nascimento.getDate());
          }

          const diasAte = differenceInDays(aniversario, hoje);
          if (diasAte >= 0 && diasAte <= 30) {
            aniversariantesProximos.push({
              id: p.id,
              nome_completo: p.nome_completo,
              cargo: p.cargo,
              avatar_url: p.avatar_url,
              data_nascimento: p.data_nascimento,
              diasAte,
            });
          }
        });

        aniversariantesProximos.sort((a, b) => a.diasAte - b.diasAte);
        setAniversariantes(aniversariantesProximos);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('Erro ao buscar aniversariantes:', msg);
      } finally {
        setIsLoading(false);
      }
    }

    fetchAniversariantes();
  }, []);

  const getInitials = (name: string) =>
    name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();

  if (isLoading) return null;
  if (aniversariantes.length === 0 && !compact) return null;

  const hoje = aniversariantes.filter((a) => a.diasAte === 0);
  const proximos = aniversariantes.filter((a) => a.diasAte > 0);
  const destaque = hoje[0] || aniversariantes[0];
  const lista = hoje.length > 0 ? [...hoje, ...proximos] : proximos;

  if (!destaque) {
    return (
      <Card className={cn("h-auto border-pink-200/60 bg-gradient-to-br from-pink-50/80 to-purple-50/30", className)}>
        <CardContent className="px-3 py-2 flex items-center gap-2">
          <Cake className="h-3.5 w-3.5 text-pink-500 shrink-0" />
          <p className="text-[10px] text-muted-foreground">Nenhum aniversário nos próximos 30 dias</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 }}
      className={cn("h-full min-h-0", className)}
    >
      <Card className="h-full overflow-hidden border-pink-200/60 bg-gradient-to-br from-pink-50/80 via-rose-50/40 to-purple-50/30 dark:from-pink-950/25 dark:via-rose-950/15 dark:to-purple-950/10 dark:border-pink-800/30 shadow-sm flex flex-col">
        <CardHeader className={cn("shrink-0", compact ? "pb-1 pt-2 px-2.5" : "pb-2 pt-3 px-4")}>
          <div className="flex items-center gap-2">
            <div className="relative shrink-0">
              <div
                className={cn(
                  'absolute inset-0 rounded-xl blur-md',
                  hoje.length > 0 ? 'bg-pink-500/40 animate-pulse' : 'bg-pink-400/25',
                )}
              />
              <div className={cn(
                "relative flex items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 shadow-lg shadow-pink-500/35 ring-2 ring-white/60 dark:ring-pink-900/50",
                compact ? "h-8 w-8" : "h-11 w-11",
              )}>
                <Cake className={cn("text-white drop-shadow-sm", compact ? "h-4 w-4" : "h-5 w-5")} />
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <CardTitle className={cn("font-bold leading-tight", compact ? "text-xs" : "text-sm")}>
                Aniversariantes
              </CardTitle>
              <p className="text-[9px] text-muted-foreground mt-0.5">Próximos 30 dias</p>
            </div>

            {hoje.length > 0 && (
              <Badge className="bg-pink-500 text-white text-[8px] px-1 py-0 shrink-0">
                Hoje!
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className={cn("flex-1 min-h-0", compact ? "px-2.5 pb-2 space-y-1" : "px-4 pb-3 space-y-2")}>
          <div
            className={cn(
              'flex items-center gap-2 rounded-xl border min-w-0',
              compact ? 'p-1.5' : 'p-2.5 gap-3',
              destaque.diasAte === 0
                ? 'bg-pink-100/90 dark:bg-pink-900/35 border-pink-300/70 dark:border-pink-700'
                : 'bg-white/60 dark:bg-pink-950/20 border-pink-200/50 dark:border-pink-800/40',
            )}
          >
            <Avatar
              className={cn(
                'ring-2 ring-offset-1 ring-offset-background shrink-0',
                compact ? 'h-8 w-8' : 'h-12 w-12',
                destaque.diasAte === 0 ? 'ring-pink-400' : 'ring-pink-200 dark:ring-pink-700',
              )}
            >
              {destaque.avatar_url ? (
                <AvatarImage src={destaque.avatar_url} alt={destaque.nome_completo} className="object-cover" />
              ) : null}
              <AvatarFallback className={cn(
                "bg-gradient-to-br from-pink-200 to-rose-300 text-pink-800 font-bold",
                compact ? "text-[9px]" : "text-sm",
              )}>
                {getInitials(destaque.nome_completo)}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <p className={cn("font-semibold truncate", compact ? "text-[11px]" : "text-sm")}>
                {destaque.nome_completo}
              </p>
              {destaque.cargo && (
                <p className={cn("text-muted-foreground truncate", compact ? "text-[9px]" : "text-[11px]")}>
                  {destaque.cargo}
                </p>
              )}
            </div>

            <div className="text-right shrink-0">
              {destaque.diasAte === 0 ? (
                <p className="text-[9px] font-bold text-pink-600 dark:text-pink-300">Hoje!</p>
              ) : (
                <>
                  <p className={cn("font-bold text-pink-600 dark:text-pink-300", compact ? "text-[10px]" : "text-xs")}>
                    em {destaque.diasAte}d
                  </p>
                  <p className="text-[9px] text-muted-foreground">
                    {format(
                      new Date(
                        new Date().getFullYear(),
                        parseISO(destaque.data_nascimento).getMonth(),
                        parseISO(destaque.data_nascimento).getDate(),
                      ),
                      'dd/MM',
                      { locale: ptBR },
                    )}
                  </p>
                </>
              )}
            </div>
          </div>

          {!compact && lista.slice(1, 3).map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-pink-50/80 dark:hover:bg-pink-950/20 transition-colors"
            >
              <Avatar className="h-8 w-8 border border-pink-200/60 dark:border-pink-800/50 shrink-0">
                {a.avatar_url ? (
                  <AvatarImage src={a.avatar_url} alt={a.nome_completo} className="object-cover" />
                ) : null}
                <AvatarFallback className="bg-muted text-muted-foreground text-[10px] font-semibold">
                  {getInitials(a.nome_completo)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{a.nome_completo}</p>
                {a.cargo && <p className="text-[10px] text-muted-foreground truncate">{a.cargo}</p>}
              </div>
              <p className="text-[10px] font-semibold text-muted-foreground shrink-0">
                {a.diasAte === 0 ? 'Hoje' : `${a.diasAte}d`}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </motion.div>
  );
}
