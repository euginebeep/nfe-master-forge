export interface AnvisaLimit {
  auth: boolean;
  min: number;
  max: number | null;
  unit: string;
  norm: string;
  obs?: string;
}

export const ANVISA_LIMITS: Record<string, AnvisaLimit> = {
  // ============================================================
  // VITAMINAS — IN 28/2018 Anexo IV (≥19 anos) consolidada
  // ============================================================
  vitamina_a:          { auth: true,  min: 0,  max: 3000,    unit: 'mcg', norm: 'IN 28 Anexo IV (RAE pré-formada)', obs: '3000 µg = 10.000 UI máx — apenas vit. A pré-formada' },
  vitamina_d3:         { auth: true,  min: 0,  max: 50,      unit: 'mcg', norm: 'IN 28 Anexo IV',                   obs: '50 µg = 2.000 UI — MÁXIMO PERMITIDO IN 28' },
  vitamina_c:          { auth: true,  min: 0,  max: 2000,    unit: 'mg',  norm: 'IN 28 Anexo IV (IN 76/2020)' },
  vitamina_e:          { auth: true,  min: 0,  max: 1000,    unit: 'mg',  norm: 'IN 28 Anexo IV (α-tocoferol)' },
  vitamina_k2:         { auth: true,  min: 0,  max: 149,     unit: 'mcg', norm: 'IN 28 Anexo IV' },
  vitamina_b1:         { auth: true,  min: 0,  max: 2,       unit: 'mg',  norm: 'IN 28 Anexo IV (Tiamina)' },
  vitamina_b2:         { auth: true,  min: 0,  max: 2.74,    unit: 'mg',  norm: 'IN 28 Anexo IV (Riboflavina)' },
  vitamina_b3:         { auth: true,  min: 0,  max: 35,      unit: 'mg',  norm: 'IN 28 Anexo IV (Niacina NE)' },
  vitamina_b5:         { auth: true,  min: 0,  max: 5.64,    unit: 'mg',  norm: 'IN 28 Anexo IV (Ác. Pantotênico)' },
  vitamina_b6:         { auth: true,  min: 0,  max: 100,     unit: 'mg',  norm: 'IN 28 Anexo IV' },
  vitamina_b7:         { auth: true,  min: 0,  max: 45,      unit: 'mcg', norm: 'IN 28 Anexo IV (Biotina)' },
  vitamina_b9:         { auth: true,  min: 0,  max: 400,     unit: 'mcg', norm: 'IN 28 Anexo IV (DFE — IN 76/2020)', obs: 'Máximo 400 mcg DFE — IN 28 Anexo IV. Ácido fólico sintético: 1 mcg = 1,7 mcg DFE.' },
  vitamina_b12:        { auth: true,  min: 0,  max: 9.94,    unit: 'mcg', norm: 'IN 28 Anexo IV' },
  colina:              { auth: true,  min: 0,  max: 3500,    unit: 'mg',  norm: 'IN 28 Anexo IV' },

  // ============================================================
  // MINERAIS — IN 28/2018 Anexo IV (≥19 anos) consolidada
  // ============================================================
  calcio:              { auth: true,  min: 0,  max: 2500,    unit: 'mg',  norm: 'IN 28 Anexo IV' },
  magnesio:            { auth: true,  min: 0,  max: 350,     unit: 'mg',  norm: 'IN 28 Anexo IV',          obs: 'Magnésio elementar — apenas formas suplementares (não inclui alimentar)' },
  ferro:               { auth: true,  min: 0,  max: 45,      unit: 'mg',  norm: 'IN 28 Anexo IV' },
  zinco:               { auth: true,  min: 0,  max: 25,      unit: 'mg',  norm: 'IN 28 Anexo IV',          obs: 'Máximo 25 mg para adultos (IN 28)' },
  cobre:               { auth: true,  min: 0,  max: 10000,   unit: 'mcg', norm: 'IN 28 Anexo IV',          obs: '10 mg = 10.000 µg' },
  selenio:             { auth: true,  min: 0,  max: 400,     unit: 'mcg', norm: 'IN 28 Anexo IV (IN 76/2020)' },
  cromo:               { auth: true,  min: 0,  max: 200,     unit: 'mcg', norm: 'IN 28 Anexo IV',          obs: 'Máximo 200 mcg para adultos (IN 28)' },
  iodo:                { auth: true,  min: 0,  max: 1100,    unit: 'mcg', norm: 'IN 28 Anexo IV (IN 76/2020)' },
  manganes:            { auth: true,  min: 0,  max: 11,      unit: 'mg',  norm: 'IN 28 Anexo IV (IN 76/2020)' },
  molibdenio:          { auth: true,  min: 0,  max: 2000,    unit: 'mcg', norm: 'IN 28 Anexo IV' },
  boro:                { auth: true,  min: 0,  max: 6,       unit: 'mg',  norm: 'IN 28 Anexo IV',          obs: 'Máximo 6 mg para adultos (IN 28)' },
  fosforo:             { auth: true,  min: 0,  max: 4000,    unit: 'mg',  norm: 'IN 28 Anexo IV',          obs: 'Razão Ca/P entre 1:1 e 2:1' },
  fluoreto:            { auth: true,  min: 0,  max: 10,      unit: 'mg',  norm: 'IN 28 Anexo IV' },
  silicio:             { auth: true,  min: 0,  max: null,    unit: 'mg',  norm: 'IN 28 Anexo IV / RDC 240/2018', obs: 'Silício orgânico (monometilsilanetriol) autorizado sem limite máximo definido (NE)' },

  // ============================================================
  // AMINOÁCIDOS — IN 28/2018 Anexo IV (≥19 anos)
  // ============================================================
  leucina:             { auth: true,  min: 0,  max: 5660,    unit: 'mg',  norm: 'IN 28 Anexo IV' },
  lisina:              { auth: true,  min: 0,  max: 4940,    unit: 'mg',  norm: 'IN 28 Anexo IV' },
  valina:              { auth: true,  min: 0,  max: 3600,    unit: 'mg',  norm: 'IN 28 Anexo IV' },
  isoleucina:          { auth: true,  min: 0,  max: 3240,    unit: 'mg',  norm: 'IN 28 Anexo IV' },
  treonina:            { auth: true,  min: 0,  max: 2720,    unit: 'mg',  norm: 'IN 28 Anexo IV' },
  fenilalanina:        { auth: true,  min: 0,  max: 2820,    unit: 'mg',  norm: 'IN 28 Anexo IV' },
  l_tirosina:          { auth: true,  min: 0,  max: 2750,    unit: 'mg',  norm: 'IN 28 Anexo IV' },
  tirosina:            { auth: true,  min: 0,  max: 2750,    unit: 'mg',  norm: 'IN 28 Anexo IV' },
  metionina:           { auth: true,  min: 0,  max: 1530,    unit: 'mg',  norm: 'IN 28 Anexo IV' },
  l_cistina:           { auth: true,  min: 0,  max: 830,     unit: 'mg',  norm: 'IN 28 Anexo IV (Cisteína)' },
  cisteina:            { auth: true,  min: 0,  max: 830,     unit: 'mg',  norm: 'IN 28 Anexo IV' },
  histidina:           { auth: true,  min: 0,  max: 2120,    unit: 'mg',  norm: 'IN 28 Anexo IV' },
  l_triptofano:        { auth: true,  min: 0,  max: 860,     unit: 'mg',  norm: 'IN 28 Anexo IV' },
  triptofano:          { auth: true,  min: 0,  max: 860,     unit: 'mg',  norm: 'IN 28 Anexo IV' },
  l_arginina:          { auth: true,  min: 0,  max: 3810,    unit: 'mg',  norm: 'IN 28 Anexo IV' },
  aspartato:           { auth: true,  min: 0,  max: 5320,    unit: 'mg',  norm: 'IN 28 Anexo IV' },
  glicina:             { auth: true,  min: 0,  max: 2980,    unit: 'mg',  norm: 'IN 28 Anexo IV' },
  serina:              { auth: true,  min: 0,  max: 3151,    unit: 'mg',  norm: 'IN 28 Anexo IV' },
  acido_glutamico:     { auth: true,  min: 0,  max: 15880,   unit: 'mg',  norm: 'IN 28 Anexo IV' },
  prolina:             { auth: true,  min: 0,  max: 5360,    unit: 'mg',  norm: 'IN 28 Anexo IV' },
  alanina:             { auth: true,  min: 0,  max: 3320,    unit: 'mg',  norm: 'IN 28 Anexo IV' },
  glutamina:           { auth: true,  min: 0,  max: 5000,    unit: 'mg',  norm: 'IN 28 Anexo IV' },
  taurina:             { auth: true,  min: 0,  max: 2000,    unit: 'mg',  norm: 'IN 28 Anexo IV' },
  l_carnitina:         { auth: true,  min: 0,  max: 2000,    unit: 'mg',  norm: 'IN 28 Anexo IV' },
  creatina:            { auth: true,  min: 0,  max: 3000,    unit: 'mg',  norm: 'IN 28 Anexo IV' },

  // ============================================================
  // SUBSTÂNCIAS BIOATIVAS — IN 28/2018 Anexo IV (≥19 anos)
  // ============================================================
  cafeina:             { auth: true,  min: 0,  max: 200,     unit: 'mg',  norm: 'IN 28 Anexo IV',          obs: 'Dose individual 200 mg / 400 mg/dia exclusivo p/ atletas' },
  coenzima_q10:        { auth: true,  min: 0,  max: 200,     unit: 'mg',  norm: 'IN 28 Anexo IV' },
  fitoesterois:        { auth: true,  min: 0,  max: 3000,    unit: 'mg',  norm: 'IN 28 Anexo IV',          obs: '3 g/dia máx' },
  licopeno:            { auth: true,  min: 0,  max: 8,       unit: 'mg',  norm: 'IN 28 Anexo IV' },
  luteina:             { auth: true,  min: 0,  max: 10,      unit: 'mg',  norm: 'IN 28 Anexo IV' },
  zeaxantina:          { auth: true,  min: 0,  max: 2,       unit: 'mg',  norm: 'IN 28 Anexo IV' },
  astaxantina:         { auth: true,  min: 0,  max: 8,       unit: 'mg',  norm: 'IN 28 Anexo IV' },
  alicina:             { auth: true,  min: 0,  max: 5.4,     unit: 'mg',  norm: 'IN 28 Anexo IV',          obs: '1 mg alina = 0,45 mg alicina' },
  omega3_epa_dha:      { auth: true,  min: 0,  max: 2000,    unit: 'mg',  norm: 'IN 28 Anexo IV (EPA+DHA)',obs: 'Mínimo 30 mg de DHA' },

  // ============================================================
  // OUTROS / IN ESPECÍFICAS
  // ============================================================
  melatonina:          { auth: true,  min: 0,  max: 0.21,    unit: 'mg',  norm: 'IN 211/2023',             obs: 'Apenas para ≥19 anos — Dose máx 0,21 mg/dia' },
  colageno_tipo2:      { auth: true,  min: 0,  max: 40,      unit: 'mg',  norm: 'IN 28 Anexo IV (não desnaturado UC-II)' },
  colageno_hidrolisado:{ auth: true,  min: 0,  max: null,    unit: 'mg',  norm: 'RDC 243/2018 (ingrediente alimentar)', obs: 'Sem limite específico — proteína' },
  msm:                 { auth: true,  min: 0,  max: 2000,    unit: 'mg',  norm: 'IN 28 Anexo IV (Metilsulfonilmetano)' },
  trans_resveratrol:   { auth: true,  min: 0,  max: 165,     unit: 'mg',  norm: 'IN 28 Anexo IV' },
  acido_hialuronico:   { auth: true,  min: 0,  max: 80,      unit: 'mg',  norm: 'IN 28 Anexo IV' },
  beta_alanina:        { auth: true,  min: 0,  max: null,    unit: 'mg',  norm: 'IN 28 — Sem limite estabelecido (NE)' },

  // ============================================================
  // PROIBIDOS / NÃO LISTADOS — Sujeito a apreensão (RDC 243/2018)
  // ============================================================
  berberina:           { auth: false, min: 0,  max: 0,       unit: '-',   norm: 'PROIBIDO — Não consta IN 28',  obs: 'Substância classificada como medicamento. RDC 243/2018' },
  queratina:           { auth: false, min: 0,  max: 0,       unit: '-',   norm: 'PROIBIDO — Não consta IN 28',  obs: 'Cosmético, não aprovado p/ uso oral' },
  l_citrulina:         { auth: false, min: 0,  max: 0,       unit: '-',   norm: 'NÃO CONSTA IN 28 Anexo I',     obs: 'Não autorizada como suplemento alimentar' },
  silicio_organico:    { auth: true,  min: 0,  max: null,    unit: 'mg',  norm: 'IN 28 Anexo IV / RDC 240/2018', obs: 'Silício orgânico (monometilsilanetriol) sem limite máximo definido (NE)' },
};

