import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, ArrowRight } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

/* ─── Tokens ─── */
const C = {
  bg:       '#080C10',
  panel:    '#0C1118',
  surface:  '#111820',
  card:     '#141D27',
  border:   '#1A2434',
  border2:  '#243044',
  text:     '#EDF2F7',
  sub:      '#94A3B8',
  dim:      '#4A6070',
  neon:     '#00E58E',
  blue:     '#3B82F6',
  indigo:   '#6366F1',
  error:    '#F43F5E',
} as const;

/* ══════════════════════════════════════
   CUSTOM SVG ICONS
══════════════════════════════════════ */
const IconBrainX = ({ size = 22, color = '#fff' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5.5C9.2 5.5 6.5 7.5 6.5 10.5c0 1.8.9 3.3 2.2 4.2-.2.7-.3 1.3-.3 1.8 0 1.3.7 1.8 1.6 1.8.4 0 .9-.2 1.3-.5"/>
    <path d="M12 5.5c2.8 0 5.5 2 5.5 5 0 1.8-.9 3.3-2.2 4.2.2.7.3 1.3.3 1.8 0 1.3-.7 1.8-1.6 1.8-.4 0-.9-.2-1.3-.5"/>
    <line x1="12" y1="5.5" x2="12" y2="18.8"/>
    <circle cx="9" cy="9.5" r=".9" fill={color} stroke="none"/>
    <circle cx="15" cy="9.5" r=".9" fill={color} stroke="none"/>
    <circle cx="12" cy="13" r=".9" fill={color} fillOpacity=".9" stroke="none"/>
    <line x1="6.5" y1="10" x2="4.5" y2="8.5" strokeOpacity=".4" strokeWidth="1"/>
    <line x1="6.8" y1="12.5" x2="5" y2="13.5" strokeOpacity=".4" strokeWidth="1"/>
    <line x1="17.5" y1="10" x2="19.5" y2="8.5" strokeOpacity=".4" strokeWidth="1"/>
    <line x1="17.2" y1="12.5" x2="19" y2="13.5" strokeOpacity=".4" strokeWidth="1"/>
  </svg>
);

const IconProducao = ({ size = 18, color = C.neon }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.3" strokeLinecap="round">
    <rect x="7" y="3" width="10" height="2.5" rx=".8"/>
    <path d="M8 5.5v9c0 2 1.8 3.2 4 3.2s4-1.2 4-3.2v-9"/>
    <line x1="10.5" y1="9.5" x2="13.5" y2="9.5" strokeOpacity=".4"/>
    <line x1="10.5" y1="12" x2="13.5" y2="12" strokeOpacity=".4"/>
    <line x1="12" y1="5.5" x2="12" y2="14.5" strokeOpacity=".6"/>
    <line x1="10" y1="8" x2="14" y2="8" strokeOpacity=".6"/>
    <line x1="3" y1="4.75" x2="7" y2="4.75"/>
    <circle cx="2.5" cy="4.75" r="1" fill={color} fillOpacity=".2"/>
    <line x1="17" y1="4.75" x2="21" y2="4.75"/>
    <circle cx="21.5" cy="4.75" r="1" fill={color} fillOpacity=".2"/>
    <line x1="12" y1="17.7" x2="12" y2="21"/>
    <line x1="10" y1="20.5" x2="14" y2="20.5" strokeOpacity=".4"/>
  </svg>
);

const IconEstoque = ({ size = 18, color = C.neon }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.3" strokeLinecap="round">
    <rect x="2" y="3.5" width="9.5" height="5" rx="1" fill={color} fillOpacity=".06"/>
    <rect x="12.5" y="3.5" width="9.5" height="5" rx="1" fill={color} fillOpacity=".06"/>
    <rect x="2" y="10.5" width="9.5" height="5" rx="1" fill={color} fillOpacity=".06"/>
    <rect x="12.5" y="10.5" width="9.5" height="5" rx="1" fill={color} fillOpacity=".06"/>
    <rect x="2" y="17.5" width="20" height="3" rx="1" fill={color} fillOpacity=".1"/>
    <line x1="8.5" y1="17.5" x2="8.5" y2="20.5" strokeOpacity=".3"/>
    <line x1="15.5" y1="17.5" x2="15.5" y2="20.5" strokeOpacity=".3"/>
    <circle cx="5.5" cy="6" r=".9" fill={color} fillOpacity=".6" stroke="none"/>
    <circle cx="16" cy="13" r=".9" fill={color} fillOpacity=".6" stroke="none"/>
  </svg>
);

const IconKPI = ({ size = 18, color = C.neon }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.3" strokeLinecap="round">
    <path d="M4 17.5A9 9 0 0 1 12 2.5a9 9 0 0 1 8 14" strokeOpacity=".25"/>
    <path d="M4 17.5A9 9 0 0 1 12 2.5a9 9 0 0 1 6 11.8" strokeWidth="1.6"/>
    <line x1="12" y1="12" x2="17.5" y2="7.5" strokeWidth="1.8"/>
    <circle cx="12" cy="12" r="1.8" fill={color} fillOpacity=".15" strokeWidth="1.2"/>
    <circle cx="12" cy="12" r=".7" fill={color} stroke="none"/>
    <line x1="4" y1="17.5" x2="5.2" y2="15.8" strokeOpacity=".4"/>
    <line x1="12" y1="2.5" x2="12" y2="4.2" strokeOpacity=".4"/>
    <line x1="20" y1="17.5" x2="18.8" y2="15.8" strokeOpacity=".4"/>
    <line x1="7" y1="20" x2="7" y2="22.5" strokeWidth="2.2"/>
    <line x1="10" y1="19" x2="10" y2="22.5" strokeWidth="2.2"/>
    <line x1="13" y1="19.5" x2="13" y2="22.5" strokeWidth="2.2"/>
    <line x1="16" y1="20.5" x2="16" y2="22.5" strokeWidth="2.2" strokeOpacity=".3"/>
  </svg>
);

const IconAnvisa = ({ size = 18, color = C.neon }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2L4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6L12 2z" fill={color} fillOpacity=".06"/>
    <polyline points="8,12.5 11,15.5 16.5,9" strokeWidth="1.9"/>
    <line x1="8" y1="7.5" x2="16" y2="7.5" strokeOpacity=".2" strokeDasharray="1.5 1.5"/>
  </svg>
);

const IconActivity = ({ size = 13, color = C.neon }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="2,12 6,12 8,4 10,20 13,8 15,16 17,12 22,12"/>
  </svg>
);

const IconShieldLock = ({ size = 12, color = C.dim }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2L4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6L12 2z"/>
    <rect x="9" y="11" width="6" height="5" rx="1"/>
    <path d="M10 11V9a2 2 0 0 1 4 0v2"/>
  </svg>
);

const IconCheckCircle = ({ size = 12, color = C.dim }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9.5"/>
    <polyline points="8,12 11,15 16,9"/>
  </svg>
);

const IconMail = ({ size = 15, color = C.dim }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="5" width="20" height="14" rx="2"/>
    <polyline points="2,5 12,13 22,5"/>
  </svg>
);

const IconLock = ({ size = 15, color = C.dim }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="11" width="14" height="10" rx="2"/>
    <path d="M8 11V7a4 4 0 0 1 8 0v4"/>
    <circle cx="12" cy="16" r="1.1" fill={color}/>
  </svg>
);

const IconUser = ({ size = 15, color = C.dim }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4"/>
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
  </svg>
);

/* ─── Bullets ─── */
const BULLETS = [
  { Icon: IconProducao, label: 'Controle de Produção',  sub: 'Ordens de produção, fórmulas magistrais e rastreabilidade industrial completa' },
  { Icon: IconEstoque,  label: 'Gestão de Estoque',     sub: 'Lotes com critério FEFO automático, quarentena e alertas de validade' },
  { Icon: IconKPI,      label: 'Dashboard Executivo',   sub: 'Indicadores industriais em tempo real e inteligência operacional avançada' },
  { Icon: IconAnvisa,   label: 'Conformidade ANVISA',   sub: 'Validações regulatórias automatizadas e trilha de auditoria imutável' },
];

/* ─── Feature stat ─── */
function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span style={{ color: C.text, fontWeight: 800, fontSize: 20, letterSpacing: '-0.03em', lineHeight: 1 }}>{value}</span>
      <span style={{ color: C.dim, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 500 }}>{label}</span>
    </div>
  );
}

