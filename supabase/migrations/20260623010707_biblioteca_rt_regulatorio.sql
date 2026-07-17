-- ═══════════════════════════════════════════════════════════════════════════
-- MÓDULO: Regulatório → Biblioteca do RT (Copilot travado em fonte oficial)
-- Referências: RDC 243/2018, RDC 275/2002, IN 28/2018 e atualizações
-- ═══════════════════════════════════════════════════════════════════════════

-- Habilitar extensão pgvector para embeddings (se ainda não habilitada)
CREATE EXTENSION IF NOT EXISTS vector;

-- ─── 1. DOCUMENTOS-FONTE ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.legislacao_fontes (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo                     TEXT NOT NULL CHECK (tipo IN ('RDC','IN','PORTARIA','LEI','GUIA','OUTRO')),
  numero                   TEXT NOT NULL,
  ano                      INTEGER NOT NULL,
  titulo                   TEXT NOT NULL,
  categoria                TEXT NOT NULL CHECK (categoria IN (
                             'NUCLEO_SUPLEMENTO',
                             'ATUALIZACAO_IN28',
                             'ROTULAGEM',
                             'BPF_GERAL',
                             'APOIO_PERGUNTAS_RESPOSTAS',
                             'REFERENCIA_MEDICAMENTO_NAO_APLICAVEL'
                           )),
  url_oficial              TEXT NOT NULL,
  status                   TEXT NOT NULL DEFAULT 'VIGENTE' CHECK (status IN ('VIGENTE','REVOGADA','ALTERADA')),
  texto_completo           TEXT,
  hash_conteudo            TEXT,
  data_publicacao          DATE,
  data_ultima_verificacao  TIMESTAMPTZ,
  aprovado_por             UUID REFERENCES auth.users(id),
  aprovado_em              TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.legislacao_fontes IS 'Documentos-fonte da base de conhecimento regulatória (normas ANVISA, leis, guias). Toda inserção exige aprovação humana explícita (aprovado_por).';
COMMENT ON COLUMN public.legislacao_fontes.categoria IS 'REFERENCIA_MEDICAMENTO_NAO_APLICAVEL = norma de medicamento incluída propositalmente para a IA poder responder "não se aplica a suplemento" em vez de silêncio ambíguo.';

-- ─── 2. CHUNKS / TRECHOS PARA RAG ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.legislacao_chunks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fonte_id    UUID NOT NULL REFERENCES public.legislacao_fontes(id) ON DELETE CASCADE,
  referencia  TEXT NOT NULL,   -- ex: 'Art. 10, §1º' ou 'Anexo IV — curcuminoides'
  texto       TEXT NOT NULL,
  embedding   VECTOR(1536),    -- OpenAI text-embedding-3-small (1536 dims)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS legislacao_chunks_embedding_idx
  ON public.legislacao_chunks USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

COMMENT ON TABLE public.legislacao_chunks IS 'Trechos indexados para busca semântica (RAG). Cada artigo/parágrafo/anexo é um chunk independente com embedding gerado pela Edge Function legislacao-ingest.';

-- ─── 3. LOG DE MONITORAMENTO DIÁRIO ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.legislacao_monitoramento (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fonte_monitorada    TEXT NOT NULL,  -- 'ANVISALEGIS_IN28' | 'NOTICIAS_ANVISA' | 'DOU'
  url                 TEXT NOT NULL,
  hash_anterior       TEXT,
  hash_novo           TEXT,
  mudanca_detectada   BOOLEAN DEFAULT false,
  resumo_mudanca      TEXT,           -- gerado por IA, SEMPRE revisado por humano antes de aprovar
  status_revisao      TEXT DEFAULT 'PENDENTE' CHECK (status_revisao IN ('PENDENTE','APROVADO','DESCARTADO')),
  revisado_por        UUID REFERENCES auth.users(id),
  revisado_em         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.legislacao_monitoramento IS 'Log do robô de monitoramento diário. Só detecta e alerta — NUNCA publica automaticamente em legislacao_fontes. Toda mudança aguarda revisão humana (status_revisao = PENDENTE).';

-- ─── 4. TRILHAS DE ESTUDO ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trilhas_estudo (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo              TEXT NOT NULL,
  categoria           TEXT NOT NULL CHECK (categoria IN (
                        'POPS','TABELA_NUTRICIONAL','BPF','ROTULAGEM',
                        'ALEGACOES','LIMITES_DOSE','ESTABILIDADE','FISCALIZACAO'
                      )),
  nivel               TEXT DEFAULT 'INICIANTE' CHECK (nivel IN ('INICIANTE','INTERMEDIARIO')),
  conteudo_md         TEXT NOT NULL,
  fontes_relacionadas UUID[] DEFAULT '{}',
  ordem               INTEGER DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.trilhas_estudo IS 'Conteúdo didático estruturado para o RT. Não é legislação crua — é guia de estudo baseado nas fontes oficiais carregadas na base.';

-- ─── 5. HISTÓRICO DE PERGUNTAS (AUDITÁVEL) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.legislacao_perguntas (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID NOT NULL REFERENCES public.company(id),
  usuario_id          UUID NOT NULL REFERENCES auth.users(id),
  pergunta            TEXT NOT NULL,
  resposta            TEXT,
  chunks_usados       UUID[] DEFAULT '{}',
  encontrou_resposta  BOOLEAN,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.legislacao_perguntas IS 'Histórico auditável de todas as perguntas feitas ao Copilot Regulatório. Rastreável: se um RT seguiu uma orientação, é possível ver qual chunk da base sustentou a resposta.';

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.legislacao_fontes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legislacao_chunks       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legislacao_monitoramento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trilhas_estudo          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legislacao_perguntas    ENABLE ROW LEVEL SECURITY;

-- Base de legislação é compartilhada entre todos os tenants (leitura livre para autenticados)
CREATE POLICY "read_legislacao_fontes"
  ON public.legislacao_fontes FOR SELECT TO authenticated USING (true);

CREATE POLICY "read_legislacao_chunks"
  ON public.legislacao_chunks FOR SELECT TO authenticated USING (true);

CREATE POLICY "read_trilhas_estudo"
  ON public.trilhas_estudo FOR SELECT TO authenticated USING (true);

-- Monitoramento: leitura para autenticados, escrita apenas via service_role (Edge Function)
CREATE POLICY "read_legislacao_monitoramento"
  ON public.legislacao_monitoramento FOR SELECT TO authenticated USING (true);

-- Perguntas: cada empresa vê apenas as suas (RLS por company_id)
CREATE POLICY "own_company_perguntas"
  ON public.legislacao_perguntas FOR ALL TO authenticated
  USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

-- ─── SEED INICIAL: NORMAS DE REFERÊNCIA ──────────────────────────────────────
-- Inseridas sem texto_completo e sem aprovado_por — aguardam curadoria humana
-- para ter o texto extraído e aprovado antes de ficarem disponíveis para RAG.
INSERT INTO public.legislacao_fontes (tipo, numero, ano, titulo, categoria, url_oficial, status, data_publicacao) VALUES
  ('RDC', '275',  2002, 'Boas Práticas de Fabricação gerais de alimentos',                          'NUCLEO_SUPLEMENTO',                    'https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2002/res0275_21_10_2002.html',    'VIGENTE', '2002-10-21'),
  ('RDC', '259',  2002, 'Rotulagem geral de alimentos embalados',                                   'ROTULAGEM',                            'https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2002/res0259_20_09_2002.html',    'VIGENTE', '2002-09-20'),
  ('RDC', '269',  2005, 'IDR — Ingestão Diária Recomendada (base do %VD)',                          'NUCLEO_SUPLEMENTO',                    'https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2005/res0269_22_09_2005.html',    'VIGENTE', '2005-09-22'),
  ('RDC', '27',   2010, 'Categorias de alimentos com e sem registro obrigatório',                   'NUCLEO_SUPLEMENTO',                    'https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2010/rdc0027_06_08_2010.html',    'VIGENTE', '2010-08-06'),
  ('RDC', '241',  2018, 'Probióticos em suplementos alimentares',                                   'NUCLEO_SUPLEMENTO',                    'https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2018/rdc0241_26_07_2018.pdf',     'VIGENTE', '2018-07-26'),
  ('RDC', '243',  2018, 'Requisitos sanitários específicos de suplementos alimentares',             'NUCLEO_SUPLEMENTO',                    'https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2018/rdc0243_26_07_2018.pdf',     'VIGENTE', '2018-07-26'),
  ('IN',  '28',   2018, 'Listas de constituintes, limites e alegações de suplementos (consolidada)','NUCLEO_SUPLEMENTO',                    'https://anvisalegis.datalegis.net/action/UrlPublicasAction.php?acao=abrirAtoPublico&num_ato=00000028&sgl_tipo=INS&sgl_orgao=ANVS&ano_ato=2018', 'VIGENTE', '2018-07-26'),
  ('RDC', '429',  2020, 'Rotulagem nutricional de alimentos embalados (vigente)',                   'ROTULAGEM',                            'https://www.gov.br/anvisa/pt-br/assuntos/noticias-anvisa/2020/anvisa-publica-novas-regras-para-rotulagem-nutricional',                        'VIGENTE', '2020-10-08'),
  ('IN',  '75',   2020, 'Informação nutricional complementar',                                      'ROTULAGEM',                            'https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2020/int0075_08_10_2020.pdf',     'VIGENTE', '2020-10-08'),
  ('RDC', '778',  2023, 'Aditivos alimentares e coadjuvantes de tecnologia em suplementos',        'NUCLEO_SUPLEMENTO',                    'https://www.gov.br/anvisa/pt-br/assuntos/legislacao/legislacao-especifica-dos-servicos/alimentos',                                           'VIGENTE', '2023-01-01'),
  ('IN',  '373',  2025, 'Atualização IN 28/2018 — GABA, 2''-FL e outros constituintes',            'ATUALIZACAO_IN28',                     'https://anvisalegis.datalegis.net',                                                 'VIGENTE', '2025-01-01'),
  ('IN',  '418',  2025, 'Atualização pontual da IN 28/2018',                                       'ATUALIZACAO_IN28',                     'https://anvisalegis.datalegis.net',                                                 'VIGENTE', '2025-01-01'),
  ('IN',  '431',  2026, 'Atualização pontual da IN 28/2018',                                       'ATUALIZACAO_IN28',                     'https://anvisalegis.datalegis.net',                                                 'VIGENTE', '2026-01-01'),
  ('IN',  '438',  2026, 'Cúrcuma/curcuminoides — atualização IN 28/2018',                          'ATUALIZACAO_IN28',                     'https://www.gov.br/anvisa/pt-br/assuntos/noticias-anvisa',                          'VIGENTE', '2026-01-01'),
  ('OUTRO','—',   2023, 'Perguntas e Respostas sobre Suplementos Alimentares (ANVISA)',             'APOIO_PERGUNTAS_RESPOSTAS',             'https://www.gov.br/anvisa/pt-br/assuntos/alimentos/suplementos-alimentares',       'VIGENTE', '2023-01-01'),
  ('OUTRO','—',   2023, 'Esclarecimentos Gerais sobre Suplementos Alimentares (ANVISA)',            'APOIO_PERGUNTAS_RESPOSTAS',             'https://antigo.anvisa.gov.br/suplementos-alimentares',                             'VIGENTE', '2023-01-01'),
  -- RDC 658/2022 entra propositalmente como REFERENCIA_MEDICAMENTO_NAO_APLICAVEL
  -- para a IA poder responder "essa é norma de medicamento, não se aplica a suplemento"
  ('RDC', '658',  2022, 'Boas Práticas de Fabricação de MEDICAMENTOS (não aplicável a suplementos)','REFERENCIA_MEDICAMENTO_NAO_APLICAVEL', 'https://www.gov.br/anvisa/pt-br/assuntos/legislacao/legislacao-especifica-dos-servicos/medicamentos', 'VIGENTE', '2022-01-01')
ON CONFLICT DO NOTHING;

-- ─── SEED: TRILHAS DE ESTUDO ─────────────────────────────────────────────────
-- Conteúdo factual alinhado às fontes oficiais (sessão 17/07).
-- Correção idempotente também em 20260717130000_trilhas_estudo_conteudo_oficial.sql
INSERT INTO public.trilhas_estudo (titulo, categoria, nivel, conteudo_md, ordem) VALUES
(
  'Os 8 POPs obrigatórios para suplementos (RDC 275/2002)',
  'POPS', 'INICIANTE',
  E'# Os 8 POPs obrigatórios — RDC 275/2002

A RDC 275/2002 (item 4.1.1) exige que toda fábrica de alimentos (incluindo suplementos) mantenha **Procedimentos Operacionais Padronizados (POPs)** escritos, implementados e registrados para estas oito operações:

| # | POP (letra da norma) | O que deve conter |
|---|---|---|
| 1 | a) Higienização das instalações, equipamentos, móveis e utensílios | Natureza da superfície, método, princípio ativo e concentração, tempo de contato, temperatura (item 4.2.1) |
| 2 | b) Controle da potabilidade da água | Pontos de coleta, frequência, análises, metodologia, responsáveis (item 4.2.2) |
| 3 | c) Higiene e saúde dos manipuladores | Lavagem/anti-sepsia das mãos, exames, capacitação, registros nominais (item 4.2.3) |
| 4 | d) Manejo dos resíduos | Frequência, responsável, higienização dos coletores (item 4.2.4) |
| 5 | e) Manutenção preventiva e calibração de equipamentos | Periodicidade, responsáveis, calibração dos instrumentos de medição (item 4.2.5) |
| 6 | f) Controle integrado de vetores e pragas urbanas | Medidas preventivas/corretivas, comprovante de empresa especializada (item 4.2.6) |
| 7 | g) Seleção das matérias-primas, ingredientes e embalagens | Critérios de recebimento, quarentena, destino dos reprovados (item 4.2.7) |
| 8 | h) Programa de recolhimento de alimentos | Situações de adoção, procedimento de recall, segregação, destino (item 4.2.8) |