// VD_REFERENCE — Valores Diários de Referência (VDR) para SUPLEMENTOS ALIMENTARES
// Fonte: IN nº 75/2020, Anexo VIII, coluna "≥ 19 anos"
// NUNCA confundir com o Anexo II (alimentos em geral) — suplementos usam o Anexo VIII
export const VD_REFERENCE: Record<string, { vd: number; unit: string }> = {
  valor_energetico: { vd: 2000,  unit: 'kcal' },
  carboidratos:     { vd: 300,   unit: 'g'   },
  acucares_adic:    { vd: 50,    unit: 'g'   },
  proteinas:        { vd: 50,    unit: 'g'   },
  gorduras_totais:  { vd: 65,    unit: 'g'   },
  gorduras_sat:     { vd: 20,    unit: 'g'   },
  gorduras_trans:   { vd: 2,     unit: 'g'   },
  gord_mono:        { vd: 20,    unit: 'g'   },
  gord_poli:        { vd: 20,    unit: 'g'   },
  omega6:           { vd: 18,    unit: 'g'   },
  omega3:           { vd: 4000,  unit: 'mg'  },
  colesterol:       { vd: 300,   unit: 'mg'  },
  fibras:           { vd: 25,    unit: 'g'   },
  sodio:            { vd: 2000,  unit: 'mg'  },

  vitamina_a:   { vd: 800,   unit: 'mcg' },
  vitamina_d3:  { vd: 15,    unit: 'mcg' },
  vitamina_d:   { vd: 15,    unit: 'mcg' },
  vitamina_e:   { vd: 15,    unit: 'mg'  },
  vitamina_k2:  { vd: 120,   unit: 'mcg' },
  vitamina_c:   { vd: 100,   unit: 'mg'  },
  vitamina_b1:  { vd: 1.2,   unit: 'mg'  },
  vitamina_b2:  { vd: 1.2,   unit: 'mg'  },
  vitamina_b3:  { vd: 15,    unit: 'mg'  },
  vitamina_b5:  { vd: 5,     unit: 'mg'  },
  vitamina_b6:  { vd: 1.3,   unit: 'mg'  },
  vitamina_b7:  { vd: 30,    unit: 'mcg' },
  vitamina_b9:  { vd: 400,   unit: 'mcg' },
  vitamina_b12: { vd: 2.4,   unit: 'mcg' },

  calcio:     { vd: 1000, unit: 'mg'  },
  cloreto:    { vd: 2300, unit: 'mg'  },
  cobre:      { vd: 900,  unit: 'mcg' },
  cromo:      { vd: 35,   unit: 'mcg' },
  ferro:      { vd: 14,   unit: 'mg'  },
  fluor:      { vd: 4,    unit: 'mg'  },
  fosforo:    { vd: 700,  unit: 'mg'  },
  iodo:       { vd: 150,  unit: 'mcg' },
  magnesio:   { vd: 420,  unit: 'mg'  },
  manganes:   { vd: 3,    unit: 'mg'  },
  molibdenio: { vd: 45,   unit: 'mcg' },
  potassio:   { vd: 3500, unit: 'mg'  },
  selenio:    { vd: 60,   unit: 'mcg' },
  zinco:      { vd: 11,   unit: 'mg'  },
  colina:     { vd: 550,  unit: 'mg'  },
};

