'use client';

import { useToasts, dismissToast } from '@/lib/toast';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

const iconMap = {
  success: <CheckCircle size={18} className="text-green-500 flex-shrink-0" />,
  error: <AlertCircle size={18} className="text-red-500 flex-shrink-0" />,
  info: <Info size={18} className="text-blue-500 flex-shrink-0" />,
};

const bgMap = {
  success: 'bg-green-50 border-green-200',
  error: 'bg-red-50 border-red-200',
  info: 'bg-blue-50 border-blue-200',
};

export function Toaster() {
  const toasts = useToasts();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-20 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg animate-slide-in ${bgMap[toast.type]}`}
        >
          {iconMap[toast.type]}
          <span className="text-sm font-medium text-gray-800 flex-1">{toast.message}</span>
          <button
            onClick={() => dismissToast(toast.id)}
            className="text-gray-400 hover:text-gray-600 flex-shrink-0"
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
