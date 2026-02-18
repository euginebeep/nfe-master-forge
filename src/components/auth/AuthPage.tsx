import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/use-auth';

/* ─── Design tokens ─── */
const T = {
  bg:      '#0B0F14',
  bg2:     '#0E1318',
  surface: '#131A22',
  border:  '#1E2832',
  border2: '#253040',
  text:    '#DCE8F0',
  muted:   '#5E7A8A',
  dim:     '#3A5060',
  neon:    '#00E58E',
  blue:    '#2563FF',
  error:   '#FF3B3B',
} as const;

/* ─── Custom SVG Icons ─── */
const IconNeuralCore = ({ size = 20, color = T.neon }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.2">
    <circle cx="12" cy="12" r="2.5" fill={color} fillOpacity="0.15" stroke={color} strokeWidth="1.5"/>
    <circle cx="4" cy="6" r="1.5" fill={color} fillOpacity="0.1" stroke={color}/>
    <circle cx="20" cy="6" r="1.5" fill={color} fillOpacity="0.1" stroke={color}/>
    <circle cx="4" cy="18" r="1.5" fill={color} fillOpacity="0.1" stroke={color}/>
    <circle cx="20" cy="18" r="1.5" fill={color} fillOpacity="0.1" stroke={color}/>
    <circle cx="12" cy="2" r="1.5" fill={color} fillOpacity="0.1" stroke={color}/>
    <circle cx="12" cy="22" r="1.5" fill={color} fillOpacity="0.1" stroke={color}/>
    <line x1="5.2" y1="6.8" x2="10.5" y2="11" strokeOpacity="0.5"/>
    <line x1="18.8" y1="6.8" x2="13.5" y2="11" strokeOpacity="0.5"/>
    <line x1="5.2" y1="17.2" x2="10.5" y2="13" strokeOpacity="0.5"/>
    <line x1="18.8" y1="17.2" x2="13.5" y2="13" strokeOpacity="0.5"/>
    <line x1="12" y1="3.5" x2="12" y2="9.5" strokeOpacity="0.5"/>
    <line x1="12" y1="14.5" x2="12" y2="20.5" strokeOpacity="0.5"/>
  </svg>
);

const IconBatchReactor = ({ size = 16, color = T.neon }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.3">
    <rect x="6" y="4" width="12" height="3" rx="1"/>
    <path d="M7 7v8c0 2.5 2 4 5 4s5-1.5 5-4V7"/>
    <line x1="9" y1="11" x2="15" y2="11" strokeOpacity="0.5"/>
    <line x1="9" y1="13.5" x2="15" y2="13.5" strokeOpacity="0.5"/>
    <line x1="3" y1="5.5" x2="6" y2="5.5"/>
    <line x1="18" y1="5.5" x2="21" y2="5.5"/>
    <circle cx="3" cy="5.5" r="1" fill={color} fillOpacity="0.2"/>
    <circle cx="21" cy="5.5" r="1" fill={color} fillOpacity="0.2"/>
  </svg>
);

const IconInventoryMatrix = ({ size = 16, color = T.neon }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.3">
    <rect x="2" y="3" width="7" height="7" rx="1" fillOpacity="0.08" fill={color}/>
    <rect x="15" y="3" width="7" height="7" rx="1" fillOpacity="0.08" fill={color}/>
    <rect x="2" y="14" width="7" height="7" rx="1" fillOpacity="0.08" fill={color}/>
    <rect x="15" y="14" width="7" height="7" rx="1" fillOpacity="0.08" fill={color}/>
    <line x1="9" y1="6.5" x2="15" y2="6.5" strokeDasharray="1.5 1.5" strokeOpacity="0.5"/>
    <line x1="9" y1="17.5" x2="15" y2="17.5" strokeDasharray="1.5 1.5" strokeOpacity="0.5"/>
    <line x1="5.5" y1="10" x2="5.5" y2="14" strokeDasharray="1.5 1.5" strokeOpacity="0.5"/>
    <line x1="18.5" y1="10" x2="18.5" y2="14" strokeDasharray="1.5 1.5" strokeOpacity="0.5"/>
  </svg>
);

