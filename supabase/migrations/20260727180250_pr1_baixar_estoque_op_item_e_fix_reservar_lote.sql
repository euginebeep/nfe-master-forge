create or replace function public.baixar_estoque_op_item(p_op_material_id uuid)
returns jsonb
language plpgsql
security invoker                       -- RLS faz o isolamento; nao replicar DEFINER sem checagem
set search_path to 'public'
as $function$
declare
  v_company uuid;
  v_mp      record;
  v_lote    record;
  v_ja      numeric;
  v_delta   numeric;
  v_saldo   numeric;
begin
  v_company := public.get_user_company_id();
  if v_company is null then
    raise exception 'usuario_sem_empresa_associada';
  end if;

  -- 1. item da OP -----------------------------------------------------
  select mp.id, mp.op_id, mp.insumo_nome, mp.lote_id, mp.quantidade_real_g,
         mp.company_id, o.codigo as op_codigo
    into v_mp
    from public.op_materias_primas mp
    join public.ordens_producao_industrial o on o.id = mp.op_id
   where mp.id = p_op_material_id;

  if not found then
    raise exception 'item_da_op_nao_encontrado';
  end if;

  if v_mp.company_id is distinct from v_company then
    raise exception 'item_pertence_a_outra_empresa';
  end if;

  if v_mp.lote_id is null then
    raise exception 'sem_lote_alocado: "%" nao tem lote alocado. Aloque o lote antes de baixar.',
      v_mp.insumo_nome;
  end if;

  if v_mp.quantidade_real_g is null then
    raise exception 'sem_pesagem_registrada: "%" nao tem peso real. Registre a pesagem antes de baixar.',
      v_mp.insumo_nome;
  end if;

  if v_mp.quantidade_real_g < 0 then
    raise exception 'quantidade_pesada_negativa: "%" com % g', v_mp.insumo_nome, v_mp.quantidade_real_g;
  end if;

  -- 2. lote, com lock de linha (serializa pesagens concorrentes) -------
  select el.id, el.item_id, el.numero_lote, el.quantidade_interna, el.status,
         el.data_val, el.custo_unitario_interno, el.company_id,
         coalesce(el.unidade_interna, 'g') as unidade_interna
    into v_lote
    from public.estoque_lotes el
   where el.id = v_mp.lote_id
   for update;

  if not found then
    raise exception 'lote_nao_encontrado';
  end if;

  if v_lote.company_id is distinct from v_company then
    raise exception 'lote_pertence_a_outra_empresa';
  end if;

  -- unidade canonica de armazenamento e GRAMA (decisao 25/07/2026)
  if v_lote.unidade_interna <> 'g' then
    raise exception 'unidade_nao_canonica: lote % esta em "%". A unidade de armazenamento e grama (g).',
      v_lote.numero_lote, v_lote.unidade_interna;
  end if;

  if v_lote.status in ('BLOQUEADO', 'VENCIDO') then
    raise exception 'lote_indisponivel: lote % esta com status %.',
      v_lote.numero_lote, v_lote.status;
  end if;

  -- revalida validade na hora da baixa (D6 filtrou na escolha, semanas antes)
  if v_lote.data_val is not null and v_lote.data_val < current_date then
    raise exception 'lote_vencido: lote % venceu em %.',
      v_lote.numero_lote, to_char(v_lote.data_val, 'DD/MM/YYYY');
  end if;

  -- 3. quanto ja foi movimentado por ESTE item da OP -------------------
  select coalesce(sum(case when em.tipo = 'SAIDA' then em.quantidade else -em.quantidade end), 0)
    into v_ja
    from public.estoque_movimentacoes em
   where em.documento_ref_id = p_op_material_id
     and em.lote_id          = v_mp.lote_id
     and em.tipo in ('SAIDA', 'ESTORNO_SAIDA');

  v_delta := v_mp.quantidade_real_g - v_ja;

  -- 4. nada a fazer ---------------------------------------------------
  if v_delta = 0 then
    return jsonb_build_object(
      'ok', true, 'acao', 'NENHUMA', 'insumo', v_mp.insumo_nome,
      'lote', v_lote.numero_lote, 'total_baixado_g', v_ja,
      'saldo_lote_g', v_lote.quantidade_interna, 'op', v_mp.op_codigo
    );
  end if;

  -- 5. baixa ----------------------------------------------------------
  if v_delta > 0 then
    if v_lote.quantidade_interna < v_delta then
      raise exception 'saldo_insuficiente: lote % tem % g; faltam % g para "%".',
        v_lote.numero_lote, v_lote.quantidade_interna,
        (v_delta - v_lote.quantidade_interna), v_mp.insumo_nome;
    end if;

    update public.estoque_lotes
       set quantidade_interna = quantidade_interna - v_delta
     where id = v_lote.id;

    insert into public.estoque_movimentacoes
      (tipo, item_id, lote_id, quantidade, unidade, custo_unitario, motivo,
       documento_ref, documento_ref_id, origem, usuario_id, company_id)
    values
      ('SAIDA', v_lote.item_id, v_lote.id, v_delta, 'g', v_lote.custo_unitario_interno,
       'Consumo em producao', v_mp.op_codigo, p_op_material_id, 'OP', auth.uid(), v_company);

  -- 6. estorno (pesagem corrigida para menos) -------------------------
  else
    update public.estoque_lotes
       set quantidade_interna = quantidade_interna + (-v_delta)
     where id = v_lote.id;

    insert into public.estoque_movimentacoes
      (tipo, item_id, lote_id, quantidade, unidade, custo_unitario, motivo,
       documento_ref, documento_ref_id, origem, usuario_id, company_id)
    values
      ('ESTORNO_SAIDA', v_lote.item_id, v_lote.id, (-v_delta), 'g', v_lote.custo_unitario_interno,
       'Estorno por correcao de pesagem', v_mp.op_codigo, p_op_material_id, 'OP', auth.uid(), v_company);
  end if;

  select quantidade_interna into v_saldo from public.estoque_lotes where id = v_lote.id;

  return jsonb_build_object(
    'ok', true,
    'acao', case when v_delta > 0 then 'BAIXA' else 'ESTORNO' end,
    'insumo', v_mp.insumo_nome,
    'lote', v_lote.numero_lote,
    'quantidade_movimentada_g', abs(v_delta),
    'ja_baixado_antes_g', v_ja,
    'total_baixado_g', v_mp.quantidade_real_g,
    'saldo_lote_g', v_saldo,
    'op', v_mp.op_codigo
  );
