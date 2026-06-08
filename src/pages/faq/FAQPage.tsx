import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/ui/page-header";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Search, Bot, ThumbsUp, ThumbsDown, Send, Loader2, BookOpen, 
  ChevronRight, Sparkles, Rocket, Building2, Users, FileText, 
  Package, Boxes, Factory, FlaskConical, ShoppingCart, DollarSign, 
  BarChart3, Shield, Settings, Smartphone, HelpCircle, FileInput, 
  ArrowRightLeft, Copy, Check, MessageSquare
} from "lucide-react";

interface MensagemChat {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface FAQSection {
  id: string;
  icon: React.ReactNode;
  title: string;
  badge?: string;
  items: { q: string; a: string }[];
}

const faqSectionsFallback: FAQSection[] = [
  {
    id: "primeiros-passos",
    icon: <Rocket className="h-5 w-5" />,
    title: "1. Primeiros Passos",
    items: [
      { q: "Como criar minha conta no ERP?", a: "Acesse a tela de login e clique em 'Crear conta'. Preencha seu e-mail e senha (mínimo 6 caracteres). Você receberá um e-mail de verificação — clique no link para ativar sua conta. Após confirmar, faça login normalmente." },
      { q: "O que acontece no primeiro login?", a: "No primeiro acesso, você será redirecionado para a tela de Onboarding, onde deverá cadastrar os dados da sua empresa (CNPJ, Razão Social, Endereço). Este passo é obrigatório para usar o ERP." },
      { q: "Posso usar o ERP sem cadastrar a empresa?", a: "Não. O cadastro da empresa é obrigatório. Sem ele, o sistema não permite o acesso aos módulos." }
    ]
  },
  {
    id: "configuracoes-empresa",
    icon: <Building2 className="h-5 w-5" />,
    title: "2. Configurações da Empresa",
    items: [
      { q: "Como acessar as configurações da empresa?", a: "No menu lateral, clique em 'Configurações' → 'Empresa'. Lá você encontra todos os dados cadastrais, fiscais, logo e certificado digital. Apenas administradores têm acesso." },
      { q: "O que é o Regime Tributário e como preencher?", a: "O Regime Tributário define como sua empresa calcula os impostos: Simples Nacional, Lucro Presumido ou Lucro Real. Selecione o regime correto conforme orientação do seu contador." }
    ]
  }
];

export default function FAQPage() {
  const [busca, setBusca] = useState('');
  const [abaAtiva, setAbaAtiva] = useState<'manual' | 'ia'>('manual');
  const [mensagens, setMensagens] = useState<MensagemChat[]>([
    { role: 'assistant', content: 'Olá! Sou o BrainX Assistente. Posso responder qualquer dúvida sobre o ERP — produção, estoque, ANVISA, NF-e, configurações ou qualquer funcionalidade. Como posso ajudar?', timestamp: new Date() }
  ]);
  const [inputChat, setInputChat] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [copiado, setCopiado] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens]);

  const { data: secoesDB } = useQuery({
    queryKey: ['manual-secoes'],
    queryFn: async () => {
      const { data } = await supabase.from('manual_secoes').select('*').eq('ativo', true).order('ordem');
      return data || [];
    }
  });

  const { data: perguntasDB } = useQuery({
    queryKey: ['manual-perguntas', busca],
    queryFn: async () => {
      let q = supabase.from('manual_perguntas').select('*, secao:manual_secoes(titulo, icon)').eq('ativo', true).order('ordem');
      if (busca.trim().length >= 2) {
        q = q.or(`pergunta.ilike.%${busca}%,resposta.ilike.%${busca}%`);
      }
      const { data } = await q.limit(200);
      return data || [];
    }
  });

  const feedbackMutation = useMutation({
    mutationFn: async ({ id, tipo }: { id: string; tipo: 'sim' | 'nao' }) => {
      const campo = tipo === 'sim' ? 'util_sim' : 'util_nao';
      await supabase.rpc('increment_manual_voto', { pergunta_id: id, campo_voto: campo });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manual-perguntas'] });
    }
  });

  const enviarParaIA = async () => {
    if (!inputChat.trim() || enviando) return;
    const pergunta = inputChat.trim();
    setInputChat('');
    setEnviando(true);
    setMensagens(prev => [...prev, { role: 'user', content: pergunta, timestamp: new Date() }]);

    try {
      const historico = mensagens.slice(-6).map(m => ({ role: m.role, content: m.content }));
      const { data, error } = await supabase.functions.invoke('manual-ia', {
        body: { pergunta, historico_chat: historico }
      });
      if (error) throw error;
      setMensagens(prev => [...prev, { role: 'assistant', content: data.resposta, timestamp: new Date() }]);
    } catch (e) {
      setMensagens(prev => [...prev, { role: 'assistant', content: 'Erro ao conectar com a IA. Tente novamente.', timestamp: new Date() }]);
    } finally {
      setEnviando(false);
    }
  };

  const usandoBanco = (secoesDB?.length || 0) > 0;
  const buscaAtiva = busca.trim().length >= 2;

  const renderSections = () => {
    const data = usandoBanco 
      ? (secoesDB || []).map(s => ({
          ...s,
          items: (perguntasDB || []).filter((p: any) => p.secao_id === s.id)
        }))
      : faqSectionsFallback;

    return data.map((secao: any) => (
      <Card key={secao.id} className="mb-4">
        <Accordion type="single" collapsible>
          <AccordionItem value={secao.id} className="border-0">
            <AccordionTrigger className="px-6 py-4 hover:no-underline">
              <div className="flex items-center gap-3">
                <span className="text-lg font-semibold">{secao.titulo || secao.title}</span>
                {secao.badge && <Badge variant="secondary">{secao.badge}</Badge>}
                <Badge variant="outline" className="ml-auto">{secao.items.length} perguntas</Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-4">
              <Accordion type="multiple">
                {secao.items.map((item: any, idx: number) => (
                  <AccordionItem key={idx} value={`${secao.id}-${idx}`} className="border-b last:border-0">
                    <AccordionTrigger className="text-left py-3 text-sm font-medium">{item.pergunta || item.q}</AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground whitespace-pre-line pb-4">
                      {item.resposta || item.a}
                      <div className="flex items-center gap-2 mt-4 pt-4 border-t">
                        <span className="text-xs">Foi útil?</span>
                        <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={() => feedbackMutation.mutate({ id: item.id, tipo: 'sim' })}>
                          <ThumbsUp className="h-3 w-3" /> {item.util_sim || 0}
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={() => feedbackMutation.mutate({ id: item.id, tipo: 'nao' })}>
                          <ThumbsDown className="h-3 w-3" /> {item.util_nao || 0}
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 gap-1 ml-auto text-blue-500" onClick={() => { setInputChat(`Explique melhor: ${item.pergunta || item.q}`); setAbaAtiva('ia'); }}>
                          <Sparkles className="h-3 w-3" /> Aprofundar com IA
                        </Button>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </Card>
    ));
  };

  return (
    <div className="space-y-6">
      <PageHeader title="📖 Manual do ERP — BrainX IA" description="Manual interativo com busca semântica e assistente inteligente." />

      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar no manual... (ex: XML, certificado, ANVISA)" value={busca} onChange={e => setBusca(e.target.value)} className="pl-10 h-12" />
      </div>

      <Tabs value={abaAtiva} onValueChange={(v: any) => setAbaAtiva(v)}>
        <TabsList className="grid grid-cols-2 w-full max-w-md">
          <TabsTrigger value="manual" className="gap-2"><BookOpen className="h-4 w-4" /> Manual & FAQ</TabsTrigger>
          <TabsTrigger value="ia" className="gap-2"><Bot className="h-4 w-4" /> Pergunte à IA <Badge className="bg-blue-600 text-white ml-1">IA</Badge></TabsTrigger>
        </TabsList>

        <TabsContent value="manual" className="mt-6">
          <ScrollArea className="h-[calc(100vh-280px)] pr-4">
            {renderSections()}
            {buscaAtiva && (perguntasDB?.length === 0) && (
              <Card className="p-8 text-center border-dashed">
                <Bot className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p>Não encontrou o que procurava?</p>
                <Button variant="outline" className="mt-4" onClick={() => { setInputChat(busca); setAbaAtiva('ia'); }}>
                  <Sparkles className="h-4 w-4 mr-2" /> Perguntar à IA: "{busca}"
                </Button>
              </Card>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="ia" className="mt-6">
          <Card className="flex flex-col h-[65vh]">
            <CardHeader className="py-3 px-5 border-b flex-row items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center"><Bot className="h-4 w-4 text-white" /></div>
              <div>
                <CardTitle className="text-sm">BrainX Assistente</CardTitle>
                <span className="text-xs text-green-500 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Online</span>
              </div>
            </CardHeader>
            <ScrollArea className="flex-1 p-5">
              <div className="space-y-4">
                {mensagens.map((msg, i) => (
                  <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-primary' : 'bg-blue-600'}`}>
                      {msg.role === 'user' ? <Users className="h-4 w-4 text-white" /> : <Bot className="h-4 w-4 text-white" />}
                    </div>
                    <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                {enviando && <div className="flex gap-3"><div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shrink-0 animate-pulse"><Bot className="h-4 w-4 text-white" /></div><div className="bg-muted rounded-2xl px-4 py-2 text-sm">Digitando...</div></div>}
                <div ref={chatEndRef} />
              </div>
            </ScrollArea>
            <div className="p-4 border-t flex gap-2">
              <Textarea placeholder="Digite sua dúvida..." value={inputChat} onChange={e => setInputChat(e.target.value)} className="min-h-[44px] max-h-[100px]" onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarParaIA(); } }} />
              <Button size="icon" className="h-11 w-11" onClick={enviarParaIA} disabled={!inputChat.trim() || enviando}>
                {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
