/**
 * Logger Service テスト
 * 
 * Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6
 */

import { Logger, LogLevel, LogCategory, getLogger } from '../logger';

describe('Logger Service', () => {
  let logger: Logger;
  let consoleLogSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    logger = getLogger();
    logger.clearContext();
    
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('Requirements 7.1: 権限チェック開始ログ', () => {
    it('should log permission check start', () => {
      logger.logPermissionCheckStart('user01', '/shared/documents');

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const logEntry = JSON.parse(consoleLogSpy.mock.calls[0][0]);

      expect(logEntry.level).toBe(LogLevel.INFO);
      expect(logEntry.category).toBe(LogCategory.PERMISSION_CHECK);
      expect(logEntry.message).toBe('権限チェック開始');
      expect(logEntry.context.userId).toBe('user01');
      expect(logEntry.context.path).toBe('/shared/documents');
      expect(logEntry.timestamp).toBeDefined();
    });

    it('should include additional context', () => {
      logger.logPermissionCheckStart('user01', '/shared/documents', {
        requestId: 'req-123',
        ipAddress: '192.168.1.1',
      });

      const logEntry = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(logEntry.context.requestId).toBe('req-123');
      expect(logEntry.context.ipAddress).toBe('192.168.1.1');
    });
  });

  describe('Requirements 7.6: 権限チェック完了ログ', () => {
    it('should log permission check complete with duration', () => {
      logger.logPermissionCheckComplete('user01', '/shared/documents', true, 150);

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const logEntry = JSON.parse(consoleLogSpy.mock.calls[0][0]);

      expect(logEntry.level).toBe(LogLevel.INFO);
      expect(logEntry.category).toBe(LogCategory.PERMISSION_CHECK);
      expect(logEntry.message).toBe('権限チェック完了');
      expect(logEntry.context.userId).toBe('user01');
      expect(logEntry.context.path).toBe('/shared/documents');
      expect(logEntry.context.result).toBe(true);
      expect(logEntry.duration).toBe(150);
    });

    it('should log denied access', () => {
      logger.logPermissionCheckComplete('user01', '/shared/documents', false, 100, {
        reason: 'time-restriction',
      });

      const logEntry = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(logEntry.context.result).toBe(false);
      expect(logEntry.context.reason).toBe('time-restriction');
    });
  });

  describe('Requirements 7.2: ONTAP REST API呼び出しログ', () => {
    it('should log ONTAP API start', () => {
      logger.logOntapApiStart('/api/protocols/cifs/shares', 'GET');

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const logEntry = JSON.parse(consoleLogSpy.mock.calls[0][0]);

      expect(logEntry.level).toBe(LogLevel.INFO);
      expect(logEntry.category).toBe(LogCategory.ONTAP_API);
      expect(logEntry.message).toBe('ONTAP REST API呼び出し開始');
      expect(logEntry.context.endpoint).toBe('/api/protocols/cifs/shares');
      expect(logEntry.context.method).toBe('GET');
    });

    it('should log ONTAP API complete with status code', () => {
      logger.logOntapApiComplete('/api/protocols/cifs/shares', 'GET', 200, 250);

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const logEntry = JSON.parse(consoleLogSpy.mock.calls[0][0]);

      expect(logEntry.level).toBe(LogLevel.INFO);
      expect(logEntry.category).toBe(LogCategory.ONTAP_API);
      expect(logEntry.message).toBe('ONTAP REST API呼び出し完了');
      expect(logEntry.context.statusCode).toBe(200);
      expect(logEntry.duration).toBe(250);
    });

    it('should log ONTAP API error', () => {
      const error = new Error('Connection timeout');
      logger.logOntapApiError('/api/protocols/cifs/shares', 'GET', error);

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      const logEntry = JSON.parse(consoleErrorSpy.mock.calls[0][0]);

      expect(logEntry.level).toBe(LogLevel.ERROR);
      expect(logEntry.category).toBe(LogCategory.ONTAP_API);
      expect(logEntry.message).toBe('ONTAP REST APIエラー');
      expect(logEntry.error.name).toBe('Error');
      expect(logEntry.error.message).toBe('Connection timeout');
      expect(logEntry.error.stack).toBeDefined();
    });
  });

  describe('Requirements 7.3: SSM PowerShell実行ログ', () => {
    it('should log SSM PowerShell start', () => {
      logger.logSsmPowerShellStart('i-1234567890abcdef0', '/scripts/get-acl.ps1');

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const logEntry = JSON.parse(consoleLogSpy.mock.calls[0][0]);

      expect(logEntry.level).toBe(LogLevel.INFO);
      expect(logEntry.category).toBe(LogCategory.SSM_POWERSHELL);
      expect(logEntry.message).toBe('SSM PowerShell実行開始');
      expect(logEntry.context.instanceId).toBe('i-1234567890abcdef0');
      expect(logEntry.context.scriptPath).toBe('/scripts/get-acl.ps1');
    });

    it('should log SSM PowerShell complete', () => {
      logger.logSsmPowerShellComplete(
        'i-1234567890abcdef0',
        '/scripts/get-acl.ps1',
        'cmd-123',
        'Success',
        3000
      );

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const logEntry = JSON.parse(consoleLogSpy.mock.calls[0][0]);

      expect(logEntry.level).toBe(LogLevel.INFO);
      expect(logEntry.category).toBe(LogCategory.SSM_POWERSHELL);
      expect(logEntry.message).toBe('SSM PowerShell実行完了');
      expect(logEntry.context.commandId).toBe('cmd-123');
      expect(logEntry.context.status).toBe('Success');
      expect(logEntry.duration).toBe(3000);
    });

    it('should log SSM PowerShell error', () => {
      const error = new Error('Script execution failed');
      logger.logSsmPowerShellError('i-1234567890abcdef0', '/scripts/get-acl.ps1', error);

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      const logEntry = JSON.parse(consoleErrorSpy.mock.calls[0][0]);

      expect(logEntry.level).toBe(LogLevel.ERROR);
      expect(logEntry.category).toBe(LogCategory.SSM_POWERSHELL);
      expect(logEntry.message).toBe('SSM PowerShellエラー');
      expect(logEntry.error.message).toBe('Script execution failed');
    });
  });

  describe('Requirements 7.4: キャッシュ使用ログ', () => {
    it('should log cache hit', () => {
      logger.logCacheHit('user01', '/shared/documents');

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const logEntry = JSON.parse(consoleLogSpy.mock.calls[0][0]);

      expect(logEntry.level).toBe(LogLevel.INFO);
      expect(logEntry.category).toBe(LogCategory.CACHE);
      expect(logEntry.message).toBe('キャッシュヒット');
      expect(logEntry.context.userId).toBe('user01');
      expect(logEntry.context.path).toBe('/shared/documents');
      expect(logEntry.context.cacheResult).toBe('hit');
    });

    it('should log cache miss with reason', () => {
      logger.logCacheMiss('user01', '/shared/documents', 'TTL expired');

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const logEntry = JSON.parse(consoleLogSpy.mock.calls[0][0]);

      expect(logEntry.level).toBe(LogLevel.INFO);
      expect(logEntry.category).toBe(LogCategory.CACHE);
      expect(logEntry.message).toBe('キャッシュミス');
      expect(logEntry.context.cacheResult).toBe('miss');
      expect(logEntry.context.reason).toBe('TTL expired');
    });

    it('should log cache save', () => {
      const ttl = Math.floor(Date.now() / 1000) + 300;
      logger.logCacheSave('user01', '/shared/documents', ttl);

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const logEntry = JSON.parse(consoleLogSpy.mock.calls[0][0]);

      expect(logEntry.level).toBe(LogLevel.INFO);
      expect(logEntry.category).toBe(LogCategory.CACHE);
      expect(logEntry.message).toBe('キャッシュ保存');
      expect(logEntry.context.ttl).toBe(ttl);
    });

    it('should log cache delete', () => {
      logger.logCacheDelete('user01', '/shared/documents');

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const logEntry = JSON.parse(consoleLogSpy.mock.calls[0][0]);

      expect(logEntry.level).toBe(LogLevel.INFO);
      expect(logEntry.category).toBe(LogCategory.CACHE);
      expect(logEntry.message).toBe('キャッシュ削除');
    });
  });

  describe('Requirements 7.5: エラーログ', () => {
    it('should log generic error', () => {
      const error = new Error('Unexpected error');
      logger.logError('処理中にエラーが発生しました', error, {
        userId: 'user01',
        operation: 'permission-check',
      });

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      const logEntry = JSON.parse(consoleErrorSpy.mock.calls[0][0]);

      expect(logEntry.level).toBe(LogLevel.ERROR);
      expect(logEntry.category).toBe(LogCategory.ERROR);
      expect(logEntry.message).toBe('処理中にエラーが発生しました');
      expect(logEntry.error.name).toBe('Error');
      expect(logEntry.error.message).toBe('Unexpected error');
      expect(logEntry.context.userId).toBe('user01');
      expect(logEntry.context.operation).toBe('permission-check');
    });

    it('should log warning', () => {
      logger.logWarning('キャッシュ保存に失敗しました', {
        userId: 'user01',
      });

      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      const logEntry = JSON.parse(consoleWarnSpy.mock.calls[0][0]);

      expect(logEntry.level).toBe(LogLevel.WARN);
      expect(logEntry.category).toBe(LogCategory.ERROR);
      expect(logEntry.message).toBe('キャッシュ保存に失敗しました');
    });
  });

  describe('Global Context', () => {
    it('should set and use global context', () => {
      logger.setContext({
        requestId: 'req-global-123',
        sessionId: 'session-456',
      });

      logger.logPermissionCheckStart('user01', '/shared/documents');

      const logEntry = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(logEntry.context.requestId).toBe('req-global-123');
      expect(logEntry.context.sessionId).toBe('session-456');
      expect(logEntry.context.userId).toBe('user01');
    });

    it('should merge global and local context', () => {
      logger.setContext({ requestId: 'req-123' });

      logger.logPermissionCheckStart('user01', '/shared/documents', {
        ipAddress: '192.168.1.1',
      });

      const logEntry = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(logEntry.context.requestId).toBe('req-123');
      expect(logEntry.context.ipAddress).toBe('192.168.1.1');
    });

    it('should clear global context', () => {
      logger.setContext({ requestId: 'req-123' });
      logger.clearContext();

      logger.logPermissionCheckStart('user01', '/shared/documents');

      const logEntry = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(logEntry.context.requestId).toBeUndefined();
    });
  });

  describe('Timer Utility', () => {
    it('should measure duration', async () => {
      const timer = logger.startTimer();
      
      // 50ms待機
      await new Promise((resolve) => setTimeout(resolve, 50));
      
      const duration = timer();
      
      expect(duration).toBeGreaterThanOrEqual(50);
      expect(duration).toBeLessThan(100);
    });

    it('should be reusable', () => {
      const timer = logger.startTimer();
      
      const duration1 = timer();
      const duration2 = timer();
      
      expect(duration2).toBeGreaterThanOrEqual(duration1);
    });
  });

  describe('Log Levels', () => {
    it('should log INFO to console.log', () => {
      logger.logInfo(LogCategory.PERMISSION_CHECK, 'Info message');
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    });

    it('should log WARN to console.warn', () => {
      logger.logWarning('Warning message');
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    });

    it('should log ERROR to console.error', () => {
      const error = new Error('Test error');
      logger.logError('Error message', error);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });

    it('should log DEBUG to console.log', () => {
      logger.logDebug(LogCategory.CACHE, 'Debug message');
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Singleton Pattern', () => {
    it('should return same instance', () => {
      const logger1 = getLogger();
      const logger2 = getLogger();
      
      expect(logger1).toBe(logger2);
    });

    it('should share context across instances', () => {
      const logger1 = getLogger();
      const logger2 = getLogger();
      
      logger1.setContext({ requestId: 'req-123' });
      
      logger2.logPermissionCheckStart('user01', '/test');
      
      const logEntry = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(logEntry.context.requestId).toBe('req-123');
    });
  });
});
