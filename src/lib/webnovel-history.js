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
  previousRow,
  row,
  historyDate
}) {
  if (previousRow == null || row?.status !== "연재") {
    return null;
  }

  const previousViewCount = toNonNegativeCount(previousRow.view_count);
  const currentViewCount = toNonNegativeCount(row.view_count);
  const previousCommentCount = toNonNegativeCount(previousRow.comment_count);
  const currentCommentCount = toNonNegativeCount(row.comment_count);

  return {
    platform: row.platform,
    source_id: String(row.source_id),
    history_date: historyDate ?? new Date().toISOString().slice(0, 10),
    view_delta: currentViewCount - previousViewCount,
    comment_delta: currentCommentCount - previousCommentCount
  };
}
