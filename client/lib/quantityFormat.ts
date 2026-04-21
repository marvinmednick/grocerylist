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

export interface CombineOption {
  type: 'sum' | 'multipack';
  result: QuantityParsed;
  label: string;
}

export interface CombineOptions {
  options: CombineOption[];
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
  const packagePlural = fields.packagePlural ?? null;
  const sizeQty = fields.sizeQty ?? null;
  const sizeUnit = fields.sizeUnit ?? null;
  const sizeDescriptive = fields.sizeDescriptive ?? null;

  const showImpliedPackageCount = packageType && !hasExplicitCount && sizeQty === null && sizeDescriptive === null;
  const showCount = packageType ? hasExplicitCount || showImpliedPackageCount : count !== null;
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

function emptyQuantity(): QuantityParsed {
  return {
    count: null,
    packageType: null,
    packagePlural: null,
    sizeQty: null,
    sizeUnit: null,
    sizeDescriptive: null,
  };
}

function isEmptyQuantity(quantity: QuantityParsed): boolean {
  return (
    quantity.count === null &&
    quantity.packageType === null &&
    quantity.packagePlural === null &&
    quantity.sizeQty === null &&
    quantity.sizeUnit === null &&
    quantity.sizeDescriptive === null
  );
}

function isPureCount(quantity: QuantityParsed): boolean {
  return (
    quantity.count !== null &&
    quantity.packageType === null &&
    quantity.packagePlural === null &&
    quantity.sizeQty === null &&
    quantity.sizeUnit === null &&
    quantity.sizeDescriptive === null
  );
}

function getPackageCount(quantity: QuantityParsed): number {
  return quantity.count ?? 1;
}

function packagePluralFor(quantity: QuantityParsed): string {
  if (!quantity.packageType) {
    return '';
  }
  return quantity.packagePlural ?? `${quantity.packageType}s`;
}

function sameNumber(left: number | null, right: number | null): boolean {
  if (left === null || right === null) {
    return left === right;
  }
  return Math.abs(left - right) < 0.001;
}

export function formatCombineOption(option: CombineOption): string {
  if (option.type === 'sum') {
    if (
      option.result.packageType === null &&
      option.result.sizeQty !== null &&
      option.result.sizeUnit &&
      option.result.sizeDescriptive === null &&
      option.result.count === null
    ) {
      return `${formatCount(option.result.sizeQty)} ${option.result.sizeUnit}`;
    }
    return formatQuantity(option.result);
  }

  if (option.result.count !== null && option.result.sizeQty !== null && option.result.sizeUnit) {
    return `${formatCount(option.result.count)} × ${formatCount(option.result.sizeQty)} ${option.result.sizeUnit}`;
  }

  return formatQuantity(option.result);
}

export function combineQuantities(existing: QuantityParsed, incoming: QuantityParsed): CombineOptions | null {
  const existingEmpty = isEmptyQuantity(existing);
  const incomingEmpty = isEmptyQuantity(incoming);

  if (existingEmpty && incomingEmpty) {
    return null;
  }

  if (existingEmpty || incomingEmpty) {
    const result = existingEmpty ? incoming : existing;
    const option: CombineOption = {
      type: 'sum',
      result,
      label: '',
    };
    option.label = formatCombineOption(option);
    return { options: [option] };
  }

  if (isPureCount(existing) && isPureCount(incoming)) {
    const option: CombineOption = {
      type: 'sum',
      result: { ...emptyQuantity(), count: (existing.count ?? 0) + (incoming.count ?? 0) },
      label: '',
    };
    option.label = formatCombineOption(option);
    return { options: [option] };
  }

  if (
    (isPureCount(existing) && incoming.packageType && incoming.sizeDescriptive === null) ||
    (isPureCount(incoming) && existing.packageType && existing.sizeDescriptive === null)
  ) {
    const packaged = existing.packageType ? existing : incoming;
    const plainCount = existing.packageType ? incoming : existing;

    const option: CombineOption = {
      type: 'sum',
      result: {
        ...emptyQuantity(),
        count: getPackageCount(packaged) + (plainCount.count ?? 0),
        packageType: packaged.packageType,
        packagePlural: packagePluralFor(packaged),
        sizeQty: packaged.sizeQty,
        sizeUnit: packaged.sizeUnit,
      },
      label: '',
    };
    option.label = formatCombineOption(option);
    return { options: [option] };
  }

  if (
    existing.packageType === null &&
    incoming.packageType === null &&
    existing.sizeQty !== null &&
    incoming.sizeQty !== null &&
    existing.sizeUnit &&
    incoming.sizeUnit &&
    existing.sizeDescriptive === null &&
    incoming.sizeDescriptive === null &&
    existing.sizeUnit === incoming.sizeUnit
  ) {
    const sumOption: CombineOption = {
      type: 'sum',
      result: {
        ...emptyQuantity(),
        sizeQty: existing.sizeQty + incoming.sizeQty,
        sizeUnit: existing.sizeUnit,
      },
      label: '',
    };
    sumOption.label = formatCombineOption(sumOption);

    const options: CombineOption[] = [sumOption];
    if (sameNumber(existing.sizeQty, incoming.sizeQty)) {
      const multipack: CombineOption = {
        type: 'multipack',
        result: {
          ...emptyQuantity(),
          count: 2,
          sizeQty: existing.sizeQty,
          sizeUnit: existing.sizeUnit,
        },
        label: '',
      };
      multipack.label = formatCombineOption(multipack);
      options.push(multipack);
    }

    return { options };
  }

  if (
    existing.packageType &&
    incoming.packageType &&
    existing.packageType === incoming.packageType &&
    existing.sizeDescriptive === null &&
    incoming.sizeDescriptive === null
  ) {
    const existingCount = getPackageCount(existing);
    const incomingCount = getPackageCount(incoming);
    const hasSameSize = sameNumber(existing.sizeQty, incoming.sizeQty) && existing.sizeUnit === incoming.sizeUnit;

    const sumOption: CombineOption = {
      type: 'sum',
      result: {
        ...emptyQuantity(),
        count: existingCount + incomingCount,
        packageType: existing.packageType,
        packagePlural: existing.packagePlural ?? incoming.packagePlural ?? `${existing.packageType}s`,
        sizeQty: hasSameSize ? existing.sizeQty : null,
        sizeUnit: hasSameSize ? existing.sizeUnit : null,
      },
      label: '',
    };
    sumOption.label = formatCombineOption(sumOption);

    const options: CombineOption[] = [sumOption];
    const canMultipack = hasSameSize && existing.sizeQty !== null && sameNumber(existing.count, incoming.count);
    if (canMultipack) {
      const multipack: CombineOption = {
        type: 'multipack',
        result: {
          ...emptyQuantity(),
          count: 2,
          packageType: existing.packageType,
          packagePlural: existing.packagePlural ?? incoming.packagePlural ?? `${existing.packageType}s`,
          sizeQty: existing.sizeQty,
          sizeUnit: existing.sizeUnit,
        },
        label: '',
      };
      multipack.label = formatCombineOption(multipack);
      options.push(multipack);
    }

    return { options };
  }

  return null;
}

function toComparableQuantity(text: string, vocabulary: Vocabulary): QuantityParsed {
  return (
    parseQuantityText(text, vocabulary) ?? {
      ...emptyQuantity(),
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
