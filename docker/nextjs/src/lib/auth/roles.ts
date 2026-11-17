/**
 * Who may change what everyone shares (agents, teams, schedules, policies, the shared
 * registry) and read what concerns other users (audit logs). Signed-in users may use those
 * things; changing them needs the administrator role.
 *
 * The role is decided at sign-in from groups only an administrator can set:
 * - Cognito user pool groups (`cognito:groups` in the ID token), and
 * - for a user who signed in through a federated identity provider (SAML / OIDC), the groups
 *   that provider sent (`custom:ad_groups` for SAML, `custom:oidc_groups` for OIDC), which
 *   Cognito rewrites at every such sign-in.
 * A group counts when its name equals one of ADMIN_GROUP_NAMES (comma-separated; default
 * `admins`), compared without case. The role is carried in the signed session token.
 */
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { NextResponse } from 'next/server';
import { jwtSecretKey } from './secrets';

export const ADMIN_ROLE = 'administrator';

export function adminGroupNames(): string[] {
  return (process.env.ADMIN_GROUP_NAMES || 'admins')
    .split(',')
    .map((g) => g.trim().toLowerCase())
    .filter(Boolean);
}

/** The role for an ID token's claims: administrator only through an admin group. */
export function roleFromIdTokenClaims(claims: Record<string, unknown>): string {
  const admin = new Set(adminGroupNames());
  const groups: string[] = [];
  const cognitoGroups = claims['cognito:groups'];
  if (Array.isArray(cognitoGroups)) groups.push(...cognitoGroups.map(String));
  // Groups sent by a federated provider. A user who signs in with a Cognito password is not
  // federated (no `identities` claim) and could edit their own custom attributes, so this
  // attribute is read only for federated users.
  const federated = Array.isArray(claims.identities) && claims.identities.length > 0;
  if (federated) {
    for (const attr of ['custom:ad_groups', 'custom:oidc_groups']) {
      const value = claims[attr];
      if (typeof value === 'string') groups.push(...value.split(','));
    }
  }
  return groups.some((g) => admin.has(g.trim().toLowerCase())) ? ADMIN_ROLE : 'user';
}

/** The signed-in user and role, from the verified session token. */
export async function sessionClaims(): Promise<{ userId: string; role: string } | null> {
  try {
    const token = (await cookies()).get('session-token')?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, jwtSecretKey());
    const userId = (payload.userId as string) || (payload.username as string);
    if (!userId) return null;
    return { userId, role: (payload.role as string) || 'user' };
  } catch {
    return null;
  }
}

/** 401 without a session, 403 for a signed-in user who is not an administrator. */
export async function requireAdmin(): Promise<{ userId: string } | NextResponse> {
  const claims = await sessionClaims();
  if (!claims) return NextResponse.json({ success: false, error: 'Not signed in' }, { status: 401 });
  if (claims.role !== ADMIN_ROLE) {
    return NextResponse.json({ success: false, error: 'This operation needs the administrator role' }, { status: 403 });
  }
  return { userId: claims.userId };
}
