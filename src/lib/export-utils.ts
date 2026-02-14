/**
 * Export utilities for CSV and simple table-based reports
 */

export function downloadCSV(filename: string, headers: string[], rows: string[][]) {
  const bom = "\uFEFF"; // UTF-8 BOM for Excel compatibility
  const csvContent = [
    headers.join(";"),
    ...rows.map((row) => row.map((cell) => `"${(cell ?? "").replace(/"/g, '""')}"`).join(";")),
  ].join("\n");

  const blob = new Blob([bom + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function printHTMLReport(title: string, tableHTML: string) {
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(`
    <!DOCTYPE html>
    <html><head>
    <title>${title}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
      h1 { font-size: 18px; margin-bottom: 4px; }
      h2 { font-size: 14px; color: #666; font-weight: normal; margin-bottom: 16px; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th { background: #f5f5f5; text-align: left; padding: 8px; border: 1px solid #ddd; font-weight: 600; }
      td { padding: 6px 8px; border: 1px solid #ddd; }
      tr:nth-child(even) { background: #fafafa; }
      .footer { margin-top: 16px; font-size: 10px; color: #999; }
      @media print { body { margin: 0; } }
    </style>
    </head><body>
    <h1>${title}</h1>
    <h2>Gerado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}</h2>
    ${tableHTML}
    <div class="footer">Relatório gerado pelo sistema ERP</div>
    <script>window.print();</script>
    </body></html>
  `);
  win.document.close();
}

export function generateTableHTML(headers: string[], rows: string[][]): string {
  const ths = headers.map((h) => `<th>${h}</th>`).join("");
  const trs = rows
    .map((row) => `<tr>${row.map((c) => `<td>${c ?? ""}</td>`).join("")}</tr>`)
    .join("");
  return `<table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
}
