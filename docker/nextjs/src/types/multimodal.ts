/**
 * Multimodal RAG Search — Shared Type Definitions
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 13.2, 13.3, 12.1
 */

/** Supported media types for multimodal search results */
export type MediaType = 'text' | 'image' | 'video' | 'audio';

/** KB routing modes */
export type KBMode = 'replace' | 'dual';

/** Active KB type for Dual KB mode */
export type ActiveKBType = 'text' | 'multimodal';

/** Media type filter options */
export type MediaTypeFilter = 'all' | MediaType;

// ---------------------------------------------------------------------------
// KB Query Router types (used by kb-query-router.ts)
// ---------------------------------------------------------------------------

export interface KBRouterConfig {
  textKbId: string;
  multimodalKbId: string;
  mode: KBMode;
}

export type RouteReason =
  | 'text-only-query'
  | 'image-query'
  | 'multimodal-query'
  | 'user-toggle'
  | 'single-kb';

export interface RouteDecision {
  targetKbId: string;
  reason: RouteReason;
}

// ---------------------------------------------------------------------------
// Media Preview types (used by media-preview-service.ts)
// ---------------------------------------------------------------------------

export interface MediaPreviewResult {
  presignedUrl: string;
  mediaType: MediaType;
  expiresAt: number; // Unix timestamp (seconds)
  thumbnailUrl?: string;
  duration?: number; // seconds (video / audio)
  timestampRange?: { start: number; end: number };
}

// ---------------------------------------------------------------------------
// Multimodal Citation (extends existing Citation shape)
// ---------------------------------------------------------------------------

export interface MediaMetadata {
  mimeType: string;
  fileSizeBytes?: number;
  duration?: number;
  timestampRange?: {
    startSeconds: number;
    endSeconds: number;
  };
  dimensions?: {
    width: number;
    height: number;
  };
}

export interface MultimodalCitation {
  // Existing citation fields
  content: string;
  location: { s3Location: { uri: string } };
  score: number;

  // Multimodal extensions (present only when MULTIMODAL_ENABLED=true)
  mediaType?: MediaType;
  mediaMetadata?: MediaMetadata;
  presignedUrl?: string;
  presignedUrlExpiresAt?: number; // Unix timestamp (seconds)
}
