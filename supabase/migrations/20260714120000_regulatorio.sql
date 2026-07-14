-- =====================================================================
-- BrainX ERP — Módulo Regulatório (núcleo Datalegis)
-- PR1: catálogo de atos + grafo de alterações + regras + alertas
-- =====================================================================
-- Princípios:
--   1. Legislação é DADO, não código.
--   2. Atos e regras são GLOBAIS (dado público, compartilhado entre tenants).
--   3. Watchlist / alertas / snapshots são POR TENANT (company_id + RLS).
--   4. IA propõe, RT homologa. Nada entra em vigor sozinho.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. reg_atos — catálogo de atos normativos
-- ---------------------------------------------------------------------
create table if not exists public.reg_atos (
  id                  uuid primary key default gen_random_uuid(),

  tipo                text    not null check (tipo in ('RDC','IN','RE','PRT','LEI','DEC','CPB','RES')),
  numero              integer not null,
  ano                 integer not null check (ano between 1970 and 2100),
  seq_ato             text    not null default '000',
  sgl_orgao           text    not null,

  ementa              text,
  data_publicacao_dou date,
  pagina_dou          text,

  status_vigencia     text    not null default 'desconhecido'
                        check (status_vigencia in (
                          'vigente','vigente_com_alteracoes',
                          'revogado','revogado_parcialmente','desconhecido')),

  url_datalegis       text    not null,
  url_dou             text,                      -- fonte com fé pública

  texto_consolidado   text,                      -- já em UTF-8
  hash_texto          text,                      -- sha256 do texto normalizado
  relevante_para      text[]  not null default '{}',

  capturado_em        timestamptz not null default now(),
  verificado_em       timestamptz,               -- último re-check OK
  ultimo_erro         text,                      -- parser falhou? grita aqui
  ultimo_erro_em      timestamptz,

  monitorar           boolean not null default true,

  constraint reg_atos_unico unique (tipo, numero, ano, sgl_orgao, seq_ato)
);

create index if not exists reg_atos_status_idx    on public.reg_atos (status_vigencia);
create index if not exists reg_atos_monitorar_idx on public.reg_atos (monitorar) where monitorar;
create index if not exists reg_atos_relevante_idx on public.reg_atos using gin (relevante_para);

comment on column public.reg_atos.seq_ato is
  'Varia no Datalegis (000, 222...). NUNCA adivinhar: descobrir via resolver e persistir.';
comment on column public.reg_atos.hash_texto is
  'sha256 do texto normalizado. Mudou => norma foi alterada => alerta crítico.';


-- ---------------------------------------------------------------------
-- 2. reg_ato_alteracoes — grafo (quem alterou quem)
-- ---------------------------------------------------------------------
create table if not exists public.reg_ato_alteracoes (
  id                uuid primary key default gen_random_uuid(),
  ato_alterador_id  uuid references public.reg_atos(id) on delete set null,
  ato_alterado_id   uuid not null references public.reg_atos(id) on delete cascade,

  -- Se o ato alterador ainda não está no catálogo, guardamos a referência crua
  alterador_ref     text,        -- 'RDC 990/2025'
  dispositivo       text,        -- 'Art. 32', 'Anexo I'
  tipo_alteracao    text not null check (tipo_alteracao in
                      ('altera','revoga','acrescenta','suprime','renumera')),
  trecho_nota       text,        -- nota literal encontrada no texto consolidado

  detectado_em      timestamptz not null default now(),
  constraint reg_alt_unico unique (ato_alterado_id, alterador_ref, dispositivo, tipo_alteracao)
);

create index if not exists reg_alt_alterado_idx on public.reg_ato_alteracoes (ato_alterado_id);


