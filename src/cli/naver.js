#!/usr/bin/env node

import { NAVER_GENRES, collectNaverProductIds, fetchNaverSeriesDetail } from "../providers/naver.js";
import {
  loadExistingPlatformIds,
  runPlatformCli,
  shiftDateByDays
} from "../lib/platform-cli.js";
import {
  getPlatformLatestSerializedAt,
  listPlatformSourceIds,
  listOngoingSourceRows,
  upsertWebnovelHistory,
  updateWebnovelStatus
} from "../lib/supabase.js";
import { syncDetailItems } from "../lib/detail-sync.js";
import { createWebnovelHistoryRow } from "../lib/webnovel-history.js";
import { filterStoppedDetail } from "../lib/stopped-detail.js";
import { createNaverWebnovelRow } from "../lib/webnovels.js";

function isStoppedNaverDetail(detail) {
  return detail?.status === "중단";
}

async function fetchSyncableNaverDetail(sourceId) {
  const detail = await fetchNaverSeriesDetail(Number(sourceId));
  return filterStoppedDetail({
    detail,
    isStoppedDetail: isStoppedNaverDetail,
    updateStatus: updateWebnovelStatus,
    platform: "N",
    sourceId: String(sourceId),
    logPrefix: "naver",
    sourceLabel: "productNo"
  });
}

async function loadExistingNaverIds() {
  return loadExistingPlatformIds("N", "naver");
}

async function syncNaverItems({ items, existingIds, label }) {
  const knownIds = existingIds ?? (await loadExistingNaverIds());
  const pendingItems = items.filter((item) => !knownIds.has(String(item.productNo)));
  console.error(`[naver] ${label} skipped existing=${items.length - pendingItems.length}`);
  return syncDetailItems({
    platform: "N",
    logPrefix: "naver",
    sourceLabel: "productNo",
    items: pendingItems,
    label,
    getSourceId: (item) => item.productNo,
    fetchDetail: (item) => fetchSyncableNaverDetail(item.productNo),
    createRow: createNaverWebnovelRow,
    knownIds
  });
}

async function syncNaverGenre({ genre, maxPages, existingIds }) {
  console.error(`[naver] collecting ids for genre=${genre}`);
  const collected = await collectNaverProductIds({
    maxPages,
    genreCode: genre,
    onPage: ({ page, count, total }) => {
      console.error(`[naver] collected ids page=${page} count=${count} total=${total}`);
    }
  });
  const items = collected.items;

  console.error(`[naver] collected ids total=${items.length}`);
  const synced = await syncNaverItems({
    items,
    existingIds,
    label: `genre=${genre}`
  });

  return {
    platform: "N",
    genre,
    total: items.length,
    synced
  };
}

async function syncNaverOngoing() {
  console.error("[naver] loading ongoing rows from db");
  const sourceRows = await listOngoingSourceRows("N");
  const sourceIds = sourceRows.map((row) => String(row.source_id));
  console.error(`[naver] ongoing ids total=${sourceIds.length}`);
  const synced = await syncDetailItems({
    platform: "N",
    logPrefix: "naver",
    sourceLabel: "productNo",
    items: sourceIds,
    label: "ongoing",
    getSourceId: (sourceId) => sourceId,
    fetchDetail: (sourceId) => fetchSyncableNaverDetail(sourceId),
    createRow: createNaverWebnovelRow,
    afterUpsert: async ({ row, sourceId }) => {
      const historyRow = createWebnovelHistoryRow({
        row
      });

      if (historyRow == null) {
        return;
      }

      await upsertWebnovelHistory(historyRow);

      console.error(
        `[naver] ongoing history productNo=${sourceId} view=${historyRow.view_count} comment=${historyRow.comment_count}`
      );
    }
  });

  return {
    platform: "N",
    mode: "ongoing",
    total: sourceIds.length,
    synced
  };
}

async function syncLatestNaver({ maxPages } = {}) {
  const dbCutoffDate = await getPlatformLatestSerializedAt("N");
  const cutoffDate = shiftDateByDays(dbCutoffDate, -1);
  const resolvedMaxPages = maxPages;
  console.error(
    `[naver] latest collecting ids dbCutoffDate=${dbCutoffDate ?? "none"} cutoffDate=${cutoffDate ?? "none"} maxPages=${resolvedMaxPages ?? "all"}`
  );
  const { items } = await collectNaverProductIds({
    maxPages: resolvedMaxPages,
    cutoffDate,
    onPage: ({ page, count, total }) => {
      console.error(`[naver] latest collected ids page=${page} count=${count} total=${total}`);
    }
  });
  console.error(`[naver] latest collected ids total=${items.length}`);
  console.error("[naver] latest loading non-complete ids from db");
  const existingIds = await listPlatformSourceIds("N", {
    excludeStatuses: ["완결"]
  });
  console.error(`[naver] latest non-complete ids total=${existingIds.size}`);
  const totalSynced = await syncNaverItems({
    items,
    existingIds,
    label: "latest"
  });
  const ongoingResult = await syncNaverOngoing();

  return {
    platform: "N",
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
    platform: "N",
    platformName: "Naver",
    scriptPath: "src/cli/naver.js",
    genres: NAVER_GENRES,
    syncLatest: syncLatestNaver,
    syncGenre: syncNaverGenre,
    loadExistingIds: loadExistingNaverIds
  });

  if (!completed) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