> **Atenção:** Cada POP deve ser aprovado, datado e assinado pelo responsável técnico e pelo responsável legal (item 4.1.2), com frequência e responsáveis especificados (item 4.1.3), e os registros mantidos por período superior à vida de prateleira do produto (item 5.2).

> ⚠️ "Controle de qualidade do produto final" NÃO é um dos 8 POPs da RDC 275 — é uma exigência geral de BPF. Os 8 POPs são exatamente as letras a) a h) do item 4.1.1.

**Referência:** RDC 275/2002, Anexo I, item 4.1.1 (e requisitos específicos no item 4.2).',
  1
),
(
  'Tabela Nutricional na prática — RDC 429/2020 + IN 75/2020',
  'TABELA_NUTRICIONAL', 'INICIANTE',
  E'# Tabela Nutricional na prática\n\n## Regras obrigatórias (RDC 429/2020)\n\n- Declarar: Valor Energético (kcal e kJ), Carboidratos, Açúcares Totais, Açúcares Adicionados, Gorduras Totais, Gorduras Saturadas, Gorduras Trans, Fibra Alimentar, Proteínas, Sódio.\n- Porção de referência: conforme IN 75/2020 (tabela por categoria de alimento).\n- %VD calculado com base na IDR da RDC 269/2005.\n- Formato obrigatório: tabela vertical, fundo branco, fonte preta.\n\n## Para suplementos (RDC 243/2018)\n\n- Declarar também os constituintes ativos com quantidade por porção.\n- Indicar a %IDR ou informar "Valor Diário não estabelecido" quando não há IDR definida.\n- Alegações funcionais: usar apenas as aprovadas no Anexo da IN 28/2018.\n\n> **Atenção:** Açúcares Adicionados e Açúcares Totais são campos novos desde 2022 — muitos rótulos antigos estão em não conformidade.\n\n**Referências:** RDC 429/2020, IN 75/2020, RDC 269/2005, RDC 243/2018.',
  2
),
(
  'BPF para suplemento: o que a RDC 275/2002 exige (e o que a RDC 658/2022 NÃO se aplica)',
  'BPF', 'INICIANTE',
  E'# BPF para Suplemento Alimentar\n\n## Norma aplicável: RDC 275/2002\n\nA RDC 275/2002 estabelece as **Boas Práticas de Fabricação para estabelecimentos produtores de alimentos**. É a norma-base para suplementos alimentares.\n\n## O que NÃO se aplica\n\n> ⚠️ **A RDC 658/2022 é BPF de MEDICAMENTOS.** Não se aplica a suplementos alimentares. Citar essa norma em auditorias ou documentos de suplemento é um erro técnico grave que pode gerar questionamentos da ANVISA.\n\n## Diferenças práticas\n\n| Aspecto | RDC 275/2002 (suplemento) | RDC 658/2022 (medicamento) |\n|---|---|---|\n| Validação de processos | Não obrigatória | Obrigatória |\n| Qualificação de equipamentos | Não obrigatória | Obrigatória (IQ/OQ/PQ) |\n| Sistema de qualidade | POPs + registros | QMS completo |\n| Área limpa | Não exigida | Exigida por classe |\n| Estudo de estabilidade | Recomendado | Obrigatório |\n\n**Referências:** RDC 275/2002, RDC 243/2018, RDC 658/2022 (apenas para comparação — NÃO aplicável).',
  3
),
(
  'Rotulagem e Alegações — o que pode e o que é proibido',
  'ROTULAGEM', 'INICIANTE',
  E'# Rotulagem e Alegações de Suplementos

## 3 avisos obrigatórios (RDC 243/2018, Art. 14)

Todo suplemento alimentar deve trazer **obrigatoriamente** no rótulo, em destaque e negrito, as três advertências:

1. **"Este produto não é um medicamento"**
2. **"Não exceder a recomendação diária de consumo indicada na embalagem"**
3. **"Mantenha fora do alcance de crianças"**

> ⚠️ São exatamente estas três frases, no texto literal da norma. Não confundir com avisos de outras categorias de alimento (a frase "não substitui uma alimentação variada" é de alimentos, não é aviso obrigatório de suplemento).

## Designação do produto (Art. 12 e 13)

- Designar como **"Suplemento Alimentar"** + a forma farmacêutica (ex.: "Suplemento Alimentar em cápsulas").
- A designação deve estar próxima à marca, em caixa alta, negrito, cor contrastante, e no mínimo 1/3 do tamanho da maior fonte da marca.

## Alegações funcionais permitidas (Art. 16)

- Apenas as constantes no **Anexo V da IN 28/2018**.
- Não são permitidas variações textuais das alegações autorizadas (salvo reunião em única frase).
- Proibido: alegações terapêuticas, de cura, ou não previstas na IN 28/2018 (Art. 17).

## Rotulagem nutricional (Art. 15)

- Seguir a RDC 429/2020 + IN 75/2020 (regra geral de alimentos).
- Porção = recomendação diária do fabricante por grupo populacional.
- %VDR declarado por grupo, com base na IDR da RDC 269/2005.

**Referências:** RDC 243/2018 (Art. 12-17), IN 28/2018 (Anexo V), RDC 429/2020, IN 75/2020.',
  4
),
(
  'Limites de dose — como ler os Anexos III e IV da IN 28/2018',
  'LIMITES_DOSE', 'INTERMEDIARIO',
  E'# Limites de Dose na IN 28/2018

## Estrutura dos Anexos da IN 28/2018

- **Anexo I:** Lista de constituintes autorizados (nutrientes, substâncias bioativas, enzimas) e suas fontes.
- **Anexo II:** Lista de enzimas e probióticos autorizados.
- **Anexo III:** Limites **MÍNIMOS** por dia, por grupo populacional.
- **Anexo IV:** Limites **MÁXIMOS** por dia, por grupo populacional (não podem ser ultrapassados).
- **Anexo V:** Alegações funcionais autorizadas (a frase exata permitida no rótulo).

> Regra dos limites (RDC 243/2018, Art. 9º): os limites mínimo e máximo devem ser atendidos **na recomendação diária de consumo**, para cada grupo populacional indicado pelo fabricante.

## Como ler uma linha dos Anexos III/IV

Cada linha traz: nome do constituinte, quantidade mínima (Anexo III) ou máxima (Anexo IV) por dia, unidade (mg, µg, UI, UFC), e o grupo populacional (ex.: adultos, gestantes, crianças por faixa etária).

## NE (Não Estabelecido)

Quando o limite aparece como **"NE"** (Art. 7º da IN 28), cabe ao fabricante definir a quantidade adequada, com justificativa técnica. NE não significa "sem limite" — significa que a norma não fixou um número e a responsabilidade é do fabricante/RT.

## Atenção às atualizações

A IN 28/2018 é **constantemente atualizada** por Instruções Normativas posteriores (ex.: IN 373/2025, IN 418/2025, IN 431/2026, IN 438/2026). Sempre consultar a versão consolidada no ANVISALegis, e usar o ANVISA Checker do BrainX (que já traz os limites por grupo).

> **Regra prática:** se o constituinte não está em nenhum Anexo da IN 28/2018 (nem em RE posterior), ele **não pode ser usado** em suplemento alimentar no Brasil.

**Referências:** IN 28/2018 (consolidada), RDC 243/2018 (Art. 4º, 7º, 9º).',
  5
),
(
  'Como se comportar numa fiscalização da ANVISA',
  'FISCALIZACAO', 'INTERMEDIARIO',
  E'# Checklist de Fiscalização ANVISA\n\n## Documentos que devem estar disponíveis imediatamente\n\n- [ ] Alvará sanitário vigente\n- [ ] Certificado de Responsabilidade Técnica (RT) atualizado\n- [ ] Manual de BPF (baseado na RDC 275/2002)\n- [ ] 8 POPs assinados e com registros de execução\n- [ ] Registros de higienização (últimos 3 meses)\n- [ ] Laudos de potabilidade da água (últimos 6 meses)\n- [ ] Registros de controle de pragas (contrato + laudos)\n- [ ] Fichas de treinamento dos manipuladores\n- [ ] Ordens de Produção com lote, validade e assinatura do RT\n- [ ] Amostras de retenção de cada lote produzido\n- [ ] Notificações ANVISA dos produtos (ou comprovante de isenção)\n\n## Postura durante a inspeção\n\n1. Receber o fiscal com cordialidade e solicitar a identificação.\n2. Acompanhar o fiscal em todos os momentos — nunca deixá-lo sozinho.\n3. Responder apenas o que foi perguntado — não oferecer informações extras.\n4. Se não souber, dizer "vou verificar" — nunca inventar.\n5. Solicitar cópia do Auto de Inspeção ao final.\n\n**Referências:** RDC 275/2002, RDC 243/2018, Lei 9.782/1999 (ANVISA).',
  6
)
ON CONFLICT DO NOTHING;
