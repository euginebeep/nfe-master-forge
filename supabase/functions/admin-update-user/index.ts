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
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    const { data: { user: callingUser }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !callingUser) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: isAdmin } = await supabaseClient.rpc('has_role', {
      _user_id: callingUser.id,
      _role: 'admin'
    })

    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Only admins can update users' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body = await req.json()
    const { user_id, nome_completo, cargo, departamento, role, avatar_url, status, permissions, new_password } = body

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'user_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    if (new_password) {
      await supabaseAdmin.auth.admin.updateUserById(user_id, { password: new_password })
    }

    const profileUpdate: Record<string, unknown> = {}
    if (nome_completo !== undefined) profileUpdate.nome_completo = nome_completo
    if (cargo !== undefined) profileUpdate.cargo = cargo
    if (departamento !== undefined) profileUpdate.departamento = departamento
    if (avatar_url !== undefined) profileUpdate.avatar_url = avatar_url
    if (status !== undefined) profileUpdate.status = status

    if (Object.keys(profileUpdate).length > 0) {
      await supabaseAdmin.from('profiles').update(profileUpdate).eq('id', user_id)
    }

    if (role) {
      await supabaseAdmin.from('user_roles').update({ role }).eq('user_id', user_id)
    }

    if (permissions && Array.isArray(permissions)) {
      await supabaseAdmin.from('user_permissions').delete().eq('user_id', user_id)
      for (const perm of permissions) {
        await supabaseAdmin.from('user_permissions').insert({
          user_id,
          modulo: perm.modulo,
          pode_visualizar: perm.pode_visualizar ?? false,
          pode_criar: perm.pode_criar ?? false,
          pode_editar: perm.pode_editar ?? false,
          pode_excluir: perm.pode_excluir ?? false
        })
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
