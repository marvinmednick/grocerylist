import { lookupPackageEntry, lookupSizeDescriptor, lookupUnit, type PackageEntry, type Vocabulary } from '@/lib/vocabulary';

export interface Token {
  raw: string;
  quoted?: boolean;
}

export type TokenType =
  | 'COUNT_SIGIL'
  | 'STORE_HINT'
  | 'NUMBER'
  | 'COMPOUND'
  | 'UNIT'
  | 'PACKAGE'
  | 'SIZE_DESCRIPTIVE'
  | 'NAME'
  | 'QUANTITATIVE_SIZE'
  | 'SIZED_PACKAGE'
  | 'COUNT';

export interface ClassifiedToken {
  type: TokenType;
  raw: string;
  value?: unknown;
}

export type GroupedToken = ClassifiedToken;

interface PackageValue {
  canonical: string;
  plural: string | null;
}

export interface CandidateFields {
  count: number | null;
  packageType: string | null;
  packagePlural: string | null;
  sizeQty: number | null;
  sizeUnit: string | null;
  sizeDescriptive: string | null;
  storeHint: string | null;
  nameWords: string[];
  sizeDescriptiveTokens: string[];
}

export interface ParsedInput {
  name: string;
  matchedItemId: string | null;
  count: number | null;
  packageType: string | null;
  packagePlural: string | null;
  sizeDescriptive: string | null;
  sizeQty: number | null;
  sizeUnit: string | null;
  storeHint: string | null;
  orphans: string[];
}

export interface ParseResult {
  interpretations: ParsedInput[];
  rawInput: string;
}

export interface MasterItemRef {
  id: string;
  name: string;
  default_qty: string | null;
  alternate_qtys: string[] | null;
}

function parseCompound(raw: string, vocabulary: Vocabulary): { qty: number; unit: string } | null {
  const match = raw.match(/^(\d+(?:\.\d+)?)([a-zA-Z]+)$/);
  if (!match) {
    return null;
  }

  const qty = Number.parseFloat(match[1]);
  const unit = lookupUnit(match[2], vocabulary);
  if (!unit || Number.isNaN(qty)) {
    return null;
  }

  return { qty, unit };
}

export function tokenize(input: string): Token[] {
  const trimmed = input.trim();
  if (!trimmed) {
    return [];
  }

  const tokens: Token[] = [];
  let current = '';
  let quoteChar: '"' | '\'' | null = null;

  for (const char of trimmed) {
    if (quoteChar) {
      if (char === quoteChar) {
        tokens.push({ raw: current, quoted: true });
        current = '';
        quoteChar = null;
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"' || char === '\'') {
      if (current.trim().length > 0) {
        tokens.push({ raw: current.trim() });
        current = '';
      }
      quoteChar = char;
      continue;
    }

    if (/\s/.test(char)) {
      if (current.length > 0) {
        tokens.push({ raw: current });
        current = '';
      }
      continue;
    }

    current += char;
  }

  if (current.length > 0) {
    tokens.push({ raw: current, quoted: quoteChar !== null });
  }

  return tokens.filter((token) => token.raw.length > 0);
}

export function classifyTokens(tokens: Token[], vocabulary: Vocabulary): ClassifiedToken[] {
  return tokens.map((token) => {
    const raw = token.raw;

    if (token.quoted) {
      return { type: 'NAME', raw, value: raw };
    }

    if (/^\d+x$/i.test(raw)) {
      return {
        type: 'COUNT_SIGIL',
        raw,
        value: Number.parseInt(raw.slice(0, -1), 10),
      };
    }

    if (/^@\w+$/.test(raw)) {
      return {
        type: 'STORE_HINT',
        raw,
        value: raw.slice(1),
      };
    }

    if (/^\d+(?:\.\d+)?$/.test(raw)) {
      return {
        type: 'NUMBER',
        raw,
        value: Number.parseFloat(raw),
      };
    }

    const compound = parseCompound(raw, vocabulary);
    if (compound) {
      return {
        type: 'COMPOUND',
        raw,
        value: compound,
      };
    }

    const unit = lookupUnit(raw, vocabulary);
    if (unit) {
      return {
        type: 'UNIT',
        raw,
        value: unit,
      };
    }

    if (/^\d+-pack$/i.test(raw)) {
      return {
        type: 'PACKAGE',
        raw,
        value: { canonical: raw.toLowerCase(), plural: null } satisfies PackageValue,
      };
    }

    const packageEntry: PackageEntry | null = lookupPackageEntry(raw, vocabulary);
    if (packageEntry) {
      return {
        type: 'PACKAGE',
        raw,
        value: { canonical: packageEntry.canonical, plural: packageEntry.plural } satisfies PackageValue,
      };
    }

    const sizeDescriptor = lookupSizeDescriptor(raw, vocabulary);
    if (sizeDescriptor) {
      return {
        type: 'SIZE_DESCRIPTIVE',
        raw,
        value: sizeDescriptor,
      };
    }

    return {
      type: 'NAME',
      raw,
      value: raw,
    };
  });
}

function sameTokens(a: GroupedToken[], b: GroupedToken[]): boolean {
  if (a.length !== b.length) {
    return false;
  }

  return a.every((token, index) => {
    const other = b[index];
    return token.type === other.type && token.raw === other.raw && JSON.stringify(token.value) === JSON.stringify(other.value);
  });
}

function pass3a(tokens: GroupedToken[]): GroupedToken[] {
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];

    if (token.type === 'COMPOUND') {
      const next = [...tokens];
      next[i] = { ...token, type: 'QUANTITATIVE_SIZE' };
      return next;
    }

    const right = tokens[i + 1];
    if (token.type === 'NUMBER' && right?.type === 'UNIT') {
      const merged: GroupedToken = {
        type: 'QUANTITATIVE_SIZE',
        raw: `${token.raw}${right.raw}`,
        value: {
          qty: token.value as number,
          unit: right.value as string,
        },
      };
      return [...tokens.slice(0, i), merged, ...tokens.slice(i + 2)];
    }
  }

  return tokens;
}

