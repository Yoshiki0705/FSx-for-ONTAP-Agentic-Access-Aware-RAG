/** GET /api/tools/config — which tools are on, and where image generation runs. */
import { NextResponse } from 'next/server';
import { sessionUserId } from '@/lib/agent-backend';
import { toolsConfig } from '@/lib/genu-tools';

export async function GET() {
  if (!(await sessionUserId())) return NextResponse.json({ success: false, error: 'Not signed in' }, { status: 401 });
  return NextResponse.json({ success: true, ...toolsConfig() });
}
