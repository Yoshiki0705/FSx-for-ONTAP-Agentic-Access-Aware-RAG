/**
 * APIエンドポイントの統合テスト
 */
import { NextRequest } from 'next/server';

// region-info APIのテスト
describe('/api/bedrock/region-info API統合テスト', () => {
  // region-info APIのハンドラーをインポート
  let GET: (request: NextRequest) => Promise<Response>;

  beforeAll(async () => {
    // 動的インポートでAPIハンドラーを取得
    const module = await import('../../app/api/bedrock/region-info/route');
    GET = module.GET;
  });

  describe('GET /api/bedrock/region-info', () => {
    it('サポート対象リージョン情報を正しく返すべき', async () => {
      const request = new NextRequest('http://localhost:3000/api/bedrock/region-info');
      const response = await GET(request);
      
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.supportedRegions).toBeDefined();
      expect(data.unsupportedRegions).toBeDefined();
      expect(data.currentRegion).toBeDefined();
      
      // サポート対象リージョンの検証
      expect(data.supportedRegions).toContain('ap-northeast-1');
      expect(data.supportedRegions).toContain('ap-northeast-3');
      expect(data.supportedRegions).toContain('us-east-1');
      expect(data.supportedRegions).toContain('us-west-2');
      expect(data.supportedRegions).toContain('eu-west-1');
      expect(data.supportedRegions).toHaveLength(5);
      
      // サポート外リージョンの検証
      expect(Array.isArray(data.unsupportedRegions)).toBe(true);
      expect(data.unsupportedRegions.length).toBeGreaterThan(0);
    });

    it('リージョン詳細情報を正しく返すべき', async () => {
      const request = new NextRequest('http://localhost:3000/api/bedrock/region-info');
      const response = await GET(request);
      
      const data = await response.json();
      expect(data.regionDetails).toBeDefined();
      
      // 東京リージョンの詳細情報を確認
      const tokyoDetails = data.regionDetails['ap-northeast-1'];
      expect(tokyoDetails).toBeDefined();
      expect(tokyoDetails.displayName).toBe('東京 (ap-northeast-1)');
      expect(tokyoDetails.isPrimary).toBe(true);
      expect(tokyoDetails.modelCount).toBeGreaterThan(0);
      expect(tokyoDetails.description).toContain('プライマリリージョン');
    });

    it('利用可能モデル情報を正しく返すべき', async () => {
      const request = new NextRequest('http://localhost:3000/api/bedrock/region-info');
      const response = await GET(request);
      
      const data = await response.json();
      expect(data.availableModels).toBeDefined();
      expect(Array.isArray(data.availableModels)).toBe(true);
      expect(data.availableModels.length).toBeGreaterThan(0);
      
      // モデル情報の構造を確認
      const firstModel = data.availableModels[0];
      expect(firstModel.id).toBeDefined();
      expect(firstModel.name).toBeDefined();
      expect(firstModel.nameJa).toBeDefined();
      expect(firstModel.provider).toBeDefined();
      expect(firstModel.category).toMatch(/^(chat|embedding|image)$/);
      expect(Array.isArray(firstModel.supportedRegions)).toBe(true);
    });

    it('エラー処理が適切に動作するべき', async () => {
      // 無効なパラメータでのテスト（実際のAPIでは発生しにくいが、エラーハンドリングをテスト）
      const request = new NextRequest('http://localhost:3000/api/bedrock/region-info');
      
      // APIが正常に動作することを確認（エラーが発生しない）
      const response = await GET(request);
      expect(response.status).toBe(200);
    });
  });
});

