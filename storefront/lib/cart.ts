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

class CartStore {
  private items: CartItem[] = [];
  private listeners: Set<Listener> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('cart');
      if (saved) {
        try { this.items = JSON.parse(saved); } catch { /* ignore */ }
      }
    }
  }

  private notify() {
    this.persist();
    this.listeners.forEach((l) => l());
  }

  private persist() {
    if (typeof window !== 'undefined') {
      localStorage.setItem('cart', JSON.stringify(this.items));
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
