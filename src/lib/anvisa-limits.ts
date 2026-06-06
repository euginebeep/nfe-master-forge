export interface AnvisaLimit {
  auth: boolean;
  min: number;
  max: number | null;
  unit: string;
  norm: string;
  obs?: string;
}

export const ANVISA_LIMITS: Record<string, AnvisaLimit> = {
  vitamina_d3:         { auth: true,  min: 0,  max: 50,    unit: 'mcg', norm: 'IN 28 Anexo IV',          obs: '50 mcg = 2.000 UI — NÃO 4.000 UI' },
  vitamina_a:          { auth: true,  min: 0,  max: 3000,  unit: 'mcg', norm: 'IN 28 Anexo IV' },
  vitamina_c:          { auth: true,  min: 0,  max: 1000,  unit: 'mg',  norm: 'IN 28 Anexo IV' },
  vitamina_e:          { auth: true,  min: 0,  max: 1000,  unit: 'mg',  norm: 'IN 28 Anexo IV' },
  vitamina_b1:         { auth: true,  min: 0,  max: null,  unit: 'mg',  norm: 'IN 28 — NE' },
  vitamina_b2:         { auth: true,  min: 0,  max: null,  unit: 'mg',  norm: 'IN 28 — NE' },
  vitamina_b3:         { auth: true,  min: 0,  max: 35,    unit: 'mg',  norm: 'IN 28 Anexo IV (NE)' },
  vitamina_b5:         { auth: true,  min: 0,  max: null,  unit: 'mg',  norm: 'IN 28 — NE' },
  vitamina_b6:         { auth: true,  min: 0,  max: 100,   unit: 'mg',  norm: 'IN 28 Anexo IV' },
  vitamina_b7:         { auth: true,  min: 0,  max: null,  unit: 'mcg', norm: 'IN 28 — NE' },
  vitamina_b9:         { auth: true,  min: 0,  max: 400,   unit: 'mcg', norm: 'IN 28 Anexo IV (DFE)' },
  vitamina_b12:        { auth: true,  min: 0,  max: null,  unit: 'mcg', norm: 'IN 28 — NE' },
  vitamina_k2:         { auth: true,  min: 0,  max: null,  unit: 'mcg', norm: 'IN 28 — NE' },
  zinco:               { auth: true,  min: 0,  max: 25,    unit: 'mg',  norm: 'IN 28 Anexo IV' },
  ferro:               { auth: true,  min: 0,  max: 45,    unit: 'mg',  norm: 'IN 28 Anexo IV' },
  magnesio:            { auth: true,  min: 0,  max: 750,   unit: 'mg',  norm: 'IN 28 Anexo IV (elementar)' },
  calcio:              { auth: true,  min: 0,  max: 2500,  unit: 'mg',  norm: 'IN 28 Anexo IV' },
  selenio:             { auth: true,  min: 0,  max: 200,   unit: 'mcg', norm: 'IN 28 Anexo IV' },
  cromo:               { auth: true,  min: 0,  max: 200,   unit: 'mcg', norm: 'IN 28 Anexo IV' },
  iodo:                { auth: true,  min: 0,  max: 600,   unit: 'mcg', norm: 'IN 28 Anexo IV' },
  cobre:               { auth: true,  min: 0,  max: 8000,  unit: 'mcg', norm: 'IN 28 Anexo IV' },
  manganes:            { auth: true,  min: 0,  max: 2.3,   unit: 'mg',  norm: 'IN 28 Anexo IV' },
  boro:                { auth: true,  min: 0,  max: 6,     unit: 'mg',  norm: 'IN 28 Anexo IV' },
  silicio:             { auth: false, min: 0,  max: 0,     unit: '-',   norm: 'NÃO CONSTAIN 28 Anexo I', obs: 'Consulte possibilidade como Aditivo' },
  melatonina:          { auth: true,  min: 0,  max: 0.21,  unit: 'mg',  norm: 'IN 102/2021',             obs: 'Apenas para >= 19 anos' },
  triptofano:          { auth: true,  min: 0,  max: 860,   unit: 'mg',  norm: 'IN 28 Anexo IV' },
  tirosina:            { auth: true,  min: 0,  max: 1000,  unit: 'mg',  norm: 'IN 28 Anexo IV' },
  coenzima_q10:        { auth: true,  min: 0,  max: 200,   unit: 'mg',  norm: 'IN 28 Anexo IV' },
  colageno_ii:         { auth: true,  min: 0,  max: 40,    unit: 'mg',  norm: 'IN 28 Anexo IV (não desnaturado)' },
  msm:                 { auth: true,  min: 0,  max: 2000,  unit: 'mg',  norm: 'IN 28 Anexo IV (Metilsulfonilmetano)' },
  trans_resveratrol:   { auth: true,  min: 0,  max: 165,   unit: 'mg',  norm: 'IN 28 Anexo IV' },
  berberina:           { auth: false, min: 0,  max: 0,     unit: '-',   norm: 'PROIBIDO / NÃO LISTADO',  obs: 'Não consta na IN 28 como constituinte' },
  cafeina:             { auth: true,  min: 0,  max: 200,   unit: 'mg',  norm: 'IN 28 Anexo IV (Dose individual)' },
};
