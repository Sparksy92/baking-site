'use client';

import { useSyncExternalStore } from 'react';

export interface CartItem {
  variantId: number;
  productId: number;
  productName: string;
  variantSize: string;
  variantColor: string;
  unitPriceCents: number;
  quantity: number;
  imageUrl: string | null;
}

type Listener = () => void;

const CART_KEY = 'cart';
const CART_TS_KEY = 'cart_ts';
const CART_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

class CartStore {
  private items: CartItem[] = [];
  private listeners: Set<Listener> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      const ts = localStorage.getItem(CART_TS_KEY);
      const expired = ts && Date.now() - Number(ts) > CART_TTL_MS;
      if (expired) {
        localStorage.removeItem(CART_KEY);
        localStorage.removeItem(CART_TS_KEY);
      } else {
        const saved = localStorage.getItem(CART_KEY);
        if (saved) {
          try { this.items = JSON.parse(saved); } catch { /* ignore */ }
        }
      }
    }
  }

  private notify() {
    this.persist();
    this.listeners.forEach((l) => l());
  }

  private persist() {
    if (typeof window !== 'undefined') {
      localStorage.setItem(CART_KEY, JSON.stringify(this.items));
      localStorage.setItem(CART_TS_KEY, String(Date.now()));
    }
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getSnapshot(): CartItem[] {
    return this.items;
  }

  getServerSnapshot(): CartItem[] {
    return [];
  }

  addItem(item: Omit<CartItem, 'quantity'>) {
    const existing = this.items.find(
      (i) => i.variantId === item.variantId
    );
    if (existing) {
      existing.quantity += 1;
    } else {
      this.items.push({ ...item, quantity: 1 });
    }
    this.items = [...this.items];
    this.notify();
  }

  updateQuantity(variantId: number, quantity: number) {
    if (quantity <= 0) {
      this.items = this.items.filter((i) => i.variantId !== variantId);
    } else {
      const item = this.items.find((i) => i.variantId === variantId);
      if (item) item.quantity = quantity;
      this.items = [...this.items];
    }
    this.notify();
  }

  removeItem(variantId: number) {
    this.items = this.items.filter((i) => i.variantId !== variantId);
    this.notify();
  }

  clear() {
    this.items = [];
    this.notify();
  }

  get count() {
    return this.items.reduce((sum, i) => sum + i.quantity, 0);
  }

  get subtotal() {
    return this.items.reduce((sum, i) => sum + i.unitPriceCents * i.quantity, 0);
  }
}

export const cart = new CartStore();

export function useCart() {
  const items = useSyncExternalStore(
    (cb) => cart.subscribe(cb),
    () => cart.getSnapshot(),
    () => cart.getServerSnapshot(),
  );

  return {
    items,
    count: cart.count,
    subtotal: cart.subtotal,
    addItem: cart.addItem.bind(cart),
    updateQuantity: cart.updateQuantity.bind(cart),
    removeItem: cart.removeItem.bind(cart),
    clear: cart.clear.bind(cart),
  };
}
