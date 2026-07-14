-- Realinha o prefixo do sku_interno quando o tipo_item de um item muda.
-- Complementa generate_sku() (que só age no INSERT). Preserva YYMM e numero.
CREATE OR REPLACE FUNCTION public.realign_sku_on_type_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.tipo_item IS DISTINCT FROM OLD.tipo_item
     AND NEW.sku_interno IS NOT NULL
     AND NEW.sku_interno ~ '^[A-Z]+-[0-9]{4}-[0-9]{4}$'
     AND split_part(NEW.sku_interno, '-', 1) <> UPPER(LEFT(NEW.tipo_item, 2))
  THEN
    NEW.sku_interno := UPPER(LEFT(NEW.tipo_item, 2)) || '-' ||
                       split_part(NEW.sku_interno, '-', 2) || '-' ||
                       split_part(NEW.sku_interno, '-', 3);
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS realign_item_sku ON public.itens;
CREATE TRIGGER realign_item_sku
  BEFORE UPDATE OF tipo_item ON public.itens
  FOR EACH ROW EXECUTE FUNCTION public.realign_sku_on_type_change();
