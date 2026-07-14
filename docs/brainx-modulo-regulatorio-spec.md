# BrainX ERP — Módulo Regulatório (núcleo Datalegis)

**Versão:** 1.0 — 13/07/2026
**Autor técnico:** especificação para implementação via Cursor
**Escopo:** transformar legislação sanitária de *constante hardcoded* em *dado versionado, auditável e monitorado*.

---

## 0. Princípio arquitetural (o "porquê")

Hoje o ANVISA Checker vive em `anvisa-limits.ts`: valores fixos no código. Isso tem três falhas fatais:

1. **Não é auditável.** Numa inspeção, você não consegue provar qual limite estava vigente **na data em que o laudo foi emitido**.
2. **Não é monitorável.** Se a Anvisa altera um anexo da IN 28/2018, ninguém descobre até alguém tropeçar.
3. **Não é multi-tenant.** Cada cliente white-label depende de você fazer deploy pra ficar em conformidade.

**Regra de ouro:** legislação é **dado**, não código. O código consulta; a norma vive no banco, com vigência temporal e rastro até a fonte.

**Regra de ouro nº 2:** a **IA propõe, o RT homologa.** Nenhuma regra extraída automaticamente entra em vigor sem aprovação assinada do Responsável Técnico. Isso é o que te protege juridicamente.

**Regra de ouro nº 3:** o **DOU é a fonte com fé pública**; o Datalegis é a *conveniência* (texto consolidado). Sempre persistir **os dois links**.

---

## 1. Modelo de dados (Supabase / Postgres)

> Estas tabelas são **globais**, não multi-tenant (legislação é dado público, compartilhado entre todos os tenants). Apenas `reg_watchlist`, `reg_alertas` e `reg_snapshots` têm `company_id`.

### 1.1 `reg_atos` — catálogo de atos normativos

```sql
create table reg_atos (
  id                uuid primary key default gen_random_uuid(),
  tipo              text not null,           -- RDC | IN | RE | PRT | LEI | CPB
  numero            integer not null,
  ano               integer not null,
  seq_ato           text not null default '000',   -- 000, 222... NÃO adivinhar: descobrir e persistir
  sgl_orgao         text not null,           -- ex: RDC/DC/ANVISA/MS
  ementa            text,
  data_publicacao_dou date,
  pagina_dou        text,

  status_vigencia   text not null,           -- vigente | vigente_com_alteracoes | revogado | revogado_parcialmente
  url_datalegis     text not null,           -- URL pública canônica (ver §2.2)
  url_dou           text,                    -- in.gov.br — fonte com fé pública

  texto_consolidado text,                    -- já transcodificado p/ UTF-8
  hash_texto        text not null,           -- sha256 do texto normalizado → detecta mudança
  relevante_para    text[],                  -- ['suplementos','bpf','rotulagem','embalagem']

  capturado_em      timestamptz not null default now(),
  verificado_em     timestamptz not null default now(),  -- último re-check bem-sucedido

  unique (tipo, numero, ano, sgl_orgao, seq_ato)
);
create index on reg_atos (status_vigencia);
create index on reg_atos using gin (relevante_para);
```

### 1.2 `reg_ato_alteracoes` — grafo de alterações

Extraído das "Notas de Alteração" e dos links internos `LinkTexto(...)` do Datalegis.

```sql
create table reg_ato_alteracoes (
  id                uuid primary key default gen_random_uuid(),
  ato_alterador_id  uuid not null references reg_atos(id),
  ato_alterado_id   uuid not null references reg_atos(id),
  dispositivo       text,                    -- 'Art. 32', 'Anexo I', 'Art. 30, §2º'
  tipo_alteracao    text not null,           -- altera | revoga | acrescenta | suprime
  detectado_em      timestamptz not null default now()
);
```

**Caso real de validação:** RDC 990/2025 → *altera* → RDC 843/2024, dispositivo "Art. 32". Se o parser não produzir essa aresta, está errado.

### 1.3 `reg_regras` — a camada que o ERP consome

É isto que substitui `anvisa-limits.ts`.

