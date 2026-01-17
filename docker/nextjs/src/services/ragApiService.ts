/**
 * RAG API サービス
 * AWS Batch (埋め込み) + Lambda (検索・生成) アーキテクチャとの統合
 */

export interface SearchRequest {
  embedding: number[];
  userId: string;
  permissions: string[];
  k?: number;
}

export interface SearchResponse {
  success: boolean;
  documents: Array<{
    id: string;
    content: string;
    title: string;
    score: number;
    metadata: any;
    permissions: string[];
    created_at: string;
  }>;
  total: number;
  userId: string;
  timestamp: string;
}

export interface GenerateRequest {
  question: string;
  documents?: Array<{
    id: string;
    content: string;
    title: string;
    score: number;
  }>;
  userId: string;
  maxTokens?: number;
}

export interface GenerateResponse {
  success: boolean;
  answer: string;
  sources: Array<{
    id: string;
    title: string;
    score: number;
  }>;
  hasContext: boolean;
  contextDocuments: number;
  userId: string;
  model: string;
  timestamp: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface ChatRequest {
  message: string;
  userId: string;
  permissions: string[];
}

export interface ChatResponse {
  success: boolean;
  answer: string;
  sources: Array<{
    id: string;
    title: string;
    score: number;
  }>;
  timestamp: string;
  processingTime: number;
}

/**
 * RAG API サービスクラス
 */
export class RagApiService {
  private baseUrl: string;
  
  constructor(baseUrl?: string) {
    // 本番環境では環境変数から取得、開発環境ではデフォルト値使用
    this.baseUrl = baseUrl || 
      process.env.NEXT_PUBLIC_RAG_API_URL || 
      'https://api-id.execute-api.us-east-1.amazonaws.com/prod';
  }

  /**
   * 文書検索API呼び出し
   */
  async searchDocuments(request: SearchRequest): Promise<SearchResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/rag/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`Search API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Document search error:', error);
      throw error;
    }
  }

  /**
   * RAG回答生成API呼び出し
   */
  async generateAnswer(request: GenerateRequest): Promise<GenerateResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/rag/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`Generate API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Answer generation error:', error);
      throw error;
    }
  }

  /**
   * 統合チャットAPI呼び出し（検索→生成の統合処理）
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    try {
      const startTime = Date.now();

      // Step 1: 質問の埋め込み生成（AWS Batchで事前処理済みと仮定）
      // 実際の実装では、質問の埋め込みをリアルタイムで生成する必要がある
      // 現在はダミーベクトルを使用
      const questionEmbedding = await this.generateQuestionEmbedding(request.message);

      // Step 2: 文書検索
      const searchResponse = await this.searchDocuments({
        embedding: questionEmbedding,
        userId: request.userId,
        permissions: request.permissions,
        k: 5
      });

      // Step 3: 回答生成
      const generateResponse = await this.generateAnswer({
        question: request.message,
        documents: searchResponse.documents,
        userId: request.userId
      });

      const processingTime = Date.now() - startTime;

      return {
        success: true,
        answer: generateResponse.answer,
        sources: generateResponse.sources,
        timestamp: new Date().toISOString(),
        processingTime: processingTime
      };
    } catch (error) {
      console.error('Chat API error:', error);
      throw error;
    }
  }

  /**
   * 質問の埋め込み生成（簡易実装）
   * 注意: 実際の実装では、AWS Batchまたは専用サービスを使用
   */
  private async generateQuestionEmbedding(question: string): Promise<number[]> {
    // TODO: 実際のTitan Embeddings API呼び出しを実装
    // 現在はダミーベクトル（1024次元）を返す
    console.warn('ダミー埋め込みベクトルを使用中。実際の実装が必要です。');
    
    // 1024次元のダミーベクトル生成
    return Array.from({ length: 1024 }, () => Math.random() * 2 - 1);
  }

  /**
   * API接続テスト
   */
  async testConnection(): Promise<boolean> {
    try {
      // ヘルスチェック用の軽量リクエスト
      const testResponse = await this.generateAnswer({
        question: "接続テスト",
        documents: [],
        userId: "test-user"
      });

      return testResponse.success;
    } catch (error) {
      console.error('API connection test failed:', error);
      return false;
    }
  }
}

/**
 * デフォルトのRAG APIサービスインスタンス
 */
export const ragApiService = new RagApiService();