// ============================================================
// FUNÇÕES DE CONVERSÃO E CÁLCULO — obrigatórias para laudos corretos
// ============================================================

/** Normaliza a dose para a unidade do limite (ex: UI → mcg, g → mg) */
export function normalizeDoseToLimitUnit(dose: number, unit: string, limitUnit: string, key: string): number {
  const u = (unit || '').toLowerCase().trim();
  const l = (limitUnit || '').toLowerCase().trim();
  if (u === l) return dose;
  if (u === 'g'   && l === 'mg')  return dose * 1000;
  if (u === 'mg'  && l === 'mcg') return dose * 1000;
  if (u === 'mcg' && l === 'mg')  return dose / 1000;
  if (u === 'g'   && l === 'mcg') return dose * 1_000_000;
  // Conversões especiais por UI
  if ((key === 'vitamina_d3' || key === 'vitamina_d') && u === 'ui' && l === 'mcg') return dose / 40;
  if (key === 'vitamina_e' && u === 'ui' && l === 'mg') return dose * 0.67;
  if (key === 'vitamina_a' && u === 'ui' && l === 'mcg') return dose * 0.3;
  return dose;
}

/** Calcula o %VD de um nutriente com conversão de unidade */
export function calcPercentVD(key: string, dose: number, unit: string): string {
  const ref = VD_REFERENCE[key];
  if (!ref) return '**';
  const doseNorm = normalizeDoseToLimitUnit(dose, unit, ref.unit, key);
  return `${Math.round((doseNorm / ref.vd) * 100)}%`;
}

