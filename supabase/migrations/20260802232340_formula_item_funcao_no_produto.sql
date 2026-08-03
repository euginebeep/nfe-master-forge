-- ═══════════════════════════════════════════════════════════════════════
-- SEPARACAO ATIVO x EXCIPIENTE
--
-- Por que NAO da para classificar por substancia:
--   Silicio  -> "Dioxido de silicio" e coadjuvante (IN 211)
--               "Acido ortosilicico" e constituinte (IN 28) — 3 formas na base
--   Magnesio -> "Estearato de magnesio" e coadjuvante
--               "Bisglicinato de magnesio" e constituinte — 29 formas na base
-- A MESMA familia quimica esta dos dois lados. O discriminador e a FUNCAO
-- DECLARADA no produto, nunca a identidade quimica.
--
-- Por que fica em formula_itens e nao em itens:
--   o mesmo po pode ser ativo num produto e excipiente em outro.
--   itens.* pode guardar sugestao para pre-preencher a tela, mas o gate
--   NAO le de la — duas fontes para a mesma pergunta foi o defeito que
--   gerou o falso NAO_AUTORIZADO em 02/08.
--
-- Direcao do fail-safe:
--   NULL (nao declarado) => tratado como ATIVO => exige vinculo => bloqueia.
--   Omissao tem que falhar para o lado ESTRITO. O contrario deixaria ativo
--   nao autorizado passar por esquecimento.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.formula_itens
  ADD COLUMN IF NOT EXISTS funcao_no_produto     text,
  ADD COLUMN IF NOT EXISTS funcao_tecnologica    text,
  ADD COLUMN IF NOT EXISTS funcao_justificativa  text,
  ADD COLUMN IF NOT EXISTS funcao_declarada_por  text,
  ADD COLUMN IF NOT EXISTS funcao_declarada_em   timestamptz;

ALTER TABLE public.formula_itens DROP CONSTRAINT IF EXISTS chk_funcao_no_produto;
ALTER TABLE public.formula_itens ADD CONSTRAINT chk_funcao_no_produto
  CHECK (funcao_no_produto IS NULL OR funcao_no_produto IN
         ('ATIVO','EXCIPIENTE','COADJUVANTE','VEICULO'));

-- Declarar que NAO e ativo exige nome da funcao tecnologica, justificativa e autor.
-- Nao impede mentir; impede mentir em silencio e sem assinatura.
ALTER TABLE public.formula_itens DROP CONSTRAINT IF EXISTS chk_funcao_nao_ativo_exige_justificativa;
ALTER TABLE public.formula_itens ADD CONSTRAINT chk_funcao_nao_ativo_exige_justificativa
  CHECK (
    funcao_no_produto IS NULL
    OR funcao_no_produto = 'ATIVO'
    OR (funcao_tecnologica   IS NOT NULL AND btrim(funcao_tecnologica)   <> ''
    AND funcao_justificativa IS NOT NULL AND btrim(funcao_justificativa) <> ''
    AND funcao_declarada_por IS NOT NULL AND btrim(funcao_declarada_por) <> '')
  );

COMMENT ON COLUMN public.formula_itens.funcao_no_produto IS
  'ATIVO = constituinte da IN 28, exige vinculo confirmado. '
  'EXCIPIENTE/COADJUVANTE/VEICULO = regido pela IN 211, nao tem vinculo IN 28. '
  'NULL = nao declarado, tratado como ATIVO (fail-safe: omissao falha para o '
  'lado estrito). Fica aqui e nao em itens porque o mesmo po pode ser ativo '
  'num produto e excipiente em outro.';
COMMENT ON COLUMN public.formula_itens.funcao_tecnologica IS
  'Funcao da IN 211 quando nao for ATIVO: lubrificante, antiumectante, '
  'agente de desmoldagem, veiculo, edulcorante, regulador de acidez...';

-- ── Guarda contra o desvio obvio: marcar ativo como excipiente ──────────
CREATE OR REPLACE FUNCTION public.formula_item_guarda_funcao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_vinc int; v_nome text;
BEGIN
  IF NEW.funcao_no_produto IS NULL OR NEW.funcao_no_produto = 'ATIVO' THEN
    IF NEW.funcao_no_produto IS NOT NULL THEN
      NEW.funcao_declarada_em := COALESCE(NEW.funcao_declarada_em, now());
    END IF;
    RETURN NEW;
  END IF;

  -- A RT ja confirmou que este insumo E um constituinte da IN 28.
  -- Declarar excipiente aqui contradiz a propria confirmacao dela.
  SELECT count(*) INTO v_vinc FROM item_anvisa_vinculo v
   WHERE v.item_id = NEW.produto_materia_prima_id
     AND v.company_id = NEW.company_id
     AND v.status = 'confirmado' AND v.constituinte_id IS NOT NULL;

  IF v_vinc > 0 THEN
    SELECT descricao_interna INTO v_nome FROM itens WHERE id = NEW.produto_materia_prima_id;
    RAISE EXCEPTION 'funcao_no_produto: "%" tem vinculo CONFIRMADO pela RT a % '
      'constituinte(s) da IN 28 e nao pode ser declarado %. Se ele entra como '
      'excipiente neste produto, remova antes o vinculo — a RT nao pode ter '
      'afirmado as duas coisas.', COALESCE(v_nome, NEW.nome_insumo), v_vinc,
      NEW.funcao_no_produto;
  END IF;

  IF COALESCE(NEW.ativo_critico,false) THEN
    RAISE EXCEPTION 'funcao_no_produto: "%" esta marcado ativo_critico e nao pode '
      'ser declarado %.', NEW.nome_insumo, NEW.funcao_no_produto;
  END IF;

  NEW.funcao_declarada_em := COALESCE(NEW.funcao_declarada_em, now());
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_formula_item_guarda_funcao ON public.formula_itens;
CREATE TRIGGER trg_formula_item_guarda_funcao
  BEFORE INSERT OR UPDATE ON public.formula_itens
  FOR EACH ROW EXECUTE FUNCTION public.formula_item_guarda_funcao();