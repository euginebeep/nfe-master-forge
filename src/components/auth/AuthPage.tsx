import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, ArrowRight } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

/* ─── Design tokens ─── */
const T = {
  bg:      '#0B0F14',
  bg2:     '#11161D',
  surface: '#151C24',
  border:  '#1F2933',
  text:    '#E6EDF3',
  muted:   '#9BA3AF',
  neon:    '#00E58E',
  blue:    '#2F6BFF',
  error:   '#FF3B3B',
} as const;

/* ══════════════════════════════════════
   CUSTOM INDUSTRIAL SVG ICONS
   Únicos por projeto — sem Lucide genérico
══════════════════════════════════════ */

/** Módulo de produção: reator batelada com agitador */
const IconProducao = ({ size = 15, color = T.neon }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round">
    <rect x="6" y="3.5" width="12" height="2.5" rx="1"/>
    <path d="M7.5 6v8.5c0 2.2 2 3.5 4.5 3.5s4.5-1.3 4.5-3.5V6"/>
    <line x1="10" y1="10" x2="14" y2="10" strokeOpacity="0.45"/>
    <line x1="10" y1="12.5" x2="14" y2="12.5" strokeOpacity="0.45"/>
    {/* agitador central */}
    <line x1="12" y1="6" x2="12" y2="14.5" strokeWidth="1.1" strokeOpacity="0.7"/>
    <line x1="10" y1="8.5" x2="14" y2="8.5" strokeWidth="1.1" strokeOpacity="0.7"/>
    {/* válvulas laterais */}
    <line x1="3" y1="4.75" x2="6" y2="4.75"/>
    <circle cx="2.5" cy="4.75" r="0.9" fill={color} fillOpacity="0.2" stroke={color}/>
    <line x1="18" y1="4.75" x2="21" y2="4.75"/>
    <circle cx="21.5" cy="4.75" r="0.9" fill={color} fillOpacity="0.2" stroke={color}/>
    {/* saída */}
    <line x1="12" y1="18" x2="12" y2="21"/>
    <path d="M10 20.5 h4" strokeOpacity="0.5"/>
  </svg>
);

/** Estoque: matriz de lotes com rastreio FEFO */
const IconEstoque = ({ size = 15, color = T.neon }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.35" strokeLinecap="round">
    {/* três camadas de prateleira */}
    <rect x="2" y="4" width="9" height="4.5" rx="1" fill={color} fillOpacity="0.07"/>
    <rect x="13" y="4" width="9" height="4.5" rx="1" fill={color} fillOpacity="0.07"/>
    <rect x="2" y="10.5" width="9" height="4.5" rx="1" fill={color} fillOpacity="0.07"/>
    <rect x="13" y="10.5" width="9" height="4.5" rx="1" fill={color} fillOpacity="0.07"/>
    {/* indicador de validade (FEFO) */}
    <rect x="2" y="17" width="20" height="2.5" rx="1" fill={color} fillOpacity="0.12"/>
    <line x1="8" y1="17" x2="8" y2="19.5" strokeOpacity="0.3"/>
    <line x1="16" y1="17" x2="16" y2="19.5" strokeOpacity="0.3"/>
    {/* tick de rastreio */}
    <circle cx="5.5" cy="6.25" r="0.8" fill={color} fillOpacity="0.5"/>
    <circle cx="16.5" cy="12.75" r="0.8" fill={color} fillOpacity="0.5"/>
  </svg>
);

/** KPI executivo: dial de performance */
const IconKPI = ({ size = 15, color = T.neon }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.35" strokeLinecap="round">
    {/* arco de dial */}
    <path d="M4.5 17A9 9 0 0 1 12 3a9 9 0 0 1 7.5 14" strokeOpacity="0.3"/>
    <path d="M4.5 17A9 9 0 0 1 12 3a9 9 0 0 1 5.5 11.5" strokeWidth="1.6"/>
    {/* ponteiro */}
    <line x1="12" y1="12" x2="17" y2="8" strokeWidth="1.8"/>
    <circle cx="12" cy="12" r="1.6" fill={color} fillOpacity="0.2" strokeWidth="1.2"/>
    {/* marcações */}
    <line x1="4.5" y1="17" x2="5.5" y2="15.5" strokeOpacity="0.4"/>
    <line x1="12" y1="3" x2="12" y2="4.5" strokeOpacity="0.4"/>
    <line x1="19.5" y1="17" x2="18.5" y2="15.5" strokeOpacity="0.4"/>
    {/* barras abaixo */}
    <line x1="7" y1="20" x2="7" y2="22" strokeWidth="2"/>
    <line x1="10" y1="19" x2="10" y2="22" strokeWidth="2"/>
    <line x1="13" y1="19.5" x2="13" y2="22" strokeWidth="2"/>
    <line x1="16" y1="20.5" x2="16" y2="22" strokeWidth="2" strokeOpacity="0.35"/>
  </svg>
);

