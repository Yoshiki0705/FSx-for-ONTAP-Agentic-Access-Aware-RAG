'use client';

import { useRef, useEffect } from 'react';

interface WaveformAnimationProps {
  analyserNode: AnalyserNode | null;
  type: 'input' | 'output';
  isActive: boolean;
}

/**
 * 波形アニメーションコンポーネント
 * Canvas ベースで AnalyserNode の周波数データをリアルタイム描画する。
 */
export function WaveformAnimation({ analyserNode, type, isActive }: WaveformAnimationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  // prefers-reduced-motion チェック
  const prefersReducedMotion = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (!isActive || !analyserNode || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    // 色設定: 入力=青系、出力=緑系
    const color = type === 'input' ? '#3B82F6' : '#10B981';

    const draw = () => {
      if (!isActive) return;

      analyserNode.getByteFrequencyData(dataArray);

      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      if (prefersReducedMotion) {
        // 静的インジケーター（音量レベルバー）
        const avg = dataArray.reduce((sum, v) => sum + v, 0) / bufferLength;
        const barHeight = (avg / 255) * height;
        ctx.fillStyle = color;
        ctx.fillRect(width / 2 - 20, height - barHeight, 40, barHeight);
      } else {
        // 波形描画
        const barWidth = (width / bufferLength) * 2.5;
        let x = 0;
        for (let i = 0; i < bufferLength; i++) {
          const barHeight = (dataArray[i] / 255) * height;
          ctx.fillStyle = color;
          ctx.fillRect(x, height - barHeight, barWidth, barHeight);
          x += barWidth + 1;
        }
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isActive, analyserNode, type, prefersReducedMotion]);

  if (!isActive || !analyserNode) return null;

  return (
    <canvas
      ref={canvasRef}
      width={300}
      height={40}
      className="w-full h-10 rounded"
      aria-label={type === 'input' ? '入力音声波形' : '出力音声波形'}
      role="img"
    />
  );
}