end;
$function$;

comment on function public.baixar_estoque_op_item(uuid) is
  'Baixa/estorna estoque de UM item da OP pelo peso real pesado. Idempotente por '
  'diferenca: movimenta apenas o delta entre quantidade_real_g e o ja movimentado. '
  'Substitui baixar_estoque_op_materias_primas (quebrada). PR-1, 28/07/2026.';

revoke all     on function public.baixar_estoque_op_item(uuid) from public, anon;
grant  execute on function public.baixar_estoque_op_item(uuid) to authenticated;


-- ---------------------------------------------------------------------
-- MUDANCA 2 — corpo identico ao atual, exceto o SELECT MAX (alias "lr")
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reservar_proximo_lote(
  p_codigo_curto text, p_ano_mes text, p_data_fabricacao date DEFAULT NULL::date,
  p_descricao_produto text DEFAULT NULL::text, p_observacao text DEFAULT NULL::text,
  p_permitir_paralelo boolean DEFAULT false)
 RETURNS TABLE(id uuid, numero_completo text, sequencia integer, digito_verificador integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_company UUID;
  v_user UUID;
  v_next INTEGER;
  v_base TEXT;
  v_dv INTEGER;
  v_numero TEXT;
  v_id UUID;
  v_pendente_count INTEGER;
  v_codigo TEXT;
  v_anomes TEXT;
BEGIN
  v_company := public.get_user_company_id();
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'usuario_sem_empresa_associada';
  END IF;
  v_user := auth.uid();

  v_codigo := upper(trim(p_codigo_curto));
  v_anomes := trim(p_ano_mes);

  IF v_codigo !~ '^[A-Z0-9]{2,8}$' THEN
    RAISE EXCEPTION 'codigo_curto_invalido_use_2_a_8_alfanumericos';
  END IF;
  IF v_anomes !~ '^[0-9]{4}$' THEN
    RAISE EXCEPTION 'ano_mes_invalido_use_AAMM';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtext(v_company::text || ':' || v_codigo || ':' || v_anomes)
  );

  IF NOT p_permitir_paralelo THEN
    SELECT COUNT(*) INTO v_pendente_count
    FROM public.lotes_reservados
    WHERE company_id = v_company
      AND codigo_curto = v_codigo
      AND ano_mes = v_anomes
      AND status = 'PENDENTE_REGULARIZACAO';

    IF v_pendente_count > 0 THEN
      RAISE EXCEPTION 'lote_pendente_regularizacao_bloqueia_nova_reserva'
        USING HINT = 'Regularize ou cancele o lote pendente antes de reservar outro número para este SKU/mês.';
    END IF;
  END IF;

  -- >>> UNICA ALTERACAO: alias "lr" desfaz a ambiguidade com o OUT "sequencia"
  SELECT COALESCE(MAX(lr.sequencia), 0) + 1 INTO v_next
  FROM public.lotes_reservados lr
  WHERE lr.company_id = v_company
    AND lr.codigo_curto = v_codigo
    AND lr.ano_mes = v_anomes;
  -- <<< fim da alteracao

  v_base := v_codigo || '-' || v_anomes || '-' || LPAD(v_next::text, 4, '0');
  v_dv := public.calcular_dv_lote(v_base);
  v_numero := v_base || '-' || v_dv::text;

  INSERT INTO public.lotes_reservados (
    company_id, codigo_curto, ano_mes, sequencia, digito_verificador,
    numero_completo, status, data_fabricacao, descricao_produto, observacao, reservado_por
  ) VALUES (
    v_company, v_codigo, v_anomes, v_next, v_dv,
    v_numero, 'PENDENTE_REGULARIZACAO',
    p_data_fabricacao, p_descricao_produto, p_observacao, v_user
  ) RETURNING lotes_reservados.id INTO v_id;

  id := v_id;
  numero_completo := v_numero;
  sequencia := v_next;
  digito_verificador := v_dv;
  RETURN NEXT;
END;
$function$;
