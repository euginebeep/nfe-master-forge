
-- Fix: new self-signup users should be admin (they are account owners)
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, nome_completo)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  
  -- Self-signup users are account owners → admin role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'admin');
  
  RETURN NEW;
END;
$function$;
