/**
 * AgentCore Lambda直接呼び出しAPI Route
 * API Gateway無効版対応
 */

import { NextRequest, NextResponse } from 'next/server';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

// Lambda Client初期化（デフォルト認証情報プロバイダーを使用）
const lambdaClient = new LambdaClient({
  region: process.env.AWS_REGION || 'ap-northeast-1',
  // 認証情報は環境変数またはIAMロールから自動取得
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { functionName, payload } = body;

    if (!functionName) {
      return NextResponse.json(
        { error: 'Function name is required' },
        { status: 400 }
      );
    }

    // Lambda関数を直接呼び出し
    const command = new InvokeCommand({
      FunctionName: functionName,
      Payload: JSON.stringify(payload),
    });

    const response = await lambdaClient.send(command);
    
    if (!response.Payload) {
      throw new Error('No response payload from Lambda');
    }

    // レスポンスをデコード
    const responsePayload = JSON.parse(
      new TextDecoder().decode(response.Payload)
    );

    // Lambda関数のHTTPレスポンス形式を解析
    if (responsePayload.statusCode) {
      const lambdaBody = JSON.parse(responsePayload.body || '{}');
      
      return NextResponse.json({
        success: true,
        statusCode: responsePayload.statusCode,
        body: responsePayload.body,
        ...lambdaBody
      });
    }

    // 直接レスポンスの場合
    return NextResponse.json({
      success: true,
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