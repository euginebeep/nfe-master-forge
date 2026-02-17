
-- Chat interno entre usuários
CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  channel TEXT DEFAULT 'geral',
  content TEXT NOT NULL,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Usuários podem ver mensagens que enviaram ou receberam, ou do canal geral
CREATE POLICY "Users can view their messages" ON public.chat_messages
  FOR SELECT USING (
    auth.uid() = sender_id 
    OR auth.uid() = recipient_id 
    OR (recipient_id IS NULL AND channel IS NOT NULL)
  );

CREATE POLICY "Users can send messages" ON public.chat_messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can delete own messages" ON public.chat_messages
  FOR DELETE USING (auth.uid() = sender_id);

-- Index for performance
CREATE INDEX idx_chat_messages_channel ON public.chat_messages(channel, created_at DESC);
CREATE INDEX idx_chat_messages_dm ON public.chat_messages(sender_id, recipient_id, created_at DESC);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
