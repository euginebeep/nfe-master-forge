-- ============================================================
-- BrainX — Correção de unidade canônica de massa para GRAMA (g)
-- Aplicado em produção via MCP em 2026-07-25.
-- Reconciliado lote a lote contra a nota fiscal + COA.
-- Canônica decidida por Fabio: massa sempre em 'g' no armazenamento.
-- Valor total de cada lote preservado (qtd*custo constante).
--
-- FORA (pendências separadas):
--   Lactase (2 lotes) — COA PENDENTE da RT
--   Curcumina — gravada 1000x MENOR, tratamento próprio
--   21 cápsulas 'UN'/'un' — caixa alta/baixa, cosmético
--
-- NOTA: script de correção de DADO, não de schema. Num db novo
-- afeta 0 linhas (lotes não existem). Versionado para registro.
-- ============================================================

BEGIN;

-- ---- GRUPO 1: 34 lotes kg->g (Bloco A + Espirulina split) ----
UPDATE public.estoque_lotes SET quantidade_interna=2000, custo_unitario_interno=0.25, unidade_interna='g' WHERE numero_lote='AUTO045956' AND unidade_interna='kg';  -- Alfa-Amilase
UPDATE public.estoque_lotes SET quantidade_interna=10000, custo_unitario_interno=0.0215, unidade_interna='g' WHERE numero_lote='AUTO046157' AND unidade_interna='kg';  -- BETA ALANINA
UPDATE public.estoque_lotes SET quantidade_interna=5000, custo_unitario_interno=0.027, unidade_interna='g' WHERE numero_lote='26A20-B031-219137' AND unidade_interna='kg';  -- Cloreto De Magnesio-Hexahidr
UPDATE public.estoque_lotes SET quantidade_interna=1000, custo_unitario_interno=0.1, unidade_interna='g' WHERE numero_lote='26E13-B007-222067' AND unidade_interna='kg';  -- Cobre Bisglicinato 14%
UPDATE public.estoque_lotes SET quantidade_interna=2000, custo_unitario_interno=0.99, unidade_interna='g' WHERE numero_lote='26D07-B010-221989' AND unidade_interna='kg';  -- COLAGENO T II
UPDATE public.estoque_lotes SET quantidade_interna=500, custo_unitario_interno=0.99, unidade_interna='g' WHERE numero_lote='26D07-B010-221988' AND unidade_interna='kg';  -- COLAGENO T II
UPDATE public.estoque_lotes SET quantidade_interna=20000, custo_unitario_interno=0.029, unidade_interna='g' WHERE numero_lote='AUTO046277' AND unidade_interna='kg';  -- Creatina Monohidratada STD
UPDATE public.estoque_lotes SET quantidade_interna=15000, custo_unitario_interno=0.11, unidade_interna='g' WHERE numero_lote='26B26-B056-220095' AND unidade_interna='kg';  -- Feno Grego Ext Seco 50%
UPDATE public.estoque_lotes SET quantidade_interna=3000, custo_unitario_interno=0.0709, unidade_interna='g' WHERE numero_lote='26E07-B001-221856' AND unidade_interna='kg';  -- Ferro Bisglicinato 20%
UPDATE public.estoque_lotes SET quantidade_interna=2000, custo_unitario_interno=0.099, unidade_interna='g' WHERE numero_lote='26F10-B051-223897' AND unidade_interna='kg';  -- L-Leucina
UPDATE public.estoque_lotes SET quantidade_interna=25000, custo_unitario_interno=0.045, unidade_interna='g' WHERE numero_lote='AUTO043859' AND unidade_interna='kg';  -- L-Tirosina
UPDATE public.estoque_lotes SET quantidade_interna=9000, custo_unitario_interno=0.115, unidade_interna='g' WHERE numero_lote='26F18-B021-224335' AND unidade_interna='kg';  -- L-TRIPTOFANO
UPDATE public.estoque_lotes SET quantidade_interna=8000, custo_unitario_interno=0.062, unidade_interna='g' WHERE numero_lote='26F10-B038-223104' AND unidade_interna='kg';  -- Magnesio Bisglicinato 18%
UPDATE public.estoque_lotes SET quantidade_interna=1000, custo_unitario_interno=0.049, unidade_interna='g' WHERE numero_lote='AUTO046108' AND unidade_interna='kg';  -- Manganes Bisglicinato 16%
UPDATE public.estoque_lotes SET quantidade_interna=14000, custo_unitario_interno=0.115, unidade_interna='g' WHERE numero_lote='26B25-B036-220015' AND unidade_interna='kg';  -- N-ACETIL-L-CISTEINA
UPDATE public.estoque_lotes SET quantidade_interna=25000, custo_unitario_interno=0.059, unidade_interna='g' WHERE numero_lote='AUTO044238' AND unidade_interna='kg';  -- PANTOTENATO DE CALCIO
UPDATE public.estoque_lotes SET quantidade_interna=15000, custo_unitario_interno=0.025, unidade_interna='g' WHERE numero_lote='26F19-B003-224421' AND unidade_interna='kg';  -- TAURINA
UPDATE public.estoque_lotes SET quantidade_interna=1000, custo_unitario_interno=0.3, unidade_interna='g' WHERE numero_lote='25F03-B023-212445' AND unidade_interna='kg';  -- VIT. A ACETATO PO 500.000 UI/G
UPDATE public.estoque_lotes SET quantidade_interna=1000, custo_unitario_interno=0.275, unidade_interna='g' WHERE numero_lote='26A05-B021-217494' AND unidade_interna='kg';  -- Vitamina B 1 Hcl (Tiamina)
UPDATE public.estoque_lotes SET quantidade_interna=25000, custo_unitario_interno=0.023, unidade_interna='g' WHERE numero_lote='26F18-B047-223935' AND unidade_interna='kg';  -- Vitamina C Revestida
UPDATE public.estoque_lotes SET quantidade_interna=15000, custo_unitario_interno=0.145, unidade_interna='g' WHERE numero_lote='AUTO045376' AND unidade_interna='kg';  -- Vitamina E Acetato Po 50%
UPDATE public.estoque_lotes SET quantidade_interna=4000, custo_unitario_interno=0.069, unidade_interna='g' WHERE numero_lote='26E26-B004-222482' AND unidade_interna='kg';  -- Zinco Bisglicinato 20%
UPDATE public.estoque_lotes SET quantidade_interna=200, custo_unitario_interno=0.72, unidade_interna='g' WHERE numero_lote='26D23-B011-222163' AND unidade_interna='kg';  -- ASTAXANTINA
UPDATE public.estoque_lotes SET quantidade_interna=2000, custo_unitario_interno=0.35, unidade_interna='g' WHERE numero_lote='AUTO045779' AND unidade_interna='kg';  -- Bromelaina (Bromelina)
UPDATE public.estoque_lotes SET quantidade_interna=2000, custo_unitario_interno=0.043, unidade_interna='g' WHERE numero_lote='26E19-B012-223708' AND unidade_interna='kg';  -- L-Valina
UPDATE public.estoque_lotes SET quantidade_interna=10, custo_unitario_interno=18, unidade_interna='g' WHERE numero_lote='26F26-B039-224538' AND unidade_interna='kg';  -- Levometilfolato de Calcio
UPDATE public.estoque_lotes SET quantidade_interna=1000, custo_unitario_interno=0.62, unidade_interna='g' WHERE numero_lote='26E27-B075-223191' AND unidade_interna='kg';  -- Lipase
UPDATE public.estoque_lotes SET quantidade_interna=100, custo_unitario_interno=0.79, unidade_interna='g' WHERE numero_lote='AUTO045726' AND unidade_interna='kg';  -- MELATONINA
UPDATE public.estoque_lotes SET quantidade_interna=1500, custo_unitario_interno=0.19, unidade_interna='g' WHERE numero_lote='26B06-B017-220491' AND unidade_interna='kg';  -- Niacina
UPDATE public.estoque_lotes SET quantidade_interna=2000, custo_unitario_interno=0.31, unidade_interna='g' WHERE numero_lote='AUTO046681' AND unidade_interna='kg';  -- Protease Alcalina
UPDATE public.estoque_lotes SET quantidade_interna=1000, custo_unitario_interno=0.32, unidade_interna='g' WHERE numero_lote='AUTO045493' AND unidade_interna='kg';  -- Vitamina B 2 (Riboflavina)
UPDATE public.estoque_lotes SET quantidade_interna=250, custo_unitario_interno=1.3, unidade_interna='g' WHERE numero_lote='26F02-B023-223487' AND unidade_interna='kg';  -- Vitamina K2 (Mk-7) min.1,0%
UPDATE public.estoque_lotes SET quantidade_interna=1000, custo_unitario_interno=0.045, unidade_interna='g' WHERE numero_lote='25D16-B013-213112' AND unidade_interna='kg';  -- Espirulina 60% (split 1/2)
UPDATE public.estoque_lotes SET quantidade_interna=4000, custo_unitario_interno=0.045, unidade_interna='g' WHERE numero_lote='25D16-B013-213114' AND unidade_interna='kg';  -- Espirulina 60% (split 2/2)

