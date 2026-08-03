DROP VIEW IF EXISTS public.v_formulas_conformidade;
DROP FUNCTION IF EXISTS public.anvisa_avaliar_ativo(text, numeric, text, text);
DROP FUNCTION IF EXISTS public.anvisa_avaliar_insumo(uuid, uuid, numeric, text, text);

CREATE VIEW public.v_formulas_conformidade AS
SELECT f.id AS formula_id, f.company_id, f.codigo_formula, f.nome_formula, f.status,
       fi.id AS item_id, fi.nome_insumo, fi.quantidade_convertida_mg AS dose_mg,
       COALESCE(fi.funcao_no_produto,'ATIVO') AS funcao,
       anvisa_avaliar_insumo(fi.produto_materia_prima_id, f.company_id,
         fi.quantidade_convertida_mg, 'mg',
         COALESCE(f.grupo_populacional_alvo,'19_mais'),
         COALESCE(fi.funcao_no_produto,'ATIVO')) AS avaliacao,
       (SELECT v.constituinte_id FROM item_anvisa_vinculo v
         WHERE v.item_id = fi.produto_materia_prima_id AND v.company_id = f.company_id
           AND v.status='confirmado' LIMIT 1) AS vinculo_rt
FROM formulas f JOIN formula_itens fi ON fi.formula_id = f.id;

COMMENT ON VIEW public.v_formulas_conformidade IS
  'Avaliacao por item de formula pela via do VINCULO (anvisa_avaliar_insumo), '
  'respeitando funcao_no_produto. vinculo_rt NULL = sem vinculo confirmado: '
  'veredito por nome, pode ser falso negativo.';

DO $$
DECLARE v_dup text;
BEGIN
  SELECT string_agg(x.assinatura, ' | ') INTO v_dup FROM (
    SELECT p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' AS assinatura,
           count(*) OVER (PARTITION BY p.proname) AS n
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname='public' AND p.proname LIKE 'anvisa_avaliar%'
  ) x WHERE x.n > 1;
  IF v_dup IS NOT NULL THEN RAISE EXCEPTION 'Ainda ha sobrecarga: %', v_dup; END IF;
END $$;