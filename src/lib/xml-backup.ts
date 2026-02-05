// ============================================
// ARMAZENAMENTO DE XMLs ORIGINAIS - BACKUP GERENCIAL
// ============================================

import { LocalDb } from './local-db';

export interface XmlBackup {
  id: string;
  chave_acesso: string;
  numero_nota: string;
  serie: string;
  data_emissao: string;
  fornecedor_cnpj: string;
  fornecedor_razao: string;
  valor_total: number;
  xml_original: string; // XML completo e original, sem modificações
  tamanho_bytes: number;
  hash_sha256: string;
  created_at: string;
}

const COLLECTION_NAME = 'xml_backups';
const STORAGE_PREFIX = 'legacy_erp_';

function getStorageKey(): string {
  return `${STORAGE_PREFIX}${COLLECTION_NAME}`;
}

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// ============================================
// CRUD OPERATIONS
// ============================================

export function getAllXmlBackups(): XmlBackup[] {
  try {
    const data = localStorage.getItem(getStorageKey());
    const backups = data ? JSON.parse(data) : [];
    // Ordenar por data de criação (mais recente primeiro)
    return backups.sort((a: XmlBackup, b: XmlBackup) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  } catch {
    return [];
  }
}

export function getXmlBackupByChave(chaveAcesso: string): XmlBackup | null {
  const backups = getAllXmlBackups();
  return backups.find(b => b.chave_acesso === chaveAcesso) || null;
}

export function getXmlBackupById(id: string): XmlBackup | null {
  const backups = getAllXmlBackups();
  return backups.find(b => b.id === id) || null;
}

export function saveXmlBackup(
  xmlOriginal: string,
  metadata: {
    chave_acesso: string;
    numero_nota: string;
    serie: string;
    data_emissao: string;
    fornecedor_cnpj: string;
    fornecedor_razao: string;
    valor_total: number;
  }
): XmlBackup {
  // Verificar se já existe
  const existing = getXmlBackupByChave(metadata.chave_acesso);
  if (existing) {
    return existing;
  }

  const backup: XmlBackup = {
    id: generateUUID(),
    ...metadata,
    xml_original: xmlOriginal,
    tamanho_bytes: new Blob([xmlOriginal]).size,
    hash_sha256: hashString(xmlOriginal),
    created_at: new Date().toISOString(),
  };

  const backups = getAllXmlBackups();
  backups.push(backup);
  localStorage.setItem(getStorageKey(), JSON.stringify(backups));

  return backup;
}

export function deleteXmlBackup(id: string): boolean {
  const backups = getAllXmlBackups();
  const filtered = backups.filter(b => b.id !== id);
  if (filtered.length === backups.length) return false;
  localStorage.setItem(getStorageKey(), JSON.stringify(filtered));
  return true;
}

// ============================================
// DOWNLOAD XML
// ============================================

export function downloadXml(backup: XmlBackup): void {
  const blob = new Blob([backup.xml_original], { type: 'application/xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `NFe_${backup.numero_nota}_${backup.serie}_${backup.chave_acesso}.xml`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadAllXmls(): void {
  const backups = getAllXmlBackups();
  if (backups.length === 0) return;

  // Download como um arquivo txt com todos os XMLs
  const content = backups.map(b => {
    return `========================================
CHAVE: ${b.chave_acesso}
NÚMERO: ${b.numero_nota} | SÉRIE: ${b.serie}
FORNECEDOR: ${b.fornecedor_razao} (${b.fornecedor_cnpj})
DATA: ${b.data_emissao}
VALOR: R$ ${b.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
========================================
${b.xml_original}

`;
  }).join('\n\n');

  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `backup_xmls_nfe_${new Date().toISOString().split('T')[0]}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ============================================
// ESTATÍSTICAS
// ============================================

export function getXmlBackupStats(): {
  total: number;
  tamanhoTotal: number;
  valorTotal: number;
} {
  const backups = getAllXmlBackups();
  return {
    total: backups.length,
    tamanhoTotal: backups.reduce((sum, b) => sum + b.tamanho_bytes, 0),
    valorTotal: backups.reduce((sum, b) => sum + b.valor_total, 0),
  };
}

// ============================================
// LIMPAR TODOS
// ============================================

export function clearAllXmlBackups(): void {
  localStorage.removeItem(getStorageKey());
}
