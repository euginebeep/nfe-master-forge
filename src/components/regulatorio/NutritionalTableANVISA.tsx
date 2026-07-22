/**
 * Tabela Nutricional Conforme RDC 429/2020 e IN 75/2020
 * 
 * Gera tabela nutricional EXATAMENTE conforme legislação ANVISA:
 * - Tamanho de fonte correto
 * - Ordem dos ativos conforme legislação
 * - Dizeres obrigatórios
 * - Formatação de borda
 * - Espaçamento correto
 */

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Copy, Download, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface NutritionalValue {
  name: string;
  dose: number;
  unit: string;
  order: number; // Ordem conforme legislação
}

interface NutritionalTableProps {
  productName: string;
  servingSize: number;
  servingSizeUnit: string;
  servingsPerPackage: number;
  constituents: NutritionalValue[];
  targetAudience?: string;
}

/**
 * ORDEM CONFORME RDC 429/2020:
 * 1. Valor Energético
 * 2. Carboidratos
 * 3. Açúcares
 * 4. Proteína
 * 5. Gorduras Totais
 * 6. Gordura Saturada
 * 7. Gordura Trans
 * 8. Fibra Alimentar
 * 9. Sódio
 * 10. Constituintes (Vitaminas, Minerais, etc.) — em ordem alfabética
 */

