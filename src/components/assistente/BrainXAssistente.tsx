import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { MessageCircle, X, Send, Loader2, Sparkles, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';

const CONTEXTO_ROTAS: Record<string, string> = {
  '/producao': 'O usuário está na área de Produção. Pode ter dúvidas sobre Ordens de Produção (OP), lotes, fórmulas, pesagem, mistura, encapsulamento, assinatura do RT.',
  '/producao/ordens': 'O usuário está na listagem de Ordens de Produção. Pode querer criar uma nova OP, entender os status (PLANEJADA, EM_PRODUCAO, FINALIZADA, BLOQUEADA) ou filtrar por produto.',
  '/producao/ordens/nova': 'O usuário está criando uma nova Ordem de Produção. Campos obrigatórios: produto, quantidade de frascos, cápsulas por frasco e data prevista. A fórmula é carregada automaticamente.',
  '/qualidade': 'O usuário está na área de Qualidade. Pode ter dúvidas sobre desvios/não-conformidades, checklist BPF, POPs, laudos.',
  '/qualidade/desvios': 'O usuário está registrando ou visualizando desvios. Severidade CRÍTICA bloqueia automaticamente a OP vinculada.',
  '/estoque': 'O usuário está na área de Estoque. Pode ter dúvidas sobre lotes de MP, lotes de produto acabado (QUARENTENA/DISPONÍVEL), FEFO.',
  '/vendas': 'O usuário está na área de Vendas. Pode ter dúvidas sobre pedidos, cotações ou emissão de NF-e.',
  '/vendas/notas-saida': 'O usuário está na tela de NF-e. Pode querer emitir uma nota fiscal, entender status (RASCUNHO, PROCESSANDO, AUTORIZADA) ou baixar o DANFE.',
  '/financeiro': 'O usuário está no módulo financeiro. Pode ter dúvidas sobre Contas a Receber, DRE ou fluxo de caixa.',
  '/cadastros': 'O usuário está nos cadastros. Pode querer cadastrar produto, cliente, fornecedor, matéria-prima ou insumo.',
  '/cadastros/produtos': 'O usuário está no cadastro de produtos. Campos importantes: código, descrição, NCM, CEST, unidade, preço. N° Notificação ANVISA obrigatório a partir set/2026.',
  '/responsaveis-tecnicos': 'O usuário está no módulo do Responsável Técnico. O RT assina digitalmente as OPs via SHA-256, liberando o lote de QUARENTENA para DISPONÍVEL.',
  '/relatorios': 'O usuário está nos relatórios. Pode querer exportar dados de produção, estoque ou financeiro.',
};

function buildSystemPrompt(rota: string, nomeUsuario: string): string {
  const contextoRota = CONTEXTO_ROTAS[rota] ??
    CONTEXTO_ROTAS[Object.keys(CONTEXTO_ROTAS).find(k => rota.startsWith(k)) ?? ''] ??
    'O usuário está usando o BrainX ERP.';

  return `Você é o Assistente BrainX ERP, um guia especialista no BrainX ERP — sistema de gestão industrial para fábricas de suplementos alimentares em cápsulas.

USUÁRIO ATUAL: ${nomeUsuario}
TELA ATUAL: ${rota}
CONTEXTO DA TELA: ${contextoRota}

PERSONALIDADE:
- Fala como colega de trabalho paciente e experiente
- Linguagem simples, direta, sem jargão desnecessário
- Nunca critica erros, só explica como corrigir
- Emojis com moderação

MÓDULOS:
- Produção: OPs (pesagem, mistura, encapsulamento, embalagem, QC)
- Qualidade: Desvios (BAIXA/MEDIA/ALTA/CRITICA), BPF, POPs, Amostra de Retenção
- Estoque: Lotes MP e PA (QUARENTENA → RT assina → DISPONÍVEL → ESGOTADO)
- Vendas/NF-e: via Nuvem Fiscal (RASCUNHO → PROCESSANDO → AUTORIZADA)
- Financeiro: Contas a Receber automáticas, DRE, fluxo de caixa
- RT: assina OPs com SHA-256, libera lote
- Rastreabilidade: QR Code + hash em /audit/[lote]

FLUXO DE PRODUÇÃO: Criar OP → Separar MPs → Pesar → Misturar (Estearato por último, máx 2 min) → Encapsular → QC peso → Amostra retenção → Embalar → RT assina → DISPONÍVEL → NF-e → Contas a Receber.

REGULATÓRIO: RDC 243/2018, 275/2002, 658/2022, 990/2025 / IN 281/2024 (notificação ANVISA obrigatória set/2026).

REGRAS:
1. Sempre em português brasileiro
2. Máximo 4 parágrafos, prefira listas
3. Guie passo a passo quando for sobre tela específica
4. Nunca invente funcionalidades
5. Termine respostas complexas com "Quer que eu detalhe algum passo?"`;
}

interface Mensagem {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const SUGESTOES_RAPIDAS: Record<string, string[]> = {
  '/producao/ordens': ['Como criar uma nova OP?', 'O que significa status BLOQUEADA?', 'Como finalizar uma OP?'],
  '/producao': ['Qual a ordem certa para misturar os ingredientes?', 'Por que o Estearato vai por último?', 'Como funciona o pré-mix geométrico?'],
  '/vendas/notas-saida': ['Como emitir uma NF-e?', 'O que é DANFE?', 'Por que a nota ficou em PROCESSANDO?'],
  '/qualidade/desvios': ['Quando usar severidade CRÍTICA?', 'O desvio crítico bloqueia a OP?', 'O que é uma não-conformidade?'],
  '/estoque': ['Por que o lote está em QUARENTENA?', 'Como funciona o FEFO?', 'Como o RT libera um lote?'],
  '/responsaveis-tecnicos': ['Como fazer a assinatura digital do RT?', 'O que é o hash SHA-256?', 'Como liberar lote para DISPONÍVEL?'],
  '/cadastros/produtos': ['O que é o N° de Notificação ANVISA?', 'O que é NCM?', 'Como cadastrar um produto novo?'],
};

export function BrainXERPAssistente() {
  const [aberto, setAberto] = useState(false);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [input, setInput] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [nomeUsuario, setNomeUsuario] = useState('Usuário');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const location = useLocation();
  const rota = location.pathname;

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setNomeUsuario(data.user.email.split('@')[0]);
    });
  }, []);

  useEffect(() => {
    if (aberto && mensagens.length === 0) {
      const contexto = CONTEXTO_ROTAS[rota] ??
        CONTEXTO_ROTAS[Object.keys(CONTEXTO_ROTAS).find(k => rota.startsWith(k)) ?? ''] ?? '';
      setMensagens([{
        id: 'welcome',
        role: 'assistant',
        content: `Oi, ${nomeUsuario}! 👋 Sou o Assistente BrainX ERP.\n\n${contexto ? `Vejo que você está em ${rota.split('/').filter(Boolean).join(' › ') || 'home'}. ` : ''}Como posso ajudar?`,
        timestamp: new Date(),
      }]);
    }
  }, [aberto, rota, nomeUsuario, mensagens.length]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [mensagens]);

  const enviar = useCallback(async (textoOverride?: string) => {
    const texto = (textoOverride ?? input).trim();
    if (!texto || carregando) return;

    const novaMensagem: Mensagem = {
      id: crypto.randomUUID(),
      role: 'user',
      content: texto,
      timestamp: new Date(),
    };
    setMensagens(prev => [...prev, novaMensagem]);
    setInput('');
    setCarregando(true);

    try {
      const historico = [...mensagens, novaMensagem]
        .filter(m => m.id !== 'welcome')
        .slice(-10)
        .map(m => ({ role: m.role, content: m.content }));

      const { data, error } = await supabase.functions.invoke('brainx-assistente', {
        body: {
          system: buildSystemPrompt(rota, nomeUsuario),
          messages: historico,
        },
      });
      if (error) throw error;
      const resposta = data?.content ?? data?.error ?? 'Desculpe, não consegui processar.';

      setMensagens(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: resposta,
        timestamp: new Date(),
      }]);
    } catch (e) {
      setMensagens(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Ops, tive um problema de conexão. Tente novamente em instantes.',
        timestamp: new Date(),
      }]);
    } finally {
      setCarregando(false);
      inputRef.current?.focus();
    }
  }, [input, carregando, mensagens, rota, nomeUsuario]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      enviar();
    }
  };

  const sugestoes = SUGESTOES_RAPIDAS[rota] ??
    SUGESTOES_RAPIDAS[Object.keys(SUGESTOES_RAPIDAS).find(k => rota.startsWith(k)) ?? ''] ??
    ['Como usar esta tela?', 'Qual o próximo passo?', 'Tem algum erro aqui?'];

  return (
    <>
      {!aberto && (
        <button
          onClick={() => setAberto(true)}
          className="fixed bottom-6 right-6 z-[9997] w-16 h-16 rounded-full bg-white text-primary-foreground shadow-lg hover:bg-white/90 transition-all hover:scale-110 flex items-center justify-center group overflow-hidden border-4 border-white dark:border-slate-900"
          title="Assistente BrainX ERP — Clique para ajuda"
        >
          <img 
            src="/brainx-mascot.png" 
            alt="Mascote IA" 
            className="w-full h-full object-cover"
          />
          <span className="absolute right-[72px] top-1/2 -translate-y-1/2 bg-foreground text-background text-xs font-medium px-3 py-1.5 rounded-lg shadow-md whitespace-nowrap pointer-events-none">
            Precisa de ajuda?
            <span className="absolute right-[-4px] top-1/2 -translate-y-1/2 w-2 h-2 bg-foreground rotate-45" />
          </span>
        </button>
      )}

      {aberto && (
        <div className="fixed bottom-6 right-6 z-[9997] w-[400px] h-[600px] bg-card border rounded-xl shadow-2xl flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b bg-primary/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Avatar className="w-8 h-8 border border-white/20 bg-white">
                  <AvatarImage src="/brainx-mascot.png" className="object-cover" />
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    <Bot className="w-4 h-4" />
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-semibold text-foreground">Assistente BrainX ERP</p>
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Online · IA contextual
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-[10px]">
                  {rota.split('/').filter(Boolean).join(' › ') || 'home'}
                </Badge>
                <button
                  onClick={() => { setAberto(false); setMensagens([]); }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
            {mensagens.map(msg => (
              <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <Avatar className="w-7 h-7 shrink-0 border border-primary/10 bg-white">
                    <AvatarImage src="/brainx-mascot.png" className="object-cover" />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      <Bot className="w-3.5 h-3.5" />
                    </AvatarFallback>
                  </Avatar>
                )}
                <div className={`max-w-[78%] px-3 py-2 rounded-lg text-sm whitespace-pre-wrap ${
                  msg.role === 'user' ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-muted rounded-bl-sm'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {carregando && (
              <div className="flex gap-2 items-center text-xs text-muted-foreground">
                <Avatar className="w-7 h-7 shrink-0 border border-primary/10 bg-white">
                  <AvatarImage src="/brainx-mascot.png" className="object-cover" />
                  <AvatarFallback className="bg-primary/10 text-primary">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  </AvatarFallback>
                </Avatar>
                Pensando...
              </div>
            )}
          </div>

          {mensagens.length <= 1 && (
            <div className="px-3 py-2 border-t bg-muted/30">
              <p className="text-[10px] font-semibold text-muted-foreground mb-1.5 uppercase">Perguntas frequentes</p>
              <div className="flex flex-wrap gap-1.5">
                {sugestoes.map(s => (
                  <button
                    key={s}
                    onClick={() => enviar(s)}
                    className="text-xs bg-background hover:bg-primary/10 hover:text-primary text-muted-foreground px-2 py-1 rounded-full border transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="p-3 border-t flex gap-2 items-end">
            <Textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Digite sua dúvida... (Enter envia)"
              className="flex-1 resize-none text-sm min-h-[40px] max-h-[120px]"
              rows={1}
            />
            <Button
              size="icon"
              onClick={() => enviar()}
              disabled={!input.trim() || carregando}
              className="h-10 w-10 shrink-0"
            >
              {carregando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}