'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { api, type Customer } from '@/lib/api';

interface CustomerCtx {
  customer: Customer | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<CustomerCtx>({
  customer: null,
  loading: true,
  refresh: async () => {},
  logout: async () => {},
});

export function CustomerProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api.get<Customer>('/api/customers/me');
      setCustomer(data);
    } catch {
      setCustomer(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const logout = useCallback(async () => {
    try {
      await api.post('/api/customers/logout');
    } catch { /* ignore */ }
    setCustomer(null);
  }, []);

  return (
    <Ctx.Provider value={{ customer, loading, refresh, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export function useCustomer() {
  return useContext(Ctx);
}
