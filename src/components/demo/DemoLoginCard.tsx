import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Copy, Check, User, Mail, Phone, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { maskPhone } from '@/lib/masks';

const DEMO_EMAIL = 'demo@brainxerp.com';
const DEMO_PASSWORD = 'BrainxERPDemo2026!';

export function DemoLoginCard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [copied, setCopied] = useState(false);

  // Lead form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);

  const validatePhone = (p: string) => {
    const digits = p.replace(/\D/g, '');
    // Prevents simple repetition like 0000000000 or 1111111111
    if (digits.length < 10 || /^(\d)\1+$/.test(digits)) return false;
    return true;
  };

  const enterDemo = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!showForm) {
      setShowForm(true);
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!name.trim() || !email.trim() || !phone.trim()) {
      toast.error('Preencha todos os campos para acessar a demo');
      return;
    }

    if (!emailRegex.test(email)) {
      toast.error('Informe um e-mail válido');
      return;
    }

    if (!validatePhone(phone)) {
      toast.error('Informe um número de celular válido');
      return;
    }

    if (!consent) {
      toast.error('É necessário aceitar os termos para acessar a demonstração');
      return;
    }

    setLoading(true);

    try {
      const normalizedEmail = email.toLowerCase().trim();
      const normalizedPhone = phone.replace(/\D/g, '');

      // Check for existing lead and 15-day limit
      const { data: existingLead, error: checkError } = await supabase
        .from('demo_leads')
        .select('created_at')
        .or(`email.eq.${normalizedEmail},phone.eq.${normalizedPhone}`)
        .maybeSingle();

      if (checkError) {
        console.error('Erro ao verificar lead:', checkError);
      }

      if (existingLead) {
        const createdAt = new Date(existingLead.created_at);
        const now = new Date();
        const diffInDays = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

        if (diffInDays > 15) {
          toast.error('Seu período de demonstração de 15 dias expirou. Entre em contato com o suporte para continuar.');
          setLoading(false);
          return;
        }

        toast.info('Identificamos seu cadastro anterior. Seus dados foram atualizados e o acesso liberado.');
      }

      // 1. Save/Update Lead
      const { error: leadError } = await supabase.from('demo_leads').upsert({
        name,
        email: normalizedEmail,
        phone: normalizedPhone,
        updated_at: new Date().toISOString()
      }, { onConflict: 'email, phone' });

      if (leadError) {
        console.error('Erro ao salvar lead:', leadError);
      }

      // 2. Auth
      let { error } = await supabase.auth.signInWithPassword({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
      });

      // Se ainda não existe, provisiona via bootstrap e tenta novamente
      if (error) {
        toast.info('Preparando conta demo... isso pode levar até 1 minuto.');
        const { error: bootErr } = await supabase.functions.invoke('bootstrap-demo-user');
        if (bootErr) {
          setLoading(false);
          toast.error('Falha ao preparar demo: ' + bootErr.message);
          return;
        }
        const retry = await supabase.auth.signInWithPassword({
          email: DEMO_EMAIL,
          password: DEMO_PASSWORD,
        });
        error = retry.error;
      }

      if (error) {
        toast.error('Demo indisponível: ' + error.message);
        return;
      }
      
      toast.success('Bem-vindo à demonstração!');
      navigate('/');
    } catch (err: any) {
      toast.error('Erro ao acessar demo: ' + err.message);
    } finally {
      setLoading(false);
    }
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
      
      {!showForm ? (
        <>
          <p style={{ color: '#664d03', fontSize: 12.5, lineHeight: 1.5, margin: '0 0 12px' }}>
            Conta de demonstração com dados pré-carregados. Veja todos os módulos sem cadastrar nada.
          </p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
            <button
              onClick={() => enterDemo()}
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
        </>
      ) : (
        <form onSubmit={enterDemo} className="space-y-3 mt-2">
          <div className="space-y-1">
            <Label htmlFor="demo-name" className="text-xs font-semibold text-yellow-900">Nome completo</Label>
            <div className="relative">
              <User className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-yellow-700" />
              <Input 
                id="demo-name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Seu nome"
                required
                className="pl-8 h-9 border-yellow-400 focus-visible:ring-yellow-500 bg-white/50"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="demo-email" className="text-xs font-semibold text-yellow-900">Seu melhor e-mail</Label>
            <div className="relative">
              <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-yellow-700" />
              <Input 
                id="demo-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="email@empresa.com"
                required
                className="pl-8 h-9 border-yellow-400 focus-visible:ring-yellow-500 bg-white/50"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="demo-phone" className="text-xs font-semibold text-yellow-900">WhatsApp / Celular</Label>
            <div className="relative">
              <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-yellow-700" />
              <Input 
                id="demo-phone"
                value={phone}
                onChange={e => setPhone(maskPhone(e.target.value))}
                placeholder="(00) 00000-0000"
                required
                className="pl-8 h-9 border-yellow-400 focus-visible:ring-yellow-500 bg-white/50"
              />
            </div>
          </div>

          <div className="flex items-start gap-2 p-2 bg-yellow-500/10 rounded border border-yellow-500/20">
            <Checkbox 
              id="consent" 
              checked={consent} 
              onCheckedChange={(v) => setConsent(v as boolean)}
              className="mt-1 border-yellow-600 data-[state=checked]:bg-yellow-600"
            />
            <Label htmlFor="consent" className="text-[10px] text-yellow-800 leading-tight cursor-pointer">
              Eu autorizo o contato comercial futuro e o envio de e-mails sobre promoções e novidades do BrainxERP.
            </Label>
          </div>

          <div className="flex items-start gap-2 p-2 bg-blue-500/10 rounded border border-blue-500/20">
            <Info className="h-3.5 w-3.5 text-blue-700 shrink-0 mt-0.5" />
            <div className="text-[10px] text-blue-800 leading-tight">
              <strong>Privacidade:</strong> Seus dados serão armazenados com segurança. 
              Ao clicar em acessar, você confirma ser o titular dos dados.
              <a 
                href="/politica-de-privacidade" 
                target="_blank" 
                className="ml-1 text-blue-700 font-bold hover:underline"
              >
                Saiba mais
              </a>
            </div>
          </div>

          <Button 
            type="submit" 
            disabled={loading}
            className="w-full bg-yellow-500 hover:bg-yellow-600 text-yellow-950 font-bold h-10"
          >
            {loading ? 'Acessando...' : 'Acessar Demonstração'}
          </Button>
          
          <button 
            type="button" 
            onClick={() => setShowForm(false)}
            className="w-full text-[10px] text-yellow-800 hover:underline"
          >
            Voltar
          </button>
        </form>
      )}

      <div style={{ fontSize: 11, color: '#856404', marginTop: 8, fontFamily: 'monospace' }}>
        {DEMO_EMAIL} • {DEMO_PASSWORD}
      </div>
    </div>
  );
}