const IconKPIRadar = ({ size = 16, color = T.neon }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.3">
    <polygon points="12,2 21,8.5 21,15.5 12,22 3,15.5 3,8.5" fillOpacity="0.05" fill={color}/>
    <polygon points="12,6 17.5,9.75 17.5,14.25 12,18 6.5,14.25 6.5,9.75" fillOpacity="0.05" fill={color}/>
    <polygon points="12,9 14.8,11 14.8,13 12,15 9.2,13 9.2,11" fillOpacity="0.1" fill={color}/>
    <line x1="12" y1="2" x2="12" y2="22" strokeOpacity="0.2"/>
    <line x1="3" y1="8.5" x2="21" y2="15.5" strokeOpacity="0.2"/>
    <line x1="3" y1="15.5" x2="21" y2="8.5" strokeOpacity="0.2"/>
  </svg>
);

const IconComplianceShield = ({ size = 16, color = T.neon }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.3">
    <path d="M12 2L4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6L12 2z" fillOpacity="0.06" fill={color}/>
    <polyline points="8,12 11,15 16,9" strokeWidth="1.8" stroke={color}/>
    <line x1="12" y1="6" x2="12" y2="7.5" strokeOpacity="0.4"/>
    <line x1="8" y1="7" x2="9" y2="8" strokeOpacity="0.4"/>
    <line x1="16" y1="7" x2="15" y2="8" strokeOpacity="0.4"/>
  </svg>
);

const IconMail = ({ size = 16, color = T.muted }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.4">
    <rect x="2" y="5" width="20" height="14" rx="2"/>
    <polyline points="2,5 12,13 22,5"/>
    <line x1="2" y1="19" x2="8" y2="13" strokeOpacity="0.3"/>
    <line x1="22" y1="19" x2="16" y2="13" strokeOpacity="0.3"/>
  </svg>
);

const IconLock = ({ size = 16, color = T.muted }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.4">
    <rect x="5" y="11" width="14" height="10" rx="2"/>
    <path d="M8 11V7a4 4 0 1 1 8 0v4"/>
    <circle cx="12" cy="16" r="1.2" fill={color} fillOpacity="0.6"/>
    <line x1="12" y1="17.2" x2="12" y2="19" strokeWidth="1.6"/>
  </svg>
);

const IconUser = ({ size = 16, color = T.muted }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.4">
    <circle cx="12" cy="8" r="4"/>
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
    <line x1="8" y1="20" x2="16" y2="20" strokeOpacity="0.3"/>
  </svg>
);

const IconSpinner = ({ size = 16, color = '#fff' }: { size?: number; color?: string }) => (
  <motion.svg
    width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"
    animate={{ rotate: 360 }}
    transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
  >
    <circle cx="12" cy="12" r="10" strokeOpacity="0.15"/>
    <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/>
  </motion.svg>
);

const IconArrow = ({ size = 14, color = '#fff' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2">
    <line x1="4" y1="12" x2="20" y2="12"/>
    <polyline points="14,6 20,12 14,18"/>
  </svg>
);

/* ─── Bullets data ─── */
const BULLETS = [
  { Icon: IconBatchReactor,    label: 'Controle de Produção',  sub: 'Ordens, fórmulas e rastreabilidade industrial' },
  { Icon: IconInventoryMatrix, label: 'Gestão de Estoque',     sub: 'Lotes FEFO, quarentena e alertas críticos' },
  { Icon: IconKPIRadar,        label: 'Dashboard Executivo',   sub: 'KPIs industriais em tempo real' },
  { Icon: IconComplianceShield,label: 'Conformidade ANVISA',   sub: 'Validação regulatória e auditoria imutável' },
];

/* ─── Pulsing dot ─── */
function PulseDot() {
  return (
    <span className="relative flex items-center justify-center" style={{ width: 8, height: 8 }}>
      <motion.span
        className="absolute rounded-full"
        style={{ background: T.neon, width: 8, height: 8, opacity: 0.25 }}
        animate={{ scale: [1, 2], opacity: [0.25, 0] }}
        transition={{ duration: 1.4, repeat: Infinity }}
      />
      <span className="rounded-full" style={{ background: T.neon, width: 6, height: 6, boxShadow: `0 0 6px ${T.neon}` }} />
    </span>
  );
}

/* ─── Input ─── */
function OSInput({
  id, type, placeholder, value, onChange, icon: Icon, required, minLength,
}: {
  id: string; type: string; placeholder: string; value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  icon: ({ size, color }: { size?: number; color?: string }) => JSX.Element;
  required?: boolean; minLength?: number;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
        <Icon size={15} color={focused ? T.neon : T.dim} />
      </span>
      <input
        id={id} type={type} placeholder={placeholder}
        value={value} onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        required={required} minLength={minLength}
        style={{
          background: focused ? '#0D1520' : T.bg,
          border: `1px solid ${focused ? T.neon + '60' : T.border2}`,
          color: T.text,
          outline: 'none',
          boxShadow: focused ? `0 0 0 2px ${T.neon}12, inset 0 1px 0 ${T.neon}08` : `inset 0 1px 0 ${T.border}`,
          fontFamily: 'ui-monospace, "Cascadia Code", "SF Mono", Menlo, monospace',
          fontSize: 12.5,
          letterSpacing: '0.01em',
          transition: 'all 0.18s ease',
        }}
        className="w-full h-10 pl-9 pr-3 rounded-md placeholder:text-[#2E4455]"
      />
    </div>
  );
}

/* ─── Label ─── */
function OSLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      style={{ color: T.dim, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700, fontFamily: 'ui-monospace, monospace' }}
    >
      {children}
    </label>
  );
}

