-- O portao botanico do frontend olhava o NOME DIGITADO. Errado: "CURCUMA LONGA
-- 95%" dispara a heuristica, mas apos o casamento o constituinte e
-- "Extrato de rizomas de Curcuma longa" — especie E parte vegetal ja
-- determinadas PELA NORMA, com limite 80-130 mg e advertencia propria.
-- Exigir que o usuario redigite o que a norma ja fixou rebaixa constituinte
-- autorizado para PENDENTE e ensina a ignorar o alerta.
--
-- Regra correta: o portao olha o CONSTITUINTE CASADO, nao a entrada.
-- Identidade esta resolvida quando o nome tecnico ja carrega binomio latino
-- ou parte vegetal — ou quando ha vinculo confirmado pela RT.

CREATE OR REPLACE FUNCTION public.anvisa_identidade_botanica(p_constituinte_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_c anvisa_constituintes%ROWTYPE; v_n text;
        v_binomio boolean; v_parte text;
BEGIN
  SELECT * INTO v_c FROM anvisa_constituintes WHERE id = p_constituinte_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('resolvida', false,
      'motivo','Sem constituinte casado: identidade nao pode ser verificada.');
  END IF;

  v_n := lower(unaccent(v_c.nome_tecnico));

  -- binomio latino: "Curcuma longa", "Camellia sinensis", "Paullinia cupana"
  v_binomio := v_c.nome_tecnico ~ '\m[A-Z][a-z]{2,}\s+[a-z]{3,}\M';

  -- parte vegetal declarada no proprio nome tecnico
  v_parte := (regexp_match(v_n,
    '\m(rizoma[s]?|raiz|raizes|folha[s]?|semente[s]?|casca[s]?|flor|flores|fruto[s]?|caule|planta inteira|parte aerea|broto[s]?|bulbo|tuberculo)\M'))[1];

  IF v_binomio OR v_parte IS NOT NULL THEN
    RETURN jsonb_build_object(
      'resolvida', true,
      'por','norma',
      'constituinte', v_c.nome_tecnico,
      'binomio_no_nome', v_binomio,
      'parte_vegetal_no_nome', v_parte,
      'motivo','Especie e/ou parte vegetal ja fixadas pelo proprio constituinte '
        || 'autorizado. Nao exigir redigitacao: a norma ja determinou.');
  END IF;

  RETURN jsonb_build_object(
    'resolvida', false,
    'constituinte', v_c.nome_tecnico,
    'motivo','O constituinte autorizado nao fixa especie nem parte vegetal no '
      || 'nome. Para botanico, declarar especie, parte usada, tipo de extrato e '
      || 'padronizacao — a fonte faz parte da autorizacao.',
    'responsavel','rt_do_tenant_confirma_vinculo');
END; $$;

COMMENT ON FUNCTION public.anvisa_identidade_botanica(uuid) IS
  'Diz se a identidade botanica ja esta determinada pelo constituinte casado. '
  'O portao botanico deve olhar ISTO, nunca o nome digitado: "CURCUMA LONGA 95%" '
  'casa com "Extrato de rizomas de Curcuma longa", que ja fixa especie e parte. '
  'Exigir redigitacao rebaixa constituinte autorizado e ensina a ignorar alerta.';