/**
 * FsxPermissionService SSM PowerShell統合 プロパティテスト
 * 
 * Property 11-12: PowerShellスクリプト生成とACLレスポンスパース
 * Validates: Requirements 4.2, 4.4
 */

import { FsxPermissionService } from '../fsx-permission-service';

// SSM Clientのモック
jest.mock('@aws-sdk/client-ssm', () => {
  const mockSend = jest.fn();
  return {
    SSMClient: jest.fn(() => ({
      send: mockSend,
    })),
    SendCommandCommand: jest.fn((params) => params),
    GetCommandInvocationCommand: jest.fn((params) => params),
  };
});

// ONTAP REST API Clientのモック
jest.mock('../ontap-rest-api-client', () => ({
  getOntapClient: jest.fn(() => ({
    listVolumes: jest.fn().mockResolvedValue([
      { uuid: 'test-volume-uuid', name: 'test-volume' },
    ]),
    getUserAccessibleDirectories: jest.fn().mockResolvedValue([]),
    checkUserAccess: jest.fn().mockResolvedValue({ read: true }),
  })),
}));

describe('FsxPermissionService - SSM PowerShell統合', () => {
  let service: FsxPermissionService;
  let mockSsmSend: jest.Mock;

  beforeEach(() => {
    // 環境変数を設定
    process.env.AWS_REGION = 'us-east-1';
    process.env.AD_EC2_INSTANCE_ID = 'i-1234567890abcdef0';

    // モックをリセット
    jest.clearAllMocks();

    // mockSsmSendを取得
    const { SSMClient } = require('@aws-sdk/client-ssm');
    const mockClient = new SSMClient();
    mockSsmSend = mockClient.send as jest.Mock;

    service = new FsxPermissionService({
      volumeUuid: 'test-volume-uuid',
      adEc2InstanceId: 'i-1234567890abcdef0',
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Property 11: PowerShellスクリプトのGet-Acl含有', () => {
    /**
     * 生成されるPowerShellスクリプトがGet-Aclコマンドレットを含むことを検証
     * Validates: Requirements 4.2
     */

    it('should generate PowerShell script with Get-Acl cmdlet', async () => {
      // SSM SendCommandのモック
      mockSsmSend
        .mockResolvedValueOnce({
          Command: { CommandId: 'test-command-id' },
        })
        .mockResolvedValueOnce({
          Status: 'Success',
          StandardOutputContent: JSON.stringify({
            Owner: 'DOMAIN\\Administrator',
            Group: 'DOMAIN\\Domain Admins',
            Access: [],
          }),
        });

      await service.getDetailedFilePermissions('\\\\fsxn\\share\\test.txt');

      // SendCommandCommandが呼ばれたことを確認
      expect(mockSsmSend).toHaveBeenCalledWith(
        expect.objectContaining({
          DocumentName: 'AWS-RunPowerShellScript',
          Parameters: expect.objectContaining({
            commands: expect.arrayContaining([
              expect.stringContaining('Get-Acl'),
            ]),
          }),
        })
      );
    });

    it('should include file path in PowerShell script', async () => {
      const testPath = '\\\\fsxn\\share\\documents\\report.docx';

      mockSsmSend
        .mockResolvedValueOnce({
          Command: { CommandId: 'test-command-id' },
        })
        .mockResolvedValueOnce({
          Status: 'Success',
          StandardOutputContent: JSON.stringify({
            Owner: 'DOMAIN\\User',
            Group: 'DOMAIN\\Users',
            Access: [],
          }),
        });

      await service.getDetailedFilePermissions(testPath);

      // ファイルパスがスクリプトに含まれることを確認
      expect(mockSsmSend).toHaveBeenCalledWith(
        expect.objectContaining({
          Parameters: expect.objectContaining({
            commands: expect.arrayContaining([
              expect.stringContaining('fsxn\\share\\documents\\report.docx'),
            ]),
          }),
        })
      );
    });

    it('should escape single quotes in file path', async () => {
      const testPath = "\\\\fsxn\\share\\user's folder\\file.txt";

      mockSsmSend
        .mockResolvedValueOnce({
          Command: { CommandId: 'test-command-id' },
        })
        .mockResolvedValueOnce({
          Status: 'Success',
          StandardOutputContent: JSON.stringify({
            Owner: 'DOMAIN\\User',
            Group: 'DOMAIN\\Users',
            Access: [],
          }),
        });

      await service.getDetailedFilePermissions(testPath);

      // シングルクォートがエスケープされることを確認
      expect(mockSsmSend).toHaveBeenCalledWith(
        expect.objectContaining({
          Parameters: expect.objectContaining({
            commands: expect.arrayContaining([
              expect.stringContaining("user''s folder"),
            ]),
          }),
        })
      );
    });

    it('should include ConvertTo-Json in script', async () => {
      mockSsmSend
        .mockResolvedValueOnce({
          Command: { CommandId: 'test-command-id' },
        })
        .mockResolvedValueOnce({
          Status: 'Success',
          StandardOutputContent: JSON.stringify({
            Owner: 'DOMAIN\\User',
            Group: 'DOMAIN\\Users',
            Access: [],
          }),
        });

      await service.getDetailedFilePermissions('\\\\fsxn\\share\\test.txt');

      // ConvertTo-Jsonが含まれることを確認
      expect(mockSsmSend).toHaveBeenCalledWith(
        expect.objectContaining({
          Parameters: expect.objectContaining({
            commands: expect.arrayContaining([
              expect.stringContaining('ConvertTo-Json'),
            ]),
          }),
        })
      );
    });
  });

  describe('Property 12: PowerShell ACLレスポンスのパース', () => {
    /**
     * PowerShell ACLレスポンスから必要なフィールドが正しく抽出されることを検証
     * Validates: Requirements 4.4
     */

    it('should parse basic ACL response with Owner and Group', async () => {
      const aclResponse = {
        Owner: 'DOMAIN\\Administrator',
        Group: 'DOMAIN\\Domain Admins',
        Access: [
          {
            IdentityReference: 'DOMAIN\\Administrator',
            FileSystemRights: 'FullControl',
            AccessControlType: 'Allow',
            IsInherited: false,
            InheritanceFlags: 'ContainerInherit, ObjectInherit',
            PropagationFlags: 'None',
          },
        ],
      };

      mockSsmSend
        .mockResolvedValueOnce({
          Command: { CommandId: 'test-command-id' },
        })
        .mockResolvedValueOnce({
          Status: 'Success',
          StandardOutputContent: JSON.stringify(aclResponse),
        });

      const result = await service.getDetailedFilePermissions('\\\\fsxn\\share\\test.txt');

      expect(result.Owner).toBe('DOMAIN\\Administrator');
      expect(result.Group).toBe('DOMAIN\\Domain Admins');
      expect(result.Access).toHaveLength(1);
      expect(result.Access[0].IdentityReference).toBe('DOMAIN\\Administrator');
      expect(result.Access[0].FileSystemRights).toBe('FullControl');
    });

    it('should parse ACL response with multiple access entries', async () => {
      const aclResponse = {
        Owner: 'DOMAIN\\User01',
        Group: 'DOMAIN\\Users',
        Access: [
          {
            IdentityReference: 'DOMAIN\\User01',
            FileSystemRights: 'FullControl',
            AccessControlType: 'Allow',
            IsInherited: false,
            InheritanceFlags: 'None',
            PropagationFlags: 'None',
          },
          {
            IdentityReference: 'DOMAIN\\Domain Users',
            FileSystemRights: 'ReadAndExecute, Synchronize',
            AccessControlType: 'Allow',
            IsInherited: true,
            InheritanceFlags: 'ContainerInherit, ObjectInherit',
            PropagationFlags: 'None',
          },
          {
            IdentityReference: 'BUILTIN\\Administrators',
            FileSystemRights: 'FullControl',
            AccessControlType: 'Allow',
            IsInherited: true,
            InheritanceFlags: 'ContainerInherit, ObjectInherit',
            PropagationFlags: 'None',
          },
        ],
      };

      mockSsmSend
        .mockResolvedValueOnce({
          Command: { CommandId: 'test-command-id' },
        })
        .mockResolvedValueOnce({
          Status: 'Success',
          StandardOutputContent: JSON.stringify(aclResponse),
        });

      const result = await service.getDetailedFilePermissions('\\\\fsxn\\share\\test.txt');

      expect(result.Access).toHaveLength(3);
      expect(result.Access[0].IdentityReference).toBe('DOMAIN\\User01');
      expect(result.Access[1].IdentityReference).toBe('DOMAIN\\Domain Users');
      expect(result.Access[2].IdentityReference).toBe('BUILTIN\\Administrators');
    });

    it('should parse ACL response with Deny entries', async () => {
      const aclResponse = {
        Owner: 'DOMAIN\\Administrator',
        Group: 'DOMAIN\\Domain Admins',
        Access: [
          {
            IdentityReference: 'DOMAIN\\RestrictedUser',
            FileSystemRights: 'Write',
            AccessControlType: 'Deny',
            IsInherited: false,
            InheritanceFlags: 'None',
            PropagationFlags: 'None',
          },
          {
            IdentityReference: 'DOMAIN\\RestrictedUser',
            FileSystemRights: 'Read',
            AccessControlType: 'Allow',
            IsInherited: false,
            InheritanceFlags: 'None',
            PropagationFlags: 'None',
          },
        ],
      };

      mockSsmSend
        .mockResolvedValueOnce({
          Command: { CommandId: 'test-command-id' },
        })
        .mockResolvedValueOnce({
          Status: 'Success',
          StandardOutputContent: JSON.stringify(aclResponse),
        });

      const result = await service.getDetailedFilePermissions('\\\\fsxn\\share\\test.txt');

      expect(result.Access).toHaveLength(2);
      expect(result.Access[0].AccessControlType).toBe('Deny');
      expect(result.Access[1].AccessControlType).toBe('Allow');
    });

    it('should parse ACL response with inherited permissions', async () => {
      const aclResponse = {
        Owner: 'DOMAIN\\User',
        Group: 'DOMAIN\\Users',
        Access: [
          {
            IdentityReference: 'DOMAIN\\User',
            FileSystemRights: 'FullControl',
            AccessControlType: 'Allow',
            IsInherited: false,
            InheritanceFlags: 'None',
            PropagationFlags: 'None',
          },
          {
            IdentityReference: 'BUILTIN\\Users',
            FileSystemRights: 'ReadAndExecute',
            AccessControlType: 'Allow',
            IsInherited: true,
            InheritanceFlags: 'ContainerInherit, ObjectInherit',
            PropagationFlags: 'None',
          },
        ],
      };

      mockSsmSend
        .mockResolvedValueOnce({
          Command: { CommandId: 'test-command-id' },
        })
        .mockResolvedValueOnce({
          Status: 'Success',
          StandardOutputContent: JSON.stringify(aclResponse),
        });

      const result = await service.getDetailedFilePermissions('\\\\fsxn\\share\\test.txt');

      expect(result.Access[0].IsInherited).toBe(false);
      expect(result.Access[1].IsInherited).toBe(true);
    });

    it('should handle ACL response with SID format identities', async () => {
      const aclResponse = {
        Owner: 'S-1-5-21-1234567890-1234567890-1234567890-500',
        Group: 'S-1-5-21-1234567890-1234567890-1234567890-512',
        Access: [
          {
            IdentityReference: 'S-1-5-21-1234567890-1234567890-1234567890-1001',
            FileSystemRights: 'FullControl',
            AccessControlType: 'Allow',
            IsInherited: false,
            InheritanceFlags: 'None',
            PropagationFlags: 'None',
          },
          {
            IdentityReference: 'S-1-5-32-544',
            FileSystemRights: 'FullControl',
            AccessControlType: 'Allow',
            IsInherited: true,
            InheritanceFlags: 'ContainerInherit, ObjectInherit',
            PropagationFlags: 'None',
          },
        ],
      };

      mockSsmSend
        .mockResolvedValueOnce({
          Command: { CommandId: 'test-command-id' },
        })
        .mockResolvedValueOnce({
          Status: 'Success',
          StandardOutputContent: JSON.stringify(aclResponse),
        });

      const result = await service.getDetailedFilePermissions('\\\\fsxn\\share\\test.txt');

      expect(result.Owner).toMatch(/^S-1-5-21-/);
      expect(result.Group).toMatch(/^S-1-5-21-/);
      expect(result.Access[0].IdentityReference).toMatch(/^S-1-5-21-/);
      expect(result.Access[1].IdentityReference).toBe('S-1-5-32-544');
    });
  });

  describe('SSM Error Handling', () => {
    it('should throw error when SSM command fails', async () => {
      mockSsmSend
        .mockResolvedValueOnce({
          Command: { CommandId: 'test-command-id' },
        })
        .mockResolvedValueOnce({
          Status: 'Failed',
          StandardErrorContent: 'Access denied',
        });

      await expect(
        service.getDetailedFilePermissions('\\\\fsxn\\share\\test.txt')
      ).rejects.toThrow('SSM execution failed');
    });

    it('should throw specific error on timeout for fallback', async () => {
      mockSsmSend
        .mockResolvedValueOnce({
          Command: { CommandId: 'test-command-id' },
        })
        .mockResolvedValueOnce({
          Status: 'TimedOut',
          StandardErrorContent: 'Command timed out',
        });

      await expect(
        service.getDetailedFilePermissions('\\\\fsxn\\share\\test.txt')
      ).rejects.toThrow('SSM_TIMEOUT_FALLBACK_TO_ONTAP');
    });

    it('should throw error when AD EC2 Instance ID is not configured', async () => {
      delete process.env.AD_EC2_INSTANCE_ID;
      const serviceWithoutInstanceId = new FsxPermissionService({
        volumeUuid: 'test-volume-uuid',
      });

      await expect(
        serviceWithoutInstanceId.getDetailedFilePermissions('\\\\fsxn\\share\\test.txt')
      ).rejects.toThrow('AD EC2 Instance ID not configured');
    });

    it('should throw error when ACL response is invalid JSON', async () => {
      mockSsmSend
        .mockResolvedValueOnce({
          Command: { CommandId: 'test-command-id' },
        })
        .mockResolvedValueOnce({
          Status: 'Success',
          StandardOutputContent: 'Invalid JSON response',
        });

      await expect(
        service.getDetailedFilePermissions('\\\\fsxn\\share\\test.txt')
      ).rejects.toThrow('Failed to parse PowerShell ACL response');
    });

    it('should throw error when ACL response is missing required fields', async () => {
      mockSsmSend
        .mockResolvedValueOnce({
          Command: { CommandId: 'test-command-id' },
        })
        .mockResolvedValueOnce({
          Status: 'Success',
          StandardOutputContent: JSON.stringify({
            // Ownerフィールドがない
            Group: 'DOMAIN\\Users',
          }),
        });

      await expect(
        service.getDetailedFilePermissions('\\\\fsxn\\share\\test.txt')
      ).rejects.toThrow('Failed to parse PowerShell ACL response');
    });
  });
});