/* ─── Scanline overlay ─── */
function ScanlineGrid() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Grid */}
      <div style={{
        backgroundImage: `linear-gradient(${T.border}40 1px, transparent 1px), linear-gradient(90deg, ${T.border}40 1px, transparent 1px)`,
        backgroundSize: '40px 40px',
        opacity: 0.5,
        width: '100%', height: '100%',
      }} />
      {/* Scan line */}
      <motion.div
        style={{ position: 'absolute', left: 0, right: 0, height: '1px', background: `linear-gradient(90deg, transparent, ${T.neon}20, transparent)` }}
        animate={{ top: ['0%', '100%'] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
      />
    </div>
  );
}

/* ─── Corner marks ─── */
function CornerMarks({ color = T.neon }: { color?: string }) {
  const mk = (pos: React.CSSProperties, rx: string, ry: string) => (
    <div style={{ position: 'absolute', ...pos, width: 10, height: 10,
      borderTop: rx === 'top' ? `1px solid ${color}` : 'none',
      borderBottom: rx === 'bottom' ? `1px solid ${color}` : 'none',
      borderLeft: ry === 'left' ? `1px solid ${color}` : 'none',
      borderRight: ry === 'right' ? `1px solid ${color}` : 'none',
      opacity: 0.5,
    }} />
  );
  return <>
    {mk({ top: -1, left: -1 }, 'top', 'left')}
    {mk({ top: -1, right: -1 }, 'top', 'right')}
    {mk({ bottom: -1, left: -1 }, 'bottom', 'left')}
    {mk({ bottom: -1, right: -1 }, 'bottom', 'right')}
  </>;
}

/* ─── Hex Badge ─── */
function HexBadge({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 8px 3px 6px',
      border: `1px solid ${T.neon}25`, background: `${T.neon}07`, borderRadius: 4,
    }}>
      <svg width="7" height="8" viewBox="0 0 7 8" fill={T.neon} fillOpacity="0.8">
        <polygon points="3.5,0 7,2 7,6 3.5,8 0,6 0,2"/>
      </svg>
      <span style={{ color: T.neon, fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', fontFamily: 'ui-monospace, monospace' }}>
        {label}
      </span>
    </div>
  );
}

/* ─── Stat pill ─── */
function StatPill({ val, label }: { val: string; label: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ color: T.neon, fontWeight: 800, fontSize: 18, letterSpacing: '-0.03em', fontFamily: 'ui-monospace, monospace' }}>{val}</div>
      <div style={{ color: T.muted, fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 1 }}>{label}</div>
    </div>
  );
}

