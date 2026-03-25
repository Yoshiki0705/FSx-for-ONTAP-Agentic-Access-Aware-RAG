/**
 * Bedrockプロバイダーパターンレジストリ
 * 
 * モデルIDとプロバイダー名から自動的にリクエスト形式とパラメータマッピングを判定する
 * 新しいモデルが追加されても、このパターン定義に基づいて自動的に適切な設定が適用される
 */

/**
 * プロバイダーパターン定義
 */
export interface ProviderPattern {
  /** プロバイダー名 */
  name: string;
  
  /** モデルIDプレフィックスパターン（正規表現） */
  modelIdPatterns: RegExp[];
  
  /** プロバイダー名パターン（大文字小文字を区別しない） */
  providerNamePatterns: string[];
  
  /** リクエスト形式 */
  requestFormat: 'anthropic' | 'amazon' | 'prompt-based';
  
  /** レスポンス形式（テキスト抽出パス） */
  responseFormat: string;
  
  /** パラメータマッピング */
  parameterMapping: {
    maxTokens: string;
    temperature: string;
    topP: string;
    topK?: string;
  };
  
  /** 優先度（高いほど優先、同じ優先度の場合は配列の順序） */
  priority: number;
}

/**
 * プロバイダーパターンレジストリ
 * 
 * 優先度の高い順に定義する
 * 新しいプロバイダーを追加する場合は、このリストに追加するだけ
 */
