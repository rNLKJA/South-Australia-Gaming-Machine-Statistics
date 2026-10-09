/**
 * Evenly spaced axis ticks that always keep the last candidate: every `stride`-th key counted back
 * from the end, so the latest year is labelled and the spacing never suggests a gap in the data.
 */
export function thinTicks<T>(keys: T[], maxTicks: number): T[] {
  const max = Math.max(1, Math.floor(maxTicks))
  if (keys.length <= max) return keys
  const stride = Math.ceil(keys.length / max)
  return keys.filter((_, i) => (keys.length - 1 - i) % stride === 0)
}

/** How many tick labels of `labelChars` characters fit across `width` pixels at the chart font size. */
export function ticksThatFit(width: number, labelChars: number): number {
  const perTick = labelChars * 7 + 16
  return Math.max(2, Math.floor(width / perTick))
}
