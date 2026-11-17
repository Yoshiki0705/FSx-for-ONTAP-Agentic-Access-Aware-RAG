/**
 * GET /api/auth/session — the signed-in user, read from the verified session token.
 *
 * Sessions are created only by /api/auth/signin and /api/auth/callback after the identity
 * provider has checked the user. This route only reads the session; it does not create,
 * update or delete sessions.
 */
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { jwtSecretKey } from '@/lib/auth/secrets';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')?.replace('Bearer ', '');
  const token = authHeader || request.cookies.get('session-token')?.value;
  if (!token) return NextResponse.json({ error: 'Token is required' }, { status: 401 });
  try {
    const { payload } = await jwtVerify(token, jwtSecretKey());
    const userId = payload.userId as string;
    return NextResponse.json({
      success: true,
      session: {
        sessionId: payload.sessionId as string,
        userId,
        username: (payload.username as string) || userId,
        email: payload.email as string | undefined,
        role: (payload.role as string) || 'user',
        createdAt: new Date(payload.iat! * 1000).toISOString(),
        lastAccessedAt: new Date().toISOString(),
        expiresAt: new Date(payload.exp! * 1000).toISOString(),
      },
    });
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }
}

function notAllowed() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405, headers: { Allow: 'GET' } });
}
export const POST = notAllowed;
export const PUT = notAllowed;
export const DELETE = notAllowed;