-- ---------------------------------------------------------------------
-- 3. reg_regras — a camada que o ERP consome (substitui anvisa-limits.ts)
-- ---------------------------------------------------------------------
create table if not exists public.reg_regras (
  id                 uuid primary key default gen_random_uuid(),

  chave              text not null,   -- 'nutriente.vitamina_d.limite_max.adulto'
  categoria          text not null check (categoria in
                       ('nutriente','constituinte','enzima','probiotico',
                        'alegacao','rotulagem','processo')),
  entidade           text not null,   -- 'Vitamina D', 'GABA', 'Zinco'
  populacao          text,            -- 'adultos', 'gestantes', 'criancas_4_8'

  valor_min          numeric,
  valor_max          numeric,
  unidade            text,            -- mg | mcg | mcg_DFE | UI
  fator_conversao    jsonb,           -- {"UI_para_mcg": 0.025}
  payload            jsonb not null default '{}'::jsonb,

  ato_id             uuid not null references public.reg_atos(id),
  dispositivo        text not null,   -- 'Anexo II, Tabela 3'

  vigencia_inicio    date not null,
  vigencia_fim       date,            -- null = vigente
  substitui_regra_id uuid references public.reg_regras(id),

  status             text not null default 'proposta'
                       check (status in ('proposta','homologada','rejeitada','revogada')),
  proposta_por       text,            -- 'claude-extractor-v1'
  homologada_por     text,            -- 'Camila Paula da Fonseca — CRN-3 56584'
  homologada_em      timestamptz,
  observacao_rt      text,

  criado_em          timestamptz not null default now(),

  constraint reg_regras_vigencia_ok check (vigencia_fim is null or vigencia_fim > vigencia_inicio),
  -- homologada exige quem homologou: o gate jurídico, no schema
  constraint reg_regras_homolog_ok  check (
    status <> 'homologada' or (homologada_por is not null and homologada_em is not null)
  )
);

create index if not exists reg_regras_lookup_idx on public.reg_regras (chave, vigencia_inicio desc)
  where status = 'homologada';
create index if not exists reg_regras_status_idx on public.reg_regras (status);
create index if not exists reg_regras_ato_idx    on public.reg_regras (ato_id);

-- Consulta canônica: regra vigente EM UMA DATA (nunca "a atual")
create or replace function public.reg_regra_vigente(p_chave text, p_data date default current_date)
returns public.reg_regras
language sql stable as $$
  select r.* from public.reg_regras r
  where r.chave = p_chave
    and r.status = 'homologada'
    and r.vigencia_inicio <= p_data
    and (r.vigencia_fim is null or r.vigencia_fim > p_data)
  order by r.vigencia_inicio desc
  limit 1;
$$;


-- ---------------------------------------------------------------------
-- 4. reg_snapshots — imutabilidade para auditoria
-- ---------------------------------------------------------------------
create table if not exists public.reg_snapshots (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null,
  documento_tipo text not null check (documento_tipo in
                   ('laudo','op','rotulo','memorial_calculo','pop')),
  documento_id   uuid not null,
  regras         jsonb not null,
  hash_snapshot  text  not null,
  criado_em      timestamptz not null default now()
);
create index if not exists reg_snap_doc_idx on public.reg_snapshots (documento_tipo, documento_id);

-- snapshot é append-only: sem update, sem delete
create or replace function public.reg_snapshots_imutavel()
returns trigger language plpgsql as $$
begin
  raise exception 'reg_snapshots é append-only (auditoria BPF/ANVISA)';
end $$;

drop trigger if exists reg_snapshots_no_update on public.reg_snapshots;
create trigger reg_snapshots_no_update
  before update or delete on public.reg_snapshots
  for each row execute function public.reg_snapshots_imutavel();


-- ---------------------------------------------------------------------
-- 5. reg_watchlist / reg_alertas (por tenant)
-- ---------------------------------------------------------------------
create table if not exists public.reg_watchlist (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  tipo       text not null check (tipo in ('termo','cnpj_fornecedor','insumo','ato')),
  valor      text not null,
  canais     text[] not null default '{app}',   -- app | whatsapp | email
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now(),
  constraint reg_watch_unico unique (company_id, tipo, valor)
);

