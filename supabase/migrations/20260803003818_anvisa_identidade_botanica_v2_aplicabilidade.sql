-- v1 devolvia resolvida=false para "Acetato de zinco" — que nao e botanico e
-- nunca deveria passar pelo portao. Falta o eixo APLICAVEL: sem ele, todo
-- mineral e vitamina cairia em PENDENTE por "identidade botanica incompleta".
-- Tres estados, nao dois: nao se aplica / aplica e esta resolvida / aplica e falta.

CREATE OR REPLACE FUNCTION public.anvisa_identidade_botanica(p_constituinte_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_c anvisa_constituintes%ROWTYPE; v_n text;
        v_binomio boolean; v_parte text; v_vegetal boolean;
BEGIN
  SELECT * INTO v_c FROM anvisa_constituintes WHERE id = p_constituinte_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('aplicavel', true, 'resolvida', false,
      'motivo','Sem constituinte casado: identidade nao pode ser verificada.',
      'responsavel','rt_do_tenant_confirma_vinculo');
  END IF;

  v_n := lower(unaccent(v_c.nome_tecnico));

  v_binomio := v_c.nome_tecnico ~ '\m[A-Z][a-z]{2,}\s+[a-z]{3,}\M';

  v_parte := (regexp_match(v_n,
    '\m(rizoma[s]?|raiz|raizes|folha[s]?|semente[s]?|casca[s]?|flor|flores|fruto[s]?|caule|planta inteira|parte aerea|broto[s]?|bulbo|tuberculo)\M'))[1];

  -- origem vegetal declarada de alguma forma
  v_vegetal := v_binomio OR v_parte IS NOT NULL
            OR v_n ~ '\m(extrato|erva|planta|vegetal|botanico|oleo essencial|em po|moido|moida|desidratado|desidratada|liofilizado)\M';

  IF NOT v_vegetal THEN
    RETURN jsonb_build_object('aplicavel', false, 'resolvida', null,
      'constituinte', v_c.nome_tecnico,
      'motivo','Constituinte sem origem vegetal declarada — portao botanico nao '
        || 'se aplica. Mineral, vitamina, aminoacido e sal sintetico nao passam '
        || 'por aqui.');
  END IF;

  IF v_binomio OR v_parte IS NOT NULL THEN
    RETURN jsonb_build_object('aplicavel', true, 'resolvida', true, 'por','norma',
      'constituinte', v_c.nome_tecnico,
      'binomio_no_nome', v_binomio, 'parte_vegetal_no_nome', v_parte,
      'motivo','Especie e/ou parte vegetal ja fixadas pelo proprio constituinte '
        || 'autorizado. NAO exigir redigitacao: a norma ja determinou.');
  END IF;

  RETURN jsonb_build_object('aplicavel', true, 'resolvida', false,
    'constituinte', v_c.nome_tecnico,
    'motivo','Constituinte de origem vegetal cujo nome NAO fixa especie nem '
      || 'parte usada. Declarar especie, parte, tipo de extrato e padronizacao: '
      || 'a fonte faz parte da autorizacao.',
    'responsavel','rt_do_tenant_confirma_vinculo');
END; $$;

COMMENT ON FUNCTION public.anvisa_identidade_botanica(uuid) IS
  'Tres estados: aplicavel=false (mineral/vitamina — portao nao roda), '
  'resolvida=true (norma ja fixa especie/parte, ex.: Extrato de rizomas de '
  'Curcuma longa) e resolvida=false (vegetal generico, ex.: Extrato de propolis '
  '— verde e marrom sao diferentes). O portao olha o CONSTITUINTE CASADO, nunca '
  'o nome digitado.';