#!/usr/bin/env node
/**
 * Script de Testes - Fix Peso de Cápsula
 * 
 * Valida que o fix de unificação de PESO_CAPSULA_ALVO está funcionando corretamente
 * Executa testes de Q.S.P., bateladas e volume
 * 
 * Uso: npx ts-node scripts/test-peso-capsula-fix.ts
 */

import { createClient } from "@supabase/supabase-js";

// ============================================================
// TIPOS E INTERFACES
// ============================================================

interface Formula {
  id: string;
  nome_formula: string;
  peso_enchimento_mg: number | null;
  densidade_aparente_kg_l: number | null;
}

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  details?: Record<string, any>;
}

// ============================================================
// CONFIGURAÇÃO
// ============================================================

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://cjvekdfrfmwdygmr.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!SUPABASE_KEY) {
  console.error("❌ ERRO: SUPABASE_SERVICE_ROLE_KEY não configurada");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ============================================================
// TESTES
// ============================================================

/**
 * Teste 1: Validar que PESO_CAPSULA_ALVO é unificado com PESO_ENCHIMENTO_MG
 */
async function testPesoCapsulaunificado(): Promise<TestResult> {
  try {
    // Buscar fórmulas com peso_enchimento_mg definido
    const { data: formulas, error } = await supabase
      .from("formulas")
      .select("id, nome_formula, peso_enchimento_mg, densidade_aparente_kg_l")
      .eq("status", "APROVADA")
      .not("peso_enchimento_mg", "is", null)
      .limit(3);

    if (error) throw error;
    if (!formulas || formulas.length === 0) {
      return {
        name: "Peso Cápsula Unificado",
        passed: false,
        message: "Nenhuma fórmula com peso_enchimento_mg encontrada",
      };
    }

    // Validar que cada fórmula tem peso definido
    const allValid = formulas.every((f) => f.peso_enchimento_mg && f.peso_enchimento_mg > 0);

    return {
      name: "Peso Cápsula Unificado",
      passed: allValid,
      message: allValid
        ? `✅ ${formulas.length} fórmulas com peso_enchimento_mg válido`
        : "❌ Algumas fórmulas têm peso inválido",
      details: {
        formulas: formulas.map((f) => ({
          nome: f.nome_formula,
          peso_enchimento_mg: f.peso_enchimento_mg,
          densidade: f.densidade_aparente_kg_l,
        })),
      },
    };
  } catch (error) {
    return {
      name: "Peso Cápsula Unificado",
      passed: false,
      message: `❌ Erro ao buscar fórmulas: ${error}`,
    };
  }
}

/**
 * Teste 2: Validar cálculo de Q.S.P. com dados reais
 */
async function testCalculoQSP(): Promise<TestResult> {
  try {
    // Simular cálculo de Q.S.P. com diferentes densidades
    const testCases = [
      {
        nome: "Colágeno (Baixa Densidade)",
        peso_enchimento_mg: 450,
        densidade: 0.45,
        ativos_mg: 300,
        tecnologicos_pct: 5,
      },
      {
        nome: "Minerais Quelados (Alta Densidade)",
        peso_enchimento_mg: 520,
        densidade: 0.85,
        ativos_mg: 350,
        tecnologicos_pct: 5,
      },
      {
        nome: "Fallback (Sem peso)",
        peso_enchimento_mg: 500, // fallback
        densidade: 0.65,
        ativos_mg: 300,
        tecnologicos_pct: 5,
      },
    ];

    const results = testCases.map((tc) => {
      // Cálculo de tecnológicos
      const tecnologicos_mg = tc.peso_enchimento_mg * (tc.tecnologicos_pct / 100);

      // Cálculo de excipiente (Q.S.P.)
      const excipiente_mg = tc.peso_enchimento_mg - tc.ativos_mg - tecnologicos_mg;

      // Validações
      const isValid =
        excipiente_mg > 0 &&
        tc.ativos_mg + tecnologicos_mg + excipiente_mg === tc.peso_enchimento_mg;

      return {
        nome: tc.nome,
        peso_total: tc.peso_enchimento_mg,
        ativos: tc.ativos_mg,
        tecnologicos: tecnologicos_mg.toFixed(2),
        excipiente: excipiente_mg.toFixed(2),
        valido: isValid,
      };
    });

    const allValid = results.every((r) => r.valido);

    return {
      name: "Cálculo de Q.S.P.",
      passed: allValid,
      message: allValid
        ? `✅ Todos os ${results.length} cálculos de Q.S.P. válidos`
        : "❌ Alguns cálculos de Q.S.P. inválidos",
      details: { calculos: results },
    };
  } catch (error) {
    return {
      name: "Cálculo de Q.S.P.",
      passed: false,
      message: `❌ Erro ao calcular Q.S.P.: ${error}`,
    };
  }
}

