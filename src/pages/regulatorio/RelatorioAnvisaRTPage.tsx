/**
 * Página de Relatório ANVISA para RT Inexperiente
 * 
 * Apresenta informações completas sobre conformidade ANVISA
 * com explicações detalhadas para RT sem experiência
 */

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BookOpen, AlertCircle, CheckCircle2, HelpCircle, Download, FileText } from 'lucide-react';
import { toast } from 'sonner';

const RelatorioAnvisaRTPage: React.FC = () => {
  const [expandedSection, setExpandedSection] = useState<string | null>('introducao');

  const sections = [
    {
      id: 'introducao',
      title: '📚 Introdução — O que é ANVISA?',
      icon: BookOpen,
      content: `
        <div class="space-y-4">
          <p><strong>ANVISA</strong> é a Agência Nacional de Vigilância Sanitária, órgão do governo brasileiro responsável por regulamentar e fiscalizar produtos de saúde, incluindo suplementos alimentares.</p>
          
          <p>A ANVISA estabelece regras sobre:</p>
          <ul class="list-disc list-inside space-y-2 ml-4">
            <li><strong>Quais constituintes</strong> (ingredientes) podem ser usados em suplementos</li>
            <li><strong>Dose mínima e máxima</strong> de cada constituinte</li>
            <li><strong>Quem pode consumir</strong> (crianças, gestantes, adultos, etc.)</li>
            <li><strong>Como apresentar</strong> a informação nutricional no rótulo</li>
            <li><strong>Advertências obrigatórias</strong> que devem constar no rótulo</li>
          </ul>

          <p class="bg-blue-50 p-3 rounded border border-blue-200"><strong>💡 Dica:</strong> A ANVISA publica suas regras em documentos chamados <strong>INs (Instruções Normativas)</strong> e <strong>RDCs (Resoluções)</strong>. Esses documentos são atualizados regularmente.</p>
        </div>
      `,
    },
    {
      id: 'constituintes',
      title: '🧪 O que são Constituintes?',
      icon: HelpCircle,
      content: `
        <div class="space-y-4">
          <p><strong>Constituintes</strong> são os ingredientes ativos do suplemento. Exemplos:</p>
          <ul class="list-disc list-inside space-y-2 ml-4">
            <li><strong>GABA</strong> — Aminoácido que ajuda no relaxamento</li>
            <li><strong>Vitamina B12</strong> — Essencial para energia</li>
            <li><strong>Curcumina</strong> — Composto anti-inflamatório</li>
            <li><strong>Colageno Tipo 2</strong> — Proteína para articulações</li>
          </ul>

          <p class="bg-yellow-50 p-3 rounded border border-yellow-200"><strong>⚠️ Importante:</strong> Nem todos os ingredientes podem ser usados em suplementos. Apenas aqueles aprovados pela ANVISA.</p>

          <p><strong>Cada constituinte tem regras específicas:</strong></p>
          <ul class="list-disc list-inside space-y-2 ml-4">
            <li><strong>Dose Mínima:</strong> Quantidade mínima que deve ter no produto</li>
            <li><strong>Dose Máxima:</strong> Quantidade máxima permitida</li>
            <li><strong>Grupos Permitidos:</strong> Quem pode consumir (crianças, adultos, gestantes)</li>
            <li><strong>Grupos Proibidos:</strong> Quem NÃO pode consumir</li>
            <li><strong>Restrições:</strong> Não pode ser combinado com outros constituintes</li>
          </ul>
        </div>
      `,
    },
    {
      id: 'doses',
      title: '📏 Entendendo Doses Mínimas e Máximas',
      icon: AlertCircle,
      content: `
        <div class="space-y-4">
          <p><strong>Dose Mínima:</strong> É a quantidade MÍNIMA que o constituinte deve ter para ser eficaz.</p>
          <div class="bg-green-50 p-3 rounded border border-green-200">
            <p><strong>Exemplo:</strong> GABA tem dose mínima de 50mg</p>
            <p>Isso significa:</p>
            <ul class="list-disc list-inside ml-4">
              <li>✅ 50mg — OK, conforme</li>
              <li>✅ 100mg — OK, conforme</li>
              <li>❌ 25mg — NÃO CONFORME, abaixo do mínimo</li>
            </ul>
          </div>

          <p><strong>Dose Máxima:</strong> É a quantidade MÁXIMA permitida por segurança.</p>
          <div class="bg-red-50 p-3 rounded border border-red-200">
            <p><strong>Exemplo:</strong> Curcumina tem dose máxima de 130mg</p>
            <p>Isso significa:</p>
            <ul class="list-disc list-inside ml-4">
              <li>✅ 80mg — OK, conforme</li>
              <li>✅ 130mg — OK, conforme (no limite)</li>
              <li>❌ 200mg — NÃO CONFORME, acima do máximo</li>
            </ul>
          </div>

          <p class="bg-blue-50 p-3 rounded border border-blue-200"><strong>💡 Dica:</strong> Se um constituinte não tem dose máxima especificada, significa que a ANVISA não estabeleceu limite máximo (apenas mínimo).</p>
        </div>
      `,
    },
    {
      id: 'grupos',
      title: '👥 Grupos Populacionais — Quem Pode Consumir?',
      icon: HelpCircle,
      content: `
        <div class="space-y-4">
          <p>Nem todos os constituintes são permitidos para todos. A ANVISA classifica em grupos:</p>
          
          <div class="space-y-3">
            <div class="bg-blue-50 p-3 rounded border border-blue-200">
              <p><strong>👶 Crianças 4-8 anos</strong></p>
              <p class="text-sm mt-1">Alguns constituintes são permitidos apenas para crianças maiores. Exemplo: Bacillus coagulans é permitido a partir de 4 anos.</p>
            </div>

            <div class="bg-purple-50 p-3 rounded border border-purple-200">
              <p><strong>👧 Crianças 9-18 anos</strong></p>
              <p class="text-sm mt-1">Faixa etária intermediária com regras específicas.</p>
            </div>

            <div class="bg-green-50 p-3 rounded border border-green-200">
              <p><strong>👨 Adultos ≥19 anos</strong></p>
              <p class="text-sm mt-1">Maioria dos constituintes é permitida para adultos.</p>
            </div>

            <div class="bg-pink-50 p-3 rounded border border-pink-200">
              <p><strong>🤰 Gestantes</strong></p>
              <p class="text-sm mt-1">Muitos constituintes são PROIBIDOS para gestantes por segurança do bebê. Exemplo: GABA é proibido para gestantes.</p>
            </div>

            <div class="bg-orange-50 p-3 rounded border border-orange-200">
              <p><strong>🍼 Lactantes</strong></p>
              <p class="text-sm mt-1">Algumas restrições também se aplicam a mães que estão amamentando.</p>
            </div>
          </div>

          <p class="bg-red-50 p-3 rounded border border-red-200"><strong>⚠️ Crítico:</strong> Se um constituinte é proibido para um grupo, o produto NÃO pode ser vendido para esse grupo. A embalagem deve ter advertência clara.</p>
        </div>
      `,
    },
    {
      id: 'restricoes',
      title: '🚫 Restrições de Associação',
      icon: AlertCircle,
      content: `
        <div class="space-y-4">
          <p>Alguns constituintes <strong>NÃO PODEM SER COMBINADOS</strong> no mesmo produto.</p>
          
          <div class="bg-red-50 p-3 rounded border border-red-200">
            <p><strong>Exemplo: Curcumina + Tetraidrocurcuminoides</strong></p>
            <p class="text-sm mt-2">Segundo IN 438/2026, esses dois constituintes NÃO podem estar no mesmo produto.</p>
            <p class="text-sm mt-2">Isso significa:</p>
            <ul class="list-disc list-inside ml-4 text-sm">
              <li>✅ Produto com APENAS Curcumina — OK</li>
              <li>✅ Produto com APENAS Tetraidrocurcuminoides — OK</li>
              <li>❌ Produto com AMBOS — NÃO CONFORME</li>
            </ul>
          </div>

          <p class="bg-blue-50 p-3 rounded border border-blue-200"><strong>💡 Dica:</strong> O sistema ANVISA Checker bloqueia automaticamente essas combinações proibidas.</p>
        </div>
      `,
    },
    {
      id: 'legislacao',
      title: '📋 Legislações Vigentes',
      icon: FileText,
      content: `
        <div class="space-y-4">
          <p>A ANVISA publica suas regras em documentos chamados <strong>INs (Instruções Normativas)</strong>. As principais são:</p>
          
          <div class="space-y-2">
            <div class="bg-gray-50 p-3 rounded border border-gray-200">
              <p><strong>IN 28/2018</strong> — Lista de constituintes permitidos e seus limites</p>
              <p class="text-sm text-gray-600 mt-1">Documento base que lista todos os constituintes autorizados</p>
            </div>

            <div class="bg-gray-50 p-3 rounded border border-gray-200">
              <p><strong>IN 75/2020</strong> — Rotulagem nutricional</p>
              <p class="text-sm text-gray-600 mt-1">Como apresentar a informação nutricional no rótulo</p>
            </div>

            <div class="bg-gray-50 p-3 rounded border border-gray-200">
              <p><strong>IN 102/2021</strong> — Colageno</p>
              <p class="text-sm text-gray-600 mt-1">Regras específicas para colageno (dose mínima 40mg)</p>
            </div>

            <div class="bg-gray-50 p-3 rounded border border-gray-200">
              <p><strong>IN 373/2025</strong> — Novos constituintes (GABA, Probióticos, etc.)</p>
              <p class="text-sm text-gray-600 mt-1">Constituintes aprovados recentemente</p>
            </div>

            <div class="bg-gray-50 p-3 rounded border border-gray-200">
              <p><strong>IN 438/2026</strong> — Curcumina e Tetraidrocurcuminoides</p>
              <p class="text-sm text-gray-600 mt-1">Regras mais recentes (Abril 2026)</p>
            </div>
          </div>

          <p class="bg-blue-50 p-3 rounded border border-blue-200"><strong>💡 Dica:</strong> O sistema ANVISA Checker monitora automaticamente essas legislações e atualiza os limites.</p>
        </div>
      `,
    },
    {
      id: 'checklist',
      title: '✅ Checklist para RT',
      icon: CheckCircle2,
      content: `
        <div class="space-y-4">
          <p>Antes de aprovar um produto, verifique:</p>
          
          <div class="space-y-3">
            <div class="flex items-start gap-3">
              <input type="checkbox" class="mt-1" />
              <div>
                <p><strong>1. Constituinte existe em ANVISA?</strong></p>
                <p class="text-sm text-gray-600">Verificar se o constituinte está na lista de permitidos</p>
              </div>
            </div>

            <div class="flex items-start gap-3">
              <input type="checkbox" class="mt-1" />
              <div>
                <p><strong>2. Dose está dentro dos limites?</strong></p>
                <p class="text-sm text-gray-600">Verificar se dose ≥ mínimo e ≤ máximo</p>
              </div>
            </div>

            <div class="flex items-start gap-3">
              <input type="checkbox" class="mt-1" />
              <div>
                <p><strong>3. É permitido para o grupo-alvo?</strong></p>
                <p class="text-sm text-gray-600">Verificar se não é proibido para gestantes, crianças, etc.</p>
              </div>
            </div>

            <div class="flex items-start gap-3">
              <input type="checkbox" class="mt-1" />
              <div>
                <p><strong>4. Não tem restrição de associação?</strong></p>
                <p class="text-sm text-gray-600">Verificar se não está combinado com constituinte proibido</p>
              </div>
            </div>

            <div class="flex items-start gap-3">
              <input type="checkbox" class="mt-1" />
              <div>
                <p><strong>5. Tabela nutricional está correta?</strong></p>
                <p class="text-sm text-gray-600">Verificar se valores batem com o produto</p>
              </div>
            </div>

            <div class="flex items-start gap-3">
              <input type="checkbox" class="mt-1" />
              <div>
                <p><strong>6. Advertências obrigatórias estão no rótulo?</strong></p>
                <p class="text-sm text-gray-600">Verificar se tem avisos necessários (ex: gestantes não devem consumir)</p>
              </div>
            </div>
          </div>

          <p class="bg-green-50 p-3 rounded border border-green-200"><strong>✅ Se tudo estiver OK:</strong> Produto está conforme e pode ser aprovado!</p>
          <p class="bg-red-50 p-3 rounded border border-red-200"><strong>❌ Se algo não estiver OK:</strong> Devolver para correção antes de aprovar.</p>
        </div>
      `,
    },
    {
      id: 'erros-comuns',
      title: '⚠️ Erros Comuns a Evitar',
      icon: AlertCircle,
      content: `
        <div class="space-y-4">
          <div class="bg-red-50 p-3 rounded border border-red-200">
            <p><strong>❌ Erro 1: Dose abaixo do mínimo</strong></p>
            <p class="text-sm mt-1">Exemplo: GABA com 25mg (mínimo é 50mg)</p>
            <p class="text-sm mt-1 text-red-700">Consequência: Produto não conforme, pode ser apreendido</p>
          </div>

          <div class="bg-red-50 p-3 rounded border border-red-200">
            <p><strong>❌ Erro 2: Usar constituinte proibido para grupo-alvo</strong></p>
            <p class="text-sm mt-1">Exemplo: GABA para gestantes (proibido)</p>
            <p class="text-sm mt-1 text-red-700">Consequência: Multa pesada, apreensão de produto</p>
          </div>

          <div class="bg-red-50 p-3 rounded border border-red-200">
            <p><strong>❌ Erro 3: Combinar constituintes proibidos</strong></p>
            <p class="text-sm mt-1">Exemplo: Curcumina + Tetraidrocurcuminoides</p>
            <p class="text-sm mt-1 text-red-700">Consequência: Produto não conforme</p>
          </div>

          <div class="bg-red-50 p-3 rounded border border-red-200">
            <p><strong>❌ Erro 4: Tabela nutricional com valores errados</strong></p>
            <p class="text-sm mt-1">Exemplo: Tabela diz 100mg, mas produto tem 50mg</p>
            <p class="text-sm mt-1 text-red-700">Consequência: Fraude, multa pesada</p>
          </div>

          <div class="bg-red-50 p-3 rounded border border-red-200">
            <p><strong>❌ Erro 5: Falta de advertências obrigatórias</strong></p>
            <p class="text-sm mt-1">Exemplo: Produto com GABA mas não avisa que gestantes não devem consumir</p>
            <p class="text-sm mt-1 text-red-700">Consequência: Multa, apreensão</p>
          </div>
        </div>
      `,
    },
  ];

  const generatePDF = () => {
    const content = sections
      .map(
        (section) => `
      <h2>${section.title}</h2>
      ${section.content}
    `
      )
      .join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Relatório ANVISA para RT</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { color: #333; border-bottom: 3px solid #0066cc; padding-bottom: 10px; }
          h2 { color: #0066cc; margin-top: 30px; }
          p { line-height: 1.6; }
          ul { margin-left: 20px; }
          .warning { background: #fff3cd; padding: 10px; border-left: 4px solid #ffc107; margin: 10px 0; }
          .success { background: #d4edda; padding: 10px; border-left: 4px solid #28a745; margin: 10px 0; }
          .error { background: #f8d7da; padding: 10px; border-left: 4px solid #dc3545; margin: 10px 0; }
          table { width: 100%; border-collapse: collapse; margin: 10px 0; }
          th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
          th { background: #f5f5f5; }
        </style>
      </head>
      <body>
        <h1>📋 Relatório Completo ANVISA para RT</h1>
        <p>Data: ${new Date().toLocaleDateString('pt-BR')}</p>
        ${content}
      </body>
      </html>
    `;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Relatorio-ANVISA-RT-${new Date().toISOString().split('T')[0]}.html`;
    a.click();
    toast.success('Relatório baixado!');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">📋 Relatório Completo ANVISA para RT</h1>
          <p className="text-gray-600 text-lg">Guia completo com explicações para Responsáveis Técnicos inexperientes</p>
        </div>

        {/* Alert */}
        <Alert className="mb-6 border-blue-500 bg-blue-50">
          <BookOpen className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            Este relatório foi desenvolvido para ajudar RTs a entender conformidade ANVISA. Leia com atenção e use como referência.
          </AlertDescription>
        </Alert>

        {/* Botão Download */}
        <div className="mb-6">
          <Button onClick={generatePDF} className="gap-2">
            <Download className="w-4 h-4" />
            Baixar Relatório Completo (PDF)
          </Button>
        </div>

        {/* Conteúdo */}
        <div className="space-y-4">
          {sections.map((section) => {
            const Icon = section.icon;
            const isExpanded = expandedSection === section.id;

            return (
              <Card key={section.id} className="overflow-hidden">
                <button
                  onClick={() => setExpandedSection(isExpanded ? null : section.id)}
                  className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition"
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-5 h-5 text-blue-600" />
                    <h2 className="text-lg font-semibold text-gray-900">{section.title}</h2>
                  </div>
                  <span className="text-2xl">{isExpanded ? '▼' : '▶'}</span>
                </button>

                {isExpanded && (
                  <div className="p-4 bg-white border-t">
                    <div
                      dangerouslySetInnerHTML={{
                        __html: section.content
                          .replace(/\n/g, '')
                          .replace(/<ul/g, '<ul class="space-y-2"')
                          .replace(/<li/g, '<li class="ml-4"'),
                      }}
                    />
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-8 p-6 bg-white rounded-lg border">
          <h3 className="font-bold text-gray-900 mb-3">📞 Dúvidas Frequentes</h3>
          <div className="space-y-3 text-sm text-gray-700">
            <p><strong>P: O que fazer se um constituinte não está na lista?</strong></p>
            <p className="ml-4">R: Contate a ANVISA ou consulte a legislação mais recente. O sistema ANVISA Checker atualiza automaticamente.</p>

            <p><strong>P: Posso usar dose menor se o produto for mais barato?</strong></p>
            <p className="ml-4">R: NÃO. A dose mínima é obrigatória por lei. Produto com dose menor é não conforme.</p>

            <p><strong>P: Gestantes podem consumir qualquer suplemento?</strong></p>
            <p className="ml-4">R: NÃO. Muitos constituintes são proibidos para gestantes. Sempre verificar as restrições.</p>

            <p><strong>P: Como saber se meu produto está conforme?</strong></p>
            <p className="ml-4">R: Use o ANVISA Checker. Ele valida automaticamente todos os constituintes.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RelatorioAnvisaRTPage;

