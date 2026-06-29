#!/usr/bin/env node

/**
 * Script para aplicar migrations SQL no Supabase
 * Uso: node scripts/apply-migration.js [migration-file]
 * 
 * Exemplos:
 *   node scripts/apply-migration.js supabase/migrations/20260624_create_sensores_table.sql
 *   node scripts/apply-migration.js all  # Aplicar todas as migrations
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configurações
const SUPABASE_URL = process.env.VITE_FRONTEND_FORGE_API_URL || 'https://cqkvekdrifmvedvpjmjr.supabase.co';
const SUPABASE_KEY = process.env.VITE_FRONTEND_FORGE_API_KEY;
const MIGRATIONS_DIR = path.join(__dirname, '../supabase/migrations');

if (!SUPABASE_KEY) {
  console.error('❌ Erro: VITE_FRONTEND_FORGE_API_KEY não está definida');
  process.exit(1);
}

/**
 * Executar SQL diretamente via Supabase Client
 */
async function executeSqlViaClient(sql) {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    
    // Dividir SQL em statements individuais
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    let successCount = 0;
    
    for (const statement of statements) {
      try {
        // Tentar executar via RPC
        const { data, error } = await supabase.rpc('exec_sql', { sql: statement + ';' });
        
        if (error) {
          console.log(`⚠️  Erro ao executar: ${statement.substring(0, 50)}...`);
          console.log(`   ${error.message}`);
        } else {
          console.log(`✅ Executado: ${statement.substring(0, 50)}...`);
          successCount++;
        }
      } catch (err) {
        console.log(`⚠️  Erro: ${err.message}`);
      }
    }
    
    return { success: successCount > 0, count: successCount };
  } catch (err) {
    throw err;
  }
}

/**
 * Aplicar uma migration específica
 */
async function applyMigration(migrationFile) {
  try {
    const fullPath = path.isAbsolute(migrationFile) 
      ? migrationFile 
      : path.join(MIGRATIONS_DIR, migrationFile);
    
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Arquivo não encontrado: ${fullPath}`);
    }
    
    console.log(`📄 Lendo migration: ${path.basename(fullPath)}`);
    const sql = fs.readFileSync(fullPath, 'utf-8');
    
    console.log(`⏳ Aplicando migration...`);
    
    // Tentar via cliente Supabase
    try {
      const result = await executeSqlViaClient(sql);
      if (result.success) {
        console.log(`✅ Migration aplicada com sucesso! (${result.count} statements)`);
        return true;
      } else {
        console.log(`⚠️  Nenhum statement foi executado`);
        console.log(`💡 Dica: Execute o SQL manualmente no Supabase Dashboard`);
        return false;
      }
    } catch (err) {
      console.log(`⚠️  Erro ao aplicar via cliente: ${err.message}`);
      console.log(`💡 Dica: Execute o SQL manualmente no Supabase Dashboard`);
      console.log(`\n📋 SQL da migration:\n${sql}\n`);
      return false;
    }
  } catch (err) {
    console.error(`❌ Erro: ${err.message}`);
    return false;
  }
}

/**
 * Aplicar todas as migrations
 */
async function applyAllMigrations() {
  try {
    if (!fs.existsSync(MIGRATIONS_DIR)) {
      console.log(`📁 Diretório de migrations não existe: ${MIGRATIONS_DIR}`);
      return false;
    }
    
    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort();
    
    if (files.length === 0) {
      console.log('ℹ️  Nenhuma migration encontrada');
      return true;
    }
    
    console.log(`📋 Encontradas ${files.length} migration(s)`);
    
    for (const file of files) {
      console.log(`\n📌 Aplicando: ${file}`);
      await applyMigration(file);
    }
    
    return true;
  } catch (err) {
    console.error(`❌ Erro: ${err.message}`);
    return false;
  }
}

/**
 * Main
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
🚀 Script de Migrations Supabase

Uso:
  node scripts/apply-migration.js [migration-file]
  node scripts/apply-migration.js all

Exemplos:
  node scripts/apply-migration.js supabase/migrations/20260624_create_sensores_table.sql
  node scripts/apply-migration.js 20260624_create_sensores_table.sql
  node scripts/apply-migration.js all

Variáveis de Ambiente:
  VITE_FRONTEND_FORGE_API_URL  - URL do Supabase
  VITE_FRONTEND_FORGE_API_KEY  - Chave da API Supabase
    `);
    process.exit(0);
  }
  
  const target = args[0];
  
  if (target === 'all') {
    const success = await applyAllMigrations();
    process.exit(success ? 0 : 1);
  } else {
    const success = await applyMigration(target);
    process.exit(success ? 0 : 1);
  }
}

main().catch(err => {
  console.error('❌ Erro fatal:', err.message);
  process.exit(1);
});
