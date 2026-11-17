'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ThumbsDown, ThumbsUp } from 'lucide-react';

interface FeedbackButtonsProps {
  responseId: string;
  query?: string;
  modelId?: string;
  routingTier?: string;
  /** S3 URIs of the citations shown with the answer; the server keeps only their hashes. */
  sourcePaths?: string[];
}

/**
 * Thumbs up / down under one answer. It is rendered only when the collector is configured
 * (`feedbackEnabled` from /api/config/features). The answer is marked as sent only when the
 * server says it saved the rating; any other answer shows an error and leaves the buttons on.
 */
export function FeedbackButtons({ responseId, query, modelId, routingTier, sourcePaths }: FeedbackButtonsProps) {
  const t = useTranslations('feedback');
  const [submitted, setSubmitted] = useState<'positive' | 'negative' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);

  const send = async (rating: 'positive' | 'negative') => {
    if (submitted || isSubmitting) return;
    setIsSubmitting(true);
    setFailed(false);
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responseId, rating, query, modelId, routingTier, sourcePaths }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.success === true) setSubmitted(rating);
      else setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex items-center gap-1 mt-1 text-xs text-gray-500 dark:text-gray-400">
        {submitted === 'positive' ? (
          <ThumbsUp className="w-4 h-4 inline-block align-text-bottom" aria-hidden="true" />
        ) : (
          <ThumbsDown className="w-4 h-4 inline-block align-text-bottom" aria-hidden="true" />
        )}
        <span>{t('thanks')}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1 mt-1">
      <button
        type="button"
        onClick={() => send('positive')}
        disabled={isSubmitting}
        className="p-1 rounded text-gray-500 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors disabled:opacity-50"
        aria-label={t('good')}
        title={t('good')}
      >
        <ThumbsUp className="w-4 h-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => send('negative')}
        disabled={isSubmitting}
        className="p-1 rounded text-gray-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
        aria-label={t('bad')}
        title={t('bad')}
      >
        <ThumbsDown className="w-4 h-4" aria-hidden="true" />
      </button>
      {failed && (
        <span role="alert" className="text-xs text-red-700 dark:text-red-300">
          {t('failed')}
        </span>
      )}
    </div>
  );
}
