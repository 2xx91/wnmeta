import { sleep } from "./http.js";
import { recordFailedSourceId } from "./failure-log.js";
import { upsertWebnovels } from "./supabase.js";
import { findNullRequiredFields } from "./webnovels.js";

export async function syncDetailItems({
  platform,
  logPrefix,
  sourceLabel,
  items,
  label,
  getSourceId,
  fetchDetail,
  createRow,
  knownIds,
  getPreviousRow,
  afterUpsert,
  delayMs = 0
}) {
  let synced = 0;

  for (const item of items) {
    const sourceId = String(getSourceId(item));

    try {
      const detail = await fetchDetail(item);
      if (detail != null) {
        const row = createRow(detail);
        const previousRow = getPreviousRow?.(sourceId) ?? null;
        const missingFields = findNullRequiredFields(row);

        if (missingFields.length > 0) {
          await recordFailedSourceId(platform, sourceId);
          console.error(
            `[${logPrefix}] failed ${sourceLabel}=${sourceId} missing=${missingFields.join(",")}`
          );
          console.error(`[${logPrefix}] ${label} synced ${synced}/${items.length}`);

          if (delayMs > 0) {
            await sleep(delayMs);
          }

          continue;
        }

        await upsertWebnovels([row]);
        await afterUpsert?.({
          sourceId,
          row,
          previousRow
        });
        knownIds?.add(String(row.source_id));
        synced += 1;
      }
    } catch (error) {
      await recordFailedSourceId(platform, sourceId);
      console.error(`[${logPrefix}] failed ${sourceLabel}=${sourceId} ${error.message}`);
    }

    console.error(`[${logPrefix}] ${label} synced ${synced}/${items.length}`);

    if (delayMs > 0) {
      await sleep(delayMs);
    }
  }

  return synced;
}
