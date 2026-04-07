import { NextResponse } from "next/server";
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  GetUserCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { SignJWT } from "jose";

const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.COGNITO_REGION || process.env.AWS_REGION || "ap-northeast-1",
});

const jwtSecret = new TextEncoder().encode(
  process.env.JWT_SECRET || "your-super-secret-jwt-key-change-in-production"
);

// ローカル開発用デモユーザー（COGNITO_CLIENT_ID未設定時に使用）
const LOCAL_DEMO_USERS: Record<string, { password: string; role: string; permissions: string[] }> = {
  admin: {
    password: 'admin123',
    role: 'administrator',
    permissions: ['read', 'write', 'delete', 'admin', 'agent:create', 'model:all']
  },
  developer: {
    password: 'dev123',
    role: 'developer',
    permissions: ['read', 'write', 'agent:create', 'model:claude', 'model:nova']
  },
  user: {
    password: 'user123',
    role: 'user',
    permissions: ['read', 'model:claude-haiku']
  }
};

/**
 * ローカル開発用のデモ認証
 * Cognito不要でJWTを発行し、ミドルウェアの認証フローをそのまま通過させる
 */
async function handleLocalAuth(username: string, password: string): Promise<Response> {
  const demoUser = LOCAL_DEMO_USERS[username];
  if (!demoUser || demoUser.password !== password) {
    return NextResponse.json(
      { success: false, error: "Username or password is incorrect" },
      { status: 401 }
    );
  }

  const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  const token = await new SignJWT({
    sessionId,
    userId: username,
    username,
    role: demoUser.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(jwtSecret);

  console.log(`✅ ローカルデモ認証成功: ${username} (role: ${demoUser.role})`);

  const response = NextResponse.json(
    {
      success: true,
      message: "Sign-in successful (local mode)",
      user: { username, role: demoUser.role, permissions: demoUser.permissions },
    },
    { status: 200 }
  );

  response.cookies.set("session-token", token, {
    httpOnly: true,
    secure: false, // ローカル開発ではHTTP
    sameSite: "lax",
    maxAge: 60 * 60 * 24,
    path: "/",
  });

  return response;
}

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();
    const clientId = process.env.COGNITO_CLIENT_ID;

    // Cognito未設定時はローカルデモ認証にフォールバック
    if (!clientId) {
      console.log("[SignIn API] COGNITO_CLIENT_ID 未設定 → ローカルデモ認証モード");
      return handleLocalAuth(username, password);
    }

    console.log(`[SignIn API] Cognito認証試行: ${username}`);

    // Client Secretが設定されている場合、SECRET_HASHを計算
    const clientSecret = process.env.COGNITO_CLIENT_SECRET;
    let secretHash: string | undefined;
    if (clientSecret) {
      const crypto = require('crypto');
      secretHash = crypto
        .createHmac('sha256', clientSecret)
        .update(username + clientId)
        .digest('base64');
    }

    // Cognito USER_PASSWORD_AUTH フロー
    const authResult = await cognitoClient.send(
      new InitiateAuthCommand({
        AuthFlow: "USER_PASSWORD_AUTH",
        ClientId: clientId,
        AuthParameters: {
          USERNAME: username,
          PASSWORD: password,
          ...(secretHash ? { SECRET_HASH: secretHash } : {}),
        },
      })
    );

    if (!authResult.AuthenticationResult?.AccessToken) {
      return NextResponse.json(
        { success: false, error: "Authentication failed" },
        { status: 401 }
      );
    }

    // Cognitoからユーザー情報を取得
    let email = username;
    try {
      const userInfo = await cognitoClient.send(
        new GetUserCommand({
          AccessToken: authResult.AuthenticationResult.AccessToken,
        })
      );
      const emailAttr = userInfo.UserAttributes?.find(
        (a) => a.Name === "email"
      );
      if (emailAttr?.Value) email = emailAttr.Value;
    } catch {
      // ユーザー情報取得失敗は無視
    }

    // ロール決定（メールアドレスベース）
    let role = "user";
    let permissions = ["read", "model:claude-haiku"];
    if (email.startsWith("admin")) {
      role = "administrator";
      permissions = ["read", "write", "delete", "admin", "model:all"];
    }

    // 自前JWTトークン生成（ミドルウェア互換）
    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    const token = await new SignJWT({
      sessionId,
      userId: email,
      username: email,
      role,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("24h")
      .sign(jwtSecret);

    console.log(`✅ Cognito認証成功: ${email} (role: ${role})`);

    const response = NextResponse.json(
      {
        success: true,
        message: "Sign-in successful",
        user: { username: email, role },
      },
      { status: 200 }
    );

    response.cookies.set("session-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24,
      path: "/",
    });

    return response;
  } catch (error: any) {
    console.error("[SignIn API] エラー:", error.name, error.message);

    if (
      error.name === "NotAuthorizedException" ||
      error.name === "UserNotFoundException"
    ) {
      return NextResponse.json(
        { success: false, error: "Username or password is incorrect" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Server error occurred" },
      { status: 500 }
    );
  }
}
