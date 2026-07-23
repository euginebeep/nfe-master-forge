import { supabase } from '@/integrations/supabase/client';

/** Caminho canônico do XML de NF-e no bucket erp-files. */
export function nfeXmlStoragePath(companyId: string, chaveNfe: string): string {
  const chave = chaveNfe.replace(/\D/g, '');
  return `nfe-xmls/${companyId}/${chave}.xml`;
}

/**
 * Grava o XML no storage após a nota já estar persistida.
 * upsert:true — reimport/backfill não duplica.
 */
export async function uploadNfeXmlToStorage(
  companyId: string,
  chaveNfe: string,
  xmlRaw: string,
): Promise<void> {
  if (!xmlRaw?.trim()) {
    throw new Error('XML vazio — não é possível gravar no storage.');
  }
  const chave = chaveNfe.replace(/\D/g, '');
  if (chave.length !== 44) {
    throw new Error(`Chave NF-e inválida para storage (${chave.length} dígitos).`);
  }

  const path = nfeXmlStoragePath(companyId, chave);
  const blob = new Blob([xmlRaw], { type: 'application/xml' });
  const { error } = await supabase.storage.from('erp-files').upload(path, blob, {
    contentType: 'application/xml',
    upsert: true,
  });

  if (error) {
    throw new Error(`Falha ao gravar XML no storage (${path}): ${error.message}`);
  }
}
