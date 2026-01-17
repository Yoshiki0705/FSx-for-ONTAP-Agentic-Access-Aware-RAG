/**
 * 詳細チェック判定ロジック プロパティテスト
 * 
 * Property 13-17: 詳細チェック判定の正確性
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5
 */

import { UnifiedPermissionService, PermissionCheckContext } from '../unified-permission-service';

// DynamoDBのモック
jest.mock('@aws-sdk/lib-dynamodb', () => {
  const mockSend = jest.fn();
  return {
    DynamoDBDocumentClient: {
      from: jest.fn(() => ({
        send: mockSend,
      })),
    },
    GetCommand: jest.fn((params) => params),
  };
});

// ONTAP REST API Clientのモック
jest.mock('../ontap-rest-api-client', () => ({
  getOntapClient: jest.fn(() => ({
    listVolumes: jest.fn().mockResolvedValue([
      { uuid: 'test-volume-uuid', name: 'test-volume' },
    ]),
  })),
}));

describe('Detailed Check Decision - Property Tests', () => {
  let service: UnifiedPermissionService;

  beforeEach(() => {
    process.env.AWS_REGION = 'us-east-1';
    process.env.PERMISSION_TABLE = 'test-permission-table';
    
    jest.clearAllMocks();
    
    service = new UnifiedPermissionService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Property 13: ファイルパスによる詳細チェック判定', () => {
    /**
     * ファイル拡張子を含むパスで詳細チェックが必要と判定されることを検証
     * Validates: Requirements 5.1
     */

    it('should require detailed check for file with .txt extension', () => {
      const context: PermissionCheckContext = {
        userId: 'user01',
        path: '\\\\fsxn\\share\\documents\\report.txt',
      };

      const decision = service.shouldPerformDetailedCheck(context);

      expect(decision.required).toBe(true);
      expect(decision.reason).toBe('File path contains extension');
      expect(decision.method).toBe('ssm-powershell');
    });

    it('should require detailed check for file with .docx extension', () => {
      const context: PermissionCheckContext = {
        userId: 'user01',
        path: '\\\\fsxn\\share\\documents\\report.docx',
      };

      const decision = service.shouldPerformDetailedCheck(context);

      expect(decision.required).toBe(true);
      expect(decision.reason).toBe('File path contains extension');
      expect(decision.method).toBe('ssm-powershell');
    });

    it('should require detailed check for file with .xlsx extension', () => {
      const context: PermissionCheckContext = {
        userId: 'user01',
        path: '/shared/data/spreadsheet.xlsx',
      };

      const decision = service.shouldPerformDetailedCheck(context);

      expect(decision.required).toBe(true);
      expect(decision.reason).toBe('File path contains extension');
    });

    it('should require detailed check for file with .pdf extension', () => {
      const context: PermissionCheckContext = {
        userId: 'user01',
        path: '/documents/manual.pdf',
      };

      const decision = service.shouldPerformDetailedCheck(context);

      expect(decision.required).toBe(true);
    });

    it('should require detailed check for file with .jpg extension', () => {
      const context: PermissionCheckContext = {
        userId: 'user01',
        path: '/images/photo.jpg',
      };

      const decision = service.shouldPerformDetailedCheck(context);

      expect(decision.required).toBe(true);
    });

    it('should require detailed check for file with .log extension', () => {
      const context: PermissionCheckContext = {
        userId: 'user01',
        path: '/logs/application.log',
      };

      const decision = service.shouldPerformDetailedCheck(context);

      expect(decision.required).toBe(true);
    });
  });

  describe('Property 14: Share レベルリクエストの判定', () => {
    /**
     * ファイル拡張子を含まないパスでShare レベルチェックのみと判定されることを検証
     * Validates: Requirements 5.2
     */

    it('should not require detailed check for share-level path', () => {
      const context: PermissionCheckContext = {
        userId: 'user01',
        path: '\\\\fsxn\\share',
      };

      const decision = service.shouldPerformDetailedCheck(context);

      expect(decision.required).toBe(false);
      expect(decision.reason).toBe('Share-level check only');
      expect(decision.method).toBe('ontap-only');
    });

    it('should not require detailed check for directory path', () => {
      const context: PermissionCheckContext = {
        userId: 'user01',
        path: '\\\\fsxn\\share\\documents',
      };

      const decision = service.shouldPerformDetailedCheck(context);

      expect(decision.required).toBe(false);
      expect(decision.reason).toBe('Share-level check only');
    });

    it('should not require detailed check for nested directory path', () => {
      const context: PermissionCheckContext = {
        userId: 'user01',
        path: '/shared/documents/2024/reports',
      };

      const decision = service.shouldPerformDetailedCheck(context);

      expect(decision.required).toBe(false);
    });

    it('should not require detailed check for root share path', () => {
      const context: PermissionCheckContext = {
        userId: 'user01',
        path: '\\\\fsxn\\data',
      };

      const decision = service.shouldPerformDetailedCheck(context);

      expect(decision.required).toBe(false);
    });
  });

  describe('Property 15: 継承フラグによる詳細チェック判定', () => {
    /**
     * checkInheritanceフラグがtrueで詳細チェックが必要と判定されることを検証
     * Validates: Requirements 5.3
     */

    it('should require detailed check when checkInheritance is true', () => {
      const context: PermissionCheckContext = {
        userId: 'user01',
        path: '\\\\fsxn\\share\\documents',
        checkInheritance: true,
      };

      const decision = service.shouldPerformDetailedCheck(context);

      expect(decision.required).toBe(true);
      expect(decision.reason).toBe('Inheritance check required');
      expect(decision.method).toBe('ssm-powershell');
    });

    it('should require detailed check for share-level path with checkInheritance', () => {
      const context: PermissionCheckContext = {
        userId: 'user01',
        path: '\\\\fsxn\\share',
        checkInheritance: true,
      };

      const decision = service.shouldPerformDetailedCheck(context);

      expect(decision.required).toBe(true);
      expect(decision.reason).toBe('Inheritance check required');
    });

    it('should not require detailed check when checkInheritance is false', () => {
      const context: PermissionCheckContext = {
        userId: 'user01',
        path: '\\\\fsxn\\share\\documents',
        checkInheritance: false,
      };

      const decision = service.shouldPerformDetailedCheck(context);

      expect(decision.required).toBe(false);
    });

    it('should not require detailed check when checkInheritance is undefined', () => {
      const context: PermissionCheckContext = {
        userId: 'user01',
        path: '\\\\fsxn\\share\\documents',
      };

      const decision = service.shouldPerformDetailedCheck(context);

      expect(decision.required).toBe(false);
    });
  });

  describe('Property 16: Denyフラグによる詳細チェック判定', () => {
    /**
     * checkDenyフラグがtrueで詳細チェックが必要と判定されることを検証
     * Validates: Requirements 5.4
     */

    it('should require detailed check when checkDeny is true', () => {
      const context: PermissionCheckContext = {
        userId: 'user01',
        path: '\\\\fsxn\\share\\documents',
        checkDeny: true,
      };

      const decision = service.shouldPerformDetailedCheck(context);

      expect(decision.required).toBe(true);
      expect(decision.reason).toBe('Deny check required');
      expect(decision.method).toBe('ssm-powershell');
    });

    it('should require detailed check for share-level path with checkDeny', () => {
      const context: PermissionCheckContext = {
        userId: 'user01',
        path: '\\\\fsxn\\share',
        checkDeny: true,
      };

      const decision = service.shouldPerformDetailedCheck(context);

      expect(decision.required).toBe(true);
      expect(decision.reason).toBe('Deny check required');
    });

    it('should not require detailed check when checkDeny is false', () => {
      const context: PermissionCheckContext = {
        userId: 'user01',
        path: '\\\\fsxn\\share\\documents',
        checkDeny: false,
      };

      const decision = service.shouldPerformDetailedCheck(context);

      expect(decision.required).toBe(false);
    });

    it('should not require detailed check when checkDeny is undefined', () => {
      const context: PermissionCheckContext = {
        userId: 'user01',
        path: '\\\\fsxn\\share\\documents',
      };

      const decision = service.shouldPerformDetailedCheck(context);

      expect(decision.required).toBe(false);
    });
  });

  describe('Property 17: 明示的な詳細チェックフラグ', () => {
    /**
     * detailedCheckフラグがtrueで強制的に詳細チェックが実行されることを検証
     * Validates: Requirements 5.5
     */

    it('should require detailed check when detailedCheck is true', () => {
      const context: PermissionCheckContext = {
        userId: 'user01',
        path: '\\\\fsxn\\share\\documents',
        detailedCheck: true,
      };

      const decision = service.shouldPerformDetailedCheck(context);

      expect(decision.required).toBe(true);
      expect(decision.reason).toBe('Explicit detailedCheck flag is true');
      expect(decision.method).toBe('ssm-powershell');
    });

    it('should require detailed check for share-level path with detailedCheck', () => {
      const context: PermissionCheckContext = {
        userId: 'user01',
        path: '\\\\fsxn\\share',
        detailedCheck: true,
      };

      const decision = service.shouldPerformDetailedCheck(context);

      expect(decision.required).toBe(true);
      expect(decision.reason).toBe('Explicit detailedCheck flag is true');
    });

    it('should prioritize detailedCheck over file extension', () => {
      // detailedCheckフラグが最優先
      const context: PermissionCheckContext = {
        userId: 'user01',
        path: '\\\\fsxn\\share\\documents\\report.txt',
        detailedCheck: true,
      };

      const decision = service.shouldPerformDetailedCheck(context);

      expect(decision.required).toBe(true);
      expect(decision.reason).toBe('Explicit detailedCheck flag is true');
    });

    it('should not require detailed check when detailedCheck is false', () => {
      const context: PermissionCheckContext = {
        userId: 'user01',
        path: '\\\\fsxn\\share\\documents',
        detailedCheck: false,
      };

      const decision = service.shouldPerformDetailedCheck(context);

      expect(decision.required).toBe(false);
    });
  });

  describe('Priority and Edge Cases', () => {
    it('should prioritize detailedCheck over checkInheritance', () => {
      const context: PermissionCheckContext = {
        userId: 'user01',
        path: '\\\\fsxn\\share',
        detailedCheck: true,
        checkInheritance: true,
      };

      const decision = service.shouldPerformDetailedCheck(context);

      expect(decision.reason).toBe('Explicit detailedCheck flag is true');
    });

    it('should prioritize detailedCheck over checkDeny', () => {
      const context: PermissionCheckContext = {
        userId: 'user01',
        path: '\\\\fsxn\\share',
        detailedCheck: true,
        checkDeny: true,
      };

      const decision = service.shouldPerformDetailedCheck(context);

      expect(decision.reason).toBe('Explicit detailedCheck flag is true');
    });

    it('should prioritize checkInheritance over file extension', () => {
      const context: PermissionCheckContext = {
        userId: 'user01',
        path: '\\\\fsxn\\share\\documents\\report.txt',
        checkInheritance: true,
      };

      const decision = service.shouldPerformDetailedCheck(context);

      expect(decision.reason).toBe('Inheritance check required');
    });

    it('should prioritize checkDeny over file extension', () => {
      const context: PermissionCheckContext = {
        userId: 'user01',
        path: '\\\\fsxn\\share\\documents\\report.txt',
        checkDeny: true,
      };

      const decision = service.shouldPerformDetailedCheck(context);

      expect(decision.reason).toBe('Deny check required');
    });

    it('should handle path with dots in directory name', () => {
      // ディレクトリ名にドットが含まれる場合
      const context: PermissionCheckContext = {
        userId: 'user01',
        path: '\\\\fsxn\\share\\v1.0.0',
      };

      const decision = service.shouldPerformDetailedCheck(context);

      // 最後の部分が拡張子パターンにマッチしないため、Share レベル
      expect(decision.required).toBe(false);
    });

    it('should handle file with very long extension', () => {
      // 10文字を超える拡張子は無効
      const context: PermissionCheckContext = {
        userId: 'user01',
        path: '/files/document.verylongextension',
      };

      const decision = service.shouldPerformDetailedCheck(context);

      // 拡張子が長すぎるため、Share レベル
      expect(decision.required).toBe(false);
    });

    it('should handle file with single character extension', () => {
      const context: PermissionCheckContext = {
        userId: 'user01',
        path: '/files/document.c',
      };

      const decision = service.shouldPerformDetailedCheck(context);

      expect(decision.required).toBe(true);
    });

    it('should handle empty path', () => {
      const context: PermissionCheckContext = {
        userId: 'user01',
        path: '',
      };

      const decision = service.shouldPerformDetailedCheck(context);

      expect(decision.required).toBe(false);
    });

    it('should handle path with trailing slash', () => {
      const context: PermissionCheckContext = {
        userId: 'user01',
        path: '\\\\fsxn\\share\\documents\\',
      };

      const decision = service.shouldPerformDetailedCheck(context);

      expect(decision.required).toBe(false);
    });
  });
});
