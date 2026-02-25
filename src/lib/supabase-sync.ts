// Supabase Sync Service
// Migrates data from localStorage to Supabase and keeps them in sync

import { supabase } from "@/integrations/supabase/client";
import { LocalDb } from "@/lib/local-db";
import { toast } from "sonner";
import type { 
  LocalItem, 
  LocalItemFornecedor, 
  LocalItemAlias, 
  LocalEstoqueLote 
} from "@/hooks/use-local-itens";
import type { 
  LocalEntidade, 
  LocalEntidadeContato, 
  LocalEntidadeEndereco 
} from "@/hooks/use-local-entidades";

// Error log entry
export interface MigrationErrorLog {
  entity: string;
  id: string;
  label: string;
  message: string;
  detail?: string;
  hint?: string;
}

// Stats for migration
export interface MigrationStats {
  itens: { total: number; migrated: number; errors: number };
  entidades: { total: number; migrated: number; errors: number };
  lotes: { total: number; migrated: number; errors: number };
  itemFornecedores: { total: number; migrated: number; errors: number };
  contatos: { total: number; migrated: number; errors: number };
  enderecos: { total: number; migrated: number; errors: number };
  errorLogs: MigrationErrorLog[];
}

// Map local item to Supabase schema
function mapLocalItemToSupabase(item: LocalItem) {
  return {
    id: item.id,
    sku_interno: item.sku_interno,
    descricao_interna: item.descricao_interna,
    descricao_comercial: item.descricao_comercial || null,
    tipo_item: item.tipo_item,
    categoria_operacional: item.categoria_operacional || null,
    ncm: item.ncm || null,
    ean: item.ean || null,
    unidade_interna: item.unidade_interna,
    controla_lote: item.controla_lote,
    controla_validade: item.controla_validade,
    criticidade: item.criticidade,
    higroscopico: item.higroscopico,
    armazenamento: item.armazenamento,
    unidade_declaracao: item.unidade_declaracao || null,
    unidade_pesagem: item.unidade_pesagem || null,
    fator_conversao: item.fator_conversao || null,
    exige_premix: item.exige_premix,
    ativo: item.ativo,
  };
}

// Map local entidade to Supabase schema
function mapLocalEntidadeToSupabase(ent: LocalEntidade) {
  // documento is NOT NULL in Supabase - use a placeholder if empty
  let documento = (ent.documento || '').replace(/\D/g, '');
  if (!documento) {
    documento = `SEM-DOC-${ent.id.substring(0, 8)}`;
  }

  return {
    id: ent.id,
    tipo_pessoa: ent.tipo_pessoa,
    documento,
    razao_social: ent.razao_social || 'Sem razão social',
    nome_fantasia: ent.nome_fantasia || null,
    ie: ent.ie || null,
    im: ent.im || null,
    cnae: ent.cnae || null,
    crt: ent.crt || null,
    status: ent.status || 'ATIVO',
    classificacao: ent.classificacao || 'REGULAR',
    tags: ent.tags || [],
    site: ent.site || null,
    observacoes: ent.observacoes || null,
  };
}

// Set to track entidades already migrated on-demand to avoid duplicates
const migratedEntidadesCache = new Set<string>();

// Try to migrate a single entidade from localStorage if it exists there
async function ensureEntidadeInSupabase(entidadeId: string, errorLogs: MigrationErrorLog[]): Promise<boolean> {
  // Already in Supabase?
  const exists = await existsInSupabase('entidades', entidadeId);
  if (exists) return true;

  // Already tried and failed?
  if (migratedEntidadesCache.has(entidadeId)) return false;
  migratedEntidadesCache.add(entidadeId);

  // Try to find in localStorage
  const localEnt = LocalDb.getById<LocalEntidade>('entidades', entidadeId);
  if (!localEnt) return false;

  try {
    const { error } = await supabase
      .from('entidades')
      .insert(mapLocalEntidadeToSupabase(localEnt));
    if (error) throw error;

    // Also migrate papeis
    if (localEnt.papeis && localEnt.papeis.length > 0) {
      await supabase.from('entidade_papeis').insert(
        localEnt.papeis.map(p => ({ entidade_id: localEnt.id, papel: p }))
      );
    }
    return true;
  } catch (err: any) {
    console.error('Error auto-migrating entidade:', entidadeId, err);
    errorLogs.push({
      entity: 'Entidade (auto)',
      id: entidadeId,
      label: localEnt.razao_social || entidadeId,
      message: err?.message || 'Erro ao migrar entidade automaticamente',
      detail: err?.details || undefined,
    });
    return false;
  }
}

