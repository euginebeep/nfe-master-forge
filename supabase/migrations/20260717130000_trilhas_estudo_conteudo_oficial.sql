-- ============================================================================
-- VERSIONAMENTO: trilhas_estudo com conteúdo corrigido contra fonte oficial
-- (sessão 17/07 — POPS, ROTULAGEM, LIMITES_DOSE). Já aplicado em produção.
-- Idempotente: UPDATE por categoria + INSERT se a trilha não existir.
-- ============================================================================

-- POPS
UPDATE public.trilhas_estudo SET
  titulo = 'Os 8 POPs obrigatórios para suplementos (RDC 275/2002)',
  nivel = 'INICIANTE',
  conteudo_md = $trilha$# Os 8 POPs obrigatórios — RDC 275/2002

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

**Referência:** RDC 275/2002, Anexo I, item 4.1.1 (e requisitos específicos no item 4.2).$trilha$,
  ordem = 1
WHERE categoria = 'POPS';

INSERT INTO public.trilhas_estudo (titulo, categoria, nivel, conteudo_md, ordem)
SELECT 'Os 8 POPs obrigatórios para suplementos (RDC 275/2002)', 'POPS', 'INICIANTE', $trilha$# Os 8 POPs obrigatórios — RDC 275/2002

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

**Referência:** RDC 275/2002, Anexo I, item 4.1.1 (e requisitos específicos no item 4.2).$trilha$, 1
WHERE NOT EXISTS (
  SELECT 1 FROM public.trilhas_estudo WHERE categoria = 'POPS'
);

-- TABELA_NUTRICIONAL
UPDATE public.trilhas_estudo SET
  titulo = 'Tabela Nutricional na prática — RDC 429/2020 + IN 75/2020',
  nivel = 'INICIANTE',
  conteudo_md = $trilha$# Tabela Nutricional na prática

## Regras obrigatórias (RDC 429/2020)

- Declarar: Valor Energético (kcal e kJ), Carboidratos, Açúcares Totais, Açúcares Adicionados, Gorduras Totais, Gorduras Saturadas, Gorduras Trans, Fibra Alimentar, Proteínas, Sódio.
- Porção de referência: conforme IN 75/2020 (tabela por categoria de alimento).
- %VD calculado com base na IDR da RDC 269/2005.
- Formato obrigatório: tabela vertical, fundo branco, fonte preta.

## Para suplementos (RDC 243/2018)

- Declarar também os constituintes ativos com quantidade por porção.
- Indicar a %IDR ou informar "Valor Diário não estabelecido" quando não há IDR definida.
- Alegações funcionais: usar apenas as aprovadas no Anexo da IN 28/2018.

> **Atenção:** Açúcares Adicionados e Açúcares Totais são campos novos desde 2022 — muitos rótulos antigos estão em não conformidade.

**Referências:** RDC 429/2020, IN 75/2020, RDC 269/2005, RDC 243/2018.$trilha$,
  ordem = 2
WHERE categoria = 'TABELA_NUTRICIONAL';

INSERT INTO public.trilhas_estudo (titulo, categoria, nivel, conteudo_md, ordem)
SELECT 'Tabela Nutricional na prática — RDC 429/2020 + IN 75/2020', 'TABELA_NUTRICIONAL', 'INICIANTE', $trilha$# Tabela Nutricional na prática

## Regras obrigatórias (RDC 429/2020)

- Declarar: Valor Energético (kcal e kJ), Carboidratos, Açúcares Totais, Açúcares Adicionados, Gorduras Totais, Gorduras Saturadas, Gorduras Trans, Fibra Alimentar, Proteínas, Sódio.
- Porção de referência: conforme IN 75/2020 (tabela por categoria de alimento).
- %VD calculado com base na IDR da RDC 269/2005.
- Formato obrigatório: tabela vertical, fundo branco, fonte preta.

## Para suplementos (RDC 243/2018)

- Declarar também os constituintes ativos com quantidade por porção.
- Indicar a %IDR ou informar "Valor Diário não estabelecido" quando não há IDR definida.
- Alegações funcionais: usar apenas as aprovadas no Anexo da IN 28/2018.

> **Atenção:** Açúcares Adicionados e Açúcares Totais são campos novos desde 2022 — muitos rótulos antigos estão em não conformidade.

**Referências:** RDC 429/2020, IN 75/2020, RDC 269/2005, RDC 243/2018.$trilha$, 2
WHERE NOT EXISTS (
  SELECT 1 FROM public.trilhas_estudo WHERE categoria = 'TABELA_NUTRICIONAL'
);

