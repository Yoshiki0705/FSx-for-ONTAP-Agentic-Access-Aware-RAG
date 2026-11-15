/**
 * The signed-in user's saved use cases. GET lists, POST creates or updates (with
 * `useCaseId`), DELETE removes (`?useCaseId=`). A user only reaches their own items: the
 * key is the session user, never a request field.
 */
import { NextRequest, NextResponse } from 'next/server';
import { sessionUserId } from '@/lib/agent-backend';
import { deleteUseCase, listUseCases, saveUseCase, ToolInputError } from '@/lib/genu-tools';

async function withUser(fn: (userId: string) => Promise<NextResponse>): Promise<NextResponse> {
  const userId = await sessionUserId();
  if (!userId) return NextResponse.json({ success: false, error: 'Not signed in' }, { status: 401 });
  try {
    return await fn(userId);
  } catch (error) {
    if (error instanceof ToolInputError) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    console.error(JSON.stringify({ event: 'use_case_error', error: error instanceof Error ? error.message : String(error) }));
    return NextResponse.json({ success: false, error: 'the request failed; see the server log' }, { status: 500 });
  }
}

export async function GET() {
  return withUser(async (userId) => NextResponse.json({ success: true, useCases: await listUseCases(userId) }));
}

export async function POST(request: NextRequest) {
  return withUser(async (userId) => {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) throw new ToolInputError('invalid JSON');
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
