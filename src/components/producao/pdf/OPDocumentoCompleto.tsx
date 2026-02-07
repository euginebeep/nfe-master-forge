// ============================================================
// OP DOCUMENTO COMPLETO - VERSÃO PROFISSIONAL A4
// Inclui todas as etapas: Separação, Pesagem, Mistura, etc.
// ============================================================

import { useRef, useState, useEffect } from 'react';
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
  const [allSectionsRendered, setAllSectionsRendered] = useState(false);

  // Garantir que todas as seções são renderizadas para impressão
  useEffect(() => {
    setAllSectionsRendered(true);
  }, []);

  const handlePrintSection = (sectionId: string) => {
    const section = document.getElementById(sectionId);
    if (!section) {
      console.error(`Seção ${sectionId} não encontrada`);
      return;
    }

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

  // Impressão Terminal P&B - Ultra compacto para caber em 1 folha A4
  const handlePrintTerminal = (sectionId: string) => {
    const section = document.getElementById(sectionId);
    if (!section) {
      console.error(`Seção ${sectionId} não encontrada para impressão terminal`);
      return;
    }

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
            <div class="terminal-title">OP: ${op.codigo} | ${getSectionTitle(sectionId).toUpperCase()} | LOTE: ${op.lote_produto_acabado || '-'}</div>
          </div>
          ${section.innerHTML}
          <div class="terminal-footer">
            <div>DOCUMENTO TERMINAL P&B - ${new Date().toLocaleString('pt-BR')} - ANVISA</div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  // IMPRESSÃO OP COMPLETA - Todas as seções com cores profissionais
  const handlePrintAll = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const sections = [
      { id: 'section-separacao', titulo: 'SEPARAÇÃO DE MATERIAIS', fase: 'Fase 1', cor: '#dc2626', corLight: '#fef2f2', icon: '📦' },
      { id: 'section-pesagem', titulo: 'PESAGEM DE MATÉRIAS-PRIMAS', fase: 'Fase 2', cor: '#ea580c', corLight: '#fff7ed', icon: '⚖️' },
      { id: 'section-mistura', titulo: 'ORDEM DE MISTURA', fase: 'Fase 3', cor: '#16a34a', corLight: '#f0fdf4', icon: '🔬' },
      { id: 'section-encapsulamento', titulo: 'ENCAPSULAMENTO', fase: 'Fase 4', cor: '#2563eb', corLight: '#eff6ff', icon: '💊' },
      { id: 'section-embalagem', titulo: 'EMBALAGEM E ROTULAGEM', fase: 'Fase 5', cor: '#9333ea', corLight: '#faf5ff', icon: '🏷️' },
      { id: 'section-checklist', titulo: 'CHECKLIST OPERACIONAL', fase: 'Verificações', cor: '#0891b2', corLight: '#ecfeff', icon: '✅' }
    ];

    // Coletar conteúdo de todas as seções
    let allSections = '';
    let sectionsFound = 0;
    let pageNumber = 2; // Página 1 é a capa
    
    sections.forEach((sec, idx) => {
      const section = document.getElementById(sec.id);
      if (section && section.innerHTML.trim()) {
        sectionsFound++;
        allSections += `
          <div class="section-page">
            <!-- CABEÇALHO PROFISSIONAL DA SEÇÃO -->
            <header class="section-header-pro">
              <div class="header-left">
                <div class="header-badge" style="background: ${sec.cor};">
                  <span class="header-badge-num">${idx + 1}</span>
                </div>
                <div class="header-info">
                  <div class="header-fase">${sec.fase}</div>
                  <div class="header-titulo">${sec.titulo}</div>
                </div>
              </div>
              <div class="header-right">
                <div class="header-op">${op.codigo}</div>
                <div class="header-lote">Lote: ${op.lote_produto_acabado || '-'}</div>
                <div class="header-produto">${op.produto_nome || '-'}</div>
              </div>
            </header>
            
            <!-- GRID DE INFORMAÇÕES COMPACTO -->
            <div class="info-grid-compact">
              <div class="info-item">
                <span class="info-label">Total Cápsulas</span>
                <span class="info-value">${(op.total_capsulas_com_acrescimo || 0).toLocaleString()}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Frascos</span>
                <span class="info-value">${op.quantidade_frascos || 0} × ${op.capsulas_por_frasco || 60}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Data Fab.</span>
                <span class="info-value">${op.data_fabricacao ? new Date(op.data_fabricacao).toLocaleDateString('pt-BR') : '-'}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Validade</span>
                <span class="info-value">${op.data_validade ? new Date(op.data_validade).toLocaleDateString('pt-BR') : '-'}</span>
              </div>
              <div class="info-item">
                <span class="info-label">RT</span>
                <span class="info-value">${op.rt_nome || '-'}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Registro</span>
                <span class="info-value">${op.rt_tipo_conselho || ''} ${op.rt_numero_registro || '-'}</span>
              </div>
            </div>
            
            <!-- CONTEÚDO DA SEÇÃO -->
            <div class="section-content-area">
              ${section.innerHTML}
            </div>
            
            <!-- RODAPÉ COM PAGINAÇÃO -->
            <footer class="page-footer">
              <div class="footer-left">Vitalnow Industria Ltda</div>
              <div class="footer-center">${op.codigo} | ${sec.fase} - ${sec.titulo}</div>
              <div class="footer-right">Página ${pageNumber}</div>
            </footer>
          </div>
          ${idx < sections.length - 1 ? '<div class="page-break"></div>' : ''}
        `;
        pageNumber++;
      }
    });

    if (sectionsFound === 0) {
      alert('Nenhuma seção encontrada para impressão. Aguarde o carregamento completo da página.');
      return;
    }

    const totalPages = pageNumber - 1;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>OP ${op.codigo} - Documento Completo</title>
          <style>
            /* ============================================ */
            /* ESTILOS PROFISSIONAIS - OP COMPLETA A4      */
            /* ============================================ */
            
            @page { 
              size: A4; 
              margin: 10mm 12mm 15mm 12mm; 
            }
            
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            
            body {
              font-family: 'Segoe UI', -apple-system, Arial, sans-serif;
              font-size: 9px;
              line-height: 1.35;
              color: #1a1a1a;
              background: white;
            }
            
            .page-break {
              page-break-after: always;
              break-after: page;
              height: 0;
              margin: 0;
              padding: 0;
            }
            
            /* ============ CAPA PROFISSIONAL ============ */
            .op-capa {
              padding: 20mm 15mm;
              min-height: calc(100vh - 30mm);
              display: flex;
              flex-direction: column;
              position: relative;
            }
            
            .capa-header {
              text-align: center;
              padding: 35px 30px;
              border: 4px solid #1e293b;
              margin-bottom: 30px;
              background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
              border-radius: 16px;
              position: relative;
            }
            
            .capa-empresa {
              font-size: 11px;
              color: #64748b;
              text-transform: uppercase;
              letter-spacing: 3px;
              margin-bottom: 15px;
              font-weight: 600;
            }
            
            .capa-header h1 {
              font-size: 28px;
              font-weight: 800;
              color: #0f172a;
              margin: 0 0 15px 0;
              letter-spacing: 4px;
              text-transform: uppercase;
            }
            
            .capa-codigo {
              font-size: 48px;
              font-family: 'Consolas', 'Monaco', monospace;
              font-weight: 700;
              color: #0f766e;
              margin: 20px 0;
              letter-spacing: 2px;
            }
            
            .capa-produto {
              font-size: 18px;
              color: #334155;
              font-weight: 600;
              margin: 12px 0;
            }
            
            .capa-lote {
              font-size: 14px;
              color: #64748b;
              font-weight: 500;
            }
            
            /* GRID DE INFORMAÇÕES DA CAPA */
            .capa-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 15px;
              margin: 30px 0;
            }
            
            .capa-box {
              border: 2px solid #e2e8f0;
              padding: 18px 15px;
              text-align: center;
              border-radius: 12px;
              background: white;
              box-shadow: 0 2px 4px rgba(0,0,0,0.03);
            }
            
            .capa-box-label {
              font-size: 9px;
              color: #64748b;
              text-transform: uppercase;
              letter-spacing: 1px;
              margin-bottom: 8px;
              font-weight: 600;
            }
            
            .capa-box-valor {
              font-size: 17px;
              font-weight: 700;
              color: #1e293b;
            }
            
            /* ÍNDICE COLORIDO */
            .capa-indice {
              background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
              padding: 30px;
              border-radius: 16px;
              margin-top: 25px;
              border: 2px solid #e2e8f0;
              flex: 1;
            }
            
            .capa-indice-titulo {
              font-size: 15px;
              font-weight: 700;
              color: #0f172a;
              margin-bottom: 25px;
              text-transform: uppercase;
              letter-spacing: 3px;
              text-align: center;
              padding-bottom: 12px;
              border-bottom: 2px solid #cbd5e1;
            }
            
            .capa-indice-grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 15px;
            }
            
            .capa-indice-item {
              display: flex;
              align-items: center;
              gap: 14px;
              padding: 15px 18px;
              background: white;
              border-radius: 12px;
              border-left: 6px solid;
              box-shadow: 0 3px 6px rgba(0,0,0,0.05);
              transition: transform 0.2s;
            }
            
            .capa-indice-num {
              width: 38px;
              height: 38px;
              display: flex;
              align-items: center;
              justify-content: center;
              border-radius: 50%;
              font-size: 16px;
              font-weight: 700;
              color: white;
              flex-shrink: 0;
            }
            
            .capa-indice-text {
              flex: 1;
            }
            
            .capa-indice-fase {
              font-size: 9px;
              color: #94a3b8;
              text-transform: uppercase;
              letter-spacing: 1px;
              font-weight: 600;
            }
            
            .capa-indice-nome {
              font-size: 12px;
              font-weight: 600;
              color: #1e293b;
              margin-top: 3px;
            }
            
            /* RODAPÉ DA CAPA */
            .capa-footer {
              margin-top: 30px;
              padding-top: 20px;
              border-top: 2px solid #e2e8f0;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            
            .capa-footer-left {
              font-size: 11px;
              font-weight: 600;
              color: #334155;
            }
            
            .capa-footer-right {
              font-size: 10px;
              color: #64748b;
              text-align: right;
            }
            
            /* ============ CABEÇALHO DAS SEÇÕES ============ */
            .section-page {
              min-height: calc(100vh - 30mm);
              display: flex;
              flex-direction: column;
              padding: 0 0 20px 0;
            }
            
            .section-header-pro {
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 18px 20px;
              background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
              border-bottom: 4px solid #1e293b;
              margin-bottom: 15px;
            }
            
            .header-left {
              display: flex;
              align-items: center;
              gap: 18px;
            }
            
            .header-badge {
              width: 52px;
              height: 52px;
              display: flex;
              align-items: center;
              justify-content: center;
              border-radius: 50%;
              box-shadow: 0 4px 8px rgba(0,0,0,0.15);
            }
            
            .header-badge-num {
              font-size: 24px;
              font-weight: 800;
              color: white;
            }
            
            .header-info {
              display: flex;
              flex-direction: column;
            }
            
            .header-fase {
              font-size: 10px;
              text-transform: uppercase;
              letter-spacing: 2px;
              color: #64748b;
              font-weight: 600;
              margin-bottom: 4px;
            }
            
            .header-titulo {
              font-size: 20px;
              font-weight: 800;
              color: #0f172a;
              letter-spacing: 1px;
            }
            
            .header-right {
              text-align: right;
            }
            
            .header-op {
              font-size: 20px;
              font-family: 'Consolas', 'Monaco', monospace;
              font-weight: 700;
              color: #0f172a;
              letter-spacing: 1px;
            }
            
            .header-lote {
              font-size: 11px;
              color: #475569;
              margin-top: 4px;
              font-weight: 500;
            }
            
            .header-produto {
              font-size: 12px;
              color: #64748b;
              margin-top: 2px;
              font-style: italic;
            }
            
            /* GRID DE INFORMAÇÕES COMPACTO */
            .info-grid-compact {
              display: grid;
              grid-template-columns: repeat(6, 1fr);
              gap: 8px;
              padding: 0 8px;
              margin-bottom: 15px;
            }
            
            .info-item {
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 6px;
              padding: 8px 10px;
              text-align: center;
            }
            
            .info-label {
              display: block;
              font-size: 7px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              color: #64748b;
              margin-bottom: 3px;
              font-weight: 600;
            }
            
            .info-value {
              display: block;
              font-size: 10px;
              font-weight: 700;
              color: #1e293b;
            }
            
            /* CONTEÚDO DA SEÇÃO */
            .section-content-area {
              flex: 1;
              padding: 0 8px;
              font-size: 9px;
            }
            
            /* Remove headers duplicados das folhas individuais */
            .section-content-area > div > .bg-gradient-to-r:first-child,
            .section-content-area .bg-gradient-to-r.from-slate-800,
            .section-content-area > div:first-child > div:first-child[class*="bg-gradient"] {
              display: none !important;
            }
            
            /* RODAPÉ DAS PÁGINAS */
            .page-footer {
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 12px 15px;
              margin-top: auto;
              border-top: 2px solid #1e293b;
              background: #f8fafc;
              font-size: 9px;
            }
            
            .footer-left {
              font-weight: 700;
              color: #0f172a;
              font-size: 10px;
            }
            
            .footer-center {
              color: #64748b;
              font-size: 8px;
            }
            
            .footer-right {
              font-weight: 600;
              color: #334155;
              font-size: 10px;
            }
            
            /* ============ TABELAS ============ */
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 8px;
              margin-bottom: 10px;
            }
            
            th, td {
              border: 1px solid #cbd5e1;
              padding: 5px 6px;
              text-align: left;
              vertical-align: middle;
            }
            
            th {
              background: #f1f5f9;
              font-weight: 600;
              font-size: 7px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              color: #475569;
            }
            
            /* ============ IMPRESSÃO ============ */
            @media print {
              body { 
                -webkit-print-color-adjust: exact !important; 
                print-color-adjust: exact !important;
              }
              
              .section-header-pro {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              
              .header-badge {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              
              .page-break { 
                height: 0 !important; 
                visibility: hidden !important; 
              }
              
              .page-footer {
                position: relative;
                bottom: 0;
              }
            }
          </style>
        </head>
        <body>
          <!-- ========== CAPA ========== -->
          <div class="op-capa">
            <div class="capa-header">
              <div class="capa-empresa">Vitalnow Industria Ltda</div>
              <h1>📋 Ordem de Produção Industrial</h1>
              <div class="capa-codigo">${op.codigo}</div>
              <div class="capa-produto">${op.produto_nome || 'Produto não especificado'}</div>
              <div class="capa-lote">Lote: ${op.lote_produto_acabado || '-'}</div>
            </div>
            
            <div class="capa-grid">
              <div class="capa-box">
                <div class="capa-box-label">Total Cápsulas</div>
                <div class="capa-box-valor">${(op.total_capsulas_com_acrescimo || 0).toLocaleString()}</div>
              </div>
              <div class="capa-box">
                <div class="capa-box-label">Frascos</div>
                <div class="capa-box-valor">${op.quantidade_frascos || 0} × ${op.capsulas_por_frasco || 60}</div>
              </div>
              <div class="capa-box">
                <div class="capa-box-label">Data Fabricação</div>
                <div class="capa-box-valor">${op.data_fabricacao ? new Date(op.data_fabricacao).toLocaleDateString('pt-BR') : '-'}</div>
              </div>
              <div class="capa-box">
                <div class="capa-box-label">RT Responsável</div>
                <div class="capa-box-valor" style="font-size: 13px;">${op.rt_nome || '-'}</div>
              </div>
            </div>
            
            <div class="capa-indice">
              <div class="capa-indice-titulo">📑 Índice do Documento</div>
              <div class="capa-indice-grid">
                ${sections.map((s, i) => `
                  <div class="capa-indice-item" style="border-left-color: ${s.cor};">
                    <div class="capa-indice-num" style="background: ${s.cor};">${i + 1}</div>
                    <div class="capa-indice-text">
                      <div class="capa-indice-fase">${s.fase}</div>
                      <div class="capa-indice-nome">${s.titulo}</div>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
            
            <div class="capa-footer">
              <div class="capa-footer-left">Vitalnow Industria Ltda</div>
              <div class="capa-footer-right">
                <div>Documento gerado em: ${new Date().toLocaleString('pt-BR')}</div>
                <div>Total de páginas: ${totalPages} | Rastreabilidade ANVISA</div>
              </div>
            </div>
          </div>
          
          <div class="page-break"></div>
          
          <!-- ========== SEÇÕES ========== -->
          ${allSections}
        </body>
      </html>
    `);
    printWindow.document.close();
    
    // Pequeno delay para garantir renderização antes de imprimir
    setTimeout(() => {
      printWindow.print();
    }, 300);
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

      {/* Seções ocultas para impressão completa - TODAS SEMPRE RENDERIZADAS */}
      <div className="hidden">
        <div id="hidden-separacao">
          <OPFolhaSeparacao op={op} materiasPrimas={materiasPrimas} embalagens={embalagens} />
        </div>
        <div id="hidden-pesagem">
          <OPFolhaPesagem op={op} materiasPrimas={materiasPrimas} />
        </div>
        <div id="hidden-mistura">
          <OPFolhaMistura op={op} materiasPrimas={materiasPrimas} />
        </div>
        <div id="hidden-encapsulamento">
          <OPFolhaEncapsulamento op={op} />
        </div>
        <div id="hidden-embalagem">
          <OPFolhaEmbalagem op={op} embalagens={embalagens} />
        </div>
        <div id="hidden-checklist">
          <OPFolhaChecklist op={op} checklist={checklist} />
        </div>
      </div>
    </div>
  );
}
