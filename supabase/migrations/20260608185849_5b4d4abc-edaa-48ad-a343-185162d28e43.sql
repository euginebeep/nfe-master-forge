-- ── BASE DO MANUAL ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.manual_secoes (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ordem       INTEGER NOT NULL,
  titulo      TEXT NOT NULL,
  subtitulo   TEXT,
  icon        TEXT,           -- nome do ícone lucide-react
  badge       TEXT,           -- ex: 'IMPORTANTE', 'NOVO', 'BPF'
  ativo       BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.manual_perguntas (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  secao_id     UUID REFERENCES public.manual_secoes(id) ON DELETE CASCADE,
  ordem        INTEGER NOT NULL,
  pergunta     TEXT NOT NULL,
  resposta     TEXT NOT NULL,
  tags         TEXT[],        -- para busca semântica
  nivel        TEXT DEFAULT 'basico'
               CHECK (nivel IN ('basico','intermediario','avancado')),
  modulo       TEXT,          -- ex: 'producao', 'estoque', 'anvisa', 'nfe'
  video_url    TEXT,          -- link YouTube opcional
  imagem_url   TEXT,          -- screenshot opcional
  ativo        BOOLEAN DEFAULT true,
  visualizacoes INTEGER DEFAULT 0,
  util_sim     INTEGER DEFAULT 0,  -- votos "foi útil"
  util_nao     INTEGER DEFAULT 0,  -- votos "não foi útil"
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

-- ── LOG DE BUSCAS (para entender o que os usuários não encontram) ─────────
CREATE TABLE IF NOT EXISTS public.manual_busca_log (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id  UUID REFERENCES public.company(id) ON DELETE SET NULL,
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  termo       TEXT NOT NULL,
  resultados  INTEGER DEFAULT 0,
  clicou_em   UUID REFERENCES public.manual_perguntas(id),
  usou_ia     BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ── HISTÓRICO DE PERGUNTAS AO ASSISTENTE VIA MANUAL ──────────────────────
CREATE TABLE IF NOT EXISTS public.manual_ia_historico (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id  UUID REFERENCES public.company(id) ON DELETE SET NULL,
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  pergunta    TEXT NOT NULL,
  resposta    TEXT NOT NULL,
  secao_contexto TEXT, -- seção que estava aberta quando perguntou
  tokens_usados INTEGER,
  duracao_ms  INTEGER,
  avaliacao   SMALLINT, -- 1-5 estrelas (opcional)
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ── RLS ───────────────────────────────────────────────────────────
GRANT SELECT ON public.manual_secoes TO authenticated, anon;
GRANT ALL ON public.manual_secoes TO service_role;
ALTER TABLE public.manual_secoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "todos_leem_secoes" ON public.manual_secoes FOR SELECT USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.manual_perguntas TO authenticated;
GRANT SELECT ON public.manual_perguntas TO anon;
GRANT ALL ON public.manual_perguntas TO service_role;
ALTER TABLE public.manual_perguntas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "todos_leem_perguntas" ON public.manual_perguntas FOR SELECT USING (true);
CREATE POLICY "auth_vota_perguntas" ON public.manual_perguntas FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

GRANT INSERT, SELECT ON public.manual_busca_log TO authenticated;
GRANT ALL ON public.manual_busca_log TO service_role;
ALTER TABLE public.manual_busca_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_insere_busca" ON public.manual_busca_log FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

GRANT ALL ON public.manual_ia_historico TO authenticated;
GRANT ALL ON public.manual_ia_historico TO service_role;
ALTER TABLE public.manual_ia_historico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_ver_proprio_historico" ON public.manual_ia_historico FOR ALL USING (user_id = auth.uid());

-- ── FUNÇÃO RPC PARA VOTOS ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.increment_manual_voto(pergunta_id UUID, campo_voto TEXT)
RETURNS VOID AS $$
BEGIN
  IF campo_voto = 'util_sim' THEN
    UPDATE public.manual_perguntas SET util_sim = util_sim + 1 WHERE id = pergunta_id;
  ELSIF campo_voto = 'util_nao' THEN
    UPDATE public.manual_perguntas SET util_nao = util_nao + 1 WHERE id = pergunta_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── SEED (Integrando TODAS as perguntas do FAQPage.tsx) ───────────────────────────────
DO $$
DECLARE
  v_secao_id UUID;
BEGIN
  -- Seção 1
  INSERT INTO public.manual_secoes (ordem, titulo, subtitulo, icon) VALUES (1, '1. Primeiros Passos', 'Criação de conta, primeiro acesso e onboarding', 'Rocket') RETURNING id INTO v_secao_id;
  INSERT INTO public.manual_perguntas (secao_id, ordem, pergunta, resposta, nivel) VALUES
  (v_secao_id, 1, 'Como criar minha conta no ERP?', 'Acesse a tela de login e clique em ''Criar conta''. Preencha seu e-mail e senha (mínimo 6 caracteres). Você receberá um e-mail de verificação — clique no link para ativar sua conta. Após confirmar, faça login normalmente.', 'basico'),
  (v_secao_id, 2, 'O que acontece no primeiro login?', 'No primeiro acesso, você será redirecionado para a tela de Onboarding, onde deverá cadastrar os dados da sua empresa (CNPJ, Razão Social, Endereço). Este passo é obrigatório para usar o ERP.', 'basico'),
  (v_secao_id, 3, 'Posso usar o ERP sem cadastrar a empresa?', 'Não. O cadastro da empresa é obrigatório. Sem ele, o sistema não permite o acesso aos módulos. Isso garante que todos os documentos fiscais, notas e relatórios tenham os dados corretos da empresa.', 'basico');

  -- Seção 2
  INSERT INTO public.manual_secoes (ordem, titulo, subtitulo, icon) VALUES (2, '2. Configurações da Empresa', 'CNPJ, certificado digital, regime tributário', 'Building2') RETURNING id INTO v_secao_id;
  INSERT INTO public.manual_perguntas (secao_id, ordem, pergunta, resposta, nivel) VALUES
  (v_secao_id, 1, 'Como acessar as configurações da empresa?', 'No menu lateral, clique em ''Configurações'' → ''Empresa''. Lá você encontra todos os dados cadastrais, fiscais, logo e certificado digital. Apenas administradores têm acesso.', 'basico'),
  (v_secao_id, 2, 'O que é o Regime Tributário e como preencher?', 'O Regime Tributário define como sua empresa calcula os impostos: Simples Nacional (faturamento até R$ 4,8M/ano), Lucro Presumido ou Lucro Real. Selecione o regime correto conforme orientação do seu contador. Isso afeta diretamente os cálculos fiscais das NF-e.', 'basico'),
  (v_secao_id, 3, 'Como fazer upload do Logo da empresa?', 'Em Configurações → Empresa, há um campo para upload de logo. Aceita imagens PNG ou JPG. O logo aparecerá nos documentos impressos (Ordens de Produção, NF-e, contratos).', 'basico'),
  (v_secao_id, 4, 'Como configurar o Certificado Digital A1?', 'Em Configurações → Empresa, na seção ''Certificado Digital'': 1) Primeiro preencha a senha do certificado; 2) Clique para fazer upload do arquivo .pfx; 3) O sistema valida automaticamente se o CNPJ do certificado é igual ao da empresa; 4) Se válido, mostra a data de vencimento. IMPORTANTE: o certificado A1 tem validade de 1 ano — o sistema alerta quando faltar 30 dias para vencer.', 'basico'),
  (v_secao_id, 5, 'O que são CSC e Token NFC-e?', 'CSC (Código de Segurança do Contribuinte) e Token são credenciais fornecidas pela SEFAZ do seu estado para emissão de NFC-e (Nota Fiscal ao Consumidor). Você obtém esses dados no portal da SEFAZ. Configure em Configurações → Empresa na seção fiscal.', 'basico'),
  (v_secao_id, 6, 'Qual a diferença entre Homologação e Produção?', 'Homologação é o ambiente de testes da SEFAZ — as notas emitidas não têm valor fiscal. Produção é o ambiente real. Comece em Homologação para testar, e quando tudo estiver correto, mude para Produção. Essa configuração fica em Configurações → Empresa.', 'basico'),
  (v_secao_id, 7, 'O que é o CEP automático (ViaCEP)?', 'Ao digitar o CEP no cadastro de endereço, o sistema consulta automaticamente o serviço ViaCEP e preenche logradouro, bairro, cidade e UF. Isso economiza tempo e evita erros de digitação.', 'basico');

  -- Seção 3
  INSERT INTO public.manual_secoes (ordem, titulo, subtitulo, icon) VALUES (3, '3. Gestão de Usuários', 'Perfis de acesso e segurança', 'Users') RETURNING id INTO v_secao_id;
  INSERT INTO public.manual_perguntas (secao_id, ordem, pergunta, resposta, nivel) VALUES
  (v_secao_id, 1, 'Como criar novos usuários?', 'Menu lateral → Usuários. Apenas administradores podem criar novos usuários. Informe nome, e-mail e selecione o perfil (admin, gerente, supervisor, operador). Cada perfil tem permissões diferentes nos módulos.', 'basico'),
  (v_secao_id, 2, 'Quais são os perfis disponíveis?', '• Admin: acesso total, pode criar usuários e alterar configurações\n• Gerente: acesso ao financeiro, dashboards executivos\n• Supervisor: acesso à produção, fórmulas, ordens de produção\n• Operador: acesso básico a compras, vendas e cadastros', 'basico'),
  (v_secao_id, 3, 'O que é o timeout por inatividade?', 'Por segurança, se o usuário ficar 2 horas sem interagir com o sistema (sem mover mouse, digitar ou rolar a tela), o logout é feito automaticamente. Isso protege dados sensíveis em computadores compartilhados.', 'basico');

  -- Seção 4
  INSERT INTO public.manual_secoes (ordem, titulo, subtitulo, icon, badge) VALUES (4, '4. Duas Formas de Cadastrar: XML vs Manual', 'Importação automática vs Cadastro tradicional', 'FileInput', 'IMPORTANTE') RETURNING id INTO v_secao_id;
  INSERT INTO public.manual_perguntas (secao_id, ordem, pergunta, resposta, nivel) VALUES
  (v_secao_id, 1, 'Qual a diferença entre importar XML e cadastrar manualmente?', 'Ao importar um XML de NF-e de entrada, o sistema cria AUTOMATICAMENTE: Fornecedor, Itens (matérias-primas), Lotes com validade, dados fiscais completos e até Contas a Pagar. É o caminho mais rápido. O cadastro manual é para quando não se tem o XML disponível.', 'basico'),
  (v_secao_id, 2, 'O que exatamente é extraído do XML automaticamente?', 'FORNECEDOR: Razão Social, CNPJ, IE, IM, CNAE, CRT, endereço completo, telefone, e-mail.\nTRANSPORTADORA: Se houver dados de frete (CNPJ, razão, placa, ANTT).\nITENS: Descrição, NCM, CFOP, EAN/GTIN, unidade, valor unitário — para cada produto da nota.\nLOTES: Número do lote, fabricação, validade, quantidade, custo unitário.\nFISCAL: ICMS (base, alíquota, valor, CST, ST), IPI, PIS, COFINS — tudo por item.\nFINANCEIRO: Duplicatas/faturas geram Contas a Pagar automaticamente.\nNOTA: Chave de acesso (44 dígitos), série, número, natureza da operação, protocolo SEFAZ.', 'basico'),
  (v_secao_id, 3, 'Se eu importar o XML, preciso cadastrar o fornecedor manualmente?', 'NÃO! Esse é o grande benefício. Ao importar o XML, o fornecedor é criado automaticamente com todos os dados fiscais corretos. Se o fornecedor já existir (mesmo CNPJ), o sistema apenas vincula a nota a ele sem duplicar.', 'basico'),
  (v_secao_id, 4, 'E as matérias-primas, preciso cadastrar uma a uma?', 'NÃO, se você importar o XML! Cada item da nota fiscal é criado automaticamente como item no sistema (com NCM, EAN, unidade e valor). Se o item já existir (por EAN ou NCM+descrição), ele não duplica — apenas vincula.', 'basico'),
  (v_secao_id, 5, 'Os lotes também são criados automaticamente?', 'SIM. Cada item da NF-e gera um lote com: número do lote, data de fabricação, data de validade, quantidade e custo unitário. Os lotes ficam disponíveis no estoque para uso em Ordens de Produção.', 'basico'),
  (v_secao_id, 6, 'E as Contas a Pagar?', 'Se o XML contiver dados de fatura/duplicatas (campo cobr/dup), as Contas a Pagar são geradas automaticamente com valores e datas de vencimento. Caso contrário, você pode cadastrá-las manualmente.', 'basico'),
  (v_secao_id, 7, 'Quando devo usar o cadastro manual?', 'Use o cadastro manual quando: 1) Não tem o XML disponível; 2) O fornecedor é informal e não emite NF-e; 3) Precisa cadastrar clientes (que não vêm de XML de entrada); 4) Quer adicionar informações complementares que não estão no XML (como classificação, tags, CRM).', 'basico'),
  (v_secao_id, 8, 'Como importar o XML?', 'Menu lateral → Compras → Importar NF-e. Arraste o arquivo .xml ou clique para selecionar. O sistema mostra uma pré-visualização tipo DANFE. Confira os dados e confirme a importação. Todos os cadastros são criados automaticamente.', 'basico');

  -- Seção 10 (Regulatório)
  INSERT INTO public.manual_secoes (ordem, titulo, subtitulo, icon) VALUES (10, '10. Regulatório e ANVISA', 'Consulta de constituintes e alegações', 'FlaskConical') RETURNING id INTO v_secao_id;
  INSERT INTO public.manual_perguntas (secao_id, ordem, pergunta, resposta, nivel) VALUES
  (v_secao_id, 1, 'O que é a Consulta Regulatória ANVISA?', 'O sistema possui uma base de dados dos constituintes autorizados pela ANVISA (vitaminas, minerais, aminoácidos, etc.) com limites por faixa etária. Ao criar uma fórmula, você pode consultar se o ativo é permitido e quais são os limites máximos.', 'basico'),
  (v_secao_id, 2, 'O que são Alegações de Saúde?', 'São textos específicos aprovados pela ANVISA que podem constar na rotulagem do produto (ex: ''Fonte de Vitamina C''). O sistema lista as alegações permitidas para cada constituinte da fórmula.', 'basico'),
  (v_secao_id, 3, 'A base ANVISA é atualizada automaticamente?', 'Sim, o sistema possui sincronização automática com a base regulatória. O painel de Regulatório mostra a data da última sincronização e permite disparar atualizações manuais.', 'basico');

  -- Adicionando perguntas novas (Step 5 do manual)
  INSERT INTO public.manual_perguntas (secao_id, ordem, pergunta, resposta, modulo, nivel) 
  VALUES (v_secao_id, 99, 'Como o ANVISA Checker verifica minha fórmula?', 'O ANVISA Checker usa IA + Power BI ANVISA oficial (atualizado diariamente às 03h). Quando você faz upload de um briefing (ZIP ou DOCX), o sistema: 1) Extrai o texto real do arquivo; 2) Identifica cada ativo e dose; 3) Cruza com a base oficial de constituintes autorizados; 4) Gera um laudo com status APROVADO/BLOQUEADO/VERIFICAR para cada ingrediente.', 'anvisa', 'intermediario');

END $$;
