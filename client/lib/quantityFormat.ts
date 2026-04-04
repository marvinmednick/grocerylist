import { assembleCandidate, classifyTokens, groupTokens, tokenize } from '@/lib/parser';
import { DEFAULT_VOCABULARY, getPlural, type Vocabulary } from '@/lib/vocabulary';

export interface QuantityFields {
  count?: number | null;
  packageType?: string | null;
  sizeQty?: number | null;
  sizeUnit?: string | null;
  sizeDescriptive?: string | null;
}

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
      effectiveCount !== null && effectiveCount > 1 ? getPlural(packageType, DEFAULT_VOCABULARY) : packageType;
    parts.push(packageValue);
  }

  if (sizeDescriptive) {
    parts.push(sizeDescriptive);
  }

  return parts.join(' ').trim();
}

function toComparableQuantity(text: string, vocabulary: Vocabulary): Required<QuantityFields> {
  const candidate = assembleCandidate(groupTokens(classifyTokens(tokenize(text), vocabulary)));

  return {
    count: candidate.count,
    packageType: candidate.packageType,
    sizeQty: candidate.sizeQty,
    sizeUnit: candidate.sizeUnit,
    sizeDescriptive: candidate.sizeDescriptive,
  };
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
