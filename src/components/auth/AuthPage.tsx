import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/use-auth';

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
            <div style={{
              width: 42, height: 42, borderRadius: 10,
              background: '#0d6efd',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <BI name="cpu-fill" size={22} color="#fff" />
            </div>
            <div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 18, letterSpacing: '-0.02em', lineHeight: 1 }}>BrainX</div>
              <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10.5, fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', marginTop: 2 }}>
                ERP Industrial
              </div>
            </div>
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
          <div style={{
            width: 38, height: 38, borderRadius: 8,
            background: '#0d6efd',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <BI name="cpu-fill" size={20} color="#fff" />
          </div>
          <div style={{ color: '#212529', fontWeight: 700, fontSize: 16 }}>BrainX Industrial</div>
        </div>

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

          {/* Below card */}
          <p style={{ textAlign: 'center', color: '#6c757d', fontSize: 12.5, marginTop: 16, lineHeight: 1.6 }}>
            Ao continuar, você concorda com os{' '}
            <a href="#" style={{ color: '#0d6efd', textDecoration: 'none' }}>Termos de Uso</a>
            {' '}e{' '}
            <a href="#" style={{ color: '#0d6efd', textDecoration: 'none' }}>Política de Privacidade</a>.
          </p>
        </motion.div>
      </div>

      <style>{`
        @keyframes bi-spin { to { transform: rotate(360deg); } }
        .bi-spin { display: inline-block; animation: bi-spin 0.75s linear infinite; }
      `}</style>
    </div>
  );
}
