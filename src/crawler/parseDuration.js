/** Parse "30m", "1h", "90s", or raw milliseconds → ms. */
export function parseDurationMs(value, fallbackMs) {
  if (value == null || value === '') return fallbackMs;
  const raw = String(value).trim();
  const asNum = Number(raw);
  if (!Number.isNaN(asNum) && asNum > 0 && !/[a-z]/i.test(raw)) {
    return asNum;
  }
  const m = raw.match(/^(\d+(?:\.\d+)?)(ms|s|m|h|d)?$/i);
  if (!m) return fallbackMs;
  const amount = Number(m[1]);
  const unit = (m[2] || 'ms').toLowerCase();
  const mult = { ms: 1, s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit];
  return Math.round(amount * (mult || 1));
}