-- BPF
UPDATE public.trilhas_estudo SET
  titulo = 'BPF para suplemento: o que a RDC 275/2002 exige (e o que a RDC 658/2022 NÃO se aplica)',
  nivel = 'INICIANTE',
  conteudo_md = $trilha$# BPF para Suplemento Alimentar

## Norma aplicável: RDC 275/2002

A RDC 275/2002 estabelece as **Boas Práticas de Fabricação para estabelecimentos produtores de alimentos**. É a norma-base para suplementos alimentares.

## O que NÃO se aplica

> ⚠️ **A RDC 658/2022 é BPF de MEDICAMENTOS.** Não se aplica a suplementos alimentares. Citar essa norma em auditorias ou documentos de suplemento é um erro técnico grave que pode gerar questionamentos da ANVISA.

## Diferenças práticas

| Aspecto | RDC 275/2002 (suplemento) | RDC 658/2022 (medicamento) |
|---|---|---|
| Validação de processos | Não obrigatória | Obrigatória |
| Qualificação de equipamentos | Não obrigatória | Obrigatória (IQ/OQ/PQ) |
| Sistema de qualidade | POPs + registros | QMS completo |
| Área limpa | Não exigida | Exigida por classe |
| Estudo de estabilidade | Recomendado | Obrigatório |

**Referências:** RDC 275/2002, RDC 243/2018, RDC 658/2022 (apenas para comparação — NÃO aplicável).$trilha$,
  ordem = 3
WHERE categoria = 'BPF';

INSERT INTO public.trilhas_estudo (titulo, categoria, nivel, conteudo_md, ordem)
SELECT 'BPF para suplemento: o que a RDC 275/2002 exige (e o que a RDC 658/2022 NÃO se aplica)', 'BPF', 'INICIANTE', $trilha$# BPF para Suplemento Alimentar

## Norma aplicável: RDC 275/2002

A RDC 275/2002 estabelece as **Boas Práticas de Fabricação para estabelecimentos produtores de alimentos**. É a norma-base para suplementos alimentares.

## O que NÃO se aplica

> ⚠️ **A RDC 658/2022 é BPF de MEDICAMENTOS.** Não se aplica a suplementos alimentares. Citar essa norma em auditorias ou documentos de suplemento é um erro técnico grave que pode gerar questionamentos da ANVISA.

## Diferenças práticas

| Aspecto | RDC 275/2002 (suplemento) | RDC 658/2022 (medicamento) |
|---|---|---|
| Validação de processos | Não obrigatória | Obrigatória |
| Qualificação de equipamentos | Não obrigatória | Obrigatória (IQ/OQ/PQ) |
| Sistema de qualidade | POPs + registros | QMS completo |
| Área limpa | Não exigida | Exigida por classe |
| Estudo de estabilidade | Recomendado | Obrigatório |

**Referências:** RDC 275/2002, RDC 243/2018, RDC 658/2022 (apenas para comparação — NÃO aplicável).$trilha$, 3
WHERE NOT EXISTS (
  SELECT 1 FROM public.trilhas_estudo WHERE categoria = 'BPF'
);

-- ROTULAGEM
UPDATE public.trilhas_estudo SET
  titulo = 'Rotulagem e Alegações — o que pode e o que é proibido',
  nivel = 'INICIANTE',
  conteudo_md = $trilha$# Rotulagem e Alegações de Suplementos

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

**Referências:** RDC 243/2018 (Art. 12-17), IN 28/2018 (Anexo V), RDC 429/2020, IN 75/2020.$trilha$,
  ordem = 4
WHERE categoria = 'ROTULAGEM';

INSERT INTO public.trilhas_estudo (titulo, categoria, nivel, conteudo_md, ordem)
SELECT 'Rotulagem e Alegações — o que pode e o que é proibido', 'ROTULAGEM', 'INICIANTE', $trilha$# Rotulagem e Alegações de Suplementos

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

**Referências:** RDC 243/2018 (Art. 12-17), IN 28/2018 (Anexo V), RDC 429/2020, IN 75/2020.$trilha$, 4
WHERE NOT EXISTS (
  SELECT 1 FROM public.trilhas_estudo WHERE categoria = 'ROTULAGEM'
);

