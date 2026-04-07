import { editDistanceThreshold, levenshteinDistanceStrict } from '@/lib/fuzzyMatch';

export interface VocabEntry {
  canonical: string;
  aliases: string[];
  plural?: string;
}

export interface PackageEntry {
  canonical: string;
  plural: string;
}

export interface Vocabulary {
  units: VocabEntry[];
  packages: VocabEntry[];
  sizeDescriptors: VocabEntry[];
}

export const DEFAULT_VOCABULARY: Vocabulary = {
  units: [
    { canonical: 'oz', aliases: ['ounce', 'ounces'] },
    { canonical: 'lb', aliases: ['lbs', 'pound', 'pounds'] },
    { canonical: 'g', aliases: ['gram', 'grams'] },
    { canonical: 'kg', aliases: ['kilogram', 'kilograms'] },
    { canonical: 'gal', aliases: ['gallon', 'gallons'] },
    { canonical: 'qt', aliases: ['quart', 'quarts'] },
    { canonical: 'pt', aliases: ['pint', 'pints'] },
    { canonical: 'ml', aliases: ['milliliter', 'milliliters'] },
    { canonical: 'L', aliases: ['liter', 'liters'] },
    { canonical: 'cup', aliases: ['cups'] },
    { canonical: 'ct', aliases: ['count'] },
    { canonical: 'floz', aliases: [] },
  ],
  packages: [
    { canonical: 'can', plural: 'cans', aliases: [] },
    { canonical: 'bottle', plural: 'bottles', aliases: [] },
    { canonical: 'jar', plural: 'jars', aliases: [] },
    { canonical: 'box', plural: 'boxes', aliases: [] },
    { canonical: 'bag', plural: 'bags', aliases: [] },
    { canonical: 'carton', plural: 'cartons', aliases: [] },
    { canonical: 'tub', plural: 'tubs', aliases: [] },
    { canonical: 'container', plural: 'containers', aliases: [] },
    { canonical: 'tube', plural: 'tubes', aliases: [] },
    { canonical: 'pouch', plural: 'pouches', aliases: [] },
    { canonical: 'sleeve', plural: 'sleeves', aliases: [] },
    { canonical: 'roll', plural: 'rolls', aliases: [] },
    { canonical: 'stick', plural: 'sticks', aliases: [] },
    { canonical: 'bar', plural: 'bars', aliases: [] },
    { canonical: 'block', plural: 'blocks', aliases: [] },
    { canonical: 'loaf', plural: 'loaves', aliases: [] },
    { canonical: 'sheet', plural: 'sheets', aliases: [] },
    { canonical: 'pack', plural: 'packs', aliases: [] },
    { canonical: 'package', plural: 'packages', aliases: ['pkg'] },
    { canonical: 'case', plural: 'cases', aliases: [] },
    { canonical: 'flat', plural: 'flats', aliases: [] },
    { canonical: 'tray', plural: 'trays', aliases: [] },
    { canonical: 'rack', plural: 'racks', aliases: [] },
    { canonical: 'dozen', plural: 'dozens', aliases: [] },
    { canonical: 'pair', plural: 'pairs', aliases: [] },
    { canonical: 'bunch', plural: 'bunches', aliases: [] },
    { canonical: 'head', plural: 'heads', aliases: [] },
    { canonical: 'ear', plural: 'ears', aliases: [] },
    { canonical: 'stalk', plural: 'stalks', aliases: [] },
    { canonical: 'sprig', plural: 'sprigs', aliases: [] },
    { canonical: 'clove', plural: 'cloves', aliases: [] },
    { canonical: 'fillet', plural: 'fillets', aliases: [] },
    { canonical: 'slice', plural: 'slices', aliases: [] },
    { canonical: 'patty', plural: 'patties', aliases: [] },
    { canonical: 'link', plural: 'links', aliases: [] },
    { canonical: 'tablet', plural: 'tablets', aliases: [] },
    { canonical: 'capsule', plural: 'capsules', aliases: [] },
  ],
  sizeDescriptors: [
    { canonical: 'large', aliases: ['lg'] },
    { canonical: 'medium', aliases: ['med'] },
    { canonical: 'small', aliases: ['sm'] },
    { canonical: 'xl', aliases: ['extra-large'] },
    { canonical: 'jumbo', aliases: [] },
    { canonical: 'mini', aliases: ['miniature'] },
    { canonical: 'petite', aliases: [] },
    { canonical: 'king-size', aliases: [] },
    { canonical: 'family-size', aliases: [] },
    { canonical: 'travel-size', aliases: [] },
    { canonical: 'regular', aliases: [] },
  ],
};

