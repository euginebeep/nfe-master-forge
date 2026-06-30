// LocalDb - localStorage-based persistence layer
// ⚠️ DEPRECATED for business data (itens, entidades, lotes, notas)
// Only use for UI preferences, filters, and temporary state.
// All business data MUST go through Supabase with proper company_id.
import { generateUUID } from './utils';
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

function getStorageKey(collection: CollectionName): string {
  return `${STORAGE_PREFIX}${collection}`;
}

function notifyChange(collection?: string) {
  try {
    if (typeof window === 'undefined') return;
    if (typeof CustomEvent === 'undefined') return;
    window.dispatchEvent(new CustomEvent('localdb:change', { detail: { collection } }));
  } catch {
    // ignore (e.g. tests / restricted env)
  }
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
  notifyChange(collection);
}

export function getById<T extends { id: string }>(collection: CollectionName, id: string): T | null {
  const items = getCollection<T>(collection);
  return items.find(item => item.id === id) || null;
}

export function insert<T>(collection: CollectionName, item: any): T {
  console.warn(`[LocalDb] ⚠️ insert() called on '${collection}' — this data will NOT be persisted to the cloud. Use Supabase hooks instead.`);
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

// ⚠️ REMOVED: seedInitialData() - company data MUST come from Supabase
// No longer auto-creating localStorage company records on load.

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
  notifyChange('*');
}

// ── Remediação de segurança (2026-06-30) ──────────────────────────────────
// A tela antiga de configurações de empresa (EmpresaSettingsPage, removida e
// substituída por um redirect para /settings/company) salvava a senha do
// certificado digital A1 em texto puro dentro do singleton 'company' deste
// LocalDb (chave legacy_erp_company no localStorage). Ninguém mais escreve
// nem lê esse singleton hoje (use-local-company.ts ficou órfão), mas quem já
// usou a tela antiga ainda tem a senha salva no navegador. Esta função roda
// uma vez na inicialização do app e remove só o campo sensível, mantendo o
// resto do registro intacto (caso algo ainda dependa dele no futuro).
const PURGE_FLAG_KEY = `${STORAGE_PREFIX}__purged_cert_senha_v1`;

export function purgeLegacyCertificatePassword(): void {
  try {
    if (typeof window === 'undefined') return;
    if (localStorage.getItem(PURGE_FLAG_KEY)) return; // já rodou nesta máquina

    const raw = localStorage.getItem(getStorageKey('company'));
    if (raw) {
      const data = JSON.parse(raw);
      if (data && typeof data === 'object' && 'certificado_senha' in data) {
        delete data.certificado_senha;
        localStorage.setItem(getStorageKey('company'), JSON.stringify(data));
      }
    }
    localStorage.setItem(PURGE_FLAG_KEY, '1');
  } catch {
    // Ambiente sem localStorage (SSR, testes) — ignora silenciosamente
  }
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
  purgeLegacyCertificatePassword,
};

export default LocalDb;
