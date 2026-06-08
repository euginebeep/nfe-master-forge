-- 1. CORRIGIR GATILHOS PARA MULTI-TENANT

-- Trigger: auto-notify when a new anomalia is created (Apenas para a mesma empresa)
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
    -- Notificar apenas usuários da mesma empresa
    FOR u IN SELECT p.id FROM profiles p WHERE p.company_id = NEW.company_id LOOP
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

-- Trigger: notify when alerta executivo is created (Apenas para a mesma empresa)
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
  
  -- Notificar apenas usuários da mesma empresa
  FOR u IN SELECT p.id FROM profiles p WHERE p.company_id = NEW.company_id LOOP
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

-- Function to create notifications for expiring lots (Apenas para a mesma empresa)
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
    SELECT el.id, el.numero_lote, el.data_val, el.company_id, i.descricao_interna
    FROM estoque_lotes el
    JOIN itens i ON i.id = el.item_id
    WHERE el.status = 'APROVADO'
      AND el.data_val IS NOT NULL
      AND el.data_val <= CURRENT_DATE + INTERVAL '30 days'
      AND el.data_val > CURRENT_DATE
      AND el.quantidade_interna > 0
  LOOP
    -- Notificar apenas usuários da mesma empresa do lote
    FOR u IN SELECT p.id FROM profiles p WHERE p.company_id = r.company_id LOOP
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

-- Function to create notifications for low stock (Apenas para a mesma empresa)
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
    SELECT i.id, i.descricao_interna, i.sku_interno, i.company_id,
           COALESCE(SUM(el.quantidade_interna), 0) as estoque_total
    FROM itens i
    LEFT JOIN estoque_lotes el ON el.item_id = i.id AND el.status = 'APROVADO'
    WHERE i.ativo = true AND i.tipo_item = 'MP'
    GROUP BY i.id, i.descricao_interna, i.sku_interno, i.company_id
    HAVING COALESCE(SUM(el.quantidade_interna), 0) <= 0
  LOOP
    -- Notificar apenas usuários da mesma empresa do item
    FOR u IN SELECT p.id FROM profiles p WHERE p.company_id = r.company_id LOOP
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

-- 2. LIMPEZA DE DADOS VAZADOS
-- Remover notificações de usuários reais que foram geradas indevidamente por processos demo ou cross-tenant
DELETE FROM public.notifications 
WHERE user_id IN (
  SELECT id FROM public.profiles 
  WHERE company_id != '00000000-0000-0000-0000-000000000001'
) 
AND (
  title LIKE 'Anomalia%' OR 
  title LIKE 'Insumo Crítico%' OR 
  title LIKE 'Lote Vencendo%' OR
  message LIKE 'Perda de 5% acima do padrão na mistura%' OR
  message LIKE 'Estoque abaixo do ponto de reposição%'
);