/** Conformidade ANVISA: escudo com sinal de verificação técnico */
const IconAnvisa = ({ size = 15, color = T.neon }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2.5L4.5 6v5.8c0 4.8 3.3 8.8 7.5 9.7 4.2-.9 7.5-4.9 7.5-9.7V6L12 2.5z" fill={color} fillOpacity="0.07"/>
    {/* check segmentado — estilo técnico */}
    <polyline points="8,12 10.5,14.5 16,9" strokeWidth="1.7"/>
    {/* linhas de scan regulatório */}
    <line x1="8" y1="7.5" x2="16" y2="7.5" strokeOpacity="0.25" strokeDasharray="1.5 1.5"/>
    <line x1="8" y1="16.5" x2="14" y2="16.5" strokeOpacity="0.2" strokeDasharray="1.5 1.5"/>
  </svg>
);

/** Atividade / sistema online */
const IconActivity = ({ size = 12, color = T.neon }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="2,12 6,12 8,5 10,19 13,9 15,15 17,12 22,12"/>
  </svg>
);

/** Sessão criptografada */
const IconShieldCheck = ({ size = 11, color = T.muted }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2.5L4.5 6v5.8c0 4.8 3.3 8.8 7.5 9.7 4.2-.9 7.5-4.9 7.5-9.7V6L12 2.5z"/>
    <polyline points="9,12 11,14 15,10"/>
  </svg>
);

/** Rede / acesso global */
const IconGlobe = ({ size = 11, color = T.muted }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round">
    <circle cx="12" cy="12" r="9.5"/>
    <ellipse cx="12" cy="12" rx="3.8" ry="9.5"/>
    <line x1="2.5" y1="9" x2="21.5" y2="9"/>
    <line x1="2.5" y1="15" x2="21.5" y2="15"/>
  </svg>
);

