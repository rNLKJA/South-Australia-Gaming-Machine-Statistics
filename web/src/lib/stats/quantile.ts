/** Type-7 quantile (linear interpolation, the default in numpy, R and Excel). */
export function quantile(xs: readonly number[], p: number): number {
  if (!xs.length) return NaN
  if (!(p >= 0 && p <= 1)) throw new RangeError("p must lie in [0, 1]")
  const s = [...xs].sort((a, b) => a - b)
  const h = (s.length - 1) * p
  const lo = Math.floor(h)
  const hi = Math.ceil(h)
  return s[lo] + (h - lo) * (s[hi] - s[lo])
}

export function median(xs: readonly number[]): number {
  return quantile(xs, 0.5)
}
