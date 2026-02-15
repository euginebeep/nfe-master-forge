
-- Extensão para busca sem acentos
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Tabela principal de constituintes ANVISA
CREATE TABLE public.anvisa_constituintes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_tecnico TEXT NOT NULL,
  nome_popular TEXT[],
  nome_generico TEXT,
  sinonimos TEXT[],
  cas_number TEXT,
  categoria TEXT NOT NULL,
  subcategoria TEXT,
  fonte_de TEXT,
  limites_0_6_meses JSONB,
  limites_7_11_meses JSONB,
  limites_1_3_anos JSONB,
  limites_4_8_anos JSONB,
  limites_9_18_anos JSONB,
  limites_19_mais JSONB,
  limites_gestantes JSONB,
  limites_lactantes JSONB,
  alegacoes TEXT[],
  rotulagem_complementar TEXT[],
  advertencias TEXT[],
  anexo_origem TEXT NOT NULL DEFAULT 'ANEXO_I',
  norma_inclusao TEXT NOT NULL DEFAULT 'IN 28/2018',
  data_inclusao DATE,
  norma_ultima_alteracao TEXT,
  grupos_permitidos TEXT[],
  grupos_nao_autorizados TEXT[],
  restricoes_uso TEXT,
  referencias_especificacao TEXT[],
  is_proibido BOOLEAN DEFAULT FALSE,
  motivo_proibicao TEXT,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  search_vector TSVECTOR
);

-- Índices
CREATE INDEX idx_constituintes_search ON public.anvisa_constituintes USING GIN(search_vector);
CREATE INDEX idx_constituintes_categoria ON public.anvisa_constituintes(categoria);
CREATE INDEX idx_constituintes_nome ON public.anvisa_constituintes(nome_tecnico);

-- Trigger para atualizar search_vector
CREATE OR REPLACE FUNCTION public.update_constituinte_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('portuguese', COALESCE(NEW.nome_tecnico, '')), 'A') ||
    setweight(to_tsvector('portuguese', COALESCE(NEW.nome_generico, '')), 'A') ||
    setweight(to_tsvector('portuguese', COALESCE(array_to_string(NEW.nome_popular, ' '), '')), 'A') ||
    setweight(to_tsvector('portuguese', COALESCE(array_to_string(NEW.sinonimos, ' '), '')), 'B') ||
    setweight(to_tsvector('portuguese', COALESCE(NEW.fonte_de, '')), 'B') ||
    setweight(to_tsvector('portuguese', COALESCE(NEW.subcategoria, '')), 'C') ||
    setweight(to_tsvector('portuguese', COALESCE(array_to_string(NEW.alegacoes, ' '), '')), 'C');
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_constituinte_search
BEFORE INSERT OR UPDATE ON public.anvisa_constituintes
FOR EACH ROW EXECUTE FUNCTION public.update_constituinte_search_vector();

-- Tabela de alegações detalhadas
CREATE TABLE public.anvisa_alegacoes_detalhadas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  constituinte_id UUID REFERENCES public.anvisa_constituintes(id) ON DELETE CASCADE,
  texto_alegacao TEXT NOT NULL,
  requisitos_composicao TEXT,
  requisitos_rotulagem TEXT,
  grupo_populacional TEXT[],
  norma_aprovacao TEXT,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de log de consultas
CREATE TABLE public.anvisa_consultas_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  termo_buscado TEXT NOT NULL,
  constituinte_encontrado_id UUID REFERENCES public.anvisa_constituintes(id),
  resultado_encontrado BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.anvisa_constituintes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anvisa_alegacoes_detalhadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anvisa_consultas_log ENABLE ROW LEVEL SECURITY;

-- Constituintes: leitura pública, escrita para autenticados
CREATE POLICY "Constituintes visíveis para todos" ON public.anvisa_constituintes
  FOR SELECT USING (true);

CREATE POLICY "Constituintes gerenciados por autenticados" ON public.anvisa_constituintes
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- Alegações: leitura pública
CREATE POLICY "Alegações visíveis para todos" ON public.anvisa_alegacoes_detalhadas
  FOR SELECT USING (true);

CREATE POLICY "Alegações gerenciadas por autenticados" ON public.anvisa_alegacoes_detalhadas
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- Log: cada usuário vê os seus
CREATE POLICY "Log insert para autenticados" ON public.anvisa_consultas_log
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Log select próprio" ON public.anvisa_consultas_log
  FOR SELECT USING (auth.uid() = user_id);

-- Função RPC para busca em arrays (nome_popular e sinonimos)
CREATE OR REPLACE FUNCTION public.buscar_constituinte_por_nome_popular(termo_busca TEXT)
RETURNS SETOF public.anvisa_constituintes AS $$
BEGIN
  RETURN QUERY SELECT c.* FROM public.anvisa_constituintes c
  WHERE c.ativo = TRUE AND (
    EXISTS (SELECT 1 FROM unnest(c.nome_popular) AS np
      WHERE lower(unaccent(np)) LIKE '%' || lower(unaccent(termo_busca)) || '%') OR
    EXISTS (SELECT 1 FROM unnest(c.sinonimos) AS s
      WHERE lower(unaccent(s)) LIKE '%' || lower(unaccent(termo_busca)) || '%')
  )
  LIMIT 20;
END;
$$ LANGUAGE plpgsql;

-- View para exportação/Power BI
CREATE VIEW public.vw_anvisa_constituintes_completo AS
SELECT
  c.id,
  c.nome_tecnico,
  c.nome_generico,
  array_to_string(c.nome_popular, ', ') as nomes_populares,
  c.categoria,
  c.subcategoria,
  c.fonte_de,
  c.cas_number,
  c.limites_19_mais->>'min' as dose_min_adulto,
  c.limites_19_mais->>'max' as dose_max_adulto,
  c.limites_19_mais->>'unidade' as unidade_adulto,
  c.limites_gestantes->>'min' as dose_min_gestante,
  c.limites_gestantes->>'max' as dose_max_gestante,
  array_to_string(c.alegacoes, ' | ') as alegacoes,
  array_to_string(c.advertencias, ' | ') as advertencias,
  array_to_string(c.rotulagem_complementar, ' | ') as rotulagem,
  array_to_string(c.grupos_permitidos, ', ') as grupos_permitidos,
  array_to_string(c.grupos_nao_autorizados, ', ') as grupos_nao_autorizados,
  c.restricoes_uso,
  c.norma_inclusao,
  c.norma_ultima_alteracao,
  c.anexo_origem,
  c.is_proibido,
  c.motivo_proibicao,
  c.ativo
FROM public.anvisa_constituintes c
WHERE c.ativo = TRUE
ORDER BY c.nome_tecnico;
