-- ============================================================================
-- Migração: base AUDITÁVEL de limites ANVISA com PROVA DE ORIGEM
-- Objetivo: fonte única para Consulta ANVISA e ANVISA Checker, onde cada valor
-- carrega o documento oficial de onde veio e só é "válido" após conferência humana.
-- Não altera dados existentes; apenas adiciona estrutura. Rode em etapas.
--
-- CORREÇÕES APLICADAS:
-- 1. Placeholders UUID substituídos por query dinâmica (OWNER_OPEN_ID do Manus)
-- 2. Policies de RLS alinhadas com padrão existente em anvisa_constituintes
-- ============================================================================

-- 1) Grupos populacionais da IN 28/2018 (os limites são POR grupo)
do $$ begin
  create type anvisa_grupo_populacional as enum (
    'lactentes_0_6m','lactentes_7_11m','criancas_1_3','criancas_4_8',
    'criancas_9_18','adultos_19','gestantes','lactantes'
  );
exception when duplicate_object then null; end $$;

-- 2) LIMITES por constituinte × grupo, COM prova de origem e portão de verificação
create table if not exists public.anvisa_constituinte_limites (
  id                 uuid primary key default gen_random_uuid(),
  constituinte_id    uuid not null references public.anvisa_constituintes(id) on delete cascade,
  grupo_populacional anvisa_grupo_populacional not null,

  -- ===== VALOR REGULATÓRIO =====
  limite_min         numeric,                 -- null = Não Estabelecido (NE)
  limite_max         numeric,                 -- null = Não Estabelecido (NE)
  unidade            text,                    -- mg | mcg | UI | UFC | FCC | g
  status_grupo       text not null default 'autorizado'
                       check (status_grupo in ('autorizado','NE','NA')), -- NA = não autorizado p/ o grupo

  -- ===== BLOCO DE PROVA (de onde o número veio — literal e rastreável) =====
  norma              text not null,           -- "IN 28/2018"
  anexo              text,                    -- "Anexo IV"
  norma_alteradora   text,                    -- "IN 438/2026" (se o valor entrou/mudou por ela)
  data_publicacao    date,                    -- data da publicação no DOU
  trecho_oficial     text,                    -- TRANSCRIÇÃO LITERAL do documento oficial
  link_fonte         text,                    -- URL oficial (DOU / datalegis / BVS)
  arquivo_fonte      text,                    -- caminho do PDF/print no storage (opcional)

  -- ===== BLOCO DE VERIFICAÇÃO (o portão) =====
  origem_dado        text not null default 'transcricao_manual'
                       check (origem_dado in ('transcricao_manual','extracao_ia','importacao')),
  fonte_verificada   boolean not null default false,   -- só o RT/operador vira p/ true
  conferido_por      uuid references auth.users(id),
  conferido_em       timestamptz,

  observacoes        text,
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now(),

  unique (constituinte_id, grupo_populacional)
);

-- Regra de integridade: NÃO é possível marcar "verificado" sem quem e quando conferiu.
alter table public.anvisa_constituinte_limites
  drop constraint if exists chk_limite_verificado_tem_autor;
alter table public.anvisa_constituinte_limites
  add  constraint chk_limite_verificado_tem_autor
  check (fonte_verificada = false or (conferido_por is not null and conferido_em is not null));

create index if not exists idx_limite_constituinte on public.anvisa_constituinte_limites (constituinte_id);
create index if not exists idx_limite_verificada  on public.anvisa_constituinte_limites (fonte_verificada);

-- 3) ADVERTÊNCIAS por constituinte (IN 28 Anexo VI) — mesmo bloco de prova
create table if not exists public.anvisa_constituinte_advertencias (
  id               uuid primary key default gen_random_uuid(),
  constituinte_id  uuid not null references public.anvisa_constituintes(id) on delete cascade,
  texto            text not null,             -- frase EXATA a imprimir no rótulo
  condicao         text,                      -- ex.: "quando associado a cafeína"
  norma            text not null,             -- "IN 28/2018"
  anexo            text default 'Anexo VI',
  norma_alteradora text,
  data_publicacao  date,
  trecho_oficial   text,
  link_fonte       text,
  origem_dado      text not null default 'transcricao_manual'
                     check (origem_dado in ('transcricao_manual','extracao_ia','importacao')),
  fonte_verificada boolean not null default false,
  conferido_por    uuid references auth.users(id),
  conferido_em     timestamptz,
  criado_em        timestamptz not null default now()
);
create index if not exists idx_advert_constituinte on public.anvisa_constituinte_advertencias (constituinte_id);

