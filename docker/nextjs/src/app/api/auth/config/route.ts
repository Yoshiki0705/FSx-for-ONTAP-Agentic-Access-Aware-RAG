/**
 * /api/auth/config — サーバーサイド環境変数をクライアントに返すエンドポイント
 * 
 * NEXT_PUBLIC_* 環境変数はビルド時にインライン化されるため、
 * Lambda環境変数として設定してもクライアントサイドでは利用できない。
 * このエンドポイントでサーバーサイドの環境変数を安全に返す。
 */
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    oidcProviderName: process.env.NEXT_PUBLIC_OIDC_PROVIDER_NAME || '',
    oidcProviders: process.env.NEXT_PUBLIC_OIDC_PROVIDERS || '',
    cognitoDomain: process.env.NEXT_PUBLIC_COGNITO_DOMAIN || '',
    cognitoRegion: process.env.NEXT_PUBLIC_COGNITO_REGION || '',
    cognitoClientId: process.env.COGNITO_CLIENT_ID || '',
    callbackUrl: process.env.CALLBACK_URL || '',
    idpName: process.env.IDP_NAME || '',
  });
}
