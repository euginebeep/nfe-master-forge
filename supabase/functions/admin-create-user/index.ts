import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
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
        JSON.stringify({ error: 'Only admins can create users' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body = await req.json()
    const { email, password, nome_completo, cargo, departamento, role, avatar_url, permissions } = body

    if (!email || !password || !nome_completo) {
      return new Response(
        JSON.stringify({ error: 'Email, password, and nome_completo are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: nome_completo }
    })

    if (createError) {
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    await supabaseAdmin.from('profiles').update({
      nome_completo, cargo, departamento, avatar_url, status: 'ATIVO'
    }).eq('id', newUser.user.id)

    if (role && role !== 'visualizador') {
      await supabaseAdmin.from('user_roles').update({ role }).eq('user_id', newUser.user.id)
    }

    if (permissions && Array.isArray(permissions)) {
      for (const perm of permissions) {
        await supabaseAdmin.from('user_permissions').upsert({
          user_id: newUser.user.id,
          modulo: perm.modulo,
          pode_visualizar: perm.pode_visualizar ?? false,
          pode_criar: perm.pode_criar ?? false,
          pode_editar: perm.pode_editar ?? false,
          pode_excluir: perm.pode_excluir ?? false
        }, { onConflict: 'user_id,modulo' })
      }
    }

    return new Response(
      JSON.stringify({ success: true, user: { id: newUser.user.id, email: newUser.user.email, nome_completo } }),
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
