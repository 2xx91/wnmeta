import * as cheerio from "cheerio";

import { fetchJson, fetchText } from "../lib/http.js";
import { normalizeWhitespace, parseDecimalNumber, parseKoreanCount } from "../lib/parse.js";

const CATEGORY_URL = "https://series.naver.com/novel/categoryProductList.series";
const DETAIL_URL = "https://series.naver.com/novel/detail.series";
const VOLUME_LIST_URL = "https://series.naver.com/novel/volumeList.series";
const NAVER_GENRE_ALIASES = new Map([
  ["로맨스", "201"],
  ["판타지", "202"],
  ["무협", "206"],
  ["로판", "207"],
  ["현판", "208"],
  ["BL", "209"]
]);
export const NAVER_GENRES = Array.from(NAVER_GENRE_ALIASES.keys());

function isNaverStopSaleHtml(html) {
  const source = String(html ?? "");
  const $ = cheerio.load(source);
  const title = normalizeWhitespace($("title").text());
  const bodyText = normalizeWhitespace($("body").text());

  return (
    source.includes("/error/stopSale.series") ||
    source.includes("판매중지상품안내") ||
    source.includes("판매중지 되었습니다") ||
    title.includes("판매중지상품안내") ||
    bodyText.includes("판매 중지된 상품 페이지입니다") ||
    bodyText.includes("해당 상품은 판매중지 되었습니다")
  );
}

function resolveNaverGenreCode(value) {
  if (value == null || value === "") {
    throw new Error("Missing Naver genre");
  }

  const normalized = String(value).trim();
  if (!normalized) {
    throw new Error("Missing Naver genre");
  }

  if (/^\d+$/.test(normalized)) {
    return normalized;
  }

  const aliasValue = NAVER_GENRE_ALIASES.get(normalized);

  if (aliasValue == null) {
    throw new Error(`Unsupported Naver genre: ${value}`);
  }

  return aliasValue;
}

function buildCategoryUrl({ page, genreCode } = {}) {
  const url = new URL(CATEGORY_URL);
  if (genreCode == null || genreCode === "") {
    url.searchParams.set("categoryTypeCode", "all");
  } else {
    const resolvedGenreCode = resolveNaverGenreCode(genreCode);
    url.searchParams.set("categoryTypeCode", "genre");
    url.searchParams.set("genreCode", resolvedGenreCode);
  }
  url.searchParams.set("page", String(page));
  return url.toString();
}

function buildDetailUrl(productNo) {
  const url = new URL(DETAIL_URL);
  url.searchParams.set("productNo", String(productNo));
  return url.toString();
}

function buildVolumeListUrl(productNo, totalCount, sortOrder) {
  const url = new URL(VOLUME_LIST_URL);
  url.searchParams.set("productNo", String(productNo));
  url.searchParams.set("sortOrder", sortOrder);
  url.searchParams.set("totalCount", String(totalCount));
  return url.toString();
}

function parseDateOnly(value) {
  const match = String(value ?? "").match(/\d{4}[.-]\d{2}[.-]\d{2}/);
  return match?.[0]?.replace(/\./g, "-") ?? null;
}

function normalizeNaverStatus(value) {
  const status = normalizeWhitespace(value);
  if (!status) {
    return null;
  }
  if (status.includes("휴재")) {
    return "휴재";
  }
  if (status.includes("완결")) {
    return "완결";
  }
  if (status.includes("중단")) {
    return "중단";
  }
  if (status.includes("연재")) {
    return "연재";
  }

  return null;
}

function parseNaverListItems(html) {
  const $ = cheerio.load(html);
  const seen = new Set();
  const items = [];

  $("a[href*='/novel/detail.series?productNo=']").each((_, element) => {
    const listItem = $(element).closest("li");
    const href = $(element).attr("href") ?? "";
    const match = href.match(/productNo=(\d+)/);
    if (!match) {
      return;
    }

    const productNo = Number(match[1]);
    if (seen.has(productNo)) {
      return;
    }
    seen.add(productNo);

    const listedAt = parseDateOnly(listItem.find("p.info").text());
    const imageSrc = listItem.find("img").first().attr("src") ?? "";
    const isAdult = listItem.find("em.ico.n19").length > 0 || imageSrc.includes("19over_book");
    items.push({
      productNo,
      listedAt,
      isAdult
    });
  });

  return items;
}

