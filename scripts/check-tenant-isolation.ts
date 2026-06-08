
import { supabase } from './src/integrations/supabase/client';

async function checkIsolation() {
  console.log('🔍 Iniciando Check de Isolamento Multi-tenant\n');

  const demoCompanyId = '00000000-0000-0000-0000-000000000001';

  // 1. Verificar se existem notificações de empresas reais que referenciam dados demo
  console.log('--- Verificando notificações vazadas ---');
  const { data: realUsers } = await supabase
    .from('profiles')
    .select('id, nome_completo, company_id')
    .neq('company_id', demoCompanyId);

  if (realUsers && realUsers.length > 0) {
    const realUserIds = realUsers.map(u => u.id);
    const { data: leakedNotifs, error } = await supabase
      .from('notifications')
      .select('*')
      .in('user_id', realUserIds)
      .or('title.ilike.%demo%,message.ilike.%demo%,message.ilike.%L2026%,title.ilike.%Anomalia%');

    if (leakedNotifs && leakedNotifs.length > 0) {
      console.error(`❌ ERRO: Foram encontradas ${leakedNotifs.length} notificações suspeitas em contas REAIS.`);
      leakedNotifs.forEach(n => console.log(`   - Para usuário: ${n.user_id} | Título: ${n.title}`));
    } else {
      console.log('✅ SUCESSO: Nenhuma notificação demo encontrada em contas reais.');
    }
  } else {
    console.log('ℹ️ INFO: Nenhum usuário real cadastrado para teste.');
  }

  // 2. Verificar se existem alertas executivos em empresas reais que pertencem à demo
  console.log('\n--- Verificando alertas executivos vazados ---');
  const { data: realAlerts } = await supabase
    .from('alertas_executivos')
    .select('id, company_id, titulo')
    .neq('company_id', demoCompanyId);

  if (realAlerts && realAlerts.length > 0) {
    const alertsWithDemoTitle = realAlerts.filter(a => a.titulo.toLowerCase().includes('demo') || a.titulo.includes('L2026'));
    if (alertsWithDemoTitle.length > 0) {
      console.error(`❌ ERRO: Foram encontrados ${alertsWithDemoTitle.length} alertas suspeitos em empresas REAIS.`);
    } else {
      console.log('✅ SUCESSO: Alertas das empresas reais parecem legítimos.');
    }
  } else {
    console.log('✅ SUCESSO: Nenhum alerta executivo em empresas reais (limpo).');
  }

  console.log('\n🏁 Check de isolamento concluído.');
}

checkIsolation();
