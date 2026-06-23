import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigationHistory } from '@/hooks/use-navigation-history';

interface BackButtonProps {
  label?: string;
  className?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export function BackButton({
  label = 'Voltar',
  className = '',
  variant = 'outline',
  size = 'sm',
}: BackButtonProps) {
  const { goBack, canGoBack } = useNavigationHistory();

  if (!canGoBack) {
    return null;
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={goBack}
      className={`gap-2 ${className}`}
      title="Voltar para a página anterior"
    >
      <ArrowLeft className="h-4 w-4" />
      {label}
    </Button>
  );
}
