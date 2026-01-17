"use strict";
/**
 * 統合ファイル整理システム - EC2環境スキャナー
 *
 * EC2環境（Ubuntu）でのSSH接続によるリモートファイルスキャン機能を提供します。
 * 270個の平置きファイルとホームディレクトリの整理対象ファイルを検出します。
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
exports.EC2FileScanner = void 0;
const child_process_1 = require("child_process");
const util_1 = require("util");
const path = __importStar(require("path"));
const file_scanner_js_1 = require("../core/file-scanner.js");
const index_js_1 = require("../types/index.js");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
/**
 * EC2環境ファイルスキャナー
 *
 * SSH接続を使用してEC2環境のファイルシステムにアクセスし、
 * リモートファイルの情報を収集します。
 */
class EC2FileScanner extends file_scanner_js_1.BaseFileScanner {
    sshConfig;
    projectPath;
    homeDirectory;
    constructor(sshConfig, projectPath = '/home/ubuntu/rag/Permission-aware-RAG-FSxN-CDK-master', homeDirectory = '/home/ubuntu', excludePatterns = [
        'node_modules/**',
        '.git/**',
        'cdk.out/**',
        'dist/**',
        'build/**',
        '.npm/**',
        '.cache/**'
    ]) {
        super('ec2', excludePatterns);
        this.sshConfig = {
            port: 22,
            timeout: 30000,
            ...sshConfig
        };
        this.projectPath = projectPath;
        this.homeDirectory = homeDirectory;
    }
    /**
     * EC2環境の平置きファイルを検出
     *
     * 要件1.2, 6.1, 6.2, 6.3, 6.4, 6.5に対応
     */
    async detectEC2FlatFiles() {
        try {
            console.log(`EC2環境の平置きファイルをスキャン中: ${this.projectPath}`);
            // 調査スクリプトと同じコマンドを使用
            const command = `find "${this.projectPath}" -maxdepth 1 -type f ! -name '.*' -exec ls -la {} \\; 2>/dev/null || true`;
            const { stdout } = await this.executeSSHCommand(command);
            const files = [];
            const lines = stdout.split('\n').filter(line => line.trim());
            for (const line of lines) {
                const match = line.match(/^([d\-rwx]+)\s+\d+\s+\w+\s+\w+\s+(\d+)\s+\w+\s+\d+\s+[\d:]+\s+(.+)$/);
                if (match) {
                    const [, permissions, sizeStr, fullPath] = match;
                    const fileName = path.basename(fullPath);
                    const size = parseInt(sizeStr, 10);
                    // ディレクトリは除外
                    if (!permissions.startsWith('d')) {
                        files.push({
                            name: fileName,
                            path: fullPath,
                            size,
                            extension: path.extname(fileName),
                            isDirectory: false,
                            permissions,
                            lastModified: new Date(),
                            environment: 'ec2',
                            relativePath: path.relative(this.projectPath, fullPath)
                        });
                    }
                }
            }
            console.log(`EC2プロジェクトディレクトリで ${files.length} 個の平置きファイルを検出しました`);
            return files;
        }
        catch (error) {
            throw new index_js_1.OrganizationError(index_js_1.OrganizationErrorType.SSH_CONNECTION_FAILED, `EC2環境の平置きファイル検出に失敗しました: ${error}`, this.projectPath, 'ec2', error);
        }
    }
    /**
     * EC2ホームディレクトリの平置きファイルを検出
     */
    async detectHomeFlatFiles() {
        try {
            console.log(`EC2ホームディレクトリの平置きファイルをスキャン中: ${this.homeDirectory}`);
            // 調査スクリプトと同じコマンドを使用
            const command = `find "${this.homeDirectory}" -maxdepth 1 -type f ! -name '.*' -exec ls -la {} \\; 2>/dev/null || true`;
            const { stdout } = await this.executeSSHCommand(command);
            const files = [];
            const lines = stdout.split('\n').filter(line => line.trim());
            for (const line of lines) {
                const match = line.match(/^([d\-rwx]+)\s+\d+\s+\w+\s+\w+\s+(\d+)\s+\w+\s+\d+\s+[\d:]+\s+(.+)$/);
                if (match) {
                    const [, permissions, sizeStr, fullPath] = match;
                    const fileName = path.basename(fullPath);
                    const size = parseInt(sizeStr, 10);
                    // ディレクトリは除外
                    if (!permissions.startsWith('d')) {
                        files.push({
                            name: fileName,
                            path: fullPath,
                            size,
                            extension: path.extname(fileName),
                            isDirectory: false,
                            permissions,
                            lastModified: new Date(),
                            environment: 'ec2',
                            relativePath: path.relative(this.homeDirectory, fullPath)
                        });
                    }
                }
            }
            console.log(`EC2ホームディレクトリで ${files.length} 個の平置きファイルを検出しました`);
            return files;
        }
        catch (error) {
            throw new index_js_1.OrganizationError(index_js_1.OrganizationErrorType.SSH_CONNECTION_FAILED, `EC2ホームディレクトリの平置きファイル検出に失敗しました: ${error}`, this.homeDirectory, 'ec2', error);
        }
    }
    /**
     * 古いプロジェクトディレクトリを検出
     */
    async detectOldProjectDirectories() {
        try {
            const command = `find ${this.homeDirectory} -maxdepth 2 -type d -name "*-old" -o -name "*-backup" -o -name "*-archive" -o -name "*Permission-aware-RAG*" | grep -v "${this.projectPath}"`;
            const { stdout } = await this.executeSSHCommand(command);
            const directories = stdout.trim().split('\n').filter(line => line.length > 0);
            const oldProjects = [];
            for (const dirPath of directories) {
                const fileInfo = await this.getRemoteFileInfo(dirPath);
                if (fileInfo && fileInfo.isDirectory) {
                    oldProjects.push(fileInfo);
                }
            }
            console.log(`EC2環境で ${oldProjects.length} 個の古いプロジェクトディレクトリを検出しました`);
            return oldProjects;
        }
        catch (error) {
            console.warn('古いプロジェクトディレクトリの検出でエラーが発生しました:', error);
            return [];
        }
    }
    /**
     * リモートディレクトリをスキャン
     */
    async scanRemoteDirectory(remotePath, flatFilesOnly = false) {
        try {
            let command;
            if (flatFilesOnly) {
                // 平置きファイルのみを検出（隠しファイルを除く）
                command = `find "${remotePath}" -maxdepth 1 -type f ! -name '.*' -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/cdk.out/*" 2>/dev/null | head -1000`;
            }
            else {
                // 全ファイルを検出
                command = `find "${remotePath}" -type f -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/cdk.out/*" 2>/dev/null | head -1000`;
            }
            const { stdout } = await this.executeSSHCommand(command);
            const filePaths = stdout.trim().split('\n').filter(line => line.length > 0);
            const files = [];
            for (const filePath of filePaths) {
                // 平置きファイルのみの場合、ディレクトリ直下のファイルのみを対象
                if (flatFilesOnly) {
                    // リモートパスの相対パス計算（POSIX形式）
                    const normalizedRemotePath = remotePath.endsWith('/') ? remotePath.slice(0, -1) : remotePath;
                    const relativePath = filePath.replace(normalizedRemotePath + '/', '');
                    if (relativePath.includes('/')) {
                        continue; // サブディレクトリのファイルはスキップ
                    }
                }
                const fileInfo = await this.getRemoteFileInfo(filePath);
                if (fileInfo && (!flatFilesOnly || !fileInfo.isDirectory)) {
                    files.push(fileInfo);
                }
            }
            return files;
        }
        catch (error) {
            throw new index_js_1.OrganizationError(index_js_1.OrganizationErrorType.SSH_CONNECTION_FAILED, `リモートディレクトリスキャンに失敗しました: ${remotePath}`, remotePath, 'ec2', error);
        }
    }
    /**
     * リモートファイル情報を取得
     */
    async getRemoteFileInfo(filePath) {
        try {
            // stat コマンドでファイル情報を取得
            const statCommand = `stat -c "%n|%s|%Y|%A|%F" "${filePath}" 2>/dev/null || echo "ERROR"`;
            const { stdout } = await this.executeSSHCommand(statCommand);
            if (stdout.trim() === 'ERROR' || !stdout.trim()) {
                return null;
            }
            const [name, sizeStr, mtimeStr, permissions, fileType] = stdout.trim().split('|');
            const fileName = path.basename(filePath);
            const extension = path.extname(filePath);
            const size = parseInt(sizeStr, 10);
            const lastModified = new Date(parseInt(mtimeStr, 10) * 1000);
            const isDirectory = fileType.includes('directory');
            const isHidden = fileName.startsWith('.');
            // 小さなテキストファイルの内容を取得
            let content;
            if (!isDirectory && size < 1024 && this.isTextFile(extension)) {
                try {
                    const catCommand = `cat "${filePath}" 2>/dev/null | head -20`;
                    const { stdout: fileContent } = await this.executeSSHCommand(catCommand);
                    content = fileContent;
                }
                catch {
                    // 内容読み込みエラーは無視
                }
            }
            return {
                path: filePath,
                name: fileName,
                extension: extension.toLowerCase(),
                size,
                permissions: this.parseUnixPermissions(permissions),
                lastModified,
                content,
                environment: 'ec2',
                relativePath: this.getRelativePath(filePath),
                isDirectory,
                isHidden
            };
        }
        catch (error) {
            console.warn(`リモートファイル情報取得エラー: ${filePath}`, error);
            return null;
        }
    }
    /**
     * SSH コマンドを実行
     */
    async executeSSHCommand(command) {
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
     * Unix権限文字列を8進数に変換
     */
    parseUnixPermissions(permStr) {
        if (permStr.length !== 10) {
            return '644'; // デフォルト値
        }
        const owner = permStr.slice(1, 4);
        const group = permStr.slice(4, 7);
        const other = permStr.slice(7, 10);
        const convertPerm = (perm) => {
            let value = 0;
            if (perm[0] === 'r')
                value += 4;
            if (perm[1] === 'w')
                value += 2;
            if (perm[2] === 'x')
                value += 1;
            return value;
        };
        return `${convertPerm(owner)}${convertPerm(group)}${convertPerm(other)}`;
    }
    /**
     * 相対パスを取得（EC2環境用）
     */
    getRelativePath(filePath) {
        if (filePath.startsWith(this.projectPath)) {
            return path.relative(this.projectPath, filePath);
        }
        else if (filePath.startsWith(this.homeDirectory)) {
            return path.relative(this.homeDirectory, filePath);
        }
        return filePath;
    }
    /**
     * ファイル権限を取得（EC2環境用）
     */
    getPermissions(stats) {
        // EC2環境では getRemoteFileInfo で既に処理済み
        return '644';
    }
    /**
     * SSH接続テスト
     */
    async testConnection() {
        try {
            const { stdout } = await this.executeSSHCommand('echo "connection_test"');
            return stdout.trim() === 'connection_test';
        }
        catch (error) {
            console.error('SSH接続テストに失敗しました:', error);
            return false;
        }
    }
    /**
     * EC2環境の詳細情報を取得
     */
    async getEnvironmentInfo() {
        try {
            const commands = {
                hostname: 'hostname',
                platform: 'uname -s',
                architecture: 'uname -m',
                uptime: 'uptime',
                diskUsage: `df -h ${this.projectPath} | tail -1 | awk '{print $5}'`,
                memoryUsage: "free | grep Mem | awk '{printf \"%.1f%%\", $3/$2 * 100.0}'"
            };
            const results = {};
            for (const [key, command] of Object.entries(commands)) {
                try {
                    const { stdout } = await this.executeSSHCommand(command);
                    results[key] = stdout.trim();
                }
                catch {
                    results[key] = 'Unknown';
                }
            }
            const flatFiles = await this.detectEC2FlatFiles();
            const allFiles = await this.scanRemoteDirectory(this.projectPath);
            return {
                ...results,
                projectPath: this.projectPath,
                homeDirectory: this.homeDirectory,
                totalFiles: allFiles.length,
                flatFiles: flatFiles.length
            };
        }
        catch (error) {
            throw new index_js_1.OrganizationError(index_js_1.OrganizationErrorType.SSH_CONNECTION_FAILED, `EC2環境情報の取得に失敗しました: ${error}`, undefined, 'ec2', error);
        }
    }
    /**
     * EC2環境のヘルスチェック
     */
    async performHealthCheck() {
        const issues = [];
        const recommendations = [];
        try {
            // SSH接続テスト
            const connectionOk = await this.testConnection();
            if (!connectionOk) {
                issues.push('SSH接続に失敗しました');
                recommendations.push('SSH設定とネットワーク接続を確認してください');
                return { status: 'error', issues, recommendations };
            }
            // 平置きファイル数チェック
            const flatFiles = await this.detectEC2FlatFiles();
            if (flatFiles.length > 50) {
                issues.push(`平置きファイルが多すぎます: ${flatFiles.length}個`);
                recommendations.push('ファイル整理システムの実行を推奨します');
            }
            // ディスク使用量チェック
            const { stdout: diskUsage } = await this.executeSSHCommand(`df ${this.projectPath} | tail -1 | awk '{print $5}' | sed 's/%//'`);
            const diskUsagePercent = parseInt(diskUsage.trim(), 10);
            if (diskUsagePercent > 80) {
                issues.push(`ディスク使用量が高すぎます: ${diskUsagePercent}%`);
                recommendations.push('不要なファイルを削除してください');
            }
            // プロジェクトディレクトリアクセスチェック
            try {
                await this.executeSSHCommand(`test -r ${this.projectPath} && test -w ${this.projectPath}`);
            }
            catch {
                issues.push('プロジェクトディレクトリへの読み書き権限がありません');
                recommendations.push('ディレクトリ権限を確認してください');
            }
            const status = issues.length === 0 ? 'healthy' :
                issues.length <= 2 ? 'warning' : 'error';
            return { status, issues, recommendations };
        }
        catch (error) {
            return {
                status: 'error',
                issues: [`ヘルスチェック実行エラー: ${error}`],
                recommendations: ['SSH接続設定を確認してください']
            };
        }
    }
    /**
     * リモートディレクトリの存在確認
     */
    async verifyDirectoryExists(remotePath) {
        try {
            const command = `test -d "${remotePath}" && echo "exists" || echo "not_exists"`;
            const { stdout } = await this.executeSSHCommand(command);
            return stdout.trim() === 'exists';
        }
        catch (error) {
            console.warn(`ディレクトリ存在確認エラー: ${remotePath}`, error);
            return false;
        }
    }
    /**
     * リモートディレクトリの作成
     */
    async createRemoteDirectory(remotePath, permissions = '755') {
        try {
            const command = `mkdir -p "${remotePath}" && chmod ${permissions} "${remotePath}"`;
            await this.executeSSHCommand(command);
            return true;
        }
        catch (error) {
            console.error(`リモートディレクトリ作成エラー: ${remotePath}`, error);
            return false;
        }
    }
    /**
     * リモートディレクトリの書き込み権限確認
     */
    async verifyWritePermission(remotePath) {
        try {
            const testFile = `${remotePath}/.write_test_${Date.now()}`;
            const command = `touch "${testFile}" && rm "${testFile}" && echo "writable" || echo "not_writable"`;
            const { stdout } = await this.executeSSHCommand(command);
            return stdout.trim() === 'writable';
        }
        catch (error) {
            console.warn(`書き込み権限確認エラー: ${remotePath}`, error);
            return false;
        }
    }
    /**
     * EC2環境でのファイル分析
     */
    async analyzeEC2Files() {
        const flatFiles = await this.detectEC2FlatFiles();
        const oldProjects = await this.detectOldProjectDirectories();
        const analysis = {
            scriptFiles: [],
            documentFiles: [],
            configFiles: [],
            oldProjects,
            largeFiles: []
        };
        for (const file of flatFiles) {
            if (file.extension === '.sh') {
                analysis.scriptFiles.push(file);
            }
            else if (['.md', '.txt', '.doc'].includes(file.extension)) {
                analysis.documentFiles.push(file);
            }
            else if (['.json', '.js', '.ts', '.yml', '.yaml'].includes(file.extension)) {
                analysis.configFiles.push(file);
            }
            if (file.size > 10 * 1024 * 1024) { // 10MB以上
                analysis.largeFiles.push(file);
            }
        }
        return analysis;
    }
}
exports.EC2FileScanner = EC2FileScanner;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWMyLXNjYW5uZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJlYzItc2Nhbm5lci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7O0dBS0c7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsaURBQXFDO0FBQ3JDLCtCQUFpQztBQUNqQywyQ0FBNkI7QUFDN0IsNkRBQTBEO0FBQzFELGdEQUsyQjtBQUUzQixNQUFNLFNBQVMsR0FBRyxJQUFBLGdCQUFTLEVBQUMsb0JBQUksQ0FBQyxDQUFDO0FBYWxDOzs7OztHQUtHO0FBQ0gsTUFBYSxjQUFlLFNBQVEsaUNBQWU7SUFDaEMsU0FBUyxDQUFZO0lBQ3JCLFdBQVcsQ0FBUztJQUNwQixhQUFhLENBQVM7SUFFdkMsWUFDRSxTQUFvQixFQUNwQixjQUFzQix1REFBdUQsRUFDN0UsZ0JBQXdCLGNBQWMsRUFDdEMsa0JBQTRCO1FBQzFCLGlCQUFpQjtRQUNqQixTQUFTO1FBQ1QsWUFBWTtRQUNaLFNBQVM7UUFDVCxVQUFVO1FBQ1YsU0FBUztRQUNULFdBQVc7S0FDWjtRQUVELEtBQUssQ0FBQyxLQUFLLEVBQUUsZUFBZSxDQUFDLENBQUM7UUFDOUIsSUFBSSxDQUFDLFNBQVMsR0FBRztZQUNmLElBQUksRUFBRSxFQUFFO1lBQ1IsT0FBTyxFQUFFLEtBQUs7WUFDZCxHQUFHLFNBQVM7U0FDYixDQUFDO1FBQ0YsSUFBSSxDQUFDLFdBQVcsR0FBRyxXQUFXLENBQUM7UUFDL0IsSUFBSSxDQUFDLGFBQWEsR0FBRyxhQUFhLENBQUM7SUFDckMsQ0FBQztJQUVEOzs7O09BSUc7SUFDSSxLQUFLLENBQUMsa0JBQWtCO1FBQzdCLElBQUksQ0FBQztZQUNILE9BQU8sQ0FBQyxHQUFHLENBQUMsd0JBQXdCLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFDO1lBRXhELG9CQUFvQjtZQUNwQixNQUFNLE9BQU8sR0FBRyxTQUFTLElBQUksQ0FBQyxXQUFXLDRFQUE0RSxDQUFDO1lBQ3RILE1BQU0s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SSxDQUFDLENBQUM7WUFDcEMsQ0FBQztpQkFBTSxJQUFJLENBQUMsT0FBTyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFLE9BQU8sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQztnQkFDN0UsUUFBUSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDbEMsQ0FBQztZQUVELElBQUksSUFBSSxDQUFDLElBQUksR0FBRyxFQUFFLEdBQUcsSUFBSSxHQUFHLElBQUksRUFBRSxDQUFDLENBQUMsU0FBUztnQkFDM0MsUUFBUSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDakMsQ0FBQztRQUNILENBQUM7UUFFRCxPQUFPLFFBQVEsQ0FBQztJQUNsQixDQUFDO0NBQ0Y7QUEzaEJELHdDQTJoQkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIOe1seWQiOODleOCoeOCpOODq+aVtOeQhuOCt+OCueODhuODoCAtIEVDMueSsOWig+OCueOCreODo+ODiuODvFxuICogXG4gKiBFQzLnkrDlooPvvIhVYnVudHXvvInjgafjga5TU0jmjqXntprjgavjgojjgovjg6rjg6Ljg7zjg4jjg5XjgqHjgqTjg6vjgrnjgq3jg6Pjg7PmqZ/og73jgpLmj5DkvpvjgZfjgb7jgZnjgIJcbiAqIDI3MOWAi+OBruW5s+e9ruOBjeODleOCoeOCpOODq+OBqOODm+ODvOODoOODh+OCo+ODrOOCr+ODiOODquOBruaVtOeQhuWvvuixoeODleOCoeOCpOODq+OCkuaknOWHuuOBl+OBvuOBmeOAglxuICovXG5cbmltcG9ydCB7IGV4ZWMgfSBmcm9tICdjaGlsZF9wcm9jZXNzJztcbmltcG9ydCB7IHByb21pc2lmeSB9IGZyb20gJ3V0aWwnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IEJhc2VGaWxlU2Nhbm5lciB9IGZyb20gJy4uL2NvcmUvZmlsZS1zY2FubmVyLmpzJztcbmltcG9ydCB7IFxuICBGaWxlSW5mbywgXG4gIEVudmlyb25tZW50LFxuICBPcmdhbml6YXRpb25FcnJvcixcbiAgT3JnYW5pemF0aW9uRXJyb3JUeXBlXG59IGZyb20gJy4uL3R5cGVzL2luZGV4LmpzJztcblxuY29uc3QgZXhlY0FzeW5jID0gcHJvbWlzaWZ5KGV4ZWMpO1xuXG4vKipcbiAqIFNTSOaOpee2muioreWumlxuICovXG5leHBvcnQgaW50ZXJmYWNlIFNTSENvbmZpZyB7XG4gIGhvc3Q6IHN0cmluZztcbiAgdXNlcjogc3RyaW5nO1xuICBrZXlQYXRoOiBzdHJpbmc7XG4gIHBvcnQ/OiBudW1iZXI7XG4gIHRpbWVvdXQ/OiBudW1iZXI7XG59XG5cbi8qKlxuICogRUMy55Kw5aKD44OV44Kh44Kk44Or44K544Kt44Oj44OK44O8XG4gKiBcbiAqIFNTSOaOpee2muOCkuS9v+eUqOOBl+OBpkVDMueSsOWig+OBruODleOCoeOCpOODq+OCt+OCueODhuODoOOBq+OCouOCr+OCu+OCueOBl+OAgVxuICog44Oq44Oi44O844OI44OV44Kh44Kk44Or44Gu5oOF5aCx44KS5Y+O6ZuG44GX44G+44GZ44CCXG4gKi9cbmV4cG9ydCBjbGFzcyBFQzJGaWxlU2Nhbm5lciBleHRlbmRzIEJhc2VGaWxlU2Nhbm5lciB7XG4gIHByaXZhdGUgcmVhZG9ubHkgc3NoQ29uZmlnOiBTU0hDb25maWc7XG4gIHByaXZhdGUgcmVhZG9ubHkgcHJvamVjdFBhdGg6IHN0cmluZztcbiAgcHJpdmF0ZSByZWFkb25seSBob21lRGlyZWN0b3J5OiBzdHJpbmc7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgc3NoQ29uZmlnOiBTU0hDb25maWcsXG4gICAgcHJvamVjdFBhdGg6IHN0cmluZyA9ICcvaG9tZS91YnVudHUvcmFnL1Blcm1pc3Npb24tYXdhcmUtUkFHLUZTeE4tQ0RLLW1hc3RlcicsXG4gICAgaG9tZURpcmVjdG9yeTogc3RyaW5nID0gJy9ob21lL3VidW50dScsXG4gICAgZXhjbHVkZVBhdHRlcm5zOiBzdHJpbmdbXSA9IFtcbiAgICAgICdub2RlX21vZHVsZXMvKionLFxuICAgICAgJy5naXQvKionLFxuICAgICAgJ2Nkay5vdXQvKionLFxuICAgICAgJ2Rpc3QvKionLFxuICAgICAgJ2J1aWxkLyoqJyxcbiAgICAgICcubnBtLyoqJyxcbiAgICAgICcuY2FjaGUvKionXG4gICAgXVxuICApIHtcbiAgICBzdXBlcignZWMyJywgZXhjbHVkZVBhdHRlcm5zKTtcbiAgICB0aGlzLnNzaENvbmZpZyA9IHtcbiAgICAgIHBvcnQ6IDIyLFxuICAgICAgdGltZW91dDogMzAwMDAsXG4gICAgICAuLi5zc2hDb25maWdcbiAgICB9O1xuICAgIHRoaXMucHJvamVjdFBhdGggPSBwcm9qZWN0UGF0aDtcbiAgICB0aGlzLmhvbWVEaXJlY3RvcnkgPSBob21lRGlyZWN0b3J5O1xuICB9XG5cbiAgLyoqXG4gICAqIEVDMueSsOWig+OBruW5s+e9ruOBjeODleOCoeOCpOODq+OCkuaknOWHulxuICAgKiBcbiAgICog6KaB5Lu2MS4yLCA2LjEsIDYuMiwgNi4zLCA2LjQsIDYuNeOBq+WvvuW/nFxuICAgKi9cbiAgcHVibGljIGFzeW5jIGRldGVjdEVDMkZsYXRGaWxlcygpOiBQcm9taXNlPEZpbGVJbmZvW10+IHtcbiAgICB0cnkge1xuICAgICAgY29uc29sZS5sb2coYEVDMueSsOWig+OBruW5s+e9ruOBjeODleOCoeOCpOODq+OCkuOCueOCreODo+ODs+S4rTogJHt0aGlzLnByb2plY3RQYXRofWApO1xuICAgICAgXG4gICAgICAvLyDoqr/mn7vjgrnjgq/jg6rjg5fjg4jjgajlkIzjgZjjgrPjg57jg7Pjg4njgpLkvb/nlKhcbiAgICAgIGNvbnN0IGNvbW1hbmQgPSBgZmluZCBcIiR7dGhpcy5wcm9qZWN0UGF0aH1cIiAtbWF4ZGVwdGggMSAtdHlwZSBmICEgLW5hbWUgJy4qJyAtZXhlYyBscyAtbGEge30gXFxcXDsgMj4vZGV2L251bGwgfHwgdHJ1ZWA7XG4gICAgICBjb25zdCB7IHN0ZG91dCB9ID0gYXdhaXQgdGhpcy5leGVjdXRlU1NIQ29tbWFuZChjb21tYW5kKTtcbiAgICAgIFxuICAgICAgY29uc3QgZmlsZXM6IEZpbGVJbmZvW10gPSBbXTtcbiAgICAgIGNvbnN0IGxpbmVzID0gc3Rkb3V0LnNwbGl0KCdcXG4nKS5maWx0ZXIobGluZSA9PiBsaW5lLnRyaW0oKSk7XG4gICAgICBcbiAgICAgIGZvciAoY29uc3QgbGluZSBvZiBsaW5lcykge1xuICAgICAgICBjb25zdCBtYXRjaCA9IGxpbmUubWF0Y2goL14oW2RcXC1yd3hdKylcXHMrXFxkK1xccytcXHcrXFxzK1xcdytcXHMrKFxcZCspXFxzK1xcdytcXHMrXFxkK1xccytbXFxkOl0rXFxzKyguKykkLyk7XG4gICAgICAgIGlmIChtYXRjaCkge1xuICAgICAgICAgIGNvbnN0IFssIHBlcm1pc3Npb25zLCBzaXplU3RyLCBmdWxsUGF0aF0gPSBtYXRjaDtcbiAgICAgICAgICBjb25zdCBmaWxlTmFtZSA9IHBhdGguYmFzZW5hbWUoZnVsbFBhdGgpO1xuICAgICAgICAgIGNvbnN0IHNpemUgPSBwYXJzZUludChzaXplU3RyLCAxMCk7XG4gICAgICAgICAgXG4gICAgICAgICAgLy8g44OH44Kj44Os44Kv44OI44Oq44Gv6Zmk5aSWXG4gICAgICAgICAgaWYgKCFwZXJtaXNzaW9ucy5zdGFydHNXaXRoKCdkJykpIHtcbiAgICAgICAgICAgIGZpbGVzLnB1c2goe1xuICAgICAgICAgICAgICBuYW1lOiBmaWxlTmFtZSxcbiAgICAgICAgICAgICAgcGF0aDogZnVsbFBhdGgsXG4gICAgICAgICAgICAgIHNpemUsXG4gICAgICAgICAgICAgIGV4dGVuc2lvbjogcGF0aC5leHRuYW1lKGZpbGVOYW1lKSxcbiAgICAgICAgICAgICAgaXNEaXJlY3Rvcnk6IGZhbHNlLFxuICAgICAgICAgICAgICBwZXJtaXNzaW9ucyxcbiAgICAgICAgICAgICAgbGFzdE1vZGlmaWVkOiBuZXcgRGF0ZSgpLFxuICAgICAgICAgICAgICBlbnZpcm9ubWVudDogJ2VjMicsXG4gICAgICAgICAgICAgIHJlbGF0aXZlUGF0aDogcGF0aC5yZWxhdGl2ZSh0aGlzLnByb2plY3RQYXRoLCBmdWxsUGF0aClcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgRUMy44OX44Ot44K444Kn44Kv44OI44OH44Kj44Os44Kv44OI44Oq44GnICR7ZmlsZXMubGVuZ3RofSDlgIvjga7lubPnva7jgY3jg5XjgqHjgqTjg6vjgpLmpJzlh7rjgZfjgb7jgZfjgZ9gKTtcbiAgICAgIFxuICAgICAgcmV0dXJuIGZpbGVzO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICB0aHJvdyBuZXcgT3JnYW5pemF0aW9uRXJyb3IoXG4gICAgICAgIE9yZ2FuaXphdGlvbkVycm9yVHlwZS5TU0hfQ09OTkVDVElPTl9GQUlMRUQsXG4gICAgICAgIGBFQzLnkrDlooPjga7lubPnva7jgY3jg5XjgqHjgqTjg6vmpJzlh7rjgavlpLHmlZfjgZfjgb7jgZfjgZ86ICR7ZXJyb3J9YCxcbiAgICAgICAgdGhpcy5wcm9qZWN0UGF0aCxcbiAgICAgICAgJ2VjMicsXG4gICAgICAgIGVycm9yIGFzIEVycm9yXG4gICAgICApO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBFQzLjg5vjg7zjg6Djg4fjgqPjg6zjgq/jg4jjg6rjga7lubPnva7jgY3jg5XjgqHjgqTjg6vjgpLmpJzlh7pcbiAgICovXG4gIHB1YmxpYyBhc3luYyBkZXRlY3RIb21lRmxhdEZpbGVzKCk6IFByb21pc2U8RmlsZUluZm9bXT4ge1xuICAgIHRyeSB7XG4gICAgICBjb25zb2xlLmxvZyhgRUMy44Ob44O844Og44OH44Kj44Os44Kv44OI44Oq44Gu5bmz572u44GN44OV44Kh44Kk44Or44KS44K544Kt44Oj44Oz5LitOiAke3RoaXMuaG9tZURpcmVjdG9yeX1gKTtcbiAgICAgIFxuICAgICAgLy8g6Kq/5p+744K544Kv44Oq44OX44OI44Go5ZCM44GY44Kz44Oe44Oz44OJ44KS5L2/55SoXG4gICAgICBjb25zdCBjb21tYW5kID0gYGZpbmQgXCIke3RoaXMuaG9tZURpcmVjdG9yeX1cIiAtbWF4ZGVwdGggMSAtdHlwZSBmICEgLW5hbWUgJy4qJyAtZXhlYyBscyAtbGEge30gXFxcXDsgMj4vZGV2L251bGwgfHwgdHJ1ZWA7XG4gICAgICBjb25zdCB7IHN0ZG91dCB9ID0gYXdhaXQgdGhpcy5leGVjdXRlU1NIQ29tbWFuZChjb21tYW5kKTtcbiAgICAgIFxuICAgICAgY29uc3QgZmlsZXM6IEZpbGVJbmZvW10gPSBbXTtcbiAgICAgIGNvbnN0IGxpbmVzID0gc3Rkb3V0LnNwbGl0KCdcXG4nKS5maWx0ZXIobGluZSA9PiBsaW5lLnRyaW0oKSk7XG4gICAgICBcbiAgICAgIGZvciAoY29uc3QgbGluZSBvZiBsaW5lcykge1xuICAgICAgICBjb25zdCBtYXRjaCA9IGxpbmUubWF0Y2goL14oW2RcXC1yd3hdKylcXHMrXFxkK1xccytcXHcrXFxzK1xcdytcXHMrKFxcZCspXFxzK1xcdytcXHMrXFxkK1xccytbXFxkOl0rXFxzKyguKykkLyk7XG4gICAgICAgIGlmIChtYXRjaCkge1xuICAgICAgICAgIGNvbnN0IFssIHBlcm1pc3Npb25zLCBzaXplU3RyLCBmdWxsUGF0aF0gPSBtYXRjaDtcbiAgICAgICAgICBjb25zdCBmaWxlTmFtZSA9IHBhdGguYmFzZW5hbWUoZnVsbFBhdGgpO1xuICAgICAgICAgIGNvbnN0IHNpemUgPSBwYXJzZUludChzaXplU3RyLCAxMCk7XG4gICAgICAgICAgXG4gICAgICAgICAgLy8g44OH44Kj44Os44Kv44OI44Oq44Gv6Zmk5aSWXG4gICAgICAgICAgaWYgKCFwZXJtaXNzaW9ucy5zdGFydHNXaXRoKCdkJykpIHtcbiAgICAgICAgICAgIGZpbGVzLnB1c2goe1xuICAgICAgICAgICAgICBuYW1lOiBmaWxlTmFtZSxcbiAgICAgICAgICAgICAgcGF0aDogZnVsbFBhdGgsXG4gICAgICAgICAgICAgIHNpemUsXG4gICAgICAgICAgICAgIGV4dGVuc2lvbjogcGF0aC5leHRuYW1lKGZpbGVOYW1lKSxcbiAgICAgICAgICAgICAgaXNEaXJlY3Rvcnk6IGZhbHNlLFxuICAgICAgICAgICAgICBwZXJtaXNzaW9ucyxcbiAgICAgICAgICAgICAgbGFzdE1vZGlmaWVkOiBuZXcgRGF0ZSgpLFxuICAgICAgICAgICAgICBlbnZpcm9ubWVudDogJ2VjMicsXG4gICAgICAgICAgICAgIHJlbGF0aXZlUGF0aDogcGF0aC5yZWxhdGl2ZSh0aGlzLmhvbWVEaXJlY3RvcnksIGZ1bGxQYXRoKVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBFQzLjg5vjg7zjg6Djg4fjgqPjg6zjgq/jg4jjg6rjgacgJHtmaWxlcy5sZW5ndGh9IOWAi+OBruW5s+e9ruOBjeODleOCoeOCpOODq+OCkuaknOWHuuOBl+OBvuOBl+OBn2ApO1xuICAgICAgXG4gICAgICByZXR1cm4gZmlsZXM7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIHRocm93IG5ldyBPcmdhbml6YXRpb25FcnJvcihcbiAgICAgICAgT3JnYW5pemF0aW9uRXJyb3JUeXBlLlNTSF9DT05ORUNUSU9OX0ZBSUxFRCxcbiAgICAgICAgYEVDMuODm+ODvOODoOODh+OCo+ODrOOCr+ODiOODquOBruW5s+e9ruOBjeODleOCoeOCpOODq+aknOWHuuOBq+WkseaVl+OBl+OBvuOBl+OBnzogJHtlcnJvcn1gLFxuICAgICAgICB0aGlzLmhvbWVEaXJlY3RvcnksXG4gICAgICAgICdlYzInLFxuICAgICAgICBlcnJvciBhcyBFcnJvclxuICAgICAgKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICog5Y+k44GE44OX44Ot44K444Kn44Kv44OI44OH44Kj44Os44Kv44OI44Oq44KS5qSc5Ye6XG4gICAqL1xuICBwdWJsaWMgYXN5bmMgZGV0ZWN0T2xkUHJvamVjdERpcmVjdG9yaWVzKCk6IFByb21pc2U8RmlsZUluZm9bXT4ge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBjb21tYW5kID0gYGZpbmQgJHt0aGlzLmhvbWVEaXJlY3Rvcnl9IC1tYXhkZXB0aCAyIC10eXBlIGQgLW5hbWUgXCIqLW9sZFwiIC1vIC1uYW1lIFwiKi1iYWNrdXBcIiAtbyAtbmFtZSBcIiotYXJjaGl2ZVwiIC1vIC1uYW1lIFwiKlBlcm1pc3Npb24tYXdhcmUtUkFHKlwiIHwgZ3JlcCAtdiBcIiR7dGhpcy5wcm9qZWN0UGF0aH1cImA7XG4gICAgICBcbiAgICAgIGNvbnN0IHsgc3Rkb3V0IH0gPSBhd2FpdCB0aGlzLmV4ZWN1dGVTU0hDb21tYW5kKGNvbW1hbmQpO1xuICAgICAgY29uc3QgZGlyZWN0b3JpZXMgPSBzdGRvdXQudHJpbSgpLnNwbGl0KCdcXG4nKS5maWx0ZXIobGluZSA9PiBsaW5lLmxlbmd0aCA+IDApO1xuICAgICAgXG4gICAgICBjb25zdCBvbGRQcm9qZWN0czogRmlsZUluZm9bXSA9IFtdO1xuICAgICAgXG4gICAgICBmb3IgKGNvbnN0IGRpclBhdGggb2YgZGlyZWN0b3JpZXMpIHtcbiAgICAgICAgY29uc3QgZmlsZUluZm8gPSBhd2FpdCB0aGlzLmdldFJlbW90ZUZpbGVJbmZvKGRpclBhdGgpO1xuICAgICAgICBpZiAoZmlsZUluZm8gJiYgZmlsZUluZm8uaXNEaXJlY3RvcnkpIHtcbiAgICAgICAgICBvbGRQcm9qZWN0cy5wdXNoKGZpbGVJbmZvKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgRUMy55Kw5aKD44GnICR7b2xkUHJvamVjdHMubGVuZ3RofSDlgIvjga7lj6TjgYTjg5fjg63jgrjjgqfjgq/jg4jjg4fjgqPjg6zjgq/jg4jjg6rjgpLmpJzlh7rjgZfjgb7jgZfjgZ9gKTtcbiAgICAgIFxuICAgICAgcmV0dXJuIG9sZFByb2plY3RzO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLndhcm4oJ+WPpOOBhOODl+ODreOCuOOCp+OCr+ODiOODh+OCo+ODrOOCr+ODiOODquOBruaknOWHuuOBp+OCqOODqeODvOOBjOeZuueUn+OBl+OBvuOBl+OBnzonLCBlcnJvcik7XG4gICAgICByZXR1cm4gW107XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIOODquODouODvOODiOODh+OCo+ODrOOCr+ODiOODquOCkuOCueOCreODo+ODs1xuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBzY2FuUmVtb3RlRGlyZWN0b3J5KHJlbW90ZVBhdGg6IHN0cmluZywgZmxhdEZpbGVzT25seTogYm9vbGVhbiA9IGZhbHNlKTogUHJvbWlzZTxGaWxlSW5mb1tdPiB7XG4gICAgdHJ5IHtcbiAgICAgIGxldCBjb21tYW5kOiBzdHJpbmc7XG4gICAgICBpZiAoZmxhdEZpbGVzT25seSkge1xuICAgICAgICAvLyDlubPnva7jgY3jg5XjgqHjgqTjg6vjga7jgb/jgpLmpJzlh7rvvIjpmqDjgZfjg5XjgqHjgqTjg6vjgpLpmaTjgY/vvIlcbiAgICAgICAgY29tbWFuZCA9IGBmaW5kIFwiJHtyZW1vdGVQYXRofVwiIC1tYXhkZXB0aCAxIC10eXBlIGYgISAtbmFtZSAnLionIC1ub3QgLXBhdGggXCIqL25vZGVfbW9kdWxlcy8qXCIgLW5vdCAtcGF0aCBcIiovLmdpdC8qXCIgLW5vdCAtcGF0aCBcIiovY2RrLm91dC8qXCIgMj4vZGV2L251bGwgfCBoZWFkIC0xMDAwYDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIOWFqOODleOCoeOCpOODq+OCkuaknOWHulxuICAgICAgICBjb21tYW5kID0gYGZpbmQgXCIke3JlbW90ZVBhdGh9XCIgLXR5cGUgZiAtbm90IC1wYXRoIFwiKi9ub2RlX21vZHVsZXMvKlwiIC1ub3QgLXBhdGggXCIqLy5naXQvKlwiIC1ub3QgLXBhdGggXCIqL2Nkay5vdXQvKlwiIDI+L2Rldi9udWxsIHwgaGVhZCAtMTAwMGA7XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnN0IHsgc3Rkb3V0IH0gPSBhd2FpdCB0aGlzLmV4ZWN1dGVTU0hDb21tYW5kKGNvbW1hbmQpO1xuICAgICAgY29uc3QgZmlsZVBhdGhzID0gc3Rkb3V0LnRyaW0oKS5zcGxpdCgnXFxuJykuZmlsdGVyKGxpbmUgPT4gbGluZS5sZW5ndGggPiAwKTtcbiAgICAgIFxuICAgICAgY29uc3QgZmlsZXM6IEZpbGVJbmZvW10gPSBbXTtcbiAgICAgIFxuICAgICAgZm9yIChjb25zdCBmaWxlUGF0aCBvZiBmaWxlUGF0aHMpIHtcbiAgICAgICAgLy8g5bmz572u44GN44OV44Kh44Kk44Or44Gu44G/44Gu5aC05ZCI44CB44OH44Kj44Os44Kv44OI44Oq55u05LiL44Gu44OV44Kh44Kk44Or44Gu44G/44KS5a++6LGhXG4gICAgICAgIGlmIChmbGF0RmlsZXNPbmx5KSB7XG4gICAgICAgICAgLy8g44Oq44Oi44O844OI44OR44K544Gu55u45a++44OR44K56KiI566X77yIUE9TSVjlvaLlvI/vvIlcbiAgICAgICAgICBjb25zdCBub3JtYWxpemVkUmVtb3RlUGF0aCA9IHJlbW90ZVBhdGguZW5kc1dpdGgoJy8nKSA/IHJlbW90ZVBhdGguc2xpY2UoMCwgLTEpIDogcmVtb3RlUGF0aDtcbiAgICAgICAgICBjb25zdCByZWxhdGl2ZVBhdGggPSBmaWxlUGF0aC5yZXBsYWNlKG5vcm1hbGl6ZWRSZW1vdGVQYXRoICsgJy8nLCAnJyk7XG4gICAgICAgICAgaWYgKHJlbGF0aXZlUGF0aC5pbmNsdWRlcygnLycpKSB7XG4gICAgICAgICAgICBjb250aW51ZTsgLy8g44K144OW44OH44Kj44Os44Kv44OI44Oq44Gu44OV44Kh44Kk44Or44Gv44K544Kt44OD44OXXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBjb25zdCBmaWxlSW5mbyA9IGF3YWl0IHRoaXMuZ2V0UmVtb3RlRmlsZUluZm8oZmlsZVBhdGgpO1xuICAgICAgICBpZiAoZmlsZUluZm8gJiYgKCFmbGF0RmlsZXNPbmx5IHx8ICFmaWxlSW5mby5pc0RpcmVjdG9yeSkpIHtcbiAgICAgICAgICBmaWxlcy5wdXNoKGZpbGVJbmZvKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgXG4gICAgICByZXR1cm4gZmlsZXM7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIHRocm93IG5ldyBPcmdhbml6YXRpb25FcnJvcihcbiAgICAgICAgT3JnYW5pemF0aW9uRXJyb3JUeXBlLlNTSF9DT05ORUNUSU9OX0ZBSUxFRCxcbiAgICAgICAgYOODquODouODvOODiOODh+OCo+ODrOOCr+ODiOODquOCueOCreODo+ODs+OBq+WkseaVl+OBl+OBvuOBl+OBnzogJHtyZW1vdGVQYXRofWAsXG4gICAgICAgIHJlbW90ZVBhdGgsXG4gICAgICAgICdlYzInLFxuICAgICAgICBlcnJvciBhcyBFcnJvclxuICAgICAgKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICog44Oq44Oi44O844OI44OV44Kh44Kk44Or5oOF5aCx44KS5Y+W5b6XXG4gICAqL1xuICBwcml2YXRlIGFzeW5jIGdldFJlbW90ZUZpbGVJbmZvKGZpbGVQYXRoOiBzdHJpbmcpOiBQcm9taXNlPEZpbGVJbmZvIHwgbnVsbD4ge1xuICAgIHRyeSB7XG4gICAgICAvLyBzdGF0IOOCs+ODnuODs+ODieOBp+ODleOCoeOCpOODq+aDheWgseOCkuWPluW+l1xuICAgICAgY29uc3Qgc3RhdENvbW1hbmQgPSBgc3RhdCAtYyBcIiVufCVzfCVZfCVBfCVGXCIgXCIke2ZpbGVQYXRofVwiIDI+L2Rldi9udWxsIHx8IGVjaG8gXCJFUlJPUlwiYDtcbiAgICAgIGNvbnN0IHsgc3Rkb3V0IH0gPSBhd2FpdCB0aGlzLmV4ZWN1dGVTU0hDb21tYW5kKHN0YXRDb21tYW5kKTtcbiAgICAgIFxuICAgICAgaWYgKHN0ZG91dC50cmltKCkgPT09ICdFUlJPUicgfHwgIXN0ZG91dC50cmltKCkpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnN0IFtuYW1lLCBzaXplU3RyLCBtdGltZVN0ciwgcGVybWlzc2lvbnMsIGZpbGVUeXBlXSA9IHN0ZG91dC50cmltKCkuc3BsaXQoJ3wnKTtcbiAgICAgIFxuICAgICAgY29uc3QgZmlsZU5hbWUgPSBwYXRoLmJhc2VuYW1lKGZpbGVQYXRoKTtcbiAgICAgIGNvbnN0IGV4dGVuc2lvbiA9IHBhdGguZXh0bmFtZShmaWxlUGF0aCk7XG4gICAgICBjb25zdCBzaXplID0gcGFyc2VJbnQoc2l6ZVN0ciwgMTApO1xuICAgICAgY29uc3QgbGFzdE1vZGlmaWVkID0gbmV3IERhdGUocGFyc2VJbnQobXRpbWVTdHIsIDEwKSAqIDEwMDApO1xuICAgICAgY29uc3QgaXNEaXJlY3RvcnkgPSBmaWxlVHlwZS5pbmNsdWRlcygnZGlyZWN0b3J5Jyk7XG4gICAgICBjb25zdCBpc0hpZGRlbiA9IGZpbGVOYW1lLnN0YXJ0c1dpdGgoJy4nKTtcbiAgICAgIFxuICAgICAgLy8g5bCP44GV44Gq44OG44Kt44K544OI44OV44Kh44Kk44Or44Gu5YaF5a6544KS5Y+W5b6XXG4gICAgICBsZXQgY29udGVudDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuICAgICAgaWYgKCFpc0RpcmVjdG9yeSAmJiBzaXplIDwgMTAyNCAmJiB0aGlzLmlzVGV4dEZpbGUoZXh0ZW5zaW9uKSkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbnN0IGNhdENvbW1hbmQgPSBgY2F0IFwiJHtmaWxlUGF0aH1cIiAyPi9kZXYvbnVsbCB8IGhlYWQgLTIwYDtcbiAgICAgICAgICBjb25zdCB7IHN0ZG91dDogZmlsZUNvbnRlbnQgfSA9IGF3YWl0IHRoaXMuZXhlY3V0ZVNTSENvbW1hbmQoY2F0Q29tbWFuZCk7XG4gICAgICAgICAgY29udGVudCA9IGZpbGVDb250ZW50O1xuICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAvLyDlhoXlrrnoqq3jgb/ovrzjgb/jgqjjg6njg7zjga/nhKHoppZcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgXG4gICAgICByZXR1cm4ge1xuICAgICAgICBwYXRoOiBmaWxlUGF0aCxcbiAgICAgICAgbmFtZTogZmlsZU5hbWUsXG4gICAgICAgIGV4dGVuc2lvbjogZXh0ZW5zaW9uLnRvTG93ZXJDYXNlKCksXG4gICAgICAgIHNpemUsXG4gICAgICAgIHBlcm1pc3Npb25zOiB0aGlzLnBhcnNlVW5peFBlcm1pc3Npb25zKHBlcm1pc3Npb25zKSxcbiAgICAgICAgbGFzdE1vZGlmaWVkLFxuICAgICAgICBjb250ZW50LFxuICAgICAgICBlbnZpcm9ubWVudDogJ2VjMicsXG4gICAgICAgIHJlbGF0aXZlUGF0aDogdGhpcy5nZXRSZWxhdGl2ZVBhdGgoZmlsZVBhdGgpLFxuICAgICAgICBpc0RpcmVjdG9yeSxcbiAgICAgICAgaXNIaWRkZW5cbiAgICAgIH07XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUud2Fybihg44Oq44Oi44O844OI44OV44Kh44Kk44Or5oOF5aCx5Y+W5b6X44Ko44Op44O8OiAke2ZpbGVQYXRofWAsIGVycm9yKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBTU0gg44Kz44Oe44Oz44OJ44KS5a6f6KGMXG4gICAqL1xuICBwcml2YXRlIGFzeW5jIGV4ZWN1dGVTU0hDb21tYW5kKGNvbW1hbmQ6IHN0cmluZyk6IFByb21pc2U8eyBzdGRvdXQ6IHN0cmluZzsgc3RkZXJyOiBzdHJpbmcgfT4ge1xuICAgIGNvbnN0IHNzaENvbW1hbmQgPSBgc3NoIC1pIFwiJHt0aGlzLnNzaENvbmZpZy5rZXlQYXRofVwiIC1vIENvbm5lY3RUaW1lb3V0PSR7dGhpcy5zc2hDb25maWcudGltZW91dCEgLyAxMDAwfSAtbyBTdHJpY3RIb3N0S2V5Q2hlY2tpbmc9bm8gLXAgJHt0aGlzLnNzaENvbmZpZy5wb3J0fSAke3RoaXMuc3NoQ29uZmlnLnVzZXJ9QCR7dGhpcy5zc2hDb25maWcuaG9zdH0gXCIke2NvbW1hbmR9XCJgO1xuICAgIFxuICAgIHRyeSB7XG4gICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBleGVjQXN5bmMoc3NoQ29tbWFuZCwgeyBcbiAgICAgICAgdGltZW91dDogdGhpcy5zc2hDb25maWcudGltZW91dCxcbiAgICAgICAgbWF4QnVmZmVyOiAxMDI0ICogMTAyNCAqIDEwIC8vIDEwTUJcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICBpZiAoZXJyb3IuY29kZSA9PT0gJ0VUSU1FRE9VVCcpIHtcbiAgICAgICAgdGhyb3cgbmV3IE9yZ2FuaXphdGlvbkVycm9yKFxuICAgICAgICAgIE9yZ2FuaXphdGlvbkVycm9yVHlwZS5TU0hfQ09OTkVDVElPTl9GQUlMRUQsXG4gICAgICAgICAgYFNTSOaOpee2muOBjOOCv+OCpOODoOOCouOCpuODiOOBl+OBvuOBl+OBnzogJHt0aGlzLnNzaENvbmZpZy5ob3N0fWAsXG4gICAgICAgICAgdW5kZWZpbmVkLFxuICAgICAgICAgICdlYzInLFxuICAgICAgICAgIGVycm9yXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgICB0aHJvdyBlcnJvcjtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogVW5peOaoqemZkOaWh+Wtl+WIl+OCkjjpgLLmlbDjgavlpInmj5tcbiAgICovXG4gIHByaXZhdGUgcGFyc2VVbml4UGVybWlzc2lvbnMocGVybVN0cjogc3RyaW5nKTogc3RyaW5nIHtcbiAgICBpZiAocGVybVN0ci5sZW5ndGggIT09IDEwKSB7XG4gICAgICByZXR1cm4gJzY0NCc7IC8vIOODh+ODleOCqeODq+ODiOWApFxuICAgIH1cbiAgICBcbiAgICBjb25zdCBvd25lciA9IHBlcm1TdHIuc2xpY2UoMSwgNCk7XG4gICAgY29uc3QgZ3JvdXAgPSBwZXJtU3RyLnNsaWNlKDQsIDcpO1xuICAgIGNvbnN0IG90aGVyID0gcGVybVN0ci5zbGljZSg3LCAxMCk7XG4gICAgXG4gICAgY29uc3QgY29udmVydFBlcm0gPSAocGVybTogc3RyaW5nKTogbnVtYmVyID0+IHtcbiAgICAgIGxldCB2YWx1ZSA9IDA7XG4gICAgICBpZiAocGVybVswXSA9PT0gJ3InKSB2YWx1ZSArPSA0O1xuICAgICAgaWYgKHBlcm1bMV0gPT09ICd3JykgdmFsdWUgKz0gMjtcbiAgICAgIGlmIChwZXJtWzJdID09PSAneCcpIHZhbHVlICs9IDE7XG4gICAgICByZXR1cm4gdmFsdWU7XG4gICAgfTtcbiAgICBcbiAgICByZXR1cm4gYCR7Y29udmVydFBlcm0ob3duZXIpfSR7Y29udmVydFBlcm0oZ3JvdXApfSR7Y29udmVydFBlcm0ob3RoZXIpfWA7XG4gIH1cblxuICAvKipcbiAgICog55u45a++44OR44K544KS5Y+W5b6X77yIRUMy55Kw5aKD55So77yJXG4gICAqL1xuICBwcm90ZWN0ZWQgZ2V0UmVsYXRpdmVQYXRoKGZpbGVQYXRoOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIGlmIChmaWxlUGF0aC5zdGFydHNXaXRoKHRoaXMucHJvamVjdFBhdGgpKSB7XG4gICAgICByZXR1cm4gcGF0aC5yZWxhdGl2ZSh0aGlzLnByb2plY3RQYXRoLCBmaWxlUGF0aCk7XG4gICAgfSBlbHNlIGlmIChmaWxlUGF0aC5zdGFydHNXaXRoKHRoaXMuaG9tZURpcmVjdG9yeSkpIHtcbiAgICAgIHJldHVybiBwYXRoLnJlbGF0aXZlKHRoaXMuaG9tZURpcmVjdG9yeSwgZmlsZVBhdGgpO1xuICAgIH1cbiAgICByZXR1cm4gZmlsZVBhdGg7XG4gIH1cblxuICAvKipcbiAgICog44OV44Kh44Kk44Or5qip6ZmQ44KS5Y+W5b6X77yIRUMy55Kw5aKD55So77yJXG4gICAqL1xuICBwcm90ZWN0ZWQgZ2V0UGVybWlzc2lvbnMoc3RhdHM6IGFueSk6IHN0cmluZyB7XG4gICAgLy8gRUMy55Kw5aKD44Gn44GvIGdldFJlbW90ZUZpbGVJbmZvIOOBp+aXouOBq+WHpueQhua4iOOBv1xuICAgIHJldHVybiAnNjQ0JztcbiAgfVxuXG4gIC8qKlxuICAgKiBTU0jmjqXntprjg4bjgrnjg4hcbiAgICovXG4gIHB1YmxpYyBhc3luYyB0ZXN0Q29ubmVjdGlvbigpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgeyBzdGRvdXQgfSA9IGF3YWl0IHRoaXMuZXhlY3V0ZVNTSENvbW1hbmQoJ2VjaG8gXCJjb25uZWN0aW9uX3Rlc3RcIicpO1xuICAgICAgcmV0dXJuIHN0ZG91dC50cmltKCkgPT09ICdjb25uZWN0aW9uX3Rlc3QnO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdTU0jmjqXntprjg4bjgrnjg4jjgavlpLHmlZfjgZfjgb7jgZfjgZ86JywgZXJyb3IpO1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBFQzLnkrDlooPjga7oqbPntLDmg4XloLHjgpLlj5blvpdcbiAgICovXG4gIHB1YmxpYyBhc3luYyBnZXRFbnZpcm9ubWVudEluZm8oKTogUHJvbWlzZTx7XG4gICAgaG9zdG5hbWU6IHN0cmluZztcbiAgICBwbGF0Zm9ybTogc3RyaW5nO1xuICAgIGFyY2hpdGVjdHVyZTogc3RyaW5nO1xuICAgIHVwdGltZTogc3RyaW5nO1xuICAgIGRpc2tVc2FnZTogc3RyaW5nO1xuICAgIG1lbW9yeVVzYWdlOiBzdHJpbmc7XG4gICAgcHJvamVjdFBhdGg6IHN0cmluZztcbiAgICBob21lRGlyZWN0b3J5OiBzdHJpbmc7XG4gICAgdG90YWxGaWxlczogbnVtYmVyO1xuICAgIGZsYXRGaWxlczogbnVtYmVyO1xuICB9PiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGNvbW1hbmRzID0ge1xuICAgICAgICBob3N0bmFtZTogJ2hvc3RuYW1lJyxcbiAgICAgICAgcGxhdGZvcm06ICd1bmFtZSAtcycsXG4gICAgICAgIGFyY2hpdGVjdHVyZTogJ3VuYW1lIC1tJyxcbiAgICAgICAgdXB0aW1lOiAndXB0aW1lJyxcbiAgICAgICAgZGlza1VzYWdlOiBgZGYgLWggJHt0aGlzLnByb2plY3RQYXRofSB8IHRhaWwgLTEgfCBhd2sgJ3twcmludCAkNX0nYCxcbiAgICAgICAgbWVtb3J5VXNhZ2U6IFwiZnJlZSB8IGdyZXAgTWVtIHwgYXdrICd7cHJpbnRmIFxcXCIlLjFmJSVcXFwiLCAkMy8kMiAqIDEwMC4wfSdcIlxuICAgICAgfTtcblxuICAgICAgY29uc3QgcmVzdWx0czogYW55ID0ge307XG4gICAgICBcbiAgICAgIGZvciAoY29uc3QgW2tleSwgY29tbWFuZF0gb2YgT2JqZWN0LmVudHJpZXMoY29tbWFuZHMpKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgY29uc3QgeyBzdGRvdXQgfSA9IGF3YWl0IHRoaXMuZXhlY3V0ZVNTSENvbW1hbmQoY29tbWFuZCk7XG4gICAgICAgICAgcmVzdWx0c1trZXldID0gc3Rkb3V0LnRyaW0oKTtcbiAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgcmVzdWx0c1trZXldID0gJ1Vua25vd24nO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGZsYXRGaWxlcyA9IGF3YWl0IHRoaXMuZGV0ZWN0RUMyRmxhdEZpbGVzKCk7XG4gICAgICBjb25zdCBhbGxGaWxlcyA9IGF3YWl0IHRoaXMuc2NhblJlbW90ZURpcmVjdG9yeSh0aGlzLnByb2plY3RQYXRoKTtcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgLi4ucmVzdWx0cyxcbiAgICAgICAgcHJvamVjdFBhdGg6IHRoaXMucHJvamVjdFBhdGgsXG4gICAgICAgIGhvbWVEaXJlY3Rvcnk6IHRoaXMuaG9tZURpcmVjdG9yeSxcbiAgICAgICAgdG90YWxGaWxlczogYWxsRmlsZXMubGVuZ3RoLFxuICAgICAgICBmbGF0RmlsZXM6IGZsYXRGaWxlcy5sZW5ndGhcbiAgICAgIH07XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIHRocm93IG5ldyBPcmdhbml6YXRpb25FcnJvcihcbiAgICAgICAgT3JnYW5pemF0aW9uRXJyb3JUeXBlLlNTSF9DT05ORUNUSU9OX0ZBSUxFRCxcbiAgICAgICAgYEVDMueSsOWig+aDheWgseOBruWPluW+l+OBq+WkseaVl+OBl+OBvuOBl+OBnzogJHtlcnJvcn1gLFxuICAgICAgICB1bmRlZmluZWQsXG4gICAgICAgICdlYzInLFxuICAgICAgICBlcnJvciBhcyBFcnJvclxuICAgICAgKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogRUMy55Kw5aKD44Gu44OY44Or44K544OB44Kn44OD44KvXG4gICAqL1xuICBwdWJsaWMgYXN5bmMgcGVyZm9ybUhlYWx0aENoZWNrKCk6IFByb21pc2U8e1xuICAgIHN0YXR1czogJ2hlYWx0aHknIHwgJ3dhcm5pbmcnIHwgJ2Vycm9yJztcbiAgICBpc3N1ZXM6IHN0cmluZ1tdO1xuICAgIHJlY29tbWVuZGF0aW9uczogc3RyaW5nW107XG4gIH0+IHtcbiAgICBjb25zdCBpc3N1ZXM6IHN0cmluZ1tdID0gW107XG4gICAgY29uc3QgcmVjb21tZW5kYXRpb25zOiBzdHJpbmdbXSA9IFtdO1xuXG4gICAgdHJ5IHtcbiAgICAgIC8vIFNTSOaOpee2muODhuOCueODiFxuICAgICAgY29uc3QgY29ubmVjdGlvbk9rID0gYXdhaXQgdGhpcy50ZXN0Q29ubmVjdGlvbigpO1xuICAgICAgaWYgKCFjb25uZWN0aW9uT2spIHtcbiAgICAgICAgaXNzdWVzLnB1c2goJ1NTSOaOpee2muOBq+WkseaVl+OBl+OBvuOBl+OBnycpO1xuICAgICAgICByZWNvbW1lbmRhdGlvbnMucHVzaCgnU1NI6Kit5a6a44Go44ON44OD44OI44Ov44O844Kv5o6l57aa44KS56K66KqN44GX44Gm44GP44Gg44GV44GEJyk7XG4gICAgICAgIHJldHVybiB7IHN0YXR1czogJ2Vycm9yJywgaXNzdWVzLCByZWNvbW1lbmRhdGlvbnMgfTtcbiAgICAgIH1cblxuICAgICAgLy8g5bmz572u44GN44OV44Kh44Kk44Or5pWw44OB44Kn44OD44KvXG4gICAgICBjb25zdCBmbGF0RmlsZXMgPSBhd2FpdCB0aGlzLmRldGVjdEVDMkZsYXRGaWxlcygpO1xuICAgICAgaWYgKGZsYXRGaWxlcy5sZW5ndGggPiA1MCkge1xuICAgICAgICBpc3N1ZXMucHVzaChg5bmz572u44GN44OV44Kh44Kk44Or44GM5aSa44GZ44GO44G+44GZOiAke2ZsYXRGaWxlcy5sZW5ndGh95YCLYCk7XG4gICAgICAgIHJlY29tbWVuZGF0aW9ucy5wdXNoKCfjg5XjgqHjgqTjg6vmlbTnkIbjgrfjgrnjg4bjg6Djga7lrp/ooYzjgpLmjqjlpajjgZfjgb7jgZknKTtcbiAgICAgIH1cblxuICAgICAgLy8g44OH44Kj44K544Kv5L2/55So6YeP44OB44Kn44OD44KvXG4gICAgICBjb25zdCB7IHN0ZG91dDogZGlza1VzYWdlIH0gPSBhd2FpdCB0aGlzLmV4ZWN1dGVTU0hDb21tYW5kKGBkZiAke3RoaXMucHJvamVjdFBhdGh9IHwgdGFpbCAtMSB8IGF3ayAne3ByaW50ICQ1fScgfCBzZWQgJ3MvJS8vJ2ApO1xuICAgICAgY29uc3QgZGlza1VzYWdlUGVyY2VudCA9IHBhcnNlSW50KGRpc2tVc2FnZS50cmltKCksIDEwKTtcbiAgICAgIGlmIChkaXNrVXNhZ2VQZXJjZW50ID4gODApIHtcbiAgICAgICAgaXNzdWVzLnB1c2goYOODh+OCo+OCueOCr+S9v+eUqOmHj+OBjOmrmOOBmeOBjuOBvuOBmTogJHtkaXNrVXNhZ2VQZXJjZW50fSVgKTtcbiAgICAgICAgcmVjb21tZW5kYXRpb25zLnB1c2goJ+S4jeimgeOBquODleOCoeOCpOODq+OCkuWJiumZpOOBl+OBpuOBj+OBoOOBleOBhCcpO1xuICAgICAgfVxuXG4gICAgICAvLyDjg5fjg63jgrjjgqfjgq/jg4jjg4fjgqPjg6zjgq/jg4jjg6rjgqLjgq/jgrvjgrnjg4Hjgqfjg4Pjgq9cbiAgICAgIHRyeSB7XG4gICAgICAgIGF3YWl0IHRoaXMuZXhlY3V0ZVNTSENvbW1hbmQoYHRlc3QgLXIgJHt0aGlzLnByb2plY3RQYXRofSAmJiB0ZXN0IC13ICR7dGhpcy5wcm9qZWN0UGF0aH1gKTtcbiAgICAgIH0gY2F0Y2gge1xuICAgICAgICBpc3N1ZXMucHVzaCgn44OX44Ot44K444Kn44Kv44OI44OH44Kj44Os44Kv44OI44Oq44G444Gu6Kqt44G/5pu444GN5qip6ZmQ44GM44GC44KK44G+44Gb44KTJyk7XG4gICAgICAgIHJlY29tbWVuZGF0aW9ucy5wdXNoKCfjg4fjgqPjg6zjgq/jg4jjg6rmqKnpmZDjgpLnorroqo3jgZfjgabjgY/jgaDjgZXjgYQnKTtcbiAgICAgIH1cblxuICAgICAgY29uc3Qgc3RhdHVzID0gaXNzdWVzLmxlbmd0aCA9PT0gMCA/ICdoZWFsdGh5JyA6IFxuICAgICAgICAgICAgICAgICAgICBpc3N1ZXMubGVuZ3RoIDw9IDIgPyAnd2FybmluZycgOiAnZXJyb3InO1xuXG4gICAgICByZXR1cm4geyBzdGF0dXMsIGlzc3VlcywgcmVjb21tZW5kYXRpb25zIH07XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHN0YXR1czogJ2Vycm9yJyxcbiAgICAgICAgaXNzdWVzOiBbYOODmOODq+OCueODgeOCp+ODg+OCr+Wun+ihjOOCqOODqeODvDogJHtlcnJvcn1gXSxcbiAgICAgICAgcmVjb21tZW5kYXRpb25zOiBbJ1NTSOaOpee2muioreWumuOCkueiuuiqjeOBl+OBpuOBj+OBoOOBleOBhCddXG4gICAgICB9O1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDjg6rjg6Ljg7zjg4jjg4fjgqPjg6zjgq/jg4jjg6rjga7lrZjlnKjnorroqo1cbiAgICovXG4gIHB1YmxpYyBhc3luYyB2ZXJpZnlEaXJlY3RvcnlFeGlzdHMocmVtb3RlUGF0aDogc3RyaW5nKTogUHJvbWlzZTxib29sZWFuPiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGNvbW1hbmQgPSBgdGVzdCAtZCBcIiR7cmVtb3RlUGF0aH1cIiAmJiBlY2hvIFwiZXhpc3RzXCIgfHwgZWNobyBcIm5vdF9leGlzdHNcImA7XG4gICAgICBjb25zdCB7IHN0ZG91dCB9ID0gYXdhaXQgdGhpcy5leGVjdXRlU1NIQ29tbWFuZChjb21tYW5kKTtcbiAgICAgIHJldHVybiBzdGRvdXQudHJpbSgpID09PSAnZXhpc3RzJztcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS53YXJuKGDjg4fjgqPjg6zjgq/jg4jjg6rlrZjlnKjnorroqo3jgqjjg6njg7w6ICR7cmVtb3RlUGF0aH1gLCBlcnJvcik7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIOODquODouODvOODiOODh+OCo+ODrOOCr+ODiOODquOBruS9nOaIkFxuICAgKi9cbiAgcHVibGljIGFzeW5jIGNyZWF0ZVJlbW90ZURpcmVjdG9yeShyZW1vdGVQYXRoOiBzdHJpbmcsIHBlcm1pc3Npb25zOiBzdHJpbmcgPSAnNzU1Jyk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBjb21tYW5kID0gYG1rZGlyIC1wIFwiJHtyZW1vdGVQYXRofVwiICYmIGNobW9kICR7cGVybWlzc2lvbnN9IFwiJHtyZW1vdGVQYXRofVwiYDtcbiAgICAgIGF3YWl0IHRoaXMuZXhlY3V0ZVNTSENvbW1hbmQoY29tbWFuZCk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcihg44Oq44Oi44O844OI44OH44Kj44Os44Kv44OI44Oq5L2c5oiQ44Ko44Op44O8OiAke3JlbW90ZVBhdGh9YCwgZXJyb3IpO1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDjg6rjg6Ljg7zjg4jjg4fjgqPjg6zjgq/jg4jjg6rjga7mm7jjgY3ovrzjgb/mqKnpmZDnorroqo1cbiAgICovXG4gIHB1YmxpYyBhc3luYyB2ZXJpZnlXcml0ZVBlcm1pc3Npb24ocmVtb3RlUGF0aDogc3RyaW5nKTogUHJvbWlzZTxib29sZWFuPiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHRlc3RGaWxlID0gYCR7cmVtb3RlUGF0aH0vLndyaXRlX3Rlc3RfJHtEYXRlLm5vdygpfWA7XG4gICAgICBjb25zdCBjb21tYW5kID0gYHRvdWNoIFwiJHt0ZXN0RmlsZX1cIiAmJiBybSBcIiR7dGVzdEZpbGV9XCIgJiYgZWNobyBcIndyaXRhYmxlXCIgfHwgZWNobyBcIm5vdF93cml0YWJsZVwiYDtcbiAgICAgIGNvbnN0IHsgc3Rkb3V0IH0gPSBhd2FpdCB0aGlzLmV4ZWN1dGVTU0hDb21tYW5kKGNvbW1hbmQpO1xuICAgICAgcmV0dXJuIHN0ZG91dC50cmltKCkgPT09ICd3cml0YWJsZSc7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUud2Fybihg5pu444GN6L6844G/5qip6ZmQ56K66KqN44Ko44Op44O8OiAke3JlbW90ZVBhdGh9YCwgZXJyb3IpO1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBFQzLnkrDlooPjgafjga7jg5XjgqHjgqTjg6vliIbmnpBcbiAgICovXG4gIHB1YmxpYyBhc3luYyBhbmFseXplRUMyRmlsZXMoKTogUHJvbWlzZTx7XG4gICAgc2NyaXB0RmlsZXM6IEZpbGVJbmZvW107XG4gICAgZG9jdW1lbnRGaWxlczogRmlsZUluZm9bXTtcbiAgICBjb25maWdGaWxlczogRmlsZUluZm9bXTtcbiAgICBvbGRQcm9qZWN0czogRmlsZUluZm9bXTtcbiAgICBsYXJnZUZpbGVzOiBGaWxlSW5mb1tdO1xuICB9PiB7XG4gICAgY29uc3QgZmxhdEZpbGVzID0gYXdhaXQgdGhpcy5kZXRlY3RFQzJGbGF0RmlsZXMoKTtcbiAgICBjb25zdCBvbGRQcm9qZWN0cyA9IGF3YWl0IHRoaXMuZGV0ZWN0T2xkUHJvamVjdERpcmVjdG9yaWVzKCk7XG4gICAgXG4gICAgY29uc3QgYW5hbHlzaXMgPSB7XG4gICAgICBzY3JpcHRGaWxlczogW10gYXMgRmlsZUluZm9bXSxcbiAgICAgIGRvY3VtZW50RmlsZXM6IFtdIGFzIEZpbGVJbmZvW10sXG4gICAgICBjb25maWdGaWxlczogW10gYXMgRmlsZUluZm9bXSxcbiAgICAgIG9sZFByb2plY3RzLFxuICAgICAgbGFyZ2VGaWxlczogW10gYXMgRmlsZUluZm9bXVxuICAgIH07XG5cbiAgICBmb3IgKGNvbnN0IGZpbGUgb2YgZmxhdEZpbGVzKSB7XG4gICAgICBpZiAoZmlsZS5leHRlbnNpb24gPT09ICcuc2gnKSB7XG4gICAgICAgIGFuYWx5c2lzLnNjcmlwdEZpbGVzLnB1c2goZmlsZSk7XG4gICAgICB9IGVsc2UgaWYgKFsnLm1kJywgJy50eHQnLCAnLmRvYyddLmluY2x1ZGVzKGZpbGUuZXh0ZW5zaW9uKSkge1xuICAgICAgICBhbmFseXNpcy5kb2N1bWVudEZpbGVzLnB1c2goZmlsZSk7XG4gICAgICB9IGVsc2UgaWYgKFsnLmpzb24nLCAnLmpzJywgJy50cycsICcueW1sJywgJy55YW1sJ10uaW5jbHVkZXMoZmlsZS5leHRlbnNpb24pKSB7XG4gICAgICAgIGFuYWx5c2lzLmNvbmZpZ0ZpbGVzLnB1c2goZmlsZSk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIGlmIChmaWxlLnNpemUgPiAxMCAqIDEwMjQgKiAxMDI0KSB7IC8vIDEwTULku6XkuIpcbiAgICAgICAgYW5hbHlzaXMubGFyZ2VGaWxlcy5wdXNoKGZpbGUpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBhbmFseXNpcztcbiAgfVxufSJdfQ==