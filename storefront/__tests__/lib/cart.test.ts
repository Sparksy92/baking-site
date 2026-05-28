import { describe, it, expect, beforeEach } from 'vitest';

// Cart store uses localStorage — jsdom provides it
import { cart } from '@/lib/cart';

const sampleItem = {
  variantId: 1,
  productId: 100,
  productName: 'Basic Tee',
  variantSize: 'M',
  variantColor: 'Black',
  unitPriceCents: 2500,
  imageUrl: null,
};

const sampleItem2 = {
  variantId: 2,
  productId: 100,
  productName: 'Basic Tee',
  variantSize: 'L',
  variantColor: 'Black',
  unitPriceCents: 2500,
  imageUrl: null,
};

describe('CartStore', () => {
  beforeEach(() => {
    cart.clear();
    localStorage.clear();
  });

  it('starts empty', () => {
    expect(cart.getSnapshot()).toEqual([]);
    expect(cart.count).toBe(0);
    expect(cart.subtotal).toBe(0);
  });

  it('adds an item with quantity 1', () => {
    cart.addItem(sampleItem);
    const items = cart.getSnapshot();
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(1);
    expect(items[0].variantId).toBe(1);
  });

  it('increments quantity when same variant added', () => {
    cart.addItem(sampleItem);
    cart.addItem(sampleItem);
    const items = cart.getSnapshot();
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(2);
  });

  it('adds different variants as separate items', () => {
    cart.addItem(sampleItem);
    cart.addItem(sampleItem2);
    expect(cart.getSnapshot()).toHaveLength(2);
  });

  it('calculates count correctly', () => {
    cart.addItem(sampleItem);
    cart.addItem(sampleItem); // qty 2
    cart.addItem(sampleItem2); // qty 1
    expect(cart.count).toBe(3);
  });

  it('calculates subtotal correctly', () => {
    cart.addItem(sampleItem);
    cart.addItem(sampleItem); // 2 x 2500 = 5000
    cart.addItem(sampleItem2); // 1 x 2500 = 2500
    expect(cart.subtotal).toBe(7500);
  });

  it('updates quantity', () => {
    cart.addItem(sampleItem);
    cart.updateQuantity(1, 5);
    expect(cart.getSnapshot()[0].quantity).toBe(5);
  });

  it('removes item when quantity set to 0', () => {
    cart.addItem(sampleItem);
    cart.updateQuantity(1, 0);
    expect(cart.getSnapshot()).toHaveLength(0);
  });

  it('removes item explicitly', () => {
    cart.addItem(sampleItem);
    cart.addItem(sampleItem2);
    cart.removeItem(1);
    const items = cart.getSnapshot();
    expect(items).toHaveLength(1);
    expect(items[0].variantId).toBe(2);
  });

  it('clears all items', () => {
    cart.addItem(sampleItem);
    cart.addItem(sampleItem2);
    cart.clear();
    expect(cart.getSnapshot()).toHaveLength(0);
    expect(cart.count).toBe(0);
    expect(cart.subtotal).toBe(0);
  });

  it('persists to localStorage', () => {
    cart.addItem(sampleItem);
    const stored = JSON.parse(localStorage.getItem('cart') || '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0].variantId).toBe(1);
  });

  it('subscribe notifies listeners on changes', () => {
    let callCount = 0;
    const unsub = cart.subscribe(() => { callCount++; });
    cart.addItem(sampleItem);
    expect(callCount).toBe(1);
    cart.addItem(sampleItem);
    expect(callCount).toBe(2);
    unsub();
    cart.addItem(sampleItem);
    expect(callCount).toBe(2); // unsubscribed
  });

  it('getServerSnapshot returns empty array', () => {
    cart.addItem(sampleItem);
    expect(cart.getServerSnapshot()).toEqual([]);
  });
});
