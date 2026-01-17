"use strict";
/**
 * 統合ファイル整理システム - ベースファイルスキャナー
 *
 * ローカル環境とEC2環境の両方で平置きファイルを検出し、
 * ファイル情報を収集するベースクラスを提供します。
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
exports.FileScannerUtils = exports.BaseFileScanner = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const index_js_1 = require("../types/index.js");
/**
 * ベースファイルスキャナークラス
 *
 * 抽象クラスとして、共通のファイルスキャン機能を提供し、
 * 環境固有の実装は継承クラスで行います。
 */
class BaseFileScanner {
    environment;
    excludePatterns;
    maxFileSize;
    constructor(environment, excludePatterns = [], maxFileSize = 104857600 // 100MB
    ) {
        this.environment = environment;
        this.excludePatterns = excludePatterns;
        this.maxFileSize = maxFileSize;
    }
    /**
     * ディレクトリをスキャンしてファイル情報を取得
     */
    async scanDirectory(scanPath) {
        try {
            const files = [];
            await this.scanDirectoryRecursive(scanPath, files);
            return files;
        }
        catch (error) {
            throw new index_js_1.OrganizationError(index_js_1.OrganizationErrorType.SCAN_FAILED, `ディレクトリスキャンに失敗しました: ${scanPath}`, scanPath, this.environment, error);
        }
    }
    /**
     * 平置きファイルを検出
     */
    async detectFlatFiles(rootPath) {
        try {
            const allFiles = await this.scanDirectory(rootPath);
            const flatFiles = this.filterFlatFiles(allFiles, rootPath);
            const filesByType = new Map();
            const suspiciousFiles = [];
            const largeFiles = [];
            for (const file of flatFiles) {
                // 拡張子別分類
                const ext = file.extension || 'no-extension';
                if (!filesByType.has(ext)) {
                    filesByType.set(ext, []);
                }
                filesByType.get(ext).push(file);
                // 疑わしいファイルの検出
                if (this.isSuspiciousFile(file)) {
                    suspiciousFiles.push(file);
                }
                // 大きなファイルの検出
                if (file.size > this.maxFileSize / 10) { // 10MB以上
                    largeFiles.push(file);
                }
            }
            return {
                environment: this.environment,
                totalFiles: flatFiles.length,
                filesByType,
                suspiciousFiles,
                largeFiles,
                scanTime: new Date(),
                scanPath: rootPath
            };
        }
        catch (error) {
            throw new index_js_1.OrganizationError(index_js_1.OrganizationErrorType.SCAN_FAILED, `平置きファイル検出に失敗しました: ${rootPath}`, rootPath, this.environment, error);
        }
    }
    /**
     * ファイル構造を分析
     */
    async analyzeFileStructure(analyzePath) {
        try {
            const allFiles = await this.scanDirectory(analyzePath);
            const flatFiles = this.filterFlatFiles(allFiles, analyzePath);
            const directoryStructure = await this.buildDirectoryStructure(analyzePath);
            const problematicFiles = this.identifyProblematicFiles(allFiles);
            return {
                environment: this.environment,
                flatFileCount: flatFiles.length,
                directoryStructure,
                analysisTime: new Date(),
                problematicFiles
            };
        }
        catch (error) {
            throw new index_js_1.OrganizationError(index_js_1.OrganizationErrorType.SCAN_FAILED, `ファイル構造分析に失敗しました: ${analyzePath}`, analyzePath, this.environment, error);
        }
    }
    /**
     * 再帰的にディレクトリをスキャン
     */
    async scanDirectoryRecursive(currentPath, files) {
        try {
            const entries = await fs.readdir(currentPath, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(currentPath, entry.name);
                // 除外パターンのチェック
                if (this.shouldExclude(fullPath)) {
                    continue;
                }
                if (entry.isDirectory()) {
                    // ディレクトリの場合は再帰的にスキャン
                    await this.scanDirectoryRecursive(fullPath, files);
                }
                else if (entry.isFile()) {
                    // ファイルの場合は情報を収集
                    const fileInfo = await this.getFileInfo(fullPath);
                    if (fileInfo) {
                        files.push(fileInfo);
                    }
                }
            }
        }
        catch (error) {
            // ディレクトリアクセスエラーは警告として記録し、処理を継続
            console.warn(`ディレクトリアクセスエラー: ${currentPath}`, error);
        }
    }
    /**
     * ファイル情報を取得
     */
    async getFileInfo(filePath) {
        try {
            const stats = await fs.stat(filePath);
            const relativePath = this.getRelativePath(filePath);
            const fileName = path.basename(filePath);
            const extension = path.extname(filePath);
            // ファイルサイズチェック
            if (stats.size > this.maxFileSize) {
                console.warn(`ファイルサイズが大きすぎます: ${filePath} (${stats.size} bytes)`);
            }
            // 小さなテキストファイルの内容を読み込み
            let content;
            if (stats.size < 1024 && this.isTextFile(extension)) {
                try {
                    content = await fs.readFile(filePath, 'utf-8');
                }
                catch {
                    // 内容読み込みエラーは無視
                }
            }
            return {
                path: filePath,
                name: fileName,
                extension: extension.toLowerCase(),
                size: stats.size,
                permissions: this.getPermissions(stats),
                lastModified: stats.mtime,
                content,
                environment: this.environment,
                relativePath,
                isDirectory: stats.isDirectory(),
                isHidden: fileName.startsWith('.')
            };
        }
        catch (error) {
            console.warn(`ファイル情報取得エラー: ${filePath}`, error);
            return null;
        }
    }
    /**
     * 平置きファイルをフィルタリング
     */
    filterFlatFiles(allFiles, rootPath) {
        return allFiles.filter(file => {
            const relativePath = path.relative(rootPath, file.path);
            const pathParts = relativePath.split(path.sep);
            // ルートディレクトリ直下のファイルのみを平置きファイルとして判定
            return pathParts.length === 1 && !file.isDirectory;
        });
    }
    /**
     * 疑わしいファイルかどうかを判定
     */
    isSuspiciousFile(file) {
        const suspiciousPatterns = [
            /^temp_/i,
            /\.tmp$/i,
            /\.temp$/i,
            /^response\.json$/i,
            /^output\./i,
            /^debug\./i,
            /^test-.*\.json$/i,
            /^.*-backup$/i,
            /^.*\.old$/i
        ];
        return suspiciousPatterns.some(pattern => pattern.test(file.name));
    }
    /**
     * 問題のあるファイルを特定
     */
    identifyProblematicFiles(files) {
        return files.filter(file => {
            // 大きすぎるファイル
            if (file.size > this.maxFileSize) {
                return true;
            }
            // 不適切な権限
            if (file.permissions === '777' || file.permissions === '666') {
                return true;
            }
            // 疑わしいファイル
            if (this.isSuspiciousFile(file)) {
                return true;
            }
            return false;
        });
    }
    /**
     * ディレクトリ構造を構築
     */
    async buildDirectoryStructure(rootPath) {
        const structure = [];
        try {
            const entries = await fs.readdir(rootPath, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    const dirPath = path.join(rootPath, entry.name);
                    if (this.shouldExclude(dirPath)) {
                        continue;
                    }
                    const node = await this.buildDirectoryNode(dirPath);
                    structure.push(node);
                }
            }
        }
        catch (error) {
            console.warn(`ディレクトリ構造構築エラー: ${rootPath}`, error);
        }
        return structure;
    }
    /**
     * ディレクトリノードを構築
     */
    async buildDirectoryNode(dirPath) {
        const name = path.basename(dirPath);
        const children = [];
        let fileCount = 0;
        let directoryCount = 0;
        try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            for (const entry of entries) {
                const entryPath = path.join(dirPath, entry.name);
                if (this.shouldExclude(entryPath)) {
                    continue;
                }
                if (entry.isDirectory()) {
                    directoryCount++;
                    const childNode = await this.buildDirectoryNode(entryPath);
                    children.push(childNode);
                }
                else if (entry.isFile()) {
                    fileCount++;
                }
            }
        }
        catch (error) {
            console.warn(`ディレクトリノード構築エラー: ${dirPath}`, error);
        }
        return {
            name,
            path: dirPath,
            children,
            fileCount,
            directoryCount
        };
    }
    /**
     * 除外すべきパスかどうかを判定
     */
    shouldExclude(filePath) {
        return this.excludePatterns.some(pattern => {
            // 簡単なグロブパターンマッチング
            const regex = new RegExp(pattern
                .replace(/\*\*/g, '.*')
                .replace(/\*/g, '[^/]*')
                .replace(/\?/g, '[^/]'));
            return regex.test(filePath);
        });
    }
    /**
     * テキストファイルかどうかを判定
     */
    isTextFile(extension) {
        const textExtensions = [
            '.txt', '.md', '.json', '.js', '.ts', '.html', '.css', '.scss',
            '.yml', '.yaml', '.xml', '.csv', '.log', '.env', '.sh', '.bat'
        ];
        return textExtensions.includes(extension.toLowerCase());
    }
}
exports.BaseFileScanner = BaseFileScanner;
/**
 * ファイルスキャナーユーティリティ関数
 */
