import { supabase } from "@/integrations/supabase/client";

type AuditEventType = 
  | 'ENTIDADE_CRIADA' | 'ENTIDADE_ALTERADA' | 'ENTIDADE_EXCLUIDA'
  | 'ITEM_CRIADO' | 'ITEM_ALTERADO' | 'ITEM_EXCLUIDO'
  | 'LOTE_CRIADO' | 'LOTE_ALTERADO' | 'LOTE_LIBERADO' | 'LOTE_BLOQUEADO'
  | 'ESTOQUE_MOVIMENTADO'
  | 'NFE_IMPORTADA'
  | 'FORMULA_CRIADA' | 'FORMULA_APROVADA' | 'FORMULA_ALTERADA'
  | 'OP_CRIADA' | 'OP_INICIADA' | 'OP_ALTERADA' | 'OP_FINALIZADA' | 'OP_BLOQUEADA'
  | 'RT_ASSINATURA'
  | 'QC_APROVADO' | 'QC_REPROVADO'
  | 'PESAGEM_REGISTRADA' | 'CHECKLIST_VERIFICADO'
  | 'ORCAMENTO_CRIADO' | 'ORCAMENTO_ALTERADO'
  | 'PEDIDO_CRIADO' | 'PEDIDO_ALTERADO'
  | 'USUARIO_CRIADO' | 'USUARIO_ALTERADO' | 'USUARIO_EXCLUIDO'
  | 'LOGIN_REALIZADO' | 'LOGOUT_REALIZADO'
  | 'CONTA_PAGAR_CRIADA' | 'CONTA_RECEBER_CRIADA'
  | 'EXPORTACAO_DADOS'
  | 'SMTP_CONFIGURADO' | 'SMTP_TESTE_ENVIADO';

interface AuditParams {
  tipo: AuditEventType;
  descricao: string;
  entidade_tipo: string;
  entidade_id: string;
  entidade_codigo?: string;
  dados_evento?: Record<string, unknown>;
  dados_anteriores?: Record<string, unknown>;
  dados_novos?: Record<string, unknown>;
}

/**
 * Registra um evento na trilha de auditoria imutável.
 * Fire-and-forget — não bloqueia o fluxo principal.
 */
export async function registrarAuditoria(params: AuditParams) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get user profile name
    const { data: profile } = await supabase
      .from('profiles')
      .select('nome_completo')
      .eq('id', user.id)
      .maybeSingle();

    await supabase.rpc('registrar_evento_auditoria', {
      p_tipo_evento: params.tipo as any,
      p_descricao: params.descricao,
      p_entidade_tipo: params.entidade_tipo,
      p_entidade_id: params.entidade_id,
      p_entidade_codigo: params.entidade_codigo || null,
      p_usuario_id: user.id,
      p_usuario_nome: profile?.nome_completo || user.email || 'Sistema',
      p_dados_evento: (params.dados_evento || {}) as any,
      p_dados_anteriores: (params.dados_anteriores || null) as any,
      p_dados_novos: (params.dados_novos || null) as any,
    });
  } catch (err) {
    // Silent fail — audit should never break the main flow
    console.warn('[Auditoria] Erro ao registrar evento:', err);
  }
}