export async function collectNaverProductIds({
  startPage = 1,
  maxPages,
  genreCode,
  cutoffDate,
  onPage
} = {}) {
  const items = [];
  let page = startPage;
  let previousSignature = null;
  let stoppedByCutoff = false;

  while (true) {
    const html = await fetchText(buildCategoryUrl({ page, genreCode }));
    const pageItems = parseNaverListItems(html);
    const ids = pageItems.map((item) => item.productNo);

    if (ids.length === 0) break;

    const signature = ids.join(",");
    if (signature === previousSignature) break;
    previousSignature = signature;

    let pageCount = 0;
    for (const item of pageItems) {
      if (item.isAdult) {
        continue;
      }

      if (cutoffDate != null && item.listedAt != null && item.listedAt < cutoffDate) {
        stoppedByCutoff = true;
        break;
      }

      items.push(item);
      pageCount += 1;
    }

    onPage?.({
      page,
      count: pageCount,
      total: items.length
    });

    if (stoppedByCutoff) break;
    if (maxPages != null && page - startPage + 1 >= maxPages) break;
    page += 1;
  }

  return { items };
}

function parseNaverDetailHtml(html) {
  const $ = cheerio.load(html);

  const title = normalizeWhitespace($("#content .end_head h2").first().text());
  const status = normalizeWhitespace($(".end_info .info_lst > ul > li").first().text());
  const genre = normalizeWhitespace($(".end_info .info_lst > ul > li a").first().text());
  const author = normalizeWhitespace(
    $(".end_info .info_lst > ul > li")
      .filter((_, element) => normalizeWhitespace($(element).find("span").first().text()) === "글")
      .first()
      .find("a")
      .text()
  );
  const publisher = normalizeWhitespace(
    $(".end_info .info_lst > ul > li")
      .filter((_, element) => normalizeWhitespace($(element).find("span").first().text()) === "출판사")
      .first()
      .find("a")
      .text()
  );
  const viewCount = parseKoreanCount($(".user_action_area .btn_download span").first().text());
  const parsedCommentCount = parseKoreanCount($("#commentCount").first().text());
  const commentCount = parsedCommentCount == null ? null : Math.max(0, parsedCommentCount);
  const rating = parseDecimalNumber(
    $(".end_head .score_num").first().text() ||
      $(".end_head .score_area").first().text() ||
      $("#content").text().match(/평점\s*([0-9]+(?:\.[0-9]+)?)/)?.[1] ||
      null
  );
  const synopsis = normalizeWhitespace($("._synopsis").first().text());
  const totalEpisode = Number(normalizeWhitespace($(".end_total_episode strong").first().text()));
  const coverUrl =
    $(".pic_area img").first().attr("src") ??
    $('meta[property="og:image"]').attr("content") ??
    null;

  return {
    title,
    status,
    genre,
    author,
    publisher,
    viewCount,
    rating,
    commentCount,
    synopsis,
    totalEpisode,
    coverUrl
  };
}

async function fetchVolumeBoundary(productNo, totalCount, sortOrder) {
  const payload = await fetchJson(buildVolumeListUrl(productNo, totalCount, sortOrder));
  const first = payload?.resultData?.[0];

  return {
    totalCount: first?.totalVolumeCount ?? totalCount,
    boundaryDate: first?.lastVolumeUpdateDate ?? null
  };
}

export async function fetchNaverSeriesDetail(productNo) {
  const html = await fetchText(buildDetailUrl(productNo));

  if (isNaverStopSaleHtml(html)) {
    return {
      source: "naver",
      id: Number(productNo),
      status: "중단"
    };
  }

  const detail = parseNaverDetailHtml(html);

  if (!detail.title) {
    if (isNaverStopSaleHtml(html)) {
      return {
        source: "naver",
        id: Number(productNo),
        status: "중단"
      };
    }

    throw new Error(`Failed to parse Naver detail page for productNo=${productNo}`);
  }

  const latest = await fetchVolumeBoundary(productNo, detail.totalEpisode, "DESC");
  const earliest = await fetchVolumeBoundary(productNo, detail.totalEpisode, "ASC");

  return {
    source: "naver",
    id: Number(productNo),
    title: detail.title,
    author: detail.author,
    publisher: detail.publisher || null,
    genre: detail.genre,
    viewCount: detail.viewCount,
    rating: detail.rating,
    status: normalizeNaverStatus(detail.status),
    firstSerializedAt: earliest.boundaryDate,
    lastSerializedAt: latest.boundaryDate,
    currentEpisode: latest.totalCount ?? detail.totalEpisode,
    synopsis: detail.synopsis,
    commentCount: detail.commentCount,
    coverUrl: detail.coverUrl
  };
}
