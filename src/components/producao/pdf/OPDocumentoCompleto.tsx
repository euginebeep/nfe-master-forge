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

  // Impressão Terminal P&B - Ultra compacto com cabeçalho padrão
  const handlePrintTerminal = (sectionId: string) => {
    const section = document.getElementById(sectionId);
    if (!section) {
      console.error(`Seção ${sectionId} não encontrada para impressão terminal`);
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const sectionTitle = getSectionTitle(sectionId);

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>OP ${op.codigo} - ${sectionTitle} [TERMINAL]</title>
          <style>${getTerminalPrintStyles()}</style>
        </head>
        <body class="terminal-mode">
          <!-- CABEÇALHO TERMINAL PADRÃO -->
          <div class="terminal-header-industrial">
            <div class="terminal-header-bar">
              <div class="terminal-header-left">
                <div class="terminal-main-title">ORDEM DE PRODUÇÃO INDUSTRIAL</div>
                <div class="terminal-subtitle">${sectionTitle.toUpperCase()}</div>
              </div>
              <div class="terminal-header-right">
                <div class="terminal-op-code">${op.codigo}</div>
                <div class="terminal-lote">Lote: ${op.lote_produto_acabado || '-'}</div>
              </div>
            </div>
            <div class="terminal-metadata">
              <div class="terminal-meta-item"><span class="terminal-meta-label">PRODUTO:</span> ${op.produto_nome || '-'}</div>
              <div class="terminal-meta-item"><span class="terminal-meta-label">QTD:</span> ${op.quantidade_frascos || 0}×${op.capsulas_por_frasco || 60}</div>
              <div class="terminal-meta-item"><span class="terminal-meta-label">TOTAL:</span> ${(op.total_capsulas_com_acrescimo || 0).toLocaleString()}</div>
              <div class="terminal-meta-item"><span class="terminal-meta-label">FAB:</span> ${op.data_fabricacao ? new Date(op.data_fabricacao).toLocaleDateString('pt-BR') : '-'}</div>
              <div class="terminal-meta-item"><span class="terminal-meta-label">VAL:</span> ${op.data_validade ? new Date(op.data_validade).toLocaleDateString('pt-BR') : '-'}</div>
              <div class="terminal-meta-item"><span class="terminal-meta-label">RT:</span> ${op.rt_nome || op.responsavel_producao_nome || '-'}</div>
            </div>
          </div>
          ${section.innerHTML}
          <div class="terminal-footer">
            <div class="terminal-footer-left">Vitalnow Industria Ltda</div>
            <div class="terminal-footer-right">${new Date().toLocaleString('pt-BR')} | ANVISA</div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  // IMPRESSÃO OP COMPLETA - Formato Profissional ANVISA
  const handlePrintAll = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const sections = [
      { id: 'section-separacao', titulo: 'FOLHA DE SEPARAÇÃO DE MATERIAIS', fase: 'Fase 1 - Pré-Produção', cor: '#0F2A44', icon: '📦' },
      { id: 'section-pesagem', titulo: 'FOLHA DE PESAGEM DE MATÉRIAS-PRIMAS', fase: 'Fase 2 - Pesagem', cor: '#0F2A44', icon: '⚖️' },
      { id: 'section-mistura', titulo: 'FOLHA DE ORDEM DE MISTURA', fase: 'Fase 3 - Mistura', cor: '#0F2A44', icon: '🔬' },
      { id: 'section-encapsulamento', titulo: 'FOLHA DE ENCAPSULAMENTO', fase: 'Fase 4 - Encapsulamento', cor: '#0F2A44', icon: '💊' },
      { id: 'section-embalagem', titulo: 'FOLHA DE EMBALAGEM E ROTULAGEM', fase: 'Fase 5 - Embalagem', cor: '#0F2A44', icon: '🏷️' },
      { id: 'section-checklist', titulo: 'CHECKLIST OPERACIONAL', fase: 'Verificações', cor: '#0F2A44', icon: '✅' }
    ];

    // Coletar conteúdo de todas as seções
    let allSections = '';
    let sectionsFound = 0;
    let pageNumber = 2; // Página 1 é a capa
    
    sections.forEach((sec, idx) => {
      const section = document.getElementById(sec.id);
      if (section && section.innerHTML.trim()) {
        sectionsFound++;
        
        // Remover blocos de identificação internos das folhas (BLOCO 1)
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = section.innerHTML;
        
        // Remover o primeiro bloco de identificação de cada folha (border-2 border-slate-800 com título "IDENTIFICAÇÃO")
        const blocoIdentificacao = tempDiv.querySelector('.border-2.border-slate-800');
        if (blocoIdentificacao && blocoIdentificacao.textContent?.includes('IDENTIFICAÇÃO')) {
          blocoIdentificacao.remove();
        }
        
        const cleanContent = tempDiv.innerHTML;
        
        allSections += `
          <div class="section-page">
            <!-- CABEÇALHO PROFISSIONAL - PADRÃO ANVISA -->
            <header class="op-header-industrial">
              <div class="header-bar">
                <div class="header-left-block">
                  <div class="header-main-title">ORDEM DE PRODUÇÃO INDUSTRIAL</div>
                  <div class="header-subtitle">${sec.titulo}</div>
                  <div class="header-fase">${sec.fase}</div>
                </div>
                <div class="header-right-block">
                  <div class="header-op-code">${op.codigo}</div>
                  <div class="header-lote">Lote: ${op.lote_produto_acabado || '-'}</div>
                </div>
              </div>
            </header>
            
            <!-- GRID DE METADADOS - 2 LINHAS × 4 COLUNAS -->
            <div class="metadata-grid">
              <div class="meta-cell">
                <div class="meta-label">PRODUTO</div>
                <div class="meta-value">${op.produto_nome || '-'}</div>
              </div>
              <div class="meta-cell">
                <div class="meta-label">LOTE DO PRODUTO</div>
                <div class="meta-value meta-mono">${op.lote_produto_acabado || '-'}</div>
              </div>
              <div class="meta-cell">
                <div class="meta-label">QUANTIDADE</div>
                <div class="meta-value">${op.quantidade_frascos || 0} frascos × ${op.capsulas_por_frasco || 60} un</div>
              </div>
              <div class="meta-cell">
                <div class="meta-label">TOTAL C/ ACRÉSCIMO</div>
                <div class="meta-value meta-highlight">${(op.total_capsulas_com_acrescimo || 0).toLocaleString()} un</div>
              </div>
              <div class="meta-cell">
                <div class="meta-label">RESPONSÁVEL TÉCNICO</div>
                <div class="meta-value">${op.rt_nome || op.responsavel_producao_nome || '-'}</div>
              </div>
              <div class="meta-cell">
                <div class="meta-label">CONSELHO/REGISTRO</div>
                <div class="meta-value">${op.rt_tipo_conselho || ''} ${op.rt_numero_registro || '-'}</div>
              </div>
              <div class="meta-cell">
                <div class="meta-label">DATA FABRICAÇÃO</div>
                <div class="meta-value">${op.data_fabricacao ? new Date(op.data_fabricacao).toLocaleDateString('pt-BR') : '-'}</div>
              </div>
              <div class="meta-cell">
                <div class="meta-label">DATA VALIDADE</div>
                <div class="meta-value">${op.data_validade ? new Date(op.data_validade).toLocaleDateString('pt-BR') : '-'}</div>
              </div>
            </div>
            
            <!-- CONTEÚDO DA SEÇÃO (SEM BLOCO DE IDENTIFICAÇÃO DUPLICADO) -->
            <div class="section-content-area">
              ${cleanContent}
            </div>
            
            <!-- RODAPÉ FIXO -->
            <footer class="page-footer-industrial">
              <div class="footer-left">Vitalnow Industria Ltda</div>
              <div class="footer-center">${op.codigo}</div>
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
            /* PADRÃO ANVISA COM CABEÇALHO INDUSTRIAL      */
            /* ============================================ */
            
            @page { 
              size: A4; 
              margin: 8mm 10mm 12mm 10mm; 
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
            
            /* ============ CABEÇALHO INDUSTRIAL PADRÃO ============ */
            .op-header-industrial {
              margin-bottom: 0;
            }
            
            .header-bar {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              background: #0F2A44;
              color: white;
              padding: 12px 16px;
            }
            
            .header-left-block {
              flex: 1;
            }
            
            .header-main-title {
              font-size: 16px;
              font-weight: 800;
              letter-spacing: 1px;
              text-transform: uppercase;
              margin-bottom: 4px;
            }
            
            .header-subtitle {
              font-size: 12px;
              font-weight: 600;
              color: #F97316;
              margin-bottom: 2px;
            }
            
            .header-fase {
              font-size: 10px;
              color: #94a3b8;
            }
            
            .header-right-block {
              text-align: right;
            }
            
            .header-op-code {
              font-size: 18px;
              font-family: 'Consolas', 'Monaco', monospace;
              font-weight: 700;
              letter-spacing: 1px;
            }
            
            .header-lote {
              font-size: 10px;
              color: #94a3b8;
              margin-top: 3px;
            }
            
            /* ============ GRID DE METADADOS ============ */
            .metadata-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              border: 1px solid #e2e8f0;
              border-top: none;
              margin-bottom: 12px;
            }
            
            .meta-cell {
              padding: 8px 12px;
              border-right: 1px solid #e2e8f0;
              border-bottom: 1px solid #e2e8f0;
            }
            
            .meta-cell:nth-child(4n) {
              border-right: none;
            }
            
            .meta-cell:nth-child(n+5) {
              border-bottom: none;
            }
            
            .meta-label {
              font-size: 8px;
              color: #64748b;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 3px;
              font-weight: 600;
            }
            
            .meta-value {
              font-size: 11px;
              font-weight: 600;
              color: #1e293b;
            }
            
            .meta-highlight {
              color: #ea580c;
              font-weight: 700;
            }
            
            .meta-mono {
              font-family: 'Consolas', 'Monaco', monospace;
              font-weight: 700;
            }
            /* ============ CAPA PROFISSIONAL ============ */
            .op-capa {
              padding: 15mm 12mm;
              min-height: calc(100vh - 25mm);
              display: flex;
              flex-direction: column;
              position: relative;
            }
            
            .capa-header-industrial {
              background: #0F2A44;
              color: white;
              padding: 25px 30px;
              margin-bottom: 25px;
            }
            
            .capa-empresa {
              font-size: 10px;
              color: #94a3b8;
              text-transform: uppercase;
              letter-spacing: 3px;
              margin-bottom: 10px;
              font-weight: 600;
            }
            
            .capa-main-title {
              font-size: 24px;
              font-weight: 800;
              letter-spacing: 2px;
              text-transform: uppercase;
              margin-bottom: 15px;
            }
            
            .capa-codigo {
              font-size: 42px;
              font-family: 'Consolas', 'Monaco', monospace;
              font-weight: 700;
              color: #F97316;
              letter-spacing: 2px;
            }
            
            .capa-produto-box {
              background: white;
              padding: 20px 25px;
              border-left: 5px solid #1F8F5F;
              margin-bottom: 20px;
            }
            
            .capa-produto-label {
              font-size: 9px;
              color: #64748b;
              text-transform: uppercase;
              letter-spacing: 1px;
              margin-bottom: 5px;
            }
            
            .capa-produto-nome {
              font-size: 20px;
              font-weight: 700;
              color: #0f172a;
            }
            
            .capa-lote-info {
              font-size: 12px;
              color: #475569;
              margin-top: 8px;
            }
            
            /* GRID DE INFORMAÇÕES DA CAPA */
            .capa-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 12px;
              margin-bottom: 25px;
            }
            
            .capa-box {
              border: 2px solid #e2e8f0;
              padding: 15px 12px;
              text-align: center;
              background: white;
            }
            
            .capa-box-label {
              font-size: 8px;
              color: #64748b;
              text-transform: uppercase;
              letter-spacing: 1px;
              margin-bottom: 6px;
              font-weight: 600;
            }
            
            .capa-box-valor {
              font-size: 16px;
              font-weight: 700;
              color: #1e293b;
            }
            
            .capa-box-valor.destaque {
              color: #ea580c;
            }
            
            /* ÍNDICE DO DOCUMENTO */
            .capa-indice {
              background: #f8fafc;
              padding: 25px;
              border: 2px solid #e2e8f0;
              flex: 1;
            }
            
            .capa-indice-titulo {
              font-size: 14px;
              font-weight: 700;
              color: #0f172a;
              margin-bottom: 20px;
              text-transform: uppercase;
              letter-spacing: 2px;
              text-align: center;
              padding-bottom: 10px;
              border-bottom: 2px solid #cbd5e1;
            }
            
            .capa-indice-grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 12px;
            }
            
            .capa-indice-item {
              display: flex;
              align-items: center;
              gap: 12px;
              padding: 12px 15px;
              background: white;
              border-left: 5px solid #0F2A44;
              box-shadow: 0 2px 4px rgba(0,0,0,0.05);
            }
            
            .capa-indice-num {
              width: 32px;
              height: 32px;
              display: flex;
              align-items: center;
              justify-content: center;
              background: #0F2A44;
              border-radius: 50%;
              font-size: 14px;
              font-weight: 700;
              color: white;
              flex-shrink: 0;
            }
            
            .capa-indice-text {
              flex: 1;
            }
            
            .capa-indice-fase {
              font-size: 8px;
              color: #64748b;
              text-transform: uppercase;
              letter-spacing: 1px;
              font-weight: 600;
            }
            
            .capa-indice-nome {
              font-size: 11px;
              font-weight: 600;
              color: #1e293b;
              margin-top: 2px;
            }
            
            /* RODAPÉ DA CAPA */
            .capa-footer {
              margin-top: 25px;
              padding-top: 15px;
              border-top: 2px solid #0F2A44;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            
            .capa-footer-left {
              font-size: 12px;
              font-weight: 700;
              color: #0f172a;
            }
            
            .capa-footer-right {
              font-size: 9px;
              color: #64748b;
              text-align: right;
            }
            
            /* ============ PÁGINAS DE SEÇÃO ============ */
            .section-page {
              min-height: calc(100vh - 25mm);
              display: flex;
              flex-direction: column;
              padding: 0;
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
            
            /* RODAPÉ INDUSTRIAL DAS PÁGINAS */
            .page-footer-industrial {
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 10px 16px;
              margin-top: auto;
              border-top: 2px solid #0F2A44;
              background: #f8fafc;
              font-size: 9px;
            }
            
            .footer-left {
              font-weight: 700;
              color: #0F2A44;
              font-size: 10px;
            }
            
            .footer-center {
              color: #64748b;
              font-size: 9px;
              font-family: 'Consolas', monospace;
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
              
              .header-bar {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                background: #0F2A44 !important;
                color: white !important;
              }
              
              .capa-header-industrial {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                background: #0F2A44 !important;
              }
              
              .capa-indice-num {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                background: #0F2A44 !important;
              }
              
              .page-break { 
                height: 0 !important; 
                visibility: hidden !important; 
              }
            }
          </style>
        </head>
        <body>
          <!-- ========== CAPA ========== -->
          <div class="op-capa">
            <div class="capa-header-industrial">
              <div class="capa-empresa">Vitalnow Industria Ltda</div>
              <div class="capa-main-title">Ordem de Produção Industrial</div>
              <div class="capa-codigo">${op.codigo}</div>
            </div>
            
            <div class="capa-produto-box">
              <div class="capa-produto-label">Produto</div>
              <div class="capa-produto-nome">${op.produto_nome || 'Produto não especificado'}</div>
              <div class="capa-lote-info">Lote: ${op.lote_produto_acabado || '-'}</div>
            </div>
            
            <div class="capa-grid">
              <div class="capa-box">
                <div class="capa-box-label">Total Cápsulas</div>
                <div class="capa-box-valor destaque">${(op.total_capsulas_com_acrescimo || 0).toLocaleString()}</div>
              </div>
              <div class="capa-box">
                <div class="capa-box-label">Frascos × Un</div>
                <div class="capa-box-valor">${op.quantidade_frascos || 0} × ${op.capsulas_por_frasco || 60}</div>
              </div>
              <div class="capa-box">
                <div class="capa-box-label">Data Fabricação</div>
                <div class="capa-box-valor">${op.data_fabricacao ? new Date(op.data_fabricacao).toLocaleDateString('pt-BR') : '-'}</div>
              </div>
              <div class="capa-box">
                <div class="capa-box-label">Data Validade</div>
                <div class="capa-box-valor">${op.data_validade ? new Date(op.data_validade).toLocaleDateString('pt-BR') : '-'}</div>
              </div>
            </div>
            
            <div class="capa-indice">
              <div class="capa-indice-titulo">📑 Índice do Documento</div>
              <div class="capa-indice-grid">
                ${sections.map((s, i) => `
                  <div class="capa-indice-item">
                    <div class="capa-indice-num">${i + 1}</div>
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
