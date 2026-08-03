-- CORRECAO DE PRINCIPIO 02/08/2026.
-- O motor devolvia, para ativo fora da IN 28:
--   "Se botanico com uso medicinal, avaliar como fitoterapico, produto
--    tradicional fitoterapico ou novo ingrediente."
--
-- Errado para este ERP. Fitoterapico e MEDICAMENTO: exige AFE de medicamentos,
-- BPF da RDC 658/2022 e planta habilitada. ProLab tem CNAE 1099-6/07
-- (alimentos dieteticos e complementos alimentares) — ALIMENTO.
-- Sugerir a via de medicamento a quem so pode fabricar alimento induz a
-- fabricacao sem licenca, que e infracao sanitaria grave, nao "outra opcao".
--
-- Novo ingrediente (RDC 839/2024) SIM e via de alimento e continua valida.

ALTER TABLE public.company
  ADD COLUMN IF NOT EXISTS escopo_licenciado text[] NOT NULL
    DEFAULT ARRAY['SUPLEMENTO_ALIMENTAR']::text[];

COMMENT ON COLUMN public.company.escopo_licenciado IS
  'O que esta planta pode fabricar. SUPLEMENTO_ALIMENTAR e o default do BrainX. '
  'MEDICAMENTO e FITOTERAPICO exigem AFE de medicamentos e BPF RDC 658/2022 — '
  'NAO incluir sem comprovacao documental. O motor nunca sugere via fora do '
  'escopo: sugerir fabricacao sem licenca e induzir a infracao sanitaria.';

-- Aceita o novo status. AVALIAR_FITOTERAPICO fica no CHECK para nao quebrar o
-- PR #181 em draft, mas o motor nao emite mais — ver COMMENT.
ALTER TABLE public.anvisa_laudo_pareceres DROP CONSTRAINT IF EXISTS chk_parecer_status;
ALTER TABLE public.anvisa_laudo_pareceres ADD CONSTRAINT chk_parecer_status CHECK (status IN (
  'APROVADO','APROVAVEL_COM_CORRECAO','PENDENTE_VERIFICACAO',
  'NAO_AUTORIZADO','FORA_DO_ESCOPO_LICENCA','REPROVADO_ALEGACAO',
  'AVALIAR_FITOTERAPICO'));

COMMENT ON COLUMN public.anvisa_laudo_pareceres.status IS
  'PENDENTE_VERIFICACAO e NAO_AUTORIZADO sao coisas diferentes: o primeiro '
  'espera dado, o segundo exige tirar o ativo da formula. '
  'FORA_DO_ESCOPO_LICENCA = so seria possivel sob licenca que esta planta NAO '
  'tem. AVALIAR_FITOTERAPICO esta DEPRECADO: sugeria via de medicamento a '
  'fabrica de alimento.';

-- Retorno do motor para ativo ausente: sem via de medicamento.
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
      || 'E processo longo e de responsabilidade da empresa — nao libera uso '
      || 'enquanto nao deferido.',
    'via_medicamento', CASE
      WHEN 'MEDICAMENTO' = ANY(v_esc) OR 'FITOTERAPICO' = ANY(v_esc)
        THEN 'Esta planta declara escopo de medicamento/fitoterapico.'
        ELSE 'INDISPONIVEL. Fitoterapico e produto tradicional fitoterapico sao '
          || 'MEDICAMENTOS: exigem AFE de medicamentos, BPF da RDC 658/2022 e '
          || 'planta habilitada. Esta empresa esta licenciada apenas para '
          || array_to_string(v_esc, ', ')
          || '. Fabricar sob outra via sem licenca e infracao sanitaria.' END,
    'conclusao_pratica','Enquanto o constituinte nao constar da IN 28/2018, o '
      || 'ativo NAO pode entrar em suplemento alimentar produzido aqui. '
      || 'Reformular e o unico caminho disponivel hoje.');
END; $$;

COMMENT ON FUNCTION public.anvisa_via_fora_da_in28(uuid) IS
  'Vias disponiveis quando o ativo nao consta da IN 28, filtradas pelo escopo '
  'licenciado da planta. NUNCA sugerir via de medicamento a fabrica de alimento.';