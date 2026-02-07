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
      { id: 'section-separacao', titulo: 'SEPARAÇÃO DE MATERIAIS', fase: 'Fase 1' },
      { id: 'section-pesagem', titulo: 'PESAGEM DE MATÉRIAS-PRIMAS', fase: 'Fase 2' },
      { id: 'section-mistura', titulo: 'ORDEM DE MISTURA', fase: 'Fase 3' },
      { id: 'section-encapsulamento', titulo: 'ENCAPSULAMENTO', fase: 'Fase 4' },
      { id: 'section-embalagem', titulo: 'EMBALAGEM E ROTULAGEM', fase: 'Fase 5' },
      { id: 'section-checklist', titulo: 'CHECKLIST OPERACIONAL', fase: 'Verificações' }
    ];

    let allContent = '';
    sections.forEach((sec, idx) => {
      const section = document.getElementById(sec.id);
      if (section) {
        // Adiciona cabeçalho de seção para a OP completa
        allContent += `
          <div class="section-cover">
            <div class="section-cover-header">
              <div class="section-cover-fase">${sec.fase}</div>
              <div class="section-cover-titulo">${sec.titulo}</div>
              <div class="section-cover-op">OP: ${op.codigo} | Lote: ${op.lote_produto_acabado || '-'}</div>
            </div>
          </div>
        `;
        allContent += section.innerHTML;
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
            
            /* Estilos adicionais para OP completa */
            .section-cover {
              margin-bottom: 15px;
              page-break-inside: avoid;
            }
            .section-cover-header {
              background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
              color: white;
              padding: 12px 20px;
              border-radius: 6px;
              margin-bottom: 10px;
            }
            .section-cover-fase {
              font-size: 9px;
              text-transform: uppercase;
              letter-spacing: 2px;
              opacity: 0.8;
              margin-bottom: 4px;
            }
            .section-cover-titulo {
              font-size: 16px;
              font-weight: 700;
              letter-spacing: 1px;
            }
            .section-cover-op {
              font-size: 10px;
              margin-top: 6px;
              font-family: 'Consolas', monospace;
              opacity: 0.9;
            }
            
            @media print {
              .section-cover-header {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
                background: #1e293b !important;
              }
            }
          </style>
        </head>
        <body>
          <div class="op-completa-capa">
            <div style="text-align: center; padding: 30px 0; border-bottom: 3px solid #333; margin-bottom: 20px;">
              <h1 style="font-size: 22px; margin: 0 0 8px 0; font-weight: 700;">ORDEM DE PRODUÇÃO INDUSTRIAL</h1>
              <div style="font-size: 28px; font-family: 'Consolas', monospace; font-weight: 700;">${op.codigo}</div>
              <div style="font-size: 12px; margin-top: 10px; color: #555;">
                Produto: ${op.produto_nome || '-'} | Lote: ${op.lote_produto_acabado || '-'}
              </div>
              <div style="font-size: 10px; margin-top: 6px; color: #777;">
                Gerado em: ${new Date().toLocaleString('pt-BR')}
              </div>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px;">
              <div style="border: 1px solid #ccc; padding: 10px; text-align: center;">
                <div style="font-size: 9px; color: #666; text-transform: uppercase;">Total Cápsulas</div>
                <div style="font-size: 14px; font-weight: 700;">${op.total_capsulas_com_acrescimo?.toLocaleString() || 0}</div>
              </div>
              <div style="border: 1px solid #ccc; padding: 10px; text-align: center;">
                <div style="font-size: 9px; color: #666; text-transform: uppercase;">Frascos</div>
                <div style="font-size: 14px; font-weight: 700;">${op.quantidade_frascos || 0} × ${op.capsulas_por_frasco || 60}</div>
              </div>
              <div style="border: 1px solid #ccc; padding: 10px; text-align: center;">
                <div style="font-size: 9px; color: #666; text-transform: uppercase;">RT Responsável</div>
                <div style="font-size: 11px; font-weight: 600;">${op.rt_nome || '-'}</div>
              </div>
            </div>
            
            <div style="font-size: 10px; color: #555; text-align: center; margin-bottom: 15px;">
              <strong>ÍNDICE:</strong> 1. Separação | 2. Pesagem | 3. Mistura | 4. Encapsulamento | 5. Embalagem | 6. Checklist
            </div>
          </div>
          
          <div class="page-break"></div>
          
          ${allContent}
          
          <div class="op-footer-final" style="margin-top: 30px; padding-top: 15px; border-top: 2px solid #333; text-align: center;">
            <div style="font-size: 9px; color: #666;">
              Documento completo gerado em ${new Date().toLocaleString('pt-BR')} | ${op.codigo} | 
              Rastreabilidade ANVISA - Controle de Produção Industrial
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
