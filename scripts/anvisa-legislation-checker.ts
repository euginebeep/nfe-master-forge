#!/usr/bin/env node

/**
 * ANVISA Legislation Checker
 * 
 * Automatiza a verificação de novas legislações ANVISA (IN, RDC)
 * e valida conformidade de suplementos contra limites vigentes.
 * 
 * Legislações monitoradas:
 * - IN 28/2018 (consolidada)
 * - IN 75/2020 (Rotulagem nutricional)
 * - RDC 429/2020 (Informação nutricional)
 * - IN 76/2020 (Conversão DFE)
 * - IN 102/2021 (Colageno)
 * - IN 211/2023 (Melatonina)
 * - IN 373/2025 (Novos constituintes)
 * - IN 438/2026 (Curcumina)
 * 
 * Uso:
 * pnpm run anvisa-check
 * pnpm run anvisa-check --product "ALPHA PROACTIV"
 * pnpm run anvisa-check --export-report
 */

import * as fs from 'fs';
import * as path from 'path';
import fetch from 'node-fetch';

// ============================================================
// TIPOS E INTERFACES
// ============================================================

interface AnvisaLegislation {
  id: string;
  name: string;
  type: 'IN' | 'RDC';
  number: number;
  year: number;
  date: string;
  status: 'active' | 'superseded' | 'pending';
  url: string;
  lastUpdated: string;
}

interface AnvisaConstituent {
  id: string;
  name: string;
  alternativeNames: string[];
  cas: string;
  unit: 'mg' | 'mcg' | 'g' | 'UI' | 'UFC' | 'esporos/porção';
  minLimits: Record<string, number | null>;
  maxLimits: Record<string, number | null>;
  legislation: string[];
  notes: string;
  restrictions?: string[];
  warnings?: string[];
  lastUpdated: string;
}

interface SupplementProduct {
  id: string;
  name: string;
  manufacturer: string;
  constituents: {
    name: string;
    dose: number;
    unit: string;
  }[];
  targetAudience: string;
  notificationDate?: string;
  status: 'approved' | 'pending' | 'rejected' | 'unknown';
}

interface ValidationResult {
  product: string;
  constituent: string;
  dose: number;
  unit: string;
  minLimit: number | null;
  maxLimit: number | null;
  status: 'compliant' | 'below_minimum' | 'above_maximum' | 'unknown';
  legislation: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
}

interface CheckerReport {
  timestamp: string;
  legislationsChecked: AnvisaLegislation[];
  constituentsValidated: number;
  productsAnalyzed: number;
  validationResults: ValidationResult[];
  summary: {
    compliant: number;
    warnings: number;
    errors: number;
    unknown: number;
  };
}

// ============================================================
// LEGISLAÇÕES VIGENTES
// ============================================================

