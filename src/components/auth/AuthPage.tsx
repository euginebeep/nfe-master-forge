import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail, Lock, User, Loader2, ArrowRight,
  Shield, BarChart3, Package, Brain,
  Cpu, Activity, ShieldCheck, Globe
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

/* ─── Design tokens (inline, isolated from global theme) ─── */
const T = {
  bg:       '#0B0F14',
  bg2:      '#11161D',
  surface:  '#151C24',
  border:   '#1F2933',
  text:     '#E6EDF3',
  muted:    '#9BA3AF',
  neon:     '#00E58E',
  blue:     '#2F6BFF',
  error:    '#FF3B3B',
} as const;

/* ─── Left-panel bullets ─── */
const BULLETS = [
  { icon: Cpu,       label: 'Controle de Produção',    sub: 'Ordens, fórmulas e rastreabilidade industrial' },
  { icon: Package,   label: 'Gestão de Estoque',        sub: 'Lotes, FEFO automático e alertas críticos' },
  { icon: BarChart3, label: 'Dashboard Executivo',      sub: 'KPIs em tempo real e inteligência operacional' },
  { icon: Shield,    label: 'Conformidade ANVISA',      sub: 'Validações regulatórias e auditoria imutável' },
];

/* ─── Reusable styled input ─── */
function OSInput({
  id, type, placeholder, value, onChange, icon: Icon, required, minLength,
}: {
  id: string; type: string; placeholder: string; value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  icon: React.ElementType; required?: boolean; minLength?: number;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div className="relative">
      <Icon
        style={{ color: focused ? T.neon : T.muted }}
        className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 transition-colors duration-200"
      />
      <input
        id={id}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        required={required}
        minLength={minLength}
        style={{
          background: T.bg,
          border: `1px solid ${focused ? T.neon : T.border}`,
          color: T.text,
          boxShadow: focused ? `0 0 0 2px ${T.neon}18` : 'none',
          outline: 'none',
        }}
        className="w-full h-11 pl-10 pr-4 rounded-lg text-sm placeholder:text-[#9BA3AF] transition-all duration-200"
      />
    </div>
  );
}

/* ─── Label ─── */
function OSLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      style={{ color: T.muted, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}
    >
      {children}
    </label>
  );
}