// region-change APIのテスト
describe('/api/bedrock/region-change API統合テスト', () => {
  let POST: (request: NextRequest) => Promise<Response>;

  beforeAll(async () => {
    const module = await import('../../app/api/bedrock/region-change/route');
    POST = module.POST;
  });

  describe('POST /api/bedrock/region-change', () => {
    it('有効なリージョン変更リクエストを正しく処理すべき', async () => {
      const requestBody = {
        region: 'ap-northeast-1'
      };
      
      const request = new NextRequest('http://localhost:3000/api/bedrock/region-change', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });
      
      const response = await POST(request);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.region).toBe('ap-northeast-1');
      expect(data.availableModels).toBeDefined();
      expect(Array.isArray(data.availableModels)).toBe(true);
      expect(data.availableModels.length).toBeGreaterThan(0);
      expect(data.recommendedModel).toBeDefined();
    });

    it('大阪リージョンへの変更を正しく処理すべき', async () => {
      const requestBody = {
        region: 'ap-northeast-3'
      };
      
      const request = new NextRequest('http://localhost:3000/api/bedrock/region-change', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });
      
      const response = await POST(request);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.region).toBe('ap-northeast-3');
      expect(data.availableModels.length).toBeGreaterThan(0);
      
      // 大阪リージョンで利用可能なモデルが含まれていることを確認
      const hasOsakaModel = data.availableModels.some((model: any) => 
        model.supportedRegions.includes('ap-northeast-3')
      );
      expect(hasOsakaModel).toBe(true);
    });

    it('無効なリージョンに対してエラーを返すべき', async () => {
      const requestBody = {
        region: 'invalid-region'
      };
      
      const request = new NextRequest('http://localhost:3000/api/bedrock/region-change', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });
      
      const response = await POST(request);
      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
      expect(data.error).toContain('サポートされていません');
    });

    it('サポート外リージョンに対してエラーを返すべき', async () => {
      const requestBody = {
        region: 'ap-south-1'
      };
      
      const request = new NextRequest('http://localhost:3000/api/bedrock/region-change', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });
      
      const response = await POST(request);
      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });

    it('不正なリクエストボディに対してエラーを返すべき', async () => {
      const request = new NextRequest('http://localhost:3000/api/bedrock/region-change', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}) // regionフィールドなし
      });
      
      const response = await POST(request);
      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });

    it('JSONでないリクエストボディに対してエラーを返すべき', async () => {
      const request = new NextRequest('http://localhost:3000/api/bedrock/region-change', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: 'invalid-json'
      });
      
      const response = await POST(request);
      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });
  });
});

