/**
 * The keys that sign session tokens (JWT) and CSRF tokens. In a deployment they come from
 * the stack (generated Secrets Manager secrets, passed as JWT_SECRET and CSRF_SECRET). A
 * deployment without them refuses to sign or verify tokens.
 *
 * Outside production (`npm run dev`, tests) a local value is used so the app still starts.
 * Call these inside a request handler, not at module load: Next.js imports route modules
 * during `next build`, where NODE_ENV is production and no secret is set.
 */
const MIN_LENGTH = 32;

export class MissingSecretError extends Error {}

function read(name: 'JWT_SECRET' | 'CSRF_SECRET', localValue: string): string {
  const value = process.env[name];
  if (value && value.length >= MIN_LENGTH) return value;
  if (process.env.NODE_ENV === 'production') {
    throw new MissingSecretError(`${name} is not set (or shorter than ${MIN_LENGTH} characters); refusing to sign or verify tokens`);
  }
  return value || localValue;
}

export function jwtSecretKey(): Uint8Array {
  return new TextEncoder().encode(read('JWT_SECRET', 'local-development-jwt-secret-not-for-deployment'));
}

export function csrfSecret(): string {
  return read('CSRF_SECRET', 'local-development-csrf-secret-not-for-deployment');
}
