-- Base VDR (Valores Diários de Referência, IN 75/2020) homologável pela RT.
-- Global (sem company_id) — regra ANVISA é igual pra todos os tenants.
-- Substitui o hardcode VD_REFERENCE de src/lib/anvisa-limits.ts.
-- JÁ APLICADA no banco via MCP em 2026-07-04. Este arquivo mantém repo↔banco sincronizados.

CREATE TABLE IF NOT EXISTS public.anvisa_vdr (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave text NOT NULL UNIQUE,                 -- casa com resolveAnvisaKey (ex.: 'magnesio')
  nutriente text NOT NULL,                    -- rótulo exibido
  categoria text NOT NULL,                    -- macronutriente | vitamina | mineral
  vd_valor numeric NOT NULL,                  -- valor em uso
  vd_unidade text NOT NULL,                   -- g | mg | mcg | kcal
  faixa text NOT NULL DEFAULT 'adultos_19_mais',
  norma text NOT NULL DEFAULT 'IN 75/2020',
  valor_hardcode_anterior numeric,            -- rastreio do que estava no código
  homologado boolean NOT NULL DEFAULT false,  -- só imprime número quando true
  homologado_por text,
  homologado_em timestamptz,
  observacao text,                            -- suspeita p/ RT priorizar
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.anvisa_vdr ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS anvisa_vdr_select ON public.anvisa_vdr;
CREATE POLICY anvisa_vdr_select ON public.anvisa_vdr
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS anvisa_vdr_write ON public.anvisa_vdr;
CREATE POLICY anvisa_vdr_write ON public.anvisa_vdr
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_anvisa_vdr_updated ON public.anvisa_vdr;
CREATE TRIGGER trg_anvisa_vdr_updated BEFORE UPDATE ON public.anvisa_vdr
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Seed: valores atuais migrados do hardcode VD_REFERENCE (homologado=false) ──
INSERT INTO public.anvisa_vdr (chave, nutriente, categoria, vd_valor, vd_unidade, valor_hardcode_anterior, observacao) VALUES
('valor_energetico','Valor energético','macronutriente',2000,'kcal',2000,NULL),
('carboidratos','Carboidratos','macronutriente',300,'g',300,NULL),
('acucares_adic','Açúcares adicionados','macronutriente',50,'g',50,NULL),
('proteinas','Proteínas','macronutriente',50,'g',50,NULL),
('gorduras_totais','Gorduras totais','macronutriente',65,'g',65,NULL),
('gorduras_sat','Gorduras saturadas','macronutriente',20,'g',20,NULL),
('gorduras_trans','Gorduras trans','macronutriente',2,'g',2,NULL),
('gord_mono','Gorduras monoinsaturadas','macronutriente',20,'g',20,NULL),
('gord_poli','Gorduras poli-insaturadas','macronutriente',20,'g',20,NULL),
('omega6','Ômega 6','macronutriente',18,'g',18,NULL),
('omega3','Ômega 3','macronutriente',4000,'mg',4000,NULL),
('colesterol','Colesterol','macronutriente',300,'mg',300,NULL),
('fibras','Fibras alimentares','macronutriente',25,'g',25,NULL),
('sodio','Sódio','macronutriente',2000,'mg',2000,NULL),
('vitamina_a','Vitamina A','vitamina',800,'mcg',800,'SUSPEITO: valor parece US (800). IN 75/2020 provavelmente ~600 mcg RE — RT conferir Anexo.'),
('vitamina_d3','Vitamina D3','vitamina',15,'mcg',15,NULL),
('vitamina_d','Vitamina D','vitamina',15,'mcg',15,NULL),
('vitamina_e','Vitamina E','vitamina',15,'mg',15,'SUSPEITO: valor parece US (15). IN 75/2020 provavelmente ~10 mg — RT conferir.'),
('vitamina_k2','Vitamina K','vitamina',120,'mcg',120,'SUSPEITO: valor parece US (120). IN 75/2020 provavelmente ~65 mcg — RT conferir.'),
('vitamina_c','Vitamina C','vitamina',100,'mg',100,NULL),
('vitamina_b1','Vitamina B1 (Tiamina)','vitamina',1.2,'mg',1.2,NULL),
('vitamina_b2','Vitamina B2 (Riboflavina)','vitamina',1.2,'mg',1.2,'CONFERIR: IN 75/2020 possivelmente 1,3 mg.'),
('vitamina_b3','Vitamina B3 (Niacina)','vitamina',15,'mg',15,'SUSPEITO: IN 75/2020 provavelmente ~16 mg NE — RT conferir.'),
('vitamina_b5','Vitamina B5 (Ác. Pantotênico)','vitamina',5,'mg',5,NULL),
('vitamina_b6','Vitamina B6','vitamina',1.3,'mg',1.3,NULL),
('vitamina_b7','Vitamina B7 (Biotina)','vitamina',30,'mcg',30,NULL),
('vitamina_b9','Vitamina B9 (Folato)','vitamina',400,'mcg',400,NULL),
('vitamina_b12','Vitamina B12','vitamina',2.4,'mcg',2.4,NULL),
('calcio','Cálcio','mineral',1000,'mg',1000,NULL),
('cloreto','Cloreto','mineral',2300,'mg',2300,NULL),
('cobre','Cobre','mineral',900,'mcg',900,NULL),
('cromo','Cromo','mineral',35,'mcg',35,NULL),
('ferro','Ferro','mineral',14,'mg',14,NULL),
('fluor','Flúor','mineral',4,'mg',4,NULL),
('fosforo','Fósforo','mineral',700,'mg',700,NULL),
('iodo','Iodo','mineral',150,'mcg',150,'SUSPEITO: valor parece US (150). IN 75/2020 provavelmente ~130 mcg — RT conferir.'),
('magnesio','Magnésio','mineral',420,'mg',420,'SUSPEITO ALTO: valor parece US (420). IN 75/2020 provavelmente ~260 mg — RT conferir. (Deu 23% no laudo ProLab.)'),
('manganes','Manganês','mineral',3,'mg',3,'SUSPEITO: IN 75/2020 provavelmente ~2,3 mg — RT conferir.'),
('molibdenio','Molibdênio','mineral',45,'mcg',45,NULL),
('potassio','Potássio','mineral',3500,'mg',3500,'CONFERIR contra IN 75/2020.'),
('selenio','Selênio','mineral',60,'mcg',60,'SUSPEITO: valor parece antigo/US (60). IN 75/2020 provavelmente ~34 mcg — RT conferir.'),
('zinco','Zinco','mineral',11,'mg',11,'SUSPEITO: valor parece US (11). IN 75/2020 provavelmente ~7 mg — RT conferir.'),
('colina','Colina','mineral',550,'mg',550,NULL)
ON CONFLICT (chave) DO NOTHING;

NOTIFY pgrst, 'reload schema';
