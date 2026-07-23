import { supabase } from '@/integrations/supabase/client';
import type { CertificadoCoa } from '@/lib/coa-splitter';
import { normalizarNotaFiscal } from '@/lib/coa-splitter';

export interface LoteParaCoa {
  id: string;
  numero_lote: string;
  nota_numero: string | null;
  item_descricao: string | null;
}

export type CampoLoteCasamento = 'FABRICANTE' | 'INTERNO';

export interface CasamentoCertificado {
  certificado: CertificadoCoa;
  lotes: LoteParaCoa[];
  camposCasados: CampoLoteCasamento[];
}

export interface CasamentoRevisar {
  certificado: CertificadoCoa;
  lotes: LoteParaCoa[];
  motivo: string;
}

export interface PreviewImportacaoCoa {
  certificados: CertificadoCoa[];
  casamentos: CasamentoCertificado[];
  revisarManualmente: CasamentoRevisar[];
  semCorrespondencia: CertificadoCoa[];
  lotesNota: LoteParaCoa[];
  lotesNotaSemCertificado: LoteParaCoa[];
  /** NF normalizada extraída do PDF (mais frequente) */
  notaExtraidaDoPdf: string | null;
  /** Aviso quando a NF do PDF ≠ nota selecionada */
  avisoNotaDivergente: string | null;
  /** Nota encontrada automaticamente pelo número do PDF */
  notaResolvidaPorPdf: { id: string; numero: string } | null;
}

type LoteRow = {
  id: string;
  numero_lote: string;
  nota_entrada_item: {
    descricao: string | null;
    nota_entrada: { numero: string | null } | null;
  } | null;
};

export function normalizarNumeroLote(valor?: string | null): string {
  return valor?.trim().toUpperCase().replace(/\s+/g, ' ') ?? '';
}

