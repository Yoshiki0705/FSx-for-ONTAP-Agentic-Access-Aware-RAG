import { NextRequest, NextResponse } from 'next/server';
import {
  BedrockAgentRuntimeClient,
  RetrieveAndGenerateCommand,
  RetrieveAndGenerateCommandInput,
} from '@aws-sdk/client-bedrock-agent-runtime';
import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';

/**
 * RAG検索API Route — SIDベース権限フィルタリング統合
 * 
 * POST /api/bedrock/kb/retrieve
 * 
 * ┌──────────┐    ┌──────────────┐    ┌───────────────────┐    ┌──────────────┐
 * │ ユーザー  │───▶│ KB Retrieve  │───▶│ Bedrock KB        │───▶│ OpenSearch   │
 * │ (query)  │    │ API Route    │    │ RetrieveAndGenerate│    │ Serverless   │
 * └──────────┘    └──────┬───────┘    └───────────────────┘    └──────────────┘
 *                        │                                            │
 *                        │  ┌─────────────────────────────────────────┘
 *                        │  │ 検索結果（ドキュメント + メタデータ）
 *                        │  ▼
 *                 ┌──────┴───────┐    ┌──────────────┐
 *                 │ SIDフィルタ   │◀──│ DynamoDB     │
 *                 │ リング処理   │    │ user-access  │
 *                 └──────┬───────┘    │ (ユーザーSID)│
 *                        │            └──────────────┘
 *                        ▼
 *                 ┌──────────────┐
 *                 │ フィルタ済み  │
 *                 │ 検索結果     │
 *                 └──────────────┘
 * 
 * SIDフィルタリングロジック:
 *   1. DynamoDB user-accessテーブルからユーザーのSIDリストを取得
 *      （個人SID + 所属グループSID）
 *   2. Bedrock KB検索結果の各ドキュメントからメタデータを取得
 *      （allowed_group_sids: アクセス許可されたSIDリスト）
 *   3. ユーザーのSIDリストとドキュメントのallowed_group_sidsを照合
 *   4. いずれかのSIDがマッチすればアクセス許可、マッチしなければ拒否
 *   5. 権限チェック失敗時は安全側フォールバック（全ドキュメント拒否）
 */

interface RetrieveRequest {
  query: string;
  knowledgeBaseId: string;
  modelId?: string;
  userId: string;
  region?: string;
  sessionId?: string;
}

interface Citation {
  generatedResponsePart?: {
    textResponsePart?: {
      text?: string;
      span?: { start?: number; end?: number };
    };
  };
  retrievedReferences?: Array<{
    content?: { text?: string };
    location?: {
      type?: string;
      s3Location?: { uri?: string };
    };
    metadata?: Record<string, unknown>;
  }>;
}

/** DynamoDB user-accessテーブルのレコード */
interface UserAccessRecord {
  userId: string;
  userSID: string;
  groupSIDs: string[];
  displayName?: string;
  source?: string;
}

// DynamoDBクライアント（Lambda実行環境でリージョン自動検出）
const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || process.env.BEDROCK_REGION || 'ap-northeast-1',
});

/**
 * DynamoDB user-accessテーブルからユーザーのSID情報を取得
 */
async function getUserSIDs(userId: string): Promise<UserAccessRecord | null> {
  const tableName = process.env.USER_ACCESS_TABLE_NAME;
  if (!tableName) {
    console.warn('⚠️ [SID Filter] USER_ACCESS_TABLE_NAME が未設定');
    return null;
  }

  try {
    const result = await dynamoClient.send(new GetItemCommand({
      TableName: tableName,
      Key: { userId: { S: userId } },
    }));

    if (!result.Item) {
      console.warn(`⚠️ [SID Filter] ユーザー ${userId} のSID情報が見つかりません`);
      return null;
    }

    const item = unmarshall(result.Item);
    return {
      userId: item.userId,
      userSID: item.userSID || '',
      groupSIDs: item.groupSIDs || item.SID || [],
      displayName: item.displayName,
      source: item.source,
    };
  } catch (error) {
    console.error('❌ [SID Filter] DynamoDB読み取りエラー:', error);
    return null;
  }
}

