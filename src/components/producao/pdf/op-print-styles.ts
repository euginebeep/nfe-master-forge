// ============================================================
// ESTILOS CSS PARA IMPRESSÃO DE OP - FORMATO A4
// ============================================================

export function getOPPrintStyles(): string {
  return `
    @page { 
      size: A4; 
      margin: 8mm 10mm; 
    }
    
    * {
      box-sizing: border-box;
    }
    
    body { 
      font-family: 'Segoe UI', Arial, sans-serif; 
      font-size: 9px; 
      line-height: 1.25;
      color: #1a1a1a;
      margin: 0;
      padding: 0;
    }
    
    .page-break {
      page-break-after: always;
      break-after: page;
    }
    
    /* CAPA DA OP COMPLETA */
    .op-capa {
      page-break-after: always;
      padding: 20px;
    }
    
    .op-capa-titulo {
      text-align: center;
      border-bottom: 3px solid #1e293b;
      padding-bottom: 20px;
      margin-bottom: 25px;
    }
    
    .op-capa-titulo h1 {
      font-size: 22px;
      font-weight: 800;
      color: #1e293b;
      margin: 0 0 10px 0;
      letter-spacing: 2px;
    }
    
    .op-capa-codigo {
      font-size: 32px;
      font-family: 'Consolas', monospace;
      font-weight: 700;
      color: #0f766e;
    }
    
    .op-capa-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin: 20px 0;
    }
    
    .op-capa-box {
      border: 2px solid #e2e8f0;
      padding: 12px;
      text-align: center;
      border-radius: 6px;
    }
    
    .op-capa-box-label {
      font-size: 9px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 4px;
    }
    
    .op-capa-box-valor {
      font-size: 16px;
      font-weight: 700;
      color: #1e293b;
    }
    
    .op-capa-indice {
      background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
      padding: 15px;
      border-radius: 8px;
      margin-top: 25px;
    }
    
    .op-capa-indice-titulo {
      font-size: 11px;
      font-weight: 700;
      color: #334155;
      margin-bottom: 12px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    
    .op-capa-indice-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }
    
    .op-capa-indice-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      background: white;
      border-radius: 4px;
      border-left: 4px solid;
    }
    
    .op-capa-indice-num {
      width: 22px;
      height: 22px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      font-size: 10px;
      font-weight: 700;
      color: white;
    }
    
    /* CABEÇALHO DA OP */
    .op-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #333;
      padding-bottom: 6px;
      margin-bottom: 10px;
    }
    
    .op-header-left h1 {
      font-size: 13px;
      margin: 0 0 3px 0;
      font-weight: 700;
    }
    
    .op-header-left .subtitle {
      font-size: 9px;
      color: #666;
    }
    
    .op-header-right {
      text-align: right;
    }
    
    .op-codigo {
      font-size: 15px;
      font-family: 'Consolas', monospace;
      font-weight: 700;
      color: #000;
    }
    
    .op-lote {
      font-size: 10px;
      color: #333;
      margin-top: 2px;
    }
    
    /* INFORMAÇÕES DA OP */
    .op-info-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 6px;
      margin-bottom: 10px;
    }
    
    .op-info-box {
      border: 1px solid #ddd;
      padding: 5px 7px;
      background: #fafafa;
    }
    
    .op-info-box label {
      font-size: 7px;
      color: #666;
      text-transform: uppercase;
      display: block;
      margin-bottom: 1px;
    }
    
    .op-info-box .value {
      font-size: 10px;
      font-weight: 600;
    }
    
    /* SEÇÃO */
    .section {
      margin-bottom: 12px;
    }
    
    .section-title {
      font-size: 10px;
      font-weight: 700;
      background: #e8e8e8;
      padding: 4px 8px;
      margin-bottom: 6px;
      border-left: 4px solid #333;
      text-transform: uppercase;
    }
    
    .section-subtitle {
      font-size: 8px;
      color: #666;
      margin-top: 1px;
      font-weight: 400;
    }
    
    /* TABELA */
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8px;
      margin-bottom: 8px;
    }
    
    th, td {
      border: 1px solid #ccc;
      padding: 4px 5px;
      text-align: left;
      vertical-align: middle;
    }
    
    th {
      background: #f0f0f0;
      font-weight: 600;
      font-size: 7px;
      text-transform: uppercase;
    }
    
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    
    .row-critico {
      background: #fff3cd !important;
    }
    
    .row-excipiente {
      background: #e8f5e9 !important;
    }
    
    /* BADGE */
    .badge {
      display: inline-block;
      padding: 1px 5px;
      border-radius: 3px;
      font-size: 7px;
      font-weight: 600;
    }
    
    .badge-critico {
      background: #dc3545;
      color: white;
    }
    
    .badge-normal {
      background: #6c757d;
      color: white;
    }
    
    .badge-excipiente {
      background: #28a745;
      color: white;
    }
    
    /* ORDEM NÚMERO */
    .ordem-num {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      background: #333;
      color: white;
      border-radius: 50%;
      font-weight: 700;
      font-size: 9px;
    }
    
    /* ALERTA */
    .alert-critico {
      background: #f8d7da;
      border: 2px solid #dc3545;
      padding: 8px;
      margin-bottom: 10px;
    }
    
    .alert-critico-title {
      font-weight: 700;
      color: #721c24;
      font-size: 10px;
      margin-bottom: 3px;
    }
    
    .alert-critico-text {
      color: #721c24;
      font-size: 8px;
    }
    
    /* DISTRIBUIÇÃO GEOMÉTRICA */
    .diluicao-box {
      background: #e3f2fd;
      border: 1px solid #2196f3;
      padding: 6px;
      margin-bottom: 6px;
    }
    
    .diluicao-title {
      font-weight: 700;
      color: #1565c0;
      font-size: 9px;
      margin-bottom: 4px;
    }
    
    .diluicao-passo {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 2px 0;
      border-bottom: 1px dotted #90caf9;
    }
    
    .diluicao-passo:last-child {
      border-bottom: none;
    }
    
    .passo-num {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 14px;
      height: 14px;
      background: #1565c0;
      color: white;
      border-radius: 50%;
      font-weight: 700;
      font-size: 8px;
    }
    
    .passo-texto {
      flex: 1;
    }
    
    .passo-proporcao {
      font-weight: 600;
      color: #1565c0;
    }
    
    /* CAMPO ASSINATURA */
    .assinatura-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-top: 15px;
      padding-top: 10px;
      border-top: 1px solid #333;
    }
    
    .assinatura-box {
      text-align: center;
    }
    
    .assinatura-linha {
      border-bottom: 1px solid #333;
      height: 22px;
      margin-bottom: 3px;
    }
    
    .assinatura-label {
      font-size: 8px;
      font-weight: 600;
    }
    
    .assinatura-sublabel {
      font-size: 7px;
      color: #666;
    }
    
    /* CAMPO VAZIO */
    .campo-vazio {
      display: inline-block;
      min-width: 60px;
      border-bottom: 1px solid #333;
    }
    
    .campo-vazio-lg {
      min-width: 120px;
    }
    
    /* CHECKLIST */
    .checklist-item {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 3px 0;
      border-bottom: 1px dotted #ddd;
    }
    
    .checklist-box {
      width: 12px;
      height: 12px;
      border: 1px solid #333;
      display: inline-block;
    }
    
    .checklist-text {
      flex: 1;
    }
    
    /* RODAPÉ */
    .op-footer {
      margin-top: 10px;
      padding-top: 6px;
      border-top: 1px solid #ddd;
      text-align: center;
      font-size: 7px;
      color: #666;
    }
    
    /* GRID 2 COLUNAS */
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    
    /* ETAPAS DE MISTURA */
    .etapa-mistura {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 5px 6px;
      background: #f5f5f5;
      margin-bottom: 3px;
      border-left: 3px solid #333;
    }
    
    .etapa-num {
      font-weight: 700;
      font-size: 11px;
      color: #333;
    }
    
    .etapa-descricao {
      flex: 1;
    }
    
    .etapa-tempo {
      font-weight: 600;
      color: #666;
    }
    
    /* QR CODE PLACEHOLDER */
    .qr-placeholder {
      width: 50px;
      height: 50px;
      border: 2px solid #333;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 6px;
      text-align: center;
      color: #666;
    }
    
    @media print {
      .no-print { display: none !important; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  `;
}

