import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import brainxLogo from '@/assets/brainx-logo.png';
import { DemoLoginCard } from '@/components/demo/DemoLoginCard';

/* Load Bootstrap Icons CSS */
const BI_CSS = 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css';

function useBootstrapIcons() {
  useEffect(() => {
    if (document.querySelector(`link[href="${BI_CSS}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = BI_CSS;
    document.head.appendChild(link);
  }, []);
}

/* ─── Bootstrap Icon component ─── */
function BI({ name, size = 16, color, className = '' }: { name: string; size?: number; color?: string; className?: string }) {
  return <i className={`bi bi-${name} ${className}`} style={{ fontSize: size, color, lineHeight: 1 }} />;
}

const FEATURES = [
  { icon: 'box-seam-fill',    label: 'Gestão de Estoque',    sub: 'Controle de lotes, rastreabilidade e FEFO automático' },
  { icon: 'gear-wide-connected', label: 'Produção Industrial', sub: 'Fórmulas, ordens de produção e controle de qualidade' },
  { icon: 'speedometer2',     label: 'Dashboard Executivo',   sub: 'KPIs em tempo real, alertas e inteligência operacional' },
  { icon: 'shield-fill-check', label: 'Conformidade ANVISA',  sub: 'Validações regulatórias e auditoria imutável' },
];

/* ─── Input Field (Bootstrap style) ─── */
function Field({
  id, label, type, placeholder, value, onChange, icon, required, minLength,
}: {
  id: string; label: string; type: string; placeholder: string; value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  icon: string; required?: boolean; minLength?: number;
}) {
  return (
    <div className="mb-3">
      <label htmlFor={id} className="form-label" style={{ fontSize: 14, fontWeight: 500, color: '#212529', marginBottom: 6, display: 'block' }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', zIndex: 2 }}>
          <BI name={icon} size={16} color="#6c757d" />
        </span>
        <input
          id={id} type={type} placeholder={placeholder}
          value={value} onChange={onChange}
          required={required} minLength={minLength}
          className="form-control"
          style={{
            width: '100%', height: 44,
            paddingLeft: 40, paddingRight: 14,
            background: '#fff',
            border: '1px solid #dee2e6',
            borderRadius: 6, color: '#212529', fontSize: 14,
            outline: 'none', boxSizing: 'border-box',
            transition: 'border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out',
          }}
          onFocus={e => {
            e.target.style.borderColor = '#0d6efd';
            e.target.style.boxShadow = '0 0 0 0.25rem rgba(13,110,253,0.25)';
          }}
          onBlur={e => {
            e.target.style.borderColor = '#dee2e6';
            e.target.style.boxShadow = 'none';
          }}
        />
      </div>
    </div>
  );
}

/* ══════════════════════════════════════
   AUTH PAGE — Bootstrap Theme
══════════════════════════════════════ */
export default function AuthPage() {
  useBootstrapIcons();

  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [repeatedSignup, setRepeatedSignup] = useState(false);
  const { signIn, signUp, isAuthenticated, isLoading: authLoading } = useAuth();

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPass, setRegPass] = useState('');
  const [regConfirm, setRegConfirm] = useState('');
  const [signupSuccess, setSignupSuccess] = useState(false);
  const mismatch = !!regConfirm && regPass !== regConfirm;

  // Redirect authenticated users to dashboard
  if (isAuthenticated && !authLoading) {
    return <Navigate to="/" replace />;
  }

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
    <div style={{ minHeight: '100vh', display: 'flex', fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}>

      {/* ══ LEFT PANEL — Bootstrap Dark ══ */}
      <div className="hidden lg:flex flex-col" style={{
        width: '56%',
        background: 'linear-gradient(160deg, #212529 0%, #0d1b2a 100%)',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Subtle grid */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '52px 52px',
        }} />

        {/* Blue glow */}
        <div style={{
          position: 'absolute', bottom: -100, left: -100,
          width: 500, height: 500, borderRadius: '50%', pointerEvents: 'none',
          background: 'radial-gradient(circle, rgba(13,110,253,0.15) 0%, transparent 60%)',
        }} />

        {/* Content */}
        <div style={{
          position: 'relative', zIndex: 1,
          display: 'flex', flexDirection: 'column', height: '100%',
          padding: '48px 52px',
        }}>

          {/* Logo */}
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}
            style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src={brainxLogo} alt="BrainX" style={{ width: 160, height: 160, objectFit: 'contain' }} />
          </motion.div>

          {/* Hero text */}
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.1 }}
            style={{ marginTop: 'auto', marginBottom: 44 }}>
            <h1 style={{
              color: '#fff', fontWeight: 700,
              fontSize: 'clamp(28px, 3vw, 42px)',
              lineHeight: 1.15, letterSpacing: '-0.03em', marginBottom: 16,
            }}>
              Gestão industrial{' '}
              <span style={{ color: '#0d6efd' }}>inteligente</span>
              {' e integrada.'}
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 15, lineHeight: 1.65, maxWidth: 420 }}>
              Controle total da produção com
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
                  borderRadius: 8, padding: '16px 14px',
                }}
              >
                <div style={{ marginBottom: 10, width: 32, height: 32, borderRadius: 6, background: 'rgba(13,110,253,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <BI name={f.icon} size={16} color="#0d6efd" />
                </div>
                <div style={{ color: '#fff', fontSize: 13.5, fontWeight: 600, marginBottom: 4 }}>
                  {f.label}
                </div>
                <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, lineHeight: 1.5 }}>
                  {f.sub}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Footer badges */}
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', color: 'rgba(255,255,255,0.35)', fontSize: 11.5 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <BI name="shield-lock-fill" size={13} /> SSL/TLS
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <BI name="patch-check-fill" size={13} /> ISO 22716
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <BI name="globe2" size={13} /> 99.9% SLA
            </span>
          </div>
        </div>
      </div>

      {/* ══ RIGHT PANEL — Bootstrap Light ══ */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '40px 32px',
        background: '#f8f9fa',
      }}>

        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-3 mb-8">
          <img src={brainxLogo} alt="BrainX" style={{ width: 56, height: 56, objectFit: 'contain' }} />
          <div style={{ color: '#212529', fontWeight: 700, fontSize: 16 }}>BrainX Industrial</div>
        </div>

        {signupSuccess ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}
            style={{ width: '100%', maxWidth: 420, textAlign: 'center' }}
          >
            <div style={{
              background: '#fff',
              border: '1px solid #dee2e6',
              borderRadius: 8,
              padding: '40px 28px',
              boxShadow: '0 0.125rem 0.25rem rgba(0,0,0,0.075)',
            }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: 'rgba(13,110,253,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 20px',
              }}>
                <BI name="envelope-check-fill" size={28} color="#0d6efd" />
              </div>
              <h2 style={{ color: '#212529', fontWeight: 700, fontSize: 22, margin: '0 0 12px' }}>
                Verifique seu e-mail
              </h2>
              <p style={{ color: '#495057', fontSize: 14, lineHeight: 1.7, margin: '0 0 8px' }}>
                Para acessar o <strong>BrainX ERP</strong>, acesse seu e-mail
              </p>
              <p style={{
                color: '#0d6efd', fontWeight: 600, fontSize: 15,
                background: 'rgba(13,110,253,0.06)', borderRadius: 6,
                padding: '10px 16px', margin: '0 0 16px', wordBreak: 'break-all',
              }}>
                {regEmail}
              </p>
              <p style={{ color: '#495057', fontSize: 14, lineHeight: 1.7, margin: '0 0 24px' }}>
                e clique no link de confirmação para ativar sua conta.
              </p>
              <div style={{
                background: '#fff3cd', border: '1px solid #ffda6a', borderRadius: 6,
                padding: '12px 16px', fontSize: 13, color: '#664d03', lineHeight: 1.6,
                display: 'flex', alignItems: 'flex-start', gap: 8, textAlign: 'left',
              }}>
                <BI name="info-circle-fill" size={16} color="#ff9800" className="" />
                <span>Não encontrou? Verifique a pasta <strong>spam</strong> ou <strong>lixo eletrônico</strong>.</span>
              </div>
              <button onClick={() => { setSignupSuccess(false); setTab('login'); }} style={{
                width: '100%', height: 44, marginTop: 20,
                background: '#0d6efd', color: '#fff', fontWeight: 600, fontSize: 15,
                border: 'none', borderRadius: 6, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
                onMouseEnter={e => (e.target as HTMLElement).style.background = '#0b5ed7'}
                onMouseLeave={e => (e.target as HTMLElement).style.background = '#0d6efd'}
              >
                <BI name="box-arrow-in-right" size={16} /> Ir para Login
              </button>
            </div>
          </motion.div>
        ) : (
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          style={{ width: '100%', maxWidth: 420 }}
        >
          {/* Heading */}
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ color: '#212529', fontWeight: 700, fontSize: 24, letterSpacing: '-0.02em', margin: 0 }}>
              <BI name="person-circle" size={24} color="#0d6efd" />{' '}Bem-vindo de volta
            </h2>
            <p style={{ color: '#6c757d', fontSize: 14, marginTop: 6 }}>
              Acesse sua conta para continuar
            </p>
          </div>

          {/* Card */}
          <div style={{
            background: '#fff',
            border: '1px solid #dee2e6',
            borderRadius: 8,
            padding: '28px 28px 24px',
            boxShadow: '0 0.125rem 0.25rem rgba(0,0,0,0.075)',
          }}>

            {/* Tab switcher — Bootstrap nav-pills style */}
            <div style={{
              display: 'flex',
              background: '#e9ecef',
              borderRadius: 6, padding: 3,
              marginBottom: 24,
            }}>
              {(['login', 'register'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)} style={{
                  flex: 1, padding: '8px 0', borderRadius: 4,
                  border: 'none', cursor: 'pointer',
                  fontSize: 14, fontWeight: 500,
                  transition: 'all 0.15s',
                  background: tab === t ? '#0d6efd' : 'transparent',
                  color: tab === t ? '#fff' : '#495057',
                }}>
                  <BI name={t === 'login' ? 'box-arrow-in-right' : 'person-plus'} size={14} />{' '}
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
                >
                  <Field id="login-email" label="Email" type="email" placeholder="seu@email.com"
                    value={loginEmail} onChange={e => setLoginEmail(e.target.value)} icon="envelope-fill" required />
                  <Field id="login-pass" label="Senha" type="password" placeholder="••••••••"
                    value={loginPass} onChange={e => setLoginPass(e.target.value)} icon="lock-fill" required />

                  <button type="submit" disabled={loading} style={{
                    width: '100%', height: 44, marginTop: 8,
                    background: loading ? '#0d6efd99' : '#0d6efd',
                    color: '#fff', fontWeight: 600, fontSize: 15,
                    border: 'none', borderRadius: 6, cursor: loading ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    transition: 'background-color 0.15s ease-in-out',
                  }}
                    onMouseEnter={e => { if (!loading) (e.target as HTMLElement).style.background = '#0b5ed7'; }}
                    onMouseLeave={e => { if (!loading) (e.target as HTMLElement).style.background = '#0d6efd'; }}
                  >
                    {loading
                      ? <><BI name="arrow-repeat" size={16} className="bi-spin" /> Entrando...</>
                      : <><BI name="box-arrow-in-right" size={16} /> Acessar plataforma</>
                    }
                  </button>
                </motion.form>
              ) : (
                <motion.form key="register"
                  initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -6 }} transition={{ duration: 0.15 }}
                  onSubmit={handleRegister}
                >
                  <Field id="reg-name" label="Nome Completo" type="text" placeholder="Seu nome"
                    value={regName} onChange={e => setRegName(e.target.value)} icon="person-fill" required />
                  <Field id="reg-email" label="Email" type="email" placeholder="seu@email.com"
                    value={regEmail} onChange={e => setRegEmail(e.target.value)} icon="envelope-fill" required />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <Field id="reg-pass" label="Senha" type="password" placeholder="Mín. 6 dígitos"
                      value={regPass} onChange={e => setRegPass(e.target.value)} icon="lock-fill" required minLength={6} />
                    <Field id="reg-confirm" label="Confirmar" type="password" placeholder="Repita"
                      value={regConfirm} onChange={e => setRegConfirm(e.target.value)} icon="lock-fill" required minLength={6} />
                  </div>
                  {mismatch && (
                    <div style={{
                      color: '#842029', fontSize: 13, padding: '10px 14px', marginTop: 8,
                      background: '#f8d7da', border: '1px solid #f5c2c7', borderRadius: 6,
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                      <BI name="exclamation-triangle-fill" size={14} /> As senhas não coincidem
                    </div>
                  )}
                  {repeatedSignup && (
                    <div style={{
                      color: '#664d03', fontSize: 13, padding: '14px 16px', marginTop: 12,
                      background: '#fff3cd', border: '2px solid #ffda6a', borderRadius: 8,
                      lineHeight: 1.6,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, marginBottom: 6, fontSize: 14 }}>
                        <BI name="exclamation-triangle-fill" size={18} color="#ff9800" />
                        E-mail já cadastrado!
                      </div>
                      <p style={{ margin: 0 }}>
                        Este e-mail já possui uma conta. Verifique sua <strong>caixa de entrada</strong> e <strong>spam</strong> para o link de confirmação.
                      </p>
                      <p style={{ margin: '8px 0 0' }}>
                        Caso já tenha confirmado, tente <button type="button" onClick={() => { setTab('login'); setRepeatedSignup(false); }} style={{ color: '#0d6efd', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline', padding: 0, fontSize: 13 }}>fazer login</button>.
                      </p>
                    </div>
                  )}
                  <button type="submit" disabled={loading || mismatch} style={{
                    width: '100%', height: 44, marginTop: 12,
                    background: loading || mismatch ? '#0d6efd66' : '#0d6efd',
                    color: '#fff', fontWeight: 600, fontSize: 15,
                    border: 'none', borderRadius: 6, cursor: loading || mismatch ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    transition: 'background-color 0.15s ease-in-out',
                  }}
                    onMouseEnter={e => { if (!loading && !mismatch) (e.target as HTMLElement).style.background = '#0b5ed7'; }}
                    onMouseLeave={e => { if (!loading && !mismatch) (e.target as HTMLElement).style.background = '#0d6efd'; }}
                  >
                    {loading
                      ? <><BI name="arrow-repeat" size={16} className="bi-spin" /> Cadastrando...</>
                      : <><BI name="person-plus-fill" size={16} /> Criar conta</>
                    }
                  </button>
                </motion.form>
              )}
            </AnimatePresence>
          </div>

          {/* Demo login card */}
          <DemoLoginCard />

          {/* Below card */}
          <p style={{ textAlign: 'center', color: '#6c757d', fontSize: 12.5, marginTop: 16, lineHeight: 1.6 }}>
            Ao continuar, você concorda com os{' '}
            <a href="/termos-de-uso" target="_blank" style={{ color: '#0d6efd', textDecoration: 'none' }}>Termos de Uso</a>
            {' '}e{' '}
            <a href="/politica-de-privacidade" target="_blank" style={{ color: '#0d6efd', textDecoration: 'none' }}>Política de Privacidade</a>.
          </p>
        </motion.div>
        )}
      </div>

      <style>{`
        @keyframes bi-spin { to { transform: rotate(360deg); } }
        .bi-spin { display: inline-block; animation: bi-spin 0.75s linear infinite; }
      `}</style>
    </div>
  );
}
