import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

/* ─── Custom SVG Icons ─── */
const IconBrainX = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5.5C9.2 5.5 6.5 7.5 6.5 10.5c0 1.8.9 3.3 2.2 4.2-.2.7-.3 1.3-.3 1.8 0 1.1.6 1.7 1.4 1.8"/>
    <path d="M12 5.5c2.8 0 5.5 2 5.5 5 0 1.8-.9 3.3-2.2 4.2.2.7.3 1.3.3 1.8 0 1.1-.6 1.7-1.4 1.8"/>
    <line x1="12" y1="5.5" x2="12" y2="18.3"/>
    <circle cx="9" cy="9.5" r=".85" fill="#fff" stroke="none"/>
    <circle cx="15" cy="9.5" r=".85" fill="#fff" stroke="none"/>
    <circle cx="12" cy="13" r=".85" fill="#fff" fillOpacity=".9" stroke="none"/>
    <line x1="6.5" y1="10" x2="4.2" y2="8.5" strokeOpacity=".5" strokeWidth="1.1"/>
    <line x1="6.8" y1="12.5" x2="4.8" y2="13.5" strokeOpacity=".5" strokeWidth="1.1"/>
    <line x1="17.5" y1="10" x2="19.8" y2="8.5" strokeOpacity=".5" strokeWidth="1.1"/>
    <line x1="17.2" y1="12.5" x2="19.2" y2="13.5" strokeOpacity=".5" strokeWidth="1.1"/>
  </svg>
);

