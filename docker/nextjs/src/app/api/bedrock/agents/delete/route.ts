import { NextRequest, NextResponse } from 'next/server';
import { BedrockAgentClient, DeleteAgentCommand } from '@aws-sdk/client-bedrock-agent';

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/bedrock/agents/delete
 * Bedrock Agentを削除
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

    // エージェントを削除
    const command = new DeleteAgentCommand({
      agentId,
      skipResourceInUseCheck: false, // リソース使用中チェックを実施
    });

    await client.send(command);

    console.log(`[Agent Delete API] エージェント削除成功: ${agentId}`);

    return NextResponse.json({
      success: true,
      message: 'エージェントを削除しました',
      agentId,
    });

  } catch (error: any) {
    console.error('[Agent Delete API] エラー:', error);

    // エラーメッセージの詳細化
    let errorMessage = 'エージェントの削除に失敗しました';
    let statusCode = 500;

    if (error.name === 'ResourceNotFoundException') {
      errorMessage = '指定されたエージェントが見つかりません';
      statusCode = 404;
    } else if (error.name === 'ConflictException') {
      errorMessage = 'エージェントは使用中のため削除できません';
      statusCode = 409;
    } else if (error.name === 'AccessDeniedException') {
      errorMessage = 'エージェントを削除する権限がありません';
      statusCode = 403;
    } else if (error.message) {
      errorMessage = error.message;
    }

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        details: error.message,
      },
      { status: statusCode }
    );
  }
}
