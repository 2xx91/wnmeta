import assert from "node:assert/strict";
import test from "node:test";

import { listCompletedSourceRows } from "../src/lib/supabase.js";

test("listCompletedSourceRows requests only completed rows", async () => {
  const originalFetch = global.fetch;

  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SECRET_KEY = "test-key";

  global.fetch = async (url) => {
    const endpoint = new URL(String(url));
    assert.equal(endpoint.pathname, "/rest/v1/webnovels");
    assert.equal(endpoint.searchParams.get("platform"), "eq.K");
    assert.equal(endpoint.searchParams.get("status"), "eq.완결");
    assert.equal(endpoint.searchParams.get("select"), "source_id,publisher");
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: {
        "content-type": "application/json"
      }
    });
  };

  try {
    const rows = await listCompletedSourceRows("K");
    assert.deepEqual(rows, []);
  } finally {
    global.fetch = originalFetch;
  }
});
