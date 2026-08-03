-- Escopo do BrainX: SUPLEMENTO ALIMENTAR INDUSTRIALIZADO, exclusivamente.
-- Fora do escopo, cada um com marco regulatorio e licenca proprios:
--   medicamento                 -> RDC 658/2022 (BPF), AFE de medicamentos
--   fitoterapico / tradicional  -> RDC 26/2014, tambem medicamento
--   manipulado / magistral      -> RDC 67/2007, farmacia com farmaceutico RT,
--                                  prescricao individualizada — nao e industria
--
-- Manipulado e a confusao mais frequente porque "capsula com formula sob
-- medida" parece o mesmo produto. Nao e: manipulacao e ato farmaceutico para
-- paciente identificado, com receita. Industria de suplemento produz lote para
-- consumo geral, sob notificacao. Confundir os dois muda licenca, BPF, rotulo
-- e responsavel tecnico.

CREATE OR REPLACE FUNCTION public.anvisa_via_fora_da_in28(p_company_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_esc text[];
BEGIN
  SELECT escopo_licenciado INTO v_esc FROM company WHERE id = p_company_id;
  v_esc := COALESCE(v_esc, ARRAY['SUPLEMENTO_ALIMENTAR']::text[]);

  RETURN jsonb_build_object(
    'escopo_licenciado', to_jsonb(v_esc),
    'via_alimento','Se houver evidencia de seguranca e uso, cabe peticionar '
      || 'NOVO INGREDIENTE (RDC 839/2024) para inclusao na lista da IN 28. '
      || 'E processo longo, de responsabilidade da empresa, e NAO libera uso '
      || 'enquanto nao deferido. Unica via de ALIMENTO disponivel.',
    'via_medicamento', CASE
      WHEN 'MEDICAMENTO' = ANY(v_esc) OR 'FITOTERAPICO' = ANY(v_esc)
        THEN 'Esta planta declara escopo de medicamento/fitoterapico.'
        ELSE 'INDISPONIVEL. Fitoterapico e produto tradicional fitoterapico sao '
          || 'MEDICAMENTOS (RDC 26/2014): exigem AFE de medicamentos, BPF da '
          || 'RDC 658/2022 e planta habilitada.' END,
    'via_manipulacao', CASE
      WHEN 'MANIPULADO' = ANY(v_esc)
        THEN 'Esta planta declara escopo de manipulacao.'
        ELSE 'INDISPONIVEL E NAO COMPARAVEL. Manipulacao magistral (RDC 67/2007) '
          || 'e ato farmaceutico para paciente identificado, com prescricao, em '
          || 'farmacia com farmaceutico RT. Industria de suplemento produz LOTE '
          || 'para consumo geral sob notificacao. Nao e a mesma atividade, ainda '
          || 'que a forma farmaceutica seja igual.' END,
    'aviso','Fabricar sob via fora do escopo licenciado e infracao sanitaria, '
      || 'nao alternativa. O ERP nao oferece essas vias como opcao.',
    'conclusao_pratica','Enquanto o constituinte nao constar da IN 28/2018, o '
      || 'ativo NAO pode entrar em suplemento alimentar produzido aqui. '
      || 'Reformular e o unico caminho disponivel hoje.');
END; $$;

COMMENT ON COLUMN public.company.escopo_licenciado IS
  'O que esta planta pode fabricar. SUPLEMENTO_ALIMENTAR e o unico escopo do '
  'BrainX. MEDICAMENTO, FITOTERAPICO e MANIPULADO exigem licenca, BPF e RT '
  'proprios — NAO incluir sem comprovacao documental. O motor nunca sugere via '
  'fora do escopo: sugerir fabricacao sem licenca e induzir infracao sanitaria.';