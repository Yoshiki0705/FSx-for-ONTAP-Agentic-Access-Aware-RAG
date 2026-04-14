/**
 * MediaPreviewService — Generate S3 presigned URLs for media previews.
 *
 * Key invariant: permission check MUST succeed before any presigned URL is
 * generated (Property 8).
 *
 * Requirements: 12.1, 12.2, 12.3, 12.4
 */

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { MediaPreviewResult, MediaType } from '@/types/multimodal';

/** Default presigned URL lifetime in seconds (15 minutes). */
const PRESIGNED_URL_EXPIRY_SECONDS = 15 * 60;

/** Permission checker function signature — injected to decouple from concrete impl. */
export type PermissionChecker = (
  s3Key: string,
  userPermissions: string[],
) => Promise<boolean>;

export class MediaPreviewService {
  private s3Client: S3Client;
  private bucket: string;
  private checkPermission: PermissionChecker;

  constructor(opts: {
    region?: string;
    bucket?: string;
    permissionChecker: PermissionChecker;
  }) {
    const region = opts.region || process.env.AWS_REGION || 'ap-northeast-1';
    this.s3Client = new S3Client({ region });
    this.bucket =
      opts.bucket || process.env.S3_ACCESS_POINT_ARN || process.env.S3_BUCKET || '';
    this.checkPermission = opts.permissionChecker;
  }

  /**
   * Generate a presigned URL for a media file after verifying permissions.
   *
   * If the permission check fails the method returns `null` — no URL is ever
   * created for unauthorised requests.
   */
  async generatePresignedUrl(
    s3Key: string,
    mediaType: MediaType,
    userPermissions: string[],
  ): Promise<MediaPreviewResult | null> {
    // --- Permission gate (MUST happen before URL generation) ---
    const allowed = await this.checkPermission(s3Key, userPermissions);
    if (!allowed) {
      return null;
    }

    // --- Generate presigned URL ---
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: s3Key,
    });

    const presignedUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: PRESIGNED_URL_EXPIRY_SECONDS,
    });

    const expiresAt = Math.floor(Date.now() / 1000) + PRESIGNED_URL_EXPIRY_SECONDS;

    return {
      presignedUrl,
      mediaType,
      expiresAt,
    };
  }

  /**
   * Refresh an expired presigned URL.
   * Re-runs the same permission + signing flow.
   */
  async refreshPresignedUrl(
    s3Key: string,
    mediaType: MediaType,
    userPermissions: string[],
  ): Promise<MediaPreviewResult | null> {
    return this.generatePresignedUrl(s3Key, mediaType, userPermissions);
  }
}
