import { useSyncExternalStore } from 'react';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

let toasts: Toast[] = [];
let listeners: Array<() => void> = [];
let nextId = 0;

function emit() {
  listeners.forEach((l) => l());
}

export function addToast(message: string, type: Toast['type'] = 'success', durationMs = 3000) {
  const id = String(++nextId);
  toasts = [...toasts, { id, message, type }];
  emit();
  setTimeout(() => dismissToast(id), durationMs);
}

export function dismissToast(id: string) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function useToasts(): Toast[] {
  return useSyncExternalStore(
    (cb) => { listeners.push(cb); return () => { listeners = listeners.filter((l) => l !== cb); }; },
    () => toasts,
    () => [],
  );
}