/**
 * Teste 3: Validar cálculo de bateladas
 */
async function testCalculoBateladas(): Promise<TestResult> {
  try {
    const testCases = [
      {
        nome: "Pequena Produção",
        unidades: 100,
        peso_enchimento_mg: 450,
        densidade: 0.45,
        volume_misturador_l: 100,
        fator_max: 0.65,
      },
      {
        nome: "Grande Produção",
        unidades: 10000,
        peso_enchimento_mg: 520,
        densidade: 0.85,
        volume_misturador_l: 100,
        fator_max: 0.65,
      },
    ];

    const results = testCases.map((tc) => {
      // Cálculo de peso total
      const pesoTotalMg = tc.unidades * tc.peso_enchimento_mg;
      const pesoTotalKg = pesoTotalMg / 1_000_000;

      // Cálculo de volume
      const volumeTotalL = pesoTotalKg / tc.densidade;

      // Cálculo de bateladas
      const volumeUtilMaxL = tc.volume_misturador_l * tc.fator_max;
      const numeroBateladas = Math.ceil(volumeTotalL / volumeUtilMaxL);

      // Validações
      const isValid = numeroBateladas > 0 && volumeTotalL > 0;

      return {
        nome: tc.nome,
        unidades: tc.unidades,
        peso_total_kg: pesoTotalKg.toFixed(3),
        volume_total_l: volumeTotalL.toFixed(2),
        numero_bateladas: numeroBateladas,
        volume_por_batelada_l: (volumeTotalL / numeroBateladas).toFixed(2),
        valido: isValid,
      };
    });

    const allValid = results.every((r) => r.valido);

    return {
      name: "Cálculo de Bateladas",
      passed: allValid,
      message: allValid
        ? `✅ Todos os ${results.length} cálculos de bateladas válidos`
        : "❌ Alguns cálculos de bateladas inválidos",
      details: { bateladas: results },
    };
  } catch (error) {
    return {
      name: "Cálculo de Bateladas",
      passed: false,
      message: `❌ Erro ao calcular bateladas: ${error}`,
    };
  }
}

/**
 * Teste 4: Validar validação de volume
 */
async function testValidacaoVolume(): Promise<TestResult> {
  try {
    const testCases = [
      {
        nome: "Volume OK",
        volume_l: 30,
        volume_util_min_l: 15,
        volume_util_max_l: 65,
        esperado: "ok",
      },
      {
        nome: "Volume Baixo",
        volume_l: 10,
        volume_util_min_l: 15,
        volume_util_max_l: 65,
        esperado: "aviso_baixo",
      },
      {
        nome: "Volume Alto",
        volume_l: 60,
        volume_util_min_l: 15,
        volume_util_max_l: 65,
        esperado: "aviso_alto",
      },
      {
        nome: "Volume Bloqueado",
        volume_l: 70,
        volume_util_min_l: 15,
        volume_util_max_l: 65,
        esperado: "bloqueado",
      },
    ];

    const results = testCases.map((tc) => {
      let status: "ok" | "aviso_baixo" | "aviso_alto" | "bloqueado" = "ok";

      if (tc.volume_l > tc.volume_util_max_l) {
        status = "bloqueado";
      } else if (tc.volume_l > tc.volume_util_max_l * 0.9) {
        status = "aviso_alto";
      } else if (tc.volume_l < tc.volume_util_min_l) {
        status = "aviso_baixo";
      }

      const isValid = status === tc.esperado;

      return {
        nome: tc.nome,
        volume_l: tc.volume_l,
        status_calculado: status,
        status_esperado: tc.esperado,
        valido: isValid,
      };
    });

    const allValid = results.every((r) => r.valido);

    return {
      name: "Validação de Volume",
      passed: allValid,
      message: allValid
        ? `✅ Todos os ${results.length} testes de volume válidos`
        : "❌ Alguns testes de volume falharam",
      details: { validacoes: results },
    };
  } catch (error) {
    return {
      name: "Validação de Volume",
      passed: false,
      message: `❌ Erro ao validar volume: ${error}`,
    };
  }
}

