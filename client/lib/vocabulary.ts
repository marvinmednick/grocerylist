export interface VocabEntry {
  canonical: string;
  aliases: string[];
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
    { canonical: 'can', aliases: ['cans'] },
    { canonical: 'bottle', aliases: ['bottles'] },
    { canonical: 'jar', aliases: ['jars'] },
    { canonical: 'box', aliases: ['boxes'] },
    { canonical: 'bag', aliases: ['bags'] },
    { canonical: 'carton', aliases: ['cartons'] },
    { canonical: 'tub', aliases: ['tubs'] },
    { canonical: 'container', aliases: ['containers'] },
    { canonical: 'tube', aliases: ['tubes'] },
    { canonical: 'pouch', aliases: ['pouches'] },
    { canonical: 'sleeve', aliases: ['sleeves'] },
    { canonical: 'roll', aliases: ['rolls'] },
    { canonical: 'stick', aliases: ['sticks'] },
    { canonical: 'bar', aliases: ['bars'] },
    { canonical: 'block', aliases: ['blocks'] },
    { canonical: 'loaf', aliases: ['loaves'] },
    { canonical: 'sheet', aliases: ['sheets'] },
    { canonical: 'pack', aliases: ['packs'] },
    { canonical: 'package', aliases: ['packages', 'pkg'] },
    { canonical: 'case', aliases: ['cases'] },
    { canonical: 'flat', aliases: ['flats'] },
    { canonical: 'tray', aliases: ['trays'] },
    { canonical: 'rack', aliases: ['racks'] },
    { canonical: 'dozen', aliases: [] },
    { canonical: 'pair', aliases: ['pairs'] },
    { canonical: 'bunch', aliases: ['bunches'] },
    { canonical: 'head', aliases: ['heads'] },
    { canonical: 'ear', aliases: ['ears'] },
    { canonical: 'stalk', aliases: ['stalks'] },
    { canonical: 'sprig', aliases: ['sprigs'] },
    { canonical: 'clove', aliases: ['cloves'] },
    { canonical: 'fillet', aliases: ['fillets'] },
    { canonical: 'slice', aliases: ['slices'] },
    { canonical: 'patty', aliases: ['patties'] },
    { canonical: 'link', aliases: ['links'] },
    { canonical: 'tablet', aliases: ['tablets'] },
    { canonical: 'capsule', aliases: ['capsules'] },
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

    for (const alias of entry.aliases) {
      if (alias.toLowerCase() === normalized) {
        return entry.canonical;
      }
    }
  }

  return null;
}

export function lookupUnit(token: string, vocabulary: Vocabulary): string | null {
  return lookup(token, vocabulary.units);
}

export function lookupPackage(token: string, vocabulary: Vocabulary): string | null {
  return lookup(token, vocabulary.packages);
}

export function lookupSizeDescriptor(token: string, vocabulary: Vocabulary): string | null {
  return lookup(token, vocabulary.sizeDescriptors);
}

export function getPlural(canonical: string, vocabulary: Vocabulary): string {
  const normalized = canonical.toLowerCase();
  const allEntries = [...vocabulary.units, ...vocabulary.packages, ...vocabulary.sizeDescriptors];

  const match = allEntries.find((entry) => entry.canonical.toLowerCase() === normalized);
  if (!match) {
    return `${canonical}s`;
  }

  const aliasPlural = match.aliases.find((alias) => alias.toLowerCase() !== normalized);
  return aliasPlural ?? `${match.canonical}s`;
}
