import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, signPayload, verifySignature, validateProductionConfig, DEFAULT_PASSWORD_HASH, DEFAULT_SESSION_SECRET } from '../../lib/auth';
import { formatCents } from '../../lib/format';
import { SCHEMA_SQL, SEED_SQL } from '../../lib/db-schema';

describe('Vercel-Lite Admin Auth Helper', () => {
  it('should hash and verify passwords using pbkdf2Sync', () => {
    const password = 'my-secret-password-123';
    const hash = hashPassword(password);
    
    // Hash should be a hex string of length 128 (64 bytes for sha512)
    expect(hash).toHaveLength(128);
    expect(verifyPassword(password, hash)).toBe(true);
    expect(verifyPassword('wrong-password', hash)).toBe(false);
  });

  it('should sign and verify session payloads securely', () => {
    const userPayload = { email: 'admin@test.com', username: 'Admin', role: 'admin' };
    const sessionToken = signPayload({ user: userPayload, exp: Date.now() + 10000 });
    
    expect(sessionToken).toContain('.');
    
    const decrypted = verifySignature(sessionToken);
    expect(decrypted).not.toBeNull();
    expect(decrypted.user).toEqual(userPayload);
  });

  it('should fail signature verification if session token is tampered', () => {
    const userPayload = { email: 'admin@test.com', username: 'Admin', role: 'admin' };
    const sessionToken = signPayload({ user: userPayload, exp: Date.now() + 10000 });
    
    const tampered = sessionToken + 'tampered';
    expect(verifySignature(tampered)).toBeNull();
  });

  it('should validate production auth config correctly', () => {
    // Save original env variables
    const originalEnv = { ...process.env };
    
    try {
      // Set to production mode
      process.env.NODE_ENV = 'production';
      process.env.DEV_MODE = 'false';
      
      // 1. Missing ADMIN_EMAIL
      process.env.ADMIN_EMAIL = '';
      process.env.ADMIN_PASSWORD_HASH = 'somehash';
      process.env.ADMIN_SESSION_SECRET = 'somesecret';
      const check1 = validateProductionConfig();
      expect(check1.isValid).toBe(false);
      expect(check1.error).toContain('ADMIN_EMAIL');

      // 2. Missing ADMIN_PASSWORD_HASH
      process.env.ADMIN_EMAIL = 'admin@test.com';
      process.env.ADMIN_PASSWORD_HASH = '';
      const check2 = validateProductionConfig();
      expect(check2.isValid).toBe(false);
      expect(check2.error).toContain('ADMIN_PASSWORD_HASH');

      // 3. Default password hash
      process.env.ADMIN_PASSWORD_HASH = DEFAULT_PASSWORD_HASH;
      const check3 = validateProductionConfig();
      expect(check3.isValid).toBe(false);
      expect(check3.error).toContain('default development hash');

      // 4. Default session secret
      process.env.ADMIN_PASSWORD_HASH = 'validhash';
      process.env.ADMIN_SESSION_SECRET = DEFAULT_SESSION_SECRET;
      const check4 = validateProductionConfig();
      expect(check4.isValid).toBe(false);
      expect(check4.error).toContain('default development secret');

      // 5. Valid config
      process.env.ADMIN_SESSION_SECRET = 'my-super-secure-session-secret-key-32-chars';
      const check5 = validateProductionConfig();
      expect(check5.isValid).toBe(true);
    } finally {
      // Restore env
      Object.keys(originalEnv).forEach((k) => {
        process.env[k] = originalEnv[k];
      });
    }
  });
});

describe('Vercel-Lite DB Schema Constants', () => {
  it('should export non-empty SQL strings for schema and seed', () => {
    expect(SCHEMA_SQL).toContain('CREATE TABLE IF NOT EXISTS');
    expect(SEED_SQL).toContain('INSERT INTO categories');
    expect(SEED_SQL).toContain('INSERT INTO menu_items');
  });
});

describe('Pricing Label Formatting', () => {
  it('should format cents to currency string or custom messages', () => {
    expect(formatCents(800)).toBe('$8.00');
    expect(formatCents(1250)).toBe('$12.50');
    // If cents is 0 or negative, it should return Price to be confirmed for Cedar & Sage
    expect(formatCents(0)).toBe('Price to be confirmed');
  });
});

describe('Order Request Validation Simulation', () => {
  function validateOrderRequest(body: any) {
    const errors: string[] = [];
    if (!body.customer_name || body.customer_name.trim().length === 0) {
      errors.push('Name is required');
    }
    if (!body.customer_email || !body.customer_email.includes('@')) {
      errors.push('Valid email is required');
    }
    if (!body.requested_items || !Array.isArray(body.requested_items) || body.requested_items.length === 0) {
      errors.push('At least one item is required');
    }
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  it('should accept valid order requests', () => {
    const validRequest = {
      customer_name: 'John Doe',
      customer_email: 'john@example.com',
      requested_items: [{ product_name: 'Artisan Bread', quantity: 2 }]
    };
    const res = validateOrderRequest(validRequest);
    expect(res.isValid).toBe(true);
    expect(res.errors).toHaveLength(0);
  });

  it('should reject invalid order requests', () => {
    const invalidRequest = {
      customer_name: '',
      customer_email: 'john-at-example.com',
      requested_items: []
    };
    const res = validateOrderRequest(invalidRequest);
    expect(res.isValid).toBe(false);
    expect(res.errors).toContain('Name is required');
    expect(res.errors).toContain('Valid email is required');
    expect(res.errors).toContain('At least one item is required');
  });
});
