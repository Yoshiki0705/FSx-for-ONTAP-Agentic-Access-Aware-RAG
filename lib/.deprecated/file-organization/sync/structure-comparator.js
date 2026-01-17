"use strict";
/**
 * 統合ファイル整理システム - 構造比較機能
 *
 * ローカル・EC2環境間のディレクトリ構造比較機能を提供し、
 * 差分検出と整合性分析を実行します。
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
exports.StructureComparator = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const index_js_1 = require("../types/index.js");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
/**
 * 構造比較器
 *
 * ローカル・EC2環境間のディレクトリ構造を比較し、
 * 詳細な差分分析を提供します。
 */
class StructureComparator {
    sshConfig;
    constructor(sshConfig) {
        this.sshConfig = sshConfig;
    }
    /**
     * 環境間構造比較を実行
     */
    async compareStructures(localRootPath = '.', ec2RootPath = '/home/ubuntu') {
        const comparisonId = `comparison-${Date.now()}`;
        const startTime = Date.now();
        console.log('🔍 環境間構造比較を開始...');
        try {
            // 並列で両環境の構造をスキャン
            const [localStructure, ec2Structure] = await Promise.all([
                this.scanLocalStructure(localRootPath),
                this.scanEC2Structure(ec2RootPath)
            ]);
            // 構造差分を分析
            const differences = await this.analyzeDifferences(localStructure, ec2Structure);
            // 一致率を計算
            const matchPercentage = this.calculateMatchPercentage(localStructure, ec2Structure, differences);
            // サマリーを生成
            const summary = this.generateComparisonSummary(localStructure, ec2Structure, differences, startTime);
            console.log(`✅ 構造比較完了: 一致率${matchPercentage.toFixed(1)}%, 差分${differences.length}個 (${summary.processingTime}ms)`);
            return {
                comparisonId,
                comparisonTime: new Date(),
                localStructure,
                ec2Structure,
                differences,
                matchPercentage,
                summary
            };
        }
        catch (error) {
            throw new index_js_1.OrganizationError(index_js_1.OrganizationErrorType.VALIDATION_FAILED, `構造比較に失敗しました: ${error}`, undefined, undefined, error);
        }
    }
    /**
     * ローカル構造をスキャン
     */
    async scanLocalStructure(rootPath) {
        console.log(`📁 ローカル構造をスキャン中: ${rootPath}`);
        try {
            const directories = [];
            const files = [];
            await this.scanLocalDirectory(rootPath, rootPath, directories, files);
            return {
                environment: 'local',
                rootPath,
                directories,
                files,
                scanTime: new Date(),
                totalDirectories: directories.length,
                totalFiles: files.length
            };
        }
        catch (error) {
            throw new index_js_1.OrganizationError(index_js_1.OrganizationErrorType.SCAN_FAILED, `ローカル構造スキャンに失敗しました: ${error}`, undefined, 'local', error);
        }
    }
    /**
     * EC2構造をスキャン
     */
    async scanEC2Structure(rootPath) {
        console.log(`🌐 EC2構造をスキャン中: ${rootPath}`);
        if (!this.sshConfig) {
            throw new Error('SSH設定が必要です');
        }
        try {
            const directories = [];
            const files = [];
            await this.scanEC2Directory(rootPath, rootPath, directories, files);
            return {
                environment: 'ec2',
                rootPath,
                directories,
                files,
                scanTime: new Date(),
                totalDirectories: directories.length,
                totalFiles: files.length
            };
        }
        catch (error) {
            throw new index_js_1.OrganizationError(index_js_1.OrganizationErrorType.SCAN_FAILED, `EC2構造スキャンに失敗しました: ${error}`, undefined, 'ec2', error);
        }
    }
    /**
     * ローカルディレクトリを再帰的にスキャン
     */
    async scanLocalDirectory(currentPath, rootPath, directories, files) {
        try {
            const entries = await fs.readdir(currentPath, { withFileTypes: true });
            // 現在のディレクトリ情報を取得
            const stats = await fs.stat(currentPath);
            const permissions = (stats.mode & parseInt('777', 8)).toString(8);
            const childDirectories = entries.filter(entry => entry.isDirectory()).length;
            const childFiles = entries.filter(entry => entry.isFile()).length;
            // ディレクトリ情報を追加
            if (currentPath !== rootPath) {
                directories.push({
                    path: path.relative(rootPath, currentPath),
                    permissions,
                    modifiedAt: stats.mtime,
                    childDirectories,
                    childFiles
                });
            }
            // 子要素を処理
            for (const entry of entries) {
                const fullPath = path.join(currentPath, entry.name);
                if (entry.isDirectory()) {
                    // 特定のディレクトリをスキップ
                    if (this.shouldSkipDirectory(entry.name)) {
                        continue;
                    }
                    await this.scanLocalDirectory(fullPath, rootPath, directories, files);
                }
                else if (entry.isFile()) {
                    const fileStats = await fs.stat(fullPath);
                    const filePermissions = (fileStats.mode & parseInt('777', 8)).toString(8);
                    files.push({
                        path: path.relative(rootPath, fullPath),
                        size: fileStats.size,
                        permissions: filePermissions,
                        modifiedAt: fileStats.mtime,
                        type: path.extname(entry.name) || 'unknown'
                    });
                }
            }
        }
        catch (error) {
            console.warn(`⚠️ ローカルディレクトリスキャンエラー: ${currentPath} - ${error}`);
        }
    }
    /**
     * EC2ディレクトリを再帰的にスキャン
     */
    async scanEC2Directory(currentPath, rootPath, directories, files) {
        try {
            // ディレクトリ一覧を取得
            const lsResult = await this.executeSSHCommand(`ls -la "${currentPath}" 2>/dev/null || true`);
            const lines = lsResult.stdout.split('\n').filter(line => line.trim());
            let childDirectories = 0;
            let childFiles = 0;
            for (const line of lines) {
                if (line.startsWith('total') || line.trim() === '')
                    continue;
                const parts = line.split(/\s+/);
                if (parts.length < 9)
                    continue;
                const permissions = parts[0].substring(1); // 最初の文字（d/-）を除く
                const size = parseInt(parts[4]) || 0;
                const name = parts.slice(8).join(' ');
                if (name === '.' || name === '..')
                    continue;
                const fullPath = path.join(currentPath, name);
                const relativePath = path.relative(rootPath, fullPath);
                if (line.startsWith('d')) {
                    // ディレクトリ
                    childDirectories++;
                    if (this.shouldSkipDirectory(name)) {
                        continue;
                    }
                    directories.push({
                        path: relativePath,
                        permissions,
                        modifiedAt: new Date(), // 簡略化
                        childDirectories: 0, // 後で更新
                        childFiles: 0 // 後で更新
                    });
                    // 再帰的にスキャン
                    await this.scanEC2Directory(fullPath, rootPath, directories, files);
                }
                else {
                    // ファイル
                    childFiles++;
                    files.push({
                        path: relativePath,
                        size,
                        permissions,
                        modifiedAt: new Date(), // 簡略化
                        type: path.extname(name) || 'unknown'
                    });
                }
            }
            // 現在のディレクトリ情報を更新
            if (currentPath !== rootPath) {
                const dirInfo = directories.find(d => d.path === path.relative(rootPath, currentPath));
                if (dirInfo) {
                    dirInfo.childDirectories = childDirectories;
                    dirInfo.childFiles = childFiles;
                }
            }
        }
        catch (error) {
            console.warn(`⚠️ EC2ディレクトリスキャンエラー: ${currentPath} - ${error}`);
        }
    }
    /**
     * 構造差分を分析
     */
    async analyzeDifferences(localStructure, ec2Structure) {
        console.log('🔍 構造差分を分析中...');
        const differences = [];
        // ディレクトリ差分の分析
        await this.analyzeDirectoryDifferences(localStructure, ec2Structure, differences);
        // ファイル差分の分析
        await this.analyzeFileDifferences(localStructure, ec2Structure, differences);
        console.log(`📊 差分分析完了: ${differences.length}個の差分を検出`);
        return differences;
    }
    /**
     * ディレクトリ差分を分析
     */
    async analyzeDirectoryDifferences(localStructure, ec2Structure, differences) {
        const localDirs = new Set(localStructure.directories.map(d => d.path));
        const ec2Dirs = new Set(ec2Structure.directories.map(d => d.path));
        // ローカルにのみ存在するディレクトリ
        for (const localDir of localStructure.directories) {
            if (!ec2Dirs.has(localDir.path)) {
                differences.push({
                    type: 'missing_directory',
                    path: localDir.path,
                    environment: 'ec2',
                    details: {
                        description: `EC2環境にディレクトリが存在しません: ${localDir.path}`
                    },
                    severity: 'medium',
                    recommendedAction: 'EC2環境にディレクトリを作成してください'
                });
            }
        }
        // EC2にのみ存在するディレクトリ
        for (const ec2Dir of ec2Structure.directories) {
            if (!localDirs.has(ec2Dir.path)) {
                differences.push({
                    type: 'extra_directory',
                    path: ec2Dir.path,
                    environment: 'ec2',
                    details: {
                        description: `ローカル環境にディレクトリが存在しません: ${ec2Dir.path}`
                    },
                    severity: 'low',
                    recommendedAction: 'ローカル環境にディレクトリを作成するか、EC2から削除してください'
                });
            }
        }
        // 権限差分の確認
        for (const localDir of localStructure.directories) {
            const ec2Dir = ec2Structure.directories.find(d => d.path === localDir.path);
            if (ec2Dir && localDir.permissions !== ec2Dir.permissions) {
                differences.push({
                    type: 'permission_mismatch',
                    path: localDir.path,
                    environment: 'ec2',
                    details: {
                        expected: localDir.permissions,
                        actual: ec2Dir.permissions,
                        description: `ディレクトリ権限が異なります: ${localDir.path}`
                    },
                    severity: 'medium',
                    recommendedAction: `EC2環境の権限を${localDir.permissions}に変更してください`
                });
            }
        }
    }
    /**
     * ファイル差分を分析
     */
    async analyzeFileDifferences(localStructure, ec2Structure, differences) {
        const localFiles = new Set(localStructure.files.map(f => f.path));
        const ec2Files = new Set(ec2Structure.files.map(f => f.path));
        // ローカルにのみ存在するファイル
        for (const localFile of localStructure.files) {
            if (!ec2Files.has(localFile.path)) {
                differences.push({
                    type: 'missing_file',
                    path: localFile.path,
                    environment: 'ec2',
                    details: {
                        description: `EC2環境にファイルが存在しません: ${localFile.path}`
                    },
                    severity: 'high',
                    recommendedAction: 'EC2環境にファイルを同期してください'
                });
            }
        }
        // EC2にのみ存在するファイル
        for (const ec2File of ec2Structure.files) {
            if (!localFiles.has(ec2File.path)) {
                differences.push({
                    type: 'extra_file',
                    path: ec2File.path,
                    environment: 'ec2',
                    details: {
                        description: `ローカル環境にファイルが存在しません: ${ec2File.path}`
                    },
                    severity: 'medium',
                    recommendedAction: 'ローカル環境にファイルを同期するか、EC2から削除してください'
                });
            }
        }
        // ファイル属性差分の確認
        for (const localFile of localStructure.files) {
            const ec2File = ec2Structure.files.find(f => f.path === localFile.path);
            if (!ec2File)
                continue;
            // サイズ差分
            if (localFile.size !== ec2File.size) {
                differences.push({
                    type: 'size_mismatch',
                    path: localFile.path,
                    environment: 'ec2',
                    details: {
                        expected: localFile.size,
                        actual: ec2File.size,
                        description: `ファイルサイズが異なります: ${localFile.path}`
                    },
                    severity: 'high',
                    recommendedAction: 'ファイル内容を確認し、同期してください'
                });
            }
            // 権限差分
            if (localFile.permissions !== ec2File.permissions) {
                differences.push({
                    type: 'permission_mismatch',
                    path: localFile.path,
                    environment: 'ec2',
                    details: {
                        expected: localFile.permissions,
                        actual: ec2File.permissions,
                        description: `ファイル権限が異なります: ${localFile.path}`
                    },
                    severity: 'medium',
                    recommendedAction: `EC2環境の権限を${localFile.permissions}に変更してください`
                });
            }
        }
    }
    /**
     * 一致率を計算
     */
    calculateMatchPercentage(localStructure, ec2Structure, differences) {
        const totalItems = localStructure.totalDirectories + localStructure.totalFiles +
            ec2Structure.totalDirectories + ec2Structure.totalFiles;
        if (totalItems === 0)
            return 100;
        const differenceCount = differences.length;
        const matchingItems = totalItems - differenceCount;
        return Math.max(0, (matchingItems / totalItems) * 100);
    }
    /**
     * 比較サマリーを生成
     */
    generateComparisonSummary(localStructure, ec2Structure, differences, startTime) {
        const totalItems = localStructure.totalDirectories + localStructure.totalFiles +
            ec2Structure.totalDirectories + ec2Structure.totalFiles;
        const matchingItems = totalItems - differences.length;
        const processingTime = Date.now() - startTime;
        // 重要度別統計
        const severityStats = { low: 0, medium: 0, high: 0, critical: 0 };
        differences.forEach(diff => {
            severityStats[diff.severity]++;
        });
        // タイプ別統計
        const typeStats = {};
        differences.forEach(diff => {
            typeStats[diff.type] = (typeStats[diff.type] || 0) + 1;
        });
        return {
            totalItems,
            matchingItems,
            differenceItems: differences.length,
            severityStats,
            typeStats,
            processingTime
        };
    }
    /**
     * スキップすべきディレクトリかどうか判定
     */
    shouldSkipDirectory(dirName) {
        const skipDirs = [
            'node_modules',
            '.git',
            '.vscode',
            '.idea',
            'cdk.out',
            'dist',
            'build',
            '.next',
            'coverage',
            '.nyc_output'
        ];
        return skipDirs.includes(dirName) || dirName.startsWith('.');
    }
    /**
     * 構造比較レポートを生成
     */
    generateComparisonReport(comparison) {
        const { summary, differences, matchPercentage } = comparison;
        // 重要度別統計
        const severityStats = Object.entries(summary.severityStats)
            .map(([level, count]) => `- **${level.toUpperCase()}**: ${count}件`)
            .join('\n');
        // タイプ別統計
        const typeStats = Object.entries(summary.typeStats)
            .map(([type, count]) => `- **${type}**: ${count}件`)
            .join('\n');
        // 重要な差分のリスト
        const criticalDifferences = differences
            .filter(d => d.severity === 'critical' || d.severity === 'high')
            .slice(0, 10)
            .map(d => `- **${d.path}**: ${d.details.description}`)
            .join('\n');
        return `
# 環境間構造比較レポート

## 比較サマリー
- **比較日時**: ${comparison.comparisonTime.toLocaleString('ja-JP')}
- **比較ID**: ${comparison.comparisonId}
- **一致率**: ${matchPercentage.toFixed(1)}%
- **総項目数**: ${summary.totalItems}個
- **一致項目**: ${summary.matchingItems}個
- **差分項目**: ${summary.differenceItems}個
- **処理時間**: ${Math.round(summary.processingTime / 1000)}秒

## 環境別統計
### ローカル環境
- **ディレクトリ数**: ${comparison.localStructure.totalDirectories}個
- **ファイル数**: ${comparison.localStructure.totalFiles}個
- **ルートパス**: ${comparison.localStructure.rootPath}

### EC2環境
- **ディレクトリ数**: ${comparison.ec2Structure.totalDirectories}個
- **ファイル数**: ${comparison.ec2Structure.totalFiles}個
- **ルートパス**: ${comparison.ec2Structure.rootPath}

## 差分統計
### 重要度別
${severityStats || '- 差分なし'}

### タイプ別
${typeStats || '- 差分なし'}

## 重要な差分（上位10件）
${criticalDifferences || '- 重要な差分なし'}

## 推奨アクション
${summary.differenceItems === 0 ?
            '- 両環境の構造は完全に一致しています。継続的な監視を推奨します。' :
            `- ${summary.differenceItems}個の差分が検出されました。同期処理の実行を検討してください。`}

${summary.severityStats.critical > 0 ?
            `\n⚠️ **緊急**: ${summary.severityStats.critical}個の重要な構造問題があります。即座に対応してください。` : ''}

## パフォーマンス統計
- **スキャン効率**: ${Math.round(summary.totalItems / (summary.processingTime / 1000))}項目/秒
- **平均処理時間**: ${Math.round(summary.processingTime / summary.totalItems)}ms/項目
`;
    }
    /**
     * SSH コマンドを実行
     */
    async executeSSHCommand(command) {
        if (!this.sshConfig) {
            throw new Error('SSH設定が必要です');
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
}
exports.StructureComparator = StructureComparator;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RydWN0dXJlLWNvbXBhcmF0b3IuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJzdHJ1Y3R1cmUtY29tcGFyYXRvci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7O0dBS0c7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsZ0RBQWtDO0FBQ2xDLDJDQUE2QjtBQUM3QixpREFBcUM7QUFDckMsK0JBQWlDO0FBQ2pDLGdEQUsyQjtBQUczQixNQUFNLFNBQVMsR0FBRyxJQUFBLGdCQUFTLEVBQUMsb0JBQUksQ0FBQyxDQUFDO0FBdUhsQzs7Ozs7R0FLRztBQUNILE1BQWEsbUJBQW1CO0lBQ2IsU0FBUyxDQUFhO0lBRXZDLFlBQVksU0FBcUI7UUFDL0IsSUFBSSxDQUFDLFNBQVMsR0FBRyxTQUFTLENBQUM7SUFDN0IsQ0FBQztJQUVEOztPQUVHO0lBQ0ksS0FBSyxDQUFDLGlCQUFpQixDQUM1QixnQkFBd0IsR0FBRyxFQUMzQixjQUFzQixjQUFjO1FBRXBDLE1BQU0sWUFBWSxHQUFHLGNBQWMsSUFBSSxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUM7UUFDaEQsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDO1FBRTdCLE9BQU8sQ0FBQyxHQUFHLENBQUMsa0JBQWtCLENBQUMsQ0FBQztRQUVoQyxJQUFJLENBQUM7WUFDSCxpQkFBaUI7WUFDakIsTUFBTSxDQUFDLGNBQWMsRUFBRSxZQUFZLENBQUMsR0FBRyxNQUFNLE9BQU8sQ0FBQyxHQUFHLENBQUM7Z0JBQ3ZELElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxhQUFhLENBQUM7Z0JBQ3RDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxXQUFXLENBQUM7YUFDbkMsQ0FBQyxDQUFDO1lBRUgsVUFBVTtZQUNWLE1BQU0sV0FBVyxHQUFHLE1BQU0sSUFBSSxDQUFDLGtCQUFrQixDQUFDLGNBQWMsRUFBRSxZQUFZLENBQUMsQ0FBQztZQUVoRixTQUFTO1lBQ1QsTUFBTSxlQUFl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LEdBQUcsRUFBRSxDQUFDLE9BQU87YUFDcEMsQ0FBQyxDQUFDO1lBQ0gsT0FBTyxNQUFNLENBQUM7UUFDaEIsQ0FBQztRQUFDLE9BQU8sS0FBVSxFQUFFLENBQUM7WUFDcEIsSUFBSSxLQUFLLENBQUMsSUFBSSxLQUFLLFdBQVcsRUFBRSxDQUFDO2dCQUMvQixNQUFNLElBQUksNEJBQWlCLENBQ3pCLGdDQUFxQixDQUFDLHFCQUFxQixFQUMzQyxxQkFBcUIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsRUFDMUMsU0FBUyxFQUNULEtBQUssRUFDTCxLQUFLLENBQ04sQ0FBQztZQUNKLENBQUM7WUFDRCxNQUFNLEtBQUssQ0FBQztRQUNkLENBQUM7SUFDSCxDQUFDO0NBQ0Y7QUE3bEJELGtEQTZsQkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIOe1seWQiOODleOCoeOCpOODq+aVtOeQhuOCt+OCueODhuODoCAtIOani+mAoOavlOi8g+apn+iDvVxuICogXG4gKiDjg63jg7zjgqvjg6vjg7tFQzLnkrDlooPplpPjga7jg4fjgqPjg6zjgq/jg4jjg6rmp4vpgKDmr5TovIPmqZ/og73jgpLmj5DkvpvjgZfjgIFcbiAqIOW3ruWIhuaknOWHuuOBqOaVtOWQiOaAp+WIhuaekOOCkuWun+ihjOOBl+OBvuOBmeOAglxuICovXG5cbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzL3Byb21pc2VzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBleGVjIH0gZnJvbSAnY2hpbGRfcHJvY2Vzcyc7XG5pbXBvcnQgeyBwcm9taXNpZnkgfSBmcm9tICd1dGlsJztcbmltcG9ydCB7IFxuICBFbnZpcm9ubWVudCxcbiAgRmlsZUluZm8sXG4gIE9yZ2FuaXphdGlvbkVycm9yLFxuICBPcmdhbml6YXRpb25FcnJvclR5cGVcbn0gZnJvbSAnLi4vdHlwZXMvaW5kZXguanMnO1xuaW1wb3J0IHsgU1NIQ29uZmlnIH0gZnJvbSAnLi4vc2Nhbm5lcnMvZWMyLXNjYW5uZXIuanMnO1xuXG5jb25zdCBleGVjQXN5bmMgPSBwcm9taXNpZnkoZXhlYyk7XG5cbi8qKlxuICog44OH44Kj44Os44Kv44OI44Oq5qeL6YCg5oOF5aCxXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgRGlyZWN0b3J5U3RydWN0dXJlIHtcbiAgLyoqIOeSsOWigyAqL1xuICBlbnZpcm9ubWVudDogRW52aXJvbm1lbnQ7XG4gIC8qKiDjg6vjg7zjg4jjg5HjgrkgKi9cbiAgcm9vdFBhdGg6IHN0cmluZztcbiAgLyoqIOODh+OCo+ODrOOCr+ODiOODquS4gOimpyAqL1xuICBkaXJlY3RvcmllczogRGlyZWN0b3J5SW5mb1tdO1xuICAvKiog44OV44Kh44Kk44Or5LiA6KanICovXG4gIGZpbGVzOiBGaWxlU3RydWN0dXJlSW5mb1tdO1xuICAvKiog44K544Kt44Oj44Oz5pmC5Yi7ICovXG4gIHNjYW5UaW1lOiBEYXRlO1xuICAvKiog57eP44OH44Kj44Os44Kv44OI44Oq5pWwICovXG4gIHRvdGFsRGlyZWN0b3JpZXM6IG51bWJlcjtcbiAgLyoqIOe3j+ODleOCoeOCpOODq+aVsCAqL1xuICB0b3RhbEZpbGVzOiBudW1iZXI7XG59XG5cbi8qKlxuICog44OH44Kj44Os44Kv44OI44Oq5oOF5aCxXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgRGlyZWN0b3J5SW5mbyB7XG4gIC8qKiDjg5HjgrkgKi9cbiAgcGF0aDogc3RyaW5nO1xuICAvKiog5qip6ZmQICovXG4gIHBlcm1pc3Npb25zOiBzdHJpbmc7XG4gIC8qKiDkvZzmiJDml6XmmYIgKi9cbiAgY3JlYXRlZEF0PzogRGF0ZTtcbiAgLyoqIOabtOaWsOaXpeaZgiAqL1xuICBtb2RpZmllZEF0OiBEYXRlO1xuICAvKiog5a2Q44OH44Kj44Os44Kv44OI44Oq5pWwICovXG4gIGNoaWxkRGlyZWN0b3JpZXM6IG51bWJlcjtcbiAgLyoqIOWtkOODleOCoeOCpOODq+aVsCAqL1xuICBjaGlsZEZpbGVzOiBudW1iZXI7XG59XG5cbi8qKlxuICog44OV44Kh44Kk44Or5qeL6YCg5oOF5aCxXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgRmlsZVN0cnVjdHVyZUluZm8ge1xuICAvKiog44OR44K5ICovXG4gIHBhdGg6IHN0cmluZztcbiAgLyoqIOODleOCoeOCpOODq+OCteOCpOOCuiAqL1xuICBzaXplOiBudW1iZXI7XG4gIC8qKiDmqKnpmZAgKi9cbiAgcGVybWlzc2lvbnM6IHN0cmluZztcbiAgLyoqIOabtOaWsOaXpeaZgiAqL1xuICBtb2RpZmllZEF0OiBEYXRlO1xuICAvKiog44OV44Kh44Kk44Or44K/44Kk44OXICovXG4gIHR5cGU6IHN0cmluZztcbiAgLyoqIOODgeOCp+ODg+OCr+OCteODoO+8iOOCquODl+OCt+ODp+ODs++8iSAqL1xuICBjaGVja3N1bT86IHN0cmluZztcbn1cblxuLyoqXG4gKiDmp4vpgKDmr5TovIPntZDmnpxcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBTdHJ1Y3R1cmVDb21wYXJpc29uIHtcbiAgLyoqIOavlOi8g0lEICovXG4gIGNvbXBhcmlzb25JZDogc3RyaW5nO1xuICAvKiog5q+U6LyD5pmC5Yi7ICovXG4gIGNvbXBhcmlzb25UaW1lOiBEYXRlO1xuICAvKiog44Ot44O844Kr44Or5qeL6YCgICovXG4gIGxvY2FsU3RydWN0dXJlOiBEaXJlY3RvcnlTdHJ1Y3R1cmU7XG4gIC8qKiBFQzLmp4vpgKAgKi9cbiAgZWMyU3RydWN0dXJlOiBEaXJlY3RvcnlTdHJ1Y3R1cmU7XG4gIC8qKiDlt67liIbmg4XloLEgKi9cbiAgZGlmZmVyZW5jZXM6IFN0cnVjdHVyZURpZmZlcmVuY2VbXTtcbiAgLyoqIOS4gOiHtOeOhyAqL1xuICBtYXRjaFBlcmNlbnRhZ2U6IG51bWJlcjtcbiAgLyoqIOavlOi8g+OCteODnuODquODvCAqL1xuICBzdW1tYXJ5OiBDb21wYXJpc29uU3VtbWFyeTtcbn1cblxuLyoqXG4gKiDmp4vpgKDlt67liIZcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBTdHJ1Y3R1cmVEaWZmZXJlbmNlIHtcbiAgLyoqIOW3ruWIhuOCv+OCpOODlyAqL1xuICB0eXBlOiAnbWlzc2luZ19kaXJlY3RvcnknIHwgJ2V4dHJhX2RpcmVjdG9yeScgfCAnbWlzc2luZ19maWxlJyB8ICdleHRyYV9maWxlJyB8IFxuICAgICAgICAncGVybWlzc2lvbl9taXNtYXRjaCcgfCAnc2l6ZV9taXNtYXRjaCcgfCAnY29udGVudF9taXNtYXRjaCc7XG4gIC8qKiDlr77osaHjg5HjgrkgKi9cbiAgcGF0aDogc3RyaW5nO1xuICAvKiog55Kw5aKDICovXG4gIGVudmlyb25tZW50OiBFbnZpcm9ubWVudDtcbiAgLyoqIOips+e0sCAqL1xuICBkZXRhaWxzOiB7XG4gICAgZXhwZWN0ZWQ/OiBhbnk7XG4gICAgYWN0dWFsPzogYW55O1xuICAgIGRlc2NyaXB0aW9uOiBzdHJpbmc7XG4gIH07XG4gIC8qKiDph43opoHluqYgKi9cbiAgc2V2ZXJpdHk6ICdsb3cnIHwgJ21lZGl1bScgfCAnaGlnaCcgfCAnY3JpdGljYWwnO1xuICAvKiog5o6o5aWo44Ki44Kv44K344On44OzICovXG4gIHJlY29tbWVuZGVkQWN0aW9uOiBzdHJpbmc7XG59XG5cbi8qKlxuICog5q+U6LyD44K144Oe44Oq44O8XG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgQ29tcGFyaXNvblN1bW1hcnkge1xuICAvKiog57eP6aCF55uu5pWwICovXG4gIHRvdGFsSXRlbXM6IG51bWJlcjtcbiAgLyoqIOS4gOiHtOmgheebruaVsCAqL1xuICBtYXRjaGluZ0l0ZW1zOiBudW1iZXI7XG4gIC8qKiDlt67liIbpoIXnm67mlbAgKi9cbiAgZGlmZmVyZW5jZUl0ZW1zOiBudW1iZXI7XG4gIC8qKiDph43opoHluqbliKXntbHoqIggKi9cbiAgc2V2ZXJpdHlTdGF0czogUmVjb3JkPHN0cmluZywgbnVtYmVyPjtcbiAgLyoqIOOCv+OCpOODl+WIpee1seioiCAqL1xuICB0eXBlU3RhdHM6IFJlY29yZDxzdHJpbmcsIG51bWJlcj47XG4gIC8qKiDlh6bnkIbmmYLplpMgKi9cbiAgcHJvY2Vzc2luZ1RpbWU6IG51bWJlcjtcbn1cblxuLyoqXG4gKiDmp4vpgKDmr5TovIPlmahcbiAqIFxuICog44Ot44O844Kr44Or44O7RUMy55Kw5aKD6ZaT44Gu44OH44Kj44Os44Kv44OI44Oq5qeL6YCg44KS5q+U6LyD44GX44CBXG4gKiDoqbPntLDjgarlt67liIbliIbmnpDjgpLmj5DkvpvjgZfjgb7jgZnjgIJcbiAqL1xuZXhwb3J0IGNsYXNzIFN0cnVjdHVyZUNvbXBhcmF0b3Ige1xuICBwcml2YXRlIHJlYWRvbmx5IHNzaENvbmZpZz86IFNTSENvbmZpZztcblxuICBjb25zdHJ1Y3Rvcihzc2hDb25maWc/OiBTU0hDb25maWcpIHtcbiAgICB0aGlzLnNzaENvbmZpZyA9IHNzaENvbmZpZztcbiAgfVxuXG4gIC8qKlxuICAgKiDnkrDlooPplpPmp4vpgKDmr5TovIPjgpLlrp/ooYxcbiAgICovXG4gIHB1YmxpYyBhc3luYyBjb21wYXJlU3RydWN0dXJlcyhcbiAgICBsb2NhbFJvb3RQYXRoOiBzdHJpbmcgPSAnLicsXG4gICAgZWMyUm9vdFBhdGg6IHN0cmluZyA9ICcvaG9tZS91YnVudHUnXG4gICk6IFByb21pc2U8U3RydWN0dXJlQ29tcGFyaXNvbj4ge1xuICAgIGNvbnN0IGNvbXBhcmlzb25JZCA9IGBjb21wYXJpc29uLSR7RGF0ZS5ub3coKX1gO1xuICAgIGNvbnN0IHN0YXJ0VGltZSA9IERhdGUubm93KCk7XG4gICAgXG4gICAgY29uc29sZS5sb2coJ/CflI0g55Kw5aKD6ZaT5qeL6YCg5q+U6LyD44KS6ZaL5aeLLi4uJyk7XG5cbiAgICB0cnkge1xuICAgICAgLy8g5Lim5YiX44Gn5Lih55Kw5aKD44Gu5qeL6YCg44KS44K544Kt44Oj44OzXG4gICAgICBjb25zdCBbbG9jYWxTdHJ1Y3R1cmUsIGVjMlN0cnVjdHVyZV0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgICAgIHRoaXMuc2NhbkxvY2FsU3RydWN0dXJlKGxvY2FsUm9vdFBhdGgpLFxuICAgICAgICB0aGlzLnNjYW5FQzJTdHJ1Y3R1cmUoZWMyUm9vdFBhdGgpXG4gICAgICBdKTtcblxuICAgICAgLy8g5qeL6YCg5beu5YiG44KS5YiG5p6QXG4gICAgICBjb25zdCBkaWZmZXJlbmNlcyA9IGF3YWl0IHRoaXMuYW5hbHl6ZURpZmZlcmVuY2VzKGxvY2FsU3RydWN0dXJlLCBlYzJTdHJ1Y3R1cmUpO1xuXG4gICAgICAvLyDkuIDoh7TnjofjgpLoqIjnrpdcbiAgICAgIGNvbnN0IG1hdGNoUGVyY2VudGFnZSA9IHRoaXMuY2FsY3VsYXRlTWF0Y2hQZXJjZW50YWdlKGxvY2FsU3RydWN0dXJlLCBlYzJTdHJ1Y3R1cmUsIGRpZmZlcmVuY2VzKTtcblxuICAgICAgLy8g44K144Oe44Oq44O844KS55Sf5oiQXG4gICAgICBjb25zdCBzdW1tYXJ5ID0gdGhpcy5nZW5lcmF0ZUNvbXBhcmlzb25TdW1tYXJ5KGxvY2FsU3RydWN0dXJlLCBlYzJTdHJ1Y3R1cmUsIGRpZmZlcmVuY2VzLCBzdGFydFRpbWUpO1xuXG4gICAgICBjb25zb2xlLmxvZyhg4pyFIOani+mAoOavlOi8g+WujOS6hjog5LiA6Ie0546HJHttYXRjaFBlcmNlbnRhZ2UudG9GaXhlZCgxKX0lLCDlt67liIYke2RpZmZlcmVuY2VzLmxlbmd0aH3lgIsgKCR7c3VtbWFyeS5wcm9jZXNzaW5nVGltZX1tcylgKTtcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgY29tcGFyaXNvbklkLFxuICAgICAgICBjb21wYXJpc29uVGltZTogbmV3IERhdGUoKSxcbiAgICAgICAgbG9jYWxTdHJ1Y3R1cmUsXG4gICAgICAgIGVjMlN0cnVjdHVyZSxcbiAgICAgICAgZGlmZmVyZW5jZXMsXG4gICAgICAgIG1hdGNoUGVyY2VudGFnZSxcbiAgICAgICAgc3VtbWFyeVxuICAgICAgfTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgdGhyb3cgbmV3IE9yZ2FuaXphdGlvbkVycm9yKFxuICAgICAgICBPcmdhbml6YXRpb25FcnJvclR5cGUuVkFMSURBVElPTl9GQUlMRUQsXG4gICAgICAgIGDmp4vpgKDmr5TovIPjgavlpLHmlZfjgZfjgb7jgZfjgZ86ICR7ZXJyb3J9YCxcbiAgICAgICAgdW5kZWZpbmVkLFxuICAgICAgICB1bmRlZmluZWQsXG4gICAgICAgIGVycm9yIGFzIEVycm9yXG4gICAgICApO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDjg63jg7zjgqvjg6vmp4vpgKDjgpLjgrnjgq3jg6Pjg7NcbiAgICovXG4gIHB1YmxpYyBhc3luYyBzY2FuTG9jYWxTdHJ1Y3R1cmUocm9vdFBhdGg6IHN0cmluZyk6IFByb21pc2U8RGlyZWN0b3J5U3RydWN0dXJlPiB7XG4gICAgY29uc29sZS5sb2coYPCfk4Eg44Ot44O844Kr44Or5qeL6YCg44KS44K544Kt44Oj44Oz5LitOiAke3Jvb3RQYXRofWApO1xuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGRpcmVjdG9yaWVzOiBEaXJlY3RvcnlJbmZvW10gPSBbXTtcbiAgICAgIGNvbnN0IGZpbGVzOiBGaWxlU3RydWN0dXJlSW5mb1tdID0gW107XG5cbiAgICAgIGF3YWl0IHRoaXMuc2NhbkxvY2FsRGlyZWN0b3J5KHJvb3RQYXRoLCByb290UGF0aCwgZGlyZWN0b3JpZXMsIGZpbGVzKTtcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgZW52aXJvbm1lbnQ6ICdsb2NhbCcsXG4gICAgICAgIHJvb3RQYXRoLFxuICAgICAgICBkaXJlY3RvcmllcyxcbiAgICAgICAgZmlsZXMsXG4gICAgICAgIHNjYW5UaW1lOiBuZXcgRGF0ZSgpLFxuICAgICAgICB0b3RhbERpcmVjdG9yaWVzOiBkaXJlY3Rvcmllcy5sZW5ndGgsXG4gICAgICAgIHRvdGFsRmlsZXM6IGZpbGVzLmxlbmd0aFxuICAgICAgfTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgdGhyb3cgbmV3IE9yZ2FuaXphdGlvbkVycm9yKFxuICAgICAgICBPcmdhbml6YXRpb25FcnJvclR5cGUuU0NBTl9GQUlMRUQsXG4gICAgICAgIGDjg63jg7zjgqvjg6vmp4vpgKDjgrnjgq3jg6Pjg7PjgavlpLHmlZfjgZfjgb7jgZfjgZ86ICR7ZXJyb3J9YCxcbiAgICAgICAgdW5kZWZpbmVkLFxuICAgICAgICAnbG9jYWwnLFxuICAgICAgICBlcnJvciBhcyBFcnJvclxuICAgICAgKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogRUMy5qeL6YCg44KS44K544Kt44Oj44OzXG4gICAqL1xuICBwdWJsaWMgYXN5bmMgc2NhbkVDMlN0cnVjdHVyZShyb290UGF0aDogc3RyaW5nKTogUHJvbWlzZTxEaXJlY3RvcnlTdHJ1Y3R1cmU+IHtcbiAgICBjb25zb2xlLmxvZyhg8J+MkCBFQzLmp4vpgKDjgpLjgrnjgq3jg6Pjg7PkuK06ICR7cm9vdFBhdGh9YCk7XG5cbiAgICBpZiAoIXRoaXMuc3NoQ29uZmlnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1NTSOioreWumuOBjOW/heimgeOBp+OBmScpO1xuICAgIH1cblxuICAgIHRyeSB7XG4gICAgICBjb25zdCBkaXJlY3RvcmllczogRGlyZWN0b3J5SW5mb1tdID0gW107XG4gICAgICBjb25zdCBmaWxlczogRmlsZVN0cnVjdHVyZUluZm9bXSA9IFtdO1xuXG4gICAgICBhd2FpdCB0aGlzLnNjYW5FQzJEaXJlY3Rvcnkocm9vdFBhdGgsIHJvb3RQYXRoLCBkaXJlY3RvcmllcywgZmlsZXMpO1xuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBlbnZpcm9ubWVudDogJ2VjMicsXG4gICAgICAgIHJvb3RQYXRoLFxuICAgICAgICBkaXJlY3RvcmllcyxcbiAgICAgICAgZmlsZXMsXG4gICAgICAgIHNjYW5UaW1lOiBuZXcgRGF0ZSgpLFxuICAgICAgICB0b3RhbERpcmVjdG9yaWVzOiBkaXJlY3Rvcmllcy5sZW5ndGgsXG4gICAgICAgIHRvdGFsRmlsZXM6IGZpbGVzLmxlbmd0aFxuICAgICAgfTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgdGhyb3cgbmV3IE9yZ2FuaXphdGlvbkVycm9yKFxuICAgICAgICBPcmdhbml6YXRpb25FcnJvclR5cGUuU0NBTl9GQUlMRUQsXG4gICAgICAgIGBFQzLmp4vpgKDjgrnjgq3jg6Pjg7PjgavlpLHmlZfjgZfjgb7jgZfjgZ86ICR7ZXJyb3J9YCxcbiAgICAgICAgdW5kZWZpbmVkLFxuICAgICAgICAnZWMyJyxcbiAgICAgICAgZXJyb3IgYXMgRXJyb3JcbiAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIOODreODvOOCq+ODq+ODh+OCo+ODrOOCr+ODiOODquOCkuWGjeW4sOeahOOBq+OCueOCreODo+ODs1xuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBzY2FuTG9jYWxEaXJlY3RvcnkoXG4gICAgY3VycmVudFBhdGg6IHN0cmluZyxcbiAgICByb290UGF0aDogc3RyaW5nLFxuICAgIGRpcmVjdG9yaWVzOiBEaXJlY3RvcnlJbmZvW10sXG4gICAgZmlsZXM6IEZpbGVTdHJ1Y3R1cmVJbmZvW11cbiAgKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGVudHJpZXMgPSBhd2FpdCBmcy5yZWFkZGlyKGN1cnJlbnRQYXRoLCB7IHdpdGhGaWxlVHlwZXM6IHRydWUgfSk7XG4gICAgICBcbiAgICAgIC8vIOePvuWcqOOBruODh+OCo+ODrOOCr+ODiOODquaDheWgseOCkuWPluW+l1xuICAgICAgY29uc3Qgc3RhdHMgPSBhd2FpdCBmcy5zdGF0KGN1cnJlbnRQYXRoKTtcbiAgICAgIGNvbnN0IHBlcm1pc3Npb25zID0gKHN0YXRzLm1vZGUgJiBwYXJzZUludCgnNzc3JywgOCkpLnRvU3RyaW5nKDgpO1xuICAgICAgXG4gICAgICBjb25zdCBjaGlsZERpcmVjdG9yaWVzID0gZW50cmllcy5maWx0ZXIoZW50cnkgPT4gZW50cnkuaXNEaXJlY3RvcnkoKSkubGVuZ3RoO1xuICAgICAgY29uc3QgY2hpbGRGaWxlcyA9IGVudHJpZXMuZmlsdGVyKGVudHJ5ID0+IGVudHJ5LmlzRmlsZSgpKS5sZW5ndGg7XG5cbiAgICAgIC8vIOODh+OCo+ODrOOCr+ODiOODquaDheWgseOCkui/veWKoFxuICAgICAgaWYgKGN1cnJlbnRQYXRoICE9PSByb290UGF0aCkge1xuICAgICAgICBkaXJlY3Rvcmllcy5wdXNoKHtcbiAgICAgICAgICBwYXRoOiBwYXRoLnJlbGF0aXZlKHJvb3RQYXRoLCBjdXJyZW50UGF0aCksXG4gICAgICAgICAgcGVybWlzc2lvbnMsXG4gICAgICAgICAgbW9kaWZpZWRBdDogc3RhdHMubXRpbWUsXG4gICAgICAgICAgY2hpbGREaXJlY3RvcmllcyxcbiAgICAgICAgICBjaGlsZEZpbGVzXG4gICAgICAgIH0pO1xuICAgICAgfVxuXG4gICAgICAvLyDlrZDopoHntKDjgpLlh6bnkIZcbiAgICAgIGZvciAoY29uc3QgZW50cnkgb2YgZW50cmllcykge1xuICAgICAgICBjb25zdCBmdWxsUGF0aCA9IHBhdGguam9pbihjdXJyZW50UGF0aCwgZW50cnkubmFtZSk7XG4gICAgICAgIFxuICAgICAgICBpZiAoZW50cnkuaXNEaXJlY3RvcnkoKSkge1xuICAgICAgICAgIC8vIOeJueWumuOBruODh+OCo+ODrOOCr+ODiOODquOCkuOCueOCreODg+ODl1xuICAgICAgICAgIGlmICh0aGlzLnNob3VsZFNraXBEaXJlY3RvcnkoZW50cnkubmFtZSkpIHtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgIH1cbiAgICAgICAgICBcbiAgICAgICAgICBhd2FpdCB0aGlzLnNjYW5Mb2NhbERpcmVjdG9yeShmdWxsUGF0aCwgcm9vdFBhdGgsIGRpcmVjdG9yaWVzLCBmaWxlcyk7XG4gICAgICAgIH0gZWxzZSBpZiAoZW50cnkuaXNGaWxlKCkpIHtcbiAgICAgICAgICBjb25zdCBmaWxlU3RhdHMgPSBhd2FpdCBmcy5zdGF0KGZ1bGxQYXRoKTtcbiAgICAgICAgICBjb25zdCBmaWxlUGVybWlzc2lvbnMgPSAoZmlsZVN0YXRzLm1vZGUgJiBwYXJzZUludCgnNzc3JywgOCkpLnRvU3RyaW5nKDgpO1xuICAgICAgICAgIFxuICAgICAgICAgIGZpbGVzLnB1c2goe1xuICAgICAgICAgICAgcGF0aDogcGF0aC5yZWxhdGl2ZShyb290UGF0aCwgZnVsbFBhdGgpLFxuICAgICAgICAgICAgc2l6ZTogZmlsZVN0YXRzLnNpemUsXG4gICAgICAgICAgICBwZXJtaXNzaW9uczogZmlsZVBlcm1pc3Npb25zLFxuICAgICAgICAgICAgbW9kaWZpZWRBdDogZmlsZVN0YXRzLm10aW1lLFxuICAgICAgICAgICAgdHlwZTogcGF0aC5leHRuYW1lKGVudHJ5Lm5hbWUpIHx8ICd1bmtub3duJ1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUud2Fybihg4pqg77iPIOODreODvOOCq+ODq+ODh+OCo+ODrOOCr+ODiOODquOCueOCreODo+ODs+OCqOODqeODvDogJHtjdXJyZW50UGF0aH0gLSAke2Vycm9yfWApO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBFQzLjg4fjgqPjg6zjgq/jg4jjg6rjgpLlho3luLDnmoTjgavjgrnjgq3jg6Pjg7NcbiAgICovXG4gIHByaXZhdGUgYXN5bmMgc2NhbkVDMkRpcmVjdG9yeShcbiAgICBjdXJyZW50UGF0aDogc3RyaW5nLFxuICAgIHJvb3RQYXRoOiBzdHJpbmcsXG4gICAgZGlyZWN0b3JpZXM6IERpcmVjdG9yeUluZm9bXSxcbiAgICBmaWxlczogRmlsZVN0cnVjdHVyZUluZm9bXVxuICApOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0cnkge1xuICAgICAgLy8g44OH44Kj44Os44Kv44OI44Oq5LiA6Kan44KS5Y+W5b6XXG4gICAgICBjb25zdCBsc1Jlc3VsdCA9IGF3YWl0IHRoaXMuZXhlY3V0ZVNTSENvbW1hbmQoYGxzIC1sYSBcIiR7Y3VycmVudFBhdGh9XCIgMj4vZGV2L251bGwgfHwgdHJ1ZWApO1xuICAgICAgY29uc3QgbGluZXMgPSBsc1Jlc3VsdC5zdGRvdXQuc3BsaXQoJ1xcbicpLmZpbHRlcihsaW5lID0+IGxpbmUudHJpbSgpKTtcbiAgICAgIFxuICAgICAgbGV0IGNoaWxkRGlyZWN0b3JpZXMgPSAwO1xuICAgICAgbGV0IGNoaWxkRmlsZXMgPSAwO1xuXG4gICAgICBmb3IgKGNvbnN0IGxpbmUgb2YgbGluZXMpIHtcbiAgICAgICAgaWYgKGxpbmUuc3RhcnRzV2l0aCgndG90YWwnKSB8fCBsaW5lLnRyaW0oKSA9PT0gJycpIGNvbnRpbnVlO1xuICAgICAgICBcbiAgICAgICAgY29uc3QgcGFydHMgPSBsaW5lLnNwbGl0KC9cXHMrLyk7XG4gICAgICAgIGlmIChwYXJ0cy5sZW5ndGggPCA5KSBjb250aW51ZTtcbiAgICAgICAgXG4gICAgICAgIGNvbnN0IHBlcm1pc3Npb25zID0gcGFydHNbMF0uc3Vic3RyaW5nKDEpOyAvLyDmnIDliJ3jga7mloflrZfvvIhkLy3vvInjgpLpmaTjgY9cbiAgICAgICAgY29uc3Qgc2l6ZSA9IHBhcnNlSW50KHBhcnRzWzRdKSB8fCAwO1xuICAgICAgICBjb25zdCBuYW1lID0gcGFydHMuc2xpY2UoOCkuam9pbignICcpO1xuICAgICAgICBcbiAgICAgICAgaWYgKG5hbWUgPT09ICcuJyB8fCBuYW1lID09PSAnLi4nKSBjb250aW51ZTtcbiAgICAgICAgXG4gICAgICAgIGNvbnN0IGZ1bGxQYXRoID0gcGF0aC5qb2luKGN1cnJlbnRQYXRoLCBuYW1lKTtcbiAgICAgICAgY29uc3QgcmVsYXRpdmVQYXRoID0gcGF0aC5yZWxhdGl2ZShyb290UGF0aCwgZnVsbFBhdGgpO1xuICAgICAgICBcbiAgICAgICAgaWYgKGxpbmUuc3RhcnRzV2l0aCgnZCcpKSB7XG4gICAgICAgICAgLy8g44OH44Kj44Os44Kv44OI44OqXG4gICAgICAgICAgY2hpbGREaXJlY3RvcmllcysrO1xuICAgICAgICAgIFxuICAgICAgICAgIGlmICh0aGlzLnNob3VsZFNraXBEaXJlY3RvcnkobmFtZSkpIHtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgIH1cbiAgICAgICAgICBcbiAgICAgICAgICBkaXJlY3Rvcmllcy5wdXNoKHtcbiAgICAgICAgICAgIHBhdGg6IHJlbGF0aXZlUGF0aCxcbiAgICAgICAgICAgIHBlcm1pc3Npb25zLFxuICAgICAgICAgICAgbW9kaWZpZWRBdDogbmV3IERhdGUoKSwgLy8g57Ch55Wl5YyWXG4gICAgICAgICAgICBjaGlsZERpcmVjdG9yaWVzOiAwLCAvLyDlvozjgafmm7TmlrBcbiAgICAgICAgICAgIGNoaWxkRmlsZXM6IDAgLy8g5b6M44Gn5pu05pawXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgXG4gICAgICAgICAgLy8g5YaN5biw55qE44Gr44K544Kt44Oj44OzXG4gICAgICAgICAgYXdhaXQgdGhpcy5zY2FuRUMyRGlyZWN0b3J5KGZ1bGxQYXRoLCByb290UGF0aCwgZGlyZWN0b3JpZXMsIGZpbGVzKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyDjg5XjgqHjgqTjg6tcbiAgICAgICAgICBjaGlsZEZpbGVzKys7XG4gICAgICAgICAgXG4gICAgICAgICAgZmlsZXMucHVzaCh7XG4gICAgICAgICAgICBwYXRoOiByZWxhdGl2ZVBhdGgsXG4gICAgICAgICAgICBzaXplLFxuICAgICAgICAgICAgcGVybWlzc2lvbnMsXG4gICAgICAgICAgICBtb2RpZmllZEF0OiBuZXcgRGF0ZSgpLCAvLyDnsKHnlaXljJZcbiAgICAgICAgICAgIHR5cGU6IHBhdGguZXh0bmFtZShuYW1lKSB8fCAndW5rbm93bidcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyDnj77lnKjjga7jg4fjgqPjg6zjgq/jg4jjg6rmg4XloLHjgpLmm7TmlrBcbiAgICAgIGlmIChjdXJyZW50UGF0aCAhPT0gcm9vdFBhdGgpIHtcbiAgICAgICAgY29uc3QgZGlySW5mbyA9IGRpcmVjdG9yaWVzLmZpbmQoZCA9PiBkLnBhdGggPT09IHBhdGgucmVsYXRpdmUocm9vdFBhdGgsIGN1cnJlbnRQYXRoKSk7XG4gICAgICAgIGlmIChkaXJJbmZvKSB7XG4gICAgICAgICAgZGlySW5mby5jaGlsZERpcmVjdG9yaWVzID0gY2hpbGREaXJlY3RvcmllcztcbiAgICAgICAgICBkaXJJbmZvLmNoaWxkRmlsZXMgPSBjaGlsZEZpbGVzO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUud2Fybihg4pqg77iPIEVDMuODh+OCo+ODrOOCr+ODiOODquOCueOCreODo+ODs+OCqOODqeODvDogJHtjdXJyZW50UGF0aH0gLSAke2Vycm9yfWApO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDmp4vpgKDlt67liIbjgpLliIbmnpBcbiAgICovXG4gIHByaXZhdGUgYXN5bmMgYW5hbHl6ZURpZmZlcmVuY2VzKFxuICAgIGxvY2FsU3RydWN0dXJlOiBEaXJlY3RvcnlTdHJ1Y3R1cmUsXG4gICAgZWMyU3RydWN0dXJlOiBEaXJlY3RvcnlTdHJ1Y3R1cmVcbiAgKTogUHJvbWlzZTxTdHJ1Y3R1cmVEaWZmZXJlbmNlW10+IHtcbiAgICBjb25zb2xlLmxvZygn8J+UjSDmp4vpgKDlt67liIbjgpLliIbmnpDkuK0uLi4nKTtcblxuICAgIGNvbnN0IGRpZmZlcmVuY2VzOiBTdHJ1Y3R1cmVEaWZmZXJlbmNlW10gPSBbXTtcblxuICAgIC8vIOODh+OCo+ODrOOCr+ODiOODquW3ruWIhuOBruWIhuaekFxuICAgIGF3YWl0IHRoaXMuYW5hbHl6ZURpcmVjdG9yeURpZmZlcmVuY2VzKGxvY2FsU3RydWN0dXJlLCBlYzJTdHJ1Y3R1cmUsIGRpZmZlcmVuY2VzKTtcblxuICAgIC8vIOODleOCoeOCpOODq+W3ruWIhuOBruWIhuaekFxuICAgIGF3YWl0IHRoaXMuYW5hbHl6ZUZpbGVEaWZmZXJlbmNlcyhsb2NhbFN0cnVjdHVyZSwgZWMyU3RydWN0dXJlLCBkaWZmZXJlbmNlcyk7XG5cbiAgICBjb25zb2xlLmxvZyhg8J+TiiDlt67liIbliIbmnpDlrozkuoY6ICR7ZGlmZmVyZW5jZXMubGVuZ3RofeWAi+OBruW3ruWIhuOCkuaknOWHumApO1xuXG4gICAgcmV0dXJuIGRpZmZlcmVuY2VzO1xuICB9XG5cbiAgLyoqXG4gICAqIOODh+OCo+ODrOOCr+ODiOODquW3ruWIhuOCkuWIhuaekFxuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBhbmFseXplRGlyZWN0b3J5RGlmZmVyZW5jZXMoXG4gICAgbG9jYWxTdHJ1Y3R1cmU6IERpcmVjdG9yeVN0cnVjdHVyZSxcbiAgICBlYzJTdHJ1Y3R1cmU6IERpcmVjdG9yeVN0cnVjdHVyZSxcbiAgICBkaWZmZXJlbmNlczogU3RydWN0dXJlRGlmZmVyZW5jZVtdXG4gICk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IGxvY2FsRGlycyA9IG5ldyBTZXQobG9jYWxTdHJ1Y3R1cmUuZGlyZWN0b3JpZXMubWFwKGQgPT4gZC5wYXRoKSk7XG4gICAgY29uc3QgZWMyRGlycyA9IG5ldyBTZXQoZWMyU3RydWN0dXJlLmRpcmVjdG9yaWVzLm1hcChkID0+IGQucGF0aCkpO1xuXG4gICAgLy8g44Ot44O844Kr44Or44Gr44Gu44G/5a2Y5Zyo44GZ44KL44OH44Kj44Os44Kv44OI44OqXG4gICAgZm9yIChjb25zdCBsb2NhbERpciBvZiBsb2NhbFN0cnVjdHVyZS5kaXJlY3Rvcmllcykge1xuICAgICAgaWYgKCFlYzJEaXJzLmhhcyhsb2NhbERpci5wYXRoKSkge1xuICAgICAgICBkaWZmZXJlbmNlcy5wdXNoKHtcbiAgICAgICAgICB0eXBlOiAnbWlzc2luZ19kaXJlY3RvcnknLFxuICAgICAgICAgIHBhdGg6IGxvY2FsRGlyLnBhdGgsXG4gICAgICAgICAgZW52aXJvbm1lbnQ6ICdlYzInLFxuICAgICAgICAgIGRldGFpbHM6IHtcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBgRUMy55Kw5aKD44Gr44OH44Kj44Os44Kv44OI44Oq44GM5a2Y5Zyo44GX44G+44Gb44KTOiAke2xvY2FsRGlyLnBhdGh9YFxuICAgICAgICAgIH0sXG4gICAgICAgICAgc2V2ZXJpdHk6ICdtZWRpdW0nLFxuICAgICAgICAgIHJlY29tbWVuZGVkQWN0aW9uOiAnRUMy55Kw5aKD44Gr44OH44Kj44Os44Kv44OI44Oq44KS5L2c5oiQ44GX44Gm44GP44Gg44GV44GEJ1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBFQzLjgavjga7jgb/lrZjlnKjjgZnjgovjg4fjgqPjg6zjgq/jg4jjg6pcbiAgICBmb3IgKGNvbnN0IGVjMkRpciBvZiBlYzJTdHJ1Y3R1cmUuZGlyZWN0b3JpZXMpIHtcbiAgICAgIGlmICghbG9jYWxEaXJzLmhhcyhlYzJEaXIucGF0aCkpIHtcbiAgICAgICAgZGlmZmVyZW5jZXMucHVzaCh7XG4gICAgICAgICAgdHlwZTogJ2V4dHJhX2RpcmVjdG9yeScsXG4gICAgICAgICAgcGF0aDogZWMyRGlyLnBhdGgsXG4gICAgICAgICAgZW52aXJvbm1lbnQ6ICdlYzInLFxuICAgICAgICAgIGRldGFpbHM6IHtcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBg44Ot44O844Kr44Or55Kw5aKD44Gr44OH44Kj44Os44Kv44OI44Oq44GM5a2Y5Zyo44GX44G+44Gb44KTOiAke2VjMkRpci5wYXRofWBcbiAgICAgICAgICB9LFxuICAgICAgICAgIHNldmVyaXR5OiAnbG93JyxcbiAgICAgICAgICByZWNvbW1lbmRlZEFjdGlvbjogJ+ODreODvOOCq+ODq+eSsOWig+OBq+ODh+OCo+ODrOOCr+ODiOODquOCkuS9nOaIkOOBmeOCi+OBi+OAgUVDMuOBi+OCieWJiumZpOOBl+OBpuOBj+OBoOOBleOBhCdcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8g5qip6ZmQ5beu5YiG44Gu56K66KqNXG4gICAgZm9yIChjb25zdCBsb2NhbERpciBvZiBsb2NhbFN0cnVjdHVyZS5kaXJlY3Rvcmllcykge1xuICAgICAgY29uc3QgZWMyRGlyID0gZWMyU3RydWN0dXJlLmRpcmVjdG9yaWVzLmZpbmQoZCA9PiBkLnBhdGggPT09IGxvY2FsRGlyLnBhdGgpO1xuICAgICAgaWYgKGVjMkRpciAmJiBsb2NhbERpci5wZXJtaXNzaW9ucyAhPT0gZWMyRGlyLnBlcm1pc3Npb25zKSB7XG4gICAgICAgIGRpZmZlcmVuY2VzLnB1c2goe1xuICAgICAgICAgIHR5cGU6ICdwZXJtaXNzaW9uX21pc21hdGNoJyxcbiAgICAgICAgICBwYXRoOiBsb2NhbERpci5wYXRoLFxuICAgICAgICAgIGVudmlyb25tZW50OiAnZWMyJyxcbiAgICAgICAgICBkZXRhaWxzOiB7XG4gICAgICAgICAgICBleHBlY3RlZDogbG9jYWxEaXIucGVybWlzc2lvbnMsXG4gICAgICAgICAgICBhY3R1YWw6IGVjMkRpci5wZXJtaXNzaW9ucyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBg44OH44Kj44Os44Kv44OI44Oq5qip6ZmQ44GM55Ww44Gq44KK44G+44GZOiAke2xvY2FsRGlyLnBhdGh9YFxuICAgICAgICAgIH0sXG4gICAgICAgICAgc2V2ZXJpdHk6ICdtZWRpdW0nLFxuICAgICAgICAgIHJlY29tbWVuZGVkQWN0aW9uOiBgRUMy55Kw5aKD44Gu5qip6ZmQ44KSJHtsb2NhbERpci5wZXJtaXNzaW9uc33jgavlpInmm7TjgZfjgabjgY/jgaDjgZXjgYRgXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDjg5XjgqHjgqTjg6vlt67liIbjgpLliIbmnpBcbiAgICovXG4gIHByaXZhdGUgYXN5bmMgYW5hbHl6ZUZpbGVEaWZmZXJlbmNlcyhcbiAgICBsb2NhbFN0cnVjdHVyZTogRGlyZWN0b3J5U3RydWN0dXJlLFxuICAgIGVjMlN0cnVjdHVyZTogRGlyZWN0b3J5U3RydWN0dXJlLFxuICAgIGRpZmZlcmVuY2VzOiBTdHJ1Y3R1cmVEaWZmZXJlbmNlW11cbiAgKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgbG9jYWxGaWxlcyA9IG5ldyBTZXQobG9jYWxTdHJ1Y3R1cmUuZmlsZXMubWFwKGYgPT4gZi5wYXRoKSk7XG4gICAgY29uc3QgZWMyRmlsZXMgPSBuZXcgU2V0KGVjMlN0cnVjdHVyZS5maWxlcy5tYXAoZiA9PiBmLnBhdGgpKTtcblxuICAgIC8vIOODreODvOOCq+ODq+OBq+OBruOBv+WtmOWcqOOBmeOCi+ODleOCoeOCpOODq1xuICAgIGZvciAoY29uc3QgbG9jYWxGaWxlIG9mIGxvY2FsU3RydWN0dXJlLmZpbGVzKSB7XG4gICAgICBpZiAoIWVjMkZpbGVzLmhhcyhsb2NhbEZpbGUucGF0aCkpIHtcbiAgICAgICAgZGlmZmVyZW5jZXMucHVzaCh7XG4gICAgICAgICAgdHlwZTogJ21pc3NpbmdfZmlsZScsXG4gICAgICAgICAgcGF0aDogbG9jYWxGaWxlLnBhdGgsXG4gICAgICAgICAgZW52aXJvbm1lbnQ6ICdlYzInLFxuICAgICAgICAgIGRldGFpbHM6IHtcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBgRUMy55Kw5aKD44Gr44OV44Kh44Kk44Or44GM5a2Y5Zyo44GX44G+44Gb44KTOiAke2xvY2FsRmlsZS5wYXRofWBcbiAgICAgICAgICB9LFxuICAgICAgICAgIHNldmVyaXR5OiAnaGlnaCcsXG4gICAgICAgICAgcmVjb21tZW5kZWRBY3Rpb246ICdFQzLnkrDlooPjgavjg5XjgqHjgqTjg6vjgpLlkIzmnJ/jgZfjgabjgY/jgaDjgZXjgYQnXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIEVDMuOBq+OBruOBv+WtmOWcqOOBmeOCi+ODleOCoeOCpOODq1xuICAgIGZvciAoY29uc3QgZWMyRmlsZSBvZiBlYzJTdHJ1Y3R1cmUuZmlsZXMpIHtcbiAgICAgIGlmICghbG9jYWxGaWxlcy5oYXMoZWMyRmlsZS5wYXRoKSkge1xuICAgICAgICBkaWZmZXJlbmNlcy5wdXNoKHtcbiAgICAgICAgICB0eXBlOiAnZXh0cmFfZmlsZScsXG4gICAgICAgICAgcGF0aDogZWMyRmlsZS5wYXRoLFxuICAgICAgICAgIGVudmlyb25tZW50OiAnZWMyJyxcbiAgICAgICAgICBkZXRhaWxzOiB7XG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogYOODreODvOOCq+ODq+eSsOWig+OBq+ODleOCoeOCpOODq+OBjOWtmOWcqOOBl+OBvuOBm+OCkzogJHtlYzJGaWxlLnBhdGh9YFxuICAgICAgICAgIH0sXG4gICAgICAgICAgc2V2ZXJpdHk6ICdtZWRpdW0nLFxuICAgICAgICAgIHJlY29tbWVuZGVkQWN0aW9uOiAn44Ot44O844Kr44Or55Kw5aKD44Gr44OV44Kh44Kk44Or44KS5ZCM5pyf44GZ44KL44GL44CBRUMy44GL44KJ5YmK6Zmk44GX44Gm44GP44Gg44GV44GEJ1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyDjg5XjgqHjgqTjg6vlsZ7mgKflt67liIbjga7norroqo1cbiAgICBmb3IgKGNvbnN0IGxvY2FsRmlsZSBvZiBsb2NhbFN0cnVjdHVyZS5maWxlcykge1xuICAgICAgY29uc3QgZWMyRmlsZSA9IGVjMlN0cnVjdHVyZS5maWxlcy5maW5kKGYgPT4gZi5wYXRoID09PSBsb2NhbEZpbGUucGF0aCk7XG4gICAgICBpZiAoIWVjMkZpbGUpIGNvbnRpbnVlO1xuXG4gICAgICAvLyDjgrXjgqTjgrrlt67liIZcbiAgICAgIGlmIChsb2NhbEZpbGUuc2l6ZSAhPT0gZWMyRmlsZS5zaXplKSB7XG4gICAgICAgIGRpZmZlcmVuY2VzLnB1c2goe1xuICAgICAgICAgIHR5cGU6ICdzaXplX21pc21hdGNoJyxcbiAgICAgICAgICBwYXRoOiBsb2NhbEZpbGUucGF0aCxcbiAgICAgICAgICBlbnZpcm9ubWVudDogJ2VjMicsXG4gICAgICAgICAgZGV0YWlsczoge1xuICAgICAgICAgICAgZXhwZWN0ZWQ6IGxvY2FsRmlsZS5zaXplLFxuICAgICAgICAgICAgYWN0dWFsOiBlYzJGaWxlLnNpemUsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogYOODleOCoeOCpOODq+OCteOCpOOCuuOBjOeVsOOBquOCiuOBvuOBmTogJHtsb2NhbEZpbGUucGF0aH1gXG4gICAgICAgICAgfSxcbiAgICAgICAgICBzZXZlcml0eTogJ2hpZ2gnLFxuICAgICAgICAgIHJlY29tbWVuZGVkQWN0aW9uOiAn44OV44Kh44Kk44Or5YaF5a6544KS56K66KqN44GX44CB5ZCM5pyf44GX44Gm44GP44Gg44GV44GEJ1xuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgLy8g5qip6ZmQ5beu5YiGXG4gICAgICBpZiAobG9jYWxGaWxlLnBlcm1pc3Npb25zICE9PSBlYzJGaWxlLnBlcm1pc3Npb25zKSB7XG4gICAgICAgIGRpZmZlcmVuY2VzLnB1c2goe1xuICAgICAgICAgIHR5cGU6ICdwZXJtaXNzaW9uX21pc21hdGNoJyxcbiAgICAgICAgICBwYXRoOiBsb2NhbEZpbGUucGF0aCxcbiAgICAgICAgICBlbnZpcm9ubWVudDogJ2VjMicsXG4gICAgICAgICAgZGV0YWlsczoge1xuICAgICAgICAgICAgZXhwZWN0ZWQ6IGxvY2FsRmlsZS5wZXJtaXNzaW9ucyxcbiAgICAgICAgICAgIGFjdHVhbDogZWMyRmlsZS5wZXJtaXNzaW9ucyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBg44OV44Kh44Kk44Or5qip6ZmQ44GM55Ww44Gq44KK44G+44GZOiAke2xvY2FsRmlsZS5wYXRofWBcbiAgICAgICAgICB9LFxuICAgICAgICAgIHNldmVyaXR5OiAnbWVkaXVtJyxcbiAgICAgICAgICByZWNvbW1lbmRlZEFjdGlvbjogYEVDMueSsOWig+OBruaoqemZkOOCkiR7bG9jYWxGaWxlLnBlcm1pc3Npb25zfeOBq+WkieabtOOBl+OBpuOBj+OBoOOBleOBhGBcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIOS4gOiHtOeOh+OCkuioiOeul1xuICAgKi9cbiAgcHJpdmF0ZSBjYWxjdWxhdGVNYXRjaFBlcmNlbnRhZ2UoXG4gICAgbG9jYWxTdHJ1Y3R1cmU6IERpcmVjdG9yeVN0cnVjdHVyZSxcbiAgICBlYzJTdHJ1Y3R1cmU6IERpcmVjdG9yeVN0cnVjdHVyZSxcbiAgICBkaWZmZXJlbmNlczogU3RydWN0dXJlRGlmZmVyZW5jZVtdXG4gICk6IG51bWJlciB7XG4gICAgY29uc3QgdG90YWxJdGVtcyA9IGxvY2FsU3RydWN0dXJlLnRvdGFsRGlyZWN0b3JpZXMgKyBsb2NhbFN0cnVjdHVyZS50b3RhbEZpbGVzICsgXG4gICAgICAgICAgICAgICAgICAgICAgZWMyU3RydWN0dXJlLnRvdGFsRGlyZWN0b3JpZXMgKyBlYzJTdHJ1Y3R1cmUudG90YWxGaWxlcztcbiAgICBcbiAgICBpZiAodG90YWxJdGVtcyA9PT0gMCkgcmV0dXJuIDEwMDtcbiAgICBcbiAgICBjb25zdCBkaWZmZXJlbmNlQ291bnQgPSBkaWZmZXJlbmNlcy5sZW5ndGg7XG4gICAgY29uc3QgbWF0Y2hpbmdJdGVtcyA9IHRvdGFsSXRlbXMgLSBkaWZmZXJlbmNlQ291bnQ7XG4gICAgXG4gICAgcmV0dXJuIE1hdGgubWF4KDAsIChtYXRjaGluZ0l0ZW1zIC8gdG90YWxJdGVtcykgKiAxMDApO1xuICB9XG5cbiAgLyoqXG4gICAqIOavlOi8g+OCteODnuODquODvOOCkueUn+aIkFxuICAgKi9cbiAgcHJpdmF0ZSBnZW5lcmF0ZUNvbXBhcmlzb25TdW1tYXJ5KFxuICAgIGxvY2FsU3RydWN0dXJlOiBEaXJlY3RvcnlTdHJ1Y3R1cmUsXG4gICAgZWMyU3RydWN0dXJlOiBEaXJlY3RvcnlTdHJ1Y3R1cmUsXG4gICAgZGlmZmVyZW5jZXM6IFN0cnVjdHVyZURpZmZlcmVuY2VbXSxcbiAgICBzdGFydFRpbWU6IG51bWJlclxuICApOiBDb21wYXJpc29uU3VtbWFyeSB7XG4gICAgY29uc3QgdG90YWxJdGVtcyA9IGxvY2FsU3RydWN0dXJlLnRvdGFsRGlyZWN0b3JpZXMgKyBsb2NhbFN0cnVjdHVyZS50b3RhbEZpbGVzICsgXG4gICAgICAgICAgICAgICAgICAgICAgZWMyU3RydWN0dXJlLnRvdGFsRGlyZWN0b3JpZXMgKyBlYzJTdHJ1Y3R1cmUudG90YWxGaWxlcztcbiAgICBcbiAgICBjb25zdCBtYXRjaGluZ0l0ZW1zID0gdG90YWxJdGVtcyAtIGRpZmZlcmVuY2VzLmxlbmd0aDtcbiAgICBjb25zdCBwcm9jZXNzaW5nVGltZSA9IERhdGUubm93KCkgLSBzdGFydFRpbWU7XG5cbiAgICAvLyDph43opoHluqbliKXntbHoqIhcbiAgICBjb25zdCBzZXZlcml0eVN0YXRzOiBSZWNvcmQ8c3RyaW5nLCBudW1iZXI+ID0geyBsb3c6IDAsIG1lZGl1bTogMCwgaGlnaDogMCwgY3JpdGljYWw6IDAgfTtcbiAgICBkaWZmZXJlbmNlcy5mb3JFYWNoKGRpZmYgPT4ge1xuICAgICAgc2V2ZXJpdHlTdGF0c1tkaWZmLnNldmVyaXR5XSsrO1xuICAgIH0pO1xuXG4gICAgLy8g44K/44Kk44OX5Yil57Wx6KiIXG4gICAgY29uc3QgdHlwZVN0YXRzOiBSZWNvcmQ8c3RyaW5nLCBudW1iZXI+ID0ge307XG4gICAgZGlmZmVyZW5jZXMuZm9yRWFjaChkaWZmID0+IHtcbiAgICAgIHR5cGVTdGF0c1tkaWZmLnR5cGVdID0gKHR5cGVTdGF0c1tkaWZmLnR5cGVdIHx8IDApICsgMTtcbiAgICB9KTtcblxuICAgIHJldHVybiB7XG4gICAgICB0b3RhbEl0ZW1zLFxuICAgICAgbWF0Y2hpbmdJdGVtcyxcbiAgICAgIGRpZmZlcmVuY2VJdGVtczogZGlmZmVyZW5jZXMubGVuZ3RoLFxuICAgICAgc2V2ZXJpdHlTdGF0cyxcbiAgICAgIHR5cGVTdGF0cyxcbiAgICAgIHByb2Nlc3NpbmdUaW1lXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiDjgrnjgq3jg4Pjg5fjgZnjgbnjgY3jg4fjgqPjg6zjgq/jg4jjg6rjgYvjganjgYbjgYvliKTlrppcbiAgICovXG4gIHByaXZhdGUgc2hvdWxkU2tpcERpcmVjdG9yeShkaXJOYW1lOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICBjb25zdCBza2lwRGlycyA9IFtcbiAgICAgICdub2RlX21vZHVsZXMnLFxuICAgICAgJy5naXQnLFxuICAgICAgJy52c2NvZGUnLFxuICAgICAgJy5pZGVhJyxcbiAgICAgICdjZGsub3V0JyxcbiAgICAgICdkaXN0JyxcbiAgICAgICdidWlsZCcsXG4gICAgICAnLm5leHQnLFxuICAgICAgJ2NvdmVyYWdlJyxcbiAgICAgICcubnljX291dHB1dCdcbiAgICBdO1xuICAgIFxuICAgIHJldHVybiBza2lwRGlycy5pbmNsdWRlcyhkaXJOYW1lKSB8fCBkaXJOYW1lLnN0YXJ0c1dpdGgoJy4nKTtcbiAgfVxuXG4gIC8qKlxuICAgKiDmp4vpgKDmr5TovIPjg6zjg53jg7zjg4jjgpLnlJ/miJBcbiAgICovXG4gIHB1YmxpYyBnZW5lcmF0ZUNvbXBhcmlzb25SZXBvcnQoY29tcGFyaXNvbjogU3RydWN0dXJlQ29tcGFyaXNvbik6IHN0cmluZyB7XG4gICAgY29uc3QgeyBzdW1tYXJ5LCBkaWZmZXJlbmNlcywgbWF0Y2hQZXJjZW50YWdlIH0gPSBjb21wYXJpc29uO1xuICAgIFxuICAgIC8vIOmHjeimgeW6puWIpee1seioiFxuICAgIGNvbnN0IHNldmVyaXR5U3RhdHMgPSBPYmplY3QuZW50cmllcyhzdW1tYXJ5LnNldmVyaXR5U3RhdHMpXG4gICAgICAubWFwKChbbGV2ZWwsIGNvdW50XSkgPT4gYC0gKioke2xldmVsLnRvVXBwZXJDYXNlKCl9Kio6ICR7Y291bnR95Lu2YClcbiAgICAgIC5qb2luKCdcXG4nKTtcblxuICAgIC8vIOOCv+OCpOODl+WIpee1seioiFxuICAgIGNvbnN0IHR5cGVTdGF0cyA9IE9iamVjdC5lbnRyaWVzKHN1bW1hcnkudHlwZVN0YXRzKVxuICAgICAgLm1hcCgoW3R5cGUsIGNvdW50XSkgPT4gYC0gKioke3R5cGV9Kio6ICR7Y291bnR95Lu2YClcbiAgICAgIC5qb2luKCdcXG4nKTtcblxuICAgIC8vIOmHjeimgeOBquW3ruWIhuOBruODquOCueODiFxuICAgIGNvbnN0IGNyaXRpY2FsRGlmZmVyZW5jZXMgPSBkaWZmZXJlbmNlc1xuICAgICAgLmZpbHRlcihkID0+IGQuc2V2ZXJpdHkgPT09ICdjcml0aWNhbCcgfHwgZC5zZXZlcml0eSA9PT0gJ2hpZ2gnKVxuICAgICAgLnNsaWNlKDAsIDEwKVxuICAgICAgLm1hcChkID0+IGAtICoqJHtkLnBhdGh9Kio6ICR7ZC5kZXRhaWxzLmRlc2NyaXB0aW9ufWApXG4gICAgICAuam9pbignXFxuJyk7XG5cbiAgICByZXR1cm4gYFxuIyDnkrDlooPplpPmp4vpgKDmr5TovIPjg6zjg53jg7zjg4hcblxuIyMg5q+U6LyD44K144Oe44Oq44O8XG4tICoq5q+U6LyD5pel5pmCKio6ICR7Y29tcGFyaXNvbi5jb21wYXJpc29uVGltZS50b0xvY2FsZVN0cmluZygnamEtSlAnKX1cbi0gKirmr5TovINJRCoqOiAke2NvbXBhcmlzb24uY29tcGFyaXNvbklkfVxuLSAqKuS4gOiHtOeOhyoqOiAke21hdGNoUGVyY2VudGFnZS50b0ZpeGVkKDEpfSVcbi0gKirnt4/poIXnm67mlbAqKjogJHtzdW1tYXJ5LnRvdGFsSXRlbXN95YCLXG4tICoq5LiA6Ie06aCF55uuKio6ICR7c3VtbWFyeS5tYXRjaGluZ0l0ZW1zfeWAi1xuLSAqKuW3ruWIhumgheebrioqOiAke3N1bW1hcnkuZGlmZmVyZW5jZUl0ZW1zfeWAi1xuLSAqKuWHpueQhuaZgumWkyoqOiAke01hdGgucm91bmQoc3VtbWFyeS5wcm9jZXNzaW5nVGltZSAvIDEwMDApfeenklxuXG4jIyDnkrDlooPliKXntbHoqIhcbiMjIyDjg63jg7zjgqvjg6vnkrDlooNcbi0gKirjg4fjgqPjg6zjgq/jg4jjg6rmlbAqKjogJHtjb21wYXJpc29uLmxvY2FsU3RydWN0dXJlLnRvdGFsRGlyZWN0b3JpZXN95YCLXG4tICoq44OV44Kh44Kk44Or5pWwKio6ICR7Y29tcGFyaXNvbi5sb2NhbFN0cnVjdHVyZS50b3RhbEZpbGVzfeWAi1xuLSAqKuODq+ODvOODiOODkeOCuSoqOiAke2NvbXBhcmlzb24ubG9jYWxTdHJ1Y3R1cmUucm9vdFBhdGh9XG5cbiMjIyBFQzLnkrDlooNcbi0gKirjg4fjgqPjg6zjgq/jg4jjg6rmlbAqKjogJHtjb21wYXJpc29uLmVjMlN0cnVjdHVyZS50b3RhbERpcmVjdG9yaWVzfeWAi1xuLSAqKuODleOCoeOCpOODq+aVsCoqOiAke2NvbXBhcmlzb24uZWMyU3RydWN0dXJlLnRvdGFsRmlsZXN95YCLXG4tICoq44Or44O844OI44OR44K5Kio6ICR7Y29tcGFyaXNvbi5lYzJTdHJ1Y3R1cmUucm9vdFBhdGh9XG5cbiMjIOW3ruWIhue1seioiFxuIyMjIOmHjeimgeW6puWIpVxuJHtzZXZlcml0eVN0YXRzIHx8ICctIOW3ruWIhuOBquOBlyd9XG5cbiMjIyDjgr/jgqTjg5fliKVcbiR7dHlwZVN0YXRzIHx8ICctIOW3ruWIhuOBquOBlyd9XG5cbiMjIOmHjeimgeOBquW3ruWIhu+8iOS4iuS9jTEw5Lu277yJXG4ke2NyaXRpY2FsRGlmZmVyZW5jZXMgfHwgJy0g6YeN6KaB44Gq5beu5YiG44Gq44GXJ31cblxuIyMg5o6o5aWo44Ki44Kv44K344On44OzXG4ke3N1bW1hcnkuZGlmZmVyZW5jZUl0ZW1zID09PSAwID8gXG4gICctIOS4oeeSsOWig+OBruani+mAoOOBr+WujOWFqOOBq+S4gOiHtOOBl+OBpuOBhOOBvuOBmeOAgue2mee2mueahOOBquebo+imluOCkuaOqOWlqOOBl+OBvuOBmeOAgicgOlxuICBgLSAke3N1bW1hcnkuZGlmZmVyZW5jZUl0ZW1zfeWAi+OBruW3ruWIhuOBjOaknOWHuuOBleOCjOOBvuOBl+OBn+OAguWQjOacn+WHpueQhuOBruWun+ihjOOCkuaknOiojuOBl+OBpuOBj+OBoOOBleOBhOOAgmBcbn1cblxuJHtzdW1tYXJ5LnNldmVyaXR5U3RhdHMuY3JpdGljYWwgPiAwID8gXG4gIGBcXG7imqDvuI8gKirnt4rmgKUqKjogJHtzdW1tYXJ5LnNldmVyaXR5U3RhdHMuY3JpdGljYWx95YCL44Gu6YeN6KaB44Gq5qeL6YCg5ZWP6aGM44GM44GC44KK44G+44GZ44CC5Y2z5bqn44Gr5a++5b+c44GX44Gm44GP44Gg44GV44GE44CCYCA6ICcnXG59XG5cbiMjIOODkeODleOCqeODvOODnuODs+OCuee1seioiFxuLSAqKuOCueOCreODo+ODs+WKueeOhyoqOiAke01hdGgucm91bmQoc3VtbWFyeS50b3RhbEl0ZW1zIC8gKHN1bW1hcnkucHJvY2Vzc2luZ1RpbWUgLyAxMDAwKSl96aCF55uuL+enklxuLSAqKuW5s+Wdh+WHpueQhuaZgumWkyoqOiAke01hdGgucm91bmQoc3VtbWFyeS5wcm9jZXNzaW5nVGltZSAvIHN1bW1hcnkudG90YWxJdGVtcyl9bXMv6aCF55uuXG5gO1xuICB9XG5cbiAgLyoqXG4gICAqIFNTSCDjgrPjg57jg7Pjg4njgpLlrp/ooYxcbiAgICovXG4gIHByaXZhdGUgYXN5bmMgZXhlY3V0ZVNTSENvbW1hbmQoY29tbWFuZDogc3RyaW5nKTogUHJvbWlzZTx7IHN0ZG91dDogc3RyaW5nOyBzdGRlcnI6IHN0cmluZyB9PiB7XG4gICAgaWYgKCF0aGlzLnNzaENvbmZpZykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdTU0joqK3lrprjgYzlv4XopoHjgafjgZknKTtcbiAgICB9XG5cbiAgICBjb25zdCBzc2hDb21tYW5kID0gYHNzaCAtaSBcIiR7dGhpcy5zc2hDb25maWcua2V5UGF0aH1cIiAtbyBDb25uZWN0VGltZW91dD0ke3RoaXMuc3NoQ29uZmlnLnRpbWVvdXQhIC8gMTAwMH0gLW8gU3RyaWN0SG9zdEtleUNoZWNraW5nPW5vIC1wICR7dGhpcy5zc2hDb25maWcucG9ydH0gJHt0aGlzLnNzaENvbmZpZy51c2VyfUAke3RoaXMuc3NoQ29uZmlnLmhvc3R9IFwiJHtjb21tYW5kfVwiYDtcbiAgICBcbiAgICB0cnkge1xuICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgZXhlY0FzeW5jKHNzaENvbW1hbmQsIHsgXG4gICAgICAgIHRpbWVvdXQ6IHRoaXMuc3NoQ29uZmlnLnRpbWVvdXQsXG4gICAgICAgIG1heEJ1ZmZlcjogMTAyNCAqIDEwMjQgKiAxMCAvLyAxME1CXG4gICAgICB9KTtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgaWYgKGVycm9yLmNvZGUgPT09ICdFVElNRURPVVQnKSB7XG4gICAgICAgIHRocm93IG5ldyBPcmdhbml6YXRpb25FcnJvcihcbiAgICAgICAgICBPcmdhbml6YXRpb25FcnJvclR5cGUuU1NIX0NPTk5FQ1RJT05fRkFJTEVELFxuICAgICAgICAgIGBTU0jmjqXntprjgYzjgr/jgqTjg6DjgqLjgqbjg4jjgZfjgb7jgZfjgZ86ICR7dGhpcy5zc2hDb25maWcuaG9zdH1gLFxuICAgICAgICAgIHVuZGVmaW5lZCxcbiAgICAgICAgICAnZWMyJyxcbiAgICAgICAgICBlcnJvclxuICAgICAgICApO1xuICAgICAgfVxuICAgICAgdGhyb3cgZXJyb3I7XG4gICAgfVxuICB9XG59Il19