-- ---- GRUPO 2: L-Arginina — item + 2 lotes que escaparam da lista ----
UPDATE public.itens SET unidade_interna='g' WHERE sku_interno='MP-2603-0886' AND unidade_interna='kg';
UPDATE public.estoque_lotes SET quantidade_interna=25000, custo_unitario_interno=0.029, unidade_interna='g' WHERE numero_lote='26C26-B030-221289' AND unidade_interna='kg';  -- L-Arginina (fora da lista orig.)
UPDATE public.estoque_lotes SET quantidade_interna=50000, custo_unitario_interno=0.028, unidade_interna='g' WHERE numero_lote='26F18-B022-224358' AND unidade_interna='kg';  -- L-Arginina (fora da lista orig.)

-- ---- GRUPO 3: 6 itens de massa em kg (item+lote) -> g ----
UPDATE public.itens SET unidade_interna='g' WHERE sku_interno IN ('MP-2607-3778','MP-2607-4878','MP-2607-8438','MP-2603-9771','MP-2603-9573','MP-2607-9912') AND unidade_interna='kg';
UPDATE public.estoque_lotes SET quantidade_interna=4000, custo_unitario_interno=0.35, unidade_interna='g' WHERE numero_lote='25B13-B025-207951' AND unidade_interna='kg';  -- Citrus Sinensis 90%
UPDATE public.estoque_lotes SET quantidade_interna=20000, custo_unitario_interno=0.21, unidade_interna='g' WHERE numero_lote='25D09-B012-209592' AND unidade_interna='kg';  -- Citrus Sinensis 90%
UPDATE public.estoque_lotes SET quantidade_interna=3000, custo_unitario_interno=0.932, unidade_interna='g' WHERE numero_lote='AUTO046398' AND unidade_interna='kg';  -- Coenzima Q-10
UPDATE public.estoque_lotes SET quantidade_interna=5000, custo_unitario_interno=0.235, unidade_interna='g' WHERE numero_lote='26G02-B051-224168' AND unidade_interna='kg';  -- Pancreatina 3 Nf
UPDATE public.estoque_lotes SET quantidade_interna=1000, custo_unitario_interno=0.099, unidade_interna='g' WHERE numero_lote='25B14-B011-210760' AND unidade_interna='kg';  -- Psylium Po
UPDATE public.estoque_lotes SET quantidade_interna=3000, custo_unitario_interno=0.099, unidade_interna='g' WHERE numero_lote='25D02-B002-210761' AND unidade_interna='kg';  -- Psylium Po
UPDATE public.estoque_lotes SET quantidade_interna=3000, custo_unitario_interno=0.085, unidade_interna='g' WHERE numero_lote='26B02-B048-219192' AND unidade_interna='kg';  -- Psylium Po
UPDATE public.estoque_lotes SET quantidade_interna=1000, custo_unitario_interno=0.14, unidade_interna='g' WHERE numero_lote='26C26-B034-221060' AND unidade_interna='kg';  -- VIT. B-6 Piridoxina
UPDATE public.estoque_lotes SET quantidade_interna=500, custo_unitario_interno=0.19, unidade_interna='g' WHERE numero_lote='Y03202403050' AND unidade_interna='kg';  -- VIT. B-6 Piridoxina
UPDATE public.estoque_lotes SET quantidade_interna=500, custo_unitario_interno=0.21, unidade_interna='g' WHERE numero_lote='Y03202404080' AND unidade_interna='kg';  -- VIT. B-6 Piridoxina
UPDATE public.estoque_lotes SET quantidade_interna=10, custo_unitario_interno=27, unidade_interna='g' WHERE numero_lote='26B09-B008-219016' AND unidade_interna='kg';  -- Vitamina D3

