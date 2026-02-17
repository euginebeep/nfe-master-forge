import { useState, useEffect, useRef } from 'react';
import { Send, Users, Hash, MessageCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui/page-header';

interface ChatMessage {
  id: string;
  sender_id: string;
  recipient_id: string | null;
  channel: string | null;
  content: string;
  created_at: string;
  sender?: { nome_completo: string | null };
}

interface UserProfile {
  id: string;
  nome_completo: string | null;
  cargo: string | null;
  avatar_url: string | null;
}

const CHANNELS = [
  { id: 'geral', label: 'Geral', icon: Hash },
  { id: 'producao', label: 'Produção', icon: Hash },
  { id: 'qualidade', label: 'Qualidade', icon: Hash },
  { id: 'compras', label: 'Compras', icon: Hash },
];

const ChatInternoPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const [activeChannel, setActiveChannel] = useState('geral');
  const [activeDM, setActiveDM] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch users
  const { data: users = [] } = useQuery<UserProfile[]>({
    queryKey: ['chat-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nome_completo, cargo, avatar_url')
        .neq('id', user?.id || '');
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Fetch messages
  const { data: messages = [] } = useQuery<ChatMessage[]>({
    queryKey: ['chat-messages', activeDM || activeChannel],
    queryFn: async () => {
      let query = supabase
        .from('chat_messages')
        .select('id, sender_id, recipient_id, channel, content, created_at')
        .order('created_at', { ascending: true })
        .limit(100);

      if (activeDM) {
        query = query.or(
          `and(sender_id.eq.${user?.id},recipient_id.eq.${activeDM}),and(sender_id.eq.${activeDM},recipient_id.eq.${user?.id})`
        );
      } else {
        query = query.eq('channel', activeChannel).is('recipient_id', null);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    refetchInterval: 5000,
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('chat-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, () => {
        queryClient.invalidateQueries({ queryKey: ['chat-messages'] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Send message
  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      const payload: Record<string, unknown> = {
        sender_id: user?.id,
        content,
      };
      if (activeDM) {
        payload.recipient_id = activeDM;
        payload.channel = null;
      } else {
        payload.channel = activeChannel;
        payload.recipient_id = null;
      }
      const { error } = await supabase.from('chat_messages').insert(payload as never);
      if (error) throw error;
    },
    onSuccess: () => {
      setMessage('');
      queryClient.invalidateQueries({ queryKey: ['chat-messages'] });
    },
    onError: () => toast.error('Erro ao enviar mensagem'),
  });

  const handleSend = () => {
    const trimmed = message.trim();
    if (!trimmed) return;
    sendMutation.mutate(trimmed);
  };

  const getSenderName = (senderId: string) => {
    if (senderId === user?.id) return 'Você';
    return users.find(u => u.id === senderId)?.nome_completo || 'Usuário';
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const currentTitle = activeDM
    ? users.find(u => u.id === activeDM)?.nome_completo || 'Conversa'
    : `#${activeChannel}`;

  return (
    <div className="space-y-4">
      <PageHeader
        icon={MessageCircle}
        title="Chat Interno"
        description="Comunicação em tempo real com a equipe"
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 h-[calc(100vh-220px)]">
        {/* Sidebar */}
        <Card className="md:col-span-1 overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Canais</CardTitle>
          </CardHeader>
          <CardContent className="p-2 space-y-1">
            {CHANNELS.map(ch => (
              <button
                key={ch.id}
                onClick={() => { setActiveChannel(ch.id); setActiveDM(null); }}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                  !activeDM && activeChannel === ch.id
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted'
                }`}
              >
                <ch.icon className="h-4 w-4" />
                {ch.label}
              </button>
            ))}
          </CardContent>
          <Separator />
          <CardHeader className="pb-2 pt-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4" />
              Mensagens Diretas
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            <ScrollArea className="h-[200px]">
              <div className="space-y-1">
                {users.map(u => (
                  <button
                    key={u.id}
                    onClick={() => { setActiveDM(u.id); }}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                      activeDM === u.id
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted'
                    }`}
                  >
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-[10px]">
                        {getInitials(u.nome_completo || 'U')}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate">{u.nome_completo || 'Usuário'}</span>
                  </button>
                ))}
                {users.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    Nenhum outro usuário
                  </p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Chat area */}
        <Card className="md:col-span-3 flex flex-col overflow-hidden">
          <CardHeader className="pb-2 border-b">
            <CardTitle className="text-sm flex items-center gap-2">
              {activeDM ? <Users className="h-4 w-4" /> : <Hash className="h-4 w-4" />}
              {currentTitle}
            </CardTitle>
          </CardHeader>
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="flex-1 flex items-center justify-center h-full">
                <div className="text-center">
                  <MessageCircle className="h-12 w-12 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhuma mensagem ainda</p>
                  <p className="text-xs text-muted-foreground">Seja o primeiro a enviar!</p>
                </div>
              </div>
            )}
            {messages.map(msg => {
              const isMe = msg.sender_id === user?.id;
              const name = getSenderName(msg.sender_id);
              return (
                <div key={msg.id} className={`flex gap-2 ${isMe ? 'justify-end' : ''}`}>
                  {!isMe && (
                    <Avatar className="h-7 w-7 flex-shrink-0">
                      <AvatarFallback className="text-[10px]">{getInitials(name)}</AvatarFallback>
                    </Avatar>
                  )}
                  <div className={`max-w-[70%] ${isMe ? 'order-first' : ''}`}>
                    {!isMe && <p className="text-[10px] text-muted-foreground mb-0.5 font-medium">{name}</p>}
                    <div className={`px-3 py-2 rounded-lg text-sm ${
                      isMe
                        ? 'bg-primary text-primary-foreground rounded-br-sm'
                        : 'bg-muted rounded-bl-sm'
                    }`}>
                      {msg.content}
                    </div>
                    <p className="text-[9px] text-muted-foreground mt-0.5">
                      {new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="p-3 border-t">
            <form
              onSubmit={(e) => { e.preventDefault(); handleSend(); }}
              className="flex gap-2"
            >
              <Input
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder={`Mensagem para ${currentTitle}...`}
                className="flex-1"
                autoComplete="off"
              />
              <Button type="submit" size="icon" disabled={!message.trim() || sendMutation.isPending}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ChatInternoPage;
