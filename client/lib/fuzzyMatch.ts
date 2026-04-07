export function levenshteinDistanceStrict(a: string, b: string): number {
  if (a === b) {
    return 0;
  }

  if (a.length === 0) {
    return b.length;
  }

  if (b.length === 0) {
    return a.length;
  }

  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix: number[][] = Array.from({ length: rows }, () => Array<number>(cols).fill(0));

  for (let i = 0; i < rows; i += 1) {
    matrix[i][0] = i;
  }

  for (let j = 0; j < cols; j += 1) {
    matrix[0][j] = j;
  }

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[a.length][b.length];
}

function localAlignmentDistance(shorter: string, longer: string): number {
  let best = Number.POSITIVE_INFINITY;

  const maxWindowLength = Math.min(longer.length, shorter.length + 1);
  for (let windowLength = shorter.length; windowLength <= maxWindowLength; windowLength += 1) {
    for (let start = 0; start <= longer.length - windowLength; start += 1) {
      const window = longer.slice(start, start + windowLength);
      const distance = levenshteinDistanceStrict(shorter, window);
      if (distance < best) {
        best = distance;
      }
    }
  }

  return best;
}

export function levenshteinDistance(a: string, b: string): number {
  const base = levenshteinDistanceStrict(a, b);
  if (a.length === b.length) {
    return base;
  }

  if (Math.abs(a.length - b.length) !== 2) {
    return base;
  }

  const shorter = a.length < b.length ? a : b;
  const longer = a.length < b.length ? b : a;
  const aligned = localAlignmentDistance(shorter, longer);
  return Math.min(base, aligned);
}

export function editDistanceThreshold(wordLength: number): number {
  if (wordLength < 3) {
    return 0;
  }

  if (wordLength <= 4) {
    return 1;
  }

  return 2;
}

export function isFuzzyMatch(a: string, b: string): boolean {
  if (a.length < 3 || b.length < 3) {
    return false;
  }

  const threshold = editDistanceThreshold(Math.min(a.length, b.length));
  return levenshteinDistance(a, b) <= threshold;
}

export function bestFuzzyMatch(query: string, candidates: string[]): string | null {
  const threshold = editDistanceThreshold(query.length);
  let best: { candidate: string; distance: number } | null = null;

  for (const candidate of candidates) {
    const distance = levenshteinDistance(query, candidate);
    if (distance > threshold) {
      continue;
    }

    if (!best) {
      best = { candidate, distance };
      continue;
    }

    if (distance < best.distance) {
      best = { candidate, distance };
      continue;
    }

    if (distance === best.distance && candidate.length < best.candidate.length) {
      best = { candidate, distance };
    }
  }

  return best?.candidate ?? null;
}

export function normalizePlural(word: string): string {
  if (word.length < 3) {
    return word;
  }

  const normalized = word.toLowerCase();

  const withGuard = (next: string): string => {
    if (next.length < 3) {
      return normalized;
    }
    return next;
  };

  if (normalized.endsWith('ies')) {
    return withGuard(`${normalized.slice(0, -3)}y`);
  }

  if (normalized.endsWith('ves')) {
    return withGuard(`${normalized.slice(0, -3)}f`);
  }

  if (normalized.endsWith('es')) {
    return withGuard(normalized.slice(0, -2));
  }

  if (normalized.endsWith('s')) {
    return withGuard(normalized.slice(0, -1));
  }

  return normalized;
}
