-- FASE 2: Adicionar campos para cálculo de cápsulas por dose
-- Campos novos na tabela formulas para armazenar o número de cápsulas por dose,
-- peso por cápsula e massa total de ativos da dose.

alter table public.formulas
  add column if not exists n_capsulas_por_dose integer,
  add column if not exists peso_por_capsula_mg numeric,
  add column if not exists massa_ativos_dose_mg numeric;

-- Comentários para documentação
comment on column public.formulas.n_capsulas_por_dose is 'Número de cápsulas por dose (calculado a partir da massa de ativos e densidade)';
comment on column public.formulas.peso_por_capsula_mg is 'Peso de cada cápsula em mg (capacidade recomendada máxima da cápsula)';
comment on column public.formulas.massa_ativos_dose_mg is 'Massa total de ativos na dose em mg (soma dos itens da fórmula)';
