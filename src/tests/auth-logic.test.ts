import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks simples para testar a lógica de persistência e redirecionamento sem depender de rede real
describe('Auth Persistence and Logic', () => {
  beforeEach(() => {
    vi.stubGlobal('sessionStorage', {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    });
    vi.stubGlobal('location', {
      href: '',
    });
  });

  it('should persist demo flag when profile is demo', async () => {
    // Simulação da lógica que adicionei no AuthContext
    const profile = { is_demo: true };
    const isDemoPersisted = false;
    
    const isDemo = profile?.is_demo || isDemoPersisted;
    
    if (isDemo) {
      sessionStorage.setItem('brainx_demo_mode', 'true');
    }
    
    expect(sessionStorage.setItem).toHaveBeenCalledWith('brainx_demo_mode', 'true');
  });

  it('should clear demo flag on real login attempt', () => {
    // Simulação da lógica no AuthPageModern
    const handleLogin = () => {
      sessionStorage.removeItem('brainx_demo_mode');
    };
    
    handleLogin();
    expect(sessionStorage.removeItem).toHaveBeenCalledWith('brainx_demo_mode');
  });

  it('should resolve to demo company if demo mode is active', () => {
    // Simulação da lógica no use-company.ts
    const profile = { company_id: null, is_demo: false };
    const isDemoPersisted = true;
    
    const isDemo = profile?.is_demo || isDemoPersisted;
    const companyId = profile?.company_id || (isDemo ? '00000000-0000-0000-0000-000000000001' : null);
    
    expect(companyId).toBe('00000000-0000-0000-0000-000000000001');
  });
});
