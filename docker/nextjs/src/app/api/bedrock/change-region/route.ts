import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { RegionConfigManager, SupportedRegion } from '@/config/region-config-manager';

export const dynamic = 'force-dynamic';

// 定数定義
const HTTP_STATUS = {
  OK: 200,
  BAD_REQUEST: 400,
  FORBIDDEN: 403,
  METHOD_NOT_ALLOWED: 405,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
} as const;

const ERROR_MESSAGES = {
  REGION_NOT_SPECIFIED: 'リージョンが指定されていません',
  INVALID_REGION_FORMAT: '無効なリージョン形式です',
  INVALID_REGION: (region: string) => `無効なリージョン: ${region}`,
  REGION_CHANGE_FAILED: 'リージョン変更に失敗しました',
  CSRF_VALIDATION_FAILED: 'CSRF検証に失敗しました',
  RATE_LIMIT_EXCEEDED: 'リクエスト制限を超えました。しばらく待ってから再試行してください',
  METHOD_NOT_ALLOWED: 'このエンドポイントはPOSTメソッドのみサポートしています',
} as const;

const REGION_PATTERN = /^[a-z]{2}-[a-z]+-\d+$/;

// 型定義
interface ChangeRegionResponse {
  success: boolean;
  data?: {
    region: SupportedRegion;
    regionName: string;
    message: string;
  };
  error?: string;
  fallbackRegion?: SupportedRegion;
  timestamp: string;
}

// ログユーティリティ
const logger = {
  info: (message: string, ...args: any[]) => console.log(`[INFO] [Change Region API] ${message}`, ...args),
  error: (message: string, ...args: any[]) => console.error(`[ERROR] [Change Region API] ${message}`, ...args),
  warn: (message: string, ...args: any[]) => console.warn(`[WARN] [Change Region API] ${message}`, ...args),
};

// レート制限（本番環境ではRedis/DynamoDBを使用推奨）
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(clientId: string): boolean {
  const now = Date.now();
  const limit = rateLimitMap.get(clientId);
  
  if (!limit || now > limit.resetTime) {
    rateLimitMap.set(clientId, { count: 1, resetTime: now + 60000 });
    return true;
  }
  
  if (limit.count >= 10) {
    return false;
  }
  
  limit.count++;
  return true;
}

// ビジネスロジック
async function changeRegion(region: string): Promise<Omit<ChangeRegionResponse, 'timestamp'>> {
  // 入力値検証
  if (!region || typeof region !== 'string') {
    return {
      success: false,
      error: ERROR_MESSAGES.REGION_NOT_SPECIFIED,
    };
  }
  
  if (!REGION_PATTERN.test(region)) {
    return {
      success: false,
      error: ERROR_MESSAGES.INVALID_REGION_FORMAT,
    };
  }
  
  // リージョン検証
  const validation = RegionConfigManager.validateRegion(region);
  
  if (!validation.isValid) {
    return {
      success: false,
      error: ERROR_MESSAGES.INVALID_REGION(region),
      fallbackRegion: validation.fallbackRegion,
    };
  }
  
  const newRegion = region as SupportedRegion;
  const regionName = RegionConfigManager.getRegionDisplayName(newRegion);
  
  logger.info(`Region changed to: ${newRegion} (${regionName})`);
  
  return {
    success: true,
    data: {
      region: newRegion,
      regionName,
      message: `リージョンを${regionName}に変更しました`
    }
  };
}

/**
 * リージョン変更API
 * POSTリクエストで新しいリージョンを設定
 */
export async function POST(request: NextRequest): Promise<NextResponse<ChangeRegionResponse>> {
  logger.info('API endpoint called');
  
  try {
    // CSRF検証（将来的に実装予定）
    // 現在は無効化（Cookieベースの認証を使用）
    // if (process.env.NODE_ENV === 'production') {
    //   const headersList = await headers();
    //   const csrfToken = headersList.get('x-csrf-token');
    //   const sessionToken = request.cookies.get('csrf-token')?.value;
    //   
    //   if (!csrfToken || csrfToken !== sessionToken) {
    //     logger.warn('CSRF validation failed');
    //     return NextResponse.json({
    //       success: false,
    //       error: ERROR_MESSAGES.CSRF_VALIDATION_FAILED,
    //       timestamp: new Date().toISOString()
    //     }, { status: HTTP_STATUS.FORBIDDEN });
    //   }
    // }
    
    // レート制限チェック
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    if (!checkRateLimit(clientIp)) {
      logger.warn(`Rate limit exceeded for client: ${clientIp}`);
      return NextResponse.json({
        success: false,
        error: ERROR_MESSAGES.RATE_LIMIT_EXCEEDED,
        timestamp: new Date().toISOString()
      }, { status: HTTP_STATUS.TOO_MANY_REQUESTS });
    }
    
    // リクエストボディ取得
    const body = await request.json();
    const { region } = body;
    
    // ビジネスロジック実行
    const result = await changeRegion(region);
    
    // レスポンスを作成
    const response = NextResponse.json({
      ...result,
      timestamp: new Date().toISOString()
    }, {
      status: result.success ? HTTP_STATUS.OK : HTTP_STATUS.BAD_REQUEST,
      headers: {
        'Cache-Control': 'no-store, must-revalidate',
      }
    });
    
    // 成功時はCookieにリージョンを保存
    if (result.success && result.data) {
      response.cookies.set('bedrock_region', result.data.region, {
        maxAge: 60 * 60 * 24 * 30, // 30日
        path: '/',
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production'
      });
      logger.info(`Cookie set: bedrock_region=${result.data.region}`);
    }
    
    return response;
    
  } catch (error) {
    logger.error('Unexpected error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : ERROR_MESSAGES.REGION_CHANGE_FAILED,
      timestamp: new Date().toISOString()
    }, { status: HTTP_STATUS.INTERNAL_SERVER_ERROR });
  }
}

// 他のHTTPメソッドの明示的な拒否
export async function GET(): Promise<NextResponse<ChangeRegionResponse>> {
  return NextResponse.json({
    success: false,
    error: ERROR_MESSAGES.METHOD_NOT_ALLOWED,
    timestamp: new Date().toISOString()
  }, { status: HTTP_STATUS.METHOD_NOT_ALLOWED });
}

export async function PUT(): Promise<NextResponse<ChangeRegionResponse>> {
  return NextResponse.json({
    success: false,
    error: ERROR_MESSAGES.METHOD_NOT_ALLOWED,
    timestamp: new Date().toISOString()
  }, { status: HTTP_STATUS.METHOD_NOT_ALLOWED });
}

export async function DELETE(): Promise<NextResponse<ChangeRegionResponse>> {
  return NextResponse.json({
    success: false,
    error: ERROR_MESSAGES.METHOD_NOT_ALLOWED,
    timestamp: new Date().toISOString()
  }, { status: HTTP_STATUS.METHOD_NOT_ALLOWED });
}
