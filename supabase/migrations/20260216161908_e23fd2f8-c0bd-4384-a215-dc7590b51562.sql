
-- Tabela para rastrear sincronizações com o portal ANVISA
CREATE TABLE public.anvisa_sync_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo TEXT NOT NULL DEFAULT 'scraping', -- 'scraping', 'manual', 'cron'
  status TEXT NOT NULL DEFAULT 'em_andamento', -- 'em_andamento', 'sucesso', 'erro', 'alerta'
  registros_atualizados INTEGER DEFAULT 0,
  registros_novos INTEGER DEFAULT 0,
  registros_removidos INTEGER DEFAULT 0,
  fonte_url TEXT,
  versao_legislacao TEXT, -- ex: 'IN 28/2018 - Atualização RDC 560/2024'
  hash_conteudo TEXT, -- hash do conteúdo scrapeado para detectar mudanças
  detalhes JSONB DEFAULT '{}',
  erro_mensagem TEXT,
  iniciado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  finalizado_em TIMESTAMPTZ,
  iniciado_por UUID REFERENCES auth.users(id)
);

ALTER TABLE public.anvisa_sync_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos podem ver histórico de sync" ON public.anvisa_sync_history
  FOR SELECT USING (true);

CREATE POLICY "Apenas autenticados podem criar sync" ON public.anvisa_sync_history
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Apenas autenticados podem atualizar sync" ON public.anvisa_sync_history
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Adicionar coluna de versão na tabela de constituintes para rastreabilidade
ALTER TABLE public.anvisa_constituintes 
  ADD COLUMN IF NOT EXISTS sync_id UUID REFERENCES public.anvisa_sync_history(id),
  ADD COLUMN IF NOT EXISTS fonte_url TEXT,
  ADD COLUMN IF NOT EXISTS verificado_em TIMESTAMPTZ;
