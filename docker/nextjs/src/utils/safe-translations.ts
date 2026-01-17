/**
 * Safe translation helper to prevent undefined property access
 */
export function safeTranslation(t: any, key: string, fallback?: string): string {
  try {
    const result = t(key);
    return result || fallback || key;
  } catch (error) {
    console.warn(`Translation key not found: ${key}`, error);
    return fallback || key;
  }
}

/**
 * Safe nested property access
 */
export function safeGet<T>(obj: any, path: string, defaultValue?: T): T {
  try {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : defaultValue;
    }, obj) ?? defaultValue;
  } catch (error) {
    console.warn(`Safe get failed for path: ${path}`, error);
    return defaultValue as T;
  }
}

/**
 * Safe array length check
 */
export function safeLength(arr: any): number {
  try {
    return Array.isArray(arr) ? arr.length : 0;
  } catch (error) {
    console.warn('Safe length check failed:', error);
    return 0;
  }
}
