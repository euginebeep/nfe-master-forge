-- Base de LIMITES ANVISA (IN 28/2018 Anexo IV + INs específicas) homologável pela RT.
-- Global (sem company_id). Migra fielmente o hardcode ANVISA_LIMITS de src/lib/anvisa-limits.ts.
-- APLICADA via MCP em 2026-07-04. homologado=false até a RT validar cada linha.
CREATE TABLE IF NOT EXISTS public.anvisa_limites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave text NOT NULL UNIQUE,
  nome text NOT NULL,
  categoria text NOT NULL DEFAULT 'constituinte',
  autorizado boolean NOT NULL DEFAULT true,     -- false = proibido/nao consta
  dose_min numeric,
  dose_max numeric,                              -- NULL = sem limite maximo (NE)
  unidade text NOT NULL,
  norma text,
  observacao text,
  tem_grupos_restritos boolean NOT NULL DEFAULT false, -- entrada tem allowedGroups/restrictions no codigo
  faixa text NOT NULL DEFAULT 'adultos_19_mais',
  homologado boolean NOT NULL DEFAULT false,
  homologado_por text,
  homologado_em timestamptz,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.anvisa_limites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anvisa_limites_select ON public.anvisa_limites;
CREATE POLICY anvisa_limites_select ON public.anvisa_limites FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS anvisa_limites_write ON public.anvisa_limites;
CREATE POLICY anvisa_limites_write ON public.anvisa_limites FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP TRIGGER IF EXISTS trg_anvisa_limites_updated ON public.anvisa_limites;
CREATE TRIGGER trg_anvisa_limites_updated BEFORE UPDATE ON public.anvisa_limites
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.anvisa_limites (chave, nome, autorizado, dose_min, dose_max, unidade, norma, observacao, tem_grupos_restritos) VALUES
('vitamina_a','Vitamina A',true,0,3000,'mcg','IN 28 Anexo IV (RAE pré-formada)','3000 µg = 10.000 UI máx — apenas vit. A pré-formada',false),
('vitamina_d3','Vitamina D3',true,0,50,'mcg','IN 28 Anexo IV','50 µg = 2.000 UI — MÁXIMO PERMITIDO IN 28',false),
('vitamina_c','Vitamina C',true,0,2000,'mg','IN 28 Anexo IV (IN 76/2020)',NULL,false),
('vitamina_e','Vitamina E',true,0,1000,'mg','IN 28 Anexo IV (α-tocoferol)',NULL,false),
('vitamina_k2','Vitamina K2',true,0,149,'mcg','IN 28 Anexo IV',NULL,false),
('vitamina_b1','Vitamina B1',true,0,2,'mg','IN 28 Anexo IV (Tiamina)',NULL,false),
('vitamina_b2','Vitamina B2',true,0,2.74,'mg','IN 28 Anexo IV (Riboflavina)',NULL,false),
('vitamina_b3','Vitamina B3',true,0,35,'mg','IN 28 Anexo IV (Niacina NE)',NULL,false),
('vitamina_b5','Vitamina B5',true,0,5.64,'mg','IN 28 Anexo IV (Ác. Pantotênico)',NULL,false),
('vitamina_b6','Vitamina B6',true,0,100,'mg','IN 28 Anexo IV',NULL,false),
('vitamina_b7','Vitamina B7',true,0,45,'mcg','IN 28 Anexo IV (Biotina)',NULL,false),
('vitamina_b9','Vitamina B9',true,0,400,'mcg','IN 28 Anexo IV (DFE — IN 76/2020)','Máximo 400 mcg DFE — IN 28 Anexo IV. Ácido fólico sintético: 1 mcg = 1,7 mcg DFE.',false),
('vitamina_b12','Vitamina B12',true,0,9.94,'mcg','IN 28 Anexo IV',NULL,false),
('colina','Colina',true,0,3500,'mg','IN 28 Anexo IV',NULL,false),
('calcio','Calcio',true,0,2500,'mg','IN 28 Anexo IV',NULL,false),
('magnesio','Magnesio',true,0,350,'mg','IN 28 Anexo IV','Magnésio elementar — apenas formas suplementares (não inclui alimentar)',false),
('ferro','Ferro',true,0,45,'mg','IN 28 Anexo IV',NULL,false),
('zinco','Zinco',true,0,25,'mg','IN 28 Anexo IV','Máximo 25 mg para adultos (IN 28)',false),
('cobre','Cobre',true,0,10000,'mcg','IN 28 Anexo IV','10 mg = 10.000 µg',false),
('selenio','Selenio',true,0,400,'mcg','IN 28 Anexo IV (IN 76/2020)',NULL,false),
('cromo','Cromo',true,0,200,'mcg','IN 28 Anexo IV','Máximo 200 mcg para adultos (IN 28)',false),
('iodo','Iodo',true,0,1100,'mcg','IN 28 Anexo IV (IN 76/2020)',NULL,false),
('manganes','Manganes',true,0,11,'mg','IN 28 Anexo IV (IN 76/2020)',NULL,false),
('molibdenio','Molibdenio',true,0,2000,'mcg','IN 28 Anexo IV',NULL,false),
('boro','Boro',true,0,6,'mg','IN 28 Anexo IV','Máximo 6 mg para adultos (IN 28)',false),
('fosforo','Fosforo',true,0,4000,'mg','IN 28 Anexo IV','Razão Ca/P entre 1:1 e 2:1',false),
('fluoreto','Fluoreto',true,0,10,'mg','IN 28 Anexo IV',NULL,false),
('silicio','Silicio',true,0,NULL,'mg','IN 28 Anexo IV / RDC 240/2018','Silício orgânico (monometilsilanetriol) autorizado sem limite máximo definido (NE)',false),
('leucina','Leucina',true,0,5660,'mg','IN 28 Anexo IV',NULL,false),
('lisina','Lisina',true,0,4940,'mg','IN 28 Anexo IV',NULL,false),
('valina','Valina',true,0,3600,'mg','IN 28 Anexo IV',NULL,false),
('isoleucina','Isoleucina',true,0,3240,'mg','IN 28 Anexo IV',NULL,false),
('treonina','Treonina',true,0,2720,'mg','IN 28 Anexo IV',NULL,false),
('fenilalanina','Fenilalanina',true,0,2820,'mg','IN 28 Anexo IV',NULL,false),
('l_tirosina','L Tirosina',true,0,2750,'mg','IN 28 Anexo IV',NULL,false),
('tirosina','Tirosina',true,0,2750,'mg','IN 28 Anexo IV',NULL,false),
('metionina','Metionina',true,0,1530,'mg','IN 28 Anexo IV',NULL,false),
('l_cistina','L Cistina',true,0,830,'mg','IN 28 Anexo IV (Cisteína)',NULL,false),
('cisteina','Cisteina',true,0,830,'mg','IN 28 Anexo IV',NULL,false),
('histidina','Histidina',true,0,2120,'mg','IN 28 Anexo IV',NULL,false),
('l_triptofano','L Triptofano',true,0,860,'mg','IN 28 Anexo IV',NULL,false),
('triptofano','Triptofano',true,0,860,'mg','IN 28 Anexo IV',NULL,false),
('l_arginina','L Arginina',true,0,3810,'mg','IN 28 Anexo IV',NULL,false),
('aspartato','Aspartato',true,0,5320,'mg','IN 28 Anexo IV',NULL,false),
('glicina','Glicina',true,0,2980,'mg','IN 28 Anexo IV',NULL,false),
('serina','Serina',true,0,3151,'mg','IN 28 Anexo IV',NULL,false),
('acido_glutamico','Acido Glutamico',true,0,15880,'mg','IN 28 Anexo IV',NULL,false),
('prolina','Prolina',true,0,5360,'mg','IN 28 Anexo IV',NULL,false),
('alanina','Alanina',true,0,3320,'mg','IN 28 Anexo IV',NULL,false),
('glutamina','Glutamina',true,0,5000,'mg','IN 28 Anexo IV',NULL,false),
('taurina','Taurina',true,0,2000,'mg','IN 28 Anexo IV',NULL,false),
('l_carnitina','L Carnitina',true,0,2000,'mg','IN 28 Anexo IV',NULL,false),
('creatina','Creatina',true,0,3000,'mg','IN 28 Anexo IV',NULL,false),
('cafeina','Cafeina',true,0,200,'mg','IN 28 Anexo IV','Dose individual 200 mg / 400 mg/dia exclusivo p/ atletas',false),
('coenzima_q10','Coenzima Q10',true,0,200,'mg','IN 28 Anexo IV',NULL,false),
('fitoesterois','Fitoesterois',true,0,3000,'mg','IN 28 Anexo IV','3 g/dia máx',false),
('licopeno','Licopeno',true,0,8,'mg','IN 28 Anexo IV',NULL,false),
('luteina','Luteina',true,0,10,'mg','IN 28 Anexo IV',NULL,false),
('zeaxantina','Zeaxantina',true,0,2,'mg','IN 28 Anexo IV',NULL,false),
('astaxantina','Astaxantina',true,0,8,'mg','IN 28 Anexo IV',NULL,false),
('alicina','Alicina',true,0,5.4,'mg','IN 28 Anexo IV','1 mg alina = 0,45 mg alicina',false),
('omega3_epa_dha','Omega3 Epa Dha',true,0,2000,'mg','IN 28 Anexo IV (EPA+DHA)','Mínimo 30 mg de DHA',false),
('melatonina','Melatonina',true,0,0.21,'mg','IN 211/2023','Apenas para ≥19 anos — Dose máx 0,21 mg/dia',false),
('colageno_tipo2','Colageno Tipo2',true,40,NULL,'mg','IN 102/2021 (não desnaturado UC-II)','Mínimo 40mg para efeito comprovado (IN 102/2021)',false),
('colageno_hidrolisado','Colageno Hidrolisado',true,0,NULL,'mg','RDC 243/2018 (ingrediente alimentar)','Sem limite específico — proteína',false),
('msm','Msm',true,0,2000,'mg','IN 28 Anexo IV (Metilsulfonilmetano)',NULL,false),
('trans_resveratrol','Trans Resveratrol',true,0,165,'mg','IN 28 Anexo IV',NULL,false),
('acido_hialuronico','Acido Hialuronico',true,0,80,'mg','IN 28 Anexo IV',NULL,false),
('beta_alanina','Beta Alanina',true,0,NULL,'mg','IN 28 — Sem limite estabelecido (NE)',NULL,false),
('gaba','Gaba',true,50,300,'mg','IN 373/2025 (Anexo II/III)','Ácido Gama Aminobutírico — Apenas ≥19 anos',true),
('lactobacillus_acidophilus_dds1','Lactobacillus Acidophilus Dds1',true,10000000000.0,NULL,'UFC','IN 373/2025 (Anexo II/III)','Lactobacillus acidophilus DDS-1 (NCIMB 30333) — Apenas ≥19 anos (mínimo 1×10¹⁰ UFC)',true),
('bacillus_coagulans_snz1969','Bacillus Coagulans Snz1969',true,100000000.0,NULL,'esporos/porção','IN 373/2025 (Anexo II/III)','Bacillus coagulans SNZ 1969 — Faixa etária diferenciada: 4-8 anos (1×10⁸), 9-18 anos (1×10⁸), ≥19 anos (2×10⁹)',true),
('pediococcus_acidilactici','Pediococcus Acidilactici',true,3000000000.0,NULL,'UFC','IN 373/2025 (Anexo II/III)','Associação Lactobacillus plantarum + Pediococcus acidilactici — Apenas ≥19 anos (mínimo 3×10⁹ UFC, sendo 1×10⁹ para cada linhagem)',true),
('fucosil_lactose_2','Fucosil Lactose 2',true,0,3000,'mg','IN 373/2025 (Anexo II/III)','2''-Fucosil-lactose — Permitido para >=4 anos E gestantes/lactantes (maximo 3g)',true),
('curcumina','Curcumina',true,80,130,'mg','IN 438/2026 (Anexo II/III)','Curcuminoides totais (curcumina + desmetoxicurcumina + bisdesmetoxicurcumina). Apenas ≥19 anos. ⚠️ ADVERTÊNCIA: Não recomendado para gestantes, lactantes, crianças, doenças hepáticas/biliares, úlceras gástricas.',true),
('tetraidrocurcuminoides','Tetraidrocurcuminoides',true,0,120,'mg','IN 438/2026 (Anexo II/III)','Tetraidrocurcuminoides (THC) — Apenas ≥19 anos. ⚠️ NÃO PODE SER ASSOCIADO COM CURCUMINA. ADVERTÊNCIA: Não recomendado para gestantes, lactantes, crianças, doenças hepáticas/biliares, úlceras gástricas.',true),
('berberina','Berberina',false,0,0,'-','PROIBIDO — Não consta IN 28','Substância classificada como medicamento. RDC 243/2018',false),
('queratina','Queratina',false,0,0,'-','PROIBIDO — Não consta IN 28','Cosmético, não aprovado p/ uso oral',false),
('l_citrulina','L Citrulina',false,0,0,'-','NÃO CONSTA IN 28 Anexo I','Não autorizada como suplemento alimentar',false),
('silicio_organico','Silicio Organico',true,0,NULL,'mg','IN 28 Anexo IV / RDC 240/2018','Silício orgânico (monometilsilanetriol) sem limite máximo definido (NE)',false)
ON CONFLICT (chave) DO NOTHING;

NOTIFY pgrst, 'reload schema';