-- LIMITES_DOSE
UPDATE public.trilhas_estudo SET
  titulo = 'Limites de dose — como ler os Anexos III e IV da IN 28/2018',
  nivel = 'INTERMEDIARIO',
  conteudo_md = $trilha$# Limites de Dose na IN 28/2018

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

**Referências:** IN 28/2018 (consolidada), RDC 243/2018 (Art. 4º, 7º, 9º).$trilha$,
  ordem = 5
WHERE categoria = 'LIMITES_DOSE';

INSERT INTO public.trilhas_estudo (titulo, categoria, nivel, conteudo_md, ordem)
SELECT 'Limites de dose — como ler os Anexos III e IV da IN 28/2018', 'LIMITES_DOSE', 'INTERMEDIARIO', $trilha$# Limites de Dose na IN 28/2018

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

**Referências:** IN 28/2018 (consolidada), RDC 243/2018 (Art. 4º, 7º, 9º).$trilha$, 5
WHERE NOT EXISTS (
  SELECT 1 FROM public.trilhas_estudo WHERE categoria = 'LIMITES_DOSE'
);

-- FISCALIZACAO
UPDATE public.trilhas_estudo SET
  titulo = 'Como se comportar numa fiscalização da ANVISA',
  nivel = 'INTERMEDIARIO',
  conteudo_md = $trilha$# Checklist de Fiscalização ANVISA

## Documentos que devem estar disponíveis imediatamente

- [ ] Alvará sanitário vigente
- [ ] Certificado de Responsabilidade Técnica (RT) atualizado
- [ ] Manual de BPF (baseado na RDC 275/2002)
- [ ] 8 POPs assinados e com registros de execução
- [ ] Registros de higienização (últimos 3 meses)
- [ ] Laudos de potabilidade da água (últimos 6 meses)
- [ ] Registros de controle de pragas (contrato + laudos)
- [ ] Fichas de treinamento dos manipuladores
- [ ] Ordens de Produção com lote, validade e assinatura do RT
- [ ] Amostras de retenção de cada lote produzido
- [ ] Notificações ANVISA dos produtos (ou comprovante de isenção)

## Postura durante a inspeção

1. Receber o fiscal com cordialidade e solicitar a identificação.
2. Acompanhar o fiscal em todos os momentos — nunca deixá-lo sozinho.
3. Responder apenas o que foi perguntado — não oferecer informações extras.
4. Se não souber, dizer "vou verificar" — nunca inventar.
5. Solicitar cópia do Auto de Inspeção ao final.

**Referências:** RDC 275/2002, RDC 243/2018, Lei 9.782/1999 (ANVISA).$trilha$,
  ordem = 6
WHERE categoria = 'FISCALIZACAO';

INSERT INTO public.trilhas_estudo (titulo, categoria, nivel, conteudo_md, ordem)
SELECT 'Como se comportar numa fiscalização da ANVISA', 'FISCALIZACAO', 'INTERMEDIARIO', $trilha$# Checklist de Fiscalização ANVISA

## Documentos que devem estar disponíveis imediatamente

- [ ] Alvará sanitário vigente
- [ ] Certificado de Responsabilidade Técnica (RT) atualizado
- [ ] Manual de BPF (baseado na RDC 275/2002)
- [ ] 8 POPs assinados e com registros de execução
- [ ] Registros de higienização (últimos 3 meses)
- [ ] Laudos de potabilidade da água (últimos 6 meses)
- [ ] Registros de controle de pragas (contrato + laudos)
- [ ] Fichas de treinamento dos manipuladores
- [ ] Ordens de Produção com lote, validade e assinatura do RT
- [ ] Amostras de retenção de cada lote produzido
- [ ] Notificações ANVISA dos produtos (ou comprovante de isenção)

## Postura durante a inspeção

1. Receber o fiscal com cordialidade e solicitar a identificação.
2. Acompanhar o fiscal em todos os momentos — nunca deixá-lo sozinho.
3. Responder apenas o que foi perguntado — não oferecer informações extras.
4. Se não souber, dizer "vou verificar" — nunca inventar.
5. Solicitar cópia do Auto de Inspeção ao final.

**Referências:** RDC 275/2002, RDC 243/2018, Lei 9.782/1999 (ANVISA).$trilha$, 6
WHERE NOT EXISTS (
  SELECT 1 FROM public.trilhas_estudo WHERE categoria = 'FISCALIZACAO'
);

COMMENT ON TABLE public.trilhas_estudo IS
  'Trilhas de capacitação regulatória — texto estático revisado contra fonte oficial (não gerar por IA livre).';

