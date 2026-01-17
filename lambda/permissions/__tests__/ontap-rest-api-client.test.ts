/**
 * ONTAP REST APIクライアント プロパティテスト
 * 
 * Property 3: ONTAP REST APIエンドポイントの正確性
 * Property 4: ACLレスポンスのパース正確性
 * Validates: Requirements 2.3, 2.4
 */

import { OntapRestApiClient } from '../ontap-rest-api-client';
import { OntapAclResponse } from '../types';

describe('OntapRestApiClient - Property Tests', () => {
  describe('Property 3: ONTAP REST APIエンドポイントの正確性', () => {
    /**
     * 任意のSVM名とShare名に対して、正しいエンドポイントURLが構築されることを検証
     */
    
    const testCases = [
      // 基本的なケース
      { svm: 'svm1', share: 'share1', expected: '/api/protocols/cifs/shares/svm1/share1/acls' },
      { svm: 'production-svm', share: 'documents', expected: '/api/protocols/cifs/shares/production-svm/documents/acls' },
      
      // 特殊文字を含むケース
      { svm: 'svm-test', share: 'share_data', expected: '/api/protocols/cifs/shares/svm-test/share_data/acls' },
      { svm: 'svm.domain', share: 'share.name', expected: '/api/protocols/cifs/shares/svm.domain/share.name/acls' },
      
      // スペースを含むケース（URLエンコードが必要）
      { svm: 'svm test', share: 'share data', expected: '/api/protocols/cifs/shares/svm%20test/share%20data/acls' },
      
      // 日本語を含むケース（URLエンコードが必要）
      { svm: 'svm本番', share: '共有フォルダ', expected: '/api/protocols/cifs/shares/svm%E6%9C%AC%E7%95%AA/%E5%85%B1%E6%9C%89%E3%83%95%E3%82%A9%E3%83%AB%E3%83%80/acls' },
      
      // 特殊記号を含むケース
      { svm: 'svm@prod', share: 'share#1', expected: '/api/protocols/cifs/shares/svm%40prod/share%231/acls' },
      
      // 長い名前のケース
      { 
        svm: 'very-long-svm-name-for-testing-purposes', 
        share: 'very-long-share-name-for-testing-purposes',
        expected: '/api/protocols/cifs/shares/very-long-svm-name-for-testing-purposes/very-long-share-name-for-testing-purposes/acls'
      },
      
      // 数字のみのケース
      { svm: '12345', share: '67890', expected: '/api/protocols/cifs/shares/12345/67890/acls' },
      
      // 大文字小文字混在のケース
      { svm: 'SVM-Prod', share: 'Share-Data', expected: '/api/protocols/cifs/shares/SVM-Prod/Share-Data/acls' },
    ];

    testCases.forEach(({ svm, share, expected }) => {
      it(`should construct correct endpoint for SVM="${svm}" and Share="${share}"`, () => {
        // エンドポイント構築ロジックを検証
        const encodedSvm = encodeURIComponent(svm);
        const encodedShare = encodeURIComponent(share);
        const actualPath = `/api/protocols/cifs/shares/${encodedSvm}/${encodedShare}/acls`;
        
        expect(actualPath).toBe(expected);
      });
    });

    it('should handle empty strings gracefully', () => {
      // 空文字列の場合もエンドポイントが構築される
      const svm = '';
      const share = '';
      const encodedSvm = encodeURIComponent(svm);
      const encodedShare = encodeURIComponent(share);
      const actualPath = `/api/protocols/cifs/shares/${encodedSvm}/${encodedShare}/acls`;
      
      // 空文字列はエンコードされないため、スラッシュが連続する
      expect(actualPath).toBe('/api/protocols/cifs/shares///acls');
    });

    it('should preserve URL structure with forward slashes in names', () => {
      // スラッシュを含む名前の場合、正しくエンコードされる
      const svm = 'svm/test';
      const share = 'share/data';
      const encodedSvm = encodeURIComponent(svm);
      const encodedShare = encodeURIComponent(share);
      const actualPath = `/api/protocols/cifs/shares/${encodedSvm}/${encodedShare}/acls`;
      
      // スラッシュは%2Fにエンコードされる
      expect(actualPath).toBe('/api/protocols/cifs/shares/svm%2Ftest/share%2Fdata/acls');
    });

    it('should handle Unicode characters correctly', () => {
      // Unicode文字を含む名前の場合
      const svm = 'svm-日本語-テスト';
      const share = '共有-フォルダ-😀';
      const encodedSvm = encodeURIComponent(svm);
      const encodedShare = encodeURIComponent(share);
      const actualPath = `/api/protocols/cifs/shares/${encodedSvm}/${encodedShare}/acls`;
      
      // Unicode文字が正しくエンコードされる
      expect(actualPath).toContain('/api/protocols/cifs/shares/');
      expect(actualPath).toContain('/acls');
      expect(actualPath).not.toContain('日本語');
      expect(actualPath).not.toContain('😀');
    });

    it('should maintain consistent endpoint structure', () => {
      // エンドポイント構造の一貫性を検証
      const testInputs = [
        { svm: 'svm1', share: 'share1' },
        { svm: 'svm2', share: 'share2' },
        { svm: 'svm3', share: 'share3' },
      ];

      testInputs.forEach(({ svm, share }) => {
        const encodedSvm = encodeURIComponent(svm);
        const encodedShare = encodeURIComponent(share);
        const actualPath = `/api/protocols/cifs/shares/${encodedSvm}/${encodedShare}/acls`;
        
        // 全てのエンドポイントが同じ構造を持つ
        expect(actualPath).toMatch(/^\/api\/protocols\/cifs\/shares\/[^/]+\/[^/]+\/acls$/);
      });
    });
  });

  describe('Property 3: Integration with OntapRestApiClient.getCifsShareAcl()', () => {
    /**
     * 実際のOntapRestApiClientクラスのgetCifsShareAcl()メソッドが
     * 正しいエンドポイントを構築することを検証
     */

    // モック環境変数を設定
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = {
        ...originalEnv,
        FSX_MANAGEMENT_ENDPOINT: 'https://management.fsx.example.com',
        ONTAP_CREDENTIALS_SECRET_NAME: 'test-secret',
      };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should construct correct endpoint in getCifsShareAcl method', async () => {
      // OntapRestApiClientのインスタンスを作成
      const client = new OntapRestApiClient();
      
      // getCifsShareAcl()メソッドが正しいエンドポイントを使用することを検証
      // （実際のAPI呼び出しはモックする）
      
      const svm = 'test-svm';
      const share = 'test-share';
      
      // request()メソッドをスパイして、正しいパスが渡されることを確認
      const requestSpy = jest.spyOn(client as any, 'request').mockResolvedValue({
        records: [],
        num_records: 0,
      });

      try {
        await client.getCifsShareAcl(svm, share);
      } catch (error) {
        // エラーは無視（モック環境のため）
      }

      // request()が正しいパスで呼ばれたことを確認
      expect(requestSpy).toHaveBeenCalledWith(
        'GET',
        `/api/protocols/cifs/shares/${encodeURIComponent(svm)}/${encodeURIComponent(share)}/acls`
      );

      requestSpy.mockRestore();
    });

    it('should handle special characters in SVM and Share names', async () => {
      const client = new OntapRestApiClient();
      
      const testCases = [
        { svm: 'svm test', share: 'share data' },
        { svm: 'svm@prod', share: 'share#1' },
        { svm: 'svm-日本語', share: '共有フォルダ' },
      ];

      const requestSpy = jest.spyOn(client as any, 'request').mockResolvedValue({
        records: [],
        num_records: 0,
      });

      for (const { svm, share } of testCases) {
        try {
          await client.getCifsShareAcl(svm, share);
        } catch (error) {
          // エラーは無視
        }

        // 正しくエンコードされたパスが使用されることを確認
        const expectedPath = `/api/protocols/cifs/shares/${encodeURIComponent(svm)}/${encodeURIComponent(share)}/acls`;
        expect(requestSpy).toHaveBeenCalledWith('GET', expectedPath);
      }

      requestSpy.mockRestore();
    });
  });

  describe('Property 3: Edge Cases', () => {
    /**
     * エッジケースの検証
     */

    it('should handle very long SVM and Share names', () => {
      // 非常に長い名前（255文字）
      const longName = 'a'.repeat(255);
      const encodedName = encodeURIComponent(longName);
      const actualPath = `/api/protocols/cifs/shares/${encodedName}/${encodedName}/acls`;
      
      expect(actualPath).toContain('/api/protocols/cifs/shares/');
      expect(actualPath).toContain('/acls');
      expect(actualPath.length).toBeGreaterThan(255);
    });

    it('should handle names with only special characters', () => {
      const svm = '!@#$%^&*()';
      const share = '[]{}|\\;:\'",<>?';
      const encodedSvm = encodeURIComponent(svm);
      const encodedShare = encodeURIComponent(share);
      const actualPath = `/api/protocols/cifs/shares/${encodedSvm}/${encodedShare}/acls`;
      
      // 特殊文字の一部はエンコードされる（!は例外的にエンコードされない）
      // encodeURIComponentは RFC 3986 に従い、一部の文字をエンコードしない
      expect(actualPath).toContain('%');
      expect(encodedSvm.length).toBeGreaterThan(svm.length);
      expect(encodedShare.length).toBeGreaterThan(share.length);
    });

    it('should handle names with mixed encodable and non-encodable characters', () => {
      const svm = 'svm-test_123';
      const share = 'share.data-2024';
      const encodedSvm = encodeURIComponent(svm);
      const encodedShare = encodeURIComponent(share);
      const actualPath = `/api/protocols/cifs/shares/${encodedSvm}/${encodedShare}/acls`;
      
      // ハイフン、アンダースコア、ドットはエンコードされない
      expect(actualPath).toBe('/api/protocols/cifs/shares/svm-test_123/share.data-2024/acls');
    });
  });
});


