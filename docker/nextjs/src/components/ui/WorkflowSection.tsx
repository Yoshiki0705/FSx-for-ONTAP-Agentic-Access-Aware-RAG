'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { getCardsByMode, CardData } from '@/constants/card-constants';
import { useAgentStore } from '@/store/useAgentStore';
import { resolveAgentForCard } from '@/services/cardAgentBindingService';
import { useCardAgentMappingStore } from '@/store/useCardAgentMappingStore';

interface WorkflowSectionProps {
  locale: string;
  selectedAgentId: string | null;
  onWorkflowSelect: (prompt: string, label: string, agentId?: string) => void;
}

export function WorkflowSection({
  locale: _locale,
  selectedAgentId,
  onWorkflowSelect,
}: WorkflowSectionProps) {
  const tSidebar = useTranslations('sidebar');
  const tCards = useTranslations('cards');

  // Internal state for agent resolution
  const [isResolving, setIsResolving] = useState(false);
  const [resolvingCardId, setResolvingCardId] = useState<string | null>(null);
  const [progressMessage, setProgressMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const agentCards = getCardsByMode('agent');

  const handleCardClick = useCallback(async (card: CardData) => {
    // Block clicks while resolving
    if (isResolving) return;

    const title = tCards(card.titleKey.replace(/^cards\./, ''));
    const prompt = tCards(card.promptTemplateKey.replace(/^cards\./, ''));

    setIsResolving(true);
    setResolvingCardId(card.id);
    setProgressMessage(null);
    setErrorMessage(null);

    try {
      const mappingStore = useCardAgentMappingStore.getState();

      const result = await resolveAgentForCard(card, mappingStore, (progress) => {
        setProgressMessage(progress.message);
      });

      // Update AgentStore with resolved agent ID
      useAgentStore.getState().setSelectedAgentId(result.agentId);

      // Fire agent-workflow-selected CustomEvent (existing compatibility)
      if (typeof window !== 'undefined') {
        const event = new CustomEvent('agent-workflow-selected', {
          detail: { prompt, label: title },
          bubbles: true,
        });
        window.dispatchEvent(event);
      }

      // Call onWorkflowSelect callback
      onWorkflowSelect(prompt, title, result.agentId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Agent解決に失敗しました';
      setErrorMessage(message);

      // Clear error after 5 seconds
      setTimeout(() => {
        setErrorMessage(null);
      }, 5000);
    } finally {
      setIsResolving(false);
      setResolvingCardId(null);
      setProgressMessage(null);
    }
  }, [isResolving, tCards, onWorkflowSelect]);

  const isHighlighted = (card: CardData): boolean => {
    return card.agentId !== undefined && card.agentId === selectedAgentId;
  };

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
        🔧 {tSidebar('workflow')}
      </h3>
      <div className="space-y-1">
        {agentCards.map((card) => {
          const title = tCards(card.titleKey.replace(/^cards\./, ''));
          const highlighted = isHighlighted(card);
          const isThisCardResolving = isResolving && resolvingCardId === card.id;
          const isDisabledDuringResolve = isResolving && resolvingCardId !== card.id;

          return (
            <button
              key={card.id}
              onClick={() => handleCardClick(card)}
              disabled={isResolving}
              className={`w-full text-left px-2 py-1.5 text-xs rounded-md transition-colors flex items-center space-x-2
                ${
                  highlighted
                    ? 'border border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                    : 'hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-700 dark:text-gray-300'
                }
                ${isDisabledDuringResolve ? 'pointer-events-none opacity-50' : ''}
                ${isThisCardResolving ? 'border border-yellow-400 bg-yellow-50 dark:border-yellow-500 dark:bg-yellow-900/20' : ''}
              `}
            >
              {isThisCardResolving ? (
                <>
                  <span className="animate-spin inline-block">⏳</span>
                  <span className="truncate">{progressMessage || title}</span>
                </>
              ) : (
                <>
                  <span>{card.icon}</span>
                  <span>{title}</span>
                </>
              )}
            </button>
          );
        })}
        {/* Error message display */}
        {errorMessage && !isResolving && (
          <div className="px-2 py-1.5 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-md">
            ⚠️ {errorMessage}
          </div>
        )}
      </div>
    </div>
  );
}