/** Calcula o status regulatório: APROVADO, ATENÇÃO ou BLOQUEADO */
export function calcStatus(key: string, dose: number, unit: string): 'APROVADO' | 'ATENÇÃO' | 'BLOQUEADO' | 'VERIFICAR' {
  const lim = ANVISA_LIMITS[key];
  if (!lim) return 'VERIFICAR';
  if (!lim.auth) return 'BLOQUEADO';
  const doseNorm = normalizeDoseToLimitUnit(dose, unit, lim.unit, key);
  if (lim.max !== null && doseNorm > lim.max) return 'BLOQUEADO';
  if ((lim.min || 0) > 0 && doseNorm < (lim.min || 0)) return 'ATENÇÃO';
  return 'APROVADO';
}

/** Retorna descrição do desvio se a dose ultrapassar o limite máximo */
export function calcDesvio(key: string, dose: number, unit: string): string | null {
  const lim = ANVISA_LIMITS[key];
  if (!lim?.max) return null;
  const doseNorm = normalizeDoseToLimitUnit(dose, unit, lim.unit, key);
  if (doseNorm <= lim.max) return null;
  const pct = Math.round(((doseNorm - lim.max) / lim.max) * 100);
  return `${pct}% acima do limite — corrigir para máx. ${lim.max} ${lim.unit}`;
}

