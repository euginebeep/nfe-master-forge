import { createClient } from 'npm:@supabase/supabase-js@2'

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') || '';
  const allowed = (Deno.env.get('ALLOWED_ORIGINS') || '').split(',').map(s => s.trim()).filter(Boolean);
  const allowOrigin = allowed.length === 0 || allowed.includes(origin) ? origin || '*' : allowed[0];
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: { user: callingUser }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !callingUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Verify caller is admin
    const { data: isAdmin } = await supabaseClient.rpc('has_role', { _user_id: callingUser.id, _role: 'admin' })
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Apenas administradores podem excluir usuários' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, { auth: { autoRefreshToken: false, persistSession: false } })

    // Get admin's company_id for tenant isolation
    const { data: adminProfile } = await supabaseAdmin
      .from('profiles')
      .select('company_id')
      .eq('id', callingUser.id)
      .single()

    const adminCompanyId = adminProfile?.company_id

    const body = await req.json()
    const { user_id } = body

    if (!user_id) {
      return new Response(JSON.stringify({ error: 'user_id is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Cannot delete yourself
    if (user_id === callingUser.id) {
      return new Response(JSON.stringify({ error: 'Você não pode excluir sua própria conta' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Verify target user belongs to same company (tenant isolation)
    if (adminCompanyId) {
      const { data: targetProfile } = await supabaseAdmin
        .from('profiles')
        .select('company_id')
        .eq('id', user_id)
        .single()

      if (targetProfile?.company_id && targetProfile.company_id !== adminCompanyId) {
        return new Response(JSON.stringify({ error: 'Você não tem permissão para excluir este usuário' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }

    // Delete user from auth (cascades to profiles, roles, permissions)
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user_id)
    if (deleteError) {
      console.error('Error deleting user:', deleteError)
      return new Response(JSON.stringify({ error: 'Erro ao excluir usuário' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