const ANVISA_LEGISLATIONS: AnvisaLegislation[] = [
  {
    id: 'IN_28_2018',
    name: 'Instrução Normativa nº 28/2018',
    type: 'IN',
    number: 28,
    year: 2018,
    date: '2018-07-26',
    status: 'active',
    url: 'https://anvisalegis.datalegis.net/action/ActionDatalegis.php?acao=abrirTextoAto&tipo=INM&numeroAto=00000028&seqAto=000&valorAno=2018&orgao=DC/ANVISA/MS',
    lastUpdated: '2026-06-30',
  },
  {
    id: 'IN_75_2020',
    name: 'Instrução Normativa nº 75/2020 - Rotulagem Nutricional',
    type: 'IN',
    number: 75,
    year: 2020,
    date: '2020-10-08',
    status: 'active',
    url: 'https://in75.tabelanutricional.com.br/',
    lastUpdated: '2026-06-30',
  },
  {
    id: 'RDC_429_2020',
    name: 'Resolução da Diretoria Colegiada nº 429/2020',
    type: 'RDC',
    number: 429,
    year: 2020,
    date: '2020-10-08',
    status: 'active',
    url: 'https://rdc429.tabelanutricional.com.br/',
    lastUpdated: '2026-06-30',
  },
  {
    id: 'IN_76_2020',
    name: 'Instrução Normativa nº 76/2020 - Conversão DFE',
    type: 'IN',
    number: 76,
    year: 2020,
    date: '2020-10-08',
    status: 'active',
    url: 'https://anvisalegis.datalegis.net/',
    lastUpdated: '2026-06-30',
  },
  {
    id: 'IN_102_2021',
    name: 'Instrução Normativa nº 102/2021 - Colageno',
    type: 'IN',
    number: 102,
    year: 2021,
    date: '2021-01-01',
    status: 'active',
    url: 'https://anvisalegis.datalegis.net/',
    lastUpdated: '2026-06-30',
  },
  {
    id: 'IN_211_2023',
    name: 'Instrução Normativa nº 211/2023 - Melatonina',
    type: 'IN',
    number: 211,
    year: 2023,
    date: '2023-01-01',
    status: 'active',
    url: 'https://anvisalegis.datalegis.net/',
    lastUpdated: '2026-06-30',
  },
  {
    id: 'IN_373_2025',
    name: 'Instrução Normativa nº 373/2025 - Novos Constituintes',
    type: 'IN',
    number: 373,
    year: 2025,
    date: '2025-06-05',
    status: 'active',
    url: 'https://www.legisweb.com.br/legislacao/?legislacao=479296',
    lastUpdated: '2026-06-30',
  },
  {
    id: 'IN_438_2026',
    name: 'Instrução Normativa nº 438/2026 - Curcumina',
    type: 'IN',
    number: 438,
    year: 2026,
    date: '2026-04-16',
    status: 'active',
    url: 'https://www.legisweb.com.br/legislacao/?id=494422',
    lastUpdated: '2026-06-30',
  },
];

// ============================================================
// CONSTITUINTES AUTORIZADOS COM LIMITES
// ============================================================

