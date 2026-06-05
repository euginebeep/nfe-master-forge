import { useSubscription, PLANS } from '@/hooks/use-subscription';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Lock, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useState } from 'react';

/**
 * Full-page blocker shown when trial expired and no active subscription.
 */
export function SubscriptionBlocker() {
  const { createCheckout } = useSubscription();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleQuickCheckout = async () => {
    try {
      setLoading(true);
      await createCheckout(PLANS.mensal.priceId);
    } catch {
      toast.error('Erro ao iniciar checkout');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-8 pb-6 text-center space-y-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <Lock className="h-8 w-8 text-destructive" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">Período de teste expirado</h2>
            <p className="text-muted-foreground">
              Seu trial de 14 dias terminou. Para continuar usando o BrainxERP,
              escolha um plano de assinatura.
            </p>
          </div>
          <div className="space-y-3">
            <Button className="w-full" onClick={() => navigate('/assinatura')}>
              <Zap className="h-4 w-4 mr-2" />
              Ver planos e assinar
            </Button>
            <Button variant="outline" className="w-full" onClick={handleQuickCheckout} disabled={loading}>
              Assinar Plano Mensal (R$ 97,30)
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
