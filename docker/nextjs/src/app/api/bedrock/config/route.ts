/**
 * Bedrock Config API
 * 作成日: 2025-12-09
 * 
 * サーバーサイドのBedrock設定をクライアントに提供するAPIエンドポイント
 * NEXT_PUBLIC_*環境変数の代替として使用
 */

import { NextResponse } from 'next/server';

/**
 * Bedrock設定レスポンス
 */
interface BedrockConfigResponse {
  success: boolean;
  config?: {
    agentId: string;
    agentAliasId: string;
    region: string;
  };
  error?: string;
}

/**
 * GET /api/bedrock/config
 * 
 * Bedrock Agent設定を取得
 * 
 * @returns Bedrock設定情報
 */
export async function GET(): Promise<NextResponse<BedrockConfigResponse>> {
  try {
    // サーバーサイド環境変数から設定を取得
    const agentId = process.env.BEDROCK_AGENT_ID || '';
    const agentAliasId = process.env.BEDROCK_AGENT_ALIAS_ID || '';
    const region = process.env.BEDROCK_REGION || 'ap-northeast-1';

    // Agent IDが設定されていない場合でも、regionは返す
    // （Agent作成ウィザードで使用するため）
    if (!agentId) {
      console.warn('⚠️ [Bedrock Config API] BEDROCK_AGENT_ID環境変数が設定されていません（Agent作成時は正常）');
      return NextResponse.json({
        success: true,
        config: {
          agentId: '',
          agentAliasId: '',
          region
        }
      });
    }

    console.log('✅ [Bedrock Config API] 設定を返却:', { agentId, region });

    return NextResponse.json({
      success: true,
      config: {
        agentId,
        agentAliasId,
        region
      }
    });
  } catch (error) {
    console.error('❌ [Bedrock Config API] エラー:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
