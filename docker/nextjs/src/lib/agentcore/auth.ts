/**
 * AgentCore API 認証ヘルパー
 *
 * /api/auth/session と同じ方式で認証する（Cookie JWT検証のみ、DynamoDBアクセスなし）。
 * sessionManager.getSessionFromCookies() はDynamoDBアクセスを含むため、
 * セッションテーブルが存在しない環境やCookieが設定されていない場合に失敗する。
 *
 * この関数は cookies() API で session-token Cookie を読み取り、
 * JWT検証のみで userId を取得する。
 */

import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const COOKIE_NAME = 'session-token';

/**
 * Cookie ベースの JWT 認証。DynamoDBアクセスなし。
 * actorId = userId（Cognito ユーザーID）
 */
export async function authenticateRequest(): Promise<{ userId: string } | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;

    if (!token) {
      console.warn('[AgentCore Auth] session-token Cookie が見つかりません');
      return null;
    }

    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);

    const rawUserId = (payload.userId as string) || (payload.username as string);
    if (!rawUserId) {
      console.warn('[AgentCore Auth] JWT に userId/username が含まれていません');
      return null;
    }

    // AgentCore actorId はパターン [a-zA-Z0-9][a-zA-Z0-9-_/]* に合致する必要がある。
    // メールアドレス（@ . を含む）はそのまま使えないため、
    // @ → _at_ 、 . → _dot_ に置換する。
    const userId = rawUserId
      .replace(/@/g, '_at_')
      .replace(/\./g, '_dot_');

    return { userId };
  } catch (error) {
    console.error('[AgentCore Auth] 認証エラー:', error);
    return null;
  }
}