// ============================================================
// ESTILOS PARA IMPRESSÃO TERMINAL P&B (Preto e Branco)
// ULTRA-COMPACTO - CABE EM UMA FOLHA A4
// ============================================================

export function getTerminalPrintStyles(): string {
  return `
    @page { 
      size: A4; 
      margin: 4mm 5mm; 
    }
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body.terminal-mode { 
      font-family: 'Courier New', Courier, monospace; 
      font-size: 6.5px !important; 
      line-height: 1.1 !important;
      color: #000 !important;
      background: #fff !important;
    }
    
    /* Remove TODAS as cores - tudo P&B */
    body.terminal-mode *,
    body.terminal-mode *::before,
    body.terminal-mode *::after {
      background-color: transparent !important;
      background-image: none !important;
      background: transparent !important;
      color: #000 !important;
      border-color: #000 !important;
      box-shadow: none !important;
      text-shadow: none !important;
    }
    
    /* ============ CABEÇALHO TERMINAL INDUSTRIAL ============ */
    .terminal-header-industrial {
      margin-bottom: 3px;
    }
    
    .terminal-header-bar {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border: 2px solid #000;
      padding: 3px 5px;
      margin-bottom: 2px;
    }
    
    .terminal-header-left {
      flex: 1;
    }
    
    .terminal-main-title {
      font-size: 9px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .terminal-subtitle {
      font-size: 7px;
      font-weight: bold;
      margin-top: 1px;
    }
    
    .terminal-header-right {
      text-align: right;
    }
    
    .terminal-op-code {
      font-size: 9px;
      font-weight: bold;
      font-family: 'Courier New', monospace;
    }
    
    .terminal-lote {
      font-size: 6px;
      margin-top: 1px;
    }
    
    .terminal-metadata {
      display: flex;
      flex-wrap: wrap;
      gap: 2px 8px;
      padding: 2px 4px;
      border: 1px solid #000;
      border-top: none;
      font-size: 5.5px;
    }
    
    .terminal-meta-item {
      white-space: nowrap;
    }
    
    .terminal-meta-label {
      font-weight: bold;
    }
    
    /* RODAPÉ TERMINAL */
    .terminal-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 3px;
      font-family: 'Courier New', monospace;
      font-size: 5px;
      border-top: 1px solid #000;
      padding-top: 2px;
    }
    
    .terminal-footer-left {
      font-weight: bold;
    }
    
    .terminal-footer-right {
      text-align: right;
    }
    
    .page-break {
      page-break-after: always;
      break-after: page;
    }
    
    /* CABEÇALHOS */
    body.terminal-mode h1,
    body.terminal-mode .text-lg {
      font-size: 8px !important;
      font-weight: bold !important;
      margin: 0 0 2px 0 !important;
    }
    
    body.terminal-mode h2,
    body.terminal-mode h3 {
      font-size: 7px !important;
      font-weight: bold !important;
      margin: 0 !important;
    }
    
    body.terminal-mode p {
      font-size: 6px !important;
      margin: 0 !important;
    }
    
    /* Headers - remover gradients e deixar compacto */
    body.terminal-mode .bg-gradient-to-r,
    body.terminal-mode [class*="bg-gradient"],
    body.terminal-mode [class*="from-slate"],
    body.terminal-mode [class*="to-slate"] {
      background: transparent !important;
      border: 1px solid #000 !important;
      padding: 2px 3px !important;
      margin-bottom: 2px !important;
      border-radius: 0 !important;
    }
    
    /* TABELAS - Ultra compactas */
    body.terminal-mode table {
      width: 100% !important;
      border-collapse: collapse !important;
      font-size: 5.5px !important;
      margin-bottom: 2px !important;
      border: 1px solid #000 !important;
    }
    
    body.terminal-mode th,
    body.terminal-mode td {
      border: 1px solid #000 !important;
      padding: 1px 2px !important;
      text-align: left !important;
      vertical-align: middle !important;
      line-height: 1.05 !important;
      font-size: 5.5px !important;
    }
    
    body.terminal-mode th {
      font-weight: 700 !important;
      text-transform: uppercase !important;
      font-size: 5px !important;
    }
    
    body.terminal-mode thead {
      display: table-header-group !important;
    }
    
    body.terminal-mode tbody tr {
      page-break-inside: avoid !important;
    }
    
    /* Grid de informações - ultra compacto */
    body.terminal-mode .grid {
      display: grid !important;
      gap: 1px !important;
    }
    
    body.terminal-mode .grid-cols-4 {
      grid-template-columns: repeat(4, 1fr) !important;
    }
    
    body.terminal-mode .grid-cols-3 {
      grid-template-columns: repeat(3, 1fr) !important;
    }
    
    body.terminal-mode .grid-cols-2 {
      grid-template-columns: repeat(2, 1fr) !important;
    }
    
    body.terminal-mode .grid > div,
    body.terminal-mode .border {
      padding: 1px 2px !important;
      border: 1px solid #000 !important;
      font-size: 5.5px !important;
      border-radius: 0 !important;
    }
    
    /* Labels e valores */
    body.terminal-mode .text-xs,
    body.terminal-mode .text-sm,
    body.terminal-mode .text-\\[9px\\],
    body.terminal-mode .text-\\[10px\\],
    body.terminal-mode [class*="text-slate"],
    body.terminal-mode [class*="uppercase"] {
      font-size: 5px !important;
    }
    
    body.terminal-mode .font-semibold,
    body.terminal-mode .font-bold {
      font-weight: 700 !important;
      font-size: 6px !important;
    }
    
    body.terminal-mode .font-mono {
      font-family: 'Courier New', monospace !important;
    }
    
    /* Seções e blocos */
    body.terminal-mode .section-title,
    body.terminal-mode [class*="border-l-4"],
    body.terminal-mode [class*="border-l-"] {
      border-left: 2px solid #000 !important;
      background: transparent !important;
      padding: 1px 3px !important;
      font-weight: bold !important;
      text-transform: uppercase !important;
      font-size: 6px !important;
      margin-bottom: 1px !important;
      border-radius: 0 !important;
    }
    
    /* Badges e números */
    body.terminal-mode .badge,
    body.terminal-mode [class*="rounded-full"],
    body.terminal-mode .ordem-num {
      border: 1px solid #000 !important;
      background: transparent !important;
      width: 10px !important;
      height: 10px !important;
      min-width: 10px !important;
      min-height: 10px !important;
      font-size: 5px !important;
      border-radius: 50% !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      padding: 0 !important;
    }
    
    /* Campos de preenchimento */
    body.terminal-mode .campo-vazio,
    body.terminal-mode [class*="border-b-"] {
      border-bottom: 1px solid #000 !important;
      min-height: 6px !important;
    }
    
    /* Assinaturas */
    body.terminal-mode .assinatura-linha,
    body.terminal-mode .h-12,
    body.terminal-mode .h-6 {
      height: 10px !important;
      border-bottom: 1px solid #000 !important;
    }
    
    /* Padding e margins - reduzir ao máximo */
    body.terminal-mode .p-2, 
    body.terminal-mode .p-3, 
    body.terminal-mode .p-4,
    body.terminal-mode .p-6,
    body.terminal-mode .px-2,
    body.terminal-mode .px-3,
    body.terminal-mode .px-4,
    body.terminal-mode .py-2,
    body.terminal-mode .py-3,
    body.terminal-mode .py-4 {
      padding: 1px 2px !important;
    }
    
    body.terminal-mode .mb-2,
    body.terminal-mode .mb-3,
    body.terminal-mode .mb-4,
    body.terminal-mode .mb-6 {
      margin-bottom: 2px !important;
    }
    
    body.terminal-mode .mt-2,
    body.terminal-mode .mt-4,
    body.terminal-mode .mt-6,
    body.terminal-mode .mt-8 {
      margin-top: 2px !important;
    }
    
    body.terminal-mode .gap-2,
    body.terminal-mode .gap-3,
    body.terminal-mode .gap-4,
    body.terminal-mode .gap-8 {
      gap: 1px !important;
    }
    
    body.terminal-mode .space-y-2 > * + *,
    body.terminal-mode .space-y-4 > * + *,
    body.terminal-mode .space-y-6 > * + * {
      margin-top: 1px !important;
    }
    
    /* Rounded - remover */
    body.terminal-mode [class*="rounded"],
    body.terminal-mode .rounded-lg,
    body.terminal-mode .rounded-t-lg {
      border-radius: 0 !important;
    }
    
    /* Esconder ícones SVG */
    body.terminal-mode svg,
    body.terminal-mode .lucide,
    body.terminal-mode [class*="lucide-"] {
      display: none !important;
    }
    
    /* Checkboxes - usar símbolo */
    body.terminal-mode input[type="checkbox"] {
      -webkit-appearance: none;
      appearance: none;
      width: 6px;
      height: 6px;
      border: 1px solid #000;
      display: inline-block;
      vertical-align: middle;
    }
    
    /* Min/max heights reduzidos */
    body.terminal-mode [class*="min-h-"],
    body.terminal-mode [class*="h-"] {
      min-height: 6px !important;
    }
    
    /* Overflow hidden para caber na página */
    body.terminal-mode .overflow-hidden {
      overflow: hidden !important;
    }
    
    /* Alertas - compactos */
    body.terminal-mode [class*="bg-red"],
    body.terminal-mode [class*="bg-amber"],
    body.terminal-mode [class*="bg-yellow"] {
      border: 1px solid #000 !important;
      background: transparent !important;
      padding: 1px 2px !important;
    }
    
    @media print {
      .no-print { display: none !important; }
      body.terminal-mode { 
        -webkit-print-color-adjust: exact !important; 
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }
      body.terminal-mode * { 
        background: transparent !important; 
        color: #000 !important; 
      }
    }
  `;
}
