import { ANVISA_LIMITS, VD_REFERENCE } from "@/lib/anvisa-limits";

interface LaudoData {
  status_geral: string;
  alertas: Array<{ tipo: 'err' | 'warn' | 'ok' | 'info'; titulo: string; corpo: string }>;
  analise_ia: string;
  alegacoes_permitidas: string[];
  alegacoes_proibidas: string[];
  avisos_rotulo: string[];
  sugestao_capsulas: { n: number; tamanho: string; frasco: number; obs: string };
  produto: string;
  cliente?: string;
  ativos: any[];
}

const esc = (s: any): string =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function statusBadge(status: string) {
  const map: Record<string, { bg: string; fg: string }> = {
    'APROVADO':                { bg: '#dcfce7', fg: '#166534' },
    'APROVADO COM RESSALVAS':  { bg: '#fef9c3', fg: '#854d0e' },
    'BLOQUEADO':               { bg: '#fee2e2', fg: '#991b1b' },
    'ATENCAO':                 { bg: '#fef9c3', fg: '#854d0e' },
    'VERIFICAR':               { bg: '#ffedd5', fg: '#9a3412' },
  };
  const c = map[status] || { bg: '#e5e7eb', fg: '#1f2937' };
  return `<span style="display:inline-block;padding:3px 10px;border-radius:4px;font-weight:700;font-size:10px;background:${c.bg};color:${c.fg};">${esc(status)}</span>`;
}

