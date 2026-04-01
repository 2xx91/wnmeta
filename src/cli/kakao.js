#!/usr/bin/env node

import {
  KAKAO_GENRES,
  collectKakaoSeriesIds,
  createKakaoSessionCookie,
  fetchKakaoSeriesDetail
} from "../providers/kakao.js";
import {
  loadExistingPlatformIds,
  runPlatformCli,
  shiftDateByDays
} from "../lib/platform-cli.js";
import {
  getPlatformLatestSerializedAt,
  listPlatformSourceIds,
  listOngoingSourceRows,
  upsertWebnovelHistory
} from "../lib/supabase.js";
import { syncDetailItems } from "../lib/detail-sync.js";
import { createWebnovelHistoryRow } from "../lib/webnovel-history.js";
import { createKakaoWebnovelRow } from "../lib/webnovels.js";

const DETAIL_DELAY_MS = 500;

function isAdultKakaoItem(item) {
  return Number(item?.ageGrade ?? 0) >= 19;
}

async function loadExistingKakaoIds() {
  return loadExistingPlatformIds("K", "kakao");
}

async function syncKakaoItems({ items, cookieHeader, existingIds, label }) {
  const knownIds = existingIds ?? (await loadExistingKakaoIds());
  const nonAdultItems = items.filter((item) => !isAdultKakaoItem(item));
  const pendingItems = nonAdultItems.filter((item) => !knownIds.has(String(item.seriesId)));
  console.error(`[kakao] ${label} skipped adult=${items.length - nonAdultItems.length}`);
  console.error(`[kakao] ${label} skipped existing=${nonAdultItems.length - pendingItems.length}`);
  return syncDetailItems({
    platform: "K",
    logPrefix: "kakao",
    sourceLabel: "seriesId",
    items: pendingItems,
    label,
    getSourceId: (item) => item.seriesId,
    fetchDetail: (item) => fetchKakaoSeriesDetail(item.seriesId, { cookieHeader }),
    createRow: createKakaoWebnovelRow,
    knownIds,
    delayMs: DETAIL_DELAY_MS
  });
}

async function syncKakaoGenre({ genre, maxPages, existingIds }) {
  console.error(`[kakao] collecting ids for genre=${genre}`);
  const collected = await collectKakaoSeriesIds({
    maxPages,
    subcategoryUid: genre,
    onPage: ({ page, count, total }) => {
      console.error(`[kakao] collected ids page=${page} count=${count} total=${total}`);
    }
  });
  const items = collected.items;
  const cookieHeader = collected.cookieHeader;

  console.error(`[kakao] collected ids total=${items.length}`);
  const synced = await syncKakaoItems({
    items,
    cookieHeader,
    existingIds,
    label: `genre=${genre}`
  });

  return {
    platform: "K",
    genre,
    total: items.length,
    synced
  };
}

async function syncKakaoOngoing() {
  console.error("[kakao] loading ongoing rows from db");
  const sourceRows = await listOngoingSourceRows("K");
  const sourceIds = sourceRows.map((row) => String(row.source_id));
  const publisherById = new Map(
    sourceRows.map((row) => [String(row.source_id), row.publisher ?? null])
  );
  console.error(`[kakao] ongoing ids total=${sourceIds.length}`);
  const cookieHeader = await createKakaoSessionCookie();
  const synced = await syncDetailItems({
    platform: "K",
    logPrefix: "kakao",
    sourceLabel: "seriesId",
    items: sourceIds,
    label: "ongoing",
    getSourceId: (sourceId) => sourceId,
    fetchDetail: async (sourceId) => {
      const existingPublisher = publisherById.get(String(sourceId)) ?? null;
      const detail = await fetchKakaoSeriesDetail(Number(sourceId), {
        cookieHeader,
        includePublisher: existingPublisher == null
      });

      if (existingPublisher != null && detail.publisher == null) {
        detail.publisher = existingPublisher;
      }

      return detail;
    },
    createRow: createKakaoWebnovelRow,
    afterUpsert: async ({ row, sourceId }) => {
      const historyRow = createWebnovelHistoryRow({
        row
      });

      if (historyRow == null) {
        return;
      }

      await upsertWebnovelHistory(historyRow);

      console.error(
        `[kakao] ongoing history seriesId=${sourceId} view=${historyRow.view_count} comment=${historyRow.comment_count}`
      );
    },
    delayMs: DETAIL_DELAY_MS
  });

  return {
    platform: "K",
    mode: "ongoing",
    total: sourceIds.length,
    synced
  };
}

async function syncLatestKakao({ maxPages } = {}) {
  const dbCutoffDate = await getPlatformLatestSerializedAt("K");
  const cutoffDate = shiftDateByDays(dbCutoffDate, -1);
  const resolvedMaxPages = maxPages;
  console.error(
    `[kakao] latest collecting ids dbCutoffDate=${dbCutoffDate ?? "none"} cutoffDate=${cutoffDate ?? "none"} maxPages=${resolvedMaxPages ?? "all"}`
  );
  const { items, cookieHeader } = await collectKakaoSeriesIds({
    sortType: "UPDATE",
    maxPages: resolvedMaxPages,
    cutoffDate,
    onPage: ({ page, count, total }) => {
      console.error(`[kakao] latest collected ids page=${page} count=${count} total=${total}`);
    }
  });
  console.error(`[kakao] latest collected ids total=${items.length}`);
  console.error("[kakao] latest loading non-complete ids from db");
  const existingIds = await listPlatformSourceIds("K", {
    excludeStatuses: ["완결"]
  });
  console.error(`[kakao] latest non-complete ids total=${existingIds.size}`);
  const totalSynced = await syncKakaoItems({
    items,
    cookieHeader,
    existingIds,
    label: "latest"
  });
  const ongoingResult = await syncKakaoOngoing();

  return {
    platform: "K",
    mode: "latest",
    cutoffDate,
    dbCutoffDate,
    maxPages: resolvedMaxPages ?? null,
    total: items.length,
    synced: totalSynced,
    ongoing: ongoingResult
  };
}

async function main() {
  const [, , ...rest] = process.argv;
  const completed = await runPlatformCli({
    argv: rest,
    platform: "K",
    platformName: "Kakao",
    scriptPath: "src/cli/kakao.js",
    genres: KAKAO_GENRES,
    syncLatest: syncLatestKakao,
    syncGenre: syncKakaoGenre,
    loadExistingIds: loadExistingKakaoIds
  });

  if (!completed) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