export function resolveAnvisaKey(nome: string): string {
  const n = nome.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[-_\s]+/g, ' ').trim();

  const mapa: Record<string, string> = {
    // Vitamina D
    'vitamina d': 'vitamina_d3', 'vitamina d3': 'vitamina_d3',
    'colecalciferol': 'vitamina_d3', 'vitamina d2': 'vitamina_d3',
    'ergocalciferol': 'vitamina_d3',
    // Vitamina A
    'vitamina a': 'vitamina_a', 'retinol': 'vitamina_a',
    'acetato de retinol': 'vitamina_a', 'palmitato de retinol': 'vitamina_a',
    'betacaroteno': 'vitamina_a', 'beta caroteno': 'vitamina_a',
    // Vitamina C
    'vitamina c': 'vitamina_c', 'acido ascorbico': 'vitamina_c',
    'ascorbato de calcio': 'vitamina_c', 'ascorbato de sodio': 'vitamina_c',
    // Vitamina E
    'vitamina e': 'vitamina_e', 'tocoferol': 'vitamina_e',
    'alfa tocoferol': 'vitamina_e', 'acetato de tocoferol': 'vitamina_e',
    // Vitamina K
    'vitamina k2': 'vitamina_k2', 'vitamina k': 'vitamina_k2',
    'menaquinona': 'vitamina_k2', 'mk 7': 'vitamina_k2',
    'mk7': 'vitamina_k2', 'fitomenadiona': 'vitamina_k2',
    // Vitaminas B
    'vitamina b1': 'vitamina_b1', 'tiamina': 'vitamina_b1',
    'nitrato de tiamina': 'vitamina_b1', 'cloridrato de tiamina': 'vitamina_b1',
    'vitamina b2': 'vitamina_b2', 'riboflavina': 'vitamina_b2',
    'vitamina b3': 'vitamina_b3', 'niacina': 'vitamina_b3',
    'acido nicotinico': 'vitamina_b3', 'nicotinamida': 'vitamina_b3',
    'vitamina b5': 'vitamina_b5', 'acido pantotenico': 'vitamina_b5',
    'pantotenato de calcio': 'vitamina_b5', 'pantenol': 'vitamina_b5',
    'vitamina b6': 'vitamina_b6', 'piridoxina': 'vitamina_b6',
    'cloridrato de piridoxina': 'vitamina_b6',
    'vitamina b7': 'vitamina_b7', 'biotina': 'vitamina_b7',
    'd biotina': 'vitamina_b7',
    'vitamina b9': 'vitamina_b9', 'acido folico': 'vitamina_b9',
    'folato': 'vitamina_b9', 'metilfolato': 'vitamina_b9',
    'l metilfolato': 'vitamina_b9', '5 mthf': 'vitamina_b9',
    'vitamina b12': 'vitamina_b12', 'cobalamina': 'vitamina_b12',
    'metilcobalamina': 'vitamina_b12', 'cianocobalamina': 'vitamina_b12',
    'hidroxocobalamina': 'vitamina_b12',
    // Minerais
    'zinco': 'zinco', 'zinco quelato': 'zinco', 'bisglicinato de zinco': 'zinco',
    'gluconato de zinco': 'zinco', 'oxido de zinco': 'zinco',
    'ferro': 'ferro', 'ferro quelato': 'ferro', 'bisglicinato ferroso': 'ferro',
    'fumarato ferroso': 'ferro', 'sulfato ferroso': 'ferro', 'citrato ferrico': 'ferro',
    'magnesio': 'magnesio', 'magnesio quelato': 'magnesio', 'magnesio dimalato': 'magnesio',
    'magnesio taurato': 'magnesio', 'magnesio citrato': 'magnesio',
    'cloreto de magnesio': 'magnesio', 'oxido de magnesio': 'magnesio',
    'bisglicinato de magnesio': 'magnesio',
    'calcio': 'calcio', 'carbonato de calcio': 'calcio', 'citrato de calcio': 'calcio',
    'bisglicinato de calcio': 'calcio',
    'selenio': 'selenio', 'selenito de sodio': 'selenio', 'selenato de sodio': 'selenio',
    'selenometionina': 'selenio',
    'iodo': 'iodo', 'iodeto de potassio': 'iodo', 'iodato de potassio': 'iodo',
    'manganes': 'manganes', 'sulfato de manganes': 'manganes',
    'cobre': 'cobre', 'sulfato cuprico': 'cobre', 'gluconato cuprico': 'cobre',
    'cromo': 'cromo', 'picolinato de cromo': 'cromo', 'cloreto cromico': 'cromo',
    'boro': 'boro', 'boro quelato': 'boro',
    'fosforo': 'fosforo', 'fosfato': 'fosforo',
    // Substâncias bioativas
    'coenzima q10': 'coenzima_q10', 'ubiquinona': 'coenzima_q10', 'coq10': 'coenzima_q10',
    'cafeina': 'cafeina', 'cafeína': 'cafeina',
    'melatonina': 'melatonina',
    'luteina': 'luteina', 'luteína': 'luteina',
    'zeaxantina': 'zeaxantina',
    'astaxantina': 'astaxantina',
    'msm': 'msm', 'metilsulfonilmetano': 'msm', 'enxofre organico': 'msm',
    'acido hialuronico': 'acido_hialuronico', 'hialuronato': 'acido_hialuronico',
    'colageno tipo 2': 'colageno_tipo2', 'colageno tipo ii': 'colageno_tipo2',
    'uc ii': 'colageno_tipo2', 'ucii': 'colageno_tipo2',
    'colageno nao hidrolisado': 'colageno_tipo2',
    'colageno hidrolisado': 'colageno_hidrolisado', 'gelatina hidrolisada': 'colageno_hidrolisado',
    'omega 3': 'omega3_epa_dha', 'omega3': 'omega3_epa_dha', 'epa': 'omega3_epa_dha',
    'dha': 'omega3_epa_dha', 'oleo de peixe': 'omega3_epa_dha',
    // Aminoácidos
    'l arginina': 'l_arginina', 'arginina': 'l_arginina',
    'taurina': 'taurina', 'l taurina': 'taurina',
    'creatina': 'creatina', 'creatina monoidratada': 'creatina',
    'l triptofano': 'l_triptofano', 'triptofano': 'l_triptofano',
    'l tirosina': 'l_tirosina', 'tirosina': 'l_tirosina',
    'beta alanina': 'beta_alanina',
    'leucina': 'leucina', 'l leucina': 'leucina',
    'isoleucina': 'isoleucina', 'l isoleucina': 'isoleucina',
    'valina': 'valina', 'l valina': 'valina',
    'cistina': 'l_cistina', 'l cistina': 'l_cistina', 'cisteina': 'l_cistina',
    // Extratos e fitoterápicos
    'espirulina': 'espirulina', 'arthrospira': 'espirulina',
    'psyllium': 'psyllium', 'plantago': 'psyllium',
    'curcuma': 'curcuma', 'curcumina': 'curcuma', 'extrato de curcuma': 'curcuma',
    'extrato de açafrão': 'curcuma',
    'laranja moro': 'ext_laranja_moro', 'antocianinas': 'ext_laranja_moro',
    'cha verde': 'cha_verde', 'extrato de cha verde': 'cha_verde', 'camellia sinensis': 'cha_verde',
    'gengibre': 'gengibre', 'zingiber': 'gengibre',
    'feno grego': 'feno_grego', 'trigonella': 'feno_grego',
    'propolis': 'propolis', 'extrato de propolis': 'propolis',
    // Bloqueados
    'berberina': 'berberina',
    'queratina': 'queratina', 'queratina hidrolisada': 'queratina',
    'silicio organico': 'silicio_organico', 'silicio': 'silicio_organico',
    'monometilsilanetriol': 'silicio_organico',
    'citrulina': 'l_citrulina', 'l citrulina': 'l_citrulina', 'citrulina malato': 'l_citrulina',
  };

  // Busca direta
  if (mapa[n]) return mapa[n];

  // Busca parcial — se o nome contém alguma chave do mapa
  for (const [k, v] of Object.entries(mapa)) {
    if (n.includes(k) || k.includes(n)) return v;
  }

  return "";
}

