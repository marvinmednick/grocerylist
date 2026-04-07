import { editDistanceThreshold, levenshteinDistance, normalizePlural } from '@/lib/fuzzyMatch';
import {
  fuzzyLookupPackageEntry,
  fuzzyLookupSizeDescriptor,
  fuzzyLookupUnit,
  lookupUnit,
  type PackageEntry,
  type Vocabulary,
} from '@/lib/vocabulary';

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
  canonicalName: string;
  matchedItemId: string | null;
  matchedVia: 'name' | 'alias';
  count: number | null;
  packageType: string | null;
  packagePlural: string | null;
  sizeDescriptive: string | null;
  sizeQty: number | null;
  sizeUnit: string | null;
  storeHint: string | null;
  orphans: string[];
  fuzzyCount: number;
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
  aliases: string[];
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

function lookupExact(token: string, entries: { canonical: string; aliases: string[]; plural?: string }[]): string | null {
  const normalized = token.toLowerCase();

  for (const entry of entries) {
    if (entry.canonical.toLowerCase() === normalized) {
      return entry.canonical;
    }

    if (entry.plural && entry.plural.toLowerCase() === normalized) {
      return entry.canonical;
    }

    for (const alias of entry.aliases) {
      if (alias.toLowerCase() === normalized) {
        return entry.canonical;
      }
    }
  }

  return null;
}

