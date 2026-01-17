# Amazon Bedrock AgentCore Code Interpreter Lambda Function

Pythonコードを安全なサンドボックス環境で実行する機能を提供するLambda関数です。

## 主要機能

### 1. セッション管理
- **セッション開始**: 新しいコード実行セッションを開始
- **セッション停止**: 既存のセッションを終了
- **セッションタイムアウト**: 一定時間アクセスがないセッションを自動削除

### 2. コード実行
- **Python実行**: Pythonコードをサンドボックス環境で実行
- **タイムアウト制御**: 実行時間制限を設定
- **出力キャプチャ**: 標準出力・標準エラーを取得

### 3. ファイル操作
- **ファイル書き込み**: セッション内でファイルを作成
- **ファイル読み込み**: セッション内のファイルを読み込み
- **ファイル削除**: セッション内のファイルを削除
- **ファイル一覧**: セッション内の全ファイルを一覧表示

### 4. ターミナルコマンド実行
- **コマンド実行**: シェルコマンドを実行
- **ネットワークアクセス制御**: ネットワークアクセスの許可/拒否

### 5. パッケージ管理
- **パッケージインストール**: pip/npmパッケージをインストール
- **バージョン管理**: 特定バージョンのパッケージをインストール
- **ホワイトリスト方式**: 許可されたパッケージのみインストール可能
- **インストール済みパッケージ一覧**: セッション内のパッケージを一覧表示

### 6. FSx for ONTAP統合
- **S3 Access Point経由**: FSx for ONTAPにファイルを保存
- **透過的アクセス**: S3 APIを使用してFSx for ONTAPにアクセス

## API仕様

### 1. セッション開始

**リクエスト**:
```json
{
  "action": "START_SESSION"
}
```

**レスポンス**:
```json
{
  "requestId": "uuid",
  "sessionId": "session-uuid",
  "status": "SUCCESS",
  "result": {
    "output": "Session session-uuid started successfully"
  },
  "metrics": {
    "latency": 100
  }
}
```

### 2. セッション停止

**リクエスト**:
```json
{
  "action": "STOP_SESSION",
  "sessionId": "session-uuid"
}
```

**レスポンス**:
```json
{
  "requestId": "uuid",
  "sessionId": "session-uuid",
  "status": "SUCCESS",
  "result": {
    "output": "Session session-uuid stopped successfully"
  },
  "metrics": {
    "latency": 50
  }
}
```

### 3. コード実行

**リクエスト**:
```json
{
  "action": "EXECUTE_CODE",
  "sessionId": "session-uuid",
  "code": "print('Hello, World!')",
  "language": "python",
  "options": {
    "timeout": 60,
    "captureOutput": true
  }
}
```

**レスポンス**:
```json
{
  "requestId": "uuid",
  "sessionId": "session-uuid",
  "status": "SUCCESS",
  "result": {
    "output": "Hello, World!\n"
  },
  "metrics": {
    "latency": 500,
    "executionTime": 450
  }
}
```

### 4. ファイル書き込み

**リクエスト**:
```json
{
  "action": "WRITE_FILE",
  "sessionId": "session-uuid",
  "filePath": "data.txt",
  "fileContent": "Hello, World!"
}
```

**レスポンス**:
```json
{
  "requestId": "uuid",
  "sessionId": "session-uuid",
  "status": "SUCCESS",
  "result": {
    "output": "File data.txt written successfully"
  },
  "metrics": {
    "latency": 200
  }
}
```

### 5. ファイル読み込み

**リクエスト**:
```json
{
  "action": "READ_FILE",
  "sessionId": "session-uuid",
  "filePath": "data.txt"
}
```

**レスポンス**:
```json
{
  "requestId": "uuid",
  "sessionId": "session-uuid",
  "status": "SUCCESS",
  "result": {
    "fileContent": "Hello, World!"
  },
  "metrics": {
    "latency": 150
  }
}
```

### 6. ファイル削除

**リクエスト**:
```json
{
  "action": "DELETE_FILE",
  "sessionId": "session-uuid",
  "filePath": "data.txt"
}
```

**レスポンス**:
```json
{
  "requestId": "uuid",
  "sessionId": "session-uuid",
  "status": "SUCCESS",
  "result": {
    "output": "File data.txt deleted successfully"
  },
  "metrics": {
    "latency": 100
  }
}
```

### 7. ファイル一覧

**リクエスト**:
```json
{
  "action": "LIST_FILES",
  "sessionId": "session-uuid"
}
```

**レスポンス**:
```json
{
  "requestId": "uuid",
  "sessionId": "session-uuid",
  "status": "SUCCESS",
  "result": {
    "files": ["data.txt", "output.csv", "plot.png"]
  },
  "metrics": {
    "latency": 120
  }
}
```

### 8. ターミナルコマンド実行

**リクエスト**:
```json
{
  "action": "EXECUTE_COMMAND",
  "sessionId": "session-uuid",
  "command": "ls -la",
  "options": {
    "timeout": 30,
    "captureOutput": true
  }
}
```

