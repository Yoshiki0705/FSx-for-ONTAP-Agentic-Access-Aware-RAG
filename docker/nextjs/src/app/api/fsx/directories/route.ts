import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import { unmarshall } from '@aws-sdk/util-dynamodb';

/**
 * ユーザーディレクトリ権限API
 * 
 * 2種類のディレクトリ情報を返す:
 * 1. FSxアクセス可能ディレクトリ: SIDに基づくファイルレベルのアクセス権
 * 2. RAGアクセス可能ディレクトリ: KBデータソース内でSIDマッチするドキュメントのディレクトリ
 */

const region = process.env.AWS_REGION || process.env.BEDROCK_REGION || 'ap-northeast-1';
const dynamoClient = new DynamoDBClient({ region });
const s3Client = new S3Client({ region });

// SIDとディレクトリのマッピング（FSxボリューム上のNTFS ACL）
const SID_DIRECTORY_MAP: Record<string, string[]> = {
  'S-1-1-0': ['public/'],
  'S-1-5-21-0000000000-0000000000-0000000000-512': ['confidential/', 'restricted/'],
  'S-1-5-21-0000000000-0000000000-0000000000-1100': ['restricted/'],
};

async function getUserSIDs(username: string): Promise<{ userSID: string; groupSIDs: string[] } | null> {
  const tableName = process.env.USER_ACCESS_TABLE_NAME;
  if (!tableName) return null;
  try {
    const result = await dynamoClient.send(new GetItemCommand({
      TableName: tableName, Key: { userId: { S: username } },
    }));
    if (!result.Item) return null;
    const item = unmarshall(result.Item);
    return { userSID: item.userSID || '', groupSIDs: item.groupSIDs || [] };
  } catch { return null; }
}

/** S3バケットの.metadata.jsonからRAGアクセス可能ディレクトリを計算 */
async function getRagAccessibleDirs(allUserSIDs: string[]): Promise<{ ragDirs: string[]; embeddedDirs: string[] }> {
  const bucketName = process.env.DATA_BUCKET_NAME || '';
  if (!bucketName || allUserSIDs.length === 0) return { ragDirs: [], embeddedDirs: [] };

  try {
    // S3バケット内の.metadata.jsonファイルを列挙
    const listResp = await s3Client.send(new ListObjectsV2Command({
      Bucket: bucketName, Suffix: '.metadata.json',
    }));

    // Suffixフィルタが効かない場合があるので手動フィルタ
    const metadataKeys = (listResp.Contents || [])
      .map(obj => obj.Key || '')
      .filter(key => key.endsWith('.metadata.json'));

    const embeddedDirSet = new Set<string>();
    const ragDirSet = new Set<string>();

    for (const key of metadataKeys) {
      const dir = key.split('/').slice(0, -1).join('/');
      if (dir) embeddedDirSet.add(dir + '/');

      try {
        const getResp = await s3Client.send(new GetObjectCommand({ Bucket: bucketName, Key: key }));
        const body = await getResp.Body?.transformToString();
        if (!body) continue;
        const meta = JSON.parse(body);
        const allowedSIDs: string[] = meta?.metadataAttributes?.allowed_group_sids || [];
        if (allowedSIDs.some(sid => allUserSIDs.includes(sid))) {
          if (dir) ragDirSet.add(dir + '/');
        }
      } catch { /* skip unreadable metadata */ }
    }

    return {
      ragDirs: Array.from(ragDirSet).sort(),
      embeddedDirs: Array.from(embeddedDirSet).sort(),
    };
  } catch (err) {
    console.warn('[FSx Directories] S3 metadata scan error:', err);
    return { ragDirs: [], embeddedDirs: [] };
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');
    if (!username) {
      return NextResponse.json({ success: false, error: 'Username required' }, { status: 400 });
    }

    // DynamoDB SID取得
    const sidData = await getUserSIDs(username);
    const allUserSIDs: string[] = [];
    if (sidData) {
      if (sidData.userSID) allUserSIDs.push(sidData.userSID);
      allUserSIDs.push(...sidData.groupSIDs);
    }

    // FSxアクセス可能ディレクトリ（SIDマッピング）
    const fsxDirSet = new Set<string>();
    for (const sid of allUserSIDs) {
      const dirs = SID_DIRECTORY_MAP[sid];
      if (dirs) dirs.forEach(d => fsxDirSet.add(d));
    }
    const fsxDirs = Array.from(fsxDirSet).sort();

    // RAGアクセス可能ディレクトリ（S3メタデータスキャン）
    const { ragDirs, embeddedDirs } = await getRagAccessibleDirs(allUserSIDs);

    return NextResponse.json({
      success: true,
      data: {
        username,
        directoryType: allUserSIDs.length > 0 ? 'sid-based' : 'no-sid',
        // FSxファイルアクセス権
        accessibleDirectories: fsxDirs,
        // RAG検索でアクセス可能なディレクトリ
        ragAccessibleDirectories: ragDirs,
        // Embedding対象の全ディレクトリ
        embeddedDirectories: embeddedDirs,
        permissions: {
          read: true,
          write: allUserSIDs.includes('S-1-5-21-0000000000-0000000000-0000000000-512'),
          execute: true,
        },
        fsxFileSystemId: process.env.FSX_FILE_SYSTEM_ID || null,
        lastUpdated: new Date().toISOString(),
        note: allUserSIDs.length > 0
          ? 'SIDベースのアクセス権限に基づくディレクトリ一覧です'
          : 'SIDデータが未登録のため、アクセス可能なディレクトリがありません',
      },
    });
  } catch (error) {
    console.error('[FSx Directories] Error:', error);
    return NextResponse.json({
      success: false, error: 'Failed to fetch directory information',
      data: {
        username: 'unknown', directoryType: 'error',
        accessibleDirectories: [], ragAccessibleDirectories: [], embeddedDirectories: [],
        permissions: { read: false, write: false, execute: false },
        fsxFileSystemId: null, lastUpdated: new Date().toISOString(),
      },
    }, { status: 500 });
  }
}