const ANVISA_CONSTITUENTS: AnvisaConstituent[] = [
  // VITAMINAS
  {
    id: 'vitamina_a',
    name: 'Vitamina A',
    alternativeNames: ['Retinol', 'Beta-caroteno'],
    cas: '68-26-8',
    unit: 'mcg',
    minLimits: { 'ADULTOS': 0, 'GESTANTES': 0, 'CRIANCAS_4_8': 0 },
    maxLimits: { 'ADULTOS': 3000, 'GESTANTES': 770, 'CRIANCAS_4_8': 600 },
    legislation: ['IN_28_2018'],
    notes: '3000 µg = 10.000 UI máx — apenas vit. A pré-formada',
    lastUpdated: '2026-06-30',
  },
  {
    id: 'vitamina_d3',
    name: 'Vitamina D3',
    alternativeNames: ['Colecalciferol'],
    cas: '67-97-0',
    unit: 'mcg',
    minLimits: { 'ADULTOS': 0, 'GESTANTES': 0, 'CRIANCAS_4_8': 0 },
    maxLimits: { 'ADULTOS': 50, 'GESTANTES': 25, 'CRIANCAS_4_8': 25 },
    legislation: ['IN_28_2018'],
    notes: '50 µg = 2.000 UI — MÁXIMO PERMITIDO IN 28',
    lastUpdated: '2026-06-30',
  },
  {
    id: 'vitamina_b9',
    name: 'Vitamina B9 (Ácido Fólico)',
    alternativeNames: ['Folato', 'DFE'],
    cas: '59-30-3',
    unit: 'mcg',
    minLimits: { 'ADULTOS': 0, 'GESTANTES': 0, 'CRIANCAS_4_8': 0 },
    maxLimits: { 'ADULTOS': 400, 'GESTANTES': 600, 'CRIANCAS_4_8': 200 },
    legislation: ['IN_28_2018', 'IN_76_2020'],
    notes: 'Máximo 400 mcg DFE — Ácido fólico sintético: 1 mcg = 1,7 mcg DFE',
    lastUpdated: '2026-06-30',
  },
  {
    id: 'zinco',
    name: 'Zinco',
    alternativeNames: ['Zinco quelato'],
    cas: '7440-66-6',
    unit: 'mg',
    minLimits: { 'ADULTOS': 0, 'GESTANTES': 0, 'CRIANCAS_4_8': 0 },
    maxLimits: { 'ADULTOS': 25, 'GESTANTES': 25, 'CRIANCAS_4_8': 10 },
    legislation: ['IN_28_2018'],
    notes: 'Máximo 25 mg para adultos (IN 28) — NO LIMITE MÁXIMO',
    lastUpdated: '2026-06-30',
  },
  {
    id: 'colageno_tipo2',
    name: 'Colageno Tipo 2',
    alternativeNames: ['UC-II'],
    cas: '9007-34-5',
    unit: 'mg',
    minLimits: { 'ADULTOS': 40, 'GESTANTES': 0, 'CRIANCAS_4_8': 0 },
    maxLimits: { 'ADULTOS': null, 'GESTANTES': null, 'CRIANCAS_4_8': null },
    legislation: ['IN_102_2021'],
    notes: 'Mínimo 40mg (UC-II não desnaturado) para efeito comprovado',
    lastUpdated: '2026-06-30',
  },
  {
    id: 'melatonina',
    name: 'Melatonina',
    alternativeNames: [],
    cas: '73-31-4',
    unit: 'mg',
    minLimits: { 'ADULTOS': 0, 'GESTANTES': 0, 'CRIANCAS_4_8': 0 },
    maxLimits: { 'ADULTOS': 0.21, 'GESTANTES': 0, 'CRIANCAS_4_8': 0 },
    legislation: ['IN_211_2023'],
    notes: 'Apenas para ≥19 anos — Dose máx 0,21 mg/dia (IN 211/2023 — MUITO RESTRITIVO)',
    lastUpdated: '2026-06-30',
  },
  {
    id: 'gaba',
    name: 'Ácido Gama Aminobutírico (GABA)',
    alternativeNames: ['GABA'],
    cas: '56-12-2',
    unit: 'mg',
    minLimits: { 'ADULTOS': 50, 'GESTANTES': 0, 'CRIANCAS_4_8': 0 },
    maxLimits: { 'ADULTOS': 300, 'GESTANTES': 0, 'CRIANCAS_4_8': 0 },
    legislation: ['IN_373_2025'],
    notes: 'Novo em IN 373/2025 — Apenas ≥19 anos',
    lastUpdated: '2026-06-30',
  },
  {
    id: 'curcumina',
    name: 'Curcumina',
    alternativeNames: ['Extrato de cúrcuma', 'Curcuminoides totais'],
    cas: '458-37-7',
    unit: 'mg',
    minLimits: { 'ADULTOS': 80, 'GESTANTES': 0, 'CRIANCAS_4_8': 0 },
    maxLimits: { 'ADULTOS': 130, 'GESTANTES': 0, 'CRIANCAS_4_8': 0 },
    legislation: ['IN_438_2026'],
    notes: 'Curcuminoides totais = curcumina + desmetoxicurcumina + bisdesmetoxicurcumina. Apenas ≥19 anos.',
    restrictions: ['tetraidrocurcuminoides'],
    warnings: ['Não recomendado para gestantes, lactantes, crianças', 'Doenças hepáticas/biliares', 'Úlceras gástricas'],
    lastUpdated: '2026-06-30',
  },
  {
    id: 'tetraidrocurcuminoides',
    name: 'Tetraidrocurcuminoides',
    alternativeNames: ['THC'],
    cas: '36062-04-7',
    unit: 'mg',
    minLimits: { 'ADULTOS': 0, 'GESTANTES': 0, 'CRIANCAS_4_8': 0 },
    maxLimits: { 'ADULTOS': 120, 'GESTANTES': 0, 'CRIANCAS_4_8': 0 },
    legislation: ['IN_438_2026'],
    notes: 'Novo em IN 438/2026 — Apenas ≥19 anos. NÃO PODE SER ASSOCIADO COM CURCUMINA.',
    restrictions: ['curcumina'],
    warnings: ['Não recomendado para gestantes, lactantes, crianças', 'Doenças hepáticas/biliares', 'Úlceras gástricas'],
    lastUpdated: '2026-06-30',
  },
];

