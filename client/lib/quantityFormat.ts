import { assembleCandidate, classifyTokens, groupTokens, tokenize } from '@/lib/parser';
import { type Vocabulary } from '@/lib/vocabulary';

export interface QuantityFields {
  count?: number | null;
  packageType?: string | null;
  packagePlural?: string | null;
  sizeQty?: number | null;
  sizeUnit?: string | null;
  sizeDescriptive?: string | null;
}

export type QuantityParsed = Required<QuantityFields>;

function formatCount(count: number): string {
  if (Number.isInteger(count)) {
    return String(count);
  }
  return String(count);
}

export function formatQuantity(fields: QuantityFields): string {
  const parts: string[] = [];

  const hasExplicitCount = fields.count !== undefined && fields.count !== null;
  const count = fields.count ?? null;
  const packageType = fields.packageType ?? null;
  const packagePlural = fields.packagePlural ?? null;
  const sizeQty = fields.sizeQty ?? null;
  const sizeUnit = fields.sizeUnit ?? null;
  const sizeDescriptive = fields.sizeDescriptive ?? null;

  const showImpliedPackageCount = packageType && !hasExplicitCount && sizeQty === null && sizeDescriptive === null;
  const showCount = packageType ? hasExplicitCount || showImpliedPackageCount : count !== null && count !== 1;
  const effectiveCount = packageType ? (count ?? 1) : count;

  if (showCount && effectiveCount !== null) {
    parts.push(formatCount(effectiveCount));
  }

  if (sizeQty !== null && sizeUnit) {
    parts.push(`${formatCount(sizeQty)}${sizeUnit}`);
  }

  if (packageType) {
    const packageValue =
      effectiveCount !== null && effectiveCount > 1 ? packagePlural ?? `${packageType}s` : packageType;
    parts.push(packageValue);
  }

  if (sizeDescriptive) {
    parts.push(sizeDescriptive);
  }

  return parts.join(' ').trim();
}

export function parseQuantityText(text: string, vocabulary: Vocabulary): QuantityParsed | null {
  if (!text.trim()) {
    return null;
  }
  const candidate = assembleCandidate(groupTokens(classifyTokens(tokenize(text), vocabulary)));
  const parsed: QuantityParsed = {
    count: candidate.count,
    packageType: candidate.packageType,
    packagePlural: candidate.packagePlural,
    sizeQty: candidate.sizeQty,
    sizeUnit: candidate.sizeUnit,
    sizeDescriptive: candidate.sizeDescriptive,
  };

  if (
    parsed.count === null &&
    parsed.packageType === null &&
    parsed.sizeQty === null &&
    parsed.sizeUnit === null &&
    parsed.sizeDescriptive === null
  ) {
    return null;
  }

  return parsed;
}

function toComparableQuantity(text: string, vocabulary: Vocabulary): QuantityParsed {
  return (
    parseQuantityText(text, vocabulary) ?? {
      count: null,
      packageType: null,
      packagePlural: null,
      sizeQty: null,
      sizeUnit: null,
      sizeDescriptive: null,
    }
  );
}

export function quantityEquals(a: string, b: string, vocabulary: Vocabulary): boolean {
  const qtyA = toComparableQuantity(a, vocabulary);
  const qtyB = toComparableQuantity(b, vocabulary);

  const numberEqual = (left: number | null, right: number | null): boolean => {
    if (left === null || right === null) {
      return left === right;
    }
    return Math.abs(left - right) < 0.001;
  };

  return (
    numberEqual(qtyA.count, qtyB.count) &&
    qtyA.packageType === qtyB.packageType &&
    numberEqual(qtyA.sizeQty, qtyB.sizeQty) &&
    qtyA.sizeUnit === qtyB.sizeUnit &&
    qtyA.sizeDescriptive === qtyB.sizeDescriptive
  );
}

export function isPartialMatch(userInput: string, dbString: string): boolean {
  return dbString.toLowerCase().startsWith(userInput.toLowerCase());
}
