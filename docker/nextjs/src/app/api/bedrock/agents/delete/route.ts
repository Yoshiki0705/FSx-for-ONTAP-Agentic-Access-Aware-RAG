import { NextRequest, NextResponse } from 'next/server';
import {
  BedrockAgentClient,
  DeleteAgentCommand,
  ListAgentAliasesCommand,
  DeleteAgentAliasCommand,
} from '@aws-sdk/client-bedrock-agent';

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/bedrock/agents/delete
 * Bedrock Agentを削除（Aliasも自動削除）
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');
    const region = searchParams.get('region') || process.env.BEDROCK_REGION || 'ap-northeast-1';

    if (!agentId) {
      return NextResponse.json(
        { success: false, error: 'agentIdパラメータが必要です' },
        { status: 400 }
      );
    }

    console.log(`[Agent Delete API] エージェント削除開始: ${agentId}, リージョン: ${region}`);

    const client = new BedrockAgentClient({ region });

    // Step 1: Aliasを先に削除（ConflictException防止）
    try {
      const aliasesResp = await client.send(
        new ListAgentAliasesCommand({ agentId })
      );
      const aliases = aliasesResp.agentAliasSummaries || [];
      for (const alias of aliases) {
        if (alias.agentAliasId && alias.agentAliasId !== 'TSTALIASID') {
          console.log(`[Agent Delete API] Alias削除: ${alias.agentAliasId}`);
          await client.send(
            new DeleteAgentAliasCommand({
              agentId,
              agentAliasId: alias.agentAliasId,
            })
          );
        }
      }
      if (aliases.length > 0) {
        // Alias削除後に少し待機
        await new Promise((r) => setTimeout(r, 3000));
      }
    } catch (aliasErr) {
      console.warn('[Agent Delete API] Alias削除でエラー（継続）:', aliasErr);
    }

    // Step 2: Agent削除（skipResourceInUseCheck=trueで強制削除）
    await client.send(
      new DeleteAgentCommand({ agentId, skipResourceInUseCheck: true })
    );

    console.log(`[Agent Delete API] エージェント削除成功: ${agentId}`);

    return NextResponse.json({
      success: true,
      message: 'エージェントを削除しました',
      agentId,
    });
  } catch (error: any) {
    console.error('[Agent Delete API] エラー:', error);

    let errorMessage = 'エージェントの削除に失敗しました';
    let statusCode = 500;

    if (error.name === 'ResourceNotFoundException') {
      errorMessage = '指定されたエージェントが見つかりません';
      statusCode = 404;
    } else if (error.name === 'ConflictException') {
      errorMessage = 'エージェントは使用中のため削除できません。しばらく待ってから再試行してください。';
      statusCode = 409;
    } else if (error.name === 'AccessDeniedException') {
      errorMessage = 'エージェントを削除する権限がありません';
      statusCode = 403;
    } else if (error.message) {
      errorMessage = error.message;
    }

    return NextResponse.json(
      { success: false, error: errorMessage, details: error.message },
      { status: statusCode }
    );
  }
}
