-- Protocolo do laudo. Hoje o numero exibido no PDF (ZN-20260706-NUT-002) e
-- montado fora do banco: dois laudos podem receber o mesmo, e um laudo
-- apresentado em fiscalizacao nao e localizavel pelo numero que exibe.

ALTER TABLE public.anvisa_laudos ADD COLUMN IF NOT EXISTS protocolo text;
CREATE UNIQUE INDEX IF NOT EXISTS uq_anvisa_laudo_protocolo
  ON public.anvisa_laudos(protocolo) WHERE protocolo IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.anvisa_laudo_contador (
  company_id uuid NOT NULL,
  ano        int  NOT NULL,
  ultimo     int  NOT NULL DEFAULT 0,
  PRIMARY KEY (company_id, ano)
);
ALTER TABLE public.anvisa_laudo_contador ENABLE ROW LEVEL SECURITY;

-- Sequencial deterministico por tenant/ano. Nunca Math.random, nunca count(*)+1.
CREATE OR REPLACE FUNCTION public.proximo_protocolo_laudo(p_company_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_ano int := extract(year from now())::int; v_seq int; v_pref text;
BEGIN
  INSERT INTO anvisa_laudo_contador (company_id, ano, ultimo)
       VALUES (p_company_id, v_ano, 1)
  ON CONFLICT (company_id, ano)
    DO UPDATE SET ultimo = anvisa_laudo_contador.ultimo + 1
  RETURNING ultimo INTO v_seq;

  SELECT upper(regexp_replace(COALESCE(nome_fantasia, razao_social, 'LAU'), '[^A-Za-z]', '', 'g'))
    INTO v_pref FROM company WHERE id = p_company_id;
  v_pref := COALESCE(NULLIF(left(v_pref, 3), ''), 'LAU');

  RETURN v_pref || '-' || v_ano::text || '-' || lpad(v_seq::text, 5, '0');
END; $$;

COMMENT ON FUNCTION public.proximo_protocolo_laudo(uuid) IS
  'Sequencial por tenant/ano com UPSERT atomico. Nao usar count(*)+1: dois laudos '
  'simultaneos receberiam o mesmo numero.';

-- Atribui no INSERT, junto com o portao
CREATE OR REPLACE FUNCTION public.anvisa_laudo_protocolo_auto()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.protocolo IS NULL THEN
    NEW.protocolo := proximo_protocolo_laudo(NEW.company_id);
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_anvisa_laudo_protocolo ON public.anvisa_laudos;
CREATE TRIGGER trg_anvisa_laudo_protocolo
  BEFORE INSERT ON public.anvisa_laudos
  FOR EACH ROW EXECUTE FUNCTION public.anvisa_laudo_protocolo_auto();