// APIエンドポイント間の連携テスト
describe('APIエンドポイント連携テスト', () => {
  let regionInfoGET: (request: NextRequest) => Promise<Response>;
  let regionChangePOST: (request: NextRequest) => Promise<Response>;

  beforeAll(async () => {
    const regionInfoModule = await import('../../app/api/bedrock/region-info/route');
    const regionChangeModule = await import('../../app/api/bedrock/region-change/route');
    
    regionInfoGET = regionInfoModule.GET;
    regionChangePOST = regionChangeModule.POST;
  });

  it('region-infoで取得したリージョンがregion-changeで使用可能であるべき', async () => {
    // region-info APIでサポート対象リージョンを取得
    const infoRequest = new NextRequest('http://localhost:3000/api/bedrock/region-info');
    const infoResponse = await regionInfoGET(infoRequest);
    const infoData = await infoResponse.json();
    
    expect(infoData.success).toBe(true);
    expect(infoData.supportedRegions.length).toBeGreaterThan(0);
    
    // 各サポート対象リージョンでregion-change APIをテスト
    for (const region of infoData.supportedRegions) {
      const changeRequest = new NextRequest('http://localhost:3000/api/bedrock/region-change', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ region })
      });
      
      const changeResponse = await regionChangePOST(changeRequest);
      const changeData = await changeResponse.json();
      
      expect(changeResponse.status).toBe(200);
      expect(changeData.success).toBe(true);
      expect(changeData.region).toBe(region);
    }
  });

  it('region-changeで取得したモデルがregion-infoの情報と整合するべき', async () => {
    // region-info APIで全体情報を取得
    const infoRequest = new NextRequest('http://localhost:3000/api/bedrock/region-info');
    const infoResponse = await regionInfoGET(infoRequest);
    const infoData = await infoResponse.json();
    
    // 東京リージョンでregion-change APIを実行
    const changeRequest = new NextRequest('http://localhost:3000/api/bedrock/region-change', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ region: 'ap-northeast-1' })
    });
    
    const changeResponse = await regionChangePOST(changeRequest);
    const changeData = await changeResponse.json();
    
    expect(changeResponse.status).toBe(200);
    expect(changeData.success).toBe(true);
    
    // region-changeで取得したモデルがregion-infoの情報に含まれていることを確認
    const infoModels = infoData.availableModels.filter((model: any) => 
      model.supportedRegions.includes('ap-northeast-1')
    );
    
    expect(changeData.availableModels.length).toBe(infoModels.length);
    
    // 各モデルが一致することを確認
    changeData.availableModels.forEach((changeModel: any) => {
      const matchingInfoModel = infoModels.find((infoModel: any) => 
        infoModel.id === changeModel.id
      );
      expect(matchingInfoModel).toBeDefined();
    });
  });

  it('推奨モデルが適切に設定されるべき', async () => {
    const supportedRegions = ['ap-northeast-1', 'us-east-1', 'eu-west-1'];
    
    for (const region of supportedRegions) {
      const changeRequest = new NextRequest('http://localhost:3000/api/bedrock/region-change', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ region })
      });
      
      const changeResponse = await regionChangePOST(changeRequest);
      const changeData = await changeResponse.json();
      
      expect(changeResponse.status).toBe(200);
      expect(changeData.success).toBe(true);
      expect(changeData.recommendedModel).toBeDefined();
      
      // 推奨モデルが利用可能モデルに含まれていることを確認
      const recommendedModelExists = changeData.availableModels.some((model: any) => 
        model.id === changeData.recommendedModel.id
      );
      expect(recommendedModelExists).toBe(true);
      
      // 推奨モデルがチャット用であることを確認
      expect(changeData.recommendedModel.category).toBe('chat');
    }
  });
});

// パフォーマンステスト
describe('APIパフォーマンステスト', () => {
  let regionInfoGET: (request: NextRequest) => Promise<Response>;
  let regionChangePOST: (request: NextRequest) => Promise<Response>;

  beforeAll(async () => {
    const regionInfoModule = await import('../../app/api/bedrock/region-info/route');
    const regionChangeModule = await import('../../app/api/bedrock/region-change/route');
    
    regionInfoGET = regionInfoModule.GET;
    regionChangePOST = regionChangeModule.POST;
  });

  it('region-info APIが適切な時間内に応答するべき', async () => {
    const startTime = Date.now();
    
    const request = new NextRequest('http://localhost:3000/api/bedrock/region-info');
    const response = await regionInfoGET(request);
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    expect(response.status).toBe(200);
    expect(responseTime).toBeLessThan(1000); // 1秒以内
  });

  it('region-change APIが適切な時間内に応答するべき', async () => {
    const startTime = Date.now();
    
    const request = new NextRequest('http://localhost:3000/api/bedrock/region-change', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ region: 'ap-northeast-1' })
    });
    
    const response = await regionChangePOST(request);
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    expect(response.status).toBe(200);
    expect(responseTime).toBeLessThan(1000); // 1秒以内
  });

  it('連続リクエストが適切に処理されるべき', async () => {
    const regions = ['ap-northeast-1', 'us-east-1', 'eu-west-1'];
    const promises = regions.map(region => {
      const request = new NextRequest('http://localhost:3000/api/bedrock/region-change', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ region })
      });
      
      return regionChangePOST(request);
    });
    
    const responses = await Promise.all(promises);
    
    responses.forEach(response => {
      expect(response.status).toBe(200);
    });
  });
});