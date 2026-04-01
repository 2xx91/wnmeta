import assert from "node:assert/strict";
import test from "node:test";

import {
  createKakaoWebnovelRow,
  createNaverWebnovelRow,
  findNullRequiredFields
} from "../src/lib/webnovels.js";

test("createKakaoWebnovelRow normalizes detail payload into a DB row", () => {
  const row = createKakaoWebnovelRow({
    id: 123,
    title: "제목",
    author: "  작가  ",
    publisher: "  출판사  ",
    genre: {
      category: "판타지",
      subCategory: "현판"
    },
    viewCount: "470",
    rating: "9.8",
    status: "연재",
    firstSerializedAt: "2026-03-01T10:00:00+09:00",
    lastSerializedAt: "2026-03-30",
    currentEpisode: 247,
    synopsis: "  소개  ",
    commentCount: -3,
    coverUrl: " https://example.com/cover.jpg "
  });

  assert.deepEqual(row, {
    platform: "K",
    source_id: "123",
    title: "제목",
    author: "작가",
    publisher: "출판사",
    genre: "현판",
    view_count: 470,
    rating: 9.8,
    status: "연재",
    first_serialized_at: "2026-03-01",
    last_serialized_at: "2026-03-30",
    current_episode: 247,
    synopsis: "소개",
    comment_count: 0,
    cover_url: "https://example.com/cover.jpg"
  });
});

test("createNaverWebnovelRow keeps nullable fields nullable and count fields non-negative", () => {
  const row = createNaverWebnovelRow({
    id: 456,
    title: "네이버 작품",
    author: "  ",
    publisher: null,
    genre: "로판",
    viewCount: null,
    rating: null,
    status: "완결",
    firstSerializedAt: null,
    lastSerializedAt: "2026-03-29 23:59:59",
    currentEpisode: null,
    synopsis: "",
    commentCount: "12",
    coverUrl: null
  });

  assert.deepEqual(row, {
    platform: "N",
    source_id: "456",
    title: "네이버 작품",
    author: null,
    publisher: null,
    genre: "로판",
    view_count: 0,
    rating: null,
    status: "완결",
    first_serialized_at: null,
    last_serialized_at: "2026-03-29",
    current_episode: null,
    synopsis: null,
    comment_count: 12,
    cover_url: null
  });
});

test("findNullRequiredFields ignores optional nullable columns", () => {
  const missing = findNullRequiredFields({
    platform: "N",
    source_id: "789",
    title: "작품",
    author: "작가",
    publisher: null,
    genre: "판타지",
    view_count: null,
    rating: null,
    status: null,
    first_serialized_at: "2026-03-01",
    last_serialized_at: "2026-03-02",
    current_episode: 10,
    synopsis: null,
    comment_count: null,
    cover_url: "https://example.com/cover.jpg"
  });

  assert.deepEqual(missing, ["publisher", "status"]);
});