/* ─── Main component ─── */
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
    <div style={{ background: T.bg, minHeight: '100vh', display: 'flex', fontFamily: '"Inter", system-ui, sans-serif' }}>

      {/* ══ LEFT PANEL ══ */}
      <div style={{ background: T.bg2, borderRight: `1px solid ${T.border}`, width: '60%' }}
        className="hidden lg:flex relative overflow-hidden flex-col">

        <ScanlineGrid />

        {/* Glow blobs */}
        <div className="absolute pointer-events-none" style={{
          top: -120, right: -80, width: 380, height: 380, borderRadius: '50%',
          background: `radial-gradient(circle, ${T.neon}0D 0%, transparent 65%)`,
        }} />
        <div className="absolute pointer-events-none" style={{
          bottom: -120, left: -80, width: 440, height: 440, borderRadius: '50%',
          background: `radial-gradient(circle, ${T.blue}0B 0%, transparent 65%)`,
        }} />
        <div className="absolute pointer-events-none" style={{
          top: '40%', left: '30%', width: 260, height: 260, borderRadius: '50%',
          background: `radial-gradient(circle, ${T.neon}05 0%, transparent 60%)`,
        }} />

        <div className="relative z-10 flex flex-col h-full p-12 xl:p-14">

          {/* Logo */}
          <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}
            className="flex items-center gap-3">
            {/* Custom logo mark: circuit ring */}
            <div style={{ position: 'relative', width: 42, height: 42 }}>
              <svg width="42" height="42" viewBox="0 0 42 42" fill="none">
                {/* Outer ring */}
                <circle cx="21" cy="21" r="19" stroke={T.neon} strokeWidth="1" strokeOpacity="0.3"/>
                <circle cx="21" cy="21" r="19" stroke={T.neon} strokeWidth="1.5" strokeDasharray="8 4" strokeOpacity="0.6"/>
                {/* Inner hexagon */}
                <polygon points="21,8 31,14.5 31,27.5 21,34 11,27.5 11,14.5"
                  fill={T.neon} fillOpacity="0.08" stroke={T.neon} strokeWidth="1" strokeOpacity="0.5"/>
                {/* Neural core */}
                <circle cx="21" cy="21" r="4" fill={T.neon} fillOpacity="0.15" stroke={T.neon} strokeWidth="1.2"/>
                <circle cx="21" cy="21" r="1.5" fill={T.neon} fillOpacity="0.9"/>
                {/* Tick marks */}
                {[0,60,120,180,240,300].map(deg => (
                  <line key={deg}
                    x1={21 + 16 * Math.cos(deg * Math.PI/180)}
                    y1={21 + 16 * Math.sin(deg * Math.PI/180)}
                    x2={21 + 19 * Math.cos(deg * Math.PI/180)}
                    y2={21 + 19 * Math.sin(deg * Math.PI/180)}
                    stroke={T.neon} strokeWidth="1.2" strokeOpacity="0.5"/>
                ))}
              </svg>
            </div>
            <div>
              <div style={{ color: T.text, fontWeight: 800, fontSize: 15, letterSpacing: '-0.02em' }}>BrainX</div>
              <div style={{ color: T.muted, fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase', marginTop: -1, fontFamily: 'ui-monospace, monospace' }}>
                Industrial OS · v4.2
              </div>
            </div>
          </motion.div>

          {/* Hero */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.12 }} className="mt-auto mb-8">

            {/* Status bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <HexBadge label="SISTEMA OPERACIONAL INDUSTRIAL" />
              <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${T.border2}, transparent)` }} />
            </div>

            <h1 style={{
              color: T.text, fontWeight: 900, fontSize: 'clamp(26px, 3vw, 40px)',
              lineHeight: 1.08, letterSpacing: '-0.04em', marginBottom: 12,
            }}>
              Gestão industrial<br />
              <span style={{
                backgroundImage: `linear-gradient(90deg, ${T.neon}, ${T.blue})`,
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>inteligente</span>
              <span style={{ color: T.border2 }}> /</span>
              <span style={{ color: T.text }}> integrada.</span>
            </h1>

            <p style={{ color: T.muted, fontSize: 13, lineHeight: 1.65, maxWidth: 380 }}>
              Controle total da produção farmacêutica com rastreabilidade,
              qualidade e conformidade regulatória em tempo real.
            </p>
          </motion.div>

          {/* Bullets */}
          <div className="grid grid-cols-2 gap-2.5 mb-8">
            {BULLETS.map((b, i) => (
              <motion.div key={b.label}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.28 + i * 0.07 }}
                style={{
                  background: `linear-gradient(135deg, ${T.surface}EE, ${T.bg2}EE)`,
                  border: `1px solid ${T.border}`,
                  borderRadius: 6, padding: '12px 12px',
                  position: 'relative', overflow: 'hidden',
                }}
                whileHover={{ borderColor: T.neon + '30' }}
              >
                {/* Top accent line */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px',
                  background: `linear-gradient(90deg, ${T.neon}30, transparent)`,
                }} />
                <div style={{ marginBottom: 7 }}>
                  <b.Icon size={15} color={T.neon} />
                </div>
                <div style={{ color: T.text, fontSize: 11.5, fontWeight: 700, marginBottom: 3, letterSpacing: '-0.01em' }}>{b.label}</div>
                <div style={{ color: T.muted, fontSize: 10.5, lineHeight: 1.45 }}>{b.sub}</div>
              </motion.div>
            ))}
          </div>

          {/* Stats bar */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 14px', borderRadius: 6,
              border: `1px solid ${T.border}`,
              background: `${T.surface}AA`,
            }}>
            <StatPill val="99.8%" label="Uptime" />
            <div style={{ width: 1, height: 28, background: T.border }} />
            <StatPill val="∞" label="Rastreabilidade" />
            <div style={{ width: 1, height: 28, background: T.border }} />
            <StatPill val="21 CFR" label="Compliance" />
            <div style={{ width: 1, height: 28, background: T.border }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <PulseDot />
              <span style={{ color: T.neon, fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', fontFamily: 'ui-monospace, monospace' }}>ONLINE</span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* ══ RIGHT PANEL ══ */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', background: T.bg }}>
        <motion.div
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          style={{ width: '100%', maxWidth: 380, position: 'relative' }}
        >
          <CornerMarks />

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-7">
            <svg width="34" height="34" viewBox="0 0 42 42" fill="none">
              <circle cx="21" cy="21" r="19" stroke={T.neon} strokeWidth="1.5" strokeDasharray="8 4" strokeOpacity="0.6"/>
              <polygon points="21,8 31,14.5 31,27.5 21,34 11,27.5 11,14.5"
                fill={T.neon} fillOpacity="0.08" stroke={T.neon} strokeWidth="1" strokeOpacity="0.5"/>
              <circle cx="21" cy="21" r="4" fill={T.neon} fillOpacity="0.15" stroke={T.neon} strokeWidth="1.2"/>
              <circle cx="21" cy="21" r="1.5" fill={T.neon}/>
            </svg>
            <div>
              <div style={{ color: T.text, fontWeight: 800, fontSize: 15 }}>BrainX Industrial OS</div>
              <div style={{ color: T.muted, fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', fontFamily: 'ui-monospace, monospace' }}>Sistema de Gestão</div>
            </div>
          </div>

          {/* Card */}
          <div style={{
            background: T.surface, border: `1px solid ${T.border2}`,
            borderRadius: 10, padding: '28px 24px',
            boxShadow: `0 0 0 1px ${T.border}40, 0 16px 48px -12px ${T.bg}CC`,
            position: 'relative', overflow: 'hidden',
          }}>
            {/* Top glow */}
            <div style={{
              position: 'absolute', top: 0, left: '20%', right: '20%', height: '1px',
              background: `linear-gradient(90deg, transparent, ${T.neon}40, ${T.blue}40, transparent)`,
            }} />

            {/* Header */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div>
                  {/* Monospaced label above title */}
                  <div style={{ color: T.dim, fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', fontFamily: 'ui-monospace, monospace', marginBottom: 3 }}>
                    ACCESS CONTROL
                  </div>
                  <h2 style={{ color: T.text, fontWeight: 800, fontSize: 19, letterSpacing: '-0.025em', margin: 0 }}>
                    {activeTab === 'login' ? 'Autenticação' : 'Novo Operador'}
                  </h2>
                </div>
                {/* Auth type indicator */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  border: `1px solid ${T.neon}20`, background: `${T.neon}07`,
                  borderRadius: 4, padding: '3px 7px',
                }}>
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                    <rect x="1" y="1" width="6" height="6" rx="1" stroke={T.neon} strokeWidth="1" strokeOpacity="0.6"/>
                    <rect x="2.5" y="2.5" width="3" height="3" rx="0.5" fill={T.neon} fillOpacity="0.5"/>
                  </svg>
                  <span style={{ color: T.neon, fontSize: 8, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: 'ui-monospace, monospace' }}>
                    TLS 1.3
                  </span>
                </div>
              </div>
              <p style={{ color: T.muted, fontSize: 11.5, margin: 0 }}>
                {activeTab === 'login'
                  ? 'Credenciais necessárias para acesso ao sistema'
                  : 'Preencha os dados para registrar acesso'}
              </p>
            </div>

            {/* Tab switcher */}
            <div style={{
              display: 'flex', background: T.bg, border: `1px solid ${T.border}`,
              borderRadius: 6, padding: 2, marginBottom: 20, gap: 2,
            }}>
              {(['login', 'register'] as const).map((tab) => (
                <button key={tab} onClick={() => setActiveTab(tab)} style={{
                  flex: 1, padding: '6px 0', borderRadius: 5, border: 'none', cursor: 'pointer',
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                  fontFamily: 'ui-monospace, monospace',
                  transition: 'all 0.18s',
                  background: activeTab === tab ? T.surface : 'transparent',
                  color: activeTab === tab ? T.text : T.dim,
                  boxShadow: activeTab === tab ? `inset 0 0 0 1px ${T.border2}, 0 1px 0 ${T.border2}` : 'none',
                }}>
                  {tab === 'login' ? '⌕  Entrar' : '⊕  Cadastrar'}
                </button>
              ))}
            </div>

            {/* Forms */}
            <AnimatePresence mode="wait">
              {activeTab === 'login' ? (
                <motion.form key="login"
                  initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 6 }} transition={{ duration: 0.16 }}
                  onSubmit={handleLogin}
                  style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <OSLabel htmlFor="login-email">Identificador de Acesso</OSLabel>
                    <OSInput id="login-email" type="email" placeholder="operador@empresa.com.br"
                      value={loginEmail} onChange={e => setLoginEmail(e.target.value)} icon={IconMail} required />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <OSLabel htmlFor="login-password">Chave de Autenticação</OSLabel>
                    <OSInput id="login-password" type="password" placeholder="• • • • • • • •"
                      value={loginPassword} onChange={e => setLoginPassword(e.target.value)} icon={IconLock} required />
                  </div>

                  {/* Submit */}
                  <motion.button
                    type="submit" disabled={isLoading}
                    whileHover={!isLoading ? { scale: 1.005 } : {}}
                    whileTap={!isLoading ? { scale: 0.995 } : {}}
                    style={{
                      marginTop: 2, width: '100%', height: 42, borderRadius: 7,
                      border: `1px solid ${T.neon}30`, cursor: isLoading ? 'not-allowed' : 'pointer',
                      background: `linear-gradient(135deg, ${T.neon}18, ${T.blue}18)`,
                      color: T.text, fontWeight: 700, fontSize: 11.5,
                      letterSpacing: '0.1em', textTransform: 'uppercase',
                      fontFamily: 'ui-monospace, monospace',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      opacity: isLoading ? 0.6 : 1,
                      boxShadow: `0 0 16px ${T.neon}0E`,
                      transition: 'opacity 0.2s',
                    }}
                  >
                    {isLoading
                      ? <><IconSpinner size={14} /> Autenticando...</>
                      : <><IconArrow size={13} color={T.neon} /> Iniciar Sessão</>
                    }
                  </motion.button>
                </motion.form>
              ) : (
                <motion.form key="register"
                  initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -6 }} transition={{ duration: 0.16 }}
                  onSubmit={handleRegister}
                  style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <OSLabel htmlFor="register-name">Nome do Operador</OSLabel>
                    <OSInput id="register-name" type="text" placeholder="Nome completo"
                      value={registerName} onChange={e => setRegisterName(e.target.value)} icon={IconUser} required />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <OSLabel htmlFor="register-email">E-mail Corporativo</OSLabel>
                    <OSInput id="register-email" type="email" placeholder="operador@empresa.com.br"
                      value={registerEmail} onChange={e => setRegisterEmail(e.target.value)} icon={IconMail} required />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <OSLabel htmlFor="register-password">Senha</OSLabel>
                      <OSInput id="register-password" type="password" placeholder="• • • • • •"
                        value={registerPassword} onChange={e => setRegisterPassword(e.target.value)} icon={IconLock} required minLength={6} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <OSLabel htmlFor="register-confirm">Confirmar</OSLabel>
                      <OSInput id="register-confirm" type="password" placeholder="• • • • • •"
                        value={registerConfirmPassword} onChange={e => setRegisterConfirmPassword(e.target.value)} icon={IconLock} required minLength={6} />
                    </div>
                  </div>

                  {passwordMismatch && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6,
                      padding: '6px 10px', borderRadius: 5,
                      border: `1px solid ${T.error}30`, background: `${T.error}08`,
                    }}>
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke={T.error} strokeWidth="1.5">
                        <circle cx="5" cy="5" r="4"/>
                        <line x1="5" y1="3" x2="5" y2="5.5"/><circle cx="5" cy="7" r="0.5" fill={T.error}/>
                      </svg>
                      <span style={{ color: T.error, fontSize: 10, fontFamily: 'ui-monospace, monospace' }}>
                        Chaves não coincidem
                      </span>
                    </div>
                  )}

                  <motion.button
                    type="submit" disabled={isLoading || passwordMismatch}
                    whileHover={!isLoading && !passwordMismatch ? { scale: 1.005 } : {}}
                    whileTap={!isLoading && !passwordMismatch ? { scale: 0.995 } : {}}
                    style={{
                      marginTop: 2, width: '100%', height: 42, borderRadius: 7,
                      border: `1px solid ${T.neon}30`, cursor: (isLoading || passwordMismatch) ? 'not-allowed' : 'pointer',
                      background: `linear-gradient(135deg, ${T.neon}18, ${T.blue}18)`,
                      color: T.text, fontWeight: 700, fontSize: 11.5,
                      letterSpacing: '0.1em', textTransform: 'uppercase',
                      fontFamily: 'ui-monospace, monospace',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      opacity: (isLoading || passwordMismatch) ? 0.45 : 1,
                      boxShadow: `0 0 16px ${T.neon}0E`,
                      transition: 'opacity 0.2s',
                    }}
                  >
                    {isLoading
                      ? <><IconSpinner size={14} /> Registrando...</>
                      : <><IconArrow size={13} color={T.neon} /> Registrar Acesso</>
                    }
                  </motion.button>
                </motion.form>
              )}
            </AnimatePresence>

            {/* Footer */}
            <div style={{
              marginTop: 18, paddingTop: 14,
              borderTop: `1px solid ${T.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14,
            }}>
              {/* Encrypted */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <svg width="9" height="10" viewBox="0 0 9 10" fill="none">
                  <rect x="1" y="4" width="7" height="5.5" rx="1" stroke={T.dim} strokeWidth="1"/>
                  <path d="M2.5 4V3a2 2 0 0 1 4 0v1" stroke={T.dim} strokeWidth="1"/>
                  <circle cx="4.5" cy="6.8" r="0.8" fill={T.dim} fillOpacity="0.7"/>
                </svg>
                <span style={{ color: T.dim, fontSize: 9, letterSpacing: '0.08em', fontFamily: 'ui-monospace, monospace' }}>Sessão criptografada</span>
              </div>
              <span style={{ width: 1, height: 10, background: T.border }} />
              {/* ANVISA */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                  <circle cx="4.5" cy="4.5" r="3.5" stroke={T.dim} strokeWidth="1"/>
                  <polyline points="2.5,4.5 4,6 6.5,3" stroke={T.dim} strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
                <span style={{ color: T.dim, fontSize: 9, letterSpacing: '0.08em', fontFamily: 'ui-monospace, monospace' }}>ANVISA RDC</span>
              </div>
              <span style={{ width: 1, height: 10, background: T.border }} />
              {/* Version */}
              <span style={{ color: T.dim, fontSize: 9, fontFamily: 'ui-monospace, monospace', letterSpacing: '0.06em' }}>
                BRX-OS 4.2.1
              </span>
            </div>
          </div>

          {/* Below card: terminal hint */}
          <div style={{ textAlign: 'center', marginTop: 10 }}>
            <span style={{ color: T.dim, fontSize: 9, fontFamily: 'ui-monospace, monospace', letterSpacing: '0.06em' }}>
              © 2026 BrainX Industrial OS · Acesso restrito a operadores autorizados
            </span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
