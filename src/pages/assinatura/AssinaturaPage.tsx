import { useSubscription, PLANS } from '@/hooks/use-subscription';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Crown, RefreshCw, Settings, Zap, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

export default function AssinaturaPage() {
  const {
    subscribed, isInTrial, trialDaysRemaining, planName,
    subscriptionEnd, isLoading, createCheckout, openCustomerPortal,
    checkSubscription,
  } = useSubscription();

  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      toast.success('Assinatura realizada com sucesso! Atualizando status...');
      setTimeout(() => checkSubscription(), 3000);
    }
    if (searchParams.get('canceled') === 'true') {
      toast.info('Checkout cancelado.');
    }
  }, [searchParams, checkSubscription]);

  const handleCheckout = async (priceId: string, planKey: string) => {
    try {
      setLoadingPlan(planKey);
      await createCheckout(priceId);
    } catch (err) {
      toast.error('Erro ao iniciar checkout');
    } finally {
      setLoadingPlan(null);
    }
  };

  const handleManage = async () => {
    try {
      await openCustomerPortal();
    } catch (err) {
      toast.error('Erro ao abrir portal de gerenciamento');
    }
  };

  const plans = [
    { key: 'mensal', ...PLANS.mensal, popular: false },
    { key: 'semestral', ...PLANS.semestral, popular: true },
    { key: 'anual', ...PLANS.anual, popular: false },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container max-w-5xl py-8 space-y-8">
      {/* Status Banner */}
      {subscribed && (
        <Card className="border-primary bg-primary/5">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <Crown className="h-6 w-6 text-primary" />
              <div>
                <p className="font-semibold">Plano {planName} ativo</p>
                <p className="text-sm text-muted-foreground">
                  Válido até {subscriptionEnd ? new Date(subscriptionEnd).toLocaleDateString('pt-BR') : '—'}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleManage}>
              <Settings className="h-4 w-4 mr-2" />
              Gerenciar Assinatura
            </Button>
          </CardContent>
        </Card>
      )}

      {isInTrial && !subscribed && (
        <Card className="border-yellow-500 bg-yellow-500/5">
          <CardContent className="flex items-center gap-3 py-4">
            <Zap className="h-6 w-6 text-yellow-600" />
            <div>
              <p className="font-semibold text-yellow-700">Período de teste gratuito</p>
              <p className="text-sm text-muted-foreground">
                Restam <strong>{trialDaysRemaining} dias</strong> de trial. Escolha um plano para continuar usando após o período de teste.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Planos BrainX ERP</h1>
        <p className="text-muted-foreground max-w-lg mx-auto">
          Acesso completo a todos os módulos do ERP Industrial. Escolha o plano que melhor se encaixa.
        </p>
      </div>

      {/* Plans Grid */}
      <div className="grid md:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const isCurrentPlan = subscribed && planName === plan.name;
          return (
            <Card
              key={plan.key}
              className={`relative flex flex-col ${plan.popular ? 'border-primary shadow-lg scale-[1.02]' : ''} ${isCurrentPlan ? 'ring-2 ring-primary' : ''}`}
            >
              {plan.popular && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground">
                  Mais popular
                </Badge>
              )}
              {isCurrentPlan && (
                <Badge className="absolute -top-3 right-4 bg-green-600 text-white">
                  Seu plano
                </Badge>
              )}
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <CardDescription>{plan.interval}</CardDescription>
              </CardHeader>
              <CardContent className="text-center flex-1 space-y-4">
                <div>
                  <span className="text-4xl font-bold">
                    R$ {plan.priceMonthly.toFixed(2).replace('.', ',')}
                  </span>
                  <span className="text-muted-foreground">/mês</span>
                </div>
                <p className="text-sm text-muted-foreground">{plan.description}</p>
                <ul className="text-sm space-y-2 text-left">
                  {[
                    'Todos os módulos inclusos',
                    'Cadastros ilimitados',
                    'Produção e formulador',
                    'Controle de estoque e lotes',
                    'NF-e e fiscal',
                    'Suporte por email',
                  ].map((feat) => (
                    <li key={feat} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-600 shrink-0" />
                      {feat}
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                {isCurrentPlan ? (
                  <Button className="w-full" variant="outline" onClick={handleManage}>
                    Gerenciar
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    variant={plan.popular ? 'default' : 'outline'}
                    onClick={() => handleCheckout(plan.priceId, plan.key)}
                    disabled={!!loadingPlan}
                  >
                    {loadingPlan === plan.key ? (
                      <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    {subscribed ? 'Trocar plano' : 'Assinar agora'}
                  </Button>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {/* Security */}
      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Shield className="h-4 w-4" />
        Pagamento seguro via Stripe. Cancele quando quiser.
      </div>

      {/* Refresh */}
      <div className="flex justify-center">
        <Button variant="ghost" size="sm" onClick={checkSubscription}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar status da assinatura
        </Button>
      </div>
    </div>
  );
}
