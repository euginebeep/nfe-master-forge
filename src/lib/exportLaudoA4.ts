import {
  ANVISA_LIMITS,
  VD_REFERENCE,
  calcPercentVD,
  calcStatus,
  calcDesvio,
  resolveAnvisaKey,
  arredondarValorNutricional,
  formatarPorcoesEmbalagem,
} from "@/lib/anvisa-limits";

const C = {
  navy: '#0F2A44',
  navyLight: '#F4F6F8',
  green: '#1F8F5F',
  greenBg: '#EAF3EE',
  greenText: '#1C7A4D',
  red: '#DC2626',
  redBg: '#FCEFEF',
  redText: '#A31F1F',
  amber: '#D4A017',
  amberBg: '#FFFBEF',
  amberText: '#8A5A00',
  gray: '#64748B',
  grayLight: '#94A3B8',
  border: '#D8DDE3',
  textDark: '#1A2535',
};

interface RTInfo {
  nome_completo: string;
  tipo_conselho: string;
  numero_registro: string;
  uf_conselho: string;
}

interface CompanyInfo {
  razao_social?: string;
  nome_fantasia?: string;
  logo_url?: string | null;
}

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
  cliente_logo_url?: string | null;
  ativos: any[];
  company?: CompanyInfo;
  rt?: RTInfo | null;
}

const esc = (s: any): string =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function statusPillStyle(status: string) {
  const map: Record<string, { bg: string; fg: string; border: string }> = {
    'APROVADO':                { bg: C.greenBg, fg: C.greenText, border: '#B9E4CB' },
    'APROVADO COM RESSALVAS':  { bg: C.amberBg, fg: C.amberText, border: '#F0D27A' },
    'BLOQUEADO':               { bg: C.redBg,   fg: C.redText,   border: '#F0BCBC' },
    'ATENÇÃO':                 { bg: C.amberBg, fg: C.amberText, border: '#F0D27A' },
    'VERIFICAR':               { bg: '#F1F0EA', fg: '#5F5E5A',   border: '#D3D1C7' },
  };
  return map[status] || map['VERIFICAR'];
}

function statusBadgeHTML(status: string) {
  const s = statusPillStyle(status);
  return `<span style="display:inline-block;padding:3px 12px;border-radius:4px;font-weight:700;font-size:9.5px;background:${s.bg};color:${s.fg};border:1px solid ${s.border};">${esc(status)}</span>`;
}

function buildComparativoRows(ativos: any[]): string {
  return ativos.map((ativo: any) => {
    const nomeAtivo = ativo.nome || ativo.name || '-';
    const key = (ativo.key || ativo.anvisaKey || resolveAnvisaKey(nomeAtivo) || '').toLowerCase();
    const limit = key ? ANVISA_LIMITS[key] : null;
    const doseOriginal = Number(ativo.dose) || 0;
    const unitOriginal = ativo.unit || 'mg';

    const statusOriginal = key ? calcStatus(key, doseOriginal, unitOriginal) : 'VERIFICAR';
    const desvio = key ? calcDesvio(key, doseOriginal, unitOriginal) : null;
    const removido = limit && !limit.auth;

    let doseCorrigida = doseOriginal;
    let unitCorrigida = unitOriginal;
    let justificativa = 'Sem alteração — em conformidade';

    if (removido) {
      justificativa = `Removido — ${esc(limit?.norm || 'não consta Anexo I IN 28/2018')}`;
    } else if (statusOriginal === 'BLOQUEADO' && limit?.max != null) {
      doseCorrigida = limit.max;
      unitCorrigida = limit.unit;
      justificativa = `Corrigido para o limite máximo — ${esc(limit.norm || 'IN 28/2018 Anexo IV')}`;
    } else if (statusOriginal === 'ATENÇÃO') {
      justificativa = desvio ? esc(desvio) : 'Verificar dose mínima recomendada';
    }

    const corOriginal = statusPillStyle(statusOriginal).fg;
    const linhaDestaque = statusOriginal !== 'APROVADO';

    return `
      <tr style="border-bottom:1px solid #EEF1F4;${linhaDestaque ? `background:${statusOriginal === 'BLOQUEADO' || removido ? C.redBg : C.amberBg};` : ''}">
        <td style="padding:7px 10px;font-size:10px;color:${C.textDark};font-weight:600;">${esc(nomeAtivo)}</td>
        <td style="padding:7px 10px;text-align:center;font-size:10px;color:${corOriginal};font-weight:${linhaDestaque ? 700 : 400};">${esc(doseOriginal)} ${esc(unitOriginal)}</td>
        <td style="padding:7px 10px;text-align:center;">${removido
          ? `<span style="color:${C.redText};font-weight:700;">— REMOVIDO</span>`
          : `<span style="color:${C.greenText};font-weight:700;">${esc(doseCorrigida)} ${esc(unitCorrigida)}</span>`}</td>
        <td style="padding:7px 10px;font-size:9px;color:${C.gray};">${justificativa}</td>
      </tr>`;
  }).join('');
}

