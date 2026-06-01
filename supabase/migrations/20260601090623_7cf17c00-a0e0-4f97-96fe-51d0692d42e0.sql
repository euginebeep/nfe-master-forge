-- Fix audit logging: grant execute on RPC + select on table to authenticated users
GRANT EXECUTE ON FUNCTION public.registrar_evento_auditoria(
  tipo_evento_auditoria, text, text, uuid, text, uuid, text, text, text, jsonb, jsonb, jsonb
) TO authenticated;

GRANT SELECT, INSERT ON public.audit_trail_imutavel TO authenticated;
GRANT ALL ON public.audit_trail_imutavel TO service_role;

-- Add navigation/page-view event type for full activity tracking
ALTER TYPE tipo_evento_auditoria ADD VALUE IF NOT EXISTS 'NAVEGACAO';
ALTER TYPE tipo_evento_auditoria ADD VALUE IF NOT EXISTS 'ACAO_UI';