// ORDEM_NUTRIENTES_CORE — ordem EXATA de declaração conforme Anexo XI IN 75/2020
export const ORDEM_NUTRIENTES_CORE = [
  'valor_energetico', 'carboidratos', 'acucares_totais', 'acucares_adic',
  'proteinas', 'gorduras_totais', 'gorduras_sat', 'gorduras_trans',
  'fibras', 'sodio',
];

// Indentação por nível conforme Anexo XII (recuo "n", "nn", "nnn")
export const INDENTACAO_NUTRIENTE: Record<string, 0 | 1 | 2 | 3> = {
  acucares_totais: 1, acucares_adic: 2,
  gorduras_sat: 1, gorduras_trans: 1,
  gord_mono: 1, omega9: 2, acido_oleico: 3,
  gord_poli: 1, omega6: 2, acido_linoleico: 3,
  omega3: 2, acido_linolenico: 3, epa: 3, dha: 3,
  colesterol: 1, fibras: 0,
};

// Regras de arredondamento conforme Anexo III IN 75/2020
export function arredondarValorNutricional(valor: number, unidade: string): string {
  const abs = Math.abs(valor);
  if (abs >= 10) return String(Math.round(valor));
  if (abs >= 1) {
    const rounded = Math.round(valor * 10) / 10;
    return rounded % 1 === 0 ? String(Math.round(rounded)) : rounded.toFixed(1);
  }
  const u = unidade.toLowerCase();
  if (u === 'g') return (Math.round(valor * 10) / 10).toFixed(1);
  if (u === 'mg' || u === 'mcg' || u === '\u03bcg') {
    const rounded2 = Math.round(valor * 100) / 100;
    const str2 = rounded2.toFixed(2);
    return str2.endsWith('0') ? rounded2.toFixed(1) : str2;
  }
  return String(valor);
}

