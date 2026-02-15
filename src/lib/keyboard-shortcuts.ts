/**
 * Atalhos de teclado globais do BrainX ERP
 * - Ctrl+K: Busca global (já implementado no GlobalSearchDialog)
 * - Ctrl+/: Exibir lista de atalhos
 */

export const KEYBOARD_SHORTCUTS = [
  { keys: ['Ctrl', 'K'], description: 'Busca global' },
  { keys: ['Ctrl', '/'], description: 'Lista de atalhos' },
  { keys: ['Escape'], description: 'Fechar modal/dialog' },
] as const;

export function registerGlobalShortcuts() {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Ctrl+/ - Show shortcuts (can be handled by a component)
    if (e.ctrlKey && e.key === '/') {
      e.preventDefault();
      document.dispatchEvent(new CustomEvent('show-shortcuts'));
    }
  };

  document.addEventListener('keydown', handleKeyDown);
  return () => document.removeEventListener('keydown', handleKeyDown);
}
