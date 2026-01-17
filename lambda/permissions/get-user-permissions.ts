/**
 * Permission API Lambda関数
 * ユーザーのFSx for ONTAPアクセス権限を取得するAPI
 * 
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { UnifiedPermissionService } from './unified-permission-service';
import {
  handleError,
  retryWithBackoff,
  withTimeout,
  CircuitBreaker,
  FsxUnavailableError,
  UnauthorizedError,
} from './error-handler';

// レスポンス型定義
interface DirectoryPermission {
  path: string;
  permissions: ('read' | 'write')[];
  owner: string;
  group: string;
}

interface GetPermissionsResponse {
  userId: string;
  userName: string;
  role: string;
  accessibleDirectories: DirectoryPermission[];
  lastUpdated: string;
}

interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
}

// 環境変数
const FSX_VOLUME_UUID = process.env.FSX_VOLUME_UUID;
const FSX_VOLUME_NAME = process.env.FSX_VOLUME_NAME;
const REQUEST_TIMEOUT = parseInt(process.env.REQUEST_TIMEOUT || '30000', 10); // 30秒

// サーキットブレーカーのインスタンス
const circuitBreaker = new CircuitBreaker(5, 60000, 30000);

/**
 * Lambda関数ハンドラー
 * GET /api/user/permissions エンドポイント
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  console.log(`[${requestId}] Permission API called:`, JSON.stringify(event, null, 2));

  try {
    // 1. ユーザー認証
    const user = await authenticateUser(event);
    if (!user) {
      throw new UnauthorizedError('Invalid or missing authentication token');
    }

    console.log(`[${requestId}] Authenticated user:`, user);

    // 2. 統合権限サービスを初期化（ONTAP REST API使用）
    const unifiedService = new UnifiedPermissionService({
      volumeUuid: FSX_VOLUME_UUID,
      volumeName: FSX_VOLUME_NAME,
    });

    // 3. 統合権限チェック（タイムアウト・リトライ・サーキットブレーカー付き）
    const unifiedPermissions = await circuitBreaker.execute(async () => {
      return await withTimeout(
        async () => {
          return await retryWithBackoff(
            () =>
              unifiedService.checkUnifiedPermissions({
                userId: user.userId,
                ipAddress: event.requestContext.identity?.sourceIp || '0.0.0.0',
                userAgent: event.requestContext.identity?.userAgent || 'unknown',
                timestamp: new Date(),
                requestedResource: event.queryStringParameters?.resource,
              }),
            {
              maxRetries: 3,
              initialDelay: 1000,
              maxDelay: 5000,
              backoffMultiplier: 2,
            }
          );
        },
        REQUEST_TIMEOUT,
        'Permission query timed out'
      );
    });

    console.log(
      `[${requestId}] Retrieved unified permissions:`,
      JSON.stringify(unifiedPermissions, null, 2)
    );

    // アクセスが拒否された場合
    if (!unifiedPermissions.overallAccess.allowed) {
      throw new UnauthorizedError(
        unifiedPermissions.overallAccess.reason || 'Access denied'
      );
    }

    // 4. レスポンスを作成（後方互換性のため、既存のフォーマットも維持）
    const response: GetPermissionsResponse = {
      userId: user.userId,
      userName: unifiedPermissions.userName,
      role: unifiedPermissions.role,
      accessibleDirectories: unifiedPermissions.accessibleDirectories,
      lastUpdated: new Date().toISOString(),
    };

    return createSuccessResponse(response);

  } catch (error) {
    console.error(`[${requestId}] Error in permission API:`, error);
    return handleError(error as Error, requestId);
  }
}

/**
 * ユーザー認証
 * Cognitoトークンからユーザー情報を抽出
 */
async function authenticateUser(event: APIGatewayProxyEvent): Promise<UserInfo | null> {
  // Authorizationヘッダーからトークンを取得
  const authHeader = event.headers.Authorization || event.headers.authorization;
  
  if (!authHeader) {
    console.warn('No Authorization header found');
    return null;
  }

  // Bearer トークンを抽出
  const token = authHeader.replace(/^Bearer\s+/i, '');
  
  if (!token) {
    console.warn('No token found in Authorization header');
    return null;
  }

  try {
    // Cognitoトークンをデコード（実際の実装ではJWT検証が必要）
    // ここでは簡略化のため、requestContextから取得
    const claims = event.requestContext.authorizer?.claims;
    
    if (!claims) {
      console.warn('No claims found in request context');
      return null;
    }

    return {
      userId: claims.sub || claims['cognito:username'],
      userName: claims.name || claims.email || claims['cognito:username'],
      role: claims['custom:role'] || 'user',
      email: claims.email,
    };

  } catch (error) {
    console.error('Error authenticating user:', error);
    return null;
  }
}

/**
 * 成功レスポンスを作成
 */
function createSuccessResponse(data: GetPermissionsResponse): APIGatewayProxyResult {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
    },
    body: JSON.stringify(data),
  };
}

/**
 * エラーレスポンスを作成
 */
function createErrorResponse(
  statusCode: number,
  error: string,
  message: string
): APIGatewayProxyResult {
  const errorResponse: ErrorResponse = {
    error,
    message,
    statusCode,
  };

  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
    },
    body: JSON.stringify(errorResponse),
  };
}

// 型定義
interface UserInfo {
  userId: string;
  userName: string;
  role: string;
  email?: string;
}

// エクスポート（テスト用）
export { authenticateUser, createSuccessResponse, createErrorResponse };
