"use strict";
/**
 * 統合ファイル整理システム - ディレクトリ構造作成
 *
 * Agent Steering file-placement-guidelinesに準拠した
 * 統一ディレクトリ構造を作成する機能を提供します。
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DirectoryCreator = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const index_js_1 = require("../types/index.js");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
/**
 * ディレクトリ構造作成
 *
 * Agent Steering準拠のディレクトリ構造を両環境で作成し、
 * 適切な権限設定を行います。
 */
class DirectoryCreator {
    config;
    sshConfig;
    constructor(config, sshConfig) {
        this.config = config;
        this.sshConfig = sshConfig;
    }
    /**
     * ローカル環境でディレクトリ構造を作成
     */
    async createLocalDirectoryStructure(basePath = '.') {
        const startTime = Date.now();
        console.log(`📁 ローカル環境でディレクトリ構造を作成中: ${basePath}`);
        try {
            const createdPaths = [];
            const errors = [];
            // 必須ディレクトリの作成
            const requiredDirectories = this.getRequiredDirectories();
            for (const dirPath of requiredDirectories) {
                try {
                    const fullPath = path.resolve(basePath, dirPath);
                    await fs.mkdir(fullPath, { recursive: true });
                    // 権限設定
                    await this.setLocalDirectoryPermissions(fullPath, dirPath);
                    createdPaths.push(fullPath);
                    console.log(`✅ ディレクトリ作成: ${dirPath}`);
                }
                catch (error) {
                    const errorMsg = `ディレクトリ作成エラー: ${dirPath} - ${error}`;
                    errors.push(errorMsg);
                    console.warn(errorMsg);
                }
            }
            // README ファイルの作成
            await this.createDirectoryReadmeFiles(basePath, 'local', errors);
            const processingTime = Date.now() - startTime;
            console.log(`✅ ローカルディレクトリ構造作成完了: ${createdPaths.length}個 (${processingTime}ms)`);
            return {
                createdDirectories: createdPaths.length,
                createdPaths,
                errors,
                success: errors.length === 0,
                environment: 'local',
                processingTime
            };
        }
        catch (error) {
            throw new index_js_1.OrganizationError(index_js_1.OrganizationErrorType.MOVE_FAILED, `ローカルディレクトリ構造作成に失敗しました: ${error}`, basePath, 'local', error);
        }
    }
    /**
     * EC2環境でディレクトリ構造を作成
     */
    async createEC2DirectoryStructure(basePath) {
        if (!this.sshConfig) {
            throw new index_js_1.OrganizationError(index_js_1.OrganizationErrorType.SSH_CONNECTION_FAILED, 'SSH設定が提供されていません', undefined, 'ec2');
        }
        const startTime = Date.now();
        console.log(`📁 EC2環境でディレクトリ構造を作成中: ${basePath}`);
        try {
            const createdPaths = [];
            const errors = [];
            // 必須ディレクトリの作成
            const requiredDirectories = this.getRequiredDirectories();
            for (const dirPath of requiredDirectories) {
                try {
                    const fullPath = path.posix.join(basePath, dirPath);
                    await this.executeSSHCommand(`mkdir -p "${fullPath}"`);
                    // 権限設定
                    await this.setEC2DirectoryPermissions(fullPath, dirPath);
                    createdPaths.push(fullPath);
                    console.log(`✅ EC2ディレクトリ作成: ${dirPath}`);
                }
                catch (error) {
                    const errorMsg = `EC2ディレクトリ作成エラー: ${dirPath} - ${error}`;
                    errors.push(errorMsg);
                    console.warn(errorMsg);
                }
            }
            // README ファイルの作成
            await this.createDirectoryReadmeFiles(basePath, 'ec2', errors);
            const processingTime = Date.now() - startTime;
            console.log(`✅ EC2ディレクトリ構造作成完了: ${createdPaths.length}個 (${processingTime}ms)`);
            return {
                createdDirectories: createdPaths.length,
                createdPaths,
                errors,
                success: errors.length === 0,
                environment: 'ec2',
                processingTime
            };
        }
        catch (error) {
            throw new index_js_1.OrganizationError(index_js_1.OrganizationErrorType.SSH_CONNECTION_FAILED, `EC2ディレクトリ構造作成に失敗しました: ${error}`, basePath, 'ec2', error);
        }
    }
    /**
     * 統合ディレクトリ構造作成
     */
    async createIntegratedDirectoryStructure(localBasePath = '.', ec2BasePath) {
        console.log('🏗️  統合ディレクトリ構造を作成中...');
        try {
            // 並列でディレクトリ構造を作成
            const [localResult, ec2Result] = await Promise.allSettled([
                this.createLocalDirectoryStructure(localBasePath),
                this.createEC2DirectoryStructure(ec2BasePath)
            ]);
            const local = localResult.status === 'fulfilled' ? localResult.value :
                this.createErrorResult('local', localResult.reason);
            const ec2 = ec2Result.status === 'fulfilled' ? ec2Result.value :
                this.createErrorResult('ec2', ec2Result.reason);
            const success = local.success && ec2.success;
            console.log(`✅ 統合ディレクトリ構造作成完了: ${success ? '成功' : '部分的成功'}`);
            return { local, ec2, success };
        }
        catch (error) {
            throw new index_js_1.OrganizationError(index_js_1.OrganizationErrorType.MOVE_FAILED, `統合ディレクトリ構造作成に失敗しました: ${error}`, undefined, undefined, error);
        }
    }
    /**
     * 必須ディレクトリ一覧を取得
     */
    getRequiredDirectories() {
        return [
            // development/ 配下
            'development/scripts/deployment',
            'development/scripts/analysis',
            'development/scripts/maintenance',
            'development/scripts/utilities',
            'development/scripts/legacy',
            'development/docs/reports',
            'development/docs/guides',
            'development/docs/legacy',
            'development/configs/environments',
            'development/configs/security',
            'development/configs/secrets',
            'development/configs/legacy',
            'development/logs/deployment',
            'development/logs/analysis',
            'development/logs/maintenance',
            'development/logs/organization',
            'development/temp/working',
            'development/temp/cache',
            'development/temp/build',
            // docs/ 配下（公開用）
            'docs/troubleshooting',
            'docs/deployment',
            'docs/guides',
            'docs/legacy',
            // config/ 配下（公開用）
            'config/samples',
            'config/legacy',
            // tests/ 配下
            'tests/unit',
            'tests/integration',
            'tests/payloads',
            'tests/legacy',
            // archive/ 配下
            'archive/legacy-files',
            'archive/old-projects',
            'archive/backup-files'
        ];
    }
    /**
     * ローカル環境でのディレクトリ権限設定
     */
    async setLocalDirectoryPermissions(dirPath, relativePath) {
        try {
            let permissions = '755'; // デフォルト
            // 機密ディレクトリは制限された権限
            if (relativePath.includes('secrets') || relativePath.includes('security')) {
                permissions = '700';
            }
            // 一時ディレクトリは書き込み可能
            else if (relativePath.includes('temp') || relativePath.includes('logs')) {
                permissions = '755';
            }
            await fs.chmod(dirPath, parseInt(permissions, 8));
        }
        catch (error) {
            console.warn(`ローカルディレクトリ権限設定エラー: ${dirPath}`, error);
        }
    }
    /**
     * EC2環境でのディレクトリ権限設定
     */
    async setEC2DirectoryPermissions(dirPath, relativePath) {
        try {
            let permissions = '755'; // デフォルト
            // 機密ディレクトリは制限された権限
            if (relativePath.includes('secrets') || relativePath.includes('security')) {
                permissions = '700';
            }
            // 一時ディレクトリは書き込み可能
            else if (relativePath.includes('temp') || relativePath.includes('logs')) {
                permissions = '755';
            }
            await this.executeSSHCommand(`chmod ${permissions} "${dirPath}"`);
        }
        catch (error) {
            console.warn(`EC2ディレクトリ権限設定エラー: ${dirPath}`, error);
        }
    }
    /**
     * ディレクトリ用READMEファイルを作成
     */
    async createDirectoryReadmeFiles(basePath, environment, errors) {
        const readmeContents = this.getReadmeContents();
        for (const [dirPath, content] of Object.entries(readmeContents)) {
            try {
                const fullDirPath = environment === 'local' ?
                    path.resolve(basePath, dirPath) :
                    path.posix.join(basePath, dirPath);
                const readmePath = environment === 'local' ?
                    path.join(fullDirPath, 'README.md') :
                    path.posix.join(fullDirPath, 'README.md');
                if (environment === 'local') {
                    await fs.writeFile(readmePath, content);
                    await fs.chmod(readmePath, 0o644);
                }
                else {
                    await this.executeSSHCommand(`cat > "${readmePath}" << 'EOF'\n${content}\nEOF`);
                    await this.executeSSHCommand(`chmod 644 "${readmePath}"`);
                }
                console.log(`📝 README作成: ${dirPath}/README.md`);
            }
            catch (error) {
                errors.push(`README作成エラー: ${dirPath} - ${error}`);
            }
        }
    }
    /**
     * README内容を取得
     */
    getReadmeContents() {
        return {
            'development/scripts': `# 開発・運用スクリプト

## ディレクトリ構成

- \`deployment/\`: デプロイメント関連スクリプト
- \`analysis/\`: 分析・確認スクリプト
- \`maintenance/\`: メンテナンススクリプト
- \`utilities/\`: ユーティリティスクリプト
- \`legacy/\`: レガシースクリプト

## 使用方法

各ディレクトリ内のスクリプトは実行権限が設定されています。

## 注意事項

これらのスクリプトは環境固有の情報を含むため、公開リポジトリには含めないでください。
`,
            'development/docs': `# 開発ドキュメント

## ディレクトリ構成

- \`reports/\`: プロジェクトレポート・進捗報告
- \`guides/\`: 内部ガイド・手順書
- \`legacy/\`: 古いドキュメント

## 注意事項

これらのドキュメントは開発プロセス固有の情報を含むため、公開リポジトリには含めないでください。
`,
            'development/configs': `# 環境固有設定ファイル

## ディレクトリ構成

- \`environments/\`: 環境別設定
- \`security/\`: セキュリティ関連設定
- \`secrets/\`: 機密設定（権限600）
- \`legacy/\`: 古い設定ファイル

## セキュリティ

機密情報を含むファイルは適切な権限で保護されています。
`,
            'docs': `# Permission-aware RAG System ドキュメント

## ディレクトリ構成

- \`troubleshooting/\`: トラブルシューティング
- \`deployment/\`: デプロイメント関連
- \`guides/\`: ガイド・手順書
- \`legacy/\`: 古いドキュメント

## 公開用ドキュメント

これらのドキュメントは汎用的な内容で、公開リポジトリに含めることができます。
`,
            'tests': `# テストファイル

## ディレクトリ構成

- \`unit/\`: 単体テスト
- \`integration/\`: 統合テスト
- \`payloads/\`: テストペイロード・データ
- \`legacy/\`: 古いテストファイル

## テスト実行

各テストは適切なテストランナーで実行してください。
`,
            'archive': `# アーカイブファイル

## ディレクトリ構成

- \`legacy-files/\`: 古いファイル
- \`old-projects/\`: 古いプロジェクト
- \`backup-files/\`: バックアップファイル

## 注意事項

アーカイブされたファイルは定期的に見直し、不要なものは削除してください。
`
        };
    }
    /**
     * SSH コマンドを実行
     */
    async executeSSHCommand(command) {
        if (!this.sshConfig) {
            throw new Error('SSH設定が提供されていません');
        }
        const sshCommand = `ssh -i "${this.sshConfig.keyPath}" -o ConnectTimeout=${this.sshConfig.timeout / 1000} -o StrictHostKeyChecking=no -p ${this.sshConfig.port} ${this.sshConfig.user}@${this.sshConfig.host} "${command}"`;
        try {
            const result = await execAsync(sshCommand, {
                timeout: this.sshConfig.timeout,
                maxBuffer: 1024 * 1024 * 10 // 10MB
            });
            return result;
        }
        catch (error) {
            if (error.code === 'ETIMEDOUT') {
                throw new index_js_1.OrganizationError(index_js_1.OrganizationErrorType.SSH_CONNECTION_FAILED, `SSH接続がタイムアウトしました: ${this.sshConfig.host}`, undefined, 'ec2', error);
            }
            throw error;
        }
    }
    /**
     * エラー結果を作成
     */
    createErrorResult(environment, reason) {
        return {
            createdDirectories: 0,
            createdPaths: [],
            errors: [reason instanceof Error ? reason.message : String(reason)],
            success: false,
            environment,
            processingTime: 0
        };
    }
    /**
     * ディレクトリ構造の検証
     */
    async validateDirectoryStructure(basePath, environment) {
        try {
            const requiredDirectories = this.getRequiredDirectories();
            const missingDirectories = [];
            const permissionIssues = [];
            for (const dirPath of requiredDirectories) {
                const fullPath = environment === 'local' ?
                    path.resolve(basePath, dirPath) :
                    path.posix.join(basePath, dirPath);
                try {
                    if (environment === 'local') {
                        await fs.access(fullPath);
                        // 権限チェック
                        const stats = await fs.stat(fullPath);
                        const permissions = (stats.mode & parseInt('777', 8)).toString(8);
                        if (dirPath.includes('secrets') && permissions !== '700') {
                            permissionIssues.push(`${dirPath}: 期待権限700, 実際${permissions}`);
                        }
                    }
                    else {
                        await this.executeSSHCommand(`test -d "${fullPath}"`);
                        // 権限チェック
                        const { stdout } = await this.executeSSHCommand(`stat -c "%a" "${fullPath}"`);
                        const permissions = stdout.trim();
                        if (dirPath.includes('secrets') && permissions !== '700') {
                            permissionIssues.push(`${dirPath}: 期待権限700, 実際${permissions}`);
                        }
                    }
                }
                catch {
                    missingDirectories.push(dirPath);
                }
            }
            const valid = missingDirectories.length === 0 && permissionIssues.length === 0;
            return {
                valid,
                missingDirectories,
                extraDirectories: [], // 実装簡略化
                permissionIssues
            };
        }
        catch (error) {
            throw new index_js_1.OrganizationError(index_js_1.OrganizationErrorType.VALIDATION_FAILED, `ディレクトリ構造検証に失敗しました: ${error}`, basePath, environment, error);
        }
    }
    /**
     * 環境に応じたディレクトリ構造を作成
     */
    async createEnvironmentStructure(basePath, environment = 'local') {
        try {
            console.log(`🏗️ 環境ディレクトリ構造作成開始: ${environment}`);
            if (environment === 'local') {
                return await this.createLocalDirectoryStructure(basePath);
            }
            else {
                return await this.createEC2DirectoryStructure(basePath);
            }
        }
        catch (error) {
            throw new index_js_1.OrganizationError(index_js_1.OrganizationErrorType.DIRECTORY_CREATION_FAILED, `環境ディレクトリ構造作成に失敗しました: ${error}`, basePath, environment, error);
        }
    }
}
exports.DirectoryCreator = DirectoryCreator;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGlyZWN0b3J5LWNyZWF0b3IuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJkaXJlY3RvcnktY3JlYXRvci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7O0dBS0c7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsZ0RBQWtDO0FBQ2xDLDJDQUE2QjtBQUM3QixpREFBcUM7QUFDckMsK0JBQWlDO0FBQ2pDLGdEQUsyQjtBQUczQixNQUFNLFNBQVMsR0FBRyxJQUFBLGdCQUFTLEVBQUMsb0JBQUksQ0FBQyxDQUFDO0FBb0JsQzs7Ozs7R0FLRztBQUNILE1BQWEsZ0JBQWdCO0lBQ1YsTUFBTSxDQUF1QjtJQUM3QixTQUFTLENBQWE7SUFFdkMsWUFBWSxNQUE0QixFQUFFLFNBQXFCO1FBQzdELElBQUksQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDO1FBQ3JCLElBQUksQ0FBQyxTQUFTLEdBQUcsU0FBUyxDQUFDO0lBQzdCLENBQUM7SUFFRDs7T0FFRztJQUNJLEtBQUssQ0FBQyw2QkFBNkIsQ0FBQyxXQUFtQixHQUFHO1FBQy9ELE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztRQUM3QixPQUFPLENBQUMsR0FBRyxDQUFDLDJCQUEyQixRQUFRLEVBQUUsQ0FBQyxDQUFDO1FBRW5ELElBQUksQ0FBQztZQUNILE1BQU0sWUFBWSxHQUFhLEVBQUUsQ0FBQztZQUNsQyxNQUFNLE1BQU0sR0FBYSxFQUFFLENBQUM7WUFFNUIsY0FBYztZQUNkLE1BQU0sbUJBQW1CLEdBQUcsSUFBSSxDQUFDLHNCQUFzQixFQUFFLENBQUM7WUFFMUQsS0FBSyxNQUFNLE9BQU8sSUFBSSxtQkFBbUIsRUFBRSxDQUFDO2dCQUMxQyxJQUFJLENBQUM7b0JBQ0gsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLEVBQUUsT0FBTyxDQUFDLENBQUM7b0JBQ2pELE1BQU0sRUFBRSxDQUFDLEtBQUssQ0FBQyxRQUFRLEVB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QixFQUN2QyxzQkFBc0IsS0FBSyxFQUFFLEVBQzdCLFFBQVEsRUFDUixXQUFXLEVBQ1gsS0FBYyxDQUNmLENBQUM7UUFDSixDQUFDO0lBQ0gsQ0FBQztJQUVEOztPQUVHO0lBQ0ksS0FBSyxDQUFDLDBCQUEwQixDQUFDLFFBQWdCLEVBQUUsY0FBMkIsT0FBTztRQUMxRixJQUFJLENBQUM7WUFDSCxPQUFPLENBQUMsR0FBRyxDQUFDLHVCQUF1QixXQUFXLEVBQUUsQ0FBQyxDQUFDO1lBRWxELElBQUksV0FBVyxLQUFLLE9BQU8sRUFBRSxDQUFDO2dCQUM1QixPQUFPLE1BQU0sSUFBSSxDQUFDLDZCQUE2QixDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQzVELENBQUM7aUJBQU0sQ0FBQztnQkFDTixPQUFPLE1BQU0sSUFBSSxDQUFDLDJCQUEyQixDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQzFELENBQUM7UUFDSCxDQUFDO1FBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztZQUNmLE1BQU0sSUFBSSw0QkFBaUIsQ0FDekIsZ0NBQXFCLENBQUMseUJBQXlCLEVBQy9DLHdCQUF3QixLQUFLLEVBQUUsRUFDL0IsUUFBUSxFQUNSLFdBQVcsRUFDWCxLQUFjLENBQ2YsQ0FBQztRQUNKLENBQUM7SUFDSCxDQUFDO0NBQ0Y7QUFoaEJELDRDQWdoQkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIOe1seWQiOODleOCoeOCpOODq+aVtOeQhuOCt+OCueODhuODoCAtIOODh+OCo+ODrOOCr+ODiOODquani+mAoOS9nOaIkFxuICogXG4gKiBBZ2VudCBTdGVlcmluZyBmaWxlLXBsYWNlbWVudC1ndWlkZWxpbmVz44Gr5rqW5oug44GX44GfXG4gKiDntbHkuIDjg4fjgqPjg6zjgq/jg4jjg6rmp4vpgKDjgpLkvZzmiJDjgZnjgovmqZ/og73jgpLmj5DkvpvjgZfjgb7jgZnjgIJcbiAqL1xuXG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcy9wcm9taXNlcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgZXhlYyB9IGZyb20gJ2NoaWxkX3Byb2Nlc3MnO1xuaW1wb3J0IHsgcHJvbWlzaWZ5IH0gZnJvbSAndXRpbCc7XG5pbXBvcnQgeyBcbiAgQ2xhc3NpZmljYXRpb25Db25maWcsXG4gIEVudmlyb25tZW50LFxuICBPcmdhbml6YXRpb25FcnJvcixcbiAgT3JnYW5pemF0aW9uRXJyb3JUeXBlXG59IGZyb20gJy4uL3R5cGVzL2luZGV4LmpzJztcbmltcG9ydCB7IFNTSENvbmZpZyB9IGZyb20gJy4uL3NjYW5uZXJzL2VjMi1zY2FubmVyLmpzJztcblxuY29uc3QgZXhlY0FzeW5jID0gcHJvbWlzaWZ5KGV4ZWMpO1xuXG4vKipcbiAqIOODh+OCo+ODrOOCr+ODiOODquS9nOaIkOe1kOaenFxuICovXG5leHBvcnQgaW50ZXJmYWNlIERpcmVjdG9yeUNyZWF0aW9uUmVzdWx0IHtcbiAgLyoqIOS9nOaIkOOBleOCjOOBn+ODh+OCo+ODrOOCr+ODiOODquaVsCAqL1xuICBjcmVhdGVkRGlyZWN0b3JpZXM6IG51bWJlcjtcbiAgLyoqIOS9nOaIkOOBleOCjOOBn+ODh+OCo+ODrOOCr+ODiOODquODkeOCuSAqL1xuICBjcmVhdGVkUGF0aHM6IHN0cmluZ1tdO1xuICAvKiog44Ko44Op44O8ICovXG4gIGVycm9yczogc3RyaW5nW107XG4gIC8qKiDmiJDlip/jgZfjgZ/jgYvjganjgYbjgYsgKi9cbiAgc3VjY2VzczogYm9vbGVhbjtcbiAgLyoqIOWun+ihjOeSsOWigyAqL1xuICBlbnZpcm9ubWVudDogRW52aXJvbm1lbnQ7XG4gIC8qKiDlh6bnkIbmmYLplpMgKi9cbiAgcHJvY2Vzc2luZ1RpbWU6IG51bWJlcjtcbn1cblxuLyoqXG4gKiDjg4fjgqPjg6zjgq/jg4jjg6rmp4vpgKDkvZzmiJBcbiAqIFxuICogQWdlbnQgU3RlZXJpbmfmupbmi6Djga7jg4fjgqPjg6zjgq/jg4jjg6rmp4vpgKDjgpLkuKHnkrDlooPjgafkvZzmiJDjgZfjgIFcbiAqIOmBqeWIh+OBquaoqemZkOioreWumuOCkuihjOOBhOOBvuOBmeOAglxuICovXG5leHBvcnQgY2xhc3MgRGlyZWN0b3J5Q3JlYXRvciB7XG4gIHByaXZhdGUgcmVhZG9ubHkgY29uZmlnOiBDbGFzc2lmaWNhdGlvbkNvbmZpZztcbiAgcHJpdmF0ZSByZWFkb25seSBzc2hDb25maWc/OiBTU0hDb25maWc7XG5cbiAgY29uc3RydWN0b3IoY29uZmlnOiBDbGFzc2lmaWNhdGlvbkNvbmZpZywgc3NoQ29uZmlnPzogU1NIQ29uZmlnKSB7XG4gICAgdGhpcy5jb25maWcgPSBjb25maWc7XG4gICAgdGhpcy5zc2hDb25maWcgPSBzc2hDb25maWc7XG4gIH1cblxuICAvKipcbiAgICog44Ot44O844Kr44Or55Kw5aKD44Gn44OH44Kj44Os44Kv44OI44Oq5qeL6YCg44KS5L2c5oiQXG4gICAqL1xuICBwdWJsaWMgYXN5bmMgY3JlYXRlTG9jYWxEaXJlY3RvcnlTdHJ1Y3R1cmUoYmFzZVBhdGg6IHN0cmluZyA9ICcuJyk6IFByb21pc2U8RGlyZWN0b3J5Q3JlYXRpb25SZXN1bHQ+IHtcbiAgICBjb25zdCBzdGFydFRpbWUgPSBEYXRlLm5vdygpO1xuICAgIGNvbnNvbGUubG9nKGDwn5OBIOODreODvOOCq+ODq+eSsOWig+OBp+ODh+OCo+ODrOOCr+ODiOODquani+mAoOOCkuS9nOaIkOS4rTogJHtiYXNlUGF0aH1gKTtcblxuICAgIHRyeSB7XG4gICAgICBjb25zdCBjcmVhdGVkUGF0aHM6IHN0cmluZ1tdID0gW107XG4gICAgICBjb25zdCBlcnJvcnM6IHN0cmluZ1tdID0gW107XG5cbiAgICAgIC8vIOW/hemgiOODh+OCo+ODrOOCr+ODiOODquOBruS9nOaIkFxuICAgICAgY29uc3QgcmVxdWlyZWREaXJlY3RvcmllcyA9IHRoaXMuZ2V0UmVxdWlyZWREaXJlY3RvcmllcygpO1xuICAgICAgXG4gICAgICBmb3IgKGNvbnN0IGRpclBhdGggb2YgcmVxdWlyZWREaXJlY3Rvcmllcykge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbnN0IGZ1bGxQYXRoID0gcGF0aC5yZXNvbHZlKGJhc2VQYXRoLCBkaXJQYXRoKTtcbiAgICAgICAgICBhd2FpdCBmcy5ta2RpcihmdWxsUGF0aCwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gICAgICAgICAgXG4gICAgICAgICAgLy8g5qip6ZmQ6Kit5a6aXG4gICAgICAgICAgYXdhaXQgdGhpcy5zZXRMb2NhbERpcmVjdG9yeVBlcm1pc3Npb25zKGZ1bGxQYXRoLCBkaXJQYXRoKTtcbiAgICAgICAgICBcbiAgICAgICAgICBjcmVhdGVkUGF0aHMucHVzaChmdWxsUGF0aCk7XG4gICAgICAgICAgY29uc29sZS5sb2coYOKchSDjg4fjgqPjg6zjgq/jg4jjg6rkvZzmiJA6ICR7ZGlyUGF0aH1gKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICBjb25zdCBlcnJvck1zZyA9IGDjg4fjgqPjg6zjgq/jg4jjg6rkvZzmiJDjgqjjg6njg7w6ICR7ZGlyUGF0aH0gLSAke2Vycm9yfWA7XG4gICAgICAgICAgZXJyb3JzLnB1c2goZXJyb3JNc2cpO1xuICAgICAgICAgIGNvbnNvbGUud2FybihlcnJvck1zZyk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gUkVBRE1FIOODleOCoeOCpOODq+OBruS9nOaIkFxuICAgICAgYXdhaXQgdGhpcy5jcmVhdGVEaXJlY3RvcnlSZWFkbWVGaWxlcyhiYXNlUGF0aCwgJ2xvY2FsJywgZXJyb3JzKTtcblxuICAgICAgY29uc3QgcHJvY2Vzc2luZ1RpbWUgPSBEYXRlLm5vdygpIC0gc3RhcnRUaW1lO1xuICAgICAgY29uc29sZS5sb2coYOKchSDjg63jg7zjgqvjg6vjg4fjgqPjg6zjgq/jg4jjg6rmp4vpgKDkvZzmiJDlrozkuoY6ICR7Y3JlYXRlZFBhdGhzLmxlbmd0aH3lgIsgKCR7cHJvY2Vzc2luZ1RpbWV9bXMpYCk7XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIGNyZWF0ZWREaXJlY3RvcmllczogY3JlYXRlZFBhdGhzLmxlbmd0aCxcbiAgICAgICAgY3JlYXRlZFBhdGhzLFxuICAgICAgICBlcnJvcnMsXG4gICAgICAgIHN1Y2Nlc3M6IGVycm9ycy5sZW5ndGggPT09IDAsXG4gICAgICAgIGVudmlyb25tZW50OiAnbG9jYWwnLFxuICAgICAgICBwcm9jZXNzaW5nVGltZVxuICAgICAgfTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgdGhyb3cgbmV3IE9yZ2FuaXphdGlvbkVycm9yKFxuICAgICAgICBPcmdhbml6YXRpb25FcnJvclR5cGUuTU9WRV9GQUlMRUQsXG4gICAgICAgIGDjg63jg7zjgqvjg6vjg4fjgqPjg6zjgq/jg4jjg6rmp4vpgKDkvZzmiJDjgavlpLHmlZfjgZfjgb7jgZfjgZ86ICR7ZXJyb3J9YCxcbiAgICAgICAgYmFzZVBhdGgsXG4gICAgICAgICdsb2NhbCcsXG4gICAgICAgIGVycm9yIGFzIEVycm9yXG4gICAgICApO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBFQzLnkrDlooPjgafjg4fjgqPjg6zjgq/jg4jjg6rmp4vpgKDjgpLkvZzmiJBcbiAgICovXG4gIHB1YmxpYyBhc3luYyBjcmVhdGVFQzJEaXJlY3RvcnlTdHJ1Y3R1cmUoYmFzZVBhdGg6IHN0cmluZyk6IFByb21pc2U8RGlyZWN0b3J5Q3JlYXRpb25SZXN1bHQ+IHtcbiAgICBpZiAoIXRoaXMuc3NoQ29uZmlnKSB7XG4gICAgICB0aHJvdyBuZXcgT3JnYW5pemF0aW9uRXJyb3IoXG4gICAgICAgIE9yZ2FuaXphdGlvbkVycm9yVHlwZS5TU0hfQ09OTkVDVElPTl9GQUlMRUQsXG4gICAgICAgICdTU0joqK3lrprjgYzmj5DkvpvjgZXjgozjgabjgYTjgb7jgZvjgpMnLFxuICAgICAgICB1bmRlZmluZWQsXG4gICAgICAgICdlYzInXG4gICAgICApO1xuICAgIH1cblxuICAgIGNvbnN0IHN0YXJ0VGltZSA9IERhdGUubm93KCk7XG4gICAgY29uc29sZS5sb2coYPCfk4EgRUMy55Kw5aKD44Gn44OH44Kj44Os44Kv44OI44Oq5qeL6YCg44KS5L2c5oiQ5LitOiAke2Jhc2VQYXRofWApO1xuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGNyZWF0ZWRQYXRoczogc3RyaW5nW10gPSBbXTtcbiAgICAgIGNvbnN0IGVycm9yczogc3RyaW5nW10gPSBbXTtcblxuICAgICAgLy8g5b+F6aCI44OH44Kj44Os44Kv44OI44Oq44Gu5L2c5oiQXG4gICAgICBjb25zdCByZXF1aXJlZERpcmVjdG9yaWVzID0gdGhpcy5nZXRSZXF1aXJlZERpcmVjdG9yaWVzKCk7XG4gICAgICBcbiAgICAgIGZvciAoY29uc3QgZGlyUGF0aCBvZiByZXF1aXJlZERpcmVjdG9yaWVzKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgY29uc3QgZnVsbFBhdGggPSBwYXRoLnBvc2l4LmpvaW4oYmFzZVBhdGgsIGRpclBhdGgpO1xuICAgICAgICAgIGF3YWl0IHRoaXMuZXhlY3V0ZVNTSENvbW1hbmQoYG1rZGlyIC1wIFwiJHtmdWxsUGF0aH1cImApO1xuICAgICAgICAgIFxuICAgICAgICAgIC8vIOaoqemZkOioreWumlxuICAgICAgICAgIGF3YWl0IHRoaXMuc2V0RUMyRGlyZWN0b3J5UGVybWlzc2lvbnMoZnVsbFBhdGgsIGRpclBhdGgpO1xuICAgICAgICAgIFxuICAgICAgICAgIGNyZWF0ZWRQYXRocy5wdXNoKGZ1bGxQYXRoKTtcbiAgICAgICAgICBjb25zb2xlLmxvZyhg4pyFIEVDMuODh+OCo+ODrOOCr+ODiOODquS9nOaIkDogJHtkaXJQYXRofWApO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgIGNvbnN0IGVycm9yTXNnID0gYEVDMuODh+OCo+ODrOOCr+ODiOODquS9nOaIkOOCqOODqeODvDogJHtkaXJQYXRofSAtICR7ZXJyb3J9YDtcbiAgICAgICAgICBlcnJvcnMucHVzaChlcnJvck1zZyk7XG4gICAgICAgICAgY29uc29sZS53YXJuKGVycm9yTXNnKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBSRUFETUUg44OV44Kh44Kk44Or44Gu5L2c5oiQXG4gICAgICBhd2FpdCB0aGlzLmNyZWF0ZURpcmVjdG9yeVJlYWRtZUZpbGVzKGJhc2VQYXRoLCAnZWMyJywgZXJyb3JzKTtcblxuICAgICAgY29uc3QgcHJvY2Vzc2luZ1RpbWUgPSBEYXRlLm5vdygpIC0gc3RhcnRUaW1lO1xuICAgICAgY29uc29sZS5sb2coYOKchSBFQzLjg4fjgqPjg6zjgq/jg4jjg6rmp4vpgKDkvZzmiJDlrozkuoY6ICR7Y3JlYXRlZFBhdGhzLmxlbmd0aH3lgIsgKCR7cHJvY2Vzc2luZ1RpbWV9bXMpYCk7XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIGNyZWF0ZWREaXJlY3RvcmllczogY3JlYXRlZFBhdGhzLmxlbmd0aCxcbiAgICAgICAgY3JlYXRlZFBhdGhzLFxuICAgICAgICBlcnJvcnMsXG4gICAgICAgIHN1Y2Nlc3M6IGVycm9ycy5sZW5ndGggPT09IDAsXG4gICAgICAgIGVudmlyb25tZW50OiAnZWMyJyxcbiAgICAgICAgcHJvY2Vzc2luZ1RpbWVcbiAgICAgIH07XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIHRocm93IG5ldyBPcmdhbml6YXRpb25FcnJvcihcbiAgICAgICAgT3JnYW5pemF0aW9uRXJyb3JUeXBlLlNTSF9DT05ORUNUSU9OX0ZBSUxFRCxcbiAgICAgICAgYEVDMuODh+OCo+ODrOOCr+ODiOODquani+mAoOS9nOaIkOOBq+WkseaVl+OBl+OBvuOBl+OBnzogJHtlcnJvcn1gLFxuICAgICAgICBiYXNlUGF0aCxcbiAgICAgICAgJ2VjMicsXG4gICAgICAgIGVycm9yIGFzIEVycm9yXG4gICAgICApO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDntbHlkIjjg4fjgqPjg6zjgq/jg4jjg6rmp4vpgKDkvZzmiJBcbiAgICovXG4gIHB1YmxpYyBhc3luYyBjcmVhdGVJbnRlZ3JhdGVkRGlyZWN0b3J5U3RydWN0dXJlKFxuICAgIGxvY2FsQmFzZVBhdGg6IHN0cmluZyA9ICcuJyxcbiAgICBlYzJCYXNlUGF0aDogc3RyaW5nXG4gICk6IFByb21pc2U8e1xuICAgIGxvY2FsOiBEaXJlY3RvcnlDcmVhdGlvblJlc3VsdDtcbiAgICBlYzI6IERpcmVjdG9yeUNyZWF0aW9uUmVzdWx0O1xuICAgIHN1Y2Nlc3M6IGJvb2xlYW47XG4gIH0+IHtcbiAgICBjb25zb2xlLmxvZygn8J+Pl++4jyAg57Wx5ZCI44OH44Kj44Os44Kv44OI44Oq5qeL6YCg44KS5L2c5oiQ5LitLi4uJyk7XG5cbiAgICB0cnkge1xuICAgICAgLy8g5Lim5YiX44Gn44OH44Kj44Os44Kv44OI44Oq5qeL6YCg44KS5L2c5oiQXG4gICAgICBjb25zdCBbbG9jYWxSZXN1bHQsIGVjMlJlc3VsdF0gPSBhd2FpdCBQcm9taXNlLmFsbFNldHRsZWQoW1xuICAgICAgICB0aGlzLmNyZWF0ZUxvY2FsRGlyZWN0b3J5U3RydWN0dXJlKGxvY2FsQmFzZVBhdGgpLFxuICAgICAgICB0aGlzLmNyZWF0ZUVDMkRpcmVjdG9yeVN0cnVjdHVyZShlYzJCYXNlUGF0aClcbiAgICAgIF0pO1xuXG4gICAgICBjb25zdCBsb2NhbCA9IGxvY2FsUmVzdWx0LnN0YXR1cyA9PT0gJ2Z1bGZpbGxlZCcgPyBsb2NhbFJlc3VsdC52YWx1ZSA6IFxuICAgICAgICB0aGlzLmNyZWF0ZUVycm9yUmVzdWx0KCdsb2NhbCcsIGxvY2FsUmVzdWx0LnJlYXNvbik7XG4gICAgICBcbiAgICAgIGNvbnN0IGVjMiA9IGVjMlJlc3VsdC5zdGF0dXMgPT09ICdmdWxmaWxsZWQnID8gZWMyUmVzdWx0LnZhbHVlIDogXG4gICAgICAgIHRoaXMuY3JlYXRlRXJyb3JSZXN1bHQoJ2VjMicsIGVjMlJlc3VsdC5yZWFzb24pO1xuXG4gICAgICBjb25zdCBzdWNjZXNzID0gbG9jYWwuc3VjY2VzcyAmJiBlYzIuc3VjY2VzcztcbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYOKchSDntbHlkIjjg4fjgqPjg6zjgq/jg4jjg6rmp4vpgKDkvZzmiJDlrozkuoY6ICR7c3VjY2VzcyA/ICfmiJDlip8nIDogJ+mDqOWIhueahOaIkOWKnyd9YCk7XG5cbiAgICAgIHJldHVybiB7IGxvY2FsLCBlYzIsIHN1Y2Nlc3MgfTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgdGhyb3cgbmV3IE9yZ2FuaXphdGlvbkVycm9yKFxuICAgICAgICBPcmdhbml6YXRpb25FcnJvclR5cGUuTU9WRV9GQUlMRUQsXG4gICAgICAgIGDntbHlkIjjg4fjgqPjg6zjgq/jg4jjg6rmp4vpgKDkvZzmiJDjgavlpLHmlZfjgZfjgb7jgZfjgZ86ICR7ZXJyb3J9YCxcbiAgICAgICAgdW5kZWZpbmVkLFxuICAgICAgICB1bmRlZmluZWQsXG4gICAgICAgIGVycm9yIGFzIEVycm9yXG4gICAgICApO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDlv4XpoIjjg4fjgqPjg6zjgq/jg4jjg6rkuIDopqfjgpLlj5blvpdcbiAgICovXG4gIHByaXZhdGUgZ2V0UmVxdWlyZWREaXJlY3RvcmllcygpOiBzdHJpbmdbXSB7XG4gICAgcmV0dXJuIFtcbiAgICAgIC8vIGRldmVsb3BtZW50LyDphY3kuItcbiAgICAgICdkZXZlbG9wbWVudC9zY3JpcHRzL2RlcGxveW1lbnQnLFxuICAgICAgJ2RldmVsb3BtZW50L3NjcmlwdHMvYW5hbHlzaXMnLFxuICAgICAgJ2RldmVsb3BtZW50L3NjcmlwdHMvbWFpbnRlbmFuY2UnLFxuICAgICAgJ2RldmVsb3BtZW50L3NjcmlwdHMvdXRpbGl0aWVzJyxcbiAgICAgICdkZXZlbG9wbWVudC9zY3JpcHRzL2xlZ2FjeScsXG4gICAgICAnZGV2ZWxvcG1lbnQvZG9jcy9yZXBvcnRzJyxcbiAgICAgICdkZXZlbG9wbWVudC9kb2NzL2d1aWRlcycsXG4gICAgICAnZGV2ZWxvcG1lbnQvZG9jcy9sZWdhY3knLFxuICAgICAgJ2RldmVsb3BtZW50L2NvbmZpZ3MvZW52aXJvbm1lbnRzJyxcbiAgICAgICdkZXZlbG9wbWVudC9jb25maWdzL3NlY3VyaXR5JyxcbiAgICAgICdkZXZlbG9wbWVudC9jb25maWdzL3NlY3JldHMnLFxuICAgICAgJ2RldmVsb3BtZW50L2NvbmZpZ3MvbGVnYWN5JyxcbiAgICAgICdkZXZlbG9wbWVudC9sb2dzL2RlcGxveW1lbnQnLFxuICAgICAgJ2RldmVsb3BtZW50L2xvZ3MvYW5hbHlzaXMnLFxuICAgICAgJ2RldmVsb3BtZW50L2xvZ3MvbWFpbnRlbmFuY2UnLFxuICAgICAgJ2RldmVsb3BtZW50L2xvZ3Mvb3JnYW5pemF0aW9uJyxcbiAgICAgICdkZXZlbG9wbWVudC90ZW1wL3dvcmtpbmcnLFxuICAgICAgJ2RldmVsb3BtZW50L3RlbXAvY2FjaGUnLFxuICAgICAgJ2RldmVsb3BtZW50L3RlbXAvYnVpbGQnLFxuXG4gICAgICAvLyBkb2NzLyDphY3kuIvvvIjlhazplovnlKjvvIlcbiAgICAgICdkb2NzL3Ryb3VibGVzaG9vdGluZycsXG4gICAgICAnZG9jcy9kZXBsb3ltZW50JyxcbiAgICAgICdkb2NzL2d1aWRlcycsXG4gICAgICAnZG9jcy9sZWdhY3knLFxuXG4gICAgICAvLyBjb25maWcvIOmFjeS4i++8iOWFrOmWi+eUqO+8iVxuICAgICAgJ2NvbmZpZy9zYW1wbGVzJyxcbiAgICAgICdjb25maWcvbGVnYWN5JyxcblxuICAgICAgLy8gdGVzdHMvIOmFjeS4i1xuICAgICAgJ3Rlc3RzL3VuaXQnLFxuICAgICAgJ3Rlc3RzL2ludGVncmF0aW9uJyxcbiAgICAgICd0ZXN0cy9wYXlsb2FkcycsXG4gICAgICAndGVzdHMvbGVnYWN5JyxcblxuICAgICAgLy8gYXJjaGl2ZS8g6YWN5LiLXG4gICAgICAnYXJjaGl2ZS9sZWdhY3ktZmlsZXMnLFxuICAgICAgJ2FyY2hpdmUvb2xkLXByb2plY3RzJyxcbiAgICAgICdhcmNoaXZlL2JhY2t1cC1maWxlcydcbiAgICBdO1xuICB9XG5cbiAgLyoqXG4gICAqIOODreODvOOCq+ODq+eSsOWig+OBp+OBruODh+OCo+ODrOOCr+ODiOODquaoqemZkOioreWumlxuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBzZXRMb2NhbERpcmVjdG9yeVBlcm1pc3Npb25zKGRpclBhdGg6IHN0cmluZywgcmVsYXRpdmVQYXRoOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0cnkge1xuICAgICAgbGV0IHBlcm1pc3Npb25zID0gJzc1NSc7IC8vIOODh+ODleOCqeODq+ODiFxuXG4gICAgICAvLyDmqZ/lr4bjg4fjgqPjg6zjgq/jg4jjg6rjga/liLbpmZDjgZXjgozjgZ/mqKnpmZBcbiAgICAgIGlmIChyZWxhdGl2ZVBhdGguaW5jbHVkZXMoJ3NlY3JldHMnKSB8fCByZWxhdGl2ZVBhdGguaW5jbHVkZXMoJ3NlY3VyaXR5JykpIHtcbiAgICAgICAgcGVybWlzc2lvbnMgPSAnNzAwJztcbiAgICAgIH1cbiAgICAgIC8vIOS4gOaZguODh+OCo+ODrOOCr+ODiOODquOBr+abuOOBjei+vOOBv+WPr+iDvVxuICAgICAgZWxzZSBpZiAocmVsYXRpdmVQYXRoLmluY2x1ZGVzKCd0ZW1wJykgfHwgcmVsYXRpdmVQYXRoLmluY2x1ZGVzKCdsb2dzJykpIHtcbiAgICAgICAgcGVybWlzc2lvbnMgPSAnNzU1JztcbiAgICAgIH1cblxuICAgICAgYXdhaXQgZnMuY2htb2QoZGlyUGF0aCwgcGFyc2VJbnQocGVybWlzc2lvbnMsIDgpKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS53YXJuKGDjg63jg7zjgqvjg6vjg4fjgqPjg6zjgq/jg4jjg6rmqKnpmZDoqK3lrprjgqjjg6njg7w6ICR7ZGlyUGF0aH1gLCBlcnJvcik7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEVDMueSsOWig+OBp+OBruODh+OCo+ODrOOCr+ODiOODquaoqemZkOioreWumlxuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBzZXRFQzJEaXJlY3RvcnlQZXJtaXNzaW9ucyhkaXJQYXRoOiBzdHJpbmcsIHJlbGF0aXZlUGF0aDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdHJ5IHtcbiAgICAgIGxldCBwZXJtaXNzaW9ucyA9ICc3NTUnOyAvLyDjg4fjg5Xjgqnjg6vjg4hcblxuICAgICAgLy8g5qmf5a+G44OH44Kj44Os44Kv44OI44Oq44Gv5Yi26ZmQ44GV44KM44Gf5qip6ZmQXG4gICAgICBpZiAocmVsYXRpdmVQYXRoLmluY2x1ZGVzKCdzZWNyZXRzJykgfHwgcmVsYXRpdmVQYXRoLmluY2x1ZGVzKCdzZWN1cml0eScpKSB7XG4gICAgICAgIHBlcm1pc3Npb25zID0gJzcwMCc7XG4gICAgICB9XG4gICAgICAvLyDkuIDmmYLjg4fjgqPjg6zjgq/jg4jjg6rjga/mm7jjgY3ovrzjgb/lj6/og71cbiAgICAgIGVsc2UgaWYgKHJlbGF0aXZlUGF0aC5pbmNsdWRlcygndGVtcCcpIHx8IHJlbGF0aXZlUGF0aC5pbmNsdWRlcygnbG9ncycpKSB7XG4gICAgICAgIHBlcm1pc3Npb25zID0gJzc1NSc7XG4gICAgICB9XG5cbiAgICAgIGF3YWl0IHRoaXMuZXhlY3V0ZVNTSENvbW1hbmQoYGNobW9kICR7cGVybWlzc2lvbnN9IFwiJHtkaXJQYXRofVwiYCk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUud2FybihgRUMy44OH44Kj44Os44Kv44OI44Oq5qip6ZmQ6Kit5a6a44Ko44Op44O8OiAke2RpclBhdGh9YCwgZXJyb3IpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDjg4fjgqPjg6zjgq/jg4jjg6rnlKhSRUFETUXjg5XjgqHjgqTjg6vjgpLkvZzmiJBcbiAgICovXG4gIHByaXZhdGUgYXN5bmMgY3JlYXRlRGlyZWN0b3J5UmVhZG1lRmlsZXMoXG4gICAgYmFzZVBhdGg6IHN0cmluZyxcbiAgICBlbnZpcm9ubWVudDogRW52aXJvbm1lbnQsXG4gICAgZXJyb3JzOiBzdHJpbmdbXVxuICApOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCByZWFkbWVDb250ZW50cyA9IHRoaXMuZ2V0UmVhZG1lQ29udGVudHMoKTtcblxuICAgIGZvciAoY29uc3QgW2RpclBhdGgsIGNvbnRlbnRdIG9mIE9iamVjdC5lbnRyaWVzKHJlYWRtZUNvbnRlbnRzKSkge1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgZnVsbERpclBhdGggPSBlbnZpcm9ubWVudCA9PT0gJ2xvY2FsJyA/IFxuICAgICAgICAgIHBhdGgucmVzb2x2ZShiYXNlUGF0aCwgZGlyUGF0aCkgOiBcbiAgICAgICAgICBwYXRoLnBvc2l4LmpvaW4oYmFzZVBhdGgsIGRpclBhdGgpO1xuICAgICAgICBcbiAgICAgICAgY29uc3QgcmVhZG1lUGF0aCA9IGVudmlyb25tZW50ID09PSAnbG9jYWwnID9cbiAgICAgICAgICBwYXRoLmpvaW4oZnVsbERpclBhdGgsICdSRUFETUUubWQnKSA6XG4gICAgICAgICAgcGF0aC5wb3NpeC5qb2luKGZ1bGxEaXJQYXRoLCAnUkVBRE1FLm1kJyk7XG5cbiAgICAgICAgaWYgKGVudmlyb25tZW50ID09PSAnbG9jYWwnKSB7XG4gICAgICAgICAgYXdhaXQgZnMud3JpdGVGaWxlKHJlYWRtZVBhdGgsIGNvbnRlbnQpO1xuICAgICAgICAgIGF3YWl0IGZzLmNobW9kKHJlYWRtZVBhdGgsIDBvNjQ0KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBhd2FpdCB0aGlzLmV4ZWN1dGVTU0hDb21tYW5kKGBjYXQgPiBcIiR7cmVhZG1lUGF0aH1cIiA8PCAnRU9GJ1xcbiR7Y29udGVudH1cXG5FT0ZgKTtcbiAgICAgICAgICBhd2FpdCB0aGlzLmV4ZWN1dGVTU0hDb21tYW5kKGBjaG1vZCA2NDQgXCIke3JlYWRtZVBhdGh9XCJgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnNvbGUubG9nKGDwn5OdIFJFQURNReS9nOaIkDogJHtkaXJQYXRofS9SRUFETUUubWRgKTtcbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGVycm9ycy5wdXNoKGBSRUFETUXkvZzmiJDjgqjjg6njg7w6ICR7ZGlyUGF0aH0gLSAke2Vycm9yfWApO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBSRUFETUXlhoXlrrnjgpLlj5blvpdcbiAgICovXG4gIHByaXZhdGUgZ2V0UmVhZG1lQ29udGVudHMoKTogUmVjb3JkPHN0cmluZywgc3RyaW5nPiB7XG4gICAgcmV0dXJuIHtcbiAgICAgICdkZXZlbG9wbWVudC9zY3JpcHRzJzogYCMg6ZaL55m644O76YGL55So44K544Kv44Oq44OX44OIXG5cbiMjIOODh+OCo+ODrOOCr+ODiOODquani+aIkFxuXG4tIFxcYGRlcGxveW1lbnQvXFxgOiDjg4fjg5fjg63jgqTjg6Hjg7Pjg4jplqLpgKPjgrnjgq/jg6rjg5fjg4hcbi0gXFxgYW5hbHlzaXMvXFxgOiDliIbmnpDjg7vnorroqo3jgrnjgq/jg6rjg5fjg4hcbi0gXFxgbWFpbnRlbmFuY2UvXFxgOiDjg6Hjg7Pjg4bjg4rjg7Pjgrnjgrnjgq/jg6rjg5fjg4hcbi0gXFxgdXRpbGl0aWVzL1xcYDog44Om44O844OG44Kj44Oq44OG44Kj44K544Kv44Oq44OX44OIXG4tIFxcYGxlZ2FjeS9cXGA6IOODrOOCrOOCt+ODvOOCueOCr+ODquODl+ODiFxuXG4jIyDkvb/nlKjmlrnms5Vcblxu5ZCE44OH44Kj44Os44Kv44OI44Oq5YaF44Gu44K544Kv44Oq44OX44OI44Gv5a6f6KGM5qip6ZmQ44GM6Kit5a6a44GV44KM44Gm44GE44G+44GZ44CCXG5cbiMjIOazqOaEj+S6i+mghVxuXG7jgZPjgozjgonjga7jgrnjgq/jg6rjg5fjg4jjga/nkrDlooPlm7rmnInjga7mg4XloLHjgpLlkKvjgoDjgZ/jgoHjgIHlhazplovjg6rjg53jgrjjg4jjg6rjgavjga/lkKvjgoHjgarjgYTjgafjgY/jgaDjgZXjgYTjgIJcbmAsXG5cbiAgICAgICdkZXZlbG9wbWVudC9kb2NzJzogYCMg6ZaL55m644OJ44Kt44Ol44Oh44Oz44OIXG5cbiMjIOODh+OCo+ODrOOCr+ODiOODquani+aIkFxuXG4tIFxcYHJlcG9ydHMvXFxgOiDjg5fjg63jgrjjgqfjgq/jg4jjg6zjg53jg7zjg4jjg7vpgLLmjZfloLHlkYpcbi0gXFxgZ3VpZGVzL1xcYDog5YaF6YOo44Ks44Kk44OJ44O75omL6aCG5pu4XG4tIFxcYGxlZ2FjeS9cXGA6IOWPpOOBhOODieOCreODpeODoeODs+ODiFxuXG4jIyDms6jmhI/kuovpoIVcblxu44GT44KM44KJ44Gu44OJ44Kt44Ol44Oh44Oz44OI44Gv6ZaL55m644OX44Ot44K744K55Zu65pyJ44Gu5oOF5aCx44KS5ZCr44KA44Gf44KB44CB5YWs6ZaL44Oq44Od44K444OI44Oq44Gr44Gv5ZCr44KB44Gq44GE44Gn44GP44Gg44GV44GE44CCXG5gLFxuXG4gICAgICAnZGV2ZWxvcG1lbnQvY29uZmlncyc6IGAjIOeSsOWig+WbuuacieioreWumuODleOCoeOCpOODq1xuXG4jIyDjg4fjgqPjg6zjgq/jg4jjg6rmp4vmiJBcblxuLSBcXGBlbnZpcm9ubWVudHMvXFxgOiDnkrDlooPliKXoqK3lrppcbi0gXFxgc2VjdXJpdHkvXFxgOiDjgrvjgq3jg6Xjg6rjg4bjgqPplqLpgKPoqK3lrppcbi0gXFxgc2VjcmV0cy9cXGA6IOapn+WvhuioreWumu+8iOaoqemZkDYwMO+8iVxuLSBcXGBsZWdhY3kvXFxgOiDlj6TjgYToqK3lrprjg5XjgqHjgqTjg6tcblxuIyMg44K744Kt44Ol44Oq44OG44KjXG5cbuapn+WvhuaDheWgseOCkuWQq+OCgOODleOCoeOCpOODq+OBr+mBqeWIh+OBquaoqemZkOOBp+S/neitt+OBleOCjOOBpuOBhOOBvuOBmeOAglxuYCxcblxuICAgICAgJ2RvY3MnOiBgIyBQZXJtaXNzaW9uLWF3YXJlIFJBRyBTeXN0ZW0g44OJ44Kt44Ol44Oh44Oz44OIXG5cbiMjIOODh+OCo+ODrOOCr+ODiOODquani+aIkFxuXG4tIFxcYHRyb3VibGVzaG9vdGluZy9cXGA6IOODiOODqeODluODq+OCt+ODpeODvOODhuOCo+ODs+OCsFxuLSBcXGBkZXBsb3ltZW50L1xcYDog44OH44OX44Ot44Kk44Oh44Oz44OI6Zai6YCjXG4tIFxcYGd1aWRlcy9cXGA6IOOCrOOCpOODieODu+aJi+mghuabuFxuLSBcXGBsZWdhY3kvXFxgOiDlj6TjgYTjg4njgq3jg6Xjg6Hjg7Pjg4hcblxuIyMg5YWs6ZaL55So44OJ44Kt44Ol44Oh44Oz44OIXG5cbuOBk+OCjOOCieOBruODieOCreODpeODoeODs+ODiOOBr+axjueUqOeahOOBquWGheWuueOBp+OAgeWFrOmWi+ODquODneOCuOODiOODquOBq+WQq+OCgeOCi+OBk+OBqOOBjOOBp+OBjeOBvuOBmeOAglxuYCxcblxuICAgICAgJ3Rlc3RzJzogYCMg44OG44K544OI44OV44Kh44Kk44OrXG5cbiMjIOODh+OCo+ODrOOCr+ODiOODquani+aIkFxuXG4tIFxcYHVuaXQvXFxgOiDljZjkvZPjg4bjgrnjg4hcbi0gXFxgaW50ZWdyYXRpb24vXFxgOiDntbHlkIjjg4bjgrnjg4hcbi0gXFxgcGF5bG9hZHMvXFxgOiDjg4bjgrnjg4jjg5rjgqTjg63jg7zjg4njg7vjg4fjg7zjgr9cbi0gXFxgbGVnYWN5L1xcYDog5Y+k44GE44OG44K544OI44OV44Kh44Kk44OrXG5cbiMjIOODhuOCueODiOWun+ihjFxuXG7lkITjg4bjgrnjg4jjga/pganliIfjgarjg4bjgrnjg4jjg6njg7Pjg4rjg7zjgaflrp/ooYzjgZfjgabjgY/jgaDjgZXjgYTjgIJcbmAsXG5cbiAgICAgICdhcmNoaXZlJzogYCMg44Ki44O844Kr44Kk44OW44OV44Kh44Kk44OrXG5cbiMjIOODh+OCo+ODrOOCr+ODiOODquani+aIkFxuXG4tIFxcYGxlZ2FjeS1maWxlcy9cXGA6IOWPpOOBhOODleOCoeOCpOODq1xuLSBcXGBvbGQtcHJvamVjdHMvXFxgOiDlj6TjgYTjg5fjg63jgrjjgqfjgq/jg4hcbi0gXFxgYmFja3VwLWZpbGVzL1xcYDog44OQ44OD44Kv44Ki44OD44OX44OV44Kh44Kk44OrXG5cbiMjIOazqOaEj+S6i+mghVxuXG7jgqLjg7zjgqvjgqTjg5bjgZXjgozjgZ/jg5XjgqHjgqTjg6vjga/lrprmnJ/nmoTjgavopovnm7TjgZfjgIHkuI3opoHjgarjgoLjga7jga/liYrpmaTjgZfjgabjgY/jgaDjgZXjgYTjgIJcbmBcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIFNTSCDjgrPjg57jg7Pjg4njgpLlrp/ooYxcbiAgICovXG4gIHByaXZhdGUgYXN5bmMgZXhlY3V0ZVNTSENvbW1hbmQoY29tbWFuZDogc3RyaW5nKTogUHJvbWlzZTx7IHN0ZG91dDogc3RyaW5nOyBzdGRlcnI6IHN0cmluZyB9PiB7XG4gICAgaWYgKCF0aGlzLnNzaENvbmZpZykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdTU0joqK3lrprjgYzmj5DkvpvjgZXjgozjgabjgYTjgb7jgZvjgpMnKTtcbiAgICB9XG5cbiAgICBjb25zdCBzc2hDb21tYW5kID0gYHNzaCAtaSBcIiR7dGhpcy5zc2hDb25maWcua2V5UGF0aH1cIiAtbyBDb25uZWN0VGltZW91dD0ke3RoaXMuc3NoQ29uZmlnLnRpbWVvdXQhIC8gMTAwMH0gLW8gU3RyaWN0SG9zdEtleUNoZWNraW5nPW5vIC1wICR7dGhpcy5zc2hDb25maWcucG9ydH0gJHt0aGlzLnNzaENvbmZpZy51c2VyfUAke3RoaXMuc3NoQ29uZmlnLmhvc3R9IFwiJHtjb21tYW5kfVwiYDtcbiAgICBcbiAgICB0cnkge1xuICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgZXhlY0FzeW5jKHNzaENvbW1hbmQsIHsgXG4gICAgICAgIHRpbWVvdXQ6IHRoaXMuc3NoQ29uZmlnLnRpbWVvdXQsXG4gICAgICAgIG1heEJ1ZmZlcjogMTAyNCAqIDEwMjQgKiAxMCAvLyAxME1CXG4gICAgICB9KTtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgaWYgKGVycm9yLmNvZGUgPT09ICdFVElNRURPVVQnKSB7XG4gICAgICAgIHRocm93IG5ldyBPcmdhbml6YXRpb25FcnJvcihcbiAgICAgICAgICBPcmdhbml6YXRpb25FcnJvclR5cGUuU1NIX0NPTk5FQ1RJT05fRkFJTEVELFxuICAgICAgICAgIGBTU0jmjqXntprjgYzjgr/jgqTjg6DjgqLjgqbjg4jjgZfjgb7jgZfjgZ86ICR7dGhpcy5zc2hDb25maWcuaG9zdH1gLFxuICAgICAgICAgIHVuZGVmaW5lZCxcbiAgICAgICAgICAnZWMyJyxcbiAgICAgICAgICBlcnJvclxuICAgICAgICApO1xuICAgICAgfVxuICAgICAgdGhyb3cgZXJyb3I7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIOOCqOODqeODvOe1kOaenOOCkuS9nOaIkFxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVFcnJvclJlc3VsdChlbnZpcm9ubWVudDogRW52aXJvbm1lbnQsIHJlYXNvbjogYW55KTogRGlyZWN0b3J5Q3JlYXRpb25SZXN1bHQge1xuICAgIHJldHVybiB7XG4gICAgICBjcmVhdGVkRGlyZWN0b3JpZXM6IDAsXG4gICAgICBjcmVhdGVkUGF0aHM6IFtdLFxuICAgICAgZXJyb3JzOiBbcmVhc29uIGluc3RhbmNlb2YgRXJyb3IgPyByZWFzb24ubWVzc2FnZSA6IFN0cmluZyhyZWFzb24pXSxcbiAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgZW52aXJvbm1lbnQsXG4gICAgICBwcm9jZXNzaW5nVGltZTogMFxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICog44OH44Kj44Os44Kv44OI44Oq5qeL6YCg44Gu5qSc6Ki8XG4gICAqL1xuICBwdWJsaWMgYXN5bmMgdmFsaWRhdGVEaXJlY3RvcnlTdHJ1Y3R1cmUoXG4gICAgYmFzZVBhdGg6IHN0cmluZyxcbiAgICBlbnZpcm9ubWVudDogRW52aXJvbm1lbnRcbiAgKTogUHJvbWlzZTx7XG4gICAgdmFsaWQ6IGJvb2xlYW47XG4gICAgbWlzc2luZ0RpcmVjdG9yaWVzOiBzdHJpbmdbXTtcbiAgICBleHRyYURpcmVjdG9yaWVzOiBzdHJpbmdbXTtcbiAgICBwZXJtaXNzaW9uSXNzdWVzOiBzdHJpbmdbXTtcbiAgfT4ge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCByZXF1aXJlZERpcmVjdG9yaWVzID0gdGhpcy5nZXRSZXF1aXJlZERpcmVjdG9yaWVzKCk7XG4gICAgICBjb25zdCBtaXNzaW5nRGlyZWN0b3JpZXM6IHN0cmluZ1tdID0gW107XG4gICAgICBjb25zdCBwZXJtaXNzaW9uSXNzdWVzOiBzdHJpbmdbXSA9IFtdO1xuXG4gICAgICBmb3IgKGNvbnN0IGRpclBhdGggb2YgcmVxdWlyZWREaXJlY3Rvcmllcykge1xuICAgICAgICBjb25zdCBmdWxsUGF0aCA9IGVudmlyb25tZW50ID09PSAnbG9jYWwnID8gXG4gICAgICAgICAgcGF0aC5yZXNvbHZlKGJhc2VQYXRoLCBkaXJQYXRoKSA6IFxuICAgICAgICAgIHBhdGgucG9zaXguam9pbihiYXNlUGF0aCwgZGlyUGF0aCk7XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBpZiAoZW52aXJvbm1lbnQgPT09ICdsb2NhbCcpIHtcbiAgICAgICAgICAgIGF3YWl0IGZzLmFjY2VzcyhmdWxsUGF0aCk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIOaoqemZkOODgeOCp+ODg+OCr1xuICAgICAgICAgICAgY29uc3Qgc3RhdHMgPSBhd2FpdCBmcy5zdGF0KGZ1bGxQYXRoKTtcbiAgICAgICAgICAgIGNvbnN0IHBlcm1pc3Npb25zID0gKHN0YXRzLm1vZGUgJiBwYXJzZUludCgnNzc3JywgOCkpLnRvU3RyaW5nKDgpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAoZGlyUGF0aC5pbmNsdWRlcygnc2VjcmV0cycpICYmIHBlcm1pc3Npb25zICE9PSAnNzAwJykge1xuICAgICAgICAgICAgICBwZXJtaXNzaW9uSXNzdWVzLnB1c2goYCR7ZGlyUGF0aH06IOacn+W+heaoqemZkDcwMCwg5a6f6ZqbJHtwZXJtaXNzaW9uc31gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5leGVjdXRlU1NIQ29tbWFuZChgdGVzdCAtZCBcIiR7ZnVsbFBhdGh9XCJgKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8g5qip6ZmQ44OB44Kn44OD44KvXG4gICAgICAgICAgICBjb25zdCB7IHN0ZG91dCB9ID0gYXdhaXQgdGhpcy5leGVjdXRlU1NIQ29tbWFuZChgc3RhdCAtYyBcIiVhXCIgXCIke2Z1bGxQYXRofVwiYCk7XG4gICAgICAgICAgICBjb25zdCBwZXJtaXNzaW9ucyA9IHN0ZG91dC50cmltKCk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmIChkaXJQYXRoLmluY2x1ZGVzKCdzZWNyZXRzJykgJiYgcGVybWlzc2lvbnMgIT09ICc3MDAnKSB7XG4gICAgICAgICAgICAgIHBlcm1pc3Npb25Jc3N1ZXMucHVzaChgJHtkaXJQYXRofTog5pyf5b6F5qip6ZmQNzAwLCDlrp/pmpske3Blcm1pc3Npb25zfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgbWlzc2luZ0RpcmVjdG9yaWVzLnB1c2goZGlyUGF0aCk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgY29uc3QgdmFsaWQgPSBtaXNzaW5nRGlyZWN0b3JpZXMubGVuZ3RoID09PSAwICYmIHBlcm1pc3Npb25Jc3N1ZXMubGVuZ3RoID09PSAwO1xuXG4gICAgICByZXR1cm4ge1xuICAgICAgICB2YWxpZCxcbiAgICAgICAgbWlzc2luZ0RpcmVjdG9yaWVzLFxuICAgICAgICBleHRyYURpcmVjdG9yaWVzOiBbXSwgLy8g5a6f6KOF57Ch55Wl5YyWXG4gICAgICAgIHBlcm1pc3Npb25Jc3N1ZXNcbiAgICAgIH07XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIHRocm93IG5ldyBPcmdhbml6YXRpb25FcnJvcihcbiAgICAgICAgT3JnYW5pemF0aW9uRXJyb3JUeXBlLlZBTElEQVRJT05fRkFJTEVELFxuICAgICAgICBg44OH44Kj44Os44Kv44OI44Oq5qeL6YCg5qSc6Ki844Gr5aSx5pWX44GX44G+44GX44GfOiAke2Vycm9yfWAsXG4gICAgICAgIGJhc2VQYXRoLFxuICAgICAgICBlbnZpcm9ubWVudCxcbiAgICAgICAgZXJyb3IgYXMgRXJyb3JcbiAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIOeSsOWig+OBq+W/nOOBmOOBn+ODh+OCo+ODrOOCr+ODiOODquani+mAoOOCkuS9nOaIkFxuICAgKi9cbiAgcHVibGljIGFzeW5jIGNyZWF0ZUVudmlyb25tZW50U3RydWN0dXJlKGJhc2VQYXRoOiBzdHJpbmcsIGVudmlyb25tZW50OiBFbnZpcm9ubWVudCA9ICdsb2NhbCcpOiBQcm9taXNlPERpcmVjdG9yeUNyZWF0aW9uUmVzdWx0PiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnNvbGUubG9nKGDwn4+X77iPIOeSsOWig+ODh+OCo+ODrOOCr+ODiOODquani+mAoOS9nOaIkOmWi+WnizogJHtlbnZpcm9ubWVudH1gKTtcbiAgICAgIFxuICAgICAgaWYgKGVudmlyb25tZW50ID09PSAnbG9jYWwnKSB7XG4gICAgICAgIHJldHVybiBhd2FpdCB0aGlzLmNyZWF0ZUxvY2FsRGlyZWN0b3J5U3RydWN0dXJlKGJhc2VQYXRoKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBhd2FpdCB0aGlzLmNyZWF0ZUVDMkRpcmVjdG9yeVN0cnVjdHVyZShiYXNlUGF0aCk7XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIHRocm93IG5ldyBPcmdhbml6YXRpb25FcnJvcihcbiAgICAgICAgT3JnYW5pemF0aW9uRXJyb3JUeXBlLkRJUkVDVE9SWV9DUkVBVElPTl9GQUlMRUQsXG4gICAgICAgIGDnkrDlooPjg4fjgqPjg6zjgq/jg4jjg6rmp4vpgKDkvZzmiJDjgavlpLHmlZfjgZfjgb7jgZfjgZ86ICR7ZXJyb3J9YCxcbiAgICAgICAgYmFzZVBhdGgsXG4gICAgICAgIGVudmlyb25tZW50LFxuICAgICAgICBlcnJvciBhcyBFcnJvclxuICAgICAgKTtcbiAgICB9XG4gIH1cbn0iXX0=