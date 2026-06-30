
import { supabase } from './src/integrations/supabase/client';

async function runTests() {
  console.log('🚀 Iniciando Testes Ponta a Ponta - Sistema ANVISA Real\n');

  const cenarios = [
    {
      nome: 'Cenário 1: Vitamina D3 acima do limite (Bloqueio)',
      body: {
        action: 'analyze_formula',
        produto: 'Imune Plus',
        ativos: [{ nome: 'Vitamina D3', dose: 3000, unit: 'UI' }] // Limite é 2000 UI
      }
    },
    {
      nome: 'Cenário 2: Melatonina para menores de 19 anos (Bloqueio)',
      body: {
        action: 'analyze_formula',
        produto: 'Sono Kids',
        publico: 'CRIANÇAS',
        ativos: [{ nome: 'Melatonina', dose: 0.21, unit: 'mg' }]
      }
    },
    {
      nome: 'Cenário 3: Berberina (Substância Não Autorizada - Bloqueio)',
      body: {
        action: 'analyze_formula',
        produto: 'Cleanse X',
        ativos: [{ nome: 'Berberina', dose: 500, unit: 'mg' }]
      }
    },
    {
      nome: 'Cenário 4: Fórmula em Conformidade (Aprovação)',
      body: {
        action: 'analyze_formula',
        produto: 'Multivitamínico A-Z',
        publico: 'ADULTOS',
        ativos: [
          { nome: 'Vitamina C', dose: 500, unit: 'mg' },
          { nome: 'Zinco', dose: 10, unit: 'mg' },
          { nome: 'Vitamina D3', dose: 1000, unit: 'UI' }
        ]
      }
    }
  ];

  const relatorio = [];

  for (const cenario of cenarios) {
    console.log(`Testing: ${cenario.nome}...`);
    try {
      const response = await fetch('https://lvptvswvqjhvobdvgfws.supabase.co/functions/v1/anvisa-ai-verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify(cenario.body)
      });

      const data = await response.json();
      
      relatorio.push({
        cenario: cenario.nome,
        status: data.status_geral,
        alertas: data.alertas?.map(a => `[${a.tipo.toUpperCase()}] ${a.titulo}: ${a.corpo}`).join(' | ') || 'Nenhum alerta',
        resultado: data.status_geral === 'BLOQUEADO' ? '❌ BLOQUEADO' : '✅ APROVADO'
      });
    } catch (error) {
      console.error(`Erro no cenário ${cenario.nome}:`, error);
      relatorio.push({ cenario: cenario.nome, status: 'ERRO', alertas: error.message, resultado: '⚠️ FALHA NO TESTE' });
    }
  }

  console.log('\n📊 RELATÓRIO DE EVIDÊNCIAS - TESTE E2E ANVISA\n');
  console.table(relatorio);
}

runTests();
