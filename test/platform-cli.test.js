import assert from "node:assert/strict";
import test from "node:test";

import { getKstDateOnly, shiftDateByDays } from "../src/lib/platform-cli.js";

test("getKstDateOnly formats the current date in Asia/Seoul", () => {
  const dateOnly = getKstDateOnly({
    now: new Date("2026-04-01T16:17:00Z")
  });

  assert.equal(dateOnly, "2026-04-02");
});

test("shiftDateByDays returns the previous KST date for latest cutoff", () => {
  const cutoffDate = shiftDateByDays("2026-04-02", -1);
  assert.equal(cutoffDate, "2026-04-01");
});
