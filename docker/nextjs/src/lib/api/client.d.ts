import { HealthCheck, Session, Document, SearchResult } from '@/types';
declare class ApiClient {
    private client;
    constructor();
    healthCheck(): Promise<HealthCheck>;
    lambdaHealthCheck(): Promise<HealthCheck>;
    getSession(): Promise<Session>;
    getPermissions(): Promise<string[]>;
    getDocuments(): Promise<Document[]>;
    search(query: string): Promise<SearchResult>;
    getLogs(): Promise<any[]>;
    getMetrics(): Promise<any>;
}
export declare const apiClient: ApiClient;
export default apiClient;
