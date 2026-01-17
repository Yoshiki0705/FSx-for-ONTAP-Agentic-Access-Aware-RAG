/**
 * AgentModeSidebar エラーハンドリングテスト
 * 
 * テスト対象:
 * - エラー状態の表示
 * - 警告メッセージの表示
 * - 無効なデータの処理
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { AgentModeSidebar } from '../../../components/bedrock/AgentModeSidebar';
import { RawAgentInfo } from '../../../types/bedrock-agent';
import { createMockAgentInfo, renderWithIntl } from '../../utils/test-helpers';

// モック設定
jest.mock('../../../hooks/useBedrockConfig', () => ({
  useBedrockConfig: () => ({
    config: { agentId: 'ABCDEFGHIJ' },
    isLoading: false
  })
}));

jest.mock('../../../hooks/useAgentInfo', () => ({
  useAgentInfo: jest.fn()
}));

// 他のコンポーネントのモック
jest.mock('../../../components/bedrock/RegionSelector', () => ({
  RegionSelector: () => <div data-testid="region-selector">Region Selector</div>
}));

jest.mock('../../../components/bedrock/ModelSelector', () => ({
  ModelSelector: ({ selectedModelId }: any) => (
    <div data-testid="model-selector">Model Selector: {selectedModelId}</div>
  )
}));

jest.mock('../../../components/bedrock/AgentInfoSection', () => ({
  AgentInfoSection: ({ agentInfo }: any) => (
    <div data-testid="agent-info-section">
      {agentInfo ? (
        <div>
          <div data-testid="agent-id">{agentInfo.agentId}</div>
          <div data-testid="agent-alias">{agentInfo.alias}</div>
        </div>
      ) : (
        <div data-testid="no-agent">No Agent</div>
      )}
    </div>
  )
}));

jest.mock('../../../components/bedrock/AgentFeaturesSection', () => ({
  AgentFeaturesSection: () => <div data-testid="agent-features">Agent Features</div>
}));

describe('AgentModeSidebar - エラーハンドリング', () => {
  const mockProps = {
    selectedModelId: 'anthropic.claude-v2',
    onModelChange: jest.fn(),
    onCreateAgent: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('エラーケース', () => {
    it('無効なAgent情報でエラーを表示する', async () => {
      const mockAgentInfo: RawAgentInfo = {
        // agentIdが欠けている
        aliasName: 'TestAgent'
      };

      const { useAgentInfo } = require('../../../hooks/useAgentInfo');
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

      const { useAgentInfo } = require('../../../hooks/useAgentInfo');
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

    it('Agent情報がない場合を正しく処理する', async () => {
      const { useAgentInfo } = require('../../../hooks/useAgentInfo');
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

  describe('ローディング状態', () => {
    it('Agent情報ローディング中の状態を適切に処理する', async () => {
      const { useAgentInfo } = require('../../../hooks/useAgentInfo');
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
});