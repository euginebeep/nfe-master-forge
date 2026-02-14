
-- Function to create notifications for expiring lots (within 30 days)
CREATE OR REPLACE FUNCTION public.notify_expiring_lots()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r RECORD;
  u RECORD;
BEGIN
  FOR r IN
    SELECT el.id, el.numero_lote, el.data_val, i.descricao_interna
    FROM estoque_lotes el
    JOIN itens i ON i.id = el.item_id
    WHERE el.status = 'APROVADO'
      AND el.data_val IS NOT NULL
      AND el.data_val <= CURRENT_DATE + INTERVAL '30 days'
      AND el.data_val > CURRENT_DATE
      AND el.quantidade_interna > 0
  LOOP
    FOR u IN SELECT p.id FROM profiles p LOOP
      INSERT INTO notifications (user_id, title, message, type, module, link)
      VALUES (
        u.id,
        'Lote próximo ao vencimento',
        'O lote ' || r.numero_lote || ' de ' || r.descricao_interna || ' vence em ' || to_char(r.data_val, 'DD/MM/YYYY'),
        'warning',
        'Estoque',
        '/estoque/lotes/' || r.id
      )
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END;
$$;

-- Function to create notifications for low stock
CREATE OR REPLACE FUNCTION public.notify_low_stock()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r RECORD;
  u RECORD;
BEGIN
  FOR r IN
    SELECT i.id, i.descricao_interna, i.sku_interno,
           COALESCE(SUM(el.quantidade_interna), 0) as estoque_total
    FROM itens i
    LEFT JOIN estoque_lotes el ON el.item_id = i.id AND el.status = 'APROVADO'
    WHERE i.ativo = true AND i.tipo_item = 'MP'
    GROUP BY i.id, i.descricao_interna, i.sku_interno
    HAVING COALESCE(SUM(el.quantidade_interna), 0) <= 0
  LOOP
    FOR u IN SELECT p.id FROM profiles p LOOP
      INSERT INTO notifications (user_id, title, message, type, module, link)
      VALUES (
        u.id,
        'Estoque zerado: ' || COALESCE(r.sku_interno, 'S/C'),
        r.descricao_interna || ' está sem estoque disponível.',
        'error',
        'Estoque',
        '/cadastros/itens/' || r.id
      )
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END;
$$;

-- Trigger: auto-notify when a new anomalia is created
CREATE OR REPLACE FUNCTION public.trigger_notify_anomalia()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  u RECORD;
BEGIN
  IF NEW.severidade IN ('CRITICA', 'ALTA') THEN
    FOR u IN SELECT p.id FROM profiles p LOOP
      INSERT INTO notifications (user_id, title, message, type, module)
      VALUES (
        u.id,
        'Anomalia ' || NEW.severidade || ' detectada',
        NEW.descricao,
        'error',
        'Produção'
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_anomalia_insert
AFTER INSERT ON anomalias_operacionais
FOR EACH ROW EXECUTE FUNCTION trigger_notify_anomalia();

-- Trigger: notify when alerta executivo is created
CREATE OR REPLACE FUNCTION public.trigger_notify_alerta_executivo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  u RECORD;
  n_type TEXT;
BEGIN
  n_type := CASE 
    WHEN NEW.nivel = 'CRITICO' THEN 'error'
    WHEN NEW.nivel = 'ALTO' THEN 'warning'
    ELSE 'info'
  END;
  
  FOR u IN SELECT p.id FROM profiles p LOOP
    INSERT INTO notifications (user_id, title, message, type, module)
    VALUES (
      u.id,
      NEW.titulo,
      NEW.descricao,
      n_type,
      'Executivo'
    );
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_alerta_executivo_insert
AFTER INSERT ON alertas_executivos
FOR EACH ROW EXECUTE FUNCTION trigger_notify_alerta_executivo();
