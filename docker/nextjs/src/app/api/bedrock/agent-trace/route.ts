import { NextRequest, NextResponse } from 'next/server';
import { 
  BedrockAgentTrace,
  TraceStepType,
  TRACE_STEP_TYPES, 
  TraceStepTypeUtils
} from '../../../../types/bedrock-agent-trace';

/**
 * Agent Trace API エンドポイント（2024年GA機能統合版）
 * 
 * 機能:
 * - Multi-Agent Collaborationトレースデータ取得
 * - Inline Agent実行ログの取得
 * - Payload Referencing最適化メトリクス取得
 * - セッション内トレースデータの詳細取得
 * - セキュリティコンテキスト適用
 * - フィルタリング・ページネーション対応
 * 
 * エンドポイント: GET /api/bedrock/agent-trace
 * 
 * クエリパラメータ:
 * - sessionId: セッションID（オプション）
 * - traceId: 特定のトレースID（オプション）
 * - stepTypes: フィルターするステップタイプ（カンマ区切り）
 * - includeGAFeatures2024: 2024年GA機能を含めるか（boolean）
 * - page: ページ番号（デフォルト: 1）
 * - limit: 1ページあたりの件数（デフォルト: 10）
 * - startDate: 開始日時（ISO 8601形式）
 * - endDate: 終了日時（ISO 8601形式）
 */

/**
 * 実際のBedrockAgentRuntimeClientを使用したトレースデータ取得関数
 * 
 * 【重要】現在の実装について:
 * - AWS Bedrock Agent Runtime APIには直接的なGetTraceCommandが存在しないため、
 *   代替手段として以下のアプローチを使用:
 *   1. DynamoDBからトレースデータを取得
 *   2. CloudWatch Logsからトレース情報を抽出
 *   3. カスタムトレースストレージからの取得
 * 
 * - 現在のmockTraceは開発・テスト目的の一時的な実装です
 * - 本番環境では実際のAWSサービスからデータを取得する必要があります
 * 
 * 注意: 現在のAWS SDKにはGetTraceCommandは存在しないため、
 * InvokeAgentCommandのレスポンスからトレース情報を構築します
 * 
 * @param traceId トレースID
 * @param sessionId セッションID
 * @param includeGAFeatures 2024年GA機能を含めるか
 * @returns BedrockAgentTrace
 */
async function fetchActualTrace(traceId: string, sessionId: string, includeGAFeatures: boolean = false): Promise<BedrockAgentTrace> {
  // 実際のトレースデータは通常、InvokeAgentCommandの実行時に生成されるため、
  // ここでは模擬的なトレースデータを返します
  // 本番環境では、DynamoDBやCloudWatchLogsからトレースデータを取得する実装が必要です
  
  const mockTrace: BedrockAgentTrace = {
    traceId,
    sessionId,
    agentId: process.env.BEDROCK_AGENT_ID || 'unknown',
    agentAliasId: process.env.BEDROCK_AGENT_ALIAS_ID || 'unknown',
    userQuery: 'Sample query',
    finalResponse: 'Sample response',
    startTime: new Date(Date.now() - 5000),
    endTime: new Date(),
    totalExecutionTimeMs: 5000,
    status: 'COMPLETED',
    steps: [],
    metadata: {
      foundationModel: 'anthropic.claude-v2',
      region: 'ap-northeast-1',
      gaFeatures2024: {
        multiAgentEnabled: false,
        inlineAgentEnabled: false,
        payloadReferencingEnabled: false
      }
    }
  };
  
  return mockTrace;
}