// Helper: check if an ID exists in a Supabase table
async function existsInSupabase(table: 'itens' | 'entidades' | 'entidade_contatos' | 'entidade_enderecos' | 'item_fornecedores' | 'estoque_lotes', id: string): Promise<boolean> {
  const { data } = await supabase
    .from(table)
    .select('id')
    .eq('id', id)
    .maybeSingle();
  return !!data;
}

// Migrate itens from localStorage to Supabase
export async function migrateItens(errorLogs: MigrationErrorLog[]): Promise<{ migrated: number; errors: number }> {
  const localItens = LocalDb.getCollection<LocalItem>('itens');
  let migrated = 0;
  let errors = 0;

  for (const item of localItens) {
    try {
      const existing = await existsInSupabase('itens', item.id);

      if (existing) {
        const { error } = await supabase
          .from('itens')
          .update(mapLocalItemToSupabase(item))
          .eq('id', item.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('itens')
          .insert(mapLocalItemToSupabase(item));
        if (error) throw error;
      }
      migrated++;
    } catch (err: any) {
      console.error('Error migrating item:', item.id, err);
      errorLogs.push({
        entity: 'Produto',
        id: item.id,
        label: item.descricao_interna || item.sku_interno || item.id,
        message: err?.message || 'Erro desconhecido',
        detail: err?.details || undefined,
        hint: err?.hint || undefined,
      });
      errors++;
    }
  }

  return { migrated, errors };
}

// Migrate entidades from localStorage to Supabase
export async function migrateEntidades(errorLogs: MigrationErrorLog[]): Promise<{ migrated: number; errors: number }> {
  const localEntidades = LocalDb.getCollection<LocalEntidade>('entidades');
  let migrated = 0;
  let errors = 0;

  for (const ent of localEntidades) {
    try {
      const existing = await existsInSupabase('entidades', ent.id);

      if (existing) {
        const { error } = await supabase
          .from('entidades')
          .update(mapLocalEntidadeToSupabase(ent))
          .eq('id', ent.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('entidades')
          .insert(mapLocalEntidadeToSupabase(ent));
        if (error) throw error;
      }

      // Migrate papeis (roles)
      if (ent.papeis && ent.papeis.length > 0) {
        await supabase
          .from('entidade_papeis')
          .delete()
          .eq('entidade_id', ent.id);

        const papeisData = ent.papeis.map(papel => ({
          entidade_id: ent.id,
          papel: papel,
        }));

        await supabase
          .from('entidade_papeis')
          .insert(papeisData);
      }

      migrated++;
    } catch (err: any) {
      console.error('Error migrating entidade:', ent.id, err);
      errorLogs.push({
        entity: 'Entidade',
        id: ent.id,
        label: ent.razao_social || ent.documento || ent.id,
        message: err?.message || 'Erro desconhecido',
        detail: err?.details || undefined,
        hint: err?.hint || undefined,
      });
      errors++;
    }
  }

  return { migrated, errors };
}

// Migrate contatos from localStorage to Supabase
export async function migrateContatos(errorLogs: MigrationErrorLog[]): Promise<{ migrated: number; errors: number }> {
  const localContatos = LocalDb.getCollection<LocalEntidadeContato>('entidade_contatos');
  let migrated = 0;
  let errors = 0;

  for (const contato of localContatos) {
    try {
      // Ensure parent entidade exists (auto-migrate if needed)
      const entidadeOk = await ensureEntidadeInSupabase(contato.entidade_id, errorLogs);
      if (!entidadeOk) {
        throw { 
          message: 'Entidade pai não pôde ser migrada',
          details: `entidade_id ${contato.entidade_id} não existe no banco e não foi possível migrá-la automaticamente.`
        };
      }

      const existing = await existsInSupabase('entidade_contatos', contato.id);

      const contatoData = {
        id: contato.id,
        entidade_id: contato.entidade_id,
        nome: contato.nome,
        cargo: contato.cargo || 'OUTRO',
        whatsapp: contato.whatsapp || null,
        telefone: contato.telefone || null,
        email: contato.email || null,
        preferencial: contato.preferencial,
        aceita_whatsapp: contato.aceita_whatsapp,
      };

      if (existing) {
        const { error } = await supabase
          .from('entidade_contatos')
          .update(contatoData)
          .eq('id', contato.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('entidade_contatos')
          .insert(contatoData);
        if (error) throw error;
      }
      migrated++;
    } catch (err: any) {
      console.error('Error migrating contato:', contato.id, err);
      errorLogs.push({
        entity: 'Contato',
        id: contato.id,
        label: contato.nome || contato.id,
        message: err?.message || 'Erro desconhecido',
        detail: err?.details || undefined,
        hint: err?.hint || undefined,
      });
      errors++;
    }
  }

  return { migrated, errors };
}

// Migrate enderecos from localStorage to Supabase
export async function migrateEnderecos(errorLogs: MigrationErrorLog[]): Promise<{ migrated: number; errors: number }> {
  const localEnderecos = LocalDb.getCollection<LocalEntidadeEndereco>('entidade_enderecos');
  let migrated = 0;
  let errors = 0;

  for (const endereco of localEnderecos) {
    try {
      const entidadeOk = await ensureEntidadeInSupabase(endereco.entidade_id, errorLogs);
      if (!entidadeOk) {
        throw { 
          message: 'Entidade pai não pôde ser migrada',
          details: `entidade_id ${endereco.entidade_id} não existe no banco e não foi possível migrá-la automaticamente.`
        };
      }

      const existing = await existsInSupabase('entidade_enderecos', endereco.id);

      const enderecoData = {
        id: endereco.id,
        entidade_id: endereco.entidade_id,
        tipo: endereco.tipo,
        logradouro: endereco.logradouro || null,
        nro: endereco.numero || null,
        compl: endereco.complemento || null,
        bairro: endereco.bairro || null,
        cidade: endereco.cidade || null,
        uf: endereco.uf || null,
        cep: endereco.cep || null,
        pais: endereco.pais || 'Brasil',
      };

      if (existing) {
        const { error } = await supabase
          .from('entidade_enderecos')
          .update(enderecoData)
          .eq('id', endereco.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('entidade_enderecos')
          .insert(enderecoData);
        if (error) throw error;
      }
      migrated++;
    } catch (err: any) {
      console.error('Error migrating endereco:', endereco.id, err);
      errorLogs.push({
        entity: 'Endereço',
        id: endereco.id,
        label: `${endereco.logradouro || ''} ${endereco.numero || ''}`.trim() || endereco.id,
        message: err?.message || 'Erro desconhecido',
        detail: err?.details || undefined,
        hint: err?.hint || undefined,
      });
      errors++;
    }
  }

  return { migrated, errors };
}

// Migrate item_fornecedores from localStorage to Supabase
export async function migrateItemFornecedores(errorLogs: MigrationErrorLog[]): Promise<{ migrated: number; errors: number }> {
  const localFornecedores = LocalDb.getCollection<LocalItemFornecedor>('item_fornecedores');
  let migrated = 0;
  let errors = 0;

  for (const forn of localFornecedores) {
    try {
      // Check FK references exist
      const itemExists = await existsInSupabase('itens', forn.item_id);
      if (!itemExists) {
        throw { message: 'Item não encontrado no banco', details: `item_id ${forn.item_id} não existe.` };
      }

      // Check if fornecedor exists, if not set to null
      let fornecedorId: string | null = forn.fornecedor_id || null;
      if (fornecedorId) {
        const fornExists = await existsInSupabase('entidades', fornecedorId);
        if (!fornExists) {
          console.warn(`Fornecedor ${fornecedorId} não existe no Supabase, definindo como null`);
          fornecedorId = null;
        }
      }

      const existing = await existsInSupabase('item_fornecedores', forn.id);

      const fornData = {
        id: forn.id,
        item_id: forn.item_id,
        fornecedor_id: fornecedorId!,
        codigo_fornecedor: forn.codigo_fornecedor || null,
        descricao_fornecedor: forn.descricao_fornecedor || null,
        unidade_compra_padrao: forn.unidade_compra_padrao,
        fator_para_unidade_interna: forn.fator_para_unidade_interna,
        fornecedor_preferencial: forn.fornecedor_preferencial,
        preco_referencia: forn.preco_referencia || null,
      };

      // Skip if fornecedor_id is required but null
      if (!fornecedorId) {
        throw { 
          message: 'Fornecedor não encontrado no banco de dados', 
          details: `fornecedor_id original ${forn.fornecedor_id} não existe na tabela entidades. Migre as entidades primeiro.` 
        };
      }

      if (existing) {
        const { error } = await supabase
          .from('item_fornecedores')
          .update(fornData)
          .eq('id', forn.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('item_fornecedores')
          .insert(fornData);
        if (error) throw error;
      }
      migrated++;
    } catch (err: any) {
      console.error('Error migrating item_fornecedor:', forn.id, err);
      errorLogs.push({
        entity: 'Item-Fornecedor',
        id: forn.id,
        label: forn.descricao_fornecedor || forn.codigo_fornecedor || forn.id,
        message: err?.message || 'Erro desconhecido',
        detail: err?.details || undefined,
        hint: err?.hint || undefined,
      });
      errors++;
    }
  }

  return { migrated, errors };
}

// Migrate estoque_lotes from localStorage to Supabase
export async function migrateLotes(errorLogs: MigrationErrorLog[]): Promise<{ migrated: number; errors: number }> {
  const localLotes = LocalDb.getCollection<LocalEstoqueLote>('estoque_lotes');
  let migrated = 0;
  let errors = 0;

  for (const lote of localLotes) {
    try {
      // Check item FK
      const itemExists = await existsInSupabase('itens', lote.item_id);
      if (!itemExists) {
        throw { message: 'Item não encontrado no banco', details: `item_id ${lote.item_id} não existe na tabela itens.` };
      }

      // Check fornecedor FK - set to null if not found
      let fornecedorId: string | null = lote.fornecedor_id || null;
      if (fornecedorId) {
        const fornExists = await existsInSupabase('entidades', fornecedorId);
        if (!fornExists) {
          console.warn(`Fornecedor ${fornecedorId} do lote ${lote.numero_lote} não encontrado, definindo como null`);
          fornecedorId = null;
        }
      }

      const existing = await existsInSupabase('estoque_lotes', lote.id);

      const loteData = {
        id: lote.id,
        item_id: lote.item_id,
        fornecedor_id: fornecedorId,
        nota_entrada_item_id: lote.nota_entrada_item_id || null,
        numero_lote: lote.numero_lote,
        data_fab: lote.data_fab || null,
        data_val: lote.data_val || null,
        quantidade_original: lote.quantidade_original,
        unidade_original: lote.unidade_original,
        quantidade_interna: lote.quantidade_interna,
        custo_unitario_original: lote.custo_unitario_original || null,
        custo_unitario_interno: lote.custo_unitario_interno || null,
        status: lote.status,
        observacoes_qc: lote.observacoes_qc || null,
      };

      if (existing) {
        const { error } = await supabase
          .from('estoque_lotes')
          .update(loteData)
          .eq('id', lote.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('estoque_lotes')
          .insert(loteData);
        if (error) throw error;
      }
      migrated++;
    } catch (err: any) {
      console.error('Error migrating lote:', lote.id, err);
      errorLogs.push({
        entity: 'Lote',
        id: lote.id,
        label: lote.numero_lote || lote.id,
        message: err?.message || 'Erro desconhecido',
        detail: err?.details || undefined,
        hint: err?.hint || undefined,
      });
      errors++;
    }
  }

  return { migrated, errors };
}

// Full migration from localStorage to Supabase
export async function migrateAllToSupabase(): Promise<MigrationStats> {
  const errorLogs: MigrationErrorLog[] = [];
  migratedEntidadesCache.clear(); // Reset cache for new migration run
  const stats: MigrationStats = {
    itens: { total: 0, migrated: 0, errors: 0 },
    entidades: { total: 0, migrated: 0, errors: 0 },
    lotes: { total: 0, migrated: 0, errors: 0 },
    itemFornecedores: { total: 0, migrated: 0, errors: 0 },
    contatos: { total: 0, migrated: 0, errors: 0 },
    enderecos: { total: 0, migrated: 0, errors: 0 },
    errorLogs,
  };

  // Get totals
  stats.itens.total = LocalDb.getCollection('itens').length;
  stats.entidades.total = LocalDb.getCollection('entidades').length;
  stats.lotes.total = LocalDb.getCollection('estoque_lotes').length;
  stats.itemFornecedores.total = LocalDb.getCollection('item_fornecedores').length;
  stats.contatos.total = LocalDb.getCollection('entidade_contatos').length;
  stats.enderecos.total = LocalDb.getCollection('entidade_enderecos').length;

  // Migrate in order (entidades first, then items, then relations)
  const entidadesResult = await migrateEntidades(errorLogs);
  stats.entidades.migrated = entidadesResult.migrated;
  stats.entidades.errors = entidadesResult.errors;

  const contatosResult = await migrateContatos(errorLogs);
  stats.contatos.migrated = contatosResult.migrated;
  stats.contatos.errors = contatosResult.errors;

  const enderecosResult = await migrateEnderecos(errorLogs);
  stats.enderecos.migrated = enderecosResult.migrated;
  stats.enderecos.errors = enderecosResult.errors;

  const itensResult = await migrateItens(errorLogs);
  stats.itens.migrated = itensResult.migrated;
  stats.itens.errors = itensResult.errors;

  const itemFornResult = await migrateItemFornecedores(errorLogs);
  stats.itemFornecedores.migrated = itemFornResult.migrated;
  stats.itemFornecedores.errors = itemFornResult.errors;

  const lotesResult = await migrateLotes(errorLogs);
  stats.lotes.migrated = lotesResult.migrated;
  stats.lotes.errors = lotesResult.errors;

  return stats;
}

// Check if there's local data to migrate
export function hasLocalDataToMigrate(): boolean {
  const itens = LocalDb.getCollection('itens').length;
  const entidades = LocalDb.getCollection('entidades').length;
  const lotes = LocalDb.getCollection('estoque_lotes').length;
  
  return itens > 0 || entidades > 0 || lotes > 0;
}

// Get local data counts
export function getLocalDataCounts() {
  return {
    itens: LocalDb.getCollection('itens').length,
    entidades: LocalDb.getCollection('entidades').length,
    lotes: LocalDb.getCollection('estoque_lotes').length,
    contatos: LocalDb.getCollection('entidade_contatos').length,
    enderecos: LocalDb.getCollection('entidade_enderecos').length,
    itemFornecedores: LocalDb.getCollection('item_fornecedores').length,
  };
}
