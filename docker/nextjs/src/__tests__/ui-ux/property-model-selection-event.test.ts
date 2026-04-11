/**
 * Property-Based Test: モデル選択イベントの発火 (Property 4)
 *
 * Feature: ui-ux-optimization, Property 4: モデル選択イベントの発火
 *
 * 任意の有効なモデルIDに対して、ModelIndicatorでそのモデルを選択した場合、
 * `modelChanged`カスタムイベントが発火され、`event.detail.modelId`が
 * 選択したモデルIDと一致すること。
 *
 * **Validates: Requirements 5.3**
 */

import React from 'react';
import * as fc from 'fast-check';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';

// --- Mocks ---

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      label: 'Model selector',
      fallbackNotice: 'Model changed',
    };
    return translations[key] ?? key;
  },
}));

jest.mock('lucide-react', () => ({
  ChevronDown: (props: Record<string, unknown>) =>
    React.createElement('svg', { 'data-testid': 'chevron-down', ...props }),
}));

jest.mock('@/utils/truncateText', () => ({
  truncateText: (text: string, _maxLength: number) => text,
}));

jest.mock('@/utils/modelCompatibility', () => ({
  resolveModelForMode: (
    currentModelId: string,
    _targetMode: string,
    _kbModels: string[],
    _agentModels: string[],
    _defaultKb: string,
    _defaultAgent: string,
  ) => ({
    modelId: currentModelId,
    didFallback: false,
    previousModelId: currentModelId,
  }),
}));

import ModelIndicator from '../../components/bedrock/ModelIndicator';

// Feature: ui-ux-optimization, Property 4: モデル選択イベントの発火
describe('Feature: ui-ux-optimization, Property 4: モデル選択イベントの発火', () => {
  afterEach(() => {
    cleanup();
  });

  it('モデル選択時に modelChanged カスタムイベントが発火され、event.detail.modelId が一致する', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        (modelId: string) => {
          cleanup();

          // Set up a listener on window for the modelChanged event
          let capturedModelId: string | null = null;
          const handler = (e: Event) => {
            capturedModelId = (e as CustomEvent).detail.modelId;
          };
          window.addEventListener('modelChanged', handler);

          try {
            const selectedModelId = 'initial-model';
            const models = [
              { modelId: selectedModelId, modelName: 'Initial Model' },
              { modelId: modelId, modelName: `Model ${modelId}` },
            ];

            render(
              React.createElement(ModelIndicator, {
                selectedModelId,
                selectedModelName: 'Initial Model',
                onModelChange: jest.fn(),
                mode: 'kb' as const,
                models,
              }),
            );

            // Click the trigger button to open the dropdown
            const trigger = screen.getByRole('button');
            fireEvent.click(trigger);

            // Find and click the target model option
            const options = screen.getAllByRole('option');
            // The second option corresponds to the generated modelId
            const targetOption = options[1];
            fireEvent.click(targetOption);

            // Verify the modelChanged event was dispatched with the correct modelId
            expect(capturedModelId).toBe(modelId);
          } finally {
            window.removeEventListener('modelChanged', handler);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
