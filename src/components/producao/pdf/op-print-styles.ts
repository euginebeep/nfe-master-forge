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
// ============================================================

export function getTerminalPrintStyles(): string {
  return `
    @page { 
      size: A4; 
      margin: 10mm 12mm; 
    }
    
    * {
      box-sizing: border-box;
    }
    
    body.terminal-mode { 
      font-family: 'Courier New', Courier, monospace; 
      font-size: 10px; 
      line-height: 1.4;
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
      font-size: 11px;
      margin-bottom: 15px;
    }
    
    .terminal-title {
      text-align: center;
      font-weight: bold;
    }
    
    .terminal-footer {
      margin-top: 20px;
      font-family: 'Courier New', monospace;
      font-size: 9px;
      text-align: center;
    }
    
    .page-break {
      page-break-after: always;
    }
    
    /* Tabelas em modo terminal */
    body.terminal-mode table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9px;
      margin-bottom: 10px;
      border: 1px solid #000;
    }
    
    body.terminal-mode th,
    body.terminal-mode td {
      border: 1px solid #000;
      padding: 4px 5px;
      text-align: left;
      vertical-align: middle;
    }
    
    body.terminal-mode th {
      font-weight: 700;
      text-transform: uppercase;
    }
    
    /* Headers em modo terminal */
    body.terminal-mode .bg-gradient-to-r,
    body.terminal-mode [class*="bg-"] {
      background: transparent !important;
      border: 2px solid #000 !important;
      padding: 8px;
    }
    
    /* Badges em modo terminal */
    body.terminal-mode .badge,
    body.terminal-mode [class*="rounded"] {
      border: 1px solid #000 !important;
      padding: 1px 4px;
      font-weight: bold;
    }
    
    /* Números de ordem */
    body.terminal-mode .ordem-num,
    body.terminal-mode [class*="rounded-full"] {
      border: 2px solid #000 !important;
      background: transparent !important;
    }
    
    /* Campos de preenchimento */
    body.terminal-mode .campo-vazio,
    body.terminal-mode [class*="border-b"] {
      border-bottom: 1px solid #000 !important;
      min-height: 14px;
    }
    
    /* Seções */
    body.terminal-mode .section-title,
    body.terminal-mode [class*="border-l-4"] {
      border-left: 4px solid #000 !important;
      background: transparent !important;
      padding: 5px 10px;
      font-weight: bold;
      text-transform: uppercase;
    }
    
    /* Assinaturas */
    body.terminal-mode .assinatura-linha {
      border-bottom: 1px solid #000;
      height: 25px;
    }
    
    /* Grid layout */
    body.terminal-mode .grid {
      display: block !important;
    }
    
    body.terminal-mode .grid > div {
      margin-bottom: 8px;
      padding: 4px;
      border: 1px solid #000;
    }
    
    /* Texto em negrito para destaques */
    body.terminal-mode .font-bold,
    body.terminal-mode .font-semibold,
    body.terminal-mode strong {
      font-weight: 700 !important;
    }
    
    /* Esconder elementos decorativos */
    body.terminal-mode svg,
    body.terminal-mode .lucide {
      display: none !important;
    }
    
    /* Checkboxes em modo terminal */
    body.terminal-mode input[type="checkbox"] {
      -webkit-appearance: none;
      appearance: none;
      width: 12px;
      height: 12px;
      border: 1px solid #000;
      display: inline-block;
      vertical-align: middle;
    }
    
    @media print {
      .no-print { display: none !important; }
      body.terminal-mode { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      body.terminal-mode * { 
        background: transparent !important; 
        color: #000 !important; 
      }
    }
  `;
}