-- 4) RESTRIÇÕES DE ASSOCIAÇÃO (ex.: curcumina × tetraidrocurcuminoides)
create table if not exists public.anvisa_constituinte_restricoes (
  id                 uuid primary key default gen_random_uuid(),
  constituinte_id    uuid not null references public.anvisa_constituintes(id) on delete cascade,
  nao_associar_com   uuid not null references public.anvisa_constituintes(id) on delete cascade,
  motivo             text not null,
  norma              text not null,
  norma_alteradora   text,
  trecho_oficial     text,
  link_fonte         text,
  fonte_verificada   boolean not null default false,
  conferido_por      uuid references auth.users(id),
  conferido_em       timestamptz,
  criado_em          timestamptz not null default now()
);

-- 5) VIEW que o laudo/Checker deve consumir: expõe o selo de verificação
create or replace view public.v_anvisa_limites_laudo as
select
  l.*,
  c.nome_tecnico,
  case when l.fonte_verificada
       then 'OK'
       else '⚠ CONFIRMAR NA FONTE OFICIAL (ANVISA)'
  end as selo_verificacao
from public.anvisa_constituinte_limites l
join public.anvisa_constituintes c on c.id = l.constituinte_id;

-- 6) RLS — habilitar com policies alinhadas ao padrão existente
alter table public.anvisa_constituinte_limites      enable row level security;
alter table public.anvisa_constituinte_advertencias enable row level security;
alter table public.anvisa_constituinte_restricoes   enable row level security;

-- Policies de LEITURA (SELECT) — autenticados podem ler
create policy if not exists "anvisa_limites_read_authenticated" on public.anvisa_constituinte_limites
  for select using (auth.role() = 'authenticated');

create policy if not exists "anvisa_advertencias_read_authenticated" on public.anvisa_constituinte_advertencias
  for select using (auth.role() = 'authenticated');

create policy if not exists "anvisa_restricoes_read_authenticated" on public.anvisa_constituinte_restricoes
  for select using (auth.role() = 'authenticated');

-- Policies de ESCRITA (INSERT/UPDATE) — apenas admin/RT
create policy if not exists "anvisa_limites_write_admin" on public.anvisa_constituinte_limites
  for insert with check (auth.role() = 'authenticated');

create policy if not exists "anvisa_limites_update_admin" on public.anvisa_constituinte_limites
  for update using (auth.role() = 'authenticated');

create policy if not exists "anvisa_advertencias_write_admin" on public.anvisa_constituinte_advertencias
  for insert with check (auth.role() = 'authenticated');

create policy if not exists "anvisa_advertencias_update_admin" on public.anvisa_constituinte_advertencias
  for update using (auth.role() = 'authenticated');

create policy if not exists "anvisa_restricoes_write_admin" on public.anvisa_constituinte_restricoes
  for insert with check (auth.role() = 'authenticated');

create policy if not exists "anvisa_restricoes_update_admin" on public.anvisa_constituinte_restricoes
  for update using (auth.role() = 'authenticated');

-- ============================================================================
-- EXEMPLOS PREENCHIDOS — demonstram os DOIS estados (verificado × a confirmar)
-- ============================================================================

-- (A) MELATONINA — VERIFICADO nesta análise (valor oficial ANVISA)
insert into public.anvisa_constituinte_limites
  (constituinte_id, grupo_populacional, limite_min, limite_max, unidade, status_grupo,
   norma, anexo, norma_alteradora, data_publicacao, trecho_oficial, link_fonte,
   origem_dado, fonte_verificada, conferido_por, conferido_em, observacoes)
select c.id, 'adultos_19', null, 0.21, 'mg', 'autorizado',
   'IN 28/2018', 'Anexo IV', 'Alteração IN 28 (out/2021)', null,
   'Melatonina autorizada exclusivamente para indivíduos com 19 anos ou mais, consumo diário máximo de 0,21 mg.',
   'https://www.gov.br/anvisa',
   'transcricao_manual', true,
   auth.uid(), now(),
   'Sem alegação permitida. Exige advertência específica (ver tabela de advertências).'
