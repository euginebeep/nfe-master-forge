import { motion } from 'framer-motion';
import { User, Quote, Sparkles, Heart } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { getDailyPhrase, getGreeting, roleDisplayNames } from '@/lib/motivational-phrases';
import { cn } from '@/lib/utils';

type AppRole = 'admin' | 'gerente' | 'supervisor' | 'operador' | 'visualizador';
type Sexo = 'MASCULINO' | 'FEMININO' | 'NAO_INFORMADO';

interface UserWelcomeCardProps {
  name: string | null;
  role: AppRole | null;
  cargo: string | null;
  avatarUrl: string | null;
  sexo?: Sexo | null;
  isLoading?: boolean;
}

export function UserWelcomeCard({ name, role, cargo, avatarUrl, sexo, isLoading }: UserWelcomeCardProps) {
  const isFeminine = sexo === 'FEMININO';
  const greeting = getGreeting(sexo);
  const phrase = getDailyPhrase(role, sexo);
  
  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const getRoleBadgeVariant = (role: AppRole | null) => {
    switch (role) {
      case 'admin': return 'default';
      case 'gerente': return 'secondary';
      case 'supervisor': return 'outline';
      default: return 'outline';
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-16 w-full" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card className={cn(
        "overflow-hidden relative",
        isFeminine
          ? "bg-gradient-to-br from-pink-50/80 to-rose-50/60 border-pink-200/60 dark:from-pink-950/30 dark:to-rose-950/20 dark:border-pink-800/40"
          : "bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20"
      )}>
        <div className={cn(
          "absolute top-0 right-0 w-32 h-32 rounded-full -translate-y-1/2 translate-x-1/2",
          isFeminine ? "bg-pink-200/20" : "bg-primary/5"
        )} />
        <div className={cn(
          "absolute bottom-0 left-0 w-24 h-24 rounded-full translate-y-1/2 -translate-x-1/2",
          isFeminine ? "bg-rose-200/20" : "bg-primary/5"
        )} />
        
        <CardContent className="p-6 relative">
          <div className="flex flex-col md:flex-row items-start gap-6">
            <div className="flex items-start gap-4 flex-1">
              <Avatar className={cn(
                "h-16 w-16 border-2",
                isFeminine ? "border-pink-300/60" : "border-primary/20"
              )}>
                <AvatarImage src={avatarUrl || undefined} alt={name || 'Usuário'} />
                <AvatarFallback className={cn(
                  "text-lg font-semibold",
                  isFeminine ? "bg-pink-100 text-pink-700 dark:bg-pink-900/50 dark:text-pink-300" : "bg-primary/10 text-primary"
                )}>
                  {getInitials(name)}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-[32px] font-bold leading-tight">
                    {greeting},{' '}
                    <span className={cn(
                      "truncate",
                      isFeminine ? "text-pink-600 dark:text-pink-400" : ""
                    )}>
                      {name?.split(' ')[0] || 'Usuário'}!
                    </span>
                  </h2>
                  {isFeminine ? (
                    <Heart className="h-5 w-5 text-pink-500 animate-pulse fill-pink-400" />
                  ) : (
                    <Sparkles className="h-5 w-5 text-primary animate-pulse" />
                  )}
                </div>
                
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {role && (
                    <Badge variant={getRoleBadgeVariant(role)} className={cn(
                      "text-xs",
                      isFeminine && "bg-pink-100 text-pink-700 border-pink-200 hover:bg-pink-100 dark:bg-pink-900/40 dark:text-pink-300"
                    )}>
                      {roleDisplayNames[role]}
                    </Badge>
                  )}
                  {cargo && (
                    <span className="text-sm text-muted-foreground">• {cargo}</span>
                  )}
                </div>
                
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className={cn(
                    "mt-4 p-3 rounded-lg border max-w-2xl",
                    isFeminine
                      ? "bg-pink-50/80 border-pink-200/50 dark:bg-pink-950/20 dark:border-pink-800/30"
                      : "bg-background/50 border-border/50"
                  )}
                >
                  <div className="flex items-start gap-2">
                    <Quote className={cn(
                      "h-4 w-4 shrink-0 mt-0.5",
                      isFeminine ? "text-pink-500" : "text-primary"
                    )} />
                    <p className="text-sm text-muted-foreground italic leading-relaxed">
                      "{phrase}"
                    </p>
                  </div>
                </motion.div>
              </div>
            </div>

            {/* Espaço para Propaganda / Avisos */}
            <div className="w-full md:w-[320px] shrink-0 self-stretch">
              <div className={cn(
                "h-full min-h-[100px] rounded-xl border-2 border-dashed flex flex-col items-center justify-center p-4 text-center transition-all hover:bg-primary/5 cursor-pointer",
                isFeminine ? "border-pink-200/50 bg-pink-50/30" : "border-primary/20 bg-primary/5"
              )}>
                <div className="flex flex-col items-center gap-2">
                  <div className={cn(
                    "p-2 rounded-full",
                    isFeminine ? "bg-pink-100 text-pink-600" : "bg-primary/10 text-primary"
                  )}>
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground/60">Novidades e Avisos</p>
                  <p className="text-[11px] text-muted-foreground leading-tight px-4">
                    Este espaço será utilizado para comunicados importantes e novos recursos da plataforma.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
