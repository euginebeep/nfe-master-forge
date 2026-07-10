import { forwardRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface StatCardProps {
  label: string;
  value: number | string;
  icon: React.ElementType;
  variant?: 'default' | 'success' | 'warning' | 'danger';
  suffix?: string;
  className?: string;
}

export const StatCard = forwardRef<HTMLDivElement, StatCardProps>(
  ({ label, value, icon: Icon, variant = 'default', suffix, className }, ref) => {
    return (
      <Card ref={ref} className={className}>
        <CardContent className="flex items-center gap-4 py-4">
          <div
            className={cn(
              'p-2.5 rounded-lg',
              variant === 'success' && 'bg-green-500/10 text-green-600',
              variant === 'warning' && 'bg-yellow-500/10 text-yellow-600',
              variant === 'danger' && 'bg-destructive/10 text-destructive',
              variant === 'default' && 'bg-primary/10 text-primary',
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
            <p className="text-xl font-bold mt-0.5">
              {typeof value === 'number' ? value.toLocaleString('pt-BR') : value}
              {suffix && (
                <span className="text-sm font-normal text-muted-foreground ml-1">{suffix}</span>
              )}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  },
);
StatCard.displayName = 'StatCard';
