import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useEntidadeUpsert } from '../use-entidade-upsert';

// Mock do Supabase
const mockSupabase = {
  rpc: vi.fn(),
  from: vi.fn(),
};

// Mock do hook use-supabase
vi.mock('../use-supabase', () => ({
  useSupabase: () => ({
    supabase: mockSupabase,
  }),
}));

describe('useEntidadeUpsert', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('upsert', () => {
    it('deve criar nova entidade com sucesso', async () => {
      const entidadeId = '123e4567-e89b-12d3-a456-426614174000';
      mockSupabase.rpc.mockResolvedValueOnce({
        data: entidadeId,
        error: null,
      });

      const { result } = renderHook(() => useEntidadeUpsert());

      let upsertResult;
      await act(async () => {
        upsertResult = await result.current.upsert({
          documento: '12345678000190',
          company_id: 'company-123',
          razao_social: 'Empresa Teste LTDA',
          nome_fantasia: 'Empresa Teste',
          status: 'PENDENTE_CERTIFICADO',
        });
      });

      expect(upsertResult?.success).toBe(true);
      expect(upsertResult?.entidade_id).toBe(entidadeId);
      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'upsert_entidade',
        expect.objectContaining({
          p_documento: '12345678000190',
          p_company_id: 'company-123',
          p_razao_social: 'Empresa Teste LTDA',
        })
      );
    });

    it('deve atualizar entidade existente', async () => {
      const entidadeId = '123e4567-e89b-12d3-a456-426614174000';
      mockSupabase.rpc.mockResolvedValueOnce({
        data: entidadeId,
        error: null,
      });

      const { result } = renderHook(() => useEntidadeUpsert());

      let upsertResult;
      await act(async () => {
        upsertResult = await result.current.upsert({
          id: entidadeId,
          documento: '12345678000190',
          company_id: 'company-123',
          razao_social: 'Empresa Teste LTDA Atualizada',
        });
      });

      expect(upsertResult?.success).toBe(true);
      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'upsert_entidade',
        expect.objectContaining({
          p_id: entidadeId,
          p_razao_social: 'Empresa Teste LTDA Atualizada',
        })
      );
    });

    it('deve retornar erro quando CNPJ já existe', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: {
          message: 'CNPJ 12345678000190 já existe neste tenant',
        },
      });

      const { result } = renderHook(() => useEntidadeUpsert());

      let upsertResult;
      await act(async () => {
        upsertResult = await result.current.upsert({
          documento: '12345678000190',
          company_id: 'company-123',
          razao_social: 'Empresa Teste LTDA',
        });
      });

      expect(upsertResult?.success).toBe(false);
      expect(upsertResult?.error).toContain('já existe');
    });

    it('deve validar CNPJ obrigatório', async () => {
      const { result } = renderHook(() => useEntidadeUpsert());

      let upsertResult;
      await act(async () => {
        upsertResult = await result.current.upsert({
          documento: '',
          company_id: 'company-123',
          razao_social: 'Empresa Teste LTDA',
        });
      });

      expect(upsertResult?.success).toBe(false);
      expect(upsertResult?.error).toContain('CNPJ é obrigatório');
    });

    it('deve validar razão social obrigatória', async () => {
      const { result } = renderHook(() => useEntidadeUpsert());

      let upsertResult;
      await act(async () => {
        upsertResult = await result.current.upsert({
          documento: '12345678000190',
          company_id: 'company-123',
          razao_social: '',
        });
      });

      expect(upsertResult?.success).toBe(false);
      expect(upsertResult?.error).toContain('Razão social é obrigatória');
    });

    it('deve validar company_id obrigatório', async () => {
      const { result } = renderHook(() => useEntidadeUpsert());

      let upsertResult;
      await act(async () => {
        upsertResult = await result.current.upsert({
          documento: '12345678000190',
          company_id: '',
          razao_social: 'Empresa Teste LTDA',
        });
      });

      expect(upsertResult?.success).toBe(false);
      expect(upsertResult?.error).toContain('Company ID é obrigatório');
    });
  });

  describe('checkDuplicate', () => {
    it('deve retornar true quando CNPJ existe', async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockReturnValueOnce({
            eq: vi.fn().mockReturnValueOnce({
              neq: vi.fn().mockReturnValueOnce({
                limit: vi.fn().mockResolvedValueOnce({
                  data: [{ id: '123' }],
                  error: null,
                }),
              }),
            }),
          }),
        }),
      });

      const { result } = renderHook(() => useEntidadeUpsert());

      let isDuplicate;
      await act(async () => {
        isDuplicate = await result.current.checkDuplicate(
          '12345678000190',
          'company-123'
        );
      });

      expect(isDuplicate).toBe(true);
    });

    it('deve retornar false quando CNPJ não existe', async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockReturnValueOnce({
            eq: vi.fn().mockReturnValueOnce({
              neq: vi.fn().mockReturnValueOnce({
                limit: vi.fn().mockResolvedValueOnce({
                  data: [],
                  error: null,
                }),
              }),
            }),
          }),
        }),
      });

      const { result } = renderHook(() => useEntidadeUpsert());

      let isDuplicate;
      await act(async () => {
        isDuplicate = await result.current.checkDuplicate(
          '12345678000190',
          'company-123'
        );
      });

      expect(isDuplicate).toBe(false);
    });
  });

  describe('updateStatus', () => {
    it('deve atualizar status com sucesso', async () => {
      mockSupabase.from.mockReturnValueOnce({
        update: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockResolvedValueOnce({
            error: null,
          }),
        }),
      });

      const { result } = renderHook(() => useEntidadeUpsert());

      let success;
      await act(async () => {
        success = await result.current.updateStatus(
          '123e4567-e89b-12d3-a456-426614174000',
          'CERTIFICADO_VALIDADO'
        );
      });

      expect(success).toBe(true);
    });

    it('deve retornar false em caso de erro', async () => {
      mockSupabase.from.mockReturnValueOnce({
        update: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockResolvedValueOnce({
            error: { message: 'Erro ao atualizar' },
          }),
        }),
      });

      const { result } = renderHook(() => useEntidadeUpsert());

      let success;
      await act(async () => {
        success = await result.current.updateStatus(
          '123e4567-e89b-12d3-a456-426614174000',
          'CERTIFICADO_VALIDADO'
        );
      });

      expect(success).toBe(false);
    });
  });

  describe('getAuditHistory', () => {
    it('deve retornar histórico de auditoria', async () => {
      const auditData = [
        {
          id: '1',
          acao: 'INSERT',
          timestamp: '2026-06-24T10:00:00Z',
          dados_depois: { razao_social: 'Empresa Teste' },
        },
        {
          id: '2',
          acao: 'UPDATE',
          timestamp: '2026-06-24T11:00:00Z',
          dados_antes: { razao_social: 'Empresa Teste' },
          dados_depois: { razao_social: 'Empresa Teste Atualizada' },
        },
      ];

      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockReturnValueOnce({
            order: vi.fn().mockResolvedValueOnce({
              data: auditData,
              error: null,
            }),
          }),
        }),
      });

      const { result } = renderHook(() => useEntidadeUpsert());

      let history;
      await act(async () => {
        history = await result.current.getAuditHistory(
          '123e4567-e89b-12d3-a456-426614174000'
        );
      });

      expect(history).toEqual(auditData);
      expect(history.length).toBe(2);
    });

    it('deve retornar array vazio em caso de erro', async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockReturnValueOnce({
            order: vi.fn().mockResolvedValueOnce({
              data: null,
              error: { message: 'Erro ao buscar' },
            }),
          }),
        }),
      });

      const { result } = renderHook(() => useEntidadeUpsert());

      let history;
      await act(async () => {
        history = await result.current.getAuditHistory(
          '123e4567-e89b-12d3-a456-426614174000'
        );
      });

      expect(history).toEqual([]);
    });
  });
});
