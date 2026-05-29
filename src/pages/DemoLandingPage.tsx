import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Check, X, Copy, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import brainxLogo from '@/assets/brainx-logo.png';

const DEMO_EMAIL = 'demo@brainxerp.com';
const DEMO_PASSWORD = 'BrainXDemo2026!';

export default function DemoLandingPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const enterDemo = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: DEMO_EMAIL, password: DEMO_PASSWORD,
    });
    setLoading(false);
    if (error) {
      toast.error('Demo indisponível no momento. Tente novamente em instantes.');
      return;
    }
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 text-white">
      <div className="max-w-5xl mx-auto px-6 py-12 md:py-20">
        <div className="flex items-center gap-3 mb-12">
          <img src={brainxLogo} alt="BrainX" className="h-12 w-12 object-contain" />
          <span className="text-xl font-bold">BrainX ERP</span>
        </div>

        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-block bg-amber-400/20 border border-amber-400/40 text-amber-200 px-3 py-1 rounded-full text-xs font-semibold mb-4">
              🎬 DEMONSTRAÇÃO GRATUITA
            </div>
            <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-4">
              Conheça o BrainX ERP por dentro
            </h1>
            <p className="text-slate-300 text-lg leading-relaxed mb-8">
              Acesse uma conta de demonstração completa, com dados industriais reais já cadastrados:
              entidades, lotes, fórmulas, ordens de produção, NF-es, financeiro e mais.
            </p>

            <button
              onClick={enterDemo}
              disabled={loading}
              className="bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold text-lg px-8 py-4 rounded-xl flex items-center gap-3 transition-colors shadow-xl shadow-amber-400/20 disabled:opacity-60"
            >
              <Play className="h-5 w-5" />
              {loading ? 'Entrando...' : 'Acessar Demo Agora'}
            </button>

            <div className="mt-6 bg-slate-800/50 border border-slate-700 rounded-lg p-4">
              <div className="text-xs text-slate-400 uppercase tracking-wider mb-2">Credenciais</div>
              <div className="font-mono text-sm flex items-center justify-between gap-2">
                <span>{DEMO_EMAIL}</span>
                <button
                  onClick={() => { navigator.clipboard.writeText(DEMO_EMAIL); toast.success('E-mail copiado'); }}
                  className="text-slate-400 hover:text-white">
                  <Copy className="h-4 w-4" />
                </button>
              </div>
              <div className="font-mono text-sm flex items-center justify-between gap-2 mt-1">
                <span>{DEMO_PASSWORD}</span>
                <button
                  onClick={() => { navigator.clipboard.writeText(DEMO_PASSWORD); toast.success('Senha copiada'); }}
                  className="text-slate-400 hover:text-white">
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="bg-slate-800/40 backdrop-blur border border-slate-700 rounded-2xl p-6">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <Check className="h-5 w-5 text-green-400" /> O que você verá funcionando
            </h3>
            <ul className="space-y-2 text-sm text-slate-300 mb-6">
              {['60 entidades (clientes, fornecedores, transportadoras)',
                '120+ itens cadastrados (vitaminas, cápsulas, embalagens, PA)',
                '80 lotes de estoque (aprovados, em quarentena, vencendo)',
                '12 fórmulas industriais com responsáveis técnicos',
                '25 NF-e de entrada com contas a pagar',
                '40 pedidos de venda + contas a receber',
                'Dashboards executivos, KPIs, relatórios',
                'Módulos de Qualidade, Produção e Expedição',
              ].map(t => (
                <li key={t} className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-400 mt-0.5 shrink-0" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>

            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <Shield className="h-5 w-5 text-amber-400" /> Restrições da demo
            </h3>
            <ul className="space-y-2 text-sm text-slate-400">
              {['Emissão real de NF-e está desabilitada',
                'Envio de e-mails está bloqueado',
                'Pagamentos via Stripe estão bloqueados',
                'Dados são resetados todo dia às 04:00',
              ].map(t => (
                <li key={t} className="flex items-start gap-2">
                  <X className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="text-center mt-16 text-slate-500 text-sm">
          Quer uma conta real? <button onClick={() => navigate('/auth')} className="text-blue-400 hover:underline">Cadastre-se aqui</button>
        </div>
      </div>
    </div>
  );
}