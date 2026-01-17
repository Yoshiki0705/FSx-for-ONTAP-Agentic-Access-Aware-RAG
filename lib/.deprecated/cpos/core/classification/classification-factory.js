"use strict";
/**
 * Classification Engine Factory
 * 分類エンジンのファクトリークラス
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClassificationEngineFactory = void 0;
const index_1 = require("./index");
class ClassificationEngineFactory {
    /**
     * デフォルト設定で分類エンジンを作成
     */
    static createDefault() {
        const defaultConfig = {
            rulesFile: './config/classification-rules.json',
            defaultConfidenceThreshold: 0.7,
            maxContentAnalysisSize: 1024 * 1024, // 1MB
            enableContentAnalysis: true,
            enableLearning: true
        };
        return new index_1.ClassificationEngine(defaultConfig);
    }
    /**
     * CPOS設定から分類エンジンを作成
     */
    static createFromConfig(cposConfig) {
        const config = {
            rulesFile: cposConfig.classification.rules,
            defaultConfidenceThreshold: cposConfig.classification.confidence,
            maxContentAnalysisSize: 1024 * 1024, // 1MB
            enableContentAnalysis: true,
            enableLearning: true
        };
        return new index_1.ClassificationEngine(config);
    }
    /**
     * カスタム設定で分類エンジンを作成
     */
    static createCustom(config) {
        const defaultConfig = {
            rulesFile: './config/classification-rules.json',
            defaultConfidenceThreshold: 0.7,
            maxContentAnalysisSize: 1024 * 1024,
            enableContentAnalysis: true,
            enableLearning: true
        };
        const mergedConfig = {
            ...defaultConfig,
            ...config
        };
        return new index_1.ClassificationEngine(mergedConfig);
    }
    /**
     * 高速分類エンジンを作成（内容解析無効）
     */
    static createFast() {
        const config = {
            rulesFile: './config/classification-rules.json',
            defaultConfidenceThreshold: 0.6,
            maxContentAnalysisSize: 0,
            enableContentAnalysis: false,
            enableLearning: false
        };
        return new index_1.ClassificationEngine(config);
    }
    /**
     * 学習機能付き分類エンジンを作成
     */
    static createWithLearning() {
        const config = {
            rulesFile: './config/classification-rules.json',
            defaultConfidenceThreshold: 0.8,
            maxContentAnalysisSize: 2 * 1024 * 1024, // 2MB
            enableContentAnalysis: true,
            enableLearning: true
        };
        return new index_1.ClassificationEngine(config);
    }
    /**
     * 特定のファイルタイプ用分類エンジンを作成
     */
    static createForFileType(fileType) {
        const baseConfig = {
            rulesFile: `./config/classification-rules-${fileType}.json`,
            defaultConfidenceThreshold: 0.8,
            maxContentAnalysisSize: 1024 * 1024,
            enableContentAnalysis: true,
            enableLearning: true
        };
        return new index_1.ClassificationEngine(baseConfig);
    }
}
exports.ClassificationEngineFactory = ClassificationEngineFactory;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xhc3NpZmljYXRpb24tZmFjdG9yeS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImNsYXNzaWZpY2F0aW9uLWZhY3RvcnkudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7R0FHRzs7O0FBRUgsbUNBQXFFO0FBR3JFLE1BQWEsMkJBQTJCO0lBQ3RDOztPQUVHO0lBQ0gsTUFBTSxDQUFDLGFBQWE7UUFDbEIsTUFBTSxhQUFhLEdBQXlCO1lBQzFDLFNBQVMsRUFBRSxvQ0FBb0M7WUFDL0MsMEJBQTBCLEVBQUUsR0FBRztZQUMvQixzQkFBc0IsRUFBRSxJQUFJLEdBQUcsSUFBSSxFQUFFLE1BQU07WUFDM0MscUJBQXFCLEVBQUUsSUFBSTtZQUMzQixjQUFjLEVBQUUsSUFBSTtTQUNyQixDQUFDO1FBRUYsT0FBTyxJQUFJLDRCQUFvQixDQUFDLGFBQWEsQ0FBQyxDQUFDO0lBQ2pELENBQUM7SUFFRDs7T0FFRztJQUNILE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxVQUFzQjtRQUM1QyxNQUFNLE1BQU0sR0FBeUI7WUFDbkMsU0FBUyxFQUFFLFVBQVUsQ0FBQyxjQUFjLENBQUMsS0FBSztZQUMxQywwQkFBMEIsRUFBRSxVQUFVLENBQUMsY0FBYyxDQUFDLFVBQVU7WUFDaEUsc0JBQXNCLEVBQUUsSUFBSSxHQUFHLElBQUksRUFBRSxNQUFNO1lBQzNDLHFCQUFxQixFQUFFLElBQUk7WUFDM0IsY0FBYyxFQUFFLElBQUk7U0FDckIsQ0FBQztRQUVGLE9BQU8sSUFBSSw0QkFBb0IsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUMxQyxDQUFDO0lBRUQ7O09BRUc7SUFDSCxNQUFNLENBQUMsWUFBWSxDQUFDLE1BQXFDO1FBQ3ZELE1BQU0sYUFBYSxHQUF5QjtZQUMxQyxTQUFTLEVBQUUsb0NBQW9DO1lBQy9DLDBCQUEwQixFQUFFLEdBQUc7WUFDL0Isc0JBQXNCLEVBQUUsSUFBSSxHQUFHLElBQUk7WUFDbkMscUJBQXFCLEVBQUUsSUFBSTtZQUMzQixjQUFjLEVBQUUsSUFBSTtTQUNyQixDQUFDO1FBRUYsTUFBTSxZQUFZLEdBQXlCO1lBQ3pDLEdBQUcsYUFBYTtZQUNoQixHQUFHLE1BQU07U0FDVixDQUFDO1FBRUYsT0FBTyxJQUFJLDRCQUFvQixDQUFDLFlBQVksQ0FBQyxDQUFDO0lBQ2hELENBQUM7SUFFRDs7T0FFRztJQUNILE1BQU0sQ0FBQyxVQUFVO1FBQ2YsTUFBTSxNQUFNLEdBQXlCO1lBQ25DLFNBQVMsRUFBRSxvQ0FBb0M7WUFDL0MsMEJBQTBCLEVBQUUsR0FBRztZQUMvQixzQkFBc0IsRUFBRSxDQUFDO1lBQ3pCLHFCQUFxQixFQUFFLEtBQUs7WUFDNUIsY0FBYyxFQUFFLEtBQUs7U0FDdEIsQ0FBQztRQUVGLE9BQU8sSUFBSSw0QkFBb0IsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUMxQyxDQUFDO0lBRUQ7O09BRUc7SUFDSCxNQUFNLENBQUMsa0JBQWtCO1FBQ3ZCLE1BQU0sTUFBTSxHQUF5QjtZQUNuQyxTQUFTLEVBQUUsb0NBQW9DO1lBQy9DLDBCQUEwQixFQUFFLEdBQUc7WUFDL0Isc0JBQXNCLEVBQUUsQ0FBQyxHQUFHLElBQUksR0FBRyxJQUFJLEVBQUUsTUFBTTtZQUMvQyxxQkFBcUIsRUFBRSxJQUFJO1lBQzNCLGNBQWMsRUFBRSxJQUFJO1NBQ3JCLENBQUM7UUFFRixPQUFPLElBQUksNEJBQW9CLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDMUMsQ0FBQztJQUVEOztPQUVHO0lBQ0gsTUFBTSxDQUFDLGlCQUFpQixDQUFDLFFBQTZDO1FBQ3BFLE1BQU0sVUFBVSxHQUF5QjtZQUN2QyxTQUFTLEVBQUUsaUNBQWlDLFFBQVEsT0FBTztZQUMzRCwwQkFBMEIsRUFBRSxHQUFHO1lBQy9CLHNCQUFzQixFQUFFLElBQUksR0FBRyxJQUFJO1lBQ25DLHFCQUFxQixFQUFFLElBQUk7WUFDM0IsY0FBYyxFQUFFLElBQUk7U0FDckIsQ0FBQztRQUVGLE9BQU8sSUFBSSw0QkFBb0IsQ0FBQyxVQUFVLENBQUMsQ0FBQztJQUM5QyxDQUFDO0NBQ0Y7QUEvRkQsa0VBK0ZDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBDbGFzc2lmaWNhdGlvbiBFbmdpbmUgRmFjdG9yeVxuICog5YiG6aGe44Ko44Oz44K444Oz44Gu44OV44Kh44Kv44OI44Oq44O844Kv44Op44K5XG4gKi9cblxuaW1wb3J0IHsgQ2xhc3NpZmljYXRpb25FbmdpbmUsIENsYXNzaWZpY2F0aW9uQ29uZmlnIH0gZnJvbSAnLi9pbmRleCc7XG5pbXBvcnQgeyBDUE9TQ29uZmlnIH0gZnJvbSAnLi4vY29uZmlndXJhdGlvbic7XG5cbmV4cG9ydCBjbGFzcyBDbGFzc2lmaWNhdGlvbkVuZ2luZUZhY3Rvcnkge1xuICAvKipcbiAgICog44OH44OV44Kp44Or44OI6Kit5a6a44Gn5YiG6aGe44Ko44Oz44K444Oz44KS5L2c5oiQXG4gICAqL1xuICBzdGF0aWMgY3JlYXRlRGVmYXVsdCgpOiBDbGFzc2lmaWNhdGlvbkVuZ2luZSB7XG4gICAgY29uc3QgZGVmYXVsdENvbmZpZzogQ2xhc3NpZmljYXRpb25Db25maWcgPSB7XG4gICAgICBydWxlc0ZpbGU6ICcuL2NvbmZpZy9jbGFzc2lmaWNhdGlvbi1ydWxlcy5qc29uJyxcbiAgICAgIGRlZmF1bHRDb25maWRlbmNlVGhyZXNob2xkOiAwLjcsXG4gICAgICBtYXhDb250ZW50QW5hbHlzaXNTaXplOiAxMDI0ICogMTAyNCwgLy8gMU1CXG4gICAgICBlbmFibGVDb250ZW50QW5hbHlzaXM6IHRydWUsXG4gICAgICBlbmFibGVMZWFybmluZzogdHJ1ZVxuICAgIH07XG5cbiAgICByZXR1cm4gbmV3IENsYXNzaWZpY2F0aW9uRW5naW5lKGRlZmF1bHRDb25maWcpO1xuICB9XG5cbiAgLyoqXG4gICAqIENQT1PoqK3lrprjgYvjgonliIbpoZ7jgqjjg7Pjgrjjg7PjgpLkvZzmiJBcbiAgICovXG4gIHN0YXRpYyBjcmVhdGVGcm9tQ29uZmlnKGNwb3NDb25maWc6IENQT1NDb25maWcpOiBDbGFzc2lmaWNhdGlvbkVuZ2luZSB7XG4gICAgY29uc3QgY29uZmlnOiBDbGFzc2lmaWNhdGlvbkNvbmZpZyA9IHtcbiAgICAgIHJ1bGVzRmlsZTogY3Bvc0NvbmZpZy5jbGFzc2lmaWNhdGlvbi5ydWxlcyxcbiAgICAgIGRlZmF1bHRDb25maWRlbmNlVGhyZXNob2xkOiBjcG9zQ29uZmlnLmNsYXNzaWZpY2F0aW9uLmNvbmZpZGVuY2UsXG4gICAgICBtYXhDb250ZW50QW5hbHlzaXNTaXplOiAxMDI0ICogMTAyNCwgLy8gMU1CXG4gICAgICBlbmFibGVDb250ZW50QW5hbHlzaXM6IHRydWUsXG4gICAgICBlbmFibGVMZWFybmluZzogdHJ1ZVxuICAgIH07XG5cbiAgICByZXR1cm4gbmV3IENsYXNzaWZpY2F0aW9uRW5naW5lKGNvbmZpZyk7XG4gIH1cblxuICAvKipcbiAgICog44Kr44K544K/44Og6Kit5a6a44Gn5YiG6aGe44Ko44Oz44K444Oz44KS5L2c5oiQXG4gICAqL1xuICBzdGF0aWMgY3JlYXRlQ3VzdG9tKGNvbmZpZzogUGFydGlhbDxDbGFzc2lmaWNhdGlvbkNvbmZpZz4pOiBDbGFzc2lmaWNhdGlvbkVuZ2luZSB7XG4gICAgY29uc3QgZGVmYXVsdENvbmZpZzogQ2xhc3NpZmljYXRpb25Db25maWcgPSB7XG4gICAgICBydWxlc0ZpbGU6ICcuL2NvbmZpZy9jbGFzc2lmaWNhdGlvbi1ydWxlcy5qc29uJyxcbiAgICAgIGRlZmF1bHRDb25maWRlbmNlVGhyZXNob2xkOiAwLjcsXG4gICAgICBtYXhDb250ZW50QW5hbHlzaXNTaXplOiAxMDI0ICogMTAyNCxcbiAgICAgIGVuYWJsZUNvbnRlbnRBbmFseXNpczogdHJ1ZSxcbiAgICAgIGVuYWJsZUxlYXJuaW5nOiB0cnVlXG4gICAgfTtcblxuICAgIGNvbnN0IG1lcmdlZENvbmZpZzogQ2xhc3NpZmljYXRpb25Db25maWcgPSB7XG4gICAgICAuLi5kZWZhdWx0Q29uZmlnLFxuICAgICAgLi4uY29uZmlnXG4gICAgfTtcblxuICAgIHJldHVybiBuZXcgQ2xhc3NpZmljYXRpb25FbmdpbmUobWVyZ2VkQ29uZmlnKTtcbiAgfVxuXG4gIC8qKlxuICAgKiDpq5jpgJ/liIbpoZ7jgqjjg7Pjgrjjg7PjgpLkvZzmiJDvvIjlhoXlrrnop6PmnpDnhKHlirnvvIlcbiAgICovXG4gIHN0YXRpYyBjcmVhdGVGYXN0KCk6IENsYXNzaWZpY2F0aW9uRW5naW5lIHtcbiAgICBjb25zdCBjb25maWc6IENsYXNzaWZpY2F0aW9uQ29uZmlnID0ge1xuICAgICAgcnVsZXNGaWxlOiAnLi9jb25maWcvY2xhc3NpZmljYXRpb24tcnVsZXMuanNvbicsXG4gICAgICBkZWZhdWx0Q29uZmlkZW5jZVRocmVzaG9sZDogMC42LFxuICAgICAgbWF4Q29udGVudEFuYWx5c2lzU2l6ZTogMCxcbiAgICAgIGVuYWJsZUNvbnRlbnRBbmFseXNpczogZmFsc2UsXG4gICAgICBlbmFibGVMZWFybmluZzogZmFsc2VcbiAgICB9O1xuXG4gICAgcmV0dXJuIG5ldyBDbGFzc2lmaWNhdGlvbkVuZ2luZShjb25maWcpO1xuICB9XG5cbiAgLyoqXG4gICAqIOWtpue/kuapn+iDveS7mOOBjeWIhumhnuOCqOODs+OCuOODs+OCkuS9nOaIkFxuICAgKi9cbiAgc3RhdGljIGNyZWF0ZVdpdGhMZWFybmluZygpOiBDbGFzc2lmaWNhdGlvbkVuZ2luZSB7XG4gICAgY29uc3QgY29uZmlnOiBDbGFzc2lmaWNhdGlvbkNvbmZpZyA9IHtcbiAgICAgIHJ1bGVzRmlsZTogJy4vY29uZmlnL2NsYXNzaWZpY2F0aW9uLXJ1bGVzLmpzb24nLFxuICAgICAgZGVmYXVsdENvbmZpZGVuY2VUaHJlc2hvbGQ6IDAuOCxcbiAgICAgIG1heENvbnRlbnRBbmFseXNpc1NpemU6IDIgKiAxMDI0ICogMTAyNCwgLy8gMk1CXG4gICAgICBlbmFibGVDb250ZW50QW5hbHlzaXM6IHRydWUsXG4gICAgICBlbmFibGVMZWFybmluZzogdHJ1ZVxuICAgIH07XG5cbiAgICByZXR1cm4gbmV3IENsYXNzaWZpY2F0aW9uRW5naW5lKGNvbmZpZyk7XG4gIH1cblxuICAvKipcbiAgICog54m55a6a44Gu44OV44Kh44Kk44Or44K/44Kk44OX55So5YiG6aGe44Ko44Oz44K444Oz44KS5L2c5oiQXG4gICAqL1xuICBzdGF0aWMgY3JlYXRlRm9yRmlsZVR5cGUoZmlsZVR5cGU6ICdjb2RlJyB8ICdkb2NzJyB8ICdjb25maWcnIHwgJ3Rlc3QnKTogQ2xhc3NpZmljYXRpb25FbmdpbmUge1xuICAgIGNvbnN0IGJhc2VDb25maWc6IENsYXNzaWZpY2F0aW9uQ29uZmlnID0ge1xuICAgICAgcnVsZXNGaWxlOiBgLi9jb25maWcvY2xhc3NpZmljYXRpb24tcnVsZXMtJHtmaWxlVHlwZX0uanNvbmAsXG4gICAgICBkZWZhdWx0Q29uZmlkZW5jZVRocmVzaG9sZDogMC44LFxuICAgICAgbWF4Q29udGVudEFuYWx5c2lzU2l6ZTogMTAyNCAqIDEwMjQsXG4gICAgICBlbmFibGVDb250ZW50QW5hbHlzaXM6IHRydWUsXG4gICAgICBlbmFibGVMZWFybmluZzogdHJ1ZVxuICAgIH07XG5cbiAgICByZXR1cm4gbmV3IENsYXNzaWZpY2F0aW9uRW5naW5lKGJhc2VDb25maWcpO1xuICB9XG59Il19