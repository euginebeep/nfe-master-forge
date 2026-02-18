import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Cake, PartyPopper, Gift } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { format, isToday, differenceInDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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
          // Aniversário deste ano
          const aniversarioEsteAno = new Date(
            hojeAno,
            nascimento.getMonth(),
            nascimento.getDate()
          );
          // Se já passou, pegar o próximo ano
          let aniversario = aniversarioEsteAno;
          if (aniversarioEsteAno < hoje && !isToday(aniversarioEsteAno)) {
            aniversario = new Date(hojeAno + 1, nascimento.getMonth(), nascimento.getDate());
          }

          const diasAte = differenceInDays(aniversario, hoje);

          // Mostrar os próximos 30 dias
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

        // Ordenar por mais próximo
        aniversariantesProximos.sort((a, b) => a.diasAte - b.diasAte);
        setAniversariantes(aniversariantesProximos);
      } catch (err) {
        console.error('Erro ao buscar aniversariantes:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchAniversariantes();
  }, []);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  if (isLoading || aniversariantes.length === 0) return null;

  const hoje = aniversariantes.filter((a) => a.diasAte === 0);
  const proximos = aniversariantes.filter((a) => a.diasAte > 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <Card className="border-pink-200/50 bg-gradient-to-br from-pink-50/50 to-purple-50/30 dark:from-pink-950/20 dark:to-purple-950/10">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="p-1.5 rounded-lg bg-pink-100 dark:bg-pink-900/30">
              <Cake className="h-4 w-4 text-pink-600 dark:text-pink-400" />
            </div>
            <span>Aniversariantes</span>
            {hoje.length > 0 && (
              <Badge className="bg-pink-500 text-white text-[10px] px-1.5 py-0.5 animate-pulse">
                <PartyPopper className="h-3 w-3 mr-1" />
                Hoje!
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {/* Hoje */}
          {hoje.map((a) => (
            <motion.div
              key={a.id}
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              className="flex items-center gap-3 p-2.5 rounded-lg bg-pink-100/80 dark:bg-pink-900/30 border border-pink-200 dark:border-pink-800"
            >
              <div className="relative">
                <Avatar className="h-10 w-10 border-2 border-pink-400">
                  <AvatarImage src={a.avatar_url || undefined} />
                  <AvatarFallback className="bg-pink-200 text-pink-700 text-xs font-bold">
                    {getInitials(a.nome_completo)}
                  </AvatarFallback>
                </Avatar>
                <span className="absolute -top-1 -right-1 text-base">🎂</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-pink-900 dark:text-pink-200 truncate">
                  {a.nome_completo}
                </p>
                {a.cargo && (
                  <p className="text-xs text-pink-600 dark:text-pink-400 truncate">
                    {a.cargo}
                  </p>
                )}
              </div>
              <div className="text-center shrink-0">
                <p className="text-xs font-bold text-pink-600 dark:text-pink-300">Hoje!</p>
                <Gift className="h-4 w-4 text-pink-500 mx-auto mt-0.5" />
              </div>
            </motion.div>
          ))}

          {/* Próximos */}
          {proximos.slice(0, 4).map((a, idx) => (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-pink-50 dark:hover:bg-pink-950/20 transition-colors"
            >
              <Avatar className="h-8 w-8 border border-border">
                <AvatarImage src={a.avatar_url || undefined} />
                <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                  {getInitials(a.nome_completo)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{a.nome_completo}</p>
                {a.cargo && (
                  <p className="text-xs text-muted-foreground truncate">{a.cargo}</p>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs font-semibold text-muted-foreground">
                  em {a.diasAte}d
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {format(
                    new Date(
                      new Date().getFullYear(),
                      parseISO(a.data_nascimento).getMonth(),
                      parseISO(a.data_nascimento).getDate()
                    ),
                    'dd/MM',
                    { locale: ptBR }
                  )}
                </p>
              </div>
            </motion.div>
          ))}
        </CardContent>
      </Card>
    </motion.div>
  );
}
