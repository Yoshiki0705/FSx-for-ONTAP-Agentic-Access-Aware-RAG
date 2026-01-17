# 統合テスト

このディレクトリには、CDKデプロイ後の統合テストが含まれています。

## Bedrock Agent CDKリソーステスト

**ファイル**: `bedrock-agent-cdk-resources.test.ts`

**目的**: CDKデプロイ後にBedrock Agent関連リソースが正しく作成されていることを確認

### 前提条件

1. **CDKデプロイ完了**: WebAppStackがデプロイされていること
2. **AWS認証情報**: テスト実行に必要なIAM権限
   - `bedrock-agent:GetAgent`
   - `bedrock-agent:GetAgentAlias`
   - `iam:GetRole`
   - `cloudformation:DescribeStacks`

### テスト実行方法

```bash
# 環境変数を設定
export AWS_REGION=ap-northeast-1
export STACK_NAME=WebAppStack

# テストを実行
npm test -- tests/integration/bedrock-agent-cdk-resources.test.ts
```

### テスト内容

1. **Bedrock Agent存在確認**
   - Agent IDが取得できること
   - Agentのステータスが有効であること
   - Foundation Modelが設定されていること
   - Service Roleが設定されていること
   - Instructionが設定されていること
   - Idle Session TTLが600秒であること

2. **Agent Alias存在確認**
   - Agent Alias IDが取得できること
   - Agent Alias名が`dev-alias`であること
   - Agent IDが一致すること

3. **Service Role存在確認**
   - Service Role ARNが取得できること
   - Roleが存在すること
   - Trust Policyに`bedrock.amazonaws.com`が含まれていること

4. **CloudFormation Outputs確認**
   - 必要なOutputsが全て設定されていること
   - Outputsの値が空でないこと

### トラブルシューティング

#### テストが失敗する場合

1. **CloudFormation Stackが見つからない**
   - `STACK_NAME`環境変数が正しいか確認
   - CloudFormationコンソールでスタックの存在を確認

2. **Agentが見つからない**
   - CDKデプロイが完了しているか確認
   - Agent Prepareが実行されているか確認

3. **権限エラー**
   - AWS認証情報が正しいか確認
   - IAM権限が付与されているか確認

### 期待される結果

全てのテストが成功すると、以下のような出力が表示されます：

```
 PASS  tests/integration/bedrock-agent-cdk-resources.test.ts
  Bedrock Agent CDKリソース作成プロパティテスト
    ✓ Property 1: Bedrock Agentが存在すること (1234ms)
    ✓ Property 1: Agent Aliasが存在すること (567ms)
    ✓ Property 1: Agent Service Roleが存在すること (890ms)
    ✓ Property 1: CloudFormation Outputsが全て設定されていること (456ms)

Test Suites: 1 passed, 1 total
Tests:       4 passed, 4 total
```

---

**作成日**: 2025-11-29
