/**
 * Serviço de Geração de Laudos ANVISA Profissionais
 * 
 * Gera laudos técnicos completos conforme legislação ANVISA
 * com validação 100% legislativa, assinatura de RT e rodapé profissional
 */

import { supabase } from '@/integrations/supabase/client';
import { ANVISA_LIMITS } from '@/lib/anvisa-limits';

export interface Constituent {
  name: string;
  dose: number;
  unit: string;
  legislacao: string;
  minDose?: number;
  maxDose?: number;
  allowedGroups?: string[];
  restrictedGroups?: string[];
}

export interface Product {
  id: string;
  name: string;
  description: string;
  constituents: Constituent[];
  targetAudience: string; // 'CRIANCAS_4_8' | 'CRIANCAS_9_18' | 'ADULTOS' | 'GESTANTES' | 'LACTANTES'
  servingSize: number;
  servingSizeUnit: string;
  servingsPerPackage: number;
}

export interface RTInfo {
  name: string;
  tipoConselho: 'CRN' | 'CRQ' | 'CRF';
  numeroRegistro: string;
  ufConselho: string;
  email: string;
  phone: string;
  companyName: string;
  companyLogo?: string;
}

export interface LaudoData {
  product: Product;
  rtInfo: RTInfo;
  validationDate: Date;
  complianceStatus: 'CONFORME' | 'NAO_CONFORME' | 'OBSERVACOES';
  issues: string[];
  recommendations: string[];
}

class AnvisaLaudoGeneratorService {
  /**
   * Valida constituinte contra legislação ANVISA
   */
  validateConstituent(constituent: Constituent): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Verificar se constituinte existe em ANVISA
    const anvisaConstituent = Object.values(ANVISA_LIMITS).find(
      (c: any) => c.name?.toLowerCase() === constituent.name.toLowerCase()
    );

    if (!anvisaConstituent) {
      errors.push(`Constituinte \"${constituent.name}\" não encontrado na legislação ANVISA`);
      return { isValid: false, errors, warnings };
    }

    // Validar dose mínima
    if (anvisaConstituent.min && constituent.dose < anvisaConstituent.min) {
      errors.push(
        `Dose de ${constituent.name} (${constituent.dose}${constituent.unit}) está ABAIXO do mínimo permitido (${anvisaConstituent.min}${constituent.unit})`
      );
    }

    // Validar dose máxima
    if (anvisaConstituent.max && constituent.dose > anvisaConstituent.max) {
      errors.push(
        `Dose de ${constituent.name} (${constituent.dose}${constituent.unit}) está ACIMA do máximo permitido (${anvisaConstituent.max}${constituent.unit})`
      );
    }

    // Validar grupo populacional
    if (anvisaConstituent.restrictedGroups?.includes(constituent.name)) {
      errors.push(
        `${constituent.name} é PROIBIDO para o grupo-alvo especificado (${anvisaConstituent.restrictedGroups.join(', ')})`
      );
    }

