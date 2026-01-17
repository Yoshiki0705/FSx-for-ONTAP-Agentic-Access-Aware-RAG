# AgentCore Browser Lambda Function

Amazon Bedrock AgentCore Browser機能のLambda関数実装です。

## 機能

- **Headless Chrome統合**: Puppeteer + @sparticuz/chromium
- **スクリーンショット撮影**: PNG/JPEG/WebP形式
- **Webスクレイピング**: Cheerioによる HTML解析
- **ブラウザ自動化**: クリック、入力、待機、スクロール
- **FSx for ONTAP統合**: S3 Access Points経由での透過的アクセス

## FSx for ONTAP S3 Access Points連携

### 概要

Lambda関数は、S3 APIを使用してFSx for ONTAPに透過的にアクセスできます。FSx for ONTAP S3 Access Point ARNが設定されている場合、通常のS3バケットの代わりにFSx for ONTAPが使用されます。

### 設定方法

#### 1. CDK Constructで設定

```typescript
import { BedrockAgentCoreBrowserConstruct } from './lib/modules/ai/constructs/bedrock-agent-core-browser-construct';

const browser = new BedrockAgentCoreBrowserConstruct(this, 'Browser', {
  enabled: true,
  projectName: 'my-project',
  environment: 'prod',
  
  // FSx for ONTAP S3 Access Point ARNを指定
  fsxS3AccessPointArn: 'arn:aws:s3:ap-northeast-1:123456789012:accesspoint/my-fsx-access-point',
  
  // 通常のS3バケットは不要（FSx for ONTAPを使用する場合）
  // screenshotBucket: undefined,
});
```

#### 2. 環境変数

Lambda関数は以下の環境変数を使用します：

- `FSX_S3_ACCESS_POINT_ARN`: FSx for ONTAP S3 Access Point ARN
- `SCREENSHOT_BUCKET`: 通常のS3バケット名（FSx未使用時）

### 動作

1. **FSx for ONTAP S3 Access Point ARNが設定されている場合**:
   - S3 APIを使用してFSx for ONTAPに透過的にアクセス
   - `PutObjectCommand`のBucketパラメータにAccess Point ARNを指定
   - FSx for ONTAPの高性能ストレージを活用

2. **FSx for ONTAP S3 Access Point ARNが未設定の場合**:
   - 通常のS3バケットを使用
   - 既存の動作を維持

### コード例

```typescript
// ストレージ設定を取得
const storageConfig = getStorageConfig(env);

if (storageConfig.useFsxAccessPoint) {
  // FSx for ONTAP S3 Access Point経由でアップロード
  await s3Client.send(
    new PutObjectCommand({
      Bucket: env.FSX_S3_ACCESS_POINT_ARN, // Access Point ARNを直接使用
      Key: key,
      Body: screenshot,
      ContentType: `image/${env.SCREENSHOT_FORMAT}`,
    })
  );
} else {
  // 通常のS3バケットにアップロード
  await s3Client.send(
    new PutObjectCommand({
      Bucket: storageConfig.bucket,
      Key: key,
      Body: screenshot,
      ContentType: `image/${env.SCREENSHOT_FORMAT}`,
    })
  );
}
```

### IAM権限

FSx for ONTAP S3 Access Pointsを使用する場合、Lambda実行ロールに以下の権限が必要です：

```json
{
  "Effect": "Allow",
  "Action": [
    "s3:GetObject",
    "s3:PutObject",
    "s3:DeleteObject",
    "s3:ListBucket"
  ],
  "Resource": [
    "arn:aws:s3:ap-northeast-1:123456789012:accesspoint/my-fsx-access-point",
    "arn:aws:s3:ap-northeast-1:123456789012:accesspoint/my-fsx-access-point/*"
  ]
}
```

これらの権限は、CDK Constructが自動的に設定します。

### サポートされるS3 API操作

FSx for ONTAP S3 Access Pointsを介して、以下の全てのS3 API操作が可能です：

| 操作 | S3 API | 説明 |
|------|--------|------|
| **書き込み** | `PutObject` | スクリーンショット、PDFなどのアップロード |
| **読み込み** | `GetObject` | 保存済みファイルの取得・ダウンロード |
| **削除** | `DeleteObject` | 不要なファイルの削除 |
| **一覧取得** | `ListObjectsV2` | バケット内のファイル一覧取得 |
| **メタデータ取得** | `HeadObject` | ファイルのメタデータ取得 |
| **コピー** | `CopyObject` | ファイルのコピー |

**重要**: S3 APIは透過的にFSx for ONTAPにアクセスするため、Lambda関数のコードは通常のS3操作と全く同じです。

## API仕様

### リクエスト

```typescript
interface BrowserRequest {
  url: string;
  action: 'SCREENSHOT' | 'SCRAPE' | 'AUTOMATE';
  options?: {
    viewport?: { width: number; height: number };
    waitFor?: string;
    timeout?: number;
  };
  automation?: {
    steps: AutomationStep[];
  };
}
```

