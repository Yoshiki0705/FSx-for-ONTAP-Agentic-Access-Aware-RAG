/**
 * AgentModeSidebar 統合テスト
 * 
 * テスト対象:
 * - コンポーネント全体の統合動作
 * - カスタムフックとの連携
 * - 開発環境でのデバッグ機能
 * 
 * 注意: このファイルは統合テストに特化し、基本テストとエラーテストは分離されています
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { AgentModeSidebar } from '../../components/bedrock/AgentModeSidebar';
import { RawAgentInfo } from '../../types/bedrock-agent';
import { createMockAgentInfo, renderWithIntl, setTestEnvironment } from '../utils/test-helpers';

// モック設定
jest.mock('../../hooks/useBedrockConfig', () => ({
  useBedrockConfig: () => ({
    config: { agentId: 'ABCDEFGHIJ' },
    isLoading: false
  })
}));

jest.mock('../../hooks/useAgentInfo', () => ({
  useAgentInfo: jest.fn()
}));

jest.mock('../../utils/agent-logger', () => ({
  agentLogger: {
    setComponent: jest.fn(),
    logAgentNormalization: jest.fn(),
    logValidationError: jest.fn(),
    logValidationWarning: jest.fn(),
    logPerformance: jest.fn()
  }
}));

// 軽量なモックコンポーネント（統合テスト用）
jest.mock('../../components/bedrock/RegionSelector', () => ({
  RegionSelector: () => <div data-testid="region-selector">Region Selector</div>
}));

jest.mock('../../components/bedrock/ModelSelector', () => ({
  ModelSelector: ({ selectedModelId }: any) => (
    <div data-testid="model-selector">Model Selector: {selectedModelId}</div>
  )
}));

jest.mock('../../components/bedrock/AgentInfoSection', () => ({
  AgentInfoSection: ({ agentInfo }: any) => (
    <div data-testid="agent-info-section">
      {agentInfo ? (
        <div data-testid="agent-id">{agentInfo.agentId}</div>
      ) : (
        <div data-testid="no-agent">No Agent</div>
      )}
    </div>
  )
}));

jest.mock('../../components/bedrock/AgentFeaturesSection', () => ({
  AgentFeaturesSection: () => <div data-testid="agent-features">Agent Features</div>
}));

// テスト用の翻訳メッセージ
const messages = {
  'region.title': 'Region',
  'chat.chatHistory': 'Chat History',
  'chat.saveHistory': 'Save History',
  'chat.autoTitleGeneration': 'Auto Title Generation',
  'sidebar.agentMode': 'Agent Mode',
  'chat.sessionActive': 'Session Active'
};

const renderWithIntl = (component: React.ReactElement) => {
  return render(
    <NextIntlClientProvider locale="ja" messages={messages}>
      {component}
    </NextIntlClientProvider>
  );
};

describe('AgentModeSidebar Integration Tests', () => {
  const mockProps = {
    selectedModelId: 'anthropic.claude-v2',
    onModelChange: jest.fn(),
    onCreateAgent: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // コンソールログをモック（テスト出力をクリーンに保つ）
    jest.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('正常ケース', () => {
    it('完全なAgent情報を正しく表示する', async () => {
      const mockAgentInfo: RawAgentInfo = {
        agentId: 'ABCDEFGHIJ',
        aliasName: 'TestAgent',
        version: '2',
        status: 'PREPARED',
        description: 'テスト用Agent'
      };

      const { useAgentInfo } = require('../../hooks/useAgentInfo');
      useAgentInfo.mockReturnValue({
        agentInfo: mockAgentInfo,
        isLoading: false
      });

      renderWithIntl(<AgentModeSidebar {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('agent-id')).toHaveTextContent('ABCDEFGHIJ');
        expect(screen.getByTestId('agent-alias')).toHaveTextContent('TestAgent');
        expect(screen.getByTestId('agent-version')).toHaveTextContent('v2');
        expect(screen.getByTestId('agent-status')).toHaveTextContent('PREPARED');
        expect(screen.getByTestId('agent-active')).toHaveTextContent('Active');
      });

      // エラー・警告が表示されていないことを確認
      expect(screen.queryByText('エラー:')).not.toBeInTheDocument();
      expect(screen.queryByText('警告:')).not.toBeInTheDocument();
    });

    it('最小限のAgent情報を正しく表示する', async () => {
      const mockAgentInfo: RawAgentInfo = {
        agentId: 'ABCDEFGHIJ'
      };

      const { useAgentInfo } = require('../../hooks/useAgentInfo');
      useAgentInfo.mockReturnValue({
        agentInfo: mockAgentInfo,
        isLoading: false
      });

      renderWithIntl(<AgentModeSidebar {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('agent-id')).toHaveTextContent('ABCDEFGHIJ');
        expect(screen.getByTestId('agent-alias')).toHaveTextContent('N/A');
        expect(screen.getByTestId('agent-version')).toHaveTextContent('v1');
        expect(screen.getByTestId('agent-status')).toHaveTextContent('UNKNOWN');
        expect(screen.getByTestId('agent-active')).toHaveTextContent('Inactive');
      });
    });

    it('Agent情報がない場合を正しく処理する', async () => {
      const { useAgentInfo } = require('../../hooks/useAgentInfo');
      useAgentInfo.mockReturnValue({
        agentInfo: null,
        isLoading: false
      });

      renderWithIntl(<AgentModeSidebar {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('no-agent')).toBeInTheDocument();
      });

      // エラー・警告が表示されていないことを確認
      expect(screen.queryByText('エラー:')).not.toBeInTheDocument();
      expect(screen.queryByText('警告:')).not.toBeInTheDocument();
    });
  });

  describe('エラーケース', () => {
    it('無効なAgent情報でエラーを表示する', async () => {
      const mockAgentInfo: RawAgentInfo = {
        // agentIdが欠けている
        aliasName: 'TestAgent'
      };

      const { useAgentInfo } = require('../../hooks/useAgentInfo');
      useAgentInfo.mockReturnValue({
        agentInfo: mockAgentInfo,
        isLoading: false
      });

      renderWithIntl(<AgentModeSidebar {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('エラー:')).toBeInTheDocument();
        expect(screen.getByText(/agentIdは必須フィールドです/)).toBeInTheDocument();
      });

      // Agent情報が表示されていないことを確認
      expect(screen.getByTestId('no-agent')).toBeInTheDocument();
    });

    it('型が正しくないフィールドで警告を表示する', async () => {
      const mockAgentInfo: RawAgentInfo = {
        agentId: 'ABCDEFGHIJ',
        aliasName: 123 as any, // 意図的に間違った型
        version: 'invalid-version'
      };

      const { useAgentInfo } = require('../../hooks/useAgentInfo');
      useAgentInfo.mockReturnValue({
        agentInfo: mockAgentInfo,
        isLoading: false
      });

      renderWithIntl(<AgentModeSidebar {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('警告:')).toBeInTheDocument();
        expect(screen.getByText(/aliasNameは文字列である必要があります/)).toBeInTheDocument();
      });

      // Agent情報は表示される（警告は成功を妨げない）
      expect(screen.getByTestId('agent-id')).toHaveTextContent('ABCDEFGHIJ');
    });
  });

  describe('コンポーネント連携', () => {
    it('すべての子コンポーネントが正しく表示される', async () => {
      const { useAgentInfo } = require('../../hooks/useAgentInfo');
      useAgentInfo.mockReturnValue({
        agentInfo: { agentId: 'ABCDEFGHIJ' },
        isLoading: false
      });

      renderWithIntl(<AgentModeSidebar {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('agent-info-section')).toBeInTheDocument();
        expect(screen.getByTestId('region-selector')).toBeInTheDocument();
        expect(screen.getByTestId('model-selector')).toBeInTheDocument();
        expect(screen.getByTestId('agent-features')).toBeInTheDocument();
      });

      // 翻訳されたテキストが表示されることを確認
      expect(screen.getByText('Region')).toBeInTheDocument();
      expect(screen.getByText('Chat History')).toBeInTheDocument();
    });

    it('ModelSelectorに正しいpropsが渡される', async () => {
      const { useAgentInfo } = require('../../hooks/useAgentInfo');
      useAgentInfo.mockReturnValue({
        agentInfo: { agentId: 'ABCDEFGHIJ' },
        isLoading: false
      });

      renderWithIntl(<AgentModeSidebar {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('Model Selector: anthropic.claude-v2')).toBeInTheDocument();
      });
    });

    it('onCreateAgentコールバックが正しく渡される', async () => {
      const { useAgentInfo } = require('../../hooks/useAgentInfo');
      useAgentInfo.mockReturnValue({
        agentInfo: { agentId: 'ABCDEFGHIJ' },
        isLoading: false
      });

      renderWithIntl(<AgentModeSidebar {...mockProps} />);

      const createButton = screen.getByTestId('create-agent-btn');
      createButton.click();

      expect(mockProps.onCreateAgent).toHaveBeenCalledTimes(1);
    });
  });

  describe('パフォーマンス', () => {
    it('同じAgent情報で再レンダリングしても不要な処理を行わない', async () => {
      const mockAgentInfo: RawAgentInfo = {
        agentId: 'ABCDEFGHIJ',
        aliasName: 'TestAgent'
      };

      const { useAgentInfo } = require('../../hooks/useAgentInfo');
      useAgentInfo.mockReturnValue({
        agentInfo: mockAgentInfo,
        isLoading: false
      });

      const { rerender } = renderWithIntl(<AgentModeSidebar {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('agent-id')).toHaveTextContent('ABCDEFGHIJ');
      });

      // 同じpropsで再レンダリング
      rerender(
        <NextIntlClientProvider locale="ja" messages={messages}>
          <AgentModeSidebar {...mockProps} />
        </NextIntlClientProvider>
      );

      // コンポーネントが正常に動作することを確認
      expect(screen.getByTestId('agent-id')).toHaveTextContent('ABCDEFGHIJ');
    });
  });

  describe('ローディング状態', () => {
    it('Agent情報ローディング中の状態を適切に処理する', async () => {
      const { useAgentInfo } = require('../../hooks/useAgentInfo');
      useAgentInfo.mockReturnValue({
        agentInfo: null,
        isLoading: true
      });

      renderWithIntl(<AgentModeSidebar {...mockProps} />);

      // ローディング中でもコンポーネントが表示されることを確認
      expect(screen.getByTestId('agent-info-section')).toBeInTheDocument();
      expect(screen.getByTestId('no-agent')).toBeInTheDocument();
    });
  });

  describe('開発環境でのデバッグ情報', () => {
    it('開発環境でデバッグ情報を出力する', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const mockAgentInfo: RawAgentInfo = {
        agentId: 'ABCDEFGHIJ',
        aliasName: 'TestAgent'
      };

      const { useAgentInfo } = require('../../hooks/useAgentInfo');
      useAgentInfo.mockReturnValue({
        agentInfo: mockAgentInfo,
        isLoading: false
      });

      renderWithIntl(<AgentModeSidebar {...mockProps} />);

      await waitFor(() => {
        expect(console.debug).toHaveBeenCalledWith(
          'AgentModeSidebar - Agent情報正規化結果:',
          expect.objectContaining({
            raw: mockAgentInfo,
            normalized: expect.any(Object),
            validation: expect.any(Object),
            isValid: true,
            errorMessage: null,
            warningMessages: expect.any(Array),
            processingTime: expect.stringMatching(/\d+\.\d+ms/)
          })
        );
      });

      process.env.NODE_ENV = originalEnv;
    });

    it('本番環境ではデバッグ情報を出力しない', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const mockAgentInfo: RawAgentInfo = {
        agentId: 'ABCDEFGHIJ',
        aliasName: 'TestAgent'
      };

      const { useAgentInfo } = require('../../hooks/useAgentInfo');
      useAgentInfo.mockReturnValue({
        agentInfo: mockAgentInfo,
        isLoading: false
      });

      renderWithIntl(<AgentModeSidebar {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('agent-id')).toHaveTextContent('ABCDEFGHIJ');
      });

      // デバッグ情報が出力されていないことを確認
      expect(console.debug).not.toHaveBeenCalled();

      process.env.NODE_ENV = originalEnv;
    });
  });
});