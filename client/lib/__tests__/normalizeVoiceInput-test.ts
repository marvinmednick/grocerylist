import { normalizeVoiceInput } from '@/lib/parser';

describe('normalizeVoiceInput', () => {
  describe('word-to-number normalization', () => {
    it('converts "two milk" → "2 milk"', () => {
      expect(normalizeVoiceInput('two milk', [])).toBe('2 milk');
    });

    it('converts "three cans chicken broth" → "3 cans chicken broth"', () => {
      expect(normalizeVoiceInput('three cans chicken broth', [])).toBe('3 cans chicken broth');
    });

    it('converts "half pound salmon" → "0.5 pound salmon"', () => {
      expect(normalizeVoiceInput('half pound salmon', [])).toBe('0.5 pound salmon');
    });

    it('converts "dozen eggs" → "12 eggs"', () => {
      expect(normalizeVoiceInput('dozen eggs', [])).toBe('12 eggs');
    });

    it('converts "twelve" → "12"', () => {
      expect(normalizeVoiceInput('twelve', [])).toBe('12');
    });

    it('is case-insensitive: "Two Pounds" → "2 Pounds"', () => {
      expect(normalizeVoiceInput('Two Pounds', [])).toBe('2 Pounds');
    });

    it('does not replace substrings: "attend" stays "attend"', () => {
      expect(normalizeVoiceInput('attend', [])).toBe('attend');
    });

    it('does not replace substrings: "fourteen" stays "fourteen"', () => {
      expect(normalizeVoiceInput('fourteen', [])).toBe('fourteen');
    });

    it('handles multiple word-numbers: "two dozen" → "2 12"', () => {
      expect(normalizeVoiceInput('two dozen', [])).toBe('2 12');
    });

    it('returns input unchanged when no word-numbers present', () => {
      expect(normalizeVoiceInput('fresh basil leaves', [])).toBe('fresh basil leaves');
    });
  });

  describe('at store-hint normalization', () => {
    it('converts "milk at Safeway" → "milk @Safeway" when Safeway is a known store', () => {
      expect(normalizeVoiceInput('milk at Safeway', ['Safeway'])).toBe('milk @Safeway');
    });

    it('converts "2 lbs chicken at Costco" → "2 lbs chicken @Costco"', () => {
      expect(normalizeVoiceInput('2 lbs chicken at Costco', ['Safeway', 'Costco'])).toBe('2 lbs chicken @Costco');
    });

    it('leaves "at" unchanged when next word does not match any store', () => {
      expect(normalizeVoiceInput('milk at target', ['Safeway', 'Costco'])).toBe('milk at target');
    });

    it('leaves "at" unchanged at end of input', () => {
      expect(normalizeVoiceInput('chicken at', ['Safeway'])).toBe('chicken at');
    });

    it('handles prefix match: "milk at saf" → "milk @saf"', () => {
      expect(normalizeVoiceInput('milk at saf', ['Safeway'])).toBe('milk @saf');
    });

    it('is case-insensitive for "at": "milk AT safeway" → "milk @safeway"', () => {
      expect(normalizeVoiceInput('milk AT safeway', ['Safeway'])).toBe('milk @safeway');
    });

    it('leaves "at" unchanged when store list is empty', () => {
      expect(normalizeVoiceInput('milk at safeway', [])).toBe('milk at safeway');
    });

    it('does not interfere with existing @ sigil', () => {
      expect(normalizeVoiceInput('milk @safeway', ['Safeway'])).toBe('milk @safeway');
    });
  });

  describe('combined and edge cases', () => {
    it('normalizes both word-numbers and "at" keyword: "two lbs chicken at Costco" → "2 lbs chicken @Costco"', () => {
      expect(normalizeVoiceInput('two lbs chicken at Costco', ['Costco'])).toBe('2 lbs chicken @Costco');
    });

    it('returns empty string for empty input', () => {
      expect(normalizeVoiceInput('', ['Safeway'])).toBe('');
    });
  });
});
