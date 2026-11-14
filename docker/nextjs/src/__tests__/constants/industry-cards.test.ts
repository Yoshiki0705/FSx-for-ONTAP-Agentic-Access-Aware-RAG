import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { INDUSTRIES, INDUSTRY_CARDS, KB_CARDS, getIndustryCards } from '@/constants/card-constants';

const LOCALES = ['ja', 'en', 'ko', 'zh-CN', 'zh-TW', 'fr', 'de', 'es'];
const messagesDir = path.resolve(__dirname, '../../messages');

function lookup(messages: any, key: string): unknown {
  return key
    .replace(/^cards\./, '')
    .split('.')
    .reduce((node, part) => (node == null ? undefined : node[part]), messages.cards);
}

describe('industry cards', () => {
  it('has three cards for every industry and unique ids across all KB cards', () => {
    for (const industry of INDUSTRIES) {
      expect(getIndustryCards(industry.id)).toHaveLength(3);
    }
    const ids = [...KB_CARDS, ...INDUSTRY_CARDS].map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('does not change the general-purpose KB cards', () => {
    expect(KB_CARDS.every((c) => c.industry === undefined)).toBe(true);
  });

  it.each(LOCALES)('%s has a non-empty string for every industry key', (locale) => {
    const messages = JSON.parse(fs.readFileSync(path.join(messagesDir, `${locale}.json`), 'utf8'));
    for (const industry of INDUSTRIES) {
      expect(typeof lookup(messages, industry.labelKey)).toBe('string');
    }
    for (const card of INDUSTRY_CARDS) {
      for (const key of [card.titleKey, card.descriptionKey, card.promptTemplateKey]) {
        const value = lookup(messages, key);
        expect(typeof value, `${locale}: ${key}`).toBe('string');
        expect((value as string).trim().length, `${locale}: ${key}`).toBeGreaterThan(0);
      }
    }
    expect(typeof lookup(messages, 'cards.industrySelector.label')).toBe('string');
    expect(typeof lookup(messages, 'cards.industrySelector.general')).toBe('string');
  });
});
