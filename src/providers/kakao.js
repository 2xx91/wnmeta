import { extractCookieHeader, fetchJson, mergeCookieHeaders, sleep } from "../lib/http.js";
import { normalizeWhitespace } from "../lib/parse.js";

const DEFAULT_CATEGORY_UID = 11;
const KAKAO_LIST_DELAY_MS = 500;
const GENRE_API_URL = "https://page.kakao.com/api/gateway/view/v1/landing/genre";
const CONTENT_OVERVIEW_API_URL = "https://page.kakao.com/api/gateway/api/v1/content/overview";
const CONTENT_ABOUT_API_URL = "https://page.kakao.com/api/gateway/api/v1/content/about";
const KAKAO_SUBCATEGORY_ALIASES = new Map([
  ["판타지", 86],
  ["현판", 120],
  ["로맨스", 89],
  ["로판", 117],
  ["무협", 87],
  ["BL", 123]
]);
export const KAKAO_GENRES = Array.from(KAKAO_SUBCATEGORY_ALIASES.keys());

function buildGenreUrl(categoryUid = DEFAULT_CATEGORY_UID) {
  return `https://page.kakao.com/landing/genre/${categoryUid}`;
}

function resolveKakaoSubcategoryUid(value) {
  if (value == null || value === "") {
    return undefined;
  }

  const normalized = String(value).trim();
  if (!normalized) {
    return undefined;
  }

  if (/^\d+$/.test(normalized)) {
    const numericValue = Number(normalized);
    return numericValue;
  }

  const aliasValue = KAKAO_SUBCATEGORY_ALIASES.get(normalized);

  if (aliasValue == null) {
    throw new Error(`Unsupported Kakao genre: ${value}`);
  }

  return aliasValue;
}

