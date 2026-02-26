import { useState, useEffect, useCallback } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface IncomingMessage {
  id: string;
  sender_id: string;
  sender_name: string;
  content: string;
  channel: string | null;
  recipient_id: string | null;
}

interface ChatNotificationPopupProps {
  onOpenChat: (senderId: string, senderName: string) => void;
}

export function ChatNotificationPopup({ onOpenChat }: ChatNotificationPopupProps) {
  const { user } = useAuth();
  const [notification, setNotification] = useState<IncomingMessage | null>(null);

  const dismissNotification = useCallback(() => setNotification(null), []);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('chat-popup-notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        async (payload) => {
          const msg = payload.new as any;
          // Only notify if message is for me (DM) or a channel message not from me
          if (msg.sender_id === user.id) return;
          if (msg.recipient_id && msg.recipient_id !== user.id) return;

          // Fetch sender name
          const { data: profile } = await supabase
            .from('profiles')
            .select('nome_completo')
            .eq('id', msg.sender_id)
            .single();

          setNotification({
            id: msg.id,
            sender_id: msg.sender_id,
            sender_name: profile?.nome_completo || 'Usuário',
            content: msg.content,
            channel: msg.channel,
            recipient_id: msg.recipient_id,
          });

          // Auto-dismiss after 8 seconds
          setTimeout(() => {
            setNotification((prev) => (prev?.id === msg.id ? null : prev));
          }, 8000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const handleClick = () => {
    if (!notification) return;
    onOpenChat(notification.sender_id, notification.sender_name);
    setNotification(null);
  };

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

  return (
    <AnimatePresence>
      {notification && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: -20 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[9999] cursor-pointer"
          onClick={handleClick}
        >
          <div className="bg-card border-2 border-primary/30 rounded-xl shadow-2xl p-4 w-[320px] relative">
            <button
              onClick={(e) => { e.stopPropagation(); dismissNotification(); }}
              className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="relative">
                <Avatar className="h-10 w-10 border-2 border-primary/20">
                  <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">
                    {getInitials(notification.sender_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-0.5 -right-0.5 bg-primary rounded-full h-3 w-3 border-2 border-card" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <MessageCircle className="h-3.5 w-3.5 text-primary" />
                  <span className="text-sm font-semibold text-foreground">
                    {notification.sender_name}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {notification.content.length > 60
                    ? notification.content.slice(0, 60) + '…'
                    : notification.content}
                </p>
              </div>
            </div>

            <p className="text-[10px] text-muted-foreground text-center mt-2">
              Clique para responder
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