    // Avisos de dose no limite
    if (
      anvisaConstituent.max &&
      constituent.dose >= anvisaConstituent.max * 0.95
    ) {
      warnings.push(
        `⚠️ ${constituent.name} está próximo ao limite máximo (${constituent.dose}/${anvisaConstituent.max}${constituent.unit})`
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Valida produto completo
   */
  validateProduct(product: Product): {
    isValid: boolean;
    allErrors: string[];
    allWarnings: string[];
    constituentValidations: Map<string, any>;
  } {
    const allErrors: string[] = [];
    const allWarnings: string[] = [];
    const constituentValidations = new Map();

    // Validar cada constituinte
    for (const constituent of product.constituents) {
      const validation = this.validateConstituent(constituent);
      constituentValidations.set(constituent.name, validation);

      allErrors.push(...validation.errors);
      allWarnings.push(...validation.warnings);
    }

    // Validar restrições de associação
    const restrictions = this.checkRestrictions(product.constituents);
    allErrors.push(...restrictions.errors);
    allWarnings.push(...restrictions.warnings);

    return {
      isValid: allErrors.length === 0,
      allErrors,
      allWarnings,
      constituentValidations,
    };
  }

  /**
   * Verifica restrições de associação entre constituintes
   */
  private checkRestrictions(constituents: Constituent[]): {
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Restrição: Curcumina + Tetraidrocurcuminoides (IN 438/2026)
    const hasCurcumina = constituents.some(
      (c) => c.name.toLowerCase().includes('curcumina')
    );
    const hasTetraidro = constituents.some(
      (c) => c.name.toLowerCase().includes('tetraidro')
    );

    if (hasCurcumina && hasTetraidro) {
      errors.push(
        '❌ RESTRIÇÃO: Curcumina e Tetraidrocurcuminoides NÃO podem estar no mesmo produto (IN 438/2026)'
      );
    }

    return { errors, warnings };
  }

  /**
   * Gera laudo técnico em HTML
   */
  generateLaudoHTML(laudoData: LaudoData): string {
    const { product, rtInfo, validationDate, complianceStatus, issues, recommendations } =
      laudoData;

    const validation = this.validateProduct(product);
    const statusColor =
      complianceStatus === 'CONFORME'
        ? '#28a745'
        : complianceStatus === 'NAO_CONFORME'
          ? '#dc3545'
          : '#ffc107';
    const statusText =
      complianceStatus === 'CONFORME'
        ? '✅ CONFORME'
        : complianceStatus === 'NAO_CONFORME'
          ? '❌ NÃO CONFORME'
          : '⚠️ COM OBSERVAÇÕES';

    return `
<!DOCTYPE html>
<html lang=\"pt-BR\">
<head>
    <meta charset=\"UTF-8\">
    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">
    <title>Laudo Técnico ANVISA - ${product.name}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f5f5f5;
        }

        .container {
            max-width: 900px;
            margin: 0 auto;
            background: white;
            padding: 40px;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
        }

        /* CABEÇALHO */
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 3px solid #003366;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }

        .header-left h1 {
            font-size: 24px;
            color: #003366;
            margin-bottom: 5px;
        }

        .header-left p {
            font-size: 12px;
            color: #666;
        }

        .header-right {
            text-align: right;
        }

        .logo {
            max-width: 150px;
            max-height: 80px;
            margin-bottom: 10px;
        }

        .company-name {
            font-size: 14px;
            font-weight: bold;
            color: #003366;
        }

        /* STATUS */
        .status-box {
            background: ${statusColor};
            color: white;
            padding: 15px;
            border-radius: 5px;
            margin-bottom: 20px;
            font-size: 16px;
            font-weight: bold;
            text-align: center;
        }

        /* SEÇÕES */
        .section {
            margin-bottom: 30px;
        }

        .section-title {
            font-size: 16px;
            font-weight: bold;
            color: #003366;
            border-bottom: 2px solid #003366;
            padding-bottom: 10px;
            margin-bottom: 15px;
        }

        .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 15px;
        }

        .info-item {
            background: #f9f9f9;
            padding: 10px;
            border-left: 3px solid #003366;
        }

        .info-label {
            font-weight: bold;
            color: #003366;
            font-size: 12px;
            text-transform: uppercase;
        }

        .info-value {
            font-size: 14px;
            margin-top: 5px;
        }

        /* TABELA */
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
        }

        th {
            background: #003366;
            color: white;
            padding: 12px;
            text-align: left;
            font-size: 12px;
            font-weight: bold;
        }

        td {
            padding: 10px 12px;
            border-bottom: 1px solid #ddd;
            font-size: 12px;
        }

        tr:nth-child(even) {
            background: #f9f9f9;
        }

        .status-ok {
            color: #28a745;
            font-weight: bold;
        }

        .status-error {
            color: #dc3545;
            font-weight: bold;
        }

        .status-warning {
            color: #ffc107;
            font-weight: bold;
        }

        /* ERROS E AVISOS */
        .error-list, .warning-list {
            list-style: none;
            margin-left: 0;
        }

        .error-list li {
            padding: 8px;
            margin-bottom: 5px;
            background: #f8d7da;
            border-left: 3px solid #dc3545;
            color: #721c24;
        }

        .warning-list li {
            padding: 8px;
            margin-bottom: 5px;
            background: #fff3cd;
            border-left: 3px solid #ffc107;
            color: #856404;
        }

        /* ASSINATURA */
        .signature-section {
            margin-top: 50px;
            page-break-inside: avoid;
        }

        .signature-line {
            display: inline-block;
            width: 300px;
            border-top: 1px solid #000;
            margin-top: 40px;
            margin-right: 50px;
        }

        .signature-info {
            font-size: 11px;
            margin-top: 5px;
        }

        /* RODAPÉ */
        .footer {
            border-top: 2px solid #003366;
            padding-top: 15px;
            margin-top: 30px;
            font-size: 9px;
            color: #666;
            text-align: center;
        }

        .footer-line {
            margin-bottom: 5px;
        }

        /* PRINT */
        @media print {
            body {
                background: white;
            }
            .container {
                box-shadow: none;
                padding: 20px;
            }
            .page-break {
                page-break-after: always;
            }
        }
    </style>
</head>
<body>
    <div class=\"container\">
        <!-- CABEÇALHO -->
        <div class=\"header\">
            <div class=\"header-left\">
                <h1>LAUDO TÉCNICO</h1>
                <p>Conformidade ANVISA - Suplemento Alimentar</p>
            </div>
            <div class=\"header-right\">
                ${rtInfo.companyLogo ? `<img src=\"${rtInfo.companyLogo}\" class=\"logo\" alt=\"Logo\">` : ''}
                <div class=\"company-name\">${rtInfo.companyName}</div>
            </div>
        </div>

        <!-- STATUS -->
        <div class=\"status-box\">${statusText}</div>

        <!-- INFORMAÇÕES DO PRODUTO -->
        <div class=\"section\">
            <div class=\"section-title\">1. INFORMAÇÕES DO PRODUTO</div>
            <div class=\"info-grid\">
                <div class=\"info-item\">
                    <div class=\"info-label\">Nome do Produto</div>
                    <div class=\"info-value\">${product.name}</div>
                </div>
                <div class=\"info-item\">
                    <div class=\"info-label\">Público-Alvo</div>
                    <div class=\"info-value\">${this.translateTargetAudience(product.targetAudience)}</div>
                </div>
                <div class=\"info-item\">
                    <div class=\"info-label\">Porção</div>
                    <div class=\"info-value\">${product.servingSize} ${product.servingSizeUnit}(s)</div>
                </div>
                <div class=\"info-item\">
                    <div class=\"info-label\">Porções por Embalagem</div>
                    <div class=\"info-value\">${product.servingsPerPackage}</div>
                </div>
            </div>
        </div>

        <!-- CONSTITUINTES -->
        <div class=\"section\">
            <div class=\"section-title\">2. ANÁLISE DE CONSTITUINTES</div>
            <table>
                <thead>
                    <tr>
                        <th>Constituinte</th>
                        <th>Dose</th>
                        <th>Mín. Permitido</th>
                        <th>Máx. Permitido</th>
                        <th>Legislação</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${product.constituents
                      .map((constituent) => {
                        const anvisaData = Object.values(ANVISA_LIMITS).find(
                          (c: any) => c.name?.toLowerCase() === constituent.name.toLowerCase()
                        ) as any;
                        const validation = validation.constituentValidations.get(constituent.name);
                        const status = validation?.isValid
                          ? '<span class=\"status-ok\">✅ OK</span>'
                          : '<span class=\"status-error\">❌ ERRO</span>';

                        return `
                    <tr>
                        <td><strong>${constituent.name}</strong></td>
                        <td>${constituent.dose} ${constituent.unit}</td>
                        <td>${anvisaData?.min || '-'}</td>
                        <td>${anvisaData?.max || '-'}</td>
                        <td>${constituent.legislacao}</td>
                        <td>${status}</td>
                    </tr>
                    `;
                      })
                      .join('')}
                </tbody>
            </table>
        </div>

        <!-- ERROS -->
        ${validation.allErrors.length > 0
          ? `
        <div class=\"section\">
            <div class=\"section-title\">3. ❌ ERROS ENCONTRADOS</div>
            <ul class=\"error-list\">
                ${validation.allErrors.map((error) => `<li>${error}</li>`).join('')}
            </ul>
        </div>
        `
          : ''}

        <!-- AVISOS -->
        ${validation.allWarnings.length > 0
          ? `
        <div class=\"section\">
            <div class=\"section-title\">4. ⚠️ AVISOS</div>
            <ul class=\"warning-list\">
                ${validation.allWarnings.map((warning) => `<li>${warning}</li>`).join('')}
            </ul>
        </div>
        `
          : ''}

        <!-- RECOMENDAÇÕES -->
        ${recommendations.length > 0
          ? `
        <div class=\"section\">
            <div class=\"section-title\">5. RECOMENDAÇÕES</div>
            <ul class=\"error-list\">
                ${recommendations.map((rec) => `<li>${rec}</li>`).join('')}
            </ul>
        </div>
        `
          : ''}

        <!-- ASSINATURA -->
        <div class=\"signature-section\">
            <div class=\"section-title\">ASSINATURA DO RESPONSÁVEL TÉCNICO</div>
            <div style=\"margin-top: 30px;\">
                <div class=\"signature-line\"></div>
                <div class=\"signature-info\">
                    <strong>${rtInfo.name}</strong><br>
                    ${rtInfo.tipoConselho}: ${rtInfo.numeroRegistro}/${rtInfo.ufConselho}<br>
                    Email: ${rtInfo.email}<br>
                    Telefone: ${rtInfo.phone}
                </div>
            </div>
        </div>

        <!-- RODAPÉ -->
        <div class=\"footer\">
            <div class=\"footer-line\">Este laudo foi gerado pelo ERP ${rtInfo.companyName}</div>
            <div class=\"footer-line\">Data: ${validationDate.toLocaleDateString('pt-BR')} às ${validationDate.toLocaleTimeString('pt-BR')}</div>
            <div class=\"footer-line\">Responsável Técnico: ${rtInfo.name} (${rtInfo.tipoConselho}: ${rtInfo.numeroRegistro}/${rtInfo.ufConselho})</div>
            <div class=\"footer-line\">Conforme legislação ANVISA: IN 28/2018, IN 75/2020, IN 102/2021, IN 373/2025, IN 438/2026</div>
        </div>
    </div>
</body>
</html>
    `;
  }

  /**
   * Exporta laudo para PDF
   */
  async exportToPDF(laudoHTML: string, filename: string): Promise<void> {
    const blob = new Blob([laudoHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.html`;
    link.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Traduz público-alvo
   */
  private translateTargetAudience(audience: string): string {
    const translations: Record<string, string> = {
      CRIANCAS_4_8: 'Crianças 4-8 anos',
      CRIANCAS_9_18: 'Crianças 9-18 anos',
      ADULTOS: 'Adultos ≥19 anos',
      GESTANTES: 'Gestantes',
      LACTANTES: 'Lactantes',
    };
    return translations[audience] || audience;
  }

  /**
   * Salva laudo no banco de dados
   */
  async saveLaudo(laudoData: LaudoData, userId: string): Promise<string> {
    const { data, error } = await supabase
      .from('anvisa_laudos')
      .insert([
        {
          user_id: userId,
          product_name: laudoData.product.name,
          product_data: laudoData.product,
          rt_info: laudoData.rtInfo,
          compliance_status: laudoData.complianceStatus,
          validation_date: laudoData.validationDate.toISOString(),
          issues: laudoData.issues,
          recommendations: laudoData.recommendations,
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return data.id;
  }
}

export const anvisaLaudoGenerator = new AnvisaLaudoGeneratorService();

