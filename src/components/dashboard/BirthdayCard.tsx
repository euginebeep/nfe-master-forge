import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Cake, PartyPopper, Gift } from 'lucide-react';
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

export function BirthdayCard() {
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

  if (isLoading || aniversariantes.length === 0) return null;

  const hoje = aniversariantes.filter((a) => a.diasAte === 0);
  const proximos = aniversariantes.filter((a) => a.diasAte > 0);
  const destaque = hoje[0] || aniversariantes[0];
  const lista = hoje.length > 0 ? [...hoje, ...proximos] : proximos;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 }}
      className="h-full"
    >
      <Card className="h-full overflow-hidden border-pink-200/60 bg-gradient-to-br from-pink-50/80 via-rose-50/40 to-purple-50/30 dark:from-pink-950/25 dark:via-rose-950/15 dark:to-purple-950/10 dark:border-pink-800/30 shadow-sm">
        <CardHeader className="pb-2 pt-3 px-4">
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <div
                className={cn(
                  'absolute inset-0 rounded-2xl blur-md',
                  hoje.length > 0 ? 'bg-pink-500/40 animate-pulse' : 'bg-pink-400/25',
                )}
              />
              <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 shadow-lg shadow-pink-500/35 ring-2 ring-white/60 dark:ring-pink-900/50">
                <Cake className="h-5 w-5 text-white drop-shadow-sm" />
              </div>
              {hoje.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-[10px] shadow-md ring-2 ring-white dark:ring-pink-950">
                  🎉
                </span>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <CardTitle className="text-sm font-bold leading-tight">Aniversariantes</CardTitle>
              <p className="text-[10px] text-muted-foreground mt-0.5">Próximos 30 dias</p>
            </div>

            {hoje.length > 0 && (
              <Badge className="bg-pink-500 text-white text-[9px] px-1.5 py-0.5 shrink-0 animate-pulse">
                <PartyPopper className="h-3 w-3 mr-0.5" />
                Hoje!
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="px-4 pb-3 space-y-2">
          {destaque && (
            <div
              className={cn(
                'flex items-center gap-3 p-2.5 rounded-xl border',
                destaque.diasAte === 0
                  ? 'bg-pink-100/90 dark:bg-pink-900/35 border-pink-300/70 dark:border-pink-700'
                  : 'bg-white/60 dark:bg-pink-950/20 border-pink-200/50 dark:border-pink-800/40',
              )}
            >
              <div className="relative shrink-0">
                <Avatar
                  className={cn(
                    'h-12 w-12 ring-2 ring-offset-1 ring-offset-background',
                    destaque.diasAte === 0 ? 'ring-pink-400' : 'ring-pink-200 dark:ring-pink-700',
                  )}
                >
                  {destaque.avatar_url ? (
                    <AvatarImage src={destaque.avatar_url} alt={destaque.nome_completo} className="object-cover" />
                  ) : null}
                  <AvatarFallback className="bg-gradient-to-br from-pink-200 to-rose-300 text-pink-800 text-sm font-bold">
                    {getInitials(destaque.nome_completo)}
                  </AvatarFallback>
                </Avatar>
                {destaque.diasAte === 0 && (
                  <span className="absolute -bottom-0.5 -right-0.5 text-sm leading-none">🎂</span>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{destaque.nome_completo}</p>
                {destaque.cargo && (
                  <p className="text-[11px] text-muted-foreground truncate">{destaque.cargo}</p>
                )}
              </div>

              <div className="text-right shrink-0">
                {destaque.diasAte === 0 ? (
                  <div className="flex flex-col items-center gap-0.5">
                    <p className="text-[10px] font-bold text-pink-600 dark:text-pink-300">Hoje!</p>
                    <Gift className="h-4 w-4 text-pink-500" />
                  </div>
                ) : (
                  <>
                    <p className="text-xs font-bold text-pink-600 dark:text-pink-300">em {destaque.diasAte}d</p>
                    <p className="text-[10px] text-muted-foreground">
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
          )}

          {lista.slice(1, 3).map((a, idx) => (
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
