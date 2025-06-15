import gcd from "bigint-gcd/gcd";

/**
 * A set of values and their associated probabilities.
 * If there is only one value, then it represents a simple number.
 */
export interface Distr {
  ty: "distr";
  bins: Map<number, bigint>;
  total: bigint;
}

export function create(histogram: Iterable<[number, number | bigint]>): Distr {
  let total = BigInt(0);
  const bins = new Map(
    [...histogram].map(([val, cnt]) => {
      cnt = BigInt(cnt);
      total += cnt;
      return [val, cnt];
    })
  );
  return { ty: "distr", bins, total };
}

export function singular(num: number): Distr {
  return { ty: "distr", bins: new Map([[num, BigInt(1)]]), total: BigInt(1) };
}

export function simplify(distr: Distr): void {
  let g = BigInt(0);
  for (const [, cnt] of distr.bins) {
    g = gcd(g, cnt);
  }
  if (g <= 1) return;
  for (const [val, cnt] of distr.bins) {
    distr.bins.set(val, cnt / g);
  }
}

/**
 * Multiply numerators and denominators, leaving the distribution the same.
 */
export function grow(distr: Distr, factor: bigint): void {
  for (const [val, cnt] of distr.bins) {
    distr.bins.set(val, cnt * factor);
  }
  distr.total *= factor;
}

export function average(table: Distr): number | null {
  if (Number(table.total) === 0) return null;
  let total = BigInt(0);
  for (const [val, cnt] of table.bins) {
    total += BigInt(Math.round(val * 2 ** 53)) * cnt;
  }
  return Number(total / table.total) / 2 ** 53;
}

export function stddev(table: Distr, average: number | null): number | null {
  if (average === null || Number(table.total) === 0) return null;
  let variance = BigInt(0);
  for (const [val, cnt] of table.bins) {
    variance += BigInt(Math.round((val - average) ** 2 * 2 ** 53)) * cnt;
  }
  return Math.sqrt(Number(variance / table.total) / 2 ** 53);
}

export function min(table: Distr): number | null {
  const min = Math.min(...table.bins.keys());
  return min === Infinity ? null : min;
}

export function max(table: Distr): number | null {
  const max = Math.max(...table.bins.keys());
  return max === -Infinity ? null : max;
}
