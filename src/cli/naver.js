#!/usr/bin/env node

import { NAVER_GENRES, collectNaverProductIds, fetchNaverSeriesDetail } from "../providers/naver.js";
import {
  getKstDateOnly,
  loadExistingPlatformIds,
  runPlatformCli,
  shiftDateByDays
} from "../lib/platform-cli.js";
import {
  listCompletedSourceRows,
  listPlatformSourceIds,
  listOngoingSourceRows,
  upsertWebnovelHistory,
  updateWebnovelStatus
} from "../lib/supabase.js";
import { syncDetailItems } from "../lib/detail-sync.js";
import { createWebnovelHistoryRow } from "../lib/webnovel-history.js";
import { filterStoppedDetail } from "../lib/stopped-detail.js";
import { createNaverWebnovelRow } from "../lib/webnovels.js";

const IGNORED_NAVER_GENRES = new Set(["미스터리", "라이트노벨"]);

function isStoppedNaverDetail(detail) {
  return detail?.status === "중단";
}

function shouldIgnoreNaverDetail(detail) {
  const genre = String(detail?.genre ?? "").trim();
  return IGNORED_NAVER_GENRES.has(genre);
}

async function fetchSyncableNaverDetail(sourceId) {
  const detail = await fetchNaverSeriesDetail(Number(sourceId));
  const syncableDetail = await filterStoppedDetail({
    detail,
    isStoppedDetail: isStoppedNaverDetail,
    updateStatus: updateWebnovelStatus,
    platform: "N",
    sourceId: String(sourceId),
    logPrefix: "naver",
    sourceLabel: "productNo"
  });

  if (syncableDetail == null) {
    return null;
  }

  if (shouldIgnoreNaverDetail(syncableDetail)) {
    console.error(`[naver] skipped ignored genre productNo=${sourceId} genre=${syncableDetail.genre}`);
    return null;
  }

  return syncableDetail;
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
        `[naver] ongoing history productNo=${sourceId} view=${historyRow.view_count} rating=${historyRow.rating ?? "null"} comment=${historyRow.comment_count}`
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

async function syncNaverCompleted() {
  console.error("[naver] loading completed rows from db");
  const sourceRows = await listCompletedSourceRows("N");
  const sourceIds = sourceRows.map((row) => String(row.source_id));
  console.error(`[naver] completed ids total=${sourceIds.length}`);
  const synced = await syncDetailItems({
    platform: "N",
    logPrefix: "naver",
    sourceLabel: "productNo",
    items: sourceIds,
    label: "completed",
    getSourceId: (sourceId) => sourceId,
    fetchDetail: (sourceId) => fetchSyncableNaverDetail(sourceId),
    createRow: createNaverWebnovelRow
  });

  return {
    platform: "N",
    mode: "completed",
    total: sourceIds.length,
    synced
  };
}

async function syncLatestNaver({ maxPages } = {}) {
  const ongoingResult = await syncNaverOngoing();
  const runDate = getKstDateOnly();
  const cutoffDate = shiftDateByDays(runDate, -1);
  const resolvedMaxPages = maxPages;
  console.error(
    `[naver] latest collecting ids runDate=${runDate} cutoffDate=${cutoffDate ?? "none"} maxPages=${resolvedMaxPages ?? "all"}`
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

  return {
    platform: "N",
    mode: "latest",
    runDate,
    cutoffDate,
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
    syncCompleted: syncNaverCompleted,
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
