/**
 * Enhanced PDF export via print window - styled for A4 professional output.
 * Generates a full HTML document optimized for @media print.
 */

interface PDFReportOptions {
  title: string;
  subtitle?: string;
  headers: string[];
  rows: string[][];
  orientation?: 'portrait' | 'landscape';
  companyName?: string;
  logoUrl?: string;
}

export function exportToPDF(options: PDFReportOptions) {
  const { title, subtitle, headers, rows, orientation = 'portrait', companyName, logoUrl } = options;
  const now = new Date();
  const dateStr = now.toLocaleDateString('pt-BR');
  const timeStr = now.toLocaleTimeString('pt-BR');

  const ths = headers.map(h => `<th>${h}</th>`).join('');
  const trs = rows.map((row, i) =>
    `<tr class="${i % 2 === 0 ? 'even' : ''}">` +
    row.map(c => `<td>${c ?? ''}</td>`).join('') +
    '</tr>'
  ).join('');

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>${title}</title>
<style>
  @page { size: A4 ${orientation}; margin: 12mm 15mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Segoe UI', Arial, Helvetica, sans-serif;
    font-size: 10px;
    line-height: 1.4;
    color: #1a1a1a;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .report-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    border-bottom: 2px solid #1a1a1a;
    padding-bottom: 8px;
    margin-bottom: 12px;
  }
  .report-header h1 { font-size: 16px; font-weight: 700; margin-bottom: 2px; }
  .report-header .logo { height: 40px; width: auto; object-contain: contain; margin-bottom: 4px; }
  .report-header .meta { text-align: right; font-size: 9px; color: #666; }
  .report-header .company { font-weight: 600; font-size: 11px; color: #333; }
  .subtitle { font-size: 11px; color: #555; margin-bottom: 10px; }
  table { width: 100%; border-collapse: collapse; font-size: 9px; }
  th {
    background: #e8e8e8;
    font-weight: 600;
    text-align: left;
    padding: 5px 6px;
    border: 1px solid #ccc;
    white-space: nowrap;
  }
  td {
    padding: 4px 6px;
    border: 1px solid #ddd;
    word-break: break-word;
  }
  tr.even { background: #f7f7f7; }
  .summary {
    margin-top: 10px;
    font-size: 9px;
    color: #666;
    display: flex;
    justify-content: space-between;
  }
  .footer {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    text-align: center;
    font-size: 8px;
    color: #999;
    padding: 4px;
    border-top: 1px solid #eee;
  }
  @media screen {
    body { max-width: 1000px; margin: 20px auto; padding: 20px; }
  }
</style>
</head>
<body>
  <div class="report-header">
    <div>
      ${logoUrl ? `<img src="${logoUrl}" alt="Logo" class="logo" />` : ''}
      <h1>${title}</h1>
      ${subtitle ? `<p class="subtitle">${subtitle}</p>` : ''}
    </div>
    <div class="meta">
      ${companyName ? `<p class="company">${companyName}</p>` : ''}
      <p>Gerado em ${dateStr} às ${timeStr}</p>
      <p>${rows.length} registro(s)</p>
    </div>
  </div>
  <table>
    <thead><tr>${ths}</tr></thead>
    <tbody>${trs}</tbody>
  </table>
  <div class="summary">
    <span>Total: ${rows.length} registros</span>
    <span>${title} — ${dateStr}</span>
  </div>
  <div class="footer">Relatório gerado automaticamente pelo sistema ERP</div>
  <script>window.onload = function() { window.print(); };</script>
</body>
</html>`;

  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(html);
  w.document.close();
}
