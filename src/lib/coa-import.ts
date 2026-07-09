import { supabase } from '@/integrations/supabase/client';
import type { CertificadoCoa } from '@/lib/coa-splitter';

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
  return valor?.trim().toUpperCase() ?? '';
}

/** Identificadores de lote presentes no certificado (fabricante e/ou interno) */
export function identificadoresLoteCertificado(
  cert: CertificadoCoa
): { campo: CampoLoteCasamento; valor: string }[] {
  const ids: { campo: CampoLoteCasamento; valor: string }[] = [];

  const fabricante = normalizarNumeroLote(cert.loteFabricante);
  if (fabricante) ids.push({ campo: 'FABRICANTE', valor: fabricante });

  const interno = normalizarNumeroLote(cert.loteInterno);
  if (interno && !ids.some((i) => i.valor === interno)) {
    ids.push({ campo: 'INTERNO', valor: interno });
  }

  return ids;
}

export type ResultadoCasamento =
  | { tipo: 'unico'; lotes: LoteParaCoa[]; camposCasados: CampoLoteCasamento[] }
  | { tipo: 'ambiguo'; lotes: LoteParaCoa[]; motivo: string }
  | { tipo: 'nenhum' };

/** Casa certificado contra mapa numero_lote → lotes (normalizado trim+UPPER) */
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
  const numLote = normalizarNumeroLote(lote.numero_lote);
  const camposDoLote: CampoLoteCasamento[] = [];

  if (normalizarNumeroLote(cert.loteFabricante) === numLote) camposDoLote.push('FABRICANTE');
  if (normalizarNumeroLote(cert.loteInterno) === numLote) camposDoLote.push('INTERNO');

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

/** Busca lotes globalmente por numero_lote (mesmo lote em várias notas) */
export async function buscarLotesPorNumeros(numerosLote: string[]): Promise<LoteParaCoa[]> {
  const unicos = [...new Set(numerosLote.map((n) => n.trim()).filter(Boolean))];
  if (!unicos.length) return [];

  const { data, error } = await supabase
    .from('estoque_lotes')
    .select(LOTE_SELECT)
    .in('numero_lote', unicos);

  if (error) throw error;
  return ((data || []) as unknown as LoteRow[]).map(mapLoteRow);
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

/** Monta preview de casamento certificado ↔ lote(s) */
export async function montarPreviewImportacaoCoa(
  notaEntradaId: string,
  certificados: CertificadoCoa[]
): Promise<PreviewImportacaoCoa> {
  const lotesNota = await buscarLotesDaNota(notaEntradaId);

  const numerosBusca = [
    ...new Set(certificados.flatMap((c) => numerosLoteCertificado(c))),
  ];
  const lotesGlobais = await buscarLotesPorNumeros(numerosBusca);

  const lotesPorNumero = new Map<string, LoteParaCoa[]>();
  for (const lote of lotesGlobais) {
    const key = normalizarNumeroLote(lote.numero_lote);
    const lista = lotesPorNumero.get(key) || [];
    lista.push(lote);
    lotesPorNumero.set(key, lista);
  }

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
      numerosComCertificado.add(normalizarNumeroLote(lote.numero_lote));
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

  const lotesNotaSemCertificado = lotesNota.filter(
    (l) => !numerosComCertificado.has(normalizarNumeroLote(l.numero_lote))
  );

  return {
    certificados,
    casamentos,
    revisarManualmente,
    semCorrespondencia,
    lotesNota,
    lotesNotaSemCertificado,
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
