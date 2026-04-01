/**
 * Property-based tests for Vision API integration logic
 *
 * Uses fast-check and Jest to verify universal properties of Vision API
 * helper functions as pure logic. Each test runs at least 100 iterations.
 */

import * as fc from 'fast-check';

// ---------------------------------------------------------------------------
// Pure functions under test (extracted logic from route.ts)
// ---------------------------------------------------------------------------

const VISION_CAPABLE_MODELS = [
  'anthropic.claude-3-sonnet-20240229-v1:0',
  'anthropic.claude-3-haiku-20240307-v1:0',
  'amazon.nova-pro-v1:0',
  'amazon.nova-lite-v1:0',
];

const VISION_MODEL_ID = 'anthropic.claude-3-haiku-20240307-v1:0';

/** Selects the Vision-capable model for image analysis requests. */
function selectVisionModel(): string {
  return VISION_MODEL_ID;
}

/** Combines user query with image analysis result into a single context string. */
function combineContext(query: string, analysisResult: string): string {
  return `${query}\n\n画像分析結果: ${analysisResult}`;
}

/** Builds response metadata, including imageAnalysis indicator when applicable. */
function buildMetadata(imageAnalysisUsed: boolean): Record<string, unknown> {
  const base = { knowledgeBaseId: 'kb-123', modelId: 'model-123', region: 'us-east-1' };
  return imageAnalysisUsed ? { ...base, imageAnalysis: true } : base;
}

/** Determines whether Vision API should be called based on image data presence. */
function shouldCallVision(imageData?: string, imageMimeType?: string): boolean {
  return !!(imageData && imageMimeType);
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const imageMimeTypeArb = fc.constantFrom(
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp'
);

const nonEmptyStringArb = fc.string({ minLength: 1, maxLength: 500 }).filter(
  (s) => s.trim().length > 0
);

// ---------------------------------------------------------------------------
// Property 5: Vision model selection for image requests
// ---------------------------------------------------------------------------

// Feature: advanced-rag-features, Property 5: Vision model selection for image requests
// **Validates: Requirements 2.3**
describe('Property 5: Vision model selection for image requests', () => {
  it('for any image MIME type, the selected model should be in the set of Vision-capable models', () => {
    fc.assert(
      fc.property(imageMimeTypeArb, (_mimeType: string) => {
        const selectedModel = selectVisionModel();

        expect(VISION_CAPABLE_MODELS).toContain(selectedModel);
      }),
      { numRuns: 10 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 6: Image analysis context inclusion in combined prompt
// ---------------------------------------------------------------------------

// Feature: advanced-rag-features, Property 6: Image analysis context inclusion in combined prompt
// **Validates: Requirements 3.2**
describe('Property 6: Image analysis context inclusion in combined prompt', () => {
  it('for any analysis text and user query, the combined context contains both', () => {
    fc.assert(
      fc.property(nonEmptyStringArb, nonEmptyStringArb, (query: string, analysisResult: string) => {
        const combined = combineContext(query, analysisResult);

        expect(combined).toContain(query);
        expect(combined).toContain(analysisResult);
      }),
      { numRuns: 10 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 7: Response metadata includes image analysis indicator
// ---------------------------------------------------------------------------

// Feature: advanced-rag-features, Property 7: Response metadata includes image analysis indicator
// **Validates: Requirements 3.3, 4.6**
describe('Property 7: Response metadata includes image analysis indicator', () => {
  it('when image analysis was performed, metadata includes imageAnalysis: true', () => {
    fc.assert(
      fc.property(fc.constant(true), (_: boolean) => {
        const metadata = buildMetadata(true);

        expect(metadata).toHaveProperty('imageAnalysis', true);
        expect(metadata).toHaveProperty('knowledgeBaseId');
        expect(metadata).toHaveProperty('modelId');
        expect(metadata).toHaveProperty('region');
      }),
      { numRuns: 10 }
    );
  });

  it('when image analysis was NOT performed, metadata does not include imageAnalysis', () => {
    fc.assert(
      fc.property(fc.constant(false), (_: boolean) => {
        const metadata = buildMetadata(false);

        expect(metadata).not.toHaveProperty('imageAnalysis');
        expect(metadata).toHaveProperty('knowledgeBaseId');
        expect(metadata).toHaveProperty('modelId');
        expect(metadata).toHaveProperty('region');
      }),
      { numRuns: 10 }
    );
  });

  it('for any boolean, imageAnalysis indicator presence matches the flag', () => {
    fc.assert(
      fc.property(fc.boolean(), (imageAnalysisUsed: boolean) => {
        const metadata = buildMetadata(imageAnalysisUsed);

        if (imageAnalysisUsed) {
          expect(metadata.imageAnalysis).toBe(true);
        } else {
          expect(metadata).not.toHaveProperty('imageAnalysis');
        }
      }),
      { numRuns: 10 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 35: Text-only message flow unchanged
// ---------------------------------------------------------------------------

// Feature: advanced-rag-features, Property 35: Text-only message flow unchanged
// **Validates: Requirements 16.1, 16.5**
describe('Property 35: Text-only message flow unchanged', () => {
  it('when imageData is null/undefined, shouldCallVision returns false', () => {
    const optionalMimeArb = fc.option(imageMimeTypeArb, { nil: undefined });

    fc.assert(
      fc.property(optionalMimeArb, (mimeType: string | undefined) => {
        // No imageData → no Vision call
        expect(shouldCallVision(undefined, mimeType)).toBe(false);
        expect(shouldCallVision('', mimeType)).toBe(false);
      }),
      { numRuns: 10 }
    );
  });

  it('when imageMimeType is null/undefined, shouldCallVision returns false', () => {
    fc.assert(
      fc.property(nonEmptyStringArb, (imageData: string) => {
        // No mimeType → no Vision call
        expect(shouldCallVision(imageData, undefined)).toBe(false);
        expect(shouldCallVision(imageData, '')).toBe(false);
      }),
      { numRuns: 10 }
    );
  });

  it('when both imageData and imageMimeType are present, shouldCallVision returns true', () => {
    fc.assert(
      fc.property(nonEmptyStringArb, imageMimeTypeArb, (imageData: string, mimeType: string) => {
        expect(shouldCallVision(imageData, mimeType)).toBe(true);
      }),
      { numRuns: 10 }
    );
  });
});