export default function AuthPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const { signIn, signUp } = useAuth();

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    await signIn(loginEmail, loginPassword);
    setIsLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (registerPassword !== registerConfirmPassword) return;
    setIsLoading(true);
    await signUp(registerEmail, registerPassword, registerName);
    setIsLoading(false);
  };

  const passwordMismatch = !!registerConfirmPassword && registerPassword !== registerConfirmPassword;

  return (
    <div
      style={{ background: T.bg, minHeight: '100vh', display: 'flex', fontFamily: 'Inter, sans-serif' }}
    >
      {/* ══════════════════════════════════════════════════════
          LEFT PANEL — Tech / Brand
      ══════════════════════════════════════════════════════ */}
      <div
        style={{ background: T.bg2, borderRight: `1px solid ${T.border}` }}
        className="hidden lg:flex lg:w-[60%] relative overflow-hidden flex-col"
      >
        {/* Grid pattern */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(${T.border}55 1px, transparent 1px),
              linear-gradient(90deg, ${T.border}55 1px, transparent 1px)
            `,
            backgroundSize: '48px 48px',
            opacity: 0.6,
          }}
        />

        {/* Neon glow orb — top right */}
        <div
          className="absolute pointer-events-none"
          style={{
            top: '-80px', right: '-80px',
            width: 400, height: 400,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${T.neon}12 0%, transparent 70%)`,
          }}
        />
        {/* Blue glow orb — bottom left */}
        <div
          className="absolute pointer-events-none"
          style={{
            bottom: '-100px', left: '-100px',
            width: 500, height: 500,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${T.blue}10 0%, transparent 70%)`,
          }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col h-full p-12 xl:p-16">

          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-3"
          >
            <div
              style={{
                background: `linear-gradient(135deg, ${T.neon}, ${T.blue})`,
                borderRadius: 10,
                width: 40, height: 40,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 0 20px ${T.neon}30`,
              }}
            >
              <Brain style={{ color: '#fff', width: 20, height: 20 }} />
            </div>
            <div>
              <div style={{ color: T.text, fontWeight: 700, fontSize: 16, letterSpacing: '-0.01em' }}>
                BrainX
              </div>
              <div style={{ color: T.muted, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', marginTop: -2 }}>
                Industrial OS
              </div>
            </div>
          </motion.div>

          {/* Hero */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="mt-auto mb-10"
          >
            <div
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                border: `1px solid ${T.neon}30`,
                background: `${T.neon}0A`,
                borderRadius: 20, padding: '4px 12px',
                marginBottom: 20,
              }}
            >
              <Activity style={{ color: T.neon, width: 12, height: 12 }} />
              <span style={{ color: T.neon, fontSize: 11, fontWeight: 600, letterSpacing: '0.06em' }}>
                SISTEMA OPERACIONAL INDUSTRIAL
              </span>
            </div>

            <h1
              style={{
                color: T.text, fontWeight: 800, fontSize: 'clamp(28px, 3.5vw, 42px)',
                lineHeight: 1.1, letterSpacing: '-0.03em', marginBottom: 14,
              }}
            >
              Gestão industrial<br />
              <span style={{ color: T.neon }}>inteligente</span>{' '}
              <span style={{ color: T.blue }}>&</span> integrada.
            </h1>
            <p style={{ color: T.muted, fontSize: 14, lineHeight: 1.6, maxWidth: 400 }}>
              Controle total da produção farmacêutica com rastreabilidade,
              qualidade e conformidade regulatória.
            </p>
          </motion.div>

          {/* Bullets */}
          <div className="grid grid-cols-2 gap-3">
            {BULLETS.map((b, i) => (
              <motion.div
                key={b.label}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.3 + i * 0.08 }}
                style={{
                  background: `${T.surface}CC`,
                  border: `1px solid ${T.border}`,
                  borderRadius: 8,
                  padding: '14px 14px',
                  backdropFilter: 'blur(6px)',
                }}
                className="hover:border-[#2F6BFF44] transition-colors duration-300"
              >
                <b.icon style={{ color: T.neon, width: 15, height: 15, marginBottom: 8 }} />
                <div style={{ color: T.text, fontSize: 12, fontWeight: 600, marginBottom: 3 }}>{b.label}</div>
                <div style={{ color: T.muted, fontSize: 11, lineHeight: 1.45 }}>{b.sub}</div>
              </motion.div>
            ))}
          </div>

          {/* Footer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9 }}
            className="mt-8 flex items-center gap-4"
          >
            <span style={{ color: `${T.muted}60`, fontSize: 11 }}>© 2026 BrainX · ERP Industrial</span>
            <span style={{ flex: 1, height: 1, background: T.border }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: T.neon, boxShadow: `0 0 8px ${T.neon}` }} />
              <span style={{ color: T.neon, fontSize: 10, fontWeight: 600, letterSpacing: '0.1em' }}>ONLINE</span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          RIGHT PANEL — Auth Card
      ══════════════════════════════════════════════════════ */}
      <div
        style={{ background: T.bg, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
      >
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          style={{
            width: '100%', maxWidth: 400,
            background: T.surface,
            border: `1px solid ${T.border}`,
            borderRadius: 10,
            padding: '32px 28px',
          }}
        >
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div
              style={{
                background: `linear-gradient(135deg, ${T.neon}, ${T.blue})`,
                borderRadius: 8, width: 36, height: 36,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 0 16px ${T.neon}25`,
              }}
            >
              <Brain style={{ color: '#fff', width: 18, height: 18 }} />
            </div>
            <div>
              <div style={{ color: T.text, fontWeight: 700, fontSize: 15 }}>BrainX Industrial OS</div>
              <div style={{ color: T.muted, fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase' }}>Sistema de Gestão</div>
            </div>
          </div>

          {/* Header */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <h2 style={{ color: T.text, fontWeight: 700, fontSize: 20, letterSpacing: '-0.02em' }}>
                {activeTab === 'login' ? 'Acesso ao Sistema' : 'Criar Conta'}
              </h2>
              {/* Secure badge */}
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  border: `1px solid ${T.neon}25`,
                  background: `${T.neon}08`,
                  borderRadius: 20, padding: '3px 8px',
                }}
              >
                <ShieldCheck style={{ color: T.neon, width: 10, height: 10 }} />
                <span style={{ color: T.neon, fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  Encrypted
                </span>
              </div>
            </div>
            <p style={{ color: T.muted, fontSize: 12 }}>
              {activeTab === 'login'
                ? 'Autentique-se para acessar o painel industrial'
                : 'Preencha os dados para se cadastrar'}
            </p>
          </div>

          {/* Tab switcher */}
          <div
            style={{
              display: 'flex', gap: 2,
              background: T.bg,
              border: `1px solid ${T.border}`,
              borderRadius: 8, padding: 3,
              marginBottom: 24,
            }}
          >
            {(['login', 'register'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  flex: 1, padding: '7px 0',
                  borderRadius: 6, border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 600,
                  letterSpacing: '0.04em',
                  transition: 'all 0.2s',
                  background: activeTab === tab
                    ? `linear-gradient(135deg, ${T.neon}15, ${T.blue}15)`
                    : 'transparent',
                  color: activeTab === tab ? T.text : T.muted,
                  boxShadow: activeTab === tab ? `inset 0 0 0 1px ${T.border}` : 'none',
                }}
              >
                {tab === 'login' ? 'ENTRAR' : 'CADASTRAR'}
              </button>
            ))}
          </div>

          {/* Forms */}
          <AnimatePresence mode="wait">
            {activeTab === 'login' ? (
              <motion.form
                key="login"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.18 }}
                onSubmit={handleLogin}
                style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <OSLabel htmlFor="login-email">E-mail</OSLabel>
                  <OSInput id="login-email" type="email" placeholder="usuario@empresa.com" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} icon={Mail} required />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <OSLabel htmlFor="login-password">Senha</OSLabel>
                  <OSInput id="login-password" type="password" placeholder="••••••••" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} icon={Lock} required />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  style={{
                    marginTop: 4,
                    width: '100%', height: 44,
                    borderRadius: 8, border: 'none', cursor: isLoading ? 'not-allowed' : 'pointer',
                    background: `linear-gradient(135deg, ${T.neon}, ${T.blue})`,
                    color: '#fff', fontWeight: 700, fontSize: 13,
                    letterSpacing: '0.06em', textTransform: 'uppercase',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    opacity: isLoading ? 0.7 : 1,
                    boxShadow: `0 0 18px ${T.neon}22`,
                    transition: 'opacity 0.2s, box-shadow 0.2s',
                  }}
                  onMouseEnter={e => { if (!isLoading) e.currentTarget.style.boxShadow = `0 0 28px ${T.neon}38`; }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = `0 0 18px ${T.neon}22`; }}
                >
                  {isLoading ? (
                    <><Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} /> Autenticando...</>
                  ) : (
                    <><ArrowRight style={{ width: 15, height: 15 }} /> Acessar Sistema</>
                  )}
                </button>
              </motion.form>
            ) : (
              <motion.form
                key="register"
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.18 }}
                onSubmit={handleRegister}
                style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <OSLabel htmlFor="register-name">Nome Completo</OSLabel>
                  <OSInput id="register-name" type="text" placeholder="Seu nome completo" value={registerName} onChange={e => setRegisterName(e.target.value)} icon={User} required />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <OSLabel htmlFor="register-email">E-mail</OSLabel>
                  <OSInput id="register-email" type="email" placeholder="usuario@empresa.com" value={registerEmail} onChange={e => setRegisterEmail(e.target.value)} icon={Mail} required />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <OSLabel htmlFor="register-password">Senha</OSLabel>
                    <OSInput id="register-password" type="password" placeholder="••••••" value={registerPassword} onChange={e => setRegisterPassword(e.target.value)} icon={Lock} required minLength={6} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <OSLabel htmlFor="register-confirm">Confirmar</OSLabel>
                    <OSInput id="register-confirm" type="password" placeholder="••••••" value={registerConfirmPassword} onChange={e => setRegisterConfirmPassword(e.target.value)} icon={Lock} required minLength={6} />
                  </div>
                </div>
                {passwordMismatch && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: T.error, fontSize: 11 }}>
                    <span>⚠</span> As senhas não coincidem
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading || passwordMismatch}
                  style={{
                    marginTop: 4,
                    width: '100%', height: 44,
                    borderRadius: 8, border: 'none',
                    cursor: (isLoading || passwordMismatch) ? 'not-allowed' : 'pointer',
                    background: `linear-gradient(135deg, ${T.neon}, ${T.blue})`,
                    color: '#fff', fontWeight: 700, fontSize: 13,
                    letterSpacing: '0.06em', textTransform: 'uppercase',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    opacity: (isLoading || passwordMismatch) ? 0.5 : 1,
                    boxShadow: `0 0 18px ${T.neon}22`,
                    transition: 'opacity 0.2s',
                  }}
                >
                  {isLoading ? (
                    <><Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} /> Cadastrando...</>
                  ) : (
                    <><ArrowRight style={{ width: 15, height: 15 }} /> Criar Conta</>
                  )}
                </button>
              </motion.form>
            )}
          </AnimatePresence>

          {/* Footer badges */}
          <div style={{ marginTop: 24, paddingTop: 18, borderTop: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <ShieldCheck style={{ color: T.muted, width: 11, height: 11 }} />
              <span style={{ color: `${T.muted}80`, fontSize: 10, letterSpacing: '0.06em' }}>Sessão criptografada</span>
            </div>
            <span style={{ width: 1, height: 12, background: T.border }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Globe style={{ color: T.muted, width: 11, height: 11 }} />
              <span style={{ color: `${T.muted}80`, fontSize: 10, letterSpacing: '0.06em' }}>Acesso seguro</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Loader keyframes */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
