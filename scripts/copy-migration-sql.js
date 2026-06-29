#!/usr/bin/env node

/**
 * Script para copiar o SQL de uma migration para o clipboard
 * Uso: node scripts/copy-migration-sql.js [migration-file]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIGRATIONS_DIR = path.join(__dirname, '../supabase/migrations');

async function copyToClipboard(text) {
  try {
    // Tentar xclip (Linux)
    await execAsync(`echo '${text.replace(/'/g, "'\\'''")}' | xclip -selection clipboard`);
    return true;
  } catch (err) {
    try {
      // Tentar pbcopy (macOS)
      await execAsync(`echo '${text.replace(/'/g, "'\\'''")}' | pbcopy`);
      return true;
    } catch (err2) {
      return false;
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
🚀 Script para Copiar SQL de Migration

Uso:
  node scripts/copy-migration-sql.js [migration-file]

Exemplos:
  node scripts/copy-migration-sql.js 20260624_create_sensores_table.sql

    `);
    process.exit(0);
  }
  
  const migrationFile = args[0];
  const fullPath = path.join(MIGRATIONS_DIR, migrationFile);
  
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ Arquivo não encontrado: ${fullPath}`);
    process.exit(1);
  }
  
  const sql = fs.readFileSync(fullPath, 'utf-8');
  
  console.log(`📄 Lendo migration: ${path.basename(fullPath)}`);
  console.log(`📋 Conteúdo do SQL:\n`);
  console.log(sql);
  console.log(`\n`);
  
  const copied = await copyToClipboard(sql);
  
  if (copied) {
    console.log(`✅ SQL copiado para o clipboard!`);
    console.log(`\n💡 Próximos passos:`);
    console.log(`   1. Abra https://supabase.com/dashboard`);
    console.log(`   2. Vá para SQL Editor`);
    console.log(`   3. Cole o SQL (Ctrl+V ou Cmd+V)`);
    console.log(`   4. Clique em "Run"`);
  } else {
    console.log(`⚠️  Não foi possível copiar para o clipboard`);
    console.log(`\n💡 Copie manualmente o SQL acima e cole no Supabase Dashboard`);
  }
}

main().catch(err => {
  console.error('❌ Erro:', err.message);
  process.exit(1);
});