### レスポンス

```typescript
interface BrowserResponse {
  requestId: string;
  status: 'SUCCESS' | 'FAILED';
  result?: {
    screenshot?: string; // S3 URL or FSx S3 Access Point URL
    html?: string;
    data?: Record<string, any>;
  };
  error?: {
    code: string;
    message: string;
  };
  metrics: {
    latency: number;
    pageLoadTime: number;
  };
}
```

### 使用例

#### スクリーンショット撮影（FSx for ONTAP S3 Access Points経由）

```json
{
  "url": "https://example.com",
  "action": "SCREENSHOT",
  "options": {
    "viewport": { "width": 1920, "height": 1080 },
    "timeout": 30000
  }
}
```

**レスポンス例**:
```json
{
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "SUCCESS",
  "result": {
    "screenshot": "s3://arn:aws:s3:ap-northeast-1:123456789012:accesspoint/my-fsx-access-point/screenshots/550e8400-e29b-41d4-a716-446655440000.png"
  },
  "metrics": {
    "latency": 3500,
    "pageLoadTime": 2800
  }
}
```

#### スクリーンショット取得（FSx for ONTAP S3 Access Points経由）

保存されたスクリーンショットを取得する場合も、S3 APIを使用します：

```typescript
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({});

// FSx for ONTAP S3 Access Point経由で取得
const response = await s3Client.send(
  new GetObjectCommand({
    Bucket: 'arn:aws:s3:ap-northeast-1:123456789012:accesspoint/my-fsx-access-point',
    Key: 'screenshots/550e8400-e29b-41d4-a716-446655440000.png',
  })
);

// ファイルデータを取得
const imageData = await response.Body.transformToByteArray();
```

#### ファイル一覧取得（FSx for ONTAP S3 Access Points経由）

```typescript
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';

const s3Client = new S3Client({});

// FSx for ONTAP S3 Access Point経由で一覧取得
const response = await s3Client.send(
  new ListObjectsV2Command({
    Bucket: 'arn:aws:s3:ap-northeast-1:123456789012:accesspoint/my-fsx-access-point',
    Prefix: 'screenshots/',
  })
);

// ファイル一覧を取得
const files = response.Contents?.map(obj => obj.Key) || [];
```

#### ファイル削除（FSx for ONTAP S3 Access Points経由）

```typescript
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({});

// FSx for ONTAP S3 Access Point経由で削除
await s3Client.send(
  new DeleteObjectCommand({
    Bucket: 'arn:aws:s3:ap-northeast-1:123456789012:accesspoint/my-fsx-access-point',
    Key: 'screenshots/550e8400-e29b-41d4-a716-446655440000.png',
  })
);
```

### Webスクレイピング

```json
{
  "url": "https://example.com",
  "action": "SCRAPE",
  "options": {
    "timeout": 30000
  }
}
```

### ブラウザ自動化

```json
{
  "url": "https://example.com",
  "action": "AUTOMATE",
  "automation": {
    "steps": [
      { "type": "CLICK", "selector": "#button" },
      { "type": "TYPE", "selector": "#input", "value": "test" },
      { "type": "WAIT", "selector": "#result", "timeout": 5000 }
    ]
  }
}
```

## 開発

### ビルド

```bash
npm run build
```

### テスト

```bash
npm test
```

## 依存関係

- `@aws-sdk/client-s3`: S3クライアント（FSx for ONTAP S3 Access Points対応）
- `@sparticuz/chromium`: Lambda用Chromiumバイナリ
- `puppeteer-core`: Headless Chromeコントロール
- `cheerio`: HTML解析

## 注意事項

1. **メモリ**: 最低2048 MB推奨
2. **タイムアウト**: 最低300秒推奨
3. **Ephemeral Storage**: 最低2048 MB推奨
4. **FSx for ONTAP S3 Access Points**: 
   - 全てのS3 API操作（Get, Put, Delete, List等）が透過的に使用可能
   - Lambda関数のコードは通常のS3操作と全く同じ
   - Access Point ARNをBucketパラメータに指定するだけ
5. **パフォーマンス**: 
   - FSx for ONTAPは高性能ストレージのため、大容量ファイルに最適
   - 読み込み・書き込み共に高速
   - 複数の同時アクセスにも対応

## FSx for ONTAP S3 Access Pointsの利点

1. **透過的アクセス**: S3 APIで透過的にアクセス可能
2. **高性能**: FSx for ONTAPの高性能ストレージを活用
3. **スケーラビリティ**: 大容量ファイルにも対応
4. **互換性**: 既存のS3クライアントコードをそのまま使用
5. **柔軟性**: 環境変数による柔軟な設定（FSx/S3の切り替え）
6. **全API対応**: Get, Put, Delete, List等、全てのS3 API操作が可能

## ライセンス

MIT