function pass3b(tokens: GroupedToken[]): GroupedToken[] {
  for (let i = 0; i < tokens.length - 1; i += 1) {
    const left = tokens[i];
    const right = tokens[i + 1];

    if (left.type === 'QUANTITATIVE_SIZE' && right.type === 'PACKAGE') {
      const value = left.value as { qty: number; unit: string };
      const merged: GroupedToken = {
        type: 'SIZED_PACKAGE',
        raw: `${left.raw} ${right.raw}`,
        value: {
          qty: value.qty,
          unit: value.unit,
          packageType: (right.value as PackageValue).canonical,
          packagePlural: (right.value as PackageValue).plural,
        },
      };
      return [...tokens.slice(0, i), merged, ...tokens.slice(i + 2)];
    }
  }

  return tokens;
}

function pass3c(tokens: GroupedToken[]): GroupedToken[] {
  for (let i = 0; i < tokens.length - 1; i += 1) {
    const left = tokens[i];
    const right = tokens[i + 1];
    const rightPackage = right.type === 'SIZED_PACKAGE' || right.type === 'PACKAGE';

    if (!rightPackage) {
      continue;
    }

    if (left.type === 'NUMBER') {
      const next = [...tokens];
      next[i] = { ...left, type: 'COUNT' };
      return next;
    }

    if (left.type === 'COUNT_SIGIL') {
      const next = [...tokens];
      next[i] = { ...left, type: 'COUNT' };
      return next;
    }
  }

  return tokens;
}

function pass3d(tokens: GroupedToken[]): GroupedToken[] {
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token.type !== 'PACKAGE' && /^\d+-pack$/i.test(token.raw)) {
      const next = [...tokens];
      next[i] = {
        type: 'PACKAGE',
        raw: token.raw,
        value: { canonical: token.raw.toLowerCase(), plural: null } satisfies PackageValue,
      };
      return next;
    }
  }

  return tokens;
}

export function groupTokens(tokens: ClassifiedToken[]): GroupedToken[] {
  let working = [...tokens];
  let iterations = 0;

  while (iterations < 10) {
    iterations += 1;
    const before = working;

    working = pass3a(working);
    if (sameTokens(before, working)) {
      working = pass3b(working);
    }
    if (sameTokens(before, working)) {
      working = pass3c(working);
    }
    if (sameTokens(before, working)) {
      working = pass3d(working);
    }

    if (sameTokens(before, working)) {
      break;
    }
  }

  if (iterations > 4) {
    console.warn(`Parser grouping exceeded 4 iterations: ${tokens.map((token) => token.raw).join(' ')}`);
  }

  return working;
}

