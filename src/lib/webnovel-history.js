function toNonNegativeCount(value) {
  if (value == null) {
    return 0;
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return 0;
  }

  return numericValue;
}

function toNullableRating(value) {
  if (value == null) {
    return null;
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return null;
  }

  return numericValue;
}

function toKstDateOnly(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Failed to format KST date");
  }

  return `${year}-${month}-${day}`;
}

export function createWebnovelHistoryRow({
  row,
  historyDate,
  now = new Date()
}) {
  if (row?.status !== "연재") {
    return null;
  }

  return {
    platform: row.platform,
    source_id: String(row.source_id),
    history_date: historyDate ?? toKstDateOnly(now),
    view_count: toNonNegativeCount(row.view_count),
    rating: toNullableRating(row.rating),
    comment_count: toNonNegativeCount(row.comment_count)
  };
}