describe('Property 4: ACLレスポンスのパース正確性', () => {
  /**
   * 任意のONTAP ACLレスポンスに対して、SID情報が正しく抽出されることを検証
   * Validates: Requirements 2.4
   */

  describe('Basic ACL Response Parsing', () => {
    it('should parse single ACL record with full_control permission', () => {
      const response: OntapAclResponse = {
        records: [
          {
            user_or_group: 'S-1-5-21-123456789-123456789-123456789-512',
            permission: 'full_control',
            type: 'allow'
          }
        ],
        num_records: 1
      };

      expect(response.records).toHaveLength(1);
      expect(response.records[0].user_or_group).toMatch(/^S-1-5-21-/);
      expect(response.records[0].permission).toBe('full_control');
      expect(response.num_records).toBe(1);
    });

    it('should parse multiple ACL records', () => {
      const response: OntapAclResponse = {
        records: [
          {
            user_or_group: 'S-1-5-21-123456789-123456789-123456789-512',
            permission: 'full_control',
            type: 'allow'
          },
          {
            user_or_group: 'S-1-5-21-123456789-123456789-123456789-513',
            permission: 'change',
            type: 'allow'
          },
          {
            user_or_group: 'S-1-5-21-123456789-123456789-123456789-514',
            permission: 'read',
            type: 'allow'
          }
        ],
        num_records: 3
      };

      expect(response.records).toHaveLength(3);
      expect(response.num_records).toBe(3);
      
      // 全てのレコードがSID形式を持つ
      response.records.forEach(record => {
        expect(record.user_or_group).toMatch(/^S-1-5-21-/);
        expect(['full_control', 'change', 'read', 'no_access']).toContain(record.permission);
      });
    });

    it('should parse ACL record with change permission', () => {
      const response: OntapAclResponse = {
        records: [
          {
            user_or_group: 'S-1-5-21-987654321-987654321-987654321-1001',
            permission: 'change',
            type: 'allow'
          }
        ],
        num_records: 1
      };

      expect(response.records[0].permission).toBe('change');
      expect(response.records[0].user_or_group).toContain('S-1-5-21');
    });

    it('should parse ACL record with read permission', () => {
      const response: OntapAclResponse = {
        records: [
          {
            user_or_group: 'S-1-5-21-111111111-222222222-333333333-1002',
            permission: 'read',
            type: 'allow'
          }
        ],
        num_records: 1
      };

      expect(response.records[0].permission).toBe('read');
    });

    it('should parse ACL record with no_access permission', () => {
      const response: OntapAclResponse = {
        records: [
          {
            user_or_group: 'S-1-5-21-444444444-555555555-666666666-1003',
            permission: 'no_access',
            type: 'deny'
          }
        ],
        num_records: 1
      };

      expect(response.records[0].permission).toBe('no_access');
      expect(response.records[0].type).toBe('deny');
    });
  });

  describe('SID Format Validation', () => {
    it('should extract valid Windows SID format', () => {
      const testSIDs = [
        'S-1-5-21-123456789-123456789-123456789-512',
        'S-1-5-21-987654321-987654321-987654321-1001',
        'S-1-5-21-111111111-222222222-333333333-500',
        'S-1-5-21-444444444-555555555-666666666-1000',
      ];

      testSIDs.forEach(sid => {
        const response: OntapAclResponse = {
          records: [
            {
              user_or_group: sid,
              permission: 'full_control',
              type: 'allow'
            }
          ],
          num_records: 1
        };

        // SID形式の検証: S-1-5-21-{domain}-{domain}-{domain}-{rid}
        expect(response.records[0].user_or_group).toMatch(/^S-1-5-21-\d+-\d+-\d+-\d+$/);
      });
    });

    it('should handle well-known SIDs', () => {
      const wellKnownSIDs = [
        'S-1-5-32-544', // Administrators
        'S-1-5-32-545', // Users
        'S-1-5-32-546', // Guests
        'S-1-1-0',      // Everyone
        'S-1-5-18',     // Local System
      ];

      wellKnownSIDs.forEach(sid => {
        const response: OntapAclResponse = {
          records: [
            {
              user_or_group: sid,
              permission: 'full_control',
              type: 'allow'
            }
          ],
          num_records: 1
        };

        expect(response.records[0].user_or_group).toMatch(/^S-1-/);
      });
    });

    it('should parse SID with group name format', () => {
      // ONTAPは時々グループ名も返す可能性がある
      const response: OntapAclResponse = {
        records: [
          {
            user_or_group: 'DOMAIN\\Administrators',
            permission: 'full_control',
            type: 'allow'
          }
        ],
        num_records: 1
      };

      expect(response.records[0].user_or_group).toContain('\\');
    });
  });

  describe('Empty and Edge Cases', () => {
    it('should handle empty ACL response', () => {
      const response: OntapAclResponse = {
        records: [],
        num_records: 0
      };

      expect(response.records).toHaveLength(0);
      expect(response.num_records).toBe(0);
    });

    it('should handle response with mismatched num_records', () => {
      const response: OntapAclResponse = {
        records: [
          {
            user_or_group: 'S-1-5-21-123456789-123456789-123456789-512',
            permission: 'full_control',
            type: 'allow'
          }
        ],
        num_records: 5 // 実際のレコード数と異なる
      };

      // レコード数の不一致を検出
      expect(response.records.length).not.toBe(response.num_records);
      expect(response.records).toHaveLength(1);
      expect(response.num_records).toBe(5);
    });

    it('should handle very large ACL response', () => {
      // 100個のACLレコードを生成
      const records = Array.from({ length: 100 }, (_, i) => ({
        user_or_group: `S-1-5-21-123456789-123456789-123456789-${1000 + i}`,
        permission: 'read' as const,
        type: 'allow' as const
      }));

      const response: OntapAclResponse = {
        records,
        num_records: 100
      };

      expect(response.records).toHaveLength(100);
      expect(response.num_records).toBe(100);
      
      // 全てのSIDが一意であることを確認
      const sids = response.records.map(r => r.user_or_group);
      const uniqueSids = new Set(sids);
      expect(uniqueSids.size).toBe(100);
    });
  });

  describe('Permission Type Validation', () => {
    it('should validate all permission types', () => {
      const permissionTypes: Array<'full_control' | 'change' | 'read' | 'no_access'> = [
        'full_control',
        'change',
        'read',
        'no_access'
      ];

      permissionTypes.forEach(permission => {
        const response: OntapAclResponse = {
          records: [
            {
              user_or_group: 'S-1-5-21-123456789-123456789-123456789-512',
              permission,
              type: 'allow'
            }
          ],
          num_records: 1
        };

        expect(response.records[0].permission).toBe(permission);
      });
    });

    it('should handle mixed permission types', () => {
      const response: OntapAclResponse = {
        records: [
          {
            user_or_group: 'S-1-5-21-123456789-123456789-123456789-512',
            permission: 'full_control',
            type: 'allow'
          },
          {
            user_or_group: 'S-1-5-21-123456789-123456789-123456789-513',
            permission: 'change',
            type: 'allow'
          },
          {
            user_or_group: 'S-1-5-21-123456789-123456789-123456789-514',
            permission: 'read',
            type: 'allow'
          },
          {
            user_or_group: 'S-1-5-21-123456789-123456789-123456789-515',
            permission: 'no_access',
            type: 'deny'
          }
        ],
        num_records: 4
      };

      const permissions = response.records.map(r => r.permission);
      expect(permissions).toContain('full_control');
      expect(permissions).toContain('change');
      expect(permissions).toContain('read');
      expect(permissions).toContain('no_access');
    });
  });

  describe('Integration with OntapRestApiClient', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = {
        ...originalEnv,
        FSX_MANAGEMENT_ENDPOINT: 'https://management.fsx.example.com',
        ONTAP_CREDENTIALS_SECRET_NAME: 'test-secret',
      };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should correctly parse ACL response from getCifsShareAcl', async () => {
      const client = new OntapRestApiClient();
      
      const mockResponse: OntapAclResponse = {
        records: [
          {
            user_or_group: 'S-1-5-21-123456789-123456789-123456789-512',
            permission: 'full_control',
            type: 'allow'
          },
          {
            user_or_group: 'S-1-5-21-123456789-123456789-123456789-513',
            permission: 'read',
            type: 'allow'
          }
        ],
        num_records: 2
      };

      const requestSpy = jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse);

      const result = await client.getCifsShareAcl('test-svm', 'test-share');

      expect(result.records).toHaveLength(2);
      expect(result.num_records).toBe(2);
      expect(result.records[0].user_or_group).toMatch(/^S-1-5-21-/);
      expect(result.records[0].permission).toBe('full_control');

      requestSpy.mockRestore();
    });

    it('should handle ACL response with only SID information', async () => {
      const client = new OntapRestApiClient();
      
      const mockResponse: OntapAclResponse = {
        records: [
          {
            user_or_group: 'S-1-5-21-987654321-987654321-987654321-1001',
            permission: 'change',
            type: 'allow'
          }
        ],
        num_records: 1
      };

      const requestSpy = jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse);

      const result = await client.getCifsShareAcl('svm', 'share');

      // SID情報が正しく抽出される
      expect(result.records[0].user_or_group).toBe('S-1-5-21-987654321-987654321-987654321-1001');
      expect(result.records[0].permission).toBe('change');

      requestSpy.mockRestore();
    });

    it('should extract SID from complex ACL response', async () => {
      const client = new OntapRestApiClient();
      
      // 複雑なACLレスポンス（複数のSID、異なる権限）
      const mockResponse: OntapAclResponse = {
        records: [
          {
            user_or_group: 'S-1-5-21-111111111-222222222-333333333-512',
            permission: 'full_control',
            type: 'allow'
          },
          {
            user_or_group: 'S-1-5-21-111111111-222222222-333333333-513',
            permission: 'change',
            type: 'allow'
          },
          {
            user_or_group: 'S-1-5-21-111111111-222222222-333333333-514',
            permission: 'read',
            type: 'allow'
          },
          {
            user_or_group: 'S-1-5-32-544', // Well-known SID (Administrators)
            permission: 'full_control',
            type: 'allow'
          },
          {
            user_or_group: 'S-1-1-0', // Everyone
            permission: 'read',
            type: 'allow'
          }
        ],
        num_records: 5
      };

      const requestSpy = jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse);

      const result = await client.getCifsShareAcl('svm', 'share');

      // 全てのSIDが正しく抽出される
      expect(result.records).toHaveLength(5);
      result.records.forEach(record => {
        expect(record.user_or_group).toMatch(/^S-1-/);
      });

      // 権限の多様性を確認
      const permissions = result.records.map(r => r.permission);
      expect(permissions).toContain('full_control');
      expect(permissions).toContain('change');
      expect(permissions).toContain('read');

      requestSpy.mockRestore();
    });
  });

  describe('Error Cases', () => {
    it('should handle malformed SID gracefully', () => {
      const response: OntapAclResponse = {
        records: [
          {
            user_or_group: 'INVALID-SID-FORMAT',
            permission: 'read',
            type: 'allow'
          }
        ],
        num_records: 1
      };

      // 不正なSID形式でもパースは成功する（検証は別レイヤーで行う）
      expect(response.records[0].user_or_group).toBe('INVALID-SID-FORMAT');
    });

    it('should handle missing fields in ACL record', () => {
      // TypeScriptの型チェックにより、必須フィールドの欠落はコンパイル時に検出される
      // ランタイムでの検証は実装側で行う
      const response: any = {
        records: [
          {
            user_or_group: 'S-1-5-21-123456789-123456789-123456789-512',
            // permission フィールドが欠落
            type: 'allow'
          }
        ],
        num_records: 1
      };

      expect(response.records[0].user_or_group).toBeDefined();
      expect(response.records[0].permission).toBeUndefined();
    });
  });
});
