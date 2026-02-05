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

// Stats for migration
export interface MigrationStats {
  itens: { total: number; migrated: number; errors: number };
  entidades: { total: number; migrated: number; errors: number };
  lotes: { total: number; migrated: number; errors: number };
  itemFornecedores: { total: number; migrated: number; errors: number };
  contatos: { total: number; migrated: number; errors: number };
  enderecos: { total: number; migrated: number; errors: number };
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
  return {
    id: ent.id,
    tipo_pessoa: ent.tipo_pessoa,
    documento: ent.documento.replace(/\D/g, ''),
    razao_social: ent.razao_social,
    nome_fantasia: ent.nome_fantasia || null,
    ie: ent.ie || null,
    im: ent.im || null,
    cnae: ent.cnae || null,
    crt: ent.crt || null,
    status: ent.status,
    classificacao: ent.classificacao,
    tags: ent.tags || [],
    site: ent.site || null,
    observacoes: ent.observacoes || null,
  };
}

// Migrate itens from localStorage to Supabase
export async function migrateItens(): Promise<{ migrated: number; errors: number }> {
  const localItens = LocalDb.getCollection<LocalItem>('itens');
  let migrated = 0;
  let errors = 0;

  for (const item of localItens) {
    try {
      // Check if item already exists in Supabase
      const { data: existing } = await supabase
        .from('itens')
        .select('id')
        .eq('id', item.id)
        .maybeSingle();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('itens')
          .update(mapLocalItemToSupabase(item))
          .eq('id', item.id);

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('itens')
          .insert(mapLocalItemToSupabase(item));

        if (error) throw error;
      }
      migrated++;
    } catch (err) {
      console.error('Error migrating item:', item.id, err);
      errors++;
    }
  }

  return { migrated, errors };
}

// Migrate entidades from localStorage to Supabase
export async function migrateEntidades(): Promise<{ migrated: number; errors: number }> {
  const localEntidades = LocalDb.getCollection<LocalEntidade>('entidades');
  let migrated = 0;
  let errors = 0;

  for (const ent of localEntidades) {
    try {
      // Check if entidade already exists in Supabase
      const { data: existing } = await supabase
        .from('entidades')
        .select('id')
        .eq('id', ent.id)
        .maybeSingle();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('entidades')
          .update(mapLocalEntidadeToSupabase(ent))
          .eq('id', ent.id);

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('entidades')
          .insert(mapLocalEntidadeToSupabase(ent));

        if (error) throw error;
      }

      // Migrate papeis (roles)
      if (ent.papeis && ent.papeis.length > 0) {
        // Delete existing papeis
        await supabase
          .from('entidade_papeis')
          .delete()
          .eq('entidade_id', ent.id);

        // Insert new papeis
        const papeisData = ent.papeis.map(papel => ({
          entidade_id: ent.id,
          papel: papel,
        }));

        await supabase
          .from('entidade_papeis')
          .insert(papeisData);
      }

      migrated++;
    } catch (err) {
      console.error('Error migrating entidade:', ent.id, err);
      errors++;
    }
  }

  return { migrated, errors };
}

// Migrate contatos from localStorage to Supabase
export async function migrateContatos(): Promise<{ migrated: number; errors: number }> {
  const localContatos = LocalDb.getCollection<LocalEntidadeContato>('entidade_contatos');
  let migrated = 0;
  let errors = 0;

  for (const contato of localContatos) {
    try {
      const { data: existing } = await supabase
        .from('entidade_contatos')
        .select('id')
        .eq('id', contato.id)
        .maybeSingle();

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
    } catch (err) {
      console.error('Error migrating contato:', contato.id, err);
      errors++;
    }
  }

  return { migrated, errors };
}

// Migrate enderecos from localStorage to Supabase
export async function migrateEnderecos(): Promise<{ migrated: number; errors: number }> {
  const localEnderecos = LocalDb.getCollection<LocalEntidadeEndereco>('entidade_enderecos');
  let migrated = 0;
  let errors = 0;

  for (const endereco of localEnderecos) {
    try {
      const { data: existing } = await supabase
        .from('entidade_enderecos')
        .select('id')
        .eq('id', endereco.id)
        .maybeSingle();

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
    } catch (err) {
      console.error('Error migrating endereco:', endereco.id, err);
      errors++;
    }
  }

  return { migrated, errors };
}

