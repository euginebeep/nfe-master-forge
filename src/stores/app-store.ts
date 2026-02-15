import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  currentCompanyId: string | null;
  setCompanyId: (id: string) => void;
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      currentCompanyId: null,
      setCompanyId: (id) => set({ currentCompanyId: id }),
      theme: 'system',
      setTheme: (theme) => set({ theme }),
    }),
    { name: 'brainx-app-store' }
  )
);
