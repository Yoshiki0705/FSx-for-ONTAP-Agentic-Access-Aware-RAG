/**
 * Token Refresh API Route
 *
 * リフレッシュトークンを使用してCognito Token Endpointから
 * 新しいアクセストークンとIDトークンを取得する。
 *
 * Requirements: 14.1, 14.4
 */

import { NextResponse } from "next/server";

const COGNITO_DOMAIN =
  process.env.COGNITO_DOMAIN || process.env.NEXT_PUBLIC_COGNITO_DOMAIN || "";
const COGNITO_REGION =
  process.env.COGNITO_REGION ||
  process.env.NEXT_PUBLIC_COGNITO_REGION ||
  process.env.AWS_REGION ||
  "ap-northeast-1";
const COGNITO_CLIENT_ID =
  process.env.COGNITO_CLIENT_ID || process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || "";
const COGNITO_CLIENT_SECRET = process.env.COGNITO_CLIENT_SECRET || "";

export async function POST(request: Request) {
  try {
    // リフレッシュトークンをリクエストボディまたはCookieから取得
    let refreshToken: string | undefined;
    try {
      const body = await request.json();
      refreshToken = body.refreshToken;
    } catch {
      // JSONパース失敗時はCookieから取得
    }

    // Cookieからのフォールバック
    if (!refreshToken) {
      const cookieHeader = request.headers.get("cookie") || "";
      const match = cookieHeader.match(/refresh-token=([^;]+)/);
      refreshToken = match ? match[1] : undefined;
    }

    if (!refreshToken) {
      return NextResponse.json(
        { error: "refresh_token_required" },
        { status: 400 }
      );
    }

    if (!COGNITO_DOMAIN || !COGNITO_CLIENT_ID) {
      console.error(
        "[Token Refresh] Missing COGNITO_DOMAIN or COGNITO_CLIENT_ID"
      );
      return NextResponse.json(
        { error: "server_configuration_error" },
        { status: 500 }
      );
    }

    const tokenUrl = `https://${COGNITO_DOMAIN}.auth.${COGNITO_REGION}.amazoncognito.com/oauth2/token`;

    const tokenBody = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: COGNITO_CLIENT_ID,
      refresh_token: refreshToken,
    });

    // client_secret がある場合は Basic 認証ヘッダーを使用（callback route と同パターン）
    const headers: Record<string, string> = {
      "Content-Type": "application/x-www-form-urlencoded",
    };
    if (COGNITO_CLIENT_SECRET) {
      const credentials = Buffer.from(
        `${COGNITO_CLIENT_ID}:${COGNITO_CLIENT_SECRET}`
      ).toString("base64");
      headers["Authorization"] = `Basic ${credentials}`;
    }

    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers,
      body: tokenBody,
    });

    if (!tokenResponse.ok) {
      const errorBody = await tokenResponse.text();
      console.error(
        "[Token Refresh] Cognito token refresh failed:",
        tokenResponse.status,
        errorBody
      );

      // リフレッシュトークン期限切れ or 無効
      if (tokenResponse.status === 400 || tokenResponse.status === 401) {
        return NextResponse.json(
          { error: "token_expired" },
          { status: 401 }
        );
      }

      return NextResponse.json(
        { error: "token_refresh_failed" },
        { status: 502 }
      );
    }

    const tokenData = await tokenResponse.json();

    console.log("[Token Refresh] トークンリフレッシュ成功");

    return NextResponse.json({
      accessToken: tokenData.access_token,
      idToken: tokenData.id_token,
      expiresIn: tokenData.expires_in,
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("[Token Refresh] Error:", err.message);
    return NextResponse.json(
      { error: "server_error" },
      { status: 500 }
    );
  }
}
