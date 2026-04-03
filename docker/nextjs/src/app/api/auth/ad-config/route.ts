/**
 * AD Federation + OIDC Federation 設定APIルート
 *
 * サーバーサイド環境変数からAD/OIDC Federation設定を返す。
 * COGNITO_DOMAIN が設定されている場合のみ enabled: true を返す。
 */

import { NextResponse } from "next/server";

export async function GET() {
  const cognitoDomain = process.env.COGNITO_DOMAIN || "";
  const cognitoRegion = process.env.COGNITO_REGION || process.env.AWS_REGION || "ap-northeast-1";
  const cognitoClientId = process.env.COGNITO_CLIENT_ID || "";
  const callbackUrl = process.env.CALLBACK_URL || "";
  const idpName = process.env.IDP_NAME || "ActiveDirectory";
  const oidcProviderName = process.env.NEXT_PUBLIC_OIDC_PROVIDER_NAME || "";

  if (!cognitoDomain) {
    return NextResponse.json({ enabled: false });
  }

  return NextResponse.json({
    enabled: true,
    cognitoDomain,
    cognitoRegion,
    cognitoClientId,
    callbackUrl,
    idpName,
    oidcProviderName,
  });
}
