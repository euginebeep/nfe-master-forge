import { motion } from 'framer-motion';
import { User, Quote, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { getDailyPhrase, getGreeting, roleDisplayNames } from '@/lib/motivational-phrases';

type AppRole = 'admin' | 'gerente' | 'supervisor' | 'operador' | 'visualizador';

interface UserWelcomeCardProps {
  name: string | null;
  role: AppRole | null;
  cargo: string | null;
  avatarUrl: string | null;
  isLoading?: boolean;
}

export function UserWelcomeCard({ name, role, cargo, avatarUrl, isLoading }: UserWelcomeCardProps) {
  const greeting = getGreeting();
  const phrase = getDailyPhrase(role);
  
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
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-primary/5 rounded-full translate-y-1/2 -translate-x-1/2" />
        
        <CardContent className="p-6 relative">
          <div className="flex items-start gap-4">
            <Avatar className="h-16 w-16 border-2 border-primary/20">
              <AvatarImage src={avatarUrl || undefined} alt={name || 'Usuário'} />
              <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
                {getInitials(name)}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-[32px] font-bold leading-tight truncate">
                  {greeting}, {name?.split(' ')[0] || 'Usuário'}!
                </h2>
                <Sparkles className="h-5 w-5 text-primary animate-pulse" />
              </div>
              
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {role && (
                  <Badge variant={getRoleBadgeVariant(role)} className="text-xs">
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
                className="mt-4 p-3 bg-background/50 rounded-lg border border-border/50"
              >
                <div className="flex items-start gap-2">
                  <Quote className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <p className="text-sm text-muted-foreground italic leading-relaxed">
                    "{phrase}"
                  </p>
                </div>
              </motion.div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