class FileScannerUtils {
    /**
     * ファイルサイズを人間が読みやすい形式に変換
     */
    static formatFileSize(bytes) {
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        let size = bytes;
        let unitIndex = 0;
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        return `${size.toFixed(1)} ${units[unitIndex]}`;
    }
    /**
     * ファイル拡張子から推定されるファイルタイプを取得
     */
    static getFileTypeFromExtension(extension) {
        const typeMap = {
            '.js': 'JavaScript',
            '.ts': 'TypeScript',
            '.json': 'JSON',
            '.md': 'Markdown',
            '.txt': 'Text',
            '.sh': 'Shell Script',
            '.py': 'Python',
            '.html': 'HTML',
            '.css': 'CSS',
            '.yml': 'YAML',
            '.yaml': 'YAML',
            '.xml': 'XML',
            '.csv': 'CSV',
            '.log': 'Log File',
            '.env': 'Environment',
            '.pem': 'Certificate',
            '.key': 'Private Key'
        };
        return typeMap[extension.toLowerCase()] || 'Unknown';
    }
    /**
     * ファイルパスから推定される用途を取得
     */
    static inferFilePurpose(filePath) {
        const fileName = path.basename(filePath).toLowerCase();
        if (fileName.includes('test'))
            return 'Test';
        if (fileName.includes('config'))
            return 'Configuration';
        if (fileName.includes('deploy'))
            return 'Deployment';
        if (fileName.includes('setup'))
            return 'Setup';
        if (fileName.includes('install'))
            return 'Installation';
        if (fileName.includes('backup'))
            return 'Backup';
        if (fileName.includes('temp'))
            return 'Temporary';
        if (fileName.includes('log'))
            return 'Log';
        if (fileName.includes('debug'))
            return 'Debug';
        if (fileName.includes('sample'))
            return 'Sample';
        if (fileName.includes('example'))
            return 'Example';
        return 'Unknown';
    }
    /**
     * ファイル情報をCSV形式で出力
     */
    static exportToCSV(files) {
        const headers = [
            'Path', 'Name', 'Extension', 'Size', 'Permissions',
            'LastModified', 'Environment', 'IsDirectory', 'IsHidden'
        ];
        const rows = files.map(file => [
            file.path,
            file.name,
            file.extension,
            file.size.toString(),
            file.permissions,
            file.lastModified.toISOString(),
            file.environment,
            file.isDirectory.toString(),
            file.isHidden.toString()
        ]);
        return [headers, ...rows]
            .map(row => row.map(cell => `"${cell}"`).join(','))
            .join('\n');
    }
    /**
     * スキャン結果の統計情報を生成
     */
    static generateStatistics(report) {
        const stats = {
            totalFiles: report.totalFiles,
            environment: report.environment,
            scanTime: report.scanTime,
            filesByExtension: {},
            suspiciousFileCount: report.suspiciousFiles.length,
            largeFileCount: report.largeFiles.length,
            totalSize: 0,
            averageFileSize: 0
        };
        // 拡張子別統計
        for (const [ext, files] of report.filesByType) {
            stats.filesByExtension[ext] = files.length;
            stats.totalSize += files.reduce((sum, file) => sum + file.size, 0);
        }
        // 平均ファイルサイズ
        if (report.totalFiles > 0) {
            stats.averageFileSize = stats.totalSize / report.totalFiles;
        }
        return stats;
    }
}
exports.FileScannerUtils = FileScannerUtils;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmlsZS1zY2FubmVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiZmlsZS1zY2FubmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7R0FLRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCxnREFBa0M7QUFDbEMsMkNBQTZCO0FBQzdCLGdEQVMyQjtBQUUzQjs7Ozs7R0FLRztBQUNILE1BQXNCLGVBQWU7SUFDaEIsV0FBVyxDQUFjO0lBQ3pCLGVBQWUsQ0FBVztJQUMxQixXQUFXLENBQVM7SUFFdkMsWUFDRSxXQUF3QixFQUN4QixrQkFBNEIsRUFBRSxFQUM5QixjQUFzQixTQUFTLENBQUMsUUFBUTs7UUFFeEMsSUFBSSxDQUFDLFdBQVcsR0FBRyxXQUFXLENBQUM7UUFDL0IsSUFBSSxDQUFDLGVBQWUsR0FBRyxlQUFlLENBQUM7UUFDdkMsSUFBSSxDQUFDLFdBQVcsR0FBRyxXQUFXLENBQUM7SUFDakMsQ0FBQztJQUVEOztPQUVHO0lBQ0ksS0FBSyxDQUFDLGFBQWEsQ0FBQyxRQUFnQjtRQUN6QyxJQUFJLENBQUM7WUFDSCxNQUFNLEtBQUssR0FBZSxFQUFFLENBQUM7WUFDN0IsTUFBTSxJQUFJLENBQUMsc0JBQXNCLENBQUMsUUFBUSxFQUFFLEtBQUssQ0FBQyxDQUFDO1lBQ25ELE9BQU8sS0FBSyxDQUFDO1FBQ2YsQ0FBQztRQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7WUFDZixNQUFNLElBQUksNEJBQWlCLENBQ3pCLGdDQUFxQixDQUFDLFdBQVcsRUFDakMsc0JBQXNCLFFBQVEsRUFBRSxFQUNoQyxRQUFRLEVBQ1IsSUFBSSxDQUFDLFdBQVcsRUFDaEIsS0FBYyxDQUNmLENBQUM7UUFDSixDQUFDO0lBQ0gsQ0FBQztJQUVEOztPQUVHO0lBQ0ksS0FBSyxDQUFDLGVBQWUsQ0FBQyxRQUFnQjtRQUMzQyxJQUFJLENBQUM7WUFDSCxNQUFNLFFBQVEsR0FBRyxNQUFNLElBQUksQ0FBQyxhQUFhLENBQUMsUUFBUSxDQUFD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QUFJLE1BQU0sQ0FBQyxXQUFXLEVBQUUsQ0FBQztZQUM5QyxLQUFLLENBQUMsZ0JBQWdCLENBQUMsR0FBRyxDQUFDLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQztZQUMzQyxLQUFLLENBQUMsU0FBUyxJQUFJLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLEVBQUUsSUFBSSxFQUFFLEVBQUUsQ0FBQyxHQUFHLEdBQUcsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQztRQUNyRSxDQUFDO1FBRUQsWUFBWTtRQUNaLElBQUksTUFBTSxDQUFDLFVBQVUsR0FBRyxDQUFDLEVBQUUsQ0FBQztZQUMxQixLQUFLLENBQUMsZUFBZSxHQUFHLEtBQUssQ0FBQyxTQUFTLEdBQUcsTUFBTSxDQUFDLFVBQVUsQ0FBQztRQUM5RCxDQUFDO1FBRUQsT0FBTyxLQUFLLENBQUM7SUFDZixDQUFDO0NBQ0Y7QUF2SEQsNENBdUhDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiDntbHlkIjjg5XjgqHjgqTjg6vmlbTnkIbjgrfjgrnjg4bjg6AgLSDjg5njg7zjgrnjg5XjgqHjgqTjg6vjgrnjgq3jg6Pjg4rjg7xcbiAqIFxuICog44Ot44O844Kr44Or55Kw5aKD44GoRUMy55Kw5aKD44Gu5Lih5pa544Gn5bmz572u44GN44OV44Kh44Kk44Or44KS5qSc5Ye644GX44CBXG4gKiDjg5XjgqHjgqTjg6vmg4XloLHjgpLlj47pm4bjgZnjgovjg5njg7zjgrnjgq/jg6njgrnjgpLmj5DkvpvjgZfjgb7jgZnjgIJcbiAqL1xuXG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcy9wcm9taXNlcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgXG4gIEZpbGVTY2FubmVyLCBcbiAgRmlsZUluZm8sIFxuICBGbGF0RmlsZVJlcG9ydCwgXG4gIFN0cnVjdHVyZUFuYWx5c2lzLCBcbiAgRGlyZWN0b3J5Tm9kZSxcbiAgRW52aXJvbm1lbnQsXG4gIE9yZ2FuaXphdGlvbkVycm9yLFxuICBPcmdhbml6YXRpb25FcnJvclR5cGVcbn0gZnJvbSAnLi4vdHlwZXMvaW5kZXguanMnO1xuXG4vKipcbiAqIOODmeODvOOCueODleOCoeOCpOODq+OCueOCreODo+ODiuODvOOCr+ODqeOCuVxuICogXG4gKiDmir3osaHjgq/jg6njgrnjgajjgZfjgabjgIHlhbHpgJrjga7jg5XjgqHjgqTjg6vjgrnjgq3jg6Pjg7PmqZ/og73jgpLmj5DkvpvjgZfjgIFcbiAqIOeSsOWig+WbuuacieOBruWun+ijheOBr+e2meaJv+OCr+ODqeOCueOBp+ihjOOBhOOBvuOBmeOAglxuICovXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgQmFzZUZpbGVTY2FubmVyIGltcGxlbWVudHMgRmlsZVNjYW5uZXIge1xuICBwcm90ZWN0ZWQgcmVhZG9ubHkgZW52aXJvbm1lbnQ6IEVudmlyb25tZW50O1xuICBwcm90ZWN0ZWQgcmVhZG9ubHkgZXhjbHVkZVBhdHRlcm5zOiBzdHJpbmdbXTtcbiAgcHJvdGVjdGVkIHJlYWRvbmx5IG1heEZpbGVTaXplOiBudW1iZXI7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgZW52aXJvbm1lbnQ6IEVudmlyb25tZW50LFxuICAgIGV4Y2x1ZGVQYXR0ZXJuczogc3RyaW5nW10gPSBbXSxcbiAgICBtYXhGaWxlU2l6ZTogbnVtYmVyID0gMTA0ODU3NjAwIC8vIDEwME1CXG4gICkge1xuICAgIHRoaXMuZW52aXJvbm1lbnQgPSBlbnZpcm9ubWVudDtcbiAgICB0aGlzLmV4Y2x1ZGVQYXR0ZXJucyA9IGV4Y2x1ZGVQYXR0ZXJucztcbiAgICB0aGlzLm1heEZpbGVTaXplID0gbWF4RmlsZVNpemU7XG4gIH1cblxuICAvKipcbiAgICog44OH44Kj44Os44Kv44OI44Oq44KS44K544Kt44Oj44Oz44GX44Gm44OV44Kh44Kk44Or5oOF5aCx44KS5Y+W5b6XXG4gICAqL1xuICBwdWJsaWMgYXN5bmMgc2NhbkRpcmVjdG9yeShzY2FuUGF0aDogc3RyaW5nKTogUHJvbWlzZTxGaWxlSW5mb1tdPiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGZpbGVzOiBGaWxlSW5mb1tdID0gW107XG4gICAgICBhd2FpdCB0aGlzLnNjYW5EaXJlY3RvcnlSZWN1cnNpdmUoc2NhblBhdGgsIGZpbGVzKTtcbiAgICAgIHJldHVybiBmaWxlcztcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgdGhyb3cgbmV3IE9yZ2FuaXphdGlvbkVycm9yKFxuICAgICAgICBPcmdhbml6YXRpb25FcnJvclR5cGUuU0NBTl9GQUlMRUQsXG4gICAgICAgIGDjg4fjgqPjg6zjgq/jg4jjg6rjgrnjgq3jg6Pjg7PjgavlpLHmlZfjgZfjgb7jgZfjgZ86ICR7c2NhblBhdGh9YCxcbiAgICAgICAgc2NhblBhdGgsXG4gICAgICAgIHRoaXMuZW52aXJvbm1lbnQsXG4gICAgICAgIGVycm9yIGFzIEVycm9yXG4gICAgICApO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDlubPnva7jgY3jg5XjgqHjgqTjg6vjgpLmpJzlh7pcbiAgICovXG4gIHB1YmxpYyBhc3luYyBkZXRlY3RGbGF0RmlsZXMocm9vdFBhdGg6IHN0cmluZyk6IFByb21pc2U8RmxhdEZpbGVSZXBvcnQ+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgYWxsRmlsZXMgPSBhd2FpdCB0aGlzLnNjYW5EaXJlY3Rvcnkocm9vdFBhdGgpO1xuICAgICAgY29uc3QgZmxhdEZpbGVzID0gdGhpcy5maWx0ZXJGbGF0RmlsZXMoYWxsRmlsZXMsIHJvb3RQYXRoKTtcbiAgICAgIFxuICAgICAgY29uc3QgZmlsZXNCeVR5cGUgPSBuZXcgTWFwPHN0cmluZywgRmlsZUluZm9bXT4oKTtcbiAgICAgIGNvbnN0IHN1c3BpY2lvdXNGaWxlczogRmlsZUluZm9bXSA9IFtdO1xuICAgICAgY29uc3QgbGFyZ2VGaWxlczogRmlsZUluZm9bXSA9IFtdO1xuXG4gICAgICBmb3IgKGNvbnN0IGZpbGUgb2YgZmxhdEZpbGVzKSB7XG4gICAgICAgIC8vIOaLoeW8teWtkOWIpeWIhumhnlxuICAgICAgICBjb25zdCBleHQgPSBmaWxlLmV4dGVuc2lvbiB8fCAnbm8tZXh0ZW5zaW9uJztcbiAgICAgICAgaWYgKCFmaWxlc0J5VHlwZS5oYXMoZXh0KSkge1xuICAgICAgICAgIGZpbGVzQnlUeXBlLnNldChleHQsIFtdKTtcbiAgICAgICAgfVxuICAgICAgICBmaWxlc0J5VHlwZS5nZXQoZXh0KSEucHVzaChmaWxlKTtcblxuICAgICAgICAvLyDnlpHjgo/jgZfjgYTjg5XjgqHjgqTjg6vjga7mpJzlh7pcbiAgICAgICAgaWYgKHRoaXMuaXNTdXNwaWNpb3VzRmlsZShmaWxlKSkge1xuICAgICAgICAgIHN1c3BpY2lvdXNGaWxlcy5wdXNoKGZpbGUpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8g5aSn44GN44Gq44OV44Kh44Kk44Or44Gu5qSc5Ye6XG4gICAgICAgIGlmIChmaWxlLnNpemUgPiB0aGlzLm1heEZpbGVTaXplIC8gMTApIHsgLy8gMTBNQuS7peS4ilxuICAgICAgICAgIGxhcmdlRmlsZXMucHVzaChmaWxlKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBlbnZpcm9ubWVudDogdGhpcy5lbnZpcm9ubWVudCxcbiAgICAgICAgdG90YWxGaWxlczogZmxhdEZpbGVzLmxlbmd0aCxcbiAgICAgICAgZmlsZXNCeVR5cGUsXG4gICAgICAgIHN1c3BpY2lvdXNGaWxlcyxcbiAgICAgICAgbGFyZ2VGaWxlcyxcbiAgICAgICAgc2NhblRpbWU6IG5ldyBEYXRlKCksXG4gICAgICAgIHNjYW5QYXRoOiByb290UGF0aFxuICAgICAgfTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgdGhyb3cgbmV3IE9yZ2FuaXphdGlvbkVycm9yKFxuICAgICAgICBPcmdhbml6YXRpb25FcnJvclR5cGUuU0NBTl9GQUlMRUQsXG4gICAgICAgIGDlubPnva7jgY3jg5XjgqHjgqTjg6vmpJzlh7rjgavlpLHmlZfjgZfjgb7jgZfjgZ86ICR7cm9vdFBhdGh9YCxcbiAgICAgICAgcm9vdFBhdGgsXG4gICAgICAgIHRoaXMuZW52aXJvbm1lbnQsXG4gICAgICAgIGVycm9yIGFzIEVycm9yXG4gICAgICApO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDjg5XjgqHjgqTjg6vmp4vpgKDjgpLliIbmnpBcbiAgICovXG4gIHB1YmxpYyBhc3luYyBhbmFseXplRmlsZVN0cnVjdHVyZShhbmFseXplUGF0aDogc3RyaW5nKTogUHJvbWlzZTxTdHJ1Y3R1cmVBbmFseXNpcz4ge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBhbGxGaWxlcyA9IGF3YWl0IHRoaXMuc2NhbkRpcmVjdG9yeShhbmFseXplUGF0aCk7XG4gICAgICBjb25zdCBmbGF0RmlsZXMgPSB0aGlzLmZpbHRlckZsYXRGaWxlcyhhbGxGaWxlcywgYW5hbHl6ZVBhdGgpO1xuICAgICAgY29uc3QgZGlyZWN0b3J5U3RydWN0dXJlID0gYXdhaXQgdGhpcy5idWlsZERpcmVjdG9yeVN0cnVjdHVyZShhbmFseXplUGF0aCk7XG4gICAgICBjb25zdCBwcm9ibGVtYXRpY0ZpbGVzID0gdGhpcy5pZGVudGlmeVByb2JsZW1hdGljRmlsZXMoYWxsRmlsZXMpO1xuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBlbnZpcm9ubWVudDogdGhpcy5lbnZpcm9ubWVudCxcbiAgICAgICAgZmxhdEZpbGVDb3VudDogZmxhdEZpbGVzLmxlbmd0aCxcbiAgICAgICAgZGlyZWN0b3J5U3RydWN0dXJlLFxuICAgICAgICBhbmFseXNpc1RpbWU6IG5ldyBEYXRlKCksXG4gICAgICAgIHByb2JsZW1hdGljRmlsZXNcbiAgICAgIH07XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIHRocm93IG5ldyBPcmdhbml6YXRpb25FcnJvcihcbiAgICAgICAgT3JnYW5pemF0aW9uRXJyb3JUeXBlLlNDQU5fRkFJTEVELFxuICAgICAgICBg44OV44Kh44Kk44Or5qeL6YCg5YiG5p6Q44Gr5aSx5pWX44GX44G+44GX44GfOiAke2FuYWx5emVQYXRofWAsXG4gICAgICAgIGFuYWx5emVQYXRoLFxuICAgICAgICB0aGlzLmVudmlyb25tZW50LFxuICAgICAgICBlcnJvciBhcyBFcnJvclxuICAgICAgKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICog5YaN5biw55qE44Gr44OH44Kj44Os44Kv44OI44Oq44KS44K544Kt44Oj44OzXG4gICAqL1xuICBwcm90ZWN0ZWQgYXN5bmMgc2NhbkRpcmVjdG9yeVJlY3Vyc2l2ZShcbiAgICBjdXJyZW50UGF0aDogc3RyaW5nLCBcbiAgICBmaWxlczogRmlsZUluZm9bXVxuICApOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgZW50cmllcyA9IGF3YWl0IGZzLnJlYWRkaXIoY3VycmVudFBhdGgsIHsgd2l0aEZpbGVUeXBlczogdHJ1ZSB9KTtcblxuICAgICAgZm9yIChjb25zdCBlbnRyeSBvZiBlbnRyaWVzKSB7XG4gICAgICAgIGNvbnN0IGZ1bGxQYXRoID0gcGF0aC5qb2luKGN1cnJlbnRQYXRoLCBlbnRyeS5uYW1lKTtcbiAgICAgICAgXG4gICAgICAgIC8vIOmZpOWkluODkeOCv+ODvOODs+OBruODgeOCp+ODg+OCr1xuICAgICAgICBpZiAodGhpcy5zaG91bGRFeGNsdWRlKGZ1bGxQYXRoKSkge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGVudHJ5LmlzRGlyZWN0b3J5KCkpIHtcbiAgICAgICAgICAvLyDjg4fjgqPjg6zjgq/jg4jjg6rjga7loLTlkIjjga/lho3luLDnmoTjgavjgrnjgq3jg6Pjg7NcbiAgICAgICAgICBhd2FpdCB0aGlzLnNjYW5EaXJlY3RvcnlSZWN1cnNpdmUoZnVsbFBhdGgsIGZpbGVzKTtcbiAgICAgICAgfSBlbHNlIGlmIChlbnRyeS5pc0ZpbGUoKSkge1xuICAgICAgICAgIC8vIOODleOCoeOCpOODq+OBruWgtOWQiOOBr+aDheWgseOCkuWPjumbhlxuICAgICAgICAgIGNvbnN0IGZpbGVJbmZvID0gYXdhaXQgdGhpcy5nZXRGaWxlSW5mbyhmdWxsUGF0aCk7XG4gICAgICAgICAgaWYgKGZpbGVJbmZvKSB7XG4gICAgICAgICAgICBmaWxlcy5wdXNoKGZpbGVJbmZvKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgLy8g44OH44Kj44Os44Kv44OI44Oq44Ki44Kv44K744K544Ko44Op44O844Gv6K2m5ZGK44Go44GX44Gm6KiY6Yyy44GX44CB5Yem55CG44KS57aZ57aaXG4gICAgICBjb25zb2xlLndhcm4oYOODh+OCo+ODrOOCr+ODiOODquOCouOCr+OCu+OCueOCqOODqeODvDogJHtjdXJyZW50UGF0aH1gLCBlcnJvcik7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIOODleOCoeOCpOODq+aDheWgseOCkuWPluW+l1xuICAgKi9cbiAgcHJvdGVjdGVkIGFzeW5jIGdldEZpbGVJbmZvKGZpbGVQYXRoOiBzdHJpbmcpOiBQcm9taXNlPEZpbGVJbmZvIHwgbnVsbD4ge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBzdGF0cyA9IGF3YWl0IGZzLnN0YXQoZmlsZVBhdGgpO1xuICAgICAgY29uc3QgcmVsYXRpdmVQYXRoID0gdGhpcy5nZXRSZWxhdGl2ZVBhdGgoZmlsZVBhdGgpO1xuICAgICAgY29uc3QgZmlsZU5hbWUgPSBwYXRoLmJhc2VuYW1lKGZpbGVQYXRoKTtcbiAgICAgIGNvbnN0IGV4dGVuc2lvbiA9IHBhdGguZXh0bmFtZShmaWxlUGF0aCk7XG5cbiAgICAgIC8vIOODleOCoeOCpOODq+OCteOCpOOCuuODgeOCp+ODg+OCr1xuICAgICAgaWYgKHN0YXRzLnNpemUgPiB0aGlzLm1heEZpbGVTaXplKSB7XG4gICAgICAgIGNvbnNvbGUud2Fybihg44OV44Kh44Kk44Or44K144Kk44K644GM5aSn44GN44GZ44GO44G+44GZOiAke2ZpbGVQYXRofSAoJHtzdGF0cy5zaXplfSBieXRlcylgKTtcbiAgICAgIH1cblxuICAgICAgLy8g5bCP44GV44Gq44OG44Kt44K544OI44OV44Kh44Kk44Or44Gu5YaF5a6544KS6Kqt44G/6L6844G/XG4gICAgICBsZXQgY29udGVudDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuICAgICAgaWYgKHN0YXRzLnNpemUgPCAxMDI0ICYmIHRoaXMuaXNUZXh0RmlsZShleHRlbnNpb24pKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgY29udGVudCA9IGF3YWl0IGZzLnJlYWRGaWxlKGZpbGVQYXRoLCAndXRmLTgnKTtcbiAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgLy8g5YaF5a656Kqt44G/6L6844G/44Ko44Op44O844Gv54Sh6KaWXG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgcGF0aDogZmlsZVBhdGgsXG4gICAgICAgIG5hbWU6IGZpbGVOYW1lLFxuICAgICAgICBleHRlbnNpb246IGV4dGVuc2lvbi50b0xvd2VyQ2FzZSgpLFxuICAgICAgICBzaXplOiBzdGF0cy5zaXplLFxuICAgICAgICBwZXJtaXNzaW9uczogdGhpcy5nZXRQZXJtaXNzaW9ucyhzdGF0cyksXG4gICAgICAgIGxhc3RNb2RpZmllZDogc3RhdHMubXRpbWUsXG4gICAgICAgIGNvbnRlbnQsXG4gICAgICAgIGVudmlyb25tZW50OiB0aGlzLmVudmlyb25tZW50LFxuICAgICAgICByZWxhdGl2ZVBhdGgsXG4gICAgICAgIGlzRGlyZWN0b3J5OiBzdGF0cy5pc0RpcmVjdG9yeSgpLFxuICAgICAgICBpc0hpZGRlbjogZmlsZU5hbWUuc3RhcnRzV2l0aCgnLicpXG4gICAgICB9O1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLndhcm4oYOODleOCoeOCpOODq+aDheWgseWPluW+l+OCqOODqeODvDogJHtmaWxlUGF0aH1gLCBlcnJvcik7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICog5bmz572u44GN44OV44Kh44Kk44Or44KS44OV44Kj44Or44K/44Oq44Oz44KwXG4gICAqL1xuICBwcm90ZWN0ZWQgZmlsdGVyRmxhdEZpbGVzKGFsbEZpbGVzOiBGaWxlSW5mb1tdLCByb290UGF0aDogc3RyaW5nKTogRmlsZUluZm9bXSB7XG4gICAgcmV0dXJuIGFsbEZpbGVzLmZpbHRlcihmaWxlID0+IHtcbiAgICAgIGNvbnN0IHJlbGF0aXZlUGF0aCA9IHBhdGgucmVsYXRpdmUocm9vdFBhdGgsIGZpbGUucGF0aCk7XG4gICAgICBjb25zdCBwYXRoUGFydHMgPSByZWxhdGl2ZVBhdGguc3BsaXQocGF0aC5zZXApO1xuICAgICAgXG4gICAgICAvLyDjg6vjg7zjg4jjg4fjgqPjg6zjgq/jg4jjg6rnm7TkuIvjga7jg5XjgqHjgqTjg6vjga7jgb/jgpLlubPnva7jgY3jg5XjgqHjgqTjg6vjgajjgZfjgabliKTlrppcbiAgICAgIHJldHVybiBwYXRoUGFydHMubGVuZ3RoID09PSAxICYmICFmaWxlLmlzRGlyZWN0b3J5O1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIOeWkeOCj+OBl+OBhOODleOCoeOCpOODq+OBi+OBqeOBhuOBi+OCkuWIpOWumlxuICAgKi9cbiAgcHJvdGVjdGVkIGlzU3VzcGljaW91c0ZpbGUoZmlsZTogRmlsZUluZm8pOiBib29sZWFuIHtcbiAgICBjb25zdCBzdXNwaWNpb3VzUGF0dGVybnMgPSBbXG4gICAgICAvXnRlbXBfL2ksXG4gICAgICAvXFwudG1wJC9pLFxuICAgICAgL1xcLnRlbXAkL2ksXG4gICAgICAvXnJlc3BvbnNlXFwuanNvbiQvaSxcbiAgICAgIC9eb3V0cHV0XFwuL2ksXG4gICAgICAvXmRlYnVnXFwuL2ksXG4gICAgICAvXnRlc3QtLipcXC5qc29uJC9pLFxuICAgICAgL14uKi1iYWNrdXAkL2ksXG4gICAgICAvXi4qXFwub2xkJC9pXG4gICAgXTtcblxuICAgIHJldHVybiBzdXNwaWNpb3VzUGF0dGVybnMuc29tZShwYXR0ZXJuID0+IHBhdHRlcm4udGVzdChmaWxlLm5hbWUpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiDllY/poYzjga7jgYLjgovjg5XjgqHjgqTjg6vjgpLnibnlrppcbiAgICovXG4gIHByb3RlY3RlZCBpZGVudGlmeVByb2JsZW1hdGljRmlsZXMoZmlsZXM6IEZpbGVJbmZvW10pOiBGaWxlSW5mb1tdIHtcbiAgICByZXR1cm4gZmlsZXMuZmlsdGVyKGZpbGUgPT4ge1xuICAgICAgLy8g5aSn44GN44GZ44GO44KL44OV44Kh44Kk44OrXG4gICAgICBpZiAoZmlsZS5zaXplID4gdGhpcy5tYXhGaWxlU2l6ZSkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cblxuICAgICAgLy8g5LiN6YGp5YiH44Gq5qip6ZmQXG4gICAgICBpZiAoZmlsZS5wZXJtaXNzaW9ucyA9PT0gJzc3NycgfHwgZmlsZS5wZXJtaXNzaW9ucyA9PT0gJzY2NicpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG5cbiAgICAgIC8vIOeWkeOCj+OBl+OBhOODleOCoeOCpOODq1xuICAgICAgaWYgKHRoaXMuaXNTdXNwaWNpb3VzRmlsZShmaWxlKSkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIOODh+OCo+ODrOOCr+ODiOODquani+mAoOOCkuani+eviVxuICAgKi9cbiAgcHJvdGVjdGVkIGFzeW5jIGJ1aWxkRGlyZWN0b3J5U3RydWN0dXJlKHJvb3RQYXRoOiBzdHJpbmcpOiBQcm9taXNlPERpcmVjdG9yeU5vZGVbXT4ge1xuICAgIGNvbnN0IHN0cnVjdHVyZTogRGlyZWN0b3J5Tm9kZVtdID0gW107XG4gICAgXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGVudHJpZXMgPSBhd2FpdCBmcy5yZWFkZGlyKHJvb3RQYXRoLCB7IHdpdGhGaWxlVHlwZXM6IHRydWUgfSk7XG4gICAgICBcbiAgICAgIGZvciAoY29uc3QgZW50cnkgb2YgZW50cmllcykge1xuICAgICAgICBpZiAoZW50cnkuaXNEaXJlY3RvcnkoKSkge1xuICAgICAgICAgIGNvbnN0IGRpclBhdGggPSBwYXRoLmpvaW4ocm9vdFBhdGgsIGVudHJ5Lm5hbWUpO1xuICAgICAgICAgIFxuICAgICAgICAgIGlmICh0aGlzLnNob3VsZEV4Y2x1ZGUoZGlyUGF0aCkpIHtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IG5vZGUgPSBhd2FpdCB0aGlzLmJ1aWxkRGlyZWN0b3J5Tm9kZShkaXJQYXRoKTtcbiAgICAgICAgICBzdHJ1Y3R1cmUucHVzaChub2RlKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLndhcm4oYOODh+OCo+ODrOOCr+ODiOODquani+mAoOani+evieOCqOODqeODvDogJHtyb290UGF0aH1gLCBlcnJvcik7XG4gICAgfVxuXG4gICAgcmV0dXJuIHN0cnVjdHVyZTtcbiAgfVxuXG4gIC8qKlxuICAgKiDjg4fjgqPjg6zjgq/jg4jjg6rjg47jg7zjg4njgpLmp4vnr4lcbiAgICovXG4gIHByb3RlY3RlZCBhc3luYyBidWlsZERpcmVjdG9yeU5vZGUoZGlyUGF0aDogc3RyaW5nKTogUHJvbWlzZTxEaXJlY3RvcnlOb2RlPiB7XG4gICAgY29uc3QgbmFtZSA9IHBhdGguYmFzZW5hbWUoZGlyUGF0aCk7XG4gICAgY29uc3QgY2hpbGRyZW46IERpcmVjdG9yeU5vZGVbXSA9IFtdO1xuICAgIGxldCBmaWxlQ291bnQgPSAwO1xuICAgIGxldCBkaXJlY3RvcnlDb3VudCA9IDA7XG5cbiAgICB0cnkge1xuICAgICAgY29uc3QgZW50cmllcyA9IGF3YWl0IGZzLnJlYWRkaXIoZGlyUGF0aCwgeyB3aXRoRmlsZVR5cGVzOiB0cnVlIH0pO1xuICAgICAgXG4gICAgICBmb3IgKGNvbnN0IGVudHJ5IG9mIGVudHJpZXMpIHtcbiAgICAgICAgY29uc3QgZW50cnlQYXRoID0gcGF0aC5qb2luKGRpclBhdGgsIGVudHJ5Lm5hbWUpO1xuICAgICAgICBcbiAgICAgICAgaWYgKHRoaXMuc2hvdWxkRXhjbHVkZShlbnRyeVBhdGgpKSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZW50cnkuaXNEaXJlY3RvcnkoKSkge1xuICAgICAgICAgIGRpcmVjdG9yeUNvdW50Kys7XG4gICAgICAgICAgY29uc3QgY2hpbGROb2RlID0gYXdhaXQgdGhpcy5idWlsZERpcmVjdG9yeU5vZGUoZW50cnlQYXRoKTtcbiAgICAgICAgICBjaGlsZHJlbi5wdXNoKGNoaWxkTm9kZSk7XG4gICAgICAgIH0gZWxzZSBpZiAoZW50cnkuaXNGaWxlKCkpIHtcbiAgICAgICAgICBmaWxlQ291bnQrKztcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLndhcm4oYOODh+OCo+ODrOOCr+ODiOODquODjuODvOODieani+evieOCqOODqeODvDogJHtkaXJQYXRofWAsIGVycm9yKTtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgbmFtZSxcbiAgICAgIHBhdGg6IGRpclBhdGgsXG4gICAgICBjaGlsZHJlbixcbiAgICAgIGZpbGVDb3VudCxcbiAgICAgIGRpcmVjdG9yeUNvdW50XG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiDpmaTlpJbjgZnjgbnjgY3jg5HjgrnjgYvjganjgYbjgYvjgpLliKTlrppcbiAgICovXG4gIHByb3RlY3RlZCBzaG91bGRFeGNsdWRlKGZpbGVQYXRoOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy5leGNsdWRlUGF0dGVybnMuc29tZShwYXR0ZXJuID0+IHtcbiAgICAgIC8vIOewoeWNmOOBquOCsOODreODluODkeOCv+ODvOODs+ODnuODg+ODgeODs+OCsFxuICAgICAgY29uc3QgcmVnZXggPSBuZXcgUmVnRXhwKFxuICAgICAgICBwYXR0ZXJuXG4gICAgICAgICAgLnJlcGxhY2UoL1xcKlxcKi9nLCAnLionKVxuICAgICAgICAgIC5yZXBsYWNlKC9cXCovZywgJ1teL10qJylcbiAgICAgICAgICAucmVwbGFjZSgvXFw/L2csICdbXi9dJylcbiAgICAgICk7XG4gICAgICByZXR1cm4gcmVnZXgudGVzdChmaWxlUGF0aCk7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICog44OG44Kt44K544OI44OV44Kh44Kk44Or44GL44Gp44GG44GL44KS5Yik5a6aXG4gICAqL1xuICBwcm90ZWN0ZWQgaXNUZXh0RmlsZShleHRlbnNpb246IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgIGNvbnN0IHRleHRFeHRlbnNpb25zID0gW1xuICAgICAgJy50eHQnLCAnLm1kJywgJy5qc29uJywgJy5qcycsICcudHMnLCAnLmh0bWwnLCAnLmNzcycsICcuc2NzcycsXG4gICAgICAnLnltbCcsICcueWFtbCcsICcueG1sJywgJy5jc3YnLCAnLmxvZycsICcuZW52JywgJy5zaCcsICcuYmF0J1xuICAgIF07XG4gICAgcmV0dXJuIHRleHRFeHRlbnNpb25zLmluY2x1ZGVzKGV4dGVuc2lvbi50b0xvd2VyQ2FzZSgpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiDnm7jlr77jg5HjgrnjgpLlj5blvpdcbiAgICovXG4gIHByb3RlY3RlZCBhYnN0cmFjdCBnZXRSZWxhdGl2ZVBhdGgoZmlsZVBhdGg6IHN0cmluZyk6IHN0cmluZztcblxuICAvKipcbiAgICog44OV44Kh44Kk44Or5qip6ZmQ44KS5Y+W5b6XXG4gICAqL1xuICBwcm90ZWN0ZWQgYWJzdHJhY3QgZ2V0UGVybWlzc2lvbnMoc3RhdHM6IGFueSk6IHN0cmluZztcbn1cblxuLyoqXG4gKiDjg5XjgqHjgqTjg6vjgrnjgq3jg6Pjg4rjg7zjg6bjg7zjg4bjgqPjg6rjg4bjgqPplqLmlbBcbiAqL1xuZXhwb3J0IGNsYXNzIEZpbGVTY2FubmVyVXRpbHMge1xuICAvKipcbiAgICog44OV44Kh44Kk44Or44K144Kk44K644KS5Lq66ZaT44GM6Kqt44G/44KE44GZ44GE5b2i5byP44Gr5aSJ5o+bXG4gICAqL1xuICBzdGF0aWMgZm9ybWF0RmlsZVNpemUoYnl0ZXM6IG51bWJlcik6IHN0cmluZyB7XG4gICAgY29uc3QgdW5pdHMgPSBbJ0InLCAnS0InLCAnTUInLCAnR0InLCAnVEInXTtcbiAgICBsZXQgc2l6ZSA9IGJ5dGVzO1xuICAgIGxldCB1bml0SW5kZXggPSAwO1xuXG4gICAgd2hpbGUgKHNpemUgPj0gMTAyNCAmJiB1bml0SW5kZXggPCB1bml0cy5sZW5ndGggLSAxKSB7XG4gICAgICBzaXplIC89IDEwMjQ7XG4gICAgICB1bml0SW5kZXgrKztcbiAgICB9XG5cbiAgICByZXR1cm4gYCR7c2l6ZS50b0ZpeGVkKDEpfSAke3VuaXRzW3VuaXRJbmRleF19YDtcbiAgfVxuXG4gIC8qKlxuICAgKiDjg5XjgqHjgqTjg6vmi6HlvLXlrZDjgYvjgonmjqjlrprjgZXjgozjgovjg5XjgqHjgqTjg6vjgr/jgqTjg5fjgpLlj5blvpdcbiAgICovXG4gIHN0YXRpYyBnZXRGaWxlVHlwZUZyb21FeHRlbnNpb24oZXh0ZW5zaW9uOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIGNvbnN0IHR5cGVNYXA6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7XG4gICAgICAnLmpzJzogJ0phdmFTY3JpcHQnLFxuICAgICAgJy50cyc6ICdUeXBlU2NyaXB0JyxcbiAgICAgICcuanNvbic6ICdKU09OJyxcbiAgICAgICcubWQnOiAnTWFya2Rvd24nLFxuICAgICAgJy50eHQnOiAnVGV4dCcsXG4gICAgICAnLnNoJzogJ1NoZWxsIFNjcmlwdCcsXG4gICAgICAnLnB5JzogJ1B5dGhvbicsXG4gICAgICAnLmh0bWwnOiAnSFRNTCcsXG4gICAgICAnLmNzcyc6ICdDU1MnLFxuICAgICAgJy55bWwnOiAnWUFNTCcsXG4gICAgICAnLnlhbWwnOiAnWUFNTCcsXG4gICAgICAnLnhtbCc6ICdYTUwnLFxuICAgICAgJy5jc3YnOiAnQ1NWJyxcbiAgICAgICcubG9nJzogJ0xvZyBGaWxlJyxcbiAgICAgICcuZW52JzogJ0Vudmlyb25tZW50JyxcbiAgICAgICcucGVtJzogJ0NlcnRpZmljYXRlJyxcbiAgICAgICcua2V5JzogJ1ByaXZhdGUgS2V5J1xuICAgIH07XG5cbiAgICByZXR1cm4gdHlwZU1hcFtleHRlbnNpb24udG9Mb3dlckNhc2UoKV0gfHwgJ1Vua25vd24nO1xuICB9XG5cbiAgLyoqXG4gICAqIOODleOCoeOCpOODq+ODkeOCueOBi+OCieaOqOWumuOBleOCjOOCi+eUqOmAlOOCkuWPluW+l1xuICAgKi9cbiAgc3RhdGljIGluZmVyRmlsZVB1cnBvc2UoZmlsZVBhdGg6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgY29uc3QgZmlsZU5hbWUgPSBwYXRoLmJhc2VuYW1lKGZpbGVQYXRoKS50b0xvd2VyQ2FzZSgpO1xuICAgIFxuICAgIGlmIChmaWxlTmFtZS5pbmNsdWRlcygndGVzdCcpKSByZXR1cm4gJ1Rlc3QnO1xuICAgIGlmIChmaWxlTmFtZS5pbmNsdWRlcygnY29uZmlnJykpIHJldHVybiAnQ29uZmlndXJhdGlvbic7XG4gICAgaWYgKGZpbGVOYW1lLmluY2x1ZGVzKCdkZXBsb3knKSkgcmV0dXJuICdEZXBsb3ltZW50JztcbiAgICBpZiAoZmlsZU5hbWUuaW5jbHVkZXMoJ3NldHVwJykpIHJldHVybiAnU2V0dXAnO1xuICAgIGlmIChmaWxlTmFtZS5pbmNsdWRlcygnaW5zdGFsbCcpKSByZXR1cm4gJ0luc3RhbGxhdGlvbic7XG4gICAgaWYgKGZpbGVOYW1lLmluY2x1ZGVzKCdiYWNrdXAnKSkgcmV0dXJuICdCYWNrdXAnO1xuICAgIGlmIChmaWxlTmFtZS5pbmNsdWRlcygndGVtcCcpKSByZXR1cm4gJ1RlbXBvcmFyeSc7XG4gICAgaWYgKGZpbGVOYW1lLmluY2x1ZGVzKCdsb2cnKSkgcmV0dXJuICdMb2cnO1xuICAgIGlmIChmaWxlTmFtZS5pbmNsdWRlcygnZGVidWcnKSkgcmV0dXJuICdEZWJ1Zyc7XG4gICAgaWYgKGZpbGVOYW1lLmluY2x1ZGVzKCdzYW1wbGUnKSkgcmV0dXJuICdTYW1wbGUnO1xuICAgIGlmIChmaWxlTmFtZS5pbmNsdWRlcygnZXhhbXBsZScpKSByZXR1cm4gJ0V4YW1wbGUnO1xuICAgIFxuICAgIHJldHVybiAnVW5rbm93bic7XG4gIH1cblxuICAvKipcbiAgICog44OV44Kh44Kk44Or5oOF5aCx44KSQ1NW5b2i5byP44Gn5Ye65YqbXG4gICAqL1xuICBzdGF0aWMgZXhwb3J0VG9DU1YoZmlsZXM6IEZpbGVJbmZvW10pOiBzdHJpbmcge1xuICAgIGNvbnN0IGhlYWRlcnMgPSBbXG4gICAgICAnUGF0aCcsICdOYW1lJywgJ0V4dGVuc2lvbicsICdTaXplJywgJ1Blcm1pc3Npb25zJywgXG4gICAgICAnTGFzdE1vZGlmaWVkJywgJ0Vudmlyb25tZW50JywgJ0lzRGlyZWN0b3J5JywgJ0lzSGlkZGVuJ1xuICAgIF07XG4gICAgXG4gICAgY29uc3Qgcm93cyA9IGZpbGVzLm1hcChmaWxlID0+IFtcbiAgICAgIGZpbGUucGF0aCxcbiAgICAgIGZpbGUubmFtZSxcbiAgICAgIGZpbGUuZXh0ZW5zaW9uLFxuICAgICAgZmlsZS5zaXplLnRvU3RyaW5nKCksXG4gICAgICBmaWxlLnBlcm1pc3Npb25zLFxuICAgICAgZmlsZS5sYXN0TW9kaWZpZWQudG9JU09TdHJpbmcoKSxcbiAgICAgIGZpbGUuZW52aXJvbm1lbnQsXG4gICAgICBmaWxlLmlzRGlyZWN0b3J5LnRvU3RyaW5nKCksXG4gICAgICBmaWxlLmlzSGlkZGVuLnRvU3RyaW5nKClcbiAgICBdKTtcblxuICAgIHJldHVybiBbaGVhZGVycywgLi4ucm93c11cbiAgICAgIC5tYXAocm93ID0+IHJvdy5tYXAoY2VsbCA9PiBgXCIke2NlbGx9XCJgKS5qb2luKCcsJykpXG4gICAgICAuam9pbignXFxuJyk7XG4gIH1cblxuICAvKipcbiAgICog44K544Kt44Oj44Oz57WQ5p6c44Gu57Wx6KiI5oOF5aCx44KS55Sf5oiQXG4gICAqL1xuICBzdGF0aWMgZ2VuZXJhdGVTdGF0aXN0aWNzKHJlcG9ydDogRmxhdEZpbGVSZXBvcnQpOiBSZWNvcmQ8c3RyaW5nLCBhbnk+IHtcbiAgICBjb25zdCBzdGF0cyA9IHtcbiAgICAgIHRvdGFsRmlsZXM6IHJlcG9ydC50b3RhbEZpbGVzLFxuICAgICAgZW52aXJvbm1lbnQ6IHJlcG9ydC5lbnZpcm9ubWVudCxcbiAgICAgIHNjYW5UaW1lOiByZXBvcnQuc2NhblRpbWUsXG4gICAgICBmaWxlc0J5RXh0ZW5zaW9uOiB7fSBhcyBSZWNvcmQ8c3RyaW5nLCBudW1iZXI+LFxuICAgICAgc3VzcGljaW91c0ZpbGVDb3VudDogcmVwb3J0LnN1c3BpY2lvdXNGaWxlcy5sZW5ndGgsXG4gICAgICBsYXJnZUZpbGVDb3VudDogcmVwb3J0LmxhcmdlRmlsZXMubGVuZ3RoLFxuICAgICAgdG90YWxTaXplOiAwLFxuICAgICAgYXZlcmFnZUZpbGVTaXplOiAwXG4gICAgfTtcblxuICAgIC8vIOaLoeW8teWtkOWIpee1seioiFxuICAgIGZvciAoY29uc3QgW2V4dCwgZmlsZXNdIG9mIHJlcG9ydC5maWxlc0J5VHlwZSkge1xuICAgICAgc3RhdHMuZmlsZXNCeUV4dGVuc2lvbltleHRdID0gZmlsZXMubGVuZ3RoO1xuICAgICAgc3RhdHMudG90YWxTaXplICs9IGZpbGVzLnJlZHVjZSgoc3VtLCBmaWxlKSA9PiBzdW0gKyBmaWxlLnNpemUsIDApO1xuICAgIH1cblxuICAgIC8vIOW5s+Wdh+ODleOCoeOCpOODq+OCteOCpOOCulxuICAgIGlmIChyZXBvcnQudG90YWxGaWxlcyA+IDApIHtcbiAgICAgIHN0YXRzLmF2ZXJhZ2VGaWxlU2l6ZSA9IHN0YXRzLnRvdGFsU2l6ZSAvIHJlcG9ydC50b3RhbEZpbGVzO1xuICAgIH1cblxuICAgIHJldHVybiBzdGF0cztcbiAgfVxufSJdfQ==