create table if not exists public.reg_alertas (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null,
  ato_id      uuid references public.reg_atos(id) on delete set null,
  origem      text not null check (origem in ('dou','datalegis_diff','api_anvisa','manual')),
  severidade  text not null check (severidade in ('critica','alta','media','informativa')),
  titulo      text not null,
  resumo_ia   text,
  impacto     jsonb not null default '{}'::jsonb,
  status      text not null default 'novo'
                check (status in ('novo','lido','em_tratamento','tratado','ignorado')),
  tratado_por text,
  tratado_em  timestamptz,
  criado_em   timestamptz not null default now()
);
create index if not exists reg_alertas_abertos_idx
  on public.reg_alertas (company_id, severidade, criado_em desc)
  where status in ('novo','lido','em_tratamento');


-- ---------------------------------------------------------------------
-- 6. RLS
-- ---------------------------------------------------------------------
-- Atos e regras: leitura global para autenticados; escrita só service_role.
alter table public.reg_atos           enable row level security;
alter table public.reg_ato_alteracoes enable row level security;
alter table public.reg_regras         enable row level security;

drop policy if exists reg_atos_read on public.reg_atos;
create policy reg_atos_read on public.reg_atos
  for select to authenticated using (true);

drop policy if exists reg_alt_read on public.reg_ato_alteracoes;
create policy reg_alt_read on public.reg_ato_alteracoes
  for select to authenticated using (true);

drop policy if exists reg_regras_read on public.reg_regras;
create policy reg_regras_read on public.reg_regras
  for select to authenticated using (true);

-- Homologação: apenas usuários com papel de RT/admin do tenant.
-- ATENÇÃO: ajustar o nome da função/tabela de papéis para a do BrainX.
drop policy if exists reg_regras_homologar on public.reg_regras;
create policy reg_regras_homologar on public.reg_regras
  for update to authenticated
  using (public.has_role(auth.uid(), 'rt') or public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'rt') or public.has_role(auth.uid(), 'admin'));

-- Por tenant
alter table public.reg_watchlist enable row level security;
alter table public.reg_alertas   enable row level security;
alter table public.reg_snapshots enable row level security;

drop policy if exists reg_watchlist_tenant on public.reg_watchlist;
create policy reg_watchlist_tenant on public.reg_watchlist
  for all to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

drop policy if exists reg_alertas_tenant on public.reg_alertas;
create policy reg_alertas_tenant on public.reg_alertas
  for all to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

drop policy if exists reg_snapshots_tenant on public.reg_snapshots;
create policy reg_snapshots_tenant on public.reg_snapshots
  for select to authenticated
  using (company_id = public.current_company_id());

drop policy if exists reg_snapshots_insert on public.reg_snapshots;
create policy reg_snapshots_insert on public.reg_snapshots
  for insert to authenticated
  with check (company_id = public.current_company_id());


-- ---------------------------------------------------------------------
-- 7. Seed — atos que Vitalnow / ProLab realmente dependem
-- ---------------------------------------------------------------------
-- IMPORTANTE: sgl_orgao e seq_ato de cada ato precisam ser RESOLVIDOS contra
-- o Datalegis (ver resolverAto() em _shared/datalegis.ts). Só a RDC 843/2024 foi
-- verificada manualmente (13/07/2026): sgl_orgao='RDC/DC/ANVISA/MS', seq_ato='000'.
-- Os demais entram como candidatos e o job de sync corrige/valida na primeira rodada.

