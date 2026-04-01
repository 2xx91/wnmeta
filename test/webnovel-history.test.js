import assert from "node:assert/strict";
import test from "node:test";

import { createWebnovelHistoryRow } from "../src/lib/webnovel-history.js";

test("createWebnovelHistoryRow builds absolute history for 연재 rows", () => {
  const row = createWebnovelHistoryRow({
    row: {
      platform: "K",
      source_id: "101",
      status: "연재",
      view_count: 150,
      rating: 9.8,
      comment_count: 13
    },
    historyDate: "2026-03-31"
  });

  assert.deepEqual(row, {
    platform: "K",
    source_id: "101",
    history_date: "2026-03-31",
    view_count: 150,
    rating: 9.8,
    comment_count: 13
  });
});

test("createWebnovelHistoryRow skips non-연재 rows", () => {
  const row = createWebnovelHistoryRow({
    row: {
      platform: "N",
      source_id: "303",
      status: "완결",
      view_count: 15,
      comment_count: 4
    }
  });

  assert.equal(row, null);
});

test("createWebnovelHistoryRow normalizes missing or invalid counts to zero", () => {
  const row = createWebnovelHistoryRow({
    row: {
      platform: "N",
      source_id: "404",
      status: "연재",
      view_count: -1,
      rating: -5,
      comment_count: null
    },
    historyDate: "2026-03-31"
  });

  assert.equal(row.view_count, 0);
  assert.equal(row.rating, null);
  assert.equal(row.comment_count, 0);
});

test("createWebnovelHistoryRow uses KST date when historyDate is omitted", () => {
  const row = createWebnovelHistoryRow({
    row: {
      platform: "K",
      source_id: "505",
      status: "연재",
      view_count: 1,
      comment_count: 2
    },
    now: new Date("2026-04-01T16:17:00Z")
  });

  assert.equal(row.history_date, "2026-04-02");
});
