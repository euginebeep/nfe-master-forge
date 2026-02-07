// ============================================================
// ESTILOS CSS PARA IMPRESSÃO DE OP - FORMATO A4
// ============================================================

export function getOPPrintStyles(): string {
  return `
    @page { 
      size: A4; 
      margin: 12mm 15mm; 
    }
    
    * {
      box-sizing: border-box;
    }
    
    body { 
      font-family: 'Segoe UI', Arial, sans-serif; 
      font-size: 10px; 
      line-height: 1.3;
      color: #1a1a1a;
      margin: 0;
      padding: 0;
    }
    
    .page-break {
      page-break-after: always;
    }
    
    /* CABEÇALHO DA OP */
    .op-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #333;
      padding-bottom: 8px;
      margin-bottom: 12px;
    }
    
    .op-header-left h1 {
      font-size: 14px;
      margin: 0 0 4px 0;
      font-weight: 700;
    }
    
    .op-header-left .subtitle {
      font-size: 10px;
      color: #666;
    }
    
    .op-header-right {
      text-align: right;
    }
    
    .op-codigo {
      font-size: 16px;
      font-family: 'Consolas', monospace;
      font-weight: 700;
      color: #000;
    }
    
    .op-lote {
      font-size: 11px;
      color: #333;
      margin-top: 2px;
    }
    
    /* INFORMAÇÕES DA OP */
    .op-info-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-bottom: 12px;
    }
    
    .op-info-box {
      border: 1px solid #ddd;
      padding: 6px 8px;
      background: #fafafa;
    }
    
    .op-info-box label {
      font-size: 8px;
      color: #666;
      text-transform: uppercase;
      display: block;
      margin-bottom: 2px;
    }
    
    .op-info-box .value {
      font-size: 11px;
      font-weight: 600;
    }
    
    /* SEÇÃO */
    .section {
      margin-bottom: 15px;
    }
    
    .section-title {
      font-size: 11px;
      font-weight: 700;
      background: #e8e8e8;
      padding: 5px 10px;
      margin-bottom: 8px;
      border-left: 4px solid #333;
      text-transform: uppercase;
    }
    
    .section-subtitle {
      font-size: 9px;
      color: #666;
      margin-top: 2px;
      font-weight: 400;
    }
    
    /* TABELA */
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9px;
      margin-bottom: 10px;
    }
    
    th, td {
      border: 1px solid #ccc;
      padding: 5px 6px;
      text-align: left;
      vertical-align: middle;
    }
    
    th {
      background: #f0f0f0;
      font-weight: 600;
      font-size: 8px;
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
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 8px;
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
      width: 22px;
      height: 22px;
      background: #333;
      color: white;
      border-radius: 50%;
      font-weight: 700;
      font-size: 10px;
    }
    
    /* ALERTA */
    .alert-critico {
      background: #f8d7da;
      border: 2px solid #dc3545;
      padding: 10px;
      margin-bottom: 12px;
    }
    
    .alert-critico-title {
      font-weight: 700;
      color: #721c24;
      font-size: 11px;
      margin-bottom: 4px;
    }
    
    .alert-critico-text {
      color: #721c24;
      font-size: 9px;
    }
    
    /* DISTRIBUIÇÃO GEOMÉTRICA */
    .diluicao-box {
      background: #e3f2fd;
      border: 1px solid #2196f3;
      padding: 8px;
      margin-bottom: 8px;
    }
    
    .diluicao-title {
      font-weight: 700;
      color: #1565c0;
      font-size: 10px;
      margin-bottom: 6px;
    }
    
    .diluicao-passo {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 0;
      border-bottom: 1px dotted #90caf9;
    }
    
    .diluicao-passo:last-child {
      border-bottom: none;
    }
    
    .passo-num {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      background: #1565c0;
      color: white;
      border-radius: 50%;
      font-weight: 700;
      font-size: 9px;
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
      gap: 15px;
      margin-top: 20px;
      padding-top: 15px;
      border-top: 1px solid #333;
    }
    
    .assinatura-box {
      text-align: center;
    }
    
    .assinatura-linha {
      border-bottom: 1px solid #333;
      height: 30px;
      margin-bottom: 4px;
    }
    
    .assinatura-label {
      font-size: 9px;
      font-weight: 600;
    }
    
    .assinatura-sublabel {
      font-size: 8px;
      color: #666;
    }
    
    /* CAMPO VAZIO */
    .campo-vazio {
      display: inline-block;
      min-width: 80px;
      border-bottom: 1px solid #333;
    }
    
    .campo-vazio-lg {
      min-width: 150px;
    }
    
    /* CHECKLIST */
    .checklist-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 0;
      border-bottom: 1px dotted #ddd;
    }
    
    .checklist-box {
      width: 14px;
      height: 14px;
      border: 1px solid #333;
      display: inline-block;
    }
    
    .checklist-text {
      flex: 1;
    }
    
    /* RODAPÉ */
    .op-footer {
      margin-top: 15px;
      padding-top: 8px;
      border-top: 1px solid #ddd;
      text-align: center;
      font-size: 8px;
      color: #666;
    }
    
    /* GRID 2 COLUNAS */
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    
    /* ETAPAS DE MISTURA */
    .etapa-mistura {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 6px 8px;
      background: #f5f5f5;
      margin-bottom: 4px;
      border-left: 3px solid #333;
    }
    
    .etapa-num {
      font-weight: 700;
      font-size: 12px;
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
      width: 60px;
      height: 60px;
      border: 2px solid #333;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 7px;
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
// Otimizado para caber em UMA folha A4
// ============================================================

export function getTerminalPrintStyles(): string {
  return `
    @page { 
      size: A4; 
      margin: 5mm 8mm; 
    }
    
    * {
      box-sizing: border-box;
    }
    
    body.terminal-mode { 
      font-family: 'Courier New', Courier, monospace; 
      font-size: 7px; 
      line-height: 1.15;
      color: #000;
      background: #fff;
      margin: 0;
      padding: 0;
    }
    
    /* Remove cores - tudo P&B */
    body.terminal-mode * {
      background-color: transparent !important;
      color: #000 !important;
      border-color: #000 !important;
    }
    
    .terminal-header {
      font-family: 'Courier New', monospace;
      font-size: 8px;
      margin-bottom: 6px;
      border-bottom: 1px solid #000;
      padding-bottom: 4px;
    }
    
    .terminal-title {
      text-align: center;
      font-weight: bold;
    }
    
    .terminal-footer {
      margin-top: 8px;
      font-family: 'Courier New', monospace;
      font-size: 6px;
      text-align: center;
      border-top: 1px solid #000;
      padding-top: 4px;
    }
    
    .page-break {
      page-break-after: always;
    }
    
    /* Tabelas compactas em modo terminal */
    body.terminal-mode table {
      width: 100%;
      border-collapse: collapse;
      font-size: 6px;
      margin-bottom: 4px;
      border: 1px solid #000;
    }
    
    body.terminal-mode th,
    body.terminal-mode td {
      border: 1px solid #000;
      padding: 1px 2px;
      text-align: left;
      vertical-align: middle;
      line-height: 1.1;
    }
    
    body.terminal-mode th {
      font-weight: 700;
      text-transform: uppercase;
      font-size: 5px;
    }
    
    /* Headers compactos */
    body.terminal-mode .bg-gradient-to-r,
    body.terminal-mode [class*="bg-"] {
      background: transparent !important;
      border: 1px solid #000 !important;
      padding: 2px 4px;
      margin-bottom: 3px;
    }
    
    body.terminal-mode h1 {
      font-size: 9px !important;
      margin: 0 !important;
    }
    
    body.terminal-mode p {
      font-size: 6px !important;
      margin: 0 !important;
    }
    
    /* Grid de informações compacto */
    body.terminal-mode .grid {
      display: grid !important;
      gap: 2px !important;
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
    
    body.terminal-mode .grid > div {
      padding: 1px 2px !important;
      border: 1px solid #000;
      font-size: 6px;
    }
    
    /* Badges compactos */
    body.terminal-mode .badge,
    body.terminal-mode [class*="rounded"] {
      border: 1px solid #000 !important;
      padding: 0 2px;
      font-weight: bold;
      font-size: 5px;
    }
    
    /* Números de ordem menores */
    body.terminal-mode .ordem-num,
    body.terminal-mode [class*="rounded-full"] {
      border: 1px solid #000 !important;
      background: transparent !important;
      width: 12px !important;
      height: 12px !important;
      font-size: 6px !important;
    }
    
    /* Campos de preenchimento menores */
    body.terminal-mode .campo-vazio,
    body.terminal-mode [class*="border-b"] {
      border-bottom: 1px solid #000 !important;
      min-height: 8px;
    }
    
    /* Seções compactas */
    body.terminal-mode .section-title,
    body.terminal-mode [class*="border-l-4"] {
      border-left: 2px solid #000 !important;
      background: transparent !important;
      padding: 2px 4px;
      font-weight: bold;
      text-transform: uppercase;
      font-size: 7px;
      margin-bottom: 2px;
    }
    
    /* Assinaturas compactas */
    body.terminal-mode .assinatura-linha {
      border-bottom: 1px solid #000;
      height: 12px;
    }
    
    /* Espaçamentos reduzidos */
    body.terminal-mode .p-2, 
    body.terminal-mode .p-3, 
    body.terminal-mode .p-4,
    body.terminal-mode .p-6 {
      padding: 2px !important;
    }
    
    body.terminal-mode .mb-2,
    body.terminal-mode .mb-3,
    body.terminal-mode .mb-4,
    body.terminal-mode .mb-6 {
      margin-bottom: 3px !important;
    }
    
    body.terminal-mode .mt-4,
    body.terminal-mode .mt-6 {
      margin-top: 4px !important;
    }
    
    body.terminal-mode .gap-2,
    body.terminal-mode .gap-3,
    body.terminal-mode .gap-4 {
      gap: 2px !important;
    }
    
    /* Texto menor para labels */
    body.terminal-mode .text-xs,
    body.terminal-mode .text-sm,
    body.terminal-mode .text-\\[9px\\],
    body.terminal-mode .text-\\[10px\\] {
      font-size: 6px !important;
    }
    
    body.terminal-mode .font-semibold,
    body.terminal-mode .font-bold {
      font-weight: 700 !important;
    }
    
    /* Esconder elementos decorativos */
    body.terminal-mode svg,
    body.terminal-mode .lucide {
      display: none !important;
    }
    
    /* Checkboxes compactos */
    body.terminal-mode input[type="checkbox"] {
      -webkit-appearance: none;
      appearance: none;
      width: 8px;
      height: 8px;
      border: 1px solid #000;
      display: inline-block;
      vertical-align: middle;
    }
    
    /* Min heights reduzidos */
    body.terminal-mode [class*="min-h-"] {
      min-height: 8px !important;
    }
    
    @media print {
      .no-print { display: none !important; }
      body.terminal-mode { 
        -webkit-print-color-adjust: exact; 
        print-color-adjust: exact; 
      }
      body.terminal-mode * { 
        background: transparent !important; 
        color: #000 !important; 
      }
    }
  `;
}