insert into public.reg_atos (tipo, numero, ano, seq_ato, sgl_orgao, ementa, url_datalegis, relevante_para, monitorar)
values
  ('RDC', 843, 2024, '000', 'RDC/DC/ANVISA/MS',
   'Regularização de alimentos e embalagens no SNVS',
   'https://anvisalegis.datalegis.net/action/UrlPublicasAction.php?acao=abrirAtoPublico&num_ato=00000843&sgl_tipo=RDC&sgl_orgao=RDC%2FDC%2FANVISA%2FMS&vlr_ano=2024&seq_ato=000',
   '{suplementos,regularizacao,notificacao}', true),

  ('RDC', 990, 2025, '000', 'RDC/DC/ANVISA/MS',
   'Altera o art. 32 da RDC 843/2024 (prazo de notificação: 01/09/2026)',
   'https://anvisalegis.datalegis.net/action/UrlPublicasAction.php?acao=abrirAtoPublico&num_ato=00000990&sgl_tipo=RDC&sgl_orgao=RDC%2FDC%2FANVISA%2FMS&vlr_ano=2025&seq_ato=000',
   '{suplementos,notificacao,prazo}', true),

  ('RDC', 243, 2018, '000', 'RDC/DC/ANVISA/MS',
   'Requisitos sanitários dos suplementos alimentares',
   'https://anvisalegis.datalegis.net/action/UrlPublicasAction.php?acao=abrirAtoPublico&num_ato=00000243&sgl_tipo=RDC&sgl_orgao=RDC%2FDC%2FANVISA%2FMS&vlr_ano=2018&seq_ato=000',
   '{suplementos,composicao,rotulagem}', true),

  ('RDC', 275, 2002, '000', 'RDC/DC/ANVISA/MS',
   'POPs e Lista de Verificação de BPF em estabelecimentos produtores de alimentos',
   'https://anvisalegis.datalegis.net/action/UrlPublicasAction.php?acao=abrirAtoPublico&num_ato=00000275&sgl_tipo=RDC&sgl_orgao=RDC%2FDC%2FANVISA%2FMS&vlr_ano=2002&seq_ato=000',
   '{bpf,pops}', true),

  ('RDC', 429, 2020, '000', 'RDC/DC/ANVISA/MS',
   'Rotulagem nutricional dos alimentos embalados',
   'https://anvisalegis.datalegis.net/action/UrlPublicasAction.php?acao=abrirAtoPublico&num_ato=00000429&sgl_tipo=RDC&sgl_orgao=RDC%2FDC%2FANVISA%2FMS&vlr_ano=2020&seq_ato=000',
   '{rotulagem}', true),

  ('IN', 28, 2018, '000', 'IN/DC/ANVISA/MS',
   'Listas de constituintes, limites de uso e alegações de suplementos alimentares',
   'https://anvisalegis.datalegis.net/action/UrlPublicasAction.php?acao=abrirAtoPublico&num_ato=00000028&sgl_tipo=IN&sgl_orgao=IN%2FDC%2FANVISA%2FMS&vlr_ano=2018&seq_ato=000',
   '{suplementos,limites,alegacoes}', true),

  ('IN', 75, 2020, '000', 'IN/DC/ANVISA/MS',
   'Requisitos técnicos para declaração da rotulagem nutricional',
   'https://anvisalegis.datalegis.net/action/UrlPublicasAction.php?acao=abrirAtoPublico&num_ato=00000075&sgl_tipo=IN&sgl_orgao=IN%2FDC%2FANVISA%2FMS&vlr_ano=2020&seq_ato=000',
   '{rotulagem}', true),

  ('IN', 281, 2024, '000', 'IN/DC/ANVISA/MS',
   'Categorias de alimentos e embalagens por tipo de regularização',
   'https://anvisalegis.datalegis.net/action/UrlPublicasAction.php?acao=abrirAtoPublico&num_ato=00000281&sgl_tipo=IN&sgl_orgao=IN%2FDC%2FANVISA%2FMS&vlr_ano=2024&seq_ato=000',
   '{regularizacao,notificacao}', true),

  ('IN', 373, 2025, '000', 'IN/DC/ANVISA/MS',
   'Altera listas de constituintes/limites de suplementos (verificar)',
   'https://anvisalegis.datalegis.net/action/UrlPublicasAction.php?acao=abrirAtoPublico&num_ato=00000373&sgl_tipo=IN&sgl_orgao=IN%2FDC%2FANVISA%2FMS&vlr_ano=2025&seq_ato=000',
   '{suplementos,limites}', true)
on conflict on constraint reg_atos_unico do nothing;
