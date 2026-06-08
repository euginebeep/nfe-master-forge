-- ── ALERTAS NORMATIVOS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.anvisa_alertas_normativos (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo          TEXT NOT NULL DEFAULT 'ATUALIZACAO'
                CHECK (tipo IN ('NOVA_IN','NOVA_RDC','ALTERACAO_LIMITE',
                                'NOVO_CONSTITUINTE','CONSTITUINTE_REMOVIDO',
                                'ALEGACAO_ALTERADA','ATUALIZACAO')),
  titulo        TEXT NOT NULL,
  descricao     TEXT,
  norma         TEXT,           -- ex: 'IN 438/2026', 'RDC 843/2024'
  constituintes_afetados TEXT[], -- nomes dos constituintes alterados
  fonte_url     TEXT,
  lido          BOOLEAN DEFAULT false,
  critico       BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT ON public.anvisa_alertas_normativos TO authenticated;
GRANT ALL ON public.anvisa_alertas_normativos TO service_role;
ALTER TABLE public.anvisa_alertas_normativos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view alerts" ON public.anvisa_alertas_normativos
  FOR SELECT USING (auth.role() = 'authenticated');

-- ── HISTÓRICO DE SYNC DO POWER BI ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.anvisa_powerbi_sync_log (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  status          TEXT NOT NULL DEFAULT 'ok',
  registros_processados INTEGER DEFAULT 0,
  erro            TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT ON public.anvisa_powerbi_sync_log TO authenticated;
GRANT ALL ON public.anvisa_powerbi_sync_log TO service_role;
ALTER TABLE public.anvisa_powerbi_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view sync logs" ON public.anvisa_powerbi_sync_log
  FOR SELECT USING (auth.role() = 'authenticated');

-- ── AJUSTES NA TABELA DE CONSTITUINTES ───────────────────────────────────
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='anvisa_constituintes' AND column_name='ultima_verificacao') THEN
    ALTER TABLE public.anvisa_constituintes ADD COLUMN ultima_verificacao TIMESTAMPTZ DEFAULT now();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='anvisa_constituintes' AND column_name='status_normativo') THEN
    ALTER TABLE public.anvisa_constituintes ADD COLUMN status_normativo TEXT DEFAULT 'regular';
  END IF;
END $$;
