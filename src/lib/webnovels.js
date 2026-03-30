function toNullableText(value) {
  if (value == null) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized || null;
}

function toDateOnly(value) {
  if (value == null) {
    return null;
  }

  const match = String(value).match(/\d{4}-\d{2}-\d{2}/);
  return match?.[0] ?? null;
}

const OPTIONAL_WEBNOVEL_FIELDS = new Set(["view_count", "synopsis", "comment_count"]);

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

export function findNullRequiredFields(row) {
  return Object.entries(row)
    .filter(([key, value]) => !OPTIONAL_WEBNOVEL_FIELDS.has(key) && value == null)
    .map(([key]) => key);
}

function createWebnovelRow({ platform, detail, genre }) {
  return {
    platform,
    source_id: String(detail.id),
    title: detail.title,
    author: toNullableText(detail.author),
    publisher: toNullableText(detail.publisher),
    genre: toNullableText(genre),
    view_count: toNonNegativeCount(detail.viewCount),
    status: toNullableText(detail.status),
    first_serialized_at: toDateOnly(detail.firstSerializedAt),
    last_serialized_at: toDateOnly(detail.lastSerializedAt),
    current_episode: detail.currentEpisode ?? null,
    synopsis: toNullableText(detail.synopsis),
    comment_count: toNonNegativeCount(detail.commentCount),
    cover_url: toNullableText(detail.coverUrl)
  };
}

export function createKakaoWebnovelRow(detail) {
  return createWebnovelRow({
    platform: "K",
    detail,
    genre: detail.genre?.subCategory ?? detail.genre?.category
  });
}

export function createNaverWebnovelRow(detail) {
  return createWebnovelRow({
    platform: "N",
    detail,
    genre: detail.genre
  });
}
