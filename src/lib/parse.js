export function parseKoreanCount(rawValue) {
  if (rawValue == null) return null;

  const text = String(rawValue).trim().replace(/,/g, "");
  if (!text) return null;

  const units = {
    억: 100000000,
    만: 10000,
    천: 1000
  };

  const unit = Object.keys(units).find((candidate) => text.endsWith(candidate));
  if (!unit) {
    const numberValue = Number(text);
    return Number.isFinite(numberValue) ? numberValue : null;
  }

  const numericPart = Number(text.slice(0, -unit.length));
  if (!Number.isFinite(numericPart)) return null;

  return Math.round(numericPart * units[unit]);
}

export function parseDecimalNumber(rawValue) {
  if (rawValue == null) return null;

  const text = String(rawValue).trim().replace(/,/g, "");
  if (!text) return null;

  const match = text.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;

  const numberValue = Number(match[0]);
  return Number.isFinite(numberValue) ? numberValue : null;
}

export function normalizeWhitespace(value) {
  if (value == null) return "";
  return String(value).replace(/\s+/g, " ").trim();
}