-- Verificação: deve sobrar só Lactase (2) em kg, esperando COA.
--   SELECT count(*) FROM estoque_lotes WHERE lower(unidade_interna)='kg';  -- esperado: 2
--   SELECT count(*) FROM itens WHERE lower(unidade_interna)='kg';          -- esperado: 0


-- ---- GRUPO 4 (aplicado depois): Curcumina + 6 itens de massa em kg -> g ----
-- Curcumina: caso 1000x MENOR (3g->3000g). Os 6 itens: item+lote ambos em kg.
UPDATE public.itens SET unidade_interna='g' WHERE sku_interno IN
  ('MP-2607-3778','MP-2607-4878','MP-2607-8438','MP-2603-9771','MP-2603-9573','MP-2607-9912') AND unidade_interna='kg';
UPDATE public.estoque_lotes SET quantidade_interna=3000, custo_unitario_interno=0.35, unidade_interna='g' WHERE numero_lote='26C26-B010-221395';  -- CURCUMA LONGA 95%
UPDATE public.estoque_lotes SET quantidade_interna=4000, custo_unitario_interno=0.35, unidade_interna='g' WHERE numero_lote='25B13-B025-207951';  -- Citrus Sinensis 90%
UPDATE public.estoque_lotes SET quantidade_interna=20000, custo_unitario_interno=0.21, unidade_interna='g' WHERE numero_lote='25D09-B012-209592';  -- Citrus Sinensis 90%
UPDATE public.estoque_lotes SET quantidade_interna=3000, custo_unitario_interno=0.932, unidade_interna='g' WHERE numero_lote='AUTO046398';  -- Coenzima Q-10
UPDATE public.estoque_lotes SET quantidade_interna=5000, custo_unitario_interno=0.235, unidade_interna='g' WHERE numero_lote='26G02-B051-224168';  -- Pancreatina 3 Nf
UPDATE public.estoque_lotes SET quantidade_interna=1000, custo_unitario_interno=0.099, unidade_interna='g' WHERE numero_lote='25B14-B011-210760';  -- Psylium Po
UPDATE public.estoque_lotes SET quantidade_interna=3000, custo_unitario_interno=0.099, unidade_interna='g' WHERE numero_lote='25D02-B002-210761';  -- Psylium Po
UPDATE public.estoque_lotes SET quantidade_interna=3000, custo_unitario_interno=0.085, unidade_interna='g' WHERE numero_lote='26B02-B048-219192';  -- Psylium Po
UPDATE public.estoque_lotes SET quantidade_interna=1000, custo_unitario_interno=0.14, unidade_interna='g' WHERE numero_lote='26C26-B034-221060';  -- VIT. B-6 Piridoxina
UPDATE public.estoque_lotes SET quantidade_interna=500, custo_unitario_interno=0.19, unidade_interna='g' WHERE numero_lote='Y03202403050';  -- VIT. B-6 Piridoxina
UPDATE public.estoque_lotes SET quantidade_interna=500, custo_unitario_interno=0.21, unidade_interna='g' WHERE numero_lote='Y03202404080';  -- VIT. B-6 Piridoxina
UPDATE public.estoque_lotes SET quantidade_interna=10, custo_unitario_interno=27, unidade_interna='g' WHERE numero_lote='26B09-B008-219016';  -- Vitamina D3

COMMIT;