function buildTabelaNutricionalOficial(
  ativos: any[],
  massaTotalPorcaoMg: number,
  nCapsulas: number,
  porcoesPorEmbalagem: number
): string {
  const ativosValidos = ativos.filter((a: any) => {
    const key = (a.key || a.anvisaKey || resolveAnvisaKey(a.nome || a.name || '') || '').toLowerCase();
    const limit = key ? ANVISA_LIMITS[key] : null;
    return !(limit && !limit.auth);
  });

  const nutrientesCore = [
    { nome: 'Valor energético', unidade: 'kcal', valor: 0 },
    { nome: 'Carboidratos',      unidade: 'g',   valor: 0 },
    { nome: 'Proteínas',         unidade: 'g',   valor: 0 },
    { nome: 'Gorduras totais',   unidade: 'g',   valor: 0 },
    { nome: 'Fibras alimentares',unidade: 'g',   valor: 0 },
    { nome: 'Sódio',             unidade: 'mg',  valor: 0 },
  ];

  const fatorPara100g = massaTotalPorcaoMg > 0 ? 100000 / massaTotalPorcaoMg : 0;

  const linhasCoreHTML = nutrientesCore.map((nut, i) => {
    const valor100g = arredondarValorNutricional(nut.valor * fatorPara100g, nut.unidade);
    const valorPorcao = arredondarValorNutricional(nut.valor, nut.unidade);
    const isLast = i === nutrientesCore.length - 1;
    return `
      <div class="tn-row${isLast ? ' last' : ''}">
        <div class="tn-nome">${esc(nut.nome)}</div>
        <div class="tn-val">${valor100g} ${nut.unidade}</div>
        <div class="tn-val">${valorPorcao} ${nut.unidade}</div>
        <div class="tn-val">0%</div>
      </div>`;
  }).join('');

  const linhasAtivosHTML = ativosValidos.map((ativo: any, i: number) => {
    const nomeAtivo = ativo.nome || ativo.name || '-';
    const key = (ativo.key || ativo.anvisaKey || resolveAnvisaKey(nomeAtivo) || '').toLowerCase();
    const limit = key ? ANVISA_LIMITS[key] : null;
    let dose = Number(ativo.dose) || 0;
    let unit = ativo.unit || 'mg';

    if (limit && limit.auth && limit.max != null) {
      const status = key ? calcStatus(key, dose, unit) : 'APROVADO';
      if (status === 'BLOQUEADO') {
        dose = limit.max;
        unit = limit.unit;
      }
    }

    const percentVD = key ? calcPercentVD(key, dose, unit) : '**';
    const val100g = arredondarValorNutricional(dose * fatorPara100g, unit);
    const valPorcao = arredondarValorNutricional(dose, unit);
    const isLast = i === ativosValidos.length - 1;

    return `
      <div class="tn-row${isLast ? ' last' : ''}">
        <div class="tn-nome">${esc(nomeAtivo)}</div>
        <div class="tn-val">${val100g} ${esc(unit)}</div>
        <div class="tn-val">${valPorcao} ${esc(unit)}</div>
        <div class="tn-val">${esc(percentVD)}</div>
      </div>`;
  }).join('');

  const porcaoTexto = `Porção: ${nCapsulas} cápsula${nCapsulas > 1 ? 's' : ''} (${Math.round(massaTotalPorcaoMg)} mg)`;
  const porcoesTexto = `Porções por embalagem: ${formatarPorcoesEmbalagem(porcoesPorEmbalagem)}`;

  return `
    <div class="tn-table">
      <div class="tn-titulo">INFORMAÇÃO NUTRICIONAL</div>
      <div class="tn-subtitulo">${esc(porcaoTexto)}</div>
      <div class="tn-subtitulo tn-subtitulo-last">${esc(porcoesTexto)}</div>
      <div class="tn-head-row">
        <div class="tn-nome-head">&nbsp;</div>
        <div class="tn-val-head">100 g</div>
        <div class="tn-val-head">Porção</div>
        <div class="tn-val-head">%VD*</div>
      </div>
      ${linhasCoreHTML}
      ${linhasAtivosHTML}
      <div class="tn-rodape">
        Não contém quantidade significativa de açúcares totais, açúcares adicionados, gorduras saturadas, gorduras trans e colesterol.
        <br/><br/>
        *Percentual de valores diários fornecidos pela porção.<br/>
        **VD não estabelecido.
      </div>
    </div>`;
}