export const PROVIDER_PATTERNS: ProviderPattern[] = [
  // ========================================
  // Anthropic Claude
  // ========================================
  {
    name: 'anthropic',
    modelIdPatterns: [
      /^anthropic\./,           // anthropic.claude-3-5-sonnet-20241022-v2:0
      /^apac\.anthropic\./,     // apac.anthropic.claude-3-5-sonnet-20241022-v2:0
      /^us\.anthropic\./,       // us.anthropic.claude-3-5-sonnet-20241022-v2:0
      /^eu\.anthropic\./,       // eu.anthropic.claude-3-5-sonnet-20241022-v2:0
    ],
    providerNamePatterns: ['anthropic'],
    requestFormat: 'anthropic',
    responseFormat: 'content[0].text',
    parameterMapping: {
      maxTokens: 'max_tokens',
      temperature: 'temperature',
      topP: 'top_p',
      topK: 'top_k'
    },
    priority: 100
  },
  
  // ========================================
  // Amazon Nova
  // ========================================
  {
    name: 'amazon',
    modelIdPatterns: [
      /^amazon\./,              // amazon.nova-pro-v1:0
      /^us\.amazon\./,          // us.amazon.nova-pro-v1:0
      /^apac\.amazon\./,        // apac.amazon.nova-pro-v1:0
      /^eu\.amazon\./,          // eu.amazon.nova-pro-v1:0
    ],
    providerNamePatterns: ['amazon'],
    requestFormat: 'amazon',
    responseFormat: 'output.message.content[0].text',
    parameterMapping: {
      maxTokens: 'inferenceConfig.max_new_tokens',
      temperature: 'inferenceConfig.temperature',
      topP: 'inferenceConfig.topP'
    },
    priority: 100
  },
  
  // ========================================
  // Meta Llama
  // ========================================
  {
    name: 'meta',
    modelIdPatterns: [
      /^meta\./,                // meta.llama3-8b-instruct-v1:0
    ],
    providerNamePatterns: ['meta'],
    requestFormat: 'prompt-based',
    responseFormat: 'generation',
    parameterMapping: {
      maxTokens: 'max_gen_len',  // 重要: Llamaはmax_gen_lenを使用
      temperature: 'temperature',
      topP: 'top_p'
    },
    priority: 100
  },
  
  // ========================================
  // Cohere Command
  // ========================================
  {
    name: 'cohere',
    modelIdPatterns: [
      /^cohere\./,              // cohere.command-r-plus-v1:0
    ],
    providerNamePatterns: ['cohere'],
    requestFormat: 'prompt-based',
    responseFormat: 'text',
    parameterMapping: {
      maxTokens: 'max_tokens',
      temperature: 'temperature',
      topP: 'p',                // 重要: Cohereはpを使用
      topK: 'k'                 // 重要: Cohereはkを使用
    },
    priority: 100
  },
  
  // ========================================
  // AI21 Labs Jurassic
  // ========================================
  {
    name: 'ai21',
    modelIdPatterns: [
      /^ai21\./,                // ai21.jamba-instruct-v1:0
    ],
    providerNamePatterns: ['ai21', 'ai21 labs'],
    requestFormat: 'prompt-based',
    responseFormat: 'completions[0].data.text',
    parameterMapping: {
      maxTokens: 'maxTokens',   // 重要: AI21はキャメルケース
      temperature: 'temperature',
      topP: 'topP'              // 重要: AI21はキャメルケース
    },
    priority: 100
  },
  
  // ========================================
  // Mistral AI
  // ========================================
  {
    name: 'mistral',
    modelIdPatterns: [
      /^mistral\./,             // mistral.mistral-large-2402-v1:0
    ],
    providerNamePatterns: ['mistral', 'mistral ai'],
    requestFormat: 'prompt-based',
    responseFormat: 'outputs[0].text',
    parameterMapping: {
      maxTokens: 'max_tokens',
      temperature: 'temperature',
      topP: 'top_p',
      topK: 'top_k'
    },
    priority: 100
  },
  
  // ========================================
  // OpenAI (via Bedrock)
  // ========================================
  {
    name: 'openai',
    modelIdPatterns: [
      /^openai\./,              // openai.gpt-oss-20b-1:0
    ],
    providerNamePatterns: ['openai'],
    requestFormat: 'prompt-based',    // 重要: OpenAIはOpenAI Chat Completion形式を使用
    responseFormat: 'choices[0].message.content',
    parameterMapping: {
      maxTokens: 'max_tokens',
      temperature: 'temperature',
      topP: 'top_p'
    },
    priority: 100
  },
  
  // ========================================
  // DeepSeek
  // ========================================
  {
    name: 'deepseek',
    modelIdPatterns: [
      /^deepseek\./,            // deepseek.r1-v1:0
      /^us\.deepseek\./,        // us.deepseek.r1-v1:0 (推論プロファイル)
      /^apac\.deepseek\./,      // apac.deepseek.r1-v1:0 (推論プロファイル)
      /^eu\.deepseek\./,        // eu.deepseek.r1-v1:0 (推論プロファイル)
    ],
    providerNamePatterns: ['deepseek'],
    requestFormat: 'prompt-based',    // 重要: DeepSeekはOpenAI Chat Completion形式を使用
    responseFormat: 'choices[0].message.content',
    parameterMapping: {
      maxTokens: 'max_tokens',
      temperature: 'temperature',
      topP: 'top_p'
    },
    priority: 100
  },
  
  // ========================================
  // Qwen (Alibaba Cloud)
  // ========================================
  {
    name: 'qwen',
    modelIdPatterns: [
      /^qwen\./,                // qwen.qwen3-235b-a22b-2507-v1:0
    ],
    providerNamePatterns: ['qwen'],
    requestFormat: 'prompt-based',
    responseFormat: 'choices[0].message.content',
    parameterMapping: {
      maxTokens: 'max_tokens',
      temperature: 'temperature',
      topP: 'top_p'
    },
    priority: 100
  },
  
  // ========================================
  // Google Gemma
  // ========================================
  {
    name: 'google',
    modelIdPatterns: [
      /^google\./,              // google.gemma-3-27b-it
    ],
    providerNamePatterns: ['google'],
    requestFormat: 'prompt-based',
    responseFormat: 'choices[0].message.content',
    parameterMapping: {
      maxTokens: 'max_tokens',
      temperature: 'temperature',
      topP: 'top_p'
    },
    priority: 100
  },
  
  // ========================================
  // NVIDIA Nemotron
  // ========================================
  {
    name: 'nvidia',
    modelIdPatterns: [
      /^nvidia\./,              // nvidia.nemotron-nano-12b-v2
    ],
    providerNamePatterns: ['nvidia'],
    requestFormat: 'prompt-based',
    responseFormat: 'choices[0].message.content',
    parameterMapping: {
      maxTokens: 'max_tokens',
      temperature: 'temperature',
      topP: 'top_p'
    },
    priority: 100
  },
  
  // ========================================
  // MiniMax
  // ========================================
  {
    name: 'minimax',
    modelIdPatterns: [
      /^minimax\./,             // minimax.minimax-m2
    ],
    providerNamePatterns: ['minimax'],
    requestFormat: 'prompt-based',
    responseFormat: 'choices[0].message.content',
    parameterMapping: {
      maxTokens: 'max_tokens',
      temperature: 'temperature',
      topP: 'top_p'
    },
    priority: 100
  },
  
  // ========================================
  // ZAI (Zhipu AI) GLM
  // ========================================
  {
    name: 'zai',
    modelIdPatterns: [
      /^zai\./,                 // zai.glm-4.7
    ],
    providerNamePatterns: ['zai', 'zhipu'],
    requestFormat: 'prompt-based',
    responseFormat: 'choices[0].message.content',
    parameterMapping: {
      maxTokens: 'max_tokens',
      temperature: 'temperature',
      topP: 'top_p'
    },
    priority: 100
  },
  
  // ========================================
  // Moonshot AI (Kimi)
  // ========================================
  {
    name: 'moonshot',
    modelIdPatterns: [
      /^moonshot\./,            // moonshot.kimi-k2-thinking
      /^moonshotai\./,          // moonshotai.kimi-k2.5
    ],
    providerNamePatterns: ['moonshot', 'moonshotai'],
    requestFormat: 'prompt-based',
    responseFormat: 'choices[0].message.content',
    parameterMapping: {
      maxTokens: 'max_tokens',
      temperature: 'temperature',
      topP: 'top_p'
    },
    priority: 100
  },
  
  // ========================================
  // Twelve Labs (Pegasus)
  // ========================================
  {
    name: 'twelvelabs',
    modelIdPatterns: [
      /^twelvelabs\./,          // twelvelabs.pegasus-1-2-v1:0
    ],
    providerNamePatterns: ['twelvelabs', 'twelve labs'],
    requestFormat: 'prompt-based',
    responseFormat: 'text',
    parameterMapping: {
      maxTokens: 'max_tokens',
      temperature: 'temperature',
      topP: 'top_p'
    },
    priority: 100
  },
  
  // ========================================
  // Stability AI (画像生成)
  // ========================================
  {
    name: 'stability',
    modelIdPatterns: [
      /^stability\./,           // stability.stable-diffusion-xl-v1
    ],
    providerNamePatterns: ['stability', 'stability ai'],
    requestFormat: 'prompt-based',
    responseFormat: 'artifacts[0].base64',
    parameterMapping: {
      maxTokens: 'max_tokens',
      temperature: 'temperature',
      topP: 'top_p'
    },
    priority: 100
  },
  
  // ========================================
  // Default Fallback
  // ========================================
  {
    name: 'default',
    modelIdPatterns: [/.*/],    // すべてにマッチ
    providerNamePatterns: [],
    requestFormat: 'prompt-based',
    responseFormat: 'text',
    parameterMapping: {
      maxTokens: 'max_tokens',
      temperature: 'temperature',
      topP: 'top_p'
    },
    priority: 0                 // 最低優先度
  }
];

/**
 * プロバイダーパターンを名前で取得
 */
export function getPatternByName(name: string): ProviderPattern | undefined {
  return PROVIDER_PATTERNS.find(p => p.name === name);
}

/**
 * すべてのプロバイダー名を取得
 */
export function getAllProviderNames(): string[] {
  return PROVIDER_PATTERNS
    .filter(p => p.name !== 'default')
    .map(p => p.name);
}

/**
 * プロバイダーパターンの統計情報を取得
 */
export function getPatternStats() {
  return {
    totalPatterns: PROVIDER_PATTERNS.length,
    providers: getAllProviderNames(),
    totalModelIdPatterns: PROVIDER_PATTERNS.reduce((sum, p) => sum + p.modelIdPatterns.length, 0),
    requestFormats: {
      anthropic: PROVIDER_PATTERNS.filter(p => p.requestFormat === 'anthropic').length,
      amazon: PROVIDER_PATTERNS.filter(p => p.requestFormat === 'amazon').length,
      promptBased: PROVIDER_PATTERNS.filter(p => p.requestFormat === 'prompt-based').length,
    }
  };
}