async function getKakaoSessionCookie({ categoryUid = DEFAULT_CATEGORY_UID } = {}) {
  const genreUrl = buildGenreUrl(categoryUid);
  const response = await fetch(genreUrl, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to initialize Kakao session: ${response.status} ${response.statusText}`);
  }

  const landingCookie = extractCookieHeader(response);
  const html = await response.text();
  const nextDataMatch = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/
  );

  if (!nextDataMatch && html.includes("접근할 수 없는 페이지")) {
    throw new Error("Kakao blocked the landing request");
  }

  if (!nextDataMatch) {
    return landingCookie;
  }

  const nextData = JSON.parse(nextDataMatch[1]);
  const initialCookie = nextData?.props?.pageProps?.initialState?.json?.user?.user?.accessToken;

  return mergeCookieHeaders(landingCookie, initialCookie);
}

function buildKakaoHeaders({ referer, cookieHeader }) {
  return {
    referer,
    cookie: cookieHeader
  };
}

function buildKakaoCoverUrl(thumbnail) {
  if (!thumbnail) {
    return null;
  }

  const url = new URL("https://page-images.kakaoentcdn.com/download/resource");
  url.searchParams.set("kid", thumbnail);
  url.searchParams.set("filename", "o1");
  return url.toString();
}

function toDateOnly(value) {
  const match = String(value ?? "").match(/\d{4}-\d{2}-\d{2}/);
  return match?.[0] ?? null;
}

function normalizeKakaoStatus(content) {
  const rawStatus = normalizeWhitespace(
    content?.status ?? content?.statusText ?? content?.onIssueText ?? content?.onIssueLabel ?? ""
  );
  if (rawStatus.includes("휴재")) {
    return "휴재";
  }
  if (rawStatus.includes("완결")) {
    return "완결";
  }
  if (rawStatus.includes("중단")) {
    return "중단";
  }
  if (rawStatus.includes("연재")) {
    return "연재";
  }

  const onIssue = normalizeWhitespace(content?.on_issue ?? content?.onIssue ?? "");
  if (onIssue === "P" || onIssue === "Pause") {
    return "휴재";
  }
  if (onIssue === "Stop" || onIssue === "StopSale" || onIssue === "Terminate") {
    return "중단";
  }
  if (onIssue === "N" || onIssue === "End") {
    return "완결";
  }
  if (onIssue === "Y" || onIssue === "Ing") {
    return "연재";
  }

  return null;
}

export async function fetchKakaoGenrePage({
  page = 0,
  sortType = "PRODUCT_LATEST",
  isComplete = false,
  categoryUid = DEFAULT_CATEGORY_UID,
  subcategoryUid,
  cookieHeader
} = {}) {
  const genreUrl = buildGenreUrl(categoryUid);
  const resolvedSubcategoryUid = resolveKakaoSubcategoryUid(subcategoryUid);
  const sessionCookie = cookieHeader ?? (await getKakaoSessionCookie({ categoryUid }));
  const url = new URL(GENRE_API_URL);
  url.searchParams.set("category_uid", String(categoryUid));
  url.searchParams.set("page", String(page));
  url.searchParams.set("sort_type", sortType);
  url.searchParams.set("is_complete", String(isComplete));
  if (resolvedSubcategoryUid != null) {
    url.searchParams.set("subcategory_uid", String(resolvedSubcategoryUid));
  }

  const payload = await fetchJson(url, {
    headers: buildKakaoHeaders({
      referer: genreUrl,
      cookieHeader: sessionCookie
    })
  });

  return {
    cookieHeader: sessionCookie,
    payload
  };
}

export async function collectKakaoSeriesIds({
  startPage = 0,
  maxPages,
  sortType = "PRODUCT_LATEST",
  categoryUid = DEFAULT_CATEGORY_UID,
  subcategoryUid,
  cutoffDate,
  onPage
} = {}) {
  const resolvedSubcategoryUid = resolveKakaoSubcategoryUid(subcategoryUid);
  const cookieHeader = await getKakaoSessionCookie({ categoryUid });
  const items = [];
  let page = startPage;
  let stoppedByCutoff = false;

  while (true) {
    const { payload } = await fetchKakaoGenrePage({
      page,
      sortType,
      isComplete: false,
      categoryUid,
      subcategoryUid: resolvedSubcategoryUid,
      cookieHeader
    });

    const seriesList = payload?.result?.list ?? [];
    if (seriesList.length === 0) break;

    let pageCount = 0;
    for (const entry of seriesList) {
      const lastSerializedAt = toDateOnly(entry.last_slide_added_dt ?? entry.start_sale_dt);
      if (cutoffDate != null && lastSerializedAt != null && lastSerializedAt < cutoffDate) {
        stoppedByCutoff = true;
        break;
      }

      items.push({
        seriesId: entry.series_id,
        title: entry.title,
        category: entry.category,
        subCategory: entry.sub_category,
        ageGrade: entry.age_grade ?? null,
        onIssue: entry.on_issue,
        lastSerializedAt
      });
      pageCount += 1;
    }

    onPage?.({
      page,
      count: pageCount,
      total: items.length
    });

    if (stoppedByCutoff) break;
    if (payload?.result?.is_end) break;
    if (maxPages != null && page - startPage + 1 >= maxPages) break;

    page += 1;
    await sleep(KAKAO_LIST_DELAY_MS);
  }

  return {
    cookieHeader,
    items
  };
}

export async function fetchKakaoSeriesDetail(
  seriesId,
  { cookieHeader, includePublisher = true } = {}
) {
  const sessionCookie = cookieHeader ?? (await getKakaoSessionCookie());

  const overviewUrl = new URL(CONTENT_OVERVIEW_API_URL);
  overviewUrl.searchParams.set("series_id", String(seriesId));

  const aboutUrl = new URL(CONTENT_ABOUT_API_URL);
  aboutUrl.searchParams.set("series_id", String(seriesId));

  const referer = `https://page.kakao.com/content/${seriesId}?tab_type=product`;
  const detailHeaders = buildKakaoHeaders({ referer, cookieHeader: sessionCookie });
  const overviewPayload = await fetchJson(overviewUrl, {
    headers: detailHeaders
  });
  const aboutPayload = includePublisher
    ? await fetchJson(aboutUrl, {
        headers: detailHeaders
      })
    : null;

  const content = overviewPayload?.result?.content;
  const about = aboutPayload?.result ?? null;
  if (!content || (includePublisher && !about)) {
    throw new Error(`Unexpected Kakao detail payload for ${seriesId}`);
  }

  const serviceProperty = content.service_property ?? content.serviceProperty ?? {};
  const category = content.category ?? null;
  const subCategory = content.sub_category ?? content.subcategory ?? null;
  const firstSerializedAt = content.start_sale_dt ?? content.startSaleDt ?? null;
  const lastSerializedAt = content.last_slide_added_dt ?? content.lastSlideAddedDate ?? null;
  const publisher = about?.detail?.publisher_name ?? null;
  const coverUrl = buildKakaoCoverUrl(content.thumbnail);

  return {
    source: "kakao",
    id: content.series_id,
    title: normalizeWhitespace(content.title),
    author: normalizeWhitespace(content.authors),
    publisher: normalizeWhitespace(publisher) || null,
    genre: {
      category,
      subCategory
    },
    viewCount: serviceProperty.view_count ?? serviceProperty.viewCount ?? null,
    status: normalizeKakaoStatus(content),
    firstSerializedAt,
    lastSerializedAt,
    currentEpisode: content.on_sale_count ?? null,
    synopsis: content.description ?? "",
    commentCount: serviceProperty.comment_count ?? serviceProperty.commentCount ?? null,
    coverUrl
  };
}

export async function createKakaoSessionCookie() {
  return getKakaoSessionCookie();
}
