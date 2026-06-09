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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Search, Bot, ThumbsUp, ThumbsDown, Send, Loader2, BookOpen, 
  ChevronRight, Sparkles, Rocket, Building2, Users, FileText, 
  Package, Boxes, Factory, FlaskConical, ShoppingCart, DollarSign, 
  BarChart3, Shield, Settings, Smartphone, HelpCircle, FileInput, 
  ArrowRightLeft, Copy, Check, MessageSquare, Trash2
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

const faqSections: FAQSection[] = [
  {
    id: "primeiros-passos",
    icon: <Rocket className="h-5 w-5" />,
    title: "1. Primeiros Passos",
    items: [
      { q: "Como criar minha conta no ERP?", a: "Acesse a tela de login e clique em 'Criar conta'. Preencha seu e-mail e senha (mínimo 6 caracteres). Você receberá um e-mail de verificação — clique no link para ativar sua conta. Após confirmar, faça login normalmente." },
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
  },
  {
    id: "estoque-lotes",
    icon: <Boxes className="h-5 w-5" />,
    title: "3. Estoque e Lotes (FEFO)",
    items: [
      { q: "Como o sistema gerencia lotes?", a: "O BrainX ERP utiliza a metodologia FEFO (First Expired, First Out). Ao realizar uma venda ou ordem de produção, o sistema sugere automaticamente o lote com vencimento mais próximo para garantir a rotatividade e evitar perdas." },
      { q: "Como fazer uma entrada de estoque manual?", a: "Vá em 'Cadastros' → 'Produtos/Insumos', selecione o item e clique em 'Movimentações' ou use o módulo de 'Compras' para gerar entradas via XML." }
    ]
  },
  {
    id: "producao-ops",
    icon: <Factory className="h-5 w-5" />,
    title: "4. Produção e OPs",
    items: [
      { q: "Como criar uma Ordem de Produção (OP)?", a: "No módulo de Produção, clique em 'Nova OP'. Selecione o produto acabado, a quantidade e o sistema carregará a fórmula automaticamente, reservando os insumos necessários no estoque." },
      { q: "Como registrar o apontamento de produção?", a: "Dentro da OP, utilize a aba de 'Apontamentos' para informar a quantidade produzida e as matérias-primas consumidas (conforme o lote utilizado)." }
    ]
  },
  {
    id: "anvisa-checker",
    icon: <Shield className="h-5 w-5" />,
    title: "5. ANVISA Checker",
    badge: "Exclusivo",
    items: [
      { q: "O que é o ANVISA Checker?", a: "É um módulo que valida se as substâncias e dosagens da sua fórmula estão em conformidade com as Instruções Normativas da ANVISA (como a IN 28/2018). Ele alerta sobre limites excedidos para diferentes grupos (adultos, gestantes, etc)." }
    ]
  }
];

export default function FAQPage() {
  const [busca, setBusca] = useState('');
  const [abaAtiva, setAbaAtiva] = useState<'manual' | 'ia'>('manual');
  const [secaoAtiva, setSecaoAtiva] = useState<string | null>(null);
  const [mensagens, setMensagens] = useState<MensagemChat[]>([
    { role: 'assistant', content: 'Olá! Sou o BrainX Assistente. Posso responder qualquer dúvida sobre o ERP — produção, estoque, ANVISA, NF-e, configurações ou qualquer funcionalidade. Como posso ajudar?', timestamp: new Date() }
  ]);
  const [inputChat, setInputChat] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [copiadoIdx, setCopiadoIdx] = useState<number | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens]);

  const enviarParaIA = async (perguntaInput?: string) => {
    const pergunta = perguntaInput || inputChat.trim();
    if (!pergunta || enviando) return;
    
    setInputChat('');
    setEnviando(true);
    setAbaAtiva('ia');
    setMensagens(prev => [...prev, { role: 'user', content: pergunta, timestamp: new Date() }]);

    try {
      const historico = mensagens.slice(-6).map(m => ({ role: m.role, content: m.content }));
      const { data, error } = await supabase.functions.invoke('manual-ia', {
        body: { pergunta, historico_chat: historico, secao_contexto: secaoAtiva }
      });
      if (error) throw error;
      setMensagens(prev => [...prev, { role: 'assistant', content: data.resposta, timestamp: new Date() }]);
    } catch (e) {
      setMensagens(prev => [...prev, { role: 'assistant', content: 'Erro ao conectar com a IA. Tente novamente ou abra um ticket de suporte.', timestamp: new Date() }]);
    } finally {
      setEnviando(false);
    }
  };

  const registrarFeedback = async (secaoId: string, itemIdx: number, util: boolean) => {
    try {
      await supabase.from('manual_feedback').insert({
        secao_id: secaoId,
        pergunta_idx: itemIdx,
        util: util
      });
    } catch (e) {
      console.error('Erro ao registrar feedback', e);
    }
  };

  const filteredSections = faqSections.map(section => ({
    ...section,
    items: section.items.filter(item => 
      item.q.toLowerCase().includes(busca.toLowerCase()) || 
      item.a.toLowerCase().includes(busca.toLowerCase())
    )
  })).filter(section => section.items.length > 0);

  const buscaAtiva = busca.trim().length >= 2;

  return (
    <div className="space-y-6">
      <PageHeader 
        title="📖 Manual do ERP — BrainX IA" 
        description="Manual interativo com busca semântica e assistente inteligente." 
      />

      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Buscar no manual... (ex: XML, certificado, ANVISA)" 
          value={busca} 
          onChange={e => setBusca(e.target.value)} 
          className="pl-10 h-12" 
        />
      </div>

      <div className="flex gap-1 p-1 bg-muted rounded-lg max-w-md">
        <Button 
          variant={abaAtiva === 'manual' ? 'default' : 'ghost'} 
          className="flex-1 gap-2 h-9" 
          onClick={() => setAbaAtiva('manual')}
        >
          <BookOpen className="h-4 w-4" /> Manual & FAQ
        </Button>
        <Button 
          variant={abaAtiva === 'ia' ? 'default' : 'ghost'} 
          className="flex-1 gap-2 h-9" 
          onClick={() => setAbaAtiva('ia')}
        >
          <Bot className="h-4 w-4" /> Pergunte à IA
          <Badge className="ml-1 px-1.5 h-4 bg-blue-600 border-0 text-[10px] text-white">IA</Badge>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* ÍNDICE LATERAL — apenas desktop e aba manual */}
        {abaAtiva === 'manual' && (
          <aside className="hidden lg:block space-y-2">
            <h3 className="font-semibold px-3 py-2 text-sm text-muted-foreground uppercase tracking-wider">Seções</h3>
            <ScrollArea className="h-[calc(100vh-320px)]">
              {faqSections.map(s => (
                <button
                  key={s.id}
                  onClick={() => {
                    setSecaoAtiva(s.id);
                    document.getElementById(`secao-${s.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors mb-0.5 flex items-center gap-2 ${
                    secaoAtiva === s.id 
                      ? 'bg-blue-600/10 text-blue-600 border-l-2 border-blue-600 font-medium' 
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  {s.icon}
                  <span className="truncate">{s.title.replace(/^\d+\.\s/, '')}</span>
                </button>
              ))}
            </ScrollArea>
          </aside>
        )}

        {/* CONTEÚDO PRINCIPAL */}
        <div className={abaAtiva === 'manual' ? "lg:col-span-3" : "lg:col-span-4"}>
          {abaAtiva === 'manual' ? (
            <ScrollArea className="h-[calc(100vh-280px)] pr-4">
              {buscaAtiva && filteredSections.length === 0 && (
                <Card className="p-8 text-center border-dashed">
                  <Bot className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="font-medium">Não encontrei no manual</p>
                  <p className="text-sm text-muted-foreground mb-4">A IA pode responder sua dúvida com base no contexto completo do sistema.</p>
                  <Button variant="default" onClick={() => enviarParaIA(busca)} className="gap-2">
                    <Sparkles className="h-4 w-4" /> Perguntar à IA: "{busca}"
                  </Button>
                </Card>
              )}

              {filteredSections.map((section) => (
                <div key={section.id} id={`secao-${section.id}`} className="mb-6">
                  <div className="flex items-center gap-3 mb-4 sticky top-0 bg-background/95 py-2 z-10">
                    <div className="p-2 rounded-lg bg-blue-600/10 text-blue-600">
                      {section.icon}
                    </div>
                    <h2 className="text-xl font-bold">{section.title}</h2>
                    {section.badge && <Badge className="bg-blue-600 text-white border-0">{section.badge}</Badge>}
                  </div>

                  <Accordion type="single" collapsible className="space-y-3">
                    {section.items.map((item, idx) => (
                      <AccordionItem key={idx} value={`${section.id}-${idx}`} className="border rounded-lg bg-card px-4">
                        <AccordionTrigger className="hover:no-underline py-4 text-left font-medium">
                          {item.q}
                        </AccordionTrigger>
                        <AccordionContent className="pb-4">
                          <p className="text-muted-foreground whitespace-pre-line leading-relaxed mb-4">
                            {item.a}
                          </p>
                          <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-border/50">
                            <span className="text-xs font-medium text-muted-foreground">Foi útil?</span>
                            <div className="flex items-center gap-1">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-8 px-3 gap-2"
                                onClick={() => registrarFeedback(section.id, idx, true)}
                              >
                                <ThumbsUp className="h-3 w-3" /> Sim
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-8 px-3 gap-2"
                                onClick={() => registrarFeedback(section.id, idx, false)}
                              >
                                <ThumbsDown className="h-3 w-3" /> Não
                              </Button>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 gap-2 ml-auto text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              onClick={() => enviarParaIA(`Explique melhor: ${item.q}`)}
                            >
                              <Sparkles className="h-3 w-3" /> Aprofundar com IA
                            </Button>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </div>
              ))}
            </ScrollArea>
          ) : (
            /* ABA IA — CHAT COMPLETO */
            <Card className="flex flex-col h-[calc(100vh-280px)] shadow-lg overflow-hidden border-blue-100">
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <Bot className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-sm">BrainX Assistente</h3>
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                      <span className="text-[10px] text-blue-100">Online · Especialista em BrainX ERP</span>
                    </div>
                  </div>
                </div>
                {mensagens.length > 1 && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-white hover:bg-white/10 h-8 gap-2"
                    onClick={() => setMensagens([mensagens[0]])}
                  >
                    <Trash2 className="h-3 w-3" /> Limpar
                  </Button>
                )}
              </div>

              <ScrollArea className="flex-1 p-4 bg-slate-50/50">
                <div className="space-y-6">
                  {mensagens.map((msg, i) => (
                    <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 shadow-sm ${
                        msg.role === 'user' ? 'bg-primary' : 'bg-blue-600'
                      }`}>
                        {msg.role === 'user' ? <Users className="h-5 w-5 text-white" /> : <Bot className="h-5 w-5 text-white" />}
                      </div>
                      <div className="flex flex-col max-w-[85%] gap-1">
                        <div className={`rounded-2xl px-4 py-3 text-sm shadow-sm ${
                          msg.role === 'user' 
                            ? 'bg-primary text-primary-foreground rounded-tr-none' 
                            : 'bg-white text-foreground rounded-tl-none border border-blue-50'
                        }`}>
                          {msg.content}
                        </div>
                        <div className={`text-[10px] text-muted-foreground ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                          {msg.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          {msg.role === 'assistant' && (
                            <button 
                              className="ml-2 hover:text-blue-600"
                              onClick={() => {
                                navigator.clipboard.writeText(msg.content);
                                setCopiadoIdx(i);
                                setTimeout(() => setCopiadoIdx(null), 2000);
                              }}
                            >
                              {copiadoIdx === i ? <Check className="h-3 w-3 inline" /> : <Copy className="h-3 w-3 inline" />}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {enviando && (
                    <div className="flex gap-3">
                      <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center shrink-0 shadow-sm">
                        <Bot className="h-5 w-5 text-white animate-bounce" />
                      </div>
                      <div className="bg-white border border-blue-50 rounded-2xl rounded-tl-none px-4 py-3 flex gap-1 items-center shadow-sm">
                        <div className="w-1 h-1 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.3s]" />
                        <div className="w-1 h-1 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.15s]" />
                        <div className="w-1 h-1 bg-blue-600 rounded-full animate-bounce" />
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
              </ScrollArea>

              <div className="p-4 border-t bg-white">
                <div className="flex gap-2 items-end max-w-4xl mx-auto">
                  <div className="flex-1 relative">
                    <Textarea 
                      placeholder="Digite sua dúvida sobre o sistema..." 
                      value={inputChat} 
                      onChange={e => setInputChat(e.target.value)} 
                      className="min-h-[44px] max-h-[120px] pr-10 resize-none py-3" 
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          enviarParaIA();
                        }
                      }}
                    />
                  </div>
                  <Button 
                    size="icon" 
                    className="h-11 w-11 shrink-0 shadow-md transition-all active:scale-95" 
                    onClick={() => enviarParaIA()} 
                    disabled={!inputChat.trim() || enviando}
                  >
                    {enviando ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                  </Button>
                </div>
                <p className="text-[10px] text-center text-muted-foreground mt-2">
                  A IA pode cometer erros. Verifique informações importantes no manual.
                </p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}