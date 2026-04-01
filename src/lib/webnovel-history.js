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

export function createWebnovelHistoryRow({
  row,
  historyDate
}) {
  if (row?.status !== "연재") {
    return null;
  }

  return {
    platform: row.platform,
    source_id: String(row.source_id),
    history_date: historyDate ?? new Date().toISOString().slice(0, 10),
    view_count: toNonNegativeCount(row.view_count),
    comment_count: toNonNegativeCount(row.comment_count)
  };
}
