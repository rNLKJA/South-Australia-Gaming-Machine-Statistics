/** Small numeric helpers shared by the domain modules. */

export function sum(values: number[]): number {
  let s = 0
  for (const v of values) s += v
  return s
}

export function mean(values: number[]): number | null {
  return values.length ? sum(values) / values.length : null
}

/** Round to `digits` decimals, removing binary floating-point noise. */
export function round(v: number, digits = 2): number {
  const f = 10 ** digits
  return Math.round((v + Number.EPSILON) * f) / f
}

/** Group items by a key, preserving first-seen key order. */
export function groupBy<T, K extends string>(items: T[], key: (item: T) => K): Map<K, T[]> {
  const out = new Map<K, T[]>()
  for (const item of items) {
    const k = key(item)
    const list = out.get(k)
    if (list) list.push(item)
    else out.set(k, [item])
  }
  return out
}

/**
 * Quantile class breaks: returns k-1 ascending thresholds that split `values` into k classes of
 * roughly equal size. Duplicates are removed, so fewer classes may result for small samples.
 */
export function quantileBreaks(values: number[], k: number): number[] {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b)
  if (v.length === 0 || k < 2) return []
  const breaks: number[] = []
  for (let i = 1; i < k; i++) {
    const pos = (v.length - 1) * (i / k)
    const lo = Math.floor(pos)
    const hi = Math.ceil(pos)
    const q = v[lo] + (v[hi] - v[lo]) * (pos - lo)
    if (!breaks.length || q > breaks[breaks.length - 1]) breaks.push(q)
  }
  return breaks
}

/** Index of the class a value falls into given ascending breaks (0..breaks.length). */
export function classIndex(value: number, breaks: number[]): number {
  let i = 0
  while (i < breaks.length && value > breaks[i]) i++
  return i
}