export function assembleCandidate(tokens: GroupedToken[]): CandidateFields {
  const candidate: CandidateFields = {
    count: null,
    packageType: null,
    packagePlural: null,
    sizeQty: null,
    sizeUnit: null,
    sizeDescriptive: null,
    storeHint: null,
    nameWords: [],
    sizeDescriptiveTokens: [],
  };

  tokens.forEach((token) => {
    if (token.type === 'COUNT') {
      if (candidate.count === null) {
        candidate.count = Number(token.value);
      }
      return;
    }

    if (token.type === 'NUMBER') {
      if (candidate.count === null) {
        candidate.count = Number(token.value);
      }
      return;
    }

    if (token.type === 'STORE_HINT') {
      if (candidate.storeHint === null) {
        candidate.storeHint = String(token.value);
      }
      return;
    }

    if (token.type === 'QUANTITATIVE_SIZE') {
      const value = token.value as { qty: number; unit: string };
      candidate.sizeQty = value.qty;
      candidate.sizeUnit = value.unit;
      return;
    }

    if (token.type === 'SIZED_PACKAGE') {
      const value = token.value as { qty: number; unit: string; packageType: string; packagePlural: string | null };
      candidate.sizeQty = value.qty;
      candidate.sizeUnit = value.unit;
      candidate.packageType = value.packageType;
      candidate.packagePlural = value.packagePlural;
      return;
    }

    if (token.type === 'PACKAGE') {
      const value = token.value as PackageValue;
      candidate.packageType = value.canonical;
      candidate.packagePlural = value.plural;
      return;
    }

    if (token.type === 'SIZE_DESCRIPTIVE') {
      if (candidate.sizeDescriptive === null) {
        candidate.sizeDescriptive = String(token.value);
      }
      candidate.sizeDescriptiveTokens.push(String(token.value));
      return;
    }

    if (token.type === 'NAME') {
      candidate.nameWords.push(token.raw);
    }
  });

  return candidate;
}

function normalizeWords(words: string[]): string[] {
  return words
    .map((word) => word.trim().toLowerCase())
    .filter((word) => word.length > 0);
}

function splitName(name: string): string[] {
  return normalizeWords(name.split(/\s+/));
}

function buildPowerSet(words: string[]): string[][] {
  const results: string[][] = [[]];

  for (const word of words) {
    const current = [...results];
    current.forEach((subset) => {
      results.push([...subset, word]);
    });
  }

  return results;
}

function consumeTokens(pool: string[], target: string[]): { ok: boolean; leftovers: string[] } {
  const available = [...pool];

  for (const token of target) {
    const idx = available.indexOf(token);
    if (idx === -1) {
      return { ok: false, leftovers: pool };
    }
    available.splice(idx, 1);
  }

  return { ok: true, leftovers: available };
}

export function resolveNames(candidate: CandidateFields, masterItems: MasterItemRef[]): ParsedInput[] {
  const nameWords = normalizeWords(candidate.nameWords.flatMap((word) => word.split(/\s+/)));
  const descriptorWords = normalizeWords(candidate.sizeDescriptiveTokens);

  const descriptorSubsets = buildPowerSet(descriptorWords);
  const interpretations: ParsedInput[] = [];

  descriptorSubsets.forEach((descriptorSubset) => {
    const descriptorSet = new Set(descriptorSubset);
    const candidateWords = [...descriptorSubset, ...nameWords];

    if (candidateWords.length === 0) {
      return;
    }

    masterItems.forEach((item) => {
      const itemTokens = splitName(item.name);
      const consumed = consumeTokens(candidateWords, itemTokens);
      if (!consumed.ok) {
        return;
      }

      const missingSelectedDescriptor = descriptorSubset.some((token) => !itemTokens.includes(token));
      if (missingSelectedDescriptor) {
        return;
      }

      const orphans = candidateWords.filter((word, index) => {
        const prior = candidateWords.slice(0, index);
        const usedInItem = itemTokens.filter((token) => token === word).length;
        const usedBefore = prior.filter((token) => token === word).length;
        return usedBefore >= usedInItem;
      });

      const sizeDescriptive = candidate.sizeDescriptive
        ? descriptorSet.has(candidate.sizeDescriptive.toLowerCase())
          ? null
          : candidate.sizeDescriptive
        : null;

      interpretations.push({
        name: item.name,
        matchedItemId: item.id,
        count: candidate.count,
        packageType: candidate.packageType,
        packagePlural: candidate.packagePlural,
        sizeDescriptive,
        sizeQty: candidate.sizeQty,
        sizeUnit: candidate.sizeUnit,
        storeHint: candidate.storeHint,
        orphans,
      });
    });
  });

  const deduped = new Map<string, ParsedInput>();
  interpretations.forEach((interpretation) => {
    const key = [
      interpretation.matchedItemId,
      interpretation.name.toLowerCase(),
      interpretation.sizeDescriptive ?? '',
      interpretation.orphans.join('|'),
    ].join('::');
    if (!deduped.has(key)) {
      deduped.set(key, interpretation);
    }
  });

  return [...deduped.values()].sort((a, b) => {
    const tokensA = splitName(a.name).length;
    const tokensB = splitName(b.name).length;
    return tokensB - tokensA;
  });
}

export function parseInput(input: string, vocabulary: Vocabulary, masterItems: MasterItemRef[]): ParseResult {
  const tokens = tokenize(input);
  const classified = classifyTokens(tokens, vocabulary);
  const grouped = groupTokens(classified);
  const candidate = assembleCandidate(grouped);
  const interpretations = resolveNames(candidate, masterItems);

  return {
    interpretations,
    rawInput: input,
  };
}
