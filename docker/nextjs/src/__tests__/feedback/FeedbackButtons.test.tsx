/**
 * The thumbs: the answer is marked as sent only when the server says it saved the rating.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
import { FeedbackButtons } from '@/components/chat/FeedbackButtons';

function server(status: number, body: unknown) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
beforeEach(() => undefined);
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('FeedbackButtons', () => {
  it('posts the rating with the answer context and then shows the thanks', async () => {
    const f = server(200, { success: true, feedbackId: 'fb-1' });
    render(<FeedbackButtons responseId="s-1" query="q" modelId="m" routingTier="simple" sourcePaths={['s3://a/b']} />);
    fireEvent.click(screen.getByLabelText('good'));
    await waitFor(() => expect(screen.getByText('thanks')).toBeTruthy());
    const [url, init] = f.mock.calls[0] as unknown as [string, { body: string }];
    expect(url).toBe('/api/feedback');
    expect(JSON.parse(init.body)).toEqual({ responseId: 's-1', rating: 'positive', query: 'q', modelId: 'm', routingTier: 'simple', sourcePaths: ['s3://a/b'] });
  });
  it.each([
    ['a 503 (feedback is off)', 503, { success: false, error: 'feedback_disabled' }],
    ['a 502 (not saved)', 502, { success: false }],
    ['a 200 without success', 200, {}],
  ])('shows an error and keeps the buttons on %s', async (_label, status, body) => {
    server(status, body);
    render(<FeedbackButtons responseId="s-1" />);
    fireEvent.click(screen.getByLabelText('bad'));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('failed'));
    expect(screen.queryByText('thanks')).toBeNull();
    expect(screen.getByLabelText('good')).toBeTruthy();
  });
  it('shows an error when the request itself fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network'); }));
    render(<FeedbackButtons responseId="s-1" />);
    fireEvent.click(screen.getByLabelText('good'));
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
  });
});