const IconEstoque = ({ size = 18, color = '#22c988' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round">
    <rect x="2" y="4" width="9" height="4.5" rx="1" fill={color} fillOpacity=".1"/>
    <rect x="13" y="4" width="9" height="4.5" rx="1" fill={color} fillOpacity=".1"/>
    <rect x="2" y="10.5" width="9" height="4.5" rx="1" fill={color} fillOpacity=".1"/>
    <rect x="13" y="10.5" width="9" height="4.5" rx="1" fill={color} fillOpacity=".1"/>
    <line x1="2" y1="18" x2="22" y2="18" strokeOpacity=".4"/>
    <circle cx="5.5" cy="6.25" r=".8" fill={color} stroke="none"/>
    <circle cx="16.5" cy="12.75" r=".8" fill={color} stroke="none"/>
  </svg>
);

const IconProducao = ({ size = 18, color = '#22c988' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round">
    <rect x="7.5" y="3" width="9" height="2.5" rx=".7" fill={color} fillOpacity=".15"/>
    <path d="M8.5 5.5v8.5c0 2 1.6 3 3.5 3s3.5-1 3.5-3V5.5"/>
    <line x1="12" y1="5.5" x2="12" y2="13.5" strokeOpacity=".5"/>
    <line x1="10" y1="8.5" x2="14" y2="8.5" strokeOpacity=".4"/>
    <line x1="10" y1="11" x2="14" y2="11" strokeOpacity=".4"/>
    <line x1="3" y1="4.75" x2="7.5" y2="4.75" strokeOpacity=".6"/>
    <line x1="16.5" y1="4.75" x2="21" y2="4.75" strokeOpacity=".6"/>
    <line x1="12" y1="17" x2="12" y2="20.5"/>
    <line x1="10" y1="20" x2="14" y2="20" strokeOpacity=".5"/>
  </svg>
);

const IconKPI = ({ size = 18, color = '#22c988' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round">
    <path d="M4 18A8.5 8.5 0 0 1 12 3a8.5 8.5 0 0 1 8 15" strokeOpacity=".2"/>
    <path d="M4 18A8.5 8.5 0 0 1 12 3a8.5 8.5 0 0 1 5.5 11.5" strokeWidth="1.6"/>
    <line x1="12" y1="12.5" x2="17" y2="8" strokeWidth="1.8"/>
    <circle cx="12" cy="12.5" r="1.6" fill={color} fillOpacity=".12" strokeWidth="1.2"/>
    <circle cx="12" cy="12.5" r=".65" fill={color} stroke="none"/>
    <line x1="6.5" y1="20" x2="6.5" y2="22" strokeWidth="2"/>
    <line x1="9.5" y1="19" x2="9.5" y2="22" strokeWidth="2"/>
    <line x1="12.5" y1="19.5" x2="12.5" y2="22" strokeWidth="2"/>
  </svg>
);

const IconAnvisa = ({ size = 18, color = '#22c988' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2.5L4.5 6.2v5.8c0 4.8 3.3 8.7 7.5 9.7 4.2-1 7.5-4.9 7.5-9.7V6.2L12 2.5z" fill={color} fillOpacity=".07"/>
    <polyline points="8.5,12.5 11,15 15.5,9.5" strokeWidth="1.8"/>
  </svg>
);

const IconMail = ({ size = 15, color = '#94a3b8' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="5" width="20" height="14" rx="2"/>
    <polyline points="2,5 12,13 22,5"/>
  </svg>
);

const IconLock = ({ size = 15, color = '#94a3b8' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="11" width="14" height="10" rx="2"/>
    <path d="M8 11V7a4 4 0 0 1 8 0v4"/>
  </svg>
);

const FEATURES = [
  { Icon: IconEstoque,  label: 'Gestão de Estoque',       sub: 'Controle de lotes, rastreabilidade e FEFO automático' },
  { Icon: IconProducao, label: 'Produção Industrial',      sub: 'Fórmulas, ordens de produção e controle de qualidade' },
  { Icon: IconKPI,      label: 'Dashboard Executivo',      sub: 'KPIs em tempo real, alertas e inteligência operacional' },
  { Icon: IconAnvisa,   label: 'Conformidade ANVISA',      sub: 'Validações regulatórias e auditoria imutável' },
];

/* ─── Input field ─── */
function Field({
  id, label, type, placeholder, value, onChange, Icon, required, minLength,
}: {
  id: string; label: string; type: string; placeholder: string; value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  Icon: ({ size, color }: { size?: number; color?: string }) => JSX.Element;
  required?: boolean; minLength?: number;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label htmlFor={id} style={{ color: '#374151', fontSize: 13.5, fontWeight: 500 }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
          <Icon size={15} color={focused ? '#1e3a5f' : '#94a3b8'} />
        </span>
        <input
          id={id} type={type} placeholder={placeholder}
          value={value} onChange={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          required={required} minLength={minLength}
          style={{
            width: '100%', height: 44,
            paddingLeft: 40, paddingRight: 14,
            background: '#fff',
            border: `1.5px solid ${focused ? '#1e3a5f' : '#e2e8f0'}`,
            borderRadius: 8, color: '#111827', fontSize: 14,
            outline: 'none', boxSizing: 'border-box',
            boxShadow: focused ? '0 0 0 3px rgba(30,58,95,0.08)' : 'none',
            transition: 'all 0.18s ease',
          }}
        />
      </div>
    </div>
  );
}

/* ══════════════════════════════════════
   PAGE
══════════════════════════════════════ */
export default function AuthPage() {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPass, setRegPass] = useState('');
  const [regConfirm, setRegConfirm] = useState('');
  const mismatch = !!regConfirm && regPass !== regConfirm;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await signIn(loginEmail, loginPass);
    setLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mismatch) return;
    setLoading(true);
    await signUp(regEmail, regPass, regName);
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      fontFamily: '"Inter", "Segoe UI", system-ui, sans-serif',
    }}>

      {/* ══ LEFT PANEL ══ */}
      <div className="hidden lg:flex flex-col" style={{
        width: '56%',
        background: 'linear-gradient(160deg, #0d1e2e 0%, #0a2818 100%)',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Grid overlay */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}/>

        {/* Green glow bottom-left */}
        <div style={{
          position: 'absolute', bottom: -80, left: -80,
          width: 480, height: 480, borderRadius: '50%', pointerEvents: 'none',
          background: 'radial-gradient(circle, rgba(34,201,136,0.12) 0%, transparent 65%)',
        }}/>

        {/* Content */}
        <div style={{
          position: 'relative', zIndex: 1,
          display: 'flex', flexDirection: 'column', height: '100%',
          padding: '48px 52px',
        }}>

          {/* Logo */}
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}
            style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: 'linear-gradient(140deg, #22c988 0%, #1a56c4 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <IconBrainX size={20} />
            </div>
            <div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 17, letterSpacing: '-0.02em', lineHeight: 1 }}>BrainX</div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', marginTop: 2 }}>
                ERP Industrial
              </div>
            </div>
          </motion.div>

          {/* Hero text */}
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.1 }}
            style={{ marginTop: 'auto', marginBottom: 44 }}>
            <h1 style={{
              color: '#fff', fontWeight: 800,
              fontSize: 'clamp(28px, 3vw, 44px)',
              lineHeight: 1.1, letterSpacing: '-0.035em', marginBottom: 16,
            }}>
              Gestão industrial<br />
              <span style={{ color: '#22c988' }}>inteligente</span>
              {' e'}<br />integrada.
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 15, lineHeight: 1.65, maxWidth: 400 }}>
              Controle total da produção farmacêutica com
              rastreabilidade, qualidade e conformidade regulatória.
            </p>
          </motion.div>

          {/* Feature cards 2×2 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 40 }}>
            {FEATURES.map((f, i) => (
              <motion.div key={f.label}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.22 + i * 0.06 }}
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 10, padding: '16px 14px',
                }}
              >
                <div style={{ marginBottom: 10 }}>
                  <f.Icon size={18} color="#22c988" />
                </div>
                <div style={{ color: '#fff', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                  {f.label}
                </div>
                <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11.5, lineHeight: 1.5 }}>
                  {f.sub}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Footer */}
          <div style={{ color: 'rgba(255,255,255,0.28)', fontSize: 11.5 }}>
            © 2026 BrainX · Plataforma ERP Industrial
          </div>
        </div>
      </div>

      {/* ══ RIGHT PANEL ══ */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '40px 32px',
        background: '#f8fafc',
      }}>

        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-3 mb-8">
          <div style={{
            width: 38, height: 38, borderRadius: 9,
            background: 'linear-gradient(140deg, #22c988, #1a56c4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <IconBrainX size={19} />
          </div>
          <div style={{ color: '#111827', fontWeight: 700, fontSize: 16 }}>BrainX Industrial</div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          style={{ width: '100%', maxWidth: 420 }}
        >
          {/* Heading */}
          <div style={{ marginBottom: 28 }}>
            <h2 style={{ color: '#111827', fontWeight: 700, fontSize: 24, letterSpacing: '-0.025em', margin: 0 }}>
              Bem-vindo de volta
            </h2>
            <p style={{ color: '#6b7280', fontSize: 14, marginTop: 6 }}>
              Acesse sua conta para continuar
            </p>
          </div>

          {/* Card */}
          <div style={{
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 14,
            padding: '28px 28px 24px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 8px 32px rgba(0,0,0,0.05)',
          }}>

            {/* Tab switcher */}
            <div style={{
              display: 'flex',
              background: '#f1f5f9',
              borderRadius: 8, padding: 3,
              marginBottom: 24,
            }}>
              {(['login', 'register'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)} style={{
                  flex: 1, padding: '8px 0', borderRadius: 6,
                  border: 'none', cursor: 'pointer',
                  fontSize: 13.5, fontWeight: 600,
                  transition: 'all 0.18s',
                  background: tab === t ? '#fff' : 'transparent',
                  color: tab === t ? '#111827' : '#6b7280',
                  boxShadow: tab === t ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                }}>
                  {t === 'login' ? 'Entrar' : 'Cadastrar'}
                </button>
              ))}
            </div>

            {/* Forms */}
            <AnimatePresence mode="wait">
              {tab === 'login' ? (
                <motion.form key="login"
                  initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 6 }} transition={{ duration: 0.15 }}
                  onSubmit={handleLogin}
                  style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
                >
                  <Field id="login-email" label="Email" type="email" placeholder="seu@email.com"
                    value={loginEmail} onChange={e => setLoginEmail(e.target.value)} Icon={IconMail} required />
                  <Field id="login-pass" label="Senha" type="password" placeholder="••••••••"
                    value={loginPass} onChange={e => setLoginPass(e.target.value)} Icon={IconLock} required />

                  <button type="submit" disabled={loading} style={{
                    width: '100%', height: 46, marginTop: 4,
                    background: loading ? '#1e3a5f99' : '#1e3a5f',
                    color: '#fff', fontWeight: 600, fontSize: 14.5,
                    border: 'none', borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    transition: 'background 0.2s',
                  }}>
                    {loading
                      ? <><Loader2 style={{ width: 16, height: 16, animation: 'spin 0.9s linear infinite' }} /> Entrando...</>
                      : <>Acessar plataforma <span style={{ fontSize: 16 }}>→</span></>
                    }
                  </button>
                </motion.form>
              ) : (
                <motion.form key="register"
                  initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -6 }} transition={{ duration: 0.15 }}
                  onSubmit={handleRegister}
                  style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
                >
                  <Field id="reg-name" label="Nome Completo" type="text" placeholder="Seu nome"
                    value={regName} onChange={e => setRegName(e.target.value)}
                    Icon={({ size, color }) => (
                      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round">
                        <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
                      </svg>
                    )}
                    required />
                  <Field id="reg-email" label="Email" type="email" placeholder="seu@email.com"
                    value={regEmail} onChange={e => setRegEmail(e.target.value)} Icon={IconMail} required />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <Field id="reg-pass" label="Senha" type="password" placeholder="Mín. 6 dígitos"
                      value={regPass} onChange={e => setRegPass(e.target.value)} Icon={IconLock} required minLength={6} />
                    <Field id="reg-confirm" label="Confirmar" type="password" placeholder="Repita"
                      value={regConfirm} onChange={e => setRegConfirm(e.target.value)} Icon={IconLock} required minLength={6} />
                  </div>
                  {mismatch && (
                    <div style={{
                      color: '#dc2626', fontSize: 12.5, padding: '8px 12px',
                      background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 7,
                    }}>
                      As senhas não coincidem
                    </div>
                  )}
                  <button type="submit" disabled={loading || mismatch} style={{
                    width: '100%', height: 46, marginTop: 4,
                    background: loading || mismatch ? '#1e3a5f66' : '#1e3a5f',
                    color: '#fff', fontWeight: 600, fontSize: 14.5,
                    border: 'none', borderRadius: 8, cursor: loading || mismatch ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    transition: 'background 0.2s',
                  }}>
                    {loading
                      ? <><Loader2 style={{ width: 16, height: 16, animation: 'spin 0.9s linear infinite' }} /> Cadastrando...</>
                      : <>Criar conta <span style={{ fontSize: 16 }}>→</span></>
                    }
                  </button>
                </motion.form>
              )}
            </AnimatePresence>
          </div>

          {/* Below card */}
          <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: 12.5, marginTop: 16, lineHeight: 1.6 }}>
            Ao continuar, você concorda com os{' '}
            <span style={{ color: '#374151', textDecoration: 'underline', cursor: 'pointer' }}>Termos de Uso</span>
            {' '}e{' '}
            <span style={{ color: '#374151', textDecoration: 'underline', cursor: 'pointer' }}>Política de Privacidade</span>.
          </p>
        </motion.div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
