# セキュリティガイド

## セキュリティレベル設定

### 厳密モード（strict）- 本番環境推奨

```bash
# 環境変数で設定
export SECURITY_LEVEL=strict
./run-mcp-integrated-load-test.sh

# または直接指定
SECURITY_LEVEL=strict ./run-mcp-integrated-load-test.sh
```

**特徴**:
- 出力ディレクトリがプロジェクトルート外の場合、実行を停止
- パストラバーサル攻撃を防止
- 意図しないファイル書き込みを防止
- 本番環境での使用を強く推奨

### 緩和モード（relaxed）- 開発環境のみ

```bash
# 開発環境でのみ使用
SECURITY_LEVEL=relaxed ./run-mcp-integrated-load-test.sh
```

**特徴**:
- セキュリティチェックを緩和
- 開発時の利便性を優先
- **本番環境での使用は禁止**
- 警告メッセージが表示される

## セキュリティベストプラクティス

### 1. 環境別設定

```bash
# 本番環境
export SECURITY_LEVEL=strict
export MCP_ENABLED=true
export MAX_TOTAL_COST=100.00

# 開発環境
export SECURITY_LEVEL=relaxed
export DEBUG_MODE=true
export MAX_TOTAL_COST=10.00
```

### 2. 出力ディレクトリの安全な指定

```bash
# ✅ 安全な例
./run-mcp-integrated-load-test.sh -o ./reports/test-$(date +%Y%m%d)

# ❌ 危険な例
./run-mcp-integrated-load-test.sh -o /tmp/../../../etc/
./run-mcp-integrated-load-test.sh -o ~/../../sensitive-data/
```

### 3. 機密情報の保護

```bash
# 機密変数の自動クリア
unset AWS_ACCESS_KEY_ID
unset AWS_SECRET_ACCESS_KEY
unset AWS_SESSION_TOKEN

# ファイルパーミッションの設定
chmod 600 config/mcp-load-test.conf
chmod 700 reports/
```

## 脅威モデル

### 対策済み脅威

1. **パストラバーサル攻撃**
   - 出力ディレクトリの厳密な検証
   - プロジェクトルート外への書き込み防止

2. **機密情報漏洩**
   - 機密変数の自動クリア
   - セキュアなファイルパーミッション

3. **コスト爆発**
   - 最大コスト制限の強制
   - リアルタイムコスト監視

### 残存リスク

1. **AWS認証情報の不正使用**
   - 対策: IAM権限の最小化
   - 対策: MFA の強制有効化

2. **ネットワーク盗聴**
   - 対策: HTTPS通信の強制
   - 対策: VPC内通信の暗号化

## インシデント対応

### セキュリティ違反検出時

1. **即座の停止**
   ```bash
   # プロセスの強制終了
   pkill -f "run-mcp-integrated-load-test"
   ```

2. **証拠保全**
   ```bash
   # ログの保存
   cp /tmp/mcp_cost_cache_* ./security-incident/
   cp reports/mcp-integrated-test-*/error-report-*.log ./security-incident/
   ```

3. **影響範囲の調査**
   ```bash
   # 不正なファイル作成の確認
   find . -newer /tmp/incident_start_time -type f
   ```

## 監査ログ

### ログ出力項目

- セキュリティレベル設定
- 出力ディレクトリ検証結果
- コスト制限チェック結果
- 機密変数クリア実行記録

### ログ保存場所

```
reports/mcp-integrated-test-YYYYMMDD-HHMMSS/
├── security-audit.log          # セキュリティ監査ログ
├── cost-tracking.log           # コスト追跡ログ
└── error-report-*.log          # エラーレポート
```

## コンプライアンス

### 対応規格

- **ISO 27001**: 情報セキュリティ管理
- **SOC 2**: セキュリティ・可用性・機密性
- **GDPR**: データ保護規則（EU）
- **個人情報保護法**: 日本の個人情報保護

### 定期監査

- **月次**: セキュリティ設定の確認
- **四半期**: 脅威モデルの見直し
- **年次**: 包括的セキュリティ監査