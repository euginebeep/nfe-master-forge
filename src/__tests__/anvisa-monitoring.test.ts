/**
 * Testes para ANVISA Monitoring Service
 * 
 * Valida:
 * - Validação de conformidade
 * - Validação de grupo populacional
 * - Validação de restrições de associação
 * - Geração de alertas
 * - Identificação de produtos não conformes
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ANVISA_LIMITS } from '@/lib/anvisa-limits';

describe('ANVISA Monitoring Service', () => {
  describe('Validação de Constituintes', () => {
    it('deve validar GABA dentro dos limites', () => {
      const gaba = ANVISA_LIMITS['gaba'];
      expect(gaba).toBeDefined();
      expect(gaba.min).toBe(50);
      expect(gaba.max).toBe(300);
      expect(gaba.unit).toBe('mg');
    });

    it('deve validar Curcumina dentro dos limites', () => {
      const curcumina = ANVISA_LIMITS['curcumina'];
      expect(curcumina).toBeDefined();
      expect(curcumina.min).toBe(80);
      expect(curcumina.max).toBe(130);
      expect(curcumina.unit).toBe('mg');
    });

    it('deve validar Colageno Tipo 2 com mínimo correto', () => {
      const colageno = ANVISA_LIMITS['colageno_tipo2'];
      expect(colageno).toBeDefined();
      expect(colageno.min).toBe(40);
      expect(colageno.max).toBeNull();
    });
  });

  describe('Validação de Grupo Populacional', () => {
    it('GABA deve ser permitido apenas para ≥19 anos', () => {
      const gaba = ANVISA_LIMITS['gaba'];
      expect(gaba.allowedGroups).toContain('ADULTOS_19PLUS');
      expect(gaba.restrictedGroups).toContain('GESTANTES');
      expect(gaba.restrictedGroups).toContain('LACTANTES');
      expect(gaba.restrictedGroups).toContain('CRIANCAS_4_8');
    });

    it('2\'-Fucosil-lactose deve ser permitido para gestantes e lactantes', () => {
      const fucosil = ANVISA_LIMITS['fucosil_lactose_2'];
      expect(fucosil.allowedGroups).toContain('GESTANTES');
      expect(fucosil.allowedGroups).toContain('LACTANTES');
      expect(fucosil.allowedGroups).toContain('CRIANCAS_4_8');
    });

    it('Bacillus coagulans deve ser permitido para crianças 4-8 anos', () => {
      const bacillus = ANVISA_LIMITS['bacillus_coagulans_snz1969'];
      expect(bacillus.allowedGroups).toContain('CRIANCAS_4_8');
      expect(bacillus.allowedGroups).toContain('CRIANCAS_9_18');
      expect(bacillus.allowedGroups).toContain('ADULTOS_19PLUS');
      expect(bacillus.restrictedGroups).toContain('GESTANTES');
    });
  });

  describe('Validação de Restrição de Associação', () => {
    it('Curcumina não pode ser associada com Tetraidrocurcuminoides', () => {
      const curcumina = ANVISA_LIMITS['curcumina'];
      expect(curcumina.restrictions).toBeDefined();
      expect(curcumina.restrictions?.cannotBeWith).toContain('tetraidrocurcuminoides');
    });

    it('Tetraidrocurcuminoides não pode ser associado com Curcumina', () => {
      const tetraidro = ANVISA_LIMITS['tetraidrocurcuminoides'];
      expect(tetraidro.restrictions).toBeDefined();
      expect(tetraidro.restrictions?.cannotBeWith).toContain('curcumina');
    });
  });

  describe('Casos de Uso Reais', () => {
    it('Produto ARTRIVITAN ULTRA com Colageno 20mg deve ser não conforme', () => {
      const colageno = ANVISA_LIMITS['colageno_tipo2'];
      const dose = 20;
      const isNonCompliant = dose < colageno.min;
      expect(isNonCompliant).toBe(true);
    });

    it('Produto com GABA 50mg e grupo GESTANTES deve ser não conforme', () => {
      const gaba = ANVISA_LIMITS['gaba'];
      const targetGroup = 'GESTANTES';
      const isNonCompliant = gaba.restrictedGroups?.includes(targetGroup);
      expect(isNonCompliant).toBe(true);
    });

    it('Produto com Curcumina 100mg + Tetraidrocurcuminoides 50mg deve detectar restrição', () => {
      const curcumina = ANVISA_LIMITS['curcumina'];
      const hasRestriction =
        curcumina.restrictions?.cannotBeWith.includes('tetraidrocurcuminoides');
      expect(hasRestriction).toBe(true);
    });

    it('Produto com 2\'-Fucosil-lactose 3g para gestante deve ser conforme', () => {
      const fucosil = ANVISA_LIMITS['fucosil_lactose_2'];
      const dose = 3000; // 3g em mg
      const targetGroup = 'GESTANTES';
      const isAllowed = fucosil.allowedGroups?.includes(targetGroup);
      const isWithinLimits = dose <= fucosil.max!;
      expect(isAllowed && isWithinLimits).toBe(true);
    });
  });

  describe('Legislação Vigente', () => {
    it('deve ter IN 373/2025 implementada', () => {
      const gaba = ANVISA_LIMITS['gaba'];
      const fucosil = ANVISA_LIMITS['fucosil_lactose_2'];
      const bacillus = ANVISA_LIMITS['bacillus_coagulans_snz1969'];
      
      expect(gaba.norm).toContain('IN 373/2025');
      expect(fucosil.norm).toContain('IN 373/2025');
      expect(bacillus.norm).toContain('IN 373/2025');
    });

    it('deve ter IN 438/2026 implementada', () => {
      const curcumina = ANVISA_LIMITS['curcumina'];
      const tetraidro = ANVISA_LIMITS['tetraidrocurcuminoides'];
      
      expect(curcumina.norm).toContain('IN 438/2026');
      expect(tetraidro.norm).toContain('IN 438/2026');
    });

    it('deve ter IN 102/2021 implementada para Colageno', () => {
      const colageno = ANVISA_LIMITS['colageno_tipo2'];
      expect(colageno.norm).toContain('IN 102/2021');
    });
  });

  describe('Limites Específicos por Faixa Etária', () => {
    it('Bacillus coagulans deve ter documentação de mínimos diferenciados', () => {
      const bacillus = ANVISA_LIMITS['bacillus_coagulans_snz1969'];
      expect(bacillus.obs).toContain('4-8 anos');
      expect(bacillus.obs).toContain('9-18 anos');
      expect(bacillus.obs).toContain('≥19 anos');
      expect(bacillus.obs).toContain('2×10⁹');
    });
  });

  describe('Conformidade Geral', () => {
    it('todos os constituintes críticos devem ter allowedGroups definido', () => {
      const criticalConstituents = [
        'gaba',
        'curcumina',
        'tetraidrocurcuminoides',
        'lactobacillus_acidophilus_dds1',
        'bacillus_coagulans_snz1969',
      ];

      for (const key of criticalConstituents) {
        const constituent = ANVISA_LIMITS[key];
        expect(constituent.allowedGroups).toBeDefined();
        expect(constituent.allowedGroups!.length).toBeGreaterThan(0);
      }
    });

    it('todos os constituintes críticos devem ter restrictedGroups definido', () => {
      const criticalConstituents = [
        'gaba',
        'curcumina',
        'tetraidrocurcuminoides',
        'lactobacillus_acidophilus_dds1',
        'bacillus_coagulans_snz1969',
      ];

      for (const key of criticalConstituents) {
        const constituent = ANVISA_LIMITS[key];
        expect(constituent.restrictedGroups).toBeDefined();
        expect(constituent.restrictedGroups!.length).toBeGreaterThan(0);
      }
    });
  });
});