// ============================================================
// CLASSE PRINCIPAL: ANVISA CHECKER
// ============================================================

class AnvisaLegislationChecker {
  private legislations: AnvisaLegislation[];
  private constituents: AnvisaConstituent[];
  private report: CheckerReport;

  constructor() {
    this.legislations = ANVISA_LEGISLATIONS;
    this.constituents = ANVISA_CONSTITUENTS;
    this.report = {
      timestamp: new Date().toISOString(),
      legislationsChecked: [],
      constituentsValidated: 0,
      productsAnalyzed: 0,
      validationResults: [],
      summary: {
        compliant: 0,
        warnings: 0,
        errors: 0,
        unknown: 0,
      },
    };
  }

  /**
   * Valida um constituinte contra limites ANVISA
   */
  validateConstituent(
    constituentName: string,
    dose: number,
    unit: string,
    audience: string = 'ADULTOS'
  ): ValidationResult {
    const constituent = this.constituents.find(
      (c) =>
        c.name.toLowerCase() === constituentName.toLowerCase() ||
        c.alternativeNames.some(
          (alt) => alt.toLowerCase() === constituentName.toLowerCase()
        )
    );

    if (!constituent) {
      return {
        product: '',
        constituent: constituentName,
        dose,
        unit,
        minLimit: null,
        maxLimit: null,
        status: 'unknown',
        legislation: 'UNKNOWN',
        message: `Constituinte "${constituentName}" não encontrado na base ANVISA`,
        severity: 'warning',
      };
    }

    const minLimit = constituent.minLimits[audience] ?? null;
    const maxLimit = constituent.maxLimits[audience] ?? null;
    let status: 'compliant' | 'below_minimum' | 'above_maximum' | 'unknown' =
      'compliant';
    let message = '';

    // Converter unidade se necessário
    const normalizedDose = this.normalizeUnit(dose, unit, constituent.unit);

    if (minLimit !== null && normalizedDose < minLimit) {
      status = 'below_minimum';
      message = `Dose ${normalizedDose}${constituent.unit} está ABAIXO do mínimo permitido (${minLimit}${constituent.unit}) para ${audience}`;
    } else if (maxLimit !== null && normalizedDose > maxLimit) {
      status = 'above_maximum';
      message = `Dose ${normalizedDose}${constituent.unit} está ACIMA do máximo permitido (${maxLimit}${constituent.unit}) para ${audience}`;
    } else if (maxLimit !== null && normalizedDose === maxLimit) {
      status = 'compliant';
      message = `Dose ${normalizedDose}${constituent.unit} está NO MÁXIMO permitido (sem margem de segurança)`;
    } else {
      message = `Dose ${normalizedDose}${constituent.unit} está em conformidade (min: ${minLimit ?? 'N/A'}, max: ${maxLimit ?? 'N/A'})`;
    }

    return {
      product: '',
      constituent: constituent.name,
      dose: normalizedDose,
      unit: constituent.unit,
      minLimit,
      maxLimit,
      status,
      legislation: constituent.legislation.join(', '),
      message,
      severity:
        status === 'compliant' ? 'info' : status === 'unknown' ? 'warning' : 'error',
    };
  }

