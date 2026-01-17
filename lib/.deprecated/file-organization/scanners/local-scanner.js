"use strict";
/**
 * 統合ファイル整理システム - ローカル環境スキャナー
 *
 * ローカル環境（macOS/Linux）でのファイルスキャン機能を提供します。
 * 20+個の平置きファイルを検出し、適切な分類のための情報を収集します。
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
exports.LocalFileScanner = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const file_scanner_js_1 = require("../core/file-scanner.js");
const index_js_1 = require("../types/index.js");
/**
 * ローカル環境ファイルスキャナー
 *
 * macOS/Linux環境でのファイルシステムアクセスを行い、
 * ローカル固有のファイル情報を収集します。
 */
class LocalFileScanner extends file_scanner_js_1.BaseFileScanner {
    rootPath;
    constructor(rootPath = process.cwd(), excludePatterns = [
        'node_modules/**',
        '.git/**',
        'cdk.out/**',
        'dist/**',
        'build/**',
        '.DS_Store',
        'Thumbs.db',
        '*.swp',
        '*.swo',
        '*~'
    ]) {
        super('local', excludePatterns);
        this.rootPath = path.resolve(rootPath);
    }
    /**
     * ローカル環境の平置きファイルを特別に検出
     *
     * 要件1.1, 5.1, 5.2, 5.3, 5.4, 5.5に対応
     */
    async detectLocalFlatFiles() {
        try {
            console.log(`ローカル環境の平置きファイルをスキャン中: ${this.rootPath}`);
            const entries = await fs.readdir(this.rootPath, { withFileTypes: true });
            const flatFiles = [];
            for (const entry of entries) {
                if (entry.isFile() && !entry.name.startsWith('.')) {
                    const filePath = path.join(this.rootPath, entry.name);
                    // 除外パターンのチェック
                    if (this.shouldExclude(filePath)) {
                        continue;
                    }
                    const fileInfo = await this.getFileInfo(filePath);
                    if (fileInfo) {
                        flatFiles.push(fileInfo);
                        console.log(`平置きファイル検出: ${entry.name} (${this.formatFileSize(fileInfo.size)})`);
                    }
                }
            }
            console.log(`ローカル環境で ${flatFiles.length} 個の平置きファイルを検出しました`);
            return flatFiles;
        }
        catch (error) {
            throw new index_js_1.OrganizationError(index_js_1.OrganizationErrorType.SCAN_FAILED, `ローカル環境の平置きファイル検出に失敗しました: ${this.rootPath}`, this.rootPath, 'local', error);
        }
    }
    /**
     * ローカル環境固有のファイル分析
     */
    async analyzeLocalFiles() {
        const flatFiles = await this.detectLocalFlatFiles();
        const analysis = {
            configFiles: [],
            testFiles: [],
            tempFiles: [],
            scriptFiles: [],
            documentFiles: []
        };
        for (const file of flatFiles) {
            if (this.isConfigFile(file)) {
                analysis.configFiles.push(file);
            }
            else if (this.isTestFile(file)) {
                analysis.testFiles.push(file);
            }
            else if (this.isTempFile(file)) {
                analysis.tempFiles.push(file);
            }
            else if (this.isScriptFile(file)) {
                analysis.scriptFiles.push(file);
            }
            else if (this.isDocumentFile(file)) {
                analysis.documentFiles.push(file);
            }
        }
        return analysis;
    }
    /**
     * 開発環境固有ファイルの検出
     */
    async detectDevelopmentFiles() {
        const developmentPatterns = [
            '.env.template',
            '.env.local',
            '.env.development',
            'config.*.ts',
            'test-*.json',
            '*-payload.json',
            'response.json',
            'validate-*.ts',
            'debug-*.log',
            'temp_*',
            '*.tmp'
        ];
        const allFiles = await this.detectLocalFlatFiles();
        return allFiles.filter(file => developmentPatterns.some(pattern => this.matchesPattern(file.name, pattern)));
    }
    /**
     * 相対パスを取得（ローカル環境用）
     */
    getRelativePath(filePath) {
        return path.relative(this.rootPath, filePath);
    }
    /**
     * ファイル権限を取得（Unix系システム用）
     */
    getPermissions(stats) {
        if (os.platform() === 'win32') {
            // Windows環境では簡易的な権限表示
            return stats.mode & parseInt('200', 8) ? '644' : '444';
        }
        // Unix系システムでの8進数権限表示
        return (stats.mode & parseInt('777', 8)).toString(8);
    }
    /**
     * 設定ファイルかどうかを判定
     */
    isConfigFile(file) {
        const configPatterns = [
            /^config\./i,
            /\.config\./i,
            /^package\.json$/i,
            /^tsconfig\.json$/i,
            /^cdk\.json$/i,
            /^jest\.config\./i,
            /^webpack\.config\./i,
            /^\.env/i
        ];
        return configPatterns.some(pattern => pattern.test(file.name));
    }
    /**
     * テストファイルかどうかを判定
     */
    isTestFile(file) {
        const testPatterns = [
            /^test-.*\.json$/i,
            /.*-test\.json$/i,
            /.*-payload\.json$/i,
            /.*\.test\./i,
            /.*\.spec\./i,
            /^mock/i
        ];
        return testPatterns.some(pattern => pattern.test(file.name));
    }
    /**
     * 一時ファイルかどうかを判定
     */
    isTempFile(file) {
        const tempPatterns = [
            /^response\.json$/i,
            /^temp_/i,
            /\.tmp$/i,
            /\.temp$/i,
            /^output\./i,
            /^debug/i,
            /\.log$/i
        ];
        return tempPatterns.some(pattern => pattern.test(file.name));
    }
    /**
     * スクリプトファイルかどうかを判定
     */
    isScriptFile(file) {
        return file.extension === '.sh' ||
            file.extension === '.bat' ||
            file.extension === '.cmd';
    }
    /**
     * ドキュメントファイルかどうかを判定
     */
    isDocumentFile(file) {
        const docExtensions = ['.md', '.txt', '.doc', '.docx', '.pdf'];
        return docExtensions.includes(file.extension);
    }
    /**
     * パターンマッチング
     */
    matchesPattern(fileName, pattern) {
        const regex = new RegExp(pattern
            .replace(/\*/g, '.*')
            .replace(/\?/g, '.'));
        return regex.test(fileName);
    }
    /**
     * ファイルサイズをフォーマット
     */
    formatFileSize(bytes) {
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        return `${size.toFixed(1)} ${units[unitIndex]}`;
    }
    /**
     * ローカル環境の詳細情報を取得
     */
    async getEnvironmentInfo() {
        const flatFiles = await this.detectLocalFlatFiles();
        const allFiles = await this.scanDirectory(this.rootPath);
        return {
            platform: os.platform(),
            architecture: os.arch(),
            nodeVersion: process.version,
            workingDirectory: this.rootPath,
            homeDirectory: os.homedir(),
            totalFiles: allFiles.length,
            flatFiles: flatFiles.length
        };
    }
    /**
     * ローカル環境のヘルスチェック
     */
    async performHealthCheck() {
        const issues = [];
        const recommendations = [];
        try {
            // ディスク容量チェック
            const stats = await fs.stat(this.rootPath);
            // 平置きファイル数チェック
            const flatFiles = await this.detectLocalFlatFiles();
            if (flatFiles.length > 20) {
                issues.push(`平置きファイルが多すぎます: ${flatFiles.length}個`);
                recommendations.push('ファイル整理システムの実行を推奨します');
            }
            // 権限チェック
            try {
                await fs.access(this.rootPath, fs.constants.R_OK | fs.constants.W_OK);
            }
            catch {
                issues.push('ディレクトリへの読み書き権限がありません');
                recommendations.push('ディレクトリ権限を確認してください');
            }
            // 大きなファイルチェック
            const largeFiles = flatFiles.filter(file => file.size > 10 * 1024 * 1024); // 10MB
            if (largeFiles.length > 0) {
                issues.push(`大きなファイルが平置きされています: ${largeFiles.length}個`);
                recommendations.push('大きなファイルは適切なディレクトリに移動してください');
            }
            const status = issues.length === 0 ? 'healthy' :
                issues.length <= 2 ? 'warning' : 'error';
            return { status, issues, recommendations };
        }
        catch (error) {
            return {
                status: 'error',
                issues: [`ヘルスチェック実行エラー: ${error}`],
                recommendations: ['システム管理者に連絡してください']
            };
        }
    }
}
exports.LocalFileScanner = LocalFileScanner;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibG9jYWwtc2Nhbm5lci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImxvY2FsLXNjYW5uZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7OztHQUtHOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILGdEQUFrQztBQUNsQywyQ0FBNkI7QUFDN0IsdUNBQXlCO0FBQ3pCLDZEQUEwRDtBQUMxRCxnREFLMkI7QUFFM0I7Ozs7O0dBS0c7QUFDSCxNQUFhLGdCQUFpQixTQUFRLGlDQUFlO0lBQ2xDLFFBQVEsQ0FBUztJQUVsQyxZQUNFLFdBQW1CLE9BQU8sQ0FBQyxHQUFHLEVBQUUsRUFDaEMsa0JBQTRCO1FBQzFCLGlCQUFpQjtRQUNqQixTQUFTO1FBQ1QsWUFBWTtRQUNaLFNBQVM7UUFDVCxVQUFVO1FBQ1YsV0FBVztRQUNYLFdBQVc7UUFDWCxPQUFPO1FBQ1AsT0FBTztRQUNQLElBQUk7S0FDTDtRQUVELEtBQUssQ0FBQyxPQUFPLEVBQUUsZUFBZSxDQUFDLENBQUM7UUFDaEMsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQ3pDLENBQUM7SUFFRDs7OztPQUlHO0lBQ0ksS0FBSyxDQUFDLG9CQUFvQjtRQUMvQixJQUFJLENBQUM7WUFDSCxPQUFPLENBQUMsR0FBRyxDQUFDLHlCQUF5QixJQUFJLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQztZQUV0RCxNQUFNLE9BQU8sR0FBRyxNQUFNLEVBQUUsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxFQUFFLGFBQWEsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO1lBQ3pFLE1BQU0sU0FBUyxHQUFlLEVBQUUsQ0FBQztZQUVqQyxLQUFLLE1BQU0sS0FBSyxJQUFJLE9BQU8sRUFBRSxDQUFDO2dCQUM1QixJQUFJLEtBQUssQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFD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VUFBVSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUUsQ0FBQztnQkFDMUIsTUFBTSxDQUFDLElBQUksQ0FBQyxzQkFBc0IsVUFBVSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUM7Z0JBQ3hELGVBQWUsQ0FBQyxJQUFJLENBQUMsNEJBQTRCLENBQUMsQ0FBQztZQUNyRCxDQUFDO1lBRUQsTUFBTSxNQUFNLEdBQUcsTUFBTSxDQUFDLE1BQU0sS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDO2dCQUNsQyxNQUFNLENBQUMsTUFBTSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUM7WUFFdkQsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsZUFBZSxFQUFFLENBQUM7UUFDN0MsQ0FBQztRQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7WUFDZixPQUFPO2dCQUNMLE1BQU0sRUFBRSxPQUFPO2dCQUNmLE1BQU0sRUFBRSxDQUFDLGlCQUFpQixLQUFLLEVBQUUsQ0FBQztnQkFDbEMsZUFBZSxFQUFFLENBQUMsa0JBQWtCLENBQUM7YUFDdEMsQ0FBQztRQUNKLENBQUM7SUFDSCxDQUFDO0NBQ0Y7QUE1VEQsNENBNFRDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiDntbHlkIjjg5XjgqHjgqTjg6vmlbTnkIbjgrfjgrnjg4bjg6AgLSDjg63jg7zjgqvjg6vnkrDlooPjgrnjgq3jg6Pjg4rjg7xcbiAqIFxuICog44Ot44O844Kr44Or55Kw5aKD77yIbWFjT1MvTGludXjvvInjgafjga7jg5XjgqHjgqTjg6vjgrnjgq3jg6Pjg7PmqZ/og73jgpLmj5DkvpvjgZfjgb7jgZnjgIJcbiAqIDIwK+WAi+OBruW5s+e9ruOBjeODleOCoeOCpOODq+OCkuaknOWHuuOBl+OAgemBqeWIh+OBquWIhumhnuOBruOBn+OCgeOBruaDheWgseOCkuWPjumbhuOBl+OBvuOBmeOAglxuICovXG5cbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzL3Byb21pc2VzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgKiBhcyBvcyBmcm9tICdvcyc7XG5pbXBvcnQgeyBCYXNlRmlsZVNjYW5uZXIgfSBmcm9tICcuLi9jb3JlL2ZpbGUtc2Nhbm5lci5qcyc7XG5pbXBvcnQgeyBcbiAgRmlsZUluZm8sIFxuICBFbnZpcm9ubWVudCxcbiAgT3JnYW5pemF0aW9uRXJyb3IsXG4gIE9yZ2FuaXphdGlvbkVycm9yVHlwZVxufSBmcm9tICcuLi90eXBlcy9pbmRleC5qcyc7XG5cbi8qKlxuICog44Ot44O844Kr44Or55Kw5aKD44OV44Kh44Kk44Or44K544Kt44Oj44OK44O8XG4gKiBcbiAqIG1hY09TL0xpbnV455Kw5aKD44Gn44Gu44OV44Kh44Kk44Or44K344K544OG44Og44Ki44Kv44K744K544KS6KGM44GE44CBXG4gKiDjg63jg7zjgqvjg6vlm7rmnInjga7jg5XjgqHjgqTjg6vmg4XloLHjgpLlj47pm4bjgZfjgb7jgZnjgIJcbiAqL1xuZXhwb3J0IGNsYXNzIExvY2FsRmlsZVNjYW5uZXIgZXh0ZW5kcyBCYXNlRmlsZVNjYW5uZXIge1xuICBwcml2YXRlIHJlYWRvbmx5IHJvb3RQYXRoOiBzdHJpbmc7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgcm9vdFBhdGg6IHN0cmluZyA9IHByb2Nlc3MuY3dkKCksXG4gICAgZXhjbHVkZVBhdHRlcm5zOiBzdHJpbmdbXSA9IFtcbiAgICAgICdub2RlX21vZHVsZXMvKionLFxuICAgICAgJy5naXQvKionLFxuICAgICAgJ2Nkay5vdXQvKionLFxuICAgICAgJ2Rpc3QvKionLFxuICAgICAgJ2J1aWxkLyoqJyxcbiAgICAgICcuRFNfU3RvcmUnLFxuICAgICAgJ1RodW1icy5kYicsXG4gICAgICAnKi5zd3AnLFxuICAgICAgJyouc3dvJyxcbiAgICAgICcqfidcbiAgICBdXG4gICkge1xuICAgIHN1cGVyKCdsb2NhbCcsIGV4Y2x1ZGVQYXR0ZXJucyk7XG4gICAgdGhpcy5yb290UGF0aCA9IHBhdGgucmVzb2x2ZShyb290UGF0aCk7XG4gIH1cblxuICAvKipcbiAgICog44Ot44O844Kr44Or55Kw5aKD44Gu5bmz572u44GN44OV44Kh44Kk44Or44KS54m55Yil44Gr5qSc5Ye6XG4gICAqIFxuICAgKiDopoHku7YxLjEsIDUuMSwgNS4yLCA1LjMsIDUuNCwgNS4144Gr5a++5b+cXG4gICAqL1xuICBwdWJsaWMgYXN5bmMgZGV0ZWN0TG9jYWxGbGF0RmlsZXMoKTogUHJvbWlzZTxGaWxlSW5mb1tdPiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnNvbGUubG9nKGDjg63jg7zjgqvjg6vnkrDlooPjga7lubPnva7jgY3jg5XjgqHjgqTjg6vjgpLjgrnjgq3jg6Pjg7PkuK06ICR7dGhpcy5yb290UGF0aH1gKTtcbiAgICAgIFxuICAgICAgY29uc3QgZW50cmllcyA9IGF3YWl0IGZzLnJlYWRkaXIodGhpcy5yb290UGF0aCwgeyB3aXRoRmlsZVR5cGVzOiB0cnVlIH0pO1xuICAgICAgY29uc3QgZmxhdEZpbGVzOiBGaWxlSW5mb1tdID0gW107XG5cbiAgICAgIGZvciAoY29uc3QgZW50cnkgb2YgZW50cmllcykge1xuICAgICAgICBpZiAoZW50cnkuaXNGaWxlKCkgJiYgIWVudHJ5Lm5hbWUuc3RhcnRzV2l0aCgnLicpKSB7XG4gICAgICAgICAgY29uc3QgZmlsZVBhdGggPSBwYXRoLmpvaW4odGhpcy5yb290UGF0aCwgZW50cnkubmFtZSk7XG4gICAgICAgICAgXG4gICAgICAgICAgLy8g6Zmk5aSW44OR44K/44O844Oz44Gu44OB44Kn44OD44KvXG4gICAgICAgICAgaWYgKHRoaXMuc2hvdWxkRXhjbHVkZShmaWxlUGF0aCkpIHtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IGZpbGVJbmZvID0gYXdhaXQgdGhpcy5nZXRGaWxlSW5mbyhmaWxlUGF0aCk7XG4gICAgICAgICAgaWYgKGZpbGVJbmZvKSB7XG4gICAgICAgICAgICBmbGF0RmlsZXMucHVzaChmaWxlSW5mbyk7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhg5bmz572u44GN44OV44Kh44Kk44Or5qSc5Ye6OiAke2VudHJ5Lm5hbWV9ICgke3RoaXMuZm9ybWF0RmlsZVNpemUoZmlsZUluZm8uc2l6ZSl9KWApO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBjb25zb2xlLmxvZyhg44Ot44O844Kr44Or55Kw5aKD44GnICR7ZmxhdEZpbGVzLmxlbmd0aH0g5YCL44Gu5bmz572u44GN44OV44Kh44Kk44Or44KS5qSc5Ye644GX44G+44GX44GfYCk7XG4gICAgICByZXR1cm4gZmxhdEZpbGVzO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICB0aHJvdyBuZXcgT3JnYW5pemF0aW9uRXJyb3IoXG4gICAgICAgIE9yZ2FuaXphdGlvbkVycm9yVHlwZS5TQ0FOX0ZBSUxFRCxcbiAgICAgICAgYOODreODvOOCq+ODq+eSsOWig+OBruW5s+e9ruOBjeODleOCoeOCpOODq+aknOWHuuOBq+WkseaVl+OBl+OBvuOBl+OBnzogJHt0aGlzLnJvb3RQYXRofWAsXG4gICAgICAgIHRoaXMucm9vdFBhdGgsXG4gICAgICAgICdsb2NhbCcsXG4gICAgICAgIGVycm9yIGFzIEVycm9yXG4gICAgICApO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDjg63jg7zjgqvjg6vnkrDlooPlm7rmnInjga7jg5XjgqHjgqTjg6vliIbmnpBcbiAgICovXG4gIHB1YmxpYyBhc3luYyBhbmFseXplTG9jYWxGaWxlcygpOiBQcm9taXNlPHtcbiAgICBjb25maWdGaWxlczogRmlsZUluZm9bXTtcbiAgICB0ZXN0RmlsZXM6IEZpbGVJbmZvW107XG4gICAgdGVtcEZpbGVzOiBGaWxlSW5mb1tdO1xuICAgIHNjcmlwdEZpbGVzOiBGaWxlSW5mb1tdO1xuICAgIGRvY3VtZW50RmlsZXM6IEZpbGVJbmZvW107XG4gIH0+IHtcbiAgICBjb25zdCBmbGF0RmlsZXMgPSBhd2FpdCB0aGlzLmRldGVjdExvY2FsRmxhdEZpbGVzKCk7XG4gICAgXG4gICAgY29uc3QgYW5hbHlzaXMgPSB7XG4gICAgICBjb25maWdGaWxlczogW10gYXMgRmlsZUluZm9bXSxcbiAgICAgIHRlc3RGaWxlczogW10gYXMgRmlsZUluZm9bXSxcbiAgICAgIHRlbXBGaWxlczogW10gYXMgRmlsZUluZm9bXSxcbiAgICAgIHNjcmlwdEZpbGVzOiBbXSBhcyBGaWxlSW5mb1tdLFxuICAgICAgZG9jdW1lbnRGaWxlczogW10gYXMgRmlsZUluZm9bXVxuICAgIH07XG5cbiAgICBmb3IgKGNvbnN0IGZpbGUgb2YgZmxhdEZpbGVzKSB7XG4gICAgICBpZiAodGhpcy5pc0NvbmZpZ0ZpbGUoZmlsZSkpIHtcbiAgICAgICAgYW5hbHlzaXMuY29uZmlnRmlsZXMucHVzaChmaWxlKTtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5pc1Rlc3RGaWxlKGZpbGUpKSB7XG4gICAgICAgIGFuYWx5c2lzLnRlc3RGaWxlcy5wdXNoKGZpbGUpO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLmlzVGVtcEZpbGUoZmlsZSkpIHtcbiAgICAgICAgYW5hbHlzaXMudGVtcEZpbGVzLnB1c2goZmlsZSk7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMuaXNTY3JpcHRGaWxlKGZpbGUpKSB7XG4gICAgICAgIGFuYWx5c2lzLnNjcmlwdEZpbGVzLnB1c2goZmlsZSk7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMuaXNEb2N1bWVudEZpbGUoZmlsZSkpIHtcbiAgICAgICAgYW5hbHlzaXMuZG9jdW1lbnRGaWxlcy5wdXNoKGZpbGUpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBhbmFseXNpcztcbiAgfVxuXG4gIC8qKlxuICAgKiDplovnmbrnkrDlooPlm7rmnInjg5XjgqHjgqTjg6vjga7mpJzlh7pcbiAgICovXG4gIHB1YmxpYyBhc3luYyBkZXRlY3REZXZlbG9wbWVudEZpbGVzKCk6IFByb21pc2U8RmlsZUluZm9bXT4ge1xuICAgIGNvbnN0IGRldmVsb3BtZW50UGF0dGVybnMgPSBbXG4gICAgICAnLmVudi50ZW1wbGF0ZScsXG4gICAgICAnLmVudi5sb2NhbCcsXG4gICAgICAnLmVudi5kZXZlbG9wbWVudCcsXG4gICAgICAnY29uZmlnLioudHMnLFxuICAgICAgJ3Rlc3QtKi5qc29uJyxcbiAgICAgICcqLXBheWxvYWQuanNvbicsXG4gICAgICAncmVzcG9uc2UuanNvbicsXG4gICAgICAndmFsaWRhdGUtKi50cycsXG4gICAgICAnZGVidWctKi5sb2cnLFxuICAgICAgJ3RlbXBfKicsXG4gICAgICAnKi50bXAnXG4gICAgXTtcblxuICAgIGNvbnN0IGFsbEZpbGVzID0gYXdhaXQgdGhpcy5kZXRlY3RMb2NhbEZsYXRGaWxlcygpO1xuICAgIHJldHVybiBhbGxGaWxlcy5maWx0ZXIoZmlsZSA9PiBcbiAgICAgIGRldmVsb3BtZW50UGF0dGVybnMuc29tZShwYXR0ZXJuID0+IHRoaXMubWF0Y2hlc1BhdHRlcm4oZmlsZS5uYW1lLCBwYXR0ZXJuKSlcbiAgICApO1xuICB9XG5cbiAgLyoqXG4gICAqIOebuOWvvuODkeOCueOCkuWPluW+l++8iOODreODvOOCq+ODq+eSsOWig+eUqO+8iVxuICAgKi9cbiAgcHJvdGVjdGVkIGdldFJlbGF0aXZlUGF0aChmaWxlUGF0aDogc3RyaW5nKTogc3RyaW5nIHtcbiAgICByZXR1cm4gcGF0aC5yZWxhdGl2ZSh0aGlzLnJvb3RQYXRoLCBmaWxlUGF0aCk7XG4gIH1cblxuICAvKipcbiAgICog44OV44Kh44Kk44Or5qip6ZmQ44KS5Y+W5b6X77yIVW5peOezu+OCt+OCueODhuODoOeUqO+8iVxuICAgKi9cbiAgcHJvdGVjdGVkIGdldFBlcm1pc3Npb25zKHN0YXRzOiBhbnkpOiBzdHJpbmcge1xuICAgIGlmIChvcy5wbGF0Zm9ybSgpID09PSAnd2luMzInKSB7XG4gICAgICAvLyBXaW5kb3dz55Kw5aKD44Gn44Gv57Ch5piT55qE44Gq5qip6ZmQ6KGo56S6XG4gICAgICByZXR1cm4gc3RhdHMubW9kZSAmIHBhcnNlSW50KCcyMDAnLCA4KSA/ICc2NDQnIDogJzQ0NCc7XG4gICAgfVxuICAgIFxuICAgIC8vIFVuaXjns7vjgrfjgrnjg4bjg6Djgafjga446YCy5pWw5qip6ZmQ6KGo56S6XG4gICAgcmV0dXJuIChzdGF0cy5tb2RlICYgcGFyc2VJbnQoJzc3NycsIDgpKS50b1N0cmluZyg4KTtcbiAgfVxuXG4gIC8qKlxuICAgKiDoqK3lrprjg5XjgqHjgqTjg6vjgYvjganjgYbjgYvjgpLliKTlrppcbiAgICovXG4gIHByaXZhdGUgaXNDb25maWdGaWxlKGZpbGU6IEZpbGVJbmZvKTogYm9vbGVhbiB7XG4gICAgY29uc3QgY29uZmlnUGF0dGVybnMgPSBbXG4gICAgICAvXmNvbmZpZ1xcLi9pLFxuICAgICAgL1xcLmNvbmZpZ1xcLi9pLFxuICAgICAgL15wYWNrYWdlXFwuanNvbiQvaSxcbiAgICAgIC9edHNjb25maWdcXC5qc29uJC9pLFxuICAgICAgL15jZGtcXC5qc29uJC9pLFxuICAgICAgL15qZXN0XFwuY29uZmlnXFwuL2ksXG4gICAgICAvXndlYnBhY2tcXC5jb25maWdcXC4vaSxcbiAgICAgIC9eXFwuZW52L2lcbiAgICBdO1xuXG4gICAgcmV0dXJuIGNvbmZpZ1BhdHRlcm5zLnNvbWUocGF0dGVybiA9PiBwYXR0ZXJuLnRlc3QoZmlsZS5uYW1lKSk7XG4gIH1cblxuICAvKipcbiAgICog44OG44K544OI44OV44Kh44Kk44Or44GL44Gp44GG44GL44KS5Yik5a6aXG4gICAqL1xuICBwcml2YXRlIGlzVGVzdEZpbGUoZmlsZTogRmlsZUluZm8pOiBib29sZWFuIHtcbiAgICBjb25zdCB0ZXN0UGF0dGVybnMgPSBbXG4gICAgICAvXnRlc3QtLipcXC5qc29uJC9pLFxuICAgICAgLy4qLXRlc3RcXC5qc29uJC9pLFxuICAgICAgLy4qLXBheWxvYWRcXC5qc29uJC9pLFxuICAgICAgLy4qXFwudGVzdFxcLi9pLFxuICAgICAgLy4qXFwuc3BlY1xcLi9pLFxuICAgICAgL15tb2NrL2lcbiAgICBdO1xuXG4gICAgcmV0dXJuIHRlc3RQYXR0ZXJucy5zb21lKHBhdHRlcm4gPT4gcGF0dGVybi50ZXN0KGZpbGUubmFtZSkpO1xuICB9XG5cbiAgLyoqXG4gICAqIOS4gOaZguODleOCoeOCpOODq+OBi+OBqeOBhuOBi+OCkuWIpOWumlxuICAgKi9cbiAgcHJpdmF0ZSBpc1RlbXBGaWxlKGZpbGU6IEZpbGVJbmZvKTogYm9vbGVhbiB7XG4gICAgY29uc3QgdGVtcFBhdHRlcm5zID0gW1xuICAgICAgL15yZXNwb25zZVxcLmpzb24kL2ksXG4gICAgICAvXnRlbXBfL2ksXG4gICAgICAvXFwudG1wJC9pLFxuICAgICAgL1xcLnRlbXAkL2ksXG4gICAgICAvXm91dHB1dFxcLi9pLFxuICAgICAgL15kZWJ1Zy9pLFxuICAgICAgL1xcLmxvZyQvaVxuICAgIF07XG5cbiAgICByZXR1cm4gdGVtcFBhdHRlcm5zLnNvbWUocGF0dGVybiA9PiBwYXR0ZXJuLnRlc3QoZmlsZS5uYW1lKSk7XG4gIH1cblxuICAvKipcbiAgICog44K544Kv44Oq44OX44OI44OV44Kh44Kk44Or44GL44Gp44GG44GL44KS5Yik5a6aXG4gICAqL1xuICBwcml2YXRlIGlzU2NyaXB0RmlsZShmaWxlOiBGaWxlSW5mbyk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBmaWxlLmV4dGVuc2lvbiA9PT0gJy5zaCcgfHwgXG4gICAgICAgICAgIGZpbGUuZXh0ZW5zaW9uID09PSAnLmJhdCcgfHwgXG4gICAgICAgICAgIGZpbGUuZXh0ZW5zaW9uID09PSAnLmNtZCc7XG4gIH1cblxuICAvKipcbiAgICog44OJ44Kt44Ol44Oh44Oz44OI44OV44Kh44Kk44Or44GL44Gp44GG44GL44KS5Yik5a6aXG4gICAqL1xuICBwcml2YXRlIGlzRG9jdW1lbnRGaWxlKGZpbGU6IEZpbGVJbmZvKTogYm9vbGVhbiB7XG4gICAgY29uc3QgZG9jRXh0ZW5zaW9ucyA9IFsnLm1kJywgJy50eHQnLCAnLmRvYycsICcuZG9jeCcsICcucGRmJ107XG4gICAgcmV0dXJuIGRvY0V4dGVuc2lvbnMuaW5jbHVkZXMoZmlsZS5leHRlbnNpb24pO1xuICB9XG5cbiAgLyoqXG4gICAqIOODkeOCv+ODvOODs+ODnuODg+ODgeODs+OCsFxuICAgKi9cbiAgcHJpdmF0ZSBtYXRjaGVzUGF0dGVybihmaWxlTmFtZTogc3RyaW5nLCBwYXR0ZXJuOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICBjb25zdCByZWdleCA9IG5ldyBSZWdFeHAoXG4gICAgICBwYXR0ZXJuXG4gICAgICAgIC5yZXBsYWNlKC9cXCovZywgJy4qJylcbiAgICAgICAgLnJlcGxhY2UoL1xcPy9nLCAnLicpXG4gICAgKTtcbiAgICByZXR1cm4gcmVnZXgudGVzdChmaWxlTmFtZSk7XG4gIH1cblxuICAvKipcbiAgICog44OV44Kh44Kk44Or44K144Kk44K644KS44OV44Kp44O844Oe44OD44OIXG4gICAqL1xuICBwcml2YXRlIGZvcm1hdEZpbGVTaXplKGJ5dGVzOiBudW1iZXIpOiBzdHJpbmcge1xuICAgIGNvbnN0IHVuaXRzID0gWydCJywgJ0tCJywgJ01CJywgJ0dCJ107XG4gICAgbGV0IHNpemUgPSBieXRlcztcbiAgICBsZXQgdW5pdEluZGV4ID0gMDtcblxuICAgIHdoaWxlIChzaXplID49IDEwMjQgJiYgdW5pdEluZGV4IDwgdW5pdHMubGVuZ3RoIC0gMSkge1xuICAgICAgc2l6ZSAvPSAxMDI0O1xuICAgICAgdW5pdEluZGV4Kys7XG4gICAgfVxuXG4gICAgcmV0dXJuIGAke3NpemUudG9GaXhlZCgxKX0gJHt1bml0c1t1bml0SW5kZXhdfWA7XG4gIH1cblxuICAvKipcbiAgICog44Ot44O844Kr44Or55Kw5aKD44Gu6Kmz57Sw5oOF5aCx44KS5Y+W5b6XXG4gICAqL1xuICBwdWJsaWMgYXN5bmMgZ2V0RW52aXJvbm1lbnRJbmZvKCk6IFByb21pc2U8e1xuICAgIHBsYXRmb3JtOiBzdHJpbmc7XG4gICAgYXJjaGl0ZWN0dXJlOiBzdHJpbmc7XG4gICAgbm9kZVZlcnNpb246IHN0cmluZztcbiAgICB3b3JraW5nRGlyZWN0b3J5OiBzdHJpbmc7XG4gICAgaG9tZURpcmVjdG9yeTogc3RyaW5nO1xuICAgIHRvdGFsRmlsZXM6IG51bWJlcjtcbiAgICBmbGF0RmlsZXM6IG51bWJlcjtcbiAgfT4ge1xuICAgIGNvbnN0IGZsYXRGaWxlcyA9IGF3YWl0IHRoaXMuZGV0ZWN0TG9jYWxGbGF0RmlsZXMoKTtcbiAgICBjb25zdCBhbGxGaWxlcyA9IGF3YWl0IHRoaXMuc2NhbkRpcmVjdG9yeSh0aGlzLnJvb3RQYXRoKTtcblxuICAgIHJldHVybiB7XG4gICAgICBwbGF0Zm9ybTogb3MucGxhdGZvcm0oKSxcbiAgICAgIGFyY2hpdGVjdHVyZTogb3MuYXJjaCgpLFxuICAgICAgbm9kZVZlcnNpb246IHByb2Nlc3MudmVyc2lvbixcbiAgICAgIHdvcmtpbmdEaXJlY3Rvcnk6IHRoaXMucm9vdFBhdGgsXG4gICAgICBob21lRGlyZWN0b3J5OiBvcy5ob21lZGlyKCksXG4gICAgICB0b3RhbEZpbGVzOiBhbGxGaWxlcy5sZW5ndGgsXG4gICAgICBmbGF0RmlsZXM6IGZsYXRGaWxlcy5sZW5ndGhcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIOODreODvOOCq+ODq+eSsOWig+OBruODmOODq+OCueODgeOCp+ODg+OCr1xuICAgKi9cbiAgcHVibGljIGFzeW5jIHBlcmZvcm1IZWFsdGhDaGVjaygpOiBQcm9taXNlPHtcbiAgICBzdGF0dXM6ICdoZWFsdGh5JyB8ICd3YXJuaW5nJyB8ICdlcnJvcic7XG4gICAgaXNzdWVzOiBzdHJpbmdbXTtcbiAgICByZWNvbW1lbmRhdGlvbnM6IHN0cmluZ1tdO1xuICB9PiB7XG4gICAgY29uc3QgaXNzdWVzOiBzdHJpbmdbXSA9IFtdO1xuICAgIGNvbnN0IHJlY29tbWVuZGF0aW9uczogc3RyaW5nW10gPSBbXTtcblxuICAgIHRyeSB7XG4gICAgICAvLyDjg4fjgqPjgrnjgq/lrrnph4/jg4Hjgqfjg4Pjgq9cbiAgICAgIGNvbnN0IHN0YXRzID0gYXdhaXQgZnMuc3RhdCh0aGlzLnJvb3RQYXRoKTtcbiAgICAgIFxuICAgICAgLy8g5bmz572u44GN44OV44Kh44Kk44Or5pWw44OB44Kn44OD44KvXG4gICAgICBjb25zdCBmbGF0RmlsZXMgPSBhd2FpdCB0aGlzLmRldGVjdExvY2FsRmxhdEZpbGVzKCk7XG4gICAgICBpZiAoZmxhdEZpbGVzLmxlbmd0aCA+IDIwKSB7XG4gICAgICAgIGlzc3Vlcy5wdXNoKGDlubPnva7jgY3jg5XjgqHjgqTjg6vjgYzlpJrjgZnjgY7jgb7jgZk6ICR7ZmxhdEZpbGVzLmxlbmd0aH3lgItgKTtcbiAgICAgICAgcmVjb21tZW5kYXRpb25zLnB1c2goJ+ODleOCoeOCpOODq+aVtOeQhuOCt+OCueODhuODoOOBruWun+ihjOOCkuaOqOWlqOOBl+OBvuOBmScpO1xuICAgICAgfVxuXG4gICAgICAvLyDmqKnpmZDjg4Hjgqfjg4Pjgq9cbiAgICAgIHRyeSB7XG4gICAgICAgIGF3YWl0IGZzLmFjY2Vzcyh0aGlzLnJvb3RQYXRoLCBmcy5jb25zdGFudHMuUl9PSyB8IGZzLmNvbnN0YW50cy5XX09LKTtcbiAgICAgIH0gY2F0Y2gge1xuICAgICAgICBpc3N1ZXMucHVzaCgn44OH44Kj44Os44Kv44OI44Oq44G444Gu6Kqt44G/5pu444GN5qip6ZmQ44GM44GC44KK44G+44Gb44KTJyk7XG4gICAgICAgIHJlY29tbWVuZGF0aW9ucy5wdXNoKCfjg4fjgqPjg6zjgq/jg4jjg6rmqKnpmZDjgpLnorroqo3jgZfjgabjgY/jgaDjgZXjgYQnKTtcbiAgICAgIH1cblxuICAgICAgLy8g5aSn44GN44Gq44OV44Kh44Kk44Or44OB44Kn44OD44KvXG4gICAgICBjb25zdCBsYXJnZUZpbGVzID0gZmxhdEZpbGVzLmZpbHRlcihmaWxlID0+IGZpbGUuc2l6ZSA+IDEwICogMTAyNCAqIDEwMjQpOyAvLyAxME1CXG4gICAgICBpZiAobGFyZ2VGaWxlcy5sZW5ndGggPiAwKSB7XG4gICAgICAgIGlzc3Vlcy5wdXNoKGDlpKfjgY3jgarjg5XjgqHjgqTjg6vjgYzlubPnva7jgY3jgZXjgozjgabjgYTjgb7jgZk6ICR7bGFyZ2VGaWxlcy5sZW5ndGh95YCLYCk7XG4gICAgICAgIHJlY29tbWVuZGF0aW9ucy5wdXNoKCflpKfjgY3jgarjg5XjgqHjgqTjg6vjga/pganliIfjgarjg4fjgqPjg6zjgq/jg4jjg6rjgavnp7vli5XjgZfjgabjgY/jgaDjgZXjgYQnKTtcbiAgICAgIH1cblxuICAgICAgY29uc3Qgc3RhdHVzID0gaXNzdWVzLmxlbmd0aCA9PT0gMCA/ICdoZWFsdGh5JyA6IFxuICAgICAgICAgICAgICAgICAgICBpc3N1ZXMubGVuZ3RoIDw9IDIgPyAnd2FybmluZycgOiAnZXJyb3InO1xuXG4gICAgICByZXR1cm4geyBzdGF0dXMsIGlzc3VlcywgcmVjb21tZW5kYXRpb25zIH07XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHN0YXR1czogJ2Vycm9yJyxcbiAgICAgICAgaXNzdWVzOiBbYOODmOODq+OCueODgeOCp+ODg+OCr+Wun+ihjOOCqOODqeODvDogJHtlcnJvcn1gXSxcbiAgICAgICAgcmVjb21tZW5kYXRpb25zOiBbJ+OCt+OCueODhuODoOeuoeeQhuiAheOBq+mAo+e1oeOBl+OBpuOBj+OBoOOBleOBhCddXG4gICAgICB9O1xuICAgIH1cbiAgfVxufSJdfQ==