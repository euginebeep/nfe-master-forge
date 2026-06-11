import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { LogoDemoERP } from '@/components/layout/LogoDemoERP';
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
  { icon: 'graph-up', label: 'Produção rastreável', sub: 'Ordens, lotes e etapas críticas em um fluxo industrial único.' },
  { icon: 'shield-check', label: 'Qualidade e BPF', sub: 'Controles técnicos para suplementos, auditoria e liberação segura.' },
  { icon: 'stack', label: 'Estoque por lote', sub: 'FEFO, quarentena, COA e consumo com rastreabilidade total.' },
  { icon: 'receipt', label: 'Emissão de NF-e', sub: 'Emissor fiscal integrado com cálculo automático de impostos e DANFE.' },
  { icon: 'thermometer-snow', label: 'Controle de temperatura', sub: 'Monitoramento por sensores IoT com alertas e histórico para BPF.' },
  { icon: 'vials', label: 'Formulador industrial', sub: 'Cápsulas, líquidos e pós com potência por lote e travas de segurança.' },
];

/* ─── Input Field (Bootstrap style) ─── */
function Field({
  id, label, type, placeholder, value, onChange, icon, required, minLength, children,
}: {
  id: string; label: string; type: string; placeholder: string; value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  icon: string; required?: boolean; minLength?: number; children?: React.ReactNode;
}) {
  return (
    <div className="mb-3">
      <label htmlFor={id} className="form-label" style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.75)', marginBottom: 8, display: 'block', letterSpacing: '0.01em' }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', zIndex: 2 }}>
          <BI name={icon} size={15} color="rgba(255,255,255,0.4)" />
        </span>
        <input
          id={id} type={type} placeholder={placeholder}
          value={value} onChange={onChange}
          required={required} minLength={minLength}
          className="form-control"
          style={{
            width: '100%', height: 46,
            paddingLeft: 42, paddingRight: 14,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 10, color: '#fff', fontSize: 14,
            outline: 'none', boxSizing: 'border-box',
            transition: 'all 0.2s ease',
          }}
          onFocus={e => {
            e.target.style.borderColor = 'rgba(59,130,246,0.6)';
            e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.15)';
            e.target.style.background = 'rgba(255,255,255,0.06)';
          }}
          onBlur={e => {
            e.target.style.borderColor = 'rgba(255,255,255,0.1)';
            e.target.style.boxShadow = 'none';
            e.target.style.background = 'rgba(255,255,255,0.04)';
          }}
        />
      </div>
      {children}
    </div>
  );
}