/** Logo mark: cérebro industrial / circuito neural */
const IconBrainX = ({ size = 20, color = '#fff' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    {/* hemisfério esquerdo */}
    <path d="M12 6C9 6 6 8.2 6 11.5c0 1.8.8 3.3 2 4.3-.2.6-.3 1.2-.3 1.7 0 1.4.8 2 1.8 2 .5 0 1-.2 1.5-.5"/>
    {/* hemisfério direito */}
    <path d="M12 6c3 0 6 2.2 6 5.5 0 1.8-.8 3.3-2 4.3.2.6.3 1.2.3 1.7 0 1.4-.8 2-1.8 2-.5 0-1-.2-1.5-.5"/>
    {/* corpus callosum */}
    <line x1="12" y1="6" x2="12" y2="19"/>
    {/* sinapses */}
    <circle cx="8.5" cy="10" r="1" fill={color} fillOpacity="0.6" stroke="none"/>
    <circle cx="15.5" cy="10" r="1" fill={color} fillOpacity="0.6" stroke="none"/>
    <circle cx="12" cy="13.5" r="1" fill={color} fillOpacity="0.8" stroke="none"/>
    {/* dendritos externos */}
    <line x1="6" y1="10.5" x2="4" y2="9" strokeOpacity="0.5" strokeWidth="1"/>
    <line x1="6.2" y1="13" x2="4.5" y2="14" strokeOpacity="0.5" strokeWidth="1"/>
    <line x1="18" y1="10.5" x2="20" y2="9" strokeOpacity="0.5" strokeWidth="1"/>
    <line x1="17.8" y1="13" x2="19.5" y2="14" strokeOpacity="0.5" strokeWidth="1"/>
  </svg>
);

/** Input icon: email */
const IconMail = ({ size = 16, color = T.muted }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="5" width="20" height="14" rx="2"/>
    <polyline points="2,5 12,13 22,5"/>
  </svg>
);

/** Input icon: senha */
const IconLock = ({ size = 16, color = T.muted }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="11" width="14" height="10" rx="2"/>
    <path d="M8 11V7a4 4 0 0 1 8 0v4"/>
    <circle cx="12" cy="16" r="1" fill={color}/>
  </svg>
);

/** Input icon: usuário */
const IconUser = ({ size = 16, color = T.muted }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4"/>
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
  </svg>
);

/* ─── Bullets ─── */
const BULLETS = [
  { Icon: IconProducao, label: 'Controle de Produção',   sub: 'Ordens, fórmulas e rastreabilidade industrial' },
  { Icon: IconEstoque,  label: 'Gestão de Estoque',      sub: 'Lotes, FEFO automático e alertas críticos' },
  { Icon: IconKPI,      label: 'Dashboard Executivo',    sub: 'KPIs em tempo real e inteligência operacional' },
  { Icon: IconAnvisa,   label: 'Conformidade ANVISA',    sub: 'Validações regulatórias e auditoria imutável' },
];

/* ─── Reusable styled input ─── */
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
      <span
        className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none flex items-center"
        style={{ color: focused ? T.neon : T.muted, transition: 'color 0.2s' }}
      >
        <Icon size={15} color={focused ? T.neon : T.muted} />
      </span>
      <input
        id={id} type={type} placeholder={placeholder}
        value={value} onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        required={required} minLength={minLength}
        style={{
          background: T.bg,
          border: `1px solid ${focused ? T.neon : T.border}`,
          color: T.text,
          boxShadow: focused ? `0 0 0 2px ${T.neon}18` : 'none',
          outline: 'none',
        }}
        className="w-full h-11 pl-10 pr-4 rounded-lg text-sm placeholder:text-[#9BA3AF] placeholder:opacity-30 transition-all duration-200"
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

/* ─── Submit button ─── */
function SubmitButton({ isLoading, disabled, loadingText, text }: {
  isLoading: boolean; disabled?: boolean; loadingText: string; text: string;
}) {
  return (
    <button
      type="submit"
      disabled={isLoading || disabled}
      style={{
        marginTop: 4, width: '100%', height: 44,
        borderRadius: 8, border: 'none',
        cursor: (isLoading || disabled) ? 'not-allowed' : 'pointer',
        background: `linear-gradient(135deg, ${T.neon}, ${T.blue})`,
        color: '#fff', fontWeight: 700, fontSize: 13,
        letterSpacing: '0.06em', textTransform: 'uppercase',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        opacity: (isLoading || disabled) ? 0.5 : 1,
        boxShadow: `0 0 18px ${T.neon}22`,
        transition: 'opacity 0.2s, box-shadow 0.2s',
      }}
      onMouseEnter={e => { if (!isLoading && !disabled) e.currentTarget.style.boxShadow = `0 0 28px ${T.neon}38`; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = `0 0 18px ${T.neon}22`; }}
    >
      {isLoading
        ? <><Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />{loadingText}</>
        : <><ArrowRight style={{ width: 15, height: 15 }} />{text}</>
      }
    </button>
  );
}

/* ══════════════════════════════════════
   PAGE
══════════════════════════════════════ */
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
    <div style={{ background: T.bg, minHeight: '100vh', display: 'flex', fontFamily: 'Inter, sans-serif' }}>

      {/* ══ LEFT PANEL ══ */}
      <div
        style={{ background: T.bg2, borderRight: `1px solid ${T.border}` }}
        className="hidden lg:flex lg:w-[60%] relative overflow-hidden flex-col"
      >
        {/* Grid pattern */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: `
            linear-gradient(${T.border}55 1px, transparent 1px),
            linear-gradient(90deg, ${T.border}55 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
          opacity: 0.6,
        }} />

        {/* Neon glow — top right */}
        <div className="absolute pointer-events-none" style={{
          top: '-80px', right: '-80px',
          width: 400, height: 400, borderRadius: '50%',
          background: `radial-gradient(circle, ${T.neon}12 0%, transparent 70%)`,
        }} />
        {/* Blue glow — bottom left */}
        <div className="absolute pointer-events-none" style={{
          bottom: '-100px', left: '-100px',
          width: 500, height: 500, borderRadius: '50%',
          background: `radial-gradient(circle, ${T.blue}10 0%, transparent 70%)`,
        }} />

        <div className="relative z-10 flex flex-col h-full p-12 xl:p-16">

          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}
            className="flex items-center gap-3"
          >
            <div style={{
              background: `linear-gradient(135deg, ${T.neon}, ${T.blue})`,
              borderRadius: 10, width: 40, height: 40,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 0 20px ${T.neon}30`,
            }}>
              <IconBrainX size={20} color="#fff" />
            </div>
            <div>
              <div style={{ color: T.text, fontWeight: 700, fontSize: 16, letterSpacing: '-0.01em' }}>BrainX</div>
              <div style={{ color: T.muted, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', marginTop: -2 }}>
                Industrial OS
              </div>
            </div>
          </motion.div>

          {/* Hero */}
          <motion.div
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="mt-auto mb-10"
          >
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              border: `1px solid ${T.neon}30`, background: `${T.neon}0A`,
              borderRadius: 20, padding: '4px 12px', marginBottom: 20,
            }}>
              <IconActivity size={12} color={T.neon} />
              <span style={{ color: T.neon, fontSize: 11, fontWeight: 600, letterSpacing: '0.06em' }}>
                SISTEMA OPERACIONAL INDUSTRIAL
              </span>
            </div>

            <h1 style={{
              color: T.text, fontWeight: 800, fontSize: 'clamp(28px, 3.5vw, 42px)',
              lineHeight: 1.1, letterSpacing: '-0.03em', marginBottom: 14,
            }}>
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
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.3 + i * 0.08 }}
                style={{
                  background: `${T.surface}CC`,
                  border: `1px solid ${T.border}`,
                  borderRadius: 8, padding: '14px 14px',
                  backdropFilter: 'blur(6px)',
                }}
                className="hover:border-[#2F6BFF44] transition-colors duration-300"
              >
                <b.Icon size={15} color={T.neon} />
                <div style={{ color: T.text, fontSize: 12, fontWeight: 600, marginBottom: 3, marginTop: 8 }}>{b.label}</div>
                <div style={{ color: T.muted, fontSize: 11, lineHeight: 1.45 }}>{b.sub}</div>
              </motion.div>
            ))}
          </div>

          {/* Footer */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }}
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

      {/* ══ RIGHT PANEL ══ */}
      <div style={{ background: T.bg, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <motion.div
          initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}
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
            <div style={{
              background: `linear-gradient(135deg, ${T.neon}, ${T.blue})`,
              borderRadius: 8, width: 36, height: 36,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 0 16px ${T.neon}25`,
            }}>
              <IconBrainX size={18} color="#fff" />
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
              <div style={{
                display: 'flex', alignItems: 'center', gap: 4,
                border: `1px solid ${T.neon}25`, background: `${T.neon}08`,
                borderRadius: 20, padding: '3px 8px',
              }}>
                <IconShieldCheck size={10} color={T.neon} />
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
          <div style={{
            display: 'flex', gap: 2,
            background: T.bg, border: `1px solid ${T.border}`,
            borderRadius: 8, padding: 3, marginBottom: 24,
          }}>
            {(['login', 'register'] as const).map((tab) => (
              <button
                key={tab} onClick={() => setActiveTab(tab)}
                style={{
                  flex: 1, padding: '7px 0',
                  borderRadius: 6, border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 600, letterSpacing: '0.04em',
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
                initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }} transition={{ duration: 0.18 }}
                onSubmit={handleLogin}
                style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <OSLabel htmlFor="login-email">E-mail</OSLabel>
                  <OSInput id="login-email" type="email" placeholder="usuario@empresa.com"
                    value={loginEmail} onChange={e => setLoginEmail(e.target.value)} icon={IconMail} required />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <OSLabel htmlFor="login-password">Senha</OSLabel>
                  <OSInput id="login-password" type="password" placeholder="••••••••"
                    value={loginPassword} onChange={e => setLoginPassword(e.target.value)} icon={IconLock} required />
                </div>
                <SubmitButton isLoading={isLoading} loadingText="Autenticando..." text="Acessar Sistema" />
              </motion.form>
            ) : (
              <motion.form
                key="register"
                initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.18 }}
                onSubmit={handleRegister}
                style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <OSLabel htmlFor="register-name">Nome Completo</OSLabel>
                  <OSInput id="register-name" type="text" placeholder="Seu nome completo"
                    value={registerName} onChange={e => setRegisterName(e.target.value)} icon={IconUser} required />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <OSLabel htmlFor="register-email">E-mail</OSLabel>
                  <OSInput id="register-email" type="email" placeholder="usuario@empresa.com"
                    value={registerEmail} onChange={e => setRegisterEmail(e.target.value)} icon={IconMail} required />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <OSLabel htmlFor="register-password">Senha</OSLabel>
                    <OSInput id="register-password" type="password" placeholder="••••••"
                      value={registerPassword} onChange={e => setRegisterPassword(e.target.value)} icon={IconLock} required minLength={6} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <OSLabel htmlFor="register-confirm">Confirmar</OSLabel>
                    <OSInput id="register-confirm" type="password" placeholder="••••••"
                      value={registerConfirmPassword} onChange={e => setRegisterConfirmPassword(e.target.value)} icon={IconLock} required minLength={6} />
                  </div>
                </div>
                {passwordMismatch && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: T.error, fontSize: 11 }}>
                    <span>⚠</span> As senhas não coincidem
                  </div>
                )}
                <SubmitButton isLoading={isLoading} disabled={passwordMismatch} loadingText="Cadastrando..." text="Criar Conta" />
              </motion.form>
            )}
          </AnimatePresence>

          {/* Footer badges */}
          <div style={{ marginTop: 24, paddingTop: 18, borderTop: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <IconShieldCheck size={11} color={T.muted} />
              <span style={{ color: `${T.muted}80`, fontSize: 10, letterSpacing: '0.06em' }}>Sessão criptografada</span>
            </div>
            <span style={{ width: 1, height: 12, background: T.border }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <IconGlobe size={11} color={T.muted} />
              <span style={{ color: `${T.muted}80`, fontSize: 10, letterSpacing: '0.06em' }}>Acesso seguro</span>
            </div>
          </div>
        </motion.div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