```sql
create table reg_regras (
  id                uuid primary key default gen_random_uuid(),
  chave             text not null,           -- 'nutriente.vitamina_d.limite_max.adulto'
  categoria         text not null,           -- nutriente | constituinte | enzima | probiotico | alegacao | rotulagem
  entidade          text not null,           -- 'Vitamina D', 'GABA', 'Zinco'
  populacao         text,                    -- adultos | gestantes | criancas_4_8 ...

  valor_min         numeric,
  valor_max         numeric,
  unidade           text,                    -- mg | mcg | mcg_DFE | UI
  fator_conversao   jsonb,                   -- {"UI_para_mcg": 0.025}
  payload           jsonb,                   -- campos livres por categoria (alegação, condições de uso)

  ato_id            uuid not null references reg_atos(id),
  dispositivo       text not null,           -- 'Anexo II, Tabela 3'

  vigencia_inicio   date not null,
  vigencia_fim      date,                    -- null = vigente
  substitui_regra_id uuid references reg_regras(id),

  status            text not null default 'proposta',  -- proposta | homologada | rejeitada | revogada
  proposta_por      text,                    -- 'claude-extractor-v1'
  homologada_por    text,                    -- 'Camila Paula da Fonseca — CRN-3 56584'
  homologada_em     timestamptz,
  observacao_rt     text
);

create index on reg_regras (chave, vigencia_inicio desc);
create index on reg_regras (status);
```

**Consulta padrão do ERP** (sempre temporal — nunca "o valor atual"):

```sql
-- limite vigente na data de emissão do laudo
select * from reg_regras
where chave = $1
  and status = 'homologada'
  and vigencia_inicio <= $2
  and (vigencia_fim is null or vigencia_fim > $2)
order by vigencia_inicio desc
limit 1;
```

### 1.4 `reg_snapshots` — imutabilidade para auditoria

Quando um laudo, OP ou rótulo é emitido, congela o conjunto de regras usadas.

```sql
create table reg_snapshots (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null,
  documento_tipo text not null,        -- laudo | op | rotulo | memorial_calculo
  documento_id  uuid not null,
  regras        jsonb not null,        -- [{regra_id, chave, valor_max, unidade, ato: 'IN 28/2018', dispositivo}]
  hash_snapshot text not null,
  criado_em     timestamptz not null default now()
);
```

O rodapé do PDF passa a imprimir: *"Limites conforme IN nº 28/2018 (texto consolidado, verificado em 13/07/2026). Snapshot: `a3f9…`"*. Isso vale ouro numa inspeção.

### 1.5 `reg_watchlist` e `reg_alertas` (por tenant)

```sql
create table reg_watchlist (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null,
  tipo        text not null,   -- termo | cnpj_fornecedor | insumo | ato_id
  valor       text not null,   -- 'suplemento alimentar', '12.345.678/0001-90', 'GABA'
  canal       text[] default '{whatsapp}',
  ativo       boolean default true
);

create table reg_alertas (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null,
  ato_id        uuid references reg_atos(id),
  origem        text not null,          -- dou | datalegis_diff | api_anvisa
  severidade    text not null,          -- critica | alta | media | informativa
  titulo        text not null,
  resumo_ia     text,                   -- classificação de impacto gerada pela IA
  impacto       jsonb,                  -- {regras_afetadas: [...], produtos_afetados: [...]}
  status        text default 'novo',    -- novo | lido | em_tratamento | tratado | ignorado
  tratado_por   text,
  tratado_em    timestamptz,
  criado_em     timestamptz default now()
);
```

---

## 2. Ingestão — os 3 jobs

### 2.1 Job A — Descoberta (diário, DOU)

Busca no DOU (in.gov.br, mesma API que alimenta o buscador oficial) filtrando por órgão = ANVISA. Cria **stubs** em `reg_atos` para atos novos. Referência de implementação: **Ro-DOU** (`github.com/gestaogovbr/Ro-dou`), ferramenta open-source do próprio governo federal que já resolveu a parte chata da query.

### 2.2 Job B — Diff de vigência (diário, Datalegis) ⭐ **o mais importante**

Para cada `ato_id` referenciado por alguma regra homologada:

1. Monta a URL canônica:
   ```
   https://anvisalegis.datalegis.net/action/UrlPublicasAction.php
     ?acao=abrirAtoPublico
     &num_ato={numero zero-pad 8}      → 00000843
     &sgl_tipo={tipo}                  → RDC
     &sgl_orgao={sgl_orgao}            → RDC/DC/ANVISA/MS
     &vlr_ano={ano}                    → 2024
     &seq_ato={seq_ato}                → 000
   ```
2. **Transcodifica ISO-8859-1 → UTF-8** (obrigatório; sem isso o hash é lixo e o texto vem com mojibake).
3. Normaliza (colapsa whitespace, remove menus/nav) e calcula `sha256`.
4. Compara com `hash_texto` e `status_vigencia` armazenados.
5. Se mudou → grava novo `reg_atos` + aresta em `reg_ato_alteracoes` + dispara **`reg_alertas` severidade `critica`**: *"IN 28/2018 — texto alterado. N regras homologadas dependem deste ato."*

Cache agressivo: lei não muda todo dia. Re-check diário só dos atos com regras dependentes; o resto, semanal.

### 2.3 Job C — Extração (sob demanda, com humano no loop)

Ato novo/alterado → Claude lê o texto consolidado → devolve JSON estruturado de regras → grava em `reg_regras` com `status = 'proposta'`.

Tela de homologação para o RT: diff lado a lado (regra vigente × regra proposta), com link pro dispositivo. RT aprova → `status = 'homologada'`, `homologada_por`, `homologada_em`. A regra antiga recebe `vigencia_fim`.

**Nunca auto-homologar.** A IA erra em tabela de anexo; o RT responde com o CRN dele.

---

## 3. Refactor do que já existe

| Arquivo | Antes | Depois |
|---|---|---|
| `anvisa-limits.ts` | Constantes hardcoded | Client tipado que lê `reg_regras` (cache em memória + snapshot embarcado como fallback offline) |
| `exportLaudoA4.ts` | Sem proveniência | Grava `reg_snapshots` e imprime ato + dispositivo + data de verificação no rodapé |
| Cadastro de produto | Sem `numero_notificacao_anvisa` | Campo obrigatório, validável contra a API de Consulta Alimentos |

---

## 4. Fases de implementação

- **Fase 0 (1–2 dias):** tabelas `reg_atos` + `reg_ato_alteracoes`. Scraper Datalegis (fetch + transcode + hash + parse de status). Popular manualmente os ~12 atos que o Vitalnow/ProLab realmente dependem (RDC 843/2024, RDC 990/2025, IN 28/2018, IN 281/2024, RDC 243/2018, RDC 275/2002, RDC 429/2020, IN 75/2020, IN 373/2025 e as demais INs recentes).
- **Fase 1 (2–3 dias):** `reg_regras` + migração do conteúdo de `anvisa-limits.ts` para o banco, cada valor amarrado ao seu ato e dispositivo. Checker passa a ler do banco.
- **Fase 2 (2 dias):** Job B (diff diário) + `reg_alertas` + notificação WhatsApp via Evolution API.
- **Fase 3:** Job A (DOU), watchlist multi-tenant, extração por IA com tela de homologação do RT.
- **Fase 4:** `reg_snapshots` no laudo e no memorial de cálculo.

---

## 5. Riscos e limites (honestos)

- **Scraping de portal legado.** O Datalegis pode mudar o HTML e quebrar o parser. Mitigação: o job deve *falhar ruidosamente* (alerta), nunca silenciosamente — um parser quebrado que retorna vazio é pior que erro.
- **Fé pública.** O Datalegis é texto consolidado por conveniência; a norma que vale é a publicada no DOU. Sempre guardar `url_dou`.
- **Rate limit.** Sem contrato de API — ser educado: cache, backoff, User-Agent identificável.
- **Extração por IA não é confiável sozinha.** Tabelas de anexo em PDF/HTML legado são o pior caso. Homologação humana não é burocracia: é o controle.

---

## 6. Gancho comercial imediato

Prazo verificado hoje (13/07/2026): **1º de setembro de 2026** para notificação de suplementos alimentares que já estavam no mercado — art. 32 da RDC 843/2024, com redação dada pela RDC 990/2025.

Faltam ~7 semanas. Um painel "produtos notificados × pendentes" com contagem regressiva, dentro do BrainX, é o argumento de venda mais forte que você tem para white-label agora.