  /**
   * Normaliza unidades (UI → mcg, g → mg, etc)
   */
  private normalizeUnit(dose: number, fromUnit: string, toUnit: string): number {
    const conversions: Record<string, Record<string, number>> = {
      UI: {
        mcg: (dose) => dose / 40, // 1 mcg = 40 UI (vitamina A)
      },
      g: {
        mg: (dose) => dose * 1000,
        mcg: (dose) => dose * 1_000_000,
      },
      mg: {
        mcg: (dose) => dose * 1000,
      },
    };

    if (fromUnit === toUnit) return dose;

    const converter = conversions[fromUnit]?.[toUnit];
    if (!converter) {
      console.warn(
        `Conversão de ${fromUnit} para ${toUnit} não suportada. Usando valor original.`
      );
      return dose;
    }

    return converter(dose);
  }

  /**
   * Valida conversão DFE para ácido fólico
   */
  validateFolicAcid(dose: number, isSynthetic: boolean): ValidationResult {
    const dfe = isSynthetic ? dose * 1.7 : dose;
    const maxDfe = 400;

    const result = this.validateConstituent('Ácido Fólico', dfe, 'mcg', 'ADULTOS');
    result.message = `Ácido fólico: ${dose}mcg ${isSynthetic ? 'sintético' : 'natural'} = ${dfe}mcg DFE. ${
      dfe <= maxDfe
        ? 'Conforme'
        : `ACIMA do máximo (${maxDfe}mcg DFE)`
    }`;
    result.severity = dfe <= maxDfe ? 'info' : 'error';

    return result;
  }

  /**
   * Valida produto completo
   */
  validateProduct(product: SupplementProduct): ValidationResult[] {
    const results: ValidationResult[] = [];

    for (const constituent of product.constituents) {
      const result = this.validateConstituent(
        constituent.name,
        constituent.dose,
        constituent.unit,
        product.targetAudience || 'ADULTOS'
      );
      result.product = product.name;
      results.push(result);
    }

    return results;
  }

  /**
   * Gera relatório de conformidade
   */
  generateReport(results: ValidationResult[]): CheckerReport {
    this.report.legislationsChecked = this.legislations.filter(
      (l) => l.status === 'active'
    );
    this.report.constituentsValidated = this.constituents.length;
    this.report.validationResults = results;

    this.report.summary = {
      compliant: results.filter((r) => r.status === 'compliant').length,
      warnings: results.filter((r) => r.severity === 'warning').length,
      errors: results.filter((r) => r.severity === 'error').length,
      unknown: results.filter((r) => r.status === 'unknown').length,
    };

    return this.report;
  }

  /**
   * Exporta relatório em JSON
   */
  exportJSON(filePath: string): void {
    fs.writeFileSync(filePath, JSON.stringify(this.report, null, 2));
    console.log(`✅ Relatório exportado: ${filePath}`);
  }

