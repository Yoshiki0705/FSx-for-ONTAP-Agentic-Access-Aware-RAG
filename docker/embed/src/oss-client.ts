/**
 * OpenSearch Serverless クライアント
 * 
 * AWS SigV4署名を使用してOpenSearch Serverlessにドキュメントをインデックスする。
 * EC2インスタンスプロファイル（IMDS）からの認証情報を自動取得する。
 */

import * as https from 'https';
import * as crypto from 'crypto';

let collectionEndpoint = '';
let awsRegion = '';

/** 認証情報キャッシュ */
interface AwsCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  expiration?: Date;
}
let cachedCredentials: AwsCredentials | null = null;

/** AWS SDK defaultProvider経由で認証情報を取得（IMDS, env, profile等を自動解決） */
async function resolveCredentials(): Promise<AwsCredentials> {
  // キャッシュが有効なら再利用（有効期限5分前にリフレッシュ）
  if (cachedCredentials && cachedCredentials.expiration) {
    const now = new Date();
    const refreshAt = new Date(cachedCredentials.expiration.getTime() - 5 * 60 * 1000);
    if (now < refreshAt) {
      return cachedCredentials;
    }
  }

  const { defaultProvider } = await import('@aws-sdk/credential-provider-node') as any;
  const provider = defaultProvider({});
  const creds = await provider();

  cachedCredentials = {
    accessKeyId: creds.accessKeyId,
    secretAccessKey: creds.secretAccessKey,
    sessionToken: creds.sessionToken || '',
    expiration: creds.expiration ? new Date(creds.expiration) : undefined,
  };

  return cachedCredentials;
}

/** AOSS コレクションエンドポイントを取得 */
async function getCollectionEndpoint(region: string, collectionName: string): Promise<string> {
  const { OpenSearchServerlessClient, BatchGetCollectionCommand } =
    await import('@aws-sdk/client-opensearchserverless') as any;

  const client = new OpenSearchServerlessClient({ region });
  const resp = await client.send(new BatchGetCollectionCommand({
    names: [collectionName],
  }));

  const collections = resp.collectionDetails || [];
  if (collections.length === 0) {
    throw new Error(`コレクション '${collectionName}' が見つかりません`);
  }

  return collections[0].collectionEndpoint!;
}

/** クライアント初期化 */
export async function initOssClient(region: string, collectionName: string): Promise<void> {
  awsRegion = region;
  collectionEndpoint = await getCollectionEndpoint(region, collectionName);
  console.log(`✅ OpenSearch Serverless エンドポイント: ${collectionEndpoint}`);
}

/** SigV4署名ヘルパー */
function hmac(key: Buffer | string, data: string): Buffer {
  return crypto.createHmac('sha256', key).update(data).digest();
}

function sha256(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function getSignatureKey(key: string, dateStamp: string, region: string, service: string): Buffer {
  return hmac(hmac(hmac(hmac('AWS4' + key, dateStamp), region), service), 'aws4_request');
}

/** SigV4署名付きHTTPリクエスト */
async function signedRequest(
  method: string,
  endpoint: string,
  reqPath: string,
  body: any,
  region: string,
): Promise<{ statusCode: number; body: string }> {
  // SDK credential providerから認証情報を取得（IMDS対応）
  const creds = await resolveCredentials();

  const u = new URL(endpoint + reqPath);
  const host = u.hostname;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const dateStamp = amzDate.substring(0, 8);
  const bodyStr = body ? JSON.stringify(body) : '';
  const payloadHash = sha256(bodyStr);

  const hdrs: [string, string][] = [
    ['content-type', 'application/json'],
    ['host', host],
    ['x-amz-content-sha256', payloadHash],
    ['x-amz-date', amzDate],
  ];
  if (creds.sessionToken) hdrs.push(['x-amz-security-token', creds.sessionToken]);
  hdrs.sort((a, b) => a[0].localeCompare(b[0]));

  const canonicalHeaders = hdrs.map(h => h[0] + ':' + h[1] + '\n').join('');
  const signedHeaders = hdrs.map(h => h[0]).join(';');
  const canonicalRequest = [method, reqPath, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const scope = `${dateStamp}/${region}/aoss/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${sha256(canonicalRequest)}`;
  const sigKey = getSignatureKey(creds.secretAccessKey, dateStamp, region, 'aoss');
  const signature = crypto.createHmac('sha256', sigKey).update(stringToSign).digest('hex');

  const headers: Record<string, string> = {};
  hdrs.forEach(h => { headers[h[0]] = h[1]; });
  headers['Authorization'] = `AWS4-HMAC-SHA256 Credential=${creds.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return new Promise((resolve, reject) => {
    const req = https.request({ hostname: host, port: 443, path: reqPath, method, headers }, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => resolve({ statusCode: res.statusCode || 0, body: data }));
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

/** ドキュメントをインデックス */
export async function indexDocument(
  indexName: string,
  _docId: string,
  document: Record<string, any>,
): Promise<void> {
  // OpenSearch Serverless does NOT support document IDs in PUT requests.
  // Use POST /_doc (auto-generated ID) instead.
  const reqPath = `/${indexName}/_doc`;
  const resp = await signedRequest('POST', collectionEndpoint, reqPath, document, awsRegion);

  if (resp.statusCode >= 200 && resp.statusCode < 300) {
    // success
  } else {
    throw new Error(`OSS index failed (${resp.statusCode}): ${resp.body}`);
  }
}
