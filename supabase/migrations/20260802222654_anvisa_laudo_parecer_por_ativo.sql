-- Parecer POR ATIVO, persistido e citavel. Substitui a prosa do bloco "alertas".
-- Modelo tomado do laudo Nutrievo ZN-20260706-NUT-002: cada ativo tem status
-- proprio, motivo tecnico com norma, e substituicao sugerida.

CREATE TABLE IF NOT EXISTS public.anvisa_laudo_pareceres (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  laudo_id          uuid NOT NULL REFERENCES public.anvisa_laudos(id) ON DELETE RESTRICT,
  company_id        uuid NOT NULL,
  numero_item       int  NOT NULL,

  -- o que o cliente declarou
  ativo_declarado   text NOT NULL,
  dose              numeric,
  unidade           text,

  -- identidade botanica declarada (especie/parte/extrato fazem parte da
  -- autorizacao: "L-teanina" nao e igual a "L-teanina de folhas de Camellia
  -- sinensis", e Ginkgo 24%/6% e uma padronizacao especifica)
  especie_declarada text,
  parte_vegetal     text,
  tipo_extrato      text,
  padronizacao      text,

  -- o que a base disse
  constituinte_id   uuid REFERENCES public.anvisa_constituintes(id),
  chave_casada      text,
  limite_min_oficial numeric,
  limite_max_oficial numeric,
  unidade_oficial   text,
  limite_texto_oficial text,
  unidade_comparavel boolean,

  -- veredito
  status            text NOT NULL,
  motivo_tecnico    text NOT NULL,
  norma_referencia  text,
  anexo_referencia  text,
  substituicao_sugerida text,

  criado_em         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.anvisa_laudo_pareceres
  DROP CONSTRAINT IF EXISTS chk_parecer_status;
ALTER TABLE public.anvisa_laudo_pareceres
  ADD CONSTRAINT chk_parecer_status CHECK (status IN (
    'APROVADO',                 -- consta, dose dentro do limite, unidade comparavel
    'APROVAVEL_COM_CORRECAO',   -- consta, precisa ajuste de rotulagem/declaracao
    'PENDENTE_VERIFICACAO',     -- consta, mas falta dado (unidade, fonte, teor)
    'NAO_AUTORIZADO',           -- nao consta da lista de autorizados
    'AVALIAR_FITOTERAPICO',     -- botanico com uso medicinal: outra via regulatoria
    'REPROVADO_ALEGACAO'        -- alegacao terapeutica vedada
  ));

COMMENT ON COLUMN public.anvisa_laudo_pareceres.status IS
  'PENDENTE_VERIFICACAO e NAO_AUTORIZADO sao coisas diferentes: o primeiro espera '
  'dado, o segundo exige tirar o ativo da formula. Nunca colapsar em "VERIFICAR".';
COMMENT ON COLUMN public.anvisa_laudo_pareceres.unidade_comparavel IS
  'false = limite oficial em unidade incomparavel com a declarada (ex.: U.FCC/PPI '
  'contra mg). Conformidade NAO pode ser afirmada. Nunca APROVADO com false.';
COMMENT ON COLUMN public.anvisa_laudo_pareceres.substituicao_sugerida IS
  'Deve preservar proposta funcional PERMITIDA, nunca prometer a mesma eficacia '
  'terapeutica do botanico reprovado.';

CREATE INDEX IF NOT EXISTS idx_parecer_laudo ON public.anvisa_laudo_pareceres(laudo_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_parecer_item
  ON public.anvisa_laudo_pareceres(laudo_id, numero_item);

-- Coerencia: APROVADO exige constituinte casado e unidade comparavel
ALTER TABLE public.anvisa_laudo_pareceres DROP CONSTRAINT IF EXISTS chk_parecer_aprovado_coerente;
ALTER TABLE public.anvisa_laudo_pareceres ADD CONSTRAINT chk_parecer_aprovado_coerente
  CHECK (status <> 'APROVADO'
         OR (constituinte_id IS NOT NULL AND unidade_comparavel IS TRUE));

ALTER TABLE public.anvisa_laudo_pareceres ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS parecer_select ON public.anvisa_laudo_pareceres;
CREATE POLICY parecer_select ON public.anvisa_laudo_pareceres
  FOR SELECT TO authenticated
  USING (company_id = (SELECT p.company_id FROM profiles p WHERE p.id = auth.uid()));

DROP POLICY IF EXISTS parecer_insert ON public.anvisa_laudo_pareceres;
CREATE POLICY parecer_insert ON public.anvisa_laudo_pareceres
  FOR INSERT TO authenticated
  WITH CHECK (company_id = (SELECT p.company_id FROM profiles p WHERE p.id = auth.uid()));
-- Sem UPDATE nem DELETE: parecer acompanha a imutabilidade do laudo.

CREATE OR REPLACE FUNCTION public.anvisa_parecer_imutavel()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  RAISE EXCEPTION 'parecer_imutavel: parecer de laudo nao pode ser % apos gravado. '
    'Emita novo laudo e invalide o anterior.', lower(TG_OP);
END; $$;

DROP TRIGGER IF EXISTS trg_anvisa_parecer_imutavel ON public.anvisa_laudo_pareceres;
CREATE TRIGGER trg_anvisa_parecer_imutavel
  BEFORE UPDATE OR DELETE ON public.anvisa_laudo_pareceres
  FOR EACH ROW EXECUTE FUNCTION public.anvisa_parecer_imutavel();