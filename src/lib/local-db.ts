// LocalDb - localStorage-based persistence layer

type CollectionName = 
  | 'entidades'
  | 'entidade_contatos'
  | 'entidade_enderecos'
  | 'itens'
  | 'item_fornecedores'
  | 'item_alias'
  | 'estoque_lotes'
  | 'lote_documentos'
  | 'company'
  | 'arquivos'
  | 'notas_entrada'
  | 'notas_entrada_itens';

const STORAGE_PREFIX = 'legacy_erp_';

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function getStorageKey(collection: CollectionName): string {
  return `${STORAGE_PREFIX}${collection}`;
}

export function getCollection<T>(collection: CollectionName): T[] {
  try {
    const data = localStorage.getItem(getStorageKey(collection));
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function setCollection<T>(collection: CollectionName, data: T[]): void {
  localStorage.setItem(getStorageKey(collection), JSON.stringify(data));
}

export function getById<T extends { id: string }>(collection: CollectionName, id: string): T | null {
  const items = getCollection<T>(collection);
  return items.find(item => item.id === id) || null;
}

export function insert<T>(collection: CollectionName, item: any): T {
  const items = getCollection<T>(collection);
  const newItem = {
    ...item,
    id: item.id || generateUUID(),
    created_at: new Date().toISOString(),
  } as T;
  items.push(newItem);
  setCollection(collection, items);
  return newItem;
}

export function update<T extends { id: string }>(collection: CollectionName, id: string, updates: Partial<T>): T | null {
  const items = getCollection<T>(collection);
  const index = items.findIndex(item => item.id === id);
  if (index === -1) return null;
  
  const updatedItem = {
    ...items[index],
    ...updates,
    updated_at: new Date().toISOString(),
  } as T;
  items[index] = updatedItem;
  setCollection(collection, items);
  return updatedItem;
}

export function remove(collection: CollectionName, id: string): boolean {
  const items = getCollection<{ id: string }>(collection);
  const filtered = items.filter(item => item.id !== id);
  if (filtered.length === items.length) return false;
  setCollection(collection, filtered);
  return true;
}

export function query<T>(collection: CollectionName, predicate: (item: T) => boolean): T[] {
  const items = getCollection<T>(collection);
  return items.filter(predicate);
}

export function getSingleton<T>(collection: CollectionName): T | null {
  const items = getCollection<T>(collection);
  return items[0] || null;
}

export function upsertSingleton<T>(collection: CollectionName, data: Partial<T>): T {
  const existing = getSingleton<T & { id: string }>(collection);
  if (existing) {
    return update<T & { id: string }>(collection, existing.id, data as any) as T;
  }
  return insert<T>(collection, data);
}

// Generate SKU automatically
export function generateSKU(tipo: string): string {
  const prefix = tipo.substring(0, 3).toUpperCase();
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

// Seed initial data
export function seedInitialData(): void {
  // Seed company if empty
  const company = getSingleton<any>('company');
  if (!company) {
    insert('company', {
      razao_social: '',
      nome_fantasia: '',
      cnpj: '',
      ie: '',
      im: '',
      cnae: '',
      crt: '',
      regime_tributario: '',
      endereco_logradouro: '',
      endereco_nro: '',
      endereco_compl: '',
      endereco_bairro: '',
      endereco_cidade: '',
      endereco_uf: '',
      endereco_cep: '',
      endereco_pais: 'Brasil',
      telefone: '',
      site: '',
      email_fiscal: '',
      email_financeiro: '',
      nfe_ambiente: 'HOMOLOGACAO',
      nfe_serie_padrao: 1,
      nfe_numero_inicial: 1,
      csc_idtoken: '',
      csc_token: '',
    });
  }
}

// Initialize on load
seedInitialData();

// Clear all data
export function clearAll(): void {
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(STORAGE_PREFIX)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(key => localStorage.removeItem(key));
}

export const LocalDb = {
  getCollection,
  setCollection,
  getById,
  insert,
  update,
  remove,
  query,
  getSingleton,
  upsertSingleton,
  generateSKU,
  generateUUID,
  clearAll,
};

export default LocalDb;
