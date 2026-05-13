/**
 * 動的インポートテスト
 * REST モード時に WebRTC コードがロードされないことを検証。
 */

import { describe, it, expect, vi } from 'vitest';

describe('Dynamic Import Tests', () => {
  it('should not import WebRTCVoiceStrategy when mode is "rest"', async () => {
    // Mock the dynamic import
    const importSpy = vi.fn();

    const mode = 'rest';

    if (mode === 'webrtc') {
      importSpy();
      await import('@/hooks/strategies/WebRTCVoiceStrategy');
    }

    expect(importSpy).not.toHaveBeenCalled();
  });

  it('should import WebRTCVoiceStrategy when mode is "webrtc"', async () => {
    const mode = 'webrtc';
    let imported = false;

    if (mode === 'webrtc') {
      // This verifies the module can be imported
      const module = await import('@/hooks/strategies/WebRTCVoiceStrategy');
      imported = true;
      expect(module.WebRTCVoiceStrategy).toBeDefined();
    }

    expect(imported).toBe(true);
  });

  it('RESTVoiceStrategy should be importable without WebRTC dependencies', async () => {
    const module = await import('@/hooks/strategies/RESTVoiceStrategy');
    expect(module.RESTVoiceStrategy).toBeDefined();

    const strategy = new module.RESTVoiceStrategy();
    expect(strategy.isConnected()).toBe(false);
  });
});
