// ============================================================
// OP DOCUMENTO COMPLETO - VERSÃO PROFISSIONAL A4
// Inclui todas as etapas: Separação, Pesagem, Mistura, etc.
// ============================================================

import { useRef, useState } from 'react';
import { 
  Printer, FileText, Package, Scale, FlaskConical, 
  Factory, Pill, Tag, ClipboardCheck, Terminal
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OPFolhaSeparacao } from './OPFolhaSeparacao';
import { OPFolhaPesagem } from './OPFolhaPesagem';
import { OPFolhaMistura } from './OPFolhaMistura';
import { OPFolhaEncapsulamento } from './OPFolhaEncapsulamento';
import { OPFolhaEmbalagem } from './OPFolhaEmbalagem';
import { OPFolhaChecklist } from './OPFolhaChecklist';
import { getOPPrintStyles, getTerminalPrintStyles } from './op-print-styles';

interface OPDocumentoCompletoProps {
  op: any;
  materiasPrimas?: any[];
  embalagens?: any[];
  checklist?: any[];
}

export function OPDocumentoCompleto({ 
  op, 
  materiasPrimas = [], 
  embalagens = [],
  checklist = []
}: OPDocumentoCompletoProps) {
  const [activeTab, setActiveTab] = useState('separacao');
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrintSection = (sectionId: string) => {
    const section = document.getElementById(sectionId);
    if (!section) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>OP ${op.codigo} - ${getSectionTitle(sectionId)}</title>
          <style>${getOPPrintStyles()}</style>
        </head>
        <body>
          ${section.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  // Impressão Terminal P&B - Versão detalhada sem cores
  const handlePrintTerminal = (sectionId: string) => {
    const section = document.getElementById(sectionId);
    if (!section) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>OP ${op.codigo} - ${getSectionTitle(sectionId)} [TERMINAL]</title>
          <style>${getTerminalPrintStyles()}</style>
        </head>
        <body class="terminal-mode">
          <div class="terminal-header">
            <div class="terminal-title">═══════════════════════════════════════════════════════════════</div>
            <div class="terminal-title">  ORDEM DE PRODUÇÃO: ${op.codigo}</div>
            <div class="terminal-title">  SEÇÃO: ${getSectionTitle(sectionId).toUpperCase()}</div>
            <div class="terminal-title">  LOTE: ${op.lote_produto_acabado || '-'}</div>
            <div class="terminal-title">  DATA: ${new Date().toLocaleString('pt-BR')}</div>
            <div class="terminal-title">═══════════════════════════════════════════════════════════════</div>
          </div>
          ${section.innerHTML}
          <div class="terminal-footer">
            <div>───────────────────────────────────────────────────────────────</div>
            <div>DOCUMENTO GERADO PARA IMPRESSÃO EM TERMINAL P&B</div>
            <div>RASTREABILIDADE ANVISA - ${op.codigo}</div>
            <div>───────────────────────────────────────────────────────────────</div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const handlePrintAll = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const sections = [
      { id: 'section-separacao', titulo: 'SEPARAÇÃO DE MATERIAIS', fase: 'Fase 1', cor: '#ef4444' },
      { id: 'section-pesagem', titulo: 'PESAGEM DE MATÉRIAS-PRIMAS', fase: 'Fase 2', cor: '#f59e0b' },
      { id: 'section-mistura', titulo: 'ORDEM DE MISTURA', fase: 'Fase 3', cor: '#10b981' },
      { id: 'section-encapsulamento', titulo: 'ENCAPSULAMENTO', fase: 'Fase 4', cor: '#3b82f6' },
      { id: 'section-embalagem', titulo: 'EMBALAGEM E ROTULAGEM', fase: 'Fase 5', cor: '#8b5cf6' },
      { id: 'section-checklist', titulo: 'CHECKLIST OPERACIONAL', fase: 'Verificações', cor: '#06b6d4' }
    ];

    let allContent = '';
    sections.forEach((sec, idx) => {
      const section = document.getElementById(sec.id);
      if (section) {
        allContent += `
          <div class="section-page">
            <div class="section-header" style="border-left-color: ${sec.cor}; background: linear-gradient(135deg, ${sec.cor}10 0%, ${sec.cor}05 100%);">
              <div class="section-badge" style="background: ${sec.cor};">${idx + 1}</div>
              <div class="section-info">
                <div class="section-fase">${sec.fase}</div>
                <div class="section-titulo">${sec.titulo}</div>
              </div>
              <div class="section-op">
                <div class="section-op-codigo">${op.codigo}</div>
                <div class="section-op-lote">Lote: ${op.lote_produto_acabado || '-'}</div>
              </div>
            </div>
            ${section.innerHTML}
          </div>
        `;
        if (idx < sections.length - 1) {
          allContent += '<div class="page-break"></div>';
        }
      }
    });

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>OP ${op.codigo} - Documento Completo</title>
          <style>
            ${getOPPrintStyles()}
            
            /* ============ ESTILOS OP COMPLETA COLORIDA ============ */
            @page { 
              size: A4; 
              margin: 8mm 10mm; 
            }
            
            body {
              font-family: 'Segoe UI', Arial, sans-serif;
              font-size: 9px;
              line-height: 1.3;
              color: #1a1a1a;
              margin: 0;
              padding: 0;
            }
            
            /* CAPA PROFISSIONAL */
            .op-capa {
              padding: 15mm 10mm;
              display: flex;
              flex-direction: column;
              min-height: 100vh;
            }
            
            .op-capa-header {
              text-align: center;
              padding: 25px 0;
              border-bottom: 4px solid #1e293b;
              margin-bottom: 20px;
              background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
              border-radius: 8px;
            }
            
            .op-capa-header h1 {
              font-size: 24px;
              font-weight: 800;
              color: #1e293b;
              margin: 0 0 8px 0;
              letter-spacing: 3px;
              text-transform: uppercase;
            }
            
            .op-capa-codigo {
              font-size: 36px;
              font-family: 'Consolas', monospace;
              font-weight: 700;
              color: #0f766e;
              margin: 10px 0;
            }
            
            .op-capa-produto {
              font-size: 14px;
              color: #475569;
              margin: 5px 0;
            }
            
            .op-capa-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 10px;
              margin: 20px 0;
            }
            
            .op-capa-box {
              border: 2px solid #e2e8f0;
              padding: 12px;
              text-align: center;
              border-radius: 8px;
              background: white;
            }
            
            .op-capa-box-label {
              font-size: 8px;
              color: #64748b;
              text-transform: uppercase;
              letter-spacing: 1px;
              margin-bottom: 4px;
            }
            
            .op-capa-box-valor {
              font-size: 14px;
              font-weight: 700;
              color: #1e293b;
            }
            
            /* ÍNDICE COLORIDO */
            .op-capa-indice {
              background: #f8fafc;
              padding: 20px;
              border-radius: 12px;
              margin-top: 20px;
              border: 1px solid #e2e8f0;
            }
            
            .op-capa-indice-titulo {
              font-size: 12px;
              font-weight: 700;
              color: #334155;
              margin-bottom: 15px;
              text-transform: uppercase;
              letter-spacing: 2px;
              text-align: center;
            }
            
            .op-capa-indice-grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 10px;
            }
            
            .op-capa-indice-item {
              display: flex;
              align-items: center;
              gap: 10px;
              padding: 10px 12px;
              background: white;
              border-radius: 8px;
              border-left: 4px solid;
              box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            }
            
            .op-capa-indice-num {
              width: 26px;
              height: 26px;
              display: flex;
              align-items: center;
              justify-content: center;
              border-radius: 50%;
              font-size: 11px;
              font-weight: 700;
              color: white;
            }
            
            .op-capa-indice-text {
              flex: 1;
            }
            
            .op-capa-indice-fase {
              font-size: 8px;
              color: #94a3b8;
              text-transform: uppercase;
            }
            
            .op-capa-indice-nome {
              font-size: 10px;
              font-weight: 600;
              color: #334155;
            }
            
            /* CABEÇALHO DE SEÇÃO */
            .section-page {
              margin-bottom: 0;
            }
            
            .section-header {
              display: flex;
              align-items: center;
              gap: 12px;
              padding: 10px 15px;
              border-left: 5px solid;
              border-radius: 6px;
              margin-bottom: 12px;
            }
            
            .section-badge {
              width: 32px;
              height: 32px;
              display: flex;
              align-items: center;
              justify-content: center;
              border-radius: 50%;
              font-size: 14px;
              font-weight: 700;
              color: white;
            }
            
            .section-info {
              flex: 1;
            }
            
            .section-fase {
              font-size: 9px;
              text-transform: uppercase;
              letter-spacing: 1px;
              color: #64748b;
            }
            
            .section-titulo {
              font-size: 14px;
              font-weight: 700;
              color: #1e293b;
            }
            
            .section-op {
              text-align: right;
            }
            
            .section-op-codigo {
              font-size: 14px;
              font-family: 'Consolas', monospace;
              font-weight: 700;
              color: #1e293b;
            }
            
            .section-op-lote {
              font-size: 9px;
              color: #64748b;
            }
            
            /* Remove headers duplicados do conteúdo original */
            .section-page > div > .bg-gradient-to-r {
              display: none !important;
            }
            
            /* RODAPÉ FINAL */
            .op-footer-final {
              margin-top: 20px;
              padding-top: 12px;
              border-top: 2px solid #1e293b;
              text-align: center;
            }
            
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .op-capa-header { background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%) !important; }
              .section-header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          <div class="op-capa">
            <div class="op-capa-header">
              <h1>ORDEM DE PRODUÇÃO INDUSTRIAL</h1>
              <div class="op-capa-codigo">${op.codigo}</div>
              <div class="op-capa-produto">${op.produto_nome || 'Produto não especificado'}</div>
              <div style="font-size: 10px; color: #94a3b8; margin-top: 8px;">
                Gerado em: ${new Date().toLocaleString('pt-BR')}
              </div>
            </div>
            
            <div class="op-capa-grid">
              <div class="op-capa-box">
                <div class="op-capa-box-label">Total Cápsulas</div>
                <div class="op-capa-box-valor">${(op.total_capsulas_com_acrescimo || 0).toLocaleString()}</div>
              </div>
              <div class="op-capa-box">
                <div class="op-capa-box-label">Frascos</div>
                <div class="op-capa-box-valor">${op.quantidade_frascos || 0} × ${op.capsulas_por_frasco || 60}</div>
              </div>
              <div class="op-capa-box">
                <div class="op-capa-box-label">Lote</div>
                <div class="op-capa-box-valor">${op.lote_produto_acabado || '-'}</div>
              </div>
              <div class="op-capa-box">
                <div class="op-capa-box-label">RT Responsável</div>
                <div class="op-capa-box-valor" style="font-size: 11px;">${op.rt_nome || '-'}</div>
              </div>
            </div>
            
            <div class="op-capa-indice">
              <div class="op-capa-indice-titulo">📋 Índice do Documento</div>
              <div class="op-capa-indice-grid">
                ${sections.map((s, i) => `
                  <div class="op-capa-indice-item" style="border-left-color: ${s.cor};">
                    <div class="op-capa-indice-num" style="background: ${s.cor};">${i + 1}</div>
                    <div class="op-capa-indice-text">
                      <div class="op-capa-indice-fase">${s.fase}</div>
                      <div class="op-capa-indice-nome">${s.titulo}</div>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
          
          <div class="page-break"></div>
          
          ${allContent}
          
          <div class="op-footer-final">
            <div style="font-size: 9px; color: #64748b;">
              Documento completo gerado em ${new Date().toLocaleString('pt-BR')} | OP: ${op.codigo} | 
              Lote: ${op.lote_produto_acabado || '-'} | Rastreabilidade ANVISA
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const getSectionTitle = (sectionId: string): string => {
    const titles: Record<string, string> = {
      'section-separacao': 'Separação de Materiais',
      'section-pesagem': 'Pesagem de Matérias-Primas',
      'section-mistura': 'Ordem de Mistura',
      'section-encapsulamento': 'Encapsulamento',
      'section-embalagem': 'Embalagem e Rotulagem',
      'section-checklist': 'Checklist Operacional',
    };
    return titles[sectionId] || 'Documento';
  };

  const getSectionId = (tab: string): string => {
    return `section-${tab}`;
  };

  return (
    <div className="space-y-4">
      {/* Barra de ações */}
      <div className="flex items-center justify-between bg-muted/50 p-4 rounded-lg">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <span className="font-semibold">Documentos da OP {op.codigo}</span>
        </div>
        <Button onClick={handlePrintAll} className="gap-2">
          <Printer className="h-4 w-4" />
          Imprimir OP Completa
        </Button>
      </div>

      {/* Tabs de seções */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-6 w-full">
          <TabsTrigger value="separacao" className="gap-1">
            <Package className="h-4 w-4" />
            <span className="hidden sm:inline">Separação</span>
          </TabsTrigger>
          <TabsTrigger value="pesagem" className="gap-1">
            <Scale className="h-4 w-4" />
            <span className="hidden sm:inline">Pesagem</span>
          </TabsTrigger>
          <TabsTrigger value="mistura" className="gap-1">
            <FlaskConical className="h-4 w-4" />
            <span className="hidden sm:inline">Mistura</span>
          </TabsTrigger>
          <TabsTrigger value="encapsulamento" className="gap-1">
            <Pill className="h-4 w-4" />
            <span className="hidden sm:inline">Encapsulamento</span>
          </TabsTrigger>
          <TabsTrigger value="embalagem" className="gap-1">
            <Tag className="h-4 w-4" />
            <span className="hidden sm:inline">Embalagem</span>
          </TabsTrigger>
          <TabsTrigger value="checklist" className="gap-1">
            <ClipboardCheck className="h-4 w-4" />
            <span className="hidden sm:inline">Checklist</span>
          </TabsTrigger>
        </TabsList>

        {/* Separação */}
        <TabsContent value="separacao" className="mt-4">
          <div className="flex justify-end gap-2 mb-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => handlePrintTerminal('section-separacao')}
              className="gap-2"
            >
              <Terminal className="h-4 w-4" />
              Imprimir Terminal P&B
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => handlePrintSection('section-separacao')}
              className="gap-2"
            >
              <Printer className="h-4 w-4" />
              Imprimir Separação
            </Button>
          </div>
          <OPFolhaSeparacao 
            op={op} 
            materiasPrimas={materiasPrimas}
            embalagens={embalagens}
          />
        </TabsContent>

        {/* Pesagem */}
        <TabsContent value="pesagem" className="mt-4">
          <div className="flex justify-end gap-2 mb-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => handlePrintTerminal('section-pesagem')}
              className="gap-2"
            >
              <Terminal className="h-4 w-4" />
              Imprimir Terminal P&B
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => handlePrintSection('section-pesagem')}
              className="gap-2"
            >
              <Printer className="h-4 w-4" />
              Imprimir Pesagem
            </Button>
          </div>
          <OPFolhaPesagem op={op} materiasPrimas={materiasPrimas} />
        </TabsContent>

        {/* Mistura */}
        <TabsContent value="mistura" className="mt-4">
          <div className="flex justify-end gap-2 mb-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => handlePrintTerminal('section-mistura')}
              className="gap-2"
            >
              <Terminal className="h-4 w-4" />
              Imprimir Terminal P&B
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => handlePrintSection('section-mistura')}
              className="gap-2"
            >
              <Printer className="h-4 w-4" />
              Imprimir Mistura
            </Button>
          </div>
          <OPFolhaMistura op={op} materiasPrimas={materiasPrimas} />
        </TabsContent>

        {/* Encapsulamento */}
        <TabsContent value="encapsulamento" className="mt-4">
          <div className="flex justify-end gap-2 mb-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => handlePrintTerminal('section-encapsulamento')}
              className="gap-2"
            >
              <Terminal className="h-4 w-4" />
              Imprimir Terminal P&B
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => handlePrintSection('section-encapsulamento')}
              className="gap-2"
            >
              <Printer className="h-4 w-4" />
              Imprimir Encapsulamento
            </Button>
          </div>
          <OPFolhaEncapsulamento op={op} />
        </TabsContent>

        {/* Embalagem */}
        <TabsContent value="embalagem" className="mt-4">
          <div className="flex justify-end gap-2 mb-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => handlePrintTerminal('section-embalagem')}
              className="gap-2"
            >
              <Terminal className="h-4 w-4" />
              Imprimir Terminal P&B
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => handlePrintSection('section-embalagem')}
              className="gap-2"
            >
              <Printer className="h-4 w-4" />
              Imprimir Embalagem
            </Button>
          </div>
          <OPFolhaEmbalagem op={op} embalagens={embalagens} />
        </TabsContent>

        {/* Checklist */}
        <TabsContent value="checklist" className="mt-4">
          <div className="flex justify-end gap-2 mb-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => handlePrintTerminal('section-checklist')}
              className="gap-2"
            >
              <Terminal className="h-4 w-4" />
              Imprimir Terminal P&B
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => handlePrintSection('section-checklist')}
              className="gap-2"
            >
              <Printer className="h-4 w-4" />
              Imprimir Checklist
            </Button>
          </div>
          <OPFolhaChecklist op={op} checklist={checklist} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