// ============================================================
// GATE DE VALIDAÇÃO PÓS-IA — roda depois do anvisa-ai-verify (Gemini)
// devolver o laudo. A IA é não-determinística: pode gerar doses em UI
// fora de qualquer faixa plausível, ou marcar "ATENÇÃO" (abaixo do
// mínimo) sem ajustar a dose, ao contrário do que faz para "BLOQUEADO"
// (acima do máximo, onde ela corrige pro limite). Este validador pega
// os dois padrões e qualquer outro adicionado aqui, e nunca deixa
// passar silenciosamente — usar antes de exportLaudoA4 e antes de
// importar produto.ativos para formula_itens (White Label).
// ============================================================

export interface AlertaValidacao {
  severidade: 'BLOQUEIO' | 'AVISO';
  ativo: string;
  mensagem: string;
}

// Faixas de UI plausíveis em suplementos comerciais — abaixo disso é
// quase certamente erro de unidade/conversão, não dose real intencional.
const UI_MINIMO_PLAUSIVEL: Record<string, number> = {
  vitamina_a: 100,
  vitamina_d3: 50,
  vitamina_d: 50,
  vitamina_e: 5,
};

export function validarLaudoAntesExport(ativos: any[]): AlertaValidacao[] {
  const alertas: AlertaValidacao[] = [];

  for (const a of ativos) {
    const nome = a.nome || a.name || '(sem nome)';
    const key = resolveAnvisaKey(nome);
    const unit = (a.unit || '').toLowerCase();
    const dose = Number(a.dose) || 0;

    // 1) UI implausível — provável erro de unidade/conversão
    const minPlausivel = UI_MINIMO_PLAUSIVEL[key];
    if (unit === 'ui' && minPlausivel !== undefined && dose > 0 && dose < minPlausivel) {
      alertas.push({
        severidade: 'BLOQUEIO',
        ativo: nome,
        mensagem: `Dose de ${dose} UI é implausível para ${nome} (mínimo comercial esperado ~${minPlausivel} UI). ` +
          `Provável erro de unidade/conversão — confirmar valor real com o RT antes de gerar laudo ou fórmula.`,
      });
    }

    // 2) Massa de ativo que zera ao arredondar — sinaliza pra revisão,
    // mesmo já corrigido o display (não afeta cálculo de Q.S.P. por trás)
    if (unit === 'mg' && dose > 0 && dose < 0.01) {
      alertas.push({
        severidade: 'AVISO',
        ativo: nome,
        mensagem: `Dose de ${dose}mg é extremamente baixa — confirmar se a unidade de origem (mcg/UI) foi convertida corretamente.`,
      });
    }

    // 3) Status ATENÇÃO (abaixo do mínimo) sem dose ajustada — a IA corrige
    // excesso (BLOQUEADO) mas historicamente não corrige falta (ATENÇÃO).
    const status = calcStatus(key, dose, unit);
    if (status === 'ATENÇÃO') {
      const doseAjustada = Number(a.dose_ajustada ?? a.doseAjustada) || dose;
      if (doseAjustada === dose) {
        const lim = ANVISA_LIMITS[key];
        alertas.push({
          severidade: 'AVISO',
          ativo: nome,
          mensagem: `${nome} está abaixo do mínimo regulatório/de mercado e a dose ajustada não foi corrigida ` +
            `(ainda ${dose}${unit}). Sugestão: subir para o mínimo${lim?.min ? ` (${lim.min}${lim.unit})` : ''} ou documentar justificativa técnica do RT para manter a dose atual.`,
        });
      }
    }
  }

  return alertas;
}

/** Bloqueia export/import se houver qualquer alerta de severidade BLOQUEIO */
export function laudoTemBloqueio(alertas: AlertaValidacao[]): boolean {
  return alertas.some(a => a.severidade === 'BLOQUEIO');
}


export function formatarPorcoesEmbalagem(qtdExata: number): string {
  if (qtdExata >= 3 && qtdExata % 1 === 0) return String(qtdExata);
  if (qtdExata > 2) {
    const arredondado = qtdExata % 1 < 0.5 ? Math.floor(qtdExata) : Math.ceil(qtdExata);
    return `Cerca de ${arredondado}`;
  }
  return String(Math.round(qtdExata));
}


