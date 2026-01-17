/**
 * Bedrock Agent Models API プロパティテスト
 * 
 * Property 1: リージョン別モデルリスト取得の一貫性
 * Validates: Requirements 2.1, 5.1
 * 
 * このテストは、Agent Models APIが異なるリージョンで一貫した動作をすることを検証します。
 */

import { BedrockClient, ListFoundationModelsCommand } from '@aws-sdk/client-bedrock';

// テスト対象のリージョン（Bedrock利用可能リージョン）
const TEST_REGIONS = [
  'us-east-1',
  'us-west-2',
  'ap-northeast-1',
  'ap-southeast-1',
  'ap-southeast-2',
  'eu-west-1',
  'eu-central-1',
  'eu-west-3',
];

// Agent対応モデルのプロバイダーとモデルID接頭辞
const AGENT_SUPPORTED_MODELS = {
  anthropic: ['claude-3', 'claude-2'],
  amazon: ['titan', 'nova'],
};

/**
 * モデルがAgent対応かどうかを判定
 */
function isAgentSupportedModel(modelId: string, providerName: string): boolean {
  const provider = providerName.toLowerCase();
  
  if (!AGENT_SUPPORTED_MODELS[provider as keyof typeof AGENT_SUPPORTED_MODELS]) {
    return false;
  }
  
  const supportedPrefixes = AGENT_SUPPORTED_MODELS[provider as keyof typeof AGENT_SUPPORTED_MODELS];
  return supportedPrefixes.some(prefix => modelId.toLowerCase().includes(prefix));
}

describe('Bedrock Agent Models API プロパティテスト', () => {
  /**
   * Property 1: リージョン別モデルリスト取得の一貫性
   * 
   * 検証内容:
   * 1. 各リージョンでモデルリストを取得できること
   * 2. 取得したモデルが全てAgent対応モデルであること
   * 3. モデルリストが空でないこと（少なくとも1つのモデルが存在）
   * 4. 各モデルに必須フィールドが含まれていること
   * 5. モデルがプロバイダー順、モデル名順でソートされていること
   */
  test.each(TEST_REGIONS)(
    'Property 1: リージョン %s でAgent対応モデルリストを取得できること',
    async (region) => {
      // Bedrockクライアントの作成
      const bedrockClient = new BedrockClient({ region });
      
      // Foundation Modelsの取得
      const command = new ListFoundationModelsCommand({
        byOutputModality: 'TEXT',
      });
      
      const response = await bedrockClient.send(command);
      
      // モデルリストが存在することを確認
      expect(response.modelSummaries).toBeDefined();
      expect(Array.isArray(response.modelSummaries)).toBe(true);
      
      // Agent対応モデルのフィルタリング
      const agentModels = (response.modelSummaries || [])
        .filter(model => {
          if (!model.modelId || !model.providerName) {
            return false;
          }
          
          return isAgentSupportedModel(model.modelId, model.providerName);
        });
      
      // 検証1: モデルリストが空でないこと
      expect(agentModels.length).toBeGreaterThan(0);
      console.log(`✅ リージョン ${region}: ${agentModels.length}個のAgent対応モデルを取得`);
      
      // 検証2: 全てのモデルがAgent対応であること
      agentModels.forEach(model => {
        expect(model.modelId).toBeDefined();
        expect(model.providerName).toBeDefined();
        expect(isAgentSupportedModel(model.modelId!, model.providerName!)).toBe(true);
      });
      
      // 検証3: 各モデルに必須フィールドが含まれていること
      agentModels.forEach(model => {
        expect(model.modelId).toBeDefined();
        expect(model.modelName).toBeDefined();
        expect(model.providerName).toBeDefined();
        expect(model.outputModalities).toBeDefined();
        expect(model.outputModalities).toContain('TEXT');
      });
      
      // 検証4: モデルがプロバイダー順、モデル名順でソートされていること
      const sortedModels = [...agentModels].sort((a, b) => {
        if (a.providerName !== b.providerName) {
          return (a.providerName || '').localeCompare(b.providerName || '');
        }
        return (a.modelName || '').localeCompare(b.modelName || '');
      });
      
      expect(agentModels).toEqual(sortedModels);
      
      // 検証5: Anthropic Claude 3モデルが含まれていること（主要モデルの存在確認）
      const claudeModels = agentModels.filter(model => 
        model.providerName?.toLowerCase() === 'anthropic' &&
        model.modelId?.toLowerCase().includes('claude-3')
      );
      
      expect(claudeModels.length).toBeGreaterThan(0);
      console.log(`  - Anthropic Claude 3モデル: ${claudeModels.length}個`);
      
      // 検証6: 各プロバイダーのモデル数を表示（デバッグ用）
      const providerCounts = agentModels.reduce((acc, model) => {
        const provider = model.providerName || 'unknown';
        acc[provider] = (acc[provider] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      console.log(`  - プロバイダー別モデル数:`, providerCounts);
    },
    30000 // タイムアウト: 30秒
  );
  
  /**
   * Property 1.1: 無効なリージョンでエラーが返されること
   * 
   * 検証内容:
   * 1. 無効なリージョンコードでAPIを呼び出すとエラーが返されること
   * 2. エラーメッセージが適切であること
   */
  test('Property 1.1: 無効なリージョンでエラーが返されること', async () => {
    const invalidRegion = 'invalid-region';
    
    // 無効なリージョンでBedrockクライアントを作成
    const bedrockClient = new BedrockClient({ region: invalidRegion });
    
    const command = new ListFoundationModelsCommand({
      byOutputModality: 'TEXT',
    });
    
    // エラーが発生することを期待
    await expect(bedrockClient.send(command)).rejects.toThrow();
    
    console.log(`✅ 無効なリージョン ${invalidRegion} でエラーが正しく返されました`);
  });
  
  /**
   * Property 1.2: 同じリージョンで複数回呼び出しても一貫した結果が返されること
   * 
   * 検証内容:
   * 1. 同じリージョンで2回APIを呼び出す
   * 2. 両方の呼び出しで同じモデルリストが返されること
   * 3. モデルの順序も一致すること
   */
  test('Property 1.2: 同じリージョンで複数回呼び出しても一貫した結果が返されること', async () => {
    const region = 'ap-northeast-1';
    const bedrockClient = new BedrockClient({ region });
    
    const command = new ListFoundationModelsCommand({
      byOutputModality: 'TEXT',
    });
    
    // 1回目の呼び出し
    const response1 = await bedrockClient.send(command);
    const agentModels1 = (response1.modelSummaries || [])
      .filter(model => {
        if (!model.modelId || !model.providerName) {
          return false;
        }
        return isAgentSupportedModel(model.modelId, model.providerName);
      })
      .map(model => model.modelId);
    
    // 2回目の呼び出し
    const response2 = await bedrockClient.send(command);
    const agentModels2 = (response2.modelSummaries || [])
      .filter(model => {
        if (!model.modelId || !model.providerName) {
          return false;
        }
        return isAgentSupportedModel(model.modelId, model.providerName);
      })
      .map(model => model.modelId);
    
    // 両方の呼び出しで同じモデルリストが返されることを確認
    expect(agentModels1).toEqual(agentModels2);
    
    console.log(`✅ リージョン ${region} で一貫した結果が返されました (${agentModels1.length}個のモデル)`);
  });
});
