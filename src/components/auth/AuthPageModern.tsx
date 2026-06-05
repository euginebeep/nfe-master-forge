import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Navigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Factory,
  Layers3,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  User,
  UserPlus,
  FileText,
  Thermometer,
  FlaskConical,
  Boxes,
  Receipt,
  ClipboardCheck,
  Beaker,
  Activity,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import brainxLogo from '@/assets/brainx-logo.png';
import { DemoLoginCard } from '@/components/demo/DemoLoginCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const brandLogo = `${brainxLogo}?v=brainx-current-2026-06-05`;

const valueCards = [
  {
    icon: Factory,
    title: 'Produção rastreável',
    description: 'Ordens, lotes e etapas críticas em um fluxo industrial único.',
  },
  {
    icon: ShieldCheck,
    title: 'Qualidade e BPF',
    description: 'Controles técnicos para suplementos, auditoria e liberação segura.',
  },
  {
    icon: Layers3,
    title: 'Estoque por lote',
    description: 'FEFO, quarentena, COA e consumo com rastreabilidade total.',
  },
  {
    icon: Receipt,
    title: 'Emissão de NF-e / NFC-e',
    description: 'Emissor fiscal integrado com cálculo automático de impostos e DANFE.',
  },
  {
    icon: Thermometer,
    title: 'Controle de temperatura',
    description: 'Monitoramento por sensores IoT com alertas e histórico para BPF.',
  },
  {
    icon: FlaskConical,
    title: 'Formulador industrial',
    description: 'Cápsulas, líquidos e pós com potência por lote e travas de segurança.',
  },
  {
    icon: ClipboardCheck,
    title: 'Ordens de Produção',
    description: 'OP com 13 fases, assinatura digital do RT e dossiê de lote completo.',
  },
  {
    icon: Beaker,
    title: 'Controle de Qualidade',
    description: 'Físico-químico, CAPA, calibrações e liberação técnica de lotes.',
  },
  {
    icon: FileText,
    title: 'Importação de NF-e',
    description: 'XML automatiza entidades, SKUs, lotes, contas a pagar e fiscal.',
  },
  {
    icon: Boxes,
    title: 'Multi-empresa & RBAC',
    description: 'Isolamento por tenant, permissões granulares e auditoria imutável.',
  },
  {
    icon: Activity,
    title: 'Financeiro & Indicadores',
    description: 'Contas a pagar/receber, KPIs de estoque e dashboards em tempo real.',
  },
];

type AuthFieldProps = {
  id: string;
  label: string;
  type: string;
  placeholder: string;
  value: string;
  icon: typeof Mail;
  required?: boolean;
  minLength?: number;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
};

function AuthField({ id, label, type, placeholder, value, icon: Icon, required, minLength, onChange }: AuthFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-foreground">
        {label}
      </Label>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          type={type}
          placeholder={placeholder}
          value={value}
          required={required}
          minLength={minLength}
          onChange={onChange}
          className="h-11 pl-10"
        />
      </div>
    </div>
  );
}

