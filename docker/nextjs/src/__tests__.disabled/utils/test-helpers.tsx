/**
 * テストヘルパー関数
 * 
 * 機能:
 * - 共通のモックデータ作成
 * - テスト用レンダリング関数
 * - テスト用ユーティリティ
 */

import React from 'react';
import { render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { RawAgentInfo, NormalizedAgentInfo } from '../../types/bedrock-agent';

/**
 * テスト用の翻訳メッセージ
 */
export const createTestMessages = () => ({
  'region.title': 'Region',
  'chat.chatHistory': 'Chat History',
  'chat.saveHistory': 'Save History',
  'chat.autoTitleGeneration': 'Auto Title Generation',
  'sidebar.agentMode': 'Agent Mode',
  'chat.sessionActive': 'Session Active',
  'model.foundationModel': 'Foundation Model',
  'model.models': 'models',
  'model.select': 'Select',
  'permissions.available': 'Available',
  'model.requestAccess': 'Request Access',
  'common.loading': 'Loading...',
  'error.generic': 'An error occurred'
});

/**
 * Next-intl プロバイダーでラップしたレンダリング関数
 */
export const renderWithIntl = (component: React.ReactElement, locale: string = 'ja') => {
  const messages = createTestMessages();
  
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      {component}
    </NextIntlClientProvider>
  );
};

/**
 * セキュアなモック Agent 情報作成ヘルパー
 */
export const createMockAgentInfo = (overrides: Partial<RawAgentInfo> = {}): RawAgentInfo => {
  // 入力値のサニタイズ
  const sanitizeString = (value: unknown): string => {
    if (typeof value !== 'string') return '';
    return value.replace(/[<>\"'&]/g, ''); // XSS対策
  };

  const baseInfo: RawAgentInfo = {
    agentId: 'ABCDEFGHIJ',
    aliasName: 'TestAgent',
    version: '2',
    status: 'PREPARED',
    description: 'テスト用Agent'
  };

  // オーバーライド値をサニタイズ
  const sanitizedOverrides: Partial<RawAgentInfo> = {};
  Object.entries(overrides).forEach(([key, value]) => {
    if (typeof value === 'string') {
      sanitizedOverrides[key as keyof RawAgentInfo] = sanitizeString(value) as any;
    } else {
      sanitizedOverrides[key as keyof RawAgentInfo] = value;
    }
  });

  return {
    ...baseInfo,
    ...sanitizedOverrides
  };
};

/**
 * 正規化された Agent 情報作成ヘルパー
 */
export const createMockNormalizedAgentInfo = (overrides: Partial<NormalizedAgentInfo> = {}): NormalizedAgentInfo => ({
  agentId: 'ABCDEFGHIJ',
  alias: 'TestAgent',
  version: 2,
  status: 'PREPARED',
  description: 'テスト用Agent',
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-02T00:00:00Z'),
  foundationModel: 'anthropic.claude-v2',
  instruction: 'テスト指示',
  isActive: true,
  lastUsed: new Date('2024-01-02T00:00:00Z'),
  ...overrides
});

/**
 * 最小限の Agent 情報作成ヘルパー
 */
export const createMinimalMockAgentInfo = (agentId: string = 'ABCDEFGHIJ'): RawAgentInfo => ({
  agentId
});

/**
 * 無効な Agent 情報作成ヘルパー（テスト用）
 */
export const createInvalidMockAgentInfo = (type: 'missing-id' | 'invalid-type' = 'missing-id'): RawAgentInfo => {
  switch (type) {
    case 'missing-id':
      return {
        aliasName: 'TestAgent'
      } as RawAgentInfo;
    case 'invalid-type':
      return {
        agentId: 'ABCDEFGHIJ',
        aliasName: 123 as any,
        version: 'invalid-version'
      };
    default:
      return {} as RawAgentInfo;
  }
};

/**
 * テスト用のモック関数作成ヘルパー
 */
export const createMockFunction = <T extends (...args: any[]) => any>(): jest.MockedFunction<T> => {
  return jest.fn() as jest.MockedFunction<T>;
};

/**
 * 非同期テスト用のウェイト関数
 */
export const waitForNextTick = () => new Promise(resolve => setTimeout(resolve, 0));

/**
 * テスト用の環境変数設定ヘルパー
 */
export const setTestEnvironment = (env: 'development' | 'production' | 'test' = 'test') => {
  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = env;
  
  return () => {
    process.env.NODE_ENV = originalEnv;
  };
};

/**
 * コンソールモック設定ヘルパー
 */
export const mockConsole = () => {
  const originalConsole = { ...console };
  
  beforeEach(() => {
    jest.spyOn(console, 'debug').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
  });
  
  return originalConsole;
};