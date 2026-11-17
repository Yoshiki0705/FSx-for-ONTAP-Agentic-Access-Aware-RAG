// @vitest-environment node
/**
 * Session security: the signing keys are never a fixed string in a deployment, every API
 * route except the sign-in ones needs a valid session, and routes take the user from the
 * session rather than from the request.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SignJWT } from 'jose';
import { NextRequest, NextResponse } from 'next/server';

// next-intl's middleware does not load under Vitest; the API branch returns before it anyway.
vi.mock('next-intl/middleware', () => ({ default: () => () => NextResponse.next() }));

const env = process.env as Record<string, string | undefined>;
const KEY = 'k'.repeat(48);

async function token(userId: string, key = KEY) {
  return new SignJWT({ sessionId: 's1', userId, username: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(key));
}

beforeEach(() => {
  vi.resetModules();
  env.JWT_SECRET = KEY;
  env.CSRF_SECRET = KEY;
});
afterEach(() => {
  delete env.JWT_SECRET;
  delete env.CSRF_SECRET;
  vi.unstubAllEnvs();
});

describe('signing keys', () => {
  it('refuses to sign or verify in production when the key is missing or short', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { jwtSecretKey, csrfSecret, MissingSecretError } = await import('@/lib/auth/secrets');
    delete env.JWT_SECRET;
    expect(() => jwtSecretKey()).toThrow(MissingSecretError);
    env.JWT_SECRET = 'short';
    expect(() => jwtSecretKey()).toThrow(MissingSecretError);
    delete env.CSRF_SECRET;
    expect(() => csrfSecret()).toThrow(MissingSecretError);
    env.JWT_SECRET = KEY;
    expect(new TextDecoder().decode(jwtSecretKey())).toBe(KEY);
  });
  it('uses a local value outside production so `npm run dev` starts', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    delete env.JWT_SECRET;
    const { jwtSecretKey } = await import('@/lib/auth/secrets');
    expect(jwtSecretKey().length).toBeGreaterThan(0);
  });
  it('no source file keeps a fixed fallback key', () => {
    const root = join(__dirname, '..', '..');
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (name === '__tests__' || name === 'node_modules') continue;
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(ts|tsx|js)$/.test(name) && /change-in-production|your-super-secret-jwt-key|your-csrf-secret/.test(readFileSync(p, 'utf8'))) hits.push(p);
      }
    };
    walk(root);
    expect(hits).toEqual([]);
  });
});

describe('middleware on /api', () => {
  const call = async (path: string, cookie?: string) => {
    const { middleware } = await import('@/middleware');
    const req = new NextRequest(`http://localhost${path}`, { headers: cookie ? { cookie: `session-token=${cookie}` } : {} });
    return middleware(req);
  };
  it('answers 401 JSON for an API route without a session', async () => {
    const res = await call('/api/bedrock/kb/retrieve');
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ success: false, error: 'Not signed in' });
  });
  it('answers 401 for a token signed with another key', async () => {
    const forged = await token('someone@example.com', 'x'.repeat(48));
    expect((await call('/api/bedrock/kb/retrieve', forged)).status).toBe(401);
  });
  it('lets a valid session through', async () => {
    const res = await call('/api/bedrock/kb/retrieve', await token('a@example.com'));
    expect(res.status).toBe(200);
    expect(res.headers.get('x-middleware-next')).toBe('1');
  });
  it.each(['/api/auth/signin', '/api/auth/signout', '/api/auth/csrf-token', '/api/auth/ad-config', '/api/auth/callback', '/api/health', '/api/locale'])(
    'leaves %s open for signing in',
    async (path) => {
      expect((await call(path)).headers.get('x-middleware-next')).toBe('1');
    },
  );
  it('does not treat a path under a public one as public', async () => {
    expect((await call('/api/auth/signin/extra')).status).toBe(401);
    expect((await call('/api/healthz')).status).toBe(401);
  });
});
