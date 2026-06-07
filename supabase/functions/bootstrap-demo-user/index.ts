import { createClient } from 'npm:@supabase/supabase-js@2';

const DEMO_COMPANY_ID = '00000000-0000-0000-0000-000000000001';
const DEMO_EMAIL = 'demo@brainxerp.com';
const DEMO_PASSWORD = 'BrainX ERPDemo2026!';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Find existing demo user
    const { data: existingList } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    let demoUser = existingList?.users.find((u) => u.email === DEMO_EMAIL);

    if (!demoUser) {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: 'Usuário Demo BrainX ERP' },
      });
      if (createErr) {
        return new Response(JSON.stringify({ error: createErr.message }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      demoUser = created.user;
    } else {
      // Reset password in case it drifted
      await admin.auth.admin.updateUserById(demoUser.id, { password: DEMO_PASSWORD });
    }

    // 2. Ensure profile linked to demo company
    await admin.from('profiles').upsert({
      id: demoUser!.id,
      nome_completo: 'Usuário Demo BrainX ERP',
      cargo: 'Demonstração',
      departamento: 'DIRETORIA',
      company_id: DEMO_COMPANY_ID,
      is_demo: true,
      status: 'ATIVO',
    }, { onConflict: 'id' });

    // 3. Admin role
    await admin.from('user_roles').upsert(
      { user_id: demoUser!.id, role: 'admin' },
      { onConflict: 'user_id,role' },
    );

    // 4. Trigger initial seed
    const seedRes = await fetch(`${supabaseUrl}/functions/v1/seed-demo-data`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
    });
    const seedBody = await seedRes.json().catch(() => ({}));

    return new Response(JSON.stringify({
      success: true,
      user_id: demoUser!.id,
      email: DEMO_EMAIL,
      seed: seedBody,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('bootstrap-demo-user error', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});