**レスポンス**:
```json
{
  "requestId": "uuid",
  "sessionId": "session-uuid",
  "status": "SUCCESS",
  "result": {
    "output": "total 12\ndrwxr-xr-x 2 root root 4096 Jan  4 12:00 .\n..."
  },
  "metrics": {
    "latency": 300
  }
}
```

### 9. パッケージインストール

**リクエスト**:
```json
{
  "action": "INSTALL_PACKAGE",
  "sessionId": "session-uuid",
  "packageName": "numpy",
  "packageVersion": "1.24.0",
  "language": "python"
}
```

**レスポンス**:
```json
{
  "requestId": "uuid",
  "sessionId": "session-uuid",
  "status": "SUCCESS",
  "result": {
    "output": "Successfully installed numpy==1.24.0"
  },
  "metrics": {
    "latency": 5000,
    "executionTime": 4800
  }
}
```

### 10. インストール済みパッケージ一覧

**リクエスト**:
```json
{
  "action": "LIST_PACKAGES",
  "sessionId": "session-uuid"
}
```

**レスポンス**:
```json
{
  "requestId": "uuid",
  "sessionId": "session-uuid",
  "status": "SUCCESS",
  "result": {
    "files": ["numpy==1.24.0", "pandas==2.0.0"],
    "output": "Installed packages:\nnumpy==1.24.0\npandas==2.0.0"
  },
  "metrics": {
    "latency": 50
  }
}
```

## 環境変数

| 変数名 | 説明 | デフォルト値 |
|--------|------|-------------|
| `PROJECT_NAME` | プロジェクト名 | - |
| `ENVIRONMENT` | 環境名（prod, dev等） | - |
| `FSX_S3_ACCESS_POINT_ARN` | FSx for ONTAP S3 Access Point ARN | - |
| `EXECUTION_TIMEOUT` | コード実行タイムアウト（秒） | 60 |
| `MEMORY_LIMIT` | メモリ制限（MB） | 512 |
| `ALLOWED_PACKAGES` | 許可されるPythonパッケージ（JSON配列） | ["numpy", "pandas", "matplotlib", "scipy"] |
| `ALLOW_NETWORK_ACCESS` | ネットワークアクセス許可 | false |
| `SESSION_TIMEOUT` | セッションタイムアウト（秒） | 3600 |
| `MAX_CONCURRENT_SESSIONS` | 最大同時セッション数 | 10 |

## セキュリティ

### サンドボックス環境
- **リソース制限**: メモリ・CPU・実行時間を制限
- **ネットワーク隔離**: デフォルトでネットワークアクセスを拒否
- **ファイルシステム隔離**: セッションごとに独立した作業ディレクトリ

### パッケージ管理
- **ホワイトリスト方式**: 許可されたパッケージのみインストール可能
- **バージョン固定**: セキュリティリスクを最小化

### データ保護
- **KMS暗号化**: 環境変数とファイルをKMSで暗号化
- **FSx for ONTAP統合**: エンタープライズグレードのストレージ

## 使用例

### Python データ分析

```typescript
// 1. セッション開始
const startResponse = await lambda.invoke({
  FunctionName: 'code-interpreter-function',
  Payload: JSON.stringify({
    action: 'START_SESSION'
  })
});

const { sessionId } = JSON.parse(startResponse.Payload);

// 2. データファイル書き込み
await lambda.invoke({
  FunctionName: 'code-interpreter-function',
  Payload: JSON.stringify({
    action: 'WRITE_FILE',
    sessionId,
    filePath: 'data.csv',
    fileContent: 'name,age\nAlice,30\nBob,25'
  })
});

// 3. Pythonコード実行
await lambda.invoke({
  FunctionName: 'code-interpreter-function',
  Payload: JSON.stringify({
    action: 'EXECUTE_CODE',
    sessionId,
    code: `
import pandas as pd
df = pd.read_csv('data.csv')
print(df.describe())
    `,
    language: 'python'
  })
});

// 4. パッケージインストール
await lambda.invoke({
  FunctionName: 'code-interpreter-function',
  Payload: JSON.stringify({
    action: 'INSTALL_PACKAGE',
    sessionId,
    packageName: 'matplotlib',
    packageVersion: '3.7.0',
    language: 'python'
  })
});

// 5. セッション停止
await lambda.invoke({
  FunctionName: 'code-interpreter-function',
  Payload: JSON.stringify({
    action: 'STOP_SESSION',
    sessionId
  })
});
```

## ビルド・デプロイ

### ローカルビルド

```bash
cd lambda/agent-core-code-interpreter
npm install
npm run build
```

### テスト実行

```bash
npm test
```

### CDKデプロイ

```bash
cd ../../
npx cdk deploy
```

## トラブルシューティング

### セッションタイムアウト
- `SESSION_TIMEOUT`環境変数を調整
- 長時間実行する場合は、定期的にセッションにアクセス

### メモリ不足
- `MEMORY_LIMIT`環境変数を増やす
- Lambda関数のメモリサイズを増やす

### ネットワークアクセスエラー
- `ALLOW_NETWORK_ACCESS`を`true`に設定
- VPC設定を確認

## ライセンス

MIT License
