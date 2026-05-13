/**
 * Property 8: 接続品質劣化警告
 * 任意の WebRTC 統計情報に対して閾値超過時に isWarning=true となることを検証。
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { isQualityDegraded, WEBRTC_FALLBACK_CONFIG, type WebRTCStats } from '@/types/voice';

describe('Property 8: Connection quality degradation warning', () => {
  it('should set isWarning=true when packetLoss > 5% or RTT > 500ms', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 1, noNaN: true }),   // packetLoss (0-100%)
        fc.float({ min: 0, max: Math.fround(2000), noNaN: true }), // rtt (ms)
        fc.float({ min: 0, max: Math.fround(100), noNaN: true }),   // jitter (ms)
        (packetLoss, rtt, jitter) => {
          const stats: WebRTCStats = {
            packetLoss,
            rtt,
            jitter,
            bytesReceived: 0,
            bytesSent: 0,
            timestamp: Date.now(),
          };

          const isDegraded = isQualityDegraded(stats);
          const expectedDegraded =
            packetLoss > WEBRTC_FALLBACK_CONFIG.qualityWarningThresholds.packetLossRate ||
            rtt > WEBRTC_FALLBACK_CONFIG.qualityWarningThresholds.rttMs;

          expect(isDegraded).toBe(expectedDegraded);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('should not warn when both metrics are within thresholds', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: Math.fround(0.049), noNaN: true }),  // packetLoss < 5%
        fc.float({ min: 0, max: Math.fround(499), noNaN: true }),     // rtt < 500ms
        (packetLoss, rtt) => {
          const stats: WebRTCStats = {
            packetLoss,
            rtt,
            jitter: 0,
            bytesReceived: 0,
            bytesSent: 0,
            timestamp: Date.now(),
          };

          expect(isQualityDegraded(stats)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should always warn when packetLoss exceeds threshold', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0.051), max: 1, noNaN: true }), // packetLoss > 5%
        fc.float({ min: 0, max: Math.fround(2000), noNaN: true }),
        (packetLoss, rtt) => {
          const stats: WebRTCStats = {
            packetLoss,
            rtt,
            jitter: 0,
            bytesReceived: 0,
            bytesSent: 0,
            timestamp: Date.now(),
          };

          expect(isQualityDegraded(stats)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