/** Variantes para casar "HA2025102144X #3" com "HA2025102144X" e vice-versa */
export function variantesNumeroLote(valor?: string | null): string[] {
  const base = normalizarNumeroLote(valor);
  if (!base) return [];
  const out = new Set<string>([base]);
  const semHash = base.replace(/\s*#\s*\d+\s*$/, '').trim();
  if (semHash) out.add(semHash);
  out.add(base.replace(/\s+/g, ''));
  if (semHash) out.add(semHash.replace(/\s+/g, ''));
  return [...out];
}

/** Identificadores de lote presentes no certificado (fabricante e/ou interno + variantes) */
export function identificadoresLoteCertificado(
  cert: CertificadoCoa
): { campo: CampoLoteCasamento; valor: string }[] {
  const ids: { campo: CampoLoteCasamento; valor: string }[] = [];
  const seen = new Set<string>();

  const push = (campo: CampoLoteCasamento, raw?: string | null) => {
    for (const v of variantesNumeroLote(raw)) {
      if (seen.has(v)) continue;
      seen.add(v);
      ids.push({ campo, valor: v });
    }
  };

  push('FABRICANTE', cert.loteFabricante);
  push('INTERNO', cert.loteInterno);

  return ids;
}

export type ResultadoCasamento =
  | { tipo: 'unico'; lotes: LoteParaCoa[]; camposCasados: CampoLoteCasamento[] }
  | { tipo: 'ambiguo'; lotes: LoteParaCoa[]; motivo: string }
  | { tipo: 'nenhum' };

/** Casa certificado contra mapa numero_lote → lotes (normalizado + variantes) */
export function casarCertificadoComLotes(
  cert: CertificadoCoa,
  lotesPorNumero: Map<string, LoteParaCoa[]>
): ResultadoCasamento {
  const identificadores = identificadoresLoteCertificado(cert);
  if (!identificadores.length) return { tipo: 'nenhum' };

  const matchesPorCampo: { campo: CampoLoteCasamento; lotes: LoteParaCoa[] }[] = [];

  for (const { campo, valor } of identificadores) {
    const lotes = lotesPorNumero.get(valor) || [];
    if (lotes.length) matchesPorCampo.push({ campo, lotes });
  }

  if (!matchesPorCampo.length) return { tipo: 'nenhum' };

  const lotesUnicos = new Map<string, LoteParaCoa>();
  const camposCasados = new Set<CampoLoteCasamento>();

  for (const { campo, lotes } of matchesPorCampo) {
    for (const lote of lotes) {
      lotesUnicos.set(lote.id, lote);
      camposCasados.add(campo);
    }
  }

  const lista = [...lotesUnicos.values()];
  if (!lista.length) return { tipo: 'nenhum' };

  if (lista.length > 1) {
    const nums = lista.map((l) => l.numero_lote).join(', ');
    return {
      tipo: 'ambiguo',
      lotes: lista,
      motivo: `Casou com ${lista.length} lotes distintos no estoque (${nums}). Revise manualmente.`,
    };
  }

  const lote = lista[0];
  const variantesLote = new Set(variantesNumeroLote(lote.numero_lote));
  const camposDoLote: CampoLoteCasamento[] = [];

  for (const v of variantesNumeroLote(cert.loteFabricante)) {
    if (variantesLote.has(v)) {
      camposDoLote.push('FABRICANTE');
      break;
    }
  }
  for (const v of variantesNumeroLote(cert.loteInterno)) {
    if (variantesLote.has(v)) {
      camposDoLote.push('INTERNO');
      break;
    }
  }

  return {
    tipo: 'unico',
    lotes: [lote],
    camposCasados: camposDoLote.length ? camposDoLote : [...camposCasados],
  };
}

export function labelCampoCasamento(campos: CampoLoteCasamento[]): string {
  if (!campos.length) return '';
  if (campos.includes('FABRICANTE') && campos.includes('INTERNO')) return 'Fabricante e Interno';
  if (campos.includes('FABRICANTE')) return 'Fabricante';
  return 'Interno';
}

function mapLoteRow(row: LoteRow): LoteParaCoa {
  return {
    id: row.id,
    numero_lote: row.numero_lote,
    nota_numero: row.nota_entrada_item?.nota_entrada?.numero ?? null,
    item_descricao: row.nota_entrada_item?.descricao ?? null,
  };
}

const LOTE_SELECT = `
  id,
  numero_lote,
  nota_entrada_item:notas_entrada_itens!estoque_lotes_nota_entrada_item_id_fkey(
    descricao,
    nota_entrada:notas_entrada!notas_entrada_itens_nota_entrada_id_fkey(numero)
  )
`;

/** Lotes vinculados a uma nota de entrada (via itens) */
export async function buscarLotesDaNota(notaEntradaId: string): Promise<LoteParaCoa[]> {
  const { data: itens, error: itensError } = await supabase
    .from('notas_entrada_itens')
    .select('id')
    .eq('nota_entrada_id', notaEntradaId);

  if (itensError) throw itensError;
  const itemIds = (itens || []).map((i) => i.id);
  if (!itemIds.length) return [];

  const { data, error } = await supabase
    .from('estoque_lotes')
    .select(LOTE_SELECT)
    .in('nota_entrada_item_id', itemIds);

  if (error) throw error;
  return ((data || []) as unknown as LoteRow[]).map(mapLoteRow);
}

/** Busca lotes globalmente por numero_lote (exato + prefixo para variantes #N) */
export async function buscarLotesPorNumeros(numerosLote: string[]): Promise<LoteParaCoa[]> {
  const variantes = [
    ...new Set(numerosLote.flatMap((n) => variantesNumeroLote(n)).filter(Boolean)),
  ];
  if (!variantes.length) return [];

  const { data: exactos, error } = await supabase
    .from('estoque_lotes')
    .select(LOTE_SELECT)
    .in('numero_lote', variantes);

  if (error) throw error;

  const porId = new Map<string, LoteParaCoa>();
  for (const row of (exactos || []) as unknown as LoteRow[]) {
    const m = mapLoteRow(row);
    porId.set(m.id, m);
  }

  const bases = [
    ...new Set(
      variantes
        .map((v) => v.replace(/\s*#\s*\d+\s*$/, '').trim())
        .filter((v) => v.length >= 4),
    ),
  ];
  for (const base of bases) {
    const { data: pref, error: prefErr } = await supabase
      .from('estoque_lotes')
      .select(LOTE_SELECT)
      .ilike('numero_lote', `${base}%`)
      .limit(20);
    if (prefErr) continue;
    for (const row of (pref || []) as unknown as LoteRow[]) {
      const m = mapLoteRow(row);
      porId.set(m.id, m);
    }
  }

  return [...porId.values()];
}

/** Resolve nota de entrada pelo número (normalizado). */
export async function buscarNotaPorNumero(
  numero: string,
): Promise<{ id: string; numero: string } | null> {
  const alvo = normalizarNotaFiscal(numero);
  if (!alvo) return null;

  const { data, error } = await supabase
    .from('notas_entrada')
    .select('id, numero')
    .limit(200);

  if (error) throw error;
  const hit = (data || []).find((n) => normalizarNotaFiscal(n.numero) === alvo);
  return hit ? { id: hit.id, numero: hit.numero || alvo } : null;
}

/** IDs de lotes que já possuem documento COA */
export async function lotesComCoaExistente(loteIds: string[]): Promise<Set<string>> {
  if (!loteIds.length) return new Set();

  const { data, error } = await supabase
    .from('lote_documentos')
    .select('lote_id')
    .in('lote_id', loteIds)
    .eq('tipo_documento', 'COA');

  if (error) throw error;
  return new Set((data || []).map((d) => d.lote_id));
}

function numerosLoteCertificado(cert: CertificadoCoa): string[] {
  return [cert.loteFabricante, cert.loteInterno]
    .map((n) => n?.trim())
    .filter(Boolean) as string[];
}

function indexarLotesPorNumero(lotes: LoteParaCoa[]): Map<string, LoteParaCoa[]> {
  const lotesPorNumero = new Map<string, LoteParaCoa[]>();
  for (const lote of lotes) {
    for (const key of variantesNumeroLote(lote.numero_lote)) {
      const lista = lotesPorNumero.get(key) || [];
      if (!lista.some((l) => l.id === lote.id)) lista.push(lote);
      lotesPorNumero.set(key, lista);
    }
  }
  return lotesPorNumero;
}

/** Monta preview de casamento certificado ↔ lote(s) — busca em TODO o tenant */
export async function montarPreviewImportacaoCoa(
  notaEntradaId: string | null,
  certificados: CertificadoCoa[],
  opts?: { notaNumeroSelecionada?: string | null },
): Promise<PreviewImportacaoCoa> {
  const contagemNota = new Map<string, number>();
  for (const c of certificados) {
    const n = normalizarNotaFiscal(c.nota);
    if (!n) continue;
    contagemNota.set(n, (contagemNota.get(n) || 0) + 1);
  }
  let notaExtraidaDoPdf: string | null = null;
  let max = 0;
  for (const [n, q] of contagemNota) {
    if (q > max) {
      max = q;
      notaExtraidaDoPdf = n;
    }
  }

  let notaResolvidaId = notaEntradaId;
  /** Nota encontrada pelo número do PDF (para o UI auto-selecionar) */
  let notaResolvidaPorPdf: { id: string; numero: string } | null = null;

  if (!notaResolvidaId && notaExtraidaDoPdf) {
    notaResolvidaPorPdf = await buscarNotaPorNumero(notaExtraidaDoPdf);
    if (notaResolvidaPorPdf) notaResolvidaId = notaResolvidaPorPdf.id;
  }

  const lotesNota = notaResolvidaId ? await buscarLotesDaNota(notaResolvidaId) : [];

  const numerosBusca = [
    ...new Set(certificados.flatMap((c) => numerosLoteCertificado(c))),
  ];
  const lotesGlobais = await buscarLotesPorNumeros(numerosBusca);
  const lotesPorNumero = indexarLotesPorNumero(lotesGlobais);

  const casamentos: CasamentoCertificado[] = [];
  const revisarManualmente: CasamentoRevisar[] = [];
  const semCorrespondencia: CertificadoCoa[] = [];
  const numerosComCertificado = new Set<string>();

  for (const cert of certificados) {
    const resultado = casarCertificadoComLotes(cert, lotesPorNumero);

    if (resultado.tipo === 'nenhum') {
      semCorrespondencia.push(cert);
      continue;
    }

    for (const lote of resultado.lotes) {
      for (const v of variantesNumeroLote(lote.numero_lote)) {
        numerosComCertificado.add(v);
      }
    }

    if (resultado.tipo === 'ambiguo') {
      revisarManualmente.push({
        certificado: cert,
        lotes: resultado.lotes,
        motivo: resultado.motivo,
      });
    } else {
      casamentos.push({
        certificado: cert,
        lotes: resultado.lotes,
        camposCasados: resultado.camposCasados,
      });
    }
  }

  const lotesNotaSemCertificado = lotesNota.filter((l) =>
    !variantesNumeroLote(l.numero_lote).some((v) => numerosComCertificado.has(v)),
  );

  let avisoNotaDivergente: string | null = null;
  const selecionada = normalizarNotaFiscal(opts?.notaNumeroSelecionada);
  if (notaExtraidaDoPdf && selecionada && notaExtraidaDoPdf !== selecionada) {
    avisoNotaDivergente =
      `Este certificado é da NF ${notaExtraidaDoPdf}, você está na ${selecionada}. ` +
      `Trocar para a nota correta?`;
  } else if (
    !avisoNotaDivergente &&
    selecionada &&
    casamentos.length > 0
  ) {
    const notasDosLotes = [
      ...new Set(
        casamentos.flatMap((c) => c.lotes.map((l) => normalizarNotaFiscal(l.nota_numero)).filter(Boolean)),
      ),
    ];
    if (notasDosLotes.length === 1 && notasDosLotes[0] !== selecionada) {
      avisoNotaDivergente =
        `Os lotes do PDF pertencem à NF ${notasDosLotes[0]}, você está na ${selecionada}. ` +
        `Trocar para a nota correta?`;
      if (!notaExtraidaDoPdf) notaExtraidaDoPdf = notasDosLotes[0];
    }
  }

  return {
    certificados,
    casamentos,
    revisarManualmente,
    semCorrespondencia,
    lotesNota,
    lotesNotaSemCertificado,
    notaExtraidaDoPdf,
    avisoNotaDivergente,
    notaResolvidaPorPdf,
  };
}

export interface CoaLoteArquivo {
  loteId: string;
  storageKey: string;
  nomeOriginal: string | null;
}

/** Busca COA mais recente por lote (arquivo_id → arquivos.storage_key) */
export async function buscarCoasDosLotes(loteIds: string[]): Promise<CoaLoteArquivo[]> {
  const unicos = [...new Set(loteIds.filter(Boolean))];
  if (!unicos.length) return [];

  const { data, error } = await supabase
    .from('lote_documentos')
    .select('lote_id, arquivo:arquivos(storage_key, nome_original)')
    .in('lote_id', unicos)
    .eq('tipo_documento', 'COA')
    .order('created_at', { ascending: false });

  if (error) throw error;

  type Row = {
    lote_id: string;
    arquivo: { storage_key: string; nome_original: string | null } | null;
  };

  const porLote = new Map<string, CoaLoteArquivo>();
  for (const row of (data || []) as unknown as Row[]) {
    if (porLote.has(row.lote_id)) continue;
    const key = row.arquivo?.storage_key?.trim();
    if (!key) continue;
    porLote.set(row.lote_id, {
      loteId: row.lote_id,
      storageKey: key,
      nomeOriginal: row.arquivo?.nome_original ?? null,
    });
  }
  return [...porLote.values()];
}
