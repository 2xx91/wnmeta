import assert from "node:assert/strict";
import test from "node:test";

import { fetchKakaoSeriesDetail } from "../src/providers/kakao.js";

function createJsonResponse(body) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "content-type": "application/json"
    }
  });
}

test("fetchKakaoSeriesDetail reads rating from overview service_property", async () => {
  const originalFetch = global.fetch;

  global.fetch = async (url) => {
    const value = String(url);

    if (value.startsWith("https://page.kakao.com/api/gateway/api/v1/content/overview")) {
      return createJsonResponse({
        result: {
          content: {
            service_property: {
              view_count: 348553,
              rating_count: 996,
              rating_sum: 9879,
              comment_count: 230
            },
            series_id: 62406057,
            title: "조선연애화담",
            thumbnail: "kid-value",
            category: "웹소설",
            sub_category: "로맨스",
            authors: "현루아",
            on_issue: "N",
            start_sale_dt: "2023-08-07T22:00:06+09:00",
            last_slide_added_dt: "2024-05-14T18:00:16+09:00",
            on_sale_count: 108,
            description: "소개"
          }
        }
      });
    }

    throw new Error(`Unexpected fetch url: ${value}`);
  };

  try {
    const detail = await fetchKakaoSeriesDetail(62406057, {
      cookieHeader: "session=test",
      includePublisher: false
    });

    assert.equal(detail.rating, 9.9);
    assert.equal(detail.viewCount, 348553);
    assert.equal(detail.commentCount, 230);
  } finally {
    global.fetch = originalFetch;
  }
});
