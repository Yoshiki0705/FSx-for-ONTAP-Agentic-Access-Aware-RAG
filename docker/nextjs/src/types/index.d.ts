export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    message?: string;
    error?: string;
}
export interface HealthCheck {
    status: string;
    timestamp: string;
    service: string;
    environment: string;
    version: string;
}
export interface User {
    id: string;
    username: string;
    email?: string;
    roles: string[];
    permissions: string[];
}
export interface Session {
    sessionId: string;
    userId: string;
    createdAt: string;
    expiresAt: string;
}
export interface Document {
    id: string;
    title: string;
    content: string;
    path: string;
    permissions: string[];
    createdAt: string;
    updatedAt: string;
}
export interface SearchResult {
    documents: Document[];
    total: number;
    query: string;
    took: number;
}
