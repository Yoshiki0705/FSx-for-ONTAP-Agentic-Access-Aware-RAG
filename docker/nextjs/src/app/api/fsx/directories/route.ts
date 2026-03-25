import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';

/**
 * ユーザーディレクトリ権限API
 * DynamoDB user-accessテーブルのSID情報に基づいて、アクセス可能なディレクトリを返す
 */

const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || process.env.BEDROCK_REGION || 'ap-northeast-1',
});

// SIDとディレクトリのマッピング（.metadata.jsonのallowed_group_sidsに対応）
const SID_DIRECTORY_MAP: Record<string, string[]> = {
  'S-1-1-0': ['public/'],                                                    // Everyone
  'S-1-5-21-0000000000-0000000000-0000000000-512': ['confidential/', 'restricted/'], // Domain Admins
  'S-1-5-21-0000000000-0000000000-0000000000-1100': ['restricted/'],         // Engineering
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');

    if (!username) {
      return NextResponse.json({ success: false, error: 'Username required' }, { status: 400 });
    }

    // DynamoDB user-accessテーブルからSID情報を取得
    const tableName = process.env.USER_ACCESS_TABLE_NAME;
    let accessibleDirs: string[] = [];
    let userSID = '';
    let groupSIDs: string[] = [];
    let directoryType = 'sid-based';

    if (tableName) {
      try {
        const result = await dynamoClient.send(new GetItemCommand({
          TableName: tableName,
          Key: { userId: { S: username } },
        }));
        if (result.Item) {
          const item = unmarshall(result.Item);
          userSID = item.userSID || '';
          groupSIDs = item.groupSIDs || [];

          // SIDに基づいてアクセス可能ディレクトリを計算
          const allSIDs = [userSID, ...groupSIDs].filter(Boolean);
          const dirSet = new Set<string>();
          for (const sid of allSIDs) {
            const dirs = SID_DIRECTORY_MAP[sid];
            if (dirs) dirs.forEach(d => dirSet.add(d));
          }
          accessibleDirs = Array.from(dirSet).sort();
        }
      } catch (err) {
        console.warn('[FSx Directories] DynamoDB error:', err);
        directoryType = 'fallback';
      }
    } else {
      directoryType = 'no-table';
    }

    // SIDデータがない場合のフォールバック
    if (accessibleDirs.length === 0 && directoryType !== 'sid-based') {
      accessibleDirs = ['public/'];
    }

    return NextResponse.json({
      success: true,
      data: {
        username,
        directoryType,
        accessibleDirectories: accessibleDirs,
        permissions: {
          read: true,
          write: groupSIDs.includes('S-1-5-21-0000000000-0000000000-0000000000-512'),
          execute: true,
        },
        fsxFileSystemId: process.env.FSX_FILE_SYSTEM_ID || null,
        lastUpdated: new Date().toISOString(),
        note: accessibleDirs.length > 0
          ? 'SIDベースのアクセス権限に基づくディレクトリ一覧です'
          : 'SIDデータが未登録のため、アクセス可能なディレクトリがありません',
      },
    });
  } catch (error) {
    console.error('[FSx Directories] Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch directory information',
      data: {
        username: 'unknown',
        directoryType: 'error',
        accessibleDirectories: [],
        permissions: { read: false, write: false, execute: false },
        fsxFileSystemId: null,
        lastUpdated: new Date().toISOString(),
      },
    }, { status: 500 });
  }
}
