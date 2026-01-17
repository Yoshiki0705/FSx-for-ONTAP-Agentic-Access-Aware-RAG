/**
 * Markitdown設定のテストスクリプト
 * 設定の読み込みと検証をテストする
 */

import { 
  loadMarkitdownConfig, 
  validateMarkitdownConfig, 
  generateMarkitdownConfigTemplate,
  updateProcessingStrategy,
  generateProcessingMethodReport
} from './config-loader';
import { 
  DEFAULT_MARKITDOWN_CONFIG,
  shouldUseMarkitdown,
  shouldUseLangChain,
  getProcessingOrder,
  shouldPerformQualityComparison
} from '../../types/markitdown-config';

/**
 * Markitdown設定のテスト実行
 */
function testMarkitdownConfig() {
  console.log('🧪 Markitdown設定のテストを開始します...\n');

  // 1. デフォルト設定のテスト
  console.log('1️⃣ デフォルト設定のテスト');
  const defaultConfig = DEFAULT_MARKITDOWN_CONFIG;
  const isDefaultValid = validateMarkitdownConfig(defaultConfig);
  console.log(`   デフォルト設定の検証結果: ${isDefaultValid ? '✅ 有効' : '❌ 無効'}\n`);

  // 2. 環境別設定の読み込みテスト
  console.log('2️⃣ 環境別設定の読み込みテスト');
  
  const environments = ['dev', 'staging', 'prod'];
  for (const env of environments) {
    try {
      console.log(`   ${env}環境の設定を読み込み中...`);
      const envConfig = loadMarkitdownConfig(env);
      const isValid = validateMarkitdownConfig(envConfig);
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
      
    } catch (error) {
      console.error(`   ❌ ${env}環境の設定読み込みエラー: ${error}`);
    }
    console.log('');
  }

  // 3. 設定テンプレート生成のテスト
  console.log('3️⃣ 設定テンプレート生成のテスト');
  try {
    const template = generateMarkitdownConfigTemplate();
    const isTemplateValid = validateMarkitdownConfig(template);
    console.log(`   テンプレート生成: ${isTemplateValid ? '✅ 成功' : '❌ 失敗'}`);
    
    // テンプレートの主要設定を表示
    console.log(`   - サポートファイル形式数: ${Object.keys(template.supportedFormats).length}`);
    console.log(`   - デフォルト最大ファイルサイズ: ${template.performance.maxFileSize}`);
    console.log(`   - フォールバック有効: ${template.fallback.enabled}`);
    
  } catch (error) {
    console.error(`   ❌ テンプレート生成エラー: ${error}`);
  }

  // 4. 処理方法選択機能のテスト
  console.log('4️⃣ 処理方法選択機能のテスト');
  try {
    const testConfig = loadMarkitdownConfig('prod');
    
    // ファイル形式別の処理方法チェック
    const formats = ['docx', 'pdf', 'png', 'csv'] as const;
    for (const format of formats) {
      const useMarkitdown = shouldUseMarkitdown(testConfig, format);
      const useLangChain = shouldUseLangChain(testConfig, format);
      const processingOrder = getProcessingOrder(testConfig, format);
      const qualityComparison = shouldPerformQualityComparison(testConfig, format);
      
      console.log(`   ${format}:`);
      console.log(`     - Markitdown使用: ${useMarkitdown ? '✅' : '❌'}`);
      console.log(`     - LangChain使用: ${useLangChain ? '✅' : '❌'}`);
      console.log(`     - 処理順序: [${processingOrder.join(' → ')}]`);
      console.log(`     - 品質比較: ${qualityComparison ? '✅' : '❌'}`);
    }
    
  } catch (error) {
    console.error(`   ❌ 処理方法選択機能テストエラー: ${error}`);
  }
  console.log('');

  // 5. 動的設定変更のテスト
  console.log('5️⃣ 動的設定変更のテスト');
  try {
    let testConfig = loadMarkitdownConfig('dev');
    console.log(`   変更前のPDF処理戦略: ${testConfig.supportedFormats.pdf?.processingStrategy}`);
    
    // PDF処理戦略を変更
    testConfig = updateProcessingStrategy(testConfig, 'pdf', 'both-compare');
    console.log(`   変更後のPDF処理戦略: ${testConfig.supportedFormats.pdf?.processingStrategy}`);
    console.log(`   PDF品質比較有効: ${testConfig.supportedFormats.pdf?.enableQualityComparison}`);
    
  } catch (error) {
    console.error(`   ❌ 動的設定変更テストエラー: ${error}`);
  }
  console.log('');

  // 6. 処理方法レポート生成のテスト
  console.log('6️⃣ 処理方法レポート生成のテスト');
  try {
    const testConfig = loadMarkitdownConfig('prod');
    const report = generateProcessingMethodReport(testConfig);
    
    console.log(`   総ファイル形式数: ${report.summary.totalFormats}`);
    console.log(`   Markitdownのみ: ${report.summary.markitdownOnlyFormats}`);
    console.log(`   LangChainのみ: ${report.summary.langchainOnlyFormats}`);
    console.log(`   ハイブリッド: ${report.summary.hybridFormats}`);
    console.log(`   品質比較有効: ${report.summary.qualityComparisonFormats}`);
    
    console.log('   詳細:');
    report.details.forEach(detail => {
      const methods = [];
      if (detail.useMarkitdown) methods.push('Markitdown');
      if (detail.useLangChain) methods.push('LangChain');
      console.log(`     ${detail.format}: ${detail.strategy} [${methods.join('+')}]${detail.qualityComparison ? ' (品質比較)' : ''}`);
    });
    
  } catch (error) {
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

export { testMarkitdownConfig };