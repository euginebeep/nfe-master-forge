/**
 * Gerador de Tabela Nutricional
 * 
 * Gera tabela nutricional no formato ANVISA pronto para inserir no rótulo
 * com validações, cálculos automáticos e relatório detalhado para RT
 */

import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Download, AlertCircle, CheckCircle2, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { ANVISA_LIMITS } from '@/lib/anvisa-limits';

interface NutritionalData {
  productName: string;
  servingSize: number;
  servingSizeUnit: string;
  servingsPerPackage: number;
  targetAudience: 'CRIANCAS_4_8' | 'CRIANCAS_9_18' | 'ADULTOS_19PLUS' | 'GESTANTES' | 'LACTANTES';
  constituents: Array<{
    name: string;
    dose: number;
    unit: string;
  }>;
}

interface NutritionalCalculation {
  constituent: string;
  dose: number;
  unit: string;
  anvisaLimit: any;
  percentageOfLimit: number;
  isCompliant: boolean;
  complianceStatus: 'OK' | 'WARNING' | 'ERROR';
  explanation: string;
}

interface NutritionalTableFormat {
  headerHTML: string;
  tableHTML: string;
  footerHTML: string;
  completeHTML: string;
  csvFormat: string;
  jsonFormat: string;
}

const NutritionalTableGenerator: React.FC = () => {
  const [formData, setFormData] = useState<NutritionalData>({
    productName: 'Exemplo de Suplemento',
    servingSize: 1,
    servingSizeUnit: 'cápsula',
    servingsPerPackage: 30,
    targetAudience: 'ADULTOS_19PLUS',
    constituents: [
      { name: 'GABA', dose: 100, unit: 'mg' },
      { name: 'Vitamina B12', dose: 2.4, unit: 'mcg' },
    ],
  });

  const [showReport, setShowReport] = useState(false);

  // Calcular conformidade de cada constituinte
  const calculations = useMemo<NutritionalCalculation[]>(() => {
    return formData.constituents.map((constituent) => {
      const anvisaLimit = ANVISA_LIMITS[constituent.name.toLowerCase().replace(/\s+/g, '_')];

      if (!anvisaLimit) {
        return {
          constituent: constituent.name,
          dose: constituent.dose,
          unit: constituent.unit,
          anvisaLimit: null,
          percentageOfLimit: 0,
          isCompliant: false,
          complianceStatus: 'ERROR',
          explanation: `❌ "${constituent.name}" não encontrado em ANVISA LIMITS. Verifique o nome ou adicione à base de dados.`,
        };
      }

      // Validar grupo populacional
      if (anvisaLimit.restrictedGroups?.includes(formData.targetAudience)) {
        return {
          constituent: constituent.name,
          dose: constituent.dose,
          unit: constituent.unit,
          anvisaLimit,
          percentageOfLimit: 0,
          isCompliant: false,
          complianceStatus: 'ERROR',
          explanation: `❌ "${constituent.name}" NÃO é permitido para ${formData.targetAudience}. Legislação: ${anvisaLimit.norm}`,
        };
      }

      // Validar dose mínima
      if (constituent.dose < anvisaLimit.min) {
        return {
          constituent: constituent.name,
          dose: constituent.dose,
          unit: constituent.unit,
          anvisaLimit,
          percentageOfLimit: (constituent.dose / anvisaLimit.min) * 100,
          isCompliant: false,
          complianceStatus: 'ERROR',
          explanation: `❌ Dose ${constituent.dose}${constituent.unit} está ABAIXO do mínimo permitido (${anvisaLimit.min}${anvisaLimit.unit}). Legislação: ${anvisaLimit.norm}`,
        };
      }

      // Validar dose máxima
      if (anvisaLimit.max && constituent.dose > anvisaLimit.max) {
        return {
          constituent: constituent.name,
          dose: constituent.dose,
          unit: constituent.unit,
          anvisaLimit,
          percentageOfLimit: (constituent.dose / anvisaLimit.max) * 100,
          isCompliant: false,
          complianceStatus: 'WARNING',
          explanation: `⚠️ Dose ${constituent.dose}${constituent.unit} está ACIMA do máximo permitido (${anvisaLimit.max}${anvisaLimit.unit}). Legislação: ${anvisaLimit.norm}`,
        };
      }

      // ✅ Conforme
      const percentage = anvisaLimit.max
        ? (constituent.dose / anvisaLimit.max) * 100
        : (constituent.dose / anvisaLimit.min) * 100;

      return {
        constituent: constituent.name,
        dose: constituent.dose,
        unit: constituent.unit,
        anvisaLimit,
        percentageOfLimit: percentage,
        isCompliant: true,
        complianceStatus: 'OK',
        explanation: `✅ Dose ${constituent.dose}${constituent.unit} está conforme. Intervalo permitido: ${anvisaLimit.min}${anvisaLimit.unit} - ${anvisaLimit.max ? anvisaLimit.max + anvisaLimit.unit : 'sem máximo'}. Legislação: ${anvisaLimit.norm}`,
      };
    });
  }, [formData]);

  // Gerar tabela nutricional em formato ANVISA
  const generateNutritionalTable = (): NutritionalTableFormat => {
    const headerHTML = `
      <div style="border: 2px solid #000; padding: 10px; font-family: Arial, sans-serif; width: 100%; max-width: 400px;">
        <div style="text-align: center; font-weight: bold; font-size: 14px; margin-bottom: 10px;">
          INFORMAÇÃO NUTRICIONAL
        </div>
        <div style="text-align: center; font-size: 12px; margin-bottom: 10px;">
          Porção: ${formData.servingSize} ${formData.servingSizeUnit}(s)
        </div>
    `;

    const tableRows = calculations
      .filter((calc) => calc.isCompliant)
      .map(
        (calc) => `
      <div style="display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #ccc; font-size: 11px;">
        <span>${calc.constituent}</span>
        <span>${calc.dose}${calc.unit}</span>
      </div>
    `
      )
      .join('');

    const tableHTML = `
      <div style="margin: 10px 0;">
        ${tableRows}
      </div>
    `;

    const footerHTML = `
      <div style="font-size: 10px; margin-top: 10px; text-align: center; color: #666;">
        <p>*% Valores de Referência não estabelecidos.</p>
        <p>Porções por embalagem: ${formData.servingsPerPackage}</p>
      </div>
      </div>
    `;

    const completeHTML = headerHTML + tableHTML + footerHTML;

    const csvFormat = [
      ['INFORMAÇÃO NUTRICIONAL'],
      [`Porção: ${formData.servingSize} ${formData.servingSizeUnit}(s)`],
      [''],
      ['Constituinte', 'Dose', 'Unidade'],
      ...calculations
        .filter((calc) => calc.isCompliant)
        .map((calc) => [calc.constituent, calc.dose, calc.unit]),
      [''],
      [`Porções por embalagem: ${formData.servingsPerPackage}`],
    ]
      .map((row) => row.join(','))
      .join('\n');

    const jsonFormat = JSON.stringify(
      {
        productName: formData.productName,
        servingSize: `${formData.servingSize} ${formData.servingSizeUnit}`,
        servingsPerPackage: formData.servingsPerPackage,
        constituents: calculations
          .filter((calc) => calc.isCompliant)
          .map((calc) => ({
            name: calc.constituent,
            dose: calc.dose,
            unit: calc.unit,
          })),
      },
      null,
      2
    );

    return {
      headerHTML,
      tableHTML,
      footerHTML,
      completeHTML,
      csvFormat,
      jsonFormat,
    };
  };

  const table = generateNutritionalTable();
  const hasErrors = calculations.some((calc) => calc.complianceStatus === 'ERROR');
  const hasWarnings = calculations.some((calc) => calc.complianceStatus === 'WARNING');
  const allCompliant = calculations.every((calc) => calc.isCompliant);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Gerador de Tabela Nutricional</h1>
        <p className="text-gray-600">Gera tabela nutricional conforme ANVISA pronta para inserir no rótulo</p>
      </div>

      {/* Status de Conformidade */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">{calculations.filter((c) => c.isCompliant).length}</div>
            <div className="text-sm text-gray-600">Conformes</div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-center">
            <div className="text-3xl font-bold text-yellow-600">{calculations.filter((c) => c.complianceStatus === 'WARNING').length}</div>
            <div className="text-sm text-gray-600">Avisos</div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-center">
            <div className="text-3xl font-bold text-red-600">{calculations.filter((c) => c.complianceStatus === 'ERROR').length}</div>
            <div className="text-sm text-gray-600">Erros</div>
          </div>
        </Card>
      </div>

      {/* Alertas */}
      {hasErrors && (
        <Alert className="border-red-500 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            ❌ Existem erros que impedem a geração da tabela. Corrija os problemas acima.
          </AlertDescription>
        </Alert>
      )}

      {hasWarnings && !hasErrors && (
        <Alert className="border-yellow-500 bg-yellow-50">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            ⚠️ Existem avisos. Revise antes de imprimir o rótulo.
          </AlertDescription>
        </Alert>
      )}

      {allCompliant && (
        <Alert className="border-green-500 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            ✅ Todos os constituintes estão conformes com ANVISA!
          </AlertDescription>
        </Alert>
      )}

      {/* Detalhes de Conformidade */}
      <Card className="p-6">
        <h2 className="text-xl font-bold mb-4">Detalhes de Conformidade</h2>
        <div className="space-y-4">
          {calculations.map((calc, idx) => (
            <div key={idx} className="border-l-4 pl-4 py-2" style={{
              borderColor: calc.complianceStatus === 'OK' ? '#22c55e' : calc.complianceStatus === 'WARNING' ? '#eab308' : '#ef4444',
            }}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold">{calc.constituent}</span>
                <Badge variant={calc.complianceStatus === 'OK' ? 'default' : calc.complianceStatus === 'WARNING' ? 'secondary' : 'destructive'}>
                  {calc.complianceStatus === 'OK' ? '✅ Conforme' : calc.complianceStatus === 'WARNING' ? '⚠️ Aviso' : '❌ Erro'}
                </Badge>
              </div>
              <p className="text-sm text-gray-700 mb-2">{calc.explanation}</p>
              {calc.anvisaLimit && (
                <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                  <p>📋 <strong>Legislação:</strong> {calc.anvisaLimit.norm}</p>
                  <p>📌 <strong>Observações:</strong> {calc.anvisaLimit.obs}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Abas de Visualização */}
      <Tabs defaultValue="preview" className="w-full">
        <TabsList>
          <TabsTrigger value="preview">Prévia do Rótulo</TabsTrigger>
          <TabsTrigger value="html">HTML</TabsTrigger>
          <TabsTrigger value="csv">CSV</TabsTrigger>
          <TabsTrigger value="json">JSON</TabsTrigger>
          <TabsTrigger value="report">Relatório RT</TabsTrigger>
        </TabsList>

        {/* Prévia do Rótulo */}
        <TabsContent value="preview" className="mt-4">
          <Card className="p-6">
            <div className="flex justify-center">
              <div dangerouslySetInnerHTML={{ __html: table.completeHTML }} />
            </div>
            <div className="mt-4 flex gap-2">
              <Button
                onClick={() => {
                  navigator.clipboard.writeText(table.completeHTML);
                  toast.success('HTML copiado para clipboard!');
                }}
              >
                <Copy className="w-4 h-4 mr-2" />
                Copiar HTML
              </Button>
              <Button
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = 'data:text/html,' + encodeURIComponent(table.completeHTML);
                  link.download = `tabela-nutricional-${formData.productName}.html`;
                  link.click();
                }}
              >
                <Download className="w-4 h-4 mr-2" />
                Baixar HTML
              </Button>
            </div>
          </Card>
        </TabsContent>

        {/* HTML */}
        <TabsContent value="html" className="mt-4">
          <Card className="p-6">
            <pre className="bg-gray-100 p-4 rounded overflow-auto text-xs">
              {table.completeHTML}
            </pre>
            <Button
              onClick={() => {
                navigator.clipboard.writeText(table.completeHTML);
                toast.success('HTML copiado!');
              }}
              className="mt-4"
            >
              <Copy className="w-4 h-4 mr-2" />
              Copiar
            </Button>
          </Card>
        </TabsContent>

        {/* CSV */}
        <TabsContent value="csv" className="mt-4">
          <Card className="p-6">
            <pre className="bg-gray-100 p-4 rounded overflow-auto text-xs">
              {table.csvFormat}
            </pre>
            <Button
              onClick={() => {
                navigator.clipboard.writeText(table.csvFormat);
                toast.success('CSV copiado!');
              }}
              className="mt-4"
            >
              <Copy className="w-4 h-4 mr-2" />
              Copiar
            </Button>
          </Card>
        </TabsContent>

        {/* JSON */}
        <TabsContent value="json" className="mt-4">
          <Card className="p-6">
            <pre className="bg-gray-100 p-4 rounded overflow-auto text-xs">
              {table.jsonFormat}
            </pre>
            <Button
              onClick={() => {
                navigator.clipboard.writeText(table.jsonFormat);
                toast.success('JSON copiado!');
              }}
              className="mt-4"
            >
              <Copy className="w-4 h-4 mr-2" />
              Copiar
            </Button>
          </Card>
        </TabsContent>

        {/* Relatório para RT */}
        <TabsContent value="report" className="mt-4">
          <Card className="p-6">
            <div className="space-y-4">
              <h3 className="text-lg font-bold">📋 Relatório Completo para RT</h3>
              <div className="bg-blue-50 border border-blue-200 p-4 rounded space-y-4">
                <div>
                  <h4 className="font-bold text-blue-900 mb-2">📌 Resumo Executivo</h4>
                  <p className="text-sm text-blue-800">
                    Este relatório apresenta a tabela nutricional do produto <strong>{formData.productName}</strong> conforme legislação ANVISA. A tabela foi gerada automaticamente com validações de conformidade.
                  </p>
                </div>

                <div>
                  <h4 className="font-bold text-blue-900 mb-2">✅ Status de Conformidade</h4>
                  <ul className="text-sm text-blue-800 list-disc list-inside space-y-1">
                    <li>Constituintes Conformes: <strong>{calculations.filter((c) => c.isCompliant).length}</strong></li>
                    <li>Avisos: <strong>{calculations.filter((c) => c.complianceStatus === 'WARNING').length}</strong></li>
                    <li>Erros: <strong>{calculations.filter((c) => c.complianceStatus === 'ERROR').length}</strong></li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-bold text-blue-900 mb-2">📊 Detalhes Técnicos</h4>
                  <table className="w-full text-xs text-blue-800 border-collapse">
                    <thead>
                      <tr className="bg-blue-100">
                        <th className="border p-2 text-left">Constituinte</th>
                        <th className="border p-2 text-left">Dose</th>
                        <th className="border p-2 text-left">Legislação</th>
                        <th className="border p-2 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {calculations.map((calc, idx) => (
                        <tr key={idx} className={calc.complianceStatus === 'OK' ? 'bg-green-50' : calc.complianceStatus === 'WARNING' ? 'bg-yellow-50' : 'bg-red-50'}>
                          <td className="border p-2">{calc.constituent}</td>
                          <td className="border p-2">{calc.dose}{calc.unit}</td>
                          <td className="border p-2 text-xs">{calc.anvisaLimit?.norm || 'N/A'}</td>
                          <td className="border p-2">
                            {calc.complianceStatus === 'OK' ? '✅' : calc.complianceStatus === 'WARNING' ? '⚠️' : '❌'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div>
                  <h4 className="font-bold text-blue-900 mb-2">🔍 Observações Importantes para RT Inexperiente</h4>
                  <ul className="text-sm text-blue-800 list-disc list-inside space-y-2">
                    <li><strong>Conformidade ANVISA:</strong> Todos os constituintes foram validados conforme Instruções Normativas (INs) vigentes.</li>
                    <li><strong>Dose Mínima:</strong> Cada constituinte tem uma dose mínima estabelecida por lei. Abaixo disso, o produto não pode ser comercializado.</li>
                    <li><strong>Dose Máxima:</strong> Alguns constituintes têm limite máximo. Acima disso, o produto é considerado não conforme.</li>
                    <li><strong>Grupo Populacional:</strong> Alguns constituintes são proibidos para gestantes, lactantes ou crianças. Verifique as restrições.</li>
                    <li><strong>Tabela Nutricional:</strong> A tabela acima está pronta para ser inserida no rótulo do produto.</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-bold text-blue-900 mb-2">📝 Próximos Passos</h4>
                  <ol className="text-sm text-blue-800 list-decimal list-inside space-y-1">
                    <li>Revisar conformidade acima</li>
                    <li>Copiar tabela nutricional (aba "Prévia do Rótulo")</li>
                    <li>Inserir no design do rótulo</li>
                    <li>Solicitar aprovação de RT</li>
                    <li>Enviar para impressão</li>
                  </ol>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default NutritionalTableGenerator;