// Migrate item_fornecedores from localStorage to Supabase
export async function migrateItemFornecedores(): Promise<{ migrated: number; errors: number }> {
  const localFornecedores = LocalDb.getCollection<LocalItemFornecedor>('item_fornecedores');
  let migrated = 0;
  let errors = 0;

  for (const forn of localFornecedores) {
    try {
      const { data: existing } = await supabase
        .from('item_fornecedores')
        .select('id')
        .eq('id', forn.id)
        .maybeSingle();

      const fornData = {
        id: forn.id,
        item_id: forn.item_id,
        fornecedor_id: forn.fornecedor_id,
        codigo_fornecedor: forn.codigo_fornecedor || null,
        descricao_fornecedor: forn.descricao_fornecedor || null,
        unidade_compra_padrao: forn.unidade_compra_padrao,
        fator_para_unidade_interna: forn.fator_para_unidade_interna,
        fornecedor_preferencial: forn.fornecedor_preferencial,
        preco_referencia: forn.preco_referencia || null,
      };

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
    } catch (err) {
      console.error('Error migrating item_fornecedor:', forn.id, err);
      errors++;
    }
  }

  return { migrated, errors };
}

// Migrate estoque_lotes from localStorage to Supabase
export async function migrateLotes(): Promise<{ migrated: number; errors: number }> {
  const localLotes = LocalDb.getCollection<LocalEstoqueLote>('estoque_lotes');
  let migrated = 0;
  let errors = 0;

  for (const lote of localLotes) {
    try {
      const { data: existing } = await supabase
        .from('estoque_lotes')
        .select('id')
        .eq('id', lote.id)
        .maybeSingle();

      const loteData = {
        id: lote.id,
        item_id: lote.item_id,
        fornecedor_id: lote.fornecedor_id || null,
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
    } catch (err) {
      console.error('Error migrating lote:', lote.id, err);
      errors++;
    }
  }

  return { migrated, errors };
}

// Full migration from localStorage to Supabase
export async function migrateAllToSupabase(): Promise<MigrationStats> {
  const stats: MigrationStats = {
    itens: { total: 0, migrated: 0, errors: 0 },
    entidades: { total: 0, migrated: 0, errors: 0 },
    lotes: { total: 0, migrated: 0, errors: 0 },
    itemFornecedores: { total: 0, migrated: 0, errors: 0 },
    contatos: { total: 0, migrated: 0, errors: 0 },
    enderecos: { total: 0, migrated: 0, errors: 0 },
  };

  // Get totals
  stats.itens.total = LocalDb.getCollection('itens').length;
  stats.entidades.total = LocalDb.getCollection('entidades').length;
  stats.lotes.total = LocalDb.getCollection('estoque_lotes').length;
  stats.itemFornecedores.total = LocalDb.getCollection('item_fornecedores').length;
  stats.contatos.total = LocalDb.getCollection('entidade_contatos').length;
  stats.enderecos.total = LocalDb.getCollection('entidade_enderecos').length;

  // Migrate in order (entidades first, then items, then relations)
  const entidadesResult = await migrateEntidades();
  stats.entidades.migrated = entidadesResult.migrated;
  stats.entidades.errors = entidadesResult.errors;

  const contatosResult = await migrateContatos();
  stats.contatos.migrated = contatosResult.migrated;
  stats.contatos.errors = contatosResult.errors;

  const enderecosResult = await migrateEnderecos();
  stats.enderecos.migrated = enderecosResult.migrated;
  stats.enderecos.errors = enderecosResult.errors;

  const itensResult = await migrateItens();
  stats.itens.migrated = itensResult.migrated;
  stats.itens.errors = itensResult.errors;

  const itemFornResult = await migrateItemFornecedores();
  stats.itemFornecedores.migrated = itemFornResult.migrated;
  stats.itemFornecedores.errors = itemFornResult.errors;

  const lotesResult = await migrateLotes();
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