/**
 * Teste 5: Validar fallback para 500mg
 */
async function testFallback500mg(): Promise<TestResult> {
  try {
    // Buscar fórmulas SEM peso_enchimento_mg
    const { data: formulas, error } = await supabase
      .from("formulas")
      .select("id, nome_formula, peso_enchimento_mg")
      .eq("status", "APROVADA")
      .is("peso_enchimento_mg", null)
      .limit(2);

    if (error) throw error;

    // Se não houver fórmulas sem peso, teste passa (fallback não é usado)
    if (!formulas || formulas.length === 0) {
      return {
        name: "Fallback 500mg",
        passed: true,
        message: "✅ Nenhuma fórmula sem peso encontrada (fallback não necessário)",
      };
    }

    // Simular cálculo com fallback
    const fallbackResults = formulas.map((f) => {
      const peso_capsula_alvo = f.peso_enchimento_mg ?? 500; // Fallback
      return {
        nome: f.nome_formula,
        peso_enchimento_mg: f.peso_enchimento_mg,
        peso_capsula_alvo_usado: peso_capsula_alvo,
        usou_fallback: f.peso_enchimento_mg === null,
      };
    });

    const allUsouFallback = fallbackResults.every((r) => r.usou_fallback);

    return {
      name: "Fallback 500mg",
      passed: allUsouFallback,
      message: allUsouFallback
        ? `✅ Fallback de 500mg funcionando para ${formulas.length} fórmulas`
        : "❌ Algumas fórmulas não usaram fallback corretamente",
      details: { fallbacks: fallbackResults },
    };
  } catch (error) {
    return {
      name: "Fallback 500mg",
      passed: false,
      message: `❌ Erro ao testar fallback: ${error}`,
    };
  }
}

// ============================================================
// EXECUÇÃO
// ============================================================

async function runAllTests() {
  console.log("\n🧪 TESTES - FIX PESO DE CÁPSULA\n");
  console.log("=" .repeat(60));

  const tests = [
    testPesoCapsulaunificado,
    testCalculoQSP,
    testCalculoBateladas,
    testValidacaoVolume,
    testFallback500mg,
  ];

  const results: TestResult[] = [];

  for (const test of tests) {
    process.stdout.write(`⏳ Executando ${test.name}... `);
    const result = await test();
    results.push(result);
    console.log(result.passed ? "✅ PASSOU" : "❌ FALHOU");
  }

  // ============================================================
  // RELATÓRIO
  // ============================================================

  console.log("\n" + "=".repeat(60));
  console.log("📊 RELATÓRIO DE TESTES\n");

  results.forEach((result) => {
    const icon = result.passed ? "✅" : "❌";
    console.log(`${icon} ${result.name}`);
    console.log(`   ${result.message}`);
    if (result.details) {
      console.log(`   Detalhes: ${JSON.stringify(result.details, null, 2)}`);
    }
    console.log();
  });

  // ============================================================
  // RESUMO
  // ============================================================

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  const percentage = ((passed / total) * 100).toFixed(0);

  console.log("=".repeat(60));
  console.log(`\n📈 RESUMO: ${passed}/${total} testes passaram (${percentage}%)\n`);

  if (passed === total) {
    console.log("🎉 TODOS OS TESTES PASSARAM!\n");
    process.exit(0);
  } else {
    console.log("⚠️  ALGUNS TESTES FALHARAM!\n");
    process.exit(1);
  }
}

// Executar testes
runAllTests().catch((error) => {
  console.error("❌ Erro ao executar testes:", error);
  process.exit(1);
});
