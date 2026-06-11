import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface CentralToastMessage {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
}

// Global toast queue
let toastQueue: CentralToastMessage[] = [];
let listeners: ((toasts: CentralToastMessage[]) => void)[] = [];

const notifyListeners = () => {
  listeners.forEach(listener => listener([...toastQueue]));
};

export const centralToast = {
  success: (title: string, description?: string) => {
    const id = crypto.randomUUID();
    toastQueue.push({ id, type: 'success', title, description });
    notifyListeners();
    setTimeout(() => {
      toastQueue = toastQueue.filter(t => t.id !== id);
      notifyListeners();
    }, 4000);
  },
  error: (title: string, description?: string) => {
    const id = crypto.randomUUID();
    toastQueue.push({ id, type: 'error', title, description });
    notifyListeners();
    setTimeout(() => {
      toastQueue = toastQueue.filter(t => t.id !== id);
      notifyListeners();
    }, 6000);
  },
  warning: (title: string, description?: string) => {
    const id = crypto.randomUUID();
    toastQueue.push({ id, type: 'warning', title, description });
    notifyListeners();
    setTimeout(() => {
      toastQueue = toastQueue.filter(t => t.id !== id);
      notifyListeners();
    }, 4000);
  },
  info: (title: string, description?: string) => {
    const id = crypto.randomUUID();
    toastQueue.push({ id, type: 'info', title, description });
    notifyListeners();
    setTimeout(() => {
      toastQueue = toastQueue.filter(t => t.id !== id);
      notifyListeners();
    }, 4000);
  },
  dismiss: (id: string) => {
    toastQueue = toastQueue.filter(t => t.id !== id);
    notifyListeners();
  }
};

const iconMap = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const styleMap = {
  success: 'bg-green-500 text-white',
  error: 'bg-red-500 text-white',
  warning: 'bg-yellow-500 text-black',
  info: 'bg-blue-500 text-white',
};

export function CentralToastProvider() {
  const [toasts, setToasts] = useState<CentralToastMessage[]>([]);

  useEffect(() => {
    const listener = (newToasts: CentralToastMessage[]) => {
      setToasts(newToasts);
    };
    listeners.push(listener);
    return () => {
      listeners = listeners.filter(l => l !== listener);
    };
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-[100] flex items-center justify-center">
      <AnimatePresence mode="sync">
        {toasts.map((toast) => {
          const Icon = iconMap[toast.type];
          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, scale: 0.8, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: -20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className={cn(
                'pointer-events-auto absolute min-w-[320px] max-w-[500px] px-6 py-5 rounded-xl shadow-2xl',
                styleMap[toast.type]
              )}
            >
              <div className="flex items-start gap-4">
                <Icon className="h-8 w-8 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xl font-bold leading-tight">{toast.title}</p>
                  {toast.description && (
                    <p className="mt-1 text-base opacity-90">{toast.description}</p>
                  )}
                </div>
                <button
                  onClick={() => centralToast.dismiss(toast.id)}
                  className="shrink-0 p-1 rounded-full hover:bg-white/20 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