function buildHTML(data: LaudoData): string {
  const now = new Date();
  const dataStr = now.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const protocolo = `BX-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getTime()).slice(-6)}`;

  const ativosRows = (data.ativos || []).map((ativo: any) => {
    const key = (ativo.key || ativo.anvisaKey || '').toLowerCase();
    const limit = key ? ANVISA_LIMITS[key] : null;
    const doseNum = parseFloat(ativo.dose);
    const nomeAtivo = ativo.nome || ativo.name || '-';
    let status = 'VERIFICAR';
    if (limit) {
      if (!limit.auth) status = 'BLOQUEADO';
      else if (limit.max !== null && doseNum > limit.max) status = 'ATENCAO';
      else if (doseNum < limit.min) status = 'ATENCAO';
      else status = 'APROVADO';
    }
    return `
      <tr>
        <td style="font-weight:600;">${esc(nomeAtivo)}</td>
        <td style="text-align:center;">${esc(ativo.dose)} ${esc(ativo.unit || '')}</td>
        <td style="text-align:center;">${limit?.max != null ? `${limit.max} ${esc(limit.unit)}` : 'NE'}</td>
        <td style="font-size:9px;color:#555;">${esc(limit?.norm || '-')}</td>
        <td style="text-align:center;">${statusBadge(status)}</td>
      </tr>`;
  }).join('');

  const nutriRows = (data.ativos || []).map((ativo: any) => {
    const key = (ativo.key || ativo.anvisaKey || '').toLowerCase();
    const vdRef = key ? VD_REFERENCE[key] : null;
    const limit = key ? ANVISA_LIMITS[key] : null;
    const nomeAtivo = ativo.nome || ativo.name || '-';
    const doseOriginal = parseFloat(ativo.dose) || 0;
    const unitOriginal = ativo.unit || '';
    // Aplica correção IN 28/2018: se acima do limite ANVISA, ajusta para o máximo permitido
    let doseCorrigida = doseOriginal;
    let unitCorrigida = unitOriginal;
    let corrigido = false;
    if (limit && limit.auth && limit.max != null && doseOriginal > limit.max) {
      doseCorrigida = limit.max;
      unitCorrigida = limit.unit;
      corrigido = true;
    }
    let doseMg = doseCorrigida;
    const u = (unitCorrigida || '').toLowerCase();
    if (u === 'mcg') doseMg /= 1000;
    if (u === 'g') doseMg *= 1000;
    const percentVD = vdRef ? Math.round((doseMg / vdRef) * 100) : null;
    const doseCell = corrigido
      ? `<span style="text-decoration:line-through;color:#999;font-weight:500;">${esc(ativo.dose)} ${esc(unitOriginal)}</span><br/><strong style="color:#16a34a;">Tabela Nutricional Corrigida: ${doseCorrigida} ${esc(unitCorrigida)}</strong>`
      : `${esc(ativo.dose)} ${esc(unitOriginal)}`;
    return `
      <tr>
        <td style="font-weight:600;">${esc(nomeAtivo)}</td>
        <td style="text-align:center;">${doseCell}</td>
        <td style="text-align:center;font-weight:700;">${percentVD !== null ? percentVD + '%' : '**'}</td>
      </tr>`;
  }).join('');

  const alertasHTML = (data.alertas || []).map(a => {
    const colors = a.tipo === 'err'
      ? { bg: '#fef2f2', bd: '#fecaca', fg: '#7f1d1d', icon: '✕' }
      : a.tipo === 'warn'
      ? { bg: '#fffbeb', bd: '#fde68a', fg: '#78350f', icon: '⚠' }
      : { bg: '#f0fdf4', bd: '#bbf7d0', fg: '#14532d', icon: '✓' };
    return `
      <div style="background:${colors.bg};border:1px solid ${colors.bd};color:${colors.fg};padding:8px 12px;border-radius:4px;margin-bottom:6px;font-size:10px;">
        <strong style="display:block;margin-bottom:2px;">${colors.icon} ${esc(a.titulo)}</strong>
        <span style="opacity:.9">${esc(a.corpo)}</span>
      </div>`;
  }).join('');

  const permitidasHTML = (data.alegacoes_permitidas || []).map(a => `<li>${esc(a)}</li>`).join('');
  const proibidasHTML = (data.alegacoes_proibidas || []).map(a => `<li>${esc(a)}</li>`).join('');
  const avisosHTML = (data.avisos_rotulo || []).map(a => `<li><strong>${esc(a)}</strong></li>`).join('');

  const statusColor = data.status_geral === 'APROVADO' ? '#16a34a'
    : data.status_geral === 'BLOQUEADO' ? '#dc2626'
    : '#d97706';

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Laudo de Conformidade - ${esc(data.produto)}</title>
<style>
  @page {
    size: A4 portrait;
    margin: 18mm 15mm 20mm 15mm;
    @bottom-center {
      content: "Página " counter(page) " de " counter(pages);
      font-family: Arial, sans-serif;
      font-size: 9pt;
      color: #666;
    }
  }
  * { box-sizing: border-box; }
  html, body {
    margin: 0; padding: 0;
    font-family: Arial, Helvetica, sans-serif;
    color: #000;
    font-size: 10.5pt;
    line-height: 1.45;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  /* Cabeçalho institucional */
  .doc-header {
    border-bottom: 3px solid #0f172a;
    padding-bottom: 12px;
    margin-bottom: 18px;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .brand-logo {
    width: 44px; height: 44px;
    background: linear-gradient(135deg, #0f172a, #1e40af);
    color: #fff;
    border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    font-weight: 900; font-size: 20px;
    letter-spacing: -1px;
  }
  .brand-name { font-size: 16pt; font-weight: 800; color: #0f172a; letter-spacing: -0.5px; }
  .brand-sub  { font-size: 8.5pt; color: #475569; margin-top: 2px; }
  .doc-meta { text-align: right; font-size: 9pt; color: #475569; line-height: 1.6; }
  .doc-meta strong { color: #0f172a; }

  .doc-title-bar {
    background: #0f172a;
    color: #fff;
    padding: 10px 16px;
    border-radius: 4px;
    margin-bottom: 18px;
    display: flex; justify-content: space-between; align-items: center;
  }
  .doc-title-bar h1 {
    font-size: 14pt; margin: 0; font-weight: 700; letter-spacing: 0.3px;
    text-transform: uppercase;
  }
  .status-pill {
    background: ${statusColor};
    color: #fff;
    padding: 4px 14px;
    border-radius: 20px;
    font-weight: 700;
    font-size: 10pt;
    text-transform: uppercase;
  }

  .info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px 24px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    padding: 12px 16px;
    border-radius: 4px;
    margin-bottom: 18px;
  }
  .info-grid .label {
    font-size: 9pt; text-transform: uppercase;
    color: #000; letter-spacing: 0; font-weight: 700;
  }
  .info-grid .value { font-size: 11pt; font-weight: 700; color: #000; }

  h2.section {
    font-size: 12pt; color: #000; margin: 18px 0 8px;
    padding: 4px 0 4px 10px; border-left: 4px solid #1e40af;
    text-transform: uppercase; letter-spacing: 0; font-weight: 800;
    page-break-after: avoid;
  }

  table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
  table th {
    background: #0f172a; color: #fff; padding: 6px 8px;
    text-align: left; font-weight: 700; font-size: 9.5pt;
    text-transform: uppercase; letter-spacing: 0;
  }
  table td {
    padding: 6px 8px; border-bottom: 1px solid #e5e7eb; vertical-align: middle;
  }
  table tr:nth-child(even) td { background: #f8fafc; }

  .analise-box {
    background: #eff6ff; border: 1px solid #bfdbfe;
    border-left: 4px solid #1e40af;
    padding: 10px 14px; border-radius: 4px;
    font-style: italic; font-size: 10pt; color: #1e3a8a;
    white-space: pre-wrap;
  }

  .nutri {
    border: 2px solid #000; padding: 10px;
    max-width: 380px; margin: 0 auto;
    background: #fff; color: #000; font-family: Arial, sans-serif;
  }
  .nutri h3 {
    text-align:center; font-size: 14pt; font-weight: 900; font-style: italic;
    margin: 0 0 6px; padding-bottom: 4px; border-bottom: 2px solid #000;
    letter-spacing: -0.5px;
  }
  .nutri table th { background:#fff; color:#000; border:1px solid #000; padding:3px 5px; font-size: 8.5pt; }
  .nutri table td { border:1px solid #000; padding:3px 5px; font-size: 9pt; font-weight:700; }

  .capsulas {
    display:grid; grid-template-columns:repeat(3,1fr); gap:12px;
    background:#f8fafc; border:1px solid #e2e8f0; padding:14px; border-radius:4px;
    text-align:center;
  }
  .capsulas .lbl { font-size: 8pt; text-transform: uppercase; color:#64748b; font-weight: 700; }
  .capsulas .val { font-size: 16pt; font-weight: 800; color:#000; margin-top: 2px; }

  .duas-colunas { display:grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .duas-colunas ul { margin: 0; padding-left: 18px; font-size: 10pt; }
  .duas-colunas li { margin-bottom: 4px; }
  .col-ok h3 { color:#16a34a; font-size:11pt; border-left:4px solid #16a34a; padding-left:8px; margin: 0 0 6px; }
  .col-no h3 { color:#dc2626; font-size:11pt; border-left:4px solid #dc2626; padding-left:8px; margin: 0 0 6px; }

  .legal {
    margin-top: 24px; padding-top: 10px;
    border-top: 1px solid #cbd5e1;
    font-size: 8pt; color: #475569; line-height: 1.5;
  }
  .assinatura {
    margin-top: 30px; display: grid; grid-template-columns: 1fr 1fr; gap: 30px;
    font-size: 9pt; text-align: center;
  }
  .assinatura div { border-top: 1px solid #0f172a; padding-top: 4px; }

  .page-break { page-break-before: always; }
  section { page-break-inside: avoid; margin-bottom: 14px; }

  @media print { .no-print { display: none !important; } }
  .toolbar {
    position: fixed; top: 12px; right: 12px; z-index: 999;
    background: #0f172a; color: #fff; padding: 10px 16px;
    border-radius: 6px; font-family: Arial, sans-serif; font-size: 12px;
    box-shadow: 0 4px 12px rgba(0,0,0,.3);
  }
  .toolbar button {
    background: #fff; color: #0f172a; border: 0;
    padding: 6px 14px; border-radius: 4px; font-weight: 700; cursor: pointer; margin-left: 8px;
  }
</style>
</head>
<body>
  <div class="toolbar no-print">
    📄 Laudo pronto — use o botão para salvar como PDF
    <button onclick="window.print()">🖨️ Salvar como PDF</button>
  </div>

  <!-- CABEÇALHO INSTITUCIONAL -->
  <header class="doc-header">
    <div class="brand">
      <div class="brand-logo">BX</div>
      <div>
        <div class="brand-name">BrainX ERP</div>
        <div class="brand-sub">Módulo Regulatório · ANVISA Checker</div>
        <div class="brand-sub">Conformidade IN 28/2018 · RDC 243/2018 · RDC 27/2010</div>
      </div>
    </div>
    <div class="doc-meta">
      <div><strong>Protocolo:</strong> ${esc(protocolo)}</div>
      <div><strong>Emissão:</strong> ${esc(dataStr)}</div>
      <div><strong>Documento:</strong> Laudo de Conformidade Regulatória</div>
    </div>
  </header>

  <!-- FAIXA DE TÍTULO + STATUS -->
  <div class="doc-title-bar">
    <h1>Relatório de Conformidade Regulatória</h1>
    <span class="status-pill">${esc(data.status_geral)}</span>
  </div>

  <!-- DADOS DO PRODUTO -->
  <div class="info-grid">
    <div>
      <div class="label">Produto</div>
      <div class="value">${esc(data.produto)}</div>
    </div>
    <div>
      <div class="label">Cliente / Solicitante</div>
      <div class="value">${esc(data.cliente || '—')}</div>
    </div>
    <div>
      <div class="label">Público-alvo</div>
      <div class="value">Adultos ≥ 19 anos</div>
    </div>
    <div>
      <div class="label">Total de Ativos Analisados</div>
      <div class="value">${(data.ativos || []).length} ativo(s)</div>
    </div>
  </div>

  <!-- ALERTAS -->
  <section>
    <h2 class="section">1. Alertas e Pontos de Atenção</h2>
    ${alertasHTML || '<p style="color:#64748b;font-size:10pt;">Nenhum alerta crítico identificado.</p>'}
  </section>

  <!-- ANÁLISE IA -->
  <section>
    <h2 class="section">2. Análise Técnica</h2>
    <div class="analise-box">${esc(data.analise_ia)}</div>
  </section>

  <!-- TABELA DE ATIVOS -->
  <section>
    <h2 class="section">3. Tabela de Ativos Verificados</h2>
    <table>
      <thead>
        <tr>
          <th>Ativo / Ingrediente</th>
          <th style="text-align:center;">Dose Declarada</th>
          <th style="text-align:center;">Limite ANVISA</th>
          <th>Referência Normativa</th>
          <th style="text-align:center;">Status</th>
        </tr>
      </thead>
      <tbody>${ativosRows}</tbody>
    </table>
  </section>

  <!-- TABELA NUTRICIONAL -->
  <section>
    <h2 class="section">4. Tabela Nutricional Corrigida (RDC 429/2020 · IN 28/2018)</h2>
    <div class="nutri">
      <h3>INFORMAÇÃO NUTRICIONAL (CORRIGIDA)</h3>
      <table style="width:100%;">
        <thead>
          <tr>
            <th style="text-align:left;">Nutriente</th>
            <th style="text-align:center;">Qtd / Dose</th>
            <th style="text-align:center;">%VD*</th>
          </tr>
        </thead>
        <tbody>${nutriRows}</tbody>
      </table>
      <p style="font-size:7pt;margin:6px 0 0;font-style:italic;">* % Valores Diários com base em uma dieta de 2.000 kcal ou 8.400 kJ.</p>
      <p style="font-size:7pt;margin:2px 0 0;font-weight:700;">** VD NÃO ESTABELECIDO PELA ANVISA.</p>
      <p style="font-size:7pt;margin:4px 0 0;color:#16a34a;font-weight:700;">⚙ Doses ajustadas automaticamente conforme limites máximos da IN 28/2018 e Painel ANVISA Power BI.</p>
    </div>
  </section>

  <!-- CÁPSULAS -->
  <section>
    <h2 class="section">5. Sugestão de Apresentação</h2>
    <div class="capsulas">
      <div>
        <div class="lbl">Dose Sugerida</div>
        <div class="val">${esc(data.sugestao_capsulas?.n)} caps</div>
      </div>
      <div>
        <div class="lbl">Tamanho</div>
        <div class="val">${esc(data.sugestao_capsulas?.tamanho)}</div>
      </div>
      <div>
        <div class="lbl">Frasco</div>
        <div class="val">${esc(data.sugestao_capsulas?.frasco)} unid.</div>
      </div>
    </div>
    ${data.sugestao_capsulas?.obs ? `<p style="font-size:9pt;color:#475569;font-style:italic;text-align:center;margin-top:8px;">${esc(data.sugestao_capsulas.obs)}</p>` : ''}
  </section>

  <!-- ALEGAÇÕES -->
  <section>
    <h2 class="section">6. Alegações de Rotulagem</h2>
    <div class="duas-colunas">
      <div class="col-ok">
        <h3>✓ Permitidas</h3>
        <ul>${permitidasHTML || '<li style="color:#64748b;font-style:italic;">Nenhuma alegação aplicável.</li>'}</ul>
      </div>
      <div class="col-no">
        <h3>✕ Proibidas / Avisos Obrigatórios</h3>
        <ul>${proibidasHTML}${avisosHTML}</ul>
      </div>
    </div>
  </section>

  <!-- ASSINATURA -->
  <div class="assinatura">
    <div>Responsável Técnico<br/><small>CRF / CRN / CRQ</small></div>
    <div>Departamento de Qualidade<br/><small>BrainX ERP</small></div>
  </div>

  <!-- RODAPÉ LEGAL -->
  <div class="legal">
    <p><strong>Base regulatória:</strong> Instrução Normativa IN nº 28/2018 (ANVISA), RDC 243/2018, RDC 27/2010, RDC 429/2020 e atualizações.</p>
    <p>Este documento foi gerado eletronicamente pelo módulo ANVISA Checker do BrainX ERP. As informações apresentadas têm caráter orientativo e devem ser validadas pelo Responsável Técnico antes da emissão de rotulagem ou notificação sanitária. Protocolo: ${esc(protocolo)}.</p>
  </div>

  <script>
    // Abre a janela de impressão automaticamente para "Salvar como PDF"
    window.addEventListener('load', function () {
      setTimeout(function () { try { window.focus(); window.print(); } catch (e) {} }, 400);
    });
  </script>
</body>
</html>`;
}

/**
 * Gera o laudo em A4 em um iframe oculto e dispara o diálogo de impressão
 * para que o usuário possa salvar como PDF — sem abrir novas abas.
 */
export function exportLaudoA4(data: LaudoData): void {
  const html = buildHTML(data);

  // Remove iframe anterior se houver
  const old = document.getElementById('laudo-export-iframe');
  if (old) old.remove();

  const iframe = document.createElement('iframe');
  iframe.id = 'laudo-export-iframe';
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) throw new Error('Não foi possível criar o iframe de exportação');
  doc.open();
  doc.write(html);
  doc.close();

  // Aguarda render e dispara o print do iframe
  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (e) {
      console.error('Erro ao imprimir laudo:', e);
    }
  }, 600);
}