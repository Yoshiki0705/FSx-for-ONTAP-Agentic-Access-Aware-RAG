'use client';
/**
 * Whether the signed-in user has the administrator role, read from the session
 * (`/api/auth/session`). Used only to hide controls a non-administrator cannot use: the
 * routes behind those controls check the role themselves (lib/auth/roles.ts).
 *
 * The answer is false until the session has been read, so administrator controls appear
 * after a short delay rather than flashing for everyone.
 */
import { useEffect, useState } from 'react';

const ADMIN_ROLE = 'administrator';
let pending: Promise<boolean> | null = null;

function readIsAdmin(): Promise<boolean> {
  if (!pending) {
    pending = fetch('/api/auth/session', { credentials: 'same-origin' })
      .then(async (res) => {
        if (!res.ok) throw new Error(`session ${res.status}`);
        return (await res.json())?.session?.role === ADMIN_ROLE;
      })
      .catch(() => {
        // Read again on the next mount; an answer from the server lasts for the page.
        pending = null;
        return false;
      });
  }
  return pending;
}

/** For tests: forget the cached answer. */
export function __resetIsAdmin(): void {
  pending = null;
}

export function useIsAdmin(): boolean {
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    let active = true;
    readIsAdmin().then((value) => { if (active) setIsAdmin(value); });
    return () => { active = false; };
  }, []);
  return isAdmin;
}