function buildAlertasHTML(alertas: Array<{ tipo: string; titulo: string; corpo: string }>) {
  return (alertas || []).map(a => {
    const styles: Record<string, { bg: string; border: string; fg: string; icon: string }> = {
      err:  { bg: C.redBg,   border: '#F0BCBC', fg: C.redText,   icon: '✕' },
      warn: { bg: C.amberBg, border: '#F0D27A', fg: C.amberText, icon: '⚠' },
      ok:   { bg: C.greenBg, border: '#B9E4CB', fg: C.greenText, icon: '✓' },
      info: { bg: C.navyLight, border: C.border, fg: C.navy,     icon: 'ℹ' },
    };
    const s = styles[a.tipo] || styles.info;
    return `
      <div style="background:${s.bg};border:1px solid ${s.border};border-left:3px solid ${s.fg};color:${s.fg};padding:9px 13px;border-radius:6px;margin-bottom:6px;font-size:10px;">
        <strong style="display:block;margin-bottom:2px;">${s.icon} ${esc(a.titulo)}</strong>
        <span style="opacity:.92;color:${C.textDark};">${esc(a.corpo)}</span>
      </div>`;
  }).join('');
}

function buildHTML(data: LaudoData): string {
  const now = new Date();
  const dataStr = now.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const protocolo = `BX-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getTime()).slice(-6)}`;

  const totalMassa = (data.ativos || []).reduce((acc: number, a: any) => {
    const u = (a.unit || '').toLowerCase();
    const d = Number(a.dose) || 0;
    if (u === 'g') return acc + d * 1000;
    if (u === 'mcg') return acc + d / 1000;
    if (u === 'ui') return acc + d / 40;
    return acc + d;
  }, 0);
  const nCaps = data.sugestao_capsulas?.n || 1;
  const porcoesPorEmbalagem = data.sugestao_capsulas?.frasco
    ? data.sugestao_capsulas.frasco / nCaps
    : 30;

  const comparativoRows = buildComparativoRows(data.ativos || []);
  const nutriTable = buildTabelaNutricionalOficial(data.ativos || [], totalMassa, nCaps, porcoesPorEmbalagem);
  const alertasHTML = buildAlertasHTML(data.alertas || []);
  const permitidasHTML = (data.alegacoes_permitidas || []).map(a => `<li style="margin-bottom:5px;">${esc(a)}</li>`).join('');
  const proibidasHTML = (data.alegacoes_proibidas || []).map(a => `<li style="margin-bottom:5px;">${esc(a)}</li>`).join('');
  const avisosHTML = (data.avisos_rotulo || []).map(a => `<li style="margin-bottom:5px;"><strong>${esc(a)}</strong></li>`).join('');

  const empresaNome = data.company?.nome_fantasia || data.company?.razao_social || 'BrainX ERP';

  const rtAssinaturaHTML = data.rt
    ? `<strong style="color:${C.navy};">${esc(data.rt.nome_completo)}</strong><br/><span style="font-size:8px;color:${C.gray};">${esc(data.rt.tipo_conselho)} ${esc(data.rt.numero_registro)}/${esc(data.rt.uf_conselho)}</span>`
    : `<span style="color:${C.redText};font-size:9px;">⚠ Nenhum RT ativo cadastrado</span>`;

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Laudo de Conformidade - ${esc(data.produto)}</title>
<style>
  @page {
    size: A4 portrait;
    margin: 16mm 14mm 18mm 14mm;
    @bottom-center {
      content: "Página " counter(page) " de " counter(pages);
      font-family: Arial, sans-serif;
      font-size: 8pt;
      color: #94A3B8;
    }
  }
  * { box-sizing: border-box; }
  html, body {
    margin: 0; padding: 0;
    font-family: 'Inter', Arial, Helvetica, sans-serif;
    color: ${C.textDark};
    font-size: 10.5pt;
    line-height: 1.45;
    background-color: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .top-bar { height: 4px; background: linear-gradient(90deg, ${C.navy}, ${C.green}); margin-bottom: 14px; border-radius: 2px; }
  .doc-header { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
  .brand-card { flex: 1; display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 8px; }
  .brand-card.tenant { background: ${C.navyLight}; border-left: 3px solid ${C.navy}; }
  .brand-card.cliente { background: ${C.greenBg}; border-left: 3px solid ${C.green}; }
  .brand-logo-img { height: 36px; width: auto; max-width: 110px; object-fit: contain; }
  .brand-logo-placeholder { width: 32px; height: 32px; border-radius: 7px; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 12px; flex-shrink: 0; }
  .brand-label { font-size: 7.5pt; text-transform: uppercase; letter-spacing: .5px; font-weight: 700; }
  .brand-name { font-size: 10.5pt; font-weight: 800; color: ${C.navy}; line-height: 1.2; }
  .brand-sub { font-size: 7pt; color: ${C.gray}; margin-top: 1px; }
  .meta-bar { display: flex; justify-content: space-between; align-items: center; background: #fff; border: 1px solid ${C.border}; padding: 12px 18px; border-radius: 8px; margin-bottom: 16px; }
  .meta-bar .produto-nome { font-size: 13pt; font-weight: 800; color: ${C.navy}; }
  .meta-bar .protocolo { font-size: 7.5pt; color: ${C.gray}; font-family: 'Courier New', monospace; margin-top: 2px; }
  .info-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 16px; }
  .info-cell { background: #fff; border: 1px solid ${C.border}; border-radius: 7px; padding: 9px 11px; }
  .info-cell .label { font-size: 7pt; text-transform: uppercase; color: ${C.grayLight}; font-weight: 700; letter-spacing: .4px; }
  .info-cell .value { font-size: 10.5pt; font-weight: 700; color: ${C.navy}; margin-top: 2px; }
  h2.section { font-size: 9.5pt; color: ${C.navy}; margin: 18px 0 9px; text-transform: uppercase; letter-spacing: .4px; font-weight: 800; padding-bottom: 6px; border-bottom: 2px solid ${C.green}; display: inline-block; }
  table.cmp { width:100%; border-collapse: collapse; background:#fff; border: 1px solid ${C.border}; border-radius: 8px; overflow: hidden; }
  table.cmp th { background: ${C.navy}; color: #fff; padding: 8px 10px; text-align: left; font-weight: 700; font-size: 8pt; text-transform: uppercase; letter-spacing: .4px; }
  .nutri-row { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 6px; }
  .posologia-card { flex: 1; min-width: 200px; background: #fff; border: 1px solid ${C.border}; border-radius: 8px; padding: 14px; }
  .posologia-card .title { font-size: 8pt; text-transform: uppercase; letter-spacing: .5px; color: ${C.navy}; font-weight: 800; margin-bottom: 10px; }
  .posologia-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 10px; }
  .posologia-grid > div { text-align: center; background: ${C.navyLight}; border-radius: 6px; padding: 8px 4px; }
  .posologia-grid .num { font-size: 16pt; font-weight: 800; color: ${C.navy}; }
  .posologia-grid .num.green { color: ${C.green}; }
  .posologia-grid .lbl { font-size: 6.5pt; color: ${C.gray}; text-transform: uppercase; }
  .duas-colunas { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 4px; }
  .col-ok { background: ${C.greenBg}; border: 1px solid #B9E4CB; border-radius: 8px; padding: 12px 14px; }
  .col-no { background: ${C.redBg}; border: 1px solid #F0BCBC; border-radius: 8px; padding: 12px 14px; }
  .col-ok h3 { color: ${C.greenText}; font-size: 10pt; margin: 0 0 6px; font-weight: 800; }
  .col-no h3 { color: ${C.redText}; font-size: 10pt; margin: 0 0 6px; font-weight: 800; }
  .duas-colunas ul { margin: 0; padding-left: 16px; font-size: 9pt; color: ${C.textDark}; }
  .assinatura { margin-top: 48px; display: grid; grid-template-columns: 1fr 1fr; gap: 30px; font-size: 9pt; text-align: center; }
  .assinatura div { border-top: 1px solid ${C.navy}; padding-top: 10px; }
  .legal { margin-top: 24px; padding-top: 10px; border-top: 1px solid ${C.border}; font-size: 7.5pt; color: ${C.gray}; line-height: 1.5; }
  .legal a { color: ${C.green}; text-decoration: none; font-weight: 600; }
  .protocolo-badge { display:inline-block; font-family:'Courier New',monospace; font-size:7pt; color:${C.grayLight}; border:1px solid ${C.border}; padding:2px 8px; border-radius:4px; margin-top:6px; }
  .page-break { page-break-before: always; }
  section { margin-bottom: 14px; page-break-inside: avoid; }
  .bloco-final { page-break-inside: avoid; margin-top: 32px; }
  .tn-table { width: 320px; background: #fff; color: #000; font-family: Arial, Helvetica, sans-serif; border: 2px solid #000; }
  .tn-titulo { text-align: center; font-weight: 700; font-size: 10pt; text-transform: uppercase; padding: 4px 8px 3px; border-bottom: 3px solid #000; }
  .tn-subtitulo { text-align: center; font-size: 8pt; padding: 2px 8px; border-bottom: 1px solid #000; }
  .tn-subtitulo-last { border-bottom: 2px solid #000; }
  .tn-head-row { display: grid; grid-template-columns: 1fr 50px 76px 40px; border-bottom: 2px solid #000; }
  .tn-nome-head, .tn-val-head { font-size: 8pt; text-align: center; padding: 2px 4px; }
  .tn-row { display: grid; grid-template-columns: 1fr 50px 76px 40px; border-bottom: 1px solid #000; }
  .tn-row.last { border-bottom: 3px solid #000; }
  .tn-nome { font-size: 8pt; text-align: left; padding: 2px 4px; }
  .tn-val { font-size: 8pt; text-align: center; padding: 2px 4px; }
  .tn-rodape { padding: 4px 8px 6px; font-size: 6pt; line-height: 1.35; text-align: left; }
  @media print { .no-print { display: none !important; } }
  .toolbar { position: fixed; top: 12px; right: 12px; z-index: 999; background: ${C.navy}; color: #fff; padding: 10px 16px; border-radius: 6px; font-family: Arial, sans-serif; font-size: 12px; box-shadow: 0 4px 12px rgba(0,0,0,.3); }
  .toolbar button { background: #fff; color: ${C.navy}; border: 0; padding: 6px 14px; border-radius: 4px; font-weight: 700; cursor: pointer; margin-left: 8px; }
</style>
</head>
<body>
  <div class="toolbar no-print">
    📄 Laudo pronto — use o botão para salvar como PDF
    <button onclick="window.print()">🖨️ Salvar como PDF</button>
  </div>

  <div class="top-bar"></div>

  <header class="doc-header">
    <div class="brand-card tenant">
      ${data.company?.logo_url
        ? `<img src="${esc(data.company.logo_url)}" class="brand-logo-img" alt="Logo fabricante" />`
        : `<div class="brand-logo-placeholder" style="background:${C.navy};">${esc(empresaNome.slice(0,2).toUpperCase())}</div>`
      }
      <div>
        <div class="brand-label" style="color:${C.gray};">Fabricante</div>
        <div class="brand-name">${esc(empresaNome)}</div>
        <div class="brand-sub">Módulo Regulatório · ANVISA Checker</div>
      </div>
    </div>
    ${data.cliente ? `
    <div class="brand-card cliente">
      ${data.cliente_logo_url
        ? `<img src="${esc(data.cliente_logo_url)}" class="brand-logo-img" alt="Logo cliente" />`
        : `<div class="brand-logo-placeholder" style="background:${C.green};">${esc(data.cliente.slice(0,2).toUpperCase())}</div>`
      }
      <div>
        <div class="brand-label" style="color:${C.greenText};">Cliente / Marca</div>
        <div class="brand-name">${esc(data.cliente)}</div>
        <div class="brand-sub">Solicitante da análise</div>
      </div>
    </div>` : ''}
  </header>

  <div class="meta-bar">
    <div>
      <div class="produto-nome">${esc(data.produto)}</div>
      <div class="protocolo">Protocolo ${esc(protocolo)} · Emitido em ${esc(dataStr)}</div>
    </div>
    ${statusBadgeHTML(data.status_geral)}
  </div>

  <div class="info-grid">
    <div class="info-cell"><div class="label">Produto</div><div class="value">${esc(data.produto)}</div></div>
    <div class="info-cell"><div class="label">Cliente</div><div class="value">${esc(data.cliente || '—')}</div></div>
    <div class="info-cell"><div class="label">Público-alvo</div><div class="value">Adultos ≥19 anos</div></div>
    <div class="info-cell"><div class="label">Ativos Analisados</div><div class="value">${(data.ativos || []).length} ativo(s)</div></div>
  </div>

  <section>
    <h2 class="section">1. Alertas e Pontos de Atenção</h2>
    ${alertasHTML || `<p style="color:${C.gray};font-size:10pt;">Nenhum alerta crítico identificado.</p>`}
  </section>

  ${data.analise_ia ? `
  <section>
    <h2 class="section">2. Análise Técnica</h2>
    <div style="background:${C.navyLight};border:1px solid ${C.border};border-left:3px solid ${C.navy};padding:11px 14px;border-radius:8px;font-size:10pt;color:${C.textDark};white-space:pre-wrap;">${esc(data.analise_ia)}</div>
  </section>` : ''}

  <section>
    <h2 class="section">3. Comparativo: Fórmula Original vs Ajustada (IN 28/2018)</h2>
    <table class="cmp">
      <thead>
        <tr>
          <th>Ativo</th>
          <th style="text-align:center;">Dose Original</th>
          <th style="text-align:center;">Dose Ajustada</th>
          <th>Justificativa</th>
        </tr>
      </thead>
      <tbody>${comparativoRows}</tbody>
    </table>
  </section>

  <section>
    <h2 class="section">4. Informação Nutricional e Posologia (RDC 429/2020 + IN 75/2020)</h2>
    <div class="nutri-row">
      ${nutriTable}
      <div class="posologia-card">
        <div class="title">Posologia e Embalagem</div>
        <div class="posologia-grid">
          <div><div class="num">${esc(nCaps)}</div><div class="lbl">cápsulas</div></div>
          <div><div class="num green">${esc(data.sugestao_capsulas?.tamanho || '#00')}</div><div class="lbl">tamanho</div></div>
          <div><div class="num">${esc(data.sugestao_capsulas?.frasco || 60)}</div><div class="lbl">frasco</div></div>
        </div>
        <div style="font-size:9pt;color:${C.textDark};line-height:1.6;">
          ▸ Massa de ativos: ${Math.round(totalMassa)} mg<br/>
          ▸ Com excipientes (+30%): ${Math.round(totalMassa * 1.3)} mg<br/>
          ▸ Frasco ${data.sugestao_capsulas?.frasco || 60}un → ${Math.floor((data.sugestao_capsulas?.frasco || 60) / nCaps)} doses
        </div>
        ${data.sugestao_capsulas?.obs ? `<p style="font-size:8pt;color:${C.gray};font-style:italic;margin-top:8px;">${esc(data.sugestao_capsulas.obs)}</p>` : ''}
      </div>
    </div>
  </section>

  <section>
    <h2 class="section">5. Alegações de Rotulagem (IN 28/2018 Anexo V)</h2>
    <div class="duas-colunas">
      <div class="col-ok">
        <h3>✓ Permitidas</h3>
        <ul>${permitidasHTML || `<li style="color:${C.gray};font-style:italic;">Nenhuma alegação aplicável.</li>`}</ul>
      </div>
      <div class="col-no">
        <h3>✕ Proibidas / Avisos</h3>
        <ul>${proibidasHTML}${avisosHTML}</ul>
      </div>
    </div>
  </section>

  <div class="bloco-final">
    <div class="assinatura">
      <div>${rtAssinaturaHTML}</div>
      <div><strong style="color:${C.navy};">Departamento de Qualidade</strong><br/><span style="font-size:8px;color:${C.gray};">${esc(empresaNome)}</span></div>
    </div>
    <div class="legal">
      <p><strong>Base regulatória:</strong> IN 28/2018, RDC 243/2018, RDC 429/2020, IN 75/2020 (Anexo VIII) e atualizações via Power BI ANVISA.</p>
      <p>Documento gerado eletronicamente pelo módulo ANVISA Checker — <a href="https://www.brainxerp.com" target="_blank">www.brainxerp.com</a> — ${esc(empresaNome)}. Caráter orientativo, validar com RT antes de notificação sanitária.</p>
      <div class="protocolo-badge">Protocolo: ${esc(protocolo)}</div>
    </div>
  </div>

  <script>
    window.addEventListener('load', function () {
      setTimeout(function () { try { window.focus(); window.print(); } catch (e) {} }, 400);
    });
  </script>
</body>
</html>`;
}

export function exportLaudoA4(data: LaudoData): void {
  const html = buildHTML(data);
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

  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (e) {
      console.error('Erro ao imprimir laudo:', e);
    }
  }, 600);
}
