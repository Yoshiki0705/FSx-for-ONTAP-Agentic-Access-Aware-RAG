const axios = require('axios');

const CLOUDFRONT_URL = process.env.CLOUDFRONT_URL || 'https://your-distribution.cloudfront.net';

async function testAPI() {
  console.log('🧪 API統合テストを開始...');
  console.log(`CloudFront URL: ${CLOUDFRONT_URL}`);
  
  const tests = [
    {
      name: 'Simple API Health Check',
      url: `${CLOUDFRONT_URL}/api/health`,
      method: 'GET'
    },
    {
      name: 'Lambda Integration Health Check',
      url: `${CLOUDFRONT_URL}/v1/health`,
      method: 'GET'
    },
    {
      name: 'Session Endpoint',
      url: `${CLOUDFRONT_URL}/v1/session`,
      method: 'GET'
    },
    {
      name: 'Permissions Endpoint',
      url: `${CLOUDFRONT_URL}/v1/permissions`,
      method: 'GET'
    },
    {
      name: 'Documents Endpoint',
      url: `${CLOUDFRONT_URL}/v1/documents`,
      method: 'GET'
    }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      console.log(`\n📋 テスト: ${test.name}`);
      console.log(`URL: ${test.url}`);
      
      const startTime = Date.now();
      const response = await axios({
        method: test.method,
        url: test.url,
        timeout: 10000,
        validateStatus: () => true // すべてのステータスコードを受け入れ
      });
      const endTime = Date.now();
      
      console.log(`Status: ${response.status}`);
      console.log(`Time: ${endTime - startTime}ms`);
      
      if (response.status === 200) {
        console.log('✅ 成功');
        passed++;
      } else {
        console.log('❌ 失敗');
        failed++;
      }
      
      // レスポンスの最初の200文字を表示
      if (response.data) {
        const preview = typeof response.data === 'string' 
          ? response.data.substring(0, 200)
          : JSON.stringify(response.data).substring(0, 200);
        console.log(`Response preview: ${preview}...`);
      }
      
    } catch (error) {
      console.log('❌ エラー:', error.message);
      failed++;
    }
  }

  console.log('\n📊 テスト結果サマリー:');
  console.log(`✅ 成功: ${passed}`);
  console.log(`❌ 失敗: ${failed}`);
  console.log(`📈 成功率: ${Math.round((passed / (passed + failed)) * 100)}%`);

  if (failed === 0) {
    console.log('\n🎉 全てのAPIテストが成功しました！');
    process.exit(0);
  } else {
    console.log('\n⚠️  一部のAPIテストが失敗しました。');
    process.exit(1);
  }
}

testAPI().catch(error => {
  console.error('テスト実行エラー:', error);
  process.exit(1);
});
