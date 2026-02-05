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
    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client with anon key to verify the caller
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    // Get the calling user
    const { data: { user: callingUser }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !callingUser) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if the calling user is an admin
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

    // Parse the request body
    const body = await req.json()
    const { email, password, nome_completo, cargo, departamento, role, avatar_url, permissions } = body

    if (!email || !password || !nome_completo) {
      return new Response(
        JSON.stringify({ error: 'Email, password, and nome_completo are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create admin client with service role key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Create the user
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm the email
      user_metadata: {
        full_name: nome_completo
      }
    })

    if (createError) {
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update the profile with additional info
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        nome_completo,
        cargo,
        departamento,
        avatar_url,
        status: 'ATIVO'
      })
      .eq('id', newUser.user.id)

    if (profileError) {
      console.error('Profile update error:', profileError)
    }

    // Set the user's role
    if (role && role !== 'visualizador') {
      // Update the default role
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .update({ role })
        .eq('user_id', newUser.user.id)

      if (roleError) {
        console.error('Role update error:', roleError)
      }
    }

    // Set module permissions if provided
    if (permissions && Array.isArray(permissions)) {
      for (const perm of permissions) {
        const { error: permError } = await supabaseAdmin
          .from('user_permissions')
          .upsert({
            user_id: newUser.user.id,
            modulo: perm.modulo,
            pode_visualizar: perm.pode_visualizar ?? false,
            pode_criar: perm.pode_criar ?? false,
            pode_editar: perm.pode_editar ?? false,
            pode_excluir: perm.pode_excluir ?? false
          }, { onConflict: 'user_id,modulo' })

        if (permError) {
          console.error('Permission error:', permError)
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: {
          id: newUser.user.id,
          email: newUser.user.email,
          nome_completo
        }
      }),
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
