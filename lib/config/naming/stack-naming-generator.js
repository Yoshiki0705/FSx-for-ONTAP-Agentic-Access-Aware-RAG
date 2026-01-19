"use strict";
/**
 * スタック命名ジェネレーター
 * 統一された命名規則でスタック名を生成
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.StackNamingGenerator = void 0;
/**
 * スタック命名ジェネレータークラス
 */
class StackNamingGenerator {
    config;
    constructor(config) {
        this.config = {
            ...config,
            separator: config.separator || '-'
        };
    }
    /**
     * スタック名生成
     * パターン: {RegionPrefix}-{ProjectName}-{Environment}-{Component}
     */
    generateStackName(component) {
        const parts = [
            this.config.regionPrefix,
            this.config.projectName,
            this.config.environment,
            component
        ];
        return parts.join(this.config.separator);
    }
    /**
     * リソース命名設定生成
     */
    generateResourceNamingConfig() {
        const basePrefix = `${this.config.projectName}${this.config.separator}${this.config.environment}`;
        return {
            lambdaPrefix: `${basePrefix}${this.config.separator}`,
            dynamodbPrefix: `${basePrefix}${this.config.separator}`,
            s3Prefix: `${basePrefix}${this.config.separator}`,
            logGroupPrefix: `/aws/lambda/${basePrefix}${this.config.separator}`,
            iamRolePrefix: `${basePrefix}${this.config.separator}`
        };
    }
    /**
     * Lambda関数名生成
     */
    generateLambdaFunctionName(functionName) {
        const resourceConfig = this.generateResourceNamingConfig();
        return `${resourceConfig.lambdaPrefix}${functionName}`;
    }
    /**
     * DynamoDBテーブル名生成
     */
    generateDynamoDBTableName(tableName) {
        const resourceConfig = this.generateResourceNamingConfig();
        return `${resourceConfig.dynamodbPrefix}${tableName}`;
    }
    /**
     * S3バケット名生成
     */
    generateS3BucketName(bucketName) {
        const resourceConfig = this.generateResourceNamingConfig();
        // S3バケット名は小文字のみ
        return `${resourceConfig.s3Prefix}${bucketName}`.toLowerCase();
    }
    /**
     * CloudWatch LogGroup名生成
     */
    generateLogGroupName(functionName) {
        const resourceConfig = this.generateResourceNamingConfig();
        return `${resourceConfig.logGroupPrefix}${functionName}`;
    }
    /**
     * IAMロール名生成
     */
    generateIAMRoleName(roleName) {
        const resourceConfig = this.generateResourceNamingConfig();
        return `${resourceConfig.iamRolePrefix}${roleName}`;
    }
    /**
     * 設定情報取得
     */
    getConfig() {
        return { ...this.config };
    }
}
exports.StackNamingGenerator = StackNamingGenerator;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RhY2stbmFtaW5nLWdlbmVyYXRvci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInN0YWNrLW5hbWluZy1nZW5lcmF0b3IudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7R0FHRzs7O0FBSUg7O0dBRUc7QUFDSCxNQUFhLG9CQUFvQjtJQUN2QixNQUFNLENBQWU7SUFFN0IsWUFBWSxNQUFvQjtRQUM5QixJQUFJLENBQUMsTUFBTSxHQUFHO1lBQ1osR0FBRyxNQUFNO1lBQ1QsU0FBUyxFQUFFLE1BQU0sQ0FBQyxTQUFTLElBQUksR0FBRztTQUNuQyxDQUFDO0lBQ0osQ0FBQztJQUVEOzs7T0FHRztJQUNILGlCQUFpQixDQUFDLFNBQXlCO1FBQ3pDLE1BQU0sS0FBSyxHQUFHO1lBQ1osSUFBSSxDQUFDLE1BQU0sQ0FBQyxZQUFZO1lBQ3hCLElBQUksQ0FBQyxNQUFNLENBQUMsV0FBVztZQUN2QixJQUFJLENBQUMsTUFBTSxDQUFDLFdBQVc7WUFDdkIsU0FBUztTQUNWLENBQUM7UUFFRixPQUFPLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQztJQUMzQyxDQUFDO0lBRUQ7O09BRUc7SUFDSCw0QkFBNEI7UUFDMUIsTUFBTSxVQUFVLEdBQUcsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLFdBQVcsRUFBRSxDQUFDO1FBRWxHLE9BQU87WUFDTCxZQUFZLEVBQUUsR0FBRyxVQUFVLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxTQUFTLEVBQUU7WUFDckQsY0FBYyxFQUFFLEdBQUcsVUFBVSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsU0FBUyxFQUFFO1lBQ3ZELFFBQVEsRUFBRSxHQUFHLFVBQVUsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLFNBQVMsRUFBRTtZQUNqRCxjQUFjLEVBQUUsZUFBZSxVQUFVLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxTQUFTLEVBQUU7WUFDbkUsYUFBYSxFQUFFLEdBQUcsVUFBVSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsU0FBUyxFQUFFO1NBQ3ZELENBQUM7SUFDSixDQUFDO0lBRUQ7O09BRUc7SUFDSCwwQkFBMEIsQ0FBQyxZQUFvQjtRQUM3QyxNQUFNLGNBQWMsR0FBRyxJQUFJLENBQUMsNEJBQTRCLEVBQUUsQ0FBQztRQUMzRCxPQUFPLEdBQUcsY0FBYyxDQUFDLFlBQVksR0FBRyxZQUFZLEVBQUUsQ0FBQztJQUN6RCxDQUFDO0lBRUQ7O09BRUc7SUFDSCx5QkFBeUIsQ0FBQyxTQUFpQjtRQUN6QyxNQUFNLGNBQWMsR0FBRyxJQUFJLENBQUMsNEJBQTRCLEVBQUUsQ0FBQztRQUMzRCxPQUFPLEdBQUcsY0FBYyxDQUFDLGNBQWMsR0FBRyxTQUFTLEVBQUUsQ0FBQztJQUN4RCxDQUFDO0lBRUQ7O09BRUc7SUFDSCxvQkFBb0IsQ0FBQyxVQUFrQjtRQUNyQyxNQUFNLGNBQWMsR0FBRyxJQUFJLENBQUMsNEJBQTRCLEVBQUUsQ0FBQztRQUMzRCxnQkFBZ0I7UUFDaEIsT0FBTyxHQUFHLGNBQWMsQ0FBQyxRQUFRLEdBQUcsVUFBVSxFQUFFLENBQUMsV0FBVyxFQUFFLENBQUM7SUFDakUsQ0FBQztJQUVEOztPQUVHO0lBQ0gsb0JBQW9CLENBQUMsWUFBb0I7UUFDdkMsTUFBTSxjQUFjLEdBQUcsSUFBSSxDQUFDLDRCQUE0QixFQUFFLENBQUM7UUFDM0QsT0FBTyxHQUFHLGNBQWMsQ0FBQyxjQUFjLEdBQUcsWUFBWSxFQUFFLENBQUM7SUFDM0QsQ0FBQztJQUVEOztPQUVHO0lBQ0gsbUJBQW1CLENBQUMsUUFBZ0I7UUFDbEMsTUFBTSxjQUFjLEdBQUcsSUFBSSxDQUFDLDRCQUE0QixFQUFFLENBQUM7UUFDM0QsT0FBTyxHQUFHLGNBQWMsQ0FBQyxhQUFhLEdBQUcsUUFBUSxFQUFFLENBQUM7SUFDdEQsQ0FBQztJQUVEOztPQUVHO0lBQ0gsU0FBUztRQUNQLE9BQU8sRUFBRSxHQUFHLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztJQUM1QixDQUFDO0NBQ0Y7QUF2RkQsb0RBdUZDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiDjgrnjgr/jg4Pjgq/lkb3lkI3jgrjjgqfjg43jg6zjg7zjgr/jg7xcbiAqIOe1seS4gOOBleOCjOOBn+WRveWQjeimj+WJh+OBp+OCueOCv+ODg+OCr+WQjeOCkueUn+aIkFxuICovXG5cbmltcG9ydCB7IE5hbWluZ0NvbmZpZywgU3RhY2tDb21wb25lbnQsIFJlc291cmNlTmFtaW5nQ29uZmlnIH0gZnJvbSAnLi4vaW50ZXJmYWNlcy9uYW1pbmctY29uZmlnJztcblxuLyoqXG4gKiDjgrnjgr/jg4Pjgq/lkb3lkI3jgrjjgqfjg43jg6zjg7zjgr/jg7zjgq/jg6njgrlcbiAqL1xuZXhwb3J0IGNsYXNzIFN0YWNrTmFtaW5nR2VuZXJhdG9yIHtcbiAgcHJpdmF0ZSBjb25maWc6IE5hbWluZ0NvbmZpZztcbiAgXG4gIGNvbnN0cnVjdG9yKGNvbmZpZzogTmFtaW5nQ29uZmlnKSB7XG4gICAgdGhpcy5jb25maWcgPSB7XG4gICAgICAuLi5jb25maWcsXG4gICAgICBzZXBhcmF0b3I6IGNvbmZpZy5zZXBhcmF0b3IgfHwgJy0nXG4gICAgfTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOOCueOCv+ODg+OCr+WQjeeUn+aIkFxuICAgKiDjg5Hjgr/jg7zjg7M6IHtSZWdpb25QcmVmaXh9LXtQcm9qZWN0TmFtZX0te0Vudmlyb25tZW50fS17Q29tcG9uZW50fVxuICAgKi9cbiAgZ2VuZXJhdGVTdGFja05hbWUoY29tcG9uZW50OiBTdGFja0NvbXBvbmVudCk6IHN0cmluZyB7XG4gICAgY29uc3QgcGFydHMgPSBbXG4gICAgICB0aGlzLmNvbmZpZy5yZWdpb25QcmVmaXgsXG4gICAgICB0aGlzLmNvbmZpZy5wcm9qZWN0TmFtZSxcbiAgICAgIHRoaXMuY29uZmlnLmVudmlyb25tZW50LFxuICAgICAgY29tcG9uZW50XG4gICAgXTtcbiAgICBcbiAgICByZXR1cm4gcGFydHMuam9pbih0aGlzLmNvbmZpZy5zZXBhcmF0b3IpO1xuICB9XG4gIFxuICAvKipcbiAgICog44Oq44K944O844K55ZG95ZCN6Kit5a6a55Sf5oiQXG4gICAqL1xuICBnZW5lcmF0ZVJlc291cmNlTmFtaW5nQ29uZmlnKCk6IFJlc291cmNlTmFtaW5nQ29uZmlnIHtcbiAgICBjb25zdCBiYXNlUHJlZml4ID0gYCR7dGhpcy5jb25maWcucHJvamVjdE5hbWV9JHt0aGlzLmNvbmZpZy5zZXBhcmF0b3J9JHt0aGlzLmNvbmZpZy5lbnZpcm9ubWVudH1gO1xuICAgIFxuICAgIHJldHVybiB7XG4gICAgICBsYW1iZGFQcmVmaXg6IGAke2Jhc2VQcmVmaXh9JHt0aGlzLmNvbmZpZy5zZXBhcmF0b3J9YCxcbiAgICAgIGR5bmFtb2RiUHJlZml4OiBgJHtiYXNlUHJlZml4fSR7dGhpcy5jb25maWcuc2VwYXJhdG9yfWAsXG4gICAgICBzM1ByZWZpeDogYCR7YmFzZVByZWZpeH0ke3RoaXMuY29uZmlnLnNlcGFyYXRvcn1gLFxuICAgICAgbG9nR3JvdXBQcmVmaXg6IGAvYXdzL2xhbWJkYS8ke2Jhc2VQcmVmaXh9JHt0aGlzLmNvbmZpZy5zZXBhcmF0b3J9YCxcbiAgICAgIGlhbVJvbGVQcmVmaXg6IGAke2Jhc2VQcmVmaXh9JHt0aGlzLmNvbmZpZy5zZXBhcmF0b3J9YFxuICAgIH07XG4gIH1cbiAgXG4gIC8qKlxuICAgKiBMYW1iZGHplqLmlbDlkI3nlJ/miJBcbiAgICovXG4gIGdlbmVyYXRlTGFtYmRhRnVuY3Rpb25OYW1lKGZ1bmN0aW9uTmFtZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgICBjb25zdCByZXNvdXJjZUNvbmZpZyA9IHRoaXMuZ2VuZXJhdGVSZXNvdXJjZU5hbWluZ0NvbmZpZygpO1xuICAgIHJldHVybiBgJHtyZXNvdXJjZUNvbmZpZy5sYW1iZGFQcmVmaXh9JHtmdW5jdGlvbk5hbWV9YDtcbiAgfVxuICBcbiAgLyoqXG4gICAqIER5bmFtb0RC44OG44O844OW44Or5ZCN55Sf5oiQXG4gICAqL1xuICBnZW5lcmF0ZUR5bmFtb0RCVGFibGVOYW1lKHRhYmxlTmFtZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgICBjb25zdCByZXNvdXJjZUNvbmZpZyA9IHRoaXMuZ2VuZXJhdGVSZXNvdXJjZU5hbWluZ0NvbmZpZygpO1xuICAgIHJldHVybiBgJHtyZXNvdXJjZUNvbmZpZy5keW5hbW9kYlByZWZpeH0ke3RhYmxlTmFtZX1gO1xuICB9XG4gIFxuICAvKipcbiAgICogUzPjg5DjgrHjg4Pjg4jlkI3nlJ/miJBcbiAgICovXG4gIGdlbmVyYXRlUzNCdWNrZXROYW1lKGJ1Y2tldE5hbWU6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgY29uc3QgcmVzb3VyY2VDb25maWcgPSB0aGlzLmdlbmVyYXRlUmVzb3VyY2VOYW1pbmdDb25maWcoKTtcbiAgICAvLyBTM+ODkOOCseODg+ODiOWQjeOBr+Wwj+aWh+Wtl+OBruOBv1xuICAgIHJldHVybiBgJHtyZXNvdXJjZUNvbmZpZy5zM1ByZWZpeH0ke2J1Y2tldE5hbWV9YC50b0xvd2VyQ2FzZSgpO1xuICB9XG4gIFxuICAvKipcbiAgICogQ2xvdWRXYXRjaCBMb2dHcm91cOWQjeeUn+aIkFxuICAgKi9cbiAgZ2VuZXJhdGVMb2dHcm91cE5hbWUoZnVuY3Rpb25OYW1lOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIGNvbnN0IHJlc291cmNlQ29uZmlnID0gdGhpcy5nZW5lcmF0ZVJlc291cmNlTmFtaW5nQ29uZmlnKCk7XG4gICAgcmV0dXJuIGAke3Jlc291cmNlQ29uZmlnLmxvZ0dyb3VwUHJlZml4fSR7ZnVuY3Rpb25OYW1lfWA7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiBJQU3jg63jg7zjg6vlkI3nlJ/miJBcbiAgICovXG4gIGdlbmVyYXRlSUFNUm9sZU5hbWUocm9sZU5hbWU6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgY29uc3QgcmVzb3VyY2VDb25maWcgPSB0aGlzLmdlbmVyYXRlUmVzb3VyY2VOYW1pbmdDb25maWcoKTtcbiAgICByZXR1cm4gYCR7cmVzb3VyY2VDb25maWcuaWFtUm9sZVByZWZpeH0ke3JvbGVOYW1lfWA7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDoqK3lrprmg4XloLHlj5blvpdcbiAgICovXG4gIGdldENvbmZpZygpOiBOYW1pbmdDb25maWcge1xuICAgIHJldHVybiB7IC4uLnRoaXMuY29uZmlnIH07XG4gIH1cbn0iXX0=