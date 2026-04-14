/**
 * AgentCore Lambda直接呼び出しAPI Route
 * API Gateway無効版対応
 *
 * EPISODIC_MEMORY_ENABLED=true 時は類似エピソード検索を実行し、
 * 推論コンテキストに注入する。会話完了後に Background Reflection をトリガーする。
 */

import { NextRequest, NextResponse } from 'next/server';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { findSimilarEpisodes, triggerReflection } from '@/lib/agentcore/episodic-memory';
import { authenticateRequest } from '@/lib/agentcore/auth';

const EPISODIC_MEMORY_ENABLED = process.env.EPISODIC_MEMORY_ENABLED === 'true';

// Lambda Client初期化（デフォルト認証情報プロバイダーを使用）
const lambdaClient = new LambdaClient({
  region: process.env.AWS_REGION || 'ap-northeast-1',
  // 認証情報は環境変数またはIAMロールから自動取得
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { functionName, payload, sessionId } = body;

    if (!functionName) {
      return NextResponse.json(
        { error: 'Function name is required' },
        { status: 400 }
      );
    }

    // 類似エピソード検索（EPISODIC_MEMORY_ENABLED=true 時のみ）
    let episodeReferenced = false;
    let episodeCount = 0;
    let enrichedPayload = payload;

    if (EPISODIC_MEMORY_ENABLED && payload?.inputText) {
      try {
        const auth = await authenticateRequest();
        if (auth) {
          const similarEpisodes = await findSimilarEpisodes(payload.inputText, auth.userId, 3);
          if (similarEpisodes.length > 0) {
            episodeReferenced = true;
            episodeCount = similarEpisodes.length;
            // 上位3件のエピソード（goal, outcome, reflection）を推論コンテキストに注入
            const episodeContext = similarEpisodes.map((ep, i) =>
              `[Past Experience ${i + 1}] Goal: ${ep.goal} | Outcome: ${ep.outcome.summary} | Reflection: ${ep.reflection}`
            ).join('\n');
            enrichedPayload = {
              ...payload,
              inputText: `${payload.inputText}\n\n--- Past Experiences ---\n${episodeContext}`,
            };
            console.log('[AgentCore Invoke] 類似エピソード注入:', { count: episodeCount });
          }
        }
      } catch (error) {
        // エピソード検索エラーはコア機能に影響しない
        console.error('[AgentCore Invoke] 類似エピソード検索エラー（無視）:', error);
      }
    }

    // Lambda関数を直接呼び出し
    const command = new InvokeCommand({
      FunctionName: functionName,
      Payload: JSON.stringify(enrichedPayload),
    });

    const response = await lambdaClient.send(command);
    
    if (!response.Payload) {
      throw new Error('No response payload from Lambda');
    }

    // レスポンスをデコード
    const responsePayload = JSON.parse(
      new TextDecoder().decode(response.Payload)
    );

    // 会話完了後に Background Reflection をトリガー
    if (EPISODIC_MEMORY_ENABLED && sessionId) {
      try {
        const auth = await authenticateRequest();
        if (auth) {
          await triggerReflection(sessionId, auth.userId);
        }
      } catch (error) {
        console.error('[AgentCore Invoke] Background Reflection トリガーエラー（無視）:', error);
      }
    }

    // Lambda関数のHTTPレスポンス形式を解析
    if (responsePayload.statusCode) {
      const lambdaBody = JSON.parse(responsePayload.body || '{}');
      
      return NextResponse.json({
        success: true,
        statusCode: responsePayload.statusCode,
        body: responsePayload.body,
        episodeReferenced,
        episodeCount,
        ...lambdaBody
      });
    }

    // 直接レスポンスの場合
    return NextResponse.json({
      success: true,
      episodeReferenced,
      episodeCount,
      ...responsePayload
    });

  } catch (error) {
    console.error('[AgentCore Invoke API] Error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // ヘルスチェック用
  return NextResponse.json({
    status: 'healthy',
    service: 'AgentCore Lambda Invoke API',
    timestamp: new Date().toISOString(),
    version: '2.0.0'
  });
}