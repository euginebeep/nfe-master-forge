import { supabase } from '@/integrations/supabase/client';
import type { CertificadoCoa } from '@/lib/coa-splitter';

export interface LoteParaCoa {
  id: string;
  numero_lote: string;
  nota_numero: string | null;
  item_descricao: string | null;
}

export interface CasamentoCertificado {
  certificado: CertificadoCoa;
  lotes: LoteParaCoa[];
}

export interface PreviewImportacaoCoa {
  certificados: CertificadoCoa[];
  casamentos: CasamentoCertificado[];
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

/** Monta preview de casamento certificado ↔ lote(s) */
export async function montarPreviewImportacaoCoa(
  notaEntradaId: string,
  certificados: CertificadoCoa[]
): Promise<PreviewImportacaoCoa> {
  const lotesNota = await buscarLotesDaNota(notaEntradaId);
  const numerosFabricante = certificados.map((c) => c.loteFabricante).filter(Boolean);
  const lotesGlobais = await buscarLotesPorNumeros(numerosFabricante);

  const lotesPorNumero = new Map<string, LoteParaCoa[]>();
  for (const lote of lotesGlobais) {
    const key = lote.numero_lote.trim().toUpperCase();
    const lista = lotesPorNumero.get(key) || [];
    lista.push(lote);
    lotesPorNumero.set(key, lista);
  }

  const casamentos: CasamentoCertificado[] = [];
  const semCorrespondencia: CertificadoCoa[] = [];

  for (const cert of certificados) {
    if (!cert.loteFabricante?.trim()) {
      semCorrespondencia.push(cert);
      continue;
    }
    const lotes = lotesPorNumero.get(cert.loteFabricante.trim().toUpperCase()) || [];
    if (!lotes.length) {
      semCorrespondencia.push(cert);
    } else {
      casamentos.push({ certificado: cert, lotes });
    }
  }

  const numerosComCertificado = new Set(
    casamentos.map((c) => c.certificado.loteFabricante.trim().toUpperCase())
  );
  const lotesNotaSemCertificado = lotesNota.filter(
    (l) => !numerosComCertificado.has(l.numero_lote.trim().toUpperCase())
  );

  return {
    certificados,
    casamentos,
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
