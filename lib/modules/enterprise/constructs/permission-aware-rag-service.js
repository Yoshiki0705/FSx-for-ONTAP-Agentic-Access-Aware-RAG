"use strict";
/**
 * 権限認識型RAG検索サービス
 *
 * ユーザー権限に基づくベクトル検索とコンテキスト生成
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PermissionAwareRAGService = void 0;
const permission_filter_engine_1 = require("./permission-filter-engine");
class PermissionAwareRAGService {
    opensearchClient;
    bedrockClient;
    permissionEngine;
    constructor(opensearchClient, bedrockClient, permissionConfig) {
        this.opensearchClient = opensearchClient;
        this.bedrockClient = bedrockClient;
        this.permissionEngine = new permission_filter_engine_1.PermissionFilterEngine(permissionConfig);
    }
    /**
     * 権限認識型RAG検索実行
     */
    async executeRAGSearch(request) {
        const startTime = Date.now();
        try {
            // 1. クエリのEmbedding生成
            const queryEmbedding = await this.generateQueryEmbedding(request.query, request.options?.searchType || 'text');
            // 2. 権限フィルター生成
            const permissionFilter = this.permissionEngine.generateSearchFilter(request.userPermission);
            // 3. OpenSearch検索実行
            const searchQuery = this.buildSearchQuery(queryEmbedding, permissionFilter, request.options);
            const searchResponse = await this.opensearchClient.search({
                index: 'titan-multimodal-embeddings',
                body: searchQuery
            });
            // 4. 結果の後処理フィルタリング
            const { filteredResults, auditLog } = this.permissionEngine.filterSearchResults(searchResponse.body.hits.hits, request.userPermission);
            // 5. RAG結果構築
            const ragResults = filteredResults.map(hit => this.buildRAGResult(hit, request.userPermission));
            // 6. コンテキスト生成（オプション）
            let generatedContext;
            if (request.options?.includeMetadata && ragResults.length > 0) {
                generatedContext = await this.generateContext(ragResults, request.query);
            }
            const executionTimeMs = Date.now() - startTime;
            return {
                results: ragResults,
                totalHits: searchResponse.body.hits.total.value,
                filteredHits: ragResults.length,
                executionTimeMs,
                auditLog,
                generatedContext
            };
        }
        catch (error) {
            throw new Error(`RAG検索エラー: ${error}`);
        }
    }
    /**
     * クエリEmbedding生成
     */
    async generateQueryEmbedding(query, searchType) {
        const modelId = searchType === 'multimodal'
            ? 'amazon.titan-embed-image-v1'
            : 'amazon.titan-embed-text-v2:0';
        const body = searchType === 'multimodal'
            ? JSON.stringify({
                inputText: query,
                embeddingConfig: { outputEmbeddingLength: 1024 }
            })
            : JSON.stringify({
                inputText: query,
                dimensions: 1024,
                normalize: true
            });
        const response = await this.bedrockClient.invokeModel({
            modelId,
            body
        }).promise();
        const result = JSON.parse(response.body.toString());
        return result.embedding;
    }
    /**
     * OpenSearch検索クエリ構築
     */
    buildSearchQuery(queryEmbedding, permissionFilter, options) {
        const maxResults = options?.maxResults || 10;
        const minScore = options?.minScore || 0.1;
        return {
            size: maxResults,
            min_score: minScore,
            query: {
                bool: {
                    must: [
                        {
                            knn: {
                                text_embedding_vector: {
                                    vector: queryEmbedding,
                                    k: maxResults * 2 // 権限フィルタリングを考慮して多めに取得
                                }
                            }
                        }
                    ],
                    filter: permissionFilter.bool ? [permissionFilter] : []
                }
            },
            _source: {
                excludes: ['text_embedding_vector', 'multimodal_embedding_vector'] // ベクトルデータは除外
            }
        };
    }
    /**
     * RAG結果構築
     */
    buildRAGResult(hit, userPermission) {
        const source = hit._source;
        const accessResult = this.permissionEngine.checkDocumentAccess(source, userPermission);
        return {
            documentId: source.document_id,
            score: hit._score,
            textContent: source.text_content,
            filePath: source.file_path,
            metadata: {
                contentType: source.content_type,
                modelVersion: source.model_version,
                createdAt: source.created_at,
                owner: source.owner
            },
            permissionInfo: {
                accessReason: accessResult.reason,
                appliedRules: accessResult.appliedRules
            }
        };
    }
    /**
     * コンテキスト生成
     */
    async generateContext(results, query) {
        const contextParts = results.slice(0, 5).map((result, index) => `[文書${index + 1}] ${result.textContent.substring(0, 200)}...`);
        return `検索クエリ: "${query}"\n\n関連文書:\n${contextParts.join('\n\n')}`;
    }
    /**
     * 権限統計取得
     */
    getPermissionStatistics() {
        return this.permissionEngine.getStatistics();
    }
}
exports.PermissionAwareRAGService = PermissionAwareRAGService;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGVybWlzc2lvbi1hd2FyZS1yYWctc2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInBlcm1pc3Npb24tYXdhcmUtcmFnLXNlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7O0dBSUc7OztBQUlILHlFQUFvRTtBQW1FcEUsTUFBYSx5QkFBeUI7SUFDNUIsZ0JBQWdCLENBQWE7SUFDN0IsYUFBYSxDQUFxQjtJQUNsQyxnQkFBZ0IsQ0FBeUI7SUFFakQsWUFDRSxnQkFBNEIsRUFDNUIsYUFBaUMsRUFDakMsZ0JBQXdDO1FBRXhDLElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxnQkFBZ0IsQ0FBQztRQUN6QyxJQUFJLENBQUMsYUFBYSxHQUFHLGFBQWEsQ0FBQztRQUNuQyxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsSUFBSSxpREFBc0IsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO0lBQ3ZFLENBQUM7SUFFRDs7T0FFRztJQUNJLEtBQUssQ0FBQyxnQkFBZ0IsQ0FBQyxPQUF5QjtRQUNyRCxNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUM7UUFFN0IsSUFBSSxDQUFDO1lBQ0gscUJBQXFCO1lBQ3JCLE1BQU0sY0FBYyxHQUFHLE1BQU0sSUFBSSxDQUFDLHNCQUFzQixDQUN0RCxPQUFPLENBQUMsS0FBSyxFQUNiLE9BQU8sQ0FBQyxPQUFPLEVBQUUsVUFBVSxJQUFJLE1BQU0sQ0FDdEMsQ0FBQztZQUVGLGVBQWU7WUFDZixNQUFNLGdCQUFnQixHQUFHLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxvQkFBb0IsQ0FBQyxPQUFPLENBQUMsY0FBYyxDQUFDLENBQUM7WUFFNUYsb0JBQW9CO1lBQ3BCLE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsQ0FDdkMsY0FBYyxFQUNkLGdCQUFnQixFQUNoQixPQUFPLENBQUMsT0FBTyxDQUNoQixDQUFDO1lBRUYsTUFBTSxjQUFjLEdBQUcsTUFBTSxJQUFJLENBQUMsZ0JB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ZSxDQUFDLE9BQTBCLEVBQUUsS0FBYTtRQUNyRSxNQUFNLFlBQVksR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLEVBQUUsS0FBSyxFQUFFLEVBQUUsQ0FDN0QsTUFBTSxLQUFLLEdBQUcsQ0FBQyxLQUFLLE1BQU0sQ0FBQyxXQUFXLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsS0FBSyxDQUM5RCxDQUFDO1FBRUYsT0FBTyxXQUFXLEtBQUssZUFBZSxZQUFZLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUM7SUFDcEUsQ0FBQztJQUVEOztPQUVHO0lBQ0ksdUJBQXVCO1FBQzVCLE9BQU8sSUFBSSxDQUFDLGdCQUFnQixDQUFDLGFBQWEsRUFBRSxDQUFDO0lBQy9DLENBQUM7Q0FDRjtBQW5MRCw4REFtTEMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIOaoqemZkOiqjeitmOWei1JBR+aknOe0ouOCteODvOODk+OCuVxuICogXG4gKiDjg6bjg7zjgrbjg7zmqKnpmZDjgavln7rjgaXjgY/jg5njgq/jg4jjg6vmpJzntKLjgajjgrPjg7Pjg4bjgq3jgrnjg4jnlJ/miJBcbiAqL1xuXG5pbXBvcnQgKiBhcyBhd3MgZnJvbSAnYXdzLXNkayc7XG5pbXBvcnQgeyBPcGVuU2VhcmNoIH0gZnJvbSAnQG9wZW5zZWFyY2gtcHJvamVjdC9vcGVuc2VhcmNoJztcbmltcG9ydCB7IFBlcm1pc3Npb25GaWx0ZXJFbmdpbmUgfSBmcm9tICcuL3Blcm1pc3Npb24tZmlsdGVyLWVuZ2luZSc7XG5pbXBvcnQgeyBVc2VyUGVybWlzc2lvbiwgUGVybWlzc2lvbkZpbHRlckNvbmZpZywgQWNjZXNzQ29udHJvbFJlc3VsdCB9IGZyb20gJy4uL2ludGVyZmFjZXMvcGVybWlzc2lvbi1jb25maWcnO1xuXG5leHBvcnQgaW50ZXJmYWNlIFJBR1NlYXJjaFJlcXVlc3Qge1xuICAvKiog5qSc57Si44Kv44Ko44OqICovXG4gIHJlYWRvbmx5IHF1ZXJ5OiBzdHJpbmc7XG4gIFxuICAvKiog44Om44O844K244O85qip6ZmQ5oOF5aCxICovXG4gIHJlYWRvbmx5IHVzZXJQZXJtaXNzaW9uOiBVc2VyUGVybWlzc2lvbjtcbiAgXG4gIC8qKiDmpJzntKLjgqrjg5fjgrfjg6fjg7MgKi9cbiAgcmVhZG9ubHkgb3B0aW9ucz86IHtcbiAgICByZWFkb25seSBtYXhSZXN1bHRzPzogbnVtYmVyO1xuICAgIHJlYWRvbmx5IG1pblNjb3JlPzogbnVtYmVyO1xuICAgIHJlYWRvbmx5IGluY2x1ZGVNZXRhZGF0YT86IGJvb2xlYW47XG4gICAgcmVhZG9ubHkgc2VhcmNoVHlwZT86ICd0ZXh0JyB8ICdtdWx0aW1vZGFsJyB8ICdoeWJyaWQnO1xuICB9O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFJBR1NlYXJjaFJlc3BvbnNlIHtcbiAgLyoqIOaknOe0oue1kOaenCAqL1xuICByZWFkb25seSByZXN1bHRzOiBSQUdTZWFyY2hSZXN1bHRbXTtcbiAgXG4gIC8qKiDnt4/jg5Ljg4Pjg4jmlbDvvIjjg5XjgqPjg6vjgr/jg6rjg7PjgrDliY3vvIkgKi9cbiAgcmVhZG9ubHkgdG90YWxIaXRzOiBudW1iZXI7XG4gIFxuICAvKiog44OV44Kj44Or44K/44Oq44Oz44Kw5b6M44OS44OD44OI5pWwICovXG4gIHJlYWRvbmx5IGZpbHRlcmVkSGl0czogbnVtYmVyO1xuICBcbiAgLyoqIOWun+ihjOaZgumWk++8iOODn+ODquenku+8iSAqL1xuICByZWFkb25seSBleGVjdXRpb25UaW1lTXM6IG51bWJlcjtcbiAgXG4gIC8qKiDnm6Pmn7vjg63jgrAgKi9cbiAgcmVhZG9ubHkgYXVkaXRMb2c6IEFjY2Vzc0NvbnRyb2xSZXN1bHRbXTtcbiAgXG4gIC8qKiDnlJ/miJDjgZXjgozjgZ/jgrPjg7Pjg4bjgq3jgrnjg4ggKi9cbiAgcmVhZG9ubHkgZ2VuZXJhdGVkQ29udGV4dD86IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBSQUdTZWFyY2hSZXN1bHQge1xuICAvKiog44OJ44Kt44Ol44Oh44Oz44OISUQgKi9cbiAgcmVhZG9ubHkgZG9jdW1lbnRJZDogc3RyaW5nO1xuICBcbiAgLyoqIOmhnuS8vOW6puOCueOCs+OCoiAqL1xuICByZWFkb25seSBzY29yZTogbnVtYmVyO1xuICBcbiAgLyoqIOODhuOCreOCueODiOOCs+ODs+ODhuODs+ODhCAqL1xuICByZWFkb25seSB0ZXh0Q29udGVudDogc3RyaW5nO1xuICBcbiAgLyoqIOODleOCoeOCpOODq+ODkeOCuSAqL1xuICByZWFkb25seSBmaWxlUGF0aDogc3RyaW5nO1xuICBcbiAgLyoqIOODoeOCv+ODh+ODvOOCvyAqL1xuICByZWFkb25seSBtZXRhZGF0YToge1xuICAgIHJlYWRvbmx5IGNvbnRlbnRUeXBlOiBzdHJpbmc7XG4gICAgcmVhZG9ubHkgbW9kZWxWZXJzaW9uOiBzdHJpbmc7XG4gICAgcmVhZG9ubHkgY3JlYXRlZEF0OiBzdHJpbmc7XG4gICAgcmVhZG9ubHkgb3duZXI/OiBzdHJpbmc7XG4gIH07XG4gIFxuICAvKiog5qip6ZmQ5oOF5aCxICovXG4gIHJlYWRvbmx5IHBlcm1pc3Npb25JbmZvOiB7XG4gICAgcmVhZG9ubHkgYWNjZXNzUmVhc29uOiBzdHJpbmc7XG4gICAgcmVhZG9ubHkgYXBwbGllZFJ1bGVzOiBzdHJpbmdbXTtcbiAgfTtcbn1cblxuZXhwb3J0IGNsYXNzIFBlcm1pc3Npb25Bd2FyZVJBR1NlcnZpY2Uge1xuICBwcml2YXRlIG9wZW5zZWFyY2hDbGllbnQ6IE9wZW5TZWFyY2g7XG4gIHByaXZhdGUgYmVkcm9ja0NsaWVudDogYXdzLkJlZHJvY2tSdW50aW1lO1xuICBwcml2YXRlIHBlcm1pc3Npb25FbmdpbmU6IFBlcm1pc3Npb25GaWx0ZXJFbmdpbmU7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgb3BlbnNlYXJjaENsaWVudDogT3BlblNlYXJjaCxcbiAgICBiZWRyb2NrQ2xpZW50OiBhd3MuQmVkcm9ja1J1bnRpbWUsXG4gICAgcGVybWlzc2lvbkNvbmZpZzogUGVybWlzc2lvbkZpbHRlckNvbmZpZ1xuICApIHtcbiAgICB0aGlzLm9wZW5zZWFyY2hDbGllbnQgPSBvcGVuc2VhcmNoQ2xpZW50O1xuICAgIHRoaXMuYmVkcm9ja0NsaWVudCA9IGJlZHJvY2tDbGllbnQ7XG4gICAgdGhpcy5wZXJtaXNzaW9uRW5naW5lID0gbmV3IFBlcm1pc3Npb25GaWx0ZXJFbmdpbmUocGVybWlzc2lvbkNvbmZpZyk7XG4gIH1cblxuICAvKipcbiAgICog5qip6ZmQ6KqN6K2Y5Z6LUkFH5qSc57Si5a6f6KGMXG4gICAqL1xuICBwdWJsaWMgYXN5bmMgZXhlY3V0ZVJBR1NlYXJjaChyZXF1ZXN0OiBSQUdTZWFyY2hSZXF1ZXN0KTogUHJvbWlzZTxSQUdTZWFyY2hSZXNwb25zZT4ge1xuICAgIGNvbnN0IHN0YXJ0VGltZSA9IERhdGUubm93KCk7XG4gICAgXG4gICAgdHJ5IHtcbiAgICAgIC8vIDEuIOOCr+OCqOODquOBrkVtYmVkZGluZ+eUn+aIkFxuICAgICAgY29uc3QgcXVlcnlFbWJlZGRpbmcgPSBhd2FpdCB0aGlzLmdlbmVyYXRlUXVlcnlFbWJlZGRpbmcoXG4gICAgICAgIHJlcXVlc3QucXVlcnksIFxuICAgICAgICByZXF1ZXN0Lm9wdGlvbnM/LnNlYXJjaFR5cGUgfHwgJ3RleHQnXG4gICAgICApO1xuXG4gICAgICAvLyAyLiDmqKnpmZDjg5XjgqPjg6vjgr/jg7znlJ/miJBcbiAgICAgIGNvbnN0IHBlcm1pc3Npb25GaWx0ZXIgPSB0aGlzLnBlcm1pc3Npb25FbmdpbmUuZ2VuZXJhdGVTZWFyY2hGaWx0ZXIocmVxdWVzdC51c2VyUGVybWlzc2lvbik7XG5cbiAgICAgIC8vIDMuIE9wZW5TZWFyY2jmpJzntKLlrp/ooYxcbiAgICAgIGNvbnN0IHNlYXJjaFF1ZXJ5ID0gdGhpcy5idWlsZFNlYXJjaFF1ZXJ5KFxuICAgICAgICBxdWVyeUVtYmVkZGluZyxcbiAgICAgICAgcGVybWlzc2lvbkZpbHRlcixcbiAgICAgICAgcmVxdWVzdC5vcHRpb25zXG4gICAgICApO1xuXG4gICAgICBjb25zdCBzZWFyY2hSZXNwb25zZSA9IGF3YWl0IHRoaXMub3BlbnNlYXJjaENsaWVudC5zZWFyY2goe1xuICAgICAgICBpbmRleDogJ3RpdGFuLW11bHRpbW9kYWwtZW1iZWRkaW5ncycsXG4gICAgICAgIGJvZHk6IHNlYXJjaFF1ZXJ5XG4gICAgICB9KTtcblxuICAgICAgLy8gNC4g57WQ5p6c44Gu5b6M5Yem55CG44OV44Kj44Or44K/44Oq44Oz44KwXG4gICAgICBjb25zdCB7IGZpbHRlcmVkUmVzdWx0cywgYXVkaXRMb2cgfSA9IHRoaXMucGVybWlzc2lvbkVuZ2luZS5maWx0ZXJTZWFyY2hSZXN1bHRzKFxuICAgICAgICBzZWFyY2hSZXNwb25zZS5ib2R5LmhpdHMuaGl0cyxcbiAgICAgICAgcmVxdWVzdC51c2VyUGVybWlzc2lvblxuICAgICAgKTtcblxuICAgICAgLy8gNS4gUkFH57WQ5p6c5qeL56+JXG4gICAgICBjb25zdCByYWdSZXN1bHRzID0gZmlsdGVyZWRSZXN1bHRzLm1hcChoaXQgPT4gdGhpcy5idWlsZFJBR1Jlc3VsdChoaXQsIHJlcXVlc3QudXNlclBlcm1pc3Npb24pKTtcblxuICAgICAgLy8gNi4g44Kz44Oz44OG44Kt44K544OI55Sf5oiQ77yI44Kq44OX44K344On44Oz77yJXG4gICAgICBsZXQgZ2VuZXJhdGVkQ29udGV4dDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuICAgICAgaWYgKHJlcXVlc3Qub3B0aW9ucz8uaW5jbHVkZU1ldGFkYXRhICYmIHJhZ1Jlc3VsdHMubGVuZ3RoID4gMCkge1xuICAgICAgICBnZW5lcmF0ZWRDb250ZXh0ID0gYXdhaXQgdGhpcy5nZW5lcmF0ZUNvbnRleHQocmFnUmVzdWx0cywgcmVxdWVzdC5xdWVyeSk7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGV4ZWN1dGlvblRpbWVNcyA9IERhdGUubm93KCkgLSBzdGFydFRpbWU7XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIHJlc3VsdHM6IHJhZ1Jlc3VsdHMsXG4gICAgICAgIHRvdGFsSGl0czogc2VhcmNoUmVzcG9uc2UuYm9keS5oaXRzLnRvdGFsLnZhbHVlLFxuICAgICAgICBmaWx0ZXJlZEhpdHM6IHJhZ1Jlc3VsdHMubGVuZ3RoLFxuICAgICAgICBleGVjdXRpb25UaW1lTXMsXG4gICAgICAgIGF1ZGl0TG9nLFxuICAgICAgICBnZW5lcmF0ZWRDb250ZXh0XG4gICAgICB9O1xuXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgUkFH5qSc57Si44Ko44Op44O8OiAke2Vycm9yfWApO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDjgq/jgqjjg6pFbWJlZGRpbmfnlJ/miJBcbiAgICovXG4gIHByaXZhdGUgYXN5bmMgZ2VuZXJhdGVRdWVyeUVtYmVkZGluZyhxdWVyeTogc3RyaW5nLCBzZWFyY2hUeXBlOiBzdHJpbmcpOiBQcm9taXNlPG51bWJlcltdPiB7XG4gICAgY29uc3QgbW9kZWxJZCA9IHNlYXJjaFR5cGUgPT09ICdtdWx0aW1vZGFsJyBcbiAgICAgID8gJ2FtYXpvbi50aXRhbi1lbWJlZC1pbWFnZS12MSdcbiAgICAgIDogJ2FtYXpvbi50aXRhbi1lbWJlZC10ZXh0LXYyOjAnO1xuXG4gICAgY29uc3QgYm9keSA9IHNlYXJjaFR5cGUgPT09ICdtdWx0aW1vZGFsJ1xuICAgICAgPyBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgaW5wdXRUZXh0OiBxdWVyeSxcbiAgICAgICAgICBlbWJlZGRpbmdDb25maWc6IHsgb3V0cHV0RW1iZWRkaW5nTGVuZ3RoOiAxMDI0IH1cbiAgICAgICAgfSlcbiAgICAgIDogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgIGlucHV0VGV4dDogcXVlcnksXG4gICAgICAgICAgZGltZW5zaW9uczogMTAyNCxcbiAgICAgICAgICBub3JtYWxpemU6IHRydWVcbiAgICAgICAgfSk7XG5cbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IHRoaXMuYmVkcm9ja0NsaWVudC5pbnZva2VNb2RlbCh7XG4gICAgICBtb2RlbElkLFxuICAgICAgYm9keVxuICAgIH0pLnByb21pc2UoKTtcblxuICAgIGNvbnN0IHJlc3VsdCA9IEpTT04ucGFyc2UocmVzcG9uc2UuYm9keS50b1N0cmluZygpKTtcbiAgICByZXR1cm4gcmVzdWx0LmVtYmVkZGluZztcbiAgfVxuXG4gIC8qKlxuICAgKiBPcGVuU2VhcmNo5qSc57Si44Kv44Ko44Oq5qeL56+JXG4gICAqL1xuICBwcml2YXRlIGJ1aWxkU2VhcmNoUXVlcnkoXG4gICAgcXVlcnlFbWJlZGRpbmc6IG51bWJlcltdLFxuICAgIHBlcm1pc3Npb25GaWx0ZXI6IGFueSxcbiAgICBvcHRpb25zPzogUkFHU2VhcmNoUmVxdWVzdFsnb3B0aW9ucyddXG4gICk6IGFueSB7XG4gICAgY29uc3QgbWF4UmVzdWx0cyA9IG9wdGlvbnM/Lm1heFJlc3VsdHMgfHwgMTA7XG4gICAgY29uc3QgbWluU2NvcmUgPSBvcHRpb25zPy5taW5TY29yZSB8fCAwLjE7XG5cbiAgICByZXR1cm4ge1xuICAgICAgc2l6ZTogbWF4UmVzdWx0cyxcbiAgICAgIG1pbl9zY29yZTogbWluU2NvcmUsXG4gICAgICBxdWVyeToge1xuICAgICAgICBib29sOiB7XG4gICAgICAgICAgbXVzdDogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBrbm46IHtcbiAgICAgICAgICAgICAgICB0ZXh0X2VtYmVkZGluZ192ZWN0b3I6IHtcbiAgICAgICAgICAgICAgICAgIHZlY3RvcjogcXVlcnlFbWJlZGRpbmcsXG4gICAgICAgICAgICAgICAgICBrOiBtYXhSZXN1bHRzICogMiAvLyDmqKnpmZDjg5XjgqPjg6vjgr/jg6rjg7PjgrDjgpLogIPmha7jgZfjgablpJrjgoHjgavlj5blvpdcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICBdLFxuICAgICAgICAgIGZpbHRlcjogcGVybWlzc2lvbkZpbHRlci5ib29sID8gW3Blcm1pc3Npb25GaWx0ZXJdIDogW11cbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIF9zb3VyY2U6IHtcbiAgICAgICAgZXhjbHVkZXM6IFsndGV4dF9lbWJlZGRpbmdfdmVjdG9yJywgJ211bHRpbW9kYWxfZW1iZWRkaW5nX3ZlY3RvciddIC8vIOODmeOCr+ODiOODq+ODh+ODvOOCv+OBr+mZpOWkllxuICAgICAgfVxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogUkFH57WQ5p6c5qeL56+JXG4gICAqL1xuICBwcml2YXRlIGJ1aWxkUkFHUmVzdWx0KGhpdDogYW55LCB1c2VyUGVybWlzc2lvbjogVXNlclBlcm1pc3Npb24pOiBSQUdTZWFyY2hSZXN1bHQge1xuICAgIGNvbnN0IHNvdXJjZSA9IGhpdC5fc291cmNlO1xuICAgIGNvbnN0IGFjY2Vzc1Jlc3VsdCA9IHRoaXMucGVybWlzc2lvbkVuZ2luZS5jaGVja0RvY3VtZW50QWNjZXNzKHNvdXJjZSwgdXNlclBlcm1pc3Npb24pO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIGRvY3VtZW50SWQ6IHNvdXJjZS5kb2N1bWVudF9pZCxcbiAgICAgIHNjb3JlOiBoaXQuX3Njb3JlLFxuICAgICAgdGV4dENvbnRlbnQ6IHNvdXJjZS50ZXh0X2NvbnRlbnQsXG4gICAgICBmaWxlUGF0aDogc291cmNlLmZpbGVfcGF0aCxcbiAgICAgIG1ldGFkYXRhOiB7XG4gICAgICAgIGNvbnRlbnRUeXBlOiBzb3VyY2UuY29udGVudF90eXBlLFxuICAgICAgICBtb2RlbFZlcnNpb246IHNvdXJjZS5tb2RlbF92ZXJzaW9uLFxuICAgICAgICBjcmVhdGVkQXQ6IHNvdXJjZS5jcmVhdGVkX2F0LFxuICAgICAgICBvd25lcjogc291cmNlLm93bmVyXG4gICAgICB9LFxuICAgICAgcGVybWlzc2lvbkluZm86IHtcbiAgICAgICAgYWNjZXNzUmVhc29uOiBhY2Nlc3NSZXN1bHQucmVhc29uLFxuICAgICAgICBhcHBsaWVkUnVsZXM6IGFjY2Vzc1Jlc3VsdC5hcHBsaWVkUnVsZXNcbiAgICAgIH1cbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIOOCs+ODs+ODhuOCreOCueODiOeUn+aIkFxuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBnZW5lcmF0ZUNvbnRleHQocmVzdWx0czogUkFHU2VhcmNoUmVzdWx0W10sIHF1ZXJ5OiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZz4ge1xuICAgIGNvbnN0IGNvbnRleHRQYXJ0cyA9IHJlc3VsdHMuc2xpY2UoMCwgNSkubWFwKChyZXN1bHQsIGluZGV4KSA9PiBcbiAgICAgIGBb5paH5pu4JHtpbmRleCArIDF9XSAke3Jlc3VsdC50ZXh0Q29udGVudC5zdWJzdHJpbmcoMCwgMjAwKX0uLi5gXG4gICAgKTtcblxuICAgIHJldHVybiBg5qSc57Si44Kv44Ko44OqOiBcIiR7cXVlcnl9XCJcXG5cXG7plqLpgKPmlofmm7g6XFxuJHtjb250ZXh0UGFydHMuam9pbignXFxuXFxuJyl9YDtcbiAgfVxuXG4gIC8qKlxuICAgKiDmqKnpmZDntbHoqIjlj5blvpdcbiAgICovXG4gIHB1YmxpYyBnZXRQZXJtaXNzaW9uU3RhdGlzdGljcygpOiBhbnkge1xuICAgIHJldHVybiB0aGlzLnBlcm1pc3Npb25FbmdpbmUuZ2V0U3RhdGlzdGljcygpO1xuICB9XG59Il19