/* ─── Input ─── */
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
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} style={{ color: C.sub, fontSize: 12, fontWeight: 600, letterSpacing: '0.01em' }}>
        {label}
      </label>
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
          <Icon size={15} color={focused ? C.neon : C.dim} />
        </span>
        <input
          id={id} type={type} placeholder={placeholder}
          value={value} onChange={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          required={required} minLength={minLength}
          style={{
            width: '100%', height: 44,
            paddingLeft: 42, paddingRight: 14,
            background: focused ? '#0A1018' : C.surface,
            border: `1.5px solid ${focused ? C.neon + '70' : C.border2}`,
            borderRadius: 8,
            color: C.text,
            fontSize: 14,
            outline: 'none',
            boxShadow: focused ? `0 0 0 3px ${C.neon}10` : 'none',
            transition: 'all 0.18s ease',
          }}
          className="placeholder:text-[#243044]"
        />
      </div>
    </div>
  );
}

/* ─── Primary Button ─── */
function PrimaryBtn({ loading, loadText, text, disabled }: {
  loading: boolean; loadText: string; text: string; disabled?: boolean;
}) {
  return (
    <motion.button
      type="submit"
      disabled={loading || disabled}
      whileHover={!loading && !disabled ? { scale: 1.008, boxShadow: `0 0 32px ${C.neon}30` } : {}}
      whileTap={!loading && !disabled ? { scale: 0.996 } : {}}
      style={{
        width: '100%', height: 46,
        border: 'none', borderRadius: 9, cursor: loading || disabled ? 'not-allowed' : 'pointer',
        background: loading || disabled
          ? `${C.neon}25`
          : `linear-gradient(135deg, ${C.neon} 0%, #00C97A 50%, ${C.blue} 100%)`,
        color: loading || disabled ? C.neon : '#fff',
        fontWeight: 700, fontSize: 13.5, letterSpacing: '0.04em',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        boxShadow: loading || disabled ? 'none' : `0 0 20px ${C.neon}20`,
        transition: 'all 0.2s ease',
      }}
    >
      {loading
        ? <><Loader2 style={{ width: 16, height: 16, animation: 'spin 0.9s linear infinite' }} /> {loadText}</>
        : <><ArrowRight style={{ width: 16, height: 16 }} /> {text}</>
      }
    </motion.button>
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
    <div style={{ minHeight: '100vh', display: 'flex', fontFamily: '"Inter", "Segoe UI", system-ui, sans-serif', background: C.bg }}>

      {/* ═══════════════════════════════════════
          LEFT — brand / product panel
      ═══════════════════════════════════════ */}
      <div className="hidden lg:flex flex-col" style={{
        width: '55%', background: C.panel,
        borderRight: `1px solid ${C.border}`,
        position: 'relative', overflow: 'hidden',
      }}>
        {/* subtle grid */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: `linear-gradient(${C.border}50 1px, transparent 1px),linear-gradient(90deg, ${C.border}50 1px, transparent 1px)`,
          backgroundSize: '52px 52px',
        }} />
        {/* glows */}
        <div className="absolute pointer-events-none" style={{
          top: -160, right: -100, width: 500, height: 500, borderRadius: '50%',
          background: `radial-gradient(circle, ${C.neon}0E 0%, transparent 65%)`,
        }}/>
        <div className="absolute pointer-events-none" style={{
          bottom: -140, left: -120, width: 560, height: 560, borderRadius: '50%',
          background: `radial-gradient(circle, ${C.blue}0C 0%, transparent 65%)`,
        }}/>
        <div className="absolute pointer-events-none" style={{
          top: '45%', left: '50%', transform: 'translate(-50%,-50%)',
          width: 320, height: 320, borderRadius: '50%',
          background: `radial-gradient(circle, ${C.indigo}06 0%, transparent 60%)`,
        }}/>

        <div className="relative z-10 flex flex-col h-full" style={{ padding: '52px 60px' }}>

          {/* Brand */}
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            className="flex items-center gap-3.5">
            <div style={{
              width: 46, height: 46, borderRadius: 12,
              background: `linear-gradient(140deg, ${C.neon} 0%, ${C.blue} 100%)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 4px 24px ${C.neon}28, 0 0 0 1px ${C.neon}20`,
            }}>
              <IconBrainX size={22} color="#fff" />
            </div>
            <div>
              <div style={{ color: C.text, fontWeight: 800, fontSize: 18, letterSpacing: '-0.025em', lineHeight: 1 }}>BrainX</div>
              <div style={{ color: C.dim, fontSize: 10.5, fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', marginTop: 2 }}>
                Industrial OS
              </div>
            </div>

            {/* right of brand: version pill */}
            <div className="ml-auto" style={{
              border: `1px solid ${C.border2}`, borderRadius: 6, padding: '4px 10px',
            }}>
              <span style={{ color: C.dim, fontSize: 10, fontWeight: 600, letterSpacing: '0.08em' }}>v 4.2 · Enterprise</span>
            </div>
          </motion.div>

          {/* Hero block */}
          <motion.div initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.12 }}
            style={{ marginTop: 'auto', marginBottom: 48 }}>

            {/* Status chip */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              border: `1px solid ${C.neon}28`, background: `${C.neon}08`,
              borderRadius: 100, padding: '5px 14px', marginBottom: 24,
            }}>
              <IconActivity size={13} color={C.neon} />
              <span style={{ color: C.neon, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Sistema Operacional Industrial
              </span>
            </div>

            <h1 style={{
              color: C.text, fontWeight: 900,
              fontSize: 'clamp(30px, 3.2vw, 48px)',
              lineHeight: 1.07, letterSpacing: '-0.04em', marginBottom: 18,
            }}>
              Gestão industrial<br />
              <span style={{ background: `linear-gradient(90deg, ${C.neon}, ${C.blue})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                inteligente
              </span>
              {' '}
              <span style={{ color: C.border2 }}>&amp;</span>
              {' '}
              <span style={{ color: C.text }}>integrada.</span>
            </h1>

            <p style={{ color: C.sub, fontSize: 15, lineHeight: 1.7, maxWidth: 440 }}>
              Controle total da produção farmacêutica com rastreabilidade completa,
              qualidade rigorosa e conformidade regulatória automatizada.
            </p>
          </motion.div>

          {/* Feature bullets */}
          <div className="grid grid-cols-2 gap-3" style={{ marginBottom: 40 }}>
            {BULLETS.map((b, i) => (
              <motion.div key={b.label}
                initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.42, delay: 0.28 + i * 0.07 }}
                style={{
                  background: `${C.surface}DD`,
                  border: `1px solid ${C.border}`,
                  borderRadius: 10, padding: '18px 16px',
                  backdropFilter: 'blur(8px)',
                  position: 'relative', overflow: 'hidden',
                  transition: 'border-color 0.25s',
                }}
                whileHover={{ borderColor: C.neon + '30' }}
              >
                {/* top accent */}
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: 1,
                  background: `linear-gradient(90deg, ${C.neon}30, transparent)`,
                }}/>
                <div style={{ marginBottom: 12 }}>
                  <b.Icon size={18} color={C.neon} />
                </div>
                <div style={{ color: C.text, fontSize: 13, fontWeight: 700, marginBottom: 5, letterSpacing: '-0.01em' }}>
                  {b.label}
                </div>
                <div style={{ color: C.sub, fontSize: 11.5, lineHeight: 1.55 }}>
                  {b.sub}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Bottom bar: stats + online */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
            style={{
              display: 'flex', alignItems: 'center',
              padding: '16px 20px',
              background: `${C.surface}88`,
              border: `1px solid ${C.border}`,
              borderRadius: 10, gap: 8,
            }}>
            <Stat value="99.9%" label="Uptime SLA" />
            <div style={{ width: 1, height: 32, background: C.border, margin: '0 8px' }}/>
            <Stat value="ISO" label="22716 / GMP" />
            <div style={{ width: 1, height: 32, background: C.border, margin: '0 8px' }}/>
            <Stat value="21 CFR" label="Part 11" />
            <div style={{ flex: 1 }}/>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
                background: C.neon,
                boxShadow: `0 0 10px ${C.neon}`,
              }}/>
              <span style={{ color: C.neon, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                Online
              </span>
            </div>
          </motion.div>

          {/* copyright */}
          <div style={{ marginTop: 20 }}>
            <span style={{ color: C.dim, fontSize: 11 }}>© 2026 BrainX · ERP Industrial</span>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════
          RIGHT — auth card
      ═══════════════════════════════════════ */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '32px 24px', background: C.bg, position: 'relative',
      }}>
        {/* subtle top accent line */}
        <div className="absolute top-0 left-0 right-0 h-px" style={{
          background: `linear-gradient(90deg, transparent, ${C.neon}18, ${C.blue}18, transparent)`,
        }}/>

        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.42 }}
          style={{ width: '100%', maxWidth: 440 }}
        >
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: `linear-gradient(140deg, ${C.neon}, ${C.blue})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 0 20px ${C.neon}25`,
            }}>
              <IconBrainX size={20} color="#fff" />
            </div>
            <div>
              <div style={{ color: C.text, fontWeight: 800, fontSize: 16 }}>BrainX Industrial OS</div>
              <div style={{ color: C.dim, fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase' }}>Sistema de Gestão</div>
            </div>
          </div>

          {/* Card */}
          <div style={{
            background: C.card,
            border: `1px solid ${C.border2}`,
            borderRadius: 14,
            overflow: 'hidden',
            boxShadow: `0 0 0 1px ${C.border}40, 0 24px 60px -16px ${C.bg}`,
          }}>
            {/* Card top stripe */}
            <div style={{
              height: 3,
              background: `linear-gradient(90deg, ${C.neon}, ${C.blue}, ${C.indigo})`,
            }}/>

            <div style={{ padding: '32px 32px 28px' }}>

              {/* Header */}
              <div style={{ marginBottom: 28 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div>
                    <h2 style={{ color: C.text, fontWeight: 800, fontSize: 22, letterSpacing: '-0.03em', margin: 0 }}>
                      {tab === 'login' ? 'Acesso ao Sistema' : 'Criar Conta'}
                    </h2>
                    <p style={{ color: C.sub, fontSize: 13.5, margin: '6px 0 0', lineHeight: 1.5 }}>
                      {tab === 'login'
                        ? 'Autentique-se para acessar o painel industrial'
                        : 'Preencha os dados para se cadastrar no sistema'}
                    </p>
                  </div>
                  {/* Encrypted badge */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    border: `1px solid ${C.neon}22`, background: `${C.neon}08`,
                    borderRadius: 6, padding: '5px 9px', flexShrink: 0, marginLeft: 12,
                  }}>
                    <IconShieldLock size={11} color={C.neon} />
                    <span style={{ color: C.neon, fontSize: 9.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                      TLS 1.3
                    </span>
                  </div>
                </div>
              </div>

              {/* Tab */}
              <div style={{
                display: 'flex', gap: 0,
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 9, padding: 3, marginBottom: 28,
              }}>
                {(['login', 'register'] as const).map(t => (
                  <button key={t} onClick={() => setTab(t)} style={{
                    flex: 1, padding: '8px 0', borderRadius: 7,
                    border: 'none', cursor: 'pointer',
                    fontSize: 12.5, fontWeight: 700, letterSpacing: '0.03em',
                    transition: 'all 0.2s',
                    background: tab === t
                      ? `linear-gradient(135deg, ${C.neon}14, ${C.blue}14)`
                      : 'transparent',
                    color: tab === t ? C.text : C.dim,
                    boxShadow: tab === t ? `inset 0 0 0 1px ${C.border2}` : 'none',
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
                    exit={{ opacity: 0, x: 6 }} transition={{ duration: 0.16 }}
                    onSubmit={handleLogin}
                    style={{ display: 'flex', flexDirection: 'column', gap: 18 }}
                  >
                    <Field id="login-email" label="E-mail" type="email" placeholder="usuario@empresa.com.br"
                      value={loginEmail} onChange={e => setLoginEmail(e.target.value)} Icon={IconMail} required />
                    <Field id="login-pass" label="Senha" type="password" placeholder="••••••••"
                      value={loginPass} onChange={e => setLoginPass(e.target.value)} Icon={IconLock} required />
                    <PrimaryBtn loading={loading} loadText="Autenticando..." text="Acessar Sistema" />
                  </motion.form>
                ) : (
                  <motion.form key="register"
                    initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -6 }} transition={{ duration: 0.16 }}
                    onSubmit={handleRegister}
                    style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
                  >
                    <Field id="reg-name" label="Nome Completo" type="text" placeholder="Seu nome completo"
                      value={regName} onChange={e => setRegName(e.target.value)} Icon={IconUser} required />
                    <Field id="reg-email" label="E-mail Corporativo" type="email" placeholder="usuario@empresa.com.br"
                      value={regEmail} onChange={e => setRegEmail(e.target.value)} Icon={IconMail} required />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                      <Field id="reg-pass" label="Senha" type="password" placeholder="Mínimo 6 dígitos"
                        value={regPass} onChange={e => setRegPass(e.target.value)} Icon={IconLock} required minLength={6} />
                      <Field id="reg-confirm" label="Confirmar Senha" type="password" placeholder="Repita a senha"
                        value={regConfirm} onChange={e => setRegConfirm(e.target.value)} Icon={IconLock} required minLength={6} />
                    </div>
                    {mismatch && (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 7,
                        padding: '10px 12px', borderRadius: 7,
                        border: `1px solid ${C.error}30`, background: `${C.error}08`,
                      }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.error} strokeWidth="2" strokeLinecap="round">
                          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r="1" fill={C.error}/>
                        </svg>
                        <span style={{ color: C.error, fontSize: 12, fontWeight: 500 }}>As senhas não coincidem</span>
                      </div>
                    )}
                    <PrimaryBtn loading={loading} disabled={mismatch} loadText="Cadastrando..." text="Criar Conta" />
                  </motion.form>
                )}
              </AnimatePresence>

              {/* Footer badges */}
              <div style={{
                marginTop: 24, paddingTop: 20,
                borderTop: `1px solid ${C.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <IconShieldLock size={12} color={C.dim} />
                  <span style={{ color: C.dim, fontSize: 11 }}>Sessão criptografada</span>
                </div>
                <div style={{ width: 1, height: 13, background: C.border }}/>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <IconCheckCircle size={12} color={C.dim} />
                  <span style={{ color: C.dim, fontSize: 11 }}>Acesso auditado</span>
                </div>
                <div style={{ width: 1, height: 13, background: C.border }}/>
                <span style={{ color: C.dim, fontSize: 11 }}>ANVISA RDC</span>
              </div>
            </div>
          </div>

          {/* Below card */}
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <span style={{ color: C.dim, fontSize: 11 }}>
              © 2026 BrainX Industrial OS · Acesso restrito a operadores autorizados
            </span>
          </div>
        </motion.div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
