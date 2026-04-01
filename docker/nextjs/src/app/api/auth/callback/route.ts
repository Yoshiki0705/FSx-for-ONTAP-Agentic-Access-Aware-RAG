/**
 * OAuth Callback API Route
 *
 * Cognito Hosted UI からの認可コードコールバックを処理する。
 * 認可コード → トークン交換 → IDトークンからユーザー属性取得 → セッションCookie設定
 */

import { NextResponse } from "next/server";
import { SignJWT, decodeJwt } from "jose";

const COGNITO_DOMAIN = process.env.COGNITO_DOMAIN || "";
const COGNITO_REGION = process.env.COGNITO_REGION || process.env.AWS_REGION || "ap-northeast-1";
const COGNITO_CLIENT_ID = process.env.COGNITO_CLIENT_ID || "";
const COGNITO_CLIENT_SECRET = process.env.COGNITO_CLIENT_SECRET || "";
const CALLBACK_URL = process.env.CALLBACK_URL || "";

const jwtSecret = new TextEncoder().encode(
  process.env.JWT_SECRET || "your-super-secret-jwt-key-change-in-production"
);

/**
 * IDトークンペイロードからロールを判定する。
 * custom:role === 'admin' または custom:ad_groups に admin グループが含まれる場合は 'administrator'。
 */
export function determineRole(payload: Record<string, unknown>): string {
  const customRole = payload["custom:role"] as string | undefined;
  if (customRole === "admin") return "administrator";

  const adGroups = payload["custom:ad_groups"] as string | undefined;
  if (adGroups) {
    const groups = adGroups.split(",").map((g) => g.trim().toLowerCase());
    if (groups.some((g) => g.includes("admin"))) return "administrator";
  }

  return "user";
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    if (error) {
      console.error("[OAuth Callback] Cognito error:", error);
      return NextResponse.redirect(new URL("/signin?error=auth_failed", request.url));
    }

    if (!code) {
      return NextResponse.redirect(new URL("/signin?error=no_code", request.url));
    }

    if (!COGNITO_DOMAIN || !COGNITO_CLIENT_ID) {
      console.error("[OAuth Callback] Missing COGNITO_DOMAIN or COGNITO_CLIENT_ID");
      return NextResponse.redirect(new URL("/signin?error=config_error", request.url));
    }

    // 1. 認可コードをトークンに交換
    const tokenUrl = `https://${COGNITO_DOMAIN}.auth.${COGNITO_REGION}.amazoncognito.com/oauth2/token`;

    const tokenBody = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: COGNITO_CLIENT_ID,
      redirect_uri: CALLBACK_URL,
    });

    // client_secret がある場合は Basic 認証ヘッダーを使用
    const headers: Record<string, string> = {
      "Content-Type": "application/x-www-form-urlencoded",
    };
    if (COGNITO_CLIENT_SECRET) {
      const credentials = Buffer.from(`${COGNITO_CLIENT_ID}:${COGNITO_CLIENT_SECRET}`).toString("base64");
      headers["Authorization"] = `Basic ${credentials}`;
    }

    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers,
      body: tokenBody,
    });

    if (!tokenResponse.ok) {
      const errorBody = await tokenResponse.text();
      console.error("[OAuth Callback] Token exchange failed:", tokenResponse.status, errorBody);
      return NextResponse.redirect(new URL("/signin?error=token_exchange_failed", request.url));
    }

    const tokenData = await tokenResponse.json();
    const { id_token } = tokenData;

    if (!id_token) {
      console.error("[OAuth Callback] No id_token in response");
      return NextResponse.redirect(new URL("/signin?error=no_id_token", request.url));
    }

    // 2. IDトークンからユーザー属性取得
    const payload = decodeJwt(id_token);
    const email = (payload.email as string) || "";
    const sub = (payload.sub as string) || "";

    // 3. ロール判定
    const role = determineRole(payload as Record<string, unknown>);

    // 4. セッションJWT生成
    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    const sessionToken = await new SignJWT({
      sessionId,
      userId: sub || email,
      username: email,
      role,
      authMethod: "saml",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("24h")
      .sign(jwtSecret);

    console.log(`✅ OAuth Callback成功: ${email} (role: ${role}, authMethod: saml)`);

    // 5. セッションCookie設定 + チャット画面へリダイレクト
    const redirectUrl = new URL("/ja/genai", request.url);
    const response = NextResponse.redirect(redirectUrl);

    response.cookies.set("session-token", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24,
      path: "/",
    });

    return response;
  } catch (error: unknown) {
    const err = error as Error;
    console.error("[OAuth Callback] Error:", err.message);
    return NextResponse.redirect(new URL("/signin?error=server_error", request.url));
  }
}