  /**
   * Exporta relatório em HTML
   */
  exportHTML(filePath: string): void {
    const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Relatório ANVISA - Verificação de Legislações</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; padding: 20px; }
    .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); padding: 30px; }
    h1 { color: #1a1a1a; margin-bottom: 10px; }
    .timestamp { color: #666; font-size: 14px; margin-bottom: 30px; }
    .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 30px; }
    .summary-card { background: #f9f9f9; padding: 20px; border-radius: 6px; border-left: 4px solid #007bff; }
    .summary-card.error { border-left-color: #dc3545; }
    .summary-card.warning { border-left-color: #ffc107; }
    .summary-card.unknown { border-left-color: #6c757d; }
    .summary-card h3 { font-size: 12px; color: #666; text-transform: uppercase; margin-bottom: 10px; }
    .summary-card .value { font-size: 32px; font-weight: bold; color: #007bff; }
    .summary-card.error .value { color: #dc3545; }
    .summary-card.warning .value { color: #ffc107; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th { background: #f9f9f9; padding: 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #dee2e6; }
    td { padding: 12px; border-bottom: 1px solid #dee2e6; }
    tr:hover { background: #f9f9f9; }
    .status-compliant { color: #28a745; font-weight: 600; }
    .status-error { color: #dc3545; font-weight: 600; }
    .status-warning { color: #ffc107; font-weight: 600; }
    .status-unknown { color: #6c757d; font-weight: 600; }
    .legislation { background: #e7f3ff; padding: 15px; border-radius: 6px; margin-top: 30px; }
    .legislation h3 { color: #004085; margin-bottom: 10px; }
    .legislation ul { margin-left: 20px; }
    .legislation li { margin: 5px 0; color: #333; }
  </style>
</head>
<body>
  <div class="container">
    <h1>📋 Relatório ANVISA — Verificação de Legislações</h1>
    <div class="timestamp">Gerado em: ${new Date(this.report.timestamp).toLocaleString('pt-BR')}</div>
    
    <div class="summary">
      <div class="summary-card">
        <h3>Conformes</h3>
        <div class="value">${this.report.summary.compliant}</div>
      </div>
      <div class="summary-card warning">
        <h3>Avisos</h3>
        <div class="value">${this.report.summary.warnings}</div>
      </div>
      <div class="summary-card error">
        <h3>Erros</h3>
        <div class="value">${this.report.summary.errors}</div>
      </div>
      <div class="summary-card unknown">
        <h3>Desconhecidos</h3>
        <div class="value">${this.report.summary.unknown}</div>
      </div>
    </div>

    <h2>Resultados de Validação</h2>
    <table>
      <thead>
        <tr>
          <th>Produto</th>
          <th>Constituinte</th>
          <th>Dose</th>
          <th>Limites</th>
          <th>Status</th>
          <th>Legislação</th>
          <th>Mensagem</th>
        </tr>
      </thead>
      <tbody>
        ${this.report.validationResults
          .map(
            (r) => `
          <tr>
            <td>${r.product}</td>
            <td>${r.constituent}</td>
            <td>${r.dose}${r.unit}</td>
            <td>Min: ${r.minLimit ?? 'N/A'} | Max: ${r.maxLimit ?? 'N/A'}</td>
            <td><span class="status-${r.status}">${r.status.toUpperCase()}</span></td>
            <td>${r.legislation}</td>
            <td>${r.message}</td>
          </tr>
        `
          )
          .join('')}
      </tbody>
    </table>

    <div class="legislation">
      <h3>📚 Legislações Verificadas</h3>
      <ul>
        ${this.report.legislationsChecked
          .map((l) => `<li><strong>${l.name}</strong> (${l.date})</li>`)
          .join('')}
      </ul>
    </div>
  </div>
</body>
</html>
    `;

    fs.writeFileSync(filePath, html);
    console.log(`✅ Relatório HTML exportado: ${filePath}`);
  }

  /**
   * Exporta relatório em Markdown
   */
  exportMarkdown(filePath: string): void {
    const md = `# 📋 Relatório ANVISA — Verificação de Legislações

**Gerado em:** ${new Date(this.report.timestamp).toLocaleString('pt-BR')}

## 📊 Resumo

| Métrica | Valor |
|---------|-------|
| Conformes | ${this.report.summary.compliant} |
| Avisos | ${this.report.summary.warnings} |
| Erros | ${this.report.summary.errors} |
| Desconhecidos | ${this.report.summary.unknown} |
| **Total** | **${this.report.validationResults.length}** |

## 🔍 Resultados de Validação

${this.report.validationResults
  .map(
    (r) => `
### ${r.product || 'Sem produto'} — ${r.constituent}

- **Dose:** ${r.dose}${r.unit}
- **Limites:** Min: ${r.minLimit ?? 'N/A'} | Max: ${r.maxLimit ?? 'N/A'}
- **Status:** \`${r.status.toUpperCase()}\`
- **Legislação:** ${r.legislation}
- **Mensagem:** ${r.message}
- **Severidade:** ${r.severity.toUpperCase()}

---
`
  )
  .join('')}

## 📚 Legislações Verificadas

${this.report.legislationsChecked
  .map((l) => `- **${l.name}** (${l.date}) — [Link](${l.url})`)
  .join('\n')}

---

*Relatório gerado automaticamente pelo ANVISA Legislation Checker*
    `;

    fs.writeFileSync(filePath, md);
    console.log(`✅ Relatório Markdown exportado: ${filePath}`);
  }

  /**
   * Lista todas as legislações ativas
   */
  listLegislations(): void {
    console.log('\n📚 LEGISLAÇÕES ANVISA ATIVAS:\n');
    this.legislations
      .filter((l) => l.status === 'active')
      .forEach((l) => {
        console.log(`  ✅ ${l.name}`);
        console.log(`     Data: ${l.date} | Atualizado: ${l.lastUpdated}`);
        console.log(`     URL: ${l.url}\n`);
      });
  }

  /**
   * Lista todos os constituintes
   */
  listConstituents(): void {
    console.log('\n🧪 CONSTITUINTES AUTORIZADOS:\n');
    this.constituents.forEach((c) => {
      console.log(`  ${c.name} (${c.unit})`);
      console.log(`     Limites: Min ${c.minLimits['ADULTOS']} | Max ${c.maxLimits['ADULTOS']}`);
      console.log(`     Legislação: ${c.legislation.join(', ')}`);
      if (c.notes) console.log(`     Notas: ${c.notes}`);
      console.log();
    });
  }
}

// ============================================================
// EXEMPLOS DE USO
// ============================================================

async function main() {
  const checker = new AnvisaLegislationChecker();

  // Exemplo 1: Validar constituinte individual
  console.log('=== EXEMPLO 1: Validar Constituinte Individual ===\n');
  const result1 = checker.validateConstituent('Zinco', 25, 'mg', 'ADULTOS');
  console.log(result1);

  // Exemplo 2: Validar ácido fólico com conversão DFE
  console.log('\n=== EXEMPLO 2: Validar Ácido Fólico (DFE) ===\n');
  const result2 = checker.validateFolicAcid(300, true); // 300 mcg sintético
  console.log(result2);

  // Exemplo 3: Validar produto completo
  console.log('\n=== EXEMPLO 3: Validar Produto Completo ===\n');
  const product: SupplementProduct = {
    id: '001',
    name: 'ALPHA PROACTIV',
    manufacturer: 'Vitalnow',
    constituents: [
      { name: 'Zinco', dose: 25, unit: 'mg' },
      { name: 'Vitamina D3', dose: 500, unit: 'UI' },
      { name: 'Colageno Tipo 2', dose: 20, unit: 'mg' }, // ABAIXO DO MÍNIMO
    ],
    targetAudience: 'ADULTOS',
    status: 'approved',
  };

  const productResults = checker.validateProduct(product);
  productResults.forEach((r) => console.log(r));

  // Exemplo 4: Gerar relatório
  console.log('\n=== EXEMPLO 4: Gerar Relatório ===\n');
  const report = checker.generateReport(productResults);
  console.log(`Relatório gerado com ${report.validationResults.length} validações`);

  // Exemplo 5: Exportar relatórios
  console.log('\n=== EXEMPLO 5: Exportar Relatórios ===\n');
  const reportDir = path.join(process.cwd(), 'reports', 'anvisa');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  checker.exportJSON(path.join(reportDir, 'report.json'));
  checker.exportHTML(path.join(reportDir, 'report.html'));
  checker.exportMarkdown(path.join(reportDir, 'report.md'));

  // Exemplo 6: Listar legislações
  console.log('\n=== EXEMPLO 6: Listar Legislações ===\n');
  checker.listLegislations();

  // Exemplo 7: Listar constituintes
  console.log('\n=== EXEMPLO 7: Listar Constituintes ===\n');
  checker.listConstituents();
}

// Executar se chamado diretamente
if (require.main === module) {
  main().catch(console.error);
}

export { AnvisaLegislationChecker, ValidationResult, CheckerReport };
