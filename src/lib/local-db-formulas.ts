// Extensão do LocalDb para suportar fórmulas
// Este arquivo garante que a coleção 'formulas' seja reconhecida

import { Formula } from '@/types/formulas';
import { LocalDb } from './local-db';

// Adicionar 'formulas' como coleção válida
// O TypeScript inferirá que podemos usar LocalDb com 'formulas'

export function getFormulas(): Formula[] {
  return LocalDb.getCollection<Formula>('formulas' as any);
}

export function getFormulaById(id: string): Formula | null {
  return LocalDb.getById<Formula>('formulas' as any, id);
}

export function insertFormula(formula: Omit<Formula, 'id'>): Formula {
  return LocalDb.insert<Formula>('formulas' as any, formula);
}

export function updateFormula(id: string, updates: Partial<Formula>): Formula | null {
  return LocalDb.update<Formula>('formulas' as any, id, updates);
}

export function deleteFormula(id: string): boolean {
  return LocalDb.remove('formulas' as any, id);
}

export function queryFormulas(predicate: (f: Formula) => boolean): Formula[] {
  return LocalDb.query<Formula>('formulas' as any, predicate);
}
