import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { ApiResponse, HealthCheck, Session, Document, SearchResult } from '@/types';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: process.env.NEXT_PUBLIC_API_URL || 'https://daa1ivz70pn2k.cloudfront.net',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // レスポンスインターセプター
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('API Error:', error);
        return Promise.reject(error);
      }
    );
  }

  // ヘルスチェック
  async healthCheck(): Promise<HealthCheck> {
    const response: AxiosResponse<HealthCheck> = await this.client.get('/api/health');
    return response.data;
  }

  // Lambda Integration ヘルスチェック
  async lambdaHealthCheck(): Promise<HealthCheck> {
    const response: AxiosResponse<HealthCheck> = await this.client.get('/v1/health');
    return response.data;
  }

  // セッション管理
  async getSession(): Promise<Session> {
    const response: AxiosResponse<Session> = await this.client.get('/v1/session');
    return response.data;
  }

  // 権限確認
  async getPermissions(): Promise<string[]> {
    const response: AxiosResponse<{ permissions: string[] }> = await this.client.get('/v1/permissions');
    return response.data.permissions;
  }

  // 文書一覧取得
  async getDocuments(): Promise<Document[]> {
    const response: AxiosResponse<{ documents: Document[] }> = await this.client.get('/v1/documents');
    return response.data.documents;
  }

  // 検索
  async search(query: string): Promise<SearchResult> {
    const response: AxiosResponse<SearchResult> = await this.client.post('/v1/search', { query });
    return response.data;
  }

  // ログ取得
  async getLogs(): Promise<any[]> {
    const response: AxiosResponse<{ logs: any[] }> = await this.client.get('/v1/logs');
    return response.data.logs;
  }

  // メトリクス取得
  async getMetrics(): Promise<any> {
    const response: AxiosResponse<any> = await this.client.get('/v1/metrics');
    return response.data;
  }
}

export const apiClient = new ApiClient();
export default apiClient;