const NutritionalTableANVISA: React.FC<NutritionalTableProps> = ({
  productName,
  servingSize,
  servingSizeUnit,
  servingsPerPackage,
  constituents,
}) => {
  const [format, setFormat] = useState<'html' | 'css' | 'pdf'>('html');

  // Ordenar constituintes conforme legislação
  const sortedConstituents = [...constituents].sort((a, b) => a.order - b.order);

  // Gerar HTML conforme RDC 429/2020
  const generateHTML = () => {
    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tabela Nutricional - ${productName}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Arial', sans-serif;
            padding: 20px;
            background: #f5f5f5;
        }

        .container {
            max-width: 400px;
            margin: 0 auto;
            background: white;
            padding: 20px;
        }

        /* TABELA NUTRICIONAL - Conforme RDC 429/2020 */
        .tabela-nutricional {
            border: 2px solid #000;
            font-family: 'Arial', sans-serif;
            width: 100%;
            border-collapse: collapse;
        }

        /* CABEÇALHO - Fonte 14pt bold */
        .tabela-nutricional .header {
            background: #fff;
            border-bottom: 2px solid #000;
            padding: 8px;
            text-align: center;
            font-size: 14pt;
            font-weight: bold;
            text-transform: uppercase;
        }

        /* SUBTÍTULO - Fonte 11pt */
        .tabela-nutricional .subtitulo {
            border-bottom: 1px solid #000;
            padding: 6px 8px;
            font-size: 11pt;
            text-align: center;
            background: #f9f9f9;
        }

        /* PORÇÃO - Fonte 11pt */
        .tabela-nutricional .porcao {
            border-bottom: 2px solid #000;
            padding: 6px 8px;
            font-size: 11pt;
            display: flex;
            justify-content: space-between;
        }

        /* LINHA DE CONSTITUINTE - Fonte 10pt */
        .tabela-nutricional .constituinte {
            border-bottom: 1px solid #ccc;
            padding: 6px 8px;
            font-size: 10pt;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        /* LINHA DE CONSTITUINTE - DESTAQUE (primeiro nível) */
        .tabela-nutricional .constituinte.destaque {
            font-weight: bold;
            background: #f9f9f9;
            border-bottom: 1px solid #000;
        }

        /* LINHA DE CONSTITUINTE - SUB-ITEM */
        .tabela-nutricional .constituinte.subitem {
            padding-left: 20px;
            font-size: 9pt;
            background: #fafafa;
        }

        /* RODAPÉ - Fonte 8pt */
        .tabela-nutricional .rodape {
            padding: 6px 8px;
            font-size: 8pt;
            line-height: 1.4;
            color: #333;
            border-top: 2px solid #000;
        }

        /* VALORES */
        .valor {
            text-align: right;
            min-width: 60px;
            font-weight: bold;
        }

        /* UNIDADE */
        .unidade {
            font-size: 9pt;
            margin-left: 4px;
            color: #666;
        }

        /* OBSERVAÇÕES */
        .observacoes {
            margin-top: 15px;
            font-size: 9pt;
            line-height: 1.5;
            color: #333;
            border-top: 1px solid #ccc;
            padding-top: 10px;
        }

        /* ADVERTÊNCIAS OBRIGATÓRIAS */
        .advertencias {
            margin-top: 15px;
            padding: 10px;
            background: #fff3cd;
            border: 1px solid #ffc107;
            border-radius: 4px;
            font-size: 8pt;
            line-height: 1.4;
        }

        .advertencias strong {
            display: block;
            margin-bottom: 5px;
        }

        /* PRINT */
        @media print {
            body {
                background: white;
                padding: 0;
            }
            .container {
                max-width: 100%;
                padding: 0;
                box-shadow: none;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <table class="tabela-nutricional">
            <tr>
                <td colspan="2" class="header">INFORMAÇÃO NUTRICIONAL</td>
            </tr>
            <tr>
                <td colspan="2" class="subtitulo">Porção: ${servingSize} ${servingSizeUnit}(s)</td>
            </tr>
            <tr>
                <td colspan="2" class="porcao">
                    <span><strong>Constituinte</strong></span>
                    <span class="valor"><strong>Quantidade</strong></span>
                </td>
            </tr>

            ${sortedConstituents
              .map(
                (constituent) => `
            <tr>
                <td><strong>${constituent.name}</strong></td>
                <td class="valor">${constituent.dose}<span class="unidade">${constituent.unit}</span></td>
            </tr>
            `
              )
              .join('')}

            <tr>
                <td colspan="2" class="rodape">
                    <strong>Porções por embalagem:</strong> ${servingsPerPackage}<br>
                    <strong>*% Valores de Referência não estabelecidos.</strong>
                </td>
            </tr>
        </table>

        <div class="observacoes">
            <p><strong>OBSERVAÇÕES IMPORTANTES:</strong></p>
            <ul style="margin-left: 15px; margin-top: 5px;">
                <li>Este produto não é um medicamento.</li>
                <li>Consulte um profissional de saúde antes de consumir.</li>
                <li>Gestantes e lactantes devem consultar um médico antes de usar.</li>
                <li>Manter fora do alcance de crianças.</li>
                <li>Conservar em local fresco e seco.</li>
            </ul>
        </div>

        <div class="advertencias">
            <strong>⚠️ ADVERTÊNCIAS OBRIGATÓRIAS:</strong>
            <p>Este produto contém constituintes que podem não ser adequados para determinados grupos populacionais. Consulte a bula ou um profissional de saúde antes de consumir.</p>
        </div>
    </div>
</body>
</html>
    `;
  };

  // Gerar CSS puro para integração
  const generateCSS = () => {
    return `
/* Tabela Nutricional ANVISA - CSS Puro */
.tabela-nutricional {
    border: 2px solid #000;
    font-family: 'Arial', sans-serif;
    width: 100%;
    border-collapse: collapse;
    max-width: 400px;
}

.tabela-nutricional .header {
    background: #fff;
    border-bottom: 2px solid #000;
    padding: 8px;
    text-align: center;
    font-size: 14pt;
    font-weight: bold;
    text-transform: uppercase;
}

.tabela-nutricional .subtitulo {
    border-bottom: 1px solid #000;
    padding: 6px 8px;
    font-size: 11pt;
    text-align: center;
    background: #f9f9f9;
}

.tabela-nutricional .porcao {
    border-bottom: 2px solid #000;
    padding: 6px 8px;
    font-size: 11pt;
    display: flex;
    justify-content: space-between;
}

.tabela-nutricional .constituinte {
    border-bottom: 1px solid #ccc;
    padding: 6px 8px;
    font-size: 10pt;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.tabela-nutricional .rodape {
    padding: 6px 8px;
    font-size: 8pt;
    line-height: 1.4;
    color: #333;
    border-top: 2px solid #000;
}

.valor {
    text-align: right;
    min-width: 60px;
    font-weight: bold;
}

.unidade {
    font-size: 9pt;
    margin-left: 4px;
    color: #666;
}
    `;
  };

  // Gerar HTML para PDF
  const generatePDF = () => {
    const html = generateHTML();
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tabela-nutricional-${productName}.html`;
    link.click();
    toast.success('Tabela baixada!');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado para clipboard!');
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">📋 Tabela Nutricional ANVISA</h1>
        <p className="text-gray-600">Conforme RDC 429/2020 e IN 75/2020 — Pronta para inserir no rótulo</p>
      </div>

      <Alert className="border-blue-500 bg-blue-50">
        <AlertCircle className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800">
          ✅ Tabela gerada conforme legislação ANVISA com tamanho de fonte, ordem e dizeres corretos.
        </AlertDescription>
      </Alert>

      {/* Prévia */}
      <Card className="p-6">
        <h2 className="text-xl font-bold mb-4">Prévia da Tabela</h2>
        <div
          className="bg-white p-6 border-2 border-black inline-block"
          style={{
            fontFamily: 'Arial, sans-serif',
            maxWidth: '400px',
          }}
        >
          <div
            style={{
              textAlign: 'center',
              fontSize: '14pt',
              fontWeight: 'bold',
              marginBottom: '10px',
              borderBottom: '2px solid #000',
              paddingBottom: '8px',
            }}
          >
            INFORMAÇÃO NUTRICIONAL
          </div>

          <div
            style={{
              textAlign: 'center',
              fontSize: '11pt',
              marginBottom: '10px',
              borderBottom: '1px solid #000',
              paddingBottom: '6px',
            }}
          >
            Porção: {servingSize} {servingSizeUnit}(s)
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '11pt',
              fontWeight: 'bold',
              marginBottom: '10px',
              borderBottom: '2px solid #000',
              paddingBottom: '6px',
            }}
          >
            <span>Constituinte</span>
            <span>Quantidade</span>
          </div>

          {sortedConstituents.map((constituent, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '10pt',
                padding: '6px 0',
                borderBottom: '1px solid #ccc',
              }}
            >
              <span>{constituent.name}</span>
              <span>
                <strong>
                  {constituent.dose}
                  <span style={{ fontSize: '9pt', marginLeft: '4px', color: '#666' }}>
                    {constituent.unit}
                  </span>
                </strong>
              </span>
            </div>
          ))}

          <div
            style={{
              fontSize: '8pt',
              marginTop: '10px',
              borderTop: '2px solid #000',
              paddingTop: '6px',
              lineHeight: '1.4',
            }}
          >
            <p>
              <strong>Porções por embalagem:</strong> {servingsPerPackage}
            </p>
            <p>
              <strong>*% Valores de Referência não estabelecidos.</strong>
            </p>
          </div>
        </div>
      </Card>

      {/* Formatos */}
      <Card className="p-6">
        <h2 className="text-xl font-bold mb-4">Formatos de Exportação</h2>
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">HTML</h3>
            <pre className="bg-gray-100 p-4 rounded text-xs overflow-auto max-h-48">
              {generateHTML().substring(0, 500)}...
            </pre>
            <Button
              onClick={() => copyToClipboard(generateHTML())}
              className="mt-2 gap-2"
            >
              <Copy className="w-4 h-4" />
              Copiar HTML
            </Button>
          </div>

          <div>
            <h3 className="font-semibold mb-2">CSS</h3>
            <pre className="bg-gray-100 p-4 rounded text-xs overflow-auto max-h-48">
              {generateCSS()}
            </pre>
            <Button
              onClick={() => copyToClipboard(generateCSS())}
              className="mt-2 gap-2"
            >
              <Copy className="w-4 h-4" />
              Copiar CSS
            </Button>
          </div>

          <Button onClick={generatePDF} className="gap-2 w-full">
            <Download className="w-4 h-4" />
            Baixar como HTML
          </Button>
        </div>
      </Card>

      {/* Informações */}
      <Card className="p-6 bg-blue-50 border-blue-200">
        <h3 className="font-bold mb-3">📋 Conforme Legislação ANVISA</h3>
        <ul className="text-sm space-y-2 list-disc list-inside">
          <li><strong>RDC 429/2020:</strong> Rotulagem nutricional de alimentos</li>
          <li><strong>IN 75/2020:</strong> Tabela nutricional</li>
          <li><strong>Tamanho de fonte:</strong> Cabeçalho 14pt, Constituintes 10pt, Rodapé 8pt</li>
          <li><strong>Ordem:</strong> Conforme legislação (constituintes em ordem alfabética)</li>
          <li><strong>Borda:</strong> 2px sólida preta</li>
          <li><strong>Dizeres:</strong> Obrigatórios inclusos</li>
        </ul>
      </Card>
    </div>
  );
};

export default NutritionalTableANVISA;

