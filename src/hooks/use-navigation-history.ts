import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

interface NavigationEntry {
  path: string;
  timestamp: number;
}

const MAX_HISTORY = 50;

export function useNavigationHistory() {
  const navigate = useNavigate();
  const location = useLocation();
  const [history, setHistory] = useState<NavigationEntry[]>([]);
  const [canGoBack, setCanGoBack] = useState(false);

  // Inicializar histórico do sessionStorage
  useEffect(() => {
    const stored = sessionStorage.getItem('navigationHistory');
    if (stored) {
      try {
        setHistory(JSON.parse(stored));
      } catch {
        setHistory([]);
      }
    }
  }, []);

  // Atualizar histórico quando a rota muda
  useEffect(() => {
    setHistory((prev) => {
      // Não adicionar duplicatas consecutivas
      if (prev.length > 0 && prev[prev.length - 1].path === location.pathname) {
        return prev;
      }

      const newHistory = [
        ...prev,
        {
          path: location.pathname,
          timestamp: Date.now(),
        },
      ].slice(-MAX_HISTORY);

      sessionStorage.setItem('navigationHistory', JSON.stringify(newHistory));
      setCanGoBack(newHistory.length > 1);

      return newHistory;
    });
  }, [location.pathname]);

  const goBack = () => {
    if (history.length > 1) {
      // Voltar para a página anterior
      const previousPath = history[history.length - 2].path;
      navigate(previousPath);
    } else {
      // Se não houver histórico, voltar para dashboard
      navigate('/');
    }
  };

  return {
    goBack,
    canGoBack,
    history,
    currentPath: location.pathname,
  };
}
