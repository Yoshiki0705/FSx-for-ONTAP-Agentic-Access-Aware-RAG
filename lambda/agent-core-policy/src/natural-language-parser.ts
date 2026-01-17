/**
 * 自然言語ポリシーパーサー
 * 
 * 自然言語で記述されたポリシーをパースし、構造化データに変換します。
 * Amazon Bedrock Claude 3を使用して自然言語を理解します。
 */

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

// パース結果の型定義
export interface ParsedPolicy {
  principal: {
    type: 'user' | 'role' | 'group';
    identifier: string;
  };
  action: {
    type: 'allow' | 'deny';
    operations: string[];
  };
  resource: {
    type: string;
    identifier: string;
    attributes?: Record<string, any>;
  };
  conditions?: Array<{
    attribute: string;
    operator: 'equals' | 'notEquals' | 'in' | 'notIn' | 'greaterThan' | 'lessThan';
    value: any;
  }>;
  metadata: {
    description: string;
    confidence: number;
    language: string;
  };
}

// パーサー設定
export interface ParserConfig {
  modelId: string;
  temperature: number;
  maxTokens: number;
  supportedLanguages: string[];
}

export class NaturalLanguageParser {
  private bedrockClient: BedrockRuntimeClient;
  private config: ParserConfig;

  constructor(config: Partial<ParserConfig> = {}) {
    this.bedrockClient = new BedrockRuntimeClient({});
    this.config = {
      modelId: config.modelId || 'anthropic.claude-3-sonnet-20240229-v1:0',
      temperature: config.temperature || 0.1,
      maxTokens: config.maxTokens || 2000,
      supportedLanguages: config.supportedLanguages || ['ja', 'en'],
    };
  }

  /**
   * 自然言語ポリシーをパースする
   */
  async parsePolicy(naturalLanguagePolicy: string, language: string = 'ja'): Promise<ParsedPolicy> {
    // 言語サポートチェック
    if (!this.config.supportedLanguages.includes(language)) {
      throw new Error(`Unsupported language: ${language}`);
    }

    // Bedrockプロンプト作成
    const prompt = this.createParsingPrompt(naturalLanguagePolicy, language);

    // Bedrock呼び出し
    const response = await this.invokeBedrock(prompt);

    // レスポンスをパース
    const parsedPolicy = this.parseBedrockResponse(response, naturalLanguagePolicy, language);

    return parsedPolicy;
  }

  /**
   * パーシングプロンプトを作成
   */
  private createParsingPrompt(policy: string, language: string): string {
    const systemPrompt = language === 'ja' 
      ? `あなたはアクセス制御ポリシーの専門家です。自然言語で記述されたポリシーを構造化データに変換してください。

以下の形式でJSON出力してください：
{
  "principal": {
    "type": "user | role | group",
    "identifier": "プリンシパルの識別子"
  },
  "action": {
    "type": "allow | deny",
    "operations": ["操作1", "操作2"]
  },
  "resource": {
    "type": "リソースタイプ",
    "identifier": "リソース識別子",
    "attributes": {}
  },
  "conditions": [
    {
      "attribute": "属性名",
      "operator": "equals | notEquals | in | notIn | greaterThan | lessThan",
      "value": "値"
    }
  ],
  "metadata": {
    "description": "ポリシーの説明",
    "confidence": 0.95
  }
}`
      : `You are an access control policy expert. Convert natural language policies into structured data.

Output in the following JSON format:
{
  "principal": {
    "type": "user | role | group",
    "identifier": "principal identifier"
  },
  "action": {
    "type": "allow | deny",
    "operations": ["operation1", "operation2"]
  },
  "resource": {
    "type": "resource type",
    "identifier": "resource identifier",
    "attributes": {}
  },
  "conditions": [
    {
      "attribute": "attribute name",
      "operator": "equals | notEquals | in | notIn | greaterThan | lessThan",
      "value": "value"
    }
  ],
  "metadata": {
    "description": "policy description",
    "confidence": 0.95
  }
}`;

    return `${systemPrompt}

自然言語ポリシー:
${policy}

JSON出力:`;
  }

  /**
   * Bedrockを呼び出す
   */
  private async invokeBedrock(prompt: string): Promise<string> {
    const command = new InvokeModelCommand({
      modelId: this.config.modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    const response = await this.bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    return responseBody.content[0].text;
  }

  /**
   * Bedrockレスポンスをパース
   */
  private parseBedrockResponse(
    response: string,
    originalPolicy: string,
    language: string
  ): ParsedPolicy {
    try {
      // JSON部分を抽出
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // 必須フィールドの検証
      this.validateParsedPolicy(parsed);

      // メタデータに言語情報を追加
      parsed.metadata.language = language;

      return parsed as ParsedPolicy;
    } catch (error) {
      console.error('Failed to parse Bedrock response:', error);
      throw new Error(`Failed to parse policy: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * パース結果を検証
   */
  private validateParsedPolicy(policy: any): void {
    // 必須フィールドチェック
    if (!policy.principal || !policy.principal.type || !policy.principal.identifier) {
      throw new Error('Invalid principal');
    }

    if (!policy.action || !policy.action.type || !Array.isArray(policy.action.operations)) {
      throw new Error('Invalid action');
    }

    if (!policy.resource || !policy.resource.type || !policy.resource.identifier) {
      throw new Error('Invalid resource');
    }

    if (!policy.metadata || typeof policy.metadata.confidence !== 'number') {
      throw new Error('Invalid metadata');
    }

    // 信頼度チェック
    if (policy.metadata.confidence < 0.7) {
      console.warn(`Low confidence policy: ${policy.metadata.confidence}`);
    }
  }

  /**
   * バッチパース（複数ポリシーを一度にパース）
   */
  async parsePolicies(policies: string[], language: string = 'ja'): Promise<ParsedPolicy[]> {
    const results: ParsedPolicy[] = [];

    for (const policy of policies) {
      try {
        const parsed = await this.parsePolicy(policy, language);
        results.push(parsed);
      } catch (error) {
        console.error(`Failed to parse policy: ${policy}`, error);
        // エラーは記録するが、処理は継続
      }
    }

    return results;
  }
}
