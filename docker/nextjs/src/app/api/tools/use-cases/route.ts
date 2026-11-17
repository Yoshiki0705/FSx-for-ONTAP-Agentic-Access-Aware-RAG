/**
 * The signed-in user's saved use cases.
 * - GET lists the user's own (`useCases`) and, with sharing enabled, the shared ones
 *   (`shared`; the owner is not returned, only `ownedByMe`).
 * - POST creates or updates (with `useCaseId`; only the owner's key is used).
 *   `action: "import"` with `file` (an export) creates private copies, all or none.
 *   `action: "unshare"` with `useCaseId` stops sharing: the owner's own, or anyone's for an
 *   administrator.
 * - DELETE removes the user's own (`?useCaseId=`).
 * The key is always the session user, never a request field.
 */
import { NextRequest, NextResponse } from 'next/server';
import { sessionUserId } from '@/lib/agent-backend';
import { ADMIN_ROLE, sessionClaims } from '@/lib/auth/roles';
import {
  deleteUseCase,
  importUseCases,
  listSharedUseCases,
  listUseCases,
  parseUseCaseFile,
  saveUseCase,
  ToolInputError,
  unshareUseCase,
  UseCaseFileError,
  useCaseSharingEnabled,
} from '@/lib/genu-tools';

async function withUser(fn: (userId: string) => Promise<NextResponse>): Promise<NextResponse> {
  const userId = await sessionUserId();
  if (!userId) return NextResponse.json({ success: false, error: 'Not signed in' }, { status: 401 });
  try {
    return await fn(userId);
  } catch (error) {
    if (error instanceof ToolInputError || error instanceof UseCaseFileError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    console.error(JSON.stringify({ event: 'use_case_error', error: error instanceof Error ? error.message : String(error) }));
    return NextResponse.json({ success: false, error: 'the request failed; see the server log' }, { status: 500 });
  }
}

export async function GET() {
  return withUser(async (userId) =>
    NextResponse.json({
      success: true,
      sharingEnabled: useCaseSharingEnabled(),
      useCases: await listUseCases(userId),
      shared: await listSharedUseCases(userId),
    }),
  );
}

export async function POST(request: NextRequest) {
  return withUser(async (userId) => {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) throw new ToolInputError('invalid JSON');
    if (body.action === 'import') {
      const imported = await importUseCases(userId, parseUseCaseFile(body.file));
      return NextResponse.json({ success: true, imported: imported.length, useCases: imported });
    }
    if (body.action === 'unshare') {
      const id = typeof body.useCaseId === 'string' ? body.useCaseId : '';
      if (!id) throw new ToolInputError('useCaseId is required');
      const isAdmin = (await sessionClaims())?.role === ADMIN_ROLE;
      if (!(await unshareUseCase(userId, id, isAdmin))) {
        return NextResponse.json({ success: false, error: 'no shared use case of yours with that ID' }, { status: 404 });
      }
      return NextResponse.json({ success: true });
    }
    if (body.shared === true && !useCaseSharingEnabled()) throw new ToolInputError('sharing use cases is not enabled');
    return NextResponse.json({ success: true, useCase: await saveUseCase(userId, body) });
  });
}

export async function DELETE(request: NextRequest) {
  return withUser(async (userId) => {
    const id = request.nextUrl.searchParams.get('useCaseId') || '';
    if (!id) throw new ToolInputError('useCaseId is required');
    await deleteUseCase(userId, id);
    return NextResponse.json({ success: true });
  });
}
