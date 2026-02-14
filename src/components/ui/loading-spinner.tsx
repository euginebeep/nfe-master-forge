import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  className?: string;
  text?: string;
  fullPage?: boolean;
}

export function LoadingSpinner({ className, text = 'Carregando...', fullPage }: LoadingSpinnerProps) {
  const content = (
    <div className={cn("flex flex-col items-center justify-center gap-3", className)}>
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );

  if (fullPage) {
    return <div className="min-h-screen flex items-center justify-center">{content}</div>;
  }

  return content;
}
