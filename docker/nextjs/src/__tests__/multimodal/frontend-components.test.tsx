/**
 * Frontend Unit Tests — Multimodal Components
 *
 * - MediaPreview: image / video / audio preview rendering
 * - EmbeddingModelInfo: model name + badge display
 * - ImageSearchAction: two-action display
 * - MediaPreview failure: placeholder display
 *
 * Requirements: 4.2, 4.3, 4.4, 6.1, 7.1, 7.2, 11.1, 11.3
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { useMultimodalStore } from '@/store/useMultimodalStore';

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

import { MediaPreview } from '@/components/chat/MediaPreview';
import { EmbeddingModelInfo } from '@/components/sidebar/EmbeddingModelInfo';
import { ImageSearchAction } from '@/components/chat/ImageSearchAction';
import { DualKBToggle } from '@/components/search/DualKBToggle';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function enableMultimodal(opts?: { dualKbMode?: boolean; modelName?: string }) {
  useMultimodalStore.setState({
    multimodalEnabled: true,
    dualKbMode: opts?.dualKbMode ?? false,
    embeddingModelName: opts?.modelName ?? 'Amazon Nova Multimodal Embeddings',
  });
}

function disableMultimodal() {
  useMultimodalStore.setState({
    multimodalEnabled: false,
    dualKbMode: false,
    embeddingModelName: 'Amazon Titan Text Embeddings v2',
  });
}

// ---------------------------------------------------------------------------
// MediaPreview tests
// ---------------------------------------------------------------------------

describe('MediaPreview', () => {
  beforeEach(() => {
    cleanup();
    enableMultimodal();
  });

  it('renders image thumbnail with max 200px width', () => {
    const { getByRole } = render(
      <MediaPreview
        mediaType="image"
        presignedUrl="https://example.com/photo.jpg"
        fileName="photo.jpg"
      />,
    );
    const img = getByRole('img');
    expect(img).toBeTruthy();
    expect(img.className).toContain('max-w-[200px]');
  });

  it('renders video preview with timestamp range', () => {
    const { getByTestId, getByText } = render(
      <MediaPreview
        mediaType="video"
        presignedUrl="https://example.com/clip.mp4"
        fileName="clip.mp4"
        timestampRange={{ start: 65, end: 130 }}
      />,
    );
    expect(getByTestId('media-preview-video')).toBeTruthy();
    expect(getByText('1:05 – 2:10')).toBeTruthy();
  });

  it('renders audio preview with duration', () => {
    const { getByTestId, getByText } = render(
      <MediaPreview
        mediaType="audio"
        presignedUrl="https://example.com/track.mp3"
        fileName="track.mp3"
        duration={185}
      />,
    );
    expect(getByTestId('media-preview-audio')).toBeTruthy();
    expect(getByText('3:05')).toBeTruthy();
  });

  it('shows placeholder when presignedUrl is missing', () => {
    const { getByTestId, getByText } = render(
      <MediaPreview mediaType="image" fileName="missing.jpg" />,
    );
    expect(getByTestId('media-preview-placeholder')).toBeTruthy();
    expect(getByText('missing.jpg')).toBeTruthy();
  });

  it('shows placeholder on image load error', async () => {
    const { getByRole, getByTestId } = render(
      <MediaPreview
        mediaType="image"
        presignedUrl="https://example.com/broken.jpg"
        fileName="broken.jpg"
      />,
    );
    const img = getByRole('img');
    fireEvent.error(img);
    // After error with no refresh handler, should show placeholder
    expect(getByTestId('media-preview-placeholder')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// EmbeddingModelInfo tests
// ---------------------------------------------------------------------------

describe('EmbeddingModelInfo', () => {
  beforeEach(() => cleanup());

  it('shows multimodal badge when multimodalEnabled=true', () => {
    enableMultimodal({ modelName: 'Amazon Nova Multimodal Embeddings' });
    const { getByTestId, getByText } = render(<EmbeddingModelInfo />);
    expect(getByTestId('embedding-model-info')).toBeTruthy();
    expect(getByTestId('multimodal-badge')).toBeTruthy();
    expect(getByText('Amazon Nova Multimodal Embeddings')).toBeTruthy();
  });

  it('shows text-only badge when multimodalEnabled=false', () => {
    disableMultimodal();
    const { getByTestId, getByText } = render(<EmbeddingModelInfo />);
    expect(getByTestId('text-only-badge')).toBeTruthy();
    expect(getByText('Amazon Titan Text Embeddings v2')).toBeTruthy();
  });

  it('displays CDK redeploy note', () => {
    disableMultimodal();
    const { getByText } = render(<EmbeddingModelInfo />);
    expect(
      getByText(/CDK redeploy/i),
    ).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// ImageSearchAction tests
// ---------------------------------------------------------------------------

describe('ImageSearchAction', () => {
  beforeEach(() => cleanup());

  it('shows both Vision and Similarity buttons when multimodal enabled', () => {
    enableMultimodal();
    const onSelect = vi.fn();
    const { getByText, getByTestId } = render(
      <ImageSearchAction onSelect={onSelect} />,
    );
    expect(getByText(/Vision Analysis/)).toBeTruthy();
    expect(getByTestId('similarity-search-button')).toBeTruthy();
  });

  it('shows only Vision button when multimodal disabled', () => {
    disableMultimodal();
    const onSelect = vi.fn();
    const { getByText, queryByTestId } = render(
      <ImageSearchAction onSelect={onSelect} />,
    );
    expect(getByText(/Vision Analysis/)).toBeTruthy();
    expect(queryByTestId('similarity-search-button')).toBeNull();
  });

  it('calls onSelect with correct action', () => {
    enableMultimodal();
    const onSelect = vi.fn();
    const { getByText } = render(
      <ImageSearchAction onSelect={onSelect} />,
    );
    fireEvent.click(getByText(/Vision Analysis/));
    expect(onSelect).toHaveBeenCalledWith('vision');
  });
});

// ---------------------------------------------------------------------------
// DualKBToggle tests
// ---------------------------------------------------------------------------

describe('DualKBToggle', () => {
  beforeEach(() => cleanup());

  it('renders when dualKbMode=true', () => {
    enableMultimodal({ dualKbMode: true });
    const { getByTestId } = render(<DualKBToggle />);
    expect(getByTestId('dual-kb-toggle')).toBeTruthy();
  });

  it('does not render when dualKbMode=false', () => {
    enableMultimodal({ dualKbMode: false });
    const { queryByTestId } = render(<DualKBToggle />);
    expect(queryByTestId('dual-kb-toggle')).toBeNull();
  });

  it('toggles activeKbType on click', () => {
    enableMultimodal({ dualKbMode: true });
    useMultimodalStore.setState({ activeKbType: 'text' });
    const { getByText } = render(<DualKBToggle />);
    fireEvent.click(getByText(/Multimodal Search/));
    expect(useMultimodalStore.getState().activeKbType).toBe('multimodal');
  });
});