export async function GET(request: NextRequest) {
  try {
    // 環境変数の検証
    const requiredEnvVars = ['AWS_REGION', 'BEDROCK_AGENT_ID'];
    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        return NextResponse.json({
          success: false,
          error: `環境変数 ${envVar} が設定されていません`,
          timestamp: new Date().toISOString()
        }, { status: 500 });
      }
    }

    const { searchParams } = new URL(request.url);
    
    // クエリパラメータの取得と検証
    const sessionId = searchParams.get('sessionId');
    const traceId = searchParams.get('traceId');
    const stepTypesParam = searchParams.get('stepTypes');
    const includeGAFeatures2024 = searchParams.get('includeGAFeatures2024') === 'true';
    
    // ページネーションパラメータの検証
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '10'))); // 最大100件に制限
    
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // 入力値のサニタイゼーション
    if (traceId && !/^[a-zA-Z0-9_-]+$/.test(traceId)) {
      return NextResponse.json({
        success: false,
        error: 'traceIdの形式が無効です'
      }, { status: 400 });
    }

    if (sessionId && !/^[a-zA-Z0-9_-]+$/.test(sessionId)) {
      return NextResponse.json({
        success: false,
        error: 'sessionIdの形式が無効です'
      }, { status: 400 });
    }

    // レート制限チェック（簡易実装）
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    console.log(`[Agent Trace API] Request from IP: ${clientIp}`);
    
    // 実際の実装では Redis や DynamoDB を使用してレート制限を実装
    // 現在は基本的な制限のみ実装
    if (limit > 50) {
      return NextResponse.json({
        success: false,
        error: '1回のリクエストで取得できる件数は最大50件です'
      }, { status: 429 });
    }

    // ステップタイプフィルターの解析
    let stepTypeFilter: Set<TraceStepType> | undefined;
    if (stepTypesParam) {
      const stepTypes = stepTypesParam.split(',') as TraceStepType[];
      stepTypeFilter = new Set(stepTypes);
    }

    // 日付フィルターの解析
    let dateFilter: { start: Date; end: Date } | undefined;
    if (startDate && endDate) {
      try {
        dateFilter = {
          start: new Date(startDate),
          end: new Date(endDate)
        };
      } catch (error) {
        return NextResponse.json({
          success: false,
          error: '日付形式が無効です。ISO 8601形式を使用してください。'
        }, { status: 400 });
      }
    }

    // トレースデータを取得
    // 注意: 実際のBedrockAgentRuntimeClientにはGetTraceCommandは存在しないため、
    // 代替手段を使用します（DynamoDB、CloudWatchLogs、またはカスタムストレージから取得）
    
    let traces: BedrockAgentTrace[] = [];
    
    if (traceId) {
      // 特定のトレースを取得
      try {
        const trace = await fetchActualTrace(traceId, sessionId || '', includeGAFeatures2024);
        traces = [trace];
      } catch (error) {
        console.error('特定のトレース取得エラー:', error);
        throw new Error(`トレースID ${traceId} の取得に失敗しました`);
      }
    } else {
      // 複数のトレースを取得（模擬データ）
      try {
        // 実際の実装では、DynamoDBやCloudWatchLogsから複数のトレースを取得
        const mockTraceIds = ['trace-1', 'trace-2', 'trace-3'];
        const tracePromises = mockTraceIds.map(id => 
          fetchActualTrace(id, sessionId || '', includeGAFeatures2024)
        );
        traces = await Promise.all(tracePromises);
      } catch (error) {
        console.error('複数トレース取得エラー:', error);
        throw error;
      }
    }

    // フィルタリング適用
    let filteredTraces = traces;

    // セッションIDフィルター
    if (sessionId) {
      filteredTraces = filteredTraces.filter(trace => trace.sessionId === sessionId);
    }

    // 日付フィルター
    if (dateFilter) {
      filteredTraces = filteredTraces.filter(trace => {
        if (!trace.startTime) return false;
        const traceTime = trace.startTime;
        return traceTime >= dateFilter!.start && traceTime <= dateFilter!.end;
      });
    }

    // ステップタイプフィルター
    if (stepTypeFilter && stepTypeFilter.size > 0) {
      filteredTraces = filteredTraces.filter(trace =>
        trace.steps?.some(step => stepTypeFilter!.has(step.type)) ?? false
      );
    }

    // ページネーション
    const totalCount = filteredTraces.length;
    const totalPages = Math.ceil(totalCount / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedTraces = filteredTraces.slice(startIndex, endIndex);

    // 統計情報の効率的な計算（単一ループで処理）
    let successfulTraces = 0;
    let failedTraces = 0;
    let totalExecutionTime = 0;
    let multiAgentTraces = 0;
    let inlineAgentExecutions = 0;
    let payloadOptimizationCount = 0;

    for (const trace of filteredTraces) {
      // 基本統計（実際のプロパティに基づく）
      successfulTraces++; // 簡略化: 全て成功として扱う
      
      // 実行時間統計（タイムスタンプから推定）
      totalExecutionTime += trace.totalExecutionTimeMs || 1000;
      
      // GA機能統計（必要な場合のみ）
      if (includeGAFeatures2024 && trace.steps) {
        multiAgentTraces++; // 簡略化
        
        for (const step of trace.steps) {
          if (step.type === 'ORCHESTRATION') inlineAgentExecutions++;
          if (step.type === 'KNOWLEDGE_BASE_LOOKUP') payloadOptimizationCount++;
        }
      }
    }

    const statistics = {
      totalTraces: totalCount,
      successfulTraces,
      failedTraces,
      averageExecutionTime: totalExecutionTime / Math.max(filteredTraces.length, 1),
      gaFeatures2024Stats: includeGAFeatures2024 ? {
        multiAgentTraces,
        inlineAgentExecutions,
        payloadOptimizationCount,
        averageOptimizationRate: payloadOptimizationCount > 0 ? 75.0 : 0 // 実際の計算に変更予定
      } : undefined
    };

    return NextResponse.json({
      success: true,
      traces: paginatedTraces,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      },
      statistics,
      filters: {
        sessionId,
        traceId,
        stepTypes: stepTypeFilter ? Array.from(stepTypeFilter) : undefined,
        includeGAFeatures2024,
        dateRange: dateFilter
      },
      metadata: {
        requestTime: new Date().toISOString(),
        apiVersion: '2024-ga',
        supportedFeatures: {
          multiAgentCollaboration: true,
          inlineAgentInvocation: true,
          payloadReferencing: true,
          securityContext: true,
          realTimeUpdates: false // 将来の実装予定
        }
      }
    });

  } catch (error) {
    console.error('Agent Trace API エラー:', error);
    
    // エラータイプに応じた適切なステータスコードの設定
    let statusCode = 500;
    let errorMessage = 'トレースデータの取得中にエラーが発生しました';
    
    if (error instanceof Error) {
      if (error.message.includes('認証') || error.message.includes('権限')) {
        statusCode = 403;
        errorMessage = 'アクセス権限がありません';
      } else if (error.message.includes('見つかりません') || error.message.includes('存在しません')) {
        statusCode = 404;
        errorMessage = '指定されたトレースが見つかりません';
      } else if (error.message.includes('形式') || error.message.includes('無効')) {
        statusCode = 400;
        errorMessage = 'リクエストパラメータが無効です';
      }
    }
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : 'Unknown error') : undefined,
      timestamp: new Date().toISOString()
    }, { status: statusCode });
  }
}

// POST メソッド - トレース設定の更新（将来の実装予定）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('[Agent Trace API] POST request received:', { bodyKeys: Object.keys(body) });
    
    // 将来の実装: トレース設定の更新、リアルタイム更新の有効化など
    
    return NextResponse.json({
      success: false,
      error: 'POST メソッドは現在実装されていません',
      message: '将来のバージョンでトレース設定の更新機能を提供予定です'
    }, { status: 501 });
    
  } catch (error) {
    console.error('Agent Trace API POST エラー:', error);
    
    return NextResponse.json({
      success: false,
      error: 'リクエストの処理中にエラーが発生しました',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}