function lookup(token: string, entries: VocabEntry[]): string | null {
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

interface FuzzyLookupCandidate<T> {
  value: T;
  tokens: string[];
}

function bestFuzzyCandidate<T>(token: string, candidates: FuzzyLookupCandidate<T>[]): T | null {
  const normalized = token.toLowerCase();

  let best: { value: T; distance: number; candidateLength: number } | null = null;

  candidates.forEach((candidate) => {
    candidate.tokens.forEach((candidateToken) => {
      const candidateNormalized = candidateToken.toLowerCase();
      const firstCharsMatch =
        normalized.length >= 2 && candidateNormalized.length >= 2
          ? normalized.slice(0, 2) === candidateNormalized.slice(0, 2)
          : normalized[0] === candidateNormalized[0];
      if (!firstCharsMatch) {
        return;
      }

      const threshold = editDistanceThreshold(Math.min(normalized.length, candidateNormalized.length));
      const distance = levenshteinDistanceStrict(normalized, candidateNormalized);
      if (distance > threshold) {
        return;
      }

      if (!best || distance < best.distance || (distance === best.distance && candidateNormalized.length < best.candidateLength)) {
        best = { value: candidate.value, distance, candidateLength: candidateNormalized.length };
      }
    });
  });

  return best?.value ?? null;
}

function fuzzyLookup(token: string, entries: VocabEntry[]): string | null {
  const candidates: FuzzyLookupCandidate<string>[] = entries.map((entry) => {
    const plural = entry.plural ? [entry.plural] : [];
    return {
      value: entry.canonical,
      tokens: [entry.canonical, ...entry.aliases, ...plural],
    };
  });

  return bestFuzzyCandidate(token, candidates);
}

export function fuzzyLookupUnit(token: string, vocabulary: Vocabulary): string | null {
  return fuzzyLookup(token, vocabulary.units);
}

export function fuzzyLookupPackageEntry(token: string, vocabulary: Vocabulary): PackageEntry | null {
  const candidates: FuzzyLookupCandidate<PackageEntry>[] = vocabulary.packages.map((entry) => {
    const plural = entry.plural ?? `${entry.canonical}s`;
    return {
      value: { canonical: entry.canonical, plural },
      tokens: [entry.canonical, plural, ...entry.aliases],
    };
  });

  return bestFuzzyCandidate(token, candidates);
}

export function fuzzyLookupSizeDescriptor(token: string, vocabulary: Vocabulary): string | null {
  return fuzzyLookup(token, vocabulary.sizeDescriptors);
}

export function lookupUnit(token: string, vocabulary: Vocabulary): string | null {
  return lookup(token, vocabulary.units) ?? fuzzyLookupUnit(token, vocabulary);
}

export function lookupPackage(token: string, vocabulary: Vocabulary): string | null {
  return lookup(token, vocabulary.packages) ?? fuzzyLookup(token, vocabulary.packages);
}

export function lookupPackageEntry(token: string, vocabulary: Vocabulary): PackageEntry | null {
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

  return fuzzyLookupPackageEntry(token, vocabulary);
}

export function lookupSizeDescriptor(token: string, vocabulary: Vocabulary): string | null {
  return lookup(token, vocabulary.sizeDescriptors) ?? fuzzyLookupSizeDescriptor(token, vocabulary);
}

/** @deprecated Use packagePlural field from QuantityFields instead */
export function getPlural(canonical: string, vocabulary: Vocabulary): string {
  const normalized = canonical.toLowerCase();
  const allEntries = [...vocabulary.units, ...vocabulary.packages, ...vocabulary.sizeDescriptors];

  const match = allEntries.find((entry) => entry.canonical.toLowerCase() === normalized);
  if (!match) {
    return `${canonical}s`;
  }

  return match.plural ?? match.aliases.find((alias) => alias.toLowerCase() !== normalized) ?? `${match.canonical}s`;
}
