/**
 * Unit Test: hasDocumentAnalysisIntent ヘルパー関数
 *
 * ドキュメント分析意図キーワードの検出テスト。
 * 日本語・英語両方のキーワードをサポート。
 *
 * Validates: Requirements 1.2, 1.5
 */
import { describe, it, expect } from 'vitest';
import { hasDocumentAnalysisIntent } from '@/lib/complexity-classifier';

describe('hasDocumentAnalysisIntent', () => {
  describe('日本語キーワード検出', () => {
    it('「この文書を要約」を含むクエリでtrueを返す', () => {
      expect(hasDocumentAnalysisIntent('この文書を要約してください')).toBe(true);
    });

    it('「レポート全体を分析」を含むクエリでtrueを返す', () => {
      expect(hasDocumentAnalysisIntent('レポート全体を分析してほしい')).toBe(true);
    });

    it('「文書全体」を含むクエリでtrueを返す', () => {
      expect(hasDocumentAnalysisIntent('文書全体の内容を教えて')).toBe(true);
    });

    it('「ドキュメントを要約」を含むクエリでtrueを返す', () => {
      expect(hasDocumentAnalysisIntent('このドキュメントを要約して')).toBe(true);
    });

    it('「全文を分析」を含むクエリでtrueを返す', () => {
      expect(hasDocumentAnalysisIntent('全文を分析してください')).toBe(true);
    });

    it('「資料全体」を含むクエリでtrueを返す', () => {
      expect(hasDocumentAnalysisIntent('資料全体を確認して')).toBe(true);
    });

    it('「報告書を要約」を含むクエリでtrueを返す', () => {
      expect(hasDocumentAnalysisIntent('報告書を要約してください')).toBe(true);
    });

    it('「ファイル全体」を含むクエリでtrueを返す', () => {
      expect(hasDocumentAnalysisIntent('ファイル全体を読んで')).toBe(true);
    });
  });

  describe('英語キーワード検出', () => {
    it('"summarize this document" を含むクエリでtrueを返す', () => {
      expect(hasDocumentAnalysisIntent('Please summarize this document for me')).toBe(true);
    });

    it('"analyze the full report" を含むクエリでtrueを返す', () => {
      expect(hasDocumentAnalysisIntent('Can you analyze the full report?')).toBe(true);
    });

    it('"summarize the entire" を含むクエリでtrueを返す', () => {
      expect(hasDocumentAnalysisIntent('summarize the entire file')).toBe(true);
    });

    it('"analyze the whole" を含むクエリでtrueを返す', () => {
      expect(hasDocumentAnalysisIntent('analyze the whole document')).toBe(true);
    });

    it('"full document analysis" を含むクエリでtrueを返す', () => {
      expect(hasDocumentAnalysisIntent('I need a full document analysis')).toBe(true);
    });

    it('"review the complete" を含むクエリでtrueを返す', () => {
      expect(hasDocumentAnalysisIntent('review the complete report')).toBe(true);
    });

    it('"process the entire" を含むクエリでtrueを返す', () => {
      expect(hasDocumentAnalysisIntent('process the entire file')).toBe(true);
    });
  });

  describe('case-insensitive（英語）', () => {
    it('大文字を含む英語キーワードでもtrueを返す', () => {
      expect(hasDocumentAnalysisIntent('SUMMARIZE THIS DOCUMENT please')).toBe(true);
    });

    it('混合ケースの英語キーワードでもtrueを返す', () => {
      expect(hasDocumentAnalysisIntent('Analyze The Full Report now')).toBe(true);
    });
  });

  describe('キーワードなし', () => {
    it('関連キーワードを含まないクエリでfalseを返す', () => {
      expect(hasDocumentAnalysisIntent('今日の天気は？')).toBe(false);
    });

    it('空文字列でfalseを返す', () => {
      expect(hasDocumentAnalysisIntent('')).toBe(false);
    });

    it('部分一致しないクエリでfalseを返す', () => {
      expect(hasDocumentAnalysisIntent('summarize this')).toBe(false);
    });

    it('一般的な英語クエリでfalseを返す', () => {
      expect(hasDocumentAnalysisIntent('What is the capital of France?')).toBe(false);
    });
  });
});
