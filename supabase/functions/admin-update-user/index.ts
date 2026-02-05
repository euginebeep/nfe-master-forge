import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Update password if provided
    if (new_password) {
      const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
        password: new_password
      })
      if (passwordError) {
        console.error('Password update error:', passwordError)
      }
    }

    // Update profile
    const profileUpdate: Record<string, unknown> = {}
    if (nome_completo !== undefined) profileUpdate.nome_completo = nome_completo
    if (cargo !== undefined) profileUpdate.cargo = cargo
    if (departamento !== undefined) profileUpdate.departamento = departamento
    if (avatar_url !== undefined) profileUpdate.avatar_url = avatar_url
    if (status !== undefined) profileUpdate.status = status

    if (Object.keys(profileUpdate).length > 0) {
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update(profileUpdate)
        .eq('id', user_id)

      if (profileError) {
        console.error('Profile update error:', profileError)
      }
    }

    // Update role
    if (role) {
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .update({ role })
        .eq('user_id', user_id)

      if (roleError) {
        console.error('Role update error:', roleError)
      }
    }

    // Update permissions
    if (permissions && Array.isArray(permissions)) {
      // Delete existing permissions
      await supabaseAdmin
        .from('user_permissions')
        .delete()
        .eq('user_id', user_id)

      // Insert new permissions
      for (const perm of permissions) {
        const { error: permError } = await supabaseAdmin
          .from('user_permissions')
          .insert({
            user_id,
            modulo: perm.modulo,
            pode_visualizar: perm.pode_visualizar ?? false,
            pode_criar: perm.pode_criar ?? false,
            pode_editar: perm.pode_editar ?? false,
            pode_excluir: perm.pode_excluir ?? false
          })

        if (permError) {
          console.error('Permission error:', permError)
        }
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