/* ─── Password Strength Meter ─── */
function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;

  const getStrength = (p: string) => {
    let score = 0;
    if (p.length >= 8) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    return score;
  };

  const strength = getStrength(password);
  const colors = ['#ef4444', '#f59e0b', '#3b82f6', '#10b981'];
  const labels = ['Muito fraca', 'Fraca', 'Boa', 'Forte'];

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', gap: 4, height: 4, borderRadius: 2, overflow: 'hidden' }}>
        {[1, 2, 3, 4].map((step) => (
          <div
            key={step}
            style={{
              flex: 1,
              background: step <= strength ? colors[strength - 1] : 'rgba(255,255,255,0.1)',
              transition: 'background 0.3s'
            }}
          />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        <span style={{ fontSize: 11, color: colors[strength - 1] || 'rgba(255,255,255,0.4)', fontWeight: 600 }}>
          {labels[strength - 1] || 'Muito fraca'}
        </span>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
          Mín. 8 caracteres, letras, números e símbolos
        </span>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════
   AUTH PAGE — Bootstrap Theme
══════════════════════════════════════ */
export default function AuthPageModern() {
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
    return <Navigate to="/dashboard" replace />;
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

      {/* ══ LEFT PANEL — Deep Black background matching logo ══ */}
      <div className="hidden lg:flex flex-col" style={{
        width: '56%',
        background: '#000000',
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

          {/* Logo with 50% increase and inline text */}
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}
            style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <LogoDemoERP style={{ width: 270, height: 270, objectFit: 'contain' } as any} />
            <div style={{ color: '#fff', display: 'flex', alignItems: 'baseline', gap: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 36, letterSpacing: '-0.02em' }}>BrainX ERP</div>
              <div style={{ fontWeight: 400, fontSize: 20, color: 'rgba(255,255,255,0.6)' }}>Gestão Industrial</div>
            </div>
          </motion.div>

          {/* Hero text */}
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.1 }}
            style={{ marginTop: 'auto', marginBottom: 44 }}>
            <h1 style={{
              color: '#fff', fontWeight: 700,
              fontSize: 'clamp(32px, 4vw, 48px)',
              lineHeight: 1.1, letterSpacing: '-0.04em', marginBottom: 20,
            }}>
              BrainX ERP para gestão industrial de suplementos.
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 16, lineHeight: 1.6, maxWidth: 480 }}>
              Controle produção, estoque, qualidade e conformidade com rastreabilidade de ponta a ponta.
            </p>
          </motion.div>

          {/* Feature cards Grid - Exact style from reference image */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
            {FEATURES.map((f, i) => (
              <motion.div key={f.label}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.22 + i * 0.06 }}
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 12, padding: '16px 14px',
                  transition: 'all 0.3s ease',
                  cursor: 'default',
                  minHeight: '140px'
                }}
              >
                <div style={{ marginBottom: 12, color: '#10b981' }}>
                  <BI name={f.icon} size={22} />
                </div>
                <div style={{ color: '#f8f9fa', fontSize: 14, fontWeight: 700, marginBottom: 6, letterSpacing: '-0.01em' }}>
                  {f.label}
                </div>
                <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, lineHeight: 1.45 }}>
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
        background: 'radial-gradient(ellipse at top right, #1e293b 0%, #0a0f1a 60%, #000 100%)',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Ambient glow */}
        <div style={{
          position: 'absolute', top: '20%', right: '-10%',
          width: 420, height: 420, borderRadius: '50%', pointerEvents: 'none',
          background: 'radial-gradient(circle, rgba(59,130,246,0.18) 0%, transparent 70%)',
          filter: 'blur(20px)',
        }} />
        <div style={{
          position: 'absolute', bottom: '-10%', left: '-5%',
          width: 360, height: 360, borderRadius: '50%', pointerEvents: 'none',
          background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)',
          filter: 'blur(20px)',
        }} />

        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-3 mb-8">
          <LogoDemoERP className="w-14 h-14" />
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>BrainX ERP</div>
        </div>

        {signupSuccess ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}
            style={{ width: '100%', maxWidth: 420, textAlign: 'center', position: 'relative', zIndex: 1 }}
          >
            <div style={{
              background: 'rgba(255,255,255,0.03)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 16,
              padding: '40px 28px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
            }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: 'rgba(59,130,246,0.15)',
                border: '1px solid rgba(59,130,246,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 20px',
              }}>
                <BI name="envelope-check-fill" size={28} color="#60a5fa" />
              </div>
              <h2 style={{ color: '#fff', fontWeight: 700, fontSize: 22, margin: '0 0 12px' }}>
                Verifique seu e-mail
              </h2>
              <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14, lineHeight: 1.7, margin: '0 0 8px' }}>
                Para acessar o <strong>BrainX ERP</strong>, acesse seu e-mail
              </p>
              <p style={{
                color: '#60a5fa', fontWeight: 600, fontSize: 15,
                background: 'rgba(59,130,246,0.1)', borderRadius: 8,
                border: '1px solid rgba(59,130,246,0.2)',
                padding: '10px 16px', margin: '0 0 16px', wordBreak: 'break-all',
              }}>
                {regEmail}
              </p>
              <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14, lineHeight: 1.7, margin: '0 0 24px' }}>
                e clique no link de confirmação para ativar sua conta.
              </p>
              <div style={{
                background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 8,
                padding: '12px 16px', fontSize: 13, color: '#fbbf24', lineHeight: 1.6,
                display: 'flex', alignItems: 'flex-start', gap: 8, textAlign: 'left',
              }}>
                <BI name="info-circle-fill" size={16} color="#fbbf24" className="" />
                <span>Não encontrou? Verifique a pasta <strong>spam</strong> ou <strong>lixo eletrônico</strong>.</span>
              </div>
              <button onClick={() => { setSignupSuccess(false); setTab('login'); }} style={{
                width: '100%', height: 44, marginTop: 20,
                background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#fff', fontWeight: 600, fontSize: 15,
                border: 'none', borderRadius: 10, cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(59,130,246,0.35)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
              >
                <BI name="box-arrow-in-right" size={16} /> Ir para Login
              </button>
            </div>
          </motion.div>
        ) : (
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 1 }}
        >
          {/* Heading */}
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ color: '#fff', fontWeight: 700, fontSize: 26, letterSpacing: '-0.02em', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
              <BI name="person-circle" size={26} color="#60a5fa" />Bem-vindo de volta
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, marginTop: 8 }}>
              Acesse sua conta para continuar
            </p>
          </div>

          {/* Card */}
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 16,
            padding: '28px 28px 24px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
          }}>

            {/* Tab switcher — Bootstrap nav-pills style */}
            <div style={{
              display: 'flex',
              background: 'rgba(0,0,0,0.25)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 10, padding: 4,
              marginBottom: 24,
            }}>
              {(['login', 'register'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)} style={{
                  flex: 1, padding: '9px 0', borderRadius: 7,
                  border: 'none', cursor: 'pointer',
                  fontSize: 13.5, fontWeight: 600,
                  transition: 'all 0.2s',
                  background: tab === t ? 'linear-gradient(135deg, #3b82f6, #2563eb)' : 'transparent',
                  color: tab === t ? '#fff' : 'rgba(255,255,255,0.55)',
                  boxShadow: tab === t ? '0 4px 14px rgba(59,130,246,0.35)' : 'none',
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
                    width: '100%', height: 46, marginTop: 12,
                    background: loading ? 'rgba(59,130,246,0.5)' : 'linear-gradient(135deg, #3b82f6, #2563eb)',
                    color: '#fff', fontWeight: 600, fontSize: 15,
                    border: 'none', borderRadius: 10, cursor: loading ? 'not-allowed' : 'pointer',
                    boxShadow: loading ? 'none' : '0 4px 14px rgba(59,130,246,0.35)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    transition: 'all 0.2s ease',
                  }}
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
                      value={regPass} onChange={e => setRegPass(e.target.value)} icon="lock-fill" required minLength={6}>
                      <PasswordStrength password={regPass} />
                    </Field>
                    <Field id="reg-confirm" label="Confirmar" type="password" placeholder="Repita"
                      value={regConfirm} onChange={e => setRegConfirm(e.target.value)} icon="lock-fill" required minLength={6} />
                  </div>
                  {mismatch && (
                    <div style={{
                      color: '#fca5a5', fontSize: 13, padding: '10px 14px', marginTop: 8,
                      background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8,
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                      <BI name="exclamation-triangle-fill" size={14} /> As senhas não coincidem
                    </div>
                  )}
                  {repeatedSignup && (
                    <div style={{
                      color: '#fcd34d', fontSize: 13, padding: '14px 16px', marginTop: 12,
                      background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 10,
                      lineHeight: 1.6,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, marginBottom: 6, fontSize: 14 }}>
                        <BI name="exclamation-triangle-fill" size={18} color="#fbbf24" />
                        E-mail já cadastrado!
                      </div>
                      <p style={{ margin: 0 }}>
                        Este e-mail já possui uma conta. Verifique sua <strong>caixa de entrada</strong> e <strong>spam</strong> para o link de confirmação.
                      </p>
                      <p style={{ margin: '8px 0 0' }}>
                        Caso já tenha confirmado, tente <button type="button" onClick={() => { setTab('login'); setRepeatedSignup(false); }} style={{ color: '#60a5fa', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline', padding: 0, fontSize: 13 }}>fazer login</button>.
                      </p>
                    </div>
                  )}
                  <button type="submit" disabled={loading || mismatch} style={{
                    width: '100%', height: 46, marginTop: 14,
                    background: loading || mismatch ? 'rgba(59,130,246,0.4)' : 'linear-gradient(135deg, #3b82f6, #2563eb)',
                    color: '#fff', fontWeight: 600, fontSize: 15,
                    border: 'none', borderRadius: 10, cursor: loading || mismatch ? 'not-allowed' : 'pointer',
                    boxShadow: loading || mismatch ? 'none' : '0 4px 14px rgba(59,130,246,0.35)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    transition: 'all 0.2s ease',
                  }}
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
          <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.45)', fontSize: 12.5, marginTop: 16, lineHeight: 1.6 }}>
            Ao continuar, você concorda com os{' '}
            <a href="/termos-de-uso" target="_blank" style={{ color: '#60a5fa', textDecoration: 'none' }}>Termos de Uso</a>
            {' '}e{' '}
            <a href="/politica-de-privacidade" target="_blank" style={{ color: '#60a5fa', textDecoration: 'none' }}>Política de Privacidade</a>.
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
