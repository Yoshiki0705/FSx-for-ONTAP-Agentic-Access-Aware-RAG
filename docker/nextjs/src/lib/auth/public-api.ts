/**
 * API routes that work without a session: signing in and out, the settings and tokens the
 * sign-in page needs, the identity provider's redirect, and health checks. Matched exactly
 * (a path under one of these is not public). Every other /api route needs a valid session
 * token, checked here and again in the routes that act for a user.
 */
export const PUBLIC_API_PATHS = new Set([
  '/api/auth/signin',
  '/api/auth/signout',
  '/api/auth/csrf-token',
  '/api/auth/ad-config',
  '/api/auth/config',
  '/api/auth/callback',
  '/api/auth/refresh',
  '/api/locale',
  '/api/health',
]);

export function isPublicApi(pathname: string): boolean {
  return PUBLIC_API_PATHS.has(pathname.replace(/\/+$/, ''));
}

