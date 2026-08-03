CREATE TABLE IF NOT EXISTS public.anvisa_in211_completude (
  categoria        text PRIMARY KEY,
  descricao        text NOT NULL,
  estado           text NOT NULL DEFAULT 'NAO_INGERIDA',
  linhas_ingeridas int  NOT NULL DEFAULT 0,
  fonte            text,
  ingerido_em      timestamptz,
  observacao       text
);
ALTER TABLE public.anvisa_in211_completude DROP CONSTRAINT IF EXISTS chk_in211_estado;
ALTER TABLE public.anvisa_in211_completude ADD CONSTRAINT chk_in211_estado
  CHECK (estado IN ('NAO_INGERIDA','PARCIAL','COMPLETA'));

COMMENT ON TABLE public.anvisa_in211_completude IS
  'Controle de completude por categoria. O motor SO pode dizer "nao autorizado" '
  'em categoria COMPLETA. Em PARCIAL ou NAO_INGERIDA, ausencia significa que '
  'nao verificamos — nunca que e proibido. Sem esse controle, uma copia '
  'incompleta reprovaria aditivo legitimo e ensinaria a ignorar o alerta.';

CREATE TABLE IF NOT EXISTS public.anvisa_aditivos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo          text NOT NULL,
  categoria     text NOT NULL,
  funcao        text NOT NULL,
  ins           text,
  nome          text NOT NULL,
  limite_texto  text NOT NULL,
  limite_num    numeric,
  limite_unidade text,
  notas         text,
  norma_origem  text NOT NULL,
  anexo_origem  text NOT NULL,
  verificado_em date NOT NULL,
  ativo         boolean NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS idx_aditivos_categoria ON public.anvisa_aditivos(categoria);
CREATE INDEX IF NOT EXISTS idx_aditivos_nome_lower ON public.anvisa_aditivos(lower(nome));
CREATE INDEX IF NOT EXISTS idx_aditivos_ins ON public.anvisa_aditivos(ins);

ALTER TABLE public.anvisa_aditivos DROP CONSTRAINT IF EXISTS chk_aditivo_tipo;
ALTER TABLE public.anvisa_aditivos ADD CONSTRAINT chk_aditivo_tipo
  CHECK (tipo IN ('ADITIVO','COADJUVANTE'));

ALTER TABLE public.anvisa_aditivos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anvisa_in211_completude ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS aditivos_select ON public.anvisa_aditivos;
CREATE POLICY aditivos_select ON public.anvisa_aditivos FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS aditivos_write ON public.anvisa_aditivos;
CREATE POLICY aditivos_write ON public.anvisa_aditivos FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS completude_select ON public.anvisa_in211_completude;
CREATE POLICY completude_select ON public.anvisa_in211_completude FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS completude_write ON public.anvisa_in211_completude;
CREATE POLICY completude_write ON public.anvisa_in211_completude FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE public.anvisa_aditivos IS
  'CAMADA GLOBAL — IN 211/2023. Escrita so por service_role. Consultar SEMPRE '
  'junto com anvisa_in211_completude: ausencia so significa proibicao em '
  'categoria COMPLETA.';

INSERT INTO public.anvisa_in211_completude (categoria, descricao, estado, fonte, observacao, ingerido_em)
VALUES
 ('14.1','Suplementos alimentares liquidos','PARCIAL',
  'IN 452/2026, texto integral lido em 02/08/2026',
  'Apenas o delta da IN 452. A lista base do Anexo III da IN 211 NAO foi ingerida.', now()),
 ('14.2','Suplementos alimentares solidos e semissolidos','PARCIAL',
  'IN 452/2026, texto integral lido em 02/08/2026',
  'Apenas o delta da IN 452. O consolidado da IN 211 cobre TODAS as categorias de '
  'alimento e trunca antes da 14.2 em leitura por pagina. Talco 553(iii) e '
  'estearato de magnesio 470 NAO estao aqui: a linha deles em 14.2 segue sendo divida.', now()),
 ('22.0','Ingredientes nao compreendidos em outra categoria','PARCIAL',
  'IN 452/2026, texto integral lido em 02/08/2026','Apenas o delta da IN 452.', now())
ON CONFLICT (categoria) DO NOTHING;