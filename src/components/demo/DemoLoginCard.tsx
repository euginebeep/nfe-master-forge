import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Copy, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const DEMO_EMAIL = 'demo@brainxerp.com';
const DEMO_PASSWORD = 'BrainXDemo2026!';

export function DemoLoginCard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const enterDemo = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
    });
    setLoading(false);
    if (error) {
      toast.error('Demo ainda não está pronta. Tente novamente em alguns minutos.');
      return;
    }
    navigate('/');
  };

  const copyCreds = () => {
    navigator.clipboard.writeText(`${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{
      marginTop: 16,
      background: 'linear-gradient(135deg, #fff8e1 0%, #fff3cd 100%)',
      border: '2px solid #ffc107',
      borderRadius: 8,
      padding: '18px 20px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 18 }}>🎬</span>
        <strong style={{ color: '#664d03', fontSize: 14 }}>
          Experimente a Demo Completa
        </strong>
      </div>
      <p style={{ color: '#664d03', fontSize: 12.5, lineHeight: 1.5, margin: '0 0 12px' }}>
        Conta de demonstração com dados pré-carregados. Veja todos os módulos sem cadastrar nada.
      </p>
      <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
        <button
          onClick={enterDemo}
          disabled={loading}
          style={{
            flex: 1, height: 40,
            background: loading ? '#ffc10799' : '#ffc107',
            color: '#212529', fontWeight: 600, fontSize: 13.5,
            border: 'none', borderRadius: 6,
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          <Play className="h-4 w-4" /> {loading ? 'Entrando...' : 'Entrar na Demo'}
        </button>
        <button
          onClick={copyCreds}
          title="Copiar credenciais"
          style={{
            width: 40, height: 40,
            background: '#fff', border: '1px solid #ffc107',
            borderRadius: 6, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4 text-yellow-700" />}
        </button>
      </div>
      <div style={{ fontSize: 11, color: '#856404', marginTop: 8, fontFamily: 'monospace' }}>
        {DEMO_EMAIL} • {DEMO_PASSWORD}
      </div>
    </div>
  );
}