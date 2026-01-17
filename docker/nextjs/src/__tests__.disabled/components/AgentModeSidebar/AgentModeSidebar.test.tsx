/**
 * AgentModeSidebar 基本テスト
 * 
 * テスト対象:
 * - 基本的なレンダリング
 * - Props の受け渡し
 * - 基本的なユーザーインタラクション
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { AgentModeSidebar } from '../../../components/bedrock/AgentModeSidebar';
import { RawAgentInfo } from '../../../types/bedrock-agent';
import { createMockAgentInfo, createTestMessages, renderWithIntl } from '../../utils/test-helpers';

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

jest.mock('../../../components/bedrock/RegionSelector', () => ({
  RegionSelector: () => <div data-testid="region-selector">Region Selector</div>
}));

jest.mock('../../../components/bedrock/ModelSelector', () => ({
  ModelSelector: ({ selectedModelId, onModelChange }: any) => (
    <div data-testid="model-selector">
      Model Selector: {selectedModelId}
      <button onClick={() => onModelChange('new-model')}>Change Model</button>
    </div>
  )
}));

jest.mock('../../../components/bedrock/AgentInfoSection', () => ({
  AgentInfoSection: ({ agentInfo, onCreateAgent }: any) => (
    <div data-testid="agent-info-section">
      {agentInfo ? (
        <div>
          <div data-testid="agent-id">{agentInfo.agentId}</div>
          <div data-testid="agent-alias">{agentInfo.alias}</div>
          <div data-testid="agent-version">v{agentInfo.version}</div>
          <div data-testid="agent-status">{agentInfo.status}</div>
          <div data-testid="agent-active">{agentInfo.isActive ? 'Active' : 'Inactive'}</div>
        </div>
      ) : (
        <div data-testid="no-agent">No Agent</div>
      )}
      <button onClick={onCreateAgent} data-testid="create-agent-btn">Create Agent</button>
    </div>
  )
}));

jest.mock('../../../components/bedrock/AgentFeaturesSection', () => ({
  AgentFeaturesSection: () => <div data-testid="agent-features">Agent Features</div>
}));

describe('AgentModeSidebar', () => {
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

  describe('基本レンダリング', () => {
    it('すべての子コンポーネントが正しく表示される', async () => {
      const { useAgentInfo } = require('../../../hooks/useAgentInfo');
      useAgentInfo.mockReturnValue({
        agentInfo: createMockAgentInfo({ agentId: 'ABCDEFGHIJ' }),
        isLoading: false
      });

      renderWithIntl(<AgentModeSidebar {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('agent-info-section')).toBeInTheDocument();
        expect(screen.getByTestId('region-selector')).toBeInTheDocument();
        expect(screen.getByTestId('model-selector')).toBeInTheDocument();
        expect(screen.getByTestId('agent-features')).toBeInTheDocument();
      });
    });

    it('翻訳されたテキストが正しく表示される', async () => {
      const { useAgentInfo } = require('../../../hooks/useAgentInfo');
      useAgentInfo.mockReturnValue({
        agentInfo: createMockAgentInfo({ agentId: 'ABCDEFGHIJ' }),
        isLoading: false
      });

      renderWithIntl(<AgentModeSidebar {...mockProps} />);

      expect(screen.getByText('Region')).toBeInTheDocument();
      expect(screen.getByText('Chat History')).toBeInTheDocument();
    });
  });

  describe('Props の受け渡し', () => {
    it('ModelSelectorに正しいpropsが渡される', async () => {
      const { useAgentInfo } = require('../../../hooks/useAgentInfo');
      useAgentInfo.mockReturnValue({
        agentInfo: createMockAgentInfo({ agentId: 'ABCDEFGHIJ' }),
        isLoading: false
      });

      renderWithIntl(<AgentModeSidebar {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('Model Selector: anthropic.claude-v2')).toBeInTheDocument();
      });
    });

    it('onCreateAgentコールバックが正しく渡される', async () => {
      const { useAgentInfo } = require('../../../hooks/useAgentInfo');
      useAgentInfo.mockReturnValue({
        agentInfo: createMockAgentInfo({ agentId: 'ABCDEFGHIJ' }),
        isLoading: false
      });

      renderWithIntl(<AgentModeSidebar {...mockProps} />);

      const createButton = screen.getByTestId('create-agent-btn');
      createButton.click();

      expect(mockProps.onCreateAgent).toHaveBeenCalledTimes(1);
    });
  });
});