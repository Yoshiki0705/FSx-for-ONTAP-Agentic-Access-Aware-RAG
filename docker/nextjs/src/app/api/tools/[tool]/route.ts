/**
 * POST /api/tools/<tool> — translate, proofread, diagram, web-extract, image, use-case.
 * The user is the signed-in session; a request without one gets 401.
 */
import { NextRequest, NextResponse } from 'next/server';
import { sessionUserId } from '@/lib/agent-backend';
import { ImageFilteredError, runTool, TOOL_NAMES, ToolInputError } from '@/lib/genu-tools';

export async function POST(request: NextRequest, context: { params: Promise<{ tool: string }> }) {
  const { tool } = await context.params;
  if (!(TOOL_NAMES as readonly string[]).includes(tool)) {
    return NextResponse.json({ success: false, error: `unknown tool: ${tool}` }, { status: 404 });
  }
  const userId = await sessionUserId();
  if (!userId) return NextResponse.json({ success: false, error: 'Not signed in' }, { status: 401 });
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, error: 'invalid JSON' }, { status: 400 });
  }
  try {
    const result = await runTool(tool, userId, body);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof ToolInputError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    if (error instanceof ImageFilteredError) {
      return NextResponse.json({ success: false, error: 'the image was blocked by the content filter', reason: error.message }, { status: 422 });
    }
    console.error(JSON.stringify({ event: 'tool_error', tool, error: error instanceof Error ? error.message : String(error) }));
    return NextResponse.json({ success: false, error: 'the tool failed; see the server log' }, { status: 500 });
  }
}
