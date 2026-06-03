ALTER TABLE public.lotes_produto_acabado
  ALTER COLUMN rt_nome DROP NOT NULL,
  ALTER COLUMN rt_tipo_conselho DROP NOT NULL,
  ALTER COLUMN rt_numero_registro DROP NOT NULL,
  ALTER COLUMN rt_uf_conselho DROP NOT NULL,
  ALTER COLUMN qr_code_hash DROP NOT NULL;