import assert from "node:assert/strict";
import test from "node:test";

import { filterStoppedDetail } from "../src/lib/stopped-detail.js";

test("filterStoppedDetail returns the detail when it is not stopped", async () => {
  const updates = [];
  const logs = [];
  const detail = { status: "연재" };

  const result = await filterStoppedDetail({
    detail,
    isStoppedDetail: (value) => value?.status === "중단",
    updateStatus: async (...args) => {
      updates.push(args);
    },
    platform: "N",
    sourceId: "100",
    logPrefix: "naver",
    sourceLabel: "productNo",
    log: (message) => {
      logs.push(message);
    }
  });

  assert.equal(result, detail);
  assert.deepEqual(updates, []);
  assert.deepEqual(logs, []);
});

test("filterStoppedDetail marks stopped items and skips syncing them", async () => {
  const updates = [];
  const logs = [];

  const result = await filterStoppedDetail({
    detail: { status: "중단" },
    isStoppedDetail: (value) => value?.status === "중단",
    updateStatus: async (...args) => {
      updates.push(args);
    },
    platform: "N",
    sourceId: "200",
    logPrefix: "naver",
    sourceLabel: "productNo",
    log: (message) => {
      logs.push(message);
    }
  });

  assert.equal(result, null);
  assert.deepEqual(updates, [["N", "200", "중단"]]);
  assert.deepEqual(logs, ["[naver] marked stopped productNo=200"]);
});

test("filterStoppedDetail logs update failures and still skips the stopped item", async () => {
  const logs = [];

  const result = await filterStoppedDetail({
    detail: { status: "중단" },
    isStoppedDetail: (value) => value?.status === "중단",
    updateStatus: async () => {
      throw new Error("db unavailable");
    },
    platform: "N",
    sourceId: "300",
    logPrefix: "naver",
    sourceLabel: "productNo",
    log: (message) => {
      logs.push(message);
    }
  });

  assert.equal(result, null);
  assert.deepEqual(logs, ["[naver] stopped productNo=300 db unavailable"]);
});
