/**
 * Vitest setup file — provides jsdom environment polyfills.
 *
 * Zustand persist middleware requires window.localStorage/sessionStorage.
 * The polyfill must be available at module load time (before imports),
 * so we set it at the top level, not inside beforeAll.
 */

// Storage mock (in-memory implementation)
class StorageMock implements Storage {
  private store: Record<string, string> = {};

  get length(): number {
    return Object.keys(this.store).length;
  }

  clear(): void {
    this.store = {};
  }

  getItem(key: string): string | null {
    return this.store[key] ?? null;
  }

  key(index: number): string | null {
    return Object.keys(this.store)[index] ?? null;
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }
}

// Polyfill immediately (module load time) — zustand persist reads storage at import
if (typeof globalThis.localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: new StorageMock(),
    writable: true,
  });
}
if (typeof globalThis.sessionStorage === 'undefined') {
  Object.defineProperty(globalThis, 'sessionStorage', {
    value: new StorageMock(),
    writable: true,
  });
}

import { afterEach } from 'vitest';

afterEach(() => {
  // Clear storage between tests to prevent state leakage
  globalThis.localStorage?.clear();
  globalThis.sessionStorage?.clear();
});