export default function AuthPageModern() {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [repeatedSignup, setRepeatedSignup] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);
  const { signIn, signUp, isAuthenticated, isLoading: authLoading } = useAuth();

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPass, setRegPass] = useState('');
  const [regConfirm, setRegConfirm] = useState('');
  const mismatch = !!regConfirm && regPass !== regConfirm;

  if (isAuthenticated && !authLoading) {
    return <Navigate to="/" replace />;
  }

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    await signIn(loginEmail, loginPass);
    setLoading(false);
  };

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    if (mismatch) return;
    setLoading(true);
    setRepeatedSignup(false);
    const result = await signUp(regEmail, regPass, regName);
    if ((result as any)?.repeated) {
      setRepeatedSignup(true);
    } else {
      setSignupSuccess(true);
    }
    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-background text-foreground lg:grid lg:grid-cols-[minmax(0,0.95fr)_minmax(460px,0.7fr)]">
      <section className="relative hidden min-h-screen overflow-hidden bg-primary text-primary-foreground lg:flex">
        <div className="absolute inset-0 bg-[linear-gradient(hsl(var(--primary-foreground)/0.06)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--primary-foreground)/0.06)_1px,transparent_1px)] bg-[size:48px_48px]" />
        <div className="relative z-10 flex w-full flex-col justify-between px-14 py-12">
          <div className="flex items-center gap-4">
            <img src={brandLogo} alt="BrainX ERP" className="h-[125px] w-[125px] object-contain" />
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary-foreground/70">BrainX ERP</p>
              <p className="text-xs text-primary-foreground/50">Plataforma industrial regulatória</p>
            </div>
          </div>

          <div className="max-w-2xl py-16">
            <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
              <h1 className="max-w-2xl text-4xl font-semibold leading-tight md:text-5xl">
                Controle Industrial na Fabricação de Suplementos Alimentares e Produtos Alimentícios!
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-primary-foreground/70">
                Controle produção, estoque, qualidade e conformidade com rastreabilidade de ponta a ponta.
              </p>
            </motion.div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {valueCards.map((item, index) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.05 + index * 0.04 }}
                  className="rounded-lg border border-primary-foreground/20 bg-primary-foreground/10 p-4"
                >
                  <Icon className="mb-3 h-5 w-5 text-secondary" />
                  <h2 className="text-sm font-semibold">{item.title}</h2>
                  <p className="mt-1.5 text-xs leading-5 text-primary-foreground/60">{item.description}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-8 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-4 lg:hidden">
            <img src={brandLogo} alt="BrainX ERP" className="h-[73px] w-[73px] object-contain" />
            <div>
              <p className="text-lg font-bold">BrainX ERP</p>
              <p className="text-sm text-muted-foreground">Plataforma industrial regulatória</p>
            </div>
          </div>

          {signupSuccess ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="rounded-lg border bg-card p-8 text-center shadow-sm"
            >
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-secondary/10 text-secondary">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <h2 className="text-2xl font-semibold">Confirme seu e-mail</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Enviamos o link de ativação para <span className="font-semibold text-foreground">{regEmail}</span>.
              </p>
              <Button className="mt-6 w-full" onClick={() => { setSignupSuccess(false); setTab('login'); }}>
                Ir para acesso
                <ArrowRight className="h-4 w-4" />
              </Button>
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
              <div className="mb-6">
                <p className="text-sm font-medium text-muted-foreground">Acesso seguro</p>
                <h2 className="mt-2 text-3xl font-semibold">Acesse o BrainX ERP</h2>
                <p className="mt-2 text-sm text-muted-foreground">Entre com sua conta ou crie um cadastro para começar.</p>
              </div>

              <div className="rounded-lg border bg-card p-6 shadow-sm">
                <div className="mb-6 grid grid-cols-2 gap-2 rounded-lg bg-muted p-1">
                  <button
                    type="button"
                    onClick={() => setTab('login')}
                    className={cn(
                      'flex h-10 items-center justify-center gap-2 rounded-md text-sm font-semibold transition-colors',
                      tab === 'login' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <Lock className="h-4 w-4" />
                    Entrar
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab('register')}
                    className={cn(
                      'flex h-10 items-center justify-center gap-2 rounded-md text-sm font-semibold transition-colors',
                      tab === 'register' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <UserPlus className="h-4 w-4" />
                    Cadastrar
                  </button>
                </div>

                <AnimatePresence mode="wait">
                  {tab === 'login' ? (
                    <motion.form
                      key="login"
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 8 }}
                      transition={{ duration: 0.16 }}
                      onSubmit={handleLogin}
                      className="space-y-4"
                    >
                      <AuthField id="login-email" label="E-mail" type="email" placeholder="seu@email.com" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} icon={Mail} required />
                      <AuthField id="login-pass" label="Senha" type="password" placeholder="Sua senha" value={loginPass} onChange={(e) => setLoginPass(e.target.value)} icon={Lock} required />
                      <Button type="submit" disabled={loading} className="h-11 w-full font-semibold">
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                        Entrar no sistema
                      </Button>
                    </motion.form>
                  ) : (
                    <motion.form
                      key="register"
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -8 }}
                      transition={{ duration: 0.16 }}
                      onSubmit={handleRegister}
                      className="space-y-4"
                    >
                      <AuthField id="reg-name" label="Nome completo" type="text" placeholder="Seu nome" value={regName} onChange={(e) => setRegName(e.target.value)} icon={User} required />
                      <AuthField id="reg-email" label="E-mail" type="email" placeholder="seu@email.com" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} icon={Mail} required />
                      <AuthField id="reg-pass" label="Senha" type="password" placeholder="Mínimo de 6 caracteres" value={regPass} onChange={(e) => setRegPass(e.target.value)} icon={Lock} required minLength={6} />
                      <AuthField id="reg-confirm" label="Confirmar senha" type="password" placeholder="Repita a senha" value={regConfirm} onChange={(e) => setRegConfirm(e.target.value)} icon={Lock} required minLength={6} />

                      {mismatch && (
                        <div className="flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                          <AlertTriangle className="h-4 w-4" />
                          As senhas não coincidem.
                        </div>
                      )}

                      {repeatedSignup && (
                        <div className="rounded-md border border-warning/30 bg-warning/10 p-3 text-sm leading-6 text-warning-foreground">
                          <div className="mb-1 flex items-center gap-2 font-semibold">
                            <AlertTriangle className="h-4 w-4" />
                            E-mail já cadastrado
                          </div>
                          <p className="text-muted-foreground">Verifique sua caixa de entrada ou use a aba de entrada para acessar sua conta.</p>
                        </div>
                      )}

                      <Button type="submit" disabled={loading || mismatch} className="h-11 w-full font-semibold">
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                        Criar cadastro
                      </Button>
                    </motion.form>
                  )}
                </AnimatePresence>
              </div>

              <DemoLoginCard />

              <p className="mt-5 text-center text-xs leading-6 text-muted-foreground">
                Ao continuar, você concorda com os{' '}
                <a href="/termos-de-uso" target="_blank" className="font-medium text-primary hover:underline" rel="noreferrer">
                  Termos de Uso
                </a>{' '}
                e{' '}
                <a href="/politica-de-privacidade" target="_blank" className="font-medium text-primary hover:underline" rel="noreferrer">
                  Política de Privacidade
                </a>
                .
              </p>
            </motion.div>
          )}
        </div>
      </section>
    </main>
  );
}