function lookupPackageEntryExact(token: string, vocabulary: Vocabulary): PackageEntry | null {
  const normalized = token.toLowerCase();

  for (const entry of vocabulary.packages) {
    const plural = entry.plural ?? `${entry.canonical}s`;
    const matches =
      entry.canonical.toLowerCase() === normalized ||
      plural.toLowerCase() === normalized ||
      entry.aliases.some((alias) => alias.toLowerCase() === normalized);

    if (matches) {
      return { canonical: entry.canonical, plural };
    }
  }

  return null;
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

    const unit = lookupExact(raw, vocabulary.units);
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

    const packageEntry: PackageEntry | null = lookupPackageEntryExact(raw, vocabulary);
    if (packageEntry) {
      return {
        type: 'PACKAGE',
        raw,
        value: { canonical: packageEntry.canonical, plural: packageEntry.plural } satisfies PackageValue,
      };
    }

    const sizeDescriptor = lookupExact(raw, vocabulary.sizeDescriptors);
    if (sizeDescriptor) {
      return {
        type: 'SIZE_DESCRIPTIVE',
        raw,
        value: sizeDescriptor,
      };
    }

    const fuzzyUnit = fuzzyLookupUnit(raw, vocabulary);
    if (fuzzyUnit) {
      return {
        type: 'UNIT',
        raw,
        value: fuzzyUnit,
      };
    }

    const fuzzyPackageEntry = fuzzyLookupPackageEntry(raw, vocabulary);
    if (fuzzyPackageEntry) {
      return {
        type: 'PACKAGE',
        raw,
        value: { canonical: fuzzyPackageEntry.canonical, plural: fuzzyPackageEntry.plural } satisfies PackageValue,
      };
    }

    const fuzzySizeDescriptor = fuzzyLookupSizeDescriptor(raw, vocabulary);
    if (fuzzySizeDescriptor) {
      return {
        type: 'SIZE_DESCRIPTIVE',
        raw,
        value: fuzzySizeDescriptor,
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

interface ConsumeResult {
  ok: boolean;
  leftovers: string[];
  fuzzyCount: number;
}

function consumeTokensFuzzy(pool: string[], target: string[]): ConsumeResult {
  const available = [...pool];
  let fuzzyCount = 0;

  for (const token of target) {
    const exactIndex = available.indexOf(token);
    if (exactIndex !== -1) {
      available.splice(exactIndex, 1);
      continue;
    }

    const normalizedTarget = normalizePlural(token);
    const pluralIndex = available.findIndex((candidateToken) => normalizePlural(candidateToken) === normalizedTarget);
    if (pluralIndex !== -1) {
      available.splice(pluralIndex, 1);
      continue;
    }

    const fuzzyIndex = available.findIndex((candidateToken) => {
      if (candidateToken.length < 3 || token.length < 3) {
        return false;
      }
      const threshold = editDistanceThreshold(Math.min(candidateToken.length, token.length));
      return levenshteinDistance(candidateToken, token) <= threshold;
    });
    if (fuzzyIndex === -1) {
      return { ok: false, leftovers: pool, fuzzyCount: 0 };
    }

    available.splice(fuzzyIndex, 1);
    fuzzyCount += 1;
  }

  return { ok: true, leftovers: available, fuzzyCount };
}

export function resolveNames(candidate: CandidateFields, masterItems: MasterItemRef[]): ParsedInput[] {
  interface LookupEntry {
    id: string;
    lookupName: string;
    canonicalName: string;
    matchedVia: 'name' | 'alias';
  }

  const lookupEntries: LookupEntry[] = masterItems.flatMap((item) => {
    const canonicalEntry: LookupEntry = {
      id: item.id,
      lookupName: item.name,
      canonicalName: item.name,
      matchedVia: 'name',
    };
    const aliasEntries = (item.aliases || [])
      .map((alias) => alias.trim())
      .filter((alias) => alias.length > 0)
      .map((alias) => ({
        id: item.id,
        lookupName: alias,
        canonicalName: item.name,
        matchedVia: 'alias' as const,
      }));
    return [canonicalEntry, ...aliasEntries];
  });

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

    lookupEntries.forEach((lookupEntry) => {
      const itemTokens = splitName(lookupEntry.lookupName);
      const consumed = consumeTokensFuzzy(candidateWords, itemTokens);
      if (!consumed.ok) {
        return;
      }

      const missingSelectedDescriptor = descriptorSubset.some((token) => !itemTokens.includes(token));
      if (missingSelectedDescriptor) {
        return;
      }

      const orphans = consumed.leftovers;

      const sizeDescriptive = candidate.sizeDescriptive
        ? descriptorSet.has(candidate.sizeDescriptive.toLowerCase())
          ? null
          : candidate.sizeDescriptive
        : null;

      interpretations.push({
        name: lookupEntry.lookupName,
        canonicalName: lookupEntry.canonicalName,
        matchedItemId: lookupEntry.id,
        matchedVia: lookupEntry.matchedVia,
        count: candidate.count,
        packageType: candidate.packageType,
        packagePlural: candidate.packagePlural,
        sizeDescriptive,
        sizeQty: candidate.sizeQty,
        sizeUnit: candidate.sizeUnit,
        storeHint: candidate.storeHint,
        orphans,
        fuzzyCount: consumed.fuzzyCount,
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
    const scoreDelta = matchQualityScore(b) - matchQualityScore(a);
    if (scoreDelta !== 0) {
      return scoreDelta;
    }

    const tokensA = splitName(a.name).length;
    const tokensB = splitName(b.name).length;
    return tokensB - tokensA;
  });
}

export function expandAliases(candidate: CandidateFields, wordAliases: Map<string, string>): CandidateFields[] {
  const expandedIndices = candidate.nameWords
    .map((word, index) => {
      const normalizedWord = word.toLowerCase();
      const exactMatch = wordAliases.get(normalizedWord);
      if (exactMatch) {
        return { index, expanded: exactMatch };
      }

      let bestAliasKey: string | null = null;
      let bestDistance = Number.POSITIVE_INFINITY;

      for (const aliasKey of wordAliases.keys()) {
        const threshold = editDistanceThreshold(Math.min(normalizedWord.length, aliasKey.length));
        const distance = levenshteinDistance(normalizedWord, aliasKey);
        if (distance > threshold) {
          continue;
        }

        if (!bestAliasKey || distance < bestDistance || (distance === bestDistance && aliasKey.length < bestAliasKey.length)) {
          bestAliasKey = aliasKey;
          bestDistance = distance;
        }
      }

      return {
        index,
        expanded: bestAliasKey ? wordAliases.get(bestAliasKey) ?? null : null,
      };
    })
    .filter((entry): entry is { index: number; expanded: string } => entry.expanded !== null);

  if (expandedIndices.length === 0) {
    return [candidate];
  }

  let variants: CandidateFields[] = [{ ...candidate, nameWords: [...candidate.nameWords] }];

  expandedIndices.forEach(({ index, expanded }) => {
    const nextVariants: CandidateFields[] = [];
    variants.forEach((variant) => {
      nextVariants.push(variant);
      const expandedWords = [...variant.nameWords];
      expandedWords[index] = expanded;
      nextVariants.push({
        ...variant,
        nameWords: expandedWords,
      });
    });
    variants = nextVariants;
  });

  return variants;
}

export function matchQualityScore(interpretation: ParsedInput): number {
  const exactCount = splitName(interpretation.name).length - interpretation.orphans.length - interpretation.fuzzyCount;
  return exactCount * 2 + interpretation.fuzzyCount;
}

function isPreferredInterpretation(next: ParsedInput, current: ParsedInput): boolean {
  const scoreDelta = matchQualityScore(next) - matchQualityScore(current);
  if (scoreDelta !== 0) {
    return scoreDelta > 0;
  }
  if (next.fuzzyCount !== current.fuzzyCount) {
    return next.fuzzyCount < current.fuzzyCount;
  }
  if (next.matchedVia !== current.matchedVia) {
    return next.matchedVia === 'name';
  }
  return false;
}

function parseInputInternal(
  input: string,
  vocabulary: Vocabulary,
  masterItems: MasterItemRef[],
  wordAliases: Map<string, string>
): ParseResult {
  const tokens = tokenize(input);
  const classified = classifyTokens(tokens, vocabulary);
  const grouped = groupTokens(classified);
  const candidate = assembleCandidate(grouped);
  const variants = expandAliases(candidate, wordAliases);

  const pooledInterpretations = variants.flatMap((variant) => resolveNames(variant, masterItems));
  const dedupedByItemId = new Map<string, ParsedInput>();

  pooledInterpretations.forEach((interpretation) => {
    if (!interpretation.matchedItemId) {
      return;
    }
    const existing = dedupedByItemId.get(interpretation.matchedItemId);
    if (!existing || isPreferredInterpretation(interpretation, existing)) {
      dedupedByItemId.set(interpretation.matchedItemId, interpretation);
    }
  });

  const interpretations = [...dedupedByItemId.values()].sort((a, b) => {
    const scoreDelta = matchQualityScore(b) - matchQualityScore(a);
    if (scoreDelta !== 0) {
      return scoreDelta;
    }

    const tokensA = splitName(a.name).length;
    const tokensB = splitName(b.name).length;
    return tokensB - tokensA;
  });

  return {
    interpretations,
    rawInput: input,
  };
}

export function parseInput(
  input: string,
  vocabulary: Vocabulary,
  masterItems: MasterItemRef[],
  wordAliases: Map<string, string> = new Map<string, string>()
): ParseResult {
  return parseInputInternal(input, vocabulary, masterItems, wordAliases);
}
