'use client';

import { useState } from 'react';

interface FeedbackButtonsProps {
  responseId: string;
  query?: string;
  modelId?: string;
  routingTier?: string;
}

/**
 * 👍/👎 フィードバックボタン (#11, K-4)
 * チャット応答の下に表示し、ユーザーの評価を収集する。
 */
export function FeedbackButtons({
  responseId,
  query,
  modelId,
  routingTier,
}: FeedbackButtonsProps) {
  const [submitted, setSubmitted] = useState<'positive' | 'negative' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFeedback = async (rating: 'positive' | 'negative') => {
    if (submitted || isSubmitting) return;
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          responseId,
          rating,
          query,
          modelId,
          routingTier,
        }),
      });

      if (response.ok) {
        setSubmitted(rating);
      }
    } catch (error) {
      console.error('Feedback submission failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
        <span>{submitted === 'positive' ? '👍' : '👎'}</span>
        <span>フィードバックありがとうございます</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
      <button
        onClick={() => handleFeedback('positive')}
        disabled={isSubmitting}
        className="p-1 rounded hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
        aria-label="良い回答"
        title="良い回答"
      >
        <span className="text-sm">👍</span>
      </button>
      <button
        onClick={() => handleFeedback('negative')}
        disabled={isSubmitting}
        className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        aria-label="改善が必要"
        title="改善が必要"
      >
        <span className="text-sm">👎</span>
      </button>
    </div>
  );
}
