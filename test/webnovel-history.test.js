import assert from "node:assert/strict";
import test from "node:test";

import { createWebnovelHistoryRow } from "../src/lib/webnovel-history.js";

test("createWebnovelHistoryRow builds delta history for 연재 rows", () => {
  const row = createWebnovelHistoryRow({
    previousRow: {
      source_id: "101",
      view_count: 120,
      comment_count: 8
    },
    row: {
      platform: "K",
      source_id: "101",
      status: "연재",
      view_count: 150,
      comment_count: 13
    },
    historyDate: "2026-03-31"
  });

  assert.deepEqual(row, {
    platform: "K",
    source_id: "101",
    history_date: "2026-03-31",
    view_delta: 30,
    comment_delta: 5
  });
});

test("createWebnovelHistoryRow skips rows without a previous snapshot", () => {
  const row = createWebnovelHistoryRow({
    previousRow: null,
    row: {
      platform: "N",
      source_id: "202",
      status: "연재",
      view_count: 10,
      comment_count: 2
    }
  });

  assert.equal(row, null);
});

test("createWebnovelHistoryRow skips non-연재 rows", () => {
  const row = createWebnovelHistoryRow({
    previousRow: {
      source_id: "303",
      view_count: 10,
      comment_count: 3
    },
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

test("createWebnovelHistoryRow keeps negative deltas when counts go down", () => {
  const row = createWebnovelHistoryRow({
    previousRow: {
      source_id: "404",
      view_count: 80,
      comment_count: 12
    },
    row: {
      platform: "K",
      source_id: "404",
      status: "연재",
      view_count: 75,
      comment_count: 9
    },
    historyDate: "2026-03-31"
  });

  assert.equal(row.view_delta, -5);
  assert.equal(row.comment_delta, -3);
});