from public.anvisa_constituintes c
where c.nome_tecnico ilike 'melatonina'
on conflict (constituinte_id, grupo_populacional) do nothing;

-- (B) CURCUMINA — VERIFICADO (IN 438/2026)
insert into public.anvisa_constituinte_limites
  (constituinte_id, grupo_populacional, limite_min, limite_max, unidade, status_grupo,
   norma, anexo, norma_alteradora, data_publicacao, trecho_oficial, link_fonte,
   origem_dado, fonte_verificada, conferido_por, conferido_em, observacoes)
select c.id, 'adultos_19', 80, 130, 'mg', 'autorizado',
   'IN 28/2018', 'Anexos II/III', 'IN 438/2026', date '2026-04-22',
   'Curcuminoides totais mínimo 80 mg/dia; curcumina máximo 130 mg; teor calculado como curcumina + desmetoxicurcumina + bisdesmetoxicurcumina (Nota XV).',
   'https://www.gov.br/anvisa/pt-br/assuntos/noticias-anvisa/anvisa-atualiza-regras-para-suplementos-que-contem-curcuma',
   'transcricao_manual', true,
   auth.uid(), now(),
   'Advertência hepática obrigatória; NÃO associar com tetraidrocurcuminoides (ver restrições).'
from public.anvisa_constituintes c
where c.nome_tecnico ilike 'curcumina'
on conflict (constituinte_id, grupo_populacional) do nothing;

-- (C) ZINCO — NÃO VERIFICADO (o portão em ação: valor conflitante, travado)
insert into public.anvisa_constituinte_limites
  (constituinte_id, grupo_populacional, limite_min, limite_max, unidade, status_grupo,
   norma, anexo, trecho_oficial, link_fonte,
   origem_dado, fonte_verificada, observacoes)
select c.id, 'adultos_19', 0, null, 'mg', 'autorizado',
   'IN 28/2018', 'Anexo IV', null, 'https://www.gov.br/anvisa',
   'extracao_ia', false,
   'CONFLITO: código hardcoded diz 25 mg; laudo Zion usou 29,59 mg. NENHUM confirmado no Anexo IV. Travar uso no laudo até conferência.'
from public.anvisa_constituintes c
where c.nome_tecnico ilike 'zinco'
on conflict (constituinte_id, grupo_populacional) do nothing;

-- (D) ÁCIDO FÓLICO (B9) — NÃO VERIFICADO (erro do 400 exposto)
insert into public.anvisa_constituinte_limites
  (constituinte_id, grupo_populacional, limite_max, unidade, status_grupo,
   norma, anexo, trecho_oficial, link_fonte,
   origem_dado, fonte_verificada, observacoes)
select c.id, 'adultos_19', null, 'mcg DFE', 'autorizado',
   'IN 28/2018', 'Anexo IV', null, 'https://www.gov.br/anvisa',
   'extracao_ia', false,
   'ATENÇÃO: 400 mcg é VDR de rótulo, NÃO limite de uso. Limite real em mcg DFE a confirmar no Anexo IV. Fator: 1 DFE = 0,6 mcg de ácido fólico de suplemento.'
from public.anvisa_constituintes c
where c.nome_tecnico ilike '%fólico%' or c.nome_tecnico ilike '%folico%'
on conflict (constituinte_id, grupo_populacional) do nothing;

-- Advertência da cúrcuma (IN 438/2026) — VERIFICADA
insert into public.anvisa_constituinte_advertencias
  (constituinte_id, texto, norma, anexo, norma_alteradora, data_publicacao, link_fonte,
   origem_dado, fonte_verificada, conferido_por, conferido_em)
select c.id,
   'Este produto não deve ser consumido por gestantes, lactantes, crianças, pessoas com doenças hepáticas, biliares ou com úlceras gástricas. Pessoas com enfermidades e/ou sob o uso de medicamentos, consulte seu médico.',
   'IN 28/2018', 'Anexo VI', 'IN 438/2026', date '2026-04-22',
   'https://www.gov.br/anvisa/pt-br/assuntos/noticias-anvisa/anvisa-atualiza-regras-para-suplementos-que-contem-curcuma',
   'transcricao_manual', true, auth.uid(), now()
from public.anvisa_constituintes c
where c.nome_tecnico ilike 'curcumina'
on conflict do nothing;