/**
 * SIDベースの権限フィルタリング
 * 
 * ユーザーのSIDリスト（個人SID + グループSID）と
 * ドキュメントのallowed_group_sids（アクセス許可SIDリスト）を照合する。
 * 
 * マッチング条件:
 *   - ユーザーのいずれかのSIDが、ドキュメントのallowed_group_sidsに含まれていればアクセス許可
 *   - S-1-1-0（Everyone）はすべてのユーザーにマッチ
 *   - allowed_group_sidsが空またはメタデータなしの場合はアクセス拒否（安全側）
 */
function checkSIDAccess(
  userSIDs: string[],
  documentAllowedSIDs: string[],
): boolean {
  if (!Array.isArray(documentAllowedSIDs) || documentAllowedSIDs.length === 0) {
    return false; // メタデータなし → 安全側で拒否
  }

  // ユーザーのいずれかのSIDがドキュメントの許可SIDリストに含まれているか
  for (const userSID of userSIDs) {
    if (documentAllowedSIDs.includes(userSID)) {
      return true;
    }
  }
  return false;
}

export async function POST(request: NextRequest) {
  try {
    const body: RetrieveRequest = await request.json();
    const {
      query,
      knowledgeBaseId,
      userId,
      sessionId,
    } = body;

    const region = body.region || process.env.BEDROCK_REGION || 'ap-northeast-1';
    const modelId = body.modelId || process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-haiku-20240307-v1:0';

    // 入力検証
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'クエリが空です' },
        { status: 400 }
      );
    }

    if (!knowledgeBaseId) {
      return NextResponse.json(
        { success: false, error: 'Knowledge Base IDが指定されていません' },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'ユーザーIDが指定されていません' },
        { status: 400 }
      );
    }

    console.log('🔍 [KB Retrieve] RAG検索開始:', {
      query: query.substring(0, 100),
      knowledgeBaseId,
      modelId,
      userId,
      region,
    });

    // ========================================
    // Step 1: ユーザーのSID情報をDynamoDBから取得
    // ========================================
    const userAccess = await getUserSIDs(userId);
    const allUserSIDs: string[] = [];

    if (userAccess) {
      if (userAccess.userSID) allUserSIDs.push(userAccess.userSID);
      if (Array.isArray(userAccess.groupSIDs)) allUserSIDs.push(...userAccess.groupSIDs);
      console.log('🔑 [SID Filter] ユーザーSID取得:', {
        userId,
        userSID: userAccess.userSID,
        groupSIDs: userAccess.groupSIDs,
        totalSIDs: allUserSIDs.length,
        displayName: userAccess.displayName,
      });
    } else {
      console.warn('⚠️ [SID Filter] SID情報なし → 安全側フォールバック（全拒否）');
    }

    // ========================================
    // Step 2: Bedrock KB検索
    // ========================================
    const client = new BedrockAgentRuntimeClient({ region });

    // Foundation model ARNを直接構築（KB RetrieveAndGenerateではinference profileではなくfoundation modelを使用）
    const modelArn = `arn:aws:bedrock:${region}::foundation-model/${modelId}`;

    console.log('🎯 [KB Retrieve] モデルARN:', {
      modelId,
      modelArn,
    });

    const input: RetrieveAndGenerateCommandInput = {
      input: { text: query },
      retrieveAndGenerateConfiguration: {
        type: 'KNOWLEDGE_BASE',
        knowledgeBaseConfiguration: {
          knowledgeBaseId,
          modelArn,
          retrievalConfiguration: {
            vectorSearchConfiguration: {
              numberOfResults: 10,
            },
          },
        },
      },
    };

    if (sessionId) {
      input.sessionId = sessionId;
    }

    const command = new RetrieveAndGenerateCommand(input);
    const response = await client.send(command);

    console.log('✅ [KB Retrieve] Bedrock KB応答受信:', {
      hasOutput: !!response.output,
      outputLength: response.output?.text?.length,
      citationCount: response.citations?.length || 0,
      sessionId: response.sessionId,
    });

    // ========================================
    // Step 3: Citation情報を整形
    // ========================================
    const citations: Citation[] = response.citations || [];
    const formattedCitations = citations.flatMap((citation) => {
      const refs = citation.retrievedReferences || [];
      return refs.map((ref) => {
        const s3Uri = ref.location?.s3Location?.uri || '';
        const fileName = s3Uri.split('/').pop() || s3Uri;
        return {
          fileName,
          s3Uri,
          content: ref.content?.text?.substring(0, 500) || '',
          metadata: ref.metadata || {},
        };
      });
    });

    // ========================================
    // Step 4: SIDベース権限フィルタリング
    // ========================================
    let filteredCitations = formattedCitations;
    const sidFilterDetails: Array<{
      fileName: string;
      documentSIDs: string[];
      matched: boolean;
      matchedSID?: string;
    }> = [];

    if (allUserSIDs.length > 0) {
      // SID情報がある場合: SIDマッチングでフィルタリング
      filteredCitations = formattedCitations.filter((cite) => {
        const meta = cite.metadata as Record<string, unknown>;
        // メタデータからallowed_group_sidsを取得
        let allowedSIDs: string[] = [];
        if (Array.isArray(meta?.allowed_group_sids)) {
          allowedSIDs = meta.allowed_group_sids as string[];
        } else if (typeof meta?.allowed_group_sids === 'string') {
          // 文字列の場合はJSON解析を試みる
          try {
            allowedSIDs = JSON.parse(meta.allowed_group_sids as string);
          } catch {
            allowedSIDs = [meta.allowed_group_sids as string];
          }
        }

        const allowed = checkSIDAccess(allUserSIDs, allowedSIDs);
        const matchedSID = allowed
          ? allUserSIDs.find(sid => allowedSIDs.includes(sid))
          : undefined;

        sidFilterDetails.push({
          fileName: cite.fileName,
          documentSIDs: allowedSIDs,
          matched: allowed,
          matchedSID,
        });

        console.log(`🔐 [SID Filter] ${cite.fileName}: ${allowed ? '✅ ALLOW' : '❌ DENY'}`, {
          documentSIDs: allowedSIDs,
          matchedSID,
        });

        return allowed;
      });
    } else {
      // SID情報がない場合: 安全側フォールバック（全ドキュメント拒否）
      filteredCitations = [];
      formattedCitations.forEach((cite) => {
        sidFilterDetails.push({
          fileName: cite.fileName,
          documentSIDs: [],
          matched: false,
        });
      });
    }

    const filterLog = {
      totalDocuments: formattedCitations.length,
      allowedDocuments: filteredCitations.length,
      deniedDocuments: formattedCitations.length - filteredCitations.length,
      userId,
      userSIDs: allUserSIDs,
      filterMethod: allUserSIDs.length > 0 ? 'SID_MATCHING' : 'DENY_ALL_FALLBACK',
      details: sidFilterDetails,
      timestamp: new Date().toISOString(),
    };

    console.log('🔐 [SID Filter] フィルタリング完了:', {
      total: filterLog.totalDocuments,
      allowed: filterLog.allowedDocuments,
      denied: filterLog.deniedDocuments,
      method: filterLog.filterMethod,
    });

    return NextResponse.json({
      success: true,
      answer: response.output?.text || '',
      citations: filteredCitations,
      filterLog,
      sessionId: response.sessionId,
      metadata: {
        knowledgeBaseId,
        modelId,
        region,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('❌ [KB Retrieve] RAG検索エラー:', error);

    const errorName = error instanceof Error ? error.constructor.name : 'UnknownError';
    const errorMessage = error instanceof Error ? error.message : 'RAG検索に失敗しました';

    const errorMessages: Record<string, { ja: string; en: string }> = {
      ThrottlingException: {
        ja: 'リクエストが多すぎます。しばらく待ってから再試行してください。',
        en: 'Too many requests. Please wait and try again.',
      },
      ServiceUnavailableException: {
        ja: 'サービスが一時的に利用できません。しばらく待ってから再試行してください。',
        en: 'Service temporarily unavailable. Please try again later.',
      },
      ValidationException: {
        ja: '入力内容を確認してください。',
        en: 'Please check your input.',
      },
    };

    const userMessage = errorMessages[errorName] || {
      ja: 'エラーが発生しました。再試行してください。',
      en: 'An error occurred. Please try again.',
    };

    return NextResponse.json(
      {
        success: false,
        error: userMessage.ja,
        errorEn: userMessage.en,
        errorType: errorName,
        details: errorMessage,
      },
      { status: errorName === 'ThrottlingException' ? 429 : 500 }
    );
  }
}
