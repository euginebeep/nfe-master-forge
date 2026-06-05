import { describe, it, expect } from 'vitest';
import { normalizeEmail, normalizePhone, isDemoExpired } from './leads-utils';

describe('Leads Utilities', () => {
  describe('normalizeEmail', () => {
    it('should convert email to lowercase', () => {
      expect(normalizeEmail('TEST@EXAMPLE.COM')).toBe('test@example.com');
    });

    it('should trim whitespace', () => {
      expect(normalizeEmail('  test@example.com  ')).toBe('test@example.com');
    });

    it('should handle complex email formats', () => {
      expect(normalizeEmail('  John.Doe+Tag@EXAMPLE.co.uk  ')).toBe('john.doe+tag@example.co.uk');
    });
  });

  describe('normalizePhone', () => {
    it('should remove non-digit characters', () => {
      expect(normalizePhone('(11) 99999-9999')).toBe('11999999999');
      expect(normalizePhone('+55 (11) 99999-9999')).toBe('5511999999999');
    });

    it('should handle alphanumeric input by removing letters', () => {
      expect(normalizePhone('11-99999-9999 ext 123')).toBe('11999999999123');
    });
  });

  describe('isDemoExpired', () => {
    it('should return false for recent dates', () => {
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 5); // 5 days ago
      expect(isDemoExpired(recentDate.toISOString())).toBe(false);
    });

    it('should return true for dates older than 15 days', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 16); // 16 days ago
      expect(isDemoExpired(oldDate.toISOString())).toBe(true);
    });

    it('should return true for exactly 16 days ago', () => {
      const sixteenDaysAgo = new Date();
      sixteenDaysAgo.setDate(sixteenDaysAgo.getDate() - 16);
      expect(isDemoExpired(sixteenDaysAgo.toISOString())).toBe(true);
    });
    
    it('should return false for exactly 15 days ago', () => {
      const fifteenDaysAgo = new Date();
      fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
      expect(isDemoExpired(fifteenDaysAgo.toISOString())).toBe(false);
    });
  });
});
