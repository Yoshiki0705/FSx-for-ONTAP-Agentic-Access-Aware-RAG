/**
 * Property 5: Feature Flag UI Display Control
 *
 * For *any* multimodal-only UI component (MediaTypeIndicator, MediaPreview,
 * MediaTypeFilter, ImageSearchAction's similarity button), when
 * MULTIMODAL_ENABLED=false the component does not render, and when
 * MULTIMODAL_ENABLED=true it does render.
 *
 * **Validates: Requirements 9.3**
 */

import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { useMultimodalStore } from '@/store/useMultimodalStore';

// ---------------------------------------------------------------------------
// Mock next-intl (not used by these components but may be pulled transitively)
// ---------------------------------------------------------------------------
import { vi } from 'vitest';
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

// ---------------------------------------------------------------------------
// Imports under test
// ---------------------------------------------------------------------------
import { MediaTypeIndicator } from '@/components/chat/MediaTypeIndicator';
import { MediaPreview } from '@/components/chat/MediaPreview';
import { MediaTypeFilter } from '@/components/chat/MediaTypeFilter';
import { ImageSearchAction } from '@/components/chat/ImageSearchAction';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setMultimodalEnabled(enabled: boolean) {
  useMultimodalStore.setState({ multimodalEnabled: enabled });
}

// ---------------------------------------------------------------------------
// Property tests
// ---------------------------------------------------------------------------

describe('Property 5: Feature Flag UI Display Control', () => {
  beforeEach(() => {
    cleanup();
  });

  it('MediaTypeIndicator renders only when multimodalEnabled=true', () => {
    fc.assert(
      fc.property(fc.boolean(), (enabled) => {
        setMultimodalEnabled(enabled);
        const { container } = render(
          <MediaTypeIndicator mediaType="image" />,
        );
        const hasContent = container.innerHTML.length > 0;
        expect(hasContent).toBe(enabled);
        cleanup();
      }),
      { numRuns: 100 },
    );
  });

  it('MediaPreview renders only when multimodalEnabled=true', () => {
    fc.assert(
      fc.property(fc.boolean(), (enabled) => {
        setMultimodalEnabled(enabled);
        const { container } = render(
          <MediaPreview
            mediaType="image"
            presignedUrl="https://example.com/img.jpg"
            fileName="test.jpg"
          />,
        );
        const hasContent = container.innerHTML.length > 0;
        expect(hasContent).toBe(enabled);
        cleanup();
      }),
      { numRuns: 100 },
    );
  });

  it('MediaTypeFilter renders only when multimodalEnabled=true', () => {
    fc.assert(
      fc.property(fc.boolean(), (enabled) => {
        setMultimodalEnabled(enabled);
        const { container } = render(<MediaTypeFilter />);
        const hasContent = container.innerHTML.length > 0;
        expect(hasContent).toBe(enabled);
        cleanup();
      }),
      { numRuns: 100 },
    );
  });

  it('ImageSearchAction similarity button renders only when multimodalEnabled=true', () => {
    fc.assert(
      fc.property(fc.boolean(), (enabled) => {
        setMultimodalEnabled(enabled);
        const { queryByTestId } = render(
          <ImageSearchAction onSelect={() => {}} />,
        );
        const similarityBtn = queryByTestId('similarity-search-button');
        if (enabled) {
          expect(similarityBtn).not.toBeNull();
        } else {
          expect(similarityBtn).toBeNull();
        }
        cleanup();
      }),
      { numRuns: 100 },
    );
  });
});
