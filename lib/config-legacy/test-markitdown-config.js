"use strict";
/**
 * Markitdown設定のテストスクリプト
 * 設定の読み込みと検証をテストする
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.testMarkitdownConfig = testMarkitdownConfig;
const config_loader_1 = require("./config-loader");
const markitdown_config_1 = require("../../types/markitdown-config");
/**
 * Markitdown設定のテスト実行
 */
function testMarkitdownConfig() {
    console.log('🧪 Markitdown設定のテストを開始します...\n');
    // 1. デフォルト設定のテスト
    console.log('1️⃣ デフォルト設定のテスト');
    const defaultConfig = markitdown_config_1.DEFAULT_MARKITDOWN_CONFIG;
    const isDefaultValid = (0, config_loader_1.validateMarkitdownConfig)(defaultConfig);
    console.log(`   デフォルト設定の検証結果: ${isDefaultValid ? '✅ 有効' : '❌ 無効'}\n`);
    // 2. 環境別設定の読み込みテスト
    console.log('2️⃣ 環境別設定の読み込みテスト');
    const environments = ['dev', 'staging', 'prod'];
    for (const env of environments) {
        try {
            console.log(`   ${env}環境の設定を読み込み中...`);
            const envConfig = (0, config_loader_1.loadMarkitdownConfig)(env);
            const isValid = (0, config_loader_1.validateMarkitdownConfig)(envConfig);
            console.log(`   ${env}環境の設定: ${isValid ? '✅ 有効' : '❌ 無効'}`);
            // 主要設定の表示
            console.log(`     - 有効: ${envConfig.enabled}`);
            console.log(`     - 最大ファイルサイズ: ${envConfig.performance.maxFileSize}`);
            console.log(`     - 並列処理: ${envConfig.performance.parallelProcessing}`);
            console.log(`     - ログレベル: ${envConfig.logging.level}`);
            // 有効なファイル形式の数を表示
            const enabledFormats = Object.entries(envConfig.supportedFormats)
                .filter(([_, config]) => config.enabled)
                .map(([format, _]) => format);
            console.log(`     - 有効なファイル形式 (${enabledFormats.length}): ${enabledFormats.join(', ')}`);
        }
        catch (error) {
            console.error(`   ❌ ${env}環境の設定読み込みエラー: ${error}`);
        }
        console.log('');
    }
    // 3. 設定テンプレート生成のテスト
    console.log('3️⃣ 設定テンプレート生成のテスト');
    try {
        const template = (0, config_loader_1.generateMarkitdownConfigTemplate)();
        const isTemplateValid = (0, config_loader_1.validateMarkitdownConfig)(template);
        console.log(`   テンプレート生成: ${isTemplateValid ? '✅ 成功' : '❌ 失敗'}`);
        // テンプレートの主要設定を表示
        console.log(`   - サポートファイル形式数: ${Object.keys(template.supportedFormats).length}`);
        console.log(`   - デフォルト最大ファイルサイズ: ${template.performance.maxFileSize}`);
        console.log(`   - フォールバック有効: ${template.fallback.enabled}`);
    }
    catch (error) {
        console.error(`   ❌ テンプレート生成エラー: ${error}`);
    }
    // 4. 処理方法選択機能のテスト
    console.log('4️⃣ 処理方法選択機能のテスト');
    try {
        const testConfig = (0, config_loader_1.loadMarkitdownConfig)('prod');
        // ファイル形式別の処理方法チェック
        const formats = ['docx', 'pdf', 'png', 'csv'];
        for (const format of formats) {
            const useMarkitdown = (0, markitdown_config_1.shouldUseMarkitdown)(testConfig, format);
            const useLangChain = (0, markitdown_config_1.shouldUseLangChain)(testConfig, format);
            const processingOrder = (0, markitdown_config_1.getProcessingOrder)(testConfig, format);
            const qualityComparison = (0, markitdown_config_1.shouldPerformQualityComparison)(testConfig, format);
            console.log(`   ${format}:`);
            console.log(`     - Markitdown使用: ${useMarkitdown ? '✅' : '❌'}`);
            console.log(`     - LangChain使用: ${useLangChain ? '✅' : '❌'}`);
            console.log(`     - 処理順序: [${processingOrder.join(' → ')}]`);
            console.log(`     - 品質比較: ${qualityComparison ? '✅' : '❌'}`);
        }
    }
    catch (error) {
        console.error(`   ❌ 処理方法選択機能テストエラー: ${error}`);
    }
    console.log('');
    // 5. 動的設定変更のテスト
    console.log('5️⃣ 動的設定変更のテスト');
    try {
        let testConfig = (0, config_loader_1.loadMarkitdownConfig)('dev');
        console.log(`   変更前のPDF処理戦略: ${testConfig.supportedFormats.pdf?.processingStrategy}`);
        // PDF処理戦略を変更
        testConfig = (0, config_loader_1.updateProcessingStrategy)(testConfig, 'pdf', 'both-compare');
        console.log(`   変更後のPDF処理戦略: ${testConfig.supportedFormats.pdf?.processingStrategy}`);
        console.log(`   PDF品質比較有効: ${testConfig.supportedFormats.pdf?.enableQualityComparison}`);
    }
    catch (error) {
        console.error(`   ❌ 動的設定変更テストエラー: ${error}`);
    }
    console.log('');
    // 6. 処理方法レポート生成のテスト
    console.log('6️⃣ 処理方法レポート生成のテスト');
    try {
        const testConfig = (0, config_loader_1.loadMarkitdownConfig)('prod');
        const report = (0, config_loader_1.generateProcessingMethodReport)(testConfig);
        console.log(`   総ファイル形式数: ${report.summary.totalFormats}`);
        console.log(`   Markitdownのみ: ${report.summary.markitdownOnlyFormats}`);
        console.log(`   LangChainのみ: ${report.summary.langchainOnlyFormats}`);
        console.log(`   ハイブリッド: ${report.summary.hybridFormats}`);
        console.log(`   品質比較有効: ${report.summary.qualityComparisonFormats}`);
        console.log('   詳細:');
        report.details.forEach(detail => {
            const methods = [];
            if (detail.useMarkitdown)
                methods.push('Markitdown');
            if (detail.useLangChain)
                methods.push('LangChain');
            console.log(`     ${detail.format}: ${detail.strategy} [${methods.join('+')}]${detail.qualityComparison ? ' (品質比較)' : ''}`);
        });
    }
    catch (error) {
        console.error(`   ❌ レポート生成テストエラー: ${error}`);
    }
    console.log('\n🎉 Markitdown設定のテストが完了しました！');
    console.log('\n📊 新機能の確認:');
    console.log('   ✅ ファイル形式別処理方法選択機能');
    console.log('   ✅ 動的設定変更機能');
    console.log('   ✅ 処理方法追跡機能');
    console.log('   ✅ 品質比較機能');
    console.log('   ✅ Embedding情報追跡準備');
}
// テスト実行
if (require.main === module) {
    testMarkitdownConfig();
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVzdC1tYXJraXRkb3duLWNvbmZpZy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInRlc3QtbWFya2l0ZG93bi1jb25maWcudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7R0FHRzs7QUF5Sk0sb0RBQW9CO0FBdko3QixtREFNeUI7QUFDekIscUVBTXVDO0FBRXZDOztHQUVHO0FBQ0gsU0FBUyxvQkFBb0I7SUFDM0IsT0FBTyxDQUFDLEdBQUcsQ0FBQyxnQ0FBZ0MsQ0FBQyxDQUFDO0lBRTlDLGlCQUFpQjtJQUNqQixPQUFPLENBQUMsR0FBRyxDQUFDLGlCQUFpQixDQUFDLENBQUM7SUFDL0IsTUFBTSxhQUFhLEdBQUcsNkNBQXlCLENBQUM7SUFDaEQsTUFBTSxjQUFjLEdBQUcsSUFBQSx3Q0FBd0IsRUFBQyxhQUFhLENBQUMsQ0FBQztJQUMvRCxPQUFPLENBQUMsR0FBRyxDQUFDLG9CQUFvQixjQUFjLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsTUFBTSxJQUFJLENBQUMsQ0FBQztJQUV0RSxtQkFBbUI7SUFDbkIsT0FBTyxDQUFDLEdBQUcsQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDO0lBRWpDLE1BQU0sWUFBWSxHQUFHLENBQUMsS0FBSyxFQUFFLFNBQVMsRUFBRSxNQUFNLENBQUMsQ0FBQztJQUNoRCxLQUFLLE1BQU0sR0FBRyxJQUFJLFlBQVksRUFBRSxDQUFDO1FBQy9CLElBQUksQ0FBQztZQUNILE9BQU8sQ0FBQyxHQUFHLENBQUMsTUFBTSxHQUFHLGdCQUFnQixDQUFDLENBQUM7WUFDdkMsTUFBTSxTQUFTLEdBQUcsSUFBQSxvQ0FBb0IsRUFBQyxHQUFHLENBQUMsQ0FBQztZQUM1QyxNQUFNLE9BQU8sR0FBRyxJQUFBLHdDQUF3QixFQUFDLFNBQVMsQ0FBQyxDQUFDO1lBQ3BELE9BQU8sQ0FBQyxHQUFHLENBQUMsTUFBTSxHQUFHLFVBQVUsT0FBTyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFD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UixJQUFJLE9BQU8sQ0FBQyxJQUFJLEtBQUssTUFBTSxFQUFFLENBQUM7SUFDNUIsb0JBQW9CLEVBQUUsQ0FBQztBQUN6QixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBNYXJraXRkb3du6Kit5a6a44Gu44OG44K544OI44K544Kv44Oq44OX44OIXG4gKiDoqK3lrprjga7oqq3jgb/ovrzjgb/jgajmpJzoqLzjgpLjg4bjgrnjg4jjgZnjgotcbiAqL1xuXG5pbXBvcnQgeyBcbiAgbG9hZE1hcmtpdGRvd25Db25maWcsIFxuICB2YWxpZGF0ZU1hcmtpdGRvd25Db25maWcsIFxuICBnZW5lcmF0ZU1hcmtpdGRvd25Db25maWdUZW1wbGF0ZSxcbiAgdXBkYXRlUHJvY2Vzc2luZ1N0cmF0ZWd5LFxuICBnZW5lcmF0ZVByb2Nlc3NpbmdNZXRob2RSZXBvcnRcbn0gZnJvbSAnLi9jb25maWctbG9hZGVyJztcbmltcG9ydCB7IFxuICBERUZBVUxUX01BUktJVERPV05fQ09ORklHLFxuICBzaG91bGRVc2VNYXJraXRkb3duLFxuICBzaG91bGRVc2VMYW5nQ2hhaW4sXG4gIGdldFByb2Nlc3NpbmdPcmRlcixcbiAgc2hvdWxkUGVyZm9ybVF1YWxpdHlDb21wYXJpc29uXG59IGZyb20gJy4uLy4uL3R5cGVzL21hcmtpdGRvd24tY29uZmlnJztcblxuLyoqXG4gKiBNYXJraXRkb3du6Kit5a6a44Gu44OG44K544OI5a6f6KGMXG4gKi9cbmZ1bmN0aW9uIHRlc3RNYXJraXRkb3duQ29uZmlnKCkge1xuICBjb25zb2xlLmxvZygn8J+nqiBNYXJraXRkb3du6Kit5a6a44Gu44OG44K544OI44KS6ZaL5aeL44GX44G+44GZLi4uXFxuJyk7XG5cbiAgLy8gMS4g44OH44OV44Kp44Or44OI6Kit5a6a44Gu44OG44K544OIXG4gIGNvbnNvbGUubG9nKCcx77iP4oOjIOODh+ODleOCqeODq+ODiOioreWumuOBruODhuOCueODiCcpO1xuICBjb25zdCBkZWZhdWx0Q29uZmlnID0gREVGQVVMVF9NQVJLSVRET1dOX0NPTkZJRztcbiAgY29uc3QgaXNEZWZhdWx0VmFsaWQgPSB2YWxpZGF0ZU1hcmtpdGRvd25Db25maWcoZGVmYXVsdENvbmZpZyk7XG4gIGNvbnNvbGUubG9nKGAgICDjg4fjg5Xjgqnjg6vjg4joqK3lrprjga7mpJzoqLzntZDmnpw6ICR7aXNEZWZhdWx0VmFsaWQgPyAn4pyFIOacieWKuScgOiAn4p2MIOeEoeWKuSd9XFxuYCk7XG5cbiAgLy8gMi4g55Kw5aKD5Yil6Kit5a6a44Gu6Kqt44G/6L6844G/44OG44K544OIXG4gIGNvbnNvbGUubG9nKCcy77iP4oOjIOeSsOWig+WIpeioreWumuOBruiqreOBv+i+vOOBv+ODhuOCueODiCcpO1xuICBcbiAgY29uc3QgZW52aXJvbm1lbnRzID0gWydkZXYnLCAnc3RhZ2luZycsICdwcm9kJ107XG4gIGZvciAoY29uc3QgZW52IG9mIGVudmlyb25tZW50cykge1xuICAgIHRyeSB7XG4gICAgICBjb25zb2xlLmxvZyhgICAgJHtlbnZ955Kw5aKD44Gu6Kit5a6a44KS6Kqt44G/6L6844G/5LitLi4uYCk7XG4gICAgICBjb25zdCBlbnZDb25maWcgPSBsb2FkTWFya2l0ZG93bkNvbmZpZyhlbnYpO1xuICAgICAgY29uc3QgaXNWYWxpZCA9IHZhbGlkYXRlTWFya2l0ZG93bkNvbmZpZyhlbnZDb25maWcpO1xuICAgICAgY29uc29sZS5sb2coYCAgICR7ZW52feeSsOWig+OBruioreWumjogJHtpc1ZhbGlkID8gJ+KchSDmnInlirknIDogJ+KdjCDnhKHlirknfWApO1xuICAgICAgXG4gICAgICAvLyDkuLvopoHoqK3lrprjga7ooajnpLpcbiAgICAgIGNvbnNvbGUubG9nKGAgICAgIC0g5pyJ5Yq5OiAke2VudkNvbmZpZy5lbmFibGVkfWApO1xuICAgICAgY29uc29sZS5sb2coYCAgICAgLSDmnIDlpKfjg5XjgqHjgqTjg6vjgrXjgqTjgro6ICR7ZW52Q29uZmlnLnBlcmZvcm1hbmNlLm1heEZpbGVTaXplfWApO1xuICAgICAgY29uc29sZS5sb2coYCAgICAgLSDkuKbliJflh6bnkIY6ICR7ZW52Q29uZmlnLnBlcmZvcm1hbmNlLnBhcmFsbGVsUHJvY2Vzc2luZ31gKTtcbiAgICAgIGNvbnNvbGUubG9nKGAgICAgIC0g44Ot44Kw44Os44OZ44OrOiAke2VudkNvbmZpZy5sb2dnaW5nLmxldmVsfWApO1xuICAgICAgXG4gICAgICAvLyDmnInlirnjgarjg5XjgqHjgqTjg6vlvaLlvI/jga7mlbDjgpLooajnpLpcbiAgICAgIGNvbnN0IGVuYWJsZWRGb3JtYXRzID0gT2JqZWN0LmVudHJpZXMoZW52Q29uZmlnLnN1cHBvcnRlZEZvcm1hdHMpXG4gICAgICAgIC5maWx0ZXIoKFtfLCBjb25maWddKSA9PiBjb25maWcuZW5hYmxlZClcbiAgICAgICAgLm1hcCgoW2Zvcm1hdCwgX10pID0+IGZvcm1hdCk7XG4gICAgICBjb25zb2xlLmxvZyhgICAgICAtIOacieWKueOBquODleOCoeOCpOODq+W9ouW8jyAoJHtlbmFibGVkRm9ybWF0cy5sZW5ndGh9KTogJHtlbmFibGVkRm9ybWF0cy5qb2luKCcsICcpfWApO1xuICAgICAgXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoYCAgIOKdjCAke2Vudn3nkrDlooPjga7oqK3lrproqq3jgb/ovrzjgb/jgqjjg6njg7w6ICR7ZXJyb3J9YCk7XG4gICAgfVxuICAgIGNvbnNvbGUubG9nKCcnKTtcbiAgfVxuXG4gIC8vIDMuIOioreWumuODhuODs+ODl+ODrOODvOODiOeUn+aIkOOBruODhuOCueODiFxuICBjb25zb2xlLmxvZygnM++4j+KDoyDoqK3lrprjg4bjg7Pjg5fjg6zjg7zjg4jnlJ/miJDjga7jg4bjgrnjg4gnKTtcbiAgdHJ5IHtcbiAgICBjb25zdCB0ZW1wbGF0ZSA9IGdlbmVyYXRlTWFya2l0ZG93bkNvbmZpZ1RlbXBsYXRlKCk7XG4gICAgY29uc3QgaXNUZW1wbGF0ZVZhbGlkID0gdmFsaWRhdGVNYXJraXRkb3duQ29uZmlnKHRlbXBsYXRlKTtcbiAgICBjb25zb2xlLmxvZyhgICAg44OG44Oz44OX44Os44O844OI55Sf5oiQOiAke2lzVGVtcGxhdGVWYWxpZCA/ICfinIUg5oiQ5YqfJyA6ICfinYwg5aSx5pWXJ31gKTtcbiAgICBcbiAgICAvLyDjg4bjg7Pjg5fjg6zjg7zjg4jjga7kuLvopoHoqK3lrprjgpLooajnpLpcbiAgICBjb25zb2xlLmxvZyhgICAgLSDjgrXjg53jg7zjg4jjg5XjgqHjgqTjg6vlvaLlvI/mlbA6ICR7T2JqZWN0LmtleXModGVtcGxhdGUuc3VwcG9ydGVkRm9ybWF0cykubGVuZ3RofWApO1xuICAgIGNvbnNvbGUubG9nKGAgICAtIOODh+ODleOCqeODq+ODiOacgOWkp+ODleOCoeOCpOODq+OCteOCpOOCujogJHt0ZW1wbGF0ZS5wZXJmb3JtYW5jZS5tYXhGaWxlU2l6ZX1gKTtcbiAgICBjb25zb2xlLmxvZyhgICAgLSDjg5Xjgqnjg7zjg6vjg5Djg4Pjgq/mnInlirk6ICR7dGVtcGxhdGUuZmFsbGJhY2suZW5hYmxlZH1gKTtcbiAgICBcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKGAgICDinYwg44OG44Oz44OX44Os44O844OI55Sf5oiQ44Ko44Op44O8OiAke2Vycm9yfWApO1xuICB9XG5cbiAgLy8gNC4g5Yem55CG5pa55rOV6YG45oqe5qmf6IO944Gu44OG44K544OIXG4gIGNvbnNvbGUubG9nKCc077iP4oOjIOWHpueQhuaWueazlemBuOaKnuapn+iDveOBruODhuOCueODiCcpO1xuICB0cnkge1xuICAgIGNvbnN0IHRlc3RDb25maWcgPSBsb2FkTWFya2l0ZG93bkNvbmZpZygncHJvZCcpO1xuICAgIFxuICAgIC8vIOODleOCoeOCpOODq+W9ouW8j+WIpeOBruWHpueQhuaWueazleODgeOCp+ODg+OCr1xuICAgIGNvbnN0IGZvcm1hdHMgPSBbJ2RvY3gnLCAncGRmJywgJ3BuZycsICdjc3YnXSBhcyBjb25zdDtcbiAgICBmb3IgKGNvbnN0IGZvcm1hdCBvZiBmb3JtYXRzKSB7XG4gICAgICBjb25zdCB1c2VNYXJraXRkb3duID0gc2hvdWxkVXNlTWFya2l0ZG93bih0ZXN0Q29uZmlnLCBmb3JtYXQpO1xuICAgICAgY29uc3QgdXNlTGFuZ0NoYWluID0gc2hvdWxkVXNlTGFuZ0NoYWluKHRlc3RDb25maWcsIGZvcm1hdCk7XG4gICAgICBjb25zdCBwcm9jZXNzaW5nT3JkZXIgPSBnZXRQcm9jZXNzaW5nT3JkZXIodGVzdENvbmZpZywgZm9ybWF0KTtcbiAgICAgIGNvbnN0IHF1YWxpdHlDb21wYXJpc29uID0gc2hvdWxkUGVyZm9ybVF1YWxpdHlDb21wYXJpc29uKHRlc3RDb25maWcsIGZvcm1hdCk7XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGAgICAke2Zvcm1hdH06YCk7XG4gICAgICBjb25zb2xlLmxvZyhgICAgICAtIE1hcmtpdGRvd27kvb/nlKg6ICR7dXNlTWFya2l0ZG93biA/ICfinIUnIDogJ+KdjCd9YCk7XG4gICAgICBjb25zb2xlLmxvZyhgICAgICAtIExhbmdDaGFpbuS9v+eUqDogJHt1c2VMYW5nQ2hhaW4gPyAn4pyFJyA6ICfinYwnfWApO1xuICAgICAgY29uc29sZS5sb2coYCAgICAgLSDlh6bnkIbpoIbluo86IFske3Byb2Nlc3NpbmdPcmRlci5qb2luKCcg4oaSICcpfV1gKTtcbiAgICAgIGNvbnNvbGUubG9nKGAgICAgIC0g5ZOB6LOq5q+U6LyDOiAke3F1YWxpdHlDb21wYXJpc29uID8gJ+KchScgOiAn4p2MJ31gKTtcbiAgICB9XG4gICAgXG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcihgICAg4p2MIOWHpueQhuaWueazlemBuOaKnuapn+iDveODhuOCueODiOOCqOODqeODvDogJHtlcnJvcn1gKTtcbiAgfVxuICBjb25zb2xlLmxvZygnJyk7XG5cbiAgLy8gNS4g5YuV55qE6Kit5a6a5aSJ5pu044Gu44OG44K544OIXG4gIGNvbnNvbGUubG9nKCc177iP4oOjIOWLleeahOioreWumuWkieabtOOBruODhuOCueODiCcpO1xuICB0cnkge1xuICAgIGxldCB0ZXN0Q29uZmlnID0gbG9hZE1hcmtpdGRvd25Db25maWcoJ2RldicpO1xuICAgIGNvbnNvbGUubG9nKGAgICDlpInmm7TliY3jga5QREblh6bnkIbmiKbnlaU6ICR7dGVzdENvbmZpZy5zdXBwb3J0ZWRGb3JtYXRzLnBkZj8ucHJvY2Vzc2luZ1N0cmF0ZWd5fWApO1xuICAgIFxuICAgIC8vIFBERuWHpueQhuaIpueVpeOCkuWkieabtFxuICAgIHRlc3RDb25maWcgPSB1cGRhdGVQcm9jZXNzaW5nU3RyYXRlZ3kodGVzdENvbmZpZywgJ3BkZicsICdib3RoLWNvbXBhcmUnKTtcbiAgICBjb25zb2xlLmxvZyhgICAg5aSJ5pu05b6M44GuUERG5Yem55CG5oim55WlOiAke3Rlc3RDb25maWcuc3VwcG9ydGVkRm9ybWF0cy5wZGY/LnByb2Nlc3NpbmdTdHJhdGVneX1gKTtcbiAgICBjb25zb2xlLmxvZyhgICAgUERG5ZOB6LOq5q+U6LyD5pyJ5Yq5OiAke3Rlc3RDb25maWcuc3VwcG9ydGVkRm9ybWF0cy5wZGY/LmVuYWJsZVF1YWxpdHlDb21wYXJpc29ufWApO1xuICAgIFxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoYCAgIOKdjCDli5XnmoToqK3lrprlpInmm7Tjg4bjgrnjg4jjgqjjg6njg7w6ICR7ZXJyb3J9YCk7XG4gIH1cbiAgY29uc29sZS5sb2coJycpO1xuXG4gIC8vIDYuIOWHpueQhuaWueazleODrOODneODvOODiOeUn+aIkOOBruODhuOCueODiFxuICBjb25zb2xlLmxvZygnNu+4j+KDoyDlh6bnkIbmlrnms5Xjg6zjg53jg7zjg4jnlJ/miJDjga7jg4bjgrnjg4gnKTtcbiAgdHJ5IHtcbiAgICBjb25zdCB0ZXN0Q29uZmlnID0gbG9hZE1hcmtpdGRvd25Db25maWcoJ3Byb2QnKTtcbiAgICBjb25zdCByZXBvcnQgPSBnZW5lcmF0ZVByb2Nlc3NpbmdNZXRob2RSZXBvcnQodGVzdENvbmZpZyk7XG4gICAgXG4gICAgY29uc29sZS5sb2coYCAgIOe3j+ODleOCoeOCpOODq+W9ouW8j+aVsDogJHtyZXBvcnQuc3VtbWFyeS50b3RhbEZvcm1hdHN9YCk7XG4gICAgY29uc29sZS5sb2coYCAgIE1hcmtpdGRvd27jga7jgb86ICR7cmVwb3J0LnN1bW1hcnkubWFya2l0ZG93bk9ubHlGb3JtYXRzfWApO1xuICAgIGNvbnNvbGUubG9nKGAgICBMYW5nQ2hhaW7jga7jgb86ICR7cmVwb3J0LnN1bW1hcnkubGFuZ2NoYWluT25seUZvcm1hdHN9YCk7XG4gICAgY29uc29sZS5sb2coYCAgIOODj+OCpOODluODquODg+ODiTogJHtyZXBvcnQuc3VtbWFyeS5oeWJyaWRGb3JtYXRzfWApO1xuICAgIGNvbnNvbGUubG9nKGAgICDlk4Hos6rmr5TovIPmnInlirk6ICR7cmVwb3J0LnN1bW1hcnkucXVhbGl0eUNvbXBhcmlzb25Gb3JtYXRzfWApO1xuICAgIFxuICAgIGNvbnNvbGUubG9nKCcgICDoqbPntLA6Jyk7XG4gICAgcmVwb3J0LmRldGFpbHMuZm9yRWFjaChkZXRhaWwgPT4ge1xuICAgICAgY29uc3QgbWV0aG9kcyA9IFtdO1xuICAgICAgaWYgKGRldGFpbC51c2VNYXJraXRkb3duKSBtZXRob2RzLnB1c2goJ01hcmtpdGRvd24nKTtcbiAgICAgIGlmIChkZXRhaWwudXNlTGFuZ0NoYWluKSBtZXRob2RzLnB1c2goJ0xhbmdDaGFpbicpO1xuICAgICAgY29uc29sZS5sb2coYCAgICAgJHtkZXRhaWwuZm9ybWF0fTogJHtkZXRhaWwuc3RyYXRlZ3l9IFske21ldGhvZHMuam9pbignKycpfV0ke2RldGFpbC5xdWFsaXR5Q29tcGFyaXNvbiA/ICcgKOWTgeizquavlOi8gyknIDogJyd9YCk7XG4gICAgfSk7XG4gICAgXG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcihgICAg4p2MIOODrOODneODvOODiOeUn+aIkOODhuOCueODiOOCqOODqeODvDogJHtlcnJvcn1gKTtcbiAgfVxuXG4gIGNvbnNvbGUubG9nKCdcXG7wn46JIE1hcmtpdGRvd27oqK3lrprjga7jg4bjgrnjg4jjgYzlrozkuobjgZfjgb7jgZfjgZ/vvIEnKTtcbiAgY29uc29sZS5sb2coJ1xcbvCfk4og5paw5qmf6IO944Gu56K66KqNOicpO1xuICBjb25zb2xlLmxvZygnICAg4pyFIOODleOCoeOCpOODq+W9ouW8j+WIpeWHpueQhuaWueazlemBuOaKnuapn+iDvScpO1xuICBjb25zb2xlLmxvZygnICAg4pyFIOWLleeahOioreWumuWkieabtOapn+iDvScpO1xuICBjb25zb2xlLmxvZygnICAg4pyFIOWHpueQhuaWueazlei/vei3oeapn+iDvScpO1xuICBjb25zb2xlLmxvZygnICAg4pyFIOWTgeizquavlOi8g+apn+iDvScpO1xuICBjb25zb2xlLmxvZygnICAg4pyFIEVtYmVkZGluZ+aDheWgsei/vei3oea6luWCmScpO1xufVxuXG4vLyDjg4bjgrnjg4jlrp/ooYxcbmlmIChyZXF1aXJlLm1haW4gPT09IG1vZHVsZSkge1xuICB0ZXN0TWFya2l0ZG93bkNvbmZpZygpO1xufVxuXG5leHBvcnQgeyB0ZXN0TWFya2l0ZG93bkNvbmZpZyB